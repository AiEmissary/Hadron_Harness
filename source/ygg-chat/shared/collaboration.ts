import {parseHadronImages,type HadronImage} from './hadronImages.js'
import { isHadronProvider, type HadronProvider } from './hadronProviders.js'
/** Legacy proposal admission plus explicit bounded collaboration. No credentials or tool capabilities in input. */
export const HADRON_LIVE_COLLABORATION_ENABLED = true
export const PROPOSAL_CONTEXT_MAX_CHARS = 16_000

export interface ProposalSessionInput {
  schemaVersion: 1
  sessionId: string
  conversationId: string
  sourceLineageId: string
  anchorMessageId: string
  task: string
  images?:HadronImage[]
  context: string
  parentSessionId?: string
  includeParentContext?: boolean
  workflow?: 'review_and_synthesis' | 'review_verify_and_synthesis'
  projectGrantId?: string
  projectMode?:'agent'
  participants: Array<{ id: string; provider: HadronProvider; modelName: string }>
}

/** Public projection. Optional collaboration includes unverified saved stage text, never private handles. */
export interface ProposalSessionStatus {
  schemaVersion: 1
  sessionId: string
  conversationId: string
  phase: 'independent_proposals'
  status: 'created' | 'running' | 'stopping' | 'completed' | 'cancelled' | 'failed' | 'interrupted'
  revision: number
  limits: { deadlineMs: number; maxRequestsPerParticipant: 1 }
  participants: Array<{ id: string; provider: HadronProvider; modelName: string;
    status: string; runId: string | null; streamId: string | null }>
  artifacts: Array<{ kind: 'proposal'; verified: false; participantId: string;
    runId: string; lineageId: string; messageId: string }>
  error: string | null
  parentSessionId?: string
  journalAvailable?: boolean
  collaboration?: {
    phase: 'proposals' | 'reviews' | 'verification' | 'synthesis' | 'finished'
    maxRequests: 5 | 13
    evidence?: VerificationEvidence
    toolActivity?: Array<{ time: string; tool: string; state: string }>
    folderAccess?: boolean
    researchLimited?: boolean
    folderActivity?: Array<{ time: string; tool: string; state: string }>
    stages: Array<{ id: string; participantId: string; modelName: string; status: string; text: string; verified: false }>
  }
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object')
  return value as Record<string, unknown>
}
const exactKeys = (value: Record<string, unknown>, keys: string[]) => {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('Unknown collaboration input field')
}
const text = (value: unknown, name: string, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${name}`)
  return value
}

/** Strict runtime validation: unsupported providers/unknown authority-bearing fields reject. */
export function parseProposalSession(value: unknown): ProposalSessionInput {
  const input = object(value)
  exactKeys(input, ['schemaVersion', 'sessionId', 'conversationId', 'sourceLineageId', 'anchorMessageId', 'task', 'context', 'images', 'participants', 'workflow', 'parentSessionId', 'includeParentContext', 'projectGrantId', 'projectMode'])
  if(input.projectMode!==undefined&&(input.projectMode!=='agent'||!input.projectGrantId))throw Error('Invalid Agent permission reference')
  if(input.projectGrantId!==undefined){text(input.projectGrantId,'folder selection',128);if(!input.workflow)throw Error('Folder access requires the collaboration workflow')}
  if (input.workflow !== undefined && !['review_and_synthesis', 'review_verify_and_synthesis'].includes(input.workflow as string)) throw new Error('Unsupported workflow')
  if (input.schemaVersion !== 1 || !Array.isArray(input.participants) || input.participants.length !== 2) {
    throw new Error('Expected version 1 with two participants')
  }
  if (input.parentSessionId !== undefined) text(input.parentSessionId, 'parent session', 128)
  if (input.includeParentContext !== undefined && (typeof input.includeParentContext !== 'boolean' || !input.parentSessionId)) throw new Error('Invalid shared context choice')
  if (input.parentSessionId && input.parentSessionId === input.sessionId) throw new Error('Shared session cannot continue itself')
  const participants = input.participants.map(value => {
    const participant = object(value)
    exactKeys(participant, ['id', 'provider', 'modelName'])
    const id = text(participant.id, 'participant ID', 64)
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || !isHadronProvider(participant.provider)) {
      throw new Error('Unsupported participant or provider')
    }
    return { id, provider: participant.provider, modelName: text(participant.modelName, 'model', 256) }
  })
  if (participants[0].id === participants[1].id) throw new Error('Duplicate participant')
  const task = text(input.task, 'task', 16_000)
  if (typeof input.context !== 'string' || input.context.length > PROPOSAL_CONTEXT_MAX_CHARS) throw new Error('Invalid context')
  return { schemaVersion: 1, sessionId: text(input.sessionId, 'session ID', 128),
    conversationId: text(input.conversationId, 'conversation', 128),
    sourceLineageId: text(input.sourceLineageId, 'lineage', 128), anchorMessageId: text(input.anchorMessageId, 'anchor', 128),
    task, context: input.context, ...(input.images!==undefined?{images:parseHadronImages(input.images)}:{}), participants, ...(input.projectGrantId?{projectGrantId:input.projectGrantId as string}:{}), ...(input.projectMode==='agent'?{projectMode:'agent' as const}:{}), ...(input.parentSessionId ? { parentSessionId: input.parentSessionId as string, includeParentContext: input.includeParentContext !== false } : {}), ...(input.workflow ? { workflow: input.workflow as ProposalSessionInput['workflow'] } : {}) }
}


export interface ProposalSessionPage {
  schemaVersion: 1
  sessions: Array<Pick<ProposalSessionStatus, 'sessionId' | 'conversationId' | 'phase' | 'status' | 'revision'> & {
    participants: Array<{ id: string; provider: HadronProvider; modelName: string }>
  }>
  nextBefore: string | null
}

export interface ProposalTranscript {
  schemaVersion: 1; sessionId: string; participantId: string; runId: string
  status: 'completed' | 'aborted' | 'error'; text: string; verified: false
}

export interface VerificationEvidence {
  attempts?: number
  receipts: Array<{ id: string; tool: string; recordedAt: string; result: string; truncated: boolean }>
  omitted: number
}
