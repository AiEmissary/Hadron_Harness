import { CollaborationReplayUnavailable } from './client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProposalSessionStatus } from '../../../../../shared/collaboration'
import { CollaborationSupervisor, type CollaborationView } from './supervisor'
const status = (sessionId = 'one', revision = 1): ProposalSessionStatus => ({ schemaVersion: 1,
  sessionId, conversationId: 'c', phase: 'independent_proposals', status: 'running', revision,
  limits: { deadlineMs: 1000, maxRequestsPerParticipant: 1 }, error: null, artifacts: [],
  participants: ['a', 'b'].map(id => ({ id, provider: 'openaichatgpt', modelName: 'model', status: 'running', runId: id, streamId: sessionId + id })) })
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
function fixture() {
  let view: CollaborationView
  const attachments: Array<{ signal: AbortSignal; frame: (frame: any) => void; reject: (error: Error) => void; resolve: (value: any) => void }> = []
  const client = { transcript: vi.fn(async () => ({ schemaVersion: 1 as const, sessionId: 'one', participantId: 'a', runId: 'a', status: 'completed' as const, text: 'Saved A', verified: false as const })), status: vi.fn(async (id: string, _signal?: AbortSignal) => status(id)),
    stop: vi.fn(async (id: string): Promise<ProposalSessionStatus> => ({ ...status(id, 2), status: 'stopping' as const })),
    stream: vi.fn((_session: string, _stream: string, _seq: number, signal: AbortSignal, frame: (frame: any) => void) =>
      new Promise<{ cursor: number; terminal: true }>((resolve, reject) => attachments.push({ signal, frame, reject, resolve }))) }
  const supervisor = new CollaborationSupervisor(client, next => { view = next }, 100)
  return { client, supervisor, attachments, view: () => view! }
}
afterEach(() => vi.useRealTimers())
describe('dual stream supervisor', () => {
  it('keeps A/B output and replay cursors independent, with explicit reconnect only', async () => {
    const f = fixture(); f.supervisor.watch('one'); await flush()
    f.attachments[0].frame({ seq: 1, type: 'chunk', part: 'text', delta: 'A' })
    f.attachments[1].frame({ seq: 1, type: 'chunk', part: 'text', delta: 'B' })
    f.attachments[0].frame({ seq: 1, type: 'chunk', part: 'text', delta: 'duplicate' })
    f.attachments[0].reject(new Error('offline')); await flush()
    expect(f.client.stream).toHaveBeenCalledTimes(2)
    expect(f.view().panes.a.error).toContain('Reconnect')
    f.supervisor.reconnect('a'); await flush()
    expect(f.client.stream.mock.calls[2].slice(0, 3)).toEqual(['one', 'onea', 1])
    f.attachments[2].frame({ seq: 2, type: 'chunk', part: 'text', delta: '2' })
    expect([f.view().panes.a.text, f.view().panes.b.text]).toEqual(['A2', 'B'])
    expect(f.client.stop).not.toHaveBeenCalled(); f.supervisor.dispose()
  })
  it('detaches on session replacement/unmount without Stop and fences late frames', async () => {
    const f = fixture(); f.supervisor.watch('one'); await flush()
    f.supervisor.watch('two'); await flush()
    expect(f.attachments[0].signal.aborted).toBe(true)
    f.attachments[0].frame({ seq: 1, type: 'chunk', part: 'text', delta: 'stale' })
    expect(f.view().panes.a.text).toBe('')
    f.supervisor.dispose()
    expect(f.attachments.every(a => a.signal.aborted)).toBe(true)
    expect(f.client.stop).not.toHaveBeenCalled()
  })
  it('only explicit Stop sends one cancellation and keeps observing server state', async () => {
    const f = fixture(); f.supervisor.watch('one'); await flush()
    await f.supervisor.stop(); await flush()
    expect(f.client.stop).toHaveBeenCalledTimes(1)
    expect(f.client.stop).toHaveBeenCalledWith('one')
    expect(f.view().status?.revision).toBe(2)
    f.supervisor.dispose()
  })
  it('polls only status and never reopens terminal streams', async () => {
    vi.useFakeTimers()
    const f = fixture(); f.supervisor.watch('one'); await flush()
    f.attachments[0].frame({ seq: 1, type: 'complete', result: 'Final A' })
    f.attachments[0].resolve({ cursor: 1, terminal: true }); await flush()
    f.supervisor.reconnect('a'); await flush()
    expect(f.client.stream).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(100)
    expect(f.client.status.mock.calls.length).toBeGreaterThan(1)
    expect(f.view().panes.a.text).toBe('Final A')
    f.supervisor.dispose()
  })
  it('shows status failure without automatic retry and recovers via explicit reconnect', async () => {
    const f = fixture(); f.client.status.mockRejectedValueOnce(new Error('auth'))
    f.supervisor.watch('one'); await flush()
    expect(f.view().error).toContain('Reconnect')
    expect(f.client.stream).not.toHaveBeenCalled()
    f.supervisor.reconnect(); await flush()
    expect(f.client.stream).toHaveBeenCalledTimes(2)
    f.supervisor.dispose()
  })
})


it('ignores late status and Stop acknowledgments from the previous session', async () => {
  const f = fixture()
  let statusDone!: (value: ProposalSessionStatus) => void
  let stopDone!: (value: ProposalSessionStatus) => void
  f.client.status.mockImplementationOnce(() => new Promise(resolve => { statusDone = resolve }))
  f.client.stop.mockImplementationOnce(() => new Promise(resolve => { stopDone = resolve }))
  f.supervisor.watch('one')
  const stopping = f.supervisor.stop()
  f.supervisor.watch('two'); await flush()
  statusDone(status('one', 99)); stopDone(status('one', 100)); await stopping; await flush()
  expect(f.view().sessionId).toBe('two')
  expect(f.view().status?.sessionId).toBe('two')
  expect(f.client.stream.mock.calls.every(([id]) => id === 'two')).toBe(true)
  f.supervisor.dispose()
})

it('rejects sequence gaps without advancing the saved replay position', async () => {
  const f = fixture(); f.supervisor.watch('one'); await flush()
  expect(() => f.attachments[0].frame({ type: 'chunk', part: 'text', delta: 'lost', seq: 2 })).toThrow('gap')
  expect(f.view().panes.a.cursor).toBe(0)
  expect(f.view().panes.a.text).toBe('')
  f.supervisor.dispose()
})


it('recovers saved response only for missing live replay without a new provider call', async () => {
  const f = fixture(); f.supervisor.watch('one'); await flush()
  f.attachments[0].reject(new CollaborationReplayUnavailable()); await flush()
  expect(f.client.transcript).toHaveBeenCalledWith('one', 'a', expect.any(AbortSignal))
  expect(f.view().panes.a.text).toBe('Saved A')
  expect(f.view().panes.a.terminal).toBe(true)
  expect(f.client.stream).toHaveBeenCalledTimes(2)
  expect(f.client.stop).not.toHaveBeenCalled(); f.supervisor.dispose()
})

it('does not attempt saved recovery for authorization or ordinary disconnect errors', async () => {
  const f = fixture(); f.supervisor.watch('one'); await flush()
  f.attachments[0].reject(new Error('unauthorized')); await flush()
  expect(f.client.transcript).not.toHaveBeenCalled()
  expect(f.view().panes.a.error).toContain('Reconnect')
  f.supervisor.dispose()
})


it('fences late saved recovery after switching sessions', async () => {
  const f = fixture(); let resolve!: (value: Awaited<ReturnType<typeof f.client.transcript>>) => void
  f.client.transcript.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  f.supervisor.watch('one'); await flush()
  f.attachments[0].reject(new CollaborationReplayUnavailable()); await flush()
  f.supervisor.watch('two'); await flush()
  resolve({ schemaVersion: 1, sessionId: 'one', participantId: 'a', runId: 'a', status: 'completed', text: 'Old private text', verified: false })
  await flush()
  expect(f.view().sessionId).toBe('two')
  expect(f.view().panes.a.text).toBe('')
  expect(f.client.stop).not.toHaveBeenCalled(); f.supervisor.dispose()
})
