import type {BaseMessage} from '../../../../../shared/types'
import type {AgentConversationTree,AgentWorkspaceNavigation} from '../../../../../shared/independentJobs'
import type {ProposalSessionStatus} from '../../../../../shared/collaboration'
import type {ArchivedChat} from '../../../server/hadronTools/workspaceArchive'
import {agentHistoryChats,sharedHistoryChat,workspaceReplyState} from './workspaceHistory'
import {blankWorkspaceChat,type WorkspaceChat,type WorkspaceMessage} from './unifiedWorkspace'
import {workspaceSharedFailureText} from './workspaceSharedFailure'

export interface WorkspaceConversation {id:string;project_id?:string|null;user_id:string;title:string|null;storage_mode?:string;system_prompt?:string|null;conversation_context?:string|null}
export interface WorkspaceLoaderApi {
 project?(id:string):Promise<{id:string;user_id:string;context?:string|null;system_prompt?:string|null}>;
 conversation(id:string):Promise<WorkspaceConversation>;messages(id:string):Promise<BaseMessage[]>;
 archive(id:string):Promise<ArchivedChat|null>;navigation(id:string):Promise<AgentWorkspaceNavigation>;
 agentTree(workspace:string,slot:'a'|'b',cursor?:string):Promise<AgentConversationTree>;
 sharedTree(workspace:string):Promise<{nodes:AgentConversationTree['nodes']}>;
 sharedStatus?(id:string):Promise<ProposalSessionStatus>;sharedTranscript?(id:string,agent:string):Promise<{text:string}>;
 otherHistory?(workspace:string):Promise<ArchivedChat[]>;
}
export interface LoadedWorkspace {primary:WorkspaceChat;related:WorkspaceChat[];archived:ArchivedChat[]}

/** Preserve the original IDs and topology while skipping internal tool/system
 * rows. A failed read aborts opening; it never manufactures a blank replacement. */
export function legacyWorkspaceMessages(rows:BaseMessage[]):WorkspaceMessage[]{
 const all=new Map(rows.map(row=>[String(row.id),row]))
 if(all.size!==rows.length)throw Error('Saved chat has duplicate message identities')
 for(const row of rows){let current=row;const seen=new Set<string>();while(current.parent_id){if(seen.has(String(current.id)))throw Error('Saved chat contains a branch cycle');seen.add(String(current.id));const parent=all.get(String(current.parent_id));if(!parent)throw Error('Saved branch parent is missing');current=parent}}
 const visible=rows.filter(row=>['user','assistant','ex_agent'].includes(row.role)&&!isInternal(row))
 const kept=new Set(visible.map(row=>String(row.id)))
 return visible.map(row=>{
  let parent=row.parent_id?String(row.parent_id):null;const seen=new Set([String(row.id)])
  while(parent&&!kept.has(parent)){
   if(seen.has(parent))throw Error('Saved chat contains a branch cycle')
   seen.add(parent);const ancestor=all.get(parent);if(!ancestor)throw Error('Saved branch parent is missing')
   parent=ancestor.parent_id?String(ancestor.parent_id):null
  }
  return {id:String(row.id),parentId:parent,role:row.role==='user'?'user':'assistant',agent:'a',text:row.content_plain_text??(row as any).plain_text_content??row.content??'',state:row.partial?'stopped':'completed',modelName:row.model_name??undefined,note:row.note??undefined}
 })
}
function isInternal(row:BaseMessage){
 let meta:Record<string,unknown>|null=null
 try{meta=typeof row.meta==='string'?JSON.parse(row.meta):row.meta??null}catch{/* Old free-text metadata is not permission or routing. */}
 return !!(meta?.hadronSharedTask||meta?.hadronIndependentJob||meta?.hadronSharedProposal||meta?.kind==='context_injection')
}
export async function loadWorkspace(owner:string,projectId:string,id:string,api:WorkspaceLoaderApi):Promise<LoadedWorkspace>{
 const metadata=await api.conversation(id)
 if(String(metadata.id)!==id||metadata.user_id!==owner||String(metadata.project_id)!==projectId||metadata.storage_mode==='cloud')throw Error('Choose a saved chat in one of your local projects.')
 const project=await api.project?.(projectId)
 if(project&&(String(project.id)!==projectId||project.user_id!==owner))throw Error('Project instructions belong to another account')
 const instructions=[...new Set([project?.system_prompt,project?.context,metadata.system_prompt,metadata.conversation_context].filter(Boolean))].join('\n\n')||undefined
 const existing=await api.archive(id)
 if(existing){
  existing.chat.title=metadata.title??existing.chat.title
  existing.chat.instructions=instructions
  if(existing.chat.projectId!==projectId)throw Error('Saved project identity changed')
  const peers=await Promise.all([...new Set(Object.values(existing.chat.peerChats??{}))].filter(peer=>peer!==id).map(peer=>api.archive(peer)))
  const saved=peers.filter((peer):peer is ArchivedChat=>!!peer&&peer.chat.projectId===projectId)
  const available=new Set([id,...saved.map(peer=>peer.chat.id)])
  existing.chat.peerChats=Object.fromEntries(Object.entries(existing.chat.peerChats??{}).filter(([,peer])=>available.has(peer)))
  return {primary:existing.chat,related:saved.map(peer=>peer.chat),archived:[existing,...saved]}
 }
 const navigation=await api.navigation(id),workspace=navigation.workspaceConversationId
 const raw=await api.messages(id),primary=blankWorkspaceChat(projectId,id)
 primary.title=metadata.title??'';primary.nativeWorkspaceId=workspace
 primary.instructions=instructions
 primary.messages=legacyWorkspaceMessages(raw);primary.selectedId=primary.messages.at(-1)?.id??null
 const archived:ArchivedChat[]=[],related:WorkspaceChat[]=[]
 if(navigation.historicalOnly)return {primary,related,archived}
 const readAgent=async(slot:'a'|'b')=>{
  const nodes=new Map<string,AgentConversationTree['nodes'][number]>(),pages:AgentConversationTree['nodes'][]=[],cursors=new Set<string>()
  let cursor:string|undefined
  do{
   const page=await api.agentTree(workspace,slot,cursor)
   pages.unshift(page.nodes);for(const node of page.nodes)nodes.set(node.id,node)
   if(nodes.size>10000)throw Error('This workspace has more than 10,000 saved branch messages.')
   cursor=page.page?.nextCursor??undefined
   if(cursor&&cursors.has(cursor))throw Error('Saved history paging did not advance')
   if(cursor)cursors.add(cursor)
  }while(cursor)
  return agentHistoryChats(projectId,{schemaVersion:1,sourceConversationId:workspace,slot,nodes:[...new Map(pages.flat().map(node=>[node.id,node])).values()]})
 }
 const results=await Promise.allSettled([readAgent('a'),readAgent('b'),api.sharedTree(workspace)])
 for(const result of results)if(result.status==='rejected')throw Error('Saved agent history could not be loaded. '+(result.reason instanceof Error?result.reason.message:'Try opening this chat again.'))
 const agentChats=(results.slice(0,2) as PromiseFulfilledResult<WorkspaceChat[]>[]).flatMap(result=>result.value)
 for(const projected of agentChats){
  const canonical=projected.id.slice(`agent:${projected.agent}:`.length)
  const [saved,canonicalMetadata]=await Promise.all([api.archive(canonical),api.conversation(canonical)])
  if(canonicalMetadata.user_id!==owner||String(canonicalMetadata.project_id)!==projectId)throw Error('Saved agent chat belongs to another project or account')
  const chat=saved?.chat??{...projected,id:canonical,title:canonicalMetadata.title??projected.title,nativeWorkspaceId:workspace}
  if(saved)archived.push(saved)
  if(canonical===id){Object.assign(primary,chat,{title:metadata.title??chat.title,instructions:primary.instructions})}
  else related.push(chat)
 }
 if(navigation.slot&&!agentChats.some(chat=>chat.id===`agent:${navigation.slot}:${id}`))throw Error('The selected saved agent branch could not be found. Its original chat has not been changed.')
 if(!navigation.slot){
  if(api.otherHistory){const other=await api.otherHistory(workspace);archived.push(...other);related.push(...other.map(saved=>saved.chat))}
  const shared=(results[2] as PromiseFulfilledResult<{nodes:AgentConversationTree['nodes']}>).value
  if(shared.nodes.length){
   const projected=sharedHistoryChat(projectId,workspace,shared.nodes)
   primary.messages=[...primary.messages,...projected.messages];primary.selectedId=projected.selectedId;primary.workType='together'
   primary.jobId=projected.jobId;primary.jobState=projected.jobState;primary.nativeJob=projected.nativeJob
   if(api.sharedStatus){
    const tasks=shared.nodes.filter(node=>node.kind==='task')
    for(const task of tasks){
     const sessionId=task.jobId.replace(/^shared:/,''),answerId=`shared-answer:${sessionId}`
     const hasAnswer=primary.messages.some(message=>message.id===answerId)
     if(hasAnswer&&task!==tasks.at(-1))continue
     const status=await api.sharedStatus(sessionId)
     if(task===tasks.at(-1))for(const participant of status.participants)primary.models[participant.id]={provider:participant.provider,modelName:participant.modelName}
     if(hasAnswer)continue
     const final=status.collaboration?.stages.find(stage=>stage.id==='final')
     const replies=api.sharedTranscript?await Promise.allSettled(status.participants.filter(participant=>participant.runId).map(async participant=>({agent:participant.id,text:(await api.sharedTranscript!(sessionId,participant.id)).text}))):[]
     const partial=replies.flatMap(result=>result.status==='fulfilled'&&result.value.text?[`Agent ${result.value.agent.toUpperCase()}\n${result.value.text}`]:[]).join('\n\n')
     const ended=['completed','cancelled','failed','interrupted'].includes(status.status)
     const text=final?.text||(ended?workspaceSharedFailureText(status,partial):partial)
     const message:WorkspaceMessage={id:answerId,parentId:task.id,role:'assistant',agent:'both',text,state:ended&&status.status==='completed'&&!final?.text?'failed':workspaceReplyState(status.status),origin:{kind:'shared',id:sessionId,nodeId:final?.id??sessionId}}
     const questionIndex=primary.messages.findIndex(message=>message.id===task.id);primary.messages.splice(questionIndex+1,0,message)
     if(task===tasks.at(-1))primary.selectedId=answerId
    }
   }
  }
 }
 return {primary,related,archived}
}
