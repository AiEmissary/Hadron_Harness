import express from 'express'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerChatRoutes } from '../chatRoutes.js'
import { RunSessionRegistry } from '../../services/runSessionRegistry.js'

describe('generic route collaboration stream fence', () => {
  let registry: RunSessionRegistry
  let server: ReturnType<ReturnType<typeof express>['listen']>
  let origin: string
  let runMessage: ReturnType<typeof vi.fn>
  beforeEach(async () => {
    registry = new RunSessionRegistry({ isCollaborationStream: id => id === 'persisted' })
    registry.create('owned', 'c', 'collaboration').publish({ type: 'chunk', part: 'text', delta: 'private text' } as any)
    const app = express()
    app.use(express.json())
    runMessage = vi.fn(async () => {})
    registerChatRoutes(app, { orchestrator: { runMessage } as any, runSessions: registry, resumableRuns: true })
    server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())) })
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${origin}${path}`, { method, headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: await response.text() }
  }
  it('blocks generic GET, abort and duplicate chat POST before replay/cancel/inference', async () => {
    const session = registry.get('owned')!
    expect((await request('/api/streams/owned')).status).toBe(403)
    expect((await request('/api/streams/owned/abort', 'POST', {})).status).toBe(403)
    expect((await request('/api/conversations/c/messages', 'POST', { streamId: 'owned', content: 'hijack' })).status).toBe(403)
    expect(session.signal.aborted).toBe(false)
    expect(session.hasSubscriber()).toBe(false)
    expect(runMessage).not.toHaveBeenCalled()
  })
  it('preserves ordinary replay and abort behavior', async () => {
    const ordinary = registry.create('ordinary', 'c')
    ordinary.publish({ type: 'complete' } as any)
    const replay = await request('/api/streams/ordinary')
    expect(replay.status).toBe(200)
    expect(replay.body).toContain('complete')
    expect((await request('/api/streams/ordinary/abort', 'POST', {})).status).toBe(200)
  })
  it('retains the collaboration fence after eviction and refuses scope replacement', async () => {
    const session = registry.get('owned')!
    expect(() => registry.replace('owned', 'c')).toThrow()
    expect(session.signal.aborted).toBe(false)
    registry.delete('owned')
    expect(() => registry.create('owned', 'c')).toThrow('scope')
    expect((await request('/api/streams/owned')).status).toBe(403)
    expect((await request('/api/conversations/c/messages', 'POST', { streamId: 'owned' })).status).toBe(403)
    expect((await request('/api/streams/persisted')).status).toBe(403)
    expect((await request('/api/streams/persisted/abort', 'POST', {})).status).toBe(403)
    expect((await request('/api/conversations/c/messages', 'POST', { streamId: 'persisted' })).status).toBe(403)
    expect(() => registry.create('persisted', 'c')).toThrow('scope')
  })
})
