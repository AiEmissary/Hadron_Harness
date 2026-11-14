import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'node_modules','.cache','hadron','project-worker-runtime.mjs')
await build({stdin:{contents:`export {WindowsOwnedWorkerHost} from './server/auth/windowsOwnedWorker.ts';export {captureOwnedProcess} from './server/auth/hadronOwnedProcess.ts';export {HadronCodexRuntime} from './server/auth/hadronCodexRuntime.ts';export {executionStartup} from './server/hadronTools/executionStartup.ts';`,resolveDir:root,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm'})
const {WindowsOwnedWorkerHost,captureOwnedProcess,HadronCodexRuntime,executionStartup}=await import(pathToFileURL(output))
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-project-worker-')),nativeDirectory=path.join(root,'vendor','hadron-worker')
console.log('Project worker runtime: '+profile)
const host=new WindowsOwnedWorkerHost(nativeDirectory,profile,randomUUID()),env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR}
const value=await host.run({executable:process.execPath,args:['-e','process.stdout.write("contained-runtime-ok")'],cwd:profile,env,
 consume:child=>{const pending=captureOwnedProcess(child,{timeout:10000});child.stdin.end();return pending}})
assert.equal(value.code,0);assert.equal(value.text,'contained-runtime-ok');assert.equal(host.inspect().state,'active')
const controller=new AbortController()
const stopped=await host.run({executable:process.execPath,args:['-e','process.stdout.write("ready");setInterval(()=>{},1000)'],cwd:profile,env,signal:controller.signal,
 consume:child=>captureOwnedProcess(child,{timeout:10000,signal:controller.signal,onText:()=>controller.abort()})})
assert.equal(stopped.code,null)
let crashedClosed=false
const crashed=await host.run({executable:process.execPath,args:['-e','process.stdout.write("ready");setInterval(()=>{},1000)'],cwd:profile,env,
 consume:child=>{child.once('close',()=>{crashedClosed=true});return captureOwnedProcess(child,{timeout:10000,onText:()=>process.kill(child.pid)})}})
assert.notEqual(crashed.code,0);assert.equal(crashedClosed,true)
let observerClosed=false
await assert.rejects(host.run({executable:process.execPath,args:['-e','process.stdout.write("ready");setInterval(()=>{},1000)'],cwd:profile,env,
 consume:child=>{child.once('close',()=>{observerClosed=true});return captureOwnedProcess(child,{timeout:10000,onText:()=>{throw Error('synthetic consumer failure')}})}}),/process closure was observed/)
assert.equal(observerClosed,true)
// Exercise the actual project-mode adapter using only version/local signed-out
// status commands in a fresh profile. No login, account migration or inference.
executionStartup.initialize(profile,'project')
const runtime=new HadronCodexRuntime({runtimeDirectory:path.join(root,'vendor','codex'),nativeHostDirectory:nativeDirectory,profileDirectory:profile,
 openBrowser:async()=>{throw Error('Browser forbidden in isolated local status probe')}})
assert.deepEqual(await runtime.status(),{installed:true,connected:false,reason:'signed_out',loginState:'idle'})
await runtime.shutdown()
const report={success:true,productionTransportJoins:true,cancellationJoins:true,abruptHelperDeathRechecked:true,consumerFailureJoins:true,liveOwnerNotReportedEnded:true,actualBundledCodexProjectStatus:true,realProviderRequests:0,realCredentialsUsed:false,canonicalEditingEnabled:false}
fs.writeFileSync(path.join(profile,'project-worker-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
