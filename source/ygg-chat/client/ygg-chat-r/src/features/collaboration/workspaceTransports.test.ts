import {afterEach,expect,it,vi} from 'vitest'
import type {ProposalSessionInput,ProposalSessionStatus,ProposalTranscript} from '../../../../../shared/collaboration'
import type {ContinuousChatApi,ContinuousChatView} from '../../../../../shared/continuousChat'
import {sharedWorkspaceTransport} from './workspaceSharedTransport'
import {individualWorkspaceTransport} from './workspaceIndependentTransport'
import {continuousWorkspaceTransport} from './workspaceContinuousTransport'
import type {WorkspaceRunRequest,WorkspaceRunEvent,WorkspaceRunHandle} from './workspaceRunner'
const handles:WorkspaceRunHandle[]=[]
afterEach(()=>{for(const handle of handles)handle.dispose();handles.length=0})
const request=(workType:WorkspaceRunRequest['workType']):WorkspaceRunRequest=>({id:'request',chatId:'chat',projectId:'project',workType,permission:'chat',agent:'a',models:{a:{provider:'openaichatgpt',modelName:'model-a'},b:{provider:'claudecode',modelName:'model-b'}},maxTurns:100,folder:undefined,question:{id:'question',parentId:null,role:'user',text:'Continue this work',state:'completed'},answerId:'answer',path:[]})
const wait=async(condition:()=>boolean)=>{for(let i=0;i<100;i++){if(condition())return;await new Promise(resolve=>setImmediate(resolve))}throw Error('Task did not settle')}
const sharedStatus=(status='completed'):ProposalSessionStatus=>({schemaVersion:1,sessionId:'request',conversationId:'workspace',phase:'independent_proposals',status:status as ProposalSessionStatus['status'],revision:1,limits:{deadlineMs:120000,maxRequestsPerParticipant:1},participants:[{id:'a',provider:'openaichatgpt',modelName:'model-a',status:'completed',runId:'run-a',streamId:null},{id:'b',provider:'claudecode',modelName:'model-b',status:'completed',runId:'run-b',streamId:null}],artifacts:[],error:null,collaboration:{phase:'finished',maxRequests:5,stages:[{id:'final',participantId:'a',modelName:'model-a',status:'completed',text:'Here is the combined answer.',verified:false}]}})
it('can send a drawing-heavy GPT conversation to Claude without a manual excerpt',async()=>{
 const input=request('individual');input.images=[fixtureImage];input.agent='b';input.question.text='Give me an outline of a cow with long horns'
 input.path=[{id:'drawing',parentId:null,role:'assistant',agent:'a',provider:'openaichatgpt',text:'```svg\n<svg>'+'.'.repeat(30000)+'</svg>\n```',state:'completed'}]
 let saved:any=null
 const client={prepare:vi.fn(async(value:any)=>({...value,conversationId:'native',anchorMessageId:'anchor'})),start:vi.fn(async(value:any)=>({schemaVersion:1 as const,id:value.id,conversationId:'native',status:'running',revision:1,provider:'claudecode' as const,modelName:'model-b',runId:'run',streamId:'stream'})),status:vi.fn(),stop:vi.fn(),transcript:vi.fn(),stream:vi.fn(async()=>({cursor:0,terminal:true as const}))}
 const handle=individualWorkspaceTransport({client,workspaceId:'workspace',store:()=>({read:()=>saved,write:value=>{saved=value},clear:()=>{saved=null}}),pollMs:100000}).create(input,()=>{});handles.push(handle)
 await handle.start()
 expect(client.start).toHaveBeenCalledTimes(1)
 expect(client.start.mock.calls[0][0]).toMatchObject({provider:'claudecode',toolMode:'web',task:input.question.text,images:[fixtureImage]})
 expect(client.start.mock.calls[0][0].context.length).toBeLessThanOrEqual(16000)
 expect(input.path[0].text.length).toBeGreaterThan(30000)
})
function sharedFixture(){
 let saved:any=null
 const client={prepareTask:vi.fn(async()=>({conversationId:'workspace',sourceLineageId:'lineage',anchorMessageId:'anchor',context:'',messageCount:0})),preflight:vi.fn(async()=>{}),start:vi.fn(async(_input:ProposalSessionInput)=>sharedStatus()),status:vi.fn(async()=>sharedStatus()),stream:vi.fn(async()=>({cursor:0,terminal:true as const})),stop:vi.fn(async()=>sharedStatus('cancelled')),transcript:vi.fn(async(id:string,participant:string):Promise<ProposalTranscript>=>({schemaVersion:1 as const,sessionId:id,participantId:participant,runId:'run-'+participant,status:'completed' as const,text:'Saved '+participant,verified:false as const}))}
 const store={read:()=>saved,write:(value:any)=>{saved=value},clear:()=>{saved=null}}
 const events:WorkspaceRunEvent[]=[]
 return {client,store,events,saved:()=>saved,make:(input=request('together'))=>{const handle=sharedWorkspaceTransport({client,workspaceId:'workspace',store:()=>store,pollMs:100000}).create(input,event=>events.push(event));handles.push(handle);return handle}}
}
it('sends a shared follow-up directly from the selected combined answer with both selected models',async()=>{
 const f=sharedFixture(),input=request('together');input.images=[fixtureImage]
 input.folder={id:'read-grant',label:'Folder'}
 input.path=[{id:'previous',parentId:null,role:'assistant',text:'Previous answer',state:'completed',origin:{kind:'shared',id:'shared:previous-session',nodeId:'final'}}]
 await f.make(input).start();await wait(()=>f.events.some(event=>event.state==='completed'))
 expect(f.client.start).toHaveBeenCalledTimes(1)
 expect(f.client.start.mock.calls[0][0]).toMatchObject({images:[fixtureImage],parentSessionId:'previous-session',includeParentContext:true,projectGrantId:'read-grant',participants:[{id:'a',provider:'openaichatgpt'},{id:'b',provider:'claudecode'}]})
 expect(f.events.at(-1)?.text).toBe('Here is the combined answer.');expect(f.saved()).toBeNull()
})
it('keeps available replies visible when a shared task fails before synthesis',async()=>{
 const f=sharedFixture(),failed=sharedStatus('failed');failed.collaboration!.stages=[]
 f.client.status.mockResolvedValue(failed)
 await f.make().start();await wait(()=>f.events.some(event=>event.state==='failed'))
 expect(f.events.at(-1)?.text).toContain('Saved a');expect(f.events.at(-1)?.text).toContain('Saved b')
 expect(f.client.start).toHaveBeenCalledTimes(1)
})
it('shows the saved failure explanation in the reply when neither participant produced text',async()=>{
 const f=sharedFixture(),failed=sharedStatus('failed');failed.collaboration!.stages=[]
 failed.error='Agent B (Claude) needs you to reconnect Claude. Agent A was stopped when the shared task failed.'
 f.client.status.mockResolvedValue(failed)
 f.client.transcript.mockImplementation(async(id,participant)=>({schemaVersion:1 as const,sessionId:id,participantId:participant,runId:'run-'+participant,status:'error' as const,text:'',verified:false as const}))
 await f.make().start();await wait(()=>f.events.some(event=>event.state==='failed'))
 expect(f.events.at(-1)?.text).toBe(failed.error);expect(f.client.start).toHaveBeenCalledTimes(1)
})
it('Stop during shared preparation prevents both provider requests',async()=>{
 const f=sharedFixture();let release!:()=>void
 f.client.preflight.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve}))
 const handle=f.make(),launch=handle.start();await wait(()=>!!release)
 await handle.stop();release();await launch
 expect(f.client.start).not.toHaveBeenCalled();expect(f.events.at(-1)?.state).toBe('stopped')
})
it('Stop during individual preparation prevents its inference launch',async()=>{
 let saved:any=null,release!:(value:any)=>void
 const client={prepare:vi.fn((input:any)=>new Promise<any>(resolve=>{release=()=>resolve({...input,conversationId:'native',anchorMessageId:'anchor'})})),start:vi.fn(),status:vi.fn(),stop:vi.fn(),transcript:vi.fn(),stream:vi.fn()}
 const events:WorkspaceRunEvent[]=[],handle=individualWorkspaceTransport({client,workspaceId:'workspace',store:()=>({read:()=>saved,write:value=>{saved=value},clear:()=>{saved=null}})}).create(request('individual'),event=>events.push(event));handles.push(handle)
 const launch=handle.start();await wait(()=>!!release);await handle.stop();release(null);await launch
 expect(client.start).not.toHaveBeenCalled();expect(events.at(-1)?.state).toBe('stopped');expect(saved).toBeNull()
})
it('uses a distinct native Agent capability for shared coding while retaining the selected models and conversation',async()=>{
 const f=sharedFixture(),input=request('together');input.images=[fixtureImage];const access=vi.fn(async()=>({id:'agent-capability'})),release=vi.fn()
 input.permission='agent';input.folder={id:'read-only-capability',label:'Project'}
 const handle=sharedWorkspaceTransport({client:f.client,workspaceId:'workspace',store:()=>f.store,agentAccess:access,releaseAgent:release}).create(input,event=>f.events.push(event));handles.push(handle)
 await handle.start();await wait(()=>f.events.some(event=>event.state==='completed'))
 expect(access).toHaveBeenCalledTimes(1)
 expect(f.client.start.mock.calls[0][0]).toMatchObject({projectMode:'agent',projectGrantId:'agent-capability'})
 expect(release).toHaveBeenCalledWith('agent-capability')
 expect(input.folder.id).toBe('read-only-capability')
})
it('does not confuse an individual read grant with permission to edit',async()=>{
 const input=request('individual');input.permission='agent';input.folder={id:'read-only-capability',label:'Project'}
 let saved:any=null
 const access=vi.fn(async()=>({id:'11111111-1111-4111-8111-111111111111'}))
 const client={prepare:vi.fn(async(value:any)=>({...value,conversationId:'native',anchorMessageId:'anchor'})),start:vi.fn(async(value:any)=>({schemaVersion:1 as const,id:value.id,conversationId:'native',status:'running',revision:1,provider:'openaichatgpt' as const,modelName:'model-a',runId:'run',streamId:'stream'})),status:vi.fn(),stop:vi.fn(),transcript:vi.fn(),stream:vi.fn(async()=>({cursor:0,terminal:true as const}))}
 const store=()=>({read:()=>saved,write:(value:any)=>{saved=value},clear:()=>{saved=null}})
 expect(()=>individualWorkspaceTransport({client,workspaceId:'workspace',store}).create(input,()=>{})).toThrow('coding folder')
 const handle=individualWorkspaceTransport({client,workspaceId:'workspace',store,agentAccess:access,pollMs:100000}).create(input,()=>{});handles.push(handle)
 await handle.start()
 expect(client.start.mock.calls[0][0]).toMatchObject({toolMode:'agent',projectGrantId:'11111111-1111-4111-8111-111111111111'})
 expect(input.folder.id).toBe('read-only-capability')
})
it('projects continuous replies as separate chronological messages and pauses at the saved native limit',async()=>{
 const input=request('continuous');input.images=[fixtureImage];const view:ContinuousChatView={id:input.id,input:{id:input.id,workspaceId:'workspace',anchorMessageId:'anchor',goal:input.question.text,models:{a:'model-a',b:'model-b'},maxTurns:100,maxSeconds:3600},state:'paused',reason:'turn_budget',revision:3,workersEnded:true,canResume:true,
  turns:[{ordinal:1,role:'a',state:'completed',text:'A reply',runId:'run-a'},{ordinal:2,role:'b',state:'completed',text:'B reply',runId:'run-b'}],messages:[]}
 const api={start:vi.fn(async()=>view),status:vi.fn(async()=>view),stop:vi.fn(async()=>view),continueSaved:vi.fn(async()=>view)} as unknown as ContinuousChatApi
 const events:WorkspaceRunEvent[]=[],remember=vi.fn(),handle=continuousWorkspaceTransport({api,workspaceId:'workspace',anchor:async()=>'anchor',remember}).create(input,event=>events.push(event));handles.push(handle)
 await handle.start()
 expect(api.start).toHaveBeenCalledTimes(1);expect(api.start).toHaveBeenCalledWith(expect.objectContaining({images:[fixtureImage],maxTurns:100,providers:{a:'openaichatgpt',b:'claudecode'}}))
 expect(events.at(-1)?.replies?.map(reply=>[reply.agent,reply.text])).toEqual([['a','A reply'],['b','B reply']])
 expect(events.at(-1)?.state).toBe('completed');expect(remember).toHaveBeenLastCalledWith(null)
})

it('shows the failed stage and completed peer review alongside saved work when synthesis cannot finish',async()=>{
 const f=sharedFixture(),failed=sharedStatus('failed')
 failed.error='Agent A (ChatGPT) could not complete its review. Reason: request limit.'
 failed.collaboration!.stages=[{id:'review_b',participantId:'b',modelName:'model-b',status:'completed',text:'B reviewed the calculator and found an arithmetic edge case.',verified:false}]
 f.client.status.mockResolvedValue(failed)
 await f.make().start();await wait(()=>f.events.some(event=>event.state==='failed'))
 expect(f.events.at(-1)?.text).toContain('could not complete its review')
 expect(f.events.at(-1)?.text).toContain('Saved work — not a combined answer')
 expect(f.events.at(-1)?.text).toContain('B reviewed the calculator')
 expect(f.client.start).toHaveBeenCalledTimes(1)
})
import {fixtureImage} from '../../../../../shared/__fixtures__/hadronImage'
it.each(['pasted','attached'] as const)('accepts long %s continuous follow-ups with unchanged text and current folder/models',async source=>{
 const input=request('continuous'),text='Compare all figures and reach a conclusion.\n'+'Report evidence and constraints. '.repeat(300)
 input.question.text=source==='pasted'?text:'Read report.txt and compare it with this discussion.'
 if(source==='attached')input.question.context=JSON.stringify({files:[{name:'report.txt',text}]})
 input.folder={id:'read-grant',label:'Chosen folder'}
 input.path=[{id:'last',parentId:null,role:'assistant',text:'Previous conclusion.',state:'completed',origin:{kind:'continuous',id:'saved-source',nodeId:'turn:4',fullContext:true}}]
 const view={id:input.id,input:{},state:'paused',reason:'consensus_reached',revision:1,workersEnded:true,canResume:true,turns:[],messages:[]} as unknown as ContinuousChatView
 const api={start:vi.fn(),continueSaved:vi.fn(async()=>view),status:vi.fn(async()=>view),stop:vi.fn(async()=>view)} as unknown as ContinuousChatApi
 const handle=continuousWorkspaceTransport({api,workspaceId:'workspace',anchor:async()=>'anchor',remember:()=>{}}).create(input,()=>{});handles.push(handle)
 await handle.start()
 expect(api.start).not.toHaveBeenCalled();expect(api.continueSaved).toHaveBeenCalledTimes(1)
 expect(api.continueSaved).toHaveBeenCalledWith('saved-source',expect.objectContaining({instruction:[input.question.text,input.question.context].filter(Boolean).join('\n\n'),projectGrantId:'read-grant',models:{a:'model-a',b:'model-b'}}))
})
it('admits a long initial continuous question with its context instead of the legacy 12K cap',async()=>{
 const input=request('continuous');input.question.text='全文📘 '.repeat(5000);input.question.context='Retain these constraints.'
 const view={id:input.id,state:'paused',revision:1,workersEnded:true,turns:[],messages:[]} as unknown as ContinuousChatView
 const api={start:vi.fn(async()=>view)} as unknown as ContinuousChatApi
 const handle=continuousWorkspaceTransport({api,workspaceId:'workspace',anchor:async()=>'anchor',remember:()=>{}}).create(input,()=>{});handles.push(handle)
 await handle.start()
 expect(api.start).toHaveBeenCalledWith(expect.objectContaining({goal:input.question.text+'\n\nAttached context: '+input.question.context}))
})
it('sends a follow-up from saved text and pictures without reusing a failed native parent',async()=>{
 const input=request('individual');input.agent='b';input.images=[fixtureImage]
 input.path=[{id:'saved-q',parentId:null,role:'user',text:'Add the logo to the brochure.',state:'completed',images:[fixtureImage]},
 {id:'orphan',parentId:'saved-q',role:'assistant',agent:'b',provider:'claudecode',modelName:'model-b',text:'Saved partial output.',state:'failed',origin:{kind:'independent',id:'missing-native-job',nodeId:'missing-run'}}]
 let saved:any=null
 const client={prepare:vi.fn(async(value:any)=>({...value,conversationId:'native',anchorMessageId:'anchor'})),start:vi.fn(async(value:any)=>({schemaVersion:1 as const,id:value.id,conversationId:'native',status:'running',revision:1,provider:'claudecode' as const,modelName:'model-b',runId:'run',streamId:'stream'})),status:vi.fn(),stop:vi.fn(),transcript:vi.fn(),stream:vi.fn(async()=>({cursor:0,terminal:true as const}))}
 const handle=individualWorkspaceTransport({client,workspaceId:'workspace',store:()=>({read:()=>saved,write:value=>{saved=value},clear:()=>{saved=null}}),pollMs:100000}).create(input,()=>{});handles.push(handle)
 await handle.start()
 expect(client.prepare.mock.calls[0][0].parent).toBeUndefined()
 expect(client.start.mock.calls[0][0]).toMatchObject({images:[fixtureImage],provider:'claudecode'})
 expect(client.start.mock.calls[0][0].context).toContain('Add the logo to the brochure.')
 expect(client.start.mock.calls[0][0].context).toContain('Saved partial output.')
 expect(JSON.stringify(client.prepare.mock.calls[0][0])).not.toContain('missing-native-job')
})
