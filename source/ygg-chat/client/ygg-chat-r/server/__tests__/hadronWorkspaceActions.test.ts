import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it} from 'vitest'
import {WorkspaceArchive} from '../hadronTools/workspaceArchive'
import {WorkspaceSession} from '../../src/features/collaboration/workspaceSession'
import {WorkspacePersistence} from '../../src/features/collaboration/workspacePersistence'
import {WorkspaceActions} from '../../src/features/collaboration/workspaceActions'
import {blankWorkspaceChat,workspaceMessagePath,type WorkspaceChat} from '../../src/features/collaboration/unifiedWorkspace'
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
let db:any,archive:WorkspaceArchive,session:WorkspaceSession,persistence:WorkspacePersistence,opened:WorkspaceChat[],requests:number
beforeEach(()=>{
 db=new DatabaseSync(':memory:');archive=new WorkspaceArchive(db,()=>{});opened=[];requests=0
 const chat=blankWorkspaceChat('project','source')
 chat.messages=[{id:'q',parentId:null,role:'user',text:'Keep question',state:'completed'},{id:'a',parentId:'q',role:'assistant',text:'Move selected words only',state:'completed'}];chat.selectedId='a'
 const saved=archive.save('owner',chat,0)
 session=new WorkspaceSession('project','source',{create(){requests++;throw Error('Selections must not call models')}},undefined,chat)
 persistence=new WorkspacePersistence(session,{load:async id=>archive.load('owner',id),save:async(chat,revision)=>archive.save('owner',chat,revision)},[saved],100000)
})
afterEach(()=>{persistence.dispose();session.dispose();db.close()})
function actions(){return new WorkspaceActions({session,persistence,api:{
 copy:async input=>archive.copy('owner',input),copyNew:async input=>archive.copyToNew('owner',input,()=>({...blankWorkspaceChat(input.projectId??'new-project','new-chat'),title:input.title})),
 trash:async(id,ids,revision,excerpts)=>archive.trash('owner',id,ids,revision,excerpts),note:async(id,ids,text,revision)=>archive.note('owner',id,ids,text,revision),
},load:async id=>{const saved=archive.load('owner',id);if(!saved)throw Error('Missing destination');return saved},open:chat=>{opened.push(chat);if(chat.projectId==='project')session.open(chat)}})}
it('moves highlighted text through the real archive and opens a new chat without launching AI',async()=>{
 const result=await actions().transfer({chatId:'source',ids:['a'],excerpts:{a:{start:5,end:19,text:'selected words'}}},{projectName:'Andromeda Profitability',title:'Selected conclusions'},true,'transfer')
 expect(archive.load('owner','source')?.chat.messages.at(-1)?.text).toBe('Move  only')
 expect(session.getSnapshot().state.chats.source.messages.at(-1)?.text).toBe('Move  only')
 expect(opened[0]).toMatchObject({projectId:'new-project',title:'Selected conclusions'})
 expect(opened[0].messages[0].text).toBe('selected words');expect(requests).toBe(0)
 expect(result.binId).toBeTruthy()
})
it('appends successive selections into an existing chat and leaves both source and destination drafts intact',async()=>{
 const target={...blankWorkspaceChat('project','target'),draft:'Destination draft'}
 target.messages=[{id:'existing',parentId:null,role:'assistant',text:'Existing answer',state:'completed'}];target.selectedId='existing'
 const saved=archive.save('owner',target,0);session.open(target);persistence.accept(saved)
 session.dispatch({type:'draft',chatId:'source',text:'My next question'})
 const controller=actions()
 await controller.transfer({chatId:'source',ids:['q']},{projectId:'project',chatId:'target'},false,'copy-question')
 await controller.transfer({chatId:'source',ids:['a']},{projectId:'project',chatId:'target'},false,'copy-answer')
 const state=session.getSnapshot().state
 expect(workspaceMessagePath(state.chats.target).map(message=>message.text)).toEqual(['Existing answer','Keep question','Move selected words only'])
 expect(state.chats.source.draft).toBe('My next question');expect(state.chats.target.draft).toBe('Destination draft')
 await persistence.flushAll()
 expect(archive.load('owner','target')?.chat.draft).toBe('Destination draft');expect(requests).toBe(0)
})
it('keeps the source visible and unchanged if a native transfer fails',async()=>{
 const target=archive.save('owner',blankWorkspaceChat('other-project','target'),0)
 db.exec("CREATE TRIGGER refuse BEFORE UPDATE ON hadron_workspace_chats WHEN NEW.id='target' BEGIN SELECT RAISE(ABORT,'disk full'); END")
 await expect(actions().transfer({chatId:'source',ids:['a']},{projectId:target.chat.projectId,chatId:'target'},true,'move')).rejects.toThrow('disk full')
 expect(opened).toHaveLength(0);expect(session.getSnapshot().state.chats.source.messages).toHaveLength(2)
 expect(archive.load('owner','source')?.chat.messages).toHaveLength(2);expect(requests).toBe(0)
})
it('persists notes and recoverable removal through the same action controller',async()=>{
 const controller=actions();await controller.note({chatId:'source',ids:['a']},'Check this first')
 expect(session.getSnapshot().state.chats.source.messages.at(-1)?.note).toBe('Check this first')
 await controller.remove({chatId:'source',ids:['a']})
 expect(session.getSnapshot().state.chats.source.messages.map(message=>message.id)).toEqual(['q'])
 expect(archive.listBin('owner')).toHaveLength(1);expect(requests).toBe(0)
})
