import {build} from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules/.cache/hadron/diagnostic-trace.mjs')
await build({stdin:{contents:`import {app} from 'electron';import fs from 'node:fs';import {diagnosticRecorder} from './electron/hadronDiagnosticBootstrap.ts';void app.whenReady().then(()=>{diagnosticRecorder.mark('profile_ready');const mode=process.argv.find(arg=>arg.startsWith('--trace-test='))?.slice(13);if(mode==='success'){const folder=process.argv.find(arg=>arg.startsWith('--hadron-diagnose='))?.slice(18);fs.writeFileSync(folder+'/release-check.json',JSON.stringify({success:true,diagnosticRunId:diagnosticRecorder.runId}));diagnosticRecorder.complete();app.quit()}else if(mode==='quit'){app.quit()}else if(mode==='lock'){diagnosticRecorder.fail('instance_lock_denied');app.quit()}else process.exit(17)});`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm',external:['electron']})
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
const results=[]
for(const mode of ['exit','quit','lock','success']){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-release-check-trace-'))
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(createRequire(import.meta.url)('electron'),[output,'--hadron-diagnose='+profile,'--trace-test='+mode],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>fs.appendFileSync(path.join(profile,'process.log'),chunk))
  const timer=setTimeout(()=>{child.kill();reject(Error('Trace test timed out'))},15000)
  child.on('error',error=>{clearTimeout(timer);reject(error)})
  child.on('exit',code=>{clearTimeout(timer);resolve(code)})
 })
 const trace=JSON.parse(fs.readFileSync(path.join(profile,'startup-trace.json'),'utf8'))
 if(mode==='exit'){
  if(code!==17||trace.stage!=='profile_ready'||fs.existsSync(path.join(profile,'release-check.json')))throw Error('Abrupt exit trace mismatch')
  results.push({mode,profile,exitCode:code,lastStartupStage:trace.stage,abruptExitLeavesDurableTrace:true});continue
 }
 const report=JSON.parse(fs.readFileSync(path.join(profile,'release-check.json'),'utf8'))
 const expected=mode==='success'?'diagnostic_passed':mode==='lock'?'instance_lock_denied':'unexpected_exit'
 if(trace.stage!==expected||trace.runId!==report.diagnosticRunId||report.success!==(mode==='success')||code!==0)throw Error('Native diagnostic trace mismatch: '+mode)
 results.push({mode,profile,exitCode:code,stage:trace.stage,matchingReport:true})

}
console.log(JSON.stringify({success:true,nativeElectron:true,realModelRequests:0,results},null,2))
