import {WorkspaceSession} from './workspaceSession'
import {WorkspacePersistence} from './workspacePersistence'
import {loadWorkspace,type LoadedWorkspace,type WorkspaceLoaderApi} from './workspaceLoader'
import {WorkspaceActions} from './workspaceActions'
import {createIndependentJobClient} from './independentClient'
import {createCollaborationClient} from './client'
import {individualWorkspaceTransport} from './workspaceIndependentTransport'
import {sharedWorkspaceTransport} from './workspaceSharedTransport'
import {continuousWorkspaceTransport} from './workspaceContinuousTransport'
import {browserJobStore} from './independentJobController'
import {browserAdmissionStore} from './admission'
import {observeWorkspaceJob} from './workspaceRecovery'
import type {WorkspaceChat} from './unifiedWorkspace'
import type {WorkspaceRunTransport,WorkspaceRunRequest} from './workspaceRunner'
import type {SelectionProject} from '../../components/UnifiedWorkspace/WorkspaceDestination'
import {continuousHistoryChat,projectHistoryChat} from './workspaceHistory'
import {registerWorkspaceMoveOwner} from './workspaceMove'
import {watchWorkspaceCompletions} from './workspaceCompletionAlerts'
import {workspaceModelPreferences} from './workspaceModelPreferences'

export async function historyChatId(owner:string,kind:string,id:string){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['hadron-workspace-history',owner,kind,id])))).slice(0,16)
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128
 const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('')
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}

type Native=Pick<ElectronAPI,'workspaceArchive'|'collaboration'|'continuousChat'|'projectDraft'>
export interface DesktopGateway {get<T>(path:string):Promise<T>}
export class DesktopWorkspaceRuntime {
 session!:WorkspaceSession;persistence!:WorkspacePersistence;actions!:WorkspaceActions
 readonly independent;readonly shared
 private loader:WorkspaceLoaderApi
 private observed=new Set<string>()
 private loading=new Map<string,Promise<LoadedWorkspace>>()
 private latestOpen=0
 private detachMover:()=>void
 private detachAlerts?:()=>void
 constructor(readonly owner:string,readonly projectId:string,private native:Native,private gateway:DesktopGateway,private navigate:(chat:WorkspaceChat)=>Promise<void>|void,clients?:{independent:ReturnType<typeof createIndependentJobClient>;shared:ReturnType<typeof createCollaborationClient>}){
  this.independent=clients?.independent??createIndependentJobClient(()=>native.collaboration.capability());this.shared=clients?.shared??createCollaborationClient(()=>native.collaboration.capability())
  this.detachMover=registerWorkspaceMoveOwner(this,{has:id=>!!this.session?.getSnapshot().state.chats[id],save:async id=>{if(this.session.getSnapshot().state.chats[id].jobState!=='idle')throw Error('Wait for this task to finish before moving its chat.');return this.persistence.flush(id)}})
  this.loader={project:id=>gateway.get(`/projects/${encodeURIComponent(id)}`),conversation:id=>gateway.get(`/conversations/${encodeURIComponent(id)}`),messages:id=>gateway.get(`/conversations/${encodeURIComponent(id)}/messages`),archive:id=>native.workspaceArchive.load(id),
   navigation:id=>this.independent.openWorkspace(id),agentTree:(workspace,slot,cursor)=>this.independent.workspace(workspace,slot,undefined,{cursor}),sharedTree:workspace=>this.shared.tree(workspace),sharedStatus:id=>this.shared.status(id),sharedTranscript:(id,agent)=>this.shared.transcript(id,agent),otherHistory:workspace=>this.otherHistory(workspace)}
 }
 private load(id:string){
  const current=this.loading.get(id);if(current)return current
  const pending=loadWorkspace(this.owner,this.projectId,id,this.loader).finally(()=>{this.loading.delete(id)})
  this.loading.set(id,pending);return pending
 }
 private async otherHistory(workspace:string){
  const [continuous,projects]=await Promise.all([this.native.continuousChat.list(workspace),this.native.projectDraft.list(workspace)])
  const saved=[]
  for(const [kind,records] of [['continuous',continuous],['project',projects]] as const)for(const item of [...records].reverse()){
   const id=await historyChatId(this.owner,kind,item.id),existing=await this.native.workspaceArchive.load(id)
   if(existing){saved.push(existing);continue}
   const chat=kind==='continuous'?continuousHistoryChat(this.projectId,await this.native.continuousChat.status(item.id)):projectHistoryChat(this.projectId,await this.native.projectDraft.status(item.id))
   saved.push(await this.native.workspaceArchive.save({...chat,id,nativeWorkspaceId:workspace},0))
  }
  return saved
 }
 async openContinuous(workspace:string,id:string){
  const visit=this.latestOpen
  const view=await this.native.continuousChat.check(workspace,id)
  if(visit!==this.latestOpen)return
  if(!view)throw Error('The saved conversation is unavailable. Its original record was not changed.')
  const canonical=await historyChatId(this.owner,'continuous',id)
  const existing=await this.native.workspaceArchive.load(canonical)
  if(!existing)await this.native.workspaceArchive.save({...continuousHistoryChat(this.projectId,view),id:canonical,nativeWorkspaceId:workspace},0)
  if(visit!==this.latestOpen)return
  const opened=await this.open(canonical);if(!opened)return
  await this.navigate(this.session.getSnapshot().state.chats[canonical])
 }
 async open(id:string){
  const visit=++this.latestOpen
  const cached=this.session?.getSnapshot().state.chats[id]
  if(cached){
   const metadata=await this.loader.conversation(id)
   if(metadata.user_id!==this.owner||String(metadata.project_id)!==this.projectId)throw Error('This chat has moved to another project. Open it from its current project in the sidebar.')
   const project=await this.loader.project?.(this.projectId)
   const instructions=[...new Set([project?.system_prompt,project?.context,metadata.system_prompt,metadata.conversation_context].filter(Boolean))].join('\n\n')||undefined
   if(visit!==this.latestOpen)return null
   if(cached.instructions!==instructions)this.session.dispatch({type:'instructions',chatId:id,text:instructions})
   this.session.dispatch({type:'select-chat',id});await this.restoreFolder(id);return this.session
  }
  const loaded=await this.load(id)
  if(visit!==this.latestOpen)return null
  if(!this.session){
   const transport=this.transport()
   this.session=new WorkspaceSession(this.projectId,id,transport,undefined,loaded.primary,workspaceModelPreferences(this.owner))
   for(const related of loaded.related)this.session.open(related)
   this.session.dispatch({type:'select-chat',id})
   this.persistence=new WorkspacePersistence(this.session,this.native.workspaceArchive,loaded.archived)
   this.detachAlerts=watchWorkspaceCompletions(this.session)
   this.actions=new WorkspaceActions({session:this.session,persistence:this.persistence,api:this.native.workspaceArchive,load:async destination=>{
    const metadata=await this.loader.conversation(destination)
    if(metadata.user_id!==this.owner||!metadata.project_id)throw Error('Choose one of your saved chats')
    const saved=await this.native.workspaceArchive.load(destination)
    if(saved)return saved
    const loaded=await loadWorkspace(this.owner,String(metadata.project_id),destination,this.loader)
    return this.native.workspaceArchive.save(loaded.primary,0)
   },open:async chat=>{if(chat.projectId===this.projectId)this.session.open(chat);await this.navigate(chat)}})
  }else{
   for(const related of loaded.related)this.session.open(related)
   this.session.open(loaded.primary)
   loaded.archived.forEach(saved=>this.persistence.accept(saved))
  }
  // Reopening attaches observers to saved work; no transport.start is invoked.
  for(const chat of Object.values(this.session.getSnapshot().state.chats))if(chat.jobState!=='idle'&&chat.nativeJob&&!this.observed.has(chat.id)){
   this.observed.add(chat.id);observeWorkspaceJob(this.session,chat.id,{independent:this.independent,shared:this.shared,continuous:this.native.continuousChat,project:this.native.projectDraft})
  }
  await this.restoreFolder(id)
  return this.session
 }
 private async restoreFolder(id:string){
  const chat=this.session.getSnapshot().state.chats[id]
  if(!chat||chat.folder||chat.folderDetached||chat.jobState!=='idle'||!this.native.collaboration.projectRestore)return
  const workspaceId=chat.nativeWorkspaceId??id,slot=chat.folderBookmarkSlot??(chat.workType==='individual'?chat.agent:chat.workType==='together'?'shared':'continuous')
  try{const grant=await this.native.collaboration.projectRestore(workspaceId,slot);if(grant)this.session.dispatch({type:'folder',chatId:id,folder:{...grant,workspaceId,slot}})}catch{/* A missing or replaced folder must be selected again. */}
 }
 private transport():WorkspaceRunTransport{
  return {create:(request,changed)=>{
   const workspace=request.nativeWorkspaceId??request.chatId,checkpoint=async()=>{await this.persistence.flush(request.chatId)}
   let identified=false,started=false,stopped=false
   const render:typeof changed=event=>{if(event.nativeJob)identified=true;changed(event)}
   const agentAccess=(input:WorkspaceRunRequest)=>this.native.collaboration.projectAgent(workspace,input.workType==='individual'?input.agent:'shared',input.folder!.id)
   const common={workspaceId:workspace,agentAccess,releaseAgent:(id:string)=>this.native.collaboration.agentRevoke(id),checkpoint}
   const transport=request.workType==='individual'?individualWorkspaceTransport({...common,client:this.independent,store:()=>browserJobStore(workspace,request.agent,`unified:${request.chatId}`)}):request.workType==='together'?sharedWorkspaceTransport({...common,client:this.shared,store:()=>browserAdmissionStore(workspace,`unified:${request.chatId}`)}):continuousWorkspaceTransport({workspaceId:workspace,api:this.native.continuousChat,checkpoint,anchor:async input=>(await this.shared.prepareTask(input.id,workspace,input.question.text,'continuous')).anchorMessageId,remember:()=>{}})
   // Local construction validates context before the composer is cleared.
   const handle=transport.create(request,render)
   return {
    start:async()=>{
     try{
      await checkpoint()
      if(stopped)return
      if(request.folder){
       const source=request.folder.slot??request.agent,target=request.workType==='individual'?request.agent:request.workType==='together'?'shared':'continuous'
       if(request.folder.workspaceId&&request.folder.workspaceId!==workspace)throw Error('Attach this chat’s project folder again before sending.')
       const grant=await this.native.collaboration.projectUse(workspace,source,request.folder.id,target)
       request.folder={...grant,slot:target,workspaceId:workspace}
      }
      if(stopped)return
      started=true;await handle.start()
     }catch(error){
      if(!identified)changed({text:'This task was not sent.',state:'failed',error:error instanceof Error?error.message:'Check the folder and connection, then try again.'})
      else throw error
     }
    },
    stop:async()=>{stopped=true;if(started)await handle.stop();else changed({text:'Stopped before the task was sent.',state:'stopped'})},
    recover:()=>handle.recover(),dispose:()=>handle.dispose(),
   }
  }}
 }
 async chooseFolder(chat:WorkspaceChat,mode:'add'|'replace'='add'):Promise<WorkspaceChat['folder']|null>{
  if(chat.jobState!=='idle')throw Error('Wait for this reply to finish before changing its folder.')
  const workspaceId=chat.nativeWorkspaceId??chat.id,slot=chat.workType==='individual'?chat.agent:chat.workType==='continuous'?'continuous':'shared'
  if(Object.values(this.session.getSnapshot().state.chats).some(other=>other.id!==chat.id&&other.jobState!=='idle'&&(other.nativeWorkspaceId??other.id)===workspaceId&&(chat.workType!=='individual'||other.workType!=='individual'||other.agent===chat.agent)))throw Error('This agent is using its folder in another chat. Wait for that task to finish before changing the folder.')
  // Ensure newly created A/B chats exist before requesting a native grant.
  await this.persistence.flush(chat.id)
  const grant=await this.native.collaboration.projectSelect(workspaceId,slot,{mode,existingId:chat.folder?.id,source:chat.folder?.slot??slot})
  return grant?{...grant,workspaceId,slot}:null
 }
 async removeFolder(chat:WorkspaceChat,index?:number):Promise<WorkspaceChat['folder']|null>{
  if(chat.jobState!=='idle')throw Error('Wait for this reply to finish before changing its folders.')
  if(!chat.folder)return null
  const workspaceId=chat.nativeWorkspaceId??chat.id,slot=chat.workType==='individual'?chat.agent:chat.workType==='continuous'?'continuous':'shared'
  if(Object.values(this.session.getSnapshot().state.chats).some(other=>other.id!==chat.id&&other.jobState!=='idle'&&(other.nativeWorkspaceId??other.id)===workspaceId&&(chat.workType!=='individual'||other.workType!=='individual'||other.agent===chat.agent)))throw Error('Wait for the other task using this folder to finish.')
  await this.persistence.flush(chat.id)
  const paths=chat.folder.paths??[chat.folder.label],indexes=index===undefined?[]:paths.map((_,i)=>i).filter(i=>i!==index)
  const grant=await this.native.collaboration.projectRetain(workspaceId,chat.folder.slot??slot,chat.folder.id,slot,indexes)
  return grant?{...grant,workspaceId,slot}:null
 }
 async projects():Promise<SelectionProject[]>{
  const [projects,chats]=await Promise.all([this.gateway.get<Array<{id:string;name:string;storage_mode?:string}>>(`/projects?userId=${encodeURIComponent(this.owner)}`),this.gateway.get<Array<{id:string;project_id:string;title:string|null;storage_mode?:string}>>(`/conversations?userId=${encodeURIComponent(this.owner)}`)])
  return projects.filter(project=>project.storage_mode!=='cloud').map(project=>({id:String(project.id),title:project.name,chats:chats.filter(chat=>String(chat.project_id)===String(project.id)&&chat.storage_mode!=='cloud').map(chat=>({id:String(chat.id),title:chat.title??'Untitled chat'}))}))
 }
 async reload(id:string,selectLatest=false){
  const current=this.session?.getSnapshot().state.chats[id]
  if(!current||current.jobState!=='idle')return
  await this.persistence.synchronize(id,async()=>{
   const saved=await this.native.workspaceArchive.load(id);if(!saved)return
   this.session.dispatch({type:'replace-messages',chatId:id,messages:saved.chat.messages,selectedId:saved.chat.selectedId,select:selectLatest})
   this.persistence.accept(saved)
  })
 }
 dispose(){this.detachAlerts?.();this.detachMover();this.persistence?.dispose();this.session?.dispose()}
}
