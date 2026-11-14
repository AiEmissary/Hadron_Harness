import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
if(!process.argv.includes('--run-live'))throw Error('Explicit --run-live required: spends two real subscription jobs')
const index=process.argv.indexOf('--profile'),profile=path.resolve(process.argv[index+1]??'')
if(index<0||!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile)))throw Error('Explicit Hadron profile required')
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/live-mixed.mjs')
await build({stdin:{contents:`export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {ContinuousChatService} from './server/hadronTools/continuousChat.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {ClaudeCodeRuntime,HadronCodexRuntime,ContinuousChatService,executionStartup}=await import(pathToFileURL(output).href)
executionStartup.initialize(profile,'standard');if(!executionStartup.status().execution.ready)throw Error('Hadron execution must be idle; no lock reset or requests were made')
const nativeHostDirectory=path.join(root,'vendor/hadron-worker')
const claude=new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor/claude-code'),profileDirectory:profile,nativeHostDirectory})
const codex=new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor/codex'),profileDirectory:profile,nativeHostDirectory,openBrowser:async()=>{throw Error('No sign-in during acceptance')}})
const evidence=executionStartup.privatePath('validation-mixed-'+randomUUID());fs.mkdirSync(evidence)
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite'),db=new DatabaseSync(path.join(evidence,'conversation.db'));db.exec('PRAGMA synchronous=FULL;PRAGMA foreign_keys=ON')
let service
try{
 const openai=await codex.models(),anthropic=await claude.models(),model=openai.find(item=>item.id.toLowerCase().includes('luna'))
 if(!model||!anthropic.some(item=>item.id==='sonnet'))throw Error('Both existing subscriptions must be ready; no sign-in attempted')
 const providers=[]
 // The real scheduler/native engines are exercised; run-binding IDs in this
 // standalone adapter are controlled. Built desktop fixtures cover real run rows.
 service=new ContinuousChatService(db,{allowedModels:new Set([model.id]),admitModel:(provider,id)=>provider==='claudecode'?claude.allowedModels.has(id):id===model.id,
  authorize:owner=>{if(owner!=='validation')throw Error('Owner mismatch')},cancel:()=>{},join:async()=>{},
  generate:async(_owner,input,role,prompt,signal,onPrepared)=>{
   const provider=input.providers[role],binding={runId:randomUUID(),handle:randomUUID(),streamId:randomUUID()};onPrepared(binding);providers.push(provider)
   const result=await (provider==='claudecode'?claude:codex).generate({requestPolicy:'single_attempt',modelName:input.models[role],history:[],userContent:prompt,systemPrompt:`You are Agent ${role.toUpperCase()} in a text-only Hadron conversation. Follow the shared goal and read the supplied peer transcript. You have no tools, files or delegation.`,tools:[],signal})
   return {text:result.content,binding}
  }})
 service.start('validation',{id:'mixed-live',workspaceId:'validation',anchorMessageId:'validation',goal:"Agent A: reply exactly HADRON_PEER_BLUE. Agent B: quote Agent A's token and say Claude received it. No other text.",providers:{a:'openaichatgpt',b:'claudecode'},models:{a:model.id,b:'sonnet'},maxTurns:2,maxSeconds:90})
 let view
 for(let step=0;step<1000;step++){view=service.status('validation','mixed-live');if(view.workersEnded)break;await new Promise(resolve=>setTimeout(resolve,100))}
 const success=view?.state==='paused'&&view.turns.length===2&&view.turns.every(turn=>turn.state==='completed')&&view.turns[1].text.includes('HADRON_PEER_BLUE')&&providers.join(',')==='openaichatgpt,claudecode'
 const report={success,realSubscriptionJobs:providers.length,providers,models:[model.id,'sonnet'],peerTokenReceived:view?.turns[1]?.text?.includes('HADRON_PEER_BLUE')??false,nativeWorkersJoined:view?.workersEnded??false,signInOrOut:false,projectFilesChanged:false,evidence}
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!success)process.exitCode=1
}finally{if(service)await service.shutdown();else db.close();await Promise.all([codex.shutdown(),claude.shutdown()])}
