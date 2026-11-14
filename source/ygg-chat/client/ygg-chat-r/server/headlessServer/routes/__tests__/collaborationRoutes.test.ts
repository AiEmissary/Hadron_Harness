import express from 'express'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerCollaborationRoutes } from '../collaborationRoutes.js'
import { proposalSqlite } from '../../services/__tests__/fixtures/proposalSqlite.js'
import { createCollaborationSchema } from '../../persistence/collaborationSchema.js'
import { CollaborationRepo } from '../../persistence/collaborationRepo.js'
import { ProposalSessionService } from '../../services/collaboration/proposalSessionService.js'
import type { ProviderRouter } from '../../services/providerRouter.js'
import { RunSessionRegistry } from '../../services/runSessionRegistry.js'

describe('internal collaboration HTTP routes with real proposal service/SQLite', () => {
  let f: ReturnType<typeof proposalSqlite>
  let sessions: CollaborationRepo
  let service: ProposalSessionService
  let server: ReturnType<ReturnType<typeof express>['listen']>
  let origin: string
  let input: any
  let access: boolean
  let enabled: boolean
  let pending: Array<() => void>
  let generate: ReturnType<typeof vi.fn>
  let streams: RunSessionRegistry
  const base = '/api/collaboration/proposals'

  beforeEach(() => {
    access = enabled = true
    streams = new RunSessionRegistry({ bufferCap: 2 })
    pending = []
    generate = vi.fn(async (_provider, request) => new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Stopped', 'AbortError'))
      if (request.signal.aborted) return abort()
      request.signal.addEventListener('abort', abort, { once: true })
      pending.push(() => { request.signal.removeEventListener('abort', abort); resolve({ content: 'Unverified proposal' }) })
    }))
    f = proposalSqlite({ generate } as unknown as ProviderRouter)
    createCollaborationSchema(f.db)
    sessions = new CollaborationRepo({ db: f.db })
    service = new ProposalSessionService({ ...f, sessions, allowedModels: new Set(['model-a', 'model-b']),
      authorizeConversation: owner => { if (owner !== 'owner' || !access) throw new Error('Revoked') },
      authorize: owner => { if (owner !== 'owner' || !access) throw new Error('Revoked') } })
    input = { schemaVersion: 1, sessionId: 'route-session', conversationId: 'c1', sourceLineageId: f.source.id,
      anchorMessageId: f.anchor.id, task: 'Shared private task', context: 'Frozen context',
      participants: [{ id: 'a', provider: 'openaichatgpt', modelName: 'model-a' },
        { id: 'b', provider: 'openaichatgpt', modelName: 'model-b' }] }
    const app = express()
    app.use(express.json())
    registerCollaborationRoutes(app, { get enabled() { return enabled }, service, streams,
      // Synthetic authenticated transport for tests; production wiring is absent.
      authenticatedOwner: req => req.get('x-test-principal') ?? null })
    server = app.listen(0, '127.0.0.1')
  })
  afterEach(async () => {
    access = true
    service.stop('owner', input.sessionId)
    await vi.waitFor(() => expect(f.db.prepare("SELECT COUNT(*) AS n FROM subagent_runs WHERE status = 'running'").get().n).toBe(0))
    await new Promise<void>(resolve => server.close(() => resolve()))
    f.close()
  })
  async function request(path = '', method = 'GET', body?: unknown, owner: string | null = 'owner') {
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const response = await fetch(`${origin}${base}${path}`, { method,
      headers: { 'content-type': 'application/json', ...(owner ? { 'x-test-principal': owner } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }

  it('discovers only owned conversation sessions with bounded pages and no private packet or inference', async () => {
    for (const sessionId of ['page-a', 'page-b', 'page-c']) {
      const config = { ...input, sessionId, limits: { deadlineMs: 120000, maxRequestsPerParticipant: 1 } }
      sessions.create({ id: sessionId, ownerId: 'owner', conversationId: 'c1', sourceLineageId: f.source.id,
        anchorMessageId: f.anchor.id, configJson: JSON.stringify(config), configHash: sessionId, participantIds: ['a', 'b'] })
    }
    const config = { ...input, sessionId: 'foreign', limits: { deadlineMs: 120000, maxRequestsPerParticipant: 1 } }
    sessions.create({ id: 'foreign', ownerId: 'another-owner', conversationId: 'c1', sourceLineageId: f.source.id,
      anchorMessageId: f.anchor.id, configJson: JSON.stringify(config), configHash: 'foreign', participantIds: ['a', 'b'] })
    const first = await request('?conversationId=c1&limit=2')
    expect(first.status).toBe(200)
    expect(first.body.sessions.map((s: any) => s.sessionId)).toEqual(['page-c', 'page-b'])
    expect(first.body.nextBefore).toBe('page-b')
    const next = await request('?conversationId=c1&limit=2&before=page-b')
    expect(next.body.sessions.map((s: any) => s.sessionId)).toEqual(['page-a'])
    expect(next.body.nextBefore).toBeNull()
    expect(JSON.stringify(first.body)).not.toMatch(/Shared private task|Frozen context|handle|streamId|runId/)
    expect(generate).not.toHaveBeenCalled()
    expect((await request('?conversationId=c1', 'GET', undefined, null)).status).toBe(401)
    access = false
    expect((await request('?conversationId=c1')).status).toBe(403)
    access = true; enabled = false
    expect((await request('?conversationId=c1')).status).toBe(404)
  })

  it('rejects invalid discovery pagination before repository reads', async () => {
    for (const query of ['', '?conversationId=c1&limit=51', '?conversationId=c1&limit=-1', '?conversationId=c1&limit=1.5', '?conversationId=c1&before=', '?conversationId=c1&conversationId=c2']) {
      expect((await request(query)).status).toBe(400)
    }
    expect(generate).not.toHaveBeenCalled()
  })

  it('recovers only settled owned participant output and never exposes task packets or restarts inference', async () => {
    await request('', 'POST', input)
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    expect((await request('/route-session/participants/a/transcript')).status).toBe(404)
    pending.forEach(resolve => resolve())
    await vi.waitFor(() => expect(service.status('owner', input.sessionId)?.status).toBe('completed'))
    const saved = await request('/route-session/participants/a/transcript')
    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({ sessionId: 'route-session', participantId: 'a', text: 'Unverified proposal', verified: false })
    expect(JSON.stringify(saved.body)).not.toMatch(/Shared private task|Frozen context|handle|thinking/)
    expect((await request('/route-session/participants/unknown/transcript')).status).toBe(404)
    expect((await request('/route-session/participants/a/transcript', 'GET', undefined, 'intruder')).status).toBe(403)
    access = false
    expect((await request('/route-session/participants/a/transcript')).status).toBe(403)
    access = true; enabled = false
    expect((await request('/route-session/participants/a/transcript')).status).toBe(404)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('admits immediately, deduplicates, reports streams and returns canonical unverified artifacts', async () => {
    expect((await request('', 'POST', input)).status).toBe(202)
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    expect((await request('', 'POST', input)).status).toBe(202)
    const running = await request('/route-session')
    expect(running.body.status).toBe('running')
    expect(running.body.participants.every((p: any) => p.runId && p.streamId && !('handle' in p))).toBe(true)
    expect(JSON.stringify(running.body)).not.toContain(input.task)
    pending.forEach(finish => finish())
    await vi.waitFor(() => expect(sessions.get(input.sessionId, 'owner')?.status).toBe('completed'))
    const done = await request('/route-session')
    expect(done.body.artifacts).toHaveLength(2)
    expect(done.body.artifacts.every((a: any) => a.kind === 'proposal' && a.verified === false && a.lineageId && a.messageId)).toBe(true)
    expect((await request('', 'POST', input)).body.artifacts).toEqual(done.body.artifacts)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('closes disabled and unauthenticated entry points before any inference or persistence', async () => {
    enabled = false
    expect((await request('', 'POST', input)).status).toBe(404)
    enabled = true
    expect((await request('', 'POST', input, null)).status).toBe(401)
    expect((await request('', 'POST', { ...input, ownerId: 'owner' }, null)).status).toBe(401)
    expect(sessions.get(input.sessionId, 'owner')).toBeNull()
    expect(generate).not.toHaveBeenCalled()
  })

  it.each(['provider', 'authority'])('rejects invalid %s fields without dispatch', async kind => {
    const body = JSON.parse(JSON.stringify(input))
    if (kind === 'provider') body.participants[0].provider = 'unknown-provider'
    else body.autoApprove = true
    expect((await request('', 'POST', body)).status).toBe(400)
    expect(generate).not.toHaveBeenCalled()
  })

  it('rejects changed configuration and cross-owner reads/stops without cancelling the owner', async () => {
    await request('', 'POST', input)
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    expect((await request('', 'POST', { ...input, context: 'changed' })).status).toBe(409)
    expect((await request('/route-session', 'GET', undefined, 'intruder')).status).toBe(403)
    expect((await request('/route-session/stop', 'POST', {}, 'intruder')).status).toBe(403)
    expect(sessions.get(input.sessionId, 'owner')?.status).toBe('running')
    expect((await request('/route-session/stop', 'POST', {})).status).toBe(202)
    await vi.waitFor(() => expect(sessions.get(input.sessionId, 'owner')?.status).toBe('cancelled'))
    expect((await request('/missing')).status).toBe(404)
  })

  it('rechecks revoked workspace access on read and Stop', async () => {
    await request('', 'POST', input)
    access = false
    expect((await request('/route-session')).status).toBe(403)
    expect((await request('/route-session/stop', 'POST', {})).status).toBe(403)
    expect(sessions.get(input.sessionId, 'owner')?.status).toBe('running')
  })

  it('observes asynchronous provider failure and returns a durable sanitized failure status', async () => {
    generate.mockRejectedValue(new Error('synthetic private provider diagnostic'))
    expect((await request('', 'POST', input)).status).toBe(202)
    await vi.waitFor(() => expect(sessions.get(input.sessionId, 'owner')?.status).toBe('failed'))
    const failed = await request('/route-session')
    expect(failed.status).toBe(200)
    expect(failed.body.status).toBe('failed')
    expect(failed.body.artifacts).toEqual([])
    expect(JSON.stringify(failed.body)).not.toContain('private provider diagnostic')
    expect((await request('', 'POST', input)).status).toBe(409)
  })

  async function ownedStream() {
    await request('', 'POST', input)
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    const streamId = service.status('owner', input.sessionId)!.participants[0].streamId!
    return { streamId, stream: streams.create(streamId, 'c1', 'collaboration'),
      url: `${origin}${base}/route-session/streams/${streamId}` }
  }
  const streamHeaders = { 'x-test-principal': 'owner' }

  it('replays only owned stream frames after the cursor and refuses other owners/streams', async () => {
    const { stream, url } = await ownedStream()
    stream.publish({ type: 'chunk', part: 'text', delta: 'first' } as any)
    stream.publish({ type: 'complete', result: 'done' } as any)
    const response = await fetch(`${url}?fromSeq=1`, { headers: streamHeaders })
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('"seq":2')
    expect(body).not.toContain('first')
    expect((await fetch(url, { headers: { 'x-test-principal': 'intruder' } })).status).toBe(403)
    expect((await request('/route-session/streams/unowned')).status).toBe(404)
    expect((await fetch(`${url}?fromSeq=-1`, { headers: streamHeaders })).status).toBe(400)
    expect((await fetch(`${url}?fromSeq=900`, { headers: streamHeaders })).status).toBe(409)
  })

  it('rejects a truncated initial cursor instead of silently sending an incomplete history', async () => {
    const { stream, url } = await ownedStream()
    stream.publish({ type: 'chunk', part: 'text', delta: 'lost' } as any)
    stream.publish({ type: 'chunk', part: 'text', delta: 'retained' } as any)
    stream.publish({ type: 'complete' } as any)
    expect((await fetch(url, { headers: streamHeaders })).status).toBe(409)
    const replay = await fetch(`${url}?fromSeq=2`, { headers: streamHeaders })
    expect(await replay.text()).toContain('"seq":3')
  })

  it('detaches on disconnect without cancelling inference and reconnects without a new launch', async () => {
    const { stream, url } = await ownedStream()
    const response = await fetch(url, { headers: streamHeaders })
    await response.body!.cancel()
    await vi.waitFor(() => expect(stream.hasSubscriber()).toBe(false))
    expect(stream.signal.aborted).toBe(false)
    expect(sessions.get(input.sessionId, 'owner')?.status).toBe('running')
    stream.publish({ type: 'chunk', part: 'text', delta: 'retained while detached' } as any)
    stream.publish({ type: 'complete' } as any)
    const replay = await fetch(url, { headers: streamHeaders })
    expect(await replay.text()).toContain('retained while detached')
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('rechecks access before live frames and never forwards text after revocation', async () => {
    const { stream, url } = await ownedStream()
    const response = await fetch(url, { headers: streamHeaders })
    access = false
    stream.publish({ type: 'chunk', part: 'text', delta: 'private-after-revoke' } as any)
    const body = await response.text()
    expect(body).toContain('access_revoked')
    expect(body).not.toContain('private-after-revoke')
    expect(stream.signal.aborted).toBe(false)
  })

  it('closes idle replay after access revocation without cancelling the owned run', async () => {
    const { stream, url } = await ownedStream()
    const response = await fetch(url, { headers: streamHeaders })
    access = false
    expect(await response.text()).toContain('access_revoked')
    expect(stream.signal.aborted).toBe(false)
  })

  it('allows explicit Stop while attached and then replays the producer terminal frame', async () => {
    const { stream, url } = await ownedStream()
    const response = await fetch(url, { headers: streamHeaders })
    expect((await request('/route-session/stop', 'POST', {})).status).toBe(202)
    await vi.waitFor(() => expect(sessions.get(input.sessionId, 'owner')?.status).toBe('cancelled'))
    stream.publish({ type: 'error', aborted: true, error: 'Stopped' } as any)
    expect(await response.text()).toContain('"aborted":true')
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('rejects a registry stream with the wrong conversation even when its ID matches', async () => {
    const { streamId, url } = await ownedStream()
    streams.delete(streamId)
    streams.create(streamId, 'other-conversation', 'collaboration')
    expect((await fetch(url, { headers: streamHeaders })).status).toBe(410)
  })
})
