import type {ArchivedChat,MessageExcerpts,NewSelectionDestination,WorkspaceArchive} from '../../../server/hadronTools/workspaceArchive'
import type {SelectionDestination} from '../../components/UnifiedWorkspace/WorkspaceDestination'
import type {WorkspaceChat} from './unifiedWorkspace'
import type {WorkspaceSession} from './workspaceSession'
import type {WorkspacePersistence} from './workspacePersistence'

export interface ConversationSelection {chatId:string;ids:string[];excerpts?:MessageExcerpts}
type TransferResult=ReturnType<WorkspaceArchive['copy']>
export interface WorkspaceActionApi {
 copy(input:Parameters<WorkspaceArchive['copy']>[1]):Promise<TransferResult>;
 copyNew(input:NewSelectionDestination):Promise<TransferResult>;
 trash(id:string,ids:string[],revision:number,excerpts?:MessageExcerpts):Promise<ReturnType<WorkspaceArchive['trash']>>;
 note(id:string,ids:string[],text:string,revision:number):Promise<ArchivedChat>;
}
/** Connects the contextual actions to the authoritative native archive. No
 * inference dispatch is reachable here; cross-project navigation follows save. */
export class WorkspaceActions {
 constructor(private deps:{session:WorkspaceSession;persistence:WorkspacePersistence;api:WorkspaceActionApi;
  load(id:string):Promise<ArchivedChat>;open(chat:WorkspaceChat):Promise<void>|void;
 }){}
 private apply(saved:ArchivedChat,select=false){
  const existing=this.deps.session.getSnapshot().state.chats[saved.chat.id]
  if(existing)this.deps.session.dispatch({type:'replace-messages',chatId:saved.chat.id,messages:saved.chat.messages,selectedId:saved.chat.selectedId,select})
  this.deps.persistence.accept(saved)
 }
 async transfer(selection:ConversationSelection,destination:SelectionDestination,move:boolean,operationId:string){
  const local=this.deps.session.getSnapshot().state.chats
  const destinationId='chatId' in destination?destination.chatId:undefined
  if(destinationId===selection.chatId)throw Error('Choose another chat for this selection.')
  // A destination outside this session is loaded through the owned canonical
  // loader. It is not opened until the native transaction has succeeded.
  const external=destinationId&&!local[destinationId]?await this.deps.load(destinationId):undefined
  const ids=[selection.chatId,...(destinationId&&local[destinationId]?[destinationId]:[])]
  return this.deps.persistence.mutate(ids,async saved=>{
   const source=saved.get(selection.chatId)!
   const common={id:operationId,source:selection.chatId,sourceRevision:source.revision,ids:selection.ids,excerpts:selection.excerpts,move}
   const target=destinationId?saved.get(destinationId)??external:undefined
   const result=target?await this.deps.api.copy({...common,destination:target.chat.id,destinationRevision:target.revision,parentId:target.chat.selectedId}):await this.deps.api.copyNew({...common,...destination} as NewSelectionDestination)
   if(result.source)this.apply(result.source)
   this.apply(result.destination,true)
   await this.deps.open(result.destination.chat)
   return result
  })
 }
 async remove(selection:ConversationSelection){
  return this.deps.persistence.mutate([selection.chatId],async saved=>{
   const result=await this.deps.api.trash(selection.chatId,selection.ids,saved.get(selection.chatId)!.revision,selection.excerpts)
   this.apply(result);this.deps.session.selection(selection.chatId,[]);return result
  })
 }
 async note(selection:ConversationSelection,text:string){
  return this.deps.persistence.mutate([selection.chatId],async saved=>{
   const result=await this.deps.api.note(selection.chatId,selection.ids,text,saved.get(selection.chatId)!.revision)
   this.apply(result);return result
  })
 }
}
