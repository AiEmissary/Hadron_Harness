// Isolated hidden Electron window; no user profile, account access or provider requests.
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..')
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-jpeg-ui-'))
await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{UnifiedChatSurface}from'./src/components/UnifiedWorkspace/UnifiedChatSurface';
import{AttachmentPicker}from'./src/components/CollaborationPanel/AttachmentPicker';
import{readSharedFiles}from'./src/features/collaboration/attachments';
import{blankWorkspaceChat}from'./src/features/collaboration/unifiedWorkspace';
import{fixtureImage}from'../../shared/__fixtures__/hadronImage';
window.fixtureImage=fixtureImage;window.readSharedFiles=readSharedFiles;
function App(){const [chat,setChat]=useState(()=>({...blankWorkspaceChat('fixture','image-chat'),draft:'Describe this picture.'}));window.fixtureChat=chat;
return <><UnifiedChatSurface chat={chat} providers={[]} help={<span>How to use Hadron</span>} canSend={true} onDraft={draft=>setChat(c=>({...c,draft}))} onSend={()=>setChat(c=>({...c,attachments:[],draft:'',messages:[{id:'q',parentId:null,role:'user',text:c.draft,state:'completed',images:c.attachments.flatMap(f=>f.image?[f.image]:[])},{id:'a',parentId:'q',role:'assistant',text:'Picture received.',state:'completed'}],selectedId:'a'}))} onStop={()=>{}} onAgent={()=>{}} onConfigure={()=>{}} onFile={()=>document.querySelector('input[type=file]').click()} onFolder={()=>{}} onLatest={()=>{}} onSelect={()=>{}} onMessageAction={()=>{}} onRemoveFile={id=>setChat(c=>({...c,attachments:c.attachments.filter(f=>f.id!==id)}))} onScroll={()=>{}}/>
<AttachmentPicker compact label="Attach files" onBusy={()=>{}} files={chat.attachments??[]} onFiles={files=>setChat(c=>({...c,attachments:files}))}/></>}
createRoot(document.getElementById('root')).render(<App/>);
`},outfile:path.join(directory,'renderer.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',plugins:[{name:'unused-pdf-worker',setup(build){build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'unused-pdf-worker',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "unused-pdf-worker"',loader:'js'}))}}]})
await fs.writeFile(path.join(directory,'index.html'),'<meta charset="utf-8"><link rel="stylesheet" href="renderer.css"><style>html,body,#root{height:100%;margin:0;font:14px Arial;color:#294253}#root{padding:12px;box-sizing:border-box;background:#e7eef2}.sr-only{display:none}</style><div id="root"></div><script src="renderer.js"></script>')
await fs.writeFile(path.join(directory,'main.cjs'),String.raw`
const{app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(__dirname,'profile'));
app.whenReady().then(async()=>{let win;const report={success:false,providerRequests:0};try{
win=new BrowserWindow({show:false,width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
win.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
await win.loadFile(path.join(__dirname,'index.html'));
const run=code=>win.webContents.executeJavaScript(code).catch(error=>{throw Error(code+': '+error.message)}),wait=async code=>{for(let i=0;i<120;i++){if(await run('Boolean('+code+')'))return;await new Promise(resolve=>setTimeout(resolve,25))}throw Error('Timed out: '+code)};
await wait('document.querySelector("input[type=file]")');
report.acceptsJPEG=await run('document.querySelector("input[type=file]").accept.includes(".jpeg")');
await run('(async()=>{const b=await(await fetch(fixtureImage.dataUrl)).blob();const data=new DataTransfer();data.items.add(new File([b],"test-picture.JPEG",{type:"image/jpeg"}));const input=document.querySelector("input[type=file]");input.files=data.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()');
await wait('window.fixtureChat.attachments?.length===1');
report.preparedImage=await run('fixtureChat.attachments[0].image.dataUrl.startsWith("data:image/jpeg;base64,")&&fixtureChat.attachments[0].text===""');
await run('Array.from(document.querySelectorAll("button")).find(b=>b.ariaLabel==="Attach file or folder").click()');
await wait('document.querySelector(".hadron-v2-image-thumbnail")?.complete');
report.thumbnailVisible=await run('document.querySelector(".hadron-v2-image-thumbnail").naturalWidth===80');
report.corruptRejected=await run('(async()=>{try{await readSharedFiles([new File(["not a JPEG"],"bad.jpg")]);return false}catch{return true}})()');
report.invalidEncodedImageRejected=await run('(async()=>{try{const bytes=Uint8Array.from([255,216,255,192,0,8,8,0,2,0,2,0,255,217]);await readSharedFiles([new File([bytes],"corrupt.jpg")]);return false}catch{return true}})()');
report.largeSourceRejected=await run('(async()=>{try{await readSharedFiles([new File([new Uint8Array(8*1024*1024+1)],"large.jpg")]);return false}catch{return true}})()');
report.largePicturePrepared=await run('(async()=>{const canvas=document.createElement("canvas");canvas.width=3000;canvas.height=2000;const context=canvas.getContext("2d"),pixels=context.createImageData(3000,2000);let seed=17;for(let i=0;i<pixels.data.length;i+=4){for(let j=0;j<3;j++){seed=(seed*1664525+1013904223)>>>0;pixels.data[i+j]=seed>>>24}pixels.data[i+3]=255}context.putImageData(pixels,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.9));const [file]=await readSharedFiles([new File([blob],"large-photo.jpg",{type:"image/jpeg"})]);const prepared=await(await fetch(file.image.dataUrl)).blob(),bitmap=await createImageBitmap(prepared),ok=Math.max(bitmap.width,bitmap.height)<=2048&&prepared.size<=1024*1024;bitmap.close();return ok})()');
report.originalUnchanged=await run('(async()=>{const b=await(await fetch(fixtureImage.dataUrl)).blob(),file=new File([b],"source.jpg");const before=await file.arrayBuffer();await readSharedFiles([file]);const after=await file.arrayBuffer();return new Uint8Array(before).every((v,i)=>v===new Uint8Array(after)[i])})()');
await run('Array.from(document.querySelectorAll("button")).find(b=>b.ariaLabel==="Attach file or folder").click()');
await run('Array.from(document.querySelectorAll("button")).find(b=>b.ariaLabel==="Send").click()');
await wait('document.querySelector(".hadron-v2-attached-image")?.complete');
report.pictureInMessage=await run('document.querySelector(".hadron-v2-attached-image").naturalWidth===80&&fixtureChat.messages[0].images.length===1&&fixtureChat.attachments.length===0');
for(const[key,value]of Object.entries(report))if(typeof value==='boolean'&&key!=='success'&&!value)throw Error('JPEG assertion failed: '+key);
await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,150))))');
fs.writeFileSync(path.join(__dirname,'jpeg-ui.png'),(await win.webContents.capturePage()).toPNG());report.success=true;
}catch(error){report.error=String(error)}finally{fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));win?.destroy();app.exit(report.success?0:1)}});
`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated JPEG attachment fixture: '+directory)
await new Promise((resolve,reject)=>{
 const child=spawn(require('electron'),[path.join(directory,'main.cjs')],{cwd:root,env,windowsHide:true,stdio:'inherit'})
 const timer=setTimeout(()=>{child.kill();reject(Error('JPEG fixture timed out'))},30000)
 child.once('error',error=>{clearTimeout(timer);reject(error)})
 child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('JPEG fixture failed'))})
})
