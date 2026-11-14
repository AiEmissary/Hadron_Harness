import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { createCollaborationSchema, createCollaborationDeletionGuards, createCollaborationWorkflowSchema, createCollaborationVerificationSchema } from '../collaborationSchema.js'
import { createIndependentJobsSchema } from '../independentJobsSchema.js'
import { CollaborationRepo } from '../collaborationRepo.js'

const source = readFileSync(new URL('../../../localServer.ts', import.meta.url), 'utf8')
const start = source.indexOf('function createHookRunsSchema(')
const end = source.indexOf('// Initialize database at specified path', start)
if (start < 0 || end < 0) throw new Error('Production migration boundaries changed')
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText
const { runSchemaMigrations, SCHEMA_MIGRATIONS } = runInNewContext(
  `${code}; ({ runSchemaMigrations, SCHEMA_MIGRATIONS })`, {
    createCollaborationSchema, createCollaborationDeletionGuards, createIndependentJobsSchema, createCollaborationWorkflowSchema, createCollaborationVerificationSchema,
    rebuildSearchIndexes: vi.fn(), console: { log() {}, error() {} },
  })

function database() {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE lineages (id TEXT PRIMARY KEY);
    CREATE TABLE messages (id TEXT PRIMARY KEY);
    INSERT INTO conversations VALUES ('legacy', 'Keep existing chat');
    PRAGMA user_version = 6;`)
  return { exec: (sql: string) => sqlite.exec(sql), prepare: (sql: string) => sqlite.prepare(sql),
    pragma: (sql: string, options?: { simple?: boolean }) => {
      const rows = sqlite.prepare(`PRAGMA ${sql}`).all()
      return options?.simple ? Object.values(rows[0] ?? {})[0] : rows
    }, close: () => sqlite.close() }
}
const schema = (db: ReturnType<typeof database>) => db.prepare(
  "SELECT type, name, sql FROM sqlite_master WHERE name LIKE '%hadron%' ORDER BY name").all()

describe('Hadron production migration runner', () => {
  it('registers v7 and converges fresh DDL and a v6 upgrade without altering legacy chats', () => {
    const fresh = database(), legacy = database()
    try {
      expect(SCHEMA_MIGRATIONS.find((m: any) => m.name === 'hadron_collaboration_sessions').version).toBe(7)
      expect(source.indexOf('createCollaborationSchema(db)', source.indexOf('function initializeLocalDatabase('))).toBeGreaterThan(0)
      createCollaborationSchema(fresh)
      runSchemaMigrations(fresh)
      runSchemaMigrations(legacy)
      expect(schema(legacy)).toEqual(schema(fresh))
      expect(legacy.pragma('user_version', { simple: true })).toBe(11)
      expect(legacy.prepare('SELECT * FROM conversations').all()).toEqual([{ id: 'legacy', title: 'Keep existing chat' }])
      const exec = vi.spyOn(legacy, 'exec')
      runSchemaMigrations(legacy)
      expect(exec).not.toHaveBeenCalled()
    } finally { fresh.close(); legacy.close() }
  })

  it('leaves a failed migration unstamped and retries partial DDL safely', () => {
    const db = database()
    try {
      const execute = db.exec
      db.exec = sql => {
        // SQLite exec can apply the first CREATE before a later statement fails.
        execute(sql.slice(0, sql.indexOf(';') + 1))
        throw new Error('injected DDL failure')
      }
      expect(() => runSchemaMigrations(db)).toThrow('injected DDL failure')
      expect(db.pragma('user_version', { simple: true })).toBe(6)
      db.exec = execute
      runSchemaMigrations(db)
      expect(db.pragma('user_version', { simple: true })).toBe(11)
      expect(schema(db).length).toBeGreaterThan(2)
    } finally { db.close() }
  })

  it('wires recovery after migrations and before route startup, without rerunning work', () => {
    const initialization = source.slice(source.indexOf('function initializeLocalDatabase('))
    expect(initialization.indexOf('new CollaborationRepo({ db }).reconcileInterrupted()'))
      .toBeGreaterThan(initialization.indexOf('runSchemaMigrations(db)'))
    expect(initialization.indexOf('new CollaborationRepo({ db }).reconcileInterrupted()'))
      .toBeLessThan(initialization.indexOf('registerHeadlessServerRoutes(app'))
    const db = database()
    try {
      runSchemaMigrations(db)
      db.exec(`INSERT INTO lineages VALUES ('l'); INSERT INTO messages VALUES ('a');
        INSERT INTO hadron_sessions (id, owner_id, conversation_id, source_lineage_id,
          anchor_message_id, config_json, config_hash, status)
        VALUES ('lost', 'owner', 'legacy', 'l', 'a', '{}', 'hash', 'running');
        INSERT INTO hadron_participants (session_id, participant_id) VALUES ('lost', 'a');`)
      // Match the production driver's transaction port for Node SQLite.
      const repo = new CollaborationRepo({ db: { ...db, transaction: (fn: () => unknown) => () => {
        db.exec('BEGIN')
        try { const result = fn(); db.exec('COMMIT'); return result }
        catch (error) { db.exec('ROLLBACK'); throw error }
      } } })
      expect(repo.reconcileInterrupted()).toBe(1)
      expect(repo.get('lost', 'owner')?.status).toBe('interrupted')
      expect(repo.claim('lost', 'owner')).toBe(false)
      expect(repo.reconcileInterrupted()).toBe(0)
    } finally { db.close() }
  })
})

it('upgrades v10 additively while preserving saved workflow bindings and chat rows',()=>{
 const db=database()
 try{
  createCollaborationSchema(db)
  db.exec(`DROP TRIGGER hadron_verification_delete_private_records; DROP TABLE hadron_verification_runs; PRAGMA user_version=10;
   INSERT INTO lineages VALUES ('lineage'); INSERT INTO messages VALUES ('anchor');
   INSERT INTO hadron_sessions(id,owner_id,conversation_id,source_lineage_id,anchor_message_id,status,config_json,config_hash) VALUES ('old','owner','legacy','lineage','anchor','completed','{}','hash');
   INSERT INTO hadron_workflows(session_id,status,phase) VALUES ('old','completed','finished');
   INSERT INTO hadron_workflow_runs(session_id,stage_id,participant_id,model_name,run_id,handle,stream_id) VALUES ('old','final','a','existing-model','saved-run','saved-handle','saved-stream');`)
  const before=db.prepare('SELECT * FROM hadron_workflow_runs').all()
  runSchemaMigrations(db)
  expect(db.pragma('user_version',{simple:true})).toBe(11)
  expect(db.prepare('SELECT * FROM hadron_workflow_runs').all()).toEqual(before)
  expect(db.prepare('SELECT title FROM conversations').all()).toEqual([{title:'Keep existing chat'}])
  expect(db.prepare('SELECT * FROM hadron_verification_runs').all()).toEqual([])
 }finally{db.close()}
})
