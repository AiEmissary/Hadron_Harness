export type CompletionAlertMode='off'|'ping'|'voice'
export interface CompletionAlert {id:string;projectId:string;chatId:string;agent:'a'|'b'|'both';outcome:'completed'|'failed'|'stopped'|'needs_input'}
export function completionAlertText(input:CompletionAlert){
 const who=input.agent==='both'?'Agents A and B':`Agent ${input.agent.toUpperCase()}`
 if(input.outcome==='needs_input')return {title:who+' · Needs your answer',body:'The agent paused because it needs something from you before it can continue. Open Hadron to see its question.',speech:'I need your answer.'}
 return input.outcome==='completed'?{title:who+' finished',body:'Your reply is ready in Hadron.',speech:input.agent==='both'?'We are done.':'I am done.'}:
  {title:who+' · Not finished',body:input.outcome==='stopped'?'The task was stopped before completion. Open Hadron to see the saved work.':'The task ended before completion. Open Hadron for the reason and saved work.',speech:'Not finished.'}
}
