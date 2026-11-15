import {initialUnifiedWorkspace,unifiedWorkspaceReducer,workspaceModelsWithDefaults,type UnifiedWorkspaceState,type UnifiedWorkspaceAction,type WorkspaceChat} from './unifiedWorkspace'
import {WorkspaceRunner,type WorkspaceRunTransport} from './workspaceRunner'
import type {WorkspaceModelPreferences} from './workspaceModelPreferences'

export interface WorkspaceSnapshot {state:UnifiedWorkspaceState;errors:Record<string,string|null>;selections:Record<string,ReadonlySet<string>>}
/** Synchronous state ownership prevents double Send and stale async events from crossing chats. */
export class WorkspaceSession {
 private snapshot:WorkspaceSnapshot
 private listeners=new Set<()=>void>()
 private readonly runner:WorkspaceRunner
 private recovered=new Map<string,{stop():Promise<void>;recover():Promise<void>;dispose():void}>()
 constructor(projectId:string,chatId:string,transport:WorkspaceRunTransport,id:()=>string=()=>crypto.randomUUID(),initialChat?:WorkspaceChat,private modelPreferences?:WorkspaceModelPreferences){
  const models={...initialChat?.models,...modelPreferences?.load()}
  const state=initialUnifiedWorkspace(projectId,chatId,models)
  if(initialChat){if(initialChat.id!==chatId||initialChat.projectId!==projectId)throw Error('Saved chat identity changed');state.chats[chatId]=workspaceModelsWithDefaults(initialChat,models);state.agentChats=initialChat.workType==='individual'?{[initialChat.agent]:chatId}:{}}
  if(Object.keys(models).length)modelPreferences?.save(models)
  this.snapshot={state,errors:{},selections:{}}
  this.runner=new WorkspaceRunner({getState:()=>this.snapshot.state,dispatch:action=>this.dispatch(action),transport,id,error:(chatId,error)=>this.error(chatId,error)})
 }
 getSnapshot=()=>this.snapshot
 startedHere(chatId:string,id:string){return this.runner.startedHere(chatId,id)}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 private emit(){for(const listener of this.listeners)listener()}
 dispatch(action:UnifiedWorkspaceAction){
  const previous=this.snapshot.state
  const defaults=this.modelPreferences?.load()
  const state=defaults?{...previous,modelDefaults:{...previous.modelDefaults,...defaults}}:previous
  const next=unifiedWorkspaceReducer(state,action)
  if(JSON.stringify(next.modelDefaults)!==JSON.stringify(defaults??previous.modelDefaults))this.modelPreferences?.save(next.modelDefaults)
  this.snapshot={...this.snapshot,state:next};this.emit()
 }
 error(chatId:string,error:string|null){this.snapshot={...this.snapshot,errors:{...this.snapshot.errors,[chatId]:error}};this.emit()}
 open(chat:WorkspaceChat){this.dispatch({type:'open',chat})}
 select(id:string,multiple=false){
  const chatId=this.snapshot.state.activeChatId
  const selected=new Set(multiple?this.snapshot.selections[chatId]:[])
  if(multiple){if(selected.has(id))selected.delete(id);else selected.add(id)}
  else this.dispatch({type:'select-message',chatId,id})
  this.selection(chatId,selected)
 }
 selection(chatId:string,ids:Iterable<string>){
  const messages=this.snapshot.state.chats[chatId]?.messages
  if(!messages)throw Error('Chat is unavailable')
  const selected=new Set(ids)
  if([...selected].some(id=>!messages.some(message=>message.id===id)))throw Error('Selected message is unavailable')
  this.snapshot={...this.snapshot,selections:{...this.snapshot.selections,[chatId]:selected}};this.emit()
 }
 async send(){
  const chatId=this.snapshot.state.activeChatId
  try{await this.runner.send()}catch(error){this.error(chatId,error instanceof Error?error.message:'The message could not be sent.')}
 }
 async branch(chatId:string,messageId:string,text:string):Promise<boolean>{
  try{await this.runner.send({chatId,messageId,text});return true}
  catch(error){this.error(chatId,error instanceof Error?error.message:'The branch could not be sent.');return false}
 }
 attachRecovery(chatId:string,control:{stop():Promise<void>;recover():Promise<void>;dispose():void}){this.recovered.get(chatId)?.dispose();this.recovered.set(chatId,control)}
 endRecovery(chatId:string){this.recovered.get(chatId)?.dispose();this.recovered.delete(chatId)}
 stop(chatId=this.snapshot.state.activeChatId){return this.recovered.get(chatId)?.stop()??this.runner.stop(chatId)}
 recover(chatId=this.snapshot.state.activeChatId){return this.recovered.get(chatId)?.recover()??this.runner.recover(chatId)}
 dispose(){this.runner.dispose();for(const control of this.recovered.values())control.dispose();this.recovered.clear();this.listeners.clear()}
}
