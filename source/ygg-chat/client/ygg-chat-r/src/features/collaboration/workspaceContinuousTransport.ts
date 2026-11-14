import {workspaceActivity} from './workspaceActivity'
import type {ContinuousChatApi,ContinuousChatView} from '../../../../../shared/continuousChat'
import type {WorkspaceRunRequest,WorkspaceRunTransport,WorkspaceRunEvent} from './workspaceRunner'
import {workspaceReplyState} from './workspaceHistory'
import {workspaceHandoverContext} from './workspaceContext'

export interface ContinuousRunReference {id:string;workspaceId:string}
export function continuousWorkspaceTransport(deps:{
 api:ContinuousChatApi;workspaceId:string;anchor(request:WorkspaceRunRequest):Promise<string>;
 remember(reference:ContinuousRunReference|null):void;pollMs?:number;checkpoint?():Promise<void>;
}):WorkspaceRunTransport {
 return {create(request,changed){
  if(request.workType!=='continuous'||request.permission!=='chat')throw Error('Continuous conversation uses Chat permissions')
  const a=request.models.a,b=request.models.b
  if(!a?.provider||!a.modelName||!b?.provider||!b.modelName)throw Error('Choose both agent providers and models')
  const selected=request.path.at(-1),parent=selected?.origin
  const continuation=!request.path.some(message=>message.edited||message.note)&&selected?.role==='assistant'&&parent?.kind==='continuous'&&parent.fullContext?parent.id:undefined
  const historyBudget=Math.max(0,12000-request.question.text.length-(request.question.context?.length??0)-120)
  const context=continuation||!request.path.length?'':workspaceHandoverContext(request.path,'',request.agent,historyBudget)
  const goal=context?`Previous selected conversation:\n${context}\n\nCurrent instruction:\n${request.question.text}`:request.question.text
  const goalWithFiles=[goal,request.question.context?'Attached context: '+request.question.context:''].filter(Boolean).join('\n\n')
  const continuationInstruction=[request.question.text,request.question.context??''].filter(Boolean).join('\n\n')
  if(!continuation&&goalWithFiles.length>12000)throw Error('Select a shorter excerpt to start this conversation')
  if(continuation&&continuationInstruction.length>4000)throw Error('Use a shorter continuation message or attach a folder for reading')
  let disposed=false,started=false,posted=false,stopRequested=false,poll:ReturnType<typeof setTimeout>|undefined,revision=-1
  let launch:Promise<void>|undefined
  const render=(view:ContinuousChatView)=>{
   if(disposed||view.id!==request.id||view.revision<revision)return
   revision=view.revision
   const ended=view.workersEnded
   const replyTurns=view.turns.filter(turn=>turn.kind!=='memory')
   const replies:WorkspaceRunEvent['replies']=replyTurns.map(turn=>({id:`continuous:${view.id}:turn:${turn.ordinal}`,text:turn.text??'',activity:workspaceActivity(view.folderActivity,[{id:turn.role,status:turn.state}]),state:workspaceReplyState(turn.state),agent:turn.role,
    ...request.models[turn.role],origin:{kind:'continuous',id:view.id,nodeId:`turn:${turn.ordinal}`,fullContext:ended&&turn.ordinal===replyTurns.at(-1)?.ordinal}}))
   changed({text:ended&&!replies.length?'The conversation ended before a reply was produced.':'',state:ended?(view.state==='failed'||view.state==='needs_recovery'||!replies.length?'failed':view.state==='stopped'?'stopped':'completed'):'running',replies,
    ...(view.state==='failed'||view.state==='needs_recovery'?{error:'This conversation stopped before its limit. Its completed replies are saved.'}:{})})
   if(ended){deps.remember(null);return}
   if(poll)clearTimeout(poll)
   poll=setTimeout(()=>void recover().catch(()=>{}),deps.pollMs??1000)
  }
  const recover=async()=>{
   try{render(await deps.api.status(request.id))}
   catch{if(!disposed)changed({text:'',state:'unknown',error:'The conversation status is unavailable. No additional conversation has been started.'});throw Error('Conversation status unavailable')}
  }
  const startFlow=async()=>{
   const anchorMessageId=await deps.anchor(request)
   if(disposed||stopRequested)return
   deps.remember({id:request.id,workspaceId:deps.workspaceId})
   changed({text:'',state:'running',nativeJob:{kind:'continuous',id:request.id}})
   try{await deps.checkpoint?.()}catch(error){deps.remember(null);changed({text:'The conversation was not sent because its saved checkpoint failed.',state:'failed',error:error instanceof Error?error.message:'Save failed'});return}
   if(disposed||stopRequested)return
   posted=true
   const common={id:request.id,models:{a:a.modelName,b:b.modelName},providers:{a:a.provider,b:b.provider},maxTurns:request.maxTurns,maxSeconds:3600,
    ...(request.folder?{projectGrantId:request.folder.id}:{})}
   if(continuation)render(await deps.api.continueSaved(continuation,{...common,instruction:continuationInstruction}))
   else render(await deps.api.start({...common,workspaceId:deps.workspaceId,anchorMessageId,goal:goalWithFiles}))
  }
  return {
   async start(){if(started)throw Error('This message was already sent');started=true;launch=startFlow();await launch},
   async stop(){
    stopRequested=true
    if(!posted){changed({text:'Stopped before the conversation started.',state:'stopped'});return}
    // The native API may acknowledge Start after the user presses Stop. Preserve its identity and stop it once admitted.
    try{await launch}catch{ /* A lost response is checked by the native stop request. */ }
    render(await deps.api.stop(request.id))
   },recover,
   dispose(){disposed=true;if(poll)clearTimeout(poll)},
  }
 }}
}
