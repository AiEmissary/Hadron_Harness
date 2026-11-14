// Opt-in, synthetic-data-only acceptance. Observes local transport boundaries;
// it cannot inspect the providers' internal delivery logs or model attention.
import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
if(!process.argv.includes('--run-live'))throw Error('Explicit --run-live required: up to four real subscription replies')
const index=process.argv.indexOf('--profile'),profile=path.resolve(process.argv[index+1]??'')
if(index<0||path.basename(profile)!=='Hadron-Harness')throw Error('Explicit owning Hadron profile required; no sign-in or credential copying')
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/live-continuous-context.mjs')
await build({stdin:{contents:`export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {ContinuousChatService} from './server/hadronTools/continuousChat.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';export {projectExecutionGate} from './server/hadronTools/executionGate.ts';`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {ClaudeCodeRuntime,HadronCodexRuntime,ContinuousChatService,executionStartup,projectExecutionGate}=await import(pathToFileURL(output).href)
executionStartup.initialize(profile,'standard')
// A standard session's legacy marker does not prohibit tool-free provider jobs.
// A project marker or failed ledger must still block this standalone process.
projectExecutionGate.assertExternalLaunchAllowed()
const evidence=executionStartup.privatePath('validation-context-'+randomUUID());fs.mkdirSync(evidence)
console.log('Evidence: '+evidence)
const digest=text=>createHash('sha256').update(text).digest('hex')
const receipts=[],dispatches=[],replies=[]
let current
const observe=(boundary,prompt,systemPrompt,model)=>{
 if(!current)throw Error('Unexpected generation outside a reserved turn')
 const receipt={turn:current.turn,role:current.role,boundary,model,prompt,systemPrompt,
  promptSha256:digest(prompt),systemPromptSha256:digest(systemPrompt),sameAsScheduler:prompt===current.prompt,
  allEarlierRepliesPresent:replies.every(reply=>prompt.includes(reply.text.split('\n').map(line=>'> '+line).join('\n')))}
 receipts.push(receipt);return receipt
}
const nativeHostDirectory=path.join(root,'vendor/hadron-worker')
const claude=new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor/claude-code'),profileDirectory:profile,nativeHostDirectory})
const capture=claude.capture.bind(claude)
claude.capture=async(args,options)=>{
 let receipt
 if(args.includes('--print')&&typeof options.input==='string'){
  const systemPrompt=fs.readFileSync(args[args.indexOf('--system-prompt-file')+1],'utf8')
  receipt=observe('Claude CLI stdin submission (not provider HTTP capture)',options.input,systemPrompt,args[args.indexOf('--model')+1])
 }
 const result=await capture(args,options)
 if(receipt)receipt.nativeExitCode=result.code
 return result
}
const codex=new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor/codex'),profileDirectory:profile,nativeHostDirectory,
 openBrowser:async()=>{throw Error('No sign-in during validation')},fetch:async(url,options)=>{
  let receipt
  if(options?.method==='POST'&&new URL(String(url)).pathname.endsWith('/responses')){
   const payload=JSON.parse(options.body)
   if(payload.input.length!==1||payload.input[0].role!=='user'||typeof payload.input[0].content!=='string')throw Error('Unexpected outbound context shape')
   receipt=observe('ChatGPT outbound HTTP request',payload.input[0].content,payload.instructions,payload.model)
  }
  const response=await fetch(url,options)
  if(receipt){receipt.httpStatus=response.status;receipt.requestId=response.headers.get('x-request-id')}
  return response
 }})
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite'),db=new DatabaseSync(path.join(evidence,'conversation.db'))
db.exec('PRAGMA synchronous=FULL;PRAGMA foreign_keys=ON')
let service,report={success:false,evidence,realRequestsAttempted:0}
try{
 const models=await codex.models(),claudeModels=await claude.models(),model=models.find(item=>item.id.toLowerCase().includes('luna'))
 if(!model||!claudeModels.some(item=>item.id==='haiku'))throw Error('Both existing subscriptions must be ready; no sign-in attempted')
 service=new ContinuousChatService(db,{allowedModels:new Set([model.id]),admitModel:(provider,id)=>provider==='claudecode'?claude.allowedModels.has(id):id===model.id,
  authorize:owner=>{if(owner!=='validation')throw Error('Owner mismatch')},cancel:()=>{},join:async()=>{},
  generate:async(_owner,input,role,prompt,signal,onPrepared,packet)=>{
   const binding={runId:randomUUID(),handle:randomUUID(),streamId:randomUUID()};onPrepared(binding)
   const own='N'+randomUUID().replaceAll('-',''),turn=packet.turn,provider=input.providers[role]
   current={turn,role,prompt};dispatches.push({...current,provider,model:input.models[role]})
   const systemPrompt=`You are Agent ${role.toUpperCase()} in a synthetic four-turn transport check. Reply with exactly two lines: OWN=${own} and SEEN=<the OWN value in the immediately preceding peer reply, or NONE if there is no preceding reply>. Read that peer value only from the supplied conversation history. Do not invent it. Do not emit consensus markers. No tools, files or delegation.`
   console.log('Dispatch turn '+turn+' Agent '+role.toUpperCase()+' via '+provider)
   const result=await (provider==='claudecode'?claude:codex).generate({requestPolicy:'single_attempt',modelName:input.models[role],history:[],userContent:prompt,systemPrompt,tools:[],signal})
   const expectedPeer=replies.at(-1)?.own??'NONE'
   replies.push({turn,role,text:result.content,own,ownCorrect:new RegExp('^OWN='+own+'$','m').test(result.content),peerCorrect:new RegExp('^SEEN='+expectedPeer+'$','m').test(result.content)})
   current=undefined
   console.log('Completed turn '+turn+'; peer challenge '+(replies.at(-1).peerCorrect?'passed':'FAILED'))
   return {text:result.content,binding}
  }})
 service.start('validation',{id:'context-live',workspaceId:'validation',anchorMessageId:'validation',goal:'Exchange the per-turn transport challenges. Preserve the earlier speaker-attributed replies; no coding or external actions.',
  providers:{a:'openaichatgpt',b:'claudecode'},models:{a:model.id,b:'haiku'},maxTurns:4,maxSeconds:480})
 let view
 for(let step=0;step<5000;step++){view=service.status('validation','context-live');if(view.workersEnded)break;await new Promise(resolve=>setTimeout(resolve,100))}
 const saved=db.prepare('SELECT ordinal,prompt FROM hadron_continuous_turns ORDER BY ordinal').all()
 const exactSaved=saved.length===dispatches.length&&saved.every((row,index)=>row.prompt===dispatches[index].prompt)
 report={success:view?.reason==='turn_budget'&&view.workersEnded&&replies.length===4&&receipts.length===4&&replies.every(reply=>reply.ownCorrect&&reply.peerCorrect)&&receipts.every(receipt=>receipt.sameAsScheduler&&receipt.allEarlierRepliesPresent)&&exactSaved,
  evidence,realRequestsAttempted:dispatches.length,completedReplies:replies.length,alternatingRoles:replies.map(reply=>reply.role),state:view?.state,reason:view?.reason,
  outboundBoundaryMatchesScheduler:receipts.every(receipt=>receipt.sameAsScheduler),allEarlierRepliesPresentAtEachObservedBoundary:receipts.every(receipt=>receipt.allEarlierRepliesPresent),exactSavedPromptMatchesDispatch:exactSaved,
  freshPeerChallengeChecks:replies.map(({turn,ownCorrect,peerCorrect})=>({turn,ownCorrect,peerCorrect})),workersEnded:view?.workersEnded,
  boundaries:receipts.map(({prompt,systemPrompt,...receipt})=>receipt),
  limits:['Local transport observations, not independent provider-internal delivery logs.','Claude observation is CLI stdin, not decrypted provider HTTP.','Four alternating replies without compaction; does not establish long-run memory quality, all modes, or general reliability.','Uses the real scheduler and provider engines with controlled standalone run bindings; desktop run bindings were checked separately with simulated providers.','Turn contexts differ because later replies add history and each agent has its own role instructions. No claim of identical full histories or model attention.']}
}catch(error){report={...report,realRequestsAttempted:dispatches.length,completedReplies:replies.length,error:String(error?.message??error)}}
finally{
 fs.writeFileSync(path.join(evidence,'transport-receipts.json'),JSON.stringify(receipts,null,2))
 fs.writeFileSync(path.join(evidence,'dispatches-and-replies.json'),JSON.stringify({dispatches,replies},null,2))
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2))
 console.log(JSON.stringify(report,null,2));if(!report.success)process.exitCode=1
 if(service)await service.shutdown();else db.close()
 await Promise.all([codex.shutdown(),claude.shutdown()])
}
