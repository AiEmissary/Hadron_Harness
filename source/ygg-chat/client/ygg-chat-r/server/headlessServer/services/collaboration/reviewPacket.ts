import { readProposalConfig } from './sharedContinuation.js'
import { type ProposalSessionInput } from '../../../../../../shared/collaboration.js'
import type { CollaborationRepo } from '../../persistence/collaborationRepo.js'
import type { SubagentRunRepo } from '../../persistence/subagentRunRepo.js'
import type { LineageRepo } from '../../persistence/lineageRepo.js'
import { proposalHash, type ProposalCheckpoint } from './proposalCheckpoints.js'

export interface CommittedReviewPacket {
  schemaVersion: 1; kind: 'cross_review_packet'; sessionId: string; recipientId: string; round: 1
  task: string; context: string; contextHash: string
  proposals: ReadonlyArray<Readonly<{ authorId: string; runId: string; attempt: number; lineageId: string; messageId: string;
    contentHash: string; text: string; truncated: boolean; verified: false }>>
}

/** Data preparation only: completed checkpoint barrier, canonical provenance, no provider/tool execution. */
export function buildCommittedReviewPacket(deps: {
  sessions: CollaborationRepo; runs: SubagentRunRepo; lineages: LineageRepo
  authorize(ownerId: string, input: ProposalSessionInput): void
}, ownerId: string, sessionId: string, recipientId: string): Readonly<CommittedReviewPacket> {
  const row = deps.sessions.get(sessionId, ownerId)
  if (!row) throw new Error('Session unavailable')
  const config = JSON.parse(row.config_json)
  const input = readProposalConfig(config)
  deps.authorize(ownerId, input)
  if (row.status !== 'completed' || !input.participants.some(participant => participant.id === recipientId)) throw new Error('Committed proposal barrier required')
  const checkpoints = JSON.parse(row.checkpoints_json ?? '[]') as ProposalCheckpoint[]
  const bindings = deps.sessions.participants(sessionId, ownerId)
  if (checkpoints.length !== 2 || new Set(checkpoints.map(item => item.participantId)).size !== 2) throw new Error('Missing committed proposals')
  const contextHash = proposalHash(JSON.stringify({ schemaVersion: 1, task: input.task, context: input.context }))
  const proposals = input.participants.map(participant => {
    const checkpoint = checkpoints.find(item => item.participantId === participant.id)
    const binding = bindings.find(item => item.participant_id === participant.id)
    if (!checkpoint || checkpoint.runId !== binding?.run_id) throw new Error('Proposal binding mismatch')
    const run = deps.runs.getRunById(checkpoint.runId)
    if (!run || run.status !== 'completed' || run.conversation_id !== input.conversationId || run.parent_message_id !== input.anchorMessageId ||
      run.provider !== participant.provider || run.model_name !== participant.modelName || !run.final_response?.trim() || proposalHash(run.prompt) !== contextHash) throw new Error('Proposal provenance mismatch')
    const receipt = deps.lineages.getForkOperation(`hadron-proposal:${proposalHash(JSON.stringify([sessionId, participant.id]))}`)
    const metadata = JSON.parse(receipt?.metadata_json ?? 'null')
    const contentHash = proposalHash(run.final_response)
    if (!receipt || receipt.status !== 'materialized' || receipt.conversation_id !== input.conversationId ||
      receipt.source_lineage_id !== input.sourceLineageId || receipt.source_message_id !== input.anchorMessageId ||
      receipt.target_lineage_id !== checkpoint.lineageId || receipt.materialized_message_id !== checkpoint.messageId ||
      metadata?.resultHash !== contentHash || metadata?.contextHash !== contextHash || metadata?.attempt !== run.attempt) throw new Error('Committed proposal receipt mismatch')
    const detail = deps.lineages.getDetail(input.conversationId, checkpoint.lineageId)
    if (!detail?.pathMessageIds.includes(checkpoint.messageId)) throw new Error('Missing proposal checkpoint')
    return Object.freeze({ authorId: participant.id, runId: run.id, attempt: run.attempt, lineageId: checkpoint.lineageId,
      messageId: checkpoint.messageId, contentHash, text: run.final_response.slice(0, 6000), truncated: run.final_response.length > 6000, verified: false as const })
  })
  const packet = { schemaVersion: 1 as const, kind: 'cross_review_packet' as const, sessionId, recipientId, round: 1 as const,
    task: input.task, context: input.context, contextHash, proposals: Object.freeze(proposals) }
  if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > 65536) throw new Error('Review packet exceeds bounded context; explicit shorter context required')
  return Object.freeze(packet)
}
