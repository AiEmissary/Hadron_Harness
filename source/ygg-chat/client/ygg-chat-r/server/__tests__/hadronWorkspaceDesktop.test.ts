import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {WorkspaceArchive} from '../hadronTools/workspaceArchive'
import {DesktopWorkspaceRuntime} from '../../src/features/collaboration/workspaceDesktop'
import {blankWorkspaceChat,workspaceMessagePath} from '../../src/features/collaboration/unifiedWorkspace'
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
let db:any,archive:WorkspaceArchive,runtime:DesktopWorkspaceRuntime,native:any,independent:any,shared:any,lastShared:any,lastIndependent:any
const wait=async(check:()=>boolean)=>{for(let n=0;n<100;n++){if(check())return;await new Promise(resolve=>setImmediate(resolve))}throw Error('Desktop flow did not finish')}
beforeEach(()=>{
 db=new DatabaseSync(':memory:');archive=new WorkspaceArchive(db,()=>{})
 const storage=new Map();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)})
 native={workspaceArchive:{load:vi.fn(async(id:string)=>archive.load('owner',id)),save:vi.fn(async(chat:any,revision:number)=>archive.save('owner',chat,revision))},
  collaboration:{capability:vi.fn(async()=>{throw Error('No real desktop capability in this fixture')}),projectSelect:vi.fn(async()=>({id:'11111111-1111-4111-8111-111111111111',label:'Temporary fixture project'})),projectUse:vi.fn(async()=>({id:'22222222-2222-4222-8222-222222222222',label:'Temporary fixture project'})),projectAgent:vi.fn(async()=>({id:'33333333-3333-4333-8333-333333333333',label:'Temporary fixture project'})),agentRevoke:vi.fn(async()=>{})},
  continuousChat:{list:vi.fn(async()=>[]),start:vi.fn(async(input:any)=>({id:input.id,input,revision:1,state:'completed',workersEnded:true,turns:[{ordinal:1,role:'a',state:'completed',text:'A first reply'},{ordinal:2,role:'b',state:'completed',text:'B second reply'}],messages:[]}))},projectDraft:{list:vi.fn(async()=>[])}}
 independent={openWorkspace:vi.fn(async(id:string)=>({schemaVersion:1,requestedConversationId:id,workspaceConversationId:id,slot:null,nodeId:null})),workspace:vi.fn(async(source:string,slot:string)=>({schemaVersion:1,sourceConversationId:source,slot,nodes:[]})),
  prepare:vi.fn(async(input:any)=>({...input,conversationId:'native-backing-chat',anchorMessageId:'native-anchor'})),start:vi.fn(async(input:any)=>{
   const checkpoint=archive.load('owner','root')!;expect(checkpoint.chat.nativeJob?.id).toBe(input.id)
   expect(checkpoint.chat.messages.some(message=>message.role==='user'&&message.text===input.task)).toBe(true)
   return lastIndependent={schemaVersion:1,id:input.id,conversationId:input.conversationId,status:'completed',revision:1,provider:input.provider,modelName:input.modelName,runId:'native-run',streamId:null}
  }),status:vi.fn(async()=>lastIndependent),transcript:vi.fn(async(id:string)=>({id,status:'completed',text:'Files updated and checks passed (fixture).'})),stream:vi.fn(),stop:vi.fn()}
 const sharedStatus=(input:any)=>({schemaVersion:1,sessionId:input.sessionId,conversationId:'root',phase:'independent_proposals',status:'completed',revision:1,limits:{deadlineMs:120000,maxRequestsPerParticipant:1},participants:input.participants.map((item:any)=>({...item,status:'completed',runId:'run-'+item.id,streamId:null})),artifacts:[],error:null,collaboration:{phase:'finished',maxRequests:5,stages:[{id:'final',participantId:'a',modelName:input.participants[0].modelName,status:'completed',text:'Combined answer from both agents (fixture).',verified:false}]}})
 shared={tree:vi.fn(async()=>({nodes:[]})),prepareTask:vi.fn(async()=>({sourceLineageId:'lineage',anchorMessageId:'shared-anchor',context:'',messageCount:0})),preflight:vi.fn(async()=>{}),start:vi.fn(async(input:any)=>{expect(archive.load('owner','root')?.chat.nativeJob?.id).toBe(input.sessionId);return lastShared=sharedStatus(input)}),status:vi.fn(async()=>lastShared),stream:vi.fn(),stop:vi.fn(),transcript:vi.fn()}
 runtime=new DesktopWorkspaceRuntime('owner','project',native,{get:async(path:string)=>path.startsWith('/projects/')?{id:'project',user_id:'owner'}:path.endsWith('/messages')?[]:{id:'root',project_id:'project',user_id:'owner',title:'Desktop test',storage_mode:'local'}} as any,()=>{},{independent,shared} as any)
})
afterEach(()=>{runtime.dispose();db.close();vi.unstubAllGlobals()})
async function open(){await runtime.open('root');runtime.session.dispatch({type:'configure',chatId:'root',models:{a:{provider:'openaichatgpt',modelName:'model-a'},b:{provider:'claudecode',modelName:'model-b'}}})}
const active=()=>runtime.session.getSnapshot().state.chats.root
it('connects actual archive checkpoints, native folder rebinding, Agent permission and final task feedback',async()=>{
 await open();runtime.session.dispatch({type:'configure',chatId:'root',permission:'agent'})
 const folder=await runtime.chooseFolder(active());runtime.session.dispatch({type:'folder',chatId:'root',folder})
 expect(active().permission).toBe('agent')
 runtime.session.dispatch({type:'draft',chatId:'root',text:'Fix this fixture project'})
 await runtime.session.send();await wait(()=>active().jobState==='idle')
 expect(runtime.session.getSnapshot().errors.root).toBeNull()
 expect(independent.start).toHaveBeenCalledTimes(1)
 expect(independent.start.mock.calls[0][0]).toMatchObject({toolMode:'agent',projectGrantId:'33333333-3333-4333-8333-333333333333'})
 expect(native.collaboration.projectAgent).toHaveBeenCalledWith('root','a','22222222-2222-4222-8222-222222222222')
 expect(active().messages.at(-1)?.text).toContain('checks passed')
 await runtime.persistence.flush('root');expect(archive.load('owner','root')?.chat.messages.at(-1)?.text).toContain('checks passed')
})
it('uses the same chat and composer data for a direct shared task then a bounded continuous exchange',async()=>{
 await open();runtime.session.dispatch({type:'configure',chatId:'root',workType:'together'})
 runtime.session.dispatch({type:'draft',chatId:'root',text:'Discuss this together'});await runtime.session.send();await wait(()=>active().jobState==='idle')
 expect(active().messages.at(-1)?.text).toContain('Combined answer');expect(shared.start).toHaveBeenCalledTimes(1)
 runtime.session.dispatch({type:'configure',chatId:'root',workType:'continuous',maxTurns:100})
 runtime.session.dispatch({type:'draft',chatId:'root',text:'Continue taking turns'});await runtime.session.send();await wait(()=>active().jobState==='idle')
 expect(native.continuousChat.start.mock.calls[0][0].maxTurns).toBe(100)
 expect(active().messages.slice(-2).map(message=>message.text)).toEqual(['A first reply','B second reply'])
 expect(active().permission).toBe('chat')
})
it('does not dispatch a native task if the durable chat checkpoint fails',async()=>{
 await open();native.workspaceArchive.save.mockRejectedValue(Error('Disk unavailable'))
 runtime.session.dispatch({type:'draft',chatId:'root',text:'Keep this unsent instruction'})
 await runtime.session.send()
 expect(independent.start).not.toHaveBeenCalled();expect(shared.start).not.toHaveBeenCalled()
 expect(active().messages.some(message=>message.text==='Keep this unsent instruction')).toBe(true)
 expect(active().jobState).toBe('idle');expect(runtime.session.getSnapshot().errors.root).toContain('Disk unavailable')
})
it('reopens archive messages and both A/B drafts without creating replacements or dispatching tasks',async()=>{
 await open();runtime.session.dispatch({type:'draft',chatId:'root',text:'A draft'})
 runtime.session.open(blankWorkspaceChat('project','b-chat','b'));runtime.session.dispatch({type:'draft',chatId:'b-chat',text:'B draft'})
 await runtime.persistence.flushAll();runtime.dispose()
 runtime=new DesktopWorkspaceRuntime('owner','project',native,{get:async(path:string)=>path.startsWith('/projects/')?{id:'project',user_id:'owner'}:{id:'root',project_id:'project',user_id:'owner',title:'Desktop test',storage_mode:'local'}} as any,()=>{},{independent,shared} as any)
 await runtime.open('root')
 const state=runtime.session.getSnapshot().state
 expect(state.chats.root.draft).toBe('A draft');expect(state.chats['b-chat'].draft).toBe('B draft');expect(state.agentChats.b).toBe('b-chat')
 runtime.session.dispatch({type:'select-chat',id:'b-chat'})
 expect(runtime.session.getSnapshot().state.activeChatId).toBe('b-chat');expect(Object.keys(state.chats).sort()).toEqual(['b-chat','root'])
 expect(independent.start).not.toHaveBeenCalled();expect(shared.start).not.toHaveBeenCalled()
})
it('refreshes an already-open transfer destination without overwriting its draft or showing its old branch',async()=>{
 await open()
 runtime.session.dispatch({type:'message',chatId:'root',message:{id:'old',parentId:null,role:'user',text:'Existing message',state:'completed'}})
 runtime.session.dispatch({type:'select-message',chatId:'root',id:'old'})
 const target=await runtime.persistence.flush('root')
 runtime.session.dispatch({type:'draft',chatId:'root',text:'Keep my next question'})
 const source=archive.save('owner',{...blankWorkspaceChat('other-project','external'),selectedId:'external-answer',messages:[{id:'external-answer',parentId:null,role:'assistant',text:'Newly appended answer',state:'completed'}]},0)
 archive.copy('owner',{id:'external-transfer',source:'external',destination:'root',ids:['external-answer'],parentId:'old',sourceRevision:source.revision,destinationRevision:target.revision})
 await runtime.reload('root',true)
 expect(workspaceMessagePath(active()).map(message=>message.text)).toEqual(['Existing message','Newly appended answer'])
 expect(active().draft).toBe('Keep my next question')
 await runtime.persistence.flush('root');expect(archive.load('owner','root')?.chat.messages).toHaveLength(2)
 expect(independent.start).not.toHaveBeenCalled()
})

it('continues the shared result with B in the same saved chat and passes the selected context',async()=>{
 await open();runtime.session.dispatch({type:'configure',chatId:'root',workType:'together'})
 runtime.session.dispatch({type:'draft',chatId:'root',text:'Find the approach'})
 await runtime.session.send();await wait(()=>active().jobState==='idle')
 runtime.session.dispatch({type:'configure',chatId:'root',workType:'individual'})
 runtime.session.dispatch({type:'configure',chatId:'root',agent:'b'})
 expect(runtime.session.getSnapshot().state.activeChatId).toBe('root')
 runtime.session.dispatch({type:'draft',chatId:'root',text:'Now implement that approach'})
 await runtime.session.send();await wait(()=>active().jobState==='idle')
 expect(independent.start.mock.calls[0][0]).toMatchObject({provider:'claudecode',modelName:'model-b',task:'Now implement that approach'})
 expect(independent.start.mock.calls[0][0].context).toContain('Combined answer from both agents')
 expect(active().messages).toHaveLength(4);expect(Object.keys(runtime.session.getSnapshot().state.chats)).toEqual(['root'])
})
