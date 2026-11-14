import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
// Explicitly opt in: this spends one real Claude subscription job.
if(!process.argv.includes('--run-live'))throw Error('Use --run-live only when a real Claude subscription check is authorised')
const index=process.argv.indexOf('--profile'),profile=path.resolve(process.argv[index+1]??'')
if(index<0||!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile)))throw Error('Explicit Hadron profile required')
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/live-claude.mjs')
fs.mkdirSync(path.dirname(output),{recursive:true})
await build({stdin:{contents:`export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {ClaudeCodeRuntime,executionStartup}=await import(pathToFileURL(output).href)
executionStartup.initialize(profile,'standard')
if(!executionStartup.status().execution.ready)throw Error('Hadron execution must be idle; no lock reset or request was made')
const runtime=new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor/claude-code'),nativeHostDirectory:path.join(root,'vendor/hadron-worker'),profileDirectory:profile})
const capture=runtime.capture.bind(runtime)
runtime.capture=async(args,options)=>{
 const result=await capture(args,options)
 if(args.includes('--print')){
  let frames=[];try{frames=result.stdout.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))}catch{}
  console.log(JSON.stringify({diagnostic:{exitCode:result.code,outputBytes:Buffer.byteLength(result.stdout),initCount:frames.filter(frame=>frame.type==='system'&&frame.subtype==='init').length,resultCount:frames.filter(frame=>frame.type==='result').length,toolCount:frames.find(frame=>frame.type==='system'&&frame.subtype==='init')?.tools?.length??null}}))
 }
 return result
}
try{
 const models=await runtime.models();if(!models.some(model=>model.id==='haiku'))throw Error('Claude subscription is not ready; no sign-in attempted')
 const response=await runtime.generate({modelName:'haiku',requestPolicy:'single_attempt',history:[],userContent:'Reply with exactly HADRON_CLAUDE_OK.',systemPrompt:'You are a text-only Hadron connection check. Respond exactly as requested. You have no tools.',tools:[]})
 const success=response.content.trim()==='HADRON_CLAUDE_OK'
 console.log(JSON.stringify({success,provider:'claudecode',model:'haiku',realSubscriptionJobs:1,nativeWorkerJoined:true,projectFilesChanged:false,signInOrOut:false},null,2))
 if(!success)process.exitCode=1
}finally{await runtime.shutdown()}
