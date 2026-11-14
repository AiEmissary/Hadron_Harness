import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {runHadronToolConversation} from '../hadronTools/types.js'
import {ProjectWriteStore} from '../hadronTools/projectWrites.js'
import {ProjectBuildCoordinator,type ProjectBuildInput} from '../hadronTools/projectBuildCoordinator.js'
import {SubagentRunService} from '../headlessServer/services/subagentRunService.js'
import {AgentJobJournal} from '../headlessServer/services/collaboration/agentJobJournal.js'
import {fileExecutionLedger,ProjectExecutionGate,projectExecutionGate} from '../hadronTools/executionGate.js'
import {projectCheckHost} from '../hadronTools/projectChecks.js'
import {spawn} from 'node:child_process'
import {captureOwnedProcess} from '../auth/hadronOwnedProcess.js'
projectCheckHost.install(async(root,files,signal)=>{
 const child=spawn(process.execPath,['--test',...files.map(file=>path.join(root,file.path))],{cwd:root,stdio:'pipe',windowsHide:true,shell:false})
 const capture=captureOwnedProcess(child,{signal,timeout:10000,maxBytes:131072});child.stdin.end()
 const result=await capture;return {code:result.code,output:result.text}
})

const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
let temporary:string,root:string,db:any,writes:ProjectWriteStore,coordinator:ProjectBuildCoordinator
let submitted:any[],runs:Map<string,any>,authorize:ReturnType<typeof vi.fn>,agents:any,answer:(request:any,index:number)=>unknown
let tamperBinding:((run:any)=>void)|undefined,gate:Promise<void>|undefined,journal:AgentJobJournal,execution:ProjectExecutionGate
const input=():ProjectBuildInput=>({id:'build',workspaceId:'workspace',anchorMessageId:'anchor',task:'Improve the calculator.',plan:'Propose one small change, then obtain an independent review.',deliverables:['Updated calculator'],models:{a:'model-a',b:'model-b'},sourcePaths:['example.txt']})
const proposal=(replacement='replacement')=>({summary:'Proposed calculator update.',changes:[{path:'example.txt',expectedHash:hash('original'),text:replacement}]})
function make(assertApplyConsent?: (owner:string,input:ProjectBuildInput,snapshotHash:string)=>void){
 return new ProjectBuildCoordinator(db,writes,{agents,runs:{getRunById:(id:string)=>runs.get(id)},allowedModels:new Set(['model-a','model-b']),authorize,journal,execution,assertApplyConsent})
}
beforeEach(()=>{
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-project-build-'));root=path.join(temporary,'project');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'example.txt'),'original')
 db=new DatabaseSync(path.join(temporary,'journal.db'));writes=new ProjectWriteStore(db);submitted=[];runs=new Map();authorize=vi.fn();tamperBinding=undefined;gate=undefined
 journal=new AgentJobJournal(path.join(temporary,'job-logs'))
 execution=new ProjectExecutionGate();execution.configure(fileExecutionLedger(path.join(temporary,'execution')))
 vi.spyOn(projectExecutionGate,'legacyStart').mockImplementation(kind=>execution.legacyStart(kind))
 answer=(request)=>request.modelName==='model-a'?proposal():{snapshotHash:JSON.parse(request.prompt).snapshot.snapshotHash,verdict:'approve',text:'The exact proposed change meets the task; no tests ran.'}
 agents={spawnDetached:vi.fn(async(request:any,admission:any)=>{
   const index=submitted.push({request,admission})-1,id=`run-${index}`,handle=`handle-${index}`,streamId=`stream-${index}`
   const run={id,handle,status:'running',conversation_id:request.conversationId,parent_message_id:request.parentMessageId,provider:request.provider,
    model_name:request.modelName,prompt:request.prompt,system_prompt:request.systemPrompt,final_response:null}
   runs.set(id,run);tamperBinding?.(run)
   admission.onPrepared({runId:id,handle,streamId})
   if(gate)await gate
   run.final_response=JSON.stringify(answer(request,index));run.status=admission.signal.aborted?'aborted':'completed'
   return {runId:id,handle,streamId}
 }),waitForTerminal:vi.fn(async(handle:string)=>[...runs.values()].find(run=>run.handle===handle)),isActive:vi.fn((handle:string)=>[...runs.values()].some(run=>run.handle===handle&&run.status==='running')),cancel:vi.fn((handle:string)=>{
   const run=[...runs.values()].find(run=>run.handle===handle);if(run?.status==='running')run.status='aborted'
 })}
 coordinator=make()
})
afterEach(()=>{
 vi.restoreAllMocks();db.close()
 if(path.dirname(temporary)!==fs.realpathSync(os.tmpdir())||!path.basename(temporary).startsWith('hadron-project-build-'))throw Error('Invalid test cleanup root')
 fs.rmSync(temporary,{recursive:true,force:true})
})
function prepare(){coordinator.prepare('owner',input(),root)}
function applicationFixture(consent=vi.fn(()=>{}),native=false){
 writes=new ProjectWriteStore(db,{...(native?{}:{replaceFile:({temporary,target})=>fs.renameSync(temporary,target)}),
  assertExecution:(owner,workspace,lease)=>coordinator.assertCanonicalWrite(owner,workspace,lease)})
 coordinator=make(consent);return consent
}
const approvedHash=()=>coordinator.status('owner','build').writes!.reviews.at(-1)!.snapshotHash
it('runs a real failing test, applies the exact correction, invalidates the baseline and records a passing retest',async()=>{
 applicationFixture()
 fs.writeFileSync(path.join(root,'example.test.cjs'),"const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');test('content repaired',()=>assert.equal(fs.readFileSync('example.txt','utf8'),'replacement'))")
 prepare();await coordinator.run('owner','build')
 await expect(coordinator.runChecks('other','build',['example.test.cjs'])).rejects.toThrow('unavailable')
 await expect(coordinator.runChecks('owner','build',['../outside.test.cjs'])).rejects.toThrow()
 expect(coordinator.status('owner','build').checks).toHaveLength(0)
 await coordinator.runChecks('owner','build',['example.test.cjs'])
 expect(coordinator.status('owner','build')).toMatchObject({tests:{status:'failed'}})
 expect(coordinator.status('owner','build').checks[0].output).toContain('content repaired')
 await coordinator.apply('owner','build',approvedHash())
 expect(coordinator.status('owner','build').tests.status).toBe('stale')
 await coordinator.runChecks('owner','build',['example.test.cjs'])
 const status=coordinator.status('owner','build')
 expect(status).toMatchObject({state:'applied',tests:{status:'passed'},projectFilesChanged:true})
 expect(status.checks.map(check=>check.state)).toEqual(['stale','passed'])
 expect(coordinator.journal('owner','build','a').markdown).toContain('content repaired')
 expect(submitted).toHaveLength(2)
 coordinator.discard('owner','build');expect(execution.status().ready).toBe(true)
})
it('Stop during actual tests joins the child and never overlaps apply or a second test run',async()=>{
 applicationFixture();fs.writeFileSync(path.join(root,'slow.test.cjs'),"const {test}=require('node:test');test('slow',async()=>new Promise(resolve=>setTimeout(resolve,30000)))")
 prepare();await coordinator.run('owner','build')
 const first=coordinator.runChecks('owner','build',['slow.test.cjs'])
 expect(coordinator.status('owner','build')).toMatchObject({state:'checking',workersEnded:false,canApply:false})
 await expect(coordinator.runChecks('owner','build',['slow.test.cjs'])).rejects.toThrow('reviewed proposal')
 await expect(coordinator.apply('owner','build',approvedHash())).rejects.toThrow('workers must end')
 coordinator.cancel('owner','build');await first
 expect(coordinator.status('owner','build')).toMatchObject({tests:{status:'stopped'},workersEnded:true,projectFilesChanged:false})
 coordinator.discard('owner','build')
})
it('keeps canonical application unavailable by default despite peer approval',async()=>{
 prepare();await coordinator.run('owner','build')
 await expect(coordinator.apply('owner','build',approvedHash())).rejects.toThrow('consent is unavailable')
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 expect(db.prepare('SELECT COUNT(*) AS count FROM hadron_project_applications').get().count).toBe(0)
})
it('applies only the user-confirmed review, records actual changes and never claims checks ran',async()=>{
 const consent=applicationFixture();prepare();await coordinator.run('owner','build');const snapshot=approvedHash()
 expect(coordinator.status('owner','build').canApply).toBe(true)
 expect(()=>coordinator.assertCanonicalWrite('owner','workspace',coordinator.status('owner','build').writes!.leaseId)).toThrow('closed')
 await coordinator.apply('owner','build',snapshot)
 expect(consent).toHaveBeenCalledWith('owner',input(),snapshot)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('replacement')
 expect(coordinator.status('owner','build')).toMatchObject({state:'applied',canApply:false,projectFilesChanged:true,tests:{status:'not_run'},application:{state:'applied',snapshotHash:snapshot}})
 expect(coordinator.markdown('owner','build')).toContain('Project files changed by this coordinator: yes')
 expect(coordinator.journal('owner','build','a').markdown).toContain('Applying changes does not establish project completion')
 expect(coordinator.journal('owner','build','b').markdown).toContain('"projectFilesChanged": true')
 expect(()=>execution.legacyStart('shell')).toThrow('disabled');expect(submitted).toHaveLength(2)
 await expect(coordinator.apply('owner','build',snapshot)).rejects.toThrow()
 coordinator.discard('owner','build');expect(execution.status().ready).toBe(true)
})
it('rejects foreign ownership, stale hashes, declined and asynchronous user consent before reserving a write',async()=>{
 const consent=applicationFixture();prepare();await coordinator.run('owner','build');const snapshot=approvedHash()
 await expect(coordinator.apply('other','build',snapshot)).rejects.toThrow('unavailable')
 await expect(coordinator.apply('owner','build','forged')).rejects.toThrow('exact approved')
 consent.mockImplementation(()=>{throw Error('User declined')})
 await expect(coordinator.apply('owner','build',snapshot)).rejects.toThrow('User declined')
 consent.mockImplementation((()=>Promise.resolve()) as any)
 await expect(coordinator.apply('owner','build',snapshot)).rejects.toThrow('consent is unavailable')
 expect(db.prepare('SELECT COUNT(*) AS count FROM hadron_project_applications').get().count).toBe(0)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})
it('checks actual worker termination again before applying a reviewed snapshot',async()=>{
 applicationFixture();prepare();await coordinator.run('owner','build');agents.isActive.mockReturnValue(true)
 expect(coordinator.status('owner','build').canApply).toBe(false)
 await expect(coordinator.apply('owner','build',approvedHash())).rejects.toThrow('workers must end')
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})
it('reserves application once and rejects a second simultaneous action without another consent or inference',async()=>{
 const consent=applicationFixture();prepare();await coordinator.run('owner','build');const snapshot=approvedHash()
 const first=coordinator.apply('owner','build',snapshot)
 await expect(coordinator.apply('owner','build',snapshot)).rejects.toThrow('workers must end')
 await first;expect(consent).toHaveBeenCalled();expect(submitted).toHaveLength(2)
 expect(db.prepare('SELECT COUNT(*) AS count FROM hadron_project_applications').get().count).toBe(1)
})
it('checks the actual review again after yielding and refuses revoked approval before mutation',async()=>{
 applicationFixture();prepare();await coordinator.run('owner','build');const snapshot=approvedHash()
 const applying=coordinator.apply('owner','build',snapshot)
 db.prepare("UPDATE hadron_project_reviews SET verdict='changes_required'").run()
 await expect(applying).rejects.toThrow('reviewed snapshot changed')
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 expect(coordinator.status('owner','build').state).toBe('failed')
})
it('checks the durable exclusion marker again before committing a file',async()=>{
 applicationFixture();prepare();await coordinator.run('owner','build')
 const applying=coordinator.apply('owner','build',approvedHash())
 fs.writeFileSync(path.join(temporary,'execution/execution.json'),'corrupt')
 await expect(applying).rejects.toThrow()
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 expect(coordinator.status('owner','build')).toMatchObject({state:'failed',interventionRequired:true})
})
it('allows Stop before the first file with no mutation or provider replay',async()=>{
 applicationFixture();prepare();await coordinator.run('owner','build');const snapshot=approvedHash()
 const applying=coordinator.apply('owner','build',snapshot);expect(coordinator.status('owner','build').state).toBe('applying')
 expect(()=>coordinator.discard('owner','build')).toThrow('workers must end')
 coordinator.cancel('owner','build');await expect(applying).rejects.toThrow()
 expect(coordinator.status('owner','build')).toMatchObject({state:'cancelled',workersEnded:true,projectFilesChanged:false,application:{state:'failed'}})
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original');expect(submitted).toHaveLength(2)
 await expect(coordinator.apply('owner','build',snapshot)).rejects.toThrow()
 coordinator.discard('owner','build');expect(execution.status().ready).toBe(true)
})
it('yields between files so Stop retains the first receipt and leaves the second file unchanged',async()=>{
 applicationFixture();fs.writeFileSync(path.join(root,'second.txt'),'second')
 answer=request=>request.modelName==='model-a'?{summary:'Two reviewed changes',changes:[
  {path:'example.txt',expectedHash:hash('original'),text:'replacement'},
  {path:'second.txt',expectedHash:hash('second'),text:'second replacement'}]}:
  {snapshotHash:JSON.parse(request.prompt).snapshot.snapshotHash,verdict:'approve',text:'Both exact changes reviewed; tests not run.'}
 coordinator.prepare('owner',{...input(),sourcePaths:['example.txt','second.txt']},root);await coordinator.run('owner','build')
 const apply=writes.apply.bind(writes);let count=0
 vi.spyOn(writes,'apply').mockImplementation((...args)=>{apply(...args);if(++count===1)setImmediate(()=>coordinator.cancel('owner','build'))})
 await expect(coordinator.apply('owner','build',approvedHash())).rejects.toThrow()
 expect(count).toBe(1);expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('replacement')
 expect(fs.readFileSync(path.join(root,'second.txt'),'utf8')).toBe('second')
 expect(coordinator.status('owner','build')).toMatchObject({state:'cancelled',projectFilesChanged:true,application:{state:'failed'}})
 expect(submitted).toHaveLength(2);coordinator.discard('owner','build')
})
it('rejects an existing-file proposal outside the native source packet even if its hash is known',async()=>{
 fs.writeFileSync(path.join(root,'unselected.txt'),'private source')
 const propose=vi.spyOn(writes,'propose')
 answer=()=>({summary:'An unauthorized extra source',changes:[{path:'unselected.txt',expectedHash:hash('private source'),text:'replacement'}]})
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow('exact selected source evidence')
 expect(propose).not.toHaveBeenCalled();expect(submitted).toHaveLength(1)
 expect(fs.readFileSync(path.join(root,'unselected.txt'),'utf8')).toBe('private source')
})
it('previews nested new documents without creating folders before approval',async()=>{
 answer=(request:any)=>{const packet=JSON.parse(request.prompt);return packet.kind==='project_proposal'?{summary:'Documentation',changes:[{path:'docs/calculator-add.md',expectedHash:null,text:'Reviewed documentation'}]}:{snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'Reviewed the exact new file and parent folder.'}}
 prepare();await coordinator.run('owner','build')
 expect(coordinator.status('owner','build')).toMatchObject({state:'ready_to_apply',projectFilesChanged:false})
 expect(fs.existsSync(path.join(root,'docs'))).toBe(false)
 expect(submitted).toHaveLength(2)
 expect(submitted[0].request.systemPrompt).toContain('host creates missing parents only after exact review')
})
it('allows reviewed new documents at the root or beside an explicitly selected source',async()=>{
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','calculator.js'),'export const add=(a,b)=>a+b')
 answer=request=>request.modelName==='model-a'?{summary:'Documentation',changes:[
  {path:'calculator.md',expectedHash:null,text:'Root documentation'},
  {path:'src/calculator.md',expectedHash:null,text:'Source documentation'},
 ]}:{snapshotHash:JSON.parse(request.prompt).snapshot.snapshotHash,verdict:'approve',text:'Reviewed both documents; tests not run.'}
 coordinator.prepare('owner',{...input(),sourcePaths:['src/calculator.js']},root);await coordinator.run('owner','build')
 expect(JSON.parse(submitted[0].request.prompt).allowedNewFileDirectories).toEqual(['.','src'])
 expect(coordinator.status('owner','build')).toMatchObject({state:'ready_to_apply',projectFilesChanged:false})
 expect(submitted).toHaveLength(2)
 expect(fs.existsSync(path.join(root,'calculator.md'))).toBe(false)
 expect(fs.existsSync(path.join(root,'src','calculator.md'))).toBe(false)
})
it('keeps manual edits and durable conflict receipts instead of overwriting or replaying them',async()=>{
 applicationFixture();prepare();await coordinator.run('owner','build');fs.writeFileSync(path.join(root,'example.txt'),'manual')
 await expect(coordinator.apply('owner','build',approvedHash())).rejects.toThrow('changed after review')
 expect(coordinator.status('owner','build')).toMatchObject({state:'failed',interventionRequired:true,application:{state:'failed'}})
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('manual')
 expect(()=>coordinator.discard('owner','build')).toThrow()
 expect(coordinator.recovery('owner','build').reconcilable).toBe(false)
})
it('blocks before mutation when the mandatory Markdown application checkpoint fails',async()=>{
 applicationFixture();prepare();await coordinator.run('owner','build')
 vi.spyOn(journal,'checkpoint').mockImplementation(()=>{throw Error('Checkpoint storage failed')})
 await expect(coordinator.apply('owner','build',approvedHash())).rejects.toThrow('Checkpoint storage')
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 expect(coordinator.status('owner','build')).toMatchObject({state:'failed',journalAvailable:false,canApply:false})
 expect(submitted).toHaveLength(2)
})
it('retains post-write uncertainty across a new host without replaying an operation or inference',async()=>{
 applicationFixture();prepare();await coordinator.run('owner','build')
 const apply=writes.apply.bind(writes)
 vi.spyOn(writes,'apply').mockImplementation((...args)=>{apply(...args);throw Error('Lost batch acknowledgement')})
 await expect(coordinator.apply('owner','build',approvedHash())).rejects.toThrow('Lost batch')
 const fresh=make(()=>{});expect(fresh.status('owner','build')).toMatchObject({state:'failed',interventionRequired:true,canApply:false,projectFilesChanged:true})
 await expect(fresh.apply('owner','build',approvedHash())).rejects.toThrow('workers must end')
 expect(submitted).toHaveLength(2);expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('replacement')
})
it.runIf(process.platform==='win32')('binds real Windows replacement to the coordinator application scope',async()=>{
 applicationFixture(vi.fn(()=>{}),true);prepare();await coordinator.run('owner','build')
 await coordinator.apply('owner','build',approvedHash())
 expect(coordinator.status('owner','build')).toMatchObject({state:'applied',projectFilesChanged:true,canApply:false})
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('replacement')
 expect(coordinator.recovery('owner','build').reconcilable).toBe(true)
 coordinator.discard('owner','build');expect(execution.status().ready).toBe(true)
},20000)
it('binds A proposal and B review to actual runs, persists exact review and never edits the project',async()=>{
 prepare();await coordinator.run('owner','build')
 const status=coordinator.status('owner','build')
 expect(status).toMatchObject({state:'ready_to_apply',canApply:false,projectFilesChanged:false,tests:{status:'not_run'},attempts:[{role:'a',runId:'run-0',state:'completed'},{role:'b',runId:'run-1',state:'completed'}]})
 expect(status.writes?.reviews).toHaveLength(1)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 for(const {request,admission} of submitted){
  expect(request).toMatchObject({fullAccess:false,autoApprove:false,tools:[],maxTurns:1,operationMode:'plan',rootPath:null})
  expect(admission.toolPolicy).toBe('none');expect(admission.toolSession).toBeUndefined()
 }
 expect(JSON.parse(submitted[1].request.prompt).snapshot.files[0]).toMatchObject({before:'original',after:'replacement'})
 expect(JSON.parse(submitted[0].request.prompt).evidence).toEqual([{path:'example.txt',text:'original',hash:hash('original')}])
 expect(coordinator.markdown('owner','build')).toContain('Tests/builds: not run')
 expect(coordinator.journal('owner','build','a').markdown).toContain('proposal_0')
 expect(coordinator.journal('owner','build','b').markdown).toContain('review_0')
 expect(fs.readdirSync(path.join(temporary,'job-logs')).filter(file=>file.endsWith('.md'))).toHaveLength(2)
 await coordinator.run('owner','build');expect(submitted).toHaveLength(2)
 coordinator.discard('owner','build');expect(coordinator.status('owner','build').state).toBe('discarded')
 expect(writes.acquire('other','workspace',root).id).toBeTruthy()
})
it('freezes caller input, ownership and model choices at admission',async()=>{
 const config=input();coordinator.prepare('owner',config,root);config.task='Changed';config.models.b='unadmitted';config.deliverables.push('Extra')
 await coordinator.run('owner','build')
 expect(JSON.parse(submitted[0].request.prompt).task).toBe('Improve the calculator.')
 expect(submitted[1].request.modelName).toBe('model-b')
 expect(()=>coordinator.status('another','build')).toThrow('unavailable')
 expect(()=>coordinator.cancel('another','build')).toThrow('unavailable')
 expect(()=>coordinator.discard('another','build')).toThrow('unavailable')
 expect(()=>coordinator.prepare('owner',{...input(),id:'bad',models:{a:'other',b:'model-b'}},root)).toThrow('not admitted')
})
it('performs only one correction and fresh exact-snapshot review while retaining both histories',async()=>{
 let reviewCount=0
 answer=(request,index)=>request.modelName==='model-a'?proposal(index===0?'first draft':'corrected draft'):
  {snapshotHash:JSON.parse(request.prompt).snapshot.snapshotHash,verdict:++reviewCount===1?'changes_required':'approve',text:'Specific review findings.'}
 prepare();await coordinator.run('owner','build')
 const status=coordinator.status('owner','build')
 expect(status.state).toBe('ready_to_apply');expect(status.attempts).toHaveLength(4);expect(status.writes?.reviews).toHaveLength(2)
 expect(status.writes?.files).toHaveLength(2)
 expect(JSON.parse(submitted[2].request.prompt)).toMatchObject({review:{verdict:'changes_required'},previousSnapshot:{files:[{after:'first draft'}]}})
 expect(JSON.parse(submitted[1].request.prompt).snapshot.snapshotHash).not.toBe(JSON.parse(submitted[3].request.prompt).snapshot.snapshotHash)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})
it('preserves unresolved defects after the bounded correction instead of forcing approval',async()=>{
 answer=(request)=>request.modelName==='model-a'?proposal():{snapshotHash:JSON.parse(request.prompt).snapshot.snapshotHash,verdict:'changes_required',text:'The implementation still misses a deliverable.'}
 prepare();await coordinator.run('owner','build')
 expect(coordinator.status('owner','build').state).toBe('changes_required');expect(submitted).toHaveLength(4)
})
it('rejects stale review snapshots and model-supplied authority fields',async()=>{
 answer=(request)=>request.modelName==='model-a'?proposal():{snapshotHash:'stale',verdict:'approve',text:'Approved'}
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow('does not match')
 expect(coordinator.status('owner','build').writes?.reviews).toHaveLength(0)
 coordinator.discard('owner','build')
 answer=()=>({...proposal(),apply:true,reviewer:'b'})
 coordinator.prepare('owner',{...input(),id:'second'},root)
 await expect(coordinator.run('owner','second')).rejects.toThrow('response shape')
 expect(submitted).toHaveLength(3)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})
it.each(['model_name','provider','parent_message_id','conversation_id','prompt','system_prompt'])('rejects a substituted %s before provider execution',async field=>{
 tamperBinding=run=>{run[field]='substituted'}
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow('binding mismatch')
 expect(coordinator.status('owner','build').state).toBe('failed');expect(submitted).toHaveLength(1)
 expect(coordinator.status('owner','build').writes?.files).toHaveLength(0)
})
it('holds the lease when a substituted handle makes actual worker termination unconfirmable',async()=>{
 tamperBinding=run=>{run.handle='substituted'}
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow('termination is unconfirmed')
 expect(()=>coordinator.discard('owner','build')).toThrow('workers must end')
 expect(()=>writes.acquire('other','workspace',root)).toThrow('overlapping')
})
it('rejects changed terminal identity and never dispatches a peer review for it',async()=>{
 answer=(request)=>{runs.get('run-0').model_name='substituted';return proposal()}
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow('result identity')
 expect(submitted).toHaveLength(1)
 expect(coordinator.status('owner','build').writes?.files).toHaveLength(0)
})
it('blocks cancellation results, waits for workers and retains the lease until explicit discard',async()=>{
 let release!:()=>void;gate=new Promise(resolve=>{release=resolve});prepare()
 const work=coordinator.run('owner','build');coordinator.cancel('owner','build')
 expect(()=>coordinator.discard('owner','build')).toThrow('workers must end')
 expect(()=>writes.acquire('other','workspace',root)).toThrow('overlapping')
 release();await expect(work).rejects.toThrow()
 expect(coordinator.status('owner','build').state).toBe('cancelled')
 expect(coordinator.status('owner','build').writes?.files).toHaveLength(0)
 expect(submitted).toHaveLength(1);coordinator.discard('owner','build')
})
it('does not resume, reclaim capabilities or replay requests after a coordinator restart',async()=>{
 prepare();const fresh=make()
 expect(fresh.status('owner','build')).toMatchObject({state:'interrupted',interventionRequired:true,canApply:false})
 expect(()=>fresh.run('owner','build')).toThrow('no automatic replay')
 expect(()=>fresh.discard('owner','build')).toThrow('workers must end')
 expect(submitted).toHaveLength(0)
 await coordinator.run('owner','build');const after=make().status('owner','build')
 expect(after).toMatchObject({state:'ready_to_apply',interventionRequired:true,canApply:false})
 expect(after.drafts).toMatchObject([{path:'example.txt',before:'original',after:'replacement'}])
 expect(after.attempts).toHaveLength(2);expect(submitted).toHaveLength(2)
})
it('requires current ownership throughout execution and closes before accepting a revoked result',async()=>{
 answer=()=>{authorize.mockImplementation(()=>{throw Error('Ownership revoked')});return proposal()}
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow('Ownership revoked')
 authorize.mockReset();expect(coordinator.status('owner','build').state).toBe('failed')
 expect(submitted).toHaveLength(1);expect(coordinator.status('owner','build').writes?.files).toHaveLength(0)
})
it('rejects an escaping parent before preparing any files or granting review',async()=>{
 answer=()=>({summary:'Two changes.',changes:[...proposal().changes,{path:'../outside.txt',expectedHash:null,text:'escape'}]})
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow()
 const status=coordinator.status('owner','build');expect(status.state).toBe('failed');expect(status.writes?.files).toHaveLength(0)
 expect(status.writes?.reviews).toHaveLength(0);expect(submitted).toHaveLength(1)
 expect(fs.existsSync(path.join(temporary,'outside.txt'))).toBe(false)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})
it('does not dispatch anything when the durable first stage reservation cannot be saved',async()=>{
 prepare();db.exec('DROP TABLE hadron_project_build_attempts')
 await expect(coordinator.run('owner','build')).rejects.toThrow()
 expect(submitted).toHaveLength(0);expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})
it('rejects protected source paths and releases a failed admission without a provider request',()=>{
 expect(()=>coordinator.prepare('owner',{...input(),sourcePaths:['../private.txt']},root)).toThrow()
 expect(coordinator.status('owner','build').state).toBe('failed');expect(submitted).toHaveLength(0)
 expect(writes.acquire('other','workspace',root).id).toBeTruthy()
})
it('freezes source bytes and rejects a manual change before admitting a draft for review',async()=>{
 prepare();fs.writeFileSync(path.join(root,'example.txt'),'manual change')
 await expect(coordinator.run('owner','build')).rejects.toThrow('Expected file hash')
 expect(JSON.parse(submitted[0].request.prompt).evidence[0].text).toBe('original')
 expect(submitted).toHaveLength(1);expect(coordinator.status('owner','build').writes?.reviews).toHaveLength(0)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('manual change')
})
it('rejects tampered frozen source evidence before a provider request',async()=>{
 prepare();db.prepare('UPDATE hadron_project_builds SET evidence_json=? WHERE id=?').run('[]','build')
 await expect(coordinator.run('owner','build')).rejects.toThrow('evidence changed');expect(submitted).toHaveLength(0)
})

function actualEngine(generate:(provider:string,request:any)=>Promise<any>,deadlineMs?:number,admitModel?:(provider:string,model:string)=>boolean){
 // Only persistence adapters/provider transport are fixtures; admission, worker loop,
 // protected-run controls, tool denial and cancellation use the production engine.
 const messages=new Map<string,any[]>();let sequence=0
 const runRepo:any={
  createRun(config:any){
   const id=`actual-${++sequence}`,row={id,handle:`actual-handle-${sequence}`,conversation_id:config.conversationId,
    parent_message_id:config.parentMessageId,provider:config.provider,model_name:config.modelName,system_prompt:config.systemPrompt,
    prompt:config.prompt,status:config.status,final_response:null,turns_used:0,tool_calls_used:0}
   runs.set(id,row);messages.set(id,[]);return {...row}
  },
  getRunById(id:string){const row=runs.get(id);return row?{...row}:null},
  getRunByHandle(handle:string){const row=[...runs.values()].find(item=>item.handle===handle);return row?{...row}:null},
  getMessages(id:string){return messages.get(id)??[]},
  updateRun(id:string,patch:any){
   const row=runs.get(id)
   for(const [key,value] of Object.entries(patch))row[({finalResponse:'final_response',turnsUsed:'turns_used',toolCallsUsed:'tool_calls_used'} as Record<string,string>)[key]??key]=value
   return {...row}
  },
  appendMessage(id:string,config:any){const list=messages.get(id)!,row={...config,id:`message-${list.length}`,role:config.role,content:config.content,content_blocks:config.contentBlocks};list.push(row);return row},
  updateMessageToolState(id:string,messageId:string,patch:any){const row=messages.get(id)?.find(item=>item.id===messageId);if(!row)return null;row.content_blocks=patch.contentBlocks;row.tool_calls=patch.toolCalls;return row},
 }
 const execute=vi.fn(async()=>{throw Error('No project worker may invoke legacy tools')})
 const engine=new SubagentRunService({runRepo,streamingRunRepo:{upsert:()=>`stream-${sequence}`,finish:()=>{}} as any,
  providerRouter:{generate} as any,toolExecutor:execute,resolveToolsByName:()=>({tools:[{name:'bash',description:'Forbidden legacy default',inputSchema:{}}],resolvedNames:['bash'],unknownNames:[]})})
 coordinator=new ProjectBuildCoordinator(db,writes,{agents:engine,runs:runRepo,allowedModels:new Set(['model-a','model-b']),authorize,journal,execution,deadlineMs,admitModel})
 return {engine,execute}
}
it('runs the real protected engine through both stages without native tools or automatic retries',async()=>{
 const transport=vi.fn(async(_provider,request)=>{
  expect(request.requestPolicy).toBe('single_attempt');expect(request.tools).toEqual([])
  const packet=JSON.parse(request.userContent)
  return {content:JSON.stringify(packet.kind==='project_proposal'?proposal():{snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'Reviewed the exact diff; no tests ran.'})}
 })
 const {engine,execute}=actualEngine(transport)
 prepare();await coordinator.run('owner','build')
 expect(coordinator.status('owner','build').state).toBe('ready_to_apply')
 expect(transport).toHaveBeenCalledTimes(2);expect(execute).not.toHaveBeenCalled()
 for(const run of runs.values())expect(engine.isActive(run.handle)).toBe(false)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 coordinator.discard('owner','build')
})
it.each(['empty','provider_error'])('real engine %s response fails once and ends cleanly before draft discard',async kind=>{
 const transport=vi.fn(async()=>{if(kind==='provider_error')throw Error('503 simulated provider failure');return {content:''}})
 const {engine,execute}=actualEngine(transport)
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow('result identity mismatch')
 expect(coordinator.status('owner','build').state).toBe('failed')
 expect(transport).toHaveBeenCalledTimes(1);expect(execute).not.toHaveBeenCalled()
 for(const run of runs.values()){expect(run.status).toBe('error');expect(engine.isActive(run.handle)).toBe(false)}
 coordinator.discard('owner','build')
})
it('real engine refuses a model attempt to invoke legacy shell tools',async()=>{
 const transport=vi.fn(async()=>({content:'',toolCalls:[{id:'tool-1',name:'bash',arguments:{command:'echo forbidden'}}]}))
 const {execute}=actualEngine(transport)
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow()
 expect(transport).toHaveBeenCalledTimes(1);expect(execute).not.toHaveBeenCalled()
 expect(coordinator.status('owner','build').state).toBe('failed')
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 coordinator.discard('owner','build')
})
it('real engine cancellation ends the actual worker before releasing a draft lease',async()=>{
 let started!:()=>void;const beginning=new Promise<void>(resolve=>{started=resolve})
 const transport=vi.fn(async(_provider,request)=>{started();return new Promise((_resolve,reject)=>{
  const abort=()=>reject(Object.assign(Error('Aborted by fixture transport'),{name:'AbortError'}))
  if(request.signal.aborted)abort();else request.signal.addEventListener('abort',abort,{once:true})
 })})
 const {engine}=actualEngine(transport)
 prepare();const work=coordinator.run('owner','build');await beginning;coordinator.cancel('owner','build')
 expect(()=>coordinator.discard('owner','build')).toThrow('workers must end')
 await expect(work).rejects.toThrow()
 expect(transport).toHaveBeenCalledTimes(1)
 for(const run of runs.values()){expect(run.status).toBe('aborted');expect(engine.isActive(run.handle)).toBe(false)}
 expect(coordinator.status('owner','build').workersEnded).toBe(true)
 coordinator.discard('owner','build')
})
it('does not start an agent when its automatic Markdown checkpoint cannot be saved',async()=>{
 prepare();vi.spyOn(journal,'checkpoint').mockImplementation(()=>{throw Error('Log disk unavailable')})
 await expect(coordinator.run('owner','build')).rejects.toThrow('Log disk unavailable')
 expect(submitted).toHaveLength(0)
 expect(coordinator.status('owner','build')).toMatchObject({state:'failed',journalAvailable:false})
})
it('real engine closes admission before dispatch if the bound-run Markdown checkpoint fails',async()=>{
 const transport=vi.fn(async()=>({content:JSON.stringify(proposal())})),{engine}=actualEngine(transport)
 prepare();const checkpoint=journal.checkpoint.bind(journal)
 vi.spyOn(journal,'checkpoint').mockImplementation(snapshot=>{if(snapshot.runId)throw Error('Bound checkpoint disk failure');checkpoint(snapshot)})
 await expect(coordinator.run('owner','build')).rejects.toThrow('Bound checkpoint disk failure')
 expect(transport).not.toHaveBeenCalled()
 for(const run of runs.values()){expect(run.status).toBe('error');expect(engine.isActive(run.handle)).toBe(false)}
 expect(coordinator.status('owner','build')).toMatchObject({state:'failed',journalAvailable:false,workersEnded:true})
})
it('the whole-build deadline aborts a real worker instead of silently retrying',async()=>{
 const transport=vi.fn(async(_provider,request)=>new Promise((_resolve,reject)=>{
  const abort=()=>reject(Object.assign(Error('Timed out'),{name:'AbortError'}))
  if(request.signal.aborted)abort();else request.signal.addEventListener('abort',abort,{once:true})
 }))
 const {engine}=actualEngine(transport,20)
 prepare();await expect(coordinator.run('owner','build')).rejects.toThrow()
 expect(transport).toHaveBeenCalledTimes(1)
 expect(coordinator.status('owner','build')).toMatchObject({state:'cancelled',workersEnded:true})
 for(const run of runs.values())expect(engine.isActive(run.handle)).toBe(false)
 coordinator.discard('owner','build')
})
it('refuses project admission after earlier unrestricted activity, including an already-ended custom call',()=>{
 execution.legacyStart('custom_module')
 expect(()=>prepare()).toThrow('Legacy activity')
 expect(submitted).toHaveLength(0);expect(coordinator.status('owner','build').state).toBe('failed')
})
it('holds global exclusion through peer review and until an explicit settled draft discard',async()=>{
 prepare();expect(()=>execution.legacyStart('widget_write')).toThrow('disabled')
 const marker=JSON.parse(fs.readFileSync(path.join(temporary,'execution/execution.json'),'utf8'))
 expect(db.prepare('SELECT scope_id FROM hadron_project_builds WHERE id=?').get('build').scope_id).toBe(marker.id)
 await coordinator.run('owner','build')
 expect(()=>execution.legacyStart('shell')).toThrow('disabled')
 coordinator.discard('owner','build');expect(()=>execution.legacyStart('shell')).not.toThrow()
})
it('closes a reviewed draft through explicit reconciliation without editing, replaying or reusing the old capability',async()=>{
 prepare();await coordinator.run('owner','build')
 ;(execution as any).active.uncertain=true
 const plan=coordinator.recovery('owner','build')
 expect(plan.reconcilable).toBe(true)
 expect(coordinator.reconcile('owner','build',plan.inspectionHash,'keep_observed_files').filesChanged).toBe(false)
 expect(coordinator.status('owner','build').state).toBe('discarded');expect(execution.status().ready).toBe(true)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original');expect(submitted).toHaveLength(2)
 expect(()=>coordinator.run('owner','build')).toThrow('no automatic replay')
})
it('allows restart inspection but denies a serialized or foreign host recovery decision',()=>{
 prepare();const plan=coordinator.recovery('owner','build'),fresh=make()
 expect(fresh.recovery('owner','build').inspectionHash).toBe(plan.inspectionHash)
 expect(()=>fresh.reconcile('owner','build',plan.inspectionHash,'keep_observed_files')).toThrow('original live host')
 expect(()=>coordinator.recovery('other','build')).toThrow('unavailable')
 expect(execution.status().reason).toBe('project_active');expect(submitted).toHaveLength(0)
})
it('rechecks actual worker activity before accepting a recovery decision',async()=>{
 prepare();await coordinator.run('owner','build');const plan=coordinator.recovery('owner','build')
 agents.isActive.mockReturnValue(true)
 expect(()=>coordinator.reconcile('owner','build',plan.inspectionHash,'keep_observed_files')).toThrow('workers have not ended')
 expect(execution.status().reason).toBe('project_active')
 agents.isActive.mockReturnValue(false);coordinator.reconcile('owner','build',plan.inspectionHash,'keep_observed_files')
 expect(execution.status().ready).toBe(true)
})
it('retains the marker after a release-storage failure and finishes a new explicit reconciliation without replay',async()=>{
 prepare();await coordinator.run('owner','build');const plan=coordinator.recovery('owner','build')
 const release=vi.spyOn((execution as any).ledger,'release').mockImplementation(()=>{throw Error('Marker storage failed')})
 expect(()=>coordinator.reconcile('owner','build',plan.inspectionHash,'keep_observed_files')).toThrow('Marker storage failed')
 expect(execution.status().reason).toBe('intervention_required')
 expect(db.prepare('SELECT state FROM hadron_project_leases').get().state).toBe('released')
 expect(coordinator.status('owner','build')).toMatchObject({state:'discarded',interventionRequired:true,canApply:false})
 release.mockRestore();const fresh=coordinator.recovery('owner','build')
 coordinator.reconcile('owner','build',fresh.inspectionHash,'keep_observed_files')
 expect(execution.status().ready).toBe(true)
 expect(db.prepare('SELECT COUNT(*) AS count FROM hadron_project_recoveries').get().count).toBe(1)
 expect(submitted).toHaveLength(2);expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})

it('freezes mixed project providers and uses Claude for the exact review without granting tools',async()=>{
 coordinator=new ProjectBuildCoordinator(db,writes,{agents,runs:{getRunById:(id:string)=>runs.get(id)},allowedModels:new Set(['model-a']),admitModel:(provider,model)=>provider==='claudecode'?model==='model-b':model==='model-a',authorize,journal,execution})
 coordinator.prepare('owner',{...input(),providers:{a:'openaichatgpt',b:'claudecode'}},root)
 await coordinator.run('owner','build')
 expect(coordinator.status('owner','build').state).toBe('ready_to_apply')
 expect(submitted.map(item=>item.request.provider)).toEqual(['openaichatgpt','claudecode'])
 expect(coordinator.status('owner','build').input.providers).toEqual({a:'openaichatgpt',b:'claudecode'})
 expect(submitted.every(item=>item.admission.toolPolicy==='none'&&item.request.tools.length===0)).toBe(true)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})

it('builds a complete small Node project from an empty source selection, including nested folders and executable tests',async()=>{
 applicationFixture()
 answer=(request:any)=>{const packet=JSON.parse(request.prompt);return packet.kind==='project_proposal'?{summary:'Complete calculator module, test and documentation',changes:[
  {path:'src/calculator.js',expectedHash:null,text:'exports.add=(a,b)=>a+b'},
  {path:'tests/calculator.test.js',expectedHash:null,text:"const {test}=require('node:test');const assert=require('node:assert/strict');const {add}=require('../src/calculator.js');test('negative addition',()=>assert.equal(add(-2,3),1));"},
  {path:'README.md',expectedHash:null,text:'Run node --test tests/calculator.test.js. The add function returns the sum.'}
 ]}:{snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'Exact files satisfy the module, negative addition test and README deliverables.'}}
 coordinator.prepare('owner',{...input(),sourcePaths:[],helpers:false},root)
 await coordinator.run('owner','build');expect(fs.existsSync(path.join(root,'src'))).toBe(false)
 await coordinator.apply('owner','build',approvedHash())
 await coordinator.runChecks('owner','build',['tests/calculator.test.js'])
 const check=coordinator.status('owner','build').checks!.at(-1)!
 expect(check.state).toBe('passed');expect(check.code).toBe(0)
 expect(fs.readFileSync(path.join(root,'src/calculator.js'),'utf8')).toContain('a+b')
 expect(submitted.every(item=>item.admission.helpers===undefined)).toBe(true)
})

it.each(['openaichatgpt','claudecode'] as const)('the real protected %s engine searches a selected folder with no manual picks and freezes discovered evidence',async provider=>{
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','nested.js'),'export const needle = 1')
 let step=0
 const transport=vi.fn(async(_provider,request)=>{
  if(request.hadronToolSession){
   const content=await runHadronToolConversation({session:request.hadronToolSession,task:request.userContent,signal:request.signal??new AbortController().signal,
    generate:async(packet)=>{
     const conversation=JSON.parse(packet)
     if(step++===0)return JSON.stringify({tool:'project_search',arguments:{query:'needle',mode:'content'}})
     if(step===2){expect(JSON.stringify(conversation)).toContain('src/nested.js');return JSON.stringify({tool:'project_read',arguments:{path:'src/nested.js'}})}
     const evidence=conversation.transcript.at(-1).content.result
     return JSON.stringify({summary:'Change the discovered value',changes:[{path:'src/nested.js',expectedHash:evidence.sha256,text:'export const needle = 2'}]})
    }})
   return {content}
  }
  const packet=JSON.parse(request.userContent)
  expect(packet.evidence).toEqual([{path:'src/nested.js',hash:hash('export const needle = 1'),text:'export const needle = 1'}])
  return {content:JSON.stringify({snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'Reviewed the full frozen before/after.'})}
 })
 const {execute}=actualEngine(transport,undefined,(_provider,model)=>['model-a','model-b'].includes(model))
 coordinator.prepare('owner',{...input(),providers:{a:provider,b:'openaichatgpt'},exploreFolder:true,sourcePaths:[]},root)
 await coordinator.run('owner','build')
 const status=coordinator.status('owner','build')
 expect(status).toMatchObject({state:'ready_to_apply',projectFilesChanged:false,discoveredPaths:['src/nested.js']})
 expect(status.folderActivity.map(item=>item.tool)).toEqual(['project_search','project_read'])
 expect(status.drafts[0]).toMatchObject({path:'src/nested.js',before:'export const needle = 1',after:'export const needle = 2'})
 expect(execute).not.toHaveBeenCalled()
 expect(fs.readFileSync(path.join(root,'src','nested.js'),'utf8')).toBe('export const needle = 1')
 coordinator.discard('owner','build')
})
it('never permits existing-file replacement from a search hit alone without a frozen read',async()=>{
 const request={...input(),exploreFolder:true,sourcePaths:[]};coordinator.prepare('owner',request,root)
 await expect(coordinator.run('owner','build')).rejects.toThrow('selected source evidence')
 expect(coordinator.status('owner','build').drafts).toHaveLength(0)
 coordinator.discard('owner','build')
})

it('uses only one chosen model for single-agent work and still checks the exact changes',async()=>{
 const value={...input(),participation:'b' as const,models:{a:'model-a',b:'model-a'}}
 answer=(_request,index)=>index===0?proposal():{snapshotHash:JSON.parse(submitted[index].request.prompt).snapshot.snapshotHash,verdict:'approve',text:'Self-check only; no tests run.'}
 coordinator.prepare('owner',value,root);await coordinator.run('owner','build')
 expect(submitted.map(item=>item.request.modelName)).toEqual(['model-a','model-a'])
 expect(submitted[0].request.systemPrompt).toContain('You are Agent B')
 expect(submitted[1].request.systemPrompt).toContain('self-check, not independent peer review')
 expect(coordinator.status('owner','build').input.participation).toBe('b')
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
})
it('refuses misleading single-agent metadata when another model would be used',()=>{
 expect(()=>coordinator.prepare('owner',{...input(),participation:'b'},root)).toThrow('same agent')
 expect(submitted).toHaveLength(0)
})

it.each(['openaichatgpt','claudecode'] as const)('the real protected %s engine corrects a premature empty proposal after search by reading the source within the existing budget',async provider=>{
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','nested.js'),'export const needle = 1')
 let step=0
 const transport=vi.fn(async(_provider,request)=>{
  if(request.hadronToolSession){
   const content=await runHadronToolConversation({session:request.hadronToolSession,task:request.userContent,signal:request.signal??new AbortController().signal,
    generate:async(packet)=>{
     const conversation=JSON.parse(packet)
     if(step++===0)return JSON.stringify({tool:'project_search',arguments:{query:'needle',mode:'content'}})
     if(step===2)return JSON.stringify({summary:'No frozen source evidence yet',changes:[]})
     if(step===3){expect(JSON.stringify(conversation)).toContain('HOST PROTOCOL CORRECTION');expect(JSON.stringify(conversation)).toContain('project_read');return JSON.stringify({tool:'project_read',arguments:{path:'src/nested.js'}})}
     const evidence=conversation.transcript.at(-1).content.result
     return JSON.stringify({summary:'Change the discovered value',changes:[{path:'src/nested.js',expectedHash:evidence.sha256,text:'export const needle = 2'}]})
    }})
   return {content}
  }
  const packet=JSON.parse(request.userContent)
  expect(packet.evidence).toEqual([{path:'src/nested.js',hash:hash('export const needle = 1'),text:'export const needle = 1'}])
  return {content:JSON.stringify({snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'Reviewed the full frozen before/after.'})}
 })
 const {execute}=actualEngine(transport,undefined,(_provider,model)=>['model-a','model-b'].includes(model))
 coordinator.prepare('owner',{...input(),providers:{a:provider,b:'openaichatgpt'},exploreFolder:true,sourcePaths:[]},root)
 await coordinator.run('owner','build')
 const status=coordinator.status('owner','build')
 expect(status).toMatchObject({state:'ready_to_apply',projectFilesChanged:false,discoveredPaths:['src/nested.js']})
 expect(status.folderActivity.map(item=>item.tool)).toEqual(['project_search','project_read'])
 expect(status.drafts[0]).toMatchObject({path:'src/nested.js',before:'export const needle = 1',after:'export const needle = 2'})
 expect(step).toBe(4);expect(execute).not.toHaveBeenCalled()
 expect(fs.readFileSync(path.join(root,'src','nested.js'),'utf8')).toBe('export const needle = 1')
 coordinator.discard('owner','build')
})

it('allows new-project work after a confirmed empty root without inventing a source read',async()=>{
 fs.unlinkSync(path.join(root,'example.txt'));let step=0
 const transport=vi.fn(async(_provider,request)=>{
  if(request.hadronToolSession)return {content:await runHadronToolConversation({session:request.hadronToolSession,task:request.userContent,signal:request.signal??new AbortController().signal,generate:async()=>step++===0?JSON.stringify({tool:'project_list',arguments:{path:''}}):JSON.stringify({summary:'Create a starter document',changes:[{path:'README.md',expectedHash:null,text:'Starter project'}]})})}
  const packet=JSON.parse(request.userContent);return {content:JSON.stringify({snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'New document reviewed'})}
 })
 actualEngine(transport,undefined,(_provider,model)=>['model-a','model-b'].includes(model))
 coordinator.prepare('owner',{...input(),exploreFolder:true,sourcePaths:[]},root);await coordinator.run('owner','build')
 expect(step).toBe(2);expect(coordinator.status('owner','build').state).toBe('ready_to_apply')
 expect(fs.existsSync(path.join(root,'README.md'))).toBe(false);coordinator.discard('owner','build')
})
