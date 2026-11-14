import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..')
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-model-preferences-'))
await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {UnifiedWorkspace} from './src/components/UnifiedWorkspace/UnifiedWorkspace';
import {WorkspaceSession} from './src/features/collaboration/workspaceSession';
import {blankWorkspaceChat} from './src/features/collaboration/unifiedWorkspace';
import {workspaceModelPreferences} from './src/features/collaboration/workspaceModelPreferences';
const root=createRoot(document.getElementById('root')),noop=()=>{};
window.electronAPI={collaboration:{providerAllowance:async()=>null}};
let connected=true;
const providers=()=>connected?[{provider:'openaichatgpt',label:'ChatGPT',connected:true,models:[{id:'fixture-gpt',label:'GPT selected'}]},{provider:'claudecode',label:'Claude',connected:true,models:[{id:'fixture-claude',label:'Claude selected'}]}]:[{provider:'openaichatgpt',label:'ChatGPT',connected:false,models:[]},{provider:'claudecode',label:'Claude',connected:false,models:[]}];
const transport={create:()=>{throw Error('Provider calls prohibited in preference fixture')}};
let session=new WorkspaceSession('project','chat',transport,undefined,undefined,workspaceModelPreferences('fixture-owner'));
const show=()=>root.render(<UnifiedWorkspace session={session} providers={providers()} help={<span>How to use Hadron</span>} attachFiles={async()=>{}} chooseFolder={async()=>null} messageAction={noop}/>);
window.fixtureChat=()=>session.getSnapshot().state.chats[session.getSnapshot().state.activeChatId];
window.fixtureDraft=text=>session.dispatch({type:'draft',chatId:session.getSnapshot().state.activeChatId,text});
window.fixtureNew=()=>{session.open(blankWorkspaceChat('project','new-chat'));};
window.fixtureProject=()=>{session.dispose();session=new WorkspaceSession('new-project','new-project-chat',transport,undefined,undefined,workspaceModelPreferences('fixture-owner'));show();};
window.fixtureDisconnect=()=>{connected=false;show();};
show();
`},outfile:path.join(directory,'renderer.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic'})
await fs.writeFile(path.join(directory,'index.html'),'<meta charset="utf-8"><style>body{font:14px Arial}#root{height:850px}</style><div id="root"></div><script src="renderer.js"></script>')
await fs.writeFile(path.join(directory,'main.cjs'),String.raw`
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(__dirname,'profile'));
app.whenReady().then(async()=>{
 const report={success:false,phase:process.env.HADRON_MODEL_CHECK_PHASE,modelRequests:0};let window;
 try{
  window=new BrowserWindow({show:false,width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  window.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
  await window.loadFile(path.join(__dirname,'index.html'));
  const run=code=>window.webContents.executeJavaScript(code).catch(error=>{throw Error(code+': '+error.message)});
  const wait=async code=>{for(let i=0;i<100;i++){if(await run('Boolean('+code+')'))return;await new Promise(resolve=>setTimeout(resolve,30))}throw Error('Timed out: '+code)};
  const select=label=>'document.querySelector('+JSON.stringify('select[aria-label="'+label+'"]')+')';
  const choose=async(label,value)=>{await run('(()=>{const select='+select(label)+';select.value='+JSON.stringify(value)+';select.dispatchEvent(new Event("change",{bubbles:true}))})()');};
  const popup=async()=>{await wait('document.querySelector("[data-workspace-menu-toggle]")');await run('if(!document.querySelector(".hadron-v2-menu"))document.querySelector("[data-workspace-menu-toggle]").click()');await wait(select('Work type'));};
  const choices=()=>run('({a:fixtureChat().models.a,b:fixtureChat().models.b,empty:fixtureChat().messages.length===0,noFolder:!fixtureChat().folder,draft:fixtureChat().draft})');
  if(report.phase==='seed'){
   await popup();await choose('Agent A provider','openaichatgpt');await choose('Agent A model','fixture-gpt');
   await choose('Work type','together');await wait(select('Agent B provider'));
   await choose('Agent B provider','claudecode');await choose('Agent B model','fixture-claude');
   await run('window.fixtureNew()');await popup();
   if(await run(select('Agent A model')+'.value')!=='fixture-gpt')throw Error('New chat forgot A');
   await choose('Work type','individual:b');await wait(select('Agent B model'));
   if(await run(select('Agent B model')+'.value')!=='fixture-claude')throw Error('New chat forgot B');
   for(const mode of ['together','continuous','individual:a']){await choose('Work type',mode);const current=await choices();if(current.a?.modelName!=='fixture-gpt'||current.b?.modelName!=='fixture-claude')throw Error('Mode change forgot selection');}
   report.newChatAndAllWorkTypes=true;
   await run('window.fixtureDraft("A new question without a folder")');
   await wait('document.querySelector(".hadron-v2-send")&&!document.querySelector(".hadron-v2-send").disabled');
   report.rememberedModelsAllowSendingWithoutFolder=true;
   await run('window.fixtureProject()');await popup();
   if(await run(select('Agent A model')+'.value')!=='fixture-gpt')throw Error('New project forgot A');
   report.newProjectRemembers=true;
  }else{
   await popup();await choose('Work type','together');
   await wait(select('Agent B model'));
   const current=await choices();if(current.a?.modelName!=='fixture-gpt'||current.b?.modelName!=='fixture-claude')throw Error('Process restart forgot choices');
   report.processRestartRemembersBothAgents=true;
   await run('window.fixtureDisconnect()');
   await wait(select('Agent A provider')+'.selectedOptions[0].textContent.includes("sign in")');
   const visible=await run('({aProvider:'+select('Agent A provider')+'.value,aModel:'+select('Agent A model')+'.value,bProvider:'+select('Agent B provider')+'.value,bModel:'+select('Agent B model')+'.value,aUnavailable:'+select('Agent A model')+'.selectedOptions[0].disabled})');
   if(visible.aProvider!=='openaichatgpt'||visible.bProvider!=='claudecode'||visible.aModel!=='fixture-gpt'||visible.bModel!=='fixture-claude'||!visible.aUnavailable)throw Error('Disconnected choices were hidden or replaced');
   report.disconnectedChoicesRemainVisible=true;
   await run('window.fixtureDraft("Do not send while disconnected")');
   await wait('document.querySelector(".hadron-v2-send").disabled');
   report.disconnectedProviderStillBlocksSending=true;
   await run('window.fixtureDraft("")');
  }
  const final=await choices();if(!final.empty||!final.noFolder||final.draft)throw Error('Chat contents or folder leaked');
  report.noConversationOrPermissionsCopied=true;report.success=true;
 }catch(error){report.error=String(error)}finally{
  fs.writeFileSync(path.join(__dirname,report.phase+'-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));window?.destroy();app.exit(report.success?0:1);
 }
});
`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated provider/model UI fixture: '+directory)
for(const phase of ['seed','restart'])await new Promise((resolve,reject)=>{
 const child=spawn(require('electron'),[path.join(directory,'main.cjs')],{cwd:root,env:{...env,HADRON_MODEL_CHECK_PHASE:phase},windowsHide:true,stdio:'inherit'})
 const timer=setTimeout(()=>{child.kill();reject(Error('Model preference fixture timed out'))},30000)
 child.once('error',error=>{clearTimeout(timer);reject(error)})
 child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Model preference '+phase+' check failed'))})
})
