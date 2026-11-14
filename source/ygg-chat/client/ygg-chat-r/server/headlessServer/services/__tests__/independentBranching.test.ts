import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { proposalSqlite } from './fixtures/proposalSqlite.js'
import { createIndependentJobsSchema } from '../../persistence/independentJobsSchema.js'
import { IndependentJobsRepo } from '../../persistence/independentJobsRepo.js'
import { IndependentJobContexts } from '../collaboration/independentJobContexts.js'
import { initializeCollaborationSchema } from '../../persistence/collaborationSchema.js'
import { CollaborationRepo } from '../../persistence/collaborationRepo.js'
import { ProposalSessionService } from '../collaboration/proposalSessionService.js'
import { IndependentJobService } from '../collaboration/independentJobService.js'

let f: ReturnType<typeof proposalSqlite>, contexts: IndependentJobContexts, service: IndependentJobService
const requests: any[] = []
beforeEach(() => {
  requests.length = 0
  f = proposalSqlite({ generate: vi.fn(async (_provider, input) => {
    const packet = JSON.parse(input.userContent); requests.push(packet)
    return { content: `Answer to ${packet.task}${input.modelName === 'model-a' ? ' from A' : input.modelName === 'model-b' ? ' from B' : ''}` }
  }) } as any)
  f.db.exec("ALTER TABLE conversations ADD COLUMN user_id TEXT; ALTER TABLE conversations ADD COLUMN title TEXT; ALTER TABLE conversations ADD COLUMN storage_mode TEXT; UPDATE conversations SET user_id='owner', storage_mode='local'; CREATE TABLE streaming_runs (stream_id TEXT PRIMARY KEY)")
  createIndependentJobsSchema(f.db)
  const authorize = (owner: string, id: string) => {
    if (f.db.prepare('SELECT user_id FROM conversations WHERE id=?').get(id)?.user_id !== owner) throw new Error('denied')
  }
  contexts = new IndependentJobContexts(f.db, authorize)
  service = new IndependentJobService({ jobs: new IndependentJobsRepo(f.db), agents: f.agents, runs: f.runs, allowedModels: new Set(['model']),
    authorize: (owner, input) => authorize(owner, input.conversationId), history: (owner, input) => contexts.history(owner, input) })
})
afterEach(() => f.close())
async function turn(id: string, slot: 'a' | 'b', task: string, parent?: { jobId: string; kind: 'task' | 'response' }, context = '') {
  const prepared = contexts.prepare('owner', { schemaVersion: 1, id, sourceConversationId: 'c1', slot, ...(parent ? { parent } : {}) })
  const input = { schemaVersion: 1 as const, id, conversationId: prepared.conversationId, anchorMessageId: prepared.anchorMessageId, task, context, provider: 'openaichatgpt' as const, modelName: 'model' }
  await service.start('owner', input)
  expect(service.status('owner', id)?.status).toBe('completed')
  return { prepared, input }
}
it('prepares edit/regenerate from the canonical question and original parent without another request',async()=>{
  await turn('edit-root','a','Original question',undefined,'Original supplied text')
  await turn('edit-child','a','Follow up',{jobId:'edit-root',kind:'response'},'Child supplied text')
  const count=requests.length,draft=contexts.editDraft('owner','edit-child')
  expect(draft).toMatchObject({toolMode:'',task:'Follow up',context:'Child supplied text',slot:'a',workspace:'c1',parent:{jobId:'edit-root',kind:'response'}})
  expect(requests).toHaveLength(count)
  await turn('edited-child','a','Edited follow up',draft.parent!,draft.context)
  const tree=contexts.workspace('owner','c1','a')
  expect(tree.nodes.filter(n=>n.kind==='task').map(n=>n.text)).toEqual(expect.arrayContaining(['Original question','Follow up','Edited follow up']))
  expect(()=>contexts.editDraft('intruder','edit-child')).toThrow()
})
it('moves the whole selected conversation to the 30-day bin, retains unrelated roots and restores its branches',async()=>{
  await turn('bin-root','a','Root')
  await turn('bin-child','a','Child',{jobId:'bin-root',kind:'response'})
  await turn('bin-other','a','Other root')
  const before=requests.length,removed=contexts.removeConversation('owner','bin-child')
  expect(contexts.workspace('owner','c1','a').nodes.map(n=>n.jobId)).toEqual(['bin-other','bin-other'])
  expect(()=>contexts.editDraft('owner','bin-root')).toThrow()
  const {HadronRecycleBin}=await import('../../../hadronTools/recycleBin.js')
  new HadronRecycleBin(f.db).restore('conversation',removed.conversationId,'owner')
  expect(contexts.workspace('owner','c1','a').nodes.filter(n=>n.kind==='task')).toHaveLength(3)
  expect(requests).toHaveLength(before)
})
it('keeps follow-ups in one conversation, preserves siblings and supplies only the selected ancestry', async () => {
  const root = await turn('root', 'a', 'Original question', undefined, 'Original attachment')
  const first = await turn('first', 'a', 'First follow-up', { jobId: 'root', kind: 'response' })
  const sibling = await turn('sibling', 'a', 'Alternative follow-up', { jobId: 'root', kind: 'response' })
  const nested = await turn('nested', 'a', 'Nested follow-up', { jobId: 'first', kind: 'response' })
  expect(new Set([root, first, sibling, nested].map(item => item.prepared.conversationId)).size).toBe(1)
  expect(requests[2].conversationHistory).toEqual([
    { role: 'user', content: JSON.stringify({ task: 'Original question', context: 'Original attachment' }) },
    { role: 'assistant', content: 'Answer to Original question', status: 'completed' },
  ])
  expect(JSON.stringify(requests[3].conversationHistory)).toContain('First follow-up')
  expect(JSON.stringify(requests[3].conversationHistory)).not.toContain('Alternative follow-up')
  const tree = contexts.workspace('owner', 'c1', 'a')
  expect(tree.nodes).toHaveLength(8)
  const firstTask = tree.nodes.find(node => node.jobId === 'first' && node.kind === 'task')!, siblingTask = tree.nodes.find(node => node.jobId === 'sibling' && node.kind === 'task')!
  expect(firstTask.parentId).toBe(siblingTask.parentId)
  expect(firstTask.parentId).toBe(tree.nodes.find(node => node.jobId === 'root' && node.kind === 'response')!.id)
  const parent = f.db.prepare('SELECT children_ids FROM messages WHERE id=?').get(firstTask.parentId)
  expect(JSON.parse(parent.children_ids)).toEqual([firstTask.id, siblingTask.id])
  expect(contexts.workspace('owner', 'c1', 'a')).toEqual(tree) // Restart/read reconstruction does not infer.
  expect(requests).toHaveLength(4)
})
it('branches from a question without including its answer or later descendants, and creates separate new tasks', async () => {
  const root = await turn('root', 'a', 'Original question')
  await turn('question-branch', 'a', 'Clarify this question', { jobId: 'root', kind: 'task' })
  expect(requests[1].conversationHistory).toEqual([{ role: 'user', content: JSON.stringify({ task: 'Original question', context: '' }) }])
  const separate = await turn('separate', 'a', 'Fresh task')
  expect(separate.prepared.conversationId).not.toBe(root.prepared.conversationId)
  expect(requests[2].conversationHistory).toBeUndefined()
  const tree = contexts.workspace('owner', 'c1', 'a')
  expect(tree.nodes.filter(node => node.parentId === null)).toHaveLength(2)
})
it('opens a private project-list entry in its owning workspace and selects its saved response without inference', async () => {
  const root = await turn('root', 'a', 'Saved A')
  await turn('next', 'a', 'Saved follow-up', { jobId: 'root', kind: 'response' })
  await turn('b', 'b', 'Saved B')
  expect(contexts.openWorkspace('owner', root.prepared.conversationId)).toEqual({ schemaVersion: 1,
    requestedConversationId: root.prepared.conversationId, workspaceConversationId: 'c1', slot: 'a', nodeId: 'hadron-response-next' })
  expect(contexts.workspace('owner', 'c1', 'a').nodes.find(node => node.id === 'hadron-response-next')!.text).toContain('Saved follow-up')
  expect(contexts.openWorkspace('owner', 'c1')).toEqual({ schemaVersion: 1, requestedConversationId: 'c1', workspaceConversationId: 'c1', slot: null, nodeId: null })
  expect(() => contexts.openWorkspace('intruder', root.prepared.conversationId)).toThrow()
  expect(requests).toHaveLength(3)
})
it('preserves the immediate scope of older nested workspaces rather than losing their saved chats by flattening them', async () => {
  const original = await turn('original', 'a', 'Old original')
  const nested = contexts.prepare('owner', { schemaVersion: 1, id: 'nested-workspace', sourceConversationId: original.prepared.conversationId, slot: 'b' })
  await service.start('owner', { schemaVersion: 1, id: nested.id, conversationId: nested.conversationId, anchorMessageId: nested.anchorMessageId,
    task: 'Saved inside older nested workspace', context: '', provider: 'openaichatgpt', modelName: 'model' })
  const opened = contexts.openWorkspace('owner', nested.conversationId)
  expect(opened.workspaceConversationId).toBe(original.prepared.conversationId)
  expect(opened.slot).toBe('b')
  expect(contexts.workspace('owner', opened.workspaceConversationId, 'b').nodes.find(node => node.id === opened.nodeId)!.text).toContain('Saved inside older nested workspace')
  expect(requests).toHaveLength(2)
})
it('reopens a managed chat that owns shared sessions in its own scope, without replaying its private job', async () => {
  const original = await turn('original', 'a', 'Original private chat')
  initializeCollaborationSchema(f.db)
  const insert = f.db.prepare("INSERT INTO hadron_sessions (id, owner_id, conversation_id, source_lineage_id, anchor_message_id, status, config_json, config_hash) VALUES (?, ?, ?, ?, ?, 'completed', '{}', 'fixture')")
  insert.run('earlier-shared', 'owner', original.prepared.conversationId, f.source.id, original.prepared.anchorMessageId)
  insert.run('latest-shared', 'owner', original.prepared.conversationId, f.source.id, original.prepared.anchorMessageId)
  // Another owner's record cannot select or redirect this owner's view.
  insert.run('unrelated-owner', 'intruder', original.prepared.conversationId, f.source.id, original.prepared.anchorMessageId)
  expect(contexts.openWorkspace('owner', original.prepared.conversationId)).toEqual({ schemaVersion: 1,
    requestedConversationId: original.prepared.conversationId, workspaceConversationId: original.prepared.conversationId,
    slot: null, nodeId: null, sharedSessionId: 'latest-shared' })
  expect(() => contexts.openWorkspace('intruder', original.prepared.conversationId)).toThrow()
  expect(requests).toHaveLength(1)
})
it('rejects other agents, owners, source workspaces, forged parent links and config changes before dispatch', async () => {
  const root = await turn('root', 'a', 'Private A', undefined, 'Secret A context')
  await turn('root-b', 'b', 'Private B')
  expect(() => contexts.prepare('owner', { schemaVersion: 1, id: 'bad', sourceConversationId: 'c1', slot: 'b', parent: { jobId: 'root', kind: 'response' } })).toThrow()
  expect(() => contexts.prepare('intruder', { schemaVersion: 1, id: 'bad', sourceConversationId: 'c1', slot: 'a', parent: { jobId: 'root', kind: 'response' } })).toThrow()
  expect(() => contexts.workspace('intruder', 'c1', 'a')).toThrow()
  expect(() => contexts.prepare('owner', { schemaVersion: 1, id: 'bad', sourceConversationId: 'other', slot: 'a', parent: { jobId: 'root', kind: 'response' } })).toThrow()
  expect(() => service.start('owner', { ...root.input, task: 'Mutated old question' })).toThrow('conflict')
  const prepared = contexts.prepare('owner', { schemaVersion: 1, id: 'tampered', sourceConversationId: 'c1', slot: 'a', parent: { jobId: 'root', kind: 'response' } })
  f.db.prepare('UPDATE messages SET parent_id=NULL WHERE id=?').run(prepared.anchorMessageId)
  expect(() => service.start('owner', { ...root.input, id: 'tampered', anchorMessageId: prepared.anchorMessageId, task: 'Forged' })).toThrow('mismatch')
  expect(JSON.stringify(contexts.workspace('owner', 'c1', 'b'))).not.toContain('Secret A')
  expect(requests).toHaveLength(2)
})
it('keeps explicit preparations idempotent and fences missing, cyclic and oversized paths', async () => {
  await turn('root', 'a', 'Root', undefined, 'x'.repeat(16000))
  const input = { schemaVersion: 1 as const, id: 'prepared', sourceConversationId: 'c1', slot: 'a' as const, parent: { jobId: 'root', kind: 'response' as const } }
  expect(contexts.prepare('owner', input)).toEqual(contexts.prepare('owner', input))
  expect(() => contexts.prepare('owner', { ...input, parent: { jobId: 'missing', kind: 'response' } })).toThrow()
  await turn('next', 'a', 'Next', { jobId: 'root', kind: 'response' }, 'y'.repeat(16000))
  await turn('third', 'a', 'Third', { jobId: 'next', kind: 'response' }, 'z'.repeat(16000))
  await turn('fourth', 'a', 'Fourth', { jobId: 'third', kind: 'response' }, 'w'.repeat(16000))
  expect(() => contexts.prepare('owner', { schemaVersion: 1, id: 'over', sourceConversationId: 'c1', slot: 'a', parent: { jobId: 'fourth', kind: 'response' } })).toThrow('exceeds limit')
  expect(requests).toHaveLength(4)
})

it('continues a shared proposal as a private branching agent conversation without rerunning the proposal', async () => {
  initializeCollaborationSchema(f.db)
  const shared = new ProposalSessionService({ ...f, sessions: new CollaborationRepo({ db: f.db }), allowedModels: new Set(['model-a', 'model-b']), authorize: owner => { if (owner !== 'owner') throw new Error('denied') }, authorizeConversation: () => {} })
  await shared.start('owner', { schemaVersion: 1, sessionId: 'shared', conversationId: 'c1', sourceLineageId: f.source.id, anchorMessageId: f.anchor.id,
    task: 'Shared original task', context: 'Shared attachment', participants: [{ id: 'a', provider: 'openaichatgpt', modelName: 'model-a' }, { id: 'b', provider: 'openaichatgpt', modelName: 'model-b' }] })
  const treeA = contexts.workspace('owner', 'c1', 'a'), treeB = contexts.workspace('owner', 'c1', 'b')
  expect(contexts.openWorkspace('owner', treeB.nodes[0].conversationId)).toMatchObject({ workspaceConversationId: 'c1', slot: 'b', nodeId: 'hadron-response-proposal:shared:b' })
  expect(treeA.nodes).toHaveLength(2); expect(treeB.nodes).toHaveLength(2)
  expect(treeA.nodes[0].conversationId).not.toBe(treeB.nodes[0].conversationId)
  expect(treeA.nodes[0].conversationId).not.toBe('c1')
  const child = await turn('shared-child', 'a', 'Explain proposal A', { jobId: 'proposal:shared:a', kind: 'response' })
  expect(child.prepared.conversationId).toBe(treeA.nodes[0].conversationId)
  expect(requests).toHaveLength(3)
  expect(JSON.stringify(requests[2])).not.toContain('from B')
  expect(requests[2].conversationHistory).toEqual([{ role: 'user', content: JSON.stringify({ task: 'Shared original task', context: 'Shared attachment' }) }, { role: 'assistant', content: 'Answer to Shared original task from A', status: 'completed' }])
  expect(contexts.workspace('owner', 'c1', 'a').nodes).toHaveLength(4)
  expect(contexts.workspace('owner', 'c1', 'b').nodes).toHaveLength(2)
  expect(() => contexts.prepare('owner', { schemaVersion: 1, id: 'wrong-slot', sourceConversationId: 'c1', slot: 'b', parent: { jobId: 'proposal:shared:a', kind: 'response' } })).toThrow()
  expect(() => contexts.workspace('intruder', 'c1', 'a')).toThrow()
  expect(requests).toHaveLength(3)
})

it('pages more than 256 saved jobs without losing, duplicating or replaying roots', async () => {
  for (let i = 0; i < 300; i++) await turn(`page-${i}`, 'a', `Question ${i}`)
  const ids = new Set<string>()
  let cursor: string | undefined, pages = 0
  do {
    const tree = contexts.workspace('owner', 'c1', 'a', {cursor})
    expect(tree.nodes.length).toBeLessThanOrEqual(64)
    for (const node of tree.nodes.filter(n => n.kind === 'task')) {
      expect(ids.has(node.jobId)).toBe(false); ids.add(node.jobId)
    }
    cursor = tree.page!.nextCursor ?? undefined; pages++
  } while(cursor && pages < 20)
  expect(ids.size).toBe(300); expect(pages).toBe(10)
  expect(requests).toHaveLength(300)
  expect(contexts.workspace('owner', 'c1', 'b').nodes).toEqual([])
})
it('pins a selected old branch and hydrates parents across pages without sharing other slots', async () => {
  await turn('old-root', 'a', 'Old question')
  await turn('old-child', 'a', 'Old child', {jobId:'old-root',kind:'response'})
  for (let i = 0; i < 40; i++) await turn(`fresh-${i}`, 'a', `Fresh ${i}`)
  const page = contexts.workspace('owner', 'c1', 'a', {focusNodeId:'hadron-response-old-child'})
  const ids = page.nodes.map(n=>n.id)
  expect(ids.indexOf('hadron-response-old-root')).toBeLessThan(ids.indexOf('hadron-response-old-child'))
  expect(page.nodes.some(n=>n.jobId==='fresh-39')).toBe(true)
  expect(() => contexts.workspace('owner','c1','b',{focusNodeId:'hadron-response-old-child'})).toThrow()
  expect(() => contexts.workspace('intruder','c1','a',{cursor:page.page!.nextCursor!})).toThrow()
  expect(() => contexts.workspace('owner','c1','a',{cursor:'-1:j'})).toThrow('Invalid history cursor')
  const next = contexts.workspace('owner','c1','a',{cursor:page.page!.nextCursor!,focusNodeId:'hadron-response-old-child'})
  expect(next.nodes.some(n=>n.id==='hadron-response-old-child')).toBe(true)
  expect(requests).toHaveLength(42)
})
it('keeps a cursor stable when newer tasks arrive between page reads', async () => {
  for (let i = 0; i < 35; i++) await turn(`stable-${i}`, 'a', `Question ${i}`)
  const first = contexts.workspace('owner','c1','a')
  await turn('new-arrival','a','New arrival')
  const next = contexts.workspace('owner','c1','a',{cursor:first.page!.nextCursor!})
  expect(next.nodes.filter(n=>n.kind==='task').map(n=>n.jobId)).toEqual(['stable-0','stable-1','stable-2'])
  expect(next.page!.nextCursor).toBeNull()
})

it('shrinks a page for large answers while keeping full text and a resumable cursor', async () => {
  for (let i = 0; i < 10; i++) {
    await turn(`large-${i}`, 'a', `Large ${i}`)
    const job = f.db.prepare('SELECT run_id FROM hadron_independent_jobs WHERE id=?').get(`large-${i}`)
    f.db.prepare('UPDATE subagent_runs SET final_response=? WHERE id=?').run('x'.repeat(900000),job.run_id)
  }
  const first = contexts.workspace('owner','c1','a')
  expect(first.nodes.filter(n=>n.kind==='response').length).toBeLessThan(5)
  expect(first.page!.nextCursor).toBeTruthy()
  expect(first.nodes.find(n=>n.kind==='response')!.text).toHaveLength(900000)
  const next = contexts.workspace('owner','c1','a',{cursor:first.page!.nextCursor!})
  expect(next.nodes.length).toBeGreaterThan(0)
  const firstIds = new Set(first.nodes.map(n=>n.id))
  expect(next.nodes.some(n=>firstIds.has(n.id))).toBe(false)
  expect(requests).toHaveLength(10)
})

it('pages more than 128 completed shared proposals and pins an older proposal before its snapshot exists', async () => {
  initializeCollaborationSchema(f.db)
  const shared = new ProposalSessionService({ ...f, sessions: new CollaborationRepo({db:f.db}), allowedModels:new Set(['model-a','model-b']), authorize:()=>{}, authorizeConversation:()=>{} })
  for(let i=0;i<130;i++) await shared.start('owner',{schemaVersion:1,sessionId:`shared-page-${i}`,conversationId:'c1',sourceLineageId:f.source.id,anchorMessageId:f.anchor.id,task:`Shared ${i}`,context:'',participants:[{id:'a',provider:'openaichatgpt',modelName:'model-a'},{id:'b',provider:'openaichatgpt',modelName:'model-b'}]})
  const ids=new Set<string>();let cursor:string|undefined
  do {
    const page=contexts.workspace('owner','c1','b',{cursor})
    for(const node of page.nodes.filter(n=>n.kind==='task')) {expect(ids.has(node.jobId)).toBe(false);ids.add(node.jobId)}
    cursor=page.page!.nextCursor??undefined
  }while(cursor)
  expect(ids.size).toBe(130)
  const pinned=contexts.workspace('owner','c1','a',{focusNodeId:'hadron-response-proposal:shared-page-0:a'})
  expect(pinned.nodes.some(n=>n.id==='hadron-response-proposal:shared-page-0:a')).toBe(true)
  expect(requests).toHaveLength(260)
  f.db.prepare("UPDATE hadron_sessions SET status='running' WHERE id='shared-page-129'").run()
  expect(contexts.workspace('owner','c1','a',{focusNodeId:'hadron-response-proposal:shared-page-129:a'}).nodes.some(n=>n.jobId==='proposal:shared-page-129:a')).toBe(false)
})
