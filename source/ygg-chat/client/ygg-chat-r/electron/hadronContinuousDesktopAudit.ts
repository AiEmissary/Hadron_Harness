import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
export async function auditHadronContinuous(window:BrowserWindow,profile:string){
 const reopening=process.env.HADRON_DESKTOP_SMOKE_REOPEN_CONTINUOUS==='1'
 await window.webContents.executeJavaScript(`window.auditContinuousReopen=${reopening};window.auditContinueSaved=${process.env.HADRON_DESKTOP_SMOKE_CONTINUE_SAVED==='1'};window.auditMixed=${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'}`)
 const result=await window.webContents.executeJavaScript(`(async()=>{
 const button=text=>Array.from(document.querySelectorAll('button')).find(el=>el.textContent.trim()===text);
 const wait=async condition=>{for(let index=0;index<250;index++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Continuous UI timed out: '+condition)};
 const text=(label,value)=>{const el=document.querySelector('textarea[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))};
 const number=(label,value)=>{const el=document.querySelector('input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}))};
 const select=(label,value)=>{const el=document.querySelector('select[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))};
 const left=()=>document.querySelector('[data-continuous-chat="response"]'),tree=()=>document.querySelector('[data-continuous-chat="tree"]'),panel=()=>document.querySelector('[aria-label="Automatic conversation setup"]'),composer=()=>document.querySelector('[data-workflow-composer="continuous"]');
 if(window.auditContinuousReopen){
  await wait(()=>left()?.textContent.includes('REOPEN_CONTINUOUS_FIXTURE')&&left().textContent.includes('Agent B · turn 2'));
  if(button('Resume conversation')||button('Start automatic conversation'))throw Error('Historical session was automatically executable');
  if(!button('Continue this saved conversation'))throw Error('Saved continuation action missing');
  const savedSelect=document.querySelector('select[aria-label="Saved automatic conversations"]');
  const compactedOption=Array.from(savedSelect.options).find(option=>option.textContent.includes('AUTOMATIC_TWENTY_TURNS'));
  const originalSavedId=savedSelect.value;
  if(!compactedOption)throw Error('Compacted history missing on cold reopen');
  select('Saved automatic conversations',compactedOption.value);
  await wait(()=>left().textContent.includes('Conversation memory')&&left().textContent.includes('Agent B · turn 40'));
  if(!left().textContent.includes('Agent A · turn 1'))throw Error('Original reply missing after compaction/restart');
  select('Saved automatic conversations',originalSavedId);
  await wait(()=>left().textContent.includes('REOPEN_CONTINUOUS_FIXTURE')&&left().textContent.includes('Agent B · turn 2'));
  if(window.auditContinueSaved){
   button('Continue this saved conversation').click();
   await wait(()=>!!document.querySelector('textarea[aria-label="Continuation instruction"]'));
   text('Continuation instruction','Continue the existing plan and remember accessibility.');number('Conversation maximum turns',2);
   await wait(()=>!button('Start continuation').disabled);button('Start continuation').click();
   await wait(()=>left().textContent.includes('with 2 earlier replies')&&left().textContent.includes('Agent B · turn 2')&&composer().textContent.includes('turn budget'));
   if(tree().querySelectorAll('[aria-pressed]').length!==4)throw Error('Saved and fresh turn cards not preserved');
   if(!left().textContent.includes('Continue the existing plan and remember accessibility.'))throw Error('Continuation direction missing');
   return {success:true,explicitColdContinuation:true,compactedHistoryRestored:true,priorRepliesVisible:true,newTurnsCompleted:2,priorAndNewTurnCards:4,realProviderRequests:0};
  }
  return {success:true,savedConversationRestored:true,compactedHistoryRestored:true,orderedTurnsRestored:true,noInferenceReplay:true,historicalResumeUnavailable:true,continuedHistoryRestored:left().textContent.includes('with 2 earlier replies')};
 }
 button('Automatic conversation').click();
 await wait(()=>!!document.querySelector('select[aria-label="Conversation Agent A model"] option[value="fixture-model"]'));
 for(const role of ['A','B'])select('Conversation Agent '+role+' model','fixture-model');
 if(window.auditMixed){select('Conversation Agent B provider','claudecode');await wait(()=>!!document.querySelector('select[aria-label="Conversation Agent B model"] option[value="fixture-claude"]'));select('Conversation Agent B model','fixture-claude')}
 const start=async goal=>{text('Conversation goal',goal);await wait(()=>!button('Start automatic conversation').disabled);button('Start automatic conversation').click()};
 await start('AUTOMATIC_TWENTY_TURNS');
 await wait(()=>left()?.textContent.includes('Conversation memory')&&left()?.textContent.includes('Memory compaction · request 20')&&composer().textContent.includes('turn budget'));
 await wait(()=>document.querySelector('select[aria-label="Saved automatic conversations"] option:checked')?.textContent.endsWith('paused'));
 if(tree().querySelectorAll('[aria-pressed]').length!==20)throw Error('Turn cards missing');
 const bounds=[left(),tree(),panel()].map(el=>el.getBoundingClientRect());if(!(bounds[0].left<bounds[1].left&&bounds[1].left<bounds[2].left))throw Error('Continuous three-pane placement incorrect');
 text('Conversation user message','Remember accessibility.');button('Add at next turn').click();await wait(()=>left().textContent.includes('Remember accessibility.'));
 button('Resume conversation').click();await wait(()=>left().textContent.includes('Agent B · turn 40')&&composer().textContent.includes('turn budget'));
 button('New conversation').click();await wait(()=>!!button('Start automatic conversation'));
 await start('STOP_CONVERSATION_FIXTURE');await wait(()=>!!button('Pause after this turn'));
 await wait(()=>left()?.querySelector('[role="status"] .animate-spin')&&left().textContent.includes('Agent A is working on turn 1'));
 if(!left().textContent.includes('observed. This timer is not a progress estimate.'))throw Error('Elapsed work indicator missing');
 button('Pause after this turn').click();await wait(()=>composer().textContent.includes('pause requested'));
 button('Stop conversation').click();await wait(()=>composer().textContent.includes('stopped by user')&&!!button('New conversation'));
 if(left().querySelector('.animate-spin')||left().textContent.includes('Waiting for the confirmed response.'))throw Error('Stopped turn still displayed as working');
 button('New conversation').click();await wait(()=>!!button('Start automatic conversation'));
 number('Conversation maximum turns',2);await start('REOPEN_CONTINUOUS_FIXTURE');
 await wait(()=>left().textContent.includes('Agent B · turn 2')&&composer().textContent.includes('turn budget'));
 const openSaved=async goal=>{
  document.querySelector('button[aria-label="Open sidebar panel"]').click();
  const savedLink=()=>Array.from(document.querySelectorAll('[aria-label="Sidebar panel"] [aria-label="Saved automatic conversations"] button')).find(el=>el.textContent.includes(goal));
  await wait(()=>!!savedLink());savedLink().click();
  await wait(()=>left().textContent.includes(goal)&&!left().hidden&&!document.querySelector('[aria-label="Sidebar panel"]'));
 };
 button('Independent jobs').click();
 await openSaved('AUTOMATIC_TWENTY_TURNS');
 await wait(()=>left().textContent.includes('Agent B · turn 40')&&button('Automatic conversation').getAttribute('aria-pressed')==='true');
 await openSaved('REOPEN_CONTINUOUS_FIXTURE');
 await wait(()=>left().textContent.includes('Agent B · turn 2')&&!left().textContent.includes('Agent B · turn 40'));
 return {success:true,twentyBudgetedRequests:true,extendedToFortyRequests:true,compactedMemoryVisible:true,savedStatusMatchesLiveState:true,fullOriginalRepliesRetained:true,userInjectionAtBoundary:true,pauseAndStop:true,workingIndicatorAndElapsedTime:true,stoppedTurnNotWaiting:true,threePanePlacement:true,savedForColdReopen:true,sidebarSavedTaskLinks:true,sidebarSwitchesModeAndTranscript:true,sameWorkspaceTaskSwitch:true,realProviderRequests:0};
 })()`)
 fs.writeFileSync(path.join(profile,reopening?'continuous-reopen-result.json':'continuous-result.json'),JSON.stringify(result,null,2))
 fs.writeFileSync(path.join(profile,reopening?'continuous-reopened.png':'continuous.png'),(await window.webContents.capturePage()).toPNG())
}
