import {workspaceMessagePath,type UnifiedWorkspaceAction,type UnifiedWorkspaceState,type WorkspaceChat,type WorkspaceMessage} from './unifiedWorkspace'
import {composeSharedContext} from './attachmentContext'
import {WORKSPACE_VISUAL_INSTRUCTION} from './workspaceVisuals'
import {parseHadronImages,type HadronImage} from '../../../../../shared/hadronImages'

export interface WorkspaceRunRequest {
 id:string;chatId:string;projectId:string;nativeWorkspaceId?:string;workType:WorkspaceChat['workType'];permission:WorkspaceChat['permission'];agent:WorkspaceChat['agent'];
 models:WorkspaceChat['models'];maxTurns:number;folder:WorkspaceChat['folder'];
 question:WorkspaceMessage;answerId:string;path:WorkspaceMessage[];
 images?:HadronImage[];
}
export interface WorkspaceRunEvent {
 text:string;state:'running'|'completed'|'failed'|'stopped'|'unknown';error?:string;origin?:WorkspaceMessage['origin'];
 nativeJob?:WorkspaceChat['nativeJob'];activity?:WorkspaceMessage['activity'];
 replies?:Array<Pick<WorkspaceMessage,'id'|'text'|'state'|'agent'|'origin'|'provider'|'modelName'|'activity'>>;
}
export interface WorkspaceRunHandle {start():Promise<void>;stop():Promise<void>;recover():Promise<void>;dispose():void}
export interface WorkspaceRunTransport {
 /** Constructor is local only. start() is the sole provider dispatch point. */
 create(request:WorkspaceRunRequest,changed:(event:WorkspaceRunEvent)=>void):WorkspaceRunHandle;
}

/** Keeps jobs attached to their chat while the user switches agents, branches or views. */
export class WorkspaceRunner {
 private runs=new Map<string,{request:WorkspaceRunRequest;handle:WorkspaceRunHandle;ended:boolean}>()
 private disposed=false
 constructor(private readonly deps:{
  getState():UnifiedWorkspaceState;dispatch(action:UnifiedWorkspaceAction):void;
  transport:WorkspaceRunTransport;id():string;error(chatId:string,error:string|null):void;
 }){}
 async send(branch?:{chatId:string;messageId:string;text:string}):Promise<void>{
  if(this.disposed)throw Error('Workspace is closed')
  const state=this.deps.getState(),chat=state.chats[branch?.chatId??state.activeChatId]
  const text=branch?.text??chat?.draft
  if(!chat||!text?.trim())throw Error('Write a message first')
  const source=branch?chat.messages.find(message=>message.id===branch.messageId):undefined
  if(branch&&!source)throw Error('The branch source is no longer available')
  if(chat.jobState!=='idle'||this.runs.get(chat.id)&&!this.runs.get(chat.id)!.ended)throw Error('This chat still has work in progress')
  const agents=chat.workType==='individual'?[chat.agent]:['a','b'] as const
  if(agents.some(agent=>!chat.models[agent]?.provider||!chat.models[agent]?.modelName))throw Error('Choose an agent provider and model in the pop-up')
  if(Object.values(state.chats).some(other=>other.id!==chat.id&&other.jobState!=='idle'&&(other.workType!=='individual'||chat.workType!=='individual'||other.agent===chat.agent)))throw Error('One of these agents already has work in progress')
  const context=source?.role==='user'&&source.context?source.context:composeSharedContext([chat.instructions??'',WORKSPACE_VISUAL_INSTRUCTION].filter(Boolean).join('\n\n'),branch?[]:chat.attachments??[])
  // An alternative question is a sibling of the original, not a repeated follow-up beneath it.
  const parentId=source?(source.role==='user'?source.parentId:source.id):chat.selectedId
  const id=this.deps.id(),answerId=this.deps.id(),question:WorkspaceMessage={id:this.deps.id(),parentId,role:'user',text,state:'completed',...(context?{context}:{})}
  const path=workspaceMessagePath({...chat,selectedId:parentId})
  const attached=parseHadronImages(branch?(source?.role==='user'?source.images:[]) : (chat.attachments??[]).flatMap(file=>file.image?[file.image]:[]))
  if(attached.length)question.images=attached
  const images=parseHadronImages([...new Map([...path.flatMap(message=>message.images??[]),...attached].map(image=>[image.id,image])).values()])
  const request:WorkspaceRunRequest=structuredClone({id,chatId:chat.id,projectId:state.projectId,nativeWorkspaceId:chat.nativeWorkspaceId,workType:chat.workType,permission:chat.folder?chat.permission:'chat',agent:chat.agent,models:chat.models,maxTurns:chat.maxTurns,folder:chat.folder,question,answerId,path,...(images.length?{images}:{})})
  // Build and validate locally before clearing the user's draft or showing an admitted task.
  let record:{request:WorkspaceRunRequest;handle:WorkspaceRunHandle;ended:boolean}|undefined
  const buffered:WorkspaceRunEvent[]=[]
  const changed=(event:WorkspaceRunEvent)=>{
   if(!record){buffered.push(event);return}
   if(this.disposed||this.runs.get(chat.id)!==record||record.ended)return
   const ended=['completed','failed','stopped'].includes(event.state)
   if(event.nativeJob){
    this.deps.dispatch({type:'native-job',chatId:chat.id,job:event.nativeJob})
    if(event.nativeJob.kind==='independent')this.deps.dispatch({type:'message',chatId:chat.id,message:{...question,origin:{kind:'independent',id:event.nativeJob.id,nodeId:'task'}}})
   }
   if(event.replies?.length){
    let parentId=question.id
    for(const [index,reply] of event.replies.entries()){
     const id=index===0?answerId:reply.id
     const state=index===event.replies.length-1&&ended&&(event.state==='failed'||event.state==='stopped')?event.state:reply.state
     this.deps.dispatch({type:'message',chatId:chat.id,message:{...reply,id,parentId,role:'assistant',state}})
     parentId=id
    }
   }else if(event.state!=='unknown')this.deps.dispatch({type:'message',chatId:chat.id,message:{id:answerId,parentId:question.id,role:'assistant',agent:chat.workType==='individual'?chat.agent:'both',text:event.text,state:event.state,origin:event.origin,activity:event.activity,
    ...(chat.models[chat.agent]??{})}})
   this.deps.dispatch({type:'job',chatId:chat.id,id, state:ended?'idle':event.state==='unknown'?'unknown':'running'})
   this.deps.error(chat.id,event.error??null)
   record.ended=ended
  }
  const handle=this.deps.transport.create(request,changed)
  record={request,handle,ended:false}
  this.runs.get(chat.id)?.handle.dispose();this.runs.set(chat.id,record)
  this.deps.dispatch({type:'message',chatId:chat.id,message:question})
  this.deps.dispatch({type:'message',chatId:chat.id,message:{id:answerId,parentId:question.id,role:'assistant',agent:chat.workType==='individual'?chat.agent:'both',text:'',state:'running'}})
  this.deps.dispatch({type:'select-message',chatId:chat.id,id:answerId})
  this.deps.dispatch({type:'follow-updates',chatId:chat.id,value:true})
  this.deps.dispatch({type:'job',chatId:chat.id,id,state:'running'})
  if(!branch){this.deps.dispatch({type:'draft',chatId:chat.id,text:''});this.deps.dispatch({type:'attachments',chatId:chat.id,files:[]})}
  this.deps.error(chat.id,null)
  for(const event of buffered)changed(event)
  try{await handle.start()}
  catch{
   // A lost admission response is not proof that work did not start. Only status recovery may unblock it.
   if(!this.disposed&&!record.ended&&this.runs.get(chat.id)===record){
    this.deps.dispatch({type:'job',chatId:chat.id,id,state:'unknown'})
    this.deps.error(chat.id,'The task could not be confirmed. Hadron will check its saved status; it will not send it twice.')
    try{await handle.recover()}catch{ /* Keep unconfirmed work visible and fenced. */ }
   }
  }
 }
 async stop(chatId:string):Promise<void>{
  const run=this.runs.get(chatId);if(!run||run.ended||this.disposed)return
  this.deps.dispatch({type:'job',chatId,id:run.request.id,state:'stopping'})
  try{await run.handle.stop()}catch{this.deps.error(chatId,'Stop could not be confirmed. Checking the existing task.');try{await run.handle.recover()}catch{ /* Retain task identity. */ }}
 }
 async recover(chatId:string):Promise<void>{await this.runs.get(chatId)?.handle.recover()}
 /** Ephemeral launch provenance: recovered/archive job IDs never enter this map. */
 startedHere(chatId:string,id:string){return !this.disposed&&this.runs.get(chatId)?.request.id===id}
 /** Unmounting the viewer never stops work or starts an additional request. */
 dispose(){this.disposed=true;for(const run of this.runs.values())run.handle.dispose();this.runs.clear()}
}
