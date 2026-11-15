import { createHash } from 'node:crypto'
import type { MessageRepo } from '../../persistence/messageRepo.js'
import type { LineageRepo } from '../../persistence/lineageRepo.js'
import { ProposalAccessDenied } from './proposalSessionService.js'
import {CONTINUOUS_INPUT_MAX_BYTES} from '../../../../../../shared/continuousChat.js'

/** Explicit task-only root: saves a new branch without copying chat history or
 * making an inference call. Deterministic IDs fence uncertain preparation replies.
 */
export class SharedTaskContexts {
  constructor(private readonly deps: { db: any; messages: MessageRepo; lineages: LineageRepo;
    authorize(owner: string, conversation: string): void }) {}
  prepare(owner: string, raw: any) {
    if (!raw || raw.schemaVersion !== 1 || Object.keys(raw).some(key => !['schemaVersion', 'id', 'conversationId', 'task','workflow'].includes(key)) ||
      raw.workflow!==undefined&&raw.workflow!=='continuous' ||
      ![raw.id, raw.conversationId].every(value => typeof value === 'string' && value.trim() && value.length <= 128) ||
      typeof raw.task !== 'string' || !raw.task.trim() || (raw.workflow==='continuous'?Buffer.byteLength(raw.task)>CONTINUOUS_INPUT_MAX_BYTES:raw.task.length>16000)) throw new Error('Invalid shared task context')
    try { this.deps.authorize(owner, raw.conversationId) } catch { throw new ProposalAccessDenied() }
    const key = createHash('sha256').update(JSON.stringify([owner, raw.id])).digest('hex')
    const anchorMessageId = `hadron-shared-${key}`, sourceLineageId = `hadron-lineage-${key}`
    this.deps.messages.transaction(() => {
      const existing = this.deps.lineages.get(sourceLineageId)
      if (existing) {
        const detail = this.deps.lineages.getDetail(raw.conversationId, sourceLineageId)
        if (!detail || detail.path.length !== 1 || detail.path[0].id !== anchorMessageId || detail.path[0].content !== raw.task) throw new Error('Shared task context conflict')
      } else {
        if (this.deps.db.prepare('SELECT id FROM messages WHERE id=?').get(anchorMessageId)) throw new Error('Shared task anchor conflict')
        this.deps.messages.createMessage({ id: anchorMessageId, conversationId: raw.conversationId, parentId: null, role: 'user',
          content: raw.task, meta: { hadronSharedTask: { id: raw.id, ownerId: owner } } })
        this.deps.lineages.createRoot({ id: sourceLineageId, conversationId: raw.conversationId, rootMessageId: anchorMessageId })
      }
    })
    return { schemaVersion: 1, conversationId: raw.conversationId, sourceLineageId, anchorMessageId, context: '', messageCount: 0 }
  }
}
