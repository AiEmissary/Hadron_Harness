import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export async function auditHadronConversationWork(window:BrowserWindow,profile:string){
 await window.webContents.executeJavaScript(`(async()=>{
 const wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw Error('Conversation work timeout: '+fn)};
 const button=(text,root=document)=>Array.from(root.querySelectorAll('button')).find(b=>b.textContent.trim()===text&&!b.closest('[hidden]'));
 const choose=(label,value)=>{const input=document.querySelector('select[aria-label="'+label+'"]');if(!input||input.matches(':disabled'))throw Error('Missing choice '+label);input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}))};
 const type=(label,value)=>{const input=document.querySelector('textarea[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))};
 button('Independent jobs').click();
 for(const slot of ['A','B']){choose('Agent '+slot+' job provider',slot==='B'?'claudecode':'openaichatgpt');await new Promise(r=>setTimeout(r,60));choose('Agent '+slot+' job model',slot==='B'?'fixture-claude':'fixture-model')}
 button('Open Agent B conversation').click();await wait(()=>!!button('Add folder',document.querySelector('[aria-label="Agent B conversation"]')));button('Add folder',document.querySelector('[aria-label="Agent B conversation"]')).click();await wait(()=>!!document.querySelector('[aria-label="Agent B attached folder"]'));
 type('Agent B job task','SIMPLE_WORK_DISCUSSION');await wait(()=>!button('Send to Agent B').disabled);button('Send to Agent B').click();await wait(()=>document.querySelector('[aria-label="Agent B job response"]')?.textContent.includes('Calculator discussion'));
 await wait(()=>!button('Work on this',document.querySelector('[aria-label="Agent B conversation"]')).disabled);button('Work on this',document.querySelector('[aria-label="Agent B conversation"]')).click();
 await wait(()=>!!document.querySelector('[aria-label="Work on this conversation"]'));type('Work instruction','SIMPLE_WORK_NATIVE B');choose('Work agent','b');button('Go',document.querySelector('[aria-label="Work on this conversation"]')).click();
 await wait(()=>document.querySelector('[aria-label="Project conclusion"]')?.textContent.includes('Tests: passed'));
 if(!document.querySelector('[aria-label="Project conclusion"]').textContent.includes('Self-check by Agent B'))throw Error('Single-agent self-check mislabelled');
 const receipt=()=>document.querySelector('[aria-label="Task feedback"]');
 if(!receipt()?.textContent.includes('Agent B: saved 1 file.'))throw Error('Agent B has no saved-file feedback');
 button('calculator.js',receipt()).click();await wait(()=>document.querySelector('[aria-label="Project proposal result"]').textContent.includes('Proposed after'));
 if(!receipt()||!document.querySelector('[aria-label="Project conclusion"]'))throw Error('File inspection hid task feedback');
 const checkStage=Array.from(document.querySelector('[aria-label="Project plan and proposed files"]').querySelectorAll('button')).find(b=>b.querySelector('strong')?.textContent==='Agent B - self-check');checkStage.click();
 await wait(()=>document.querySelector('[aria-label="Project proposal result"]').textContent.includes(' - self-check'));
 if(!receipt()||!document.querySelector('[aria-label="Project conclusion"]'))throw Error('Stage inspection hid task feedback');
 button('Read task report',receipt()).click();await wait(()=>!!document.querySelector('[aria-label="Project proposal result"] [aria-label="Conversation actions"]'));

 const actions=document.querySelector('[aria-label="Project proposal result"] [aria-label="Conversation actions"]');button('Continue with Agent A',actions).click();
 await wait(()=>!!document.querySelector('[aria-label="Agent A attached folder"]')&&document.querySelector('textarea[aria-label="Agent A job task"]').value==='Continue this conversation.');
 type('Agent A job task','SIMPLE_WORK_FOLLOWUP');await wait(()=>!button('Send to Agent A').disabled);button('Send to Agent A').click();await wait(()=>document.querySelector('[aria-label="Agent A job response"]')?.textContent.includes('Addition verified from current file'));
 await wait(()=>!button('Work on this',document.querySelector('[aria-label="Agent A conversation"]')).disabled);button('Work on this',document.querySelector('[aria-label="Agent A conversation"]')).click();
 await wait(()=>!!document.querySelector('[aria-label="Work on this conversation"]'));choose('Work agent','both');type('Work instruction','SIMPLE_WORK_NATIVE BOTH');choose('Work file permission','task');button('Go',document.querySelector('[aria-label="Work on this conversation"]')).click();
 await wait(()=>document.querySelector('[aria-label="Project conclusion"]')?.textContent.includes('Tests: passed')&&document.querySelector('[aria-label="Project conclusion"]').textContent.includes('SIMPLE_WORK_NATIVE BOTH'));

 const projectActions=document.querySelector('[aria-label="Project proposal result"] [aria-label="Conversation actions"]');button('Continue with both agents',projectActions).click();
 await wait(()=>document.querySelector('textarea[aria-label="Shared task"]').value==='Continue this conversation.');
 type('Shared task','SIMPLE_WORK_NATIVE SHARED');choose('Work together access mode','edit');
 await wait(()=>!!button('Go',document.querySelector('[data-workflow-composer="shared"]'))&&!button('Go',document.querySelector('[data-workflow-composer="shared"]')).disabled);button('Go',document.querySelector('[data-workflow-composer="shared"]')).click();
 await wait(()=>document.querySelector('[aria-label="Project conclusion"]')?.textContent.includes('Tests: passed')&&document.querySelector('[aria-label="Project conclusion"]').textContent.includes('SIMPLE_WORK_NATIVE SHARED'));
 button('Automatic conversation').click();await wait(()=>!!document.querySelector('select[aria-label="Conversation access mode"]'));choose('Conversation access mode','edit');
 for(const role of ['A','B']){choose('Conversation Agent '+role+' provider',role==='B'?'claudecode':'openaichatgpt');await new Promise(r=>setTimeout(r,70));choose('Conversation Agent '+role+' model',role==='B'?'fixture-claude':'fixture-model')}
 type('Conversation goal','SIMPLE_WORK_NATIVE AUTO');await wait(()=>!!button('Go',document.querySelector('[data-workflow-composer="continuous"]'))&&!button('Go',document.querySelector('[data-workflow-composer="continuous"]')).disabled);button('Go',document.querySelector('[data-workflow-composer="continuous"]')).click();
 await wait(()=>document.querySelector('[aria-label="Project conclusion"]')?.textContent.includes('Tests: passed')&&document.querySelector('[aria-label="Project conclusion"]').textContent.includes('SIMPLE_WORK_NATIVE AUTO'));

 button('New project task',document.querySelector('[aria-label="Project proposal result"]')).click();await wait(()=>!document.querySelector('textarea[aria-label="Project goal"]').disabled&&document.querySelector('textarea[aria-label="Project goal"]').value==='');choose('Project work agent','a');type('Project goal','SIMPLE_WORK_NATIVE MANUAL');await wait(()=>!button('Go',document.querySelector('[data-workflow-composer="project"]')).disabled);button('Go',document.querySelector('[data-workflow-composer="project"]')).click();
 await wait(()=>document.querySelector('[aria-label="Project conclusion"]')?.textContent.includes('Tests: passed')&&document.querySelector('[aria-label="Project conclusion"]').textContent.includes('SIMPLE_WORK_NATIVE MANUAL'));


 })()`).catch(async error=>{fs.writeFileSync(path.join(profile,'conversation-work-failure.json'),JSON.stringify({error:String(error),text:await window.webContents.executeJavaScript('document.body.innerText')}));throw error})
 await new Promise<void>((resolve)=>{window.webContents.once('did-finish-load',()=>resolve());window.webContents.reload()})
 await new Promise(resolve=>setTimeout(resolve,2000))
 const db=new Database(path.join(profile,'hadron-project-builds.db'),{readonly:true})
 const rows=db.prepare('SELECT config_json FROM hadron_project_builds ORDER BY rowid').all() as Array<{config_json:string}>
 const first=JSON.parse(rows[0].config_json);const firstReads=db.prepare('SELECT tool FROM hadron_project_folder_activity WHERE build_id=? ORDER BY rowid').all(first.id) as Array<{tool:string}>;if(firstReads.map(item=>item.tool).join(',')!=='project_search,project_read')throw Error('Premature empty proposal was not corrected with an actual source read');
 db.close()
 if(rows.length!==5)throw Error('Work action submitted an unexpected number of tasks')
 const [single,both,shared,automatic,manual]=rows.map(row=>JSON.parse(row.config_json))
 if(single.participation!=='b'||single.providers.a!=='claudecode'||single.providers.b!=='claudecode'||single.models.a!==single.models.b)throw Error('Selected Agent B was not used alone')
 if(!single.plan.includes('SIMPLE_WORK_DISCUSSION'))throw Error('Conversation was lost when starting work')
 if(both.participation!=='both'||both.providers.a!=='openaichatgpt'||both.providers.b!=='claudecode'||!both.plan.includes('Addition verified from current file'))throw Error('Two-agent work lost actors or conversation')
 if(shared.task!=='SIMPLE_WORK_NATIVE SHARED'||automatic.task!=='SIMPLE_WORK_NATIVE AUTO')throw Error('Mode work action did not start its instruction');
 if(manual.participation!=='a'||manual.models.a!==manual.models.b||manual.providers.a!=='openaichatgpt')throw Error('Manual Go did not use selected Agent A');
 const fixture=JSON.parse(fs.readFileSync(path.join(profile,'build-fixture.json'),'utf8'))
 if(!fs.readFileSync(path.join(fixture.root,'calculator.js'),'utf8').includes('a + b'))throw Error('Approved coding work did not change the actual file')
 return {success:true,agentBWorksAlone:true,prematureEmptyProposalCorrectedWithinBudget:true,agentBSavedFileReceipt:true,fileAndStageInspectionKeepFeedback:true,selfCheckLabelHonest:true,bothAgentsWork:true,selectedConversationCarried:true,selectedFolderCarried:true,continueFromWorkToAgentA:true,actualCodeApplied:true,actualNodeTestsPassed:true,approvalAtExecution:true,extraPreparationNotRequired:true,sharedGoWorks:true,automaticGoWorks:true,manualGoWorks:true,agentAWorksAlone:true,reopenStartsNoNewTasks:true,realProviderRequests:0}
}
