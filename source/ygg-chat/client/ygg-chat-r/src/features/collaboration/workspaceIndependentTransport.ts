import {workspaceActivity} from './workspaceActivity'
import {IndependentJobController,jobTerminal,type IndependentJobView,type JobStore} from './independentJobController'
import type {createIndependentJobClient} from './independentClient'
import type {WorkspaceRunRequest,WorkspaceRunTransport,WorkspaceRunEvent} from './workspaceRunner'
import {workspaceReplyState} from './workspaceHistory'
import {workspaceHandoverContext,workspaceHistorySize} from './workspaceContext'

type Client=Pick<ReturnType<typeof createIndependentJobClient>,'prepare'|'start'|'status'|'stop'|'transcript'|'stream'>

/** Uses the existing durable native job admission and replay; no inference on navigation. */
export function individualWorkspaceTransport(deps:{client:Client;workspaceId:string;store(request:WorkspaceRunRequest):JobStore;pollMs?:number;
 agentAccess?(request:WorkspaceRunRequest):Promise<{id:string}>;releaseAgent?(id:string):Promise<void>|void;checkpoint?():Promise<void>;
}):WorkspaceRunTransport {
 return {create(request,changed){
  if(request.workType!=='individual')throw Error('This transport only handles individual agents')
  if(request.permission==='agent'&&(!deps.agentAccess||!request.folder))throw Error('Attach a coding folder and choose Agent mode')
  const model=request.models[request.agent]
  if(!model?.provider||!model.modelName)throw Error('Choose the agent provider and model')
  const parent=request.path.at(-1)
  const nativeParent=workspaceHistorySize(request.path)<20000&&!request.path.some(message=>message.edited||message.note)&&parent?.role==='assistant'&&parent.agent===request.agent&&parent.provider===model.provider&&parent.origin?.kind==='independent'?{jobId:parent.origin.id,kind:'response' as const}:undefined
  // Native branch continuity is rebuilt by the host. Imported text remains explicit context.
  const context=workspaceHandoverContext(nativeParent?[]:request.path,request.question.context??'',request.agent)
  const store=deps.store(request)
  if(store.read())throw Error('There is a saved task to reconnect before sending another message')
  let last:IndependentJobView|undefined,started=false,stoppedBeforeLaunch=false,launch:Promise<boolean>|undefined,agentId:string|undefined
  let checkpointError:unknown
  const client={...deps.client,start:async(input:Parameters<Client['start']>[0])=>{try{await deps.checkpoint?.()}catch(error){checkpointError=error;throw error}return deps.client.start(input)}}
  const controller=new IndependentJobController(client,deps.workspaceId,request.agent,store,view=>{
   last=view
   if(!started||!view.id||view.phase==='ready')return
   const terminal=view.status&&jobTerminal(view.status.status)
   const state=terminal&&view.outputComplete?workspaceReplyState(view.status!.status,view.text):view.phase==='unknown'?'unknown':'running'
   const event:WorkspaceRunEvent={nativeJob:{kind:'independent',id:view.id},activity:workspaceActivity(view.status?.toolActivity,[{id:request.agent,status:state==='failed'?'failed':view.status?.status??'created'}]),text:view.text,state,
    ...(view.error?{error:view.error}:{}),...(view.status?.runId?{origin:{kind:'independent',id:view.id,nodeId:view.status.runId} as const}:{})}
   changed(event)
   if(terminal&&view.outputComplete){store.clear();if(agentId)void deps.releaseAgent?.(agentId)}
  },deps.pollMs)
  return {
   async start(){
    if(started)throw Error('This message was already sent')
    started=true
    if(request.permission==='agent'){
     agentId=(await deps.agentAccess!(request)).id
     if(stoppedBeforeLaunch){void deps.releaseAgent?.(agentId);return}
    }
    launch=controller.submit({task:request.question.text,context,...model,...(request.images?.length?{images:request.images}:{}),
     ...(request.folder?{toolMode:request.permission==='agent'?'agent':'project',projectGrantId:agentId??request.folder.id}:{}),
    },nativeParent)
    const accepted=await launch
    if(checkpointError){controller.dispose();store.clear();if(agentId)void deps.releaseAgent?.(agentId);changed({text:'The task was not sent because its saved checkpoint failed.',state:'failed',error:checkpointError instanceof Error?checkpointError.message:'Save failed'});return}
    if(stoppedBeforeLaunch)return
    if(!accepted&&last?.phase==='unknown')await controller.recover()
    if(!accepted&&last?.phase==='ready')changed({text:'This task was not sent. Its preparation did not finish.',state:'failed',error:'The saved instruction is available above. Check the folder and connection, then send again.'})
   },
   async stop(){
    if(!launch||last?.phase==='preparing'){
     stoppedBeforeLaunch=true;controller.dispose();store.clear()
     changed({text:'Stopped before the task started.',state:'stopped'});return
    }
    if(last?.phase==='submitting'||last?.phase==='unknown'){await launch;await controller.recover()}
    await controller.stop()
   },recover:()=>controller.reconnect(),dispose:()=>controller.dispose(),
  }
 }}
}
