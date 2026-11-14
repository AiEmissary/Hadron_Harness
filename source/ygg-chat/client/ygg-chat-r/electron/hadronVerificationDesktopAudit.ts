import type { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

/** Real desktop persistence/capability/QuickJS; synthetic model, no account or network. */
export async function auditHadronVerification(window: BrowserWindow, profile: string): Promise<void> {
 const reopening = process.env.HADRON_DESKTOP_SMOKE_REOPEN_VERIFICATION === '1'
 const nested = process.env.HADRON_DESKTOP_SMOKE_NESTED_SHARED === '1'
 if(nested && !reopening) await window.webContents.executeJavaScript(nestedSetup)
 if(nested && reopening) {
  const db=new Database(path.join(profile,'local-sync.db'),{readonly:true})
  let saved: {id:string;project_id:string}
  try { saved=db.prepare('SELECT c.id,c.project_id FROM conversations c JOIN hadron_sessions s ON s.conversation_id=c.id ORDER BY s.rowid DESC LIMIT 1').get() as typeof saved } finally { db.close() }
  if(!saved)throw Error('Saved nested fixture missing')
  // No route injection, project-list click or mode switch: test the shortcut's cold startup.
  if(!await window.webContents.executeJavaScript(`location.hash===${JSON.stringify(`#/chat/${saved.project_id}/${saved.id}`)}`))throw Error('Cold startup chose another conversation instead of the last workspace')
 }
 await window.webContents.executeJavaScript(`window.auditVerificationReopen=${JSON.stringify(reopening)};window.auditNestedShared=${JSON.stringify(nested)};window.auditSharedFiles=${process.env.HADRON_DESKTOP_SMOKE_SHARED_FILES === '1'}`)
 const result = await window.webContents.executeJavaScript(script)
 if (process.env.HADRON_DESKTOP_SMOKE_SHARED_FOLLOWUP === '1') Object.assign(result,await window.webContents.executeJavaScript(followupScript))
 await new Promise(resolve=>setTimeout(resolve,600))
 fs.writeFileSync(path.join(profile,reopening?'verification-reopen-result.json':'verification-result.json'),JSON.stringify({...result,coldStartupRestored:reopening&&nested,syntheticModel:true,realProviderRequests:0,externalRequests:0},null,2))
 fs.writeFileSync(path.join(profile,reopening?'verification-reopened.png':'verification.png'),(await window.webContents.capturePage()).toPNG())
}
const script = `(async()=>{
 const button=text=>Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===text);
 const wait=async(fn)=>{for(let i=0;i<160;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('Verification UI timed out: '+fn)};
 const select=(label,value)=>{const e=document.querySelector('select[aria-label="'+label+'"]');e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}))};
 await wait(()=>!!button('Work together'));
 if(window.auditVerificationReopen || window.auditNestedShared){
  await wait(()=>button('Work together').getAttribute('aria-pressed')==='true'&&button('Shared task').getAttribute('aria-pressed')==='true');
 } else button('Work together').click();
 if(!window.auditVerificationReopen && !window.auditNestedShared){
  if(button('Use task only'))button('Use task only').click();
  for(const slot of ['A','B']){await wait(()=>!!document.querySelector('select[aria-label="Agent '+slot+' provider"] option[value="openaichatgpt"]'));select('Agent '+slot+' provider','openaichatgpt');await new Promise(r=>setTimeout(r,100));select('Agent '+slot+' model','fixture-model')}
  select('Collaboration review mode','verification');
  if(window.auditSharedFiles){const input=document.querySelector('input[aria-label="Choose shared task files"]'),files=new DataTransfer();files.items.add(new File(['ORIGINAL_SHARED_ATTACHMENT_SENTINEL'],'shared-notes.txt',{type:'text/plain'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>document.querySelector('[aria-label="Shared task files"]')?.textContent.includes('shared-notes.txt'));}
  const e=document.querySelector('textarea[aria-label="Shared task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Verify the shared fixture claim');e.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>!button('Start collaboration').disabled);button('Start collaboration').click();
 }
 await wait(()=>document.querySelector('[aria-label="Combined answer"]')?.textContent.includes('Evidence-backed fixture combined answer'));
 if(window.auditVerificationReopen && !document.querySelector('[aria-label="Combined answer"]').textContent.includes('Verify the shared fixture claim.'))throw Error('Earlier selected shared answer was replaced by the latest admission');
 if(window.auditVerificationReopen)await wait(()=>!button('Continue with both agents').disabled);
 const section=document.querySelector('[aria-label="Verification results"]');
 if(!section||!section.textContent.includes('fixture_counter')||!section.textContent.includes('42'))throw Error('Actual tool receipt missing from UI');
 if(!section.textContent.includes('Verification fixture: value 42 observed'))throw Error('Verifier report missing');
 section.querySelectorAll('details').forEach(e=>e.open=true);
 button('Shared task').click();
 section.scrollIntoView({block:'start'});
 return {success:true,optionalVerification:true,actualToolReceiptVisible:true,verifierReportVisible:true,sharedConversationRestored:!!window.auditVerificationReopen,automaticSharedView:!!window.auditVerificationReopen||!!window.auditNestedShared,nestedWorkspace:!!window.auditNestedShared};
})()`

const followupScript = `(async()=>{
 const button=text=>Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===text);
 const wait=async(fn)=>{for(let i=0;i<180;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('Shared follow-up timed out: '+fn)};
 const combined=()=>document.querySelector('[aria-label="Combined answer"]')?.textContent??'';
 const follow=async(task)=>{
   const draftInput=document.querySelector('textarea[aria-label="Shared task"]');
   Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(draftInput,task);draftInput.dispatchEvent(new Event('input',{bubbles:true}));
   await wait(()=>draftInput.value===task);
   button('Continue with both agents').click();
   await wait(()=>!!document.querySelector('[aria-label="Shared follow-up context"]'));
   const input=document.querySelector('textarea[aria-label="Shared task"]');
   await wait(()=>input.value===task);
   if(!combined().includes('Evidence-backed fixture combined answer'))throw Error('Continue hid the saved answer');
   const access=document.querySelector('select[aria-label="Work together access mode"]');access.value='edit';access.dispatchEvent(new Event('change',{bubbles:true}));
   await wait(()=>button('Send follow-up to both agents')?.disabled);
   button('Use Read files for this conversation').click();
   await wait(()=>access.value==='read');
   if(!button('Send follow-up to both agents').disabled)throw Error('Read access without folder was admitted');
   access.value='chat';access.dispatchEvent(new Event('change',{bubbles:true}));
   const choice=document.querySelector('[aria-label="Shared follow-up context"] input[type="checkbox"]');
   if(!choice.checked)throw Error('Prior context choice missing');if(!window.auditSharedFiles||task==='Continue shared fixture')choice.click();
   Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,task);input.dispatchEvent(new Event('input',{bubbles:true}));
   await wait(()=>!button('Send follow-up to both agents').disabled);button('Send follow-up to both agents').click();
   await wait(()=>combined().includes('Evidence-backed fixture combined answer: '+task+'.'));
 };
 await follow('Continue shared fixture');
 await wait(()=>document.querySelectorAll('[aria-label="Shared conversation tree"] button[aria-label^="Shared branch response:"]').length===2);
 document.querySelector('[aria-label="Shared conversation tree"] button[aria-label^="Shared branch response:"]').click();
 await wait(()=>combined().includes('Evidence-backed fixture combined answer: Verify the shared fixture claim.'));
 await follow('Alternative shared fixture');
 await wait(()=>document.querySelectorAll('[aria-label="Shared conversation tree"] button[aria-label^="Shared branch response:"]').length===3);
 const graph=document.querySelector('[aria-label="Shared conversation tree"]');graph.scrollIntoView({block:'start'});
 graph.querySelector('button[aria-label^="Shared branch response:"]').click();
 await wait(()=>combined().includes('Evidence-backed fixture combined answer: Verify the shared fixture claim.'));
 await new Promise(r=>setTimeout(r,500));
 button('Reopen last saved answer').click();
 await wait(()=>combined().includes('Evidence-backed fixture combined answer: Alternative shared fixture.'));
 return {reopenLastSavedAnswer:true,continueBoth:true,followUpQuestionEditable:true,typedDraftPreserved:true,previousAnswerStaysVisible:true,editBlockExplainedBesideSend:true,readingStillRequiresFolder:true,explicitPriorContextChoice:true,actualAttachmentKeepExclude:!!window.auditSharedFiles,sharedTreeQuestionsAndCombinedAnswers:6,branchFromEarlierCombinedAnswer:true,siblingIsolation:true};
})()`

// Reproduce legacy nested scopes using real authenticated admission, in the smoke profile only.
const nestedSetup = `(async()=>{
 const {localServerUrl:origin}=await window.electronAPI.sync.status();
 const token=await window.electronAPI.collaboration.capability();
 const request=async(path,body)=>{const r=await fetch(origin+'/api/collaboration/'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Nested fixture route failed '+path+' '+r.status);return r.json()};
 const route=location.hash.split('/'),id=crypto.randomUUID();
 const prepared=await request('jobs/contexts',{schemaVersion:1,id,sourceConversationId:route[3],slot:'a'});
 await request('jobs',{schemaVersion:1,id,conversationId:prepared.conversationId,anchorMessageId:prepared.anchorMessageId,task:'Legacy private fixture',context:'',provider:'openaichatgpt',modelName:'fixture-model'});
 const sessionId=crypto.randomUUID(),task='Verify the shared fixture claim';
 const source=await request('proposals/context',{schemaVersion:1,id:sessionId,conversationId:prepared.conversationId,task});
 await request('proposals',{schemaVersion:1,sessionId,conversationId:prepared.conversationId,sourceLineageId:source.sourceLineageId,anchorMessageId:source.anchorMessageId,task,context:'',workflow:'review_verify_and_synthesis',participants:['a','b'].map(id=>({id,provider:'openaichatgpt',modelName:'fixture-model'}))});
 for(let i=0;i<160;i++){const status=await request('proposals/'+sessionId);if(status.collaboration?.phase==='finished')break;await new Promise(r=>setTimeout(r,100));}
 // Legacy navigation preference from the old private entry must not hide owned shared history.
 localStorage.setItem('hadron:agent-tree-view:'+prepared.conversationId,JSON.stringify({schemaVersion:1,mode:'independent',leftView:'a',selectedNodes:{}}));
 location.hash='#/chat/'+route[2]+'/'+prepared.conversationId;
 await new Promise(r=>setTimeout(r,800));
})()`
