import { expect, it, vi } from 'vitest'
import type { ProposalSessionPage, ProposalSessionStatus } from '../../../../../shared/collaboration'
import { emptySavedSessions, SavedSessionsController } from './sessions'
const summary = (id: string, conversationId = 'c') => ({ sessionId: id, conversationId, phase: 'independent_proposals' as const,
  status: 'completed' as const, revision: 1, participants: ['a', 'b'].map(id => ({ id, provider: 'openaichatgpt' as const, modelName: 'model' })) })
const page = (ids: string[], nextBefore: string | null = null): ProposalSessionPage => ({ schemaVersion: 1, sessions: ids.map(id => summary(id)), nextBefore })
const status = (id: string, conversationId = 'c'): ProposalSessionStatus => ({ ...summary(id, conversationId), schemaVersion: 1,
  limits: { deadlineMs: 1000, maxRequestsPerParticipant: 1 }, artifacts: [], error: null,
  participants: summary(id).participants.map(p => ({ ...p, status: 'completed', runId: p.id, streamId: p.id })) })
const flush = async () => { for(let i = 0; i < 8; i++) await Promise.resolve() }
function fixture() {
  let view = emptySavedSessions()
  const client = { list: vi.fn(async (_conversationId: string, _before?: string, _signal?: AbortSignal) => page(['c', 'b'], 'b')),
    status: vi.fn(async (id: string, _signal?: AbortSignal) => status(id)) }
  const controller = new SavedSessionsController(client, next => { view = next })
  return { client, controller, view: () => view }
}
it('pages explicitly and authorizes every saved-session selection without launching inference', async () => {
  const f = fixture(); f.controller.open('c'); await flush()
  f.client.list.mockResolvedValueOnce(page(['a']))
  await f.controller.more()
  expect(f.view().sessions.map(s => s.sessionId)).toEqual(['c', 'b', 'a'])
  expect(f.client.list.mock.calls[1].slice(0, 2)).toEqual(['c', 'b'])
  await f.controller.select('a'); expect(f.view().selected?.sessionId).toBe('a')
  await f.controller.select('a'); expect(f.client.status).toHaveBeenCalledTimes(2)
  f.client.status.mockRejectedValueOnce(new Error('revoked')); await f.controller.select('a')
  expect(f.view().selected).toBeNull(); expect(f.view().error).toContain('access')
  f.controller.dispose()
})
it('fences late page and authorization responses after conversation change and disposal', async () => {
  const f = fixture(); f.controller.open('c'); await flush()
  let release!: (value: ProposalSessionStatus) => void
  f.client.status.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const selection = f.controller.select('c')
  f.client.list.mockResolvedValueOnce({ ...page([]) }); f.controller.open('other'); await flush()
  release(status('c')); await selection
  expect(f.view().conversationId).toBe('other'); expect(f.view().selected).toBeNull()
  expect(f.client.status.mock.calls[0][1]?.aborted).toBe(true)
  f.controller.dispose(); expect(() => f.controller.open('c')).toThrow('disposed')
})
it('rejects cross-conversation selection and nonprogressing page cursors', async () => {
  const f = fixture(); f.controller.open('c'); await flush()
  f.client.status.mockResolvedValueOnce(status('b', 'other')); await f.controller.select('b')
  expect(f.view().selected).toBeNull()
  f.client.list.mockResolvedValueOnce(page(['b'], 'b')); await f.controller.more()
  expect(f.view().error).toContain('unavailable')
  f.controller.dispose()
})
it('never reads an undiscovered session and ignores a late page after unmount', async () => {
  const f = fixture(); let release!: (value: ProposalSessionPage) => void
  f.client.list.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  f.controller.open('c'); await f.controller.select('unknown')
  expect(f.client.status).not.toHaveBeenCalled()
  f.controller.dispose(); release(page(['late'])); await flush()
  expect(f.view().sessions).toEqual([])
})
