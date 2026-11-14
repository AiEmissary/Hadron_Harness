import { composeSharedContext, type SharedAttachment } from './attachments'
import { parseProposalSession, type ProposalSessionInput } from '../../../../../shared/collaboration'

export interface ParticipantOption {
  provider: import('../../../../../shared/hadronProviders').HadronProvider
  label: string
  connected: boolean
  connectionLabel?: string
  models: ReadonlyArray<{ id: string; label: string }>
}
export interface CollaborationDraft {
  importedContext?:string
  task: string
  attachments: SharedAttachment[]
  verification?: boolean
  projectGrantId?: string
  participants: [{ id: 'a'; provider: string; modelName: string }, { id: 'b'; provider: string; modelName: string }]
}
export const initialDraft = (): CollaborationDraft => ({ task: '', attachments: [], participants: [
  { id: 'a', provider: '', modelName: '' }, { id: 'b', provider: '', modelName: '' },
] })

export function chooseProvider(draft: CollaborationDraft, index: 0 | 1, provider: string): CollaborationDraft {
  return { ...draft, participants: draft.participants.map((p, i) => i === index ? { ...p, provider, modelName: '' } : p) as CollaborationDraft['participants'] }
}
export function chooseModel(draft: CollaborationDraft, index: 0 | 1, modelName: string): CollaborationDraft {
  return { ...draft, participants: draft.participants.map((p, i) => i === index ? { ...p, modelName } : p) as CollaborationDraft['participants'] }
}

/** No default provider/model substitution. Copy the selection before admission. */
export function buildProposalInput(draft: CollaborationDraft, options: ReadonlyArray<ParticipantOption>,
  anchor: { sessionId: string; conversationId: string; sourceLineageId: string; anchorMessageId: string; context: string; parentSessionId?: string; includeParentContext?: boolean }): ProposalSessionInput {
  for (const participant of draft.participants) {
    const provider = options.find(option => option.provider === participant.provider)
    if (!provider?.connected || !provider.models.some(model => model.id === participant.modelName)) {
      throw new Error('Choose an available provider and model for both agents')
    }
  }
  return parseProposalSession({ schemaVersion: 1, workflow: draft.verification ? 'review_verify_and_synthesis' : 'review_and_synthesis', ...anchor, ...(draft.attachments.some(file=>file.image)?{images:draft.attachments.flatMap(file=>file.image?[file.image]:[])}:{}), context: composeSharedContext([anchor.context,draft.importedContext??''].filter(Boolean).join('\n'), draft.attachments), task: draft.task.trim() || (draft.attachments.length ? 'Work on the attached files.' : ''),
    participants: draft.participants.map(p => ({ ...p })),...(draft.projectGrantId?{projectGrantId:draft.projectGrantId}:{}) })
}
