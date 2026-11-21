import {useSyncExternalStore,type ReactNode} from 'react'
import type {ParticipantOption} from '../../features/collaboration/setup'
import type {WorkspaceChat} from '../../features/collaboration/unifiedWorkspace'
import type {WorkspaceSession} from '../../features/collaboration/workspaceSession'
import {UnifiedChatSurface,type MessageAction,type MessageExcerpts} from './UnifiedChatSurface'

export interface UnifiedWorkspaceProps {
 session:WorkspaceSession;disabled?:boolean;providers:ReadonlyArray<ParticipantOption>;help:ReactNode;connections?:ReactNode;reasoningControl?:ReactNode;
 attachFiles(chat:WorkspaceChat):Promise<void>;chooseFolder(chat:WorkspaceChat):Promise<WorkspaceChat['folder']|null>;
 messageAction(chat:WorkspaceChat,action:MessageAction,ids:string[],excerpts?:MessageExcerpts):void;
}
/** All modes share this component. Folder picking never changes the chosen Chat/Agent permission. */
export function UnifiedWorkspace(props:UnifiedWorkspaceProps){
 const {session}=props,snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot),state=snapshot.state,chat=state.chats[state.activeChatId]
 const safely=(work:()=>void)=>{try{work()}catch(error){session.error(chat.id,error instanceof Error?error.message:'This action could not be completed.')}}
 const folder=async()=>{
  const id=chat.id
  try{
   const selected=await props.chooseFolder(chat)
   if(selected)session.dispatch({type:'folder',chatId:id,folder:selected})
  }catch(error){session.error(id,error instanceof Error?error.message:'The folder could not be attached.')}
 }
 const files=async()=>{try{await props.attachFiles(chat)}catch(error){session.error(chat.id,error instanceof Error?error.message:'Files could not be attached.')}}
 const agents=chat.workType==='individual'?[chat.agent]:['a','b'] as const
 const canBranch=!props.disabled&&chat.jobState==='idle'&&agents.every(agent=>{
  const model=chat.models[agent],provider=props.providers.find(item=>item.provider===model?.provider)
  return provider?.connected&&provider.models.some(item=>item.id===model?.modelName)
 })
 return <UnifiedChatSurface chat={chat} providers={props.providers} help={props.help} connections={props.connections} reasoningControl={props.reasoningControl}
  error={snapshot.errors[chat.id]??undefined} canSend={canBranch&&!!chat.draft.trim()} canBranch={canBranch} onBranch={(messageId,text)=>session.branch(chat.id,messageId,text)} selectedIds={snapshot.selections[chat.id]}
  onDraft={text=>session.dispatch({type:'draft',chatId:chat.id,text})} onSend={()=>void session.send()} onStop={()=>void session.stop(chat.id)}
  onConfigure={next=>safely(()=>session.dispatch({type:'configure',chatId:chat.id,...next}))}
  onFile={()=>void files()} onFolder={()=>void folder()}
  onLatest={id=>{const last=id?chat.messages.find(message=>message.id===id):chat.messages.at(-1);if(last)session.dispatch({type:'select-message',chatId:chat.id,id:last.id});session.dispatch({type:'follow-updates',chatId:chat.id,value:true})}}
  onRemoveFile={id=>session.dispatch({type:'attachments',chatId:chat.id,files:(chat.attachments??[]).filter(file=>file.id!==id)})}
  onSelect={(id,multiple)=>safely(()=>session.select(id,multiple))} onSelection={ids=>safely(()=>session.selection(chat.id,ids))}
  onMessageAction={(action,ids,excerpts)=>props.messageAction(chat,action,ids,excerpts)}
  onScroll={(top,following)=>session.dispatch({type:'scroll',chatId:chat.id,top,following})}/>
}
