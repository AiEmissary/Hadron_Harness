import {expect,it,vi} from 'vitest'
import {createHash} from 'node:crypto'
import {proposalSqlite} from '../headlessServer/services/__tests__/fixtures/proposalSqlite.js'
import {exportChatArchive,importChatArchive,validateChatArchive} from '../hadronTools/chatArchive.js'
import {blankWorkspaceChat} from '../../src/features/collaboration/unifiedWorkspace.js'
function fixture(){
 const f=proposalSqlite({generate:vi.fn()} as any)
 f.db.exec("ALTER TABLE projects ADD COLUMN name TEXT;ALTER TABLE projects ADD COLUMN user_id TEXT;ALTER TABLE projects ADD COLUMN storage_mode TEXT;INSERT INTO projects(id,name,user_id,storage_mode) VALUES ('p','Original','owner','local'),('f','Foreign','other','local');ALTER TABLE conversations ADD COLUMN user_id TEXT;ALTER TABLE conversations ADD COLUMN title TEXT;ALTER TABLE conversations ADD COLUMN storage_mode TEXT;UPDATE conversations SET project_id='p',user_id='owner',title='Conversation',storage_mode='local';UPDATE conversations SET project_id='f',user_id='other' WHERE id='other'")
 return {...f,references:vi.fn(()=>[{title:'Project conclusion',text:'Historical review only.'}])}
}
function seal(a:any){a.checksum=createHash('sha256').update(JSON.stringify(a.projects)).digest('hex');return JSON.stringify(a)}
it('exports the current unified conversation and notes instead of obsolete underlying messages or runtime grants',()=>{
 const f=fixture(),workspace=blankWorkspaceChat('p','c1')
 workspace.title='Current chat';workspace.folder={id:'PRIVATE_GRANT',label:'Private'}
 workspace.messages=[{id:'long-native-id-'.repeat(20),parentId:null,role:'user',text:'Current question',state:'completed',note:'Check this later'},
  {id:'reply',parentId:'long-native-id-'.repeat(20),role:'assistant',text:'Current reply',state:'completed',origin:{kind:'independent',id:'PRIVATE_JOB',nodeId:'PRIVATE_RUN'}}]
 workspace.selectedId='reply'
 try{
  const exported=exportChatArchive({...f,workspace:()=>workspace},'owner')
  expect(exported.projects[0].chats).toHaveLength(1)
  expect(exported.projects[0].chats[0].title).toBe('Current chat')
  expect(exported.projects[0].chats[0].nodes.map(node=>node.text)).toEqual(['Current question\n\nPersonal note:\nCheck this later','Current reply'])
  expect(JSON.stringify(exported)).not.toMatch(/PRIVATE_|Frozen anchor|Historical review/)
  expect(importChatArchive(f,'owner',exported).messages).toBe(2)
 }finally{f.close()}
})
it('round trips a fork into new owned projects, preserving both paths and excluding foreign data and runtime authority',()=>{
 const f=fixture();try{
  const left=f.messages.createMessage({conversationId:'c1',parentId:f.anchor.id,role:'assistant',content:'Left answer',meta:{grant:'do-not-export'}})
  f.messages.createMessage({conversationId:'c1',parentId:f.anchor.id,role:'assistant',content:'Right answer'})
  f.messages.createMessage({conversationId:'c1',parentId:left.id,role:'user',content:'Follow up'})
  const archive=exportChatArchive(f,'owner')
  expect(archive.projects).toHaveLength(1);expect(archive.projects[0].chats).toHaveLength(2)
  expect(JSON.stringify(archive)).not.toContain('do-not-export');expect(JSON.stringify(archive)).not.toContain('Foreign')
  const result=importChatArchive(f,'owner',archive);expect(result).toMatchObject({projects:1,chats:2,messages:5,alreadyImported:false})
  const original=f.db.prepare("SELECT count(*) AS n FROM messages WHERE conversation_id='c1'").get();expect(original.n).toBe(4)
  const imported=f.db.prepare("SELECT id FROM conversations WHERE project_id NOT IN ('p','f') AND title='Conversation'").get()
  expect(f.lineages.list(imported.id)).toHaveLength(2)
  expect(f.db.prepare('SELECT content FROM messages WHERE conversation_id=?').all(imported.id).map((m:any)=>m.content).sort()).toEqual(['Frozen anchor','Left answer','Right answer','Follow up'].sort())
  expect(importChatArchive(f,'owner',archive).alreadyImported).toBe(true)
  expect(f.db.prepare('SELECT count(*) AS n FROM projects').get().n).toBe(3)
 }finally{f.close()}
})
it('rejects corrupt, cyclic, foreign-format and executable-metadata archives before creating any projects',()=>{
 const f=fixture();try{const a=exportChatArchive(f,'owner')
  const corrupt=JSON.parse(JSON.stringify(a));corrupt.projects[0].name='tampered';expect(()=>validateChatArchive(JSON.stringify(corrupt))).toThrow('integrity')
  for(const change of [(x:any)=>{x.projects[0].chats[0].nodes[0].parent=x.projects[0].chats[0].nodes[0].key},(x:any)=>{x.projects[0].chats[0].nodes[0].role='system'},(x:any)=>{x.projects[0].chats[0].nodes[0].permission='write'},(x:any)=>{x.version=999}]){const x=JSON.parse(JSON.stringify(a));change(x);expect(()=>importChatArchive(f,'owner',JSON.parse(seal(x)))).toThrow()}
  expect(f.db.prepare('SELECT count(*) AS n FROM projects').get().n).toBe(2)
 }finally{f.close()}
})
it('rolls back the whole import when lineage reconstruction fails and can then retry successfully',()=>{
 const f=fixture();try{const a=exportChatArchive(f,'owner'),restore=vi.spyOn(f.lineages,'reconcileLegacyConversation').mockImplementationOnce(()=>{throw Error('disk error')})
  expect(()=>importChatArchive(f,'owner',a)).toThrow('disk error');expect(f.db.prepare('SELECT count(*) AS n FROM projects').get().n).toBe(2)
  restore.mockRestore();expect(importChatArchive(f,'owner',a).alreadyImported).toBe(false)
 }finally{f.close()}
})
it('does not export items in the thirty-day recycle bin',()=>{
 const f=fixture();try{exportChatArchive(f,'owner');f.db.prepare("INSERT INTO hadron_recycle_bin VALUES ('project','p','owner',?)").run(Date.now());expect(exportChatArchive(f,'owner').projects).toEqual([])}finally{f.close()}
})
