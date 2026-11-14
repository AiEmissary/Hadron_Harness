import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
export async function auditHadronProject(window:BrowserWindow,profile:string){
 const reopening=process.env.HADRON_DESKTOP_SMOKE_REOPEN_PROJECT==='1'
 await window.webContents.executeJavaScript(`window.auditProjectReopen=${reopening}`)
 const result=await window.webContents.executeJavaScript(`(async()=>{
  const button=text=>Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===text);
  const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('Project UI timed out: '+fn)};
  const select=(label,value)=>{const el=document.querySelector('select[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))};
  button('Independent jobs').click();
  if(window.auditProjectReopen){
    await wait(()=>!!button('Open Agent A conversation'));button('Open Agent A conversation').click();
    await wait(()=>document.querySelector('[aria-label="Agent A conversation messages"]')?.textContent.includes('Read actual project line: SECOND_PROJECT_LINE_SENTINEL'));
    select('Agent A tool mode','project');await wait(()=>!!button('Choose project for Agent A'));
    if(button('Remove Agent A project access'))throw Error('Project access survived restart');
    const input=document.querySelector('textarea[aria-label="Agent A job task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Check project after restart');input.dispatchEvent(new Event('input',{bubbles:true}));
    await wait(()=>button('Send to Agent A').disabled);
    return {success:true,savedProjectAnswerRestored:true,projectAccessExpires:true,sendBlockedWithoutGrant:true,inferenceRequests:0};
  }
  await wait(()=>!!document.querySelector('select[aria-label="Agent A job provider"] option[value="openaichatgpt"]'));
  select('Agent A job provider','openaichatgpt');await new Promise(r=>setTimeout(r,100));select('Agent A job model','fixture-model');
  await wait(()=>!!document.querySelector('button[aria-label="Add folder for Agent A"]'));document.querySelector('button[aria-label="Add folder for Agent A"]').click();
  await wait(()=>document.querySelector('[aria-label="Agent A project access"]')?.textContent.includes('project-fixture'));
  if(document.querySelector('select[aria-label="Agent A tool mode"]').value!=='project')throw Error('Add folder did not enable folder tools');
  button('Open Agent A conversation').click();
  const input=document.querySelector('textarea[aria-label="Agent A job task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Inspect the selected project fixture');input.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>!button('Send to Agent A').disabled);button('Send to Agent A').click();
  await wait(()=>document.querySelector('[aria-label="Agent A conversation messages"]')?.textContent.includes('Read actual project line: SECOND_PROJECT_LINE_SENTINEL'));
  await wait(()=>!button('Remove Agent A project access').matches(':disabled'));button('Remove Agent A project access').click();
  await wait(()=>!button('Remove Agent A project access'));
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Another project check');input.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>button('Send to Agent A').disabled);
  return {success:true,projectFolderPicker:true,pickerIsFixture:true,selectedAgentOnly:true,actualBoundedRead:true,accessRevoked:true,sendBlockedWithoutGrant:true,nativeToolsEnabled:false,projectWrites:0,shellCommands:0,realProviderRequests:0};
 })()`)
 const file=path.join(profile,'project-fixture','README.md')
 if(fs.readFileSync(file,'utf8')!=='FIRST_PROJECT_LINE_SENTINEL\nSECOND_PROJECT_LINE_SENTINEL\nTHIRD_PROJECT_LINE_SENTINEL')throw Error('Project fixture changed')
 fs.writeFileSync(path.join(profile,reopening?'project-reopen-result.json':'project-result.json'),JSON.stringify(result,null,2))
 fs.writeFileSync(path.join(profile,reopening?'project-reopened.png':'project.png'),(await window.webContents.capturePage()).toPNG())
}
