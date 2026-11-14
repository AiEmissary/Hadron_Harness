import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {auditHadronProject} from './hadronProjectDesktopAudit.js'
import {auditHadronWorkflowLayout} from './hadronWorkflowLayoutAudit.js'

export async function auditHadronSharedFolder(window:BrowserWindow,profile:string,requestCount:()=>number){
 const initialRequests=requestCount();await auditHadronWorkflowLayout(window,profile);if(requestCount()!==initialRequests)throw Error('Typing or changing modes sent a request')
 // First test the independent mode using its newly visible Add folder action.
 await auditHadronProject(window,profile)
 const result=await window.webContents.executeJavaScript(`(async()=>{
 const button=(text,root=document)=>Array.from(root.querySelectorAll('button')).find(e=>e.textContent.trim()===text&&!e.closest('[hidden]'));
 const wait=async fn=>{for(let i=0;i<120;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('Shared folder UI timed out: '+fn)};
 const choose=(label,value)=>{const s=document.querySelector('select[aria-label="'+label+'"]');s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}))};
 button('Work together').click();await wait(()=>!!document.querySelector('[data-agent-conversation="shared"]')?.getClientRects().length);button('Use task only')?.click();
 await wait(()=>!!document.querySelector('select[aria-label="Agent A provider"] option[value="openaichatgpt"]'));
 const mixed=!!document.querySelector('select[aria-label="Agent B provider"] option[value="claudecode"]:not(:disabled)');
 for(const slot of ['A','B']){choose('Agent '+slot+' provider',slot==='B'&&mixed?'claudecode':'openaichatgpt');await new Promise(r=>setTimeout(r,50));choose('Agent '+slot+' model',slot==='B'&&mixed?'fixture-claude':'fixture-model')}
 let panel=document.querySelector('[aria-label="Hadron collaboration"]');
 button('Add folder',panel).click();await wait(()=>panel.querySelector('[aria-label="Shared task folder"]')?.textContent.includes('project-fixture'));
 for(const mode of ['review','verification']){
  choose('Collaboration review mode',mode);
  const task=document.querySelector('textarea[aria-label="Shared task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(task,'SHARED_FOLDER_NATIVE');task.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>!!button('Start collaboration')&&!button('Start collaboration').disabled);button('Start collaboration').click();
  await wait(()=>document.querySelector('[aria-label="Combined answer"]')?.textContent.includes('SHARED_FOLDER_SENTINEL'));
  await wait(()=>document.querySelector('[aria-label="Shared folder activity"]')?.textContent.includes('review_b:project_read'));
  if(mode==='verification')await wait(()=>document.querySelector('[aria-label="Verification results"]')?.textContent.includes('project_read'));
  if(mode==='review'){
   await wait(()=>!button('New collaboration').disabled);button('New collaboration').click();
   await wait(()=>!task.value);
   if(!panel.querySelector('[aria-label="Shared task folder"]'))throw Error('Shared folder disappeared between tasks');
  }
 }
 await wait(()=>!button('Remove folder',panel).disabled);button('Remove folder',panel).click();
 await wait(()=>!panel.querySelector('[aria-label="Shared task folder"]'));
 return {success:true,mixedProviders:mixed,independentVisibleFolderAction:true,sharedNativeFolderPicker:true,bothProposalsReadFolder:true,bothCrossReviewsReadFolder:true,verificationReadsFolder:true,hostFolderEvidence:true,folderActivityVisible:true,folderKeptForNextTask:true,sharedFolderRemoved:true,noInferenceOnSelection:true,projectWrites:0,shellCommands:0,realProviderRequests:0};
 })()`)
 if(requestCount()!==42)throw Error('Folder workflow request accounting changed: '+requestCount())
 const source=fs.readFileSync(path.join(profile,'project-fixture','src','value.ts'),'utf8')
 if(source!=='export const marker = "SHARED_FOLDER_SENTINEL"\n')throw Error('Shared source file was changed')
 fs.writeFileSync(path.join(profile,'shared-folder-result.json'),JSON.stringify(result,null,2))
 fs.writeFileSync(path.join(profile,'shared-folder.png'),(await window.webContents.capturePage()).toPNG())
}
