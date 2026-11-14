import type {WorkspaceChat} from '../../src/features/collaboration/unifiedWorkspace.js'
import {createHash,randomUUID} from 'node:crypto'
import {ensureRecycleBin,activeProjectSql,activeConversationSql} from './recycleBin.js'

export const ARCHIVE_BYTES=64*1024*1024
type Node={key:string;parent:string|null;role:'user'|'assistant';text:string}
type Chat={title:string;nodes:Node[]}
type Project={name:string;chats:Chat[]}
export type ChatArchive={format:'hadron-chat-archive';version:1;createdAt:string;projects:Project[];checksum:string}
export const chatArchiveHost:{export?:(owner:string)=>ChatArchive;import?:(owner:string,archive:ChatArchive)=>{projects:number;chats:number;messages:number;alreadyImported:boolean}}={}
const hash=(projects:Project[])=>createHash('sha256').update(JSON.stringify(projects)).digest('hex')
const exact=(value:any,keys:string)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys
function text(value:any,max:number,blank=false){if(typeof value!=='string'||value.length>max||(!blank&&!value.trim())||value.includes('\0'))throw Error('Invalid archive text')}
/** Entire file is validated before any write. Parent order bounds depth and prevents cycles. */
export function validateChatArchive(raw:string):ChatArchive{
 if(Buffer.byteLength(raw)>ARCHIVE_BYTES)throw Error('Archive exceeds 64 MiB')
 const a=JSON.parse(raw)
 if(!exact(a,'checksum,createdAt,format,projects,version')||a.format!=='hadron-chat-archive'||a.version!==1||typeof a.createdAt!=='string'||!Number.isFinite(Date.parse(a.createdAt))||!Array.isArray(a.projects)||a.projects.length>500)throw Error('Unsupported or invalid Hadron archive')
 let chats=0,messages=0
 for(const p of a.projects){
  if(!exact(p,'chats,name')||!Array.isArray(p.chats))throw Error('Invalid archive project')
  text(p.name,120)
  for(const c of p.chats){
   if(++chats>10000||!exact(c,'nodes,title')||!Array.isArray(c.nodes))throw Error('Invalid archive chat')
   text(c.title,200)
   const keys=new Map<string,number>()
   for(const n of c.nodes){
    if(++messages>100000||!exact(n,'key,parent,role,text')||!['user','assistant'].includes(n.role))throw Error('Invalid archive message')
    text(n.key,160);text(n.text,4*1024*1024,true)
    if(keys.has(n.key)||(n.parent!==null&&(typeof n.parent!=='string'||!keys.has(n.parent))))throw Error('Invalid archive branch links')
    const depth=n.parent===null?0:keys.get(n.parent)!+1
    if(depth>2000)throw Error('Archive branch is too deep')
    keys.set(n.key,depth)
   }
  }
 }
 if(typeof a.checksum!=='string'||a.checksum!==hash(a.projects))throw Error('Archive integrity check failed')
 return a
}
export function archiveSummary(a:ChatArchive){return {createdAt:a.createdAt,projects:a.projects.length,chats:a.projects.reduce((n,p)=>n+p.chats.length,0),messages:a.projects.reduce((n,p)=>n+p.chats.reduce((m,c)=>m+c.nodes.length,0),0)}}
export function exportChatArchive(deps:{db:any;references(owner:string,workspace:string):Array<{title:string;text:string}>;workspace?(owner:string,id:string):WorkspaceChat|null},owner:string):ChatArchive{
 ensureRecycleBin(deps.db)
 const projects:Project[]=[]
 for(const p of deps.db.prepare(`SELECT id,name FROM projects WHERE user_id=? AND storage_mode='local' AND ${activeProjectSql()} ORDER BY rowid`).all(owner)){
  const chats:Chat[]=[]
  for(const c of deps.db.prepare(`SELECT id,title FROM conversations WHERE project_id=? AND user_id=? AND storage_mode='local' AND ${activeConversationSql()} ORDER BY rowid`).all(p.id,owner)){
   const workspace=deps.workspace?.(owner,c.id)
   const references=workspace?[]:deps.references(owner,c.id)
   const keys=workspace?new Map(workspace.messages.map(message=>[message.id,randomUUID()])):null
   const rows:any[]=workspace?workspace.messages.map(message=>({id:keys!.get(message.id),parent_id:message.parentId?keys!.get(message.parentId):null,role:message.role,content:message.text+(message.note?'\n\nPersonal note:\n'+message.note:'')})):deps.db.prepare('SELECT id,parent_id,role,content FROM messages WHERE conversation_id=? ORDER BY rowid').all(c.id)
   const all=new Map(rows.map(r=>[r.id,r])),keep=new Set(rows.filter(r=>['user','assistant'].includes(r.role)).map(r=>r.id)),nodes:Node[]=[],pending=rows.filter(r=>keep.has(r.id)),emitted=new Set<string>()
   while(pending.length){let progress=false
    for(let i=0;i<pending.length;){const r=pending[i];let parent=r.parent_id;const seen=new Set<string>([r.id]);while(parent&&!keep.has(parent)){if(seen.has(parent))throw Error('Saved chat contains a cycle');seen.add(parent);if(!all.has(parent))throw Error('Saved chat has a missing parent');parent=all.get(parent)!.parent_id??null}
     if(parent&&!all.has(parent))throw Error('Saved chat has a missing parent')
     if(!parent||emitted.has(parent)){nodes.push({key:r.id,parent:parent??null,role:r.role,text:r.content??''});emitted.add(r.id);pending.splice(i,1);progress=true}else i++
    }if(!progress)throw Error('Saved chat contains invalid branch links')
   }
   chats.push({title:workspace?.title||c.title||'Saved chat',nodes})
   for(const ref of references)chats.push({title:ref.title.slice(0,200)||'Saved workflow',nodes:[{key:randomUUID(),parent:null,role:'user',text:'Historical workflow reference. Claims and tool results are unverified; no jobs, permissions or approvals are restored.\n\n'+ref.text}]})
  }
  projects.push({name:p.name||'Saved project',chats})
 }
 return validateChatArchive(JSON.stringify({format:'hadron-chat-archive',version:1,createdAt:new Date().toISOString(),projects,checksum:hash(projects)}))
}
export function importChatArchive(deps:{db:any;messages:any;lineages:any},owner:string,a:ChatArchive){
 a=validateChatArchive(JSON.stringify(a))
 if(!owner||owner.length>128)throw Error('Local account unavailable')
 deps.db.exec('CREATE TABLE IF NOT EXISTS hadron_archive_imports(owner TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(owner,checksum))')
 const summary=archiveSummary(a)
 return deps.messages.transaction(()=>{
  if(deps.db.prepare('SELECT 1 FROM hadron_archive_imports WHERE owner=? AND checksum=?').get(owner,a.checksum))return {...summary,alreadyImported:true}
  for(const p of a.projects){const project=randomUUID();deps.db.prepare("INSERT INTO projects(id,name,user_id,storage_mode) VALUES (?,?,?,'local')").run(project,('Imported · '+p.name).slice(0,120),owner)
   for(const c of p.chats){const chat=randomUUID(),ids=new Map<string,string>();deps.db.prepare("INSERT INTO conversations(id,project_id,user_id,title,storage_mode) VALUES (?,?,?,?,'local')").run(chat,project,owner,c.title)
    for(const n of c.nodes){const m=deps.messages.createMessage({conversationId:chat,parentId:n.parent===null?null:ids.get(n.parent),role:n.role,content:n.text,meta:{hadronArchive:{referenceOnly:true,importedAt:new Date().toISOString()}}});ids.set(n.key,m.id)}
    deps.lineages.reconcileLegacyConversation(chat)
   }
  }
  deps.db.prepare('INSERT INTO hadron_archive_imports VALUES (?,?)').run(owner,a.checksum)
  return {...summary,alreadyImported:false}
 })
}
