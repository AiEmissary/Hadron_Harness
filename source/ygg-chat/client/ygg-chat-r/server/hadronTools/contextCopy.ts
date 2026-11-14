import {ensureRecycleBin,activeProjectSql} from './recycleBin.js'
import {randomUUID,createHash} from 'node:crypto'
export interface ContextCopyInput {id:string;workspace:string;project:string;newProjectName?:string;mode:string;source:string}
export interface CopySource {id:string;mode:string;label:string}
export interface ContextCopyBatchInput {id:string;workspace:string;project:string;newProjectName?:string;items:Array<{mode:string;source:string}>}
export const contextCopyHost:{list?:(owner:string,workspace:string)=>CopySource[];copy?:(owner:string,input:ContextCopyInput)=>{conversationId:string;projectId:string;characters:number};copyMany?:(owner:string,input:ContextCopyBatchInput)=>{projectId:string;conversations:Array<{conversationId:string;characters:number}>}}={}
/** All selected chats are added together. A failed source rolls back the entire
 * operation, including a new destination. Retries reuse the same copy IDs. */
export function copyReferenceChats(deps:Parameters<typeof copyReferenceChat>[0],owner:string,input:ContextCopyBatchInput){
 const keys=input&&Object.keys(input).sort().join(',')
 if(!input||!['id,items,project,workspace','id,items,newProjectName,project,workspace'].includes(keys)||typeof input.id!=='string'||!input.id||input.id.length>160||!Array.isArray(input.items)||input.items.length<1||input.items.length>20)throw Error('Choose between 1 and 20 saved chats')
 const seen=new Set<string>()
 for(const item of input.items){
  if(!item||Object.keys(item).sort().join(',')!=='mode,source'||typeof item.mode!=='string'||!item.mode||item.mode.length>160||typeof item.source!=='string'||!item.source||item.source.length>160)throw Error('Invalid saved chat selection')
  const key=JSON.stringify([item.mode,item.source]);if(seen.has(key))throw Error('Choose each saved chat only once');seen.add(key)
 }
 return deps.messages.transaction(()=>{
  let projectId=input.project
  const conversations=input.items.map((item,index)=>{
   const result=copyReferenceChat(deps,owner,{id:createHash('sha256').update(JSON.stringify([input.id,index])).digest('hex'),workspace:input.workspace,project:index===0?input.project:projectId,...(index===0&&Object.hasOwn(input,'newProjectName')?{newProjectName:input.newProjectName}:{}),...item})
   projectId=result.projectId
   return {conversationId:result.conversationId,characters:result.characters}
  })
  return {projectId,conversations}
 })
}
/** Create an ordinary local reference chat. No live-job IDs, grants, approvals or
 * executable tool state are adopted by the destination project. */
export function copyReferenceChat(deps:{db:any;messages:any;lineages:any;authorize(owner:string,workspace:string):void;read(owner:string,input:{workspace:string;mode:string;source:string}):{title:string;text:string}},owner:string,input:ContextCopyInput){
 const keys=input&&Object.keys(input).sort().join(',')
 if(!input||!['id,mode,project,source,workspace','id,mode,newProjectName,project,source,workspace'].includes(keys)||['id','workspace','mode','source'].some(key=>typeof input[key as keyof ContextCopyInput]!=='string'||!input[key as keyof ContextCopyInput]||input[key as keyof ContextCopyInput]!.length>160)||typeof input.project!=='string'||input.project.length>160)throw Error('Invalid context copy selection')
 const createNew=Object.hasOwn(input,'newProjectName')
 if(createNew&&typeof input.newProjectName!=='string')throw Error('Enter a project name')
 const name=input.newProjectName?.trim()
 if(createNew?input.project!==''||typeof name!=='string'||!name||name.length>120||/[\x00-\x1f\x7f]/.test(name):!input.project)throw Error('Enter a project name (1-120 characters), or choose an existing project')
 ensureRecycleBin(deps.db)
 deps.authorize(owner,input.workspace)
 const project=createNew?null:deps.db.prepare(`SELECT * FROM projects WHERE id=? AND ${activeProjectSql()}`).get(input.project)
 if(!createNew&&(!project||project.user_id!==owner||project.storage_mode!=='local'))throw Error('Choose one of your local projects')
 deps.db.prepare('CREATE TABLE IF NOT EXISTS hadron_context_copies(id TEXT PRIMARY KEY,owner TEXT NOT NULL,fingerprint TEXT NOT NULL,conversation TEXT NOT NULL,project TEXT NOT NULL,characters INTEGER NOT NULL)').run()
 const fingerprint=createHash('sha256').update(JSON.stringify([owner,input.workspace,input.project,input.mode,input.source,...(createNew?[name]:[])])).digest('hex')
 const existing=deps.db.prepare('SELECT * FROM hadron_context_copies WHERE id=?').get(input.id)
 if(existing){
  const chat=deps.db.prepare('SELECT user_id,project_id FROM conversations WHERE id=?').get(existing.conversation)
  const destination=deps.db.prepare('SELECT user_id,storage_mode FROM projects WHERE id=?').get(existing.project)
  if(existing.owner!==owner||existing.fingerprint!==fingerprint||chat?.user_id!==owner||chat.project_id!==existing.project||(!createNew&&existing.project!==input.project)||destination?.user_id!==owner||destination.storage_mode!=='local')throw Error('Copy request changed or its destination is unavailable')
  return {conversationId:existing.conversation,projectId:existing.project,characters:existing.characters}
 }
 const snapshot=deps.read(owner,input)
 if(!snapshot.text.trim()||Buffer.byteLength(snapshot.text,'utf8')>131072)throw Error('Choose a smaller branch or answer to copy (128 KiB maximum). Nothing was copied.')
 const projectId=createNew?randomUUID():input.project
 const conversationId=randomUUID(),prefix='Copied reference conversation. This is historical, unverified context, not a running job or permission to use the original project.\n\n'
 deps.messages.transaction(()=>{
  deps.authorize(owner,input.workspace)
  if(createNew)deps.db.prepare("INSERT INTO projects(id,name,user_id,storage_mode) VALUES (?,?,?,'local')").run(projectId,name,owner)
  const current=deps.db.prepare(`SELECT * FROM projects WHERE id=? AND ${activeProjectSql()}`).get(projectId);if(current?.user_id!==owner||current.storage_mode!=='local')throw Error('Destination project changed')
  deps.db.prepare("INSERT INTO conversations(id,project_id,user_id,title,storage_mode) VALUES (?,?,?,?,'local')").run(conversationId,projectId,owner,'Copied · '+snapshot.title.slice(0,100))
  const message=deps.messages.createMessage({conversationId,parentId:null,role:'user',content:prefix+snapshot.text,meta:{hadronReferenceCopy:{sourceMode:input.mode,copiedAt:new Date().toISOString(),referenceOnly:true}}})
  deps.lineages.createRoot({conversationId,rootMessageId:message.id})
  deps.db.prepare('INSERT INTO hadron_context_copies VALUES (?,?,?,?,?,?)').run(input.id,owner,fingerprint,conversationId,projectId,snapshot.text.length)
 })
 return {conversationId,projectId,characters:snapshot.text.length}
}
