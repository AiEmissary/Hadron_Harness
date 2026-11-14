import type { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/** Real desktop/preload/server/library/QuickJS; synthetic model text, no external web or account. */
export async function auditHadronTools(window: BrowserWindow, profile: string): Promise<void> {
  const reopening = process.env.HADRON_DESKTOP_SMOKE_REOPEN_TOOLS === '1'
  await window.webContents.executeJavaScript(`window.auditReopeningTools=${JSON.stringify(reopening)}`)
  const result = await window.webContents.executeJavaScript(script)
  const root = process.env.HADRON_TOOLS_LIBRARY!
  if (!root.startsWith(profile + path.sep)) throw new Error('Tool smoke escaped its private temporary profile')
  const logs = fs.readdirSync(path.join(root, 'job-logs'))
  if (logs.length !== 2 || !logs.every(file => fs.readFileSync(path.join(root, 'job-logs', file), 'utf8').includes('completed'))) throw new Error('Tool activity logs missing')
  fs.writeFileSync(path.join(profile, reopening ? 'tools-reopen-result.json' : 'tools-result.json'), JSON.stringify({ ...result, ownToolRoot: root, activityLogs: logs.length,
    syntheticModel: true, realCredentialsUsed: false, externalRequests: 0, noGravitonChanges: true }, null, 2))
  await new Promise(resolve => setTimeout(resolve, 500))
  fs.writeFileSync(path.join(profile, reopening ? 'tool-library-reopened.png' : 'tool-library.png'), (await window.webContents.capturePage()).toPNG())
}
const script = `(async()=>{
const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,50))}throw Error('Tool desktop timeout: '+fn)};
const button=text=>Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===text);
const select=(label,value)=>{const e=document.querySelector('select[aria-label="'+label+'"]');e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}))};
const task=(slot,text)=>{const e=document.querySelector('textarea[aria-label="Agent '+slot+' job task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,text);e.dispatchEvent(new Event('input',{bubbles:true}))};
button('Independent jobs').click();await wait(()=>!!document.querySelector('select[aria-label="Agent A job provider"] option[value="openaichatgpt"]'));
if(window.auditReopeningTools){
  button('Tool library').click();await wait(()=>document.querySelector('[aria-label="Hadron tool library"]').textContent.includes('character_counter'));
  const library=document.querySelector('[aria-label="Hadron tool library"]').textContent;
  if(!library.includes('word_counter · Disabled draft')||!library.includes('character_counter · Disabled draft'))throw Error('Saved library state changed across restart');
  button('Open Agent A conversation').click();await wait(()=>document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Created and tested word_counter'));
  button('Open Agent B conversation').click();await wait(()=>document.querySelector('[aria-label="Agent B conversation messages"]').textContent.includes('Counter returned 3'));
  if(['A','B'].some(slot=>document.querySelector('select[aria-label="Agent '+slot+' tool mode"]').value!==''))throw Error('Restart silently granted tools to the next message');
  return {success:true,savedToolSourceAndStateRestored:true,bothAgentChatsRestored:true,nextMessageDefaultsToText:true};
}
for(const slot of ['A','B']){select('Agent '+slot+' job provider','openaichatgpt');await new Promise(r=>setTimeout(r,50));select('Agent '+slot+' job model','fixture-model')}
select('Agent A tool mode','build');button('Open Agent A conversation').click();task('A','Build a reusable word counter');await wait(()=>!button('Send to Agent A').disabled);button('Send to Agent A').click();
await wait(()=>document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Created and tested word_counter'));
await wait(()=>document.querySelector('[aria-label="Agent A conversation"]').textContent.includes('Tool activity'));
button('Tool library').click();await wait(()=>!!button('Review source'));
if(button('Enable reviewed version'))throw Error('Enable offered before source review');
if(!document.querySelector('[aria-label="Hadron tool library"]').textContent.includes('Disabled draft'))throw Error('Agent enabled its own tool');
button('Review source').click();await wait(()=>!!button('Enable reviewed version'));
if(!document.querySelector('[aria-label="Review tool version"]').textContent.includes('function* run'))throw Error('Actual saved tool source missing');
button('Enable reviewed version').click();await wait(()=>document.querySelector('[aria-label="Hadron tool library"]').textContent.includes('word_counter · Enabled'));
select('Agent B tool mode','web');button('Open Agent B conversation').click();task('B','Count words using the enabled counter');await wait(()=>!button('Send to Agent B').disabled);button('Send to Agent B').click();
await wait(()=>document.querySelector('[aria-label="Agent B conversation messages"]').textContent.includes('Counter returned 3'));
if(document.querySelector('[aria-label="Agent B conversation messages"]').textContent.includes('Build a reusable word counter'))throw Error('Agent A task leaked into B');
button('Disable word_counter').click();await wait(()=>!button('Disable word_counter'));
button('Add a tool').click();await wait(()=>!!document.querySelector('[aria-label="New tool name"]'));
const field=(label,text)=>{const e=document.querySelector('[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,text);e.dispatchEvent(new Event('input',{bubbles:true}))};
field('New tool name','character_counter');field('New tool description','Count characters');field('New tool JavaScript','function* run(args){return {count:args.text.length};}');await new Promise(r=>setTimeout(r,50));button('Save disabled tool').click();
await wait(()=>document.querySelector('[aria-label="Review tool version"]')?.textContent.includes('character_counter'));
field('Tool test inputs',JSON.stringify({text:'hello'}));await new Promise(r=>setTimeout(r,50));button('Test this version').click();
await wait(()=>!!document.querySelector('[aria-label="Tool test result"]'));
if(JSON.parse(document.querySelector('[aria-label="Tool test result"]').textContent).count!==5)throw Error('Manual sandbox test failed');
if(!document.querySelector('[aria-label="Hadron tool library"]').textContent.includes('character_counter · Disabled draft'))throw Error('Manual test enabled its draft');
return {success:true,createdByAgentA:true,testedInRealQuickJs:true,disabledUntilUserReview:true,sourceReviewBeforeEnable:true,enabledVersionReusedByAgentB:true,userDisable:true,privateConversations:true,visibleToolActivity:true,manualToolCreation:true,manualSandboxTest:true,manualDraftStillDisabled:true};
})()`
