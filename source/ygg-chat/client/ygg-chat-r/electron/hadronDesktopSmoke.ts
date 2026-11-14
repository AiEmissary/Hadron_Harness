import {continuousFixturePacket} from './hadronContinuousFixture.js'
import {auditHadronConversationWork} from './hadronConversationWorkAudit.js'
import {IndependentJobContexts} from '../server/headlessServer/services/collaboration/independentJobContexts.js'
import {IndependentJobsRepo} from '../server/headlessServer/persistence/independentJobsRepo.js'
import { auditHadronSettingsScroll } from './hadronSettingsScrollAudit.js'
import { auditHadronAppearance } from './hadronAppearanceAudit.js'
import {createHash} from 'node:crypto'
import './hadronBootstrap.js'
import { app,dialog } from 'electron'
import { auditHadronProject } from './hadronProjectDesktopAudit.js'
import {auditHadronSharedFolder} from './hadronSharedFolderAudit.js'
import {auditHadronProviderChoices} from './hadronProviderChoicesAudit.js'
import {auditHadronFileAccess} from './hadronFileAccessAudit.js'
import {auditHadronProjectBuild} from './hadronProjectBuildDesktopAudit.js'
import {auditHadronContinuous} from './hadronContinuousDesktopAudit.js'
import {auditHadronEntry} from './hadronEntryDesktopAudit.js'
import os from 'node:os'
import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { HadronCodexRuntime } from '../server/auth/hadronCodexRuntime.js'
import {ClaudeCodeRuntime} from '../server/headlessServer/providers/claudeCodeRuntime.js'
import {WindowsOwnedWorkerHost} from '../server/auth/windowsOwnedWorker.js'
import {captureOwnedProcess} from '../server/auth/hadronOwnedProcess.js'
import {executionStartup} from '../server/hadronTools/executionStartup.js'
import { auditHadronSettings } from './hadronSettingsAudit.js'
import { auditHadronVerification } from './hadronVerificationDesktopAudit.js'
import { HadronToolLibrary } from '../server/hadronTools/toolLibrary.js'
import { auditHadronTools } from './hadronToolDesktopAudit.js'
import { isHadronToolSession, runHadronToolConversation } from '../server/hadronTools/types.js'
const profile = process.env.HADRON_DESKTOP_SMOKE_PROFILE
const fixtureApprovalTitles:string[]=[]
if (!profile) throw new Error('Explicit desktop smoke profile required')
if(process.env.HADRON_DESKTOP_SMOKE_CONTINUOUS==='1')dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync
if(process.env.HADRON_DESKTOP_SMOKE_BUILD==='1'){
 const quit=app.quit.bind(app)
 app.quit=()=>{fs.appendFileSync(path.join(profile,'fixture-quit-trace.txt'),new Error('Fixture Quit requested').stack+'\n');quit()}
}
if(process.env.HADRON_DESKTOP_SMOKE_BUILD==='1'){
 dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync
 if(process.env.HADRON_DESKTOP_SMOKE_APPLY_BUILD==='1'||process.env.HADRON_DESKTOP_SMOKE_AUTO_BUILD==='1')dialog.showMessageBox=(async(_window:any,options:any)=>{fixtureApprovalTitles.push(options.title);return {response:1,checkboxChecked:false}}) as typeof dialog.showMessageBox
 if(process.env.HADRON_DESKTOP_SMOKE_REOPEN_BUILD!=='1'){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-build-fixture-'))
  fs.writeFileSync(path.join(root,'calculator.js'),'export function add(a, b) { return a - b }\n')
  if(process.env.HADRON_DESKTOP_SMOKE_FOLDER_BUILD==='1'){fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','nested.js'),'export const folderNeedle = 1\n')}
  fs.writeFileSync(path.join(root,'README.md'),'A disposable calculator fixture.\n')
  fs.writeFileSync(path.join(root,'calculator.test.mjs'),"import {test} from 'node:test';import assert from 'node:assert/strict';import {add} from './calculator.js';test('adds negative numbers',()=>assert.equal(add(-2,3),1));\n")
  fs.writeFileSync(path.join(root,'build.mjs'),"import fs from 'node:fs';import {add} from './calculator.js';if(add(-2,3)!==1)process.exit(1);fs.writeFileSync('build-result.txt','CALCULATOR_BUILD_OK');console.log('CALCULATOR_BUILD_OK');\n")
  fs.writeFileSync(path.join(profile,'build-fixture.json'),JSON.stringify({root}))
  let sourcePicks=0
  dialog.showOpenDialog=(async(_window:any,options:any)=>({canceled:false,filePaths:['Choose a Node build script','Optional: choose a Node build script (Cancel for tests only)'].includes(options.title)?[path.join(root,'build.mjs')]:['Choose Node test files','Choose Node tests for build/test/fix'].includes(options.title)?[path.join(root,'calculator.test.mjs')]:options.properties.includes('openDirectory')?[root]:
    ++sourcePicks===1?[path.join(root,'calculator.js')]:sourcePicks===2?[path.join(root,'README.md')]:[path.join(root,'calculator.js'),path.join(root,'README.md')]})) as typeof dialog.showOpenDialog
 }
}
if(process.env.HADRON_DESKTOP_SMOKE_PROJECT==='1'&&process.env.HADRON_DESKTOP_SMOKE_REOPEN_PROJECT!=='1'){
 const directory=process.env.HADRON_DESKTOP_SMOKE_TOOL_MARKUP==='1'?fs.mkdtempSync(path.join(os.tmpdir(),'hadron-folder-choice-fixture-')):path.join(profile,'project-fixture');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'README.md'),'FIRST_PROJECT_LINE_SENTINEL\nSECOND_PROJECT_LINE_SENTINEL\nTHIRD_PROJECT_LINE_SENTINEL')
 if(process.env.HADRON_DESKTOP_SMOKE_SHARED_FOLDER==='1'){fs.mkdirSync(path.join(directory,'src'));fs.writeFileSync(path.join(directory,'src/value.ts'),'export const marker = "SHARED_FOLDER_SENTINEL"\n')}
 dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[directory]})) as typeof dialog.showOpenDialog
}
const jobFixture = process.env.HADRON_DESKTOP_SMOKE_JOBS === '1'
const fixtureRequests: Array<{ task: string; kind?: string; proposals?: unknown[]; reviews?: unknown[]; context?: string; conversationHistory?: Array<{role: string; content: string}> }> = []
let fixtureClaudeCalls=0
let fixtureProvidersConnected=true
if (jobFixture) {
  if(process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'){
    ClaudeCodeRuntime.prototype.status=async()=>({installed:true,version:'2.1.318',connected:fixtureProvidersConnected,reason:'ready',loginState:'idle'})
    ClaudeCodeRuntime.prototype.models=async function(){if(!fixtureProvidersConnected)return [];this.allowedModels.add('fixture-claude');if(process.env.HADRON_DESKTOP_SMOKE_HELPERS==='1')this.allowedModels.add('fixture-haiku');return [{id:'fixture-claude',label:'Fixture Claude'},...(process.env.HADRON_DESKTOP_SMOKE_HELPERS==='1'?[{id:'fixture-haiku',label:'Fixture Haiku'}]:[])] as any}
    ClaudeCodeRuntime.prototype.generate=async function(input,emit){if(!['fixture-claude','fixture-haiku'].includes(input.modelName))throw Error('Wrong Claude fixture model');fixtureClaudeCalls++;return HadronCodexRuntime.prototype.generate.call(this as any,input,emit)}
  }
  // Test entry only: real main/preload/server/SQLite/UI, synthetic inference.
  HadronCodexRuntime.prototype.status = async () => ({ installed: true, connected: fixtureProvidersConnected, reason: 'ready', loginState: 'idle' })
  HadronCodexRuntime.prototype.models = async function () { this.allowedModels.add('fixture-model'); if(process.env.HADRON_DESKTOP_SMOKE_HELPERS==='1')this.allowedModels.add('fixture-luna');return [{ id: 'fixture-model', label: 'Fixture model' },...(process.env.HADRON_DESKTOP_SMOKE_HELPERS==='1'?[{id:'fixture-luna',label:'Fixture lightweight'}]:[])] }
  HadronCodexRuntime.prototype.generate = async function (input, emit) {
    if (input.requestPolicy !== 'single_attempt' || input.tools?.length || !input.systemPrompt?.includes('Hadron worker contract')) throw new Error('Wrong fixture admission')
    const packet = continuousFixturePacket(input.userContent); fixtureRequests.push(packet)
    if(packet.task==='ACCESS_CHAT_FIXTURE'){
      if(input.hadronToolSession)throw Error('Chat-only mode inherited folder access')
      if(!packet.kind&&(!input.userContent.includes('LOG_LINE_100')||input.userContent.includes('LOG_LINE_9999')))throw Error('Attachment excerpt not honored')
    }
    if(process.env.HADRON_DESKTOP_SMOKE_SECOND_OPINION==='1'&&packet.task?.startsWith('Give a quick, independent second opinion'))await new Promise(resolve=>setTimeout(resolve,800))
    if(packet.kind==='project_proposal'&&packet.task==='FOLDER_SEARCH_FIXTURE'){
      if(!input.hadronToolSession||!isHadronToolSession(input.hadronToolSession))throw Error('Folder project session missing')
      let turn=0
      const content=await runHadronToolConversation({session:input.hadronToolSession,task:input.userContent,signal:input.signal!,generate:async(protocol)=>{
        const transcript=JSON.parse(protocol).transcript
        if(turn++===0)return JSON.stringify({tool:'project_search',arguments:{query:'folderNeedle'}})
        if(turn===2){if(!JSON.stringify(transcript).includes('src/nested.js'))throw Error('Nested search result missing');return JSON.stringify({tool:'project_read',arguments:{path:'src/nested.js'}})}
        return JSON.stringify({summary:'Update the file discovered by folder search.',changes:[{path:'src/nested.js',expectedHash:transcript.at(-1).content.result.sha256,text:'export const folderNeedle = 2\n'}]})
      }})
      return {content}
    }
    if(packet.kind==='hadron_helper'){if(input.hadronToolSession||!['fixture-luna','fixture-haiku'].includes(input.modelName))throw Error('Helper nested or wrong model');return {content:'Helper extracted: A and B.'}}
    if(packet.kind==='continuous_memory'){if(input.hadronToolSession||input.tools?.length)throw Error('Memory unexpectedly has tools');return {content:'Saved memory: continue evidence-based discussion; retain accessibility and unresolved questions. Source replies '+packet.transcript.map((turn:any)=>turn.turn).join(', ')} }
    if(packet.kind==='continuous_conversation'){
      if(packet.goal==='READ_FILES_CONVERSATION'){
        if(!input.hadronToolSession||!isHadronToolSession(input.hadronToolSession))throw Error('Conversation read permission missing')
        let turn=0
        const content=await runHadronToolConversation({session:input.hadronToolSession,task:input.userContent,signal:input.signal!,generate:async protocol=>{
          const transcript=JSON.parse(protocol).transcript
          if(turn++===0)return JSON.stringify({tool:'project_search',arguments:{query:'SECOND_PROJECT_LINE_SENTINEL'}})
          if(turn===2)return JSON.stringify({tool:'project_read',arguments:{path:'README.md',startLine:2,maxLines:1}})
          if(!JSON.stringify(transcript).includes('SECOND_PROJECT_LINE_SENTINEL'))throw Error('Conversation missed actual read evidence')
          return JSON.stringify({answer:'Agent '+packet.speaker+' turn '+packet.turn+': SECOND_PROJECT_LINE_SENTINEL read; no edits or tests.'})
        }})
        return {content}
      }
      if(input.hadronToolSession||input.tools?.length)throw Error('Continuous turn unexpectedly has tools')
      if(packet.goal==='STOP_CONVERSATION_FIXTURE'){
        await new Promise<void>(resolve=>{if(input.signal?.aborted)resolve();else input.signal?.addEventListener('abort',()=>resolve(),{once:true})})
        const error=Error('Fixture stopped');error.name='AbortError';throw error
      }
      if(packet.goal==='AUTOMATIC_TWENTY_TURNS'&&packet.userMessages.length&&packet.userMessages[0]?.text!=='Remember accessibility.')throw Error('Continuous injection missing')
      const text=`Agent ${packet.speaker} turn ${packet.turn}: responding to the supplied peer history.`
      emit?.({type:'chunk',part:'text',delta:text});return {content:text}
    }
    if(packet.kind==='project_proposal'&&packet.task?.startsWith('SIMPLE_WORK_NATIVE')){
      if(!input.hadronToolSession)throw Error('Conversation work lost folder tools')
      let turn=0
      const content=await runHadronToolConversation({session:input.hadronToolSession,task:input.userContent,signal:input.signal!,generate:async protocol=>{
        const transcript=JSON.parse(protocol).transcript
        fixtureRequests.push({task:packet.task,kind:'tool_model_request'})
        const step=turn++;if(packet.task==='SIMPLE_WORK_NATIVE B'){if(step===0)return JSON.stringify({tool:'project_search',arguments:{query:'add',mode:'content'}});if(step===1)return JSON.stringify({summary:'No source hashes were supplied yet',changes:[]});if(step===2){if(!JSON.stringify(transcript).includes('HOST PROTOCOL CORRECTION'))throw Error('No source-read correction');return JSON.stringify({tool:'project_read',arguments:{path:'calculator.js'}})}}else if(step===0)return JSON.stringify({tool:'project_read',arguments:{path:'calculator.js'}})
        const result=transcript.at(-1).content.result
        if(!result.sha256)throw Error('Coding work did not read actual source')
        return JSON.stringify({summary:'Change calculator using the selected discussion.',changes:[{path:'calculator.js',expectedHash:result.sha256,text:'export function add(a, b) { return a + b }\n'+'// '+packet.task+'\n'}]})
      }})
      return {content}
    }
    if(packet.kind==='project_proposal'||packet.kind==='project_review'){
      if(input.hadronToolSession||input.tools?.length)throw Error('Project draft unexpectedly has tools')
      if(packet.task==='STOP_BUILD_FIXTURE'){
        await new Promise<void>(resolve=>{if(input.signal?.aborted)resolve();else input.signal?.addEventListener('abort',()=>resolve(),{once:true})})
        const error=new Error('Fixture stopped');error.name='AbortError';throw error
      }
      if(packet.task==='EMPTY_PROPOSAL_FIXTURE'){
        const text=JSON.stringify({summary:'No usable changes supplied.',changes:[]})
        emit?.({type:'chunk',part:'text',delta:text});return {content:text}
      }
      const text=JSON.stringify(packet.kind==='project_proposal'?{summary:'Propose correcting calculator addition. Tests have not run.',changes:[{path:'calculator.js',expectedHash:packet.evidence[0].hash,text:packet.task.startsWith('REOPEN_BUILD_FIXTURE AUTO_REPAIR_FIXTURE')&&!packet.task.includes('Repair the recorded')?'export function add(a, b) { return a + b + 1 }\n':'export function add(a, b) { return a + b }\n'}]}:
        {snapshotHash:packet.snapshot.snapshotHash,verdict:'approve',text:'Reviewed the exact calculator diff. Addition now uses plus. Tests have not run.'})
      emit?.({type:'chunk',part:'text',delta:text});return {content:text}
    }
    if (input.hadronToolSession) {
      if (!isHadronToolSession(input.hadronToolSession)) throw new Error('Untrusted tool fixture capability')
      let turn = 0
      const answer = await runHadronToolConversation({ session: input.hadronToolSession, task: input.userContent, signal: input.signal!,
        generate: async text => {
          const transcript = JSON.parse(text).transcript, result = transcript.at(-1)?.content?.result
          fixtureRequests.push({ task: packet.task, kind: 'tool_model_request' }); turn++
          if(['SIMPLE_WORK_DISCUSSION','SIMPLE_WORK_FOLLOWUP'].includes(packet.task)){if(turn===1)return JSON.stringify({tool:'project_read',arguments:{path:packet.task==='SIMPLE_WORK_DISCUSSION'?'README.md':'calculator.js'}});if(!result?.text)throw Error('Conversation folder was lost');if(packet.task==='SIMPLE_WORK_FOLLOWUP'&&!result.text.includes('a + b'))throw Error('Coding result not visible to continuing agent');return JSON.stringify({answer:packet.task==='SIMPLE_WORK_DISCUSSION'?'Calculator discussion: fix subtraction to addition.':'Addition verified from current file. Continue this work.'})}
          if(packet.task==='XML_TOOL_NATIVE'){
            if(turn===1)return '<invoke name="project_read"><parameter name="path">README.md</parameter></invoke>';
            if(turn===2){if(!JSON.stringify(transcript).includes('HOST PROTOCOL CORRECTION'))throw Error('Missing native markup correction');return JSON.stringify({tool:'project_read',arguments:{path:'README.md'}})}
            if(!result?.text?.includes('SECOND_PROJECT_LINE_SENTINEL'))throw Error('Actual file evidence missing');
            return JSON.stringify({answer:'Read the selected README successfully. SECOND_PROJECT_LINE_SENTINEL was observed. No edits or tests.'})
          }
          if(packet.task==='LIMITED_RESEARCH_NATIVE'){
            if(!packet.kind||turn===1)return JSON.stringify({tool:'project_read',arguments:{path:'README.md'}})
            return JSON.stringify({answer:'Cross-review: the proposals contain limited evidence only; uninspected files and conclusions remain uncertain.'})
          }
          if(packet.task==='SHARED_FOLDER_NATIVE'){
            if(turn===1)return JSON.stringify({tool:'project_search',arguments:{query:'marker'}})
            if(turn===2){if(!result?.matches?.some((item:any)=>item.path==='src/value.ts'))throw Error('Shared recursive folder search failed');return JSON.stringify({tool:'project_read',arguments:{path:'src/value.ts'}})}
            if(!result?.text?.includes('SHARED_FOLDER_SENTINEL')||!result.sha256)throw Error('Shared bounded file read failed')
            return JSON.stringify({answer:'SHARED_FOLDER_SENTINEL observed in src/value.ts; hash '+result.sha256+'. No edits or tests.'})
          }
          if(packet.task==='HELPER_DESKTOP_FIXTURE'){if(turn===1)return JSON.stringify({tool:'helper_analyse',arguments:{task:'Extract names',context:'A and B are names.'}});if(result?.result!=='Helper extracted: A and B.'||!['fixture-luna','fixture-haiku'].includes(result.model))throw Error('Actual helper result missing');return JSON.stringify({answer:'Parent used actual helper: '+result.result})}
          if(packet.task==='Inspect the selected project fixture'){
            if(turn===1)return JSON.stringify({tool:'project_list',arguments:{path:''}})
            if(turn===2){if(!result?.entries.some((entry:any)=>entry.name==='README.md'))throw Error('Project listing missing');return JSON.stringify({tool:'project_read',arguments:{path:'README.md',startLine:2,maxLines:1}})}
            if(result?.text!=='SECOND_PROJECT_LINE_SENTINEL'||!result.sha256)throw Error('Actual project read missing')
            return JSON.stringify({answer:'Read actual project line: '+result.text+'. Read-only; no edits or commands.'})
          }
          if (packet.kind === 'verification_packet') {
            if (turn === 1) return JSON.stringify({ tool: 'fixture_counter', arguments: { text: 'fixture' } })
            if (result?.value !== 42) throw Error('Verification sandbox result missing')
            return JSON.stringify({ answer: 'Verification fixture: value 42 observed using the enabled sandbox tool; no web or project tests performed.' })
          }
          if (packet.task === 'Build a reusable word counter') {
            if (turn === 1) return JSON.stringify({ tool: 'tool_create', arguments: { definition: { name: 'word_counter', description: 'Count whitespace-separated words', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } }, code: "function* run(args){return {count:args.text.trim().split(/\\s+/).filter(Boolean).length};}" } })
            if (turn === 2) return JSON.stringify({ tool: 'tool_test', arguments: { name: 'word_counter', hash: result.hash, arguments: { text: 'one two three' } } })
            if (result?.count !== 3) throw new Error('Actual tool test failed')
            return JSON.stringify({ answer: 'Created and tested word_counter; disabled until you review and enable it.' })
          }
          if (turn === 1) return JSON.stringify({ tool: 'word_counter', arguments: { text: 'one two three' } })
          if (result?.count !== 3) throw new Error('Enabled tool reuse failed')
          return JSON.stringify({ answer: 'Counter returned 3 using the enabled tool.' })
        } })
      emit?.({ type: 'chunk', part: 'text', delta: answer }); return { content: answer }
    }
    if(packet.kind==='combined_answer_packet'&&packet.task==='SHARED_FOLDER_NATIVE'){
      if(!JSON.stringify(packet.proposals).includes('SHARED_FOLDER_SENTINEL')||!JSON.stringify(packet.reviews).includes('SHARED_FOLDER_SENTINEL'))throw Error('Combined answer missing folder findings')
      if(packet.verification&&!packet.hostEvidence?.receipts.some((item:any)=>item.tool==='project_read'))throw Error('Folder verification evidence missing')
      return {content:'Combined: SHARED_FOLDER_SENTINEL observed by both agents. No project files changed; no tests run.'}
    }
    const text = packet.kind === 'combined_answer_packet' && ['Verify the shared fixture claim','Continue shared fixture','Alternative shared fixture'].includes(packet.task) ? (() => {
      const full = packet as any
      if (!full.verification?.text.includes('value 42 observed') || !full.hostEvidence?.receipts.some((item: any) => item.tool === 'fixture_counter' && item.result.includes('42'))) throw Error('Synthesis missed actual host evidence')
      if(process.env.HADRON_DESKTOP_SMOKE_SHARED_FILES==='1' && !!packet.context?.includes('ORIGINAL_SHARED_ATTACHMENT_SENTINEL') !== (packet.task !== 'Continue shared fixture')) throw Error('Previous attached file context was incorrectly retained or excluded')
      if (packet.task !== 'Verify the shared fixture claim' && (!packet.context?.includes('Verify the shared fixture claim') || !packet.context?.includes('Evidence-backed fixture combined answer') || packet.context?.includes('Continue shared fixture'))) throw Error('Shared continuation context missing or includes a sibling')
      return 'Evidence-backed fixture combined answer: ' + packet.task + '. Value 42. Confidence limited to the fixture tool result; no project tests.'
    })() : packet.kind === 'combined_answer_packet' ? 'Combined fixture answer. Remaining disagreements: timing needs verification.' :
      packet.kind === 'cross_review_packet' ? `Fixture cross-review for ${packet.recipientId}: retain uncertainty about timing.` : `Fixture response for ${packet.task}`
    emit?.({ type: 'chunk', part: 'text', delta: text }); return { content: text }
  }
}
process.env.HADRON_USE_BUILT_RENDERER = '1'
app.on('browser-window-created', (_event, window) => {
  window.webContents.on('did-finish-load', () => {
    const entryCheck=(process.env.HADRON_DESKTOP_SMOKE_BUILD==='1'||process.env.HADRON_DESKTOP_SMOKE_SETTINGS_SCROLL==='1')?auditHadronEntry(window,profile):Promise.resolve()
    // Observe immediately, and report through the existing smoke failure path.
    void entryCheck.catch(()=>{})
    setTimeout(() => {
      void entryCheck.then(()=>window.webContents.executeJavaScript(`JSON.stringify({title:document.title,route:location.hash,text:document.body.innerText.slice(0,5000),desktopBridge:!!window.electronAPI,
        workspaceVisible:!!document.getElementById('hadron-collaboration-workspace')?.offsetWidth,
        workspaceBeside:(()=>{const a=document.querySelector('[data-existing-chat-area]')?.getBoundingClientRect(),b=document.querySelector('[data-collaboration-dock]')?.getBoundingClientRect();return !!a&&!!b&&b.left>=a.right-1})()})`))
        .then(async (result: string) => {
          const state = JSON.parse(result)
          state.startedMaximized=window.isMaximized()
          if(process.env.HADRON_DESKTOP_SMOKE_BUILD==='1'&&!state.startedMaximized)throw Error('Hadron did not start maximized')
          const endpoint = await window.webContents.executeJavaScript(`window.electronAPI.sync.status().then(s=>({port:s.localServerPort,url:s.localServerUrl}))`)
          if (!endpoint.port || endpoint.port >= 3002 && endpoint.port <= 3015) throw new Error('Hadron is competing for a legacy Graviton port')
          state.separateServerPort = endpoint.port
          const subscriptions = await window.webContents.executeJavaScript(`Promise.all([window.electronAPI.collaboration.codexStatus(),window.electronAPI.collaboration.claudeStatus()]).then(([codex,claude])=>({codexInstalled:codex.installed,claudeInstalled:claude.installed,separateSubscriptionProfile:!codex.connected&&!claude.connected}))`)
          Object.assign(state, subscriptions)
          const database = new Database(path.join(profile, 'local-sync.db'), { readonly: true })
          try { state.ownDatabaseProject = !!database.prepare('SELECT id FROM projects WHERE id = ?').get(state.route.split('/')[2]) }
          finally { database.close() }
          fs.writeFileSync(path.join(profile, 'desktop-result.json'), JSON.stringify(state, null, 2))
          if (!state.desktopBridge || !state.route.startsWith('#/chat/') || state.text.includes('Sign in to Graviton')) throw new Error('Hadron did not enter its local chat workspace')
          if (!state.workspaceVisible || !state.workspaceBeside) throw new Error('Default Hadron agent workspace is missing or not beside chat/tree')
          if (!state.ownDatabaseProject) throw new Error('Displayed project is not in this Hadron profile database')
          if (!state.codexInstalled || !state.claudeInstalled || (!jobFixture && !state.separateSubscriptionProfile)) throw new Error('Vendor engines unavailable or fresh smoke profile reused an account')
          return window.webContents.capturePage()
        }).then(async image => {
          fs.writeFileSync(path.join(profile, 'desktop.png'), image.toPNG())
          if(process.env.HADRON_DESKTOP_SMOKE_CONVERSATION_WORK==='1'){const result=await auditHadronConversationWork(window,profile);fs.writeFileSync(path.join(profile,'conversation-work-result.json'),JSON.stringify(result,null,2));app.quit();return}
          if(process.env.HADRON_DESKTOP_SMOKE_TOOL_MARKUP==='1'){
            await window.webContents.executeJavaScript(`(async()=>{const wait=async fn=>{for(let i=0;i<160;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('Native markup timeout: '+fn)};const button=text=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===text&&!b.closest('[hidden]'));const choose=(label,value)=>{const s=document.querySelector('select[aria-label="'+label+'"]');s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}))};button('Independent jobs').click();choose('Agent A job provider','claudecode');await new Promise(r=>setTimeout(r,80));choose('Agent A job model','fixture-claude');button('Open Agent A conversation').click();const folder=Array.from(document.querySelector('[aria-label="Agent A conversation"]').querySelectorAll('button')).find(b=>b.textContent==='Add folder');choose('Agent A access mode','edit');folder.click();await wait(()=>!!document.querySelector('[aria-label="Agent A attached folder"]'));if(document.querySelector('select[aria-label="Agent A access mode"]').value!=='edit')throw Error('Adding a folder overwrote reviewed access');choose('Agent A access mode','read');await wait(()=>document.querySelector('select[aria-label="Agent A access mode"]').value==='read');const input=document.querySelector('textarea[aria-label="Agent A job task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'XML_TOOL_NATIVE');input.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>!button('Send to Agent A').disabled);button('Send to Agent A').click();await wait(()=>document.querySelector('[aria-label="Agent A job response"]')?.textContent.includes('SECOND_PROJECT_LINE_SENTINEL'));if(document.querySelector('[aria-label="Agent A job response"]').textContent.includes('<invoke'))throw Error('Raw invocation accepted as answer');await wait(()=>!!button('Regenerate answer')&&!button('Regenerate answer').disabled);choose('Agent A access mode','edit');button('Regenerate answer').click();await wait(()=>document.querySelector('textarea[aria-label="Agent A job task"]').value==='XML_TOOL_NATIVE');if(!document.querySelector('[aria-label="Agent A attached folder"]')||document.querySelector('select[aria-label="Agent A access mode"]').value!=='read')throw Error('Regeneration cleared current folder/access');await wait(()=>!button('Send to Agent A').disabled);choose('Agent A access mode','chat');choose('Agent A access mode','read');await wait(()=>!button('Send to Agent A').disabled);if(!document.querySelector('[aria-label="Agent A attached folder"]'))throw Error('Access switch cleared folder');button('Work together').click();choose('Work together access mode','edit');Array.from(document.querySelector('[aria-label="Hadron collaboration"]').querySelectorAll('button')).find(b=>b.textContent==='Add folder').click();await wait(()=>!!document.querySelector('[aria-label="Shared task folder"]'));if(document.querySelector('select[aria-label="Work together access mode"]').value!=='edit')throw Error('Shared folder overwrote access');button('Automatic conversation').click();choose('Conversation access mode','edit');Array.from(document.querySelector('[aria-label="Automatic conversation setup"]').querySelectorAll('button')).find(b=>b.textContent==='Add folder').click();await wait(()=>!!document.querySelector('[aria-label="Conversation folder"]'));if(document.querySelector('select[aria-label="Conversation access mode"]').value!=='edit')throw Error('Automatic conversation folder overwrote access');button('Build a project').click();for(const slot of ['A','B']){choose('Project Agent '+slot+' provider','openaichatgpt');await new Promise(r=>setTimeout(r,50));choose('Project Agent '+slot+' model','fixture-model')}for(const label of ['Project goal','Project deliverables']){const field=document.querySelector('textarea[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Preserve project instructions');field.dispatchEvent(new Event('input',{bubbles:true}))}button('Choose project folder').click();await wait(()=>document.querySelector('[aria-label="Build a project"]').textContent.includes('Project:'));if(document.querySelector('textarea[aria-label="Project goal"]').value!=='Preserve project instructions')throw Error('Build folder lost goal/access');await wait(()=>!button('Go').disabled);})()`)
            if(fixtureRequests.length!==4)throw Error('Unexpected native markup request count: '+fixtureRequests.length)
            fs.writeFileSync(path.join(profile,'tool-markup-result.json'),JSON.stringify({success:true,claudeFixture:true,rawMarkupNotExecuted:true,hostProtocolCorrection:true,actualSelectedFileRead:true,finalAnswerReadable:true,originalBudgetUnchanged:true,addFolderPreservesReviewedAccess:true,readActionBesideQuestion:true,regenerateKeepsCurrentFolder:true,accessSwitchKeepsFolder:true,sendEnabledWithReadGrant:true,sharedAndAutomaticAccessPreserved:true,buildFolderKeepsGoalModelsAndReviewedAccess:true,buildProposalReady:true,realProviderRequests:0},null,2));app.quit();return
          }
          if(process.env.HADRON_DESKTOP_SMOKE_RESEARCH_LIMIT==='1'){
            await window.webContents.executeJavaScript(`(async()=>{const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('Research-limit native timeout: '+fn)};const button=text=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===text&&!b.closest('[hidden]'));const choose=(name,value)=>{const s=document.querySelector('select[aria-label="'+name+'"]');s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}))};button('Work together').click();button('Add folder').click();await wait(()=>!!document.querySelector('[aria-label="Shared task folder"]'));for(const slot of ['A','B']){choose('Agent '+slot+' provider',slot==='B'?'claudecode':'openaichatgpt');await new Promise(r=>setTimeout(r,50));choose('Agent '+slot+' model',slot==='B'?'fixture-claude':'fixture-model')}const task=document.querySelector('textarea[aria-label="Shared task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(task,'LIMITED_RESEARCH_NATIVE');task.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>!button('Start collaboration').disabled);button('Start collaboration').click();await wait(()=>document.querySelector('[aria-label="Combined answer"]')?.textContent.includes('Proposals and cross-review complete'));await wait(()=>!!document.querySelector('[aria-label="Partial research warning"]'));await wait(()=>!document.querySelector('[aria-label="Agent A branches"]').textContent.includes('history could not be loaded'));})()`)
            if(fixtureRequests.length!==25)throw Error('Research-limit request budget changed: '+fixtureRequests.length)
            fs.writeFileSync(path.join(profile,'research-limit-result.json'),JSON.stringify({success:true,modelsKeptResearchingThroughLastRequest:true,sevenOperationsThenFinalOnly:true,budgetNotIncreased:true,partialEvidencePreserved:true,bothPeerReviewsCompleted:true,combinedAnswerCompleted:true,partialWarningVisible:true,historyRefreshesAtTerminal:true,realProviderRequests:0},null,2));app.quit();return
          }
          if(process.env.HADRON_DESKTOP_SMOKE_FILE_ACCESS==='1'){await auditHadronFileAccess(window,profile);if(fixtureRequests.length!==7)throw Error('Access workflow sent unexpected requests: '+fixtureRequests.length);app.quit();return}
          if(process.env.HADRON_DESKTOP_SMOKE_PROVIDER_CHOICES==='1'){await auditHadronProviderChoices(window,profile,value=>{fixtureProvidersConnected=value});if(fixtureRequests.length)throw Error('Changing provider choices sent inference');app.quit();return}
          if(process.env.HADRON_DESKTOP_SMOKE_SETTINGS_SCROLL==='1'){await auditHadronSettingsScroll(window,profile);if(fixtureRequests.length)throw Error('Settings scrolling sent inference');app.exit(0);return}
          if(process.env.HADRON_DESKTOP_SMOKE_APPEARANCE==='1'){await auditHadronAppearance(window,profile);if(fixtureRequests.length)throw Error('Appearance sent inference');app.exit(0);return}
          if(process.env.HADRON_DESKTOP_SMOKE_CONTINUOUS==='1'){
            await auditHadronContinuous(window,profile)
            if(fixtureRequests.length!==(process.env.HADRON_DESKTOP_SMOKE_REOPEN_CONTINUOUS==='1'?(process.env.HADRON_DESKTOP_SMOKE_CONTINUE_SAVED==='1'?2:0):43))throw Error('Automatic conversation request count changed')
            if(process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'&&process.env.HADRON_DESKTOP_SMOKE_REOPEN_CONTINUOUS!=='1'&&fixtureClaudeCalls!==21)throw Error('Mixed conversation did not dispatch21 actual Claude adapter calls')
            app.quit();return
          }
          if(process.env.HADRON_DESKTOP_SMOKE_BUILD==='1'){
            await auditHadronProjectBuild(window,profile)
            if(fixtureRequests.length!==(process.env.HADRON_DESKTOP_SMOKE_REOPEN_BUILD==='1'?0:process.env.HADRON_DESKTOP_SMOKE_AUTO_BUILD==='1'?4:process.env.HADRON_DESKTOP_SMOKE_APPLY_BUILD==='1'?2:process.env.HADRON_DESKTOP_SMOKE_FOLDER_BUILD==='1'?2:6))throw Error('Project build request count changed')
            if(process.env.HADRON_DESKTOP_SMOKE_AUTO_BUILD==='1'){
              if(fixtureApprovalTitles.filter(title=>title==='Approve bounded build/test/fix run').length!==1||fixtureApprovalTitles.length!==1)throw Error('Automation required unexpected additional approval')
              fs.writeFileSync(path.join(profile,'automation-approval-result.json'),JSON.stringify({oneScopeApproval:true,noPerRepairPrompts:true,additionalAIRequests:2}))
            }
            if(process.env.HADRON_DESKTOP_SMOKE_NATIVE_EVIDENCE==='1'&&process.env.HADRON_DESKTOP_SMOKE_REOPEN_BUILD!=='1'){
              const host=new WindowsOwnedWorkerHost(path.join(process.env.HADRON_DESKTOP_SMOKE_APP_DIR!,'vendor','hadron-worker'),profile,executionStartup.workerEpochId())
              const local=await host.run({executable:process.execPath,args:['-e','process.stdout.write("native-evidence-fixture")'],cwd:profile,
                env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,ELECTRON_RUN_AS_NODE:'1'},
                consume:child=>{const result=captureOwnedProcess(child,{timeout:10000});child.stdin.end();return result}})
              if(local.code!==0||local.text!=='native-evidence-fixture'||host.inspect().state!=='active')throw Error('Native evidence fixture failed')
              fs.writeFileSync(path.join(profile,'native-evidence-fixture.json'),JSON.stringify({epoch:executionStartup.workerEpochId(),sameActualDesktopOwner:true,localProcessOnly:true}))
            }
            const endpoint=await window.webContents.executeJavaScript('window.electronAPI.sync.status()')
            const idleSocket=new WebSocket(`ws://127.0.0.1:${endpoint.localServerPort}/ide-context`)
            await new Promise<void>((resolve,reject)=>{idleSocket.once('open',resolve);idleSocket.on('error',reject)})
            fs.writeFileSync(path.join(profile,'build-quit-socket.json'),JSON.stringify({unregisteredIdleSocketConnected:true}))
            app.quit();return
          }
          if(process.env.HADRON_DESKTOP_SMOKE_PROJECT==='1'){
            if(process.env.HADRON_DESKTOP_SMOKE_SHARED_FOLDER==='1'){await auditHadronSharedFolder(window,profile,()=>fixtureRequests.length);app.exit(0);return}
            await auditHadronProject(window,profile)
            if(process.env.HADRON_DESKTOP_SMOKE_REOPEN_PROJECT==='1'?fixtureRequests.length!==0:fixtureRequests.filter(item=>item.kind==='tool_model_request').length!==3)throw Error('Project request accounting mismatch')
            app.exit(0);return
          }
          if (process.env.HADRON_DESKTOP_SMOKE_VERIFICATION === '1') {
            if (process.env.HADRON_DESKTOP_SMOKE_REOPEN_VERIFICATION !== '1') {
              const principal = await window.webContents.executeJavaScript('window.electronAPI.auth.status()')
              if (!principal.user?.id) throw Error('Fixture owner unavailable')
              const library = new HadronToolLibrary(process.env.HADRON_TOOLS_LIBRARY!)
              const tool = library.create(principal.user.id, 'fixture', { name: 'fixture_counter', description: 'Return fixture observation', inputSchema: { type: 'object', properties: {text:{type:'string'}}, required:['text'] } }, 'function* run(args){return {value:42};}')
              library.enable(principal.user.id, tool.definition.name, tool.hash)
            }
            await auditHadronVerification(window, profile)
            const reopening = process.env.HADRON_DESKTOP_SMOKE_REOPEN_VERIFICATION === '1'
            if (fixtureRequests.filter(input => input.kind === 'tool_model_request').length !== (reopening ? 0 : process.env.HADRON_DESKTOP_SMOKE_SHARED_FOLLOWUP === '1' ? 6 : 2) || fixtureRequests.filter(input => input.kind === 'cross_review_packet').length !== (reopening ? 0 : process.env.HADRON_DESKTOP_SMOKE_SHARED_FOLLOWUP === '1' ? 6 : 2)) throw Error('Verification request accounting mismatch')
            app.exit(0); return
          }
          if (process.env.HADRON_DESKTOP_SMOKE_TOOLS === '1') {
            await auditHadronTools(window, profile)
            if (fixtureRequests.filter(input => input.kind === 'tool_model_request').length !== (process.env.HADRON_DESKTOP_SMOKE_REOPEN_TOOLS === '1' ? 0 : 5)) throw new Error('Tool request accounting changed')
            app.exit(0); return
          }
          if (process.env.HADRON_DESKTOP_SMOKE_SETTINGS === '1') {
            await auditHadronSettings(window, profile)
            app.exit(0); return
          }
          if (jobFixture) {
            const run = (code: string) => window.webContents.executeJavaScript(code)
            const wait = async (condition: string) => { for (let i = 0; i < 100; i++) { if (await run(condition)) return; await new Promise(resolve => setTimeout(resolve, 100)) }; throw new Error('Job UI fixture timed out: ' + condition) }
            if(process.env.HADRON_DESKTOP_SMOKE_SAVED_HISTORY==='1'){
            const workspaceRoute=await run('location.hash') as string
            const ownDb=new Database(path.join(profile,'local-sync.db'),{readonly:true})
            const newProject=ownDb.prepare('SELECT user_id FROM conversations WHERE id=?').get(workspaceRoute.split('/')[3]) as any
            ownDb.close();const requestsBeforeReopening=fixtureRequests.length
            const historicalId='hadron-proposal-'+createHash('sha256').update(JSON.stringify([newProject.user_id,'proposal:missing-historical-session:a'])).digest('hex')
            const historyDb=new Database(path.join(profile,'local-sync.db'))
            historyDb.transaction(()=>{
              historyDb.prepare("INSERT INTO conversations(id,project_id,user_id,title,storage_mode) VALUES (?,?,?,'Historical saved proposal','local')").run(historicalId,workspaceRoute.split('/')[2],newProject.user_id)
              const meta=JSON.stringify({hadronSharedProposal:{ownerId:newProject.user_id,sessionId:'missing-historical-session',participant:'a',sourceRunId:'old-missing-run'}})
              historyDb.prepare("INSERT INTO messages(id,conversation_id,parent_id,children_ids,role,content,plain_text_content,meta) VALUES ('old-history-question',?,NULL,?,'user','Earlier saved question','Earlier saved question',?)").run(historicalId,JSON.stringify(['old-history-answer']),meta)
              historyDb.prepare("INSERT INTO messages(id,conversation_id,parent_id,children_ids,role,content,plain_text_content,meta) VALUES ('old-history-answer',?,'old-history-question','[]','assistant','Historical answer retained without its session ledger','Historical answer retained without its session ledger',?)").run(historicalId,meta)
              historyDb.prepare("INSERT INTO lineages(id,conversation_id,root_message_id,head_message_id,status) VALUES ('old-history-lineage',?,'old-history-question','old-history-answer','active')").run(historicalId)
              historyDb.prepare("UPDATE messages SET lineage_id='old-history-lineage' WHERE conversation_id=?").run(historicalId)
            })();historyDb.close()
            await run(`location.hash=${JSON.stringify('#/chat/'+workspaceRoute.split('/')[2]+'/'+historicalId)}`)
            await wait(`document.querySelector('[data-chat-pane-surface]')?.textContent.includes('Historical answer retained without its session ledger')&&document.body.textContent.includes('original agent-session record is no longer available')`)
            await new Promise(resolve=>setTimeout(resolve,250))
            if(!await run(`Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Main chat'&&button.getAttribute('aria-pressed')==='true')`))throw Error('Historical recovery did not select Main chat')
            if(fixtureRequests.length!==requestsBeforeReopening)throw Error('Opening historical messages dispatched inference')
            fs.writeFileSync(path.join(profile,'historical-chat-opened.png'),(await window.webContents.capturePage()).toPNG())
            fs.writeFileSync(path.join(profile,'jobs-result.json'),JSON.stringify({success:true,orphanedProposalHistoryOpened:true,mainChatSelected:true,noOldJobsRecreated:true,historyReopenRequests:0,realProviderRequests:0},null,2))
            app.exit(0);return
            }
            await run(`window.smokeButton=text=>Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===text);window.smokeSelect=(label,value)=>{const el=document.querySelector('select[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))};window.smokeTask=(label,value)=>{const el=document.querySelector('textarea[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))};smokeButton('Independent jobs').click()`)
            await wait(`!!document.querySelector('select[aria-label="Agent A job provider"] option[value="openaichatgpt"]')`)
            if(process.env.HADRON_DESKTOP_SMOKE_SECOND_OPINION==='1'){
              for(const slot of ['A','B']){
                await run(`smokeSelect('Agent ${slot} job provider','openaichatgpt')`)
                await wait(`!!document.querySelector('select[aria-label="Agent ${slot} job model"] option[value="fixture-model"]')`)
                await run(`smokeSelect('Agent ${slot} job model','fixture-model')`)
              }
              await run(`smokeButton('Open Agent A conversation').click();smokeTask('Agent A job task','Second opinion original question')`)
              await wait(`!smokeButton('Send to Agent A').disabled`);await run(`smokeButton('Send to Agent A').click()`)
              await wait(`!!Array.from(document.querySelectorAll('[aria-label="Agent A conversation messages"] button')).find(e=>e.textContent==='Get a second opinion')`)
              await run(`smokeTask('Agent A job task','UNSENT ORIGINAL DRAFT');window.opinionRoute=location.hash;window.opinionNavigation=localStorage.getItem('hadron:agent-tree-view:'+document.getElementById('hadron-collaboration-workspace').dataset.collaborationConversation);smokeButton('Get a second opinion').click()`)
              await wait(`!!document.querySelector('dialog[open]')`)
              await wait(`!smokeButton('Evaluate with Agent B').disabled`)
              if(fixtureRequests.length!==1)throw Error('Opening opinion auto-dispatched')
              await run(`smokeButton('Evaluate with Agent B').click()`)
              await wait(`document.querySelector('dialog[open] [role="status"]')?.textContent.includes('is evaluating the answer')`)
              await wait(`document.querySelector('[aria-label="Second opinion evaluation"]')?.textContent.includes('Fixture response for Give a quick')`)
              await wait(`document.querySelector('dialog[open]')?.textContent.includes('Evaluation completed.')`)
              fs.writeFileSync(path.join(profile,'second-opinion.png'),(await window.webContents.capturePage()).toPNG())
              await run(`smokeButton('Close and continue with Agent A').click()`)
              await wait(`!document.querySelector('dialog[open]')`)
              if(!await run(`location.hash===window.opinionRoute&&document.querySelector('[aria-label="Agent A job task"]').value==='UNSENT ORIGINAL DRAFT'&&localStorage.getItem('hadron:agent-tree-view:'+document.getElementById('hadron-collaboration-workspace').dataset.collaborationConversation)===window.opinionNavigation`))throw Error('Opinion changed original branch or draft')
              await run(`smokeButton('Get a second opinion').click()`);await wait(`!!document.querySelector('[aria-label="Second opinion evaluation"]')`)
              if(Number(fixtureRequests.length)!==2)throw Error('Opinion reopened with duplicate inference')
              await run(`smokeButton('Close and continue with Agent A').click()`)
              const evaluation=fixtureRequests[1]
              if(!evaluation.context?.includes('Fixture response for Second opinion original question')||evaluation.conversationHistory)throw Error('Evaluation snapshot missing or peer history shared')
              fs.writeFileSync(path.join(profile,'second-opinion-result.json'),JSON.stringify({success:true,clearPopup:true,waitingStatus:true,otherAgentEvaluation:true,originalBranchAndDraftPreserved:true,savedEvaluationReopensWithoutInference:true,textSnapshotOnly:true,syntheticRequests:2,realProviderRequests:0},null,2));app.exit(0);return
            }
            if (process.env.HADRON_DESKTOP_SMOKE_REOPEN === '1') {
              await wait(`!!smokeButton('All workspace chats')`)
              const savedScopeRestored = await run(`(()=>{const id=document.getElementById('hadron-collaboration-workspace').dataset.collaborationConversation;const saved=JSON.parse(localStorage.getItem('hadron:agent-tree-view:'+id));return smokeButton(saved.treeScope==='all'?'All workspace chats':'Current task').getAttribute('aria-pressed')==='true'})()`)
              if (!savedScopeRestored) throw new Error('Tree scope preference was not restored')
              await run(`smokeButton('All workspace chats').click()`)
              await wait(`document.querySelectorAll('[aria-label="Agent A branches"] button[aria-label^="Agent A branch task"]').length===8&&document.querySelectorAll('[aria-label="Agent B branches"] button[aria-label^="Agent B branch task"]').length===3`)
              await run(`smokeButton('Open Agent A conversation').click()`)
              await wait(`document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Alternative A')&&!document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Nested A')`)
              if (fixtureRequests.length !== 0) throw new Error('Restart repeated inference')
              await run(`smokeButton('Work together').click()`)
              await wait(`document.querySelector('[aria-label="Combined answer"]')?.textContent.includes('Combined fixture answer.')`)
              if (fixtureRequests.length !== 0) throw new Error('Viewing the saved combined answer repeated inference')
              fs.writeFileSync(path.join(profile, 'reopen-result.json'), JSON.stringify({ success: true, treeScopeRestored: savedScopeRestored, branchTreesRestored: true, selectedConversationRestored: true, selectedBranchRestored: true, inferenceRequests: fixtureRequests.length, syntheticInference: true, realCredentialsUsed: false }, null, 2))
              fs.writeFileSync(path.join(profile, 'reopened-branches.png'), (await window.webContents.capturePage()).toPNG())
              app.exit(0); return
            }

            await run(`window.helpRoute=location.hash;smokeButton('How to use Hadron').click()`)
            await wait(`document.querySelector('dialog[open]')?.querySelectorAll('ol[aria-label$="flowchart"]').length===4`)
            await run(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
            fs.writeFileSync(path.join(profile, 'hadron-help.png'), (await window.webContents.capturePage()).toPNG())
            await run(`Array.from(document.querySelectorAll('nav[aria-label="Choose a workflow"] button')).at(-1).click()`)
            if(!await run(`location.hash===window.helpRoute`))throw Error('Help changed the chat route')
            await run(`smokeButton('Open Independent jobs').click()`)
            await wait(`!document.querySelector('dialog[open]')`)
            if(fixtureRequests.length!==0)throw Error('Help dispatched an agent')
            if(process.env.HADRON_DESKTOP_SMOKE_HELPERS==='1'){
              for(const slot of (process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'?['A','B']:['A'])){
               const claude=slot==='B'
               await run(`smokeSelect('Agent ${slot} job provider','${claude?'claudecode':'openaichatgpt'}');smokeSelect('Agent ${slot} job model','${claude?'fixture-claude':'fixture-model'}');smokeButton('Open Agent ${slot} conversation').click();smokeTask('Agent ${slot} job task','HELPER_DESKTOP_FIXTURE')`)
               await wait(`!smokeButton('Send to Agent ${slot}').disabled`);await run(`smokeButton('Send to Agent ${slot}').click()`)
               await wait(`document.querySelector('[aria-label="Agent ${slot} conversation messages"]').textContent.includes('Parent used actual helper: Helper extracted: A and B.')`)
              }
              const helpers=await run(`window.electronAPI.helpers.list(document.getElementById('hadron-collaboration-workspace').dataset.collaborationConversation)`)
              const count=process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'?2:1
              if(helpers.length!==count||helpers.some((helper:any)=>helper.state!=='completed'||helper.model!==(helper.provider==='claudecode'?'fixture-haiku':'fixture-luna')))throw Error('Helpers did not persist with same-provider models')
              fs.writeFileSync(path.join(profile,'jobs-result.json'),JSON.stringify({success:true,actualDetachedChildren:count,sameProviderLightweight:true,noNestedHelpers:true,parentReceivedActualChildResult:true,helperHistory:helpers.length,realProviderRequests:0},null,2));app.exit(0);return
            }
            for (const slot of ['A', 'B']) {
              await run(`smokeSelect('Agent ${slot} job provider','${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'&&slot==='B'?'claudecode':'openaichatgpt'}')`)
              await run(`smokeSelect('Agent ${slot} job model','${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'&&slot==='B'?'fixture-claude':'fixture-model'}');smokeButton('Open Agent ${slot} conversation').click();smokeTask('Agent ${slot} job task','Fixed task ${slot}')`)
              await wait(`!smokeButton('Send to Agent ${slot}').disabled`)
              await run(`smokeButton('Send to Agent ${slot}').click()`)
            }
            await wait(`document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Fixture response for Fixed task A')&&document.querySelector('[aria-label="Agent B conversation messages"]').textContent.includes('Fixture response for Fixed task B')`)
            if (await run(`document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Fixed task B')`)) throw new Error('Job responses crossed')
            await wait(`document.querySelectorAll('[aria-label="Independent agent trees"] button[aria-label^="Agent A branch response"]').length===1`)
            if(process.env.HADRON_DESKTOP_SMOKE_HISTORY_PAGES==='1'){
              const db=new Database(path.join(profile,'local-sync.db'))
              const first=db.prepare('SELECT j.owner_id,m.meta FROM hadron_independent_jobs j JOIN messages m ON m.id=j.anchor_message_id LIMIT 1').get() as any
              const source=JSON.parse(first.meta).hadronIndependentJob.sourceConversationId
              const contexts=new IndependentJobContexts(db,(owner,id)=>{if((db.prepare('SELECT user_id FROM conversations WHERE id=?').get(id) as any)?.user_id!==owner)throw Error('Fixture access denied')})
              const repo=new IndependentJobsRepo(db)
              for(let i=0;i<70;i++){
                const id=`page-fixture-${i}`,prepared=contexts.prepare(first.owner_id,{schemaVersion:1,id,sourceConversationId:source,slot:'a'})
                const config={schemaVersion:1,id,conversationId:prepared.conversationId,anchorMessageId:prepared.anchorMessageId,task:`History paging task ${i}`,context:'',provider:'openaichatgpt',modelName:'fixture-model'}
                repo.create({id,ownerId:first.owner_id,conversationId:prepared.conversationId,anchorMessageId:prepared.anchorMessageId,configJson:JSON.stringify(config),configHash:id})
              }
              db.close()
              await run(`smokeButton('All workspace chats').click();smokeButton('Refresh trees').click()`)
              await wait(`!!document.querySelector('[aria-label="Agent A history pages"] button')&&document.querySelectorAll('[aria-label="Agent A branches"] button[aria-label^="Agent A branch task"]').length>=32`)
              const select=`Array.from(document.querySelectorAll('[aria-label="Agent A branches"] button')).find(e=>e.getAttribute('aria-label')?.startsWith('Agent A branch task: History paging task 69'))`
              await wait(`!!(${select})`);await run(`(${select}).click()`)
              await run(`smokeButton('All workspace chats').click()`)
              const countBefore=fixtureRequests.length
              await run(`Array.from(document.querySelectorAll('[aria-label="Agent A history pages"] button')).find(e=>e.textContent==='More saved chats').click()`)
              await wait(`Array.from(document.querySelectorAll('[aria-label="Agent A history pages"] button')).some(e=>e.textContent==='First page'&&!e.disabled)&&document.querySelector('[aria-label="Agent A branches"]').textContent.includes('History paging task 10')`)
              if(!await run(`document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('History paging task 69')`))throw Error('Paging changed the selected branch')
              await run(`Array.from(document.querySelectorAll('[aria-label="Agent A history pages"] button')).find(e=>e.textContent==='First page').click()`)
              await wait(`!Array.from(document.querySelectorAll('[aria-label="Agent A history pages"] button')).some(e=>e.textContent==='First page')&&document.querySelector('[aria-label="Agent A branches"]').textContent.includes('History paging task 68')`)
              if(fixtureRequests.length!==countBefore)throw Error('History paging dispatched inference')
              fs.writeFileSync(path.join(profile,'history-pages.png'),(await window.webContents.capturePage()).toPNG())
              fs.writeFileSync(path.join(profile,'jobs-result.json'),JSON.stringify({success:true,seededAdditionalTasks:70,historyPaging:true,selectedBranchPreserved:true,firstPageRestored:true,navigationInferenceRequests:0,realProviderRequests:0},null,2))
              app.exit(0);return
            }
            const selectNode = async (slot: string, kind: string, prefix: string) => {
              const selector = `Array.from(document.querySelectorAll('[aria-label="Agent ${slot} branches"] button')).find(e=>e.getAttribute('aria-label')?.startsWith(${JSON.stringify(`Agent ${slot} branch ${kind}: ${prefix}`)}))`
              if (!await run(`!!(${selector})`)) await run(`smokeButton('All workspace chats').click()`)
              await wait(`!!(${selector})`); await run(`(${selector}).click()`)
            }
            const send = async (slot: string, task: string) => {
              await run(`smokeTask('Agent ${slot} job task',${JSON.stringify(task)})`)
              await wait(`!smokeButton('Send to Agent ${slot}').disabled`)
              await run(`smokeButton('Send to Agent ${slot}').click()`)
              await wait(`document.querySelector('[aria-label="Agent ${slot} conversation messages"]').textContent.includes(${JSON.stringify(`Fixture response for ${task}`)})`)
              await wait(`!smokeButton('Send to Agent ${slot}').closest('[aria-label="Agent ${slot} conversation"]').querySelector('fieldset').disabled`)
            }
            await selectNode('A', 'response', 'Fixture response for Fixed task A')
            if (!await run(`document.querySelector('[data-chat-pane-kind="primary"]').contains(document.querySelector('[aria-label="Agent A conversation"]'))`)) throw new Error('Agent conversation is not in the left pane')
            if (await run(`document.querySelector('[data-collaboration-dock]').contains(document.querySelector('[aria-label="Agent A job task"]'))`)) throw new Error('Conversation composer stayed in setup pane')
            await send('A', 'Follow-up A')
            await selectNode('A', 'response', 'Fixture response for Fixed task A')
            await send('A', 'Alternative A')
            if (await run(`document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Follow-up A')`)) throw new Error('Sibling leaked into selected path')
            await selectNode('A', 'response', 'Fixture response for Follow-up A')
            await send('A', 'Nested A')
            await selectNode('A', 'task', 'Fixed task A')
            await send('A', 'Clarify A')
            await selectNode('B', 'response', 'Fixture response for Fixed task B')
            await send('B', 'Follow-up B')
            await run(`smokeButton('New task for Agent A').click()`)
            await send('A', 'Separate A')
            await wait(`smokeButton('Current task').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('[aria-label="Agent A branches"] button[aria-label^="Agent A branch task"]').length===1`)
            await run(`smokeButton('All workspace chats').click()`)
            await wait(`document.querySelectorAll('[aria-label="Agent A branches"] button[aria-label^="Agent A branch task"]').length===6`)
            if(process.env.HADRON_DESKTOP_SMOKE_BRANCH_CONTROLS==='1'){
              const beforeDraft=fixtureRequests.length
              await selectNode('A','response','Fixture response for Separate A')
              await run(`smokeButton('Regenerate answer').click()`)
              await wait(`document.querySelector('[aria-label="Agent A job task"]').value==='Separate A'`)
              if(fixtureRequests.length!==beforeDraft)throw Error('Regenerate sent a request before Send')
              await send('A','Regenerated separate')
              if(fixtureRequests.find(r=>r.task==='Regenerated separate')?.conversationHistory?.length)throw Error('Root regeneration inherited the old answer')
              await selectNode('A','task','Follow-up A')
              await run(`Array.from(document.querySelectorAll('[data-agent-node]')).find(e=>e.textContent.includes('Follow-up A')).querySelectorAll('button')[1].click()`)
              await wait(`document.querySelector('[aria-label="Agent A job task"]').value==='Follow-up A'`)
              await send('A','Edited follow-up')
              const edited=fixtureRequests.find(r=>r.task==='Edited follow-up')
              if(!JSON.stringify(edited?.conversationHistory).includes('Fixed task A')||JSON.stringify(edited?.conversationHistory).includes('Follow-up A'))throw Error('Edited question inherited its old answer or lost its parent')
              const beforeBin=fixtureRequests.length
              await run(`window.savedConfirm=window.confirm;window.confirm=()=>true;smokeButton('Move conversation to bin').click()`)
              await wait(`document.querySelector('[aria-label="Agent A conversation messages"]').textContent.includes('Start a separate task')`)
              const bin=await run(`window.electronAPI.recycleBin.list()`)
              if(bin.length!==1)throw Error('Conversation did not enter the bin')
              await run(`window.electronAPI.recycleBin.restore('conversation',${JSON.stringify(bin[0].id)})`)
              await run(`window.confirm=window.savedConfirm;smokeButton('Refresh trees').click()`)
              await selectNode('A','response','Fixture response for Edited follow-up')
              if(fixtureRequests.length!==beforeBin)throw Error('Bin restore repeated inference')
              const archivePath=path.join(profile,'portable.hadron')
              dialog.showSaveDialog=(async()=>({canceled:false,filePath:archivePath})) as typeof dialog.showSaveDialog
              dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[archivePath]})) as typeof dialog.showOpenDialog
              dialog.showMessageBox=(async()=>({response:1,checkboxChecked:false})) as typeof dialog.showMessageBox
              const beforeArchive=fixtureRequests.length
              await run(`location.hash='#/settings'`);await wait(`!!document.querySelector('[data-hadron-chat-archive]')`)
              await run(`smokeButton('Back up saved chats').click()`)
              await wait(`document.querySelector('[data-hadron-chat-archive]').textContent.includes('Backup saved:')`)
              if(!fs.existsSync(archivePath))throw Error('Archive file was not written')
              await run(`smokeButton('Import chat backup').click()`)
              await wait(`document.querySelector('[data-hadron-chat-archive]').textContent.includes('Open Projects on the left')`)
              await run(`smokeButton('Import chat backup').click()`)
              await wait(`document.querySelector('[data-hadron-chat-archive]').textContent.includes('already been imported')`)
              if(fixtureRequests.length!==beforeArchive)throw Error('Chat archive operation sent inference')
              const archiveDb=new Database(path.join(profile,'local-sync.db'),{readonly:true})
              const imported=archiveDb.prepare("SELECT count(*) AS n FROM projects WHERE name LIKE 'Imported · %'").get() as any
              if(imported.n<1)throw Error('Imported projects were not saved')
              archiveDb.close()
              fs.writeFileSync(path.join(profile,'branch-controls.png'),(await window.webContents.capturePage()).toPNG())
              fs.writeFileSync(path.join(profile,'jobs-result.json'),JSON.stringify({success:true,editPreservesParent:true,regenerateExcludesOriginalAnswer:true,preparationRequests:0,conversationBinRestore:true,binRequests:0,archiveNativeIpcRoundTrip:true,archiveImportIdempotent:true,archiveRequests:0,realProviderRequests:0,syntheticInference:true},null,2))
              app.exit(0);return
            }
            fs.writeFileSync(path.join(profile, 'central-trees.png'), (await window.webContents.capturePage()).toPNG())
            const packet = (task: string) => fixtureRequests.find(input => input.task === task)!
            if (!JSON.stringify(packet('Follow-up A').conversationHistory).includes('Fixed task A') || JSON.stringify(packet('Alternative A').conversationHistory).includes('Follow-up A') || !JSON.stringify(packet('Nested A').conversationHistory).includes('Follow-up A') || JSON.stringify(packet('Clarify A').conversationHistory).includes('Fixture response') || packet('Separate A').conversationHistory || JSON.stringify(packet('Follow-up B').conversationHistory).includes('Fixed task A')) throw new Error('Branch inference context crossed paths')
            await run(`smokeButton('Chat tree').click()`)
            if (!await run(`document.querySelector('[aria-label="Independent agent trees"]').hidden`)) throw new Error('Chat tree navigation failed')
            await run(`smokeButton('Agent trees').click()`)
            await run(`smokeButton('Work together').click();smokeButton('Use task only')?.click()`)
            for (const slot of ['A', 'B']) {
              await run(`smokeSelect('Agent ${slot} provider','${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'&&slot==='B'?'claudecode':'openaichatgpt'}')`)
              await run(`smokeSelect('Agent ${slot} model','${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'&&slot==='B'?'fixture-claude':'fixture-model'}')`)
            }
            await run(`smokeTask('Shared task','Fixed shared task')`)
            const beforeNewDraft = fixtureRequests.length
            await run(`smokeButton('New collaboration').click()`)
            await wait(`document.querySelector('[aria-label="Shared task"]').value===''&&smokeButton('Start collaboration').disabled`)
            const newCollaborationKeepsModels = await run(`['A','B'].every(slot=>document.querySelector('select[aria-label="Agent '+slot+' provider"]').value===(slot==='B'&&${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'}?'claudecode':'openaichatgpt')&&document.querySelector('select[aria-label="Agent '+slot+' model"]').value===(slot==='B'&&${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'}?'fixture-claude':'fixture-model'))`)
            if (!newCollaborationKeepsModels || fixtureRequests.length !== beforeNewDraft) throw new Error('New collaboration changed models or dispatched inference')
            await run(`smokeTask('Shared task','Fixed shared task')`)
            await wait(`!smokeButton('Start collaboration').disabled`)
            await run(`smokeButton('Start collaboration').click()`)
            await wait(`document.querySelector('[aria-label="Collaboration session responses"] [aria-label="Agent A response"]')?.textContent.includes('Fixture response for Fixed shared task')&&document.querySelector('[aria-label="Collaboration session responses"] [aria-label="Agent B response"]')?.textContent.includes('Fixture response for Fixed shared task')`)
            await wait(`!smokeButton('Continue with Agent A').disabled`)
            const continueOnCards = await run(`['A','B'].every(slot=>document.querySelector('[aria-label="Agent '+slot+' response"]').contains(smokeButton('Continue with Agent '+slot)))`)
            if (!continueOnCards) throw new Error('Continue buttons are not on their own response cards')
            await wait(`document.querySelector('[aria-label="Combined answer"]')?.textContent.includes('Combined fixture answer.')`)
            await wait(`smokeButton('Current task').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('[aria-label="Agent A branches"] button[aria-label^="Agent A branch task"]').length===1&&document.querySelectorAll('[aria-label="Agent B branches"] button[aria-label^="Agent B branch task"]').length===1`)
            const beforeScopeSwitch = fixtureRequests.length
            if (await run(`Array.from(document.querySelectorAll('[aria-label="Collaboration session responses"] button')).some(e=>/Reconnect Agent|Recover Agent/.test(e.textContent))`)) throw new Error('Finished responses still offer stream recovery')
            if (!await run(`['A','B'].every(slot=>document.querySelector('[aria-label="Agent '+slot+' response"]').textContent.includes('Initial independent proposal'))`)) throw new Error('Initial proposals lack stage labels')
            await run(`smokeButton('All workspace chats').click()`)
            await wait(`document.querySelectorAll('[aria-label="Agent A branches"] button[aria-label^="Agent A branch task"]').length===7`)
            await run(`smokeButton('Current task').click()`)
            await wait(`document.querySelectorAll('[aria-label="Agent A branches"] button[aria-label^="Agent A branch task"]').length===1`)
            if (fixtureRequests.length !== beforeScopeSwitch) throw new Error('Tree view switch repeated inference')
            const actionsSpaced = await run(`(()=>{const a=smokeButton('Check existing session').getBoundingClientRect(),b=smokeButton('Prepare another task').getBoundingClientRect();return a.width>0&&b.width>0&&(b.left-a.right>=12||b.top-a.bottom>=12)})()`)
            if (!actionsSpaced) throw new Error('Session action buttons are too close')
            const collaborationRequests = fixtureRequests.filter(input => input.task === 'Fixed shared task')
            if (collaborationRequests.length !== 5 || collaborationRequests.filter(input => input.kind === 'cross_review_packet').length !== 2 ||
              collaborationRequests.find(input => input.kind === 'combined_answer_packet')?.reviews?.length !== 2) throw new Error('Missing collaboration review/synthesis barrier')
            fs.writeFileSync(path.join(profile, 'combined-answer.png'), (await window.webContents.capturePage()).toPNG())
            await run(`smokeButton('Continue with Agent B').click()`)
            await wait(`document.activeElement?.getAttribute('aria-label')==='Agent B job task'`)
            await run(`smokeButton('Shared task').click()`)
            await wait(`!document.querySelector('[data-agent-conversation="shared"]').hidden`)
            await run(`smokeButton('Continue with Agent A').click()`)
            await wait(`document.activeElement?.getAttribute('aria-label')==='Agent A job task'`)
            await send('A', 'Continue shared A')
            if (!JSON.stringify(packet('Continue shared A').conversationHistory).includes('Fixed shared task') || JSON.stringify(packet('Continue shared A').conversationHistory).includes('Separate A')) throw new Error('Shared proposal continuation used the wrong path')
            fs.writeFileSync(path.join(profile, 'branch-conversation.png'), (await window.webContents.capturePage()).toPNG())
            await selectNode('A', 'response', 'Fixture response for Alternative A')
            fs.writeFileSync(path.join(profile, 'branch-preview.png'), (await window.webContents.capturePage()).toPNG())
            const entryDb = new Database(path.join(profile, 'local-sync.db'), { readonly: true })
            const savedEntries = ['Fixed task B', 'Fixed task A'].map(task => (entryDb.prepare("SELECT conversation_id FROM hadron_independent_jobs WHERE json_extract(config_json,'$.task')=?").get(task) as any).conversation_id as string)
            entryDb.close()
            const requestsBeforeReopening = fixtureRequests.length
            const workspaceRoute = await run('location.hash') as string
            for (const [index, conversation] of savedEntries.entries()) {
              await run(`location.hash=${JSON.stringify(`#/conversationPage?projectId=${workspaceRoute.split('/')[2]}`)}`)
              const entry = `[data-saved-conversation-id="${conversation}"]`
              await wait(`!!document.querySelector(${JSON.stringify(entry)})`)
              await run(`document.querySelector(${JSON.stringify(entry)}).click()`)
              const slot = index === 0 ? 'B' : 'A', expected = index === 0 ? 'Follow-up B' : 'Clarify A'
              await wait(`document.querySelector('[aria-label="Agent ${slot} conversation messages"]')?.textContent.includes(${JSON.stringify(`Fixture response for ${expected}`)})`)
              if (!await run(`document.querySelector('[aria-label="Independent agent trees"]')?.offsetWidth>0`)) throw new Error('Project entry did not restore its agent tree')
              if (!await run(`document.getElementById('hadron-collaboration-workspace')?.dataset.collaborationConversation===${JSON.stringify(workspaceRoute.split('/')[3])}`)) throw new Error('Project entry opened the wrong workspace scope')
            }
            fs.writeFileSync(path.join(profile, 'project-chat-restored.png'), (await window.webContents.capturePage()).toPNG())
            if (fixtureRequests.length !== requestsBeforeReopening) throw new Error('Opening saved project chats repeated inference')
            await run(`location.hash=${JSON.stringify(workspaceRoute)}`)
            await wait(`!!document.querySelector('[aria-label="Agent A branches"]')`)
            await selectNode('A', 'response', 'Fixture response for Alternative A')
            const database = new Database(path.join(profile, 'local-sync.db'), { readonly: true })
            const jobs = database.prepare("SELECT COUNT(*) AS n FROM hadron_independent_jobs WHERE status='completed'").get() as any
            const proposals = database.prepare("SELECT COUNT(*) AS n FROM hadron_sessions WHERE status='completed'").get() as any
            const workflows = database.prepare("SELECT COUNT(*) AS n FROM hadron_workflows WHERE status='completed'").get() as any
            database.close()
            if (jobs.n !== 9 || proposals.n !== 1 || workflows.n !== 1) throw new Error('Completed jobs were not persisted')
            const logs = fs.readdirSync(path.join(profile, 'hadron-job-logs')).filter(name => name.endsWith('.md'))
            if (logs.length !== 14) throw new Error('Expected fourteen participant/job/stage logs')
            await new Promise(resolve=>setTimeout(resolve,250))
            await run(`smokeButton('Copy into project').click()`)
            await wait(`document.querySelector('dialog[open] select')?.options.length>1`)
            await run(`(()=>{const selects=document.querySelectorAll('dialog[open] select');selects[0].value='0';selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].value=${JSON.stringify(workspaceRoute.split('/')[2])};selects[1].dispatchEvent(new Event('change',{bubbles:true}))})()`)
            await wait(`!smokeButton('Copy and open').disabled`);await run(`smokeButton('Copy and open').click()`)
            await wait(`!document.querySelector('dialog[open]')&&location.hash!==${JSON.stringify(workspaceRoute)}`)
            if(fixtureRequests.length!==requestsBeforeReopening)throw Error('Copy dispatched inference')
            const copiedDb=new Database(path.join(profile,'local-sync.db'),{readonly:true})
            const copies=copiedDb.prepare('SELECT COUNT(*) AS n FROM hadron_context_copies').get() as any;copiedDb.close();if(copies.n!==1)throw Error('Copy was not saved')
            await run(`location.hash=${JSON.stringify(workspaceRoute)}`);await wait(`!!smokeButton('Independent jobs')`)
            await new Promise(resolve=>setTimeout(resolve,250))
            await run(`smokeButton('Copy into project').click()`)
            await wait(`document.querySelector('dialog[open] select')?.options.length>1`)
            await run(`(()=>{const selects=document.querySelectorAll('dialog[open] select');selects[0].value='0';selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].focus()})()`)
            window.focus(); window.webContents.focus()
            window.webContents.sendInputEvent({type:'keyDown',keyCode:'Home'})
            window.webContents.sendInputEvent({type:'keyUp',keyCode:'Home'})
            window.webContents.sendInputEvent({type:'keyDown',keyCode:'Down'})
            window.webContents.sendInputEvent({type:'keyUp',keyCode:'Down'})
            await wait(`!!document.querySelector('input[aria-label="New project name"]')`)
            if(!await run(`smokeButton('Copy and open').disabled`))throw Error('Unnamed project allowed copying')
            // Exercise native keyboard input: assigning .value bypasses focus bugs.
            window.focus(); window.webContents.focus()
            await wait(`document.activeElement===document.querySelector('input[aria-label="New project name"]')`)
            for(const character of 'Draft')window.webContents.sendInputEvent({type:'char',keyCode:character})
            await wait(`document.querySelector('input[aria-label="New project name"]')?.value==='Draft'`)
            // Switch away and use the explicit button as well. No draft is lost.
            await run(`(()=>{const select=document.querySelectorAll('dialog[open] select')[1];select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
            await wait(`!document.querySelector('input[aria-label="New project name"]')`)
            await run(`Array.from(document.querySelectorAll('dialog[open] button')).find(button=>button.textContent==='New project').click()`)
            await wait(`document.activeElement===document.querySelector('input[aria-label="New project name"]')&&document.activeElement.value==='Draft'`)
            const nameBounds = await run(`(()=>{const input=document.querySelector('input[aria-label="New project name"]');input.scrollIntoView({block:'center'});const r=input.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`)
            window.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...nameBounds})
            window.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...nameBounds})
            await wait(`document.activeElement===document.querySelector('input[aria-label="New project name"]')`)
            window.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']})
            window.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['control']})
            for(const character of 'Copied workspace fixture')window.webContents.sendInputEvent({type:'char',keyCode:character})
            await wait(`document.querySelector('input[aria-label="New project name"]')?.value==='Copied workspace fixture'`)
            await wait(`!smokeButton('Copy and open').disabled`)
            await run(`smokeButton('Copy and open').click()`)
            await wait(`!document.querySelector('dialog[open]')&&location.hash!==${JSON.stringify(workspaceRoute)}`)
            await wait(`document.body.textContent.includes('Copied workspace fixture')`)
            if(fixtureRequests.length!==requestsBeforeReopening)throw Error('New-project copy dispatched inference')
            const newCopyDb=new Database(path.join(profile,'local-sync.db'),{readonly:true})
            const newProject=newCopyDb.prepare("SELECT * FROM projects WHERE name='Copied workspace fixture'").get() as any
            if(!newProject||newProject.storage_mode!=='local'||newProject.cwd||newProject.context||newProject.system_prompt)throw Error('New copy inherited folder/context permissions or failed creation')
            if((newCopyDb.prepare('SELECT COUNT(*) AS n FROM hadron_context_copies').get() as any).n!==2)throw Error('New-project copy was not persisted')
            if(!newCopyDb.prepare('SELECT id FROM conversations WHERE project_id=?').get(newProject.id))throw Error('New project has no copied conversation')
            newCopyDb.close()
            await wait(`document.body.textContent.includes('Copied reference conversation.')`)
            await run(`location.hash=${JSON.stringify(workspaceRoute)}`);await wait(`!!smokeButton('Independent jobs')`)
            await run(`smokeButton('Copy into project').click()`)
            await wait(`document.querySelector('dialog[open] select')?.options.length>1`)
            await run(`(()=>{const selects=document.querySelectorAll('dialog[open] select');const a=Array.from(selects[0].options).find(option=>option.textContent.startsWith('Agent A ·'));if(!a)throw Error('Agent A source missing');selects[0].value=a.value;selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].value=${JSON.stringify(newProject.id)};selects[1].dispatchEvent(new Event('change',{bubbles:true}))})()`)
            await run(`smokeButton('Add more chats').click()`)
            await wait(`!!document.querySelector('dialog[open] fieldset')`)
            await run(`(()=>{const b=Array.from(document.querySelectorAll('dialog[open] fieldset label')).find(label=>label.textContent.includes('Agent B ·'));if(!b)throw Error('Agent B source missing');b.querySelector('input').click()})()`)
            await wait(`!!smokeButton('Copy selected chats')&&!smokeButton('Copy selected chats').disabled`)
            await run(`smokeButton('Copy selected chats').click()`)
            await wait(`document.querySelector('dialog[open] [role="status"]')?.textContent.includes('2 chats copied')`)
            const batchDb=new Database(path.join(profile,'local-sync.db'),{readonly:true})
            const batchChats=batchDb.prepare('SELECT title FROM conversations WHERE project_id=?').all(newProject.id) as Array<{title:string}>
            if(batchChats.length!==3||!batchChats.some(chat=>chat.title==='Copied · Agent A conversation')||!batchChats.some(chat=>chat.title==='Copied · Agent B conversation'))throw Error('Batch copy lost an existing chat or failed to save A and B separately')
            batchDb.close()
            if(fixtureRequests.length!==requestsBeforeReopening)throw Error('Batch copy dispatched inference')
            await run(`Array.from(document.querySelectorAll('dialog[open] button')).find(button=>button.textContent.startsWith('Open Agent B ·')).click()`)
            await wait(`!document.querySelector('dialog[open]')&&document.body.textContent.includes('Copied reference conversation.')`)
            const paletteRoute=await run('location.hash')
            for(const palette of ['cream','cocoa','rose','ocean']){
              await run(`location.hash='#/settings';void 0`);await wait(`!!document.querySelector('select[aria-label="Hadron colours"]')`)
              await run(`(()=>{const select=document.querySelector('select[aria-label="Hadron colours"]');select.value=${JSON.stringify(palette)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
              await wait(`document.documentElement.dataset.hadronPalette===${JSON.stringify(palette)}`)
              await run(`location.hash=${JSON.stringify(paletteRoute)};void 0`);await wait(`!!document.querySelector('.hadron-shell [data-chat-pane-surface]')`)
              const colours=await run(`(()=>{const shell=document.querySelector('.hadron-shell');return {panel:getComputedStyle(shell).getPropertyValue('--hh-panel').trim(),left:getComputedStyle(document.querySelector('[data-chat-pane-surface]')).backgroundColor,tree:getComputedStyle(document.querySelector('[data-hadron-tree]')).backgroundColor,right:getComputedStyle(document.getElementById('hadron-collaboration-workspace')).backgroundColor,saved:localStorage.getItem('hadron:palette')}})()`)
              if(!colours.panel||colours.left==='rgb(255, 255, 255)'||colours.tree==='rgb(255, 255, 255)'||colours.saved!==palette)throw Error('Palette did not colour and persist across panes: '+palette)
              await new Promise(resolve=>setTimeout(resolve,150));fs.writeFileSync(path.join(profile,'palette-'+palette+'.png'),(await window.webContents.capturePage()).toPNG())
            }
            await run(`window.fixtureConfirm=window.confirm;window.fixtureDeletePrompt='';window.confirm=text=>{window.fixtureDeletePrompt=text;return true};document.querySelector('button[aria-label="Open sidebar panel"]')?.click()`)
            await wait(`!!document.querySelector('button[aria-label="Delete project Copied workspace fixture"]')`)
            await run(`document.querySelector('button[aria-label="Delete project Copied workspace fixture"]').click()`)
            await wait(`window.electronAPI.recycleBin.list().then(items=>items.some(item=>item.title==='Copied workspace fixture'))`)
            if(!await run(`window.fixtureDeletePrompt.includes('30 days')`))throw Error('Sidebar delete warning did not explain retention')
            await wait(`!document.querySelector('button[aria-label="Delete project Copied workspace fixture"]')`)
            await run(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Recycle Bin'&&button.offsetWidth).click()`)
            await wait(`document.querySelector('dialog[open]')?.textContent.includes('Copied workspace fixture')`)
            if(!await run(`document.querySelector('dialog[open]').textContent.includes('30 days remaining')`))throw Error('Bin did not show the 30-day restore period')
            await run(`smokeButton('Restore project').click()`)
            await wait(`document.querySelector('dialog[open]')?.textContent.includes('Recycle Bin is empty')`)
            await run(`smokeButton('Close Recycle Bin').click();window.confirm=window.fixtureConfirm;void 0`)
            await wait(`!!document.querySelector('button[aria-label="Delete project Copied workspace fixture"]')`)
            const restoredDb=new Database(path.join(profile,'local-sync.db'),{readonly:true})
            if(!restoredDb.prepare('SELECT id FROM conversations WHERE project_id=?').get(newProject.id)||!restoredDb.prepare('SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE project_id=?)').get(newProject.id))throw Error('Restoration lost the copied chat or its content')
            restoredDb.close()
            await run(`document.querySelector('button[aria-label="Close sidebar panel"]')?.click()`)
            fs.writeFileSync(path.join(profile,'copy-new-project.png'),(await window.webContents.capturePage()).toPNG())
            await run(`location.hash=${JSON.stringify(workspaceRoute)}`);await wait(`!!smokeButton('Independent jobs')`)
            fs.writeFileSync(path.join(profile, 'jobs-result.json'), JSON.stringify({ success: true, copyIntoProject:true,copyIntoNewProject:true,sidebarProjectMovedToBin:true,restorePreservesChat:true,thirtyDayExpiryShown:true,fourColourPalettesAcrossPanes:true,palettePreferenceSaved:true,newProjectNameRequired:true,newProjectListedAndOpened:true,newProjectHasNoFolderGrant:true,copyInferenceRequests:0,helpFlowcharts:4, helpNavigationWithoutInference:true, mixedProviders:process.env.HADRON_DESKTOP_SMOKE_MIXED==='1', claudeAdapterCalls:fixtureClaudeCalls, independentJobs: 9, sharedProposalContinuation: true, sharedSessions: 1, combinedAnswers: workflows.n, collaborationRequests: collaborationRequests.length, crossReviews: 2, newCollaborationClearsQuestion: true, newCollaborationKeepsModels, newCollaborationInferenceRequests: 0, currentTaskFilter: true, allWorkspaceView: true, newTaskDefaultsToCurrent: true, viewSwitchInferenceRequests: 0, sessionActionsSpaced: actionsSpaced, projectListChatRestore: true, restoredAgentAAndB: true, projectOpenInferenceRequests: fixtureRequests.length - requestsBeforeReopening, separateResponses: true, centralTrees: true, branching: true, nestedBranches: true, selectedHistoryOnly: true, leftConversation: true, nextTaskEditable: true, followUpEditable: true, journalFiles: logs.length, realCredentialsUsed: false, syntheticInference: true }, null, 2))
            fs.writeFileSync(path.join(profile, 'jobs.png'), (await window.webContents.capturePage()).toPNG())
          }
          if (process.env.HADRON_DESKTOP_SMOKE_LOGIN === '1') {
            await window.webContents.executeJavaScript(`(()=>{const button=document.querySelector('[data-auth-method="siwc"] button');const detail=button?.closest('details');if(detail)detail.open=true;button.click()})()`)
            for (let attempt = 0; attempt < 50 && !fs.existsSync(path.join(profile, 'browser-intent.json')); attempt++) await new Promise(resolve => setTimeout(resolve, 100))
            const intent = JSON.parse(fs.readFileSync(path.join(profile, 'browser-intent.json'), 'utf8'))
            if (intent.host !== 'auth.openai.com' || intent.path !== '/api/accounts/authorize' || intent.agentName !== 'The Hadron Harness' || !intent.dynamicClient) throw new Error('Incorrect Agents ChatGPT login destination')
            const popupPresent = await window.webContents.executeJavaScript(`['Sign in required for Yggdrasil models', 'This cloud provider is unavailable in Hadron'].some(text => document.body.innerText.includes(text))`)
            if (popupPresent) throw new Error('Agents sign-in opened the old cloud login popup')
            await window.webContents.executeJavaScript('window.electronAPI.collaboration.chatgptCancelSignIn()')
            fs.writeFileSync(path.join(profile, 'signin-result.json'), JSON.stringify({ success: true, agentsSignIn: true, officialOpenAiDestination: true, hadronAppName: true, upstreamPopupAbsent: true, realBrowserOpened: false, realCredentialsUsed: false }, null, 2))
          }
          if (process.env.HADRON_DESKTOP_SMOKE_PROFILE_PAGE === '1') {
            await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Open profile"]').click()`)
            for (let attempt = 0; attempt < 50; attempt++) {
              if (await window.webContents.executeJavaScript(`!!document.querySelector('main[aria-label="Hadron profile"]')`)) break
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            const cleanProfile = await window.webContents.executeJavaScript(`(()=>{const page=document.querySelector('main[aria-label="Hadron profile"]');return !!page&&location.hash==='#/payment'&&page.querySelector('h1')?.textContent==='Profile'&&!page.querySelector('a')&&!/subscribe|credits|pricing|upgrade|basic|ultra|yggchat|offers|packages/i.test(page.innerText)})()`)
            if (!cleanProfile) throw new Error('Hadron profile still contains inherited offers or links')
            if (!await window.webContents.executeJavaScript(`getComputedStyle(document.querySelector('main[aria-label="Hadron profile"]')).backgroundColor==='rgb(237, 240, 248)'`)) throw new Error('Profile surface is transparent or does not match Hadron')
            // Let route exit/enter animations paint before capturing the profile.
            await new Promise(resolve => setTimeout(resolve, 700))
            fs.writeFileSync(path.join(profile, 'profile.png'), (await window.webContents.capturePage()).toPNG())
            await window.webContents.executeJavaScript(`document.querySelector('main[aria-label="Hadron profile"] button').click()`)
            for (let attempt = 0; attempt < 50; attempt++) {
              if (await window.webContents.executeJavaScript(`location.hash.startsWith('#/chat/')`)) break
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            if (!await window.webContents.executeJavaScript(`location.hash.startsWith('#/chat/')`)) throw new Error('Profile could not return to workspace')
            fs.writeFileSync(path.join(profile, 'profile-result.json'), JSON.stringify({ success: true, sidebarProfileOpened: true, offersRemoved: true, promotionalLinksRemoved: true, hadronSurface: true, workspaceReturn: true }, null, 2))
          }
          app.exit(0)
        }).catch(async error => {
          fs.writeFileSync(path.join(profile, 'smoke-error.json'), JSON.stringify({ error: String(error) }))
          if (jobFixture) { try { fs.writeFileSync(path.join(profile, 'failure-text.txt'), await window.webContents.executeJavaScript('document.body.innerText')); fs.writeFileSync(path.join(profile, 'failure.png'), (await window.webContents.capturePage()).toPNG()) } catch {} }
          app.exit(1)
        })
    }, 15000)
  })
})
void import('./main.js')
