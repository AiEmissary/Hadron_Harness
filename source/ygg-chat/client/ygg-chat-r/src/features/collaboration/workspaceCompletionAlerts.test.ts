import {afterEach,expect,it,vi} from 'vitest'
import {WorkspaceSession} from './workspaceSession'
import {blankWorkspaceChat} from './unifiedWorkspace'
import {completionAlertText,type CompletionAlert} from '../../../../../shared/hadronCompletion'
import {watchWorkspaceCompletions,notifyWorkspaceCompletion,saveCompletionAlertMode} from './workspaceCompletionAlerts'
const sessions:WorkspaceSession[]=[]
afterEach(()=>{sessions.forEach(session=>session.dispose());sessions.length=0;vi.unstubAllGlobals()})
function fixture(){
 let changed!:(event:import('./workspaceRunner').WorkspaceRunEvent)=>void,index=0
 const initial=blankWorkspaceChat('project','chat');initial.models={a:{provider:'openaichatgpt',modelName:'fixture-a'},b:{provider:'claudecode',modelName:'fixture-b'}}
 const session=new WorkspaceSession('project','chat',{create:(_request,callback)=>{changed=callback;return{start:async()=>{},stop:async()=>changed({text:'Stopped',state:'stopped'}),recover:async()=>{},dispose:()=>{}}}},()=>++index===1?'job':`node-${index}`,initial);sessions.push(session)
 const notify=vi.fn();watchWorkspaceCompletions(session,notify)
 const start=()=>{session.dispatch({type:'draft',chatId:'chat',text:'Question'});void session.send()}
 const finish=(state:'completed'|'failed'|'stopped'='completed')=>changed({text:'Result',state})
 return{session,notify,start,finish}
}
it('announces a newly finished reply once and keeps working shared stages quiet',()=>{
 const f=fixture();f.session.dispatch({type:'configure',chatId:'chat',workType:'together'});f.start()
 f.session.dispatch({type:'message',chatId:'chat',message:{id:'proposal',parentId:null,role:'assistant',text:'A finished its own stage',state:'completed'}})
 expect(f.notify).not.toHaveBeenCalled();f.finish()
 expect(f.notify).toHaveBeenCalledWith({id:'job',projectId:'project',chatId:'chat',agent:'both',outcome:'completed'})
 f.session.dispatch({type:'draft',chatId:'chat',text:'Next question'})
 expect(f.notify).toHaveBeenCalledTimes(1)
})
it('notifies for the original chat when the user has switched to another chat',()=>{
 const f=fixture();f.start();f.session.open(blankWorkspaceChat('project','other','b'));f.finish()
 expect(f.notify.mock.calls[0][0].chatId).toBe('chat');expect(f.session.getSnapshot().state.activeChatId).toBe('other')
})
it('stays quiet for loaded historical results but notifies when a live task is stopped',()=>{
 const f=fixture();f.session.dispatch({type:'job',chatId:'chat',id:'old',state:'unknown'});f.session.dispatch({type:'job',chatId:'chat',id:'old',state:'idle'})
 expect(f.notify).not.toHaveBeenCalled();f.start();f.finish('stopped');expect(f.notify).toHaveBeenCalledWith({id:'job',projectId:'project',chatId:'chat',agent:'a',outcome:'stopped'})
 expect(completionAlertText(f.notify.mock.calls[0][0]).title).toContain('Not finished')
})
it('announces failure as needing attention, never as successful completion',()=>{
 const f=fixture();f.start();f.finish('failed');const input=f.notify.mock.calls[0][0]
 expect(completionAlertText(input).speech).toBe('Not finished.')
 expect(completionAlertText({...input,outcome:'completed'}).speech).toBe('I am done.')
 expect(completionAlertText({...input,outcome:'completed',agent:'both'}).speech).toBe('We are done.')
})
it('does not announce a host-saved partial record as successfully finished',()=>{
 const f=fixture();f.start()
 f.session.dispatch({type:'message',chatId:'chat',message:{id:'answer',parentId:null,role:'assistant',agent:'a',state:'completed',text:'Work stopped at the request or context limit before a final answer was produced. Saved evidence follows.'}})
 f.session.dispatch({type:'job',chatId:'chat',id:'job',state:'idle'})
 expect(f.notify.mock.calls[0][0].outcome).toBe('failed')
 expect(completionAlertText(f.notify.mock.calls[0][0]).title).toContain('Not finished')
 f.session.dispatch({type:'draft',chatId:'chat',text:'Follow up'})
 expect(f.notify).toHaveBeenCalledTimes(1)
})
function nativeFixture(){
 const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)})
 const notify=vi.fn(async()=>true),ping=vi.fn(async()=>{})
 vi.stubGlobal('window',{electronAPI:{completionAlerts:{notify,ping}}})
 return{notify,ping,input:{id:'job',chatId:'chat',projectId:'project',agent:'both',outcome:'completed'} as CompletionAlert}
}
it('defaults to a ping and sends no alert when switched off',async()=>{
 const f=nativeFixture();await notifyWorkspaceCompletion(f.input);expect(f.notify).toHaveBeenCalledWith(f.input,'ping')
 saveCompletionAlertMode('off');await notifyWorkspaceCompletion(f.input);expect(f.notify).toHaveBeenCalledTimes(1)
})
it('speaks only after a new alert is accepted and never pings if speech fails',async()=>{
 const f=nativeFixture(),speak=vi.fn();vi.stubGlobal('speechSynthesis',{speak});vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(public text:string){}})
 saveCompletionAlertMode('voice');await notifyWorkspaceCompletion(f.input)
 expect(f.notify).toHaveBeenCalledWith(f.input,'voice');expect(speak.mock.calls[0][0].text).toBe('We are done.')
 speak.mock.calls[0][0].onerror();expect(f.ping).not.toHaveBeenCalled()
 f.notify.mockResolvedValue(false);await notifyWorkspaceCompletion(f.input);expect(speak).toHaveBeenCalledTimes(1)
})
it('keeps voice notifications silent rather than selecting a ping when speech is unavailable',async()=>{
 const f=nativeFixture();saveCompletionAlertMode('voice')
 vi.stubGlobal('speechSynthesis',undefined);vi.stubGlobal('SpeechSynthesisUtterance',undefined)
 await notifyWorkspaceCompletion(f.input)
 expect(f.notify).toHaveBeenCalledWith(f.input,'voice');expect(f.ping).not.toHaveBeenCalled()
})

it('does not announce archived running jobs as recovery loads their saved completed answers',()=>{
 const f=fixture()
 for(let n=0;n<12;n++){
  const id='old-chat-'+n,job='old-job-'+n,chat=blankWorkspaceChat('project',id)
  chat.jobId=job;chat.jobState='unknown'
  chat.messages=[{id:'old-answer-'+n,parentId:null,role:'assistant',text:'Saved answer',state:'running'}]
  f.session.open(chat)
  // Recovery can report Running before it has finished reading a terminal transcript.
  f.session.dispatch({type:'job',chatId:id,id:job,state:'running'})
  f.session.dispatch({type:'message',chatId:id,message:{...chat.messages[0],state:'completed'}})
  f.session.dispatch({type:'job',chatId:id,id:job,state:'idle'})
 }
 expect(f.notify).not.toHaveBeenCalled()
 f.session.dispatch({type:'select-chat',id:'chat'});f.start();f.finish()
 expect(f.notify).toHaveBeenCalledTimes(1)
})
it('does not announce an old running chat already present when the watcher attaches',()=>{
 const initial=blankWorkspaceChat('project','saved')
 initial.jobId='saved-job';initial.jobState='running';initial.messages=[{id:'saved-answer',parentId:null,role:'assistant',text:'Saved answer',state:'completed'}]
 const create=vi.fn(()=>{throw Error('Restoration cannot send a request')})
 const session=new WorkspaceSession('project','saved',{create},undefined,initial);sessions.push(session)
 const notify=vi.fn();watchWorkspaceCompletions(session,notify)
 session.dispatch({type:'draft',chatId:'saved',text:'My unsent question'})
 session.dispatch({type:'job',chatId:'saved',id:'saved-job',state:'idle'})
 expect(notify).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled()
 expect(session.getSnapshot().state.chats.saved.draft).toBe('My unsent question')
})
