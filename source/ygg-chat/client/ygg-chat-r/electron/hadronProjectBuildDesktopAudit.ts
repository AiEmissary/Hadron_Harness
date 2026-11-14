import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
export async function auditHadronProjectBuild(window:BrowserWindow,profile:string){
 const reopening=process.env.HADRON_DESKTOP_SMOKE_REOPEN_BUILD==='1'
 await window.webContents.executeJavaScript(`window.auditBuildReopen=${reopening}`)
 await window.webContents.executeJavaScript(`window.auditApplyBuild=${process.env.HADRON_DESKTOP_SMOKE_APPLY_BUILD==='1'}`)
 await window.webContents.executeJavaScript(`window.auditAutoBuild=${process.env.HADRON_DESKTOP_SMOKE_AUTO_BUILD==='1'}`)
 await window.webContents.executeJavaScript(`window.auditBuildNativeEvidence=${fs.existsSync(path.join(profile,'native-evidence-fixture.json'))}`)
 await window.webContents.executeJavaScript(`window.auditAppliedHistory=${fs.existsSync(path.join(profile,'applied-build-fixture.json'))}`)
 await window.webContents.executeJavaScript(`window.auditRepairedHistory=${fs.existsSync(path.join(profile,'applied-build-fixture.json'))&&!!JSON.parse(fs.readFileSync(path.join(profile,'applied-build-fixture.json'),'utf8')).oneReviewedRepair}`)
 const result=await window.webContents.executeJavaScript(`(async()=>{
  const mixed=${process.env.HADRON_DESKTOP_SMOKE_MIXED==='1'};
 const button=text=>Array.from(document.querySelectorAll('button')).find(el=>el.textContent.trim()===text);
  const wait=async condition=>{for(let i=0;i<150;i++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Project-build UI timed out: '+condition)};
  const select=(label,value)=>{const el=document.querySelector('select[aria-label="'+label+'"]');if(!el)throw Error('Missing select '+label);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))};
  const text=(label,value)=>{const el=document.querySelector('textarea[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))};
  const panel=()=>document.querySelector('section[aria-label="Build a project"]');
  const left=()=>document.querySelector('[data-project-build="response"]');
  const tree=()=>document.querySelector('[data-project-build="tree"]');
  if(window.auditBuildReopen){
    await wait(()=>button('Build a project')?.getAttribute('aria-pressed')==='true'&&left()?.textContent.includes('REOPEN_BUILD_FIXTURE'));
    await wait(()=>tree()?.textContent.includes('calculator.js'));
    if(!panel().querySelector('[aria-label="Selected source files"]')?.textContent.includes('README.md')||!panel().textContent.includes('Selected source files: '+(window.auditRepairedHistory?3:2)+' / 20'))throw Error('Saved proposal lost one of its source files');
    if(window.electronAPI.projectDraft.reconcile||button('Apply reviewed changes'))throw Error('Historical editing or recovery-unlock was enabled');
    if(!panel().textContent.includes('Folder access is required again after a restart'))throw Error('Folder expiry missing');
    button('Inspect saved state').click();
    await wait(()=>left().querySelector('[aria-label="Saved state inspection"]')?.textContent.includes(window.auditAppliedHistory?'Matches the proposed state':'Matches the original state'));
    if(!left().textContent.includes(window.auditBuildNativeEvidence?'confirmed ended by Windows process and job inspection':'historical or not confirmed by this session'))throw Error('Saved inspection did not distinguish actual native evidence from unknown history');
    button('View Agent A job log').click();
    await wait(()=>left().textContent.includes('# Hadron agent job log')&&left().textContent.includes('## Project execution'));
    return {success:true,savedBuildRestored:true,projectModeRestored:true,sourceGrantExpired:true,savedInspectionNoReplay:true,savedJobLogReadable:true,nativePreviousEpochConfirmed:window.auditBuildNativeEvidence,noInferenceReplay:true,editingUnavailable:true};
  }
  button('Build a project').click();
  const savedMilestones=await window.electronAPI.projectDraft.milestones(location.hash.split('/')[3]);
  if(!Array.isArray(savedMilestones)||typeof window.electronAPI.projectDraft.accept!=='function'||typeof window.electronAPI.projectDraft.nextMilestone!=='function')throw Error('Project milestone bridge is incomplete');
  await wait(()=>!!document.querySelector('select[aria-label="Project Agent A provider"] option[value="openaichatgpt"]'));
  for(const role of ['A','B']){select('Project Agent '+role+' provider',mixed&&role==='B'?'claudecode':'openaichatgpt');await new Promise(resolve=>setTimeout(resolve,100));select('Project Agent '+role+' model',mixed&&role==='B'?'fixture-claude':'fixture-model')}
  button('Choose project folder').click();await wait(()=>panel().textContent.includes('Project: hadron-build-fixture-'));
  if(${process.env.HADRON_DESKTOP_SMOKE_FOLDER_BUILD==='1'}){
    if(!panel().querySelector('input[type="checkbox"]').checked)throw Error('Folder search not enabled by default')
    text('Project goal','FOLDER_SEARCH_FIXTURE');text('Project deliverables','Reviewed change in a discovered nested source file.')
    await wait(()=>!button('Go').disabled);button('Go').click()
    await wait(()=>left()?.textContent.includes('Proposal reviewed')&&tree()?.textContent.includes('src/nested.js'))
    if(!left().textContent.includes('project_search')||!left().textContent.includes('project_read')||!left().textContent.includes('Relevant files found: src/nested.js'))throw Error('Folder search activity/evidence missing')
    const source=panel().querySelector('[aria-label="Selected source files"]');if(!source.textContent.includes('Selected source files: 0'))throw Error('Folder test used manual selections')
    return {success:true,folderOnlySelection:true,recursiveSearch:true,discoveredNestedSource:true,readEvidenceFrozen:true,exactIndependentReview:true,visibleFolderActivity:true,noManualFiles:true,projectWrites:0,realProviderRequests:0}
  }
  button('Add source files').click();await wait(()=>panel().textContent.includes('calculator.js'));
  button('Add source files').click();
  await wait(()=>panel().querySelector('[aria-label="Selected source files"]')?.textContent.includes('README.md')&&panel().textContent.includes('Selected source files: 2 / 20'));
  if(!panel().querySelector('[aria-label="Selected source files"]').textContent.includes('calculator.js'))throw Error('A second picker visit replaced the first source');
  select('Project Agent B provider','');
  await wait(()=>panel().textContent.includes('Choose a provider for Agent B.')&&panel().textContent.includes('Enter a project goal.')&&panel().textContent.includes('Enter at least one deliverable:'));
  if(!button('Go').disabled)throw Error('Incomplete project setup allowed preparation');
  select('Project Agent B provider',mixed?'claudecode':'openaichatgpt');
  await wait(()=>panel().textContent.includes('Choose an available model for Agent B.'));
  select('Project Agent B model',mixed?'fixture-claude':'fixture-model');
  const folderChoice=panel().querySelector('input[type="checkbox"]');if(folderChoice.checked)folderChoice.click();
  const prepare=async goal=>{const folderChoice=panel().querySelector('input[type="checkbox"]');if(folderChoice.checked)folderChoice.click();text('Project goal',goal);text('Project deliverables','A reviewed calculator correction.');await new Promise(resolve=>setTimeout(resolve,100));await wait(()=>!button('Go').disabled);button('Go').click()};
  if(window.auditAutoBuild){
    await prepare('REOPEN_BUILD_FIXTURE AUTO_REPAIR_FIXTURE');
    await wait(()=>!!button('Run build/test/fix')&&!button('Run build/test/fix').disabled);
    button('Run build/test/fix').click();
    await wait(()=>left()?.textContent.includes('Build/test/fix: passed')&&left().textContent.includes('repairs 1 / 2'));
    if(!left().textContent.includes('Node tests · passed')||!left().textContent.includes('Build script · passed')||!left().textContent.includes('Files changed: yes'))throw Error('Automatic repair did not reach actual passing tests and build');
    return {success:true,oneApprovalBuildTestFix:true,actualInitialTestFailed:true,independentRepairReview:true,actualRepairedTestPassed:true,actualBuildPassed:true,repairRounds:1,realProviderRequests:0};
  }
  if(window.auditApplyBuild){
    await prepare('REOPEN_BUILD_FIXTURE');
    await wait(()=>!!button('Apply reviewed changes')&&!button('Apply reviewed changes').disabled);
    button('Run Node tests').click();await wait(()=>left().textContent.includes('Node tests · failed'));
    if(!left().textContent.includes('adds negative numbers'))throw Error('Actual failing test output missing');
    button('Apply reviewed changes').click();await wait(()=>left().textContent.includes('Files changed: yes'));
    if(!left().textContent.includes('Tests: stale'))throw Error('Pre-application test result not invalidated');
    button('Run Node tests').click();await wait(()=>left().textContent.includes('Node tests · passed'));
    if(!left().textContent.includes('Tests: passed'))throw Error('Actual test success missing');
    button('Run build script').click();await wait(()=>left().textContent.includes('Build script · passed'));
    if(!left().textContent.includes('CALCULATOR_BUILD_OK'))throw Error('Actual build output missing');
    return {success:true,nativeApprovedApplication:true,actualFailingBaseline:true,actualPassingRetest:true,actualBuildScript:true,previousResultsInvalidated:true,realProviderRequests:0};
  }
  const closeMonitor=()=>document.querySelector('button[aria-label="Close agent monitor"]');
  await wait(()=>!!closeMonitor());closeMonitor().click();
  await wait(()=>!document.querySelector('.agents-pill'));
  button('Agent monitor').click();
  await wait(()=>!!document.querySelector('button[aria-label="Minimize agent monitor"]'));
  document.querySelector('button[aria-label="Minimize agent monitor"]').click();
  await wait(()=>!!closeMonitor()&&!document.querySelector('button[aria-label="Minimize agent monitor"]'));
  closeMonitor().click();await wait(()=>!document.querySelector('.agents-pill'));
  await prepare('Correct the selected calculator addition');
  await wait(()=>left()?.textContent.includes('Proposal reviewed')&&tree()?.textContent.includes('calculator.js'));
  const review=Array.from(tree().querySelectorAll('button')).find(el=>el.textContent.includes('Agent B · review'));review.click();
  await wait(()=>left().textContent.includes('Reviewed the exact calculator diff'));
  const file=Array.from(tree().querySelectorAll('button')).find(el=>el.textContent.startsWith('calculator.js'));file.click();
  await wait(()=>left().textContent.includes('a - b')&&left().textContent.includes('a + b'));
  button('Inspect saved state').click();
  await wait(()=>left().querySelector('[aria-label="Saved state inspection"]')?.textContent.includes('Matches the original state'));
  if(!left().textContent.includes('confirmed ended in this session'))throw Error('Live inspection lost actual worker termination');
  const bounds=[left(),tree(),panel()].map(el=>el.getBoundingClientRect());
  if(!(bounds[0].left<bounds[1].left&&bounds[1].left<bounds[2].left))throw Error('Build preview left/tree/right placement is wrong');
  if(window.electronAPI.projectDraft.reconcile)throw Error('Recovery-unlock API exposed');
  const first=panel().querySelector('select[aria-label="Saved project proposals"]').value;
  await wait(()=>!button('New project task').disabled);button('New project task').click();
  await wait(()=>document.querySelector('textarea[aria-label="Project goal"]').value==='');
  if(!panel().textContent.includes('calculator.js'))throw Error('Kept source files were lost');
  await prepare('STOP_BUILD_FIXTURE');await wait(()=>!!button('Stop project agents'));
  button('Stop project agents').click();await wait(()=>!button('New project task').disabled&&left().textContent.includes('Stopped'));
  const keep=panel().querySelector('input[type="checkbox"]');keep.click();button('New project task').click();
  await wait(()=>document.querySelector('textarea[aria-label="Project goal"]').value===''&&!panel().textContent.includes('calculator.js'));
  select('Saved project proposals',first);await wait(()=>left().textContent.includes('Correct the selected calculator addition'));
  button('New project task').click();await wait(()=>document.querySelector('textarea[aria-label="Project goal"]').value==='');
  button('Add source files').click();await wait(()=>panel().textContent.includes('calculator.js'));
  await prepare('EMPTY_PROPOSAL_FIXTURE');
  await wait(()=>left()?.textContent.includes('Proposal failed')&&left()?.textContent.includes('no usable file changes')&&panel().textContent.includes('no usable file changes'));
  await wait(()=>!button('Try again').disabled);button('Try again').click();
  await wait(()=>!document.querySelector('textarea[aria-label="Project goal"]').disabled);
  if(document.querySelector('textarea[aria-label="Project goal"]').value!=='EMPTY_PROPOSAL_FIXTURE')throw Error('Retry lost the failed project goal');
  await wait(()=>!button('Go').disabled);
  button('Add source files').click();await wait(()=>panel().textContent.includes('calculator.js'));
  await prepare('REOPEN_BUILD_FIXTURE');await wait(()=>left()?.textContent.includes('Proposal reviewed')&&tree()?.textContent.includes('calculator.js'));
  await wait(()=>!!left().querySelector('[aria-label="Project conclusion"]'));
  if(!left().querySelector('[aria-label="Project conclusion"]').textContent.includes('Tests: not run'))throw Error('Conclusion claimed unrun checks');
  for(const target of ['a','b','shared','main']){
    select('Conclusion destination',target);await new Promise(resolve=>setTimeout(resolve,100));button('Use conclusion in new workflow').click();
    if(target==='a'||target==='b')await wait(()=>document.querySelector('textarea[aria-label="Agent '+target.toUpperCase()+' job task"]').value.includes('# Hadron project conclusion'));
    else if(target==='shared')await wait(()=>document.querySelector('textarea[aria-label="Shared task"]').value.includes('# Hadron project conclusion'));
    else await wait(()=>Array.from(document.querySelectorAll('textarea')).some(el=>el.value.includes('# Hadron project conclusion')&&!el.getAttribute('aria-label')));
    button('Build a project').click();await wait(()=>button('Project build')?.getAttribute('aria-pressed')==='true'&&!!left().querySelector('[aria-label="Project conclusion"]'));left().scrollTop=0;
    if(!left().querySelector('[aria-label="Project conclusion"]').textContent.includes('REOPEN_BUILD_FIXTURE'))throw Error('Handoff lost the original project');
  }
  await new Promise(resolve=>setTimeout(resolve,250));
  if(getComputedStyle(left()).display==='none')throw Error('Project conclusion pane was not visible after handoff');
  return {success:true,projectConclusionVisible:true,fourDraftDestinations:true,originalProjectPreserved:true,noAutomaticHandoffSend:true,monitorClosedCompletely:true,monitorReopenedFromTitleBar:true,monitorMinimizedSeparately:true,failedTaskRetryPreservesGoal:true,newProjectTaskAvailable:true,freshInspectionOriginal:true,additiveSourceSelection:true,twoSelectedPathsVisible:true,missingRequirementsExplained:true,emptyProposalExplained:true,nativeSelectionFixture:true,actualFrozenSource:true,actualProtectedWorkerEngine:true,exactPeerReview:true,threePanePlacement:true,fileDiffPreview:true,keepAndClearFiles:true,stopConfirmed:true,savedProposalReopened:true,gracefulQuitRequested:true,editingUnavailable:true,projectWrites:0,projectCommands:0,realProviderRequests:0};
 })()`)
 const fixture=JSON.parse(fs.readFileSync(path.join(profile,'build-fixture.json'),'utf8'))
 const applied=process.env.HADRON_DESKTOP_SMOKE_APPLY_BUILD==='1'||process.env.HADRON_DESKTOP_SMOKE_AUTO_BUILD==='1'||fs.existsSync(path.join(profile,'applied-build-fixture.json'))
 if(fs.readFileSync(path.join(fixture.root,'calculator.js'),'utf8')!==`export function add(a, b) { return a ${applied?'+':'-'} b }\n`)throw Error('Unexpected calculator file state')
 if(process.env.HADRON_DESKTOP_SMOKE_APPLY_BUILD==='1'){
  if(fs.readFileSync(path.join(fixture.root,'build-result.txt'),'utf8')!=='CALCULATOR_BUILD_OK')throw Error('Actual build artifact missing')
  fs.writeFileSync(path.join(profile,'applied-build-fixture.json'),JSON.stringify({applied:true,testsPassed:true,buildPassed:true}))
 }
 if(process.env.HADRON_DESKTOP_SMOKE_AUTO_BUILD==='1')fs.writeFileSync(path.join(profile,'applied-build-fixture.json'),JSON.stringify({applied:true,testsPassed:true,oneReviewedRepair:true}))
 if(fs.readFileSync(path.join(fixture.root,'README.md'),'utf8')!=='A disposable calculator fixture.\n')throw Error('Draft preview edited the second source file')
 fs.writeFileSync(path.join(profile,reopening?'build-reopen-result.json':'build-result.json'),JSON.stringify(result,null,2))
 fs.writeFileSync(path.join(profile,reopening?'build-reopened.png':'build.png'),(await window.webContents.capturePage()).toPNG())
}
