import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
if(!process.argv.includes('--run-live'))throw Error('Explicit --run-live required: two real reviewer requests')
const index=process.argv.indexOf('--profile'),profile=path.resolve(process.argv[index+1]??'')
if(index<0||!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile))||!fs.existsSync(profile)||fs.lstatSync(profile).isSymbolicLink())throw Error('Explicit existing Hadron profile required')
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/live-second-opinion.mjs')
await build({stdin:{contents:`export {secondOpinionPacket} from './src/features/collaboration/secondOpinion.ts';export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {secondOpinionPacket,HadronCodexRuntime,ClaudeCodeRuntime,executionStartup}=await import(pathToFileURL(output))
executionStartup.initialize(profile,'standard');if(!executionStartup.status().execution.ready)throw Error('Hadron execution must be idle; no lock reset or request attempted')
const evidence=executionStartup.privatePath('validation-live-second-opinion-'+randomUUID());fs.mkdirSync(evidence)
const nativeHostDirectory=path.join(root,'vendor/hadron-worker')
const codex=new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor/codex'),profileDirectory:profile,nativeHostDirectory,openBrowser:async()=>{throw Error('No sign-in during acceptance')}})
const claude=new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor/claude-code'),profileDirectory:profile,nativeHostDirectory})
const report={success:false,evidence,realRequests:0,results:[],personalProjectEdits:false,signInOrOut:false,adapter:'Real official provider engines and actual bounded second-opinion packet. Deliberately flawed fixture answers; source responses are not attributed to actual provider generation. Full modal/controller preservation is separately tested in Electron.'}
try{
 const models={openaichatgpt:await codex.models(),claudecode:await claude.models()}
 for(const provider of ['claudecode','openaichatgpt']){
  const source=provider==='claudecode'?'openaichatgpt':'claudecode'
  const model=provider==='claudecode'?'haiku':models.openaichatgpt.find(item=>/luna/i.test(item.id))?.id
  if(!models[provider].some(item=>item.id===model))throw Error('Existing connected reviewer model unavailable')
  const question={id:'q',parentId:null,kind:'task',jobId:'fixture',conversationId:'fixture',text:'What is seven multiplied by eight?',status:'completed',provider:source,modelName:'fixture'}
  const answer={...question,id:'a',parentId:'q',kind:'response',text:'Seven multiplied by eight equals 54. No tools or tests were used.'}
  const sibling={...question,id:'private-sibling',text:'PRIVATE_SIBLING_MUST_NOT_BE_SHARED'}
  const original=JSON.stringify([question,answer,sibling]),packet=secondOpinionPacket([question,answer,sibling],'a')
  if(packet.context.includes('PRIVATE_SIBLING')||packet.excerpted)throw Error('Review packet escaped the selected branch')
  report.realRequests++
  const result=await (provider==='claudecode'?claude:codex).generate({requestPolicy:'single_attempt',modelName:model,history:[],userContent:JSON.stringify({task:packet.task,context:packet.context}),systemPrompt:'You are a text-only Hadron second-opinion reviewer. Follow the review task. You have no tools, files, shell, delegation or browsing. Do not claim verification.',tools:[],signal:AbortSignal.timeout(120000)})
  const disclaimer=/(?:text review|not independent verification)/i.test(result.content)&&/(?:not.{0,35}verif|did not.{0,45}(?:run|check|verify))/i.test(result.content)
  const success=/56/.test(result.content)&&/verdict/i.test(result.content)&&/main concerns/i.test(result.content)&&/suggested correction/i.test(result.content)&&disclaimer&&JSON.stringify([question,answer,sibling])===original
  report.results.push({sourceProvider:source,reviewProvider:provider,reviewModel:model,success,concreteErrorCorrected:/56/.test(result.content),reviewDisclaimerPresent:disclaimer,sourceAndSiblingUnchanged:true,packetBytes:Buffer.byteLength(packet.context),review:result.content})
  if(!success)throw Error('Second-opinion acceptance criteria were not met')
 }
 report.success=true
}catch(error){report.failure='Second-opinion check failed; inspect the saved results before repeating.';process.exitCode=1}
finally{await Promise.all([codex.shutdown(),claude.shutdown()]);report.nativeWorkersJoined=true;fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
