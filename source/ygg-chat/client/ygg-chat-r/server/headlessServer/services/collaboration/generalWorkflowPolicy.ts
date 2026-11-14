import { parseProposalSession, type ProposalSessionInput } from '../../../../../../shared/collaboration.js'

export interface GeneralWorkflowPlan {
  schemaVersion: 1; sessionId: string; workflow: 'general'; synthesisParticipantId: string
  maxProviderRequests: 5 | 13
  phases: ReadonlyArray<Readonly<{ id: 'proposals' | 'cross_review' | 'verification' | 'synthesis';
    participants: readonly string[]; requires: readonly string[]; providerRequests: number; tools: 'none' | 'web'; round: 0 | 1 }>>
  perParticipantRequests: Readonly<Record<string, number>>
}

/** Deterministic server plan. Not an inference runner or an approval to spend this budget. */
export function createGeneralWorkflowPlan(raw: ProposalSessionInput, synthesisParticipantId: string): Readonly<GeneralWorkflowPlan> {
  const input = parseProposalSession(raw)
  if (!input.participants.some(p => p.id === synthesisParticipantId)) throw new Error('Choose a configured synthesis participant')
  const verification = input.workflow === 'review_verify_and_synthesis'
  const participants = Object.freeze(input.participants.map(p => p.id))
  const phases: GeneralWorkflowPlan['phases'] = Object.freeze([
    Object.freeze({ id: 'proposals' as const, participants, requires: Object.freeze([]), providerRequests: 2, tools: 'none' as const, round: 0 as const }),
    Object.freeze({ id: 'cross_review' as const, participants, requires: Object.freeze(['proposals']), providerRequests: 2, tools: 'none' as const, round: 1 as const }),
    Object.freeze({ id: 'verification' as const, participants: Object.freeze(verification ? [input.participants[0].id] : []), requires: Object.freeze(['cross_review']), providerRequests: verification ? 8 : 0, tools: verification ? 'web' as const : 'none' as const, round: 1 as const }),
    Object.freeze({ id: 'synthesis' as const, participants: Object.freeze([synthesisParticipantId]), requires: Object.freeze(['verification']), providerRequests: 1, tools: 'none' as const, round: 1 as const }),
  ])
  return Object.freeze({ schemaVersion: 1, sessionId: input.sessionId, workflow: 'general', synthesisParticipantId,
    maxProviderRequests: verification ? 13 : 5, phases, perParticipantRequests: Object.freeze(Object.fromEntries(participants.map(id => [id, 2 + (id === synthesisParticipantId ? 1 : 0) + (verification && id === input.participants[0].id ? 8 : 0)]))) })
}

export interface WorkflowEvidence {
  id: string; claimId: string; origin: 'server_observed' | 'human_attested'
  source: string; verdict: 'supports' | 'contradicts' | 'inconclusive'
}
export interface ClaimVerification { claimId: string; status: 'supported' | 'contradicted' | 'unverified'; evidenceIds: string[] }

/** Only explicit evidence counts. Peer agreement and model confidence never become verification. */
export function verifyWorkflowClaims(claimIds: readonly string[], records: readonly WorkflowEvidence[]): ClaimVerification[] {
  if (claimIds.length > 100 || new Set(claimIds).size !== claimIds.length || claimIds.some(id => !id || id.length > 128) || records.length > 200 || new Set(records.map(record => record.id)).size !== records.length) throw new Error('Invalid bounded claim/evidence set')
  for (const record of records) {
    if (!record.id || record.id.length > 128 || !claimIds.includes(record.claimId) ||
      !['server_observed', 'human_attested'].includes(record.origin) || !['supports', 'contradicts', 'inconclusive'].includes(record.verdict) ||
      !record.source.trim() || record.source.length > 4000) throw new Error('Evidence requires explicit trusted provenance')
  }
  return claimIds.map(claimId => {
    const evidence = records.filter(record => record.claimId === claimId)
    return { claimId, status: evidence.some(record => record.verdict === 'contradicts') ? 'contradicted' :
      evidence.some(record => record.verdict === 'supports') ? 'supported' : 'unverified', evidenceIds: evidence.map(record => record.id) }
  })
}
