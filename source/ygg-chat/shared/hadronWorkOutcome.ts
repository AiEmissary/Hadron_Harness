export const HADRON_AGENT_INCOMPLETE = 'Not finished — the agent reported that its assigned work is incomplete. Saved work is available.'
export const HADRON_COMPLETION_UNCONFIRMED = 'Not finished — the agent did not confirm that its assigned work was complete. Saved work is available.'
export function hadronAgentOutcomeFailure(error:string):string|undefined {
 return [HADRON_AGENT_INCOMPLETE,HADRON_COMPLETION_UNCONFIRMED].find(message=>error===message)
}
/** Recognise only Hadron's historical host-generated partial records, not ordinary model wording. */
export function isHadronIncompleteRecord(text:string):boolean{
 return text.startsWith('Work stopped at the request or context limit before a final answer was produced.')||
  text.startsWith('### Partial research — limit reached')||text.startsWith('Not finished — Hadron stopped before a final answer was produced.')
}
