import {expect,it} from 'vitest'
import type {AgentConversationNode} from '../../../../../shared/independentJobs'
import type {ContinuousChatView} from '../../../../../shared/continuousChat'
import type {ProjectDraftView} from '../../../../../shared/projectBuild'
import {agentHistoryChats,sharedHistoryChat,continuousHistoryChat,projectHistoryChat} from './workspaceHistory'
import {workspaceMessagePath} from './unifiedWorkspace'

const node=(id:string,parentId:string|null,conversationId='native-chat',status='completed'):AgentConversationNode=>({
 id,parentId,conversationId,status,kind:parentId?'response':'task',jobId:'job-'+id,text:id,provider:'claudecode',modelName:'sonnet',
})
it('preserves native branches and separate old chats without turning history into new jobs or permissions',()=>{
 const nodes=[node('q',null),node('a','q'),node('sibling','q'),node('other',null,'other-chat')]
 const before=JSON.stringify(nodes),chats=agentHistoryChats('project',{schemaVersion:1,sourceConversationId:'workspace',slot:'b',nodes})
 expect(chats).toHaveLength(2)
 expect(chats[0].messages.map(message=>message.id)).toEqual(['q','a','sibling'])
 expect(workspaceMessagePath(chats[0]).map(message=>message.id)).toEqual(['q','sibling'])
 expect(chats[0].agent).toBe('b');expect(chats[0].permission).toBe('chat');expect(chats[0].folder).toBeUndefined()
 expect(chats[0].messages[1].origin).toEqual({kind:'independent',id:'job-a',nodeId:'a'})
 expect(JSON.stringify(nodes)).toBe(before)
})
it('rejects broken topology instead of showing an apparently empty or overwritten chat',()=>{
 expect(()=>agentHistoryChats('p',{schemaVersion:1,sourceConversationId:'w',slot:'a',nodes:[node('a','missing')]})).toThrow('parent')
 expect(()=>sharedHistoryChat('p','w',[node('foreign',null)])).toThrow('another workspace')
 expect(()=>sharedHistoryChat('p','w',[node('a','b','w'),node('b','a','w')])).toThrow('cycle')
})
it('opens active history as unconfirmed work rather than enabling a duplicate send',()=>{
 const [chat]=agentHistoryChats('p',{schemaVersion:1,sourceConversationId:'w',slot:'a',nodes:[node('q',null),node('a','q','native-chat','running')]})
 expect(chat.jobState).toBe('unknown');expect(chat.jobId).toBe('job-a')
})
it('places saved continuous replies and interjections in conversational order including partial failure',()=>{
 const view:ContinuousChatView={id:'continuous',input:{id:'continuous',workspaceId:'w',anchorMessageId:'anchor',goal:'Discuss it',models:{a:'a-model',b:'b-model'},maxTurns:100,maxSeconds:3600},state:'failed',reason:'provider_error',revision:3,workersEnded:true,canResume:false,
  turns:[{ordinal:1,role:'a',state:'completed',text:'First reply',runId:'run-1'},{ordinal:2,role:'b',state:'failed',text:'Partial reply',runId:'run-2'}],messages:[{id:'injection',afterTurn:1,text:'Consider this'}]}
 const chat=continuousHistoryChat('p',view)
 expect(workspaceMessagePath(chat).map(message=>message.text)).toEqual(['Discuss it','First reply','Consider this','Partial reply'])
 expect(chat.messages.at(-1)?.state).toBe('failed');expect(chat.maxTurns).toBe(100);expect(chat.jobState).toBe('idle')
})
it('shows actual project progress with original replies and no invented coding success',()=>{
 const view:ProjectDraftView={id:'draft',state:'failed',input:{id:'draft',workspaceId:'w',anchorMessageId:'q',task:'Fix it',plan:'',deliverables:[],models:{a:'model-a',b:'model-b'},sourcePaths:[],participation:'b'},failure:'No usable changes',
  attempts:[{stage:'proposal',role:'b',model:'model-b',runId:'run',state:'completed',response:'I could not establish a fix.'}],drafts:[],tests:{status:'not_run'},projectFilesChanged:false,canApply:false,workersEnded:true,interventionRequired:false,journalAvailable:true,execution:{ready:false,reason:'No change'}}
 const chat=projectHistoryChat('p',view)
 expect(chat.agent).toBe('b');expect(chat.workType).toBe('individual')
 expect(chat.messages[1].text).toBe('I could not establish a fix.')
 expect(chat.messages.at(-1)?.text).toContain('Files changed: no. Tests: not run. Build: not run.')
 expect(chat.messages.at(-1)?.state).toBe('failed');expect(chat.folder).toBeUndefined()
})
