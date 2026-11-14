import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { proposalSqlite } from './fixtures/proposalSqlite.js'
import { IndependentJobContexts } from '../collaboration/independentJobContexts.js'
let f: ReturnType<typeof proposalSqlite>, contexts: IndependentJobContexts
const input = { schemaVersion: 1, id: 'job-a', sourceConversationId: 'c1', slot: 'a' }
const generate = vi.fn()
beforeEach(() => {
  f = proposalSqlite({ generate } as any)
  f.db.exec("ALTER TABLE conversations ADD COLUMN user_id TEXT; ALTER TABLE conversations ADD COLUMN title TEXT; ALTER TABLE conversations ADD COLUMN storage_mode TEXT; UPDATE conversations SET user_id='owner', storage_mode='local'")
  contexts = new IndependentJobContexts(f.db, (owner, id) => {
    if (f.db.prepare('SELECT user_id FROM conversations WHERE id=?').get(id)?.user_id !== owner) throw new Error('denied')
  })
})
afterEach(() => f.close())
it('prepares distinct owned empty contexts idempotently without copying chat or generating', () => {
  const a = contexts.prepare('owner', input), b = contexts.prepare('owner', { ...input, id: 'job-b', slot: 'b' })
  expect(a).toEqual(contexts.prepare('owner', input)); expect(a.conversationId).not.toBe(b.conversationId)
  expect(f.db.prepare('SELECT * FROM conversations WHERE id=?').get(a.conversationId)).toMatchObject({ user_id: 'owner', storage_mode: 'local', project_id: null })
  const messages = f.db.prepare('SELECT * FROM messages WHERE conversation_id=?').all(a.conversationId)
  expect(messages).toHaveLength(1); expect(messages[0].content).toBe('Independent job workspace')
  expect(generate).not.toHaveBeenCalled()
})
it('rejects different source/slot, missing anchors and unauthorized preparation', () => {
  const a = contexts.prepare('owner', input)
  expect(() => contexts.prepare('owner', { ...input, slot: 'b' })).toThrow('conflict')
  expect(() => contexts.prepare('owner', { ...input, sourceConversationId: 'other' })).toThrow('conflict')
  expect(() => contexts.prepare('intruder', input)).toThrow('Access denied')
  expect(() => contexts.prepare('owner', { ...input, fullAccess: true })).toThrow()
  f.db.prepare('DELETE FROM messages WHERE id=?').run(a.anchorMessageId)
  expect(() => contexts.prepare('owner', input)).toThrow('conflict')
})
it('rolls back the conversation if anchor creation fails', () => {
  f.db.exec("CREATE TRIGGER reject_job_anchor BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'fixture rejection'); END")
  expect(() => contexts.prepare('owner', input)).toThrow('fixture rejection')
  expect(f.db.prepare("SELECT COUNT(*) AS n FROM conversations WHERE id LIKE 'hadron-job-%'").get().n).toBe(0)
})
