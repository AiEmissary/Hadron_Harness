import { createRequire } from 'node:module'
import { MessageRepo } from '../../../persistence/messageRepo.js'
import { LineageRepo } from '../../../persistence/lineageRepo.js'
import { SubagentRunRepo } from '../../../persistence/subagentRunRepo.js'
import { SubagentRunService } from '../../subagentRunService.js'
import type { ProviderRouter } from '../../providerRouter.js'
import type { StreamingRunRepo } from '../../../persistence/streamingRunRepo.js'

/** P0-only in-memory schema; real repositories, no localServer startup or user data. */
export function proposalSqlite(providerRouter: ProviderRouter) {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
  const sqlite = new DatabaseSync(':memory:')
  let savepoint = 0
  const db = {
    exec: (sql: string) => sqlite.exec(sql),
    prepare: (sql: string) => sqlite.prepare(sql),
    transaction: <T>(operation: () => T) => () => {
      const name = `proposal_${savepoint++}`
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
  sqlite.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, updated_at TEXT);
    CREATE TABLE conversations (id TEXT PRIMARY KEY, project_id TEXT, updated_at TEXT);
    INSERT INTO conversations VALUES ('c1', NULL, NULL), ('other', NULL, NULL);
    CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, parent_id TEXT, children_ids TEXT,
      role TEXT, content TEXT, plain_text_content TEXT, thinking_block TEXT, tool_calls TEXT, tool_call_id TEXT,
      model_name TEXT, note TEXT, note_color TEXT, ex_agent_session_id TEXT, ex_agent_type TEXT,
      content_blocks TEXT, created_at TEXT, meta TEXT, lineage_id TEXT);
    CREATE TABLE lineages (id TEXT PRIMARY KEY, conversation_id TEXT, parent_lineage_id TEXT,
      forked_from_message_id TEXT, root_message_id TEXT, head_message_id TEXT, status TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE fork_operations (id TEXT PRIMARY KEY, conversation_id TEXT, source_lineage_id TEXT,
      target_lineage_id TEXT, source_message_id TEXT, materialized_message_id TEXT, operation TEXT,
      status TEXT, metadata_json TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE subagent_runs (id TEXT PRIMARY KEY, conversation_id TEXT, parent_message_id TEXT,
      tool_call_id TEXT, prompt TEXT, provider TEXT, model_name TEXT, system_prompt TEXT, status TEXT,
      final_response TEXT, error TEXT, turns_used INTEGER, tool_calls_used INTEGER, created_at TEXT,
      updated_at TEXT, lineage_id TEXT, handle TEXT UNIQUE, attempt INTEGER DEFAULT 0);
    CREATE TABLE subagent_messages (id TEXT PRIMARY KEY, run_id TEXT, role TEXT, content TEXT,
      thinking_block TEXT, tool_calls TEXT, tool_call_id TEXT, content_blocks TEXT, sequence INTEGER, created_at TEXT, meta TEXT);
  `)
  const prepare = (sql: string) => db.prepare(sql)
  const insert = (table: string, columns: string[]) => prepare(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
  const statements = {
    upsertMessage: insert('messages', ['id', 'conversation_id', 'parent_id', 'children_ids', 'role', 'content',
      'plain_text_content', 'thinking_block', 'tool_calls', 'tool_call_id', 'model_name', 'note', 'note_color',
      'ex_agent_session_id', 'ex_agent_type', 'content_blocks', 'created_at', 'meta']),
    getMessageById: prepare('SELECT * FROM messages WHERE id = ?'),
    getConversationById: prepare('SELECT * FROM conversations WHERE id = ?'),
    insertLineage: prepare('INSERT INTO lineages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    getLineageById: prepare('SELECT * FROM lineages WHERE id = ?'),
    listLineagesByConversation: prepare('SELECT * FROM lineages WHERE conversation_id = ?'),
    attachMessageToLineage: prepare('UPDATE messages SET lineage_id = ? WHERE id = ? AND conversation_id = (SELECT conversation_id FROM lineages WHERE id = ?) AND (lineage_id IS NULL OR lineage_id = ?)'),
    advanceLineage: prepare('UPDATE lineages SET root_message_id = COALESCE(root_message_id, ?), head_message_id = ?, status = ?, updated_at = ? WHERE id = ?'),
    insertForkOperation: prepare('INSERT INTO fork_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    getForkOperationById: prepare('SELECT * FROM fork_operations WHERE id = ?'),
    materializeForkOperation: prepare("UPDATE fork_operations SET materialized_message_id = ?, status = 'materialized', updated_at = ? WHERE id = ? AND status = 'pending'"),
    upsertSubagentRun: insert('subagent_runs', ['id', 'conversation_id', 'parent_message_id', 'tool_call_id',
      'prompt', 'provider', 'model_name', 'system_prompt', 'status', 'final_response', 'error', 'turns_used',
      'tool_calls_used', 'created_at', 'updated_at']),
    attachSubagentRunToLineage: prepare('UPDATE subagent_runs SET lineage_id = ? WHERE id = ?'),
    attachSubagentRunHandle: prepare('UPDATE subagent_runs SET handle = ? WHERE id = ?'),
    getSubagentRunById: prepare('SELECT * FROM subagent_runs WHERE id = ?'),
    getSubagentRunByHandle: prepare('SELECT * FROM subagent_runs WHERE handle = ?'),
    updateSubagentRun: prepare('UPDATE subagent_runs SET status = COALESCE(?, status), final_response = COALESCE(?, final_response), error = ?, turns_used = COALESCE(?, turns_used), tool_calls_used = COALESCE(?, tool_calls_used), updated_at = ? WHERE id = ?'),
    insertSubagentMessage: insert('subagent_messages', ['id', 'run_id', 'role', 'content', 'thinking_block',
      'tool_calls', 'tool_call_id', 'content_blocks', 'sequence', 'created_at']),
    getSubagentMessagesByRunId: prepare('SELECT * FROM subagent_messages WHERE run_id = ? ORDER BY sequence'),
    getNextSubagentMessageSequence: prepare('SELECT COALESCE(MAX(sequence), -1) + 1 AS nextSequence FROM subagent_messages WHERE run_id = ?'),
    updateSubagentMessageMetadata: prepare('UPDATE subagent_messages SET meta = ? WHERE id = ? AND run_id = ?'),
  }
  const messages = new MessageRepo({ db, statements })
  const lineages = new LineageRepo({ db, statements })
  const runs = new SubagentRunRepo({ statements })
  let stream = 0
  const finished: Array<{ streamId: string; status: string }> = []
  const agents = new SubagentRunService({ runRepo: runs, providerRouter,
    // Streaming transport is a recorder, not a production RunSessionRegistry.
    streamingRunRepo: { upsert: () => `proposal-stream-${++stream}`,
      finish: (streamId: string, input: { status: string }) => finished.push({ streamId, ...input }),
    } as unknown as StreamingRunRepo,
    resolveToolsByName: names => {
      if (!Array.isArray(names) || names.length) throw new Error('P0 allows only explicit empty tools')
      return { tools: [], resolvedNames: [], unknownNames: [] }
    },
    toolExecutor: async () => { throw new Error('No tools may execute during proposal independence') },
  })
  const anchor = messages.createMessage({ conversationId: 'c1', parentId: null, role: 'user', content: 'Frozen anchor' })
  const source = lineages.createRoot({ conversationId: 'c1', rootMessageId: anchor.id })
  return { db, messages, lineages, runs, agents, anchor, source, finished,
    close: () => sqlite.close() }
}
