import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it} from 'vitest'
import {WorkspaceArchive} from '../hadronTools/workspaceArchive.js'
import {blankWorkspaceChat,workspaceMessagePath,type WorkspaceChat} from '../../src/features/collaboration/unifiedWorkspace.js'
import {RETENTION_MS} from '../hadronTools/recycleBin.js'
import {activeConversationSql,ensureRecycleBin} from '../hadronTools/recycleBin.js'
import {fixtureImage} from '../../../../shared/__fixtures__/hadronImage.js'
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
let db:any,archive:WorkspaceArchive,now:number
beforeEach(()=>{
 db=new DatabaseSync(':memory:');now=1000
 archive=new WorkspaceArchive(db,(owner,project)=>{if(owner!=='owner'||!['project','other-project'].includes(project))throw Error('Access denied')},()=>now)
})
afterEach(()=>db.close())
function chat(id:string,project='project'):WorkspaceChat{
 const chat=blankWorkspaceChat(project,id)
 chat.messages=[{id:id+'-q',parentId:null,role:'user',text:'Question '+id,state:'completed'},
  {id:id+'-a',parentId:id+'-q',role:'assistant',agent:'a',text:'Answer '+id,state:'completed',origin:{kind:'independent',id:'native-job',nodeId:'native-answer'}}]
 chat.selectedId=id+'-a';return chat
}
it('round-trips pictures on messages and pending attachments and copies them into a new chat without altering the source',()=>{
 const value=chat('source');value.messages[0].images=[fixtureImage]
 value.attachments=[{id:fixtureImage.id,name:fixtureImage.name,text:'',image:fixtureImage}]
 const source=archive.save('owner',value,0),target=archive.save('owner',chat('target'),0)
 expect(archive.load('owner','source')?.chat.messages[0].images).toEqual([fixtureImage])
 expect(archive.load('owner','source')?.chat.attachments?.[0].image).toEqual(fixtureImage)
 const copied=archive.copy('owner',{id:'picture-copy',source:'source',destination:'target',ids:['source-q'],parentId:target.chat.selectedId,sourceRevision:source.revision,destinationRevision:target.revision})
 expect(copied.destination.chat.messages.at(-1)?.images).toEqual([fixtureImage])
 expect(archive.load('owner','source')?.chat.messages[0].images).toEqual([fixtureImage])
 value.messages[0].images=[{...fixtureImage,dataUrl:'file:///private.jpg'}]
 expect(()=>archive.save('owner',value,source.revision)).toThrow('JPEG')
})
it('treats binned companion archives as absent and makes them readable again only after restore',()=>{
 ensureRecycleBin(db)
 db.exec('CREATE TABLE conversations(id TEXT,project_id TEXT,user_id TEXT,storage_mode TEXT)')
 db.prepare("INSERT INTO conversations VALUES ('source','project','owner','local')").run()
 const available=(owner:string,id:string)=>!!db.prepare(`SELECT 1 FROM conversations WHERE id=? AND user_id=? AND ${activeConversationSql()}`).get(id,owner)
 archive=new WorkspaceArchive(db,(owner,_project,id)=>{if(!available(owner,id))throw Error('Inactive chat')},()=>now,()=>{},undefined,available)
 archive.save('owner',chat('source'),0)
 db.prepare("INSERT INTO hadron_recycle_bin VALUES ('conversation','source','owner',?)").run(now)
 expect(archive.load('owner','source')).toBeNull()
 expect(()=>archive.save('owner',chat('source'),1)).toThrow('Inactive chat')
 db.exec("DELETE FROM hadron_recycle_bin")
 expect(archive.load('owner','source')?.chat.messages).toHaveLength(2)
 db.prepare("INSERT INTO hadron_recycle_bin VALUES ('project','project','owner',?)").run(now)
 expect(archive.load('owner','source')).toBeNull()
 expect(archive.load('foreign','source')).toBeNull()
})
it('stores drafts, branches and preferences without persisting live folder authority or resuming a job',()=>{
 const value=chat('source');value.draft='Next question';value.permission='agent';value.folder={id:'LIVE_GRANT_SENTINEL',label:'Private folder'};value.jobId='native-job';value.jobState='running'
 archive.save('owner',value,0)
 const loaded=archive.load('owner','source')!
 expect(loaded.chat.draft).toBe('Next question');expect(loaded.chat.permission).toBe('agent');expect(loaded.chat.folder).toBeUndefined();expect(loaded.chat.jobState).toBe('unknown')
 expect(db.prepare('SELECT body FROM hadron_workspace_chats').get().body).not.toContain('LIVE_GRANT_SENTINEL')
 expect(archive.load('foreign','source')).toBeNull()
})
it('appends two separately copied selections and does not repeat a copy after an uncertain acknowledgement',()=>{
 const source=archive.save('owner',chat('source'),0),target=archive.save('owner',chat('target','other-project'),0)
 const first={id:'copy-1',source:'source',destination:'target',ids:['source-q'],parentId:target.chat.selectedId,sourceRevision:source.revision,destinationRevision:target.revision}
 const copy1=archive.copy('owner',first),copy2=archive.copy('owner',{...first,id:'copy-2',ids:['source-a'],parentId:copy1.destination.chat.selectedId,destinationRevision:copy1.destination.revision})
 expect(workspaceMessagePath(copy2.destination.chat).map(message=>message.text)).toEqual(['Question target','Answer target','Question source','Answer source'])
 expect(copy2.destination.chat.messages.at(-1)?.origin).toBeUndefined()
 expect(copy2.destination.chat.messages.at(-1)?.reference).toMatchObject({chatId:'source',messageId:'source-a'})
 const retried=archive.copy('owner',first)
 expect(retried.ids).toEqual(copy1.ids);expect(archive.load('owner','target')?.chat.messages).toHaveLength(4)
 expect(archive.load('owner','source')?.chat.messages).toHaveLength(2)
})
it('rolls a move back if the destination cannot be saved, preserving the entire source',()=>{
 const source=archive.save('owner',chat('source'),0),target=archive.save('owner',chat('target'),0)
 db.exec("CREATE TRIGGER refuse_destination BEFORE UPDATE ON hadron_workspace_chats WHEN NEW.id='target' BEGIN SELECT RAISE(ABORT,'disk fixture failure'); END")
 expect(()=>archive.copy('owner',{id:'move',source:'source',destination:'target',ids:['source-a'],parentId:target.chat.selectedId,move:true,sourceRevision:source.revision,destinationRevision:target.revision})).toThrow('disk fixture failure')
 expect(archive.load('owner','source')?.chat.messages).toHaveLength(2);expect(archive.load('owner','target')?.chat.messages).toHaveLength(2);expect(archive.listBin('owner')).toHaveLength(0)
})
it('moves only selected messages, keeps descendants connected, and restores original branch links',()=>{
 const value=chat('source');value.messages.push({id:'follow-up',parentId:'source-a',role:'user',text:'Keep this descendant',state:'completed'});value.selectedId='follow-up'
 const source=archive.save('owner',value,0),target=archive.save('owner',chat('target'),0)
 const moved=archive.copy('owner',{id:'move',source:'source',destination:'target',ids:['source-a'],parentId:target.chat.selectedId,move:true,sourceRevision:source.revision,destinationRevision:target.revision})
 expect(moved.source.chat.messages.map((message:any)=>message.id)).toEqual(['source-q','follow-up'])
 expect(moved.source.chat.messages.at(-1).parentId).toBe('source-q');expect(moved.source.chat.messages.at(-1).edited).toBe(true)
 const restored=archive.restore('owner',moved.binId)
 expect(restored.chat.messages.map(message=>message.id)).toEqual(['source-q','source-a','follow-up'])
 expect(restored.chat.messages.at(-1)?.parentId).toBe('source-a');expect(archive.listBin('owner')).toHaveLength(0)
})
it('keeps a deleted selection for exactly 30 days and never extends retention by viewing the bin',()=>{
 const saved=archive.save('owner',chat('source'),0),removed=archive.trash('owner','source',['source-a'],saved.revision)
 const expires=now+RETENTION_MS
 expect(archive.listBin('owner')[0].expiresAt).toBe(expires)
 now=expires-1;expect(archive.listBin('owner')).toHaveLength(1)
 now=expires;expect(archive.listBin('owner')).toHaveLength(0)
 expect(()=>archive.restore('owner',removed.binId)).toThrow('no longer available')
})
it('rejects stale saves, broken branches and deletion of an active task, and retains notes',()=>{
 const value=chat('source'),saved=archive.save('owner',value,0)
 expect(()=>archive.save('owner',{...value,draft:'Stale edit'},0)).toThrow('another view')
 const noted=archive.note('owner','source',['source-a'],'Remember to test this',saved.revision)
 expect(noted.chat.messages.at(-1)?.note).toBe('Remember to test this')
 const broken={...value,messages:[{...value.messages[0],parentId:'missing'}]}
 expect(()=>archive.save('owner',broken,noted.revision)).toThrow('Missing branch parent')
 const active=archive.save('owner',{...noted.chat,jobId:'run',jobState:'running'},noted.revision)
 expect(()=>archive.trash('owner','source',['source-a'],active.revision)).toThrow('Wait for this task')
})
it('creates a named destination once, and rolls a failed new-project move back without leaving an empty project',()=>{
 const source=archive.save('owner',chat('source'),0)
 db.exec('CREATE TABLE created_projects(id TEXT PRIMARY KEY,name TEXT NOT NULL)')
 let calls=0
 const create=(_owner:string,input:any)=>{
  calls++;db.prepare('INSERT INTO created_projects VALUES (?,?)').run('new-project',input.projectName)
  return {...blankWorkspaceChat('other-project','new-chat'),title:input.title}
 }
 const input={id:'new-destination',source:'source',sourceRevision:source.revision,ids:['source-q','source-a'],projectName:'Andromeda Profitability',title:'Selected findings',move:true}
 expect(()=>archive.copyToNew('owner',{...input,sourceRevision:0},create)).toThrow('Conversation changed')
 expect(db.prepare('SELECT COUNT(*) AS count FROM created_projects').get().count).toBe(0)
 expect(archive.load('owner','source')?.chat.messages).toHaveLength(2)
 const result=archive.copyToNew('owner',input,create)
 expect(result.destination.chat.title).toBe('Selected findings');expect(result.destination.chat.messages).toHaveLength(2)
 const count=calls,retry=archive.copyToNew('owner',input,create)
 expect(calls).toBe(count);expect(retry.ids).toEqual(result.ids)
 expect(db.prepare('SELECT name FROM created_projects').get().name).toBe('Andromeda Profitability')
})
it('stores only copy receipt identities so later deletion cannot reappear through an old acknowledgement',()=>{
 const source=archive.save('owner',chat('source'),0),target=archive.save('owner',chat('target'),0)
 const input={id:'copy',source:'source',destination:'target',ids:['source-a'],parentId:target.chat.selectedId,sourceRevision:source.revision,destinationRevision:target.revision}
 const result=archive.copy('owner',input)
 expect(db.prepare('SELECT result FROM hadron_workspace_copies').get().result).not.toContain('Answer source')
 archive.trash('owner','target',result.ids,result.destination.revision)
 const retry=archive.copy('owner',input)
 expect(retry.destination.chat.messages.some((message:any)=>message.text==='Answer source')).toBe(false)
})

it('moves a highlighted portion, keeps both surrounding texts and restores the exact original',()=>{
 const source=archive.save('owner',chat('source'),0),target=archive.save('owner',chat('target'),0)
 const excerpts={'source-a':{start:0,end:6,text:'Answer'}}
 const moved=archive.copy('owner',{id:'partial-move',source:'source',destination:'target',ids:['source-a'],parentId:target.chat.selectedId,move:true,sourceRevision:source.revision,destinationRevision:target.revision,excerpts})
 expect(moved.destination.chat.messages.at(-1)?.text).toBe('Answer')
 expect(moved.source.chat.messages.at(-1)?.text).toBe(' source')
 expect(moved.source.chat.messages.at(-1)?.edited).toBe(true)
 expect(moved.source.chat.messages.at(-1)?.parentId).toBe('source-q')
 const restored=archive.restore('owner',moved.binId)
 expect(restored.chat.messages.at(-1)?.text).toBe('Answer source')
 expect(restored.chat.messages).toHaveLength(2)
})
it('recovers a removed excerpt as an alternative without overwriting a later deliberate edit',()=>{
 const source=archive.save('owner',chat('source'),0)
 const removed=archive.trash('owner','source',['source-a'],source.revision,{'source-a':{start:0,end:6,text:'Answer'}})
 const changed={...removed.chat,messages:removed.chat.messages.map(message=>message.id==='source-a'?{...message,text:'Later revision'}:message)}
 archive.save('owner',changed,removed.revision)
 const restored=archive.restore('owner',removed.binId)
 expect(restored.chat.messages.find(message=>message.id==='source-a')?.text).toBe('Later revision')
 expect(restored.chat.messages.at(-1)).toMatchObject({text:'Answer source',parentId:'source-q'})
})
it('rejects stale highlighted text and invalid offsets without moving any source text',()=>{
 const source=archive.save('owner',chat('source'),0)
 for(const range of [{start:0,end:6,text:'Wrong!'},{start:-1,end:5,text:'Answer'},{start:0,end:99,text:'Answer'}]){
  expect(()=>archive.trash('owner','source',['source-a'],source.revision,{'source-a':range})).toThrow('selected text changed')
 }
 expect(()=>archive.trash('owner','source',['source-a'],source.revision,{'missing':{start:0,end:6,text:'Answer'}})).toThrow('Invalid text selection')
 expect(archive.load('owner','source')?.chat.messages.at(-1)?.text).toBe('Answer source')
 expect(archive.listBin('owner')).toHaveLength(0)
})
it('follows an explicitly moved canonical chat into its new owned project without restoring old native context authority',()=>{
 let project='project'
 archive=new WorkspaceArchive(db,(_owner,actual)=>{if(actual!==project)throw Error('Wrong canonical project')},()=>now,()=>{},()=>project)
 const value={...chat('source'),nativeWorkspaceId:'old-workspace',peerChats:{b:'old-b'},draft:'Keep my draft'}
 archive.save('owner',value,0);project='other-project'
 const moved=archive.load('owner','source')!
 expect(moved.chat).toMatchObject({projectId:'other-project',nativeWorkspaceId:'source',draft:'Keep my draft'})
 expect(moved.chat.peerChats).toBeUndefined();expect(moved.chat.messages.every(message=>message.edited)).toBe(true)
 expect(moved.chat.messages.map(message=>message.text)).toEqual(value.messages.map(message=>message.text))
 expect(()=>archive.save('owner',moved.chat,moved.revision)).not.toThrow()
})
it('keeps a bounded sidebar preview in step with changed or removed messages',()=>{
 const saved=archive.save('owner',chat('source'),0)
 expect(db.prepare('SELECT preview FROM hadron_workspace_chats WHERE id=?').get('source').preview).toBe('Question source')
 archive.trash('owner','source',['source-q'],saved.revision)
 expect(db.prepare('SELECT preview FROM hadron_workspace_chats WHERE id=?').get('source').preview).toBe('Answer source')
})

it('keeps handover ownership and bounded public activity when the saved chat is reopened',()=>{
 const value=chat('handover');value.agent='b';value.sharedContinuation=true
 value.messages[1].activity=[{label:'Create file',state:'Completed',time:'2026-11-11T22:00:00Z'}]
 archive.save('owner',value,0)
 const loaded=archive.load('owner','handover')!.chat
 expect(loaded.sharedContinuation).toBe(true);expect(loaded.agent).toBe('b');expect(loaded.messages[1].activity).toEqual(value.messages[1].activity)
 value.id='invalid';value.messages[1].activity=Array.from({length:101},()=>({label:'Event',state:'Completed'}))
 expect(()=>archive.save('owner',value,0)).toThrow('Invalid saved activity')
})
