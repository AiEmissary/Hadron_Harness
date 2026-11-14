import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { CollaborationRepo } from '../collaborationRepo.js'
import { createCollaborationSchema, createCollaborationDeletionGuards } from '../collaborationSchema.js'

const databases: any[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })
function fixture() {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
  const sqlite = new DatabaseSync(':memory:')
  databases.push(sqlite)
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE conversations (id TEXT PRIMARY KEY);
    CREATE TABLE lineages (id TEXT PRIMARY KEY, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE);
    CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE);
    INSERT INTO conversations VALUES ('c'), ('other');
    INSERT INTO lineages VALUES ('l','c'), ('other-l','other');
    INSERT INTO messages VALUES ('a','c'), ('other-a','other');
    CREATE TABLE publications (id TEXT PRIMARY KEY);
    CREATE TABLE subagent_runs (id TEXT PRIMARY KEY);
    CREATE TABLE subagent_messages (id TEXT PRIMARY KEY, run_id TEXT REFERENCES subagent_runs(id) ON DELETE CASCADE);
    CREATE TABLE streaming_runs (stream_id TEXT PRIMARY KEY);
  `)
  let sequence = 0
  const db = {
    exec: (sql: string) => sqlite.exec(sql),
    prepare: (sql: string) => sqlite.prepare(sql),
    transaction: <T>(operation: () => T) => () => {
      const name = `test_${sequence++}`
      sqlite.exec(`SAVEPOINT ${name}`)
      try {
        const result = operation()
        sqlite.exec(`RELEASE ${name}`)
        return result
      } catch (error) {
        sqlite.exec(`ROLLBACK TO ${name}; RELEASE ${name}`)
        throw error
      }
    },
  }
  createCollaborationSchema(db)
  const repo = new CollaborationRepo({ db })
  const input = { id: 's', ownerId: 'owner', conversationId: 'c', sourceLineageId: 'l', anchorMessageId: 'a',
    configJson: '{"mode":"proposal"}', configHash: 'hash', participantIds: ['p1', 'p2'] }
  return { db, repo, input, create: () => repo.create(input) }
}
const binding = { runId: 'run', handle: '123456', streamId: 'stream' }

describe('CollaborationRepo real in-memory SQLite', () => {
  it('shares fresh/idempotent DDL, indexes, checks and foreign keys', () => {
    const { db, repo, create } = fixture()
    createCollaborationSchema(db)
    expect(create().status).toBe('created')
    expect(repo.participants('s', 'owner').map(p => p.status)).toEqual(['reserved', 'reserved'])
    expect(db.prepare("PRAGMA index_list(hadron_sessions)").all().map((i: any) => i.name)).toContain('idx_hadron_sessions_active')
    expect(() => db.prepare("UPDATE hadron_sessions SET status = 'bogus'").run()).toThrow()
    expect(() => db.prepare("UPDATE hadron_participants SET status = 'running'").run()).toThrow()
    expect(() => db.prepare("UPDATE hadron_sessions SET conversation_id = 'missing'").run()).toThrow()
  })

  it('is idempotent only for exact owner/scope/config/participant identity', () => {
    const { repo, input, create } = fixture()
    const row = create()
    expect(repo.create({ ...input, participantIds: ['p2', 'p1'] })).toEqual(row)
    for (const patch of [{ ownerId: 'wrong' }, { conversationId: 'other' }, { sourceLineageId: 'other-l' },
      { anchorMessageId: 'other-a' }, { configHash: 'changed' }, { configJson: '{}' }, { participantIds: ['p1'] }]) {
      expect(() => repo.create({ ...input, ...patch })).toThrow()
    }
    expect(() => repo.get('s', 'wrong')).toThrow(/owner/)
    expect(() => repo.participants('s', 'wrong')).toThrow(/owner/)
    expect(repo.get('missing', 'owner')).toBeNull()
    expect(() => repo.create({ ...input, id: 'new', sourceLineageId: 'other-l' })).toThrow(/scope/)
    expect(() => repo.create({ ...input, id: 'new', configJson: 'x'.repeat(65537) })).toThrow()
    expect(() => repo.create({ ...input, id: 'new', participantIds: ['p1', 'p1'] })).toThrow()
  })

  it('uses competing repository CAS claims and Stop fencing', () => {
    const { db, repo, create } = fixture()
    const competing = new CollaborationRepo({ db })
    create()
    expect(repo.claim('s', 'owner')).toBe(true)
    expect(competing.claim('s', 'owner')).toBe(false)
    repo.bind('s', 'owner', 'p1', binding)
    expect(competing.stop('s', 'owner')).toBe(true)
    expect(repo.stop('s', 'owner')).toBe(false)
    expect(repo.get('s', 'owner')?.revision).toBe(2)
    expect(() => repo.bind('s', 'owner', 'p2', { ...binding, runId: 'r2' })).toThrow(/running/)
    expect(() => repo.assertRunning('s', 'owner')).toThrow()
    expect(() => repo.complete('s', 'owner', () => ({}))).toThrow()
    repo.finish('s', 'owner', 'cancelled')
    expect(repo.stop('s', 'owner')).toBe(false)
    expect(repo.claim('s', 'owner')).toBe(false)
    repo.finish('s', 'owner', 'failed', 'ignored')
    expect(repo.get('s', 'owner')?.status).toBe('cancelled')
  })

  it('persists exact bindings atomically and rejects overwrites/unreserved/duplicate runs', () => {
    const { repo, create } = fixture()
    create()
    expect(() => repo.bind('s', 'owner', 'p1', binding)).toThrow()
    repo.claim('s', 'owner')
    expect(repo.ownsStreamId('stream')).toBe(false)
    expect(repo.ownsRunId('run')).toBe(false)
    repo.bind('s', 'owner', 'p1', binding)
    expect(repo.ownsStreamId('stream')).toBe(true)
    expect(repo.ownsRunId('run')).toBe(true)
    repo.bind('s', 'owner', 'p1', binding)
    expect(repo.participants('s', 'owner')[0]).toEqual({ participant_id: 'p1', run_id: 'run', handle: '123456', stream_id: 'stream', status: 'running' })
    expect(() => repo.bind('s', 'owner', 'p1', { ...binding, handle: 'different' })).toThrow(/Conflicting/)
    expect(() => repo.bind('s', 'owner', 'unknown', binding)).toThrow(/reserved/)
    expect(() => repo.bind('s', 'owner', 'p2', binding)).toThrow()
    expect(repo.participants('s', 'owner')[1].status).toBe('reserved')
    expect(() => repo.finishParticipant('s', 'owner', 'run', 'failed')).toThrow()
    repo.finishParticipant('s', 'owner', 'run', 'completed')
    repo.finishParticipant('s', 'owner', 'run', 'completed')
    expect(() => repo.finishParticipant('s', 'owner', 'run', 'aborted')).toThrow(/terminal/)
    expect(repo.participants('s', 'owner')[0].status).toBe('completed')
  })

  it('rolls publication back on failure, then stores replay JSON with completion atomically', () => {
    const { db, repo, create } = fixture()
    create(); repo.claim('s', 'owner')
    expect(() => repo.complete('s', 'owner', () => {
      db.prepare("INSERT INTO publications VALUES ('checkpoint')").run()
      throw new Error('publication failure')
    })).toThrow(/publication failure/)
    expect(db.prepare('SELECT * FROM publications').all()).toHaveLength(0)
    expect(repo.get('s', 'owner')?.status).toBe('running')
    expect(() => repo.complete('s', 'owner', () => Promise.resolve({}))).toThrow(/synchronous/)
    // Serialization/storage failures roll back the publisher's database writes too.
    expect(() => repo.complete('s', 'owner', () => {
      db.prepare("INSERT INTO publications VALUES ('invalid-json')").run()
      const cyclic: any = {}; cyclic.self = cyclic
      return cyclic
    })).toThrow()
    expect(db.prepare('SELECT * FROM publications').all()).toHaveLength(0)
    const result = { checkpointId: 'checkpoint' }
    expect(repo.complete('s', 'owner', () => {
      db.prepare("INSERT INTO publications VALUES ('checkpoint')").run()
      return result
    })).toEqual(result)
    expect(repo.get('s', 'owner')?.status).toBe('completed')
    expect(JSON.parse(repo.get('s', 'owner')!.checkpoints_json!)).toEqual(result)
    let called = false
    expect(() => repo.complete('s', 'owner', () => { called = true; return {} })).toThrow()
    expect(called).toBe(false)
  })

  it('enforces terminal transitions including pre-claim Stop', () => {
    const { repo, create } = fixture()
    create()
    expect(() => repo.finish('s', 'owner', 'failed')).toThrow()
    repo.claim('s', 'owner')
    expect(() => repo.finish('s', 'owner', 'cancelled')).toThrow()
    repo.finish('s', 'owner', 'failed', 'diagnostic')
    expect(repo.get('s', 'owner')?.error).toBe('diagnostic')
    const next = fixture()
    next.create(); expect(next.repo.stop('s', 'owner')).toBe(true)
    expect(next.repo.claim('s', 'owner')).toBe(false)
    next.repo.finish('s', 'owner', 'cancelled')
  })

  it('reconciles startup orphans once without changing terminal participants or dispatching', () => {
    const { repo, input, create } = fixture()
    create(); repo.claim('s', 'owner'); repo.bind('s', 'owner', 'p1', binding)
    repo.finishParticipant('s', 'owner', 'run', 'completed')
    repo.create({ ...input, id: 'created' })
    repo.create({ ...input, id: 'stopping' }); repo.stop('stopping', 'owner')
    repo.create({ ...input, id: 'done' }); repo.claim('done', 'owner'); repo.complete('done', 'owner', () => ({}))
    expect(repo.reconcileInterrupted()).toBe(3)
    expect(repo.reconcileInterrupted()).toBe(0)
    expect(repo.get('s', 'owner')?.status).toBe('interrupted')
    expect(repo.participants('s', 'owner').map(p => p.status)).toEqual(['completed', 'interrupted'])
    expect(repo.get('done', 'owner')?.status).toBe('completed')
    // Reconciliation must not rewrite participants of already terminal sessions.
    expect(repo.participants('done', 'owner').map(p => p.status)).toEqual(['reserved', 'reserved'])
    expect(() => repo.bind('created', 'owner', 'p1', binding)).toThrow()
  })

  it.each(['conversations', 'lineages', 'messages'])('cascades %s deletion through sessions and participants', table => {
    const { db, repo, create } = fixture()
    create()
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(table === 'conversations' ? 'c' : table === 'lineages' ? 'l' : 'a')
    expect(repo.get('s', 'owner')).toBeNull()
    expect(db.prepare('SELECT * FROM hadron_participants').all()).toHaveLength(0)
  })
})


describe('collaboration parent deletion lifecycle (migration 8)', () => {
  function deletionFixture() {
    const f = fixture()
    f.db.exec(`INSERT INTO subagent_runs VALUES ('run'), ('ordinary');
      INSERT INTO subagent_messages VALUES ('private-message','run'), ('ordinary-message','ordinary');
      INSERT INTO streaming_runs VALUES ('stream'), ('ordinary-stream');`)
    f.create()
    f.repo.claim('s', 'owner')
    f.repo.bind('s', 'owner', 'p1', binding)
    return f
  }
  for (const table of ['messages', 'lineages', 'conversations', 'hadron_sessions']) {
    const id = { messages: 'a', lineages: 'l', conversations: 'c', hadron_sessions: 's' }[table]!
    it(`blocks ${table} deletion atomically until the session is terminal`, () => {
      const { db, repo } = deletionFixture()
      // Install over populated v7 data, then repeat to prove idempotence.
      createCollaborationDeletionGuards(db)
      createCollaborationDeletionGuards(db)
      const remove = db.prepare(`DELETE FROM ${table} WHERE id = ?`)
      for (const status of ['created', 'running', 'stopping']) {
        db.prepare('UPDATE hadron_sessions SET status = ? WHERE id = ?').run(status, 's')
        expect(() => remove.run(id)).toThrow(/Stop collaboration/)
        expect(db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id)).toBeTruthy()
        expect(repo.ownsRunId('run')).toBe(true)
        expect(repo.ownsStreamId('stream')).toBe(true)
        expect(db.prepare('SELECT id FROM subagent_messages WHERE id = ?').get('private-message')).toBeTruthy()
      }
      repo.finish('s', 'owner', 'cancelled')
      remove.run(id)
      expect(db.prepare('SELECT id FROM hadron_sessions WHERE id = ?').get('s')).toBeUndefined()
      expect(db.prepare('SELECT id FROM subagent_runs WHERE id = ?').get('run')).toBeUndefined()
      expect(db.prepare('SELECT id FROM subagent_messages WHERE id = ?').get('private-message')).toBeUndefined()
      expect(db.prepare('SELECT stream_id FROM streaming_runs WHERE stream_id = ?').get('stream')).toBeUndefined()
      expect(db.prepare('SELECT id FROM subagent_runs WHERE id = ?').get('ordinary')).toBeTruthy()
      expect(db.prepare('SELECT stream_id FROM streaming_runs WHERE stream_id = ?').get('ordinary-stream')).toBeTruthy()
    })
  }
  it('cleans private records for every terminal status and allows unrelated deletion', () => {
    for (const status of ['completed', 'cancelled', 'failed', 'interrupted']) {
      const { db } = deletionFixture()
      createCollaborationDeletionGuards(db)
      db.prepare("DELETE FROM messages WHERE id = 'other-a'").run()
      db.prepare('UPDATE hadron_sessions SET status = ? WHERE id = ?').run(status, 's')
      db.prepare("DELETE FROM hadron_sessions WHERE id = 's'").run()
      expect(db.prepare("SELECT id FROM subagent_runs WHERE id = 'run'").get()).toBeUndefined()
      expect(db.prepare("SELECT stream_id FROM streaming_runs WHERE stream_id = 'stream'").get()).toBeUndefined()
    }
  })
})


it('pages saved IDs within exact owner/conversation scope using bound cursors', () => {
  const { repo, input } = fixture()
  for (const id of ['a', 'b', 'c']) repo.create({ ...input, id })
  repo.create({ ...input, id: 'foreign-owner', ownerId: 'another' })
  repo.create({ ...input, id: 'foreign-conversation', conversationId: 'other', sourceLineageId: 'other-l', anchorMessageId: 'other-a' })
  expect(repo.listIds('owner', 'c', 2)).toEqual(['c', 'b'])
  expect(repo.listIds('owner', 'c', 2, 'b')).toEqual(['a'])
  expect(repo.listIds('owner', 'c', 2, "' OR 1=1 --")).toEqual([])
  expect(() => repo.listIds('owner', 'c', 100)).toThrow('limit')
})


it('reopens the most recently created session rather than the greatest random ID', () => {
  const { repo, input } = fixture()
  for (const id of ['z-old', 'm-middle', 'a-new']) repo.create({ ...input, id })
  repo.create({ ...input, id: 'foreign', ownerId: 'another' })
  expect(repo.listIds('owner', 'c', 2)).toEqual(['a-new', 'm-middle'])
  expect(repo.listIds('owner', 'c', 2, 'm-middle')).toEqual(['z-old'])
  expect(repo.listIds('owner', 'c', 2, 'foreign')).toEqual([])
})
import {largeFixtureImage} from '../../../../../../shared/__fixtures__/hadronImage.js'
it('round-trips a JPEG larger than 64 KiB without widening or rebuilding the shared session table',()=>{
 const f=fixture(),configJson=JSON.stringify({mode:'proposal',images:[largeFixtureImage]}),input={...f.input,configJson}
 expect(configJson.length).toBeGreaterThan(65536)
 expect(f.repo.create(input).config_json).toBe(configJson)
 expect(f.repo.create(input).config_json).toBe(configJson)
 expect(f.db.prepare('SELECT length(config_json) AS size FROM hadron_sessions').get().size).toBeLessThan(65536)
 expect(()=>f.repo.get(input.id,'intruder')).toThrow()
})
