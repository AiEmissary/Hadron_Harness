// Actual built Electron/server boot, private disposable profiles, no inference.
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const require=createRequire(import.meta.url),appDir=path.resolve(import.meta.dirname,'..')
const output=path.join(appDir,'electron','hadron-execution-startup-smoke.cjs')
await fs.writeFile(output,String.raw`
const {app,shell}=require('electron'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
let externalCalls=0;
shell.openExternal=async()=>{externalCalls++};shell.openPath=async()=>{externalCalls++;return ''};
const profile=process.env.HADRON_DESKTOP_SMOKE_PROFILE,mode=process.env.HADRON_STARTUP_FIXTURE_MODE;
let done=false;
function finish(error,result){if(done)return;done=true;fs.writeFileSync(path.join(profile,'execution-startup-result.json'),JSON.stringify(error?{error:String(error)}:result,null,2));app.exit(error?1:0)}
if(mode==='blocked'){fs.mkdirSync(path.join(profile,'project-execution'));fs.writeFileSync(path.join(profile,'project-execution','execution.json'),'partial marker');}
if(mode==='draft-storage')fs.writeFileSync(path.join(profile,'hadron-project-builds.db'),'not a SQLite database');
if(mode==='project'){
 const Database=require('better-sqlite3'),db=new Database(path.join(profile,'local-sync.db'));
 db.exec("CREATE TABLE tool_jobs(id TEXT PRIMARY KEY,tool_name TEXT NOT NULL,args TEXT NOT NULL,status TEXT NOT NULL,priority TEXT NOT NULL,root_path TEXT,operation_mode TEXT,timeout_ms INTEGER NOT NULL,retries INTEGER DEFAULT 0,retries_remaining INTEGER DEFAULT 0,retry_delay_ms INTEGER DEFAULT 1000,metadata TEXT,conversation_id TEXT,message_id TEXT,stream_id TEXT,created_at TEXT NOT NULL,started_at TEXT,completed_at TEXT,result TEXT,error TEXT,progress INTEGER DEFAULT 0,progress_message TEXT)");
 db.prepare('INSERT INTO tool_jobs(id,tool_name,args,status,priority,timeout_ms,created_at) VALUES (?,?,?,?,?,?,?)').run('held-fixture','must_not_execute','{"sentinel":"untouched"}','pending','normal',1000,'2026-01-01');db.close();
 // If startup imports even a disabled custom module, this sentinel catches it.
 const directory=path.join(profile,'tool-storage','custom-tools','startup_fixture');fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'definition.json'),JSON.stringify({name:'startup_fixture',description:'Must not load',inputSchema:{type:'object',properties:{}}}));
 fs.writeFileSync(path.join(directory,'index.js'),"require('node:fs').writeFileSync("+JSON.stringify(path.join(profile,'UNSAFE_CUSTOM_IMPORT'))+",'loaded');module.exports={execute:()=>{throw Error('must not execute')}}");
}
app.on('browser-window-created',(_event,window)=>{
 window.hide();window.webContents.once('did-finish-load',()=>{void(async()=>{
  let endpoint;
  for(let attempt=0;attempt<60;attempt++){
   endpoint=await window.webContents.executeJavaScript('window.electronAPI.sync.status().then(s=>({port:s.localServerPort,url:s.localServerUrl}))');
   if(endpoint.port)break;await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!endpoint?.port)throw Error('Built server did not start');
  const health=await(await fetch('http://127.0.0.1:'+endpoint.port+'/api/health')).json();
  if(health.executionSession?.mode!==(['blocked','draft-storage'].includes(mode)?'project':mode))throw Error('Wrong boot mode');
  if(mode==='project'){
   if(!health.executionSession.execution.ready||health.heldLegacyJobs!==1||health.utilityRuntimeAvailable)throw Error('Project startup tainted or queue not held');
   if(fs.existsSync(path.join(profile,'UNSAFE_CUSTOM_IMPORT')))throw Error('Custom implementation imported');
   const Database=require('better-sqlite3'),db=new Database(path.join(profile,'local-sync.db'),{readonly:true});
   const job=db.prepare('SELECT status,args FROM tool_jobs WHERE id=?').get('held-fixture');db.close();
   if(job.status!=='pending'||JSON.parse(job.args).sentinel!=='untouched')throw Error('Held job changed');
   if(fs.existsSync(path.join(profile,'project-execution','execution.json')))throw Error('Unexpected inherited claim');
  }else if(mode==='blocked'){
   if(!health.executionSession.startupBlocked||health.executionSession.execution.ready||health.utilityRuntimeAvailable)throw Error('Corrupt startup was not restricted');
   if(fs.readFileSync(path.join(profile,'project-execution','execution.json'),'utf8')!=='partial marker')throw Error('Corrupt evidence changed');
  }else if(mode==='draft-storage'){
   const proposal=await window.webContents.executeJavaScript('window.electronAPI.projectDraft.availability()');
   if(proposal.available||proposal.reason!=='project_storage_unavailable'||!health.executionSession.execution.ready)throw Error('Optional project storage failure broke the app or enabled proposal admission');
   if(fs.readFileSync(path.join(profile,'hadron-project-builds.db'),'utf8')!=='not a SQLite database')throw Error('Damaged project storage changed');
  }else if(health.executionSession.execution.ready||!health.utilityRuntimeAvailable)throw Error('Standard utility startup failed or was not observed');
  // Exercise actual authenticated main/preload routes; the native shell is
  // intercepted, so no browser/editor/executable is launched by this fixture.
  const launch=await window.webContents.executeJavaScript('(async()=>({web:await window.electronAPI.auth.openExternal("https://example.com/"),file:await window.electronAPI.shell.openPath("C:/hadron-synthetic-not-a-file.txt")}))()');
  if(launch.web.success!==(mode==='standard')||launch.file.success!==(mode==='standard'))throw Error('External application admission was wrong');
  const popup=await window.webContents.executeJavaScript('window.electronAPI.auth.openOAuthWindow('+JSON.stringify(mode==='standard'?'file:///C:/hadron-synthetic-not-a-file.txt':'https://example.com/oauth')+')');
  if(popup.success)throw Error('Restricted or non-web OAuth popup was admitted');
  await window.webContents.executeJavaScript('window.open("https://example.com/window-link", "_blank");void 0');
  await new Promise(resolve=>setTimeout(resolve,200));
  if(externalCalls!==(mode==='standard'?3:0))throw Error('External shell dispatch escaped policy or standard handoff broke: '+externalCalls);
  finish(null,{success:true,mode,health,noInference:true,externalLaunchPolicy:true,interceptedShellCalls:externalCalls,heldPendingJobUnchanged:mode==='project',customCodeNotImported:!fs.existsSync(path.join(profile,'UNSAFE_CUSTOM_IMPORT'))});
 })().catch(error=>finish(error))})
});
setTimeout(()=>finish(Error('Startup fixture timeout')),45000).unref();
void import(pathToFileURL(path.join(process.env.HADRON_DESKTOP_SMOKE_APP_DIR,'electron','main.mjs')).href).catch(error=>finish(error));
`)
for(const mode of ['project','standard','blocked','draft-storage']){
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-desktop-smoke-'))
 const env={...process.env,HADRON_DESKTOP_SMOKE_PROFILE:profile,HADRON_DESKTOP_SMOKE_APP_DIR:appDir,HADRON_USE_BUILT_RENDERER:'1',HADRON_STARTUP_FIXTURE_MODE:mode,YGG_TOOLS_RUNTIME:'utility'}
 delete env.ELECTRON_RUN_AS_NODE
 console.log(`Execution startup ${mode}: ${profile}`)
 const child=spawn(require('electron'),[output,...(mode!=='standard'?['--hadron-project-session']:[])],{cwd:appDir,env,windowsHide:true,stdio:'ignore'})
 const code=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Startup process timeout'))},55000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);resolve(code)})})
 const report=JSON.parse(await fs.readFile(path.join(profile,'execution-startup-result.json'),'utf8'))
 console.log(JSON.stringify(report,null,2));if(code!==0||!report.success)throw Error('Built startup fixture failed')
}
