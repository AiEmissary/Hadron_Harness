import { expect, it } from 'vitest'
import { createGeneralWorkflowPlan, verifyWorkflowClaims } from '../collaboration/generalWorkflowPolicy.js'
import type { ProposalSessionInput } from '../../../../../../shared/collaboration.js'
const input: ProposalSessionInput = { schemaVersion: 1, sessionId: 's', conversationId: 'c', sourceLineageId: 'l', anchorMessageId: 'a', task: 'Task', context: '',
  participants: [{ id: 'a', provider: 'openaichatgpt', modelName: 'same-model' }, { id: 'b', provider: 'openaichatgpt', modelName: 'same-model' }] }
it('plans one bounded cross-review and one chosen synthesis without granting tools or extra rounds', () => {
  const plan = createGeneralWorkflowPlan(input, 'b')
  expect(plan.phases.map(phase => [phase.id, phase.providerRequests])).toEqual([['proposals', 2], ['cross_review', 2], ['verification', 0], ['synthesis', 1]])
  expect(plan.perParticipantRequests).toEqual({ a: 2, b: 3 })
  expect(plan.phases.every(phase => phase.tools === 'none')).toBe(true)
  expect(plan.phases[3].requires).toEqual(['verification'])
  expect(Object.isFrozen(plan.phases[1].participants)).toBe(true)
  expect(() => createGeneralWorkflowPlan(input, 'foreign')).toThrow()
  expect(() => createGeneralWorkflowPlan({ ...input, maxRounds: 10 } as any, 'a')).toThrow()
})
it('keeps claims unverified without evidence, even when both peers might agree', () => {
  expect(verifyWorkflowClaims(['agreed-by-both'], [])).toEqual([{ claimId: 'agreed-by-both', status: 'unverified', evidenceIds: [] }])
  expect(() => verifyWorkflowClaims(['claim'], [{ id: 'e', claimId: 'claim', origin: 'model_assertion', source: 'Both models agree', verdict: 'supports' } as any])).toThrow('trusted provenance')
})
it('retains contrary evidence rather than allowing a supporting observation to erase it', () => {
  const result = verifyWorkflowClaims(['claim'], [
    { id: 'passed-test', claimId: 'claim', origin: 'server_observed', source: 'test command result', verdict: 'supports' },
    { id: 'counterexample', claimId: 'claim', origin: 'human_attested', source: 'Observed counterexample', verdict: 'contradicts' },
  ])
  expect(result[0]).toEqual({ claimId: 'claim', status: 'contradicted', evidenceIds: ['passed-test', 'counterexample'] })
  expect(() => verifyWorkflowClaims(['claim', 'claim'], [])).toThrow()
})

it('budgets the optional verifier without granting tools to other phases',()=>{
 const plan=createGeneralWorkflowPlan({...input,workflow:'review_verify_and_synthesis'},'a')
 expect(plan.maxProviderRequests).toBe(13);expect(plan.perParticipantRequests).toEqual({a:11,b:2})
 expect(plan.phases.filter(phase=>phase.tools!=='none').map(phase=>phase.id)).toEqual(['verification'])
})
