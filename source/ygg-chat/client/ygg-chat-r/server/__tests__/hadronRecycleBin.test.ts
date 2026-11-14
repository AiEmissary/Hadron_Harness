import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { activeConversationSql, activeProjectSql, HadronRecycleBin, RETENTION_MS } from '../hadronTools/recycleBin.js'
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
function fixture() {
  const db = new DatabaseSync(':memory:'); let now = Date.UTC(2026, 10, 8)
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,user_id TEXT,storage_mode TEXT); CREATE TABLE conversations(id TEXT PRIMARY KEY,title TEXT,user_id TEXT,project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,storage_mode TEXT); CREATE TABLE messages(id TEXT PRIMARY KEY,conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,content TEXT); INSERT INTO projects VALUES ('p','My project','owner','local'),('other','Other','other','local'); INSERT INTO conversations VALUES ('c','My chat','owner','p','local'),('separate','Separate chat','owner','p','local'); INSERT INTO messages VALUES ('m','c','Saved conversation and branch context')")
  const bin = new HadronRecycleBin(db, () => now)
  return { db, bin, advance: (ms: number) => { now += ms } }
}
it('hides projects and their chats without deleting content, then restores the same records', () => {
  const f = fixture(); try {
    f.bin.trash('project', 'p', 'owner')
    expect(f.db.prepare(`SELECT id FROM projects WHERE ${activeProjectSql()} AND user_id='owner'`).all()).toEqual([])
    expect(f.db.prepare(`SELECT id FROM conversations WHERE ${activeConversationSql()}`).all()).toEqual([])
    expect(f.db.prepare('SELECT content FROM messages').get().content).toContain('branch context')
    expect(f.bin.list('owner')[0]).toMatchObject({ kind: 'project', id: 'p', title: 'My project' })
    f.bin.restore('project', 'p', 'owner')
    expect(f.db.prepare(`SELECT id FROM conversations WHERE ${activeConversationSql()}`).all()).toHaveLength(2)
    expect(f.db.prepare('SELECT content FROM messages').get().content).toContain('branch context')
  } finally { f.db.close() }
})
it('keeps separately deleted chats deleted when their project is restored', () => {
  const f = fixture(); try {
    f.bin.trash('conversation', 'c', 'owner'); f.bin.trash('project', 'p', 'owner')
    expect(f.bin.list('owner').find(item => item.id === 'c')?.parentDeleted).toBe(true)
    expect(() => f.bin.restore('conversation', 'c', 'owner')).toThrow('project first')
    f.bin.restore('project', 'p', 'owner')
    expect(f.db.prepare(`SELECT id FROM conversations WHERE ${activeConversationSql()}`).all()).toMatchObject([{ id: 'separate' }])
    f.bin.restore('conversation', 'c', 'owner')
    expect(f.db.prepare(`SELECT id FROM conversations WHERE ${activeConversationSql()}`).all()).toHaveLength(2)
  } finally { f.db.close() }
})
it('expires at 30 days, does not extend retention on duplicate delete, and cascades content removal', () => {
  const f = fixture(); try {
    f.bin.trash('project', 'p', 'owner'); const expiry = f.bin.list('owner')[0].expiresAt
    f.advance(RETENTION_MS - 1); f.bin.trash('project', 'p', 'owner')
    expect(f.bin.list('owner')[0].expiresAt).toBe(expiry)
    expect(f.db.prepare("SELECT id FROM projects WHERE id='p'").get()).toBeTruthy()
    f.advance(1); expect(f.bin.list('owner')).toEqual([])
    expect(f.db.prepare("SELECT id FROM projects WHERE id='p'").get()).toBeUndefined()
    expect(f.db.prepare('SELECT * FROM messages').all()).toEqual([])
    expect(() => f.bin.restore('project', 'p', 'owner')).toThrow('no longer available')
    expect(f.db.prepare("SELECT id FROM projects WHERE id='other'").get()).toBeTruthy()
  } finally { f.db.close() }
})
it('isolates owners and recovers persisted bin entries in a new service instance', () => {
  const f = fixture(); try {
    expect(() => f.bin.trash('project', 'other', 'owner')).toThrow('your local')
    f.bin.trash('conversation', 'c', 'owner')
    expect(f.bin.list('other')).toEqual([])
    expect(() => f.bin.restore('conversation', 'c', 'other')).toThrow('no longer available')
    const recovered = new HadronRecycleBin(f.db, () => Date.UTC(2026, 10, 8))
    expect(recovered.list('owner')).toHaveLength(1); recovered.restore('conversation', 'c', 'owner')
    expect(recovered.list('owner')).toEqual([])
  } finally { f.db.close() }
})
