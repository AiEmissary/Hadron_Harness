import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { proposalSqlite } from './fixtures/proposalSqlite.js'
import { SharedTaskContexts } from '../collaboration/sharedTaskContexts.js'
let fixture: ReturnType<typeof proposalSqlite>, contexts: SharedTaskContexts
const generate = vi.fn()
const input = { schemaVersion: 1, id: 'shared-session', conversationId: 'c1', task: 'A task with no shared history' }
beforeEach(() => {
  fixture = proposalSqlite({ generate } as any)
  contexts = new SharedTaskContexts({ ...fixture, authorize: owner => { if (owner !== 'owner') throw Error('Denied') } })
})
afterEach(() => fixture.close())
it('creates an idempotent task-only root without copying the selected conversation or generating', () => {
  const result = contexts.prepare('owner', input)
  expect(contexts.prepare('owner', input)).toEqual(result)
  const detail = fixture.lineages.getDetail('c1', result.sourceLineageId)!
  expect(detail.pathMessageIds).toEqual([result.anchorMessageId])
  expect(detail.path[0].content).toBe(input.task)
  expect(result.context).toBe(''); expect(result.messageCount).toBe(0)
  expect(generate).not.toHaveBeenCalled()
})
it('rejects a different task or conversation for a previously prepared session', () => {
  contexts.prepare('owner', input)
  expect(() => contexts.prepare('owner', { ...input, task: 'Changed task' })).toThrow('conflict')
  expect(() => contexts.prepare('owner', { ...input, conversationId: 'other' })).toThrow('conflict')
})
it('rejects unauthorized owners and injected authority before writing any branch', () => {
  expect(() => contexts.prepare('other', input)).toThrow('Access denied')
  expect(() => contexts.prepare('owner', { ...input, tools: ['shell'] })).toThrow('Invalid')
  expect(fixture.lineages.list('c1')).toHaveLength(1)
})
it('rolls back an anchor if lineage creation fails', () => {
  fixture.db.exec("CREATE TRIGGER reject_shared_lineage BEFORE INSERT ON lineages BEGIN SELECT RAISE(ABORT, 'fixture rejection'); END")
  expect(() => contexts.prepare('owner', input)).toThrow('fixture rejection')
  expect(fixture.db.prepare("SELECT COUNT(*) AS n FROM messages WHERE id LIKE 'hadron-shared-%'").get().n).toBe(0)
})
it('saves a long continuous instruction in full without loosening ordinary shared-task admission',()=>{
 const task='Full report and latest instruction. '.repeat(3000)
 expect(()=>contexts.prepare('owner',{...input,task})).toThrow('Invalid')
 const result=contexts.prepare('owner',{...input,task,workflow:'continuous'})
 expect(fixture.lineages.getDetail('c1',result.sourceLineageId)!.path[0].content).toBe(task)
 expect(contexts.prepare('owner',{...input,task,workflow:'continuous'})).toEqual(result)
 expect(()=>contexts.prepare('other',{...input,task,workflow:'continuous'})).toThrow('Access denied')
 expect(()=>contexts.prepare('owner',{...input,id:'oversized',task:'🌙'.repeat(65000),workflow:'continuous'})).toThrow('Invalid')
 expect(()=>contexts.prepare('owner',{...input,id:'unknown',workflow:'agent'})).toThrow('Invalid')
 expect(generate).not.toHaveBeenCalled()
})
