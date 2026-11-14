import {diagnosticRecorder} from './hadronDiagnosticBootstrap.js'
// Must follow diagnostic bootstrap and precede runtime singleton imports: isolate paths before server singleton imports.
import { app } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { mkdirSync, existsSync, copyFileSync, constants, lstatSync, writeFileSync } from 'node:fs'
import { configureHadronEnvironment, hadronAppId, hadronName } from '../server/runtimeIdentity.js'
import { ClaudeCodeRuntime } from '../server/headlessServer/providers/claudeCodeRuntime.js'
import { installClaudeRuntime } from '../server/headlessServer/providers/claudeRuntimeHost.js'
import {executionStartup} from '../server/hadronTools/executionStartup.js'

const profile = app.isPackaged ? 'Hadron-Harness' : 'Hadron-Harness-Development'
export const hadronDiagnosticDirectory=process.argv.find(arg=>arg.startsWith('--hadron-diagnose='))?.slice('--hadron-diagnose='.length)
if(hadronDiagnosticDirectory&&(path.dirname(path.resolve(hadronDiagnosticDirectory)).toLowerCase()!==path.resolve(os.tmpdir()).toLowerCase()||!path.basename(hadronDiagnosticDirectory).startsWith('hadron-release-check-')||!path.isAbsolute(hadronDiagnosticDirectory)||!existsSync(hadronDiagnosticDirectory)||lstatSync(hadronDiagnosticDirectory).isSymbolicLink()))throw Error('Diagnostics require an existing private temporary release-check directory')
const smokeProfile = hadronDiagnosticDirectory??(!app.isPackaged ? process.env.HADRON_DESKTOP_SMOKE_PROFILE : undefined)
if (smokeProfile && !hadronDiagnosticDirectory && (!path.isAbsolute(smokeProfile) || !path.basename(smokeProfile).startsWith('hadron-desktop-smoke-'))) throw new Error('Invalid desktop smoke profile')
export const hadronIsolatedTestProfile = !!smokeProfile
// Local acceptance uses the installed Hadron identity/data, rather than the
// empty development profile. Packaged apps ignore this source-only switch.
const localAcceptance=!app.isPackaged&&process.argv.includes('--hadron-local-test')
const dataDir = smokeProfile ?? path.join(app.getPath('appData'),localAcceptance?'Hadron-Harness':profile)
mkdirSync(path.join(dataDir, 'chromium'), { recursive: true })
app.setName(hadronName)
app.setPath('userData', dataDir)
app.setPath('sessionData', path.join(dataDir, 'chromium'))
app.setAppUserModelId(hadronAppId)
diagnosticRecorder?.mark('profile_ready')
configureHadronEnvironment(dataDir)
// Pin execution before main.ts loads custom modules, queues or utility children.
// A project session is selected at process launch, never by a renderer setting.
const executionMode=process.argv.includes('--hadron-project-session')?'project':'standard'
executionStartup.initialize(dataDir,executionMode)
process.env.HADRON_EXECUTION_PROFILE=dataDir
process.env.HADRON_EXECUTION_SESSION=executionMode
// Development tool source belongs to the Hadron project, never Graviton's custom-tools directory.
// Temporary smoke profiles and packaged installs always retain their own private library.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
if (!smokeProfile && !app.isPackaged && existsSync(path.join(projectRoot, 'wherearewe.md'))) {
  process.env.HADRON_TOOLS_LIBRARY = path.join(projectRoot, 'custom-tools')
}
const toolRoot = process.env.HADRON_TOOLS_LIBRARY!
mkdirSync(toolRoot, { recursive: true })
if (lstatSync(toolRoot).isSymbolicLink()) throw new Error('Hadron tool library cannot be a link to another folder')
const toolGuide = path.join(app.isPackaged ? process.resourcesPath : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'hadron-tools', 'TOOL_DEVELOPMENT.md')
if (existsSync(toolGuide) && !existsSync(path.join(toolRoot, 'TOOL_DEVELOPMENT.md'))) copyFileSync(toolGuide, path.join(toolRoot, 'TOOL_DEVELOPMENT.md'), constants.COPYFILE_EXCL)
installClaudeRuntime(new ClaudeCodeRuntime({ profileDirectory: dataDir,
  onJobDiagnostic:value=>{try{writeFileSync(path.join(dataDir,'claude-runtime-work','last-job-diagnostic.json'),JSON.stringify(value),{mode:0o600})}catch{}},
  nativeHostDirectory:app.isPackaged?path.join(process.resourcesPath,'hadron-worker'):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','vendor','hadron-worker'),
  runtimeDirectory: app.isPackaged ? path.join(process.resourcesPath, 'claude-code') : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'claude-code') }))
