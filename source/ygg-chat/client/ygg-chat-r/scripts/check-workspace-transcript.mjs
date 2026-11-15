import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..'),directory=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-transcript-'))
await build({entryPoints:[path.join(root,'electron/fixtures/transcriptNavigation.tsx')],outfile:path.join(directory,'renderer.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic'})
await fs.writeFile(path.join(directory,'index.html'),'<meta charset="utf-8"><link rel="stylesheet" href="renderer.css"><style>html,body,#root{height:100%;margin:0;font:14px Arial}#root{padding:12px;box-sizing:border-box;background:#e7eef2}</style><div id="root"></div><script src="renderer.js"></script>')
await fs.writeFile(path.join(directory,'main.cjs'),String.raw`
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(__dirname,'profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 let win;const report={success:false,providerRequests:0};
 try{
  win=new BrowserWindow({show:false,width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});
  win.webContents.on('paint',()=>{});win.webContents.setFrameRate(60);
  win.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
  await win.loadFile(path.join(__dirname,'index.html'));
  const run=code=>win.webContents.executeJavaScript(code).catch(error=>{throw Error(code+': '+error.message)}),wait=async code=>{for(let i=0;i<120;i++){if(await run('Boolean('+code+')'))return;await new Promise(resolve=>setTimeout(resolve,25))}throw Error('Timed out: '+code)};
  const paint=()=>run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,100))))');
  const ids=()=>run('Array.from(document.querySelectorAll(".hadron-v2-transcript [data-message-id]")).map(el=>el.dataset.messageId)');
  await wait('document.querySelectorAll(".hadron-v2-transcript article").length===20');
  const clickNode=async id=>{
   await run('(()=>{const buttons=Array.from(document.querySelectorAll(".hadron-v2-tree-node"));const ids='+JSON.stringify(['q0','a0','q1','a1','q2','a2','q3','a3','q4','a4','q5','a5','q6','a6','q7','a7','q8','a8','q9','a9','fork-q','fork-a','fork-q2','fork-a2'])+';buttons[ids.indexOf('+JSON.stringify(id)+')].click()})();true');
   await wait('fixture().selected==='+JSON.stringify(id));await paint();
  };
  for(let n=0;n<3;n++)await run('document.querySelector("button[aria-label=\\"Zoom tree in\\"]").click();true');
  await wait('document.querySelector("button[aria-label=\\"Reset tree view\\"]").textContent==="173%"');
  await clickNode('q3');
  const main=await ids();
  if(main.length!==20||!main.includes('a9')||main.includes('fork-a2'))throw Error('Earlier node cut off or mixed the branch');
  const position=await run('(()=>{const p=document.querySelector(".hadron-v2-transcript"),m=p.querySelector("[data-message-id=q3]");return m.getBoundingClientRect().top-p.getBoundingClientRect().top})()');
  if(Math.abs(position-8)>2)throw Error('Selected message was not scrolled into view: '+position);
  const saved=await run('fixture()');
  if(saved.draft!=='Keep this unsent message.'||saved.calls.creates||saved.context.at(-1)!=='q3')throw Error('Browsing changed the draft, sent a request or changed continuation ancestry');
  report.earlierNodeScrollsWithoutTruncation=true;report.zoomedSelectionWorks=true;report.unsentDraftPreserved=true;
  await run('document.querySelector("button[aria-label=\\"Go to latest message\\"]").click();true');
  await wait('fixture().selected==="a9"');await paint();
  if((await ids()).length!==20)throw Error('Latest jumped to an unrelated sibling');
  report.latestStaysOnDisplayedBranch=true;
  await clickNode('fork-a');
  const fork=await ids();
  if(!fork.includes('fork-a2')||fork.includes('a9'))throw Error('Sibling selection did not retain its later replies');
  await clickNode('q0');
  if(!(await ids()).includes('fork-a2')||(await ids()).includes('a9'))throw Error('Selecting an ancestor abandoned the branch being read');
  report.siblingAndAncestorNavigation=true;
  await run('const pane=document.querySelector(".hadron-v2-transcript");pane.scrollTop=200;pane.dispatchEvent(new Event("scroll",{bubbles:true}));true');
  const before=await run('document.querySelector(".hadron-v2-transcript").scrollTop');
  await run('fixtureUpdate();true');await paint();
  const after=await run('document.querySelector(".hadron-v2-transcript").scrollTop');
  if(Math.abs(after-before)>2)throw Error('A reply update moved the reader away');
  report.replyUpdatesPreserveReadingPosition=true;
  await clickNode('q0');
  const reselected=await run('(()=>{const p=document.querySelector(".hadron-v2-transcript"),m=p.querySelector("[data-message-id=q0]");return m.getBoundingClientRect().top-p.getBoundingClientRect().top})()');
  if(Math.abs(reselected-8)>2)throw Error('Clicking the same node did not scroll back to the selected message');
  report.reselectingSameNodeScrolls=true;
  fs.writeFileSync(path.join(__dirname,'transcript.png'),(await win.webContents.capturePage()).toPNG());
  report.success=true;
 }catch(error){report.error=String(error)}
 finally{fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));win?.destroy();app.exit(report.success?0:1)}
});
`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated transcript navigation check: '+directory)
const child=spawn(require('electron'),[path.join(directory,'main.cjs')],{cwd:root,env,windowsHide:true,stdio:'inherit'})
const timer=setTimeout(()=>child.kill(),45000)
child.once('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1})
child.once('exit',code=>{clearTimeout(timer);process.exitCode=code??1})
