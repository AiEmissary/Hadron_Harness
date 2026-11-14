import {createRequire} from 'node:module'
import {expect,it,vi} from 'vitest'
import {HadronHelpers,lightweightModel} from '../hadronTools/helpers.js'
import {runHadronToolConversation} from '../hadronTools/types.js'
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE messages(id TEXT,meta TEXT)')
 const runs=new Map<string,any>([['parent',{id:'parent',status:'running',conversation_id:'workspace',parent_message_id:'anchor',provider:'openaichatgpt'}]])
 const agents={spawnDetached:vi.fn(async(request:any,admission:any)=>{const id='child-'+runs.size,handle='h-'+id;const run={id,handle,status:'running',provider:request.provider,model_name:request.modelName,prompt:request.prompt,conversation_id:request.conversationId,parent_message_id:request.parentMessageId,final_response:'Extracted supplied facts only.'};runs.set(id,run);admission.onPrepared({runId:id,handle,streamId:'s-'+id});run.status='completed';return {runId:id,handle,streamId:'s-'+id}}),cancel:vi.fn(),waitForTerminal:vi.fn(async(handle:string)=>[...runs.values()].find(run=>run.handle===handle))}
 const service=new HadronHelpers(db,{agents,runs:{getRunById:(id:string)=>runs.get(id)},models:()=>new Set(['gpt-6-luna','gpt-6-sol']),authorize:(owner,workspace)=>{if(owner!=='owner'||workspace!=='workspace')throw Error('denied')}})
 const controller=new AbortController(),input={owner:'owner',workspace:'workspace',anchor:'anchor',parentRun:'parent',provider:'openaichatgpt',assignment:{jobId:'job',role:'a'},signal:controller.signal}
 return {db,runs,agents,service,controller,input}
}
it('chooses only known lightweight available tiers from the same provider',()=>{
 expect(lightweightModel('openaichatgpt',new Set(['gpt-6-sol','gpt-6-luna','gpt-6-mini','gpt-6-nano']))).toBe('gpt-6-nano')
 expect(lightweightModel('claudecode',new Set(['sonnet','haiku','opus']))).toBe('haiku')
 expect(lightweightModel('claudecode',new Set(['sonnet','opus']))).toBeNull()
 expect(lightweightModel('openaichatgpt',new Set(['premium-unknown']))).toBeNull()
})
it('binds one-level children, returns evidence and enforces a shared two-helper agent/job budget',async()=>{
 const f=fixture();try{
  const session=f.service.decorate(undefined,f.input)!
  const args={task:'Extract names',context:'A and B are names.'}
  expect(await session.invoke('helper_analyse',args,f.controller.signal)).toMatchObject({model:'gpt-6-luna',verified:false})
  await session.invoke('helper_analyse',args,f.controller.signal)
  await expect(session.invoke('helper_analyse',args,f.controller.signal)).rejects.toThrow('budget')
  expect(f.agents.spawnDetached).toHaveBeenCalledTimes(2)
  for(const [request,admission] of f.agents.spawnDetached.mock.calls){expect(request.provider).toBe('openaichatgpt');expect(request.tools).toEqual([]);expect(admission.helpers).toBeUndefined()}
  expect(f.service.list('owner','workspace')).toHaveLength(2)
  expect(()=>f.service.list('other','workspace')).toThrow('denied')
  expect(f.agents.cancel).toHaveBeenCalledTimes(2)
 }finally{f.db.close()}
})
it('preserves project structured answers through the helper protocol and refuses ungranted file access',async()=>{
 const f=fixture();try{
  const session=f.service.decorate(undefined,f.input)!
  const answer={summary:'Change',changes:[{path:'README.md',expectedHash:null,text:'New README'}]}
  expect(JSON.parse(await runHadronToolConversation({session,task:'Propose',signal:f.controller.signal,generate:async()=>JSON.stringify(answer)}))).toEqual(answer)
  await expect(session.invoke('helper_read',{task:'Read',path:'secret'},f.controller.signal)).rejects.toThrow('grant')
  expect(f.agents.spawnDetached).not.toHaveBeenCalled()
 }finally{f.db.close()}
})
it('honours parent stop and does not recreate helpers on restart or preference disable',async()=>{
 const f=fixture();try{
  const session=f.service.decorate(undefined,f.input)!
  f.controller.abort();await expect(session.invoke('helper_analyse',{task:'Read',context:'text'},f.controller.signal)).rejects.toThrow()
  expect(f.agents.spawnDetached).not.toHaveBeenCalled()
  f.service.preference('owner',false);expect(f.service.decorate(undefined,{...f.input,signal:new AbortController().signal})).toBeUndefined()
 }finally{f.db.close()}
})
it('cancels and joins an in-flight child when the parent stops',async()=>{
 const f=fixture();try{
  f.agents.spawnDetached.mockImplementation(async(request:any,admission:any)=>{
   const run={id:'active-child',handle:'active-handle',status:'running',provider:request.provider,model_name:request.modelName,prompt:request.prompt,conversation_id:request.conversationId,parent_message_id:request.parentMessageId};f.runs.set(run.id,run);admission.onPrepared({runId:run.id,handle:run.handle,streamId:'s'});return {runId:run.id,handle:run.handle,streamId:'s'}
  })
  f.agents.waitForTerminal.mockImplementation(async(handle:string,signal?:AbortSignal)=>{
   if(signal&&!signal.aborted)await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}))
   return [...f.runs.values()].find(run=>run.handle===handle)
  })
  const pending=f.service.decorate(undefined,f.input)!.invoke('helper_analyse',{task:'Extract names',context:'A and B'},f.controller.signal)
  const result=expect(pending).rejects.toThrow()
  await vi.waitFor(()=>expect(f.service.list('owner','workspace')[0]?.state).toBe('running'))
  f.controller.abort();await result
  expect(f.agents.cancel).toHaveBeenCalledWith('active-handle')
  expect(f.agents.waitForTerminal).toHaveBeenLastCalledWith('active-handle')
  expect(f.service.list('owner','workspace')[0]?.state).toBe('cancelled')
 }finally{f.db.close()}
})
it('marks unfinished helpers interrupted on restart without dispatching another run',async()=>{
 const f=fixture();try{
  await f.service.decorate(undefined,f.input)!.invoke('helper_analyse',{task:'Extract names',context:'A and B'},f.controller.signal)
  f.db.prepare("UPDATE hadron_helpers SET state='running'").run();f.agents.spawnDetached.mockClear()
  const restarted=new HadronHelpers(f.db,{agents:f.agents,runs:{getRunById:(id:string)=>f.runs.get(id)},models:()=>new Set(['gpt-6-luna']),authorize:()=>{}})
  expect(restarted.list('owner','workspace')[0].state).toBe('interrupted')
  expect(f.agents.spawnDetached).not.toHaveBeenCalled()
 }finally{f.db.close()}
})

it('delegates a granted focused search to the lightweight same-provider helper without widening access',async()=>{
 const f=fixture();try{
  const invoke=vi.fn(async(name:string,args:unknown)=>{expect(name).toBe('project_search');return {matches:[{path:'src/a.ts',line:3,text:'needle'}],truncated:false}})
  const session=f.service.decorate({instructions:'Granted bounded project search',invoke},f.input)!
  await session.invoke('helper_search',{task:'Identify relevant code',query:'needle',path:'src'},f.controller.signal)
  expect(invoke).toHaveBeenCalledWith('project_search',{query:'needle',path:'src',mode:'content',maxResults:20},expect.any(AbortSignal))
  const request=f.agents.spawnDetached.mock.calls[0][0]
  expect(request.provider).toBe('openaichatgpt');expect(request.modelName).toBe('gpt-6-luna')
  expect(request.prompt).toContain('src/a.ts');expect(request.tools).toEqual([])
 }finally{f.db.close()}
})
it('condenses earlier Agent evidence using the same bounded helper quota, with no filesystem or tool access in the child',async()=>{
 const f=fixture();try{
  const base={execution:'agent' as const,maxRequests:100,instructions:'Agent tools',invoke:vi.fn(async()=>({success:true}))}
  const session=f.service.decorate(base,f.input)!
  expect(await session.condense!('Observed src/example.ts:14, read succeeded; no edits.',f.controller.signal)).toBe('Extracted supplied facts only.')
  expect(f.agents.spawnDetached.mock.calls[0][0]).toMatchObject({provider:'openaichatgpt',modelName:'gpt-6-luna',tools:[],maxTurns:1})
  expect(f.agents.spawnDetached.mock.calls[0][0].prompt).toContain('src/example.ts:14')
  expect(base.invoke).not.toHaveBeenCalled()
  await session.condense!('More evidence',f.controller.signal)
  await expect(session.condense!('Third summary',f.controller.signal)).rejects.toThrow('budget')
  expect(f.agents.spawnDetached).toHaveBeenCalledTimes(2)
 }finally{f.db.close()}
})
