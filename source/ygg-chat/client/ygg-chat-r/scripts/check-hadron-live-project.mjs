// Explicit opt-in acceptance using Hadron's existing official subscription.
// Never signs in/out, reads/copies credentials, or changes a personal project.
import {build} from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const appRoot=path.resolve(import.meta.dirname,'..'),profileIndex=process.argv.indexOf('--profile')
if(!process.argv.includes('--run-live')||profileIndex<0)throw Error('Explicit --run-live --profile <existing Hadron profile> required')
const profile=path.resolve(process.argv[profileIndex+1]??'')
if(!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile))||!fs.existsSync(profile)||fs.lstatSync(profile).isSymbolicLink())throw Error('Use the existing isolated Hadron profile only')
const output=path.join(appRoot,'node_modules','.cache','hadron','live-project.mjs')
await build({stdin:{contents:`export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';export {ProjectExecutionGate,fileExecutionLedger} from './server/hadronTools/executionGate.ts';export {ProjectWriteStore} from './server/hadronTools/projectWrites.ts';export {ProjectBuildCoordinator} from './server/hadronTools/projectBuildCoordinator.ts';export {AgentJobJournal} from './server/headlessServer/services/collaboration/agentJobJournal.ts';export {projectCheckHost} from './server/hadronTools/projectChecks.ts';export {WindowsOwnedWorkerHost} from './server/auth/windowsOwnedWorker.ts';export {captureOwnedProcess} from './server/auth/hadronOwnedProcess.ts';`,resolveDir:appRoot,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {HadronCodexRuntime,executionStartup,ProjectExecutionGate,fileExecutionLedger,ProjectWriteStore,ProjectBuildCoordinator,AgentJobJournal,projectCheckHost,WindowsOwnedWorkerHost,captureOwnedProcess}=await import(pathToFileURL(output))
executionStartup.initialize(profile,'standard')
if(!executionStartup.status().execution.ready)throw Error('Existing Hadron execution must be idle; no requests or lock resets were made')
const evidence=executionStartup.privatePath('validation-live-'+randomUUID());fs.mkdirSync(evidence)
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-live-project-'))
fs.writeFileSync(path.join(root,'calculator.mjs'),'export function add(a,b){return a-b}\n')
fs.writeFileSync(path.join(root,'calculator.test.mjs'),"import {test} from 'node:test';import assert from 'node:assert/strict';import {add} from './calculator.mjs';test('adds numbers',()=>{assert.equal(add(2,3),5);assert.equal(add(-2,3),1)});\n")
const originalTest=fs.readFileSync(path.join(root,'calculator.test.mjs'),'utf8')
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite'),db=new DatabaseSync(path.join(evidence,'project.db'))
db.exec('PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON')
const native=path.join(appRoot,'vendor','hadron-worker'),diagnostics=[]
const runtime=new HadronCodexRuntime({runtimeDirectory:path.join(appRoot,'vendor','codex'),nativeHostDirectory:native,profileDirectory:profile,openBrowser:async()=>{throw Error('Sign-in forbidden during acceptance')},onJobDiagnostic:value=>diagnostics.push(value)})
let coordinator,owned=false,attempts=0
const report={success:false,personalProjectsChanged:false,signInOrOut:false,credentialsReadOrCopied:false}
try{
 const status=await runtime.status();if(!status.connected)throw Error('Existing Hadron ChatGPT connection is unavailable; no sign-in attempted')
 const models=await runtime.models(),model=models.find(model=>model.id.toLowerCase().includes('luna'))??models[0]
 if(!model)throw Error('No approved model available')
 const gate=new ProjectExecutionGate();gate.configure(fileExecutionLedger(path.join(evidence,'execution')))
 const runs=new Map(),agents={
  spawnDetached:async(request,admission)=>{
   const binding={runId:randomUUID(),handle:randomUUID(),streamId:randomUUID()},run={id:binding.runId,handle:binding.handle,status:'running',conversation_id:request.conversationId,parent_message_id:request.parentMessageId,provider:request.provider,model_name:request.modelName,prompt:request.prompt,system_prompt:request.systemPrompt,final_response:null}
   runs.set(run.id,run);admission.onPrepared(binding);attempts++
   try{const result=await runtime.generate({modelName:request.modelName,systemPrompt:request.systemPrompt,history:[],userContent:request.prompt,tools:[],requestPolicy:'single_attempt',signal:admission.signal});run.final_response=result.content;run.status='completed';return binding}
   catch(error){run.status=admission.signal.aborted?'aborted':'error';throw error}
  },waitForTerminal:async handle=>[...runs.values()].find(run=>run.handle===handle),isActive:handle=>[...runs.values()].some(run=>run.handle===handle&&run.status==='running'),cancel:()=>runtime.cancelJobs(),
 }
 const writes=new ProjectWriteStore(db,{assertExecution:(owner,workspace,lease)=>coordinator.assertCanonicalWrite(owner,workspace,lease)})
 coordinator=new ProjectBuildCoordinator(db,writes,{agents,runs:{getRunById:id=>runs.get(id)},allowedModels:new Set([model.id]),journal:new AgentJobJournal(path.join(evidence,'logs')),execution:gate,authorize:owner=>assert.equal(owner,'live-acceptance'),assertApplyConsent:(owner,input)=>{assert.equal(owner,'live-acceptance');assert.equal(input.id,'live-build');assert.equal(fs.realpathSync(root),root)}})
 projectCheckHost.install(async(cwd,files,signal)=>{
  assert.equal(cwd,root);assert.deepEqual(files.map(file=>file.path),['calculator.test.mjs'])
  const host=new WindowsOwnedWorkerHost(native,profile,executionStartup.workerEpochId())
  const result=await host.run({executable:process.execPath,args:['--test',path.join(root,'calculator.test.mjs')],cwd:root,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR},signal,consume:child=>{const result=captureOwnedProcess(child,{signal,timeout:20000,maxBytes:65536});child.stdin.end();return result}})
  return {code:result.code,output:result.text}
 })
 coordinator.prepare('live-acceptance',{id:'live-build',workspaceId:'disposable-workspace',anchorMessageId:'disposable-anchor',task:'Correct add(a,b) so it returns the arithmetic sum of numeric arguments. Change only calculator.mjs. Preserve the tests.',plan:'Make the smallest useful implementation correction. Independently review the exact diff; no tests have run yet.',deliverables:['Numeric addition works for positive and negative arguments.'],models:{a:model.id,b:model.id},sourcePaths:['calculator.mjs','calculator.test.mjs']},root,[profile,appRoot]);owned=true
 await coordinator.run('live-acceptance','live-build')
 const reviewed=coordinator.status('live-acceptance','live-build')
 assert.equal(reviewed.state,'ready_to_apply');assert.equal(reviewed.drafts.length,1);assert.equal(reviewed.drafts[0].path,'calculator.mjs')
 await coordinator.apply('live-acceptance','live-build',reviewed.writes.reviews.at(-1).snapshotHash)
 await coordinator.runChecks('live-acceptance','live-build',['calculator.test.mjs'])
 const final=coordinator.status('live-acceptance','live-build')
 assert.equal(final.tests.status,'passed');assert.equal(final.projectFilesChanged,true)
 assert.equal(fs.readFileSync(path.join(root,'calculator.test.mjs'),'utf8'),originalTest)
 coordinator.discard('live-acceptance','live-build');owned=false
 Object.assign(report,{success:true,actualChatGPTProposalAndIndependentReview:true,actualReviewedApplication:true,actualNodeTestsPassed:true,testsPreserved:true,model:model.id,modelAttempts:attempts})
}catch(error){report.failure=String(error?.message??'Live acceptance failed').slice(0,300)}
finally{
 await runtime.shutdown()
 if(owned){try{coordinator.discard('live-acceptance','live-build')}catch{/* Retain only this test's separate recovery evidence; never clear the user's execution marker. */}}
 report.realProviderRequests=diagnostics.reduce((sum,value)=>sum+value.requests,0)
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2));db.close()
 console.log('Live acceptance evidence: '+evidence);console.log(JSON.stringify(report,null,2));if(!report.success)process.exitCode=1
}
