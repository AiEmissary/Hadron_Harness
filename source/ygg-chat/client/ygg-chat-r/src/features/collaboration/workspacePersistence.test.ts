import {afterEach,expect,it,vi} from 'vitest'
import {WorkspaceSession} from './workspaceSession'
import {WorkspacePersistence} from './workspacePersistence'
import {blankWorkspaceChat,type WorkspaceChat} from './unifiedWorkspace'
import type {ArchivedChat} from '../../../server/hadronTools/workspaceArchive'

const sessions:WorkspaceSession[]=[],stores:WorkspacePersistence[]=[]
afterEach(()=>{stores.forEach(store=>store.dispose());sessions.forEach(session=>session.dispose());stores.length=0;sessions.length=0})
function fixture(){
 const session=new WorkspaceSession('project','chat-a',{create(){throw Error('No provider calls in storage tests')}});sessions.push(session)
 const rows=new Map<string,ArchivedChat>()
 const api={load:vi.fn(async(id:string)=>rows.get(id)??null),save:vi.fn(async(chat:WorkspaceChat,revision:number)=>{
  if((rows.get(chat.id)?.revision??0)!==revision)throw Error('Revision changed')
  const saved={chat:structuredClone(chat),revision:revision+1};rows.set(chat.id,saved);return saved
 })}
 const store=new WorkspacePersistence(session,api,[],100000);stores.push(store)
 return {session,api,store,rows}
}
it('serializes each chat revision while retaining text typed during an earlier save',async()=>{
 const f=fixture();let release!:(value:ArchivedChat)=>void
 f.api.save.mockImplementationOnce((chat)=>new Promise(resolve=>{release=value=>{f.rows.set(chat.id,value);resolve(value)}}))
 f.session.dispatch({type:'draft',chatId:'chat-a',text:'First draft'})
 const first=f.store.flush('chat-a');await Promise.resolve()
 f.session.dispatch({type:'draft',chatId:'chat-a',text:'Latest draft'})
 const second=f.store.flush('chat-a')
 release({chat:structuredClone(f.api.save.mock.calls[0][0]),revision:1})
 await first;await second
 expect(f.api.save.mock.calls.map(call=>call[1])).toEqual([0,1])
 expect(f.rows.get('chat-a')?.chat.draft).toBe('Latest draft')
})
it('does not make B wait for A storage and keeps both drafts separate',async()=>{
 const f=fixture();let finish!:()=>void
 f.api.save.mockImplementationOnce((chat,revision)=>new Promise(resolve=>{finish=()=>resolve({chat,revision:revision+1})}))
 const a=f.store.flush('chat-a');await Promise.resolve()
 f.session.open(blankWorkspaceChat('project','chat-b','b'))
 f.session.dispatch({type:'draft',chatId:'chat-b',text:'B instruction'})
 await f.store.flush('chat-b')
 expect(f.rows.get('chat-b')?.chat.draft).toBe('B instruction')
 finish();await a
})
it('keeps an unsaved draft and reports a failed checkpoint before a task can be launched',async()=>{
 const f=fixture();f.api.save.mockRejectedValueOnce(Error('Storage unavailable'))
 f.session.dispatch({type:'draft',chatId:'chat-a',text:'Keep this message'})
 await expect(f.store.flush('chat-a')).rejects.toThrow('Storage unavailable')
 expect(f.session.getSnapshot().state.chats['chat-a'].draft).toBe('Keep this message')
 expect(f.session.getSnapshot().errors['chat-a']).toContain('could not be saved')
 expect(f.store.revision('chat-a')).toBe(0)
 await f.store.flush('chat-a');expect(f.rows.get('chat-a')?.revision).toBe(1)
})
it('saves and reloads an inline question branch without changing the original or consuming the main draft',async()=>{
 const f=fixture()
 f.session.dispatch({type:'configure',chatId:'chat-a',models:{a:{provider:'openaichatgpt',modelName:'model'}}})
 f.session.dispatch({type:'message',chatId:'chat-a',message:{id:'original',parentId:null,role:'user',text:'Original question',state:'completed'}})
 f.session.dispatch({type:'message',chatId:'chat-a',message:{id:'answer',parentId:'original',role:'assistant',text:'Original answer',state:'completed'}})
 f.session.dispatch({type:'select-message',chatId:'chat-a',id:'answer'})
 f.session.dispatch({type:'draft',chatId:'chat-a',text:'Unsent bottom draft'})
 const failed=await f.session.branch('chat-a','original','Alternative question')
 expect(failed).toBe(false);expect(f.session.getSnapshot().state.chats['chat-a'].messages).toHaveLength(2)
 // A separate session supplies a local completed transport instead of the storage fixture's request guard.
 const original=f.session.getSnapshot().state.chats['chat-a']
 const session=new WorkspaceSession('project','chat-a',{create:(_request,changed)=>({start:async()=>{changed({text:'Alternative answer',state:'completed'})},stop:async()=>{},recover:async()=>{},dispose:()=>{}})},undefined,structuredClone(original));sessions.push(session)
 const store=new WorkspacePersistence(session,f.api,[],100000);stores.push(store)
 expect(await session.branch('chat-a','original','Alternative question')).toBe(true)
 await store.flush('chat-a')
 const saved=await f.api.load('chat-a'),restored=new WorkspaceSession('project','chat-a',{create(){throw Error('Reload must not infer')}},undefined,saved!.chat);sessions.push(restored)
 const chat=restored.getSnapshot().state.chats['chat-a']
 expect(chat.messages.map(message=>message.text)).toEqual(['Original question','Original answer','Alternative question','Alternative answer'])
 expect(chat.messages[2].parentId).toBeNull();expect(chat.draft).toBe('Unsent bottom draft')
 expect(chat.selectedId).toBe(chat.messages[3].id)
})
