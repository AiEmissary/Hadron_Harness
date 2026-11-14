// Explicit two-request acceptance check using a synthetic JPEG; no personal chat/files.
import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
if(!process.argv.includes('--run-live'))throw Error('Use --run-live only for an authorised real subscription check')
const index=process.argv.indexOf('--profile'),profile=path.resolve(process.argv[index+1]??'')
if(index<0||!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile)))throw Error('Explicit Hadron profile required')
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/live-vision.mjs')
fs.mkdirSync(path.dirname(output),{recursive:true})
await build({stdin:{resolveDir:root,loader:'ts',contents:`export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';export {fixtureImage} from '../../shared/__fixtures__/hadronImage.ts';`},outfile:output,bundle:true,platform:'node',format:'esm'})
const {ClaudeCodeRuntime,HadronCodexRuntime,executionStartup,fixtureImage}=await import(pathToFileURL(output).href)
executionStartup.initialize(profile,'standard')
if(!executionStartup.status().execution.ready)throw Error('Hadron execution must be idle; no reset or inference attempted')
const nativeHostDirectory=path.join(root,'vendor/hadron-worker')
const runtimes={claudecode:new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor/claude-code'),nativeHostDirectory,profileDirectory:profile}),openaichatgpt:new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor/codex'),nativeHostDirectory,profileDirectory:profile,openBrowser:async()=>{throw Error('No sign-in during acceptance')}})}
const report={success:false,syntheticImage:true,personalFilesUsed:false,signInOrOut:false,results:[]}
try{
 for(const [provider,runtime] of Object.entries(runtimes)){
  const models=await runtime.models(),model=provider==='claudecode'?models.find(item=>item.id==='sonnet'):models.find(item=>/sol/i.test(item.id))??models[0]
  if(!model){report.results.push({provider,passed:false,reason:'Existing account is not ready; no inference or sign-in attempted'});continue}
  const images=[{...fixtureImage,name:'test.jpg'}]
  try{
   const response=await runtime.generate({modelName:model.id,requestPolicy:'single_attempt',history:[],userContent:'Identify the two coloured shapes in the attached image and their left-to-right order. Reply in one short sentence.',images,systemPrompt:'Describe only the image you actually see. You have no tools. Do not infer from the filename.',tools:[],signal:AbortSignal.timeout(150000)})
   const text=response.content.trim(),passed=/red/i.test(text)&&/blue/i.test(text)&&/square|rectangle/i.test(text)&&/circle|round|disk|disc/i.test(text)&&text.toLowerCase().indexOf('red')<text.toLowerCase().indexOf('blue')
   report.results.push({provider,model:model.id,passed,response:text})
  }catch(error){report.results.push({provider,model:model.id,passed:false,reason:String(error.message)})}
 }
 report.success=report.results.length===2&&report.results.every(result=>result.passed)
 console.log(JSON.stringify(report,null,2));if(!report.success)process.exitCode=1
}finally{await Promise.allSettled(Object.values(runtimes).map(runtime=>runtime.shutdown()))}
