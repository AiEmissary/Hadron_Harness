import {app} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {configureHadronEnvironment} from '../server/runtimeIdentity.js'
import {executionStartup} from '../server/hadronTools/executionStartup.js'
import {HadronCodexRuntime} from '../server/auth/hadronCodexRuntime.js'
import {ClaudeCodeRuntime} from '../server/headlessServer/providers/claudeCodeRuntime.js'
import {providerSearchEvidence} from '../server/hadronTools/providerWebSearch.js'
const directory=process.env.HADRON_WEB_CHECK_DIRECTORY!,root=process.env.HADRON_WEB_CHECK_APP!
app.setPath('userData',directory);configureHadronEnvironment(directory);
const profile=path.join(app.getPath('appData'),process.env.HADRON_WEB_PROFILE||'Hadron-Harness-Development');executionStartup.initialize(profile,'standard')
void app.whenReady().then(async()=>{
 const results:any[]=[]
 const nativeHostDirectory=path.join(root,'vendor','hadron-worker')
 const query='Find the official IANA page explaining Example Domains. Search online and return its title and URL.'
 const instruction='Use your web search tool to search the public web for the supplied query. Do not answer from memory. Return a short factual answer and official source links. No file, command, browser or account actions are allowed.'
 let claude:ClaudeCodeRuntime|undefined,codex:HadronCodexRuntime|undefined
 try{
  if(process.env.HADRON_WEB_CHECK_ONLY!=='chatgpt'){
  claude=new ClaudeCodeRuntime({runtimeDirectory:path.join(root,'vendor','claude-code'),profileDirectory:profile,nativeHostDirectory})
  try{
   if(!(await claude.status()).connected)throw Error('Existing Claude sign-in unavailable: '+(await claude.status()).reason)
   const models=await claude.models();if(!models.some(model=>model.id==='haiku'))throw Error('Claude test model unavailable')
   const answer=await(claude as any).generateText({modelName:'haiku',requestPolicy:'single_attempt',tools:[],history:[],userContent:query,systemPrompt:instruction},undefined,false,true)
   const evidence=providerSearchEvidence('Claude',query,answer.content,answer.raw?.webSources)
   results.push({provider:'Claude',model:'haiku',success:evidence.results.some(item=>new URL(item.url).hostname.endsWith('iana.org')),evidence})
  }catch(error){results.push({provider:'Claude',success:false,error:error instanceof Error?error.message:'Search failed'})}
  }
  const diagnostics:unknown[]=[]
  codex=new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor','codex'),profileDirectory:profile,nativeHostDirectory,openBrowser:async()=>{throw Error('This test never signs in')},onJobDiagnostic:value=>diagnostics.push(value)})
  if(!(await codex.status()).connected)throw Error('Existing ChatGPT sign-in unavailable: '+(await codex.status()).reason)
  const choices=await codex.models(),model=choices.find(item=>item.id==='gpt-6.1-sol')?.id??choices.find(item=>item.id==='gpt-6-sol')?.id
  if(!model)throw Error('No admitted ChatGPT Sol test model; no substitution was made')
  try{
   const answer=await(codex as any).generateText({modelName:model,requestPolicy:'single_attempt',tools:[],history:[],userContent:query,systemPrompt:instruction},undefined,true)
   const evidence=providerSearchEvidence('ChatGPT',query,answer.content,answer.raw?.webSources)
   results.push({provider:'ChatGPT',model,success:evidence.results.some(item=>new URL(item.url).hostname.endsWith('iana.org')),evidence})
  }catch(error){results.push({provider:'ChatGPT',model,success:false,diagnostics,error:error instanceof Error?error.message:'Search failed'})}
 }catch(error){results.push({setup:true,success:false,error:error instanceof Error?error.message:'Setup unavailable'})}
 finally{
  await Promise.allSettled([claude?.shutdown(),codex?.shutdown()])
  const report={success:results.length===(process.env.HADRON_WEB_CHECK_ONLY==='chatgpt'?1:2)&&results.every(item=>item.success),separateApiKeyUsed:false,newSignInStarted:false,userChatsModified:false,results}
  fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(report,null,2))
  app.exit(report.success?0:1)
 }
})
