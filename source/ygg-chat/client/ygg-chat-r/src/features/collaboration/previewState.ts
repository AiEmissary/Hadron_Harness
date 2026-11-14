import type { ProposalSessionStatus } from '../../../../../shared/collaboration'
import type { CollaborationDraft } from './setup'

export interface PreviewState {
  status: ProposalSessionStatus | null
  text: Record<'a' | 'b', string>
  seq: Record<'a' | 'b', number>
}
export type PreviewEvent =
  | { type: 'start'; sessionId: string; draft: CollaborationDraft }
  | { type: 'delta'; sessionId: string; participant: 'a' | 'b'; seq: number; text: string }
  | { type: 'complete' | 'stop'; sessionId: string }
export const emptyPreview = (): PreviewState => ({ status: null, text: { a: '', b: '' }, seq: { a: 0, b: 0 } })

/** Fixture-only projector: duplicate/reordered frames and late post-Stop frames are ignored. */
export function previewReducer(state: PreviewState, event: PreviewEvent): PreviewState {
  if (event.type === 'start') return { ...emptyPreview(), status: {
    schemaVersion: 1, sessionId: event.sessionId, conversationId: 'preview-only', phase: 'independent_proposals',
    status: 'running', revision: 1, limits: { deadlineMs: 120000, maxRequestsPerParticipant: 1 }, error: null, artifacts: [],
    participants: event.draft.participants.map(p => ({ ...p, provider: 'openaichatgpt', status: 'running', runId: null, streamId: null })),
  } }
  if (!state.status || state.status.sessionId !== event.sessionId || state.status.status !== 'running') return state
  if (event.type === 'delta') {
    if (event.seq <= state.seq[event.participant]) return state
    return { ...state, text: { ...state.text, [event.participant]: state.text[event.participant] + event.text },
      seq: { ...state.seq, [event.participant]: event.seq } }
  }
  const status = event.type === 'stop' ? 'cancelled' : 'completed'
  return { ...state, status: { ...state.status, status, revision: state.status.revision + 1,
    participants: state.status.participants.map(p => ({ ...p, status: event.type === 'stop' ? 'aborted' : 'completed' })) } }
}
