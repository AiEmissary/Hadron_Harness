import type {HadronProvider} from '../../../../../shared/hadronProviders'

export interface WorkspaceAttachment {id:string;name:string;text:string;image?:import('../../../../../shared/hadronImages').HadronImage;searchable?:true}
export type WorkspaceAgent='a'|'b'
export type WorkspaceWorkType='individual'|'together'|'continuous'
export type WorkspacePermission='chat'|'agent'
export interface WorkspaceNativeJob {kind:'independent'|'shared'|'continuous'|'project';id:string}
export interface WorkspaceModel {provider:HadronProvider;modelName:string}
export interface WorkspaceMessage {
  id:string;parentId:string|null;role:'user'|'assistant';agent?:WorkspaceAgent|'both';text:string;
  state:'running'|'completed'|'failed'|'stopped';modelName?:string;provider?:HadronProvider;
  origin?:{kind:'independent'|'shared'|'continuous'|'project';id:string;nodeId:string;fullContext?:boolean};
  activity?:Array<{time?:string;label:string;state:string}>;
  edited?:boolean;
  note?:string;
  context?:string;
  images?:import('../../../../../shared/hadronImages').HadronImage[];
  reference?:{chatId:string;messageId:string;capturedAt:number;state:WorkspaceMessage['state']};
}
export interface WorkspaceChat {
  id:string;projectId:string;title:string;workType:WorkspaceWorkType;permission:WorkspacePermission;
  nativeWorkspaceId?:string;instructions?:string;sharedContinuation?:boolean;peerChats?:Partial<Record<WorkspaceAgent,string>>;
  agent:WorkspaceAgent;models:Partial<Record<WorkspaceAgent,WorkspaceModel>>;maxTurns:number;
  draft:string;selectedId:string|null;messages:WorkspaceMessage[];scrollTop:number;followLatest:boolean;followBranch:boolean;
  jobId:string|null;jobState:'idle'|'running'|'stopping'|'unknown';
  folder?:{id:string;label:string;workspaceId?:string;slot?:'a'|'b'|'shared'|'continuous'};
  nativeJob?:WorkspaceNativeJob;attachments?:WorkspaceAttachment[];
}
export interface UnifiedWorkspaceState {
  projectId:string;activeChatId:string;chats:Record<string,WorkspaceChat>;
  agentChats:Partial<Record<WorkspaceAgent,string>>;
  modelDefaults:WorkspaceChat['models'];
}
export function blankWorkspaceChat(projectId:string,id:string,agent:WorkspaceAgent='a',models:WorkspaceChat['models']={}):WorkspaceChat {
  return {id,projectId,title:'',workType:'individual',permission:'chat',agent,models:structuredClone(models),maxTurns:20,draft:'',selectedId:null,messages:[],scrollTop:0,followLatest:true,followBranch:true,jobId:null,jobState:'idle'}
}
export function initialUnifiedWorkspace(projectId:string,chatId:string,models:WorkspaceChat['models']={}):UnifiedWorkspaceState {
  return {projectId,activeChatId:chatId,chats:{[chatId]:blankWorkspaceChat(projectId,chatId,'a',models)},agentChats:{a:chatId},modelDefaults:structuredClone(models)}
}
/** Only connection choices are inherited: never messages, instructions, attachments or file authority. */
export function workspaceModelsWithDefaults(chat:WorkspaceChat,defaults:WorkspaceChat['models']):WorkspaceChat{
  const missing=(['a','b'] as const).filter(agent=>!chat.models[agent]&&defaults[agent])
  if(!missing.length)return chat
  const models={...chat.models}
  for(const agent of missing)models[agent]={...defaults[agent]!}
  return {...chat,models}
}
export type UnifiedWorkspaceAction=
  |{type:'open';chat:WorkspaceChat}
  |{type:'select-chat';id:string}
  |{type:'draft';chatId:string;text:string}
  |{type:'scroll';chatId:string;top:number;following?:boolean}
  |{type:'follow-updates';chatId:string;value:boolean}
  |{type:'select-message';chatId:string;id:string|null}
  |{type:'configure';chatId:string;workType?:WorkspaceWorkType;agent?:WorkspaceAgent;permission?:WorkspacePermission;models?:WorkspaceChat['models'];maxTurns?:number}
  |{type:'folder';chatId:string;folder:WorkspaceChat['folder']}
  |{type:'native-job';chatId:string;job:WorkspaceNativeJob}
  |{type:'attachments';chatId:string;files:WorkspaceAttachment[]}
  |{type:'instructions';chatId:string;text:string|undefined}
  |{type:'replace-messages';chatId:string;messages:WorkspaceMessage[];selectedId:string|null;select?:boolean}
  |{type:'job';chatId:string;id:string|null;state:WorkspaceChat['jobState']}
  |{type:'message';chatId:string;message:WorkspaceMessage}

/** Navigation does not dispatch requests, cancel jobs, clear drafts or mint file access. */
export function unifiedWorkspaceReducer(state:UnifiedWorkspaceState,action:UnifiedWorkspaceAction):UnifiedWorkspaceState {
  if(action.type==='open'){
    if(action.chat.projectId!==state.projectId)throw Error('Chat belongs to another project')
    const existing=state.chats[action.chat.id],modelDefaults={...action.chat.models,...state.modelDefaults}
    const opened=existing??workspaceModelsWithDefaults(action.chat,modelDefaults)
    return {...state,modelDefaults,activeChatId:action.chat.id,chats:existing?state.chats:{...state.chats,[action.chat.id]:opened},
      agentChats:opened.workType==='individual'?{...state.agentChats,[opened.agent]:opened.id}:state.agentChats}
  }
  if(action.type==='select-chat'){
    if(!state.chats[action.id])throw Error('Saved chat is unavailable')
    const chat=state.chats[action.id]
    return {...state,activeChatId:action.id,agentChats:chat.workType==='individual'?{...state.agentChats,[chat.agent]:chat.id}:state.agentChats}
  }
  const chat=state.chats[action.chatId]
  if(!chat)throw Error('Chat is unavailable')
  let next:WorkspaceChat
  switch(action.type){
    case 'draft':next={...chat,draft:action.text};break
    case 'scroll':next={...chat,scrollTop:Math.max(0,action.top),followLatest:action.following??chat.followLatest};break
    case 'follow-updates':next={...chat,followBranch:action.value};break
    case 'select-message':
      if(action.id&&!chat.messages.some(message=>message.id===action.id))throw Error('Branch is unavailable')
      next={...chat,selectedId:action.id,followBranch:false};break
    case 'folder':next={...chat,folder:action.folder};break
    case 'native-job':next={...chat,nativeJob:action.job};break
    case 'attachments':next={...chat,attachments:action.files};break
    case 'instructions':next={...chat,instructions:action.text};break
    case 'replace-messages':
      if(chat.jobState!=='idle')throw Error('Wait for this task to end before replacing its saved messages')
      next={...chat,messages:action.messages,selectedId:action.select||!action.messages.some(message=>message.id===chat.selectedId)?action.selectedId:chat.selectedId};break
    case 'configure':{
      if(chat.jobState!=='idle')throw Error('Wait for this reply to finish before changing its setup')
      const maxTurns=action.maxTurns??chat.maxTurns
      if(!Number.isSafeInteger(maxTurns)||maxTurns<1||maxTurns>100)throw Error('Choose 1 to 100 turns')
      const workType=action.workType??chat.workType,agent=action.agent??chat.agent
      if(action.agent&&Object.values(state.chats).some(other=>other.id!==chat.id&&other.jobState!=='idle'&&(other.workType!=='individual'||other.agent===agent)))throw Error('This agent already has work in progress')
      const models={...state.modelDefaults,...chat.models,...action.models}
      // A mode or agent change keeps the transcript and reuses remembered models.
      if(workType!==chat.workType||agent!==chat.agent)for(const agent of ['a','b'] as const){
        if(models[agent]?.provider||models[agent]?.modelName)continue
        const peer=state.chats[state.agentChats[agent]??'']
        const model=peer?.models[agent]??Object.values(state.chats).reverse().find(item=>item.models[agent]?.provider&&item.models[agent]?.modelName)?.models[agent]
        if(model?.provider&&model.modelName)models[agent]={...model}
      }
      next={...chat,workType,agent,sharedContinuation:workType==='individual'&&(chat.workType!=='individual'||chat.sharedContinuation||action.agent!==undefined)||undefined,permission:workType==='continuous'?'chat':action.permission??chat.permission,models,maxTurns};break
    }
    case 'job':
      if(chat.jobState!=='idle'&&chat.jobId&&action.id&&chat.jobId!==action.id)throw Error('Existing work cannot be replaced')
      next={...chat,jobId:action.id,jobState:action.state,...(chat.jobState==='idle'&&action.state!=='idle'?{nativeJob:undefined}:{})};break
    case 'message':{
      const index=chat.messages.findIndex(message=>message.id===action.message.id)
      const old=index>=0?chat.messages[index]:undefined
      if(action.message.parentId&&!chat.messages.some(message=>message.id===action.message.parentId))throw Error('Missing branch parent')
      if(old&&(old.parentId!==action.message.parentId||old.role!==action.message.role))throw Error('A message cannot be moved by a stream update')
      const messages=index<0?[...chat.messages,action.message]:chat.messages.map((message,i)=>i===index?action.message:message)
      const followLatest=chat.followBranch&&(chat.selectedId===null||chat.selectedId===old?.id||chat.selectedId===action.message.parentId)
      next={...chat,messages,selectedId:followLatest?action.message.id:chat.selectedId};break
    }
  }
  let agentChats=state.agentChats
  if(action.type==='configure'&&(next.workType!==chat.workType||next.agent!==chat.agent)){
    agentChats={...agentChats}
    for(const agent of ['a','b'] as const)if(agentChats[agent]===chat.id)delete agentChats[agent]
    if(next.workType==='individual')agentChats[next.agent]=next.id
  }
  let modelDefaults=state.modelDefaults
  if(action.type==='configure'&&action.models){
    modelDefaults={...modelDefaults}
    for(const agent of ['a','b'] as const){
      const model=action.models[agent],previous=chat.models[agent]
      if(model&&(model.provider==='openaichatgpt'||model.provider==='claudecode')&&
        (!previous||model.provider!==previous.provider||model.modelName!==previous.modelName))modelDefaults[agent]={...model}
    }
  }
  return {...state,agentChats,modelDefaults,chats:{...state.chats,[chat.id]:next}}
}

export function workspaceMessagePath(chat:WorkspaceChat):WorkspaceMessage[]{
  if(!chat.selectedId)return []
  const byId=new Map(chat.messages.map(message=>[message.id,message])),path:WorkspaceMessage[]=[],seen=new Set<string>()
  let message=byId.get(chat.selectedId)
  if(!message)throw Error('Selected branch is unavailable')
  while(message){
    if(seen.has(message.id))throw Error('Invalid branch cycle')
    seen.add(message.id);path.unshift(message)
    if(!message.parentId)break
    message=byId.get(message.parentId)
    if(!message)throw Error('Missing branch parent')
  }
  return path
}
/** Reading an earlier node must not cut off the rest of its branch. The
 * submission path still ends at selectedId; this is a display-only projection. */
export function workspaceTranscriptPath(chat:WorkspaceChat,preferredLeaf?:string):WorkspaceMessage[]{
  const selected=workspaceMessagePath(chat)
  if(!selected.length)return selected
  const byId=new Map(chat.messages.map(message=>[message.id,message]))
  let root=selected.at(-1)!.id
  if(preferredLeaf&&byId.has(preferredLeaf)){
    const previous=workspaceMessagePath({...chat,selectedId:preferredLeaf})
    if(previous.some(message=>message.id===root))root=preferredLeaf
  }
  const children=new Map<string,string[]>(),order=new Map<string,number>()
  chat.messages.forEach((message,index)=>{
    order.set(message.id,index)
    if(message.parentId){const list=children.get(message.parentId)??[];list.push(message.id);children.set(message.parentId,list)}
  })
  const pending=[root],seen=new Set<string>();let leaf=root,last=-1
  while(pending.length){
    const id=pending.pop()!
    if(seen.has(id))throw Error('Invalid branch cycle')
    seen.add(id)
    const next=children.get(id)
    if(next?.length)pending.push(...next)
    else if(order.get(id)!>last){leaf=id;last=order.get(id)!}
  }
  return workspaceMessagePath({...chat,selectedId:leaf})
}
export function workspaceChatPreview(chat:WorkspaceChat):string {
  const text=chat.messages.find(message=>message.role==='user')?.text??chat.title
  return text.replace(/\s+/g,' ').trim().slice(0,85)
}
