import type {WorkspaceSession} from './workspaceSession'
import {completionAlertText,type CompletionAlert,type CompletionAlertMode} from '../../../../../shared/hadronCompletion'
import {isHadronIncompleteRecord} from '../../../../../shared/hadronWorkOutcome'
const key='hadron:completion-alerts'
export function completionAlertMode():CompletionAlertMode{
 try{const value=localStorage.getItem(key);return value==='off'||value==='voice'?value:'ping'}catch{return'ping'}
}
export function saveCompletionAlertMode(value:CompletionAlertMode){localStorage.setItem(key,value)}
export async function notifyWorkspaceCompletion(input:CompletionAlert){
 const mode=completionAlertMode();if(mode==='off')return
 const voice=mode==='voice'&&typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined'
 try{
  const accepted=await window.electronAPI.completionAlerts.notify(input,mode)
  if(accepted&&voice){
   const utterance=new SpeechSynthesisUtterance(completionAlertText(input).speech)
   utterance.onerror=()=>{} // Voice mode stays silent if speech fails; never add a ping.
   speechSynthesis.speak(utterance)
  }
 }catch{/* Alerts must never alter the completed task or interrupt typing. */}
}
/** Watch the durable session, including jobs in other chats/projects. Loaded
 * historical results and individual shared stages must not announce completion. */
export function watchWorkspaceCompletions(session:WorkspaceSession,notify:(input:CompletionAlert)=>unknown=notifyWorkspaceCompletion){
 const armed=new Map<string,string>(),announced=new Set<string>()
 return session.subscribe(()=>{
  for(const chat of Object.values(session.getSnapshot().state.chats)){
   if((chat.jobState==='running'||chat.jobState==='stopping')&&chat.jobId&&session.startedHere(chat.id,chat.jobId))armed.set(chat.id,chat.jobId)
   if(chat.jobState!=='idle')continue
   const id=armed.get(chat.id);if(!id)continue;armed.delete(chat.id)
   const message=chat.messages.findLast(item=>item.role==='assistant')
   if(!message||!['completed','failed','stopped'].includes(message.state))continue
   const outcome=message.state==='stopped'?'stopped':message.state==='failed'||isHadronIncompleteRecord(message.text)?'failed':'completed'
   const identity=chat.id+':'+id;if(announced.has(identity))continue;announced.add(identity)
   if(announced.size>200)announced.delete(announced.values().next().value!)
   try{void Promise.resolve(notify({id,projectId:chat.projectId,chatId:chat.id,agent:chat.workType==='individual'?chat.agent:'both',outcome})).catch(()=>{})}catch{/* Notification-only failure. */}
  }
 })
}
