// Explicit, bounded real-account read-only smoke. No personal project or login changes.
import {build} from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const appRoot=path.resolve(import.meta.dirname,'..'),index=process.argv.indexOf('--profile')
if(!process.argv.includes('--run-live')||index<0)throw Error('Explicit --run-live --profile required; at most 16 model requests')
const profile=path.resolve(process.argv[index+1]??'')
if(!['Hadron-Harness','Hadron-Harness-Development'].includes(path.basename(profile))||!fs.existsSync(profile)||fs.lstatSync(profile).isSymbolicLink())throw Error('Existing Hadron profile required')
const output=path.join(appRoot,'node_modules/.cache/hadron/live-folders.mjs')
await build({stdin:{contents:`export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {ClaudeCodeRuntime} from './server/headlessServer/providers/claudeCodeRuntime.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';export {ProjectReadHost} from './server/hadronTools/projectRead.ts';export {buildHadronWorkerPrompt} from './server/headlessServer/services/collaboration/hadronWorkerPrompt.ts';`,resolveDir:appRoot,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {HadronCodexRuntime,ClaudeCodeRuntime,executionStartup,ProjectReadHost,buildHadronWorkerPrompt}=await import(pathToFileURL(output))
executionStartup.initialize(profile,'standard')
if(!executionStartup.status().execution.ready)throw Error('Profile execution is not idle; no lock resets or requests attempted')
const evidence=executionStartup.privatePath('validation-live-folders-'+randomUUID());fs.mkdirSync(evidence)
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-live-folder-'));fs.mkdirSync(path.join(root,'src'))
// Search reveals the declaration, but only a file read reveals the random value.
const marker='FOLDER_PROBE_'+randomUUID().slice(0,8),content=`export const evidenceMarker =\n  "${marker}"\n`
fs.writeFileSync(path.join(root,'src/probe.ts'),content)
const native=path.join(appRoot,'vendor/hadron-worker'),diagnostics=[]
const gpt=new HadronCodexRuntime({runtimeDirectory:path.join(appRoot,'vendor/codex'),nativeHostDirectory:native,profileDirectory:profile,openBrowser:async()=>{throw Error('No sign-in allowed during validation')},onJobDiagnostic:value=>diagnostics.push(value)})
const claude=new ClaudeCodeRuntime({runtimeDirectory:path.join(appRoot,'vendor/claude-code'),nativeHostDirectory:native,profileDirectory:profile})
const report={success:false,maxModelRequests:16,personalFilesChanged:false,credentialsReadOrCopied:false,signInOrOut:false,providers:[]}
const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),240000)
try{
 if(!(await gpt.status()).connected||!(await claude.status()).connected)throw Error('Both existing provider connections are required; no sign-in attempted')
 const gptModels=await gpt.models(),gptModel=gptModels.find(item=>item.id==='gpt-6.1-sol')??gptModels.find(item=>/luna|mini|nano/i.test(item.id))
 const claudeModels=await claude.models(),claudeModel=claudeModels.find(item=>/sonnet/i.test(item.id))??claudeModels.find(item=>/haiku/i.test(item.id))
 if(!gptModel||!claudeModel)throw Error('The regular main-agent models are unavailable')
 const host=new ProjectReadHost(),grant=host.grant('fixture-owner','fixture-workspace','shared',root)
 for(const [provider,runtime,model] of [['ChatGPT',gpt,gptModel.id],['Claude',claude,claudeModel.id]]){
  const activity=[],session=host.session('fixture-owner',grant.id,'fixture-workspace','shared',()=>{},(tool,state)=>activity.push({tool,state}))
  const result=await runtime.generate({modelName:model,systemPrompt:buildHadronWorkerPrompt('proposal'),history:[],userContent:JSON.stringify({task:'Use project_search to find the declaration of evidenceMarker in the selected folder, then project_read the matching file. Read the STRING VALUE assigned to that variable on the following line, not the identifier evidenceMarker. Return that exact string value and the relative file path in one sentence. A matching declaration alone does not reveal the value; you must read the file. Do not edit anything or run tests.',context:''}),tools:[],requestPolicy:'single_attempt',signal:abort.signal,hadronToolSession:session})
  fs.writeFileSync(path.join(evidence,provider+'-private-response.json'),JSON.stringify({text:result.content,activity},null,2))
  if(!result.content.includes(marker)||!activity.some(item=>item.tool==='project_search'&&item.state==='completed')||!activity.some(item=>item.tool==='project_read'&&item.state==='completed'))throw Error(provider+' did not complete both real folder operations')
  report.providers.push({provider,model,actualFolderSearch:true,actualFileRead:true,randomMarkerMatched:true,activity})
 }
 if(fs.readFileSync(path.join(root,'src/probe.ts'),'utf8')!==content)throw Error('Fixture file changed')
 report.success=true;report.fixtureHash=createHash('sha256').update(content).digest('hex')
}catch(error){report.failure=String(error.message??error).slice(0,300)}
finally{clearTimeout(timer);await Promise.all([gpt.shutdown(),claude.shutdown()]);report.chatgptRequests=diagnostics.reduce((sum,item)=>sum+item.requests,0);fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2));console.log('Private folder evidence: '+evidence);console.log(JSON.stringify(report,null,2));if(!report.success)process.exitCode=1}
