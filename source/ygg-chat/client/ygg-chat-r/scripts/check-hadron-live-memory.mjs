import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
if(!process.argv.includes('--run-live'))throw Error('Explicit --run-live required: spends 9-40 real subscription requests, including memory summaries')
const countIndex=process.argv.indexOf('--requests'),requestBudget=countIndex<0?9:Number(process.argv[countIndex+1])
if(!Number.isSafeInteger(requestBudget)||requestBudget<9||requestBudget>40)throw Error('Choose 9-40 real requests explicitly')
const index=process.argv.indexOf('--profile'),profile=path.resolve(process.argv[index+1]??'')
if(index<0||!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile)))throw Error('Explicit Hadron profile required')
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/live-memory.mjs')
await build({stdin:{contents:`export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {ContinuousChatService} from './server/hadronTools/continuousChat.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {ClaudeCodeRuntime,HadronCodexRuntime,ContinuousChatService,executionStartup}=await import(pathToFileURL(output).href)
executionStartup.initialize(profile,'standard');if(!executionStartup.status().execution.ready)throw Error('Hadron execution must be idle; no lock reset or requests were made')
const nativeHostDirectory=path.join(root,'vendor/hadron-worker')
const claude=new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor/claude-code'),profileDirectory:profile,nativeHostDirectory})
const codex=new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor/codex'),profileDirectory:profile,nativeHostDirectory,openBrowser:async()=>{throw Error('No sign-in during acceptance')}})
const evidence=executionStartup.privatePath('validation-memory-'+randomUUID());fs.mkdirSync(evidence)
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite'),db=new DatabaseSync(path.join(evidence,'conversation.db'));db.exec('PRAGMA synchronous=FULL;PRAGMA foreign_keys=ON')
let service
try{
 const openai=await codex.models(),anthropic=await claude.models(),model=openai.find(item=>item.id.toLowerCase().includes('luna'))
 if(!model||!anthropic.some(item=>item.id==='haiku'))throw Error('Both existing subscriptions must be ready; no sign-in attempted')
 const providers=[],packets=[]
 // The real scheduler/native engines are exercised; run-binding IDs in this
 // standalone adapter are controlled. Built desktop fixtures cover real run rows.
 service=new ContinuousChatService(db,{allowedModels:new Set([model.id]),admitModel:(provider,id)=>provider==='claudecode'?claude.allowedModels.has(id):id===model.id,
  authorize:owner=>{if(owner!=='validation')throw Error('Owner mismatch')},cancel:()=>{},join:async()=>{},
  generate:async(_owner,input,role,prompt,signal,onPrepared,packet)=>{
   const provider=input.providers[role],binding={runId:randomUUID(),handle:randomUUID(),streamId:randomUUID()};onPrepared(binding);providers.push(provider);packets.push(packet)
   const result=await (provider==='claudecode'?claude:codex).generate({requestPolicy:'single_attempt',modelName:input.models[role],history:[],userContent:prompt,systemPrompt:`You are Agent ${role.toUpperCase()} in a text-only Hadron conversation. If kind is continuous_memory, follow its instruction to summarise the transcript and previousMemory, keeping the handover marker and decisions with source-turn references. Otherwise follow the shared goal, memory and latest peer transcript. You have no tools, files or delegation.`,tools:[],signal})
   return {text:result.content,binding}
  }})
 service.start('validation',{id:'mixed-live',workspaceId:'validation',anchorMessageId:'validation',goal:'Collaboratively create a deployment checklist for a fictional app. Each conversational turn adds ONE new checklist item; do not repeat previous items or restate agreement. Keep each reply below 25 words. Remember the handover marker CEDAR-47 and requirement to preserve rollback backups. No tools or tests are available.',providers:{a:'openaichatgpt',b:'claudecode'},models:{a:model.id,b:'haiku'},maxTurns:requestBudget,maxSeconds:900})
 let view
 for(let step=0;step<9200;step++){view=service.status('validation','mixed-live');if(view.workersEnded)break;await new Promise(resolve=>setTimeout(resolve,100))}
 const memoryRequests=packets.filter(packet=>packet.kind==='continuous_memory')
 const lastPacket=packets.at(-1)
 const success=view?.state==='paused'&&view.reason==='turn_budget'&&view.turns.length===requestBudget&&view.turns.every(turn=>turn.state==='completed')&&memoryRequests.length>=1&&view.memory?.text.includes('CEDAR-47')&&/rollback/i.test(view.memory.text)&&lastPacket.kind==='continuous_conversation'&&lastPacket.memory?.text===view.memory.text&&lastPacket.transcript.length<=6
 const report={success,realSubscriptionRequests:providers.length,requestBudget,providers,models:[model.id,'haiku'],completedReplies:view?.turns.filter(turn=>turn.kind==='reply'&&turn.state==='completed').length,summaryRequests:memoryRequests.length,memoryThroughReply:view?.memory?.throughTurn,markerAndRollbackPreserved:!!view.memory?.text.includes('CEDAR-47')&&/rollback/i.test(view.memory.text),lastPromptUsesMemory:lastPacket?.memory?.text===view.memory?.text,lastPromptRecentReplies:lastPacket?.transcript?.length,promptByteSizes:packets.map(packet=>Buffer.byteLength(JSON.stringify(packet))),state:view?.state,reason:view?.reason,nativeWorkersJoined:view?.workersEnded??false,signInOrOut:false,projectFilesChanged:false,evidence,adapter:'Real scheduler and official provider engines; controlled standalone run bindings. Actual desktop run-service bindings are covered by the separate Electron fixture.'}
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!success)process.exitCode=1
}finally{if(service)await service.shutdown();else db.close();await Promise.all([codex.shutdown(),claude.shutdown()])}
