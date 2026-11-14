import {fixtureImage} from '../../../../../../shared/__fixtures__/hadronImage.js'
import { describe, expect, it, vi } from 'vitest'
import type { ProviderRouter } from '../providerRouter.js'
import { ProposalSpike } from '../collaboration/proposalSpike.js'
import { publishProposalCheckpoints } from '../collaboration/proposalCheckpoints.js'
import { proposalSqlite } from './fixtures/proposalSqlite.js'

function fixture(implementerId?:string) {
  const pending = new Map<string, { input: any; finish: (content?: string) => void; fail: () => void }>()
  const generate = vi.fn(async (_provider: string, input: any) => new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Stopped', 'AbortError'))
    const finish = (content = `Proposal ${input.modelName}`) => {
      input.signal.removeEventListener('abort', abort)
      resolve({ content })
    }
    pending.set(input.modelName, { input, finish,
      fail: () => { input.signal.removeEventListener('abort', abort); reject(new Error('invalid request (400)')) } })
    if (input.signal.aborted) abort()
    else input.signal.addEventListener('abort', abort, { once: true })
  }))
  const store = proposalSqlite({ generate } as unknown as ProviderRouter)
  const input = { sessionId: 'p0-session', conversationId: 'c1', sourceLineageId: store.source.id,
    anchorMessageId: store.anchor.id, images:[fixtureImage], task: 'Solve the shared task', context: 'Frozen evidence',
    participants: [{ id: 'a', modelName: 'model-a' }, { id: 'b', modelName: 'model-b' }] }
  const publish = vi.fn((snapshot, proposals) => publishProposalCheckpoints(store, snapshot, proposals))
  const spike = new ProposalSpike({ agents: store.agents, publish,implementerId,
    validateAnchor: snapshot => {
      const source = store.lineages.getDetail(snapshot.conversationId, snapshot.sourceLineageId)
      if (!source?.pathMessageIds.includes(snapshot.anchorMessageId)) throw new Error('Invalid source anchor')
    },
  }, input)
  const count = (table: string) => Number(store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)
  const cleanup = async () => {
    spike.stop()
    await spike.start().catch(() => {})
    store.close()
  }
  return { ...store, input, publish, spike, pending, generate, count, cleanup }
}

function observe<T>(promise: Promise<T>) {
  return promise.then(value => ({ value, error: null }), error => ({ value: null, error }))
}

describe('Hadron P0 proposal checkpoints', () => {
  it('freezes identical inputs, waits for both results and persists replayable sibling checkpoints without inference', async () => {
    const f = fixture()
    try {
      const start = f.spike.start()
      expect(f.spike.start()).toBe(start)
      f.input.context = 'Mutated after launch'
      f.input.participants[0].modelName = 'changed-model'
      await vi.waitFor(() => expect(f.pending.size).toBe(2))
      const a = f.pending.get('model-a')!.input
      const b = f.pending.get('model-b')!.input
      expect(a.images).toEqual([fixtureImage]);expect(b.images).toEqual([fixtureImage])
      expect(a.userContent).not.toContain(fixtureImage.dataUrl)
      expect(a.userContent).toBe(b.userContent)
      expect(JSON.parse(a.userContent).context).toBe('Frozen evidence')
      expect(a.railwayTurn.conversationId).not.toBe(b.railwayTurn.conversationId)
      expect(a.tools ?? []).toEqual([])
      expect(b.tools ?? []).toEqual([])
      f.pending.get('model-b')!.finish('B result')
      await vi.waitFor(() => expect(f.db.prepare("SELECT status FROM subagent_runs WHERE model_name = 'model-b'").get().status).toBe('completed'))
      expect(f.publish).not.toHaveBeenCalled()
      expect(f.count('messages')).toBe(1)
      f.pending.get('model-a')!.finish('A'.repeat(9_000))
      const checkpoints = await start
      expect(checkpoints).toHaveLength(2)
      expect(f.count('messages')).toBe(3)
      expect(f.count('lineages')).toBe(3)
      expect(f.count('fork_operations')).toBe(2)
      expect(f.generate).toHaveBeenCalledTimes(2)
      const children = JSON.parse(f.db.prepare('SELECT children_ids FROM messages WHERE id = ?').get(f.anchor.id).children_ids)
      expect(new Set(children)).toEqual(new Set(checkpoints.map(c => c.messageId)))
      for (const checkpoint of checkpoints) {
        const detail = f.lineages.getDetail('c1', checkpoint.lineageId)!
        expect(detail.pathMessageIds).toEqual([f.anchor.id, checkpoint.messageId])
        expect(detail.parent_lineage_id).toBe(f.source.id)
        const message = detail.path[1]
        const meta = JSON.parse(message.meta)
        expect(meta.runId).toBe(checkpoint.runId)
        expect(meta.contextHash).toBe(f.publish.mock.calls[0][0].contextHash)
        expect(meta.verified).toBe(false)
        expect(message.content.length).toBeLessThan(8_200)
        expect(f.runs.getMessages(checkpoint.runId)).toHaveLength(2)
      }
      // New publisher invocation reads receipts, not in-memory coordinator state.
      const [snapshot, proposals] = f.publish.mock.calls[0]
      expect(publishProposalCheckpoints(f, snapshot, proposals)).toEqual(checkpoints)
      expect(f.count('messages')).toBe(3)
      expect(f.count('fork_operations')).toBe(2)
      expect(f.generate).toHaveBeenCalledTimes(2)
      expect(f.lineages.get(f.source.id)?.head_message_id).toBe(f.anchor.id)
      expect(() => publishProposalCheckpoints(f, { ...snapshot, contextHash: 'different' }, proposals)).toThrow()
      expect(f.count('messages')).toBe(3)
    } finally { await f.cleanup() }
  })

  it.each(['before', 'one', 'both'] as const)('Stop at %s completion cancels owned work and publishes nothing', async boundary => {
    const f = fixture()
    try {
      const outcome = observe(f.spike.start())
      await vi.waitFor(() => expect(f.pending.size).toBe(2))
      if (boundary === 'one') {
        f.pending.get('model-a')!.finish()
        await vi.waitFor(() => expect(f.db.prepare("SELECT status FROM subagent_runs WHERE model_name = 'model-a'").get().status).toBe('completed'))
      } else if (boundary === 'both') {
        f.pending.get('model-a')!.finish()
        f.pending.get('model-b')!.finish()
      }
      f.spike.stop()
      expect((await outcome).error).toBeTruthy()
      expect(f.publish).not.toHaveBeenCalled()
      expect(f.count('messages')).toBe(1)
      expect(f.count('fork_operations')).toBe(0)
      expect(f.db.prepare("SELECT COUNT(*) AS n FROM subagent_runs WHERE status = 'running'").get().n).toBe(0)
    } finally { await f.cleanup() }
  })

  it('stops before launch without starting any inference', async () => {
    const f = fixture()
    try {
      f.spike.stop()
      await expect(f.spike.start()).rejects.toThrow()
      expect(f.generate).not.toHaveBeenCalled()
      expect(f.count('subagent_runs')).toBe(0)
    } finally { await f.cleanup() }
  })

  it('cleans up a child that finishes asynchronous preparation after Stop', async () => {
    const f = fixture()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const spawn = f.agents.spawnDetached.bind(f.agents)
    vi.spyOn(f.agents, 'spawnDetached').mockImplementation(async (request, admission) => {
      await gate
      return spawn(request, admission)
    })
    try {
      const outcome = observe(f.spike.start())
      f.spike.stop()
      release()
      expect((await outcome).error).toBeTruthy()
      expect(f.count('subagent_runs')).toBe(0)
      expect(f.generate).not.toHaveBeenCalled()
      expect(f.publish).not.toHaveBeenCalled()
    } finally { release(); await f.cleanup() }
  })

  it('fails the barrier and cancels the peer when one proposal errors', async () => {
    const f = fixture()
    try {
      const outcome = observe(f.spike.start())
      await vi.waitFor(() => expect(f.pending.size).toBe(2))
      f.pending.get('model-a')!.fail()
      expect((await outcome).error).toBeTruthy()
      expect(f.db.prepare("SELECT status FROM subagent_runs WHERE model_name = 'model-b'").get().status).toBe('aborted')
      expect(f.publish).not.toHaveBeenCalled()
      expect(f.count('messages')).toBe(1)
    } finally { await f.cleanup() }
  })

  it('rolls back both checkpoints on a second write failure, then retries from committed transcripts', async () => {
    const f = fixture()
    const create = f.messages.createMessage.bind(f.messages)
    const write = vi.spyOn(f.messages, 'createMessage').mockImplementation(input => {
      if (input.content.includes('proposal — b')) throw new Error('injected second write failure')
      return create(input)
    })
    try {
      const outcome = observe(f.spike.start())
      await vi.waitFor(() => expect(f.pending.size).toBe(2))
      for (const pending of f.pending.values()) pending.finish()
      expect((await outcome).error?.message).toContain('injected second write failure')
      expect(f.count('messages')).toBe(1)
      expect(f.count('lineages')).toBe(1)
      expect(f.count('fork_operations')).toBe(0)
      write.mockRestore()
      const [snapshot, proposals] = f.publish.mock.calls[0]
      expect(publishProposalCheckpoints(f, snapshot, proposals)).toHaveLength(2)
      expect(f.generate).toHaveBeenCalledTimes(2)
      expect(f.count('messages')).toBe(3)
    } finally { write.mockRestore(); await f.cleanup() }
  })

  it('rejects conflicting participant receipts and changed attempts without altering committed checkpoints', async () => {
    const f = fixture()
    try {
      const started = f.spike.start()
      await vi.waitFor(() => expect(f.pending.size).toBe(2))
      for (const pending of f.pending.values()) pending.finish()
      await started
      const [snapshot, proposals] = f.publish.mock.calls[0]
      const swapped = proposals.map((p: any) => ({ ...p, participantId: p.participantId === 'a' ? 'b' : 'a' }))
      expect(() => publishProposalCheckpoints(f, snapshot, swapped)).toThrow('conflicts')
      const stale = proposals.map((p: any) => ({ ...p, attempt: p.attempt + 1 }))
      expect(() => publishProposalCheckpoints(f, snapshot, stale)).toThrow('completed attempt')
      expect(() => publishProposalCheckpoints(f, { ...snapshot, conversationId: 'other' }, proposals)).toThrow('anchor')
      expect(f.count('messages')).toBe(3)
      expect(f.count('fork_operations')).toBe(2)
      expect(f.generate).toHaveBeenCalledTimes(2)
    } finally { await f.cleanup() }
  })

  it('rejects oversized participant IDs at both entry points without launching or writing', async () => {
    const f = fixture()
    try {
      const participants = [{ id: 'a'.repeat(65), modelName: 'model-a' }, { id: 'b', modelName: 'model-b' }]
      expect(() => new ProposalSpike({ agents: f.agents, publish: f.publish, validateAnchor: () => {} },
        { ...f.input, participants })).toThrow('two named models')
      const snapshot = { sessionId: 'test', conversationId: 'c1', sourceLineageId: f.source.id,
        anchorMessageId: f.anchor.id, contextHash: 'unused' }
      expect(() => publishProposalCheckpoints(f, snapshot, [
        { participantId: participants[0].id, runId: 'one', attempt: 0 },
        { participantId: 'b', runId: 'two', attempt: 0 },
      ])).toThrow('two distinct')
      expect(f.generate).not.toHaveBeenCalled()
      expect(f.count('messages')).toBe(1)
      expect(f.count('fork_operations')).toBe(0)
    } finally { await f.cleanup() }
  })

  it('cancels the first child when second launch preparation fails', async () => {
    const f = fixture()
    const spawn = f.agents.spawnDetached.bind(f.agents)
    let launched = 0
    vi.spyOn(f.agents, 'spawnDetached').mockImplementation((request, admission) => {
      if (++launched === 2) return Promise.reject(new Error('preparation failed'))
      return spawn(request, admission)
    })
    try {
      await expect(f.spike.start()).rejects.toThrow('preparation failed')
      expect(f.db.prepare('SELECT status FROM subagent_runs').get().status).toBe('aborted')
      expect(f.publish).not.toHaveBeenCalled()
    } finally { await f.cleanup() }
  })

  it('rejects a cross-conversation anchor before child inference', async () => {
    const f = fixture()
    try {
      // The real publisher repeats scope validation within its transaction.
      const spike = new ProposalSpike({ agents: f.agents,
        validateAnchor: snapshot => {
          if (!f.lineages.getDetail(snapshot.conversationId, snapshot.sourceLineageId)) throw new Error('Invalid source')
        }, publish: (snapshot, proposals) => publishProposalCheckpoints(f, snapshot, proposals),
      }, { ...f.input, conversationId: 'other' })
      await expect(spike.start()).rejects.toThrow('Invalid source')
      expect(f.generate).not.toHaveBeenCalled()
    } finally { await f.cleanup() }
  })
})

it('assigns implementation only to the coordinator-selected coding agent',async()=>{
 const f=fixture('a')
 try{
  const work=f.spike.start()
  await vi.waitFor(()=>expect(f.pending.size).toBe(2))
  expect(f.pending.get('model-a')!.input.systemPrompt).toContain('sole implementer')
  expect(f.pending.get('model-b')!.input.systemPrompt).not.toContain('sole implementer')
  f.pending.get('model-a')!.finish('Implemented one calculator')
  f.pending.get('model-b')!.finish('Independent analysis only')
  await work
 }finally{await f.cleanup()}
})
