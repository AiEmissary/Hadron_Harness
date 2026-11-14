import { describe, expect, it } from 'vitest'
import { buildProposalInput, chooseModel, chooseProvider, initialDraft, type ParticipantOption } from './setup'
const options: ParticipantOption[] = [{ provider: 'openaichatgpt', label: 'ChatGPT', connected: true,
  models: [{ id: 'model-a', label: 'Model A' }, { id: 'model-b', label: 'Model B' }] }]
const anchor = { sessionId: 's', conversationId: 'c', sourceLineageId: 'l', anchorMessageId: 'm', context: 'frozen' }
describe('independent participant setup', () => {
  it('keeps A/B selections independent, resets changed provider models and freezes admitted input', () => {
    let draft = { ...initialDraft(), task: 'Shared task' }
    draft = chooseModel(chooseProvider(draft, 0, 'openaichatgpt'), 0, 'model-a')
    expect(draft.participants[1].provider).toBe('')
    draft = chooseModel(chooseProvider(draft, 1, 'openaichatgpt'), 1, 'model-b')
    const input = buildProposalInput(draft, options, anchor)
    expect(input.workflow).toBe('review_and_synthesis')
    draft.participants[0].modelName = 'changed'
    expect(input.participants.map(p => p.modelName)).toEqual(['model-a', 'model-b'])
    expect(chooseProvider(draft, 0, '').participants[0].modelName).toBe('')
    expect(draft.participants[1].modelName).toBe('model-b')
  })
  it('refuses unavailable providers/models and permits two sessions using the same model', () => {
    let draft = { ...initialDraft(), task: 'Task' }
    expect(() => buildProposalInput(draft, options, anchor)).toThrow()
    draft = chooseModel(chooseProvider(draft, 0, 'openaichatgpt'), 0, 'model-a')
    draft = chooseModel(chooseProvider(draft, 1, 'openaichatgpt'), 1, 'model-a')
    expect(buildProposalInput(draft, options, anchor).participants).toHaveLength(2)
    expect(() => buildProposalInput(draft, [{ ...options[0], connected: false }], anchor)).toThrow()
    expect(() => buildProposalInput(chooseModel(draft, 1, 'unknown'), options, anchor)).toThrow()
  })
})

it('admits verification only when explicitly selected',()=>{
 const draft={...initialDraft(),task:'Check evidence',participants:[{id:'a' as const,provider:'openaichatgpt',modelName:'model-a'},{id:'b' as const,provider:'openaichatgpt',modelName:'model-b'}] as ReturnType<typeof initialDraft>['participants']}
 expect(buildProposalInput(draft,options,anchor).workflow).toBe('review_and_synthesis')
 expect(buildProposalInput({...draft,verification:true},options,anchor).workflow).toBe('review_verify_and_synthesis')
})

it('carries only the selected opaque folder grant into the collaboration request',()=>{
 const draft={...initialDraft(),task:'Find the relevant code',projectGrantId:'selected-shared-folder',participants:[{id:'a' as const,provider:'openaichatgpt',modelName:'model-a'},{id:'b' as const,provider:'openaichatgpt',modelName:'model-b'}] as ReturnType<typeof initialDraft>['participants']}
 const input=buildProposalInput(draft,options,anchor)
 expect(input.projectGrantId).toBe('selected-shared-folder')
 expect(input).not.toHaveProperty('root')
 expect(buildProposalInput({...draft,projectGrantId:undefined},options,anchor)).not.toHaveProperty('projectGrantId')
})
