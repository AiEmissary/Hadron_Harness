import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {spawn} from 'node:child_process'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),appDir=path.resolve(import.meta.dirname,'..')
const project=path.resolve(appDir,'../../../..'),preview=path.join(project,'design/project-building.html')
const output=path.join(project,'validation/revision76'),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'hadron-design-'))
const cache=path.join(appDir,'node_modules/.cache/hadron');await fs.mkdir(cache,{recursive:true});await fs.mkdir(output,{recursive:true})
const runner=path.join(cache,'project-design.mjs')
await fs.writeFile(runner,`import {app,BrowserWindow,session} from 'electron';import fs from 'node:fs';import path from 'node:path';
app.setPath('userData',${JSON.stringify(temporary)});
void app.whenReady().then(async()=>{let window;const external=[];try{
session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,done)=>{external.push(details.url);done({cancel:true})});
window=new BrowserWindow({show:false,width:1500,height:1080,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
const demo=${JSON.stringify(path.join(project,'demo-project/src/calculator.js'))},before=fs.readFileSync(demo,'utf8');
await window.loadFile(${JSON.stringify(preview)});
const result=await window.webContents.executeJavaScript(\`(()=>{
const assert=(value,message)=>{if(!value)throw Error(message)};
assert(document.querySelectorAll('main>.pane').length===3,'Missing three panes');
assert(document.querySelectorAll('[data-tree-view]').length===6,'Missing project history steps');
assert(document.getElementById('apply-preview').disabled,'Apply must start disabled');
document.getElementById('simulate').click();assert(!document.querySelector('[data-panel="review"]').hidden,'Review did not open');
document.querySelector('[data-view="plan"]').click();assert(!document.querySelector('[data-panel="plan"]').hidden,'Changes did not open');
document.getElementById('apply-preview').click();assert(document.getElementById('apply-message').textContent.includes('no files were written'),'Preview apply mislabeled');
document.querySelector('[data-view="logs"]').click();assert(!document.querySelector('[data-panel="logs"]').hidden,'Job log did not open');
document.querySelector('[data-tree-view="plan"]').click();
assert(typeof require==='undefined'&&!window.electronAPI,'Preview has ambient native access');
assert(Array.from(document.querySelectorAll('main>.pane')).every(pane=>pane.scrollWidth<=pane.clientWidth+1),'A pane overflows horizontally');
return {success:true,threePanes:true,historySteps:6,reviewAndLogNavigation:true,simulationLabeled:true,noNativeBridge:true};
})()\`);
if(before!==fs.readFileSync(demo,'utf8')||external.length)throw Error('Design preview touched files or attempted external access');
await new Promise(resolve=>setTimeout(resolve,250));
fs.writeFileSync(path.join(${JSON.stringify(output)},'project-building-preview.png'),(await window.webContents.capturePage()).toPNG());
fs.writeFileSync(path.join(${JSON.stringify(output)},'project-design-result.json'),JSON.stringify({...result,externalRequests:0,providerRequests:0,projectWrites:0},null,2));app.exit(0);
}catch(error){fs.writeFileSync(path.join(${JSON.stringify(output)},'project-design-error.json'),JSON.stringify({error:String(error)}));app.exit(1)}});`)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
const child=spawn(require('electron'),[runner],{cwd:appDir,env,windowsHide:true,stdio:'ignore'})
const timer=setTimeout(()=>child.kill(),25000)
child.on('exit',async code=>{clearTimeout(timer);const report=code===0?'project-design-result.json':'project-design-error.json';try{console.log(await fs.readFile(path.join(output,report),'utf8'))}catch{}process.exitCode=code??1})
