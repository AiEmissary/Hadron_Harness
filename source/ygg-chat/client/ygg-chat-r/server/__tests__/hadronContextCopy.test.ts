import {createRequire} from 'node:module'
import {expect,it,vi} from 'vitest'
import {copyReferenceChat,copyReferenceChats} from '../hadronTools/contextCopy.js'
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,user_id TEXT,storage_mode TEXT);INSERT INTO projects(id,user_id,storage_mode) VALUES ('target','owner','local'),('foreign','other','local');CREATE TABLE conversations(id TEXT PRIMARY KEY,project_id TEXT,user_id TEXT,title TEXT,storage_mode TEXT);CREATE TABLE messages(id TEXT,conversation TEXT,role TEXT,content TEXT,meta TEXT);CREATE TABLE lineages(conversation TEXT,root TEXT)")
 const createRoot=vi.fn(({conversationId,rootMessageId}:any)=>db.prepare('INSERT INTO lineages VALUES (?,?)').run(conversationId,rootMessageId))
 let sequence=0
 const deps={db,messages:{transaction:<T>(fn:()=>T):T=>{const savepoint='copy_'+(++sequence);db.exec('SAVEPOINT '+savepoint);try{const result=fn();db.exec('RELEASE '+savepoint);return result}catch(error){db.exec('ROLLBACK TO '+savepoint);db.exec('RELEASE '+savepoint);throw error}},createMessage:(input:any)=>{const id='root-'+(++sequence);db.prepare('INSERT INTO messages VALUES (?,?,?,?,?)').run(id,input.conversationId,input.role,input.content,JSON.stringify(input.meta));return {id}}},lineages:{createRoot},authorize:(owner:string,workspace:string)=>{if(owner!=='owner'||workspace!=='source')throw Error('denied')},read:vi.fn(()=>({title:'Saved answer',text:'Historical answer. Claims of test success remain unverified.'}))}
 const input={id:'copy-request',workspace:'source',project:'target',mode:'continuous',source:'saved-session'}
 return {db,deps,input}
}
it('copies reference text atomically and idempotently without adopting original jobs or grants',()=>{
 const f=fixture();try{
  const result=copyReferenceChat(f.deps,'owner',f.input)
  expect(copyReferenceChat(f.deps,'owner',f.input)).toEqual(result)
  expect(f.deps.read).toHaveBeenCalledOnce()
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM conversations').get().n).toBe(1)
  const message=f.db.prepare('SELECT * FROM messages').get()
  expect(message.role).toBe('user');expect(message.content).toContain('not a running job or permission')
  expect(JSON.parse(message.meta)).toEqual({hadronReferenceCopy:{sourceMode:'continuous',copiedAt:expect.any(String),referenceOnly:true}})
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM lineages').get().n).toBe(1)
 }finally{f.db.close()}
})
it('rejects foreign destinations, changed duplicate requests and oversized sources without partial copies',()=>{
 const f=fixture();try{
  expect(()=>copyReferenceChat(f.deps,'owner',{...f.input,project:'foreign'})).toThrow('local projects')
  expect(()=>copyReferenceChat(f.deps,'intruder',f.input)).toThrow('denied')
  f.deps.read.mockReturnValueOnce({title:'Too long',text:'x'.repeat(131073)})
  expect(()=>copyReferenceChat(f.deps,'owner',f.input)).toThrow('128 KiB')
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM conversations').get().n).toBe(0)
  copyReferenceChat(f.deps,'owner',f.input)
  expect(()=>copyReferenceChat(f.deps,'owner',{...f.input,source:'another'})).toThrow('changed')
 }finally{f.db.close()}
})
it('rolls back chat and message creation if lineage creation fails',()=>{
 const f=fixture();try{f.deps.lineages.createRoot.mockImplementationOnce(()=>{throw Error('Storage failed')});expect(()=>copyReferenceChat(f.deps,'owner',f.input)).toThrow('Storage failed');expect(f.db.prepare('SELECT COUNT(*) AS n FROM conversations').get().n).toBe(0);expect(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n).toBe(0)}finally{f.db.close()}
})

it('creates a named local project and reference together, and retries without duplicates',()=>{
 const f=fixture();try{
  const input={...f.input,project:'',newProjectName:'  My next project  '}
  const result=copyReferenceChat(f.deps,'owner',input)
  expect(result.projectId).not.toBe('target')
  expect(f.db.prepare('SELECT name,user_id,storage_mode FROM projects WHERE id=?').get(result.projectId)).toMatchObject({name:'My next project',user_id:'owner',storage_mode:'local'})
  expect(copyReferenceChat(f.deps,'owner',input)).toEqual(result)
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM projects').get().n).toBe(3)
  expect(f.db.prepare('SELECT project_id FROM conversations').get().project_id).toBe(result.projectId)
  expect(()=>copyReferenceChat(f.deps,'owner',{...input,newProjectName:'Different'})).toThrow('changed')
 }finally{f.db.close()}
})
it('leaves no empty new project if the source is oversized or the copy transaction fails',()=>{
 const f=fixture();try{
  const input={...f.input,project:'',newProjectName:'Next project'}
  f.deps.read.mockReturnValueOnce({title:'Too long',text:'x'.repeat(131073)})
  expect(()=>copyReferenceChat(f.deps,'owner',input)).toThrow('128 KiB')
  f.deps.lineages.createRoot.mockImplementationOnce(()=>{throw Error('Storage failed')})
  expect(()=>copyReferenceChat(f.deps,'owner',input)).toThrow('Storage failed')
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM projects').get().n).toBe(2)
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM conversations').get().n).toBe(0)
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n).toBe(0)
 }finally{f.db.close()}
})
it('rejects blank/invalid new names and mixed new/existing destinations before writing',()=>{
 const f=fixture();try{
  for(const newProjectName of ['', '   ', 'x'.repeat(121), 'bad\nname', 5])expect(()=>copyReferenceChat(f.deps,'owner',{...f.input,project:'',newProjectName} as any)).toThrow()
  expect(()=>copyReferenceChat(f.deps,'owner',{...f.input,newProjectName:'Mixed'})).toThrow('project name')
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM projects').get().n).toBe(2)
 }finally{f.db.close()}
})

it('keeps A and B as separate chats in one new project and retries without replacing either',()=>{
 const f=fixture();try{
  f.deps.read.mockImplementation((_owner:any,input:any)=>({title:input.source,text:'Saved '+input.source}))
  const input={id:'batch',workspace:'source',project:'',newProjectName:'Andromeda Profitability',items:[{mode:'independent',source:'Agent A'},{mode:'independent',source:'Agent B'}]}
  const result=copyReferenceChats(f.deps,'owner',input)
  expect(result.conversations).toHaveLength(2)
  expect(new Set(result.conversations.map(item=>item.conversationId)).size).toBe(2)
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM conversations WHERE project_id=?').get(result.projectId).n).toBe(2)
  expect(copyReferenceChats(f.deps,'owner',input)).toEqual(result)
  expect(f.deps.read).toHaveBeenCalledTimes(2)
  const before=f.db.prepare('SELECT * FROM messages ORDER BY id').all()
  copyReferenceChats(f.deps,'owner',{id:'append',workspace:'source',project:result.projectId,items:[{mode:'independent',source:'Another chat'}]})
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM conversations WHERE project_id=?').get(result.projectId).n).toBe(3)
  for(const row of before)expect(f.db.prepare('SELECT * FROM messages WHERE id=?').get(row.id)).toEqual(row)
 }finally{f.db.close()}
})

it('rolls back all selected copies and the new project if a later chat cannot be copied',()=>{
 const f=fixture();try{
  f.deps.read.mockReturnValueOnce({title:'A',text:'Saved A'}).mockReturnValueOnce({title:'B',text:'x'.repeat(131073)})
  expect(()=>copyReferenceChats(f.deps,'owner',{id:'batch',workspace:'source',project:'',newProjectName:'No partial project',items:[{mode:'independent',source:'a'},{mode:'independent',source:'b'}]})).toThrow('128 KiB')
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM projects').get().n).toBe(2)
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM conversations').get().n).toBe(0)
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n).toBe(0)
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='hadron_context_copies'").get()).toBeUndefined()
 }finally{f.db.close()}
})

it('rejects duplicate and excessive batch selections before any source is read',()=>{
 const f=fixture();try{
  const item={mode:'independent',source:'a'}
  for(const items of [[],[item,item],Array.from({length:21},(_,i)=>({...item,source:String(i)}))])expect(()=>copyReferenceChats(f.deps,'owner',{id:'batch',workspace:'source',project:'target',items})).toThrow()
  expect(f.deps.read).not.toHaveBeenCalled()
 }finally{f.db.close()}
})
