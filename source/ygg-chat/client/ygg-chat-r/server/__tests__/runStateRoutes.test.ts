import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { registerRunStateRoutes } from '../routes/runStateRoutes.js'

function setup(protectedIds = false) {
  const handlers = new Map<string, any>()
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, (path: string, handler: any) => handlers.set(`${method} ${path}`, handler)]))
  const authoritative = { stream_id: 'r', source: 'headless', status: 'error', duration_ms: 42,
    metadata_json: JSON.stringify({ runStatistics: { version: 1, invocationRecording: true } }) }
  const statements = {
    getStreamingRunById: { get: vi.fn(() => authoritative) },
    upsertStreamingRun: { run: vi.fn() }, updateStreamingRun: { run: vi.fn() },
    getStreamingRunsByConversationId: { all: vi.fn(() => [authoritative, { ...authoritative, stream_id: 'old', metadata_json: null }]) },
    getToolCountsByConversation: { all: vi.fn(() => [{ run_id: 'r', count: 3 }]) },
  }
  registerRunStateRoutes(app as any, { statements,
    isCollaborationRun: id => protectedIds && id === 'owned',
    isCollaborationStream: id => protectedIds && id === 'r',
  })
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
  return { handlers, statements, res }
}

describe('run-state statistics compatibility', () => {
  it('ignores renderer lifecycle writes and source spoofing for authoritative runs', () => {
    const { handlers, statements, res } = setup()
    handlers.get('post /api/streaming/runs')({ body: { stream_id: 'r', source: 'headless', status: 'running' } }, res)
    handlers.get('patch /api/streaming/runs/:streamId')({ params: { streamId: 'r' }, body: { status: 'completed' } }, res)
    expect(statements.upsertStreamingRun.run).not.toHaveBeenCalled()
    expect(statements.updateStreamingRun.run).not.toHaveBeenCalled()
    expect(res.json.mock.calls[1][0].run.status).toBe('error')
  })
  it('returns batched counts with explicit historical coverage without dropping existing fields', () => {
    const { handlers, statements, res } = setup()
    handlers.get('get /api/conversations/:conversationId/streaming-runs')({ params: { conversationId: 'c' } }, res)
    expect(statements.getToolCountsByConversation.all).toHaveBeenCalledWith('c')
    const runs = res.json.mock.calls[0][0].runs
    expect(runs[0]).toMatchObject({ duration_ms: 42, status: 'error', tool_statistics: { count: 3, coverage: 'recorded' } })
    expect(runs[1].tool_statistics.coverage).toBe('unavailable')
  })
})


describe('collaboration legacy persistence boundary', () => {
  it('denies stream reads and writes before reading authoritative records', () => {
    const { handlers, statements, res } = setup(true)
    handlers.get('post /api/streaming/runs')({ body: { streamId: 'r' } }, res)
    handlers.get('patch /api/streaming/runs/:streamId')({ params: { streamId: 'r' }, body: {} }, res)
    handlers.get('get /api/streaming/runs/:streamId')({ params: { streamId: 'r' } }, res)
    expect(res.status.mock.calls).toEqual([[403], [403], [403]])
    expect(statements.getStreamingRunById.get).not.toHaveBeenCalled()
    expect(statements.upsertStreamingRun.run).not.toHaveBeenCalled()
    expect(statements.updateStreamingRun.run).not.toHaveBeenCalled()
  })
  it('filters protected streams from mixed conversation ledger lists', () => {
    const { handlers, res } = setup(true)
    handlers.get('get /api/conversations/:conversationId/streaming-runs')({ params: { conversationId: 'c' } }, res)
    expect(res.json.mock.calls[0][0].runs.map((run: any) => run.stream_id)).toEqual(['old'])
  })
  it('denies transcript append, run replacement and status writes before repository access', () => {
    const { handlers, res } = setup(true)
    handlers.get('post /api/subagents/runs')({ body: {
      id: ' owned ', conversationId: 'c', parentMessageId: 'p', prompt: 'replacement',
    } }, res)
    handlers.get('post /api/subagents/runs/:runId/messages')({ params: { runId: 'owned' }, body: { role: 'user', content: 'injected' } }, res)
    handlers.get('patch /api/subagents/runs/:runId')({ params: { runId: 'owned' }, body: { status: 'completed' } }, res)
    expect(res.status.mock.calls).toEqual([[403], [403], [403]])
    expect(res.json.mock.calls.every(([body]: any[]) => body.error === 'scoped_collaboration_access_required')).toBe(true)
  })
  it('filters parent/conversation transcripts and keeps repositories local to each registration', () => {
    const handlers = new Map<string, any>()
    const app = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, (path: string, handler: any) => handlers.set(`${method} ${path}`, handler)]))
    const statements = {
      getSubagentRunsByParentMessageId: { all: () => [{ id: 'owned' }, { id: 'ordinary' }] },
      getSubagentRunsByConversationId: { all: () => [{ id: 'owned' }, { id: 'ordinary' }] },
      getSubagentMessagesByRunId: { all: (id: string) => [{ id: 'm', run_id: id, content: id === 'owned' ? 'private' : 'public' }] },
    }
    registerRunStateRoutes(app as any, { statements, isCollaborationRun: id => id === 'owned' })
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    handlers.get('get /api/subagents/by-parent/:messageId')({ params: { messageId: 'p' } }, res)
    handlers.get('get /api/conversations/:conversationId/subagents')({ params: { conversationId: 'c' } }, res)
    expect(res.json.mock.calls.map(([body]) => body.runs.map((run: any) => run.id))).toEqual([['ordinary'], ['ordinary']])
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('private')
    const second = { ...statements, getSubagentRunsByConversationId: { all: () => [{ id: 'second-db' }] } }
    registerRunStateRoutes(app as any, { statements: second })
    handlers.get('get /api/conversations/:conversationId/subagents')({ params: { conversationId: 'c' } }, res)
    expect(res.json.mock.calls[2][0].runs[0].id).toBe('second-db')
  })
})


it('production transcript upsert cannot overwrite another run through a colliding message ID', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`CREATE TABLE subagent_messages (id TEXT PRIMARY KEY, run_id TEXT, role TEXT, content TEXT,
      thinking_block TEXT, tool_calls TEXT, tool_call_id TEXT, content_blocks TEXT, sequence INTEGER, created_at TEXT)`)
    const source = readFileSync(new URL('../localServer.ts', import.meta.url), 'utf8')
    const sql = source.match(/insertSubagentMessage: db.prepare\(`([\s\S]*?)`\)/)?.[1]
    expect(sql).toBeTruthy()
    const insert = db.prepare(sql!)
    const values = (run: string, text: string) => ['same-id', run, 'assistant', text, null, null, null, null, 0, 'now']
    insert.run(...values('protected', 'original'))
    insert.run(...values('ordinary', 'injected'))
    expect(db.prepare('SELECT run_id, content FROM subagent_messages').get()).toMatchObject({ run_id: 'protected', content: 'original' })
    insert.run(...values('protected', 'updated by owner'))
    expect(db.prepare('SELECT content FROM subagent_messages').get().content).toBe('updated by owner')
  } finally { db.close() }
})
