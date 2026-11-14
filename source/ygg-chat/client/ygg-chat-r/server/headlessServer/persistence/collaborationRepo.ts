import {storeJobImages,restoreJobImages} from './savedJobImages.js'
export type CollaborationStatus = 'created' | 'running' | 'stopping' | 'completed' | 'cancelled' | 'failed' | 'interrupted'
export class CollaborationOwnerMismatch extends Error {
  constructor() { super('Collaboration owner mismatch') }
}
export interface CollaborationSessionRow {
  id: string
  owner_id: string
  conversation_id: string
  source_lineage_id: string
  anchor_message_id: string
  status: CollaborationStatus
  revision: number
  config_json: string
  config_hash: string
  checkpoints_json: string | null
  error: string | null
}
export interface CollaborationParticipantRow {
  participant_id: string
  run_id: string | null
  handle: string | null
  stream_id: string | null
  status: string
}
export interface CreateCollaborationInput {
  id: string
  ownerId: string
  conversationId: string
  sourceLineageId: string
  anchorMessageId: string
  configJson: string
  configHash: string
  participantIds: string[]
}
const terminal = (status: string) => ['completed', 'cancelled', 'failed', 'interrupted'].includes(status)

/** Internal durable admission/fencing only. Does not dispatch, resume or publish source mutations. */
export class CollaborationRepo {
  private readonly db: any
  constructor({ db }: { db: any }) { this.db = db }

  /** Authority lookup only: no transcript/config disclosure. Indexed by stream_id. */
  ownsStreamId(streamId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM hadron_participants WHERE stream_id = ? UNION ALL SELECT 1 FROM hadron_workflow_runs WHERE stream_id = ? UNION ALL SELECT 1 FROM hadron_verification_runs WHERE stream_id = ? LIMIT 1').get(streamId, streamId, streamId)
  }

  /** Bounded newest-first pagination with scoped ID cursors. No task/context/config disclosure. */
  listIds(ownerId: string, conversationId: string, limit: number, before?: string): string[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 51) throw new Error('Invalid page limit')
    const rows = before === undefined
      ? this.db.prepare('SELECT id FROM hadron_sessions WHERE owner_id = ? AND conversation_id = ? ORDER BY rowid DESC LIMIT ?').all(ownerId, conversationId, limit)
      : this.db.prepare('SELECT id FROM hadron_sessions WHERE owner_id = ? AND conversation_id = ? AND rowid < (SELECT rowid FROM hadron_sessions WHERE id = ? AND owner_id = ? AND conversation_id = ?) ORDER BY rowid DESC LIMIT ?').all(ownerId, conversationId, before, ownerId, conversationId, limit)
    return rows.map((row: { id: string }) => row.id)
  }

  treeIds(ownerId: string, conversationId: string): string[] {
    const rows = this.db.prepare('SELECT id FROM hadron_sessions WHERE owner_id=? AND conversation_id=? ORDER BY rowid LIMIT 129').all(ownerId, conversationId)
    if (rows.length > 128) throw new Error('Shared tree exceeds display limit')
    return rows.map((row: {id:string})=>row.id)
  }

  ownsRunId(runId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM hadron_participants WHERE run_id = ? UNION ALL SELECT 1 FROM hadron_workflow_runs WHERE run_id = ? UNION ALL SELECT 1 FROM hadron_verification_runs WHERE run_id = ? LIMIT 1').get(runId, runId, runId)
  }

  get(id: string, ownerId: string): CollaborationSessionRow | null {
    const row = this.db.prepare('SELECT * FROM hadron_sessions WHERE id = ?').get(id)
    if (row && row.owner_id !== ownerId) throw new CollaborationOwnerMismatch()
    return row?{...row,config_json:restoreJobImages(this.db,'shared',row)}:null
  }

  private require(id: string, ownerId: string): CollaborationSessionRow {
    const row = this.get(id, ownerId)
    if (!row) throw new Error('Collaboration session not found')
    return row
  }

  create(input: CreateCollaborationInput): CollaborationSessionRow {
    const { id, ownerId, conversationId, sourceLineageId, anchorMessageId, configJson, configHash, participantIds } = input
    if (![id, ownerId, conversationId, sourceLineageId, anchorMessageId, configHash].every(v => typeof v === 'string' && v.length > 0)
      || typeof configJson !== 'string' || Buffer.byteLength(configJson, 'utf8') > 8*1024*1024
      || !Array.isArray(participantIds) || participantIds.length < 1 || participantIds.length > 32
      || participantIds.some(p => typeof p !== 'string' || !p.length) || new Set(participantIds).size !== participantIds.length) {
      throw new Error('Invalid collaboration configuration')
    }
    JSON.parse(configJson)
    return this.db.transaction(() => {
      const existing = this.get(id, ownerId)
      if (existing) {
        const reserved = this.participants(id, ownerId).map(p => p.participant_id).sort()
        if (existing.conversation_id !== conversationId || existing.source_lineage_id !== sourceLineageId
          || existing.anchor_message_id !== anchorMessageId || existing.config_json !== configJson || existing.config_hash !== configHash
          || JSON.stringify(reserved) !== JSON.stringify([...participantIds].sort())) throw new Error('Collaboration configuration conflict')
        return existing
      }
      const lineage = this.db.prepare('SELECT conversation_id FROM lineages WHERE id = ?').get(sourceLineageId)
      const anchor = this.db.prepare('SELECT conversation_id FROM messages WHERE id = ?').get(anchorMessageId)
      if (lineage?.conversation_id !== conversationId || anchor?.conversation_id !== conversationId) throw new Error('Collaboration scope mismatch')
      this.db.prepare(`INSERT INTO hadron_sessions
        (id, owner_id, conversation_id, source_lineage_id, anchor_message_id, config_json, config_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, ownerId, conversationId, sourceLineageId, anchorMessageId, storeJobImages(this.db,'shared',id,ownerId,conversationId,configJson), configHash)
      const insert = this.db.prepare('INSERT INTO hadron_participants (session_id, participant_id) VALUES (?, ?)')
      for (const participantId of participantIds) insert.run(id, participantId)
      return this.require(id, ownerId)
    })()
  }

  claim(id: string, ownerId: string): boolean {
    this.require(id, ownerId)
    return this.db.prepare("UPDATE hadron_sessions SET status = 'running', revision = revision + 1 WHERE id = ? AND owner_id = ? AND status = 'created'").run(id, ownerId).changes > 0
  }

  assertRunning(id: string, ownerId: string): void {
    if (this.require(id, ownerId).status !== 'running') throw new Error('Collaboration session is not running')
  }

  bind(id: string, ownerId: string, participantId: string, binding: { runId: string; handle: string; streamId: string }): void {
    this.db.transaction(() => {
      this.assertRunning(id, ownerId)
      if (![binding.runId, binding.handle, binding.streamId].every(v => typeof v === 'string' && v.length)) throw new Error('Invalid collaboration binding')
      const participant = this.participants(id, ownerId).find(p => p.participant_id === participantId)
      if (!participant) throw new Error('Participant not reserved')
      if (participant.run_id !== null) {
        if (participant.run_id === binding.runId && participant.handle === binding.handle && participant.stream_id === binding.streamId) return
        throw new Error('Conflicting participant binding')
      }
      this.db.prepare("UPDATE hadron_participants SET run_id = ?, handle = ?, stream_id = ?, status = 'running' WHERE session_id = ? AND participant_id = ? AND status = 'reserved'")
        .run(binding.runId, binding.handle, binding.streamId, id, participantId)
    })()
  }

  finishParticipant(id: string, ownerId: string, runId: string, status: string): void {
    if (!['completed', 'aborted', 'error'].includes(status)) throw new Error('Invalid participant terminal status')
    this.db.transaction(() => {
      const participant = this.participants(id, ownerId).find(p => p.run_id === runId)
      if (!participant) throw new Error('Participant run not bound')
      if (participant.status === status) return
      if (participant.status !== 'running') throw new Error('Participant already terminal')
      this.db.prepare('UPDATE hadron_participants SET status = ? WHERE session_id = ? AND run_id = ?').run(status, id, runId)
    })()
  }

  stop(id: string, ownerId: string): boolean {
    this.require(id, ownerId)
    return this.db.prepare("UPDATE hadron_sessions SET status = 'stopping', revision = revision + 1 WHERE id = ? AND owner_id = ? AND status IN ('created','running')").run(id, ownerId).changes > 0
  }

  complete(id: string, ownerId: string, publish: () => unknown): unknown {
    return this.db.transaction(() => {
      this.assertRunning(id, ownerId)
      const result = publish()
      if (result && typeof (result as any).then === 'function') throw new Error('Collaboration publisher must be synchronous')
      const json = JSON.stringify(result)
      if (json === undefined) throw new Error('Collaboration publisher must return JSON')
      this.assertRunning(id, ownerId)
      this.db.prepare("UPDATE hadron_sessions SET status = 'completed', checkpoints_json = ?, revision = revision + 1 WHERE id = ? AND owner_id = ? AND status = 'running'").run(json, id, ownerId)
      return result
    })()
  }

  finish(id: string, ownerId: string, status: 'cancelled' | 'failed', error?: string): void {
    if (!['cancelled', 'failed'].includes(status)) throw new Error('Invalid collaboration terminal status')
    this.db.transaction(() => {
      const row = this.require(id, ownerId)
      if (terminal(row.status)) return
      if (!['running', 'stopping'].includes(row.status) || (status === 'cancelled' && row.status !== 'stopping')) throw new Error('Invalid collaboration terminal transition')
      this.db.prepare('UPDATE hadron_sessions SET status = ?, error = ?, revision = revision + 1 WHERE id = ?').run(status, error ?? null, id)
    })()
  }

  participants(id: string, ownerId: string): CollaborationParticipantRow[] {
    this.require(id, ownerId)
    return this.db.prepare('SELECT participant_id, run_id, handle, stream_id, status FROM hadron_participants WHERE session_id = ? ORDER BY participant_id').all(id)
  }

  workflow(id: string, ownerId: string): { status: CollaborationStatus; phase: 'proposals' | 'reviews' | 'synthesis' | 'finished'; revision: number; error: string | null } | null {
    this.require(id, ownerId)
    return this.db.prepare('SELECT status, phase, revision, error FROM hadron_workflows WHERE session_id = ?').get(id) ?? null
  }

  createWorkflow(id: string, ownerId: string, participants: Array<{ id: string; modelName: string }>, verification = false): void {
    this.db.transaction(() => {
      this.assertRunning(id, ownerId)
      if (this.workflow(id, ownerId)) throw new Error('Workflow already claimed')
      this.db.prepare("INSERT INTO hadron_workflows(session_id, status, phase) VALUES (?, 'running', 'proposals')").run(id)
      const insert = this.db.prepare('INSERT INTO hadron_workflow_runs(session_id, stage_id, participant_id, model_name) VALUES (?, ?, ?, ?)')
      insert.run(id, 'review_a', participants[0].id, participants[0].modelName)
      insert.run(id, 'review_b', participants[1].id, participants[1].modelName)
      insert.run(id, 'final', participants[0].id, participants[0].modelName)
      if (verification) this.db.prepare('INSERT INTO hadron_verification_runs(session_id, participant_id, model_name) VALUES (?, ?, ?)').run(id, participants[0].id, participants[0].modelName)
    })()
  }

  workflowRuns(id: string, ownerId: string): Array<{ stage_id: string; participant_id: string; model_name: string; run_id: string | null; handle: string | null; stream_id: string | null }> {
    this.require(id, ownerId)
    return this.db.prepare('SELECT session_id, stage_id, participant_id, model_name, run_id, handle, stream_id FROM hadron_workflow_runs WHERE session_id = ? UNION ALL SELECT session_id, stage_id, participant_id, model_name, run_id, handle, stream_id FROM hadron_verification_runs WHERE session_id = ? ORDER BY stage_id').all(id, id)
  }

  updateWorkflow(id: string, ownerId: string, status: CollaborationStatus, phase: 'proposals' | 'reviews' | 'synthesis' | 'finished', error?: string): void {
    this.require(id, ownerId)
    const current = this.workflow(id, ownerId)
    if (!current || !['running', 'stopping'].includes(current.status)) throw new Error('Workflow is not active')
    if (current.status === 'stopping' && status !== 'cancelled') throw new Error('Workflow is stopping')
    this.db.prepare('UPDATE hadron_workflows SET status = ?, phase = ?, error = ?, revision = revision + 1 WHERE session_id = ?').run(status, phase, error ?? null, id)
  }

  bindWorkflow(id: string, ownerId: string, stage: string, child: { runId: string; handle: string | null; streamId: string }): void {
    if (this.workflow(id, ownerId)?.status !== 'running' || !child.handle) throw new Error('Workflow admission closed')
    const result = this.db.prepare(`UPDATE ${stage === 'verification' ? 'hadron_verification_runs' : 'hadron_workflow_runs'} SET run_id = ?, handle = ?, stream_id = ? WHERE session_id = ? AND stage_id = ? AND run_id IS NULL`)
      .run(child.runId, child.handle, child.streamId, id, stage)
    if (!result.changes) throw new Error('Workflow stage already claimed')
    this.db.prepare('UPDATE hadron_workflows SET revision = revision + 1 WHERE session_id = ?').run(id)
  }

  verificationEvidence(id: string, ownerId: string): import('../../../../../shared/collaboration.js').VerificationEvidence | undefined {
    this.require(id, ownerId)
    const row = this.db.prepare('SELECT evidence_json FROM hadron_verification_runs WHERE session_id = ?').get(id)
    return row ? JSON.parse(row.evidence_json) : undefined
  }

  recordVerificationAttempt(id: string, ownerId: string): void {
    if (this.workflow(id, ownerId)?.status !== 'running') throw new Error('Verification admission closed')
    const record = this.verificationEvidence(id, ownerId)
    if (!record) throw new Error('Verification not reserved')
    record.attempts = (record.attempts ?? 0) + 1
    if (record.attempts > 32) throw new Error('Verification operation limit')
    this.db.prepare('UPDATE hadron_verification_runs SET evidence_json = ? WHERE session_id = ?').run(JSON.stringify(record), id)
    this.db.prepare('UPDATE hadron_workflows SET revision = revision + 1 WHERE session_id = ?').run(id)
  }

  recordVerificationEvidence(id: string, ownerId: string, tool: string, result: unknown): void {
    if (this.workflow(id, ownerId)?.status !== 'running') throw new Error('Verification admission closed')
    const current = this.verificationEvidence(id, ownerId)
    if (!current) throw new Error('Verification not reserved')
    const text = JSON.stringify(result)
    const receipt = { id: `check-${current.receipts.length + current.omitted + 1}`, tool: tool.slice(0, 80), recordedAt: new Date().toISOString(), result: text.slice(0, 1600), truncated: text.length > 1600 }
    const next = { ...current, receipts: [...current.receipts, receipt] }
    if (JSON.stringify(next).length > 23000) current.omitted++
    else current.receipts.push(receipt)
    this.db.prepare('UPDATE hadron_verification_runs SET evidence_json = ? WHERE session_id = ?').run(JSON.stringify(current), id)
    this.db.prepare('UPDATE hadron_workflows SET revision = revision + 1 WHERE session_id = ?').run(id)
  }

  /** Startup-only: records crash orphans; never adopts or dispatches their runs. */
  reconcileInterrupted(): number {
    return this.db.transaction(() => {
      this.db.prepare("UPDATE hadron_workflows SET status = 'interrupted', revision = revision + 1, error = 'Hadron restarted; review saved work before starting a new session' WHERE status IN ('running','stopping')").run()
      this.db.prepare(`UPDATE hadron_participants SET status = 'interrupted'
        WHERE status IN ('reserved','running') AND session_id IN
          (SELECT id FROM hadron_sessions WHERE status IN ('created','running','stopping'))`).run()
      return Number(this.db.prepare("UPDATE hadron_sessions SET status = 'interrupted', revision = revision + 1 WHERE status IN ('created','running','stopping')").run().changes)
    })()
  }
}
