import {sharedWorkspaceActivity} from './workspaceActivity'
import type {ProposalSessionInput} from '../../../../../shared/collaboration'
import {CollaborationAdmission,type AdmissionState,type AdmissionStore} from './admission'
import {CollaborationSupervisor,type CollaborationView} from './supervisor'
import type {createCollaborationClient} from './client'
import type {WorkspaceRunRequest,WorkspaceRunTransport} from './workspaceRunner'
import {workspaceReplyState} from './workspaceHistory'
import {workspaceHandoverContext,workspaceHistorySize} from './workspaceContext'
import {workspaceSharedFailureText} from './workspaceSharedFailure'

type Client=Pick<ReturnType<typeof createCollaborationClient>,'prepareTask'|'preflight'|'start'|'status'|'stream'|'stop'|'transcript'>

/** Both agents answer the same selected branch. The next Send continues its saved final answer. */
export function sharedWorkspaceTransport(deps:{client:Client;workspaceId:string;store(request:WorkspaceRunRequest):AdmissionStore;pollMs?:number;
 agentAccess?(request:WorkspaceRunRequest):Promise<{id:string}>;releaseAgent?(id:string):Promise<void>|void;checkpoint?():Promise<void>;
}):WorkspaceRunTransport {
 return {create(request,changed){
  if(request.workType!=='together')throw Error('This transport handles Work together')
  if(request.permission==='agent'&&(!request.folder||!deps.agentAccess))throw Error('Attach a coding folder and choose Agent mode')
  const participants=(['a','b'] as const).map(id=>{
   const model=request.models[id];if(!model?.provider||!model.modelName)throw Error('Choose both agent providers and models')
   return {id,...model}
  })
  const selected=request.path.at(-1),parent=selected?.origin
  const parentSessionId=workspaceHistorySize(request.path)<20000&&!request.path.some(message=>message.edited||message.note)&&selected?.role==='assistant'&&selected.state==='completed'&&parent?.kind==='shared'?parent.id.replace(/^shared:/,''):undefined
  const context=workspaceHandoverContext(parentSessionId?[]:request.path,request.question.context??'',request.agent)
  const store=deps.store(request)
  if(store.read())throw Error('There is a saved shared task to reconnect before sending another message')
  let started=false,disposed=false,stoppedBeforeLaunch=false,posted=false,launch:Promise<void>|undefined,settling=false,admitted:AdmissionState|undefined,agentId:string|undefined
  const releaseAgent=()=>{if(agentId)void deps.releaseAgent?.(agentId)}
  const admission=new CollaborationAdmission(deps.client,view=>{admitted=view},store)
  const render=(view:CollaborationView)=>{
   if(disposed||!view.status)return
   const status=view.status,final=status.collaboration?.stages.find(stage=>stage.id==='final')
   const ended=['completed','cancelled','failed','interrupted'].includes(status.status)
   const proposals=(['a','b'] as const).map(agent=>view.panes[agent].text?`Agent ${agent.toUpperCase()}\n${view.panes[agent].text}`:'').filter(Boolean).join('\n\n')
   const activity=sharedWorkspaceActivity(status)
   const text=final?.text||proposals
   if(ended&&!final?.text){
    if(settling)return
    settling=true
    void Promise.allSettled(status.participants.filter(participant=>participant.runId).map(participant=>deps.client.transcript(status.sessionId,participant.id))).then(results=>{
     if(disposed)return
     const saved=results.flatMap((result,index)=>result.status==='fulfilled'&&result.value.text?[`Agent ${status.participants.filter(participant=>participant.runId)[index].id.toUpperCase()}\n${result.value.text}`]:[]).join('\n\n')
     changed({activity,text:workspaceSharedFailureText(status,saved||text),state:status.status==='completed'?'failed':workspaceReplyState(status.status),
      origin:{kind:'shared',id:status.sessionId,nodeId:status.sessionId},error:status.error??'The combined answer did not finish.'})
     store.clear();releaseAgent()
    });return
   }
   changed({activity,text,state:ended?workspaceReplyState(status.status):'running',origin:{kind:'shared',id:status.sessionId,nodeId:final?.id??status.sessionId},
    ...(view.error||status.error?{error:view.error??status.error??undefined}:{}),
   })
   if(ended){store.clear();releaseAgent()}
  }
  const supervisor=new CollaborationSupervisor(deps.client,render,deps.pollMs)
  const recover=async()=>{
   await admission.recover()
   if(admitted?.phase==='accepted'&&admitted.status)supervisor.watch(admitted.status.sessionId)
   else changed({text:'',state:'unknown',error:admitted?.error??'The saved task could not be confirmed.'})
  }
  const startFlow=async()=>{
    if(request.permission==='agent')agentId=(await deps.agentAccess!(request)).id
    if(disposed||stoppedBeforeLaunch){releaseAgent();return}
    const source=await deps.client.prepareTask(request.id,deps.workspaceId,request.question.text)
    const input:ProposalSessionInput={schemaVersion:1,sessionId:request.id,conversationId:deps.workspaceId,
     sourceLineageId:source.sourceLineageId,anchorMessageId:source.anchorMessageId,task:request.question.text,context,participants,...(request.images?.length?{images:request.images}:{}),...(request.documents?.length?{documents:request.documents}:{}),
     workflow:'review_and_synthesis',...(request.folder?{projectGrantId:agentId??request.folder.id}:{}),...(request.permission==='agent'?{projectMode:'agent'}:{}),
     ...(parentSessionId?{parentSessionId,includeParentContext:true}:{}),
    }
    await deps.client.preflight(input)
    if(disposed||stoppedBeforeLaunch)return
    changed({text:'',state:'running',nativeJob:{kind:'shared',id:request.id}})
    try{await deps.checkpoint?.()}catch(error){releaseAgent();changed({text:'The task was not sent because its saved checkpoint failed.',state:'failed',error:error instanceof Error?error.message:'Save failed'});return}
    if(disposed||stoppedBeforeLaunch)return
    posted=true
    await admission.submit(input)
    if(admitted?.phase==='accepted')supervisor.watch(request.id)
    else await recover()
  }
  return {
   async start(){if(started)throw Error('This message was already sent');started=true;launch=startFlow();await launch},
   async stop(){
    if(!posted){stoppedBeforeLaunch=true;changed({text:'Stopped before the task started.',state:'stopped'});return}
    await launch;await supervisor.stop()
   },recover,
   dispose(){disposed=true;supervisor.dispose();admission.dispose()},
  }
 }}
}
