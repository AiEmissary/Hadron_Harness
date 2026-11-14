import { CollaborationOwnerMismatch } from './collaborationRepo.js'
export interface IndependentJobRow {
  id: string; owner_id: string; conversation_id: string; anchor_message_id: string
  config_json: string; config_hash: string; status: string; revision: number
  run_id: string | null; handle: string | null; stream_id: string | null
}
export class IndependentJobsRepo {
  constructor(private readonly db: any) {}
  get(id: string, ownerId: string): IndependentJobRow | null {
    const row = this.db.prepare('SELECT * FROM hadron_independent_jobs WHERE id = ?').get(id)
    if (row && row.owner_id !== ownerId) throw new CollaborationOwnerMismatch()
    return row ?? null
  }
  create(input: { id: string; ownerId: string; conversationId: string; anchorMessageId: string; configJson: string; configHash: string }): IndependentJobRow {
    if (![input.id, input.ownerId, input.conversationId, input.anchorMessageId, input.configHash].every(value => typeof value === 'string' && value.length > 0 && value.length <= 128) ||
      Buffer.byteLength(input.configJson, 'utf8') > 65536) throw new Error('Invalid independent job')
    JSON.parse(input.configJson)
    return this.db.transaction(() => {
      const existing = this.get(input.id, input.ownerId)
      if (existing) {
        if (existing.conversation_id !== input.conversationId || existing.anchor_message_id !== input.anchorMessageId || existing.config_hash !== input.configHash || existing.config_json !== input.configJson) throw new Error('Job configuration conflict')
        return existing
      }
      const anchor = this.db.prepare('SELECT conversation_id FROM messages WHERE id = ?').get(input.anchorMessageId)
      if (anchor?.conversation_id !== input.conversationId) throw new Error('Invalid job anchor')
      this.db.prepare('INSERT INTO hadron_independent_jobs (id, owner_id, conversation_id, anchor_message_id, config_json, config_hash) VALUES (?, ?, ?, ?, ?, ?)')
        .run(input.id, input.ownerId, input.conversationId, input.anchorMessageId, input.configJson, input.configHash)
      return this.get(input.id, input.ownerId)!
    })()
  }
  claim(id: string, ownerId: string): boolean {
    this.get(id, ownerId)
    return this.db.prepare("UPDATE hadron_independent_jobs SET status='running', revision=revision+1 WHERE id=? AND owner_id=? AND status='created' AND (SELECT COUNT(*) FROM hadron_independent_jobs WHERE owner_id=? AND status IN ('running','stopping')) < 2").run(id, ownerId, ownerId).changes > 0
  }
  bind(id: string, ownerId: string, child: { runId: string; handle: string; streamId: string }): void {
    this.db.transaction(() => {
      const row = this.get(id, ownerId)
      if (!row || row.status !== 'running') throw new Error('Job no longer running')
      if (row.run_id) {
        if (row.run_id === child.runId && row.handle === child.handle && row.stream_id === child.streamId) return
        throw new Error('Job binding conflict')
      }
      const run = this.db.prepare('SELECT conversation_id, parent_message_id FROM subagent_runs WHERE id=?').get(child.runId)
      if (!child.handle || !child.streamId || run?.conversation_id !== row.conversation_id || run.parent_message_id !== row.anchor_message_id) throw new Error('Job run ownership mismatch')
      this.db.prepare("UPDATE hadron_independent_jobs SET run_id=?, handle=?, stream_id=? WHERE id=? AND owner_id=? AND status='running'")
        .run(child.runId, child.handle, child.streamId, id, ownerId)
    })()
  }
  stop(id: string, ownerId: string): boolean {
    this.get(id, ownerId)
    return this.db.prepare("UPDATE hadron_independent_jobs SET status='stopping', revision=revision+1 WHERE id=? AND owner_id=? AND status IN ('created','running')").run(id, ownerId).changes > 0
  }
  finish(id: string, ownerId: string, status: 'completed' | 'cancelled' | 'failed'): void {
    const row = this.get(id, ownerId)
    if (!row || !['running', 'stopping'].includes(row.status)) return
    if (status === 'completed' && row.status !== 'running') throw new Error('Stopped job cannot complete')
    this.db.prepare('UPDATE hadron_independent_jobs SET status=?, revision=revision+1 WHERE id=? AND owner_id=?').run(status, id, ownerId)
  }
  ownsRunId(id: string): boolean { return !!this.db.prepare('SELECT 1 FROM hadron_independent_jobs WHERE run_id=?').get(id) }
  ownsStreamId(id: string): boolean { return !!this.db.prepare('SELECT 1 FROM hadron_independent_jobs WHERE stream_id=?').get(id) }
  agentLabel(id: string, ownerId: string): string {
    const row = this.get(id, ownerId)
    if (!row) return 'Independent job'
    const anchor = this.db.prepare('SELECT meta FROM messages WHERE id=? AND conversation_id=?').get(row.anchor_message_id, row.conversation_id)
    try {
      const slot = JSON.parse(anchor?.meta ?? 'null')?.hadronIndependentJob?.slot
      return slot === 'a' || slot === 'b' ? `Agent ${slot.toUpperCase()}` : 'Independent job'
    } catch { return 'Independent job' }
  }
  branchReference(id: string, ownerId: string) {
    const row = this.get(id, ownerId); if (!row) return undefined
    const anchor = this.db.prepare('SELECT meta FROM messages WHERE id=? AND conversation_id=?').get(row.anchor_message_id, row.conversation_id)
    const meta = JSON.parse(anchor?.meta ?? 'null')?.hadronIndependentJob
    if (!meta || meta.ownerId !== ownerId || typeof meta.sourceConversationId !== 'string') return undefined
    return { conversationId: row.conversation_id, sourceConversationId: meta.sourceConversationId,
      ...(meta.parent ? { parentJobId: meta.parent.jobId as string, parentKind: meta.parent.kind as 'task' | 'response' } : {}) }
  }
  reconcileInterrupted(): number {
    return this.db.prepare("UPDATE hadron_independent_jobs SET status='interrupted', revision=revision+1 WHERE status IN ('created','running','stopping')").run().changes
  }
}
