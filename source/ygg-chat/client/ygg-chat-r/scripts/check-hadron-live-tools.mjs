import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
if (!process.argv.includes('--live')) throw Error('Explicit --live required: uses the existing Hadron subscription for a bounded public-URL acceptance check')
const require=createRequire(import.meta.url), appDir=path.resolve(import.meta.dirname,'..')
const temporary=await mkdtemp(path.join(os.tmpdir(),'hadron-live-tools-'))
const outfile=path.join(appDir,'node_modules/.cache/hadron/live-tools.mjs')
await build({stdin:{resolveDir:appDir,contents:`
import { app } from 'electron';import fs from 'node:fs';import path from 'node:path';
import { configureHadronEnvironment } from './server/runtimeIdentity.ts';
import { HadronCodexRuntime } from './server/auth/hadronCodexRuntime.ts';
import { createHadronToolSession } from './server/hadronTools/toolSession.ts';
import { buildHadronWorkerPrompt } from './server/headlessServer/services/collaboration/hadronWorkerPrompt.ts';
const temporary=process.env.HADRON_LIVE_TOOL_TEMP;app.setPath('userData',temporary);configureHadronEnvironment(temporary);
void app.whenReady().then(async()=>{let requests=0,attempts=0;const receipts=[], replies=[];
const runtime=new HadronCodexRuntime({runtimeDirectory:path.join(process.env.HADRON_LIVE_APP_DIR,'vendor/codex'),profileDirectory:path.join(app.getPath('appData'),'Hadron-Harness-Development'),openBrowser:async()=>{throw Error('This check never opens sign-in')},onJobDiagnostic:()=>requests++});
const originalGenerateText=runtime.generateText.bind(runtime);runtime.generateText=async(...args)=>{const result=await originalGenerateText(...args);replies.push(result.content.slice(0,3000));return result};
try{
const choices=await runtime.models();const model=choices.find(m=>m.id==='gpt-5.6-luna')?.id;if(!model)throw Error('Expected Hadron test model unavailable; no substitution');
const session=createHadronToolSession({root:path.join(temporary,'tools'),owner:'live-acceptance',job:'public-url',mode:'web',verification:true,onCheckAttempt:()=>attempts++,onEvidence:(tool,result)=>receipts.push({tool,result})});
const result=await runtime.generate({hadronToolSession:session,modelName:model,requestPolicy:'single_attempt',history:[],userContent:'Check https://example.com using web_read. Return its exact page title and source URL from the returned tool evidence. Do not search, access other URLs, or read any personal files. This is a verification acceptance check.',systemPrompt:buildHadronWorkerPrompt('verification'),tools:[]});
const success=receipts.some(r=>r.tool==='web_read'&&r.result.title==='Example Domain')&&result.content.includes('Example Domain');
fs.writeFileSync(path.join(temporary,'result.json'),JSON.stringify({success,model,nativeRequests:requests,protocolReplies:replies,evidenceAttempts:attempts,successfulReads:receipts.filter(r=>r.tool==='web_read').length,answer:result.content,realAccountUsed:true,gravitonAccess:false},null,2));app.exit(success?0:1);
}catch(error){fs.writeFileSync(path.join(temporary,'result.json'),JSON.stringify({success:false,nativeRequests:requests,protocolReplies:replies,evidenceAttempts:attempts,successfulReads:receipts.length,error:error instanceof Error?error.message:'Check failed',realAccountUsed:true},null,2));app.exit(1)}
});
`},outfile,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}})
const env={...process.env,HADRON_LIVE_TOOL_TEMP:temporary,HADRON_LIVE_APP_DIR:appDir};delete env.ELECTRON_RUN_AS_NODE
console.log('Hadron live tool acceptance: '+temporary)
const child=spawn(require('electron'),[outfile],{cwd:appDir,env,windowsHide:true,stdio:'ignore'})
const timer=setTimeout(()=>child.kill(),240000)
child.on('exit',async code=>{clearTimeout(timer);try{console.log(await readFile(path.join(temporary,'result.json'),'utf8'))}catch{}process.exitCode=code??1})
