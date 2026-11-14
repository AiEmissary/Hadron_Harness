import {afterEach,expect,it,vi} from 'vitest'
import {WorkspaceSession} from './workspaceSession'
import {observeWorkspaceJob} from './workspaceRecovery'
import {blankWorkspaceChat} from './unifiedWorkspace'
import {IndependentJobMissing} from './independentClient'
it('unlocks an orphaned admission only after the host fences late Start, retaining saved output and the unsent draft',async()=>{
 const f=fixture();f.deps.independent.status=vi.fn(async()=>{throw new IndependentJobMissing()})
 f.deps.independent.closeUnstarted=vi.fn(async()=>true)
 observeWorkspaceJob(f.session,'chat',f.deps);await wait(()=>f.chat().jobState==='idle')
 expect(f.deps.independent.closeUnstarted).toHaveBeenCalledWith('native','chat','a')
 expect(f.chat().messages.at(-1)).toMatchObject({text:'Partial saved output',state:'failed'})
 expect(f.chat().draft).toBe('My next unsent question');expect(f.dispatch).not.toHaveBeenCalled()
 expect(f.session.getSnapshot().errors.chat).toContain('unavailable task is closed')
})
it('keeps controls fenced when a missing admission cannot be closed or a network check fails',async()=>{
 const f=fixture();f.deps.independent.status=vi.fn(async()=>{throw new IndependentJobMissing()})
 f.deps.independent.closeUnstarted=vi.fn(async()=>false)
 observeWorkspaceJob(f.session,'chat',f.deps);await wait(()=>f.deps.independent.closeUnstarted.mock.calls.length>0)
 expect(f.chat().jobState).not.toBe('idle');expect(f.chat().messages.at(-1)?.text).toBe('Partial saved output');expect(f.dispatch).not.toHaveBeenCalled()
})
const sessions:WorkspaceSession[]=[]
afterEach(()=>{sessions.forEach(session=>session.dispose());sessions.length=0;vi.unstubAllGlobals()})
const wait=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setImmediate(resolve))}throw Error('Recovery did not settle')}
function fixture(kind:'independent'|'continuous'|'shared'='independent'){
 const items=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>items.get(key)??null,setItem:(key:string,value:string)=>items.set(key,value),removeItem:(key:string)=>items.delete(key)})
 const chat={...blankWorkspaceChat('project','chat'),nativeJob:{kind,id:'native'},jobId:'ui-request',jobState:'unknown' as const,draft:'My next unsent question'}
 chat.messages=[{id:'q',parentId:null,role:'user',text:'Saved question',state:'completed'},{id:'a',parentId:'q',role:'assistant',text:'Partial saved output',state:'running'}];chat.selectedId='a'
 const dispatch=vi.fn(()=>{throw Error('Recovery cannot launch inference')})
 const session=new WorkspaceSession('project','chat',{create:dispatch},undefined,chat);sessions.push(session)
 const independent={start:dispatch,prepare:dispatch,status:vi.fn(async()=>({schemaVersion:1,id:'native',conversationId:'native-conversation',status:'completed',revision:1,provider:'openaichatgpt',modelName:'model',runId:'run',streamId:null})),transcript:vi.fn(async()=>({id:'native',status:'completed',text:'Saved final answer'})),stream:vi.fn(),stop:vi.fn()}
 const deps={independent,shared:{start:dispatch},continuous:{start:dispatch,continueSaved:dispatch,resume:dispatch},project:{start:dispatch},pollMs:100000} as any
 return {session,deps,dispatch,chat:()=>session.getSnapshot().state.chats.chat}
}
it('recovers saved final output without another Start and preserves the unsent question',async()=>{
 const f=fixture();observeWorkspaceJob(f.session,'chat',f.deps);await wait(()=>f.chat().jobState==='idle')
 expect(f.chat().messages.at(-1)?.text).toBe('Saved final answer');expect(f.chat().draft).toBe('My next unsent question');expect(f.dispatch).not.toHaveBeenCalled()
 expect(f.deps.independent.status).toHaveBeenCalledTimes(2)
})
it('restores continuous replies into the original branch and never resumes or duplicates the topic',async()=>{
 const f=fixture('continuous')
 f.deps.continuous.status=vi.fn(async()=>({id:'native',revision:1,workersEnded:true,state:'stopped',turns:[{ordinal:1,role:'a',state:'completed',text:'A reply'},{ordinal:2,role:'b',state:'completed',text:'B reply'}],messages:[]}))
 observeWorkspaceJob(f.session,'chat',f.deps);await wait(()=>f.chat().jobState==='idle')
 expect(f.chat().messages.map(message=>message.text)).toEqual(['Saved question','A reply','B reply'])
 expect(f.chat().messages.at(-1)?.parentId).toBe('a');expect(f.dispatch).not.toHaveBeenCalled()
})
it('detaches while a recovery read is pending without stopping work or modifying its saved output',async()=>{
 const f=fixture();let resolve!:(value:any)=>void
 f.deps.independent.status=vi.fn(()=>new Promise(done=>{resolve=done}))
 observeWorkspaceJob(f.session,'chat',f.deps);f.session.dispose();resolve({id:'native',conversationId:'native-conversation',status:'completed'})
 await new Promise(done=>setImmediate(done))
 expect(f.chat().messages.at(-1)?.text).toBe('Partial saved output');expect(f.deps.independent.stop).not.toHaveBeenCalled();expect(f.dispatch).not.toHaveBeenCalled()
})

it('recovers the failed review explanation and completed peer work without another model request',async()=>{
 const f=fixture('shared')
 f.deps.shared.status=vi.fn(async()=>({schemaVersion:1,sessionId:'native',conversationId:'chat',status:'failed',revision:2,phase:'independent_proposals',participants:[{id:'a',provider:'openaichatgpt',modelName:'model',status:'completed',runId:'run-a',streamId:null},{id:'b',provider:'claudecode',modelName:'sonnet',status:'completed',runId:'run-b',streamId:null}],artifacts:[],error:'Agent A (ChatGPT) could not complete its review.',collaboration:{phase:'reviews',maxRequests:5,stages:[{id:'review_b',participantId:'b',modelName:'sonnet',status:'completed',text:'B checked the implementation.',verified:false}]}}))
 f.deps.shared.transcript=vi.fn(async()=>({text:'Saved implementation report'}))
 observeWorkspaceJob(f.session,'chat',f.deps);await wait(()=>f.chat().jobState==='idle')
 expect(f.chat().messages.at(-1)?.text).toContain('could not complete its review')
 expect(f.chat().messages.at(-1)?.text).toContain('B checked the implementation')
 expect(f.chat().messages.at(-1)?.state).toBe('failed')
 expect(f.chat().draft).toBe('My next unsent question')
 expect(f.dispatch).not.toHaveBeenCalled()
})
