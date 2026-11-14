import { afterEach, expect, it, vi } from 'vitest'
import { IndependentJobController, type IndependentJobView, type JobReference, type JobStore } from './independentJobController'
const controllers: IndependentJobController[] = []
afterEach(() => { controllers.forEach(c => c.dispose()); controllers.length = 0; vi.useRealTimers() })
const draft = { task: 'Only my job', context: 'Only my file', provider: 'openaichatgpt' as const, modelName: 'model' }
function fixture(slot: 'a' | 'b' = 'a') {
  let saved: JobReference | null = null, view: IndependentJobView | undefined
  const store: JobStore = { read: () => saved, write: value => { saved = structuredClone(value) }, clear: () => { saved = null } }
  const state = (id: string, status = 'running', revision = 1) => ({ schemaVersion: 1 as const, id, conversationId: `chat-${slot}`, status, revision,
    provider: 'openaichatgpt' as const, modelName: 'model', runId: `run-${slot}`, streamId: `stream-${slot}` })
  const client = {
    prepare: vi.fn(async (input: any) => ({ ...input, conversationId: `chat-${slot}`, anchorMessageId: `anchor-${slot}` })),
    start: vi.fn(async (input: any) => state(input.id)), status: vi.fn(async (id: string) => state(id)),
    stop: vi.fn(async (id: string) => state(id, 'cancelled', 2)),
    transcript: vi.fn(async (id: string) => ({ schemaVersion: 1 as const, id, status: 'completed', text: `Output ${slot}`, verified: false as const })),
    stream: vi.fn(async (_id: string, _stream: string, _cursor: number, _signal: AbortSignal, _onFrame: (frame: any) => void) => ({ cursor: 0, terminal: true as const })),
  }
  const make = () => {
    const c = new IndependentJobController(client, 'source', slot, store, next => { view = next }, 100000)
    controllers.push(c); return c
  }
  return { client, store, make, state, saved: () => saved, view: () => view! }
}
it('launches only once, freezes task/files and records only identity before dispatch', async () => {
  const f = fixture(), c = f.make()
  f.client.start.mockImplementationOnce(async input => {
    expect(f.saved()).toMatchObject({ stage: 'submitted', id: input.id, conversationId: input.conversationId })
    expect(JSON.stringify(f.saved())).not.toMatch(/Only my job|Only my file|model/)
    throw new Error('Lost reply')
  })
  const mutable = { ...draft }; const launch = c.submit(mutable); mutable.task = 'Changed later'; await launch
  expect(f.client.start.mock.calls[0][0].task).toBe('Only my job')
  await expect(c.submit(draft)).rejects.toThrow('existing job')
  c.dispose(); const restored = f.make(); await restored.recover()
  expect(f.view().phase).toBe('accepted'); expect(f.client.start).toHaveBeenCalledTimes(1)
  expect(f.client.prepare).toHaveBeenCalledTimes(1)
})
it('keeps a missing or mismatched saved job fenced, including after reload', async () => {
  const f = fixture(), c = f.make()
  f.client.start.mockRejectedValueOnce(new Error('lost')); await c.submit(draft)
  f.client.status.mockRejectedValueOnce(new Error('404')); await c.recover()
  expect(f.view().phase).toBe('unknown'); expect(() => c.prepareNext()).toThrow()
  f.client.status.mockResolvedValueOnce(f.state('wrong-id')); await c.recover()
  expect(f.view().phase).toBe('unknown'); expect(f.client.start).toHaveBeenCalledTimes(1)
})
it('stops A individually while B stays running, then recovers canonical terminal output', async () => {
  const a = fixture('a'), b = fixture('b'), ca = a.make(), cb = b.make()
  await Promise.all([ca.submit(draft), cb.submit({ ...draft, task: 'Different B' })])
  a.client.status.mockImplementation(async id => a.state(id, 'cancelled', 2))
  a.client.transcript.mockImplementation(async id => ({ schemaVersion: 1, id, status: 'cancelled', text: 'Partial A', verified: false }))
  await ca.stop()
  expect(a.view().text).toBe('Partial A'); expect(b.view().status?.status).toBe('running')
  expect(b.client.stop).not.toHaveBeenCalled(); expect(a.client.start).toHaveBeenCalledTimes(1)
  ca.prepareNext(); expect(a.saved()).toBeNull(); expect(a.view().phase).toBe('ready')
})
it('does not launch after closing during preparation and never dispatches if persistence fails', async () => {
  const f = fixture(), c = f.make()
  let finish!: (value: any) => void
  f.client.prepare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const launch = c.submit(draft); c.dispose()
  finish({ ...f.saved(), conversationId: 'chat-a', anchorMessageId: 'anchor-a' }); await launch
  expect(f.client.start).not.toHaveBeenCalled()
  const restored = f.make(); await restored.recover(); expect(f.view().phase).toBe('ready')
  f.store.write = () => { throw new Error('Storage blocked') }
  await expect(restored.submit(draft)).rejects.toThrow('Storage blocked')
  expect(f.client.start).not.toHaveBeenCalled()
})
it('polls only status, rejects stale replies, and disposing never stops a provider', async () => {
  vi.useFakeTimers()
  const f = fixture(), c = f.make(); await c.submit(draft)
  f.client.status.mockImplementation(async id => f.state(id, 'running', 0))
  await vi.advanceTimersByTimeAsync(100000)
  expect(f.view().status?.revision).toBe(1); expect(f.client.status).toHaveBeenCalledTimes(1)
  c.dispose(); await vi.advanceTimersByTimeAsync(200000)
  expect(f.client.stop).not.toHaveBeenCalled(); expect(f.client.start).toHaveBeenCalledTimes(1)
})
it('reconnects at its own cursor and ignores an old stream after switching to canonical output', async () => {
  const f = fixture(), c = f.make(); await c.submit(draft)
  const old = f.client.stream.mock.calls[0][4]
  old({ type: 'chunk', part: 'text', delta: 'Visible progress', seq: 1 })
  expect(f.view().text).toBe('Visible progress')
  await c.reconnect()
  expect(f.client.stream.mock.calls[1][2]).toBe(1)
  old({ type: 'chunk', part: 'text', delta: ' stale response', seq: 2 })
  expect(f.view().text).toBe('Visible progress')
  f.client.status.mockImplementation(async id => f.state(id, 'completed', 2)); await c.recover()
  f.client.stream.mock.calls[1][4]({ type: 'chunk', part: 'text', delta: ' stale after terminal', seq: 2 })
  expect(f.view().text).toBe('Output a'); expect(f.client.start).toHaveBeenCalledTimes(1)
})
it('refreshes after Stop even when an older status poll arrives late', async () => {
  const f = fixture(), c = f.make(); await c.submit(draft)
  let release!: (value: any) => void
  f.client.status.mockImplementation(async id => f.state(id, 'cancelled', 2))
  f.client.status.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  f.client.transcript.mockImplementation(async id => ({ schemaVersion: 1, id, status: 'cancelled', text: 'Saved partial', verified: false }))
  const poll = c.recover(), stopped = c.stop()
  await vi.waitFor(() => expect(f.view().status?.status).toBe('cancelled'))
  release(f.state(f.saved()!.id, 'running', 1)); await Promise.all([poll, stopped])
  expect(f.view().status?.status).toBe('cancelled'); expect(f.view().text).toBe('Saved partial')
  expect(f.view().error).toBeNull(); expect(f.client.start).toHaveBeenCalledTimes(1)
})
it('retries status and transcript reads after a temporary failure without another Start',async()=>{
 vi.useFakeTimers()
 const f=fixture(),controller=f.make();await controller.submit(draft)
 f.client.status.mockRejectedValueOnce(Error('Temporary status failure'))
 f.client.status.mockImplementation(async id=>f.state(id,'completed',2))
 await controller.recover();expect(f.view().outputComplete).toBe(false)
 await vi.advanceTimersByTimeAsync(100000)
 expect(f.client.status).toHaveBeenCalledTimes(2)
 expect(f.view()).toMatchObject({text:'Output a',outputComplete:true})
 expect(f.client.start).toHaveBeenCalledTimes(1)
})
