// Isolated, hidden Electron UI checks. No native provider calls, real auth, or OS browser launches.
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..')
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-sign-in-ui-'))
await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{SubscriptionConnections}from'./src/components/CollaborationPanel/SubscriptionConnections';
import{UnifiedWorkspace}from'./src/components/UnifiedWorkspace/UnifiedWorkspace';
import{UnifiedWorkspaceHelp}from'./src/components/UnifiedWorkspace/UnifiedWorkspaceHelp';
import{WorkspaceSession}from'./src/features/collaboration/workspaceSession';
window.fixture={starts:[],opens:0,cancels:0,connected:false,loginState:'idle',method:undefined,claudeStarts:0,claudeState:'idle',claudeConnected:false};
const f=window.fixture;
window.electronAPI={collaboration:{providerAllowance:async()=>null,
codexStatus:async()=>({installed:true,connected:f.connected,reason:f.connected?'ready':'signed_out',loginState:f.loginState,loginMethod:f.method,...(f.loginState==='running'?(f.method==='device'?{device:{verificationUri:'https://auth.openai.com/codex/device',userCode:'TEST-CODE'}}:{browserReady:true}):{})}),
codexSignIn:async(method)=>{f.starts.push(method);f.method=method;f.loginState='running'},
codexOpenSignIn:async()=>{f.opens++},codexCancelSignIn:async()=>{f.cancels++;f.loginState='idle';f.method=undefined},
codexDisconnect:async()=>{f.connected=false},codexTest:async()=>{throw Error('Provider test prohibited')},
claudeStatus:async()=>({installed:true,connected:f.claudeConnected,reason:f.claudeConnected?'ready':'signed_out',accountSource:'claude_code',loginState:f.claudeState}),
claudeSignIn:async()=>{f.claudeStarts++;f.claudeState='running'},claudeCancelSignIn:async()=>{f.claudeState='idle'}}};
const session=new WorkspaceSession('fixture-project','fixture-chat',{create:()=>{throw Error('Provider calls prohibited')}});
session.dispatch({type:'draft',chatId:'fixture-chat',text:'Unsent question stays here'});
const app=createRoot(document.getElementById('root'));
window.fixtureWorkspace=()=>app.render(<UnifiedWorkspace session={session} providers={[]} help={<UnifiedWorkspaceHelp/>} connections={<SubscriptionConnections compact/>} attachFiles={async()=>{}} chooseFolder={async()=>null} messageAction={()=>{}}/>);
window.fixtureSettings=()=>app.render(<main style={{maxWidth:850,margin:'30px auto'}}><h1>Hadron connections</h1><SubscriptionConnections/></main>);
window.fixtureWorkspace();
`},outfile:path.join(directory,'renderer.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic'})
const assets=await fs.readdir(path.join(root,'dist-electron/assets')),css=assets.find(file=>/^index-.*\.css$/.test(file))
if(!css)throw Error('Build the local renderer before running this fixture')
await fs.copyFile(path.join(root,'dist-electron/assets',css),path.join(directory,'app.css'))
await fs.writeFile(path.join(directory,'index.html'),'<meta charset="utf-8"><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="renderer.css"><style>html,body,#root{height:100%;margin:0;font:14px Arial;color:#294253}#root{padding:12px;box-sizing:border-box;background:#e7eef2}</style><div id="root"></div><script src="renderer.js"></script>')
await fs.writeFile(path.join(directory,'main.cjs'),String.raw`
const{app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(__dirname,'profile'));
app.whenReady().then(async()=>{let win;const report={success:false,realProviderRequests:0,realSignIns:0};try{
 win=new BrowserWindow({show:false,width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 await win.loadFile(path.join(__dirname,'index.html'));
 const run=code=>win.webContents.executeJavaScript(code).catch(error=>{throw Error(code+': '+error.message)}),wait=async code=>{for(let i=0;i<160;i++){if(await run('Boolean('+code+')'))return;await new Promise(resolve=>setTimeout(resolve,25))}throw Error('Timed out: '+code)};
 const click=async text=>{await wait('Array.from(document.querySelectorAll("button")).some(b=>b.textContent==='+JSON.stringify(text)+'&&!b.disabled)');await run('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==='+JSON.stringify(text)+').click();true');};
 const paint=()=>run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,200))))');
 await wait('document.querySelector("[data-workspace-menu-toggle]")');await run('document.querySelector("[data-workspace-menu-toggle]").click();true');
 await wait('document.querySelector(".hadron-v2-connections")');await run('document.querySelector(".hadron-v2-connections").open=true;true');
 await wait('document.querySelector("aside[aria-label]")');
 report.noticeVisibleInPopup=await run('(()=>{const el=document.querySelector("aside[aria-label]");return el.textContent.includes("account restrictions")&&el.getClientRects().length>0})()');
 report.deviceIsOptional=await run('Array.from(document.querySelectorAll("details")).some(d=>d.querySelector("summary")?.textContent==="Optional: device-code sign-in"&&!d.open)');
 if(await run('fixture.starts.length+fixture.claudeStarts+fixture.opens'))throw Error('Opening connections started auth');
 await click('Continue with ChatGPT');await wait('document.body.textContent.includes("Finish signing in in your browser")');
 report.browserIsDefault=await run('fixture.starts.length===1&&fixture.starts[0]==="browser"&&!document.body.textContent.includes("TEST-CODE")');
 await click('Open sign-in page');report.fallbackOpensOnce=await run('fixture.opens===1');
 await click('Connect Claude');await wait('fixture.claudeStarts===1');
 await click('Cancel ChatGPT sign-in');await wait('document.body.textContent.includes("Continue with ChatGPT")');
 report.accountsIndependent=await run('fixture.claudeState==="running"&&fixture.cancels===1');
 await click('Cancel Claude sign-in');
 await run('fixture.claudeConnected=true;true');await click('Check Claude');
 await wait('document.body.textContent.includes("Connected using your Claude Code sign-in")');
 report.existingClaudeLoginReusedWithoutAnotherPrompt=await run('fixture.claudeStarts===1&&!Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="Connect Claude")&&document.body.textContent.includes("claude -p")');
 await run('Array.from(document.querySelectorAll("details")).find(d=>d.querySelector("summary")?.textContent==="Optional: device-code sign-in").open=true;true');
 await click('Sign in with a device code');await wait('document.body.textContent.includes("TEST-CODE")');
 report.explicitDeviceFlow=await run('fixture.starts.length===2&&fixture.starts[1]==="device"');
 await run('document.querySelector(".hadron-v2-menu code").scrollIntoView({block:"center"});true');
 report.deviceControlsReachable=await run('(()=>{const code=document.querySelector(".hadron-v2-menu code").getBoundingClientRect(),menu=document.querySelector(".hadron-v2-menu").getBoundingClientRect();return code.top>=menu.top&&code.bottom<=menu.bottom})()');
 await paint();fs.writeFileSync(path.join(__dirname,'popup-device.png'),(await win.webContents.capturePage()).toPNG());
 await click('Cancel ChatGPT sign-in');await wait('!document.body.textContent.includes("TEST-CODE")');
 await run('fixture.loginState="failed";fixture.method="device";true');await click('Check ChatGPT');
 await wait('document.body.textContent.includes("Try browser sign-in instead")');
 report.devicePolicyExplained=true;
 report.draftPreserved=await run('document.querySelector(".hadron-v2-composer textarea").value==="Unsent question stays here"');
 await run('document.querySelector("[data-workspace-menu-toggle]").click();true');await click('How to use Hadron');
 await wait('document.querySelector("dialog[open]")');
 report.guideUpdated=await run('(()=>{const t=document.querySelector("dialog").textContent;return t.includes("browser OAuth")&&t.includes("device-code authentication")&&t.includes("claude -p / --print")})()');
 await run('document.querySelector("dialog header button").click();window.fixtureSettings();true');
 await wait('document.querySelector("aside[aria-label]")');
 report.noticeVisibleInSettings=await run('document.querySelector("aside[aria-label]").getClientRects().length>0');
 await paint();fs.writeFileSync(path.join(__dirname,'settings.png'),(await win.webContents.capturePage()).toPNG());
 for(const[key,value]of Object.entries(report))if(typeof value==='boolean'&&key!=='success'&&!value)throw Error('UI assertion failed: '+key);
 report.success=true;
 }catch(error){report.error=String(error)}finally{fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));win?.destroy();app.exit(report.success?0:1)}});
`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated sign-in UI fixture: '+directory)
await new Promise((resolve,reject)=>{
 const child=spawn(require('electron'),[path.join(directory,'main.cjs')],{cwd:root,env,windowsHide:true,stdio:'inherit'})
 const timer=setTimeout(()=>{child.kill();reject(Error('Sign-in fixture timed out'))},45000)
 child.once('error',error=>{clearTimeout(timer);reject(error)})
 child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Sign-in fixture failed'))})
})
