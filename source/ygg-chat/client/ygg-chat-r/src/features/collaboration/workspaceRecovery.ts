import {workspaceSharedFailureText} from './workspaceSharedFailure'
import {workspaceActivity,sharedWorkspaceActivity} from './workspaceActivity'
import {IndependentJobController,browserJobStore,jobTerminal} from './independentJobController'
import {CollaborationSupervisor} from './supervisor'
import {projectHistoryChat,workspaceReplyState} from './workspaceHistory'
import type {WorkspaceSession} from './workspaceSession'
import type {createIndependentJobClient} from './independentClient'
import type {createCollaborationClient} from './client'
import type {ContinuousChatApi} from '../../../../../shared/continuousChat'
import type {ProjectDraftApi} from '../../../../../shared/projectBuild'
import type {WorkspaceMessage} from './unifiedWorkspace'

/** Attach only GET/replay/Stop to saved identities. This module has no Start,
 * continueSaved, resume, admission, prepare, or provider-dispatch code. */
export function observeWorkspaceJob(session:WorkspaceSession,chatId:string,deps:{
 independent:ReturnType<typeof createIndependentJobClient>;shared:ReturnType<typeof createCollaborationClient>;
 continuous:ContinuousChatApi;project:ProjectDraftApi;pollMs?:number;
}){
 const initial=session.getSnapshot().state.chats[chatId],reference=initial?.nativeJob
 if(!initial||!reference||initial.jobState==='idle')return
 let finishingShared=false,sharedNeedsReconnect=false,disposed=false,timer:ReturnType<typeof setTimeout>|undefined,controller:{dispose():void;stop():Promise<void>;recover():Promise<void>}|undefined,reading:Promise<void>|undefined
 const workspace=initial.nativeWorkspaceId??initial.id,id=reference.id,uiJob=initial.jobId??id
 const current=()=>session.getSnapshot().state.chats[chatId]
 const error=(text:string|null)=>{if(!disposed)session.error(chatId,text)}
 const settle=(ended:boolean)=>{
  if(disposed)return
  session.dispatch({type:'job',chatId,id:uiJob,state:ended?'idle':'running'})
  if(ended){if(timer){clearTimeout(timer);timer=undefined}session.endRecovery(chatId)}
 }
 const write=(message:WorkspaceMessage)=>{if(!disposed)session.dispatch({type:'message',chatId,message})}
 const reply=(text:string,state:WorkspaceMessage['state'],origin:NonNullable<WorkspaceMessage['origin']>,activity?:WorkspaceMessage['activity'])=>{
  const chat=current(),old=chat.messages.findLast(message=>message.role==='assistant'&&message.origin?.kind===origin.kind&&message.origin.id===origin.id)??chat.messages.findLast(message=>message.role==='assistant'&&message.state==='running')
  const question=old?undefined:chat.messages.findLast(message=>message.role==='user')
  if(!old&&!question)throw Error('The saved task has no original question')
  write({...old,id:old?.id??`recovered:${reference.kind}:${id}`,parentId:old?old.parentId:question!.id,role:'assistant',agent:old?.agent??(chat.workType==='individual'?chat.agent:'both'),text,state,origin,...(activity?{activity}:{})})
 }
 const read=async()=>{
  if(disposed)return
  try{
   if(reference.kind==='independent'){
    if(!controller){
     const status=await deps.independent.status(id);if(disposed)return
     const store=browserJobStore(workspace,initial.agent,`unified:${chatId}`)
     store.write({schemaVersion:1,id,sourceConversationId:workspace,slot:initial.agent,stage:'submitted',conversationId:status.conversationId})
     const native=new IndependentJobController(deps.independent,workspace,initial.agent,store,view=>{
      if(disposed||!view.status)return
      const ended=jobTerminal(view.status.status)&&view.outputComplete
      if(view.text||view.outputComplete||view.status.toolActivity?.length)reply(view.text,ended?workspaceReplyState(view.status.status,view.text):'running',{kind:'independent',id,nodeId:view.status.runId??id},workspaceActivity(view.status.toolActivity,[{id:initial.agent,status:view.status.status}]))
      error(view.error);settle(ended)
      if(ended)store.clear()
     },deps.pollMs)
     controller={dispose:()=>native.dispose(),stop:()=>native.stop(),recover:()=>native.recover()}
    }
    await controller.recover()
   }else if(reference.kind==='shared'){
    if(!controller){
     const supervisor=new CollaborationSupervisor(deps.shared,view=>{
      if(disposed)return
      sharedNeedsReconnect=!!view.error
      if(!view.status)return
      const status=view.status,final=status.collaboration?.stages.find(stage=>stage.id==='final'),ended=jobTerminal(status.status)
      const activity=sharedWorkspaceActivity(status)
      const partial=(['a','b'] as const).flatMap(agent=>view.panes[agent].text?[`Agent ${agent.toUpperCase()}\n${view.panes[agent].text}`]:[]).join('\n\n')
      if(ended&&!final?.text){
       if(finishingShared)return
       finishingShared=true
       void Promise.allSettled(status.participants.filter(participant=>participant.runId).map(async participant=>({agent:participant.id,text:(await deps.shared.transcript(id,participant.id)).text}))).then(results=>{
        if(disposed)return
        const saved=results.flatMap(result=>result.status==='fulfilled'&&result.value.text?[`Agent ${result.value.agent.toUpperCase()}\n${result.value.text}`]:[]).join('\n\n')
        reply(workspaceSharedFailureText(status,saved||partial),status.status==='completed'?'failed':workspaceReplyState(status.status),{kind:'shared',id,nodeId:id},activity)
        error(status.error??null);settle(true)
       });return
      }
      if(final?.text||partial||ended||activity.length)reply(final?.text||partial||'This collaboration ended before an answer was saved.',ended?(status.status==='completed'&&!final?.text?'failed':workspaceReplyState(status.status)):'running',{kind:'shared',id,nodeId:final?.id??id},activity)
      error(view.error??status.error??null);settle(ended)
     },deps.pollMs)
     supervisor.watch(id)
     controller={dispose:()=>supervisor.dispose(),stop:()=>supervisor.stop(),recover:async()=>{if(sharedNeedsReconnect)supervisor.watch(id)}}
    }else await controller.recover()
   }else if(reference.kind==='continuous'){
    const view=await deps.continuous.status(id);if(disposed)return
    const chat=current(),existing=chat.messages.filter(message=>message.role==='assistant'&&message.origin?.kind==='continuous'&&message.origin.id===id)
    const first=existing[0]??chat.messages.findLast(message=>message.role==='assistant'&&message.state==='running')
    let parent=first?.parentId??chat.messages.findLast(message=>message.role==='user')?.id??null
    const turns=view.turns.filter(turn=>turn.kind!=='memory')
    for(const [index,turn] of turns.entries()){
     const old=existing.find(message=>message.origin?.nodeId.endsWith(`:${turn.ordinal}`))??(index===0?first:undefined)
     const nextId=old?.id??`continuous:${id}:turn:${turn.ordinal}`
     const state=view.workersEnded&&index===turns.length-1&&(view.state==='failed'||view.state==='stopped')?workspaceReplyState(view.state):workspaceReplyState(turn.state)
     write({id:nextId,parentId:old?.parentId??parent,role:'assistant',agent:turn.role,text:turn.text??'',state,...chat.models[turn.role],origin:{kind:'continuous',id,nodeId:`turn:${turn.ordinal}`,fullContext:view.workersEnded&&index===turns.length-1}})
     parent=nextId
    }
    if(view.workersEnded&&!turns.length)reply('This conversation ended before a reply was saved.','failed',{kind:'continuous',id,nodeId:'empty'})
    error(view.state==='failed'?'This conversation stopped before its turn limit. Saved replies are available.':null);settle(view.workersEnded)
   }else{
    const view=await deps.project.status(id);if(disposed)return
    const projected=projectHistoryChat(initial.projectId,view)
    for(const message of projected.messages)write(message)
    error(view.failure??null);settle(view.workersEnded)
   }
  }catch{error('The saved task status is temporarily unavailable. Hadron is checking it; no new task was started.')}
  if(!disposed&&current().jobState!=='idle'&&!timer)timer=setTimeout(()=>{timer=undefined;void recover()},deps.pollMs??1500)
 }
 const recover=()=>reading??=(read().finally(()=>{reading=undefined}))
 const stop=async()=>{
  await recover();if(disposed||current().jobState==='idle')return
  session.dispatch({type:'job',chatId,id:uiJob,state:'stopping'})
  try{
   if(controller)await controller.stop()
   else if(reference.kind==='continuous')await deps.continuous.stop(id)
   else if(reference.kind==='project')await deps.project.stop(id)
   await recover()
  }catch{error('Stop could not be confirmed. Hadron will check the saved task again.')}
 }
 const dispose=()=>{disposed=true;if(timer)clearTimeout(timer);controller?.dispose()}
 session.attachRecovery(chatId,{stop,recover,dispose});void recover()
}
