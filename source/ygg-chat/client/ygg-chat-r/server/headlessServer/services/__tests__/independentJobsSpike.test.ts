import { expect, it, vi } from 'vitest'
import { IndependentJobsSpike } from '../collaboration/independentJobsSpike.js'
import { proposalSqlite } from './fixtures/proposalSqlite.js'
import type { ProviderRouter } from '../providerRouter.js'
it('runs different private jobs concurrently, and stopping one leaves the other running', async () => {
  const pending: Array<{ input: any; finish: () => void }> = []
  const generate = vi.fn(async (_provider, input) => new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Stopped', 'AbortError'))
    if (input.signal.aborted) return abort()
    input.signal.addEventListener('abort', abort, { once: true })
    pending.push({ input, finish: () => { input.signal.removeEventListener('abort', abort); resolve({ content: 'Second job result' }) } })
  }))
  const f = proposalSqlite({ generate } as unknown as ProviderRouter)
  const second = f.messages.createMessage({ conversationId: 'other', parentId: null, role: 'user', content: 'Separate anchor' })
  const jobs = [
    { id: 'a', conversationId: 'c1', anchorMessageId: f.anchor.id, task: 'Private task A', context: 'Only file A', provider: 'openaichatgpt' as const, modelName: 'same-model' },
    { id: 'b', conversationId: 'other', anchorMessageId: second.id, task: 'Private task B', context: 'Only file B', provider: 'openaichatgpt' as const, modelName: 'same-model' },
  ]
  const prepared = new Map<string, any>()
  const runner = new IndependentJobsSpike({ agents: f.agents, ownerId: 'owner', deadlineMs: 10000, allowedModels: new Set(['same-model']),
    authorize: () => {}, onPrepared: (id, child) => { prepared.set(id, child) } }, jobs)
  const outcome = runner.start()
  try {
    expect(runner.start()).toBe(outcome)
    jobs[0].task = 'Changed later'
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    const a = pending.find(p => JSON.parse(p.input.userContent).task === 'Private task A')!
    const b = pending.find(p => JSON.parse(p.input.userContent).task === 'Private task B')!
    expect(a.input.userContent).not.toContain('Only file B')
    expect(b.input.userContent).not.toContain('Only file A')
    expect(a.input.railwayTurn.conversationId).not.toBe(b.input.railwayTurn.conversationId)
    expect(a.input.tools ?? []).toEqual([]); expect(b.input.tools ?? []).toEqual([])
    runner.stopJob('a')
    await vi.waitFor(() => expect(f.runs.getRunById(prepared.get('a').runId)?.status).toBe('aborted'))
    expect(b.input.signal.aborted).toBe(false)
    expect(f.runs.getRunById(prepared.get('b').runId)?.status).toBe('running')
    b.finish()
    const results = await outcome
    expect(results.map(result => result.status)).toEqual(['aborted', 'completed'])
    expect(generate).toHaveBeenCalledTimes(2)
  } finally { runner.stopAll(); await outcome; f.close() }
})


it('rejects shared conversation ownership or unsupported models before dispatch', () => {
  const agents = { spawnDetached: vi.fn(), cancel: vi.fn(), waitForTerminal: vi.fn() }
  const job = { id: 'a', conversationId: 'c', anchorMessageId: 'm', task: 'Task', context: '', provider: 'openaichatgpt' as const, modelName: 'approved' }
  const deps = { agents, ownerId: 'owner', deadlineMs: 1000, allowedModels: new Set(['approved']), authorize: () => {}, onPrepared: () => {} }
  expect(() => new IndependentJobsSpike(deps, [job, { ...job, id: 'b' }])).toThrow('isolated')
  expect(() => new IndependentJobsSpike(deps, [job, { ...job, id: 'b', conversationId: 'other', modelName: 'unknown' }])).toThrow('Unsupported')
  expect(agents.spawnDetached).not.toHaveBeenCalled()
})
