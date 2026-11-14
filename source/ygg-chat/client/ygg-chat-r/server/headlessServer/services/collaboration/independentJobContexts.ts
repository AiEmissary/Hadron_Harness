import {HadronRecycleBin,ensureRecycleBin,activeConversationSql} from '../../../hadronTools/recycleBin.js'
import { createHash } from 'node:crypto'
import { parseIndependentJobContext, parseIndependentJob, type IndependentJobInput, type IndependentJobContext, type IndependentJobContextInput, type AgentConversationTree } from '../../../../../../shared/independentJobs.js'
import { ProposalAccessDenied } from './proposalSessionService.js'

const terminal = (value: string) => ['completed', 'cancelled', 'failed', 'interrupted'].includes(value)
class HistoryDisplayBudget extends Error {}
const responseId = (jobId: string) => `hadron-response-${jobId}`

/** Durable branch topology uses the existing messages.meta contract, not renderer storage. */
export class IndependentJobContexts {
  constructor(private readonly db: any, private readonly authorize: (ownerId: string, conversationId: string) => void) {}
  /** Project lists contain private agent conversations as well as workspace chats.
   * Read their server-owned provenance; do not reinterpret them as fresh workspaces.
   * Keep the immediate source, since older saved work can have nested workspace scopes. */
  openWorkspace(ownerId: string, conversationId: string): import('../../../../../../shared/independentJobs.js').AgentWorkspaceNavigation {
    const own = this.source(ownerId, conversationId)
    const hasSessions = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='hadron_sessions'").get()
    // Older versions allowed a managed agent chat to become a workspace itself.
    // Its own shared history takes precedence over its original private provenance.
    const shared = hasSessions && this.db.prepare('SELECT id FROM hadron_sessions WHERE owner_id=? AND conversation_id=? ORDER BY rowid DESC LIMIT 1').get(ownerId, conversationId)
    if (shared) return { schemaVersion: 1, requestedConversationId: conversationId, workspaceConversationId: conversationId,
      slot: null, nodeId: null, sharedSessionId: shared.id }
    const job = this.db.prepare('SELECT id FROM hadron_independent_jobs WHERE owner_id=? AND conversation_id=? ORDER BY rowid DESC LIMIT 1').get(ownerId, conversationId)
    if (job) {
      const saved = this.saved(ownerId, job.id)
      return { schemaVersion: 1, requestedConversationId: conversationId, workspaceConversationId: saved.prepared.sourceConversationId,
        slot: saved.prepared.slot, nodeId: terminal(saved.row.status) && saved.row.run_id ? responseId(job.id) : saved.row.anchor_message_id }
    }
    if (hasSessions) {
      const message = this.db.prepare("SELECT meta FROM messages WHERE conversation_id=? AND json_valid(meta) AND json_type(meta, '$.hadronSharedProposal')='object' LIMIT 1").get(conversationId)
      const meta = JSON.parse(message?.meta ?? 'null')?.hadronSharedProposal
      if (meta) {
        if (meta.ownerId !== ownerId || !['a', 'b'].includes(meta.participant)) throw new ProposalAccessDenied()
        if (typeof meta.sessionId !== 'string' || !meta.sessionId || meta.sessionId.length > 100) throw new ProposalAccessDenied()
        const id = `proposal:${meta.sessionId}:${meta.participant}`
        const key = createHash('sha256').update(JSON.stringify([ownerId, id])).digest('hex')
        if (conversationId !== `hadron-proposal-${key}`) throw new ProposalAccessDenied()
        const session = this.db.prepare('SELECT * FROM hadron_sessions WHERE id=?').get(meta.sessionId)
        // The owned messages remain readable even when a historical session ledger
        // no longer exists. This grants no source-workspace/job execution authority.
        if (!session) return { schemaVersion: 1, requestedConversationId: conversationId,
          workspaceConversationId: conversationId, slot: null, nodeId: null, historicalOnly: true }
        if (session.owner_id !== ownerId || session.status !== 'completed') throw new ProposalAccessDenied()
        const source = this.source(ownerId, session.conversation_id)
        const participant = this.db.prepare('SELECT run_id FROM hadron_participants WHERE session_id=? AND participant_id=?').get(session.id, meta.participant)
        if (conversationId !== `hadron-proposal-${key}` || source.project_id !== own.project_id || participant?.run_id !== meta.sourceRunId) throw new ProposalAccessDenied()
        return { schemaVersion: 1, requestedConversationId: conversationId, workspaceConversationId: source.id,
          slot: meta.participant, nodeId: responseId(id) }
      }
    }
    return { schemaVersion: 1, requestedConversationId: conversationId, workspaceConversationId: conversationId, slot: null, nodeId: null }
  }
  private source(ownerId: string, id: string) {
    if (!ownerId || ownerId.length > 128) throw new ProposalAccessDenied()
    try { this.authorize(ownerId, id) } catch { throw new ProposalAccessDenied() }
    ensureRecycleBin(this.db)
    const row = this.db.prepare(`SELECT * FROM conversations WHERE id=? AND ${activeConversationSql()}`).get(id)
    if (row?.user_id !== ownerId || row.storage_mode !== 'local') throw new ProposalAccessDenied()
    return row
  }
  /** A completed shared proposal is a read-only branch root, with explicit source provenance. */
  private proposalSnapshot(ownerId: string, id: string) {
    const match = /^proposal:([^:]{1,100}):(a|b)$/.exec(id)
    if (!match) throw new Error('Invalid shared proposal reference')
    const session = this.db.prepare('SELECT * FROM hadron_sessions WHERE id=?').get(match[1])
    if (!session || session.owner_id !== ownerId || session.status !== 'completed') throw new ProposalAccessDenied()
    const source = this.source(ownerId, session.conversation_id)
    const participant = this.db.prepare('SELECT * FROM hadron_participants WHERE session_id=? AND participant_id=?').get(session.id, match[2])
    const run = participant?.run_id ? this.db.prepare('SELECT * FROM subagent_runs WHERE id=?').get(participant.run_id) : null
    if (!run || run.status !== 'completed' || run.conversation_id !== session.conversation_id || run.parent_message_id !== session.anchor_message_id) throw new Error('Shared proposal unavailable')
    const packet = JSON.parse(session.config_json), selection = packet.participants.find((item: any) => item.id === match[2])
    if (!selection || !['openaichatgpt','claudecode'].includes(selection.provider)) throw new Error('Unsupported proposal connection')
    const text = run.final_response ?? ''
    if (!text || text.length > 1_000_000) throw new Error('Shared proposal text unavailable')
    const key = createHash('sha256').update(JSON.stringify([ownerId, id])).digest('hex')
    const conversationId = `hadron-proposal-${key}`, anchorMessageId = `hadron-anchor-${key}`
    const prepared: IndependentJobContextInput = { schemaVersion: 1, id, sourceConversationId: session.conversation_id, slot: match[2] as 'a' | 'b' }
    const config: IndependentJobInput = { schemaVersion: 1, id, conversationId, anchorMessageId, task: packet.task, context: packet.continuationSnapshot?.context ?? packet.context, provider: selection.provider, modelName: selection.modelName }
    const meta = JSON.stringify({ hadronSharedProposal: { ownerId, sessionId: session.id, participant: match[2], sourceRunId: run.id } })
    this.db.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM conversations WHERE id=?').get(conversationId)
      if (!existing) this.db.prepare("INSERT INTO conversations (id, project_id, user_id, title, storage_mode) VALUES (?, ?, ?, ?, 'local')").run(conversationId, source.project_id, ownerId, `Hadron - Agent ${match[2].toUpperCase()} shared proposal branch`)
      else if (existing.user_id !== ownerId || existing.project_id !== source.project_id || existing.storage_mode !== 'local') throw new ProposalAccessDenied()
      for (const message of [{ id: anchorMessageId, parent: null, role: 'user', text: packet.task }, { id: responseId(id), parent: anchorMessageId, role: 'assistant', text }]) {
        const saved = this.db.prepare('SELECT * FROM messages WHERE id=?').get(message.id)
        if (saved && (saved.conversation_id !== conversationId || saved.parent_id !== message.parent || saved.content !== message.text || saved.meta !== meta)) throw new Error('Shared proposal snapshot conflict')
        if (!saved) this.db.prepare("INSERT INTO messages (id, conversation_id, parent_id, children_ids, role, content, plain_text_content, meta) VALUES (?, ?, ?, '[]', ?, ?, ?, ?)").run(message.id, conversationId, message.parent, message.role, message.text, message.text, meta)
      }
      this.link(anchorMessageId, responseId(id))
    })()
    return { row: { id, owner_id: ownerId, conversation_id: conversationId, anchor_message_id: anchorMessageId, status: 'completed', run_id: run.id }, prepared, config, text }
  }
  private saved(ownerId: string, id: string): {row: any; prepared: IndependentJobContextInput; config: IndependentJobInput} {
    if (id.startsWith('proposal:')) return this.proposalSnapshot(ownerId, id)

    const row = this.db.prepare('SELECT j.*, m.meta FROM hadron_independent_jobs j JOIN messages m ON m.id=j.anchor_message_id AND m.conversation_id=j.conversation_id WHERE j.id=?').get(id)
    if (!row || row.owner_id !== ownerId) throw new ProposalAccessDenied()
    const meta = JSON.parse(row.meta ?? 'null')?.hadronIndependentJob
    const prepared = parseIndependentJobContext(meta && Object.fromEntries(Object.entries(meta).filter(([key]) => key !== 'ownerId')))
    if (meta.ownerId !== ownerId || prepared.id !== row.id) throw new ProposalAccessDenied()
    const source = this.source(ownerId, prepared.sourceConversationId), conversation = this.source(ownerId, row.conversation_id)
    if (source.project_id !== conversation.project_id) throw new ProposalAccessDenied()
    const config = parseIndependentJob(Object.fromEntries(Object.entries(JSON.parse(row.config_json)).filter(([key]) => key !== 'deadlineMs')))
    if (config.id !== row.id || config.conversationId !== row.conversation_id || config.anchorMessageId !== row.anchor_message_id) throw new Error('Branch record mismatch')
    return { row, prepared, config }
  }
  editDraft(ownerId:string,id:string){
    const {row,prepared,config}=this.saved(ownerId,id)
    if(!terminal(row.status))throw Error('Wait for this answer to finish before editing or regenerating')
    return {schemaVersion:1 as const,sourceJobId:id,workspace:prepared.sourceConversationId,slot:prepared.slot,task:config.task,context:config.context,provider:config.provider,modelName:config.modelName,toolMode:config.toolMode??'',parent:prepared.parent??null}
  }
  removeConversation(ownerId:string,id:string){
    const {row}=this.saved(ownerId,id)
    if(!terminal(row.status)||this.db.prepare("SELECT 1 FROM hadron_independent_jobs WHERE conversation_id=? AND status NOT IN ('completed','cancelled','failed','interrupted')").get(row.conversation_id))throw Error('Stop the conversation before moving it to the bin')
    new HadronRecycleBin(this.db).trash('conversation',row.conversation_id,ownerId)
    return {removed:true,conversationId:row.conversation_id}
  }
  private materialize(ownerId: string, id: string) {
    if (id.startsWith('proposal:')) return this.proposalSnapshot(ownerId, id)
    const saved = this.saved(ownerId, id), { row, config } = saved
    this.db.prepare('UPDATE messages SET content=?, plain_text_content=? WHERE id=? AND conversation_id=?').run(config.task, config.task, row.anchor_message_id, row.conversation_id)
    let text = ''
    if (row.run_id) {
      const run = this.db.prepare('SELECT * FROM subagent_runs WHERE id=?').get(row.run_id)
      if (!run || run.conversation_id !== row.conversation_id || run.parent_message_id !== row.anchor_message_id) throw new Error('Branch output ownership mismatch')
      if (terminal(row.status)) {
        text = run.final_response ?? this.db.prepare("SELECT content FROM subagent_messages WHERE run_id=? AND role='assistant' ORDER BY rowid").all(row.run_id).map((message: any) => message.content ?? '').join('\n\n')
        if (text.length > 1_000_000) throw new Error('Branch output exceeds limit')
        const meta = JSON.stringify({ hadronAgentResponse: { jobId: id, runId: row.run_id, verified: false, status: row.status } })
        const existing = this.db.prepare('SELECT * FROM messages WHERE id=?').get(responseId(id))
        if (existing && (existing.conversation_id !== row.conversation_id || existing.parent_id !== row.anchor_message_id || existing.meta !== meta || existing.content !== text)) throw new Error('Branch response conflict')
        if (!existing) {
          this.db.prepare("INSERT INTO messages (id, conversation_id, parent_id, children_ids, role, content, plain_text_content, meta) VALUES (?, ?, ?, '[]', 'assistant', ?, ?, ?)").run(responseId(id), row.conversation_id, row.anchor_message_id, text, text, meta)
          this.link(row.anchor_message_id, responseId(id))
        }
      }
    }
    return { ...saved, text }
  }
  private link(parentId: string, childId: string) {
    const parent = this.db.prepare('SELECT children_ids FROM messages WHERE id=?').get(parentId)
    if (!parent) throw new Error('Branch parent missing')
    const children = JSON.parse(parent.children_ids ?? '[]')
    if (!Array.isArray(children)) throw new Error('Invalid branch children')
    if (!children.includes(childId)) this.db.prepare('UPDATE messages SET children_ids=? WHERE id=?').run(JSON.stringify([...children, childId]), parentId)
  }
  prepare(ownerId: string, raw: unknown): IndependentJobContext {
    const input = parseIndependentJobContext(raw)
    if (input.id.startsWith('proposal:')) throw new Error('Reserved proposal identity')
    const source = this.source(ownerId, input.sourceConversationId)
    const key = createHash('sha256').update(JSON.stringify([ownerId, input.id])).digest('hex')
    const anchorMessageId = `hadron-anchor-${key}`
    return this.db.transaction(() => {
      let conversationId = `hadron-job-${key}`, parentMessageId: string | null = null
      if (input.parent) {
        const parent = this.materialize(ownerId, input.parent.jobId)
        if (!terminal(parent.row.status) || parent.prepared.sourceConversationId !== input.sourceConversationId || parent.prepared.slot !== input.slot) throw new Error('Branch parent unavailable')
        if (input.parent.kind === 'response' && !parent.row.run_id) throw new Error('Branch response missing')
        conversationId = parent.row.conversation_id
        parentMessageId = input.parent.kind === 'task' ? parent.row.anchor_message_id : responseId(parent.row.id)
      }
      const meta = JSON.stringify({ hadronIndependentJob: { ...input, ownerId } })
      const existingAnchor = this.db.prepare('SELECT * FROM messages WHERE id=?').get(anchorMessageId)
      const existing = this.db.prepare('SELECT * FROM conversations WHERE id=?').get(conversationId)
      if (existingAnchor) {
        if (existing?.user_id !== ownerId || existing.storage_mode !== 'local' || existing.project_id !== source.project_id ||
          existingAnchor.conversation_id !== conversationId || existingAnchor.parent_id !== parentMessageId || existingAnchor.meta !== meta) throw new Error('Job context conflict')
      } else {
        if (!existing) this.db.prepare("INSERT INTO conversations (id, project_id, user_id, title, storage_mode) VALUES (?, ?, ?, ?, 'local')")
          .run(conversationId, source.project_id, ownerId, `Hadron - Agent ${input.slot.toUpperCase()} conversation`)
        else if (!input.parent) throw new Error('Job context conflict')
        this.db.prepare("INSERT INTO messages (id, conversation_id, parent_id, children_ids, role, content, plain_text_content, meta) VALUES (?, ?, ?, '[]', 'user', ?, ?, ?)")
          .run(anchorMessageId, conversationId, parentMessageId, 'Independent job workspace', 'Independent job workspace', meta)
        if (parentMessageId) this.link(parentMessageId, anchorMessageId)
      }
      if (input.parent && !existingAnchor) this.history(ownerId, { schemaVersion: 1, id: input.id, conversationId, anchorMessageId, task: 'Independent job workspace', context: '', provider: 'openaichatgpt', modelName: 'preparation' })
      return { ...input, conversationId, anchorMessageId }
    })()
  }
  /** Resolve only the selected ancestry, from canonical owned records. Never include siblings/other agents. */
  history(ownerId: string, input: IndependentJobInput) {
    const anchor = this.db.prepare('SELECT * FROM messages WHERE id=? AND conversation_id=?').get(input.anchorMessageId, input.conversationId)
    const meta = JSON.parse(anchor?.meta ?? 'null')?.hadronIndependentJob
    const prepared = parseIndependentJobContext(meta && Object.fromEntries(Object.entries(meta).filter(([key]) => key !== 'ownerId')))
    if (meta.ownerId !== ownerId || prepared.id !== input.id) throw new ProposalAccessDenied()
    const source = this.source(ownerId, prepared.sourceConversationId), own = this.source(ownerId, input.conversationId)
    if (source.project_id !== own.project_id) throw new ProposalAccessDenied()
    const existing = this.db.prepare('SELECT config_json FROM hadron_independent_jobs WHERE id=?').get(input.id)
    if (existing) {
      const config = parseIndependentJob(Object.fromEntries(Object.entries(JSON.parse(existing.config_json)).filter(([key]) => key !== 'deadlineMs')))
      if (JSON.stringify(config) !== JSON.stringify(input)) throw new Error('Job configuration conflict')
    }
    const result: Array<{ role: 'user' | 'assistant'; content: string; status?: string }> = [], seen = new Set<string>()
    let parent = prepared.parent, expectedParent: string | null = null
    if (parent) { const row = this.saved(ownerId, parent.jobId).row; expectedParent = parent.kind === 'task' ? row.anchor_message_id : responseId(row.id) }
    if (anchor.parent_id !== expectedParent) throw new Error('Branch anchor mismatch')
    while (parent) {
      if (seen.has(parent.jobId) || seen.size >= 120) throw new Error('Branch path exceeds limit')
      seen.add(parent.jobId)
      const saved = this.materialize(ownerId, parent.jobId)
      if (!terminal(saved.row.status) || saved.row.conversation_id !== input.conversationId || saved.prepared.sourceConversationId !== prepared.sourceConversationId || saved.prepared.slot !== prepared.slot) throw new ProposalAccessDenied()
      const segment: typeof result = [{ role: 'user', content: JSON.stringify({ task: saved.config.task, context: saved.config.context }) }]
      if (parent.kind === 'response') {
        if (!saved.row.run_id) throw new Error('Branch output missing')
        segment.push({ role: 'assistant', content: saved.text, status: saved.row.status })
      }
      result.unshift(...segment)
      parent = saved.prepared.parent
    }
    if (JSON.stringify(result).length > 64000) throw new Error('Selected branch context exceeds limit; start a new task with a summary')
    this.db.prepare('UPDATE messages SET content=?, plain_text_content=? WHERE id=?').run(input.task, input.task, input.anchorMessageId)
    return result
  }
  workspace(ownerId: string, sourceConversationId: string, slot: 'a' | 'b', page: {cursor?: string; focusNodeId?: string} = {}): AgentConversationTree {
    ensureRecycleBin(this.db)
    this.source(ownerId, sourceConversationId)
    if (!['a', 'b'].includes(slot)) throw new Error('Invalid agent slot')
    if (page.cursor !== undefined && !/^[1-9]\d{0,14}:[jp]$/.test(page.cursor)) throw new Error('Invalid history cursor')
    if (page.focusNodeId !== undefined && (!page.focusNodeId || page.focusNodeId.length > 256)) throw new Error('Invalid history selection')
    const [sequence, kind] = page.cursor?.split(':') ?? ['9007199254740991', 'z']
    const hasSessions = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='hadron_sessions'").get()
    // Keyset pages use bounded row identities, never a growing OFFSET or whole-history text read.
    const query = `SELECT j.rowid AS seq, 'j' AS kind, j.id FROM hadron_independent_jobs j JOIN messages m ON m.id=j.anchor_message_id JOIN conversations c ON c.id=j.conversation_id
      WHERE j.owner_id=? AND json_valid(m.meta) AND json_extract(m.meta, '$.hadronIndependentJob.sourceConversationId')=?
      AND json_extract(m.meta, '$.hadronIndependentJob.slot')=? AND ${activeConversationSql('c')}` + (hasSessions ?
      " UNION ALL SELECT rowid AS seq, 'p' AS kind, id FROM hadron_sessions WHERE owner_id=? AND conversation_id=? AND status='completed'" : '')
    const args = hasSessions ? [ownerId, sourceConversationId, slot, ownerId, sourceConversationId] : [ownerId, sourceConversationId, slot]
    const rows = this.db.prepare(`SELECT * FROM (${query}) WHERE seq < ? OR (seq = ? AND kind < ?) ORDER BY seq DESC, kind DESC LIMIT 33`).all(...args, Number(sequence), Number(sequence), kind)
    let pageSize = 32
    for (;;) {
      const selected = rows.slice(0, pageSize)
      try {
        return this.db.transaction(() => {
          const nodes: AgentConversationTree['nodes'] = [], seen = new Set<string>(), visiting = new Set<string>()
          let textSize = 0
          const append = (id: string) => {
            const conversation=id.startsWith('proposal:')?`hadron-proposal-${createHash('sha256').update(JSON.stringify([ownerId,id])).digest('hex')}`:this.db.prepare('SELECT conversation_id FROM hadron_independent_jobs WHERE id=? AND owner_id=?').get(id,ownerId)?.conversation_id
            if(conversation&&this.db.prepare("SELECT 1 FROM hadron_recycle_bin WHERE kind='conversation' AND item_id=?").get(conversation))return
            if (seen.has(id)) return
            if (visiting.has(id)) throw new Error('Cyclic branch')
            if (seen.size + visiting.size >= 256) throw new HistoryDisplayBudget('Selected branch exceeds display limit')
            visiting.add(id)
            const saved = this.materialize(ownerId, id), { row, config, prepared } = saved
            if (prepared.sourceConversationId !== sourceConversationId || prepared.slot !== slot) throw new ProposalAccessDenied()
            let parentId: string | null = null
            if (prepared.parent) {
              const parent = this.saved(ownerId, prepared.parent.jobId)
              if (parent.row.conversation_id !== row.conversation_id || parent.prepared.sourceConversationId !== sourceConversationId || parent.prepared.slot !== slot) throw new Error('Cross-linked branch')
              append(parent.row.id)
              parentId = prepared.parent.kind === 'task' ? parent.row.anchor_message_id : responseId(parent.row.id)
            }
            const base = { jobId: row.id, conversationId: row.conversation_id, provider: config.provider, modelName: config.modelName }
            textSize += config.task.length + saved.text.length
            if (textSize > 4_000_000) throw new HistoryDisplayBudget('Selected branch exceeds display size')
            nodes.push({ ...base, id: row.anchor_message_id, parentId, kind: 'task', status: row.status, text: config.task })
            if (row.run_id) nodes.push({ ...base, id: responseId(row.id), parentId: row.anchor_message_id, kind: 'response', status: row.status, text: saved.text })
            visiting.delete(id); seen.add(id)
          }
          // Pin an explicitly selected path so paging never silently changes a follow-up's parent.
          if (page.focusNodeId) {
            const job = this.db.prepare("SELECT id FROM hadron_independent_jobs WHERE owner_id=? AND (anchor_message_id=? OR 'hadron-response-' || id=?)").get(ownerId, page.focusNodeId, page.focusNodeId)
            if (job) append(job.id)
            else if (/^hadron-response-proposal:[^:]+:[ab]$/.test(page.focusNodeId)) {
              const proposalId = page.focusNodeId.slice('hadron-response-'.length)
              const sessionId = proposalId.split(':')[1]
              const session = hasSessions && this.db.prepare('SELECT owner_id, conversation_id, status FROM hadron_sessions WHERE id=?').get(sessionId)
              if (!session || session.owner_id !== ownerId || session.conversation_id !== sourceConversationId || !proposalId.endsWith(`:${slot}`)) throw new ProposalAccessDenied()
              // A running collaboration has no completed proposal snapshot to pin yet.
              if (session.status === 'completed') append(proposalId)
            }
            else {
              const message = this.db.prepare('SELECT m.meta FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.user_id=?').get(page.focusNodeId, ownerId)
              const meta = JSON.parse(message?.meta ?? 'null')?.hadronSharedProposal
              if (!meta || meta.ownerId !== ownerId || meta.participant !== slot) throw new ProposalAccessDenied()
              append(`proposal:${meta.sessionId}:${slot}`)
            }
          }
          for (const item of selected.reverse()) append(item.kind === 'p' ? `proposal:${item.id}:${slot}` : item.id)
          const last = rows[Math.min(rows.length, pageSize) - 1]
          return { schemaVersion: 1, sourceConversationId, slot, nodes,
            page: { nextCursor: rows.length > pageSize ? `${last.seq}:${last.kind}` : null, size: 32 } }
        })()
      } catch (error) {
        // Retry a smaller complete page after transaction rollback. Never cut a selected ancestry.
        if (!(error instanceof HistoryDisplayBudget) || pageSize === 1) throw error
        pageSize = Math.ceil(pageSize / 2)
      }
    }
  }
}
