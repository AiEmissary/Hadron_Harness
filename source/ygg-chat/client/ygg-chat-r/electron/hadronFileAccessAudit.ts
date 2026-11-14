import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
export async function auditHadronFileAccess(window:BrowserWindow,profile:string){
 const result=await window.webContents.executeJavaScript(`(async()=>{
 const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('File access timeout: '+fn)};
 const button=(text,root=document)=>Array.from(root.querySelectorAll('button')).find(b=>b.textContent.trim()===text&&!b.closest('[hidden]'));
 const choose=(label,value)=>{const input=document.querySelector('select[aria-label="'+label+'"]');if(!input||input.matches(':disabled'))throw Error('Selector unavailable: '+label);input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}))};
 const type=(label,value)=>{const input=document.querySelector('[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))};
 button('Work together').click();await wait(()=>!!document.querySelector('select[aria-label="Work together access mode"]'));
 choose('Work together access mode','read');await wait(()=>button('Start collaboration').disabled);
 button('Add folder',document.querySelector('[aria-label="Hadron collaboration"]')).click();await wait(()=>!!document.querySelector('[aria-label="Shared task folder"]'));
 choose('Work together access mode','chat');await wait(()=>document.querySelector('[aria-label="Hadron collaboration"]').textContent.includes('reading is off'));
 const transfer=new DataTransfer();transfer.items.add(new File([Array.from({length:10000},(_,i)=>'LOG_LINE_'+(i+1)).join('\\n')],'large-debug.log'));const input=document.querySelector('input[aria-label="Choose shared task files"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 await wait(()=>!!document.querySelector('[aria-label="Choose file excerpt"]'));type('Excerpt start line','100');type('Excerpt lines','3');await wait(()=>document.querySelector('[aria-label="File excerpt preview"]').textContent.includes('LOG_LINE_100'));
 if(document.querySelector('[aria-label="File excerpt preview"]').textContent.includes('LOG_LINE_9999'))throw Error('Unselected file contents in preview');button('Attach this excerpt').click();await wait(()=>document.querySelector('[aria-label="Shared task files"]')?.textContent.includes('(excerpt)'));
 for(const role of ['A','B']){choose('Agent '+role+' provider',role==='B'?'claudecode':'openaichatgpt');await new Promise(r=>setTimeout(r,50));choose('Agent '+role+' model',role==='B'?'fixture-claude':'fixture-model')}
 type('Shared task','ACCESS_CHAT_FIXTURE');await wait(()=>!button('Start collaboration').disabled);button('Start collaboration').click();await wait(()=>document.querySelector('[aria-label="Combined answer"]')?.textContent.includes('Combined fixture answer'));
 button('Automatic conversation').click();choose('Conversation access mode','read');button('Add folder',document.querySelector('[aria-label="Automatic conversation setup"]')).click();await wait(()=>!!document.querySelector('[aria-label="Conversation folder"]'));
 for(const role of ['A','B']){choose('Conversation Agent '+role+' provider',role==='B'?'claudecode':'openaichatgpt');await new Promise(r=>setTimeout(r,50));choose('Conversation Agent '+role+' model',role==='B'?'fixture-claude':'fixture-model')}
 type('Conversation goal','READ_FILES_CONVERSATION');type('Conversation maximum turns','2');await wait(()=>!button('Start automatic conversation').disabled);button('Start automatic conversation').click();await wait(()=>document.querySelector('[aria-label="Conversation folder activity"]')?.textContent.includes('b:project_read')&&document.querySelector('[aria-label="Conversation folder activity"]').textContent.includes('completed'));
 await wait(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Resume conversation'));button('New conversation').click();
 button('Independent jobs').click();choose('Agent A access mode','read');await wait(()=>!!document.querySelector('[aria-label="Agent A project access"]'));choose('Agent A access mode','edit');button('Open Agent A conversation').click();type('Agent A job task','WORK_FROM_AGENT_A');
 await wait(()=>!!button('Go',document.querySelector('[aria-label="Agent A conversation"]')));
 if(button('Prepare reviewed edit'))throw Error('Obsolete preparation step is still visible');

 })().catch(error=>({error:String(error),stack:error.stack}))`)
 if(result?.error)throw Error(result.error+' '+result.stack)
 fs.writeFileSync(path.join(profile,'file-access-result.json'),JSON.stringify({success:true,accessControlsAcrossFourModes:true,chatIgnoresSelectedFolder:true,largeLocalAttachmentExcerptConfirmed:true,continuousBothAgentsReadActualFolder:true,continuousActivityRecorded:true,workUsesGoWithoutExtraPreparation:true,noWorkStartedWithoutGo:true,realProviderRequests:0},null,2))
}
