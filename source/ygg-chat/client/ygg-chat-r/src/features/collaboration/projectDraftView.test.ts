import {expect,it} from 'vitest'
import {projectDraftIsRunning,projectDraftRequirements,projectDraftFailureMessage} from './projectDraftView'
const view=(state:string,workersEnded:boolean,reason='project_active')=>({state,workersEnded,execution:{reason}} as any)
it('lets a saved closed proposal start fresh even though inspection restores no worker capability',()=>{
 expect(projectDraftIsRunning(view('discarded',false,'clean'))).toBe(false)
 expect(projectDraftIsRunning(view('ready_to_apply',false,'intervention_required'))).toBe(false)
 expect(projectDraftIsRunning(view('interrupted',false,'intervention_required'))).toBe(false)
})
it('keeps live cancellation pending until actual workers have ended',()=>{
 expect(projectDraftIsRunning(view('running',false))).toBe(true)
 expect(projectDraftIsRunning(view('cancelled',false))).toBe(true)
 expect(projectDraftIsRunning(view('cancelled',true))).toBe(false)
 expect(projectDraftIsRunning(null)).toBe(false)
})
const ready=()=>({enabled:true,availability:{ready:true,reason:'clean'},hasGrant:true,task:'Improve documentation',plan:'Review the exact diff',deliverables:'Reviewed documentation',providers:{a:'openaichatgpt',b:'openaichatgpt'},models:{a:'model',b:'model'},options:[{provider:'openaichatgpt' as const,label:'ChatGPT',connected:true,models:[{id:'model',label:'Model'}]}]})
it('explains the missing inputs in the reported desktop screenshot',()=>{
 const input=ready();input.providers.b='';input.models.b='';input.task='';input.deliverables=''
 expect(projectDraftRequirements(input)).toEqual([
  'Choose a provider for Agent B.',
  'Enter a project goal.',
  'Enter at least one deliverable: the result you want from the agents.',
 ])
 input.providers.b='openaichatgpt'
 expect(projectDraftRequirements(input)).toContain('Choose an available model for Agent B.')
})
it('accepts completed setup with the same connected model for both roles',()=>{
 expect(projectDraftRequirements(ready())).toEqual([])
})
it('never describes a held execution or failed storage as still checking',()=>{
 const input=ready();input.availability={ready:false,reason:'intervention_required'}
 expect(projectDraftRequirements(input)).toEqual(['Earlier execution needs recovery before a new project proposal. Saved work remains readable.'])
 input.availability.reason='project_storage_unavailable'
 expect(projectDraftRequirements(input)[0]).toContain('storage needs attention')
})
it('requires available models and rejects whitespace-only fields',()=>{
 const input=ready();input.models.a='removed-model';input.plan='  ';input.deliverables='\n  \n'
 expect(projectDraftRequirements(input)).toEqual([
  'Choose an available model for Agent A.',
  'Enter a plan; you can use the suggested plan.',
  'Enter at least one deliverable: the result you want from the agents.',
 ])
})
it('explains rejected file locations without exposing raw storage errors or retrying',()=>{
 expect(projectDraftFailureMessage('proposal_parent_unavailable')).toContain('cannot create folders')
 expect(projectDraftFailureMessage('proposal_source_unavailable')).toContain('matching selected source evidence')
 expect(projectDraftFailureMessage('stage_failed')).toContain('will not retry automatically')
})

it('keeps polling a failed proposal until its current-host workers actually finish',()=>{
 expect(projectDraftIsRunning(view('failed',false))).toBe(true)
 expect(projectDraftIsRunning(view('failed',true))).toBe(false)
 expect(projectDraftIsRunning(view('failed',false,'intervention_required'))).toBe(false)
})

it('names the actual single working agent when it proposes no changes',()=>{
 const message=projectDraftFailureMessage('proposal_empty','Agent B')
 expect(message).toContain('Agent B proposed no file changes')
 expect(message).not.toContain('Agent A')
 expect(message).toContain('Nothing was changed')
})
