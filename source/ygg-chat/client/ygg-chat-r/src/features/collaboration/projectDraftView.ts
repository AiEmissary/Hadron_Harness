import type {ProjectDraftView} from '../../../../../shared/projectBuild'
import type {ParticipantOption} from './setup'
export function projectDraftFailureMessage(failure:string,actor='Agent A'):string{
 const messages:Record<string,string>={
  proposal_parent_unavailable:`${actor} proposed a file outside the allowed existing folders. This preview cannot create folders. Choose New project task and request a file in the project root or beside a selected source file.`,
  proposal_source_unavailable:`${actor} proposed changing an existing file without matching selected source evidence. Choose New project task and select the file that should change.`,
  proposal_empty:`${actor} proposed no file changes. Nothing was changed. Read the explanation, then continue the conversation or use Try again with a more specific instruction.`,
  cancelled_or_deadline:'The proposal was stopped or reached its time limit. It will not restart automatically.',
 }
 return messages[failure]??'The proposal could not complete. Saved stage responses and job logs remain available. Use Try again to keep the goal, or New project task for a fresh attempt; this proposal will not retry automatically.'
}

/** Explain the same admission conditions used by the proposal button. */
export function projectDraftRequirements(input:{
 enabled:boolean;availability:{ready:boolean;reason:string};hasGrant:boolean;
 task:string;plan:string;deliverables:string;providers:{a:string;b:string};models:{a:string;b:string};
 options:ReadonlyArray<ParticipantOption>
}):string[]{
 const missing:string[]=[]
 if(!input.enabled)missing.push('Connect your ChatGPT subscription in Subscriptions above.')
 if(!input.availability.ready){
  const reasons:Record<string,string>={
   not_ready:'Checking project preparation availability.',
   unconfigured:'Project preparation is unavailable in this session.',
   project_storage_unavailable:'Project proposal storage needs attention. Your existing chats remain available.',
   intervention_required:'Earlier execution needs recovery before a new project proposal. Saved work remains readable.',
   project_active:'Another project proposal is active. Finish or stop it before starting another.',
  }
  missing.push(reasons[input.availability.reason]??'Project preparation is unavailable. Check preparation status for an update.')
 }
 if(!input.hasGrant)missing.push('Choose a project folder.')
 for(const role of ['a','b'] as const){
  const label=`Agent ${role.toUpperCase()}`,provider=input.options.find(option=>option.provider===input.providers[role])
  if(!provider)missing.push(`Choose a provider for ${label}.`)
  else if(!provider.connected)missing.push(`Connect ${label}'s provider in Subscriptions above.`)
  else if(!provider.models.some(model=>model.id===input.models[role]))missing.push(`Choose an available model for ${label}.`)
 }
 if(!input.task.trim())missing.push('Enter a project goal.')
 if(!input.plan.trim())missing.push('Enter a plan; you can use the suggested plan.')
 if(!input.deliverables.trim())missing.push('Enter at least one deliverable: the result you want from the agents.')
 return missing
}
/** Historical inspection does not reconstruct worker ownership. A missing live
 * capability must not turn a saved/closed preview into a running job. */
export function projectDraftIsRunning(view:ProjectDraftView|null):boolean{
 return !!view&&!view.workersEnded&&['prepared','running','failed','changes_required','ready_to_apply','cancelled','applying','checking','automating'].includes(view.state)&&view.execution.reason==='project_active'
}
