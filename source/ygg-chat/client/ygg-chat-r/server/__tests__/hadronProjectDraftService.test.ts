import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {ProjectDraftService,createProjectDraftHost} from '../hadronTools/projectDraftService.js'
import {ProjectBuildCoordinator} from '../hadronTools/projectBuildCoordinator.js'
import {ProjectWriteStore} from '../hadronTools/projectWrites.js'
import {ProjectExecutionGate,fileExecutionLedger} from '../hadronTools/executionGate.js'
import {AgentJobJournal} from '../headlessServer/services/collaboration/agentJobJournal.js'
import type {ProjectDraftInput} from '../../../../shared/projectBuild.js'
import {projectApplicationAuthority} from '../hadronTools/projectApplicationAuthority.js'
import {projectCheckHost} from '../hadronTools/projectChecks.js'
let consent=true,checkCodes:number[]=[]
projectApplicationAuthority.install(async()=>consent)
projectApplicationAuthority.installAutomation(async()=>consent)
projectCheckHost.install(async(root,files,_signal,_kind,approval)=>{if(approval)projectApplicationAuthority.assertAutomationCheck(approval,root,files);return {code:checkCodes.shift()??1,output:'Synthetic failing test: expected repaired content'}})
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
let temporary:string,root:string,db:any,service:ProjectDraftService,coordinator:ProjectBuildCoordinator,execution:ProjectExecutionGate
let requests:any[],runs:Map<string,any>,paused:boolean,release:(()=>void)|undefined,agents:any
const input=(id='build',workspaceId='workspace'):ProjectDraftInput=>({id,workspaceId,anchorMessageId:'anchor',task:'Improve the text.',plan:'One small reviewed proposal.',deliverables:['A reviewed change'],models:{a:'model-a',b:'model-b'}})
const authorize=(owner:string,workspace:string)=>{if(owner!=='owner'||!['workspace','other-workspace'].includes(workspace))throw Error('Workspace denied')}
function make(){return new ProjectDraftService(db,coordinator,execution,authorize)}
beforeEach(()=>{
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-project-draft-'));root=path.join(temporary,'project');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'example.txt'),'original')
 db=new DatabaseSync(path.join(temporary,'project.db'));requests=[];runs=new Map();paused=false;release=undefined
 execution=new ProjectExecutionGate();execution.configure(fileExecutionLedger(path.join(temporary,'execution')))
 agents={spawnDetached:vi.fn(async(request:any,admission:any)=>{
  const index=requests.push(request),id='run-'+index,handle='handle-'+index,streamId='stream-'+index
  const run={id,handle,status:'running',conversation_id:request.conversationId,parent_message_id:request.parentMessageId,provider:request.provider,
   model_name:request.modelName,prompt:request.prompt,system_prompt:request.systemPrompt,final_response:null}
  runs.set(id,run);admission.onPrepared({runId:id,handle,streamId})
  if(paused)await new Promise<void>(resolve=>{release=resolve;admission.signal.addEventListener('abort',resolve,{once:true})})
  const packet=JSON.parse(request.prompt)
  run.final_response=JSON.stringify(packet.kind==='project_proposal'?{summary:'A proposed edit.',changes:[{path:'example.txt',expectedHash:packet.evidence[0].hash,text:'replacement'}]}:{snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'Reviewed the exact proposal. Tests not run.'})
  run.status=admission.signal.aborted?'aborted':'completed'
  return {runId:id,handle,streamId}
 }),waitForTerminal:async(handle:string)=>[...runs.values()].find(row=>row.handle===handle),
 isActive:(handle:string)=>[...runs.values()].some(row=>row.handle===handle&&row.status==='running'),
 cancel:(handle:string)=>{const row=[...runs.values()].find(row=>row.handle===handle);if(row?.status==='running')row.status='aborted';release?.()}}
 coordinator=new ProjectBuildCoordinator(db,new ProjectWriteStore(db),{agents,runs:{getRunById:id=>runs.get(id)},allowedModels:new Set(['model-a','model-b']),
  authorize:(owner,config)=>authorize(owner,config.workspaceId),journal:new AgentJobJournal(path.join(temporary,'logs')),execution})
 service=make()
 consent=true
 checkCodes=[]
})
afterEach(()=>{
 vi.restoreAllMocks();if(db)db.close()
 if(path.dirname(temporary)!==fs.realpathSync(os.tmpdir())||!path.basename(temporary).startsWith('hadron-project-draft-'))throw Error('Invalid test cleanup root')
 fs.rmSync(temporary,{recursive:true,force:true})
})
function selected(){const grant=service.select('owner','workspace',root,[]);return service.selectSources('owner',grant.id,[path.join(root,'example.txt')])}
it('reports optional proposal storage failure without inventing a service or a recovery grant',()=>{
 const host=createProjectDraftHost();host.enable();host.storageUnavailable()
 expect(host.availability()).toEqual({available:false,ready:false,reason:'project_storage_unavailable'})
 expect(()=>host.get()).toThrow('not ready')
 expect('apply' in host).toBe(false);expect(requests).toHaveLength(0)
})
async function completed(id='build'){
 for(let step=0;step<100;step++){const view=service.status('owner',id);if(view.workersEnded)return view;await new Promise(resolve=>setImmediate(resolve))}
 throw Error('Project fixture did not settle')
}
function enableApplication(){
 const writes=new ProjectWriteStore(db,{assertExecution:(owner,workspace,lease)=>coordinator.assertCanonicalWrite(owner,workspace,lease)})
 coordinator=new ProjectBuildCoordinator(db,writes,{agents,runs:{getRunById:id=>runs.get(id)},allowedModels:new Set(['model-a','model-b']),
  authorize:(owner,config)=>authorize(owner,config.workspaceId),journal:new AgentJobJournal(path.join(temporary,'logs')),execution,
  assertApplyConsent:(owner,config,hash)=>projectApplicationAuthority.assert(owner,config.id,hash)})
 service=make()
}
it('native approval applies the reviewed file once; decline and historical reopen cannot write',async()=>{
 enableApplication();const grant=selected();service.start('owner',grant.id,input());await completed()
 expect(service.status('owner','build').canApply).toBe(true)
 consent=false;await service.apply('owner','build');expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 consent=true;await service.apply('owner','build')
 expect(service.status('owner','build')).toMatchObject({state:'applied',canApply:false,projectFilesChanged:true})
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('replacement')
 await expect(service.apply('owner','build')).rejects.toThrow('fresh proposal')
 expect(requests).toHaveLength(2);service.close('owner','build')
})
it('repairs use fresh evidence and real saved test output, retain previous jobs and stop after two rounds',async()=>{
 const grant=selected();fs.writeFileSync(path.join(root,'example.test.cjs'),'// selected test fixture')
 service.start('owner',grant.id,input());await completed()
 await expect(Promise.resolve().then(()=>service.repair('owner','build'))).rejects.toThrow('failed test')
 await service.runChecks('owner','build',['example.test.cjs'])
 let next=service.repair('owner','build');await completed(next.id)
 expect(next.input.sourcePaths).toContain('example.test.cjs')
 expect(next.input.plan).toContain('Synthetic failing test')
 expect(service.status('owner','build').state).toBe('discarded')
 expect(service.list('owner','workspace')).toHaveLength(2)
 await service.runChecks('owner',next.id,['example.test.cjs'])
 next=service.repair('owner',next.id);await completed(next.id)
 await service.runChecks('owner',next.id,['example.test.cjs'])
 expect(()=>service.repair('owner',next.id)).toThrow('Two repair rounds')
 expect(service.selectSources('owner',grant.id,[path.join(root,'example.txt')]).sourcePaths).toEqual(['example.txt'])
 expect(requests).toHaveLength(6);service.close('owner',next.id)
})
it('one bounded approval applies, tests, obtains a fresh A/B repair and retests without extra user actions',async()=>{
 enableApplication();const grant=selected();fs.writeFileSync(path.join(root,'example.test.cjs'),'// fixed approved test')
 service.start('owner',grant.id,input());await completed();checkCodes=[1,0]
 const started=await service.automate('owner','build',['example.test.cjs'])
 expect(started.state).toBe('automating')
 for(let step=0;step<100;step++){if(service.status('owner','build').automation?.state!=='running')break;await new Promise(resolve=>setImmediate(resolve))}
 const result=service.status('owner','build')
 expect(result.automation).toMatchObject({state:'passed',repairs:1})
 expect(result).toMatchObject({state:'applied',tests:{status:'passed'},projectFilesChanged:true,workersEnded:true})
 expect(requests).toHaveLength(4)
 expect(result.id).not.toBe('build')
 expect(db.prepare('SELECT COUNT(*) AS count FROM hadron_project_applications').get().count).toBe(2)
 service.close('owner',result.id)
})
it('bounded automation stops at two repairs and never turns persistent test failure into success',async()=>{
 enableApplication();const grant=selected();fs.writeFileSync(path.join(root,'example.test.cjs'),'// fixed test')
 service.start('owner',grant.id,input());await completed()
 await service.automate('owner','build',['example.test.cjs'])
 for(let step=0;step<200;step++){if(service.status('owner','build').automation?.state!=='running')break;await new Promise(resolve=>setImmediate(resolve))}
 const result=service.status('owner','build')
 expect(result.automation).toMatchObject({state:'needs_work',repairs:2})
 expect(result.tests.status).toBe('failed');expect(requests).toHaveLength(6)
 service.close('owner',result.id)
})
it('Stop during an automatic repair cancels and joins its actual request without starting a successor',async()=>{
 enableApplication();const grant=selected();fs.writeFileSync(path.join(root,'example.test.cjs'),'// fixed test')
 service.start('owner',grant.id,input());await completed();paused=true
 await service.automate('owner','build',['example.test.cjs'])
 for(let step=0;step<100&&requests.length<3;step++)await new Promise(resolve=>setImmediate(resolve))
 expect(requests).toHaveLength(3)
 service.stop('owner','build')
 for(let step=0;step<100;step++){if(service.status('owner','build').automation?.state!=='running')break;await new Promise(resolve=>setImmediate(resolve))}
 const result=service.status('owner','build')
 expect(result.automation?.state).toBe('stopped');expect(result.workersEnded).toBe(true)
 expect(requests).toHaveLength(3);service.close('owner',result.id)
})
it('binds native selection to owner/workspace and refuses roots inside protected storage',()=>{
 expect(()=>service.select('other','workspace',root,[])).toThrow('Workspace denied')
 expect(()=>service.select('owner','workspace',root,[temporary])).toThrow('protected')
 const grant=selected();expect(grant).toMatchObject({label:'project',sourcePaths:['example.txt']})
 expect(()=>service.selectionDirectory('other',grant.id)).toThrow('selection expires')
 expect(()=>service.start('owner',grant.id,input('foreign','other-workspace'))).toThrow('another workspace')
 expect(requests).toHaveLength(0)
})
it('resolves protected-directory aliases before admitting a project folder',()=>{
 const actual=path.join(temporary,'protected-real'),alias=path.join(temporary,'protected-alias'),project=path.join(actual,'project')
 fs.mkdirSync(project,{recursive:true});fs.symlinkSync(actual,alias,process.platform==='win32'?'junction':'dir')
 expect(()=>service.select('owner','workspace',project,[alias])).toThrow('protected')
 expect(requests).toHaveLength(0)
})
it('refuses outside, secret, replaced-root and duplicate file selections before inference',()=>{
 const grant=selected(),outside=path.join(temporary,'outside.txt');fs.writeFileSync(outside,'private')
 expect(()=>service.selectSources('owner',grant.id,[outside])).toThrow('inside this project')
 fs.writeFileSync(path.join(root,'.env'),'secret')
 expect(()=>service.selectSources('owner',grant.id,[path.join(root,'.env')])).toThrow()
 expect(()=>service.selectSources('owner',grant.id,[path.join(root,'example.txt'),path.join(root,'example.txt')])).toThrow('only once')
 fs.renameSync(root,path.join(temporary,'original-project'));fs.mkdirSync(root)
 expect(()=>service.selectionDirectory('owner',grant.id)).toThrow('Selected project changed')
 expect(requests).toHaveLength(0)
})
it('uses only native-selected source paths, preserves real files and exposes no application authority',async()=>{
 const grant=selected();service.start('owner',grant.id,{...input(),sourcePaths:['.env']} as any)
 const view=await completed()
 expect(view).toMatchObject({state:'ready_to_apply',canApply:false,projectFilesChanged:false,tests:{status:'not_run'}})
 expect(view.input.sourcePaths).toEqual(['example.txt']);expect(requests).toHaveLength(2)
 expect(JSON.parse(requests[0].prompt).evidence[0].text).toBe('original')
 expect(view.drafts[0]).toMatchObject({before:'original',after:'replacement'})
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 expect(service.ownsRun('run-1')).toBe(true);expect(service.ownsRun('unrelated')).toBe(false)
 await expect(service.apply('owner','build')).rejects.toThrow('fresh proposal')
 expect(service.journal('owner','build','b').markdown).toContain('Reviewed the exact proposal')
 service.close('owner','build');expect(execution.status().ready).toBe(true)
})
it('adds files across picker visits and folders, deduplicates repeats, and freezes both selected sources',async()=>{
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','calculator.js'),'export const add=(a,b)=>a+b')
 const first=selected(),second=service.selectSources('owner',first.id,[path.join(root,'src','calculator.js')])
 expect(first.sourcePaths).toEqual(['example.txt'])
 expect(second.sourcePaths).toEqual(['example.txt','src/calculator.js'])
 expect(service.selectSources('owner',first.id,[path.join(root,'example.txt')]).sourcePaths).toEqual(second.sourcePaths)
 service.start('owner',first.id,input());const view=await completed()
 expect(view.input.sourcePaths).toEqual(second.sourcePaths)
 expect(JSON.parse(requests[0].prompt).evidence.map((file:any)=>file.path)).toEqual(second.sourcePaths)
 expect(requests).toHaveLength(2);service.close('owner','build')
 expect(service.selectSources('owner',first.id,[]).sourcePaths).toEqual([])
})
it('accepts a multi-file picker result and keeps the old set on invalid or over-limit additions',()=>{
 const grant=service.select('owner','workspace',root,[])
 const files=Array.from({length:21},(_,index)=>{const file=path.join(root,`source-${index}.txt`);fs.writeFileSync(file,'source');return file})
 expect(service.selectSources('owner',grant.id,files.slice(0,2)).sourcePaths).toHaveLength(2)
 expect(service.selectSources('owner',grant.id,files.slice(2,20)).sourcePaths).toHaveLength(20)
 expect(()=>service.selectSources('owner',grant.id,[files[20]])).toThrow('20 source files in total')
 expect(()=>service.selectSources('owner',grant.id,[path.join(temporary,'outside.txt')])).toThrow('inside this project')
 expect(service.selectSources('owner',grant.id,[files[0]]).sourcePaths).toHaveLength(20)
 expect(requests).toHaveLength(0)
})
it('checks uncertain admissions through read-only lookup without replaying or leaking another workspace',async()=>{
 expect(service.check('owner','workspace','missing')).toBeNull()
 const grant=selected();service.start('owner',grant.id,input());await completed()
 expect(service.check('owner','workspace','build')?.state).toBe('ready_to_apply')
 expect(()=>service.check('owner','other-workspace','build')).toThrow('another workspace')
 expect(()=>service.check('other','workspace','build')).toThrow('Workspace denied')
 expect(requests).toHaveLength(2)
})
it('inspects actual file states without new inference, writes or a resume/reconcile capability',async()=>{
 const grant=selected();service.start('owner',grant.id,input());await completed()
 const first=service.inspect('owner','build')
 expect(first).toMatchObject({readOnly:true,canResume:false,rootVerified:true,workersConfirmedEnded:true,needsRecovery:false,
  files:[{path:'example.txt',current:'original',metadata:'not-required'}]})
 fs.writeFileSync(path.join(root,'example.txt'),'manual change')
 const changed=service.inspect('owner','build')
 expect(changed).toMatchObject({readOnly:true,canResume:false,needsRecovery:true,files:[{path:'example.txt',current:'different'}]})
 expect(changed.message).toContain('differ')
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('manual change')
 expect(requests).toHaveLength(2);expect('reconcile' in service).toBe(false)
 expect('inspectionHash' in first).toBe(false)
})
it('reports native previous-epoch termination without unlocking or replaying the saved proposal',async()=>{
 const grant=selected();service.start('owner',grant.id,input());await completed()
 const epoch='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
 db.prepare('UPDATE hadron_project_builds SET instance_id=? WHERE id=?').run(epoch,'build')
 const observe=vi.fn(()=> 'ended' as const)
 const viewer=new ProjectDraftService(db,coordinator,execution,authorize,observe)
 const before=execution.status()
 const report=viewer.inspect('owner','build')
 expect(report).toMatchObject({readOnly:true,canResume:false,workersConfirmedEnded:true,workerEvidence:'windows-epoch',needsRecovery:true})
 expect(observe).toHaveBeenCalledWith(epoch);expect(requests).toHaveLength(2)
 expect(execution.status()).toEqual(before);expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 observe.mockClear();expect(()=>viewer.inspect('other','build')).toThrow('unavailable');expect(observe).not.toHaveBeenCalled()
})
it('authenticates inspection before reading files and reports a changed root without unlocking',async()=>{
 const grant=selected();service.start('owner',grant.id,input());await completed()
 const read=vi.spyOn(fs,'readSync')
 expect(()=>service.inspect('other','build')).toThrow('unavailable');expect(read).not.toHaveBeenCalled()
 fs.renameSync(root,path.join(temporary,'old-project'));fs.mkdirSync(root)
 const inspection=service.inspect('owner','build')
 expect(inspection).toMatchObject({readOnly:true,canResume:false,rootVerified:false,needsRecovery:true})
 expect(execution.status().reason).toBe('project_active');expect(requests).toHaveLength(2)
})
it('keeps separate saved workspace lists and preserves drafts after closing',async()=>{
 const grant=selected();service.start('owner',grant.id,input());await completed();service.close('owner','build')
 expect(service.list('owner','workspace')).toEqual([{id:'build',task:'Improve the text.',state:'discarded'}])
 expect(service.list('owner','other-workspace')).toEqual([])
 expect(service.check('owner','workspace','build')?.drafts[0].after).toBe('replacement')
 expect(requests).toHaveLength(2)
})
it('lists saved metadata without re-reading historical project files or dispatching another request',async()=>{
 const grant=selected();service.start('owner',grant.id,input());await completed();service.close('owner','build')
 const inspect=vi.spyOn(fs,'readSync')
 expect(service.list('owner','workspace')[0].id).toBe('build')
 expect(inspect).not.toHaveBeenCalled();expect(requests).toHaveLength(2)
})
it('expires replaced or restarted native grants and explicitly clears selected files',()=>{
 const first=selected();expect(service.selectSources('owner',first.id,[]).sourcePaths).toEqual([])
 const next=service.select('owner','workspace',root,[])
 expect(()=>service.selectionDirectory('owner',first.id)).toThrow('selection expires')
 expect(()=>make().selectionDirectory('owner',next.id)).toThrow('selection expires')
 service.revokeSelections();expect(()=>service.selectionDirectory('owner',next.id)).toThrow('selection expires')
 expect(requests).toHaveLength(0)
})
it('joins stopped draft workers and releases only a known unchanged draft during shutdown',async()=>{
 const grant=selected();paused=true;service.start('owner',grant.id,input())
 expect(service.status('owner','build').workersEnded).toBe(false)
 await service.shutdown();db=undefined
 expect(execution.status().ready).toBe(true)
 expect(requests).toHaveLength(1)
 expect(fs.readFileSync(path.join(root,'example.txt'),'utf8')).toBe('original')
 expect(()=>service.status('owner','build')).toThrow('closed')
})

it('accepts tested deliverables and prepares a fresh next milestone without inference or source permission replay',async()=>{
 enableApplication();consent=true;checkCodes=[0]
 const grant=selected();service.start('owner',grant.id,input());await completed()
 await service.apply('owner','build')
 fs.writeFileSync(path.join(root,'verify.test.js'),'// selected test fixture')
 await service.runChecks('owner','build',['verify.test.js'])
 expect(()=>service.nextMilestone('owner','build')).toThrow('Accept every')
 const accepted=service.accept('owner','build',['A reviewed change'],false)
 expect(accepted.acceptance?.checked).toEqual(['A reviewed change'])
 const calls=requests.length,next=service.nextMilestone('owner','build')
 expect(requests).toHaveLength(calls);expect(next.sourcePaths).toContain('example.txt')
 service.start('owner',next.id,{...input('next-build'),task:'Next accepted project milestone'})
 await vi.waitFor(()=>expect(service.status('owner','next-build').workersEnded).toBe(true))
 expect(service.milestones('owner','workspace').find(item=>item.id==='next-build')?.parent).toBe('build')
})
it('does not accept unapplied work or failed tests, and records an explicit documentation test waiver',async()=>{
 enableApplication();consent=true;const grant=selected();service.start('owner',grant.id,input());await completed()
 expect(()=>service.accept('owner','build',['A reviewed change'],true)).toThrow('applied')
 await service.apply('owner','build')
 expect(()=>service.accept('owner','build',['A reviewed change'],false)).toThrow('passing tests')
 expect(service.accept('owner','build',['A reviewed change'],true).acceptance?.testsWaived).toBe(true)
 fs.writeFileSync(path.join(root,'verify.test.js'),'// failing fixture');checkCodes=[1]
 await service.runChecks('owner','build',['verify.test.js'])
 expect(()=>service.nextMilestone('owner','build')).toThrow('no longer')
})

it('keeps automatic repair model budgets fixed by disabling exploratory tools for the approved repair stage',async()=>{
 enableApplication();fs.writeFileSync(path.join(root,'example.test.cjs'),'// test fixture');const grant=selected();service.start('owner',grant.id,{...input(),exploreFolder:true});await completed()
 await service.runChecks('owner','build',['example.test.cjs'])
 const repair=service.repair('owner','build',false);await completed(repair.id)
 expect(service.status('owner',repair.id).input).toMatchObject({exploreFolder:false,helpers:false})
 const calls=agents.spawnDetached.mock.calls.slice(2)
 expect(calls.every(([_request,admission]:any[])=>!admission.toolSession&&!admission.helpers)).toBe(true)
 service.close('owner',repair.id)
})

it('reuses a live proposal selection for chat only in its owning workspace',()=>{
 const grant=selected()
 expect(service.selectionForWorkspace('owner',grant.id,'workspace')).toBe(fs.realpathSync(root))
 expect(()=>service.selectionForWorkspace('other',grant.id,'workspace')).toThrow()
 expect(()=>service.selectionForWorkspace('owner',grant.id,'other')).toThrow()
})
