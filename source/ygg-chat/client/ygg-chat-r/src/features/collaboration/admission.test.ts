import { expect, it, vi } from 'vitest'
import type { ProposalSessionInput, ProposalSessionStatus } from '../../../../../shared/collaboration'
import { CollaborationAdmission, emptyAdmission } from './admission'
const input = (): ProposalSessionInput => ({ schemaVersion: 1, sessionId: 'owned', conversationId: 'c', sourceLineageId: 'l', anchorMessageId: 'm',
  task: 'Frozen task', context: 'Frozen context', participants: ['a', 'b'].map(id => ({ id, provider: 'openaichatgpt', modelName: 'model' })) })
const status = (value: ProposalSessionStatus['status'] = 'running'): ProposalSessionStatus => ({ schemaVersion: 1, sessionId: 'owned', conversationId: 'c',
  phase: 'independent_proposals', status: value, revision: 1, limits: { deadlineMs: 1000, maxRequestsPerParticipant: 1 },
  participants: [], artifacts: [], error: null })
function fixture() {
  let state = emptyAdmission()
  const client = { start: vi.fn(async (_input: ProposalSessionInput) => status()), status: vi.fn(async (_id: string) => status()) }
  const admission = new CollaborationAdmission(client, next => { state = next })
  return { client, admission, state: () => state }
}
it('sends one frozen request and refuses duplicate or concurrent submit', async () => {
  const f = fixture(), draft = input()
  let resolve!: (status: ProposalSessionStatus) => void
  f.client.start.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const submission = f.admission.submit(draft)
  draft.task = 'Changed'; draft.participants[0].modelName = 'Changed model'
  await expect(f.admission.submit(input())).rejects.toThrow('existing session')
  resolve(status()); await submission
  expect(f.client.start).toHaveBeenCalledTimes(1)
  expect(f.client.start.mock.calls[0][0]).toMatchObject({ task: 'Frozen task', participants: [{ id: 'a', modelName: 'model' }, { id: 'b', modelName: 'model' }] })
  expect(f.state().phase).toBe('accepted')
})
it('recovers an unknown outcome only by GET and retains the fence through failed recovery', async () => {
  const f = fixture(); f.client.start.mockRejectedValueOnce(new Error('reply lost'))
  await f.admission.submit(input()); expect(f.state().phase).toBe('unknown')
  f.client.status.mockRejectedValueOnce(new Error('404')); await f.admission.recover()
  await expect(f.admission.submit(input())).rejects.toThrow()
  await f.admission.recover(); expect(f.state().phase).toBe('accepted')
  expect(f.client.status.mock.calls.every(([id]) => id === 'owned')).toBe(true)
  expect(f.client.start).toHaveBeenCalledTimes(1)
})
it('requires confirmed terminal status before an explicit next attempt', async () => {
  const f = fixture(); await f.admission.submit(input())
  expect(() => f.admission.prepareNext()).toThrow('previous session')
  f.client.status.mockResolvedValueOnce(status('completed')); await f.admission.recover()
  f.admission.prepareNext(); expect(f.state().phase).toBe('ready')
  await f.admission.submit({ ...input(), sessionId: 'next' })
  expect(f.client.start).toHaveBeenCalledTimes(2)
  expect(f.state().phase).toBe('unknown') // response identity mismatch cannot become authority
})
it('coalesces recovery reads and prevents late UI updates after disposal', async () => {
  const f = fixture(); await f.admission.submit(input())
  let resolve!: (status: ProposalSessionStatus) => void
  f.client.status.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const first = f.admission.recover(), second = f.admission.recover()
  expect(first).toBe(second)
  f.admission.dispose(); resolve(status('completed')); await first
  expect(f.state().status?.status).toBe('running')
  expect(f.client.status).toHaveBeenCalledTimes(1)
  await expect(f.admission.submit(input())).rejects.toThrow()
})


it('persists only an identity reference before POST and recovers across a new controller instance', async () => {
  const f = fixture(); let saved: any = null
  const store = { read: () => saved, write: (reference: any) => { saved = reference }, clear: () => { saved = null } }
  const first = new CollaborationAdmission(f.client, () => {}, store)
  f.client.start.mockRejectedValueOnce(new Error('connection lost'))
  await first.submit(input()); first.dispose()
  expect(Object.keys(saved).sort()).toEqual(['conversationId', 'schemaVersion', 'sessionId'])
  const states: any[] = []
  const second = new CollaborationAdmission(f.client, next => states.push(next), store)
  await expect(second.submit(input())).rejects.toThrow()
  await second.recover()
  expect(states.at(-1).phase).toBe('accepted')
  expect(f.client.start).toHaveBeenCalledTimes(1)
  f.client.status.mockResolvedValueOnce(status('cancelled')); await second.recover()
  second.prepareNext(); expect(saved).toBeNull()
})

it('refuses POST when the local recovery reference cannot be saved', async () => {
  const f = fixture()
  const admission = new CollaborationAdmission(f.client, () => {}, { read: () => null, write: () => { throw new Error('storage unavailable') }, clear: () => {} })
  await expect(admission.submit(input())).rejects.toThrow('storage unavailable')
  expect(f.client.start).not.toHaveBeenCalled()
})
