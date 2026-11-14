import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..')
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-crisp-tree-'))
await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{UnifiedChatSurface}from'./src/components/UnifiedWorkspace/UnifiedChatSurface';
import{blankWorkspaceChat}from'./src/features/collaboration/unifiedWorkspace';
const chat=blankWorkspaceChat('fixture','zoom');chat.messages=[
{id:'q',parentId:null,role:'user',text:'Please review this design and explain the next steps clearly.',state:'completed'},
{id:'a',parentId:'q',role:'assistant',agent:'a',text:'The design is ready. Here are the checks and next steps.',state:'completed'},
{id:'q2',parentId:'a',role:'user',text:'Which changes should we make first?',state:'completed'},
{id:'a2',parentId:'q2',role:'assistant',agent:'a',text:'Begin with the layout, then check the finished result.',state:'completed'}];chat.selectedId='a2';
const noop=()=>{};window.fixtureSelection=[];
createRoot(document.getElementById('root')).render(<UnifiedChatSurface chat={chat} providers={[]} help={<span>How to use Hadron</span>} canSend={false} onDraft={noop} onSend={noop} onStop={noop} onAgent={noop} onConfigure={noop} onFile={noop} onFolder={noop} onLatest={noop} onSelect={id=>window.fixtureSelected=id} onSelection={ids=>window.fixtureSelection=ids} onMessageAction={noop} onScroll={noop}/>);
`},outfile:path.join(directory,'renderer.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic'})
await fs.writeFile(path.join(directory,'index.html'),'<meta charset="utf-8"><link rel="stylesheet" href="renderer.css"><style>html,body,#root{height:100%;margin:0;font:14px Arial;color:#294253}#root{padding:12px;box-sizing:border-box;background:#e7eef2}</style><div id="root"></div><script src="renderer.js"></script>')
await fs.writeFile(path.join(directory,'main.cjs'),String.raw`
const{app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.commandLine.appendSwitch('force-device-scale-factor',process.env.HADRON_TREE_DPR);
app.setPath('userData',path.join(__dirname,'profile-'+process.env.HADRON_TREE_DPR));
app.whenReady().then(async()=>{let win;const report={success:false,displayScale:Number(process.env.HADRON_TREE_DPR),providerRequests:0};try{
 win=new BrowserWindow({show:false,width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
 await win.loadFile(path.join(__dirname,'index.html'));
 const run=code=>win.webContents.executeJavaScript(code).catch(error=>{throw Error(code+': '+error.message)}),wait=async code=>{for(let i=0;i<120;i++){if(await run('Boolean('+code+')'))return;await new Promise(resolve=>setTimeout(resolve,25))}throw Error('Timed out: '+code)};
 const paint=()=>run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,150))))');
 await wait('document.querySelector(".hadron-v2-tree-node")');
 await paint();fs.writeFileSync(path.join(__dirname,'tree-100-'+report.displayScale+'.png'),(await win.webContents.capturePage()).toPNG());
 for(const expected of [120,144,173,208,250,300]){
  await run('document.querySelector(".hadron-v2-tree-controls button:nth-child(3)").click();true');
  await wait('document.querySelector(".hadron-v2-tree-controls button:nth-child(2)").textContent==="'+expected+'%"');
 }
 report.geometry=await run('(()=>{const svg=document.querySelector(".hadron-v2-tree-scroll>svg"),node=document.querySelector(".hadron-v2-tree-node"),r=node.getBoundingClientRect(),m=svg.getScreenCTM();return {font:parseFloat(getComputedStyle(node).fontSize),width:r.width,height:r.height,scaleX:m.a,scaleY:m.d,willChange:getComputedStyle(svg).willChange}})()');
 const g=report.geometry;
 report.textLaidOutAtActualZoomedSize=Math.abs(g.font-30)<.02&&Math.abs(g.width-468)<.1&&Math.abs(g.height-198)<.1;
 report.noSvgBitmapMagnification=Math.abs(g.scaleX-1)<.001&&Math.abs(g.scaleY-1)<.001&&g.willChange==='auto';
 const pan=async(dx,dy)=>{
  const p=await run('(()=>{const r=document.querySelector(".hadron-v2-tree-scroll").getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()');
  win.webContents.sendInputEvent({type:'mouseDown',...p,button:'middle',clickCount:1});
  win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(p.x+dx),y:Math.round(p.y+dy)});
  win.webContents.sendInputEvent({type:'mouseUp',x:Math.round(p.x+dx),y:Math.round(p.y+dy),button:'middle',clickCount:1});
  await paint();
 };
 for(let i=0;i<5;i++){
  const delta=await run('(()=>{const v=document.querySelector(".hadron-v2-tree-scroll").getBoundingClientRect(),r=document.querySelector(".hadron-v2-tree-node").getBoundingClientRect();return{x:v.left+v.width/2-r.left-r.width/2,y:v.top+150-r.top}})()');
  if(Math.abs(delta.x)<2&&Math.abs(delta.y)<2)break;
  await pan(Math.max(-250,Math.min(250,delta.x)),Math.max(-250,Math.min(250,delta.y)));
 }
 await paint();fs.writeFileSync(path.join(__dirname,'tree-300-'+report.displayScale+'.png'),(await win.webContents.capturePage()).toPNG());
 const box=await run('(()=>{const r=document.querySelector(".hadron-v2-tree-node").getBoundingClientRect();return{x:Math.round(r.left-8),y:Math.round(r.top-4),endX:Math.round(r.right+6),endY:Math.round(r.bottom+5)}})()');
 win.webContents.sendInputEvent({type:'mouseDown',x:box.x,y:box.y,button:'left',clickCount:1,modifiers:['shift']});
 win.webContents.sendInputEvent({type:'mouseMove',x:box.endX,y:box.endY,modifiers:['shift']});
 win.webContents.sendInputEvent({type:'mouseUp',x:box.endX,y:box.endY,button:'left',clickCount:1,modifiers:['shift']});
 await wait('window.fixtureSelection.includes("q")');report.groupSelectionAt300Percent=true;
 await run('document.querySelector(".hadron-v2-tree-controls button:nth-child(2)").click();true');
 await wait('document.querySelector(".hadron-v2-tree-controls button:nth-child(2)").textContent==="100%"');
 report.resetRestoresNativeFont=await run('Math.abs(parseFloat(getComputedStyle(document.querySelector(".hadron-v2-tree-node")).fontSize)-10)<.02');
 for(const[key,value]of Object.entries(report))if(typeof value==='boolean'&&key!=='success'&&!value)throw Error('Tree assertion failed: '+key);
 report.success=true;
 }catch(error){report.error=String(error)}finally{fs.writeFileSync(path.join(__dirname,'result-'+report.displayScale+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));win?.destroy();app.exit(report.success?0:1)}});
`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated crisp tree fixture: '+directory)
for(const scale of ['1','1.5'])await new Promise((resolve,reject)=>{
 const child=spawn(require('electron'),[path.join(directory,'main.cjs')],{cwd:root,env:{...env,HADRON_TREE_DPR:scale},windowsHide:true,stdio:'inherit'})
 const timer=setTimeout(()=>{child.kill();reject(Error('Tree fixture timed out'))},30000)
 child.once('error',error=>{clearTimeout(timer);reject(error)})
 child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Tree fixture failed'))})
})

