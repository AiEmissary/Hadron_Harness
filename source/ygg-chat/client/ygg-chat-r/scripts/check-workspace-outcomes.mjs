import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..')
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-outcome-ui-'))
await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{UnifiedWorkspace}from'./src/components/UnifiedWorkspace/UnifiedWorkspace';
import{UnifiedWorkspaceHelp}from'./src/components/UnifiedWorkspace/UnifiedWorkspaceHelp';
import{WorkspaceSession}from'./src/features/collaboration/workspaceSession';
import{blankWorkspaceChat}from'./src/features/collaboration/unifiedWorkspace';
import{watchWorkspaceCompletions}from'./src/features/collaboration/workspaceCompletionAlerts';
import{completionAlertText}from'../../shared/hadronCompletion';
window.electronAPI={collaboration:{providerAllowance:async()=>null}};
window.fixtureAlerts=[];let changed;
const session=new WorkspaceSession('fixture','chat',{create:(request,notify)=>({start:async()=>{changed=notify},stop:async()=>notify({text:'Stopped; available work is saved.',state:'stopped'}),recover:async()=>{},dispose:()=>{}})});
session.dispatch({type:'configure',chatId:'chat',models:{a:{provider:'openaichatgpt',modelName:'fixture-model'}}});
session.dispatch({type:'draft',chatId:'chat',text:'Investigate and report'});
watchWorkspaceCompletions(session,input=>window.fixtureAlerts.push({...input,...completionAlertText(input)}));
window.fixtureFail=()=>changed({text:'Partial findings are saved. The final report was not produced.',state:'failed'});
window.fixtureDraft=()=>session.dispatch({type:'draft',chatId:'chat',text:'Another instruction'});
window.fixtureLegacy=()=>session.open({...blankWorkspaceChat('fixture','legacy'),messages:[{id:'partial',parentId:null,role:'assistant',agent:'a',state:'completed',text:'Work stopped at the request or context limit before a final answer was produced. Saved receipts.'}],selectedId:'partial'});
createRoot(document.getElementById('root')).render(<UnifiedWorkspace session={session} providers={[{provider:'openaichatgpt',label:'Fixture provider',connected:true,models:[{id:'fixture-model',label:'Fixture model'}]}]} help={<UnifiedWorkspaceHelp/>} attachFiles={async()=>{}} chooseFolder={async()=>null} messageAction={()=>{}}/>);
`},outfile:path.join(directory,'renderer.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic'})
await fs.writeFile(path.join(directory,'index.html'),'<meta charset="utf-8"><link rel="stylesheet" href="renderer.css"><style>html,body,#root{height:100%;margin:0;font:14px Arial;color:#294253}#root{padding:12px;box-sizing:border-box;background:#e7eef2}</style><div id="root"></div><script src="renderer.js"></script>')
await fs.writeFile(path.join(directory,'main.cjs'),String.raw`
const{app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(__dirname,'profile'));
app.whenReady().then(async()=>{let win;const report={success:false,realProviderRequests:0,nativeSoundsOrNotifications:0};try{
 win=new BrowserWindow({show:false,width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
 await win.loadFile(path.join(__dirname,'index.html'));
 const run=code=>win.webContents.executeJavaScript(code),wait=async code=>{for(let i=0;i<120;i++){if(await run('Boolean('+code+')'))return;await new Promise(resolve=>setTimeout(resolve,25))}throw Error('Timed out: '+code)};
 await wait('document.querySelector(".hadron-v2-send")&&!document.querySelector(".hadron-v2-send").disabled');
 await run('document.querySelector(".hadron-v2-send").click()');await wait('document.querySelector(".hadron-v2-working")');
 await run('fixtureFail()');await wait('document.querySelector(".hadron-v2-not-finished")');
 report.failureLabelVisible=await run('document.querySelector(".hadron-v2-not-finished").textContent==="Not finished"&&document.querySelector(".hadron-v2-not-finished").getBoundingClientRect().width>0');
 report.failureTreeLabel=await run('Array.from(document.querySelectorAll(".hadron-v2-tree-node")).some(node=>node.textContent.startsWith("Not finished"))');
 report.failureNotification=await run('fixtureAlerts.length===1&&fixtureAlerts[0].outcome==="failed"&&fixtureAlerts[0].title.includes("Not finished")&&fixtureAlerts[0].speech==="Not finished."');
 await run('fixtureDraft()');await wait('!document.querySelector(".hadron-v2-send").disabled');
 await run('document.querySelector(".hadron-v2-send").click()');await wait('document.querySelector("button[aria-label=Stop]")');
 await run('document.querySelector("button[aria-label=Stop]").click()');
 await wait('Array.from(document.querySelectorAll(".hadron-v2-not-finished")).some(node=>node.textContent.includes("Stopped"))');
 report.stopNotification=await run('fixtureAlerts.length===2&&fixtureAlerts[1].outcome==="stopped"&&fixtureAlerts[1].title.includes("Not finished")');
 await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 await new Promise(resolve=>setTimeout(resolve,200));
 fs.writeFileSync(path.join(__dirname,'not-finished.png'),(await win.webContents.capturePage()).toPNG());
 await run('fixtureLegacy()');await wait('document.querySelector(".hadron-v2-not-finished")');
 report.historicalPartialLabel=await run('document.querySelector(".hadron-v2-not-finished").textContent==="Not finished"&&fixtureAlerts.length===2');
 await run('Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="How to use Hadron").click()');await wait('document.querySelector("dialog[open]")');
 report.helpUpdated=await run('(()=>{const headings=Array.from(document.querySelectorAll("dialog h2")).map(node=>node.textContent);return ["Not finished and notifications","Long jobs and condensed evidence","Folder access and built-in tools","Providers and models","Explore the tree"].every(title=>headings.includes(title))&&document.querySelector("dialog").textContent.includes("JPEG")})()');
 report.helpScrollable=await run('(()=>{const d=document.querySelector("dialog[open]");return d.scrollHeight>d.clientHeight&&getComputedStyle(d).overflowY==="auto"})()');
 for(const [key,value]of Object.entries(report))if(typeof value==='boolean'&&key!=='success'&&!value)throw Error('UI assertion failed: '+key);
 report.success=true;
}catch(error){report.error=String(error)}finally{fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));win?.destroy();app.exit(report.success?0:1)}});
`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated unfinished-job UI fixture: '+directory)
await new Promise((resolve,reject)=>{
 const child=spawn(require('electron'),[path.join(directory,'main.cjs')],{cwd:root,env,windowsHide:true,stdio:'inherit'})
 const timer=setTimeout(()=>{child.kill();reject(Error('Unfinished-job UI check timed out'))},30000)
 child.once('error',error=>{clearTimeout(timer);reject(error)})
 child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Unfinished-job UI check failed'))})
})
