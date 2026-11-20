import {parseHadronImages} from '../../../../shared/hadronImages.js'
import {createHash,randomUUID} from 'node:crypto'
import type {WorkspaceChat,WorkspaceMessage} from '../../src/features/collaboration/unifiedWorkspace.js'
import {isHadronProvider} from '../../../../shared/hadronProviders.js'
import {RETENTION_MS,type RecycleEntry} from './recycleBin.js'

interface Database {exec(sql:string):unknown;prepare(sql:string):any}
interface Stored {owner:string;project:string;revision:number;body:string}
export type MessageExcerpts=Record<string,{start:number;end:number;text:string}>
interface Removed {messages:WorkspaceMessage[];positions:Array<{id:string;index:number}>;rewired:Array<{id:string;before:string|null;after:string|null}>;textEdits?:Array<{before:WorkspaceMessage;afterText:string;removedText:string}>}
export interface ArchivedChat {revision:number;chat:WorkspaceChat}
export interface NewSelectionDestination {id:string;source:string;ids:string[];sourceRevision:number;move?:boolean;projectId?:string;projectName?:string;title:string;excerpts?:MessageExcerpts}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Local conversation state, separate from original native histories. No folder
 * token is persisted. A saved job identity is a recovery reference, never a launch. */
export class WorkspaceArchive {
 constructor(private readonly db:Database,private readonly authorize:(owner:string,project:string,chat:string,create?:boolean)=>void,private readonly now=()=>Date.now(),private readonly written:(owner:string,chat:WorkspaceChat)=>void=()=>{},private readonly currentProject?:(owner:string,chat:string)=>string|undefined,private readonly available?:(owner:string,chat:string)=>boolean){
  db.exec(`CREATE TABLE IF NOT EXISTS hadron_workspace_chats(id TEXT PRIMARY KEY,owner TEXT NOT NULL,project TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,preview TEXT NOT NULL DEFAULT '');
   CREATE TABLE IF NOT EXISTS hadron_workspace_copies(id TEXT PRIMARY KEY,owner TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS hadron_workspace_bin(id TEXT PRIMARY KEY,owner TEXT NOT NULL,chat TEXT NOT NULL,title TEXT NOT NULL,deleted_at INTEGER NOT NULL,payload TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS hadron_workspace_destinations(id TEXT PRIMARY KEY,owner TEXT NOT NULL,fingerprint TEXT NOT NULL,source TEXT NOT NULL,destination TEXT NOT NULL,initial_revision INTEGER NOT NULL);`)
  if(!db.prepare('PRAGMA table_info(hadron_workspace_chats)').all().some((column:{name:string})=>column.name==='preview'))db.exec("ALTER TABLE hadron_workspace_chats ADD COLUMN preview TEXT NOT NULL DEFAULT ''")
 }
 private transaction<T>(work:()=>T):T{
  const name='workspace_'+randomUUID().replaceAll('-','');this.db.exec(`SAVEPOINT ${name}`)
  try{const result=work();this.db.exec(`RELEASE ${name}`);return result}
  catch(error){this.db.exec(`ROLLBACK TO ${name}`);this.db.exec(`RELEASE ${name}`);throw error}
 }
 private clean(value:WorkspaceChat):WorkspaceChat{
  if(!value||typeof value.id!=='string'||!value.id||value.id.length>160||typeof value.projectId!=='string'||!value.projectId||value.projectId.length>160||
   typeof value.title!=='string'||value.title.length>1000||!['individual','together','continuous'].includes(value.workType)||!['chat','agent'].includes(value.permission)||!['a','b'].includes(value.agent)||
   typeof value.draft!=='string'||value.draft.length>16000||!Number.isSafeInteger(value.maxTurns)||value.maxTurns<1||value.maxTurns>100||!Array.isArray(value.messages)||value.messages.length>10000)throw Error('Invalid saved conversation')
  const messages=value.messages.map(message=>{
   if(!message||typeof message.id!=='string'||!message.id||message.id.length>256||!(message.parentId===null||typeof message.parentId==='string')||
    !['user','assistant'].includes(message.role)||typeof message.text!=='string'||message.text.length>1000000||!['running','completed','failed','stopped'].includes(message.state)||
    message.note!==undefined&&(typeof message.note!=='string'||message.note.length>8000)||message.context!==undefined&&(typeof message.context!=='string'||message.context.length>16000))throw Error('Invalid saved message')
   if(message.activity!==undefined&&(!Array.isArray(message.activity)||message.activity.length>100||message.activity.some(item=>!item||typeof item.label!=='string'||item.label.length>200||typeof item.state!=='string'||item.state.length>40||item.time!==undefined&&(typeof item.time!=='string'||item.time.length>64))))throw Error('Invalid saved activity')
   const clean=structuredClone(message);if(message.images!==undefined)clean.images=parseHadronImages(message.images)
   return clean
  })
  const seen=new Map(messages.map(message=>[message.id,message]))
  if(seen.size!==messages.length)throw Error('Duplicate saved message')
  for(const message of messages){
   let parent=message.parentId;const path=new Set([message.id])
   while(parent){if(path.has(parent))throw Error('Invalid branch cycle');path.add(parent);const found=seen.get(parent);if(!found)throw Error('Missing branch parent');parent=found.parentId}
  }
  if(value.selectedId!==null&&!seen.has(value.selectedId))throw Error('Selected message is unavailable')
  const models:WorkspaceChat['models']={}
  for(const slot of ['a','b'] as const){const model=value.models?.[slot];if(model){if(!isHadronProvider(model.provider)||typeof model.modelName!=='string'||model.modelName.length>256)throw Error('Invalid saved model');models[slot]={provider:model.provider,modelName:model.modelName}}}
  const attachments=value.attachments??[]
  if(value.peerChats!==undefined&&(!value.peerChats||typeof value.peerChats!=='object'||Object.entries(value.peerChats).some(([slot,id])=>!['a','b'].includes(slot)||typeof id!=='string'||!id||id.length>160)))throw Error('Invalid saved agent chat links')
  if(value.nativeWorkspaceId!==undefined&&(typeof value.nativeWorkspaceId!=='string'||!value.nativeWorkspaceId||value.nativeWorkspaceId.length>128)||value.instructions!==undefined&&(typeof value.instructions!=='string'||value.instructions.length>1000000))throw Error('Invalid saved project context')
  if(!Array.isArray(attachments)||attachments.length>20||attachments.some(file=>!file||typeof file.id!=='string'||typeof file.name!=='string'||file.name.length>1000||typeof file.text!=='string'||file.searchable!==undefined&&file.searchable!==true||file.text.length>(file.searchable?2_000_000:16000))||attachments.reduce((total,file)=>total+(file.searchable?0:file.text.length),0)>16000||attachments.reduce((total,file)=>total+(file.searchable?file.text.length:0),0)>4_000_000)throw Error('Invalid saved attachments')
  const chat:WorkspaceChat={id:value.id,projectId:value.projectId,title:value.title,sharedContinuation:value.sharedContinuation===true||undefined,peerChats:value.peerChats?{...value.peerChats}:undefined,nativeWorkspaceId:value.nativeWorkspaceId,instructions:value.instructions,workType:value.workType,permission:value.workType==='continuous'?'chat':value.permission,agent:value.agent,models,maxTurns:value.maxTurns,
   draft:value.draft,selectedId:value.selectedId,messages,scrollTop:Number.isFinite(value.scrollTop)?Math.max(0,value.scrollTop):0,followLatest:value.followLatest!==false,followBranch:value.followBranch!==false,
   attachments:attachments.map(file=>({id:file.id,name:file.name,text:file.text,...(file.image?{image:parseHadronImages([file.image])[0]}:{}),...(file.searchable?{searchable:true as const}:{})})),nativeJob:value.nativeJob&&['independent','shared','continuous','project'].includes(value.nativeJob.kind)&&typeof value.nativeJob.id==='string'&&value.nativeJob.id.length<=160?{kind:value.nativeJob.kind,id:value.nativeJob.id}:undefined,
   jobId:typeof value.jobId==='string'&&value.jobId.length<=160?value.jobId:null,jobState:value.jobState==='idle'?'idle':'unknown'}
  if(Buffer.byteLength(JSON.stringify(chat))>32*1024*1024)throw Error('Conversation exceeds the local archive size limit')
  return chat
 }
 load(owner:string,id:string):ArchivedChat|null{
  const row=this.db.prepare('SELECT * FROM hadron_workspace_chats WHERE id=? AND owner=?').get(id,owner) as Stored|undefined
  if(!row)return null
  // A deleted companion is an absent navigation target, not a failed read of
  // the active chat. Saves and mutations still require full authorization.
  if(this.available&&!this.available(owner,id))return null
  const project=this.currentProject?.(owner,id)
  if(project&&project!==row.project){
   this.authorize(owner,project,id)
   const chat=this.clean({...JSON.parse(row.body),projectId:project,nativeWorkspaceId:id,peerChats:undefined})
   chat.messages=chat.messages.map(message=>({...message,edited:true}))
   row.project=project;row.revision++;row.body=JSON.stringify(chat)
   this.db.prepare('UPDATE hadron_workspace_chats SET project=?,revision=?,body=? WHERE id=? AND owner=?').run(project,row.revision,row.body,id,owner)
  }
  this.authorize(owner,row.project,id)
  return {revision:row.revision,chat:this.clean(JSON.parse(row.body))}
 }
 save(owner:string,value:WorkspaceChat,expectedRevision:number):ArchivedChat{
  const chat=this.clean(value)
  return this.transaction(()=>{
   const row=this.db.prepare('SELECT * FROM hadron_workspace_chats WHERE id=?').get(chat.id) as Stored|undefined
   this.authorize(owner,chat.projectId,chat.id,!row)
   if(row&&(row.owner!==owner||row.project!==chat.projectId))throw Error('Conversation belongs to another project or account')
   if(row?.revision===expectedRevision+1&&row.body===JSON.stringify(chat))return {revision:row.revision,chat}
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||(row?.revision??0)!==expectedRevision)throw Error('Conversation changed in another view; reload it before saving')
   const revision=expectedRevision+1
   this.db.prepare('INSERT INTO hadron_workspace_chats(id,owner,project,revision,body,preview) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body=excluded.body,preview=excluded.preview').run(chat.id,owner,chat.projectId,revision,JSON.stringify(chat),(chat.messages.find(message=>message.role==='user')??chat.messages[0])?.text.replace(/\s+/g,' ').slice(0,110)??'')
   this.written(owner,chat)
   return {revision,chat}
  })
 }
 private selected(chat:WorkspaceChat,ids:string[],excerpts?:MessageExcerpts){
  if(!Array.isArray(ids)||!ids.length||ids.length>1000||new Set(ids).size!==ids.length)throw Error('Select messages to use')
  const chosen=new Set(ids),originals=chat.messages.filter(message=>chosen.has(message.id))
  if(excerpts&&(typeof excerpts!=='object'||Array.isArray(excerpts)||!Object.keys(excerpts).every(id=>chosen.has(id))))throw Error('Invalid text selection')
  const messages=originals.map(message=>{
   const range=excerpts?.[message.id]
   if(!excerpts||!Object.hasOwn(excerpts,message.id))return message
   if(!range||typeof range!=='object'||Array.isArray(range))throw Error('Invalid text selection')
   if(!Number.isSafeInteger(range.start)||!Number.isSafeInteger(range.end)||range.start<0||range.end<=range.start||range.end>message.text.length||message.text.slice(range.start,range.end)!==range.text)throw Error('The selected text changed. Select it again before moving or copying.')
   return {...message,text:range.text,note:undefined}
  })
  if(messages.length!==ids.length)throw Error('A selected message is unavailable')
  if(Buffer.byteLength(JSON.stringify(messages.map(({images,...message})=>message)))>131072||Buffer.byteLength(JSON.stringify(messages))>8*1024*1024)throw Error('Choose a smaller selection (128 KiB text or 8 MiB including pictures maximum)')
  return messages
 }
 private remove(chat:WorkspaceChat,ids:Set<string>,excerpts?:MessageExcerpts):Removed{
  const textEdits:NonNullable<Removed['textEdits']>=[]
  const whole=new Set(ids)
  chat.messages=chat.messages.map(message=>{
   const range=excerpts?.[message.id]
   if(!ids.has(message.id)||!range||range.start===0&&range.end===message.text.length)return message
   const afterText=message.text.slice(0,range.start)+message.text.slice(range.end)
   textEdits.push({before:structuredClone(message),afterText,removedText:range.text});whole.delete(message.id)
   return {...message,text:afterText,edited:true}
  })
  ids=whole
  const byId=new Map(chat.messages.map(message=>[message.id,message]))
  const rewired:Removed['rewired']=[]
  const parentOutside=(id:string|null):string|null=>{while(id&&ids.has(id))id=byId.get(id)!.parentId;return id}
  const removed={messages:chat.messages.filter(message=>ids.has(message.id)),positions:chat.messages.flatMap((message,index)=>ids.has(message.id)?[{id:message.id,index}]:[]),rewired,textEdits}
  chat.messages=chat.messages.filter(message=>!ids.has(message.id)).map(message=>{
   const parentId=parentOutside(message.parentId)
   if(parentId!==message.parentId)rewired.push({id:message.id,before:message.parentId,after:parentId})
   return {...message,parentId,...(parentId!==message.parentId?{edited:true}:{})}
  })
  chat.selectedId=parentOutside(chat.selectedId)
  return removed
 }
 private bin(owner:string,chatId:string,removed:Removed){
  const id=randomUUID(),title=(removed.messages[0]?.text??removed.textEdits?.[0]?.removedText)?.replace(/\s+/g,' ').slice(0,80)||'Conversation selection'
  this.db.prepare('INSERT INTO hadron_workspace_bin VALUES (?,?,?,?,?,?)').run(id,owner,chatId,title,this.now(),JSON.stringify(removed));return id
 }
 trash(owner:string,chatId:string,ids:string[],revision:number,excerpts?:MessageExcerpts){
  return this.transaction(()=>{
   const saved=this.load(owner,chatId);if(!saved||saved.revision!==revision)throw Error('Conversation changed; reload it before deleting')
   if(saved.chat.jobState!=='idle')throw Error('Wait for this task to end before removing its messages')
   this.selected(saved.chat,ids,excerpts)
   const binId=this.bin(owner,chatId,this.remove(saved.chat,new Set(ids),excerpts))
   return {binId,...this.save(owner,saved.chat,revision)}
  })
 }
 copy(owner:string,input:{id:string;source:string;destination:string;ids:string[];parentId:string|null;move?:boolean;sourceRevision:number;destinationRevision:number;excerpts?:MessageExcerpts}){
  if(!input||typeof input.id!=='string'||!input.id||input.id.length>160||input.source===input.destination)throw Error('Choose another destination chat')
  return this.transaction(()=>{
   const fingerprint=hash(input),previous=this.db.prepare('SELECT * FROM hadron_workspace_copies WHERE id=?').get(input.id)
   if(previous){
    if(previous.owner!==owner||previous.fingerprint!==fingerprint)throw Error('Copy request changed')
    const marker=JSON.parse(previous.result),destination=this.load(owner,input.destination),source=this.load(owner,input.source)
    if(!destination||!source)throw Error('The copied conversation is no longer available')
    return {destination,source:input.move?source:undefined,ids:marker.ids,binId:marker.binId}
   }
   const source=this.load(owner,input.source),destination=this.load(owner,input.destination)
   if(!source||!destination)throw Error('A selected conversation is unavailable')
   if(source.revision!==input.sourceRevision||destination.revision!==input.destinationRevision)throw Error('Conversation changed; reload the selection before copying')
   if(input.parentId!==null&&!destination.chat.messages.some(message=>message.id===input.parentId))throw Error('Destination branch is unavailable')
   if(destination.chat.jobState!=='idle'||input.move&&source.chat.jobState!=='idle')throw Error('Wait for the affected task to end first')
   const messages=this.selected(source.chat,input.ids,input.excerpts),ids:string[]=[]
   let parentId=input.parentId
   for(const message of messages){
    const id=randomUUID();ids.push(id)
    // Text snapshots carry no original job/permission identity into a new mode.
    const copy:WorkspaceMessage={id,parentId,role:message.role,agent:message.agent,text:message.text,...(message.images?.length?{images:structuredClone(message.images)}:{}),state:'completed',provider:message.provider,modelName:message.modelName,note:message.note,
     reference:{chatId:source.chat.id,messageId:message.id,capturedAt:this.now(),state:message.state}}
    destination.chat.messages.push(copy);parentId=id
   }
   destination.chat.selectedId=parentId
   const target=this.save(owner,destination.chat,destination.revision)
   let updatedSource:ArchivedChat|undefined,binId:string|undefined
   if(input.move){binId=this.bin(owner,source.chat.id,this.remove(source.chat,new Set(input.ids),input.excerpts));updatedSource=this.save(owner,source.chat,source.revision)}
   const result={destination:target,source:updatedSource,binId,ids}
   this.db.prepare('INSERT INTO hadron_workspace_copies VALUES (?,?,?,?)').run(input.id,owner,fingerprint,JSON.stringify({sourceId:input.source,destinationId:input.destination,ids,binId}))
   return result
  })
 }
 note(owner:string,chatId:string,ids:string[],text:string,revision:number){
  if(typeof text!=='string'||text.length>8000)throw Error('Use a note up to 8,000 characters')
  const saved=this.load(owner,chatId);if(!saved||saved.revision!==revision)throw Error('Conversation changed; reload it before adding a note')
  const selected=new Set(this.selected(saved.chat,ids).map(message=>message.id))
  saved.chat.messages=saved.chat.messages.map(message=>selected.has(message.id)?{...message,note:text}:message)
  return this.save(owner,saved.chat,revision)
 }
 copyToNew(owner:string,input:NewSelectionDestination,create:(owner:string,input:NewSelectionDestination)=>WorkspaceChat){
  const validName=(text:unknown,max:number)=>typeof text==='string'&&!!text.trim()&&text.trim().length<=max&&!/[\x00-\x1f\x7f]/.test(text)
  if(!input||!validName(input.id,160)||!validName(input.title,200)||
   (input.projectName!==undefined?!validName(input.projectName,120)||input.projectId!==undefined:!validName(input.projectId,160)))throw Error('Enter a chat name and choose a project, or enter a new project name')
  return this.transaction(()=>{
   const fingerprint=hash(input),previous=this.db.prepare('SELECT * FROM hadron_workspace_destinations WHERE id=?').get(input.id)
   let destination:string,revision:number
   if(previous){
    if(previous.owner!==owner||previous.fingerprint!==fingerprint)throw Error('New destination request changed')
    destination=previous.destination;revision=previous.initial_revision
   }else{
    const chat=create(owner,input),saved=this.save(owner,chat,0)
    destination=chat.id;revision=saved.revision
    this.db.prepare('INSERT INTO hadron_workspace_destinations VALUES (?,?,?,?,?,?)').run(input.id,owner,fingerprint,input.source,destination,revision)
   }
   return this.copy(owner,{id:input.id,source:input.source,destination,ids:input.ids,parentId:null,move:input.move,sourceRevision:input.sourceRevision,destinationRevision:revision,excerpts:input.excerpts})
  })
 }
 listBin(owner:string):Array<RecycleEntry&{chatId:string}>{this.purge();return this.db.prepare('SELECT id,chat,title,deleted_at FROM hadron_workspace_bin WHERE owner=? ORDER BY deleted_at DESC').all(owner).map((row:any)=>({kind:'branch' as const,id:row.id,title:row.title,chatId:row.chat,deletedAt:row.deleted_at,expiresAt:row.deleted_at+RETENTION_MS,parentDeleted:false}))}
 restore(owner:string,id:string){
  this.purge()
  return this.transaction(()=>{
   const row=this.db.prepare('SELECT * FROM hadron_workspace_bin WHERE id=? AND owner=?').get(id,owner)
   if(!row)throw Error('This selection is no longer available to restore')
   const saved=this.load(owner,row.chat);if(!saved)throw Error('Restore its project and chat first')
   if(saved.chat.jobState!=='idle')throw Error('Wait for this task to end before restoring messages')
   const removed=JSON.parse(row.payload) as Removed,ids=new Set(saved.chat.messages.map(message=>message.id)),restored=new Set(removed.messages.map(message=>message.id))
   if(removed.messages.some(message=>ids.has(message.id)))throw Error('A restored message identity already exists')
   if(removed.messages.some(message=>message.parentId&&!ids.has(message.parentId)&&!restored.has(message.parentId)))throw Error('Restore the earlier parent branch first')
   if(removed.textEdits?.some(edit=>!ids.has(edit.before.id)))throw Error('Restore the containing message first')
   for(const message of removed.messages){const position=removed.positions.find(position=>position.id===message.id)!.index;saved.chat.messages.splice(Math.min(position,saved.chat.messages.length),0,message)}
   saved.chat.messages=saved.chat.messages.map(message=>{const rewired=removed.rewired.find(item=>item.id===message.id&&item.after===message.parentId);return rewired?{...message,parentId:rewired.before}:message})
   for(const edit of removed.textEdits??[]){
    const current=saved.chat.messages.find(message=>message.id===edit.before.id)!
    if(current.text===edit.afterText)saved.chat.messages=saved.chat.messages.map(message=>message.id===current.id?{...message,text:edit.before.text,edited:edit.before.edited}:message)
    else saved.chat.messages.push({...edit.before,id:randomUUID(),parentId:current.parentId,origin:undefined,edited:true})
   }
   const result=this.save(owner,saved.chat,saved.revision)
   this.db.prepare('DELETE FROM hadron_workspace_bin WHERE id=? AND owner=?').run(id,owner);return result
  })
 }
 purge(){this.db.prepare('DELETE FROM hadron_workspace_bin WHERE deleted_at<=?').run(this.now()-RETENTION_MS)}
 forget(owner:string,chatId:string){
  this.db.prepare('DELETE FROM hadron_workspace_chats WHERE owner=? AND id=?').run(owner,chatId)
  this.db.prepare('DELETE FROM hadron_workspace_bin WHERE owner=? AND chat=?').run(owner,chatId)
  this.db.prepare("DELETE FROM hadron_workspace_copies WHERE owner=? AND (json_extract(result,'$.sourceId')=? OR json_extract(result,'$.destinationId')=?)").run(owner,chatId,chatId)
  this.db.prepare('DELETE FROM hadron_workspace_destinations WHERE owner=? AND (source=? OR destination=?)').run(owner,chatId,chatId)
 }
}
export const workspaceArchiveHost:{service?:WorkspaceArchive;copyNew?:(owner:string,input:NewSelectionDestination)=>ReturnType<WorkspaceArchive['copyToNew']>}={}
