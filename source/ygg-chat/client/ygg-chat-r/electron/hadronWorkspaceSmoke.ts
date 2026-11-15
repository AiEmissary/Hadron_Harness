import {continuousFixturePacket} from './hadronContinuousFixture.js'
import './hadronBootstrap.js'
import {app,dialog} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {HadronCodexRuntime} from '../server/auth/hadronCodexRuntime.js'
import {ClaudeCodeRuntime} from '../server/headlessServer/providers/claudeCodeRuntime.js'
import {runHadronToolConversation} from '../server/hadronTools/types.js'

const profile=process.env.HADRON_DESKTOP_SMOKE_PROFILE
if(!profile||!path.basename(profile).startsWith('hadron-desktop-smoke-'))throw Error('An isolated desktop smoke profile is required')
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-workspace-code-'))
fs.writeFileSync(path.join(root,'calculator.cjs'),'exports.add=(a,b)=>a-b;\n')
fs.writeFileSync(path.join(root,'calculator.test.cjs'),"const {test}=require('node:test');const assert=require('node:assert/strict');const {add}=require('./calculator.cjs');test('negative operand',()=>assert.equal(add(-2,3),1));\n")
dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[root]})) as typeof dialog.showOpenDialog
let requests=0
let claudeConnected=true
HadronCodexRuntime.prototype.status=async()=>({installed:true,connected:true,reason:'ready',loginState:'idle'})
HadronCodexRuntime.prototype.models=async function(){this.allowedModels.add('fixture-model');return [{id:'fixture-model',label:'Fixture model'}]}
ClaudeCodeRuntime.prototype.status=async()=>({installed:true,connected:claudeConnected,version:'fixture',reason:claudeConnected?'ready':'signed_out',loginState:'idle'})
ClaudeCodeRuntime.prototype.models=async function(){if(!claudeConnected){this.allowedModels.clear();return []}this.allowedModels.add('fixture-claude');return [{id:'fixture-claude',label:'Fixture Claude'}] as any}
HadronCodexRuntime.prototype.generate=async function(input,emit){
 requests++
 if(process.env.HADRON_WORKSPACE_HISTORY_ONLY==='1')throw Error('A history read attempted inference')
 const packet=continuousFixturePacket(input.userContent)
 if(packet.kind==='continuous_conversation'){
  await new Promise(resolve=>setTimeout(resolve,40))
  if(process.env.HADRON_WORKSPACE_CONSENSUS_ONLY==='1')return {content:packet.consensus.peerProposal
   ?'I independently checked the conclusion and agree.\n'+packet.consensus.peerProposal.confirmMarker
   :'Conclusion: use the tested calculator fix.\n'+packet.consensus.proposeMarker}
  return {content:`Agent ${packet.speaker} turn ${packet.turn}: fixture peer reply.`}
 }
 if(input.hadronToolSession){
  const agent=input.hadronToolSession.execution==='agent';let step=0
  const content=await runHadronToolConversation({session:input.hadronToolSession,signal:input.signal!,task:input.userContent,generate:async protocol=>{
   const transcript=JSON.parse(protocol).transcript
   if(step++===0)return JSON.stringify({tool:agent?'read_file':'project_read',arguments:{path:'calculator.cjs'}})
   if(agent&&step===2)return JSON.stringify({tool:'edit_file',arguments:{path:'calculator.cjs',operation:'replace',searchPattern:'a-b',replacement:'a+b'}})
   if(agent&&step===3)return JSON.stringify({tool:'powershell',arguments:{command:'node --test calculator.test.cjs',description:'Run the disposable calculator test'}})
   if(agent&&!JSON.stringify(transcript).includes('negative operand'))throw Error('The actual fixture test result is missing')
   return JSON.stringify({answer:agent?'Fixed calculator.cjs and ran the negative operand test.':'Read calculator.cjs from the selected folder.'})
  }})
  emit?.({type:'chunk',part:'text',delta:content});return {content}
 }
 const content=packet.kind==='combined_answer_packet'?'Combined fixture answer from Agents A and B.':packet.kind==='cross_review_packet'?'Reviewed the other proposal.':'Fixture reply: '+packet.task
 emit?.({type:'chunk',part:'text',delta:content});return {content}
}
ClaudeCodeRuntime.prototype.generate=async function(input,emit){return HadronCodexRuntime.prototype.generate.call(this as any,input,emit)}
HadronCodexRuntime.prototype.usage=async()=>({reportedAt:new Date().toISOString(),windows:[{label:'Session',remainingPercent:80,resetsAt:null}],limited:false})
ClaudeCodeRuntime.prototype.usage=async()=>({reportedAt:new Date().toISOString(),windows:[{label:'5 hours',remainingPercent:93,resetsAt:null}],limited:false})
process.env.HADRON_USE_BUILT_RENDERER='1'
const watchdog=setTimeout(()=>{fs.writeFileSync(path.join(profile,'workspace-failure.json'),JSON.stringify({error:'Full workspace audit timed out'}));app.exit(1)},120000)
app.on('browser-window-created',(_event,window)=>{
 // This source-only fixture stays hidden and never changes the user's display,
 // cursor, desktop focus, installed profile, shortcuts, or installer.
 window.show=()=>{};window.showInactive=()=>{};window.focus=()=>{};window.maximize=()=>{}
 window.setSize(1440,940);window.webContents.setBackgroundThrottling(false)
 const errors:string[]=[]
 window.webContents.on('console-message',(_event,level,message)=>{if(level>=2)errors.push(message.slice(0,1200))})
 window.webContents.once('did-finish-load',()=>{
  void (async()=>{
   const run=(code:string)=>window.webContents.executeJavaScript(code)
   const audit=async(consensus=false)=>{
    const continuousEnd=consensus?'Consensus reached — both agents agree on this conclusion.':'Agent b turn 100: fixture peer reply.'
    const wait=async(test:()=>boolean)=>{for(let i=0;i<1200;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,50))}throw Error('Timed out: '+test)}
    const button=(label:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(element=>element.textContent?.trim()===label)
    const set=(label:string,value:string)=>{const field=document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;if(!field)throw Error('Missing '+label);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}))}
    const type=(value:string,label='Message')=>{const field=document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}))}
    const setup=async()=>{document.querySelector<HTMLButtonElement>('button[aria-label="Chat setup"]')!.click();await wait(()=>!!document.querySelector('[role="dialog"][aria-label="Chat setup"]'))}
    const send=async(text:string)=>{type(text);await wait(()=>!document.querySelector<HTMLButtonElement>('button[aria-label="Send"]')?.disabled);document.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click()}
    await wait(()=>!!document.querySelector('[data-unified-workspace]'))
    if(document.querySelector('[data-collaboration-dock]')||document.querySelector('#hadron-collaboration-workspace'))throw Error('The retired third pane is still mounted')
    if(document.querySelectorAll('textarea').length!==1)throw Error('Expected one composer')
    const route=location.hash
    await setup();await wait(()=>!!document.querySelector('select[aria-label="Agent A provider"] option[value="openaichatgpt"]'))
    set('Agent A provider','openaichatgpt');await wait(()=>!!document.querySelector('select[aria-label="Agent A model"] option[value="fixture-model"]'));set('Agent A model','fixture-model');button('Agent')!.click();await wait(()=>!!document.querySelector('[aria-label="Provider allowance"]')?.textContent?.includes('80% remaining'))
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    document.querySelector<HTMLButtonElement>('button[aria-label="Attach file or folder"]')!.click();await wait(()=>!!button('Attach folder'));button('Attach folder')!.click()
    await wait(()=>!!document.querySelector('.hadron-v2-folder'))
    await setup();if(button('Agent')?.getAttribute('aria-pressed')!=='true')throw Error('Attaching the folder changed Agent permission');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    await send('FIX_CALCULATOR');await wait(()=>document.querySelector('.hadron-v2-transcript')!.textContent!.includes('Fixed calculator.cjs and ran the negative operand test.'));await wait(()=>!!document.querySelector('button[aria-label="Send"]'))
    await wait(()=>!!document.querySelector('.hadron-v2-activity')?.textContent?.includes('Run PowerShell command'))
    await setup();set('Work type','together');button('Chat')!.click();await wait(()=>!!document.querySelector('select[aria-label="Agent B provider"]'))
    set('Agent B provider','claudecode');await wait(()=>!!document.querySelector('select[aria-label="Agent B model"] option[value="fixture-claude"]'));set('Agent B model','fixture-claude');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    await send('SHARED_WORKSPACE_FIXTURE');await wait(()=>document.querySelector('.hadron-v2-transcript')!.textContent!.includes('Combined fixture answer from Agents A and B.'));await wait(()=>!!document.querySelector('button[aria-label="Send"]'))
    await setup();set('Work type','individual:b');await wait(()=>!!button('Agent B'));button('Agent B')!.click();await wait(()=>document.querySelector<HTMLSelectElement>('select[aria-label="Agent B model"]')?.value==='fixture-claude')
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    if(!document.querySelector('.hadron-v2-transcript')?.textContent?.includes('Combined fixture answer from Agents A and B.')||!document.querySelector('.hadron-v2-folder'))throw Error('Shared-to-B handover lost its transcript or folder')
    await send('SINGLE_B_HANDOVER_FIXTURE');await wait(()=>!!Array.from(document.querySelectorAll('.hadron-v2-message-text')).at(-1)?.textContent?.includes('Read calculator.cjs from the selected folder.'));await wait(()=>!!document.querySelector('button[aria-label="Send"]'))
    await setup();set('Work type','together');set('Work type','individual:a');await wait(()=>document.querySelector<HTMLSelectElement>('select[aria-label="Agent A model"]')?.value==='fixture-model')
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    if(!document.querySelector('.hadron-v2-transcript')?.textContent?.includes('Combined fixture answer from Agents A and B.'))throw Error('Returning to Agent A lost the shared discussion')
    await setup();set('Work type','continuous');await wait(()=>!!document.querySelector('input[aria-label="Conversation turns"]'))
    const turns=document.querySelector<HTMLInputElement>('input[aria-label="Conversation turns"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(turns,'100');turns.dispatchEvent(new Event('input',{bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    await send('CONTINUOUS_WORKSPACE_FIXTURE');await wait(()=>document.querySelector('.hadron-v2-transcript')!.textContent!.includes(continuousEnd));await wait(()=>!!document.querySelector('button[aria-label="Send"]'))
    if(consensus&&document.querySelector('.hadron-v2-transcript')!.textContent!.includes('HADRON_CONSENSUS'))throw Error('Consensus control metadata leaked into the transcript')
    const rightClick=(element:Element)=>element.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:240,clientY:250}))
    rightClick(document.querySelector('.hadron-v2-message-text')!);await wait(()=>!!document.querySelector('[aria-label="Conversation selection actions"]'));button('Copy into a new chat')!.click()
    await wait(()=>!!document.querySelector('select[aria-label="Destination project"]'));set('Destination project','new');await wait(()=>!!document.querySelector('input[aria-label="New project name"]'))
    for(const [label,text] of [['New project name','Workspace transfer test'],['New chat name','Copied conclusions']]){const input=document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}))}
    await new Promise(resolve=>setTimeout(resolve,100));button('Copy and open')!.click();await wait(()=>location.hash!==route&&!!document.querySelector('[data-unified-workspace]')&&!document.querySelector('dialog[open]'))
    if(!document.querySelector('.hadron-v2-transcript')!.textContent!.includes('FIX_CALCULATOR'))throw Error('The copied selection did not open in the new project')
    const copiedRoute=location.hash
    await setup();button('Agent B')!.click();await wait(()=>document.querySelector('button[aria-label="Agent and model setup"]')?.textContent?.includes('Agent B')===true);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(location.hash!==copiedRoute||!document.querySelector('.hadron-v2-transcript')!.textContent!.includes('FIX_CALCULATOR'))throw Error('Choosing B abandoned the imported selection')
    location.hash=route;await wait(()=>location.hash===route&&document.querySelector('.hadron-v2-transcript')?.textContent?.includes(continuousEnd)===true)
    rightClick(document.querySelectorAll('.hadron-v2-message-text')[1]);await wait(()=>!!document.querySelector('[aria-label="Conversation selection actions"]'));button('Copy into chat or project')!.click()
    await wait(()=>!!document.querySelector('select[aria-label="Destination project"]'))
    const project=Array.from(document.querySelector<HTMLSelectElement>('select[aria-label="Destination project"]')!.options).find(option=>option.text==='Workspace transfer test')!;set('Destination project',project.value);await wait(()=>!!document.querySelector('select[aria-label="Destination chat"]'))
    const chat=Array.from(document.querySelector<HTMLSelectElement>('select[aria-label="Destination chat"]')!.options).find(option=>option.text==='Copied conclusions')!;set('Destination chat',chat.value);await new Promise(resolve=>setTimeout(resolve,100));button('Copy and open')!.click();await wait(()=>location.hash===copiedRoute&&!document.querySelector('dialog[open]'))
    await wait(()=>document.querySelectorAll('article[data-message-id]').length===2)
    return {route,copiedRoute,oneComposer:true,twoPanes:true,providerAllowanceVisible:true,activityDropdown:true,sharedToSingleBContinues:true,directSingleAgentChoice:true,realNativeAgentEditAndTest:true,sharedAnswer:true,...(consensus?{continuousConsensus:true}:{continuous100Turns:true}),copyToNewNamedProject:true,secondCopyAppended:true,importCanContinueWithB:true}
   }
   if(process.env.HADRON_WORKSPACE_HISTORY_ONLY==='1'){
    const target=JSON.parse(fs.readFileSync(path.join(profile,'history-target.json'),'utf8'))
    await run(`(async()=>{for(let i=0;i<400;i++){if(document.querySelector('[data-unified-workspace]')&&!document.querySelector('[data-hadron-entry]'))return;await new Promise(r=>setTimeout(r,50))}throw Error('Initial copied-profile startup did not finish')})()`)
    await run(`location.hash=${JSON.stringify('#/chat/'+target.projectId+'/'+target.chatId)};void 0`)
    const result=await run(`(async()=>{for(let i=0;i<500;i++){if(document.querySelector('[data-unified-workspace]')&&document.querySelectorAll('.hadron-v2-tree-node').length>0&&!document.querySelector('[role="alert"]')){await new Promise(r=>setTimeout(r,600));return {oneComposer:document.querySelectorAll('textarea').length===1,transcriptMessages:document.querySelectorAll('article[data-message-id]').length,treeNodes:document.querySelectorAll('.hadron-v2-tree-node').length}}await new Promise(r=>setTimeout(r,50))}throw Error('The cloned saved workspace did not open')})()`)
    if(!result.oneComposer||!result.treeNodes||requests)throw Error('Cloned history or inference-free opening failed')
    fs.writeFileSync(path.join(profile,'workspace-result.json'),JSON.stringify({success:true,clonedSavedHistory:true,...result,syntheticProviderRequests:requests,realProviderRequests:0,isolatedProfile:profile},null,2));clearTimeout(watchdog);app.exit(0);return
   }
   const result=await run(`(${audit.toString()})(${process.env.HADRON_WORKSPACE_CONSENSUS_ONLY==='1'})`)
   if(result.continuousConsensus&&requests!==9)throw Error('Consensus did not stop after two replies')
   if(!fs.readFileSync(path.join(root,'calculator.cjs'),'utf8').includes('a+b'))throw Error('The actual source file was not changed')
   await new Promise(resolve=>setTimeout(resolve,500))
   const bookmarks=JSON.parse(fs.readFileSync(path.join(profile,'remembered-project-folders.json'),'utf8'))
   const bookmark=bookmarks[0];if(!bookmark)throw Error('Selected folder was not saved natively')
   const restored=await run(`window.electronAPI.collaboration.projectRestore(${JSON.stringify(bookmark.workspace)},${JSON.stringify(bookmark.slot)})`)
   if(restored?.label!==root)throw Error('Native folder restore returned the wrong project')
   const before=requests
   await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.webContents.reload()})
   await run(`(async()=>{for(let i=0;i<300;i++){if(document.querySelectorAll('article[data-message-id]').length===2)return;await new Promise(r=>setTimeout(r,50))}throw Error('Saved copied chat did not reopen')})()`)
   if(requests!==before)throw Error('Reopening dispatched inference')
   await run(`(async()=>{document.querySelector('button[aria-label="Chat setup"]').click();for(let i=0;i<200;i++){const card=Array.from(document.querySelectorAll('h3')).find(el=>el.textContent==='Claude')?.parentElement;if(card?.textContent.includes('Connected using your'))return;await new Promise(r=>setTimeout(r,50))}throw Error('Connected Claude card did not appear')})()`)
   claudeConnected=false
   await run(`(async()=>{window.dispatchEvent(new Event('focus'));for(let i=0;i<200;i++){const card=Array.from(document.querySelectorAll('h3')).find(el=>el.textContent==='Claude')?.parentElement;const choice=document.querySelector('option[value="claudecode"]');if(card?.textContent.includes('Not connected')&&choice?.disabled)return;await new Promise(r=>setTimeout(r,50))}throw Error('Claude disconnect left stale connected controls')})()`)
   claudeConnected=true
   await run(`(async()=>{window.dispatchEvent(new Event('focus'));for(let i=0;i<200;i++){const card=Array.from(document.querySelectorAll('h3')).find(el=>el.textContent==='Claude')?.parentElement;const choice=document.querySelector('option[value="claudecode"]');if(card?.textContent.includes('Connected using your')&&choice&&!choice.disabled){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return}await new Promise(r=>setTimeout(r,50))}throw Error('Claude reconnect did not refresh controls')})()`)
   await run(`(async()=>{for(let i=0;i<100;i++){if(document.querySelector('.titlebar-project-name')?.textContent.trim()==='Workspace transfer test')break;await new Promise(r=>setTimeout(r,50))}for(const el of document.querySelectorAll('.hadron-desktop-workspace button,.hadron-desktop-workspace textarea')){if(parseFloat(getComputedStyle(el).borderTopWidth)>0)throw Error('A decorative border remains in the live workspace')}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,100))})()`)
   fs.writeFileSync(path.join(profile,'workspace.png'),(await window.webContents.capturePage()).toPNG())
   fs.writeFileSync(path.join(profile,'workspace-result.json'),JSON.stringify({...result,success:true,reloadWithoutInference:true,connectionStatusRefresh:true,nativeFolderRestored:true,syntheticProviderRequests:requests,realProviderRequests:0,isolatedProfile:profile,fixtureProject:root,rendererErrors:errors},null,2))
   clearTimeout(watchdog);app.exit(0)
  })().catch(async error=>{
   fs.writeFileSync(path.join(profile,'workspace-failure.json'),JSON.stringify({error:String(error),stack:error.stack,rendererErrors:errors,requests},null,2))
   try{fs.writeFileSync(path.join(profile,'failure.txt'),await window.webContents.executeJavaScript('document.body.innerText'));fs.writeFileSync(path.join(profile,'failure.png'),(await window.webContents.capturePage()).toPNG())}catch{}
   clearTimeout(watchdog);app.exit(1)
  })
 })
})
void import('./main.js')
