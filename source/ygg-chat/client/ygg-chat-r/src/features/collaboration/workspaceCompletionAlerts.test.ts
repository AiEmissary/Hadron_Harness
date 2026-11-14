import {afterEach,expect,it,vi} from 'vitest'
import {WorkspaceSession} from './workspaceSession'
import {blankWorkspaceChat} from './unifiedWorkspace'
import {completionAlertText,type CompletionAlert} from '../../../../../shared/hadronCompletion'
import {watchWorkspaceCompletions,notifyWorkspaceCompletion,saveCompletionAlertMode} from './workspaceCompletionAlerts'
const sessions:WorkspaceSession[]=[]
afterEach(()=>{sessions.forEach(session=>session.dispose());sessions.length=0;vi.unstubAllGlobals()})
function fixture(){
 const session=new WorkspaceSession('project','chat',{create:()=>{throw Error('No inference in alert tests')}});sessions.push(session)
 const notify=vi.fn();watchWorkspaceCompletions(session,notify)
 const start=()=>session.dispatch({type:'job',chatId:'chat',id:'job',state:'running'})
 const finish=(state:'completed'|'failed'|'stopped'='completed')=>{session.dispatch({type:'message',chatId:'chat',message:{id:'answer',parentId:null,role:'assistant',agent:'a',text:'Result',state}});session.dispatch({type:'job',chatId:'chat',id:'job',state:'idle'})}
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
