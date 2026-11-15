import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..'),directory=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-branching-'))
await build({entryPoints:[path.join(root,'electron/fixtures/inlineBranching.tsx')],outfile:path.join(directory,'renderer.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic'})
await fs.writeFile(path.join(directory,'index.html'),'<meta charset="utf-8"><link rel="stylesheet" href="renderer.css"><style>html,body,#root{height:100%;margin:0;font:14px Arial}#root{padding:12px;box-sizing:border-box;background:#e7eef2}</style><div id="root"></div><script src="renderer.js"></script>')
await fs.writeFile(path.join(directory,'main.cjs'),String.raw`
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(__dirname,'profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 let win;const report={success:false,realProviderRequests:0,modes:[]};
 try{
  win=new BrowserWindow({show:false,width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});
  win.webContents.on('paint',()=>{});win.webContents.setFrameRate(60);
  win.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
  await win.loadFile(path.join(__dirname,'index.html'));
  const run=code=>win.webContents.executeJavaScript(code),wait=async code=>{for(let i=0;i<120;i++){if(await run('Boolean('+code+')'))return;await new Promise(resolve=>setTimeout(resolve,25))}throw Error('Timed out: '+code)};
  const click=selector=>run('document.querySelector('+JSON.stringify(selector)+').click();true');
  const branch=id=>click('.hadron-v2-transcript [data-message-id="'+id+'"] button[aria-label="Branch from message"]');
  const setText=text=>run('(()=>{const el=document.querySelector("textarea[aria-label=\\"Branch message\\"]");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(el,'+JSON.stringify(text)+');el.dispatchEvent(new Event("input",{bubbles:true}));})();true');
  const submit=()=>click('.hadron-v2-branch-editor button[type="submit"]');
  const cancel=()=>click('.hadron-v2-branch-editor button[type="button"]');
  const check=async(test,message)=>{if(!await run('Boolean('+test+')'))throw Error(message)};
  await wait('document.querySelectorAll(".hadron-v2-transcript article").length===4');
  for(const mode of ['individual','together','continuous']){
   await run('fixtureSwitch('+JSON.stringify(mode)+');true');
   await wait('fixture().chat.id==='+JSON.stringify(mode));
   const before=await run('fixture().requests.length');
   await branch('q1');await wait('document.querySelector("textarea[aria-label=\\"Branch message\\"]")');
   await check('document.querySelector("textarea[aria-label=\\"Branch message\\"]").value==="Original question"','Question was not prefilled');
   await check('!document.querySelector(".hadron-v2-transcript [data-message-id=q1] .hadron-v2-message-text")','Original message is duplicated below editor');
   await check('fixture().chat.messages.length===4&&fixture().requests.length==='+before,'Opening a branch sent a request or added tree messages');
   await setText('Unsent branch draft');
   if(mode==='individual'){
    await run('fixtureSwitch("together");true');await wait('fixture().chat.id==="together"');
    await check('!document.querySelector(".hadron-v2-branch-editor")','Branch draft crossed into another chat');
    await run('fixtureSwitch("individual");true');await wait('document.querySelector("textarea[aria-label=\\"Branch message\\"]")?.value==="Unsent branch draft"');
   }
   await cancel();await wait('!document.querySelector(".hadron-v2-branch-editor")');
   await check('fixture().chat.selectedId==="a1"&&fixture().chat.messages.length===4&&fixture().chat.messages[2].text==="Original question"','Cancel changed the original conversation');
   await branch('q1');await wait('document.querySelector(".hadron-v2-branch-editor")');
   await setText('Alternative question '+mode);
   if(mode==='individual'){
    await run('fixtureFail(true);true');await submit();await wait('fixture().error==="Fixture validation failure"');
    await check('fixture().chat.messages.length===4&&document.querySelector("textarea[aria-label=\\"Branch message\\"]").value==="Alternative question individual"','Local failure lost draft or added duplicate messages');
    await run('fixtureFail(false);true');
   }
   // Two rapid submissions must create only one request.
   await run('(()=>{const form=document.querySelector(".hadron-v2-branch-editor");form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));})();true');
   await wait('!document.querySelector(".hadron-v2-branch-editor")&&fixture().chat.messages.length===6');
   await check('fixture().requests.length==='+ (before+1),'Rapid send dispatched more than once');
   await check('fixture().requests.at(-1).question.parentId==="a0"&&fixture().requests.at(-1).path.map(m=>m.id).join(",")==="q0,a0"','Alternative question used original question/answer as context');
   await check('fixture().chat.messages[2].text==="Original question"&&fixture().chat.draft==="Keep my bottom draft."&&fixture().chat.attachments[0].text==="UNSENT FACTS"','Branch changed original or consumed bottom composer draft/files');
   await check('document.querySelectorAll(".hadron-v2-transcript article").length===4&&!document.querySelector(".hadron-v2-transcript [data-message-id=q1]")&&document.querySelectorAll(".hadron-v2-tree-node").length===6','Transcript duplicates the branch or tree lost original');
   report.modes.push({mode,inlineEditor:true,cancelRestoresOriginal:true,siblingBranch:true,originalSaved:true,draftAndFilesPreserved:true,singleSubmission:true});
  }
  await run('fixtureSwitch("individual");true');await wait('fixture().chat.id==="individual"');
  // Right-click an old answer in the tree; this must open a blank inline follow-up.
  await run('document.querySelectorAll(".hadron-v2-tree-item")[3].dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,clientX:1000,clientY:250}));true');
  await wait('document.querySelector(".hadron-v2-context-menu")');
  await run('Array.from(document.querySelectorAll(".hadron-v2-context-menu button")).find(el=>el.textContent==="Branch from here").click();true');
  await wait('document.querySelector("textarea[aria-label=\\"Branch message\\"]")');
  await check('document.querySelector("textarea[aria-label=\\"Branch message\\"]").value===""&&document.querySelector(".hadron-v2-transcript [data-message-id=a1] .hadron-v2-branch-editor")','Answer branching did not open a blank editor at its source');
  await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  fs.writeFileSync(path.join(__dirname,'inline-editor.png'),(await win.webContents.capturePage()).toPNG());
  await setText('Follow up on the old answer');await submit();await wait('!document.querySelector(".hadron-v2-branch-editor")&&fixture().chat.messages.length===8');
  await check('fixture().requests.at(-1).question.parentId==="a1"&&fixture().requests.at(-1).path.at(-1).id==="a1"','Answer follow-up attached to wrong branch');
  await check('fixture().externalActions.length===0','Branch action escaped to old selection-only handler');
  report.rightClickTreeAnswerStartsBlankFollowUp=true;report.failedValidationPreservesDraft=true;report.branchDraftStaysInItsChat=true;
  report.success=true;
 }catch(error){report.error=String(error)}
 finally{fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));win?.destroy();app.exit(report.success?0:1)}
});
`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated inline branching check: '+directory)
const child=spawn(require('electron'),[path.join(directory,'main.cjs')],{cwd:root,env,windowsHide:true,stdio:'inherit'})
const timer=setTimeout(()=>child.kill(),45000)
child.once('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1})
child.once('exit',code=>{clearTimeout(timer);process.exitCode=code??1})
