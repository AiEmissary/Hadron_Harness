// Actual built main/preload shutdown, disposable profile, controlled local
// child substituted for the provider CLI. No auth or provider network calls.
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const require=createRequire(import.meta.url),appDir=path.resolve(import.meta.dirname,'..')
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-desktop-smoke-'))
const wrapper=path.join(appDir,'node_modules','.cache','hadron','worker-shutdown.cjs')
await fs.mkdir(path.dirname(wrapper),{recursive:true})
await fs.writeFile(wrapper,String.raw`
const {app,shell}=require('electron'),cp=require('node:child_process'),net=require('node:net'),fs=require('node:fs'),path=require('node:path');
const {syncBuiltinESMExports}=require('node:module'),{pathToFileURL}=require('node:url');
const profile=process.env.HADRON_DESKTOP_SMOKE_PROFILE,children=[],spawn=cp.spawn;
let readyResolve,ready=false,quitAt=0,reportWritten=false,lateStarts=0,logoutCalls=0;
const workerReady=new Promise(resolve=>{readyResolve=resolve});
function fail(error){if(reportWritten)return;reportWritten=true;for(const item of children)item.kill();fs.writeFileSync(path.join(profile,'worker-shutdown-result.json'),JSON.stringify({success:false,error:String(error)}));app.exit(1)}
cp.spawn=function(executable,args,options){
 const native=String(executable).toLowerCase().endsWith('hadronworkerhost.exe')&&args[0]==='run';
 if(!native&&!String(executable).toLowerCase().endsWith('codex.exe'))return spawn(executable,args,options);
 if(quitAt){lateStarts++;throw Error('A provider worker started after shutdown admission closed')}
 if(args.includes('logout'))logoutCalls++;
 const synthetic=['-e','process.stdout.write("owned-worker-ready");setInterval(()=>{},1000)'];
 const child=native?spawn(executable,[...args.slice(0,4),process.execPath,...synthetic],{...options,env:{...options.env,ELECTRON_RUN_AS_NODE:'1'}}):spawn(process.execPath,synthetic,{...options,env:{...options.env,ELECTRON_RUN_AS_NODE:'1'},stdio:'pipe'});
 const kill=child.kill.bind(child),item={closed:false,kill};children.push(item);
 // Cancellation requests are deliberately delayed to expose a premature Quit.
 if(!native)child.kill=()=>{setTimeout(()=>kill(),600);return true};
 child.stdout.on('data',()=>{ready=true;readyResolve()});
 child.on('close',()=>{item.closed=true});return child;
};syncBuiltinESMExports();
const write=net.Socket.prototype.write;
net.Socket.prototype.write=function(chunk,...args){if(chunk==='stop\n'){setTimeout(()=>write.call(this,chunk,...args),600);return true}return write.call(this,chunk,...args)};
shell.openExternal=async()=>{throw Error('Browser launch is forbidden in this fixture')};
app.on('browser-window-created',(_event,window)=>{
 window.hide();window.webContents.once('did-finish-load',()=>{void(async()=>{
  await window.webContents.executeJavaScript('void window.electronAPI.collaboration.codexStatus().catch(()=>{})');
  await workerReady;if(!ready||!children.length)throw Error('No actual owned child was started');
  quitAt=Date.now();app.quit();setTimeout(()=>app.quit(),100);
 })().catch(fail)})
});
app.on('will-quit',()=>{
 if(!quitAt||Date.now()-quitAt<500||!children.length||children.some(item=>!item.closed)||lateStarts||logoutCalls){fail(Error('Quit did not join every actual owned child or changed account admission'));return}
 reportWritten=true;fs.writeFileSync(path.join(profile,'worker-shutdown-result.json'),JSON.stringify({success:true,actualOwnedChildren:children.length,allChildrenClosed:true,repeatedQuitJoined:true,lateStarts,logoutCalls,elapsedMs:Date.now()-quitAt,realProviderRequests:0,realCredentialsUsed:false},null,2));
});
setTimeout(()=>fail(Error('Worker shutdown fixture timeout')),45000).unref();
void import(pathToFileURL(path.join(process.env.HADRON_DESKTOP_SMOKE_APP_DIR,'electron','main.mjs')).href).catch(fail);
`)
const env={...process.env,HADRON_DESKTOP_SMOKE_PROFILE:profile,HADRON_DESKTOP_SMOKE_APP_DIR:appDir,HADRON_USE_BUILT_RENDERER:'1'}
delete env.ELECTRON_RUN_AS_NODE
console.log(`Owned worker shutdown: ${profile}`)
const child=spawn(require('electron'),[wrapper,'--hadron-project-session'],{cwd:appDir,env,windowsHide:true,stdio:'ignore'})
const code=await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{child.kill();reject(Error('Desktop shutdown process timed out'))},55000)
 child.once('error',error=>{clearTimeout(timer);reject(error)})
 child.once('exit',code=>{clearTimeout(timer);resolve(code)})
})
const report=JSON.parse(await fs.readFile(path.join(profile,'worker-shutdown-result.json'),'utf8'))
console.log(JSON.stringify(report,null,2))
if(code!==0||!report.success)throw Error('Built owned-worker shutdown fixture failed')
