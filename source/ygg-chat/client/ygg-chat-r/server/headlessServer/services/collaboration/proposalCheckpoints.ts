import { createHash } from 'node:crypto'
import type { LineageRepo } from '../../persistence/lineageRepo.js'
import type { MessageRepo } from '../../persistence/messageRepo.js'
import type { SubagentRunRepo } from '../../persistence/subagentRunRepo.js'

/** Internal P0 contract; not a public API or a durable collaboration session. */
export interface ProposalSnapshot {
  sessionId: string
  conversationId: string
  sourceLineageId: string
  anchorMessageId: string
  contextHash: string
}

export interface ProposalReference {
  participantId: string
  runId: string
  attempt: number
}

export interface ProposalCheckpoint {
  participantId: string
  runId: string
  lineageId: string
  messageId: string
}

export const proposalHash = (text: string): string => createHash('sha256').update(text).digest('hex')
const MAX_CHECKPOINT_CHARS = 8_000
export const validParticipantId = (id: string): boolean => /^[a-zA-Z0-9_-]{1,64}$/.test(id)

/**
 * Publish an all-or-nothing pair using existing fork operations as durable receipts.
 * No provider/tool execution, schema changes, or transcript re-parenting happens here.
 */
export function publishProposalCheckpoints(deps: {
  messages: MessageRepo
  lineages: LineageRepo
  runs: SubagentRunRepo
}, snapshot: ProposalSnapshot, proposals: readonly ProposalReference[]): ProposalCheckpoint[] {
  if (proposals.length !== 2 || new Set(proposals.map(p => p.participantId)).size !== 2 ||
    new Set(proposals.map(p => p.runId)).size !== 2 || proposals.some(p => !validParticipantId(p.participantId)) ||
    !snapshot.sessionId.trim() || snapshot.sessionId.length > 128) {
    throw new Error('Expected two distinct proposal participants and runs')
  }
  return deps.messages.transaction(() => {
    const source = deps.lineages.getDetail(snapshot.conversationId, snapshot.sourceLineageId)
    if (!source || source.status !== 'active' || !source.pathMessageIds.includes(snapshot.anchorMessageId)) {
      throw new Error('Proposal anchor is not on the active source lineage')
    }
    const prepared = proposals.map(proposal => {
      const run = deps.runs.getRunById(proposal.runId)
      if (!run || run.conversation_id !== snapshot.conversationId ||
        run.parent_message_id !== snapshot.anchorMessageId || run.status !== 'completed' ||
        run.attempt !== proposal.attempt || !run.final_response?.trim()) {
        throw new Error('Proposal run is not a completed attempt at this anchor')
      }
      if (proposalHash(run.prompt) !== snapshot.contextHash) throw new Error('Proposal context mismatch')
      const metadata = {
        kind: 'hadron_proposal_checkpoint', schemaVersion: 1,
        ...snapshot, ...proposal, provider: run.provider, modelName: run.model_name,
        resultHash: proposalHash(run.final_response),
      }
      const operationId = `hadron-proposal:${proposalHash(JSON.stringify([snapshot.sessionId, proposal.participantId]))}`
      const receipt = deps.lineages.getForkOperation(operationId)
      if (receipt && (receipt.conversation_id !== snapshot.conversationId ||
        receipt.source_lineage_id !== snapshot.sourceLineageId ||
        receipt.source_message_id !== snapshot.anchorMessageId ||
        receipt.status !== 'materialized' || receipt.metadata_json !== JSON.stringify(metadata))) {
        throw new Error('Checkpoint publication conflicts with an existing receipt')
      }
      if (receipt) {
        const detail = deps.lineages.getDetail(snapshot.conversationId, receipt.target_lineage_id)
        if (!detail || !detail.pathMessageIds.includes(receipt.materialized_message_id!)) {
          throw new Error('Checkpoint receipt points to missing content')
        }
      }
      return { proposal, run, metadata, operationId, receipt }
    })
    return prepared.map(({ proposal, run, metadata, operationId, receipt }) => {
      if (receipt) return { participantId: proposal.participantId, runId: run.id,
        lineageId: receipt.target_lineage_id, messageId: receipt.materialized_message_id! }
      const pending = deps.lineages.createPendingFork({ operationId,
        conversationId: snapshot.conversationId, sourceLineageId: snapshot.sourceLineageId,
        sourceMessageId: snapshot.anchorMessageId, operation: 'hadron-proposal', metadata })
      const text = run.final_response!.slice(0, MAX_CHECKPOINT_CHARS)
      const truncated = run.final_response!.length > MAX_CHECKPOINT_CHARS
      const message = deps.messages.createMessage({ conversationId: snapshot.conversationId,
        parentId: snapshot.anchorMessageId, role: 'assistant', modelName: run.model_name,
        content: `Hadron proposal — ${proposal.participantId}\n\n${text}${truncated ? '\n\n[Checkpoint excerpt; full result in source transcript.]' : ''}`,
        meta: { ...metadata, truncated, source: 'subagent_transcript', verified: false },
      })
      deps.lineages.materialize(pending.operation.id, message.id)
      return { participantId: proposal.participantId, runId: run.id,
        lineageId: pending.lineage.id, messageId: message.id }
    })
  })
}

/** Bind vision inputs to the committed proposal without putting image bytes in text. */
export function proposalTaskPacket(input:{task:string;context:string;images?:import('../../../../../../shared/hadronImages.js').HadronImage[]}):string{
 return JSON.stringify({schemaVersion:1,task:input.task,context:input.context,...(input.images?.length?{imageReferences:input.images.map(image=>({id:image.id,name:image.name,sha256:proposalHash(image.dataUrl)}))}:{})})
}
