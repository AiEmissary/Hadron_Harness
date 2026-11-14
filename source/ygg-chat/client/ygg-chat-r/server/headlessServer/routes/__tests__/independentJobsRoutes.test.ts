import express from 'express'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { proposalSqlite } from '../../services/__tests__/fixtures/proposalSqlite.js'
import { createIndependentJobsSchema } from '../../persistence/independentJobsSchema.js'
import { IndependentJobsRepo } from '../../persistence/independentJobsRepo.js'
import { IndependentJobService } from '../../services/collaboration/independentJobService.js'
import { registerIndependentJobsRoutes } from '../independentJobsRoutes.js'
import { IndependentJobContexts } from '../../services/collaboration/independentJobContexts.js'
import { RunSessionRegistry } from '../../services/runSessionRegistry.js'
import type { ProviderRouter } from '../../services/providerRouter.js'
import { AgentJobJournal } from '../../services/collaboration/agentJobJournal.js'
import { mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
let f: ReturnType<typeof proposalSqlite>, jobs: IndependentJobsRepo, service: IndependentJobService, streams: RunSessionRegistry
let server: ReturnType<ReturnType<typeof express>['listen']>, origin: string, enabled: boolean, access: boolean, a: any, b: any
let pending: Array<{ input: any; finish: () => void }>, generate: ReturnType<typeof vi.fn>
let journalDirectory: string
beforeEach(async () => {
  enabled = access = true; pending = []
  generate = vi.fn(async (_provider, input) => new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Stopped', 'AbortError'))
    if (input.signal.aborted) return abort()
    input.signal.addEventListener('abort', abort, { once: true })
    pending.push({ input, finish: () => { input.signal.removeEventListener('abort', abort); resolve({ content: 'Private output' }) } })
  }))
  f = proposalSqlite({ generate } as unknown as ProviderRouter)
  f.db.exec("ALTER TABLE conversations ADD COLUMN user_id TEXT; ALTER TABLE conversations ADD COLUMN title TEXT; ALTER TABLE conversations ADD COLUMN storage_mode TEXT; UPDATE conversations SET user_id='owner', storage_mode='local'")
  journalDirectory = mkdtempSync(path.join(os.tmpdir(), 'hadron-http-journal-'))
  f.db.exec('CREATE TABLE streaming_runs (stream_id TEXT PRIMARY KEY)'); createIndependentJobsSchema(f.db)
  jobs = new IndependentJobsRepo(f.db); streams = new RunSessionRegistry({ isCollaborationStream: id => jobs.ownsStreamId(id) })
  service = new IndependentJobService({ jobs, agents: f.agents, runs: f.runs, allowedModels: new Set(['model']), journal: new AgentJobJournal(journalDirectory),
    authorize: owner => { if (owner !== 'owner' || !access) throw new Error('denied') } })
  const second = f.messages.createMessage({ conversationId: 'other', parentId: null, role: 'user', content: 'B anchor' })
  a = { schemaVersion: 1, id: 'a', conversationId: 'c1', anchorMessageId: f.anchor.id, task: 'Private A', context: 'File A', provider: 'openaichatgpt', modelName: 'model' }
  b = { ...a, id: 'b', conversationId: 'other', anchorMessageId: second.id, task: 'Private B', context: 'File B' }
  const app = express(); app.use(express.json())
  registerIndependentJobsRoutes(app, { get enabled() { return enabled }, service, streams,
    contexts: new IndependentJobContexts(f.db, owner => { if (owner !== 'owner' || !access) throw new Error('denied') }), authenticatedOwner: req => req.get('x-test-owner') ?? null })
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterEach(async () => {
  access = true; service.stop('owner','a'); service.stop('owner','b')
  await vi.waitFor(() => expect(f.db.prepare("SELECT COUNT(*) AS n FROM subagent_runs WHERE status='running'").get().n).toBe(0))
  await new Promise<void>(resolve => server.close(() => resolve())); f.close()
  rmSync(journalDirectory, { recursive: true, force: true })
})
async function request(path = '', method = 'GET', body?: unknown, owner: string | null = 'owner') {
  const response = await fetch(`${origin}/api/collaboration/jobs${path}`, { method,
    headers: { 'content-type': 'application/json', ...(owner ? { 'x-test-owner': owner } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}
it('admits independently, deduplicates, and Stop A leaves B and its output untouched', async () => {
  expect((await request('', 'POST', a)).status).toBe(202); expect((await request('', 'POST', b)).status).toBe(202)
  await vi.waitFor(() => expect(pending).toHaveLength(2))
  expect((await request('', 'POST', a)).status).toBe(202)
  const state = await request('/a')
  expect(state.body).toMatchObject({ id: 'a', status: 'running', provider: 'openaichatgpt' })
  expect(JSON.stringify(state.body)).not.toMatch(/Private A|File A|handle/)
  expect((await request('/a/stop','POST',{})).status).toBe(202)
  await vi.waitFor(() => expect(service.status('owner','a')?.status).toBe('cancelled'))
  expect((await request('/b')).body.status).toBe('running')
  const second = pending.find(p => JSON.parse(p.input.userContent).task === 'Private B')!
  expect(second.input.signal.aborted).toBe(false); second.finish()
  await vi.waitFor(() => expect(service.status('owner','b')?.status).toBe('completed'))
  expect((await request('/b/transcript')).body).toMatchObject({ id: 'b', text: 'Private output', verified: false })
  expect(generate).toHaveBeenCalledTimes(2)
})
it('rejects missing/wrong owner, revoked workspace, unsupported authority/model and disabled access', async () => {
  expect((await request('', 'POST', a, null)).status).toBe(401)
  expect((await request('', 'POST', { ...a, fullAccess: true })).status).toBe(400)
  expect((await request('', 'POST', { ...a, modelName: 'unapproved' })).status).toBe(409)
  await request('', 'POST', a); await vi.waitFor(() => expect(pending).toHaveLength(1))
  expect((await request('/a', 'GET', undefined, 'intruder')).status).toBe(403)
  expect((await request('/a/stop', 'POST', {}, 'intruder')).status).toBe(403)
  access = false; expect((await request('/a')).status).toBe(403); access = true
  enabled = false
  expect((await request('/a')).status).toBe(404)
  expect((await request('/a/transcript')).status).toBe(404)
  expect(generate).toHaveBeenCalledTimes(1)
})
it('scopes replay to one job, enforces cursors and detaches without cancellation', async () => {
  await request('', 'POST', a); await request('', 'POST', b); await vi.waitFor(() => expect(pending).toHaveLength(2))
  const sa = service.status('owner','a')!, sb = service.status('owner','b')!
  const stream = streams.create(sa.streamId!, sa.conversationId, 'collaboration')
  stream.publish({ type: 'chunk', part: 'text', delta: 'A only' } as any)
  expect((await request(`/b/streams/${sa.streamId}`)).status).toBe(404)
  expect((await request(`/a/streams/${sa.streamId}?fromSeq=99`)).status).toBe(409)
  const response = await fetch(`${origin}/api/collaboration/jobs/a/streams/${sa.streamId}`, { headers: { 'x-test-owner': 'owner' } })
  const reader = response.body!.getReader(), frame = await reader.read()
  expect(new TextDecoder().decode(frame.value)).toContain('A only')
  await reader.cancel()
  expect(pending.every(p => !p.input.signal.aborted)).toBe(true)
  expect(service.status('owner','b')?.streamId).toBe(sb.streamId)
})
it('prepares a private context idempotently and scopes log/continuity reads without extra dispatch', async () => {
  const input = { schemaVersion: 1, id: 'a', sourceConversationId: 'c1', slot: 'a' }
  const prepared = await request('/contexts', 'POST', input)
  expect(prepared.status).toBe(200)
  expect((await request('/contexts', 'POST', input)).body).toEqual(prepared.body)
  expect((await request('/contexts', 'POST', input, 'intruder')).status).toBe(403)
  expect(generate).not.toHaveBeenCalled()
  await request('', 'POST', { ...a, conversationId: prepared.body.conversationId, anchorMessageId: prepared.body.anchorMessageId })
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  const log = await request('/a/journal')
  expect(log.status).toBe(200); expect(log.body.markdown).toContain('Private A')
  expect(log.body.markdown).toContain('Agent: Agent A')
  expect((await request('/a/journal', 'GET', undefined, 'intruder')).status).toBe(403)
  expect((await request('/a/journal', 'GET', undefined, null)).status).toBe(401)
  expect((await request('/a/tree')).body.nodes[0].text).toBe('Private A')
  expect((await request('/a/tree', 'GET', undefined, 'intruder')).status).toBe(403)
  expect((await request('/a/continuity')).status).toBe(500)
  pending[0].finish(); await vi.waitFor(() => expect(service.status('owner', 'a')?.status).toBe('completed'))
  const openPath = `/open?conversationId=${encodeURIComponent(prepared.body.conversationId)}`
  expect((await request(openPath)).body).toMatchObject({ requestedConversationId: prepared.body.conversationId, workspaceConversationId: 'c1', slot: 'a', nodeId: 'hadron-response-a' })
  expect((await request(openPath, 'GET', undefined, 'intruder')).status).toBe(403)
  expect((await request(openPath, 'GET', undefined, null)).status).toBe(401)
  access = false; expect((await request(openPath)).status).toBe(403); access = true
  expect((await request('/a/continuity')).body).toMatchObject({ sourceJobId: 'a', task: 'Private A' })
  expect(generate).toHaveBeenCalledTimes(1)
  enabled = false
  expect((await request('/a/journal')).status).toBe(404)
  expect((await request('/a/continuity')).status).toBe(404)
  expect((await request('/a/tree')).status).toBe(404)
  expect((await request('/contexts', 'POST', input)).status).toBe(404)
  expect((await request(openPath)).status).toBe(404)
})

it('requires current local ownership for saved agent workspaces and rejects ambiguous query scope', async () => {
  expect((await request('/workspace?conversationId=c1&slot=a')).body).toMatchObject({ schemaVersion: 1, sourceConversationId: 'c1', slot: 'a', nodes: [] })
  expect((await request('/workspace?conversationId=c1&slot=a', 'GET', undefined, null)).status).toBe(401)
  expect((await request('/workspace?conversationId=c1&slot=a', 'GET', undefined, 'intruder')).status).toBe(403)
  expect((await request('/workspace?conversationId=c1&slot=other')).status).toBe(400)
  expect((await request('/workspace?conversationId=c1&slot=a&slot=b')).status).toBe(400)
  expect(generate).not.toHaveBeenCalled()
})

it('validates history paging parameters before reading and requires an authorized workspace', async () => {
  for(const query of ['cursor=-1:j','cursor=1:unknown','cursor=1:j&cursor=2:j','focusNodeId=']) expect((await request(`/workspace?conversationId=c1&slot=a&${query}`)).status).toBe(400)
  expect((await request('/workspace?conversationId=c1&slot=a&cursor=3:j','GET',undefined,null)).status).toBe(401)
  expect((await request('/workspace?conversationId=c1&slot=a&cursor=3:j')).body.page).toEqual({nextCursor:null,size:32})
  expect(generate).not.toHaveBeenCalled()
})
