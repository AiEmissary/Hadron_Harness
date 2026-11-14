import type {ArchivedChat} from '../../../server/hadronTools/workspaceArchive'
import type {WorkspaceChat} from './unifiedWorkspace'
import type {WorkspaceSession} from './workspaceSession'

export interface WorkspaceArchiveClient {
 load(id:string):Promise<ArchivedChat|null>;
 save(chat:WorkspaceChat,revision:number):Promise<ArchivedChat>;
}
/** Save each chat in order, independently. A stream in A cannot hold B's Send
 * behind an endless global flush. Explicit task dispatch waits for its checkpoint. */
export class WorkspacePersistence {
 private saved=new Map<string,ArchivedChat>()
 private persisted=new Map<string,WorkspaceChat>()
 private pending=new Map<string,WorkspaceChat>()
 private chains=new Map<string,Promise<ArchivedChat>>()
 private errors=new Map<string,string>()
 private paused=new Set<string>()
 private mutation:Promise<unknown>=Promise.resolve()
 private timer?:ReturnType<typeof setTimeout>
 private unsubscribe:()=>void
 constructor(private session:WorkspaceSession,private api:WorkspaceArchiveClient,initial:ArchivedChat[]=[],private delayMs=250){
  for(const item of initial){this.saved.set(item.chat.id,item);this.persisted.set(item.chat.id,session.getSnapshot().state.chats[item.chat.id])}
  this.unsubscribe=session.subscribe(()=>this.capture())
 }
 private capture(){
  for(const chat of Object.values(this.session.getSnapshot().state.chats))if(chat!==this.persisted.get(chat.id))this.pending.set(chat.id,chat)
  if(this.timer)clearTimeout(this.timer)
  this.timer=setTimeout(()=>{this.timer=undefined;for(const id of this.pending.keys())if(!this.paused.has(id))void this.flush(id).catch(()=>{})},this.delayMs)
 }
 accept(saved:ArchivedChat){
  this.saved.set(saved.chat.id,saved)
  const chat=this.session.getSnapshot().state.chats[saved.chat.id]
  this.persisted.set(saved.chat.id,saved.chat)
  if(chat)this.pending.set(chat.id,chat)
 }
 revision(id:string){return this.saved.get(id)?.revision??0}
 flush(id:string):Promise<ArchivedChat>{
  if(this.paused.has(id))return Promise.reject(Error('Finishing this chat transfer. Try sending again when it completes.'))
  const snapshot=this.session.getSnapshot().state.chats[id]
  if(!snapshot)return Promise.reject(Error('Chat is unavailable'))
  const previous=this.chains.get(id)
  const result=(previous?.catch(()=>{})??Promise.resolve()).then(async()=>{
   const known=this.saved.get(id)
   if(this.persisted.get(id)===snapshot&&known)return known
   try{
    const saved=await this.api.save({...snapshot,peerChats:{...this.session.getSnapshot().state.agentChats}},known?.revision??0)
    this.saved.set(id,saved);this.persisted.set(id,snapshot)
    if(this.pending.get(id)===snapshot)this.pending.delete(id)
    const error=this.errors.get(id)
    if(error&&this.session.getSnapshot().errors[id]===error)this.session.error(id,null)
    this.errors.delete(id);return saved
   }catch(error){
    const message='This chat could not be saved. '+(error instanceof Error?error.message:'Try reopening the saved chat.')
    this.errors.set(id,message);this.session.error(id,message);throw error
   }
  })
  this.chains.set(id,result)
  void result.finally(()=>{if(this.chains.get(id)===result)this.chains.delete(id)}).catch(()=>{})
  return result
 }
 async flushAll(){await Promise.all(Object.keys(this.session.getSnapshot().state.chats).map(id=>this.flush(id)))}
 /** Fence local autosaves/dispatch while a native transaction changes messages.
  * Drafts may still be typed, and are checkpointed after the transaction. */
 mutate<T>(ids:string[],work:(saved:Map<string,ArchivedChat>)=>Promise<T>):Promise<T>{
  const unique=[...new Set(ids)]
  const result=this.mutation.catch(()=>{}).then(async()=>{
   const saved=await Promise.all(unique.map(id=>this.flush(id)))
   unique.forEach(id=>this.paused.add(id))
   try{return await work(new Map(saved.map(item=>[item.chat.id,item])))}
   finally{unique.forEach(id=>this.paused.delete(id));this.capture()}
  })
  this.mutation=result;return result
 }
 synchronize<T>(id:string,readAndApply:()=>Promise<T>):Promise<T>{
  const result=this.mutation.catch(()=>{}).then(async()=>{
   this.paused.add(id)
   try{await this.chains.get(id)?.catch(()=>{});return await readAndApply()}
   finally{this.paused.delete(id);this.capture()}
  })
  this.mutation=result;return result
 }
 dispose(){this.unsubscribe();if(this.timer)clearTimeout(this.timer)}
}
