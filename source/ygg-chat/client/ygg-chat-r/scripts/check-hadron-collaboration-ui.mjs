import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const appDir = path.resolve(import.meta.dirname, '..')
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hadron-ui-'))
const cache = path.join(appDir, 'node_modules/.cache/hadron')
await fs.mkdir(cache, { recursive: true })
const renderer = path.join(cache, 'collaboration-ui.js')
await build({ stdin: { contents: `import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {CollaborationWorkspace} from './src/components/CollaborationPanel/CollaborationWorkspace';
import {ChatCollaborationLayout} from './src/components/CollaborationPanel/ChatCollaborationLayout';
import {readSharedFiles} from './src/features/collaboration/attachments';
import {IndependentJobTree} from './src/components/CollaborationPanel/IndependentJobTree';
import {CodexConnection} from './src/components/CollaborationPanel/CodexConnection';
window.fixtureShowCodex=()=>{const host=document.createElement('div');host.id='fixture-codex';host.style='position:fixed;right:20px;top:20px;width:380px;z-index:9999;background:white;padding:10px';document.body.append(host);
window.fixtureCodex={connected:false,loginState:'idle',starts:0,cancels:0,opens:0,tests:0};const state=window.fixtureCodex;
Object.assign(window.electronAPI.collaboration,{codexStatus:async()=>({installed:true,connected:state.connected,reason:state.connected?'ready':'signed_out',loginState:state.loginState,...(state.loginState==='running'?{device:{verificationUri:'https://auth.openai.com/codex/device',userCode:'TEST-CODE'}}:{})}),
codexTest:async()=>{state.tests++;return {text:"Hadron connection OK"}},codexSignIn:async()=>{state.starts++;state.loginState='running'},codexCancelSignIn:async()=>{state.cancels++;state.loginState='idle'},codexOpenSignIn:async()=>{state.opens++},codexDisconnect:async()=>{state.connected=false}});
const root=createRoot(host);root.render(<CodexConnection/>);return ()=>{root.unmount();host.remove();for(const key of ['codexStatus','codexSignIn','codexCancelSignIn','codexOpenSignIn','codexDisconnect','codexTest'])delete window.electronAPI.collaboration[key]}};
window.fixtureReadSharedFiles=readSharedFiles;
window.fixtureShowJobTrees=()=>{const host=document.createElement('div');host.id='fixture-job-trees';document.body.append(host);const root=createRoot(host);
root.render(<div>{['a','b'].map(slot=>{const status={schemaVersion:1,id:'fixture-'+slot,conversationId:'fixture-chat-'+slot,status:'running',revision:1,provider:'openaichatgpt',modelName:'fixture',runId:'run-'+slot,streamId:'stream-'+slot};return <IndependentJobTree key={slot} slot={slot} label={'Fixture Agent '+slot.toUpperCase()} status={status} liveText={'Live '+slot.toUpperCase()+' only'} readTree={async()=>({schemaVersion:1,id:status.id,conversationId:status.conversationId,nodes:[{id:'anchor-'+slot,parentId:null,kind:'task',status:'saved',text:'Task '+slot.toUpperCase()+' only',verified:false},{id:'run-'+slot,parentId:'anchor-'+slot,kind:'response',status:'running',text:'',verified:false}]})}/>})}</div>);return ()=>{root.unmount();host.remove()}};
import {captureCollaborationAnchor} from './src/features/collaboration/context';
window.fixtureConnections={chatgpt:{starts:0,cancels:0,loginState:'idle',connected:false,modelReads:0,tests:0},claude:{starts:0,cancels:0,loginState:'idle'}};
window.electronAPI={collaboration:{setup:async()=>({schemaVersion:1,liveEnabled:false,ownerAvailable:true,provider:{id:'openaichatgpt',connected:true,models:[]}}),
chatgptStatus:async()=>({connected:window.fixtureConnections.chatgpt.connected,reason:'signed_out',loginState:window.fixtureConnections.chatgpt.loginState}),
chatgptTestModels:async()=>{window.fixtureConnections.chatgpt.modelReads++;return [{id:'gpt-6.1-sol',label:'Fixture model'}]},
chatgptTest:async model=>{if(model!=='gpt-6.1-sol')throw Error('Wrong fixture model');window.fixtureConnections.chatgpt.tests++;return {model,text:'Hadron connection OK'}},
chatgptSignIn:async()=>{window.fixtureConnections.chatgpt.starts++;window.fixtureConnections.chatgpt.loginState='running'},
chatgptCancelSignIn:async()=>{window.fixtureConnections.chatgpt.cancels++;window.fixtureConnections.chatgpt.loginState='idle'},
claudeStatus:async()=>({installed:true,connected:false,reason:'signed_out',loginState:window.fixtureConnections.claude.loginState}),
claudeSignIn:async()=>{window.fixtureConnections.claude.starts++;window.fixtureConnections.claude.loginState='running'},
claudeCancelSignIn:async()=>{window.fixtureConnections.claude.cancels++;window.fixtureConnections.claude.loginState='idle'}}};
function Harness(){const [open,setOpen]=useState(false);return <div style={{height:'100vh'}}><ChatCollaborationLayout workspaceOpen={open} onOpenWorkspace={()=>setOpen(true)} workspace={
<CollaborationWorkspace conversationId="isolated-fixture" captureAnchor={()=>captureCollaborationAnchor("isolated-fixture","branch",["a","tool","b"],[{id:"a",conversation_id:"isolated-fixture",role:"user",content:"Check the proposal"},{id:"tool",conversation_id:"isolated-fixture",role:"tool",content:"private-tool-output"},{id:"b",conversation_id:"isolated-fixture",role:"assistant",content:"Selected branch evidence"}])} open={open} onClose={()=>setOpen(false)}/> }>
<section data-fixture-chat="true" data-chat-pane-kind="primary" className="flex min-w-0 flex-col bg-white p-5 dark:bg-neutral-900 dark:text-white" style={{width:'62%'}}>
<header className="flex flex-wrap items-center justify-between gap-2 border-b pb-4"><strong>Chat</strong><button id="launch" className="rounded-full border px-3 py-2 text-sm" onClick={()=>setOpen(true)}>Work together</button></header>
<div className="mt-8 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-800">Compare the two approaches and keep the evidence clear.</div>
<div className="mt-5 p-3 text-sm leading-7">Your main conversation stays here while the two agents work in the separate workspace.</div>
<textarea aria-label="Main chat message" placeholder="Message your chat..." className="mt-auto rounded-2xl border bg-transparent p-4 text-sm text-neutral-500"/></section>
<section data-fixture-tree="true" className="min-w-0 border-l bg-neutral-50 p-4 dark:bg-neutral-950 dark:text-white" style={{width:'38%'}}><strong className="text-sm">Branch tree</strong><p className="mt-2 text-xs text-neutral-500">Illustrative tree for layout review</p>
<svg viewBox="0 0 240 330" style={{width:'100%',marginTop:40}} aria-label="Illustrative colourful branches"><path d="M120 20V90M120 90L55 170M120 90L185 170M55 170V260M185 170V260" fill="none" stroke="#a78bfa" strokeWidth="4"/>
{[[120,20,'#38bdf8'],[120,90,'#a78bfa'],[55,170,'#fbbf24'],[185,170,'#2dd4bf'],[55,260,'#fb7185'],[185,260,'#818cf8']].map(([x,y,c],i)=><circle key={i} cx={x} cy={y} r="12" fill={c}/>)}</svg></section>
</ChatCollaborationLayout></div>}
window.fixtureFetches=0; window.fetch=async()=>{window.fixtureFetches++;throw Error('Network forbidden')};
createRoot(document.getElementById('root')).render(<Harness/>);`, resolveDir: appDir, loader: 'tsx' },
  outfile: renderer, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.jpg': 'dataurl' },
  plugins: [{ name: 'local-pdf-worker-fixture', setup(builder) {
    builder.onResolve({ filter: /pdf\.worker\.min\.mjs\?url$/ }, () => ({ path: require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), namespace: 'local-worker' }))
    builder.onLoad({ filter: /.*/, namespace: 'local-worker' }, args => ({ contents: `export default ${JSON.stringify(pathToFileURL(args.path).href)}`, loader: 'js' }))
  } }],
  define: { 'import.meta.env': '{}', __BUILD_TARGET__: '"local"', __IS_ELECTRON__: 'false', __IS_WEB__: 'false', __IS_LOCAL__: 'true' } })
const css = (await fs.readdir(path.join(appDir, 'dist-electron/assets'))).find(name => /^index-.*\.css$/.test(name))
if (!css) throw new Error('Build renderer CSS first')
const html = path.join(dataDir, 'fixture.html')
await fs.writeFile(html, `<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="${pathToFileURL(path.join(appDir, 'dist-electron/assets', css))}"></head><body><div id="root"></div><script src="${pathToFileURL(renderer)}"></script></body></html>`)
// Tiny format-valid extraction fixtures; no user documents or remote resources.
const pdfText = 'BT /F1 12 Tf 30 780 Td (Attached PDF text) Tj ET'
const pdfObjects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${pdfText.length} >>\nstream\n${pdfText}\nendstream`]
let fixturePdf = '%PDF-1.4\n'; const offsets = [0]
for (let i = 0; i < pdfObjects.length; i++) { offsets.push(fixturePdf.length); fixturePdf += `${i+1} 0 obj\n${pdfObjects[i]}\nendobj\n` }
const xref = fixturePdf.length
fixturePdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`
await fs.writeFile(path.join(dataDir,'fixture.pdf'), fixturePdf)
function storedZip(files) {
  const locals = [], directory = []; let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const filename = Buffer.from(name), data = Buffer.from(text); let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for(let bit=0;bit<8;bit++) crc = (crc>>>1)^((crc&1)?0xedb88320:0) }
    crc = (crc^0xffffffff)>>>0
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50,0); header.writeUInt16LE(20,4); header.writeUInt32LE(crc,14); header.writeUInt32LE(data.length,18); header.writeUInt32LE(data.length,22); header.writeUInt16LE(filename.length,26)
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt32LE(crc,16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24); central.writeUInt16LE(filename.length,28); central.writeUInt32LE(offset,42)
    locals.push(header,filename,data); directory.push(central,filename); offset += header.length+filename.length+data.length
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(Object.keys(files).length,8); end.writeUInt16LE(Object.keys(files).length,10); end.writeUInt32LE(central.length,12); end.writeUInt32LE(offset,16)
  return Buffer.concat([...locals,central,end])
}
await fs.writeFile(path.join(dataDir,'fixture.docx'), storedZip({
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Attached Word text</w:t></w:r></w:p></w:body></w:document>'
}))
const main = path.join(cache, 'collaboration-ui-main.cjs')
await fs.writeFile(main, `const {app,BrowserWindow}=require('electron'); const fs=require('node:fs/promises'); const path=require('node:path');
app.setPath('userData',process.env.HADRON_UI_PROFILE); app.disableHardwareAcceleration();
app.whenReady().then(async()=>{let window; const report={success:false};try{
window=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
window.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')}));
await window.loadFile(process.env.HADRON_UI_HTML);
const run=async code=>{try{return await window.webContents.executeJavaScript(code)}catch(error){throw Error('Fixture script failed: '+code+'; '+error)}};
const wait=async(code)=>{for(let n=0;n<100;n++){if(await run(code))return;await new Promise(r=>setTimeout(r,30));}throw Error('UI condition timed out: '+code)};
await wait('!!document.getElementById("launch")');
await run('document.getElementById("launch").focus();document.getElementById("launch").click()');
await wait('!document.querySelector("[data-collaboration-conversation]").hidden');
await wait('document.body.textContent.includes("2 text messages captured")');
await wait('Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Connect Claude"&&!e.disabled)');
if(await run('window.fixtureConnections.chatgpt.starts+window.fixtureConnections.claude.starts'))throw Error('Opening workspace started sign-in');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Continue with ChatGPT").click()');
await wait('document.body.textContent.includes("Cancel ChatGPT sign-in")');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Connect Claude").click()');
await wait('document.body.textContent.includes("Cancel Claude sign-in")');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Cancel ChatGPT sign-in").click()');
await wait('document.body.textContent.includes("Continue with ChatGPT")');
if(!await run('window.fixtureConnections.claude.loginState==="running"&&window.fixtureConnections.claude.cancels===0'))throw Error('Account cancellation crossed providers');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Cancel Claude sign-in").click()');
await wait('document.body.textContent.includes("Connect Claude")');
report.subscriptionControlsIndependent=await run('window.fixtureConnections.chatgpt.starts===1&&window.fixtureConnections.chatgpt.cancels===1&&window.fixtureConnections.claude.starts===1&&window.fixtureConnections.claude.cancels===1');
if(!report.subscriptionControlsIndependent)throw Error('Wrong subscription bridge calls');
await run('window.probeByLabel=(tag,label)=>Array.from(document.querySelectorAll(tag)).find(e=>e.getAttribute("aria-label")===label);window.fixtureConnections.chatgpt.connected=true;Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Check ChatGPT").click()');
await wait('!!probeByLabel("div","ChatGPT connection test")');
if(await run('window.fixtureConnections.chatgpt.modelReads+window.fixtureConnections.chatgpt.tests'))throw Error('Connected card automatically invoked provider test');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Load test models").click()');
await wait('!!probeByLabel("select","ChatGPT connection test model")');
if(!await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Test ChatGPT").disabled'))throw Error('Test must require explicit model selection');
await run('(()=>{const field=probeByLabel("select","ChatGPT connection test model");field.value="gpt-6.1-sol";field.dispatchEvent(new Event("change",{bubbles:true}))})()');
await wait('Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Test ChatGPT"&&!e.disabled)');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Test ChatGPT").click()');
await wait('document.body.textContent.includes("ChatGPT replied: Hadron connection OK")');
report.boundedConnectionTest=await run('window.fixtureConnections.chatgpt.modelReads===1&&window.fixtureConnections.chatgpt.tests===1');
if(!report.boundedConnectionTest)throw Error('Connection test calls were duplicated');
await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'connection-test.png'),(await window.webContents.capturePage()).toPNG());
await run('window.fixtureConnections.chatgpt.connected=false;Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Check ChatGPT").click()');
await wait('!probeByLabel("div","ChatGPT connection test")');
report.frozenContext=await run('document.querySelector("pre").textContent');
if(report.frozenContext.includes('private-tool-output')||!report.frozenContext.includes('Selected branch evidence'))throw Error('Wrong shared context');
report.controls=await run('Array.from(document.querySelectorAll("select")).filter(e=>!e.closest("[hidden]")).map(e=>e.getAttribute("aria-label"))');
if(report.controls.length!==4)throw Error('Expected four independent provider/model controls');
report.startDisabled=await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Start collaboration").disabled');
if(!report.startDisabled)throw Error('Live Start must be disabled');
await run('window.byLabel=(tag,label)=>Array.from(document.querySelectorAll(tag)).find(e=>e.getAttribute("aria-label")===label);window.fixturePickerOpened=0;byLabel("input","Choose shared task files").click=()=>{window.fixturePickerOpened++};Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Add files"&&!e.closest("[hidden]")).click()');
for(const [extension,expected] of [['pdf','Attached PDF text'],['docx','Attached Word text']]) {
const encoded=(await fs.readFile(path.join(process.env.HADRON_UI_PROFILE,'fixture.'+extension))).toString('base64');
const code='(async()=>{const bytes=Uint8Array.from(atob('+JSON.stringify(encoded)+'),c=>c.charCodeAt(0));const files=await window.fixtureReadSharedFiles([new File([bytes],"fixture.'+extension+'")]);return files[0].text})()';
const extracted=await run(code);if(!extracted.includes(expected))throw Error('Document text extraction failed: '+extension);
report[extension+'Extracted']=true;
}
report.filePickerOpened=await run('window.fixturePickerOpened===1');if(!report.filePickerOpened)throw Error('Add files must open file chooser');
await run('const transfer=new DataTransfer();transfer.items.add(new File(["Shared task file text"],"brief.md",{type:"text/markdown"}));const picker=byLabel("input","Choose shared task files");picker.files=transfer.files;picker.dispatchEvent(new Event("change",{bubbles:true}))');
await wait('!!document.querySelector("ul")');
report.selectedFile=await run('document.querySelector("ul").textContent.includes("brief.md")');
if(!report.selectedFile)throw Error('Selected file must be listed');
report.desktopDockBesideChat=await run('document.querySelector("[data-collaboration-dock]").getBoundingClientRect().left >= document.querySelector("[data-existing-chat-area]").getBoundingClientRect().right - 1');
if(!report.desktopDockBesideChat)throw Error('Workspace must sit beside chat and tree');
report.focus=await run('document.activeElement.textContent');if(report.focus!=='Collapse')throw Error('Workspace must receive keyboard focus');
await run('Array.from(document.querySelectorAll("nav button")).find(e=>e.textContent==="Main chat").click()');
report.mainChatInteractive=await run('document.querySelector("textarea").focus(); document.activeElement.getAttribute("aria-label") === "Main chat message" && !document.querySelector(":modal")');
if(!report.mainChatInteractive)throw Error('Workspace must not block the main chat');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Collapse").focus()');
await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'desktop.png'),(await window.webContents.capturePage()).toPNG());
await run('document.documentElement.classList.add("dark")');
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'dark.png'),(await window.webContents.capturePage()).toPNG());
window.setSize(420,850);await new Promise(r=>setTimeout(r,100));
report.mobileOverflow=await run('document.querySelector("[data-collaboration-conversation]").scrollWidth > document.querySelector("[data-collaboration-conversation]").clientWidth');
if(report.mobileOverflow)throw Error('Workspace overflows at mobile width');
report.mobileDockBelowChat=await run('document.querySelector("[data-collaboration-dock]").getBoundingClientRect().top >= document.querySelector("[data-existing-chat-area]").getBoundingClientRect().bottom - 1');
if(!report.mobileDockBelowChat)throw Error('Narrow-screen workspace must stack below chat');
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'mobile.png'),(await window.webContents.capturePage()).toPNG());
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Remove").click()');
await wait('!document.querySelector("ul")');
report.fileRemoved=true;
await run('const transferNew=new DataTransfer();transferNew.items.add(new File(["Old task attachment"],"old-task.md"));const pickerNew=byLabel("input","Choose shared task files");pickerNew.files=transferNew.files;pickerNew.dispatchEvent(new Event("change",{bubbles:true}));const areaNew=byLabel("textarea","Shared task");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(areaNew,"Old collaboration question");areaNew.dispatchEvent(new Event("input",{bubbles:true}))');
await wait('!!byLabel("ul","Shared task files")');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="New collaboration").click()');
await wait('!!byLabel("div","Files for new collaboration")');
report.newCollaborationWaitsForFileChoice=await run('byLabel("textarea","Shared task").value==="Old collaboration question"&&!!byLabel("ul","Shared task files")');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Keep attached files").click()');
await wait('byLabel("textarea","Shared task").value===""&&!!byLabel("ul","Shared task files")');
report.newCollaborationKeepsFiles=true;
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="New collaboration").click()');
await wait('!!byLabel("div","Files for new collaboration")');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Remove attached files").click()');
await wait('byLabel("textarea","Shared task").value===""&&!byLabel("ul","Shared task files")');
report.newCollaborationClearsQuestionAndFiles=true;
report.newCollaborationFocus=await run('document.activeElement.getAttribute("aria-label")==="Shared task"');
if(!report.newCollaborationFocus)throw Error('New collaboration did not focus the question');
await run('Array.from(document.querySelectorAll("nav button")).find(e=>e.textContent==="Independent jobs").click()');
await wait('Array.from(document.querySelectorAll("nav")).find(e=>e.getAttribute("aria-label")==="Agent workspace mode").querySelector("button[aria-pressed=true]").textContent==="Independent jobs"');
await run('const setValue=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set;for(const [agent,text] of [["A","Independent task A"],["B","Different task B"]]){const area=byLabel("textarea","Agent "+agent+" job task");setValue.call(area,text);area.dispatchEvent(new Event("input",{bubbles:true}))}');
await run('const transferA=new DataTransfer();transferA.items.add(new File(["Only A file"],"only-a.md"));const inputA=byLabel("input","Choose Agent A job files");inputA.files=transferA.files;inputA.dispatchEvent(new Event("change",{bubbles:true}))');
await wait('!!byLabel("ul","Agent A job files")');
report.independentFilesIsolated=await run('!byLabel("ul","Agent B job files")');
report.independentTasksSeparate=await run('byLabel("textarea","Agent A job task").value==="Independent task A"&&byLabel("textarea","Agent B job task").value==="Different task B"');
report.independentStartsDisabled=await run('Array.from(document.querySelectorAll("button")).filter(e=>/^Send to Agent [AB]$/.test(e.textContent)).every(e=>e.disabled)');
if(!report.independentFilesIsolated||!report.independentTasksSeparate||!report.independentStartsDisabled)throw Error('Independent jobs UI isolation failed');
window.setSize(1600,1000);await new Promise(r=>setTimeout(r,100));
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'independent.png'),(await window.webContents.capturePage()).toPNG());
await run('document.documentElement.classList.remove("dark")');
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'independent-light.png'),(await window.webContents.capturePage()).toPNG());
await run('Array.from(document.querySelectorAll("nav button")).find(e=>e.textContent==="Work together").click()');
await wait('Array.from(document.querySelectorAll("nav")).find(e=>e.getAttribute("aria-label")==="Agent workspace mode").querySelector("button[aria-pressed=true]").textContent==="Work together"');
report.modeSwitchPreservesDraft=await run('byLabel("textarea","Agent A job task").value==="Independent task A"');
if(!report.modeSwitchPreservesDraft)throw Error('Mode switch discarded an independent task');
await run('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Collapse").click()');
await wait('document.querySelector("[data-collaboration-conversation]").hidden');
report.focusRestored=await run('document.activeElement.getAttribute("aria-label") === "Open agent workspace"');if(!report.focusRestored)throw Error('Agents tab did not receive focus');
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'collapsed.png'),(await window.webContents.capturePage()).toPNG());
await run('byLabel("button","Open agent workspace").click()');await wait('!document.querySelector("[data-collaboration-conversation]").hidden');
report.collapsePreservesDraft=await run('byLabel("textarea","Agent A job task").value==="Independent task A"&&byLabel("ul","Agent A job files").textContent.includes("only-a.md")');if(!report.collapsePreservesDraft)throw Error('Collapse lost draft');
window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
await wait('document.querySelector("[data-collaboration-conversation]").hidden');
report.fetches=await run('window.fixtureFetches');if(report.fetches!==0)throw Error('Unexpected HTTP call');
await run('window.cleanupTrees=window.fixtureShowJobTrees();true');
await wait('!!byLabel("button","Fixture Agent B tree task")');
await run('for(const detail of document.querySelectorAll("#fixture-job-trees details"))detail.open=true;byLabel("button","Fixture Agent A tree response").click()');
await wait('byLabel("button","Fixture Agent A tree response").getAttribute("aria-pressed")==="true"');
report.independentTreeSelectionIsolated=await run('byLabel("button","Fixture Agent B tree task").getAttribute("aria-pressed")==="true"&&byLabel("div","Fixture Agent A selected tree node").textContent==="Live A only"&&byLabel("div","Fixture Agent B selected tree node").textContent==="Task B only"');
if(!report.independentTreeSelectionIsolated)throw Error('Tree selection crossed independent jobs');
await run('window.cleanupTrees()');
report.fetches=await run('window.fixtureFetches');if(report.fetches!==0)throw Error('Unexpected tree HTTP call');
await run('window.fixtureCloseCodex=window.fixtureShowCodex();window.codexButton=text=>Array.from(document.querySelectorAll("#fixture-codex button")).find(e=>e.textContent===text);true');
await wait('!!codexButton("Continue with ChatGPT")&&!codexButton("Continue with ChatGPT").disabled');
if(await run('fixtureCodex.starts+fixtureCodex.opens'))throw Error('Codex card started sign-in automatically');
await run('document.querySelector("#fixture-codex details").open=true;codexButton("Sign in with a device code").click()');
await wait('document.getElementById("fixture-codex").textContent.includes("TEST-CODE")');
await run('codexButton("Open sign-in page").click()');
await wait('fixtureCodex.opens===1');
await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'codex-device.png'),(await window.webContents.capturePage()).toPNG());
await run('codexButton("Cancel ChatGPT sign-in").click()');
await wait('!document.getElementById("fixture-codex").textContent.includes("TEST-CODE")');
report.codexDeviceControls=await run('fixtureCodex.starts===1&&fixtureCodex.cancels===1&&fixtureCodex.opens===1');
if(!report.codexDeviceControls)throw Error('Wrong Codex device controls');
await run('fixtureCodex.connected=true;codexButton("Check ChatGPT").click()');
await wait('document.getElementById("fixture-codex").textContent.includes("Subscription connected through Codex")');
await run('codexButton("Test ChatGPT").click()');
await wait('document.getElementById("fixture-codex").textContent.includes("Hadron connection OK")');
report.codexConnectionTest=await run('fixtureCodex.tests===1');
if(!report.codexConnectionTest)throw Error('Connection test button failed');
await run('codexButton("Disconnect ChatGPT").click()');
await wait('!!codexButton("Continue with ChatGPT")&&!document.getElementById("fixture-codex").textContent.includes("Hadron connection OK")');
await run('fixtureCodex.connected=true;codexButton("Check ChatGPT").click()');
await wait('!!codexButton("Test ChatGPT")&&!codexButton("Test ChatGPT").disabled');
report.codexOldTestCleared=await run('!document.getElementById("fixture-codex").textContent.includes("Hadron connection OK")&&fixtureCodex.tests===1');
if(!report.codexOldTestCleared)throw Error('Old account retained connection-test result');
await run('fixtureCloseCodex()');
report.success=true;console.log(JSON.stringify(report,null,2));
}catch(error){report.error=String(error);console.error(error);process.exitCode=1;}finally{await fs.writeFile(path.join(process.env.HADRON_UI_PROFILE,'ui-result.json'),JSON.stringify(report,null,2));window?.destroy();app.exit(report.success?0:1)}});
`)
console.log(`Isolated Hadron UI profile: ${dataDir}`)
const env = { ...process.env, HADRON_UI_PROFILE: dataDir, HADRON_UI_HTML: html }; delete env.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), [main], { cwd: appDir, env, windowsHide: true, stdio: 'inherit' })
const timer = setTimeout(() => { child.kill(); process.exitCode = 1 }, 60_000)
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1 })
child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 1 })
