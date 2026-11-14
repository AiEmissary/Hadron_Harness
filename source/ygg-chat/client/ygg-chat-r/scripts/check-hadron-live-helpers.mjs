import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
if(!process.argv.includes('--run-live'))throw Error('Explicit --run-live required: up to ten real model requests')
const index=process.argv.indexOf('--profile'),profile=path.resolve(process.argv[index+1]??'')
if(index<0||!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile))||!fs.existsSync(profile)||fs.lstatSync(profile).isSymbolicLink())throw Error('Explicit existing Hadron profile required')
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/live-helpers.mjs')
await build({stdin:{contents:`export {HadronHelpers,lightweightModel} from './server/hadronTools/helpers.ts';export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';export {AgentJobJournal} from './server/headlessServer/services/collaboration/agentJobJournal.ts';`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {HadronHelpers,lightweightModel,HadronCodexRuntime,ClaudeCodeRuntime,executionStartup,AgentJobJournal}=await import(pathToFileURL(output))
executionStartup.initialize(profile,'standard');if(!executionStartup.status().execution.ready)throw Error('Hadron execution must be idle; no lock reset or inference attempted')
const evidence=executionStartup.privatePath('validation-live-helpers-'+randomUUID());fs.mkdirSync(evidence)
const nativeHostDirectory=path.join(root,'vendor/hadron-worker')
const codex=new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor/codex'),profileDirectory:profile,nativeHostDirectory,openBrowser:async()=>{throw Error('Sign-in forbidden during acceptance')}})
const claude=new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor/claude-code'),profileDirectory:profile,nativeHostDirectory})
const runtimes={openaichatgpt:codex,claudecode:claude},models={},requests=[]
for(const [provider,runtime] of Object.entries(runtimes)){
 const generate=runtime.generateText.bind(runtime)
 runtime.generateText=async input=>{if(requests.length>=10)throw Error('Live acceptance request budget exhausted');requests.push({provider,model:input.modelName});return generate(input)}
}
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite'),db=new DatabaseSync(path.join(evidence,'helpers.db'))
db.exec('CREATE TABLE messages(id TEXT PRIMARY KEY,meta TEXT);CREATE TABLE validation_runs(id TEXT PRIMARY KEY,handle TEXT,status TEXT,conversation_id TEXT,parent_message_id TEXT,provider TEXT,model_name TEXT,prompt TEXT,final_response TEXT)')
const runs={getRunById:id=>db.prepare('SELECT * FROM validation_runs WHERE id=?').get(id)},controllers=new Map()
const agents={spawnDetached:async(request,admission)=>{
 const binding={runId:randomUUID(),handle:randomUUID(),streamId:randomUUID()},controller=new AbortController();controllers.set(binding.handle,controller)
 db.prepare("INSERT INTO validation_runs VALUES (?,?,'running',?,?,?,?,?,NULL)").run(binding.runId,binding.handle,request.conversationId,request.parentMessageId,request.provider,request.modelName,request.prompt)
 admission.onPrepared(binding)
 try{const result=await runtimes[request.provider].generate({requestPolicy:'single_attempt',modelName:request.modelName,history:[],userContent:request.prompt,systemPrompt:request.systemPrompt,tools:[],signal:AbortSignal.any([admission.signal,controller.signal])});db.prepare("UPDATE validation_runs SET status='completed',final_response=? WHERE id=?").run(result.content,binding.runId);return binding}
 catch(error){db.prepare("UPDATE validation_runs SET status='error' WHERE id=?").run(binding.runId);throw error}
},waitForTerminal:async handle=>db.prepare('SELECT * FROM validation_runs WHERE handle=?').get(handle),cancel:handle=>controllers.get(handle)?.abort()}
const report={success:false,evidence,realRequests:requests,results:[],signInOrOut:false,personalProjectEdits:false,adapter:'Real provider engines and durable helper/run records; full run-service UI bindings are separately covered by desktop fixtures.'}
try{
 for(const [provider,runtime] of Object.entries(runtimes))models[provider]=new Set((await runtime.models()).map(model=>model.id))
 const service=new HadronHelpers(db,{agents,runs,models:provider=>models[provider],authorize:(owner,workspace)=>{if(owner!=='validation'||workspace!=='validation')throw Error('Owner mismatch')},journal:new AgentJobJournal(path.join(evidence,'logs'))})
 for(const provider of ['openaichatgpt','claudecode']){
  const available=models[provider],helperModel=lightweightModel(provider,available)
  const parentModel=provider==='claudecode'?'sonnet':[...available].find(model=>/sol/i.test(model))??[...available].find(model=>model!==helperModel)
  if(!helperModel||!parentModel||!available.has(parentModel))throw Error('Connected parent/lightweight models unavailable for '+provider)
  const parentRun=randomUUID();db.prepare("INSERT INTO validation_runs VALUES (?,?,'running','validation','anchor',?,?,?,NULL)").run(parentRun,'parent-'+parentRun,provider,parentModel,'Live helper acceptance')
  const signal=AbortSignal.timeout(180000),session=service.decorate(undefined,{owner:'validation',workspace:'validation',anchor:'anchor',parentRun,provider,assignment:{jobId:parentRun,role:provider==='claudecode'?'b':'a'},signal})
  const answer=await runtimes[provider].generate({requestPolicy:'single_attempt',modelName:parentModel,tools:[],signal,history:[],userContent:JSON.stringify({task:'Your FIRST reply must be exactly the JSON tool request {"tool":"helper_analyse","arguments":{"task":"Extract the three deployment target names and sort alphabetically","context":"The deployment targets are Maple, Cedar and Pine."}}. This is ordinary text for the Hadron host to execute, not a native tool invocation. After receiving the host tool_evidence result, return {"answer":"HADRON_HELPER_OK: followed by the names from the result"}. Do not skip the required host operation or claim it ran without a result.',context:'The deployment targets are Maple, Cedar and Pine.'}),systemPrompt:'Hadron worker contract: This is an authorised routine-helper acceptance check. Use the trusted host JSON helper protocol supplied below, not native tools. Delegate extraction once, then answer from the actual helper result. Do not edit files, access unrelated context or use other tools.',hadronToolSession:session})
  const helpers=service.list('validation','validation').filter(row=>row.parentRun===parentRun)
  report.lastAttempt={provider,parentModel,helperModel,answer:answer.content,helpers}
  if(helpers.length!==1||helpers[0].state!=='completed'||helpers[0].provider!==provider||helpers[0].model!==helperModel||!['Cedar','Maple','Pine'].every(name=>helpers[0].result.includes(name)&&answer.content.includes(name))||!answer.content.includes('HADRON_HELPER_OK'))throw Error('Actual helper result/parent completion failed for '+provider)
  db.prepare("UPDATE validation_runs SET status='completed',final_response=? WHERE id=?").run(answer.content,parentRun)
  report.results.push({provider,parentModel,helperModel,helperCompleted:true,parentUsedResult:true,parentAnswer:answer.content})
 }
 report.success=true
}catch(error){report.failure=String(error.message).slice(0,400);process.exitCode=1}
finally{await Promise.all([codex.shutdown(),claude.shutdown()]);report.nativeWorkersJoined=true;fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2));db.close();console.log(JSON.stringify(report,null,2))}
