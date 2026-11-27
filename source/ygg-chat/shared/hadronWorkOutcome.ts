/**
 * Plain-language outcomes for a run that ended without finishing everything it was asked to do.
 * Each message answers three questions: how much is done, why it stopped, and whether the user must act.
 */
export const HADRON_AGENT_INCOMPLETE = 'Partly done — the agent stopped before finishing everything it was asked to do. It did not say it needs anything from you. What it did is saved; send "continue" to resume the rest.'
export const HADRON_COMPLETION_UNCONFIRMED = 'Unclear whether finished — the agent ended without saying whether all of the request was done. What it did is saved. Check its reply; if anything remains, send "continue".'
export const HADRON_AGENT_STALLED = 'Partly done — the agent kept repeating partial reports without making progress, so Hadron stopped it. Nothing is needed from you; what it did is saved. A narrower follow-up request usually works better than "continue".'
export const HADRON_READ_ONLY_UNFINISHED = 'Partly done — this job could only read files, so it could not make edits or run commands, and the agent reported that the rest of the request needs that. Its findings are saved. Nothing is needed from you unless you want the remaining work done: switch the job to Agent (coding) mode and send it again.'
export const HADRON_NEEDS_USER_PREFIX = 'Waiting for you — the agent paused because it needs something from you before it can continue.'
export const HADRON_REQUEST_FAILED_PREFIX = 'Not finished — the model request failed before the agent could give its final answer.'
export const HADRON_UNUSABLE_REPLY = 'Not finished — the agent twice replied in a format Hadron could not use, so Hadron stopped it. This is not something you need to fix. What it did is saved; send "continue" to retry.'
export const HADRON_TIME_LIMIT = 'Not finished — the task time limit was reached before a final answer. Saved work is available.'
export const HADRON_REQUEST_LIMIT = 'Not finished — the tool request limit was reached before a final answer. Saved work is available.'
export const HADRON_CONTEXT_LIMIT = 'Not finished — the available context could not hold the task and its evidence. Saved work is available.'

/** Messages written by older Hadron versions; still recognised so saved records keep their meaning. */
export const HADRON_LEGACY_AGENT_INCOMPLETE = 'Not finished — the agent reported that its assigned work is incomplete. Saved work is available.'
const LEGACY_OUTCOMES = [
 HADRON_LEGACY_AGENT_INCOMPLETE,
 'Not finished — the agent did not confirm that its assigned work was complete. Saved work is available.',
 'Not finished — the agent repeated partial reports without advancing the assigned work. Saved work is available.',
]

export type HadronIncompleteReason='context_limit'|'request_limit'|'time_limit'|'agent_incomplete'|'completion_unconfirmed'|'agent_stalled'
/** Why an `agent_incomplete` run stopped, recorded by the trusted host loop. */
export type HadronIncompleteKind='needs_user'|'read_only'|'request_failed'|'unusable_reply'
export interface HadronRunOutcome {incompleteReason?:HadronIncompleteReason;kind?:HadronIncompleteKind;detail?:string}

const clip=(text:string)=>{const clean=text.replace(/\s+/g,' ').trim();return clean.length>600?clean.slice(0,597)+'…':clean}

export function hadronIncompleteMessage(outcome:HadronRunOutcome):string{
 switch(outcome.incompleteReason){
  case 'context_limit':return HADRON_CONTEXT_LIMIT
  case 'request_limit':return HADRON_REQUEST_LIMIT
  case 'time_limit':return HADRON_TIME_LIMIT
  case 'completion_unconfirmed':return HADRON_COMPLETION_UNCONFIRMED
  case 'agent_stalled':return HADRON_AGENT_STALLED
 }
 const detail=outcome.detail?clip(outcome.detail):''
 switch(outcome.kind){
  case 'needs_user':return HADRON_NEEDS_USER_PREFIX+(detail?' It needs: '+detail:'')+' What it did so far is saved; reply in this chat to continue.'
  case 'read_only':return HADRON_READ_ONLY_UNFINISHED
  case 'request_failed':return HADRON_REQUEST_FAILED_PREFIX+(detail?' Reason: '+detail:'')+' What it did so far is saved; send "continue" to resume.'
  case 'unusable_reply':return HADRON_UNUSABLE_REPLY
 }
 return HADRON_AGENT_INCOMPLETE
}

/** Recognise a host-written unfinished-work outcome (current or legacy), never ordinary provider errors. */
export function hadronAgentOutcomeFailure(error:string):string|undefined {
 if(!error)return undefined
 if([HADRON_AGENT_INCOMPLETE,HADRON_COMPLETION_UNCONFIRMED,HADRON_AGENT_STALLED,HADRON_READ_ONLY_UNFINISHED,HADRON_UNUSABLE_REPLY,...LEGACY_OUTCOMES].includes(error))return error
 if(error.startsWith(HADRON_NEEDS_USER_PREFIX)||error.startsWith(HADRON_REQUEST_FAILED_PREFIX))return error
 return undefined
}
/** True when the saved outcome means the user must answer before work can continue. */
export function hadronOutcomeNeedsUser(error:string|null|undefined):boolean{return !!error&&error.startsWith(HADRON_NEEDS_USER_PREFIX)}

/** Recognise only Hadron's historical host-generated partial records, not ordinary model wording. */
export function isHadronIncompleteRecord(text:string):boolean{
 return text.startsWith('Work stopped at the request or context limit before a final answer was produced.')||
  text.startsWith('### Partial research — limit reached')||text.startsWith('Not finished — Hadron stopped before a final answer was produced.')
}
