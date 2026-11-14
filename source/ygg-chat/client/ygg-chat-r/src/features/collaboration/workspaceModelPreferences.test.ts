import {afterEach,expect,it,vi} from 'vitest'
import {workspaceModelPreferences} from './workspaceModelPreferences'
import {WorkspaceSession} from './workspaceSession'
import {blankWorkspaceChat} from './unifiedWorkspace'

const sessions:WorkspaceSession[]=[]
afterEach(()=>{for(const session of sessions.splice(0))session.dispose()})
const modelA={provider:'openaichatgpt' as const,modelName:'gpt-chosen'}
const modelB={provider:'claudecode' as const,modelName:'claude-chosen'}
function fixture(){
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}}
 const transport={create:vi.fn(()=>{throw Error('No inference in preference tests')})}
 const session=(project='project',id='chat',owner='owner',chat=blankWorkspaceChat(project,id))=>{
  const session=new WorkspaceSession(project,id,transport,undefined,chat,workspaceModelPreferences(owner,storage));sessions.push(session);return session
 }
 return {values,storage,transport,session}
}
it('remembers both agents across new chats, work types, projects and restart without carrying chat contents or file access',()=>{
 const f=fixture(),first=f.session()
 first.dispatch({type:'configure',chatId:'chat',models:{a:modelA,b:modelB},permission:'agent'})
 first.dispatch({type:'draft',chatId:'chat',text:'Private draft'})
 first.dispatch({type:'folder',chatId:'chat',folder:{id:'private-grant',label:'Private directory'}})
 first.open(blankWorkspaceChat('project','new'))
 expect(first.getSnapshot().state.chats.new).toMatchObject({models:{a:modelA,b:modelB},permission:'chat',messages:[],draft:''})
 expect(first.getSnapshot().state.chats.new.folder).toBeUndefined()
 for(const workType of ['together','continuous','individual'] as const){
  first.dispatch({type:'configure',chatId:'new',workType,agent:'b'})
  expect(first.getSnapshot().state.chats.new.models).toEqual({a:modelA,b:modelB})
 }
 const restarted=f.session('another-project','restarted')
 expect(restarted.getSnapshot().state.chats.restarted.models).toEqual({a:modelA,b:modelB})
 expect(f.transport.create).not.toHaveBeenCalled()
 expect([...f.values.values()].join('')).not.toMatch(/Private|private-grant|draft|permission|messages/)
})
it('keeps saved chat selections and does not replace the remembered choices just by opening older chats',()=>{
 const f=fixture(),s=f.session()
 s.dispatch({type:'configure',chatId:'chat',models:{a:modelA,b:modelB}})
 const historical={...blankWorkspaceChat('project','old'),models:{a:{...modelA,modelName:'older-model'}}}
 s.open(historical)
 expect(s.getSnapshot().state.chats.old.models.a?.modelName).toBe('older-model')
 expect(s.getSnapshot().state.chats.old.models.b).toEqual(modelB)
 expect(f.session('project','next').getSnapshot().state.chats.next.models).toEqual({a:modelA,b:modelB})
})
it('updates only the agent the user changes, even when an older chat has stale choices for the other agent',()=>{
 const f=fixture(),s=f.session()
 s.dispatch({type:'configure',chatId:'chat',models:{a:modelA,b:modelB}})
 s.open({...blankWorkspaceChat('project','old'),models:{a:modelA,b:{...modelB,modelName:'old-b'}}})
 s.dispatch({type:'configure',chatId:'old',models:{...s.getSnapshot().state.chats.old.models,a:{...modelA,modelName:'new-a'}}})
 expect(f.session('project','new').getSnapshot().state.chats.new.models).toEqual({a:{...modelA,modelName:'new-a'},b:modelB})
})
it('refreshes remembered choices when returning to a previously opened project',()=>{
 const f=fixture(),one=f.session('one','one-chat'),two=f.session('two','two-chat')
 one.dispatch({type:'configure',chatId:'one-chat',models:{a:modelA,b:modelB}})
 two.dispatch({type:'configure',chatId:'two-chat',models:{a:{...modelA,modelName:'newer-a'}}})
 one.open(blankWorkspaceChat('one','new-chat'))
 expect(one.getSnapshot().state.chats['new-chat'].models).toEqual({a:{...modelA,modelName:'newer-a'},b:modelB})
})
it('seeds preferences from existing choices on first use, without requiring the user to choose again',()=>{
 const f=fixture()
 f.session('project','saved','owner',{...blankWorkspaceChat('project','saved'),models:{a:modelA}})
 expect(f.session('another-project','new').getSnapshot().state.chats.new.models.a).toEqual(modelA)
})
it('keeps the chosen provider while its model selection is being changed and never guesses a replacement',()=>{
 const f=fixture(),s=f.session()
 s.dispatch({type:'configure',chatId:'chat',models:{a:modelA,b:modelB}})
 s.dispatch({type:'configure',chatId:'chat',models:{a:{provider:'claudecode',modelName:''}}})
 expect(f.session('project','new').getSnapshot().state.chats.new.models).toEqual({a:{provider:'claudecode',modelName:''},b:modelB})
})
it('isolates the remembered choices between local owners',()=>{
 const f=fixture(),s=f.session()
 s.dispatch({type:'configure',chatId:'chat',models:{a:modelA,b:modelB}})
 expect(f.session('project','other','another-owner').getSnapshot().state.chats.other.models).toEqual({})
})
it('ignores damaged preference data and drops unrecognised providers and unrelated properties',()=>{
 const f=fixture(),preferences=workspaceModelPreferences('owner',f.storage)
 f.storage.setItem('hadron:agent-models:owner','{broken')
 expect(preferences.load()).toEqual({})
 f.storage.setItem('hadron:agent-models:owner',JSON.stringify({a:{provider:'other-provider',modelName:'x'},b:{...modelB,token:'never copied'},folder:{id:'not-authority'}}))
 expect(preferences.load()).toEqual({b:modelB})
 preferences.save(preferences.load())
 expect([...f.values.values()].join('')).not.toMatch(/token|folder|other-provider/)
})
it('keeps the in-memory setup usable if preference storage is unavailable',()=>{
 const preferences=workspaceModelPreferences('owner',{getItem:()=>{throw Error('Storage unavailable')},setItem:()=>{throw Error('Storage unavailable')}})
 const s=new WorkspaceSession('project','chat',{create:()=>{throw Error('No inference')}},undefined,undefined,preferences);sessions.push(s)
 expect(()=>s.dispatch({type:'configure',chatId:'chat',models:{a:modelA,b:modelB}})).not.toThrow()
 s.open(blankWorkspaceChat('project','new'))
 expect(s.getSnapshot().state.chats.new.models).toEqual({a:modelA,b:modelB})
})
