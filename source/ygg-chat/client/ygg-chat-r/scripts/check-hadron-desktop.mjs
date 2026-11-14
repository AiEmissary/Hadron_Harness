import {hadronProtocolSnapshot} from './hadron-protocol-snapshot.mjs'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, realpath } from 'node:fs/promises'
import {appendFileSync} from 'node:fs'
import {existsSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const require = createRequire(import.meta.url), appDir = path.resolve(import.meta.dirname, '..')
const reopenIndex = process.argv.indexOf('--reopen-jobs')
const reopenToolsIndex = process.argv.indexOf('--reopen-tools')
const reopenVerificationIndex = process.argv.indexOf('--reopen-verification')
const reopenProjectIndex = process.argv.indexOf('--reopen-project')
const reopenBuildIndex=process.argv.indexOf('--reopen-build')
const reopenContinuousIndex=process.argv.indexOf('--reopen-continuous')
const reopening = reopenIndex >= 0 || reopenToolsIndex >= 0 || reopenVerificationIndex >= 0 || reopenProjectIndex >= 0 || reopenBuildIndex>=0||reopenContinuousIndex>=0
const profile = reopening ? path.resolve(process.argv[(reopenContinuousIndex>=0?reopenContinuousIndex:reopenBuildIndex>=0?reopenBuildIndex:reopenProjectIndex >= 0 ? reopenProjectIndex : reopenVerificationIndex >= 0 ? reopenVerificationIndex : reopenToolsIndex >= 0 ? reopenToolsIndex : reopenIndex) + 1] ?? '') : await mkdtemp(path.join(os.tmpdir(), 'hadron-desktop-smoke-'))
if (reopening && (path.dirname(profile).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() || !path.basename(profile).startsWith('hadron-desktop-smoke-'))) throw Error('Only an explicit Hadron temporary smoke profile may be reopened')
const output = path.join(appDir, 'electron/hadron-desktop-smoke.mjs')
await mkdir(path.dirname(output), { recursive: true })
await build({ entryPoints: [path.join(appDir, 'electron/hadronDesktopSmoke.ts')], outfile: output, bundle: true, platform: 'node',
  format: 'esm', target: 'node22', packages: 'external', banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" } })
const env = { ...process.env, HADRON_DESKTOP_SMOKE_PROFILE: profile, HADRON_DESKTOP_SMOKE_APP_DIR: appDir, HADRON_USE_BUILT_RENDERER: '1' }; delete env.ELECTRON_RUN_AS_NODE
if(process.argv.includes('--provider-choices')){env.HADRON_DESKTOP_SMOKE_PROVIDER_CHOICES='1';env.HADRON_DESKTOP_SMOKE_JOBS='1';env.HADRON_DESKTOP_SMOKE_MIXED='1'}
if(process.argv.includes('--file-access')){env.HADRON_DESKTOP_SMOKE_FILE_ACCESS='1';env.HADRON_DESKTOP_SMOKE_JOBS='1';env.HADRON_DESKTOP_SMOKE_MIXED='1';env.HADRON_DESKTOP_SMOKE_PROJECT='1'}
if(process.argv.includes('--conversation-work')){env.HADRON_DESKTOP_SMOKE_CONVERSATION_WORK='1';env.HADRON_DESKTOP_SMOKE_BUILD='1';env.HADRON_DESKTOP_SMOKE_APPLY_BUILD='1';env.HADRON_DESKTOP_SMOKE_JOBS='1';env.HADRON_DESKTOP_SMOKE_MIXED='1'}
if(process.argv.includes('--tool-markup')){env.HADRON_DESKTOP_SMOKE_TOOL_MARKUP='1';env.HADRON_DESKTOP_SMOKE_JOBS='1';env.HADRON_DESKTOP_SMOKE_MIXED='1';env.HADRON_DESKTOP_SMOKE_PROJECT='1'}
if(process.argv.includes('--research-limit')){env.HADRON_DESKTOP_SMOKE_RESEARCH_LIMIT='1';env.HADRON_DESKTOP_SMOKE_JOBS='1';env.HADRON_DESKTOP_SMOKE_MIXED='1';env.HADRON_DESKTOP_SMOKE_PROJECT='1'}
if(process.argv.includes('--settings-scroll')){env.HADRON_DESKTOP_SMOKE_SETTINGS_SCROLL='1';env.HADRON_DESKTOP_SMOKE_HELPERS='1'}
if(process.argv.includes('--shared-folder')){env.HADRON_DESKTOP_SMOKE_SHARED_FOLDER='1';env.HADRON_DESKTOP_SMOKE_PROJECT='1';env.HADRON_DESKTOP_SMOKE_JOBS='1'}
if(process.argv.includes('--appearance'))env.HADRON_DESKTOP_SMOKE_APPEARANCE='1'
if(process.argv.includes('--second-opinion'))env.HADRON_DESKTOP_SMOKE_SECOND_OPINION='1'
if(process.argv.includes('--branch-controls')){env.HADRON_DESKTOP_SMOKE_BRANCH_CONTROLS='1';env.HADRON_DESKTOP_SMOKE_JOBS='1'}
if(process.argv.includes('--history-pages')){env.HADRON_DESKTOP_SMOKE_HISTORY_PAGES='1';env.HADRON_DESKTOP_SMOKE_JOBS='1'}
if(process.argv.includes('--saved-history'))env.HADRON_DESKTOP_SMOKE_SAVED_HISTORY='1'
if(process.argv.includes('--helpers'))env.HADRON_DESKTOP_SMOKE_HELPERS='1'
if (process.argv.includes('--jobs') || process.argv.includes('--helpers') || reopening) env.HADRON_DESKTOP_SMOKE_JOBS = '1'
if (reopenIndex >= 0) env.HADRON_DESKTOP_SMOKE_REOPEN = '1'
if (process.argv.includes('--settings')) { env.HADRON_DESKTOP_SMOKE_SETTINGS = '1'; env.HADRON_DESKTOP_SMOKE_HELPERS='1' }
if (process.argv.includes('--project')) {env.HADRON_DESKTOP_SMOKE_PROJECT = '1';env.HADRON_DESKTOP_SMOKE_JOBS = '1'}
if(reopenProjectIndex>=0){env.HADRON_DESKTOP_SMOKE_PROJECT='1';env.HADRON_DESKTOP_SMOKE_REOPEN_PROJECT='1'}
if(process.argv.includes('--build-project')||reopenBuildIndex>=0){env.HADRON_DESKTOP_SMOKE_BUILD='1';env.HADRON_DESKTOP_SMOKE_JOBS='1';env.YGG_TOOLS_RUNTIME='local'}
if(process.argv.includes('--folder-build'))env.HADRON_DESKTOP_SMOKE_FOLDER_BUILD='1'
if(process.argv.includes('--apply-build'))env.HADRON_DESKTOP_SMOKE_APPLY_BUILD='1'
if(process.argv.includes('--auto-build'))env.HADRON_DESKTOP_SMOKE_AUTO_BUILD='1'
if(process.argv.includes('--continuous')||reopenContinuousIndex>=0){env.HADRON_DESKTOP_SMOKE_CONTINUOUS='1';env.HADRON_DESKTOP_SMOKE_JOBS='1'}
if(reopenContinuousIndex>=0)env.HADRON_DESKTOP_SMOKE_REOPEN_CONTINUOUS='1'
if(process.argv.includes('--continue-saved'))env.HADRON_DESKTOP_SMOKE_CONTINUE_SAVED='1'
if(process.argv.includes('--mixed-continuous'))env.HADRON_DESKTOP_SMOKE_MIXED='1'
if(process.argv.includes('--native-evidence'))env.HADRON_DESKTOP_SMOKE_NATIVE_EVIDENCE='1'
if(reopenBuildIndex>=0)env.HADRON_DESKTOP_SMOKE_REOPEN_BUILD='1'
if (process.argv.includes('--tools')) { env.HADRON_DESKTOP_SMOKE_TOOLS = '1'; env.HADRON_DESKTOP_SMOKE_JOBS = '1' }
if (reopenToolsIndex >= 0) { env.HADRON_DESKTOP_SMOKE_TOOLS = '1'; env.HADRON_DESKTOP_SMOKE_REOPEN_TOOLS = '1' }
if (process.argv.includes('--shared-followup') || process.argv.includes('--shared-files')) env.HADRON_DESKTOP_SMOKE_SHARED_FOLLOWUP = '1'
if (process.argv.includes('--shared-files')) env.HADRON_DESKTOP_SMOKE_SHARED_FILES = '1'
if (process.argv.includes('--nested-shared')) env.HADRON_DESKTOP_SMOKE_NESTED_SHARED = '1'
if (process.argv.includes('--verification') || process.argv.includes('--shared-followup') || process.argv.includes('--shared-files') || reopenVerificationIndex >= 0) { env.HADRON_DESKTOP_SMOKE_VERIFICATION = '1'; env.HADRON_DESKTOP_SMOKE_JOBS = '1' }
if (reopenVerificationIndex >= 0) env.HADRON_DESKTOP_SMOKE_REOPEN_VERIFICATION = '1'
console.log(`Full Hadron desktop smoke: ${profile}`)
const start = () => spawn(require('electron'), [output], { cwd: appDir, env, windowsHide: true, stdio: env.HADRON_DESKTOP_SMOKE_BUILD==='1'?['ignore','pipe','pipe']:'ignore' })
const report=process.argv.includes('--conversation-work')?'conversation-work-result.json':process.argv.includes('--tool-markup')?'tool-markup-result.json':process.argv.includes('--research-limit')?'research-limit-result.json':process.argv.includes('--file-access')?'file-access-result.json':process.argv.includes('--provider-choices')?'provider-choices-result.json':process.argv.includes('--shared-folder')?'shared-folder-result.json':process.argv.includes('--settings-scroll')?'settings-scroll-result.json':process.argv.includes('--appearance')?'appearance-result.json':process.argv.includes('--second-opinion')?'second-opinion-result.json':reopenContinuousIndex>=0?'continuous-reopen-result.json':process.argv.includes('--continuous')?'continuous-result.json':reopenBuildIndex>=0?'build-reopen-result.json':process.argv.includes('--build-project')?'build-result.json':reopenProjectIndex>=0?'project-reopen-result.json':process.argv.includes('--project')?'project-result.json':reopenVerificationIndex>=0?'verification-reopen-result.json':(process.argv.includes('--verification')||process.argv.includes('--shared-followup')||process.argv.includes('--shared-files'))?'verification-result.json':reopenToolsIndex>=0?'tools-reopen-result.json':reopening?'reopen-result.json':process.argv.includes('--tools')?'tools-result.json':(process.argv.includes('--jobs')||process.argv.includes('--helpers')||process.argv.includes('--history-pages')||process.argv.includes('--branch-controls'))?'jobs-result.json':process.argv.includes('--settings')?'settings-result.json':'desktop-result.json'
const resolvedProfile=await realpath(profile)
if(path.dirname(resolvedProfile).toLowerCase()!==(await realpath(os.tmpdir())).toLowerCase()||!path.basename(resolvedProfile).startsWith('hadron-desktop-smoke-'))throw Error('Unexpected fixture report directory')
await rm(path.join(resolvedProfile,report),{force:true})
const protocolBefore=hadronProtocolSnapshot()
const child=start()
for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>appendFileSync(path.join(profile,'build-process-output.txt'),chunk))
const timer=setTimeout(()=>child.kill(),process.argv.includes('--conversation-work')?180000:55000)
child.on('exit', async code => { clearTimeout(timer); process.exitCode=code??1
 try { const text=await readFile(path.join(profile,report),'utf8');const result=JSON.parse(text);result.signInProtocolPreserved=hadronProtocolSnapshot()===protocolBefore;await import('node:fs/promises').then(fs=>fs.writeFile(path.join(profile,report),JSON.stringify(result,null,2)));console.log(JSON.stringify(result,null,2));if(result.success!==true||!result.signInProtocolPreserved)process.exitCode=1 }
 catch(error){console.error('Required fixture result is missing:',report);process.exitCode=1}
 if(env.HADRON_DESKTOP_SMOKE_BUILD==='1'&&code===0){
  if(existsSync(path.join(profile,'project-execution','execution.json'))){console.error('Project execution marker was not released on clean Quit');process.exitCode=1}
  else console.log('Clean Quit joined project workers, closed the idle socket and released the execution scope.')
 }
})
