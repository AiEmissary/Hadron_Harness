import {completionAlertText,type CompletionAlert} from '../../../shared/hadronCompletion.js'
import {RememberedFolders} from '../server/hadronTools/rememberedFolders.js'
import {workspaceArchiveHost} from '../server/hadronTools/workspaceArchive.js'
import {diagnosticRecorder} from './hadronDiagnosticBootstrap.js'
import {recycleBinHost} from '../server/hadronTools/recycleBin.js'
import './hadronBootstrap.js'
import {hadronDiagnosticDirectory,hadronIsolatedTestProfile} from './hadronBootstrap.js'
import {contextCopyHost} from '../server/hadronTools/contextCopy.js'
import {ARCHIVE_BYTES,archiveSummary,chatArchiveHost,validateChatArchive} from '../server/hadronTools/chatArchive.js'
import {helperHost} from '../server/hadronTools/helperHost.js'
import {hadronSetupReport} from './hadronSetup.js'
import {executionStartup} from '../server/hadronTools/executionStartup.js'
import {installWindowsWorkerEvidenceHost} from '../server/hadronTools/windowsWorkerEvidence.js'
import {desktopProjectDraftHost} from '../server/hadronTools/projectDraftService.js'
import {projectApplicationAuthority} from '../server/hadronTools/projectApplicationAuthority.js'
import {desktopContinuousHost} from '../server/hadronTools/continuousChat.js'
import {freezeProjectChecks,projectCheckHost} from '../server/hadronTools/projectChecks.js'
import {WindowsOwnedWorkerHost} from '../server/auth/windowsOwnedWorker.js'
import {captureOwnedProcess} from '../server/auth/hadronOwnedProcess.js'
import type {ProjectDraftInput} from '../../../shared/projectBuild.js'
import { assertLegacyExecutionAllowed, projectExecutionGate } from '../server/hadronTools/executionGate.js'
import { projectReadHost } from '../server/hadronTools/projectRead.js'
import {projectAgentHost} from '../server/hadronTools/projectAgent.js'
import { isOwnedHadronHealth } from '../server/runtimeIdentity.js'
import { getClaudeRuntime } from '../server/headlessServer/providers/claudeRuntimeHost.js'
import { HadronChatgptConnection } from '../server/auth/hadronChatgptConnection.js'
import { HadronChatgptStore } from '../server/auth/hadronChatgptStore.js'
import { withHadronAuthLease } from '../server/auth/hadronAuthLease.js'
import { HADRON_LIVE_COLLABORATION_ENABLED } from '../../../shared/collaboration.js'
import { HadronChatgptProbe } from '../server/auth/hadronChatgptProbe.js'
import { HadronCodexRuntime } from '../server/auth/hadronCodexRuntime.js'
import { desktopCollaborationHost } from '../server/headlessServer/services/collaboration/desktopHost.js'
import { createDesktopCollaborationAccess } from '../server/headlessServer/services/collaboration/desktopAccess.js'
import { hadronAppId, hadronName, hadronProtocol, isHadronDesktop, runtimeConfOptions } from '../server/runtimeIdentity.js'
import { getAuthManager, publicAuthState, disconnectAuth, importLegacyRenderer, enableLocalLogin } from '../server/auth/runtime.js'
import { startAppLogin, completeAppCode, completeAppCallback, cancelAppLogin } from '../server/auth/appLogin.js'
import Conf from 'conf'
import { app, autoUpdater as nativeAutoUpdater, BrowserWindow, dialog, ipcMain, Menu, Notification, nativeImage, nativeTheme, powerMonitor, safeStorage, screen, shell, Tray, webContents } from 'electron'
import autoUpdaterPkg from 'electron-updater'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
diagnosticRecorder?.mark('main_loaded')
if(hadronDiagnosticDirectory){
 const diagnosticDirectory=hadronDiagnosticDirectory
 const report=(value:unknown)=>fs.writeFileSync(path.join(diagnosticDirectory,'release-check.json'),JSON.stringify({...value as object,diagnosticRunId:diagnosticRecorder?.runId},null,2))
 const watchdog=setTimeout(()=>{diagnosticRecorder?.fail('startup_failed');app.exit(1)},45000)
 app.on('browser-window-created',(_event,window)=>{diagnosticRecorder?.mark('window_created');window.webContents.once('did-finish-load',()=>{
  diagnosticRecorder?.mark('renderer_loaded')
  void (async()=>{try{
   for(let i=0;i<200;i++){if(await window.webContents.executeJavaScript(`!document.querySelector('[data-hadron-entry]')&&!!document.querySelector('[data-unified-workspace]')?.offsetWidth`))break;await new Promise(resolve=>setTimeout(resolve,100))}
   await window.webContents.executeJavaScript(`new Promise(resolve=>setTimeout(resolve,500))`)
   const ui=await window.webContents.executeJavaScript(`({route:location.hash,workspace:!!document.querySelector('[data-unified-workspace]')?.offsetWidth,remote:Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim().toLowerCase()==='remote'),help:Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='How to use Hadron'),singleComposer:document.querySelectorAll('textarea[aria-label="Message"]').length===1,tree:!!document.querySelector('[aria-label="Conversation tree"]'),setupPopup:!!document.querySelector('button[aria-label="Chat setup"]')})`)
   ui.localOwnerReady=(await window.webContents.executeJavaScript(`window.electronAPI.collaboration.setup()`)).ownerAvailable===true
   ui.projectBridgeReady=await window.webContents.executeJavaScript(`(async()=>{const api=window.electronAPI.projectDraft;if(!['milestones','accept','nextMilestone'].every(name=>typeof api?.[name]==='function'))return false;const workspace=location.hash.split('/')[3];return Array.isArray(await api.milestones(workspace))})()`)
   const setup:ReturnType<typeof hadronSetupReport>=await window.webContents.executeJavaScript(`window.electronAPI.hadronSetup()`)
   ui.recycleBinReady=await window.webContents.executeJavaScript(`(async()=>{const api=window.electronAPI.recycleBin;return !!api&&typeof api.restore==='function'&&Array.isArray(await api.list())})()`)
   ui.paletteAbsentFromWorkspace=await window.webContents.executeJavaScript(`!document.querySelector('select[aria-label="Hadron colours"]')`)
   await window.webContents.executeJavaScript(`location.hash='#/settings';void 0`)
   for(let i=0;i<100;i++){if(await window.webContents.executeJavaScript(`!!document.querySelector('[data-settings-appearance]')`))break;await new Promise(resolve=>setTimeout(resolve,100))}
   ui.paletteChoices=await window.webContents.executeJavaScript(`document.querySelector('select[aria-label="Hadron colours"]')?.options.length??0`)
   ui.textChoices=await window.webContents.executeJavaScript(`document.querySelector('select[aria-label="Workspace text colour"]')?.options.length??0`)
   ui.settingsScrollReady=await window.webContents.executeJavaScript(`(()=>{const area=document.querySelector('[data-hadron-settings-scroll]'),nav=document.querySelector('[data-hadron-settings-navigation]');if(!area||!nav||area.clientHeight<=0||area.scrollHeight<=area.clientHeight||getComputedStyle(area).overflowY!=='scroll')return false;area.scrollTop=area.scrollHeight;const visible=nav.getBoundingClientRect().top>=0&&nav.getBoundingClientRect().bottom<=area.getBoundingClientRect().top+1;area.scrollTop=0;return visible})()`)
   await new Promise(resolve=>setTimeout(resolve,650))
   fs.writeFileSync(path.join(diagnosticDirectory,'appearance.png'),(await window.webContents.capturePage()).toPNG())
   await window.webContents.executeJavaScript(`location.hash=${JSON.stringify(ui.route)};void 0`)
   for(let i=0;i<100;i++){if(await window.webContents.executeJavaScript(`!!document.querySelector('[data-unified-workspace]')?.offsetWidth`))break;await new Promise(resolve=>setTimeout(resolve,100))}
   if(!ui.settingsScrollReady||!ui.paletteAbsentFromWorkspace||ui.textChoices!==3||!ui.recycleBinReady||ui.paletteChoices!==5||!app.isPackaged||!ui.workspace||!ui.localOwnerReady||!ui.projectBridgeReady||ui.remote||!ui.help||!ui.singleComposer||!ui.tree||!ui.setupPopup||!window.isMaximized()||setup.items.some(item=>item.required&&!item.ready))throw Error('Packaged workspace, controls or required resources failed')
   fs.writeFileSync(path.join(diagnosticDirectory,'workspace.png'),(await window.webContents.capturePage()).toPNG())
   report({success:true,ui,setup,startedMaximized:window.isMaximized(),privateProfile:app.getPath('userData')===hadronDiagnosticDirectory,modelRequests:0});diagnosticRecorder?.complete();clearTimeout(watchdog);app.quit()
  }catch(error){diagnosticRecorder?.fail('startup_failed');clearTimeout(watchdog);app.exit(1)}})()
 })})
}
import { fileURLToPath } from 'url'
import { normalizeShellPath } from './shellPath.js'
import { externalWebUrl, openHadronExternalWeb, openHadronExternalPath } from './externalLaunch.js'
import { createQuitConfirmationGuard } from './quitConfirmation.js'
import '../server/envLoader.js'
import {
  consolidateSecureSecrets,
  deleteBraveApiKey,
  getBraveApiKey,
  hasBraveApiKey,
  setBraveApiKey,
} from '../server/keytarSecrets.js'
import { mcpManager } from '../server/mcp/mcpManager.js'
import { ensureManagedHooksInitialized } from '../server/hooks/hookStorage.js'
import { buildElectronHostCapabilities, buildElectronServerConfig } from './electronHostAdapter.js'
import { createYggServer, type YggServerHandle } from '../server/createYggServer.js'
import { ensureManagedCustomToolsInitialized } from '../server/tools/customToolLoader.js'
import { ensureManagedThemesInitialized } from '../server/tools/themeManager.js'
import { detectPathType, getWSLCommandArgs, isWindows } from '../server/utils/wslBridge.js'
import { OpenAiChatgptProvider } from '../server/headlessServer/providers/openaiChatgptProvider.js'
import { fetchOpenAIUsageStatus } from '../server/auth/codexUsage.js'

// Destructure autoUpdater from CommonJS module (ESM/CJS interop)
const { autoUpdater } = autoUpdaterPkg

// ESM: Get __dirname from import.meta.url
const __dirname = fileURLToPath(new URL('.', import.meta.url))
installWindowsWorkerEvidenceHost(app.getPath('userData'),app.isPackaged?path.join(process.resourcesPath,'hadron-worker'):path.resolve(__dirname,'..','vendor','hadron-worker'))
let mainWindow: BrowserWindow | null = null
let floatingWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let hadronChatgpt: HadronChatgptConnection | undefined
function getHadronChatgptConnection(): HadronChatgptConnection {
  if (!isHadronDesktop() || !app.isReady()) throw new Error('Hadron desktop connection unavailable')
  return hadronChatgpt ??= new HadronChatgptConnection({
    store: new HadronChatgptStore(app.getPath('userData'), safeStorage),
    withLease: work => withHadronAuthLease(app.getPath('userData'), work),
    openBrowser: url => {
      // Dedicated full-desktop test records non-secret intent without opening a real login.
      if (!app.isPackaged && process.env.HADRON_DESKTOP_SMOKE_PROFILE && process.env.HADRON_DESKTOP_SMOKE_LOGIN === '1') {
        const destination = new URL(url)
        fs.writeFileSync(path.join(app.getPath('userData'), 'browser-intent.json'), JSON.stringify({
          host: destination.host, path: destination.pathname, agentName: destination.searchParams.get('agent_name_hint'),
          dynamicClient: destination.searchParams.get('client_id') === 'dynamic_agent_client',
        }))
        return Promise.resolve()
      }
      return openHadronExternalWeb(url, value => shell.openExternal(value), true)
    }, onChanged: () => {
      collaborationAccess.revoke()
      // Small local status report lets support inspect a failed attempt without OAuth URLs/tokens.
      try {
        const status = hadronChatgpt?.status()
        if (!status) return
        const directory = path.join(app.getPath('userData'), 'subscription-auth')
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
        fs.writeFileSync(path.join(directory, 'last-signin-diagnostic.json'), JSON.stringify({ schemaVersion: 1,
          at: new Date().toISOString(), connected: status.connected, reason: status.reason, loginState: status.loginState,
          ...(status.loginError ? { diagnostic: status.loginError } : {}),
        }, null, 2), { mode: 0o600 })
      } catch { /* Diagnostics must never change account publication or cancellation. */ }
    },
  })
}
let hadronCodex: HadronCodexRuntime | undefined
function getHadronCodexRuntime(): HadronCodexRuntime {
  return hadronCodex ??= new HadronCodexRuntime({
    runtimeDirectory: app.isPackaged ? path.join(process.resourcesPath, 'codex') : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'codex'),
    nativeHostDirectory:app.isPackaged?path.join(process.resourcesPath,'hadron-worker'):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','vendor','hadron-worker'),
    profileDirectory: app.getPath('userData'), openBrowser: url => openHadronExternalWeb(url, value => shell.openExternal(value), true),
    onChanged: () => { collaborationAccess.revoke(); desktopCollaborationHost.allowedModels.clear() },
    onJobDiagnostic: diagnostic => {
      try {
        const directory = path.join(app.getPath('userData'), 'codex-runtime')
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
        fs.writeFileSync(path.join(directory, 'last-job-diagnostic.json'), JSON.stringify({ at: new Date().toISOString(), ...diagnostic }), { mode: 0o600 })
      } catch { /* Diagnostic storage must not affect the job result. */ }
    },
  })
}
const confirmQuit = createQuitConfirmationGuard({
  platform: process.platform,
  isReady: () => app.isReady(),
  confirm: () => {
    const options: Electron.MessageBoxSyncOptions = {
      type: 'question',
      title: `Quit ${hadronName}?`,
      message: `Are you sure you want to quit ${hadronName}?`,
      detail: 'Quitting stops running agents and closes terminal sessions.',
      buttons: ['Cancel', 'Quit'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }
    // Use an app-modal dialog even when the main window is hidden in the tray.
    return dialog.showMessageBoxSync(options) === 1
  },
})
let compactMode = false
let savedBounds: Electron.Rectangle | null = null
let localServerStarted = false
let localServerHandle: YggServerHandle | null = null
let localServerShutdown:Promise<void>|null=null
let projectShutdownFinished=false
let codexShutdown:Promise<void>|undefined
let codexShutdownFinished=false
let localServerPort: number | null = null
let localServerUrl: string | null = null
let localServerLanUrl: string | null = null
let localServerError: string | null = null

const LOCAL_SERVER_PREFERRED_PORT = isHadronDesktop() ? 0 : 3002
const LOCAL_SERVER_FALLBACK_PORTS = isHadronDesktop() ? [] : Array.from({ length: 13 }, (_, index) => LOCAL_SERVER_PREFERRED_PORT + 1 + index)
const localServerAllowRemoteEnvRaw = (process.env.YGG_LOCAL_SERVER_ALLOW_REMOTE || '').trim().toLowerCase()
const LOCAL_SERVER_ALLOW_REMOTE =
  localServerAllowRemoteEnvRaw.length > 0
    ? ['1', 'true', 'yes', 'on'].includes(localServerAllowRemoteEnvRaw)
    : true
const LOCAL_SERVER_HOST =
  process.env.YGG_LOCAL_SERVER_HOST?.trim() || (LOCAL_SERVER_ALLOW_REMOTE ? '0.0.0.0' : '127.0.0.1')
const LOCAL_SERVER_ADVERTISE_HOST =
  process.env.YGG_LOCAL_SERVER_ADVERTISE_HOST?.trim() ||
  (LOCAL_SERVER_HOST === '0.0.0.0' ? '127.0.0.1' : LOCAL_SERVER_HOST)
const LOCAL_SERVER_LAN_ADVERTISE_HOST = process.env.YGG_LOCAL_SERVER_LAN_ADVERTISE_HOST?.trim() || ''
const LOCAL_SERVER_ALLOW_EPHEMERAL_PORT = true
const BROWSER_SETTINGS_STORAGE_KEY = 'ygg_browser_settings'
const DEFAULT_GUEST_DEVTOOLS_ENABLED = true

// ---------------------------------------------------------------------------
// Local server liveness
//
// `localServerStarted` is a BOOT-TIME boolean: once the server starts it stays
// true even if the HTTP server later dies, so `sync:status` used to report a
// dead server as running forever. The renderer then either hangs on requests or,
// worse, times out `sync:status` and falls back to the hardcoded :3002 — which
// may be a DIFFERENT app instance's server.
//
// So `sync:status` now live-probes `/api/health` (which existed and was called
// from nowhere). The probe is cached for a couple of seconds so a burst of
// `sync:status` calls costs one socket, not N.
// ---------------------------------------------------------------------------
const LOCAL_SERVER_HEALTH_TIMEOUT_MS = 1200
const LOCAL_SERVER_HEALTH_CACHE_TTL_MS = 2000

interface LocalServerHealth {
  /** Our own local server answered `/api/health` correctly. */
  ok: boolean
  /** Something answered, but it is not this instance's local server. */
  foreign: boolean
  error: string | null
}

let cachedLocalServerHealth: LocalServerHealth | null = null
let cachedLocalServerHealthAt = 0
let cachedLocalServerHealthPort: number | null = null
let pendingLocalServerHealthProbe: Promise<LocalServerHealth> | null = null

function requestLocalServerHealth(port: number): Promise<LocalServerHealth> {
  return new Promise<LocalServerHealth>(resolve => {
    let settled = false
    const finish = (result: LocalServerHealth) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
        timeout: LOCAL_SERVER_HEALTH_TIMEOUT_MS,
        headers: { accept: 'application/json' },
      },
      response => {
        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          // The payload is tiny; cap it so a wrong server on this port cannot stream at us.
          if (size >= 8192) return
          chunks.push(chunk)
          size += chunk.length
        })
        response.on('error', (error: Error) => finish({ ok: false, foreign: false, error: error.message }))
        response.on('end', () => {
          if (response.statusCode !== 200) {
            finish({ ok: false, foreign: false, error: `/api/health returned HTTP ${response.statusCode}` })
            return
          }

          let payload: Record<string, unknown> | null = null
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            payload = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
          } catch {
            payload = null
          }

          if (payload?.status !== 'ok' || payload?.mode !== 'local-sync') {
            finish({
              ok: false,
              foreign: true,
              error: `port ${port} is answering, but not as this app's local sync server`,
            })
            return
          }

          // Missing or mismatched ownership is never accepted: a legacy Graviton
          // server on the same port is not this process's database.
          const reportedPid = typeof payload.pid === 'number' ? payload.pid : null
          if (reportedPid !== process.pid || (isHadronDesktop() && !isOwnedHadronHealth(payload, process.pid))) {
            finish({
              ok: false,
              foreign: true,
              error: `port ${port} is served by another app instance (pid ${reportedPid})`,
            })
            return
          }

          finish({ ok: true, foreign: false, error: null })
        })
      }
    )

    request.on('timeout', () => {
      request.destroy()
      finish({ ok: false, foreign: false, error: `/api/health did not answer within ${LOCAL_SERVER_HEALTH_TIMEOUT_MS}ms` })
    })
    request.on('error', (error: Error) => finish({ ok: false, foreign: false, error: error.message }))
    request.end()
  })
}

async function probeLocalServerHealth(): Promise<LocalServerHealth> {
  if (!localServerStarted || localServerPort == null) {
    return { ok: false, foreign: false, error: localServerError ?? 'Local server has not been started.' }
  }

  const port = localServerPort
  const now = Date.now()

  // Any restart lands on a (possibly) different port — that invalidates the cache
  // without needing to reach into the start/stop paths.
  if (cachedLocalServerHealthPort !== port) {
    cachedLocalServerHealth = null
    cachedLocalServerHealthAt = 0
    cachedLocalServerHealthPort = port
  }

  if (cachedLocalServerHealth && now - cachedLocalServerHealthAt < LOCAL_SERVER_HEALTH_CACHE_TTL_MS) {
    return cachedLocalServerHealth
  }

  if (pendingLocalServerHealthProbe) return pendingLocalServerHealthProbe

  pendingLocalServerHealthProbe = requestLocalServerHealth(port)
    .then(result => {
      cachedLocalServerHealth = result
      cachedLocalServerHealthAt = Date.now()
      cachedLocalServerHealthPort = port
      return result
    })
    .finally(() => {
      pendingLocalServerHealthProbe = null
    })

  return pendingLocalServerHealthProbe
}


function isPrivateIpv4(address: string): boolean {
  if (address.startsWith('10.')) return true
  if (address.startsWith('192.168.')) return true
  if (!address.startsWith('172.')) return false
  const secondOctet = Number(address.split('.')[1])
  return Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31
}

function detectPreferredLanIpv4(): string | null {
  if (LOCAL_SERVER_LAN_ADVERTISE_HOST) {
    return LOCAL_SERVER_LAN_ADVERTISE_HOST
  }

  const interfaces = os.networkInterfaces()
  const candidates: string[] = []

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue
    for (const entry of entries) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue
      candidates.push(entry.address)
    }
  }

  if (candidates.length === 0) return null

  const privateCandidate = candidates.find(isPrivateIpv4)
  return privateCandidate || candidates[0] || null
}
const activeReadStreams = new Map<
  string,
  {
    stream: fs.ReadStream
    sender: Electron.WebContents
    loaded: number
    total: number | null
    aborted: boolean
    abortedSent: boolean
  }
>()

type TerminalSessionRecord = {
  sessionId: string
  pty: import('node-pty').IPty
  sender: Electron.WebContents
  cwd: string
  shell: string
  cols: number
  rows: number
}

const activeTerminalSessions = new Map<string, TerminalSessionRecord>()

function getNodePtyModule(): typeof import('node-pty') {
  return require('node-pty') as typeof import('node-pty')
}

function makeTerminalSessionId(): string {
  return `terminal_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function clampTerminalDimension(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value as number)))
}

function normalizeTerminalCwd(inputCwd?: string): string {
  const trimmed = inputCwd?.trim()
  if (!trimmed) {
    return process.cwd()
  }

  if (!isWindows()) {
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(trimmed)
  }

  const pathType = detectPathType(trimmed)
  if (pathType === 'linux') {
    return trimmed
  }
  if (pathType === 'windows') {
    return path.win32.normalize(trimmed)
  }
  return path.win32.resolve(trimmed)
}

async function resolveTerminalLaunch(inputCwd?: string): Promise<{
  file: string
  args: string[]
  spawnCwd: string
  displayCwd: string
  shellLabel: string
}> {
  const normalizedCwd = normalizeTerminalCwd(inputCwd)

  if (!isWindows()) {
    const shellPath = process.env.SHELL?.trim() || '/bin/bash'
    return {
      file: shellPath,
      args: ['-i'],
      spawnCwd: normalizedCwd,
      displayCwd: normalizedCwd,
      shellLabel: path.posix.basename(shellPath) || shellPath,
    }
  }

  if (detectPathType(normalizedCwd) === 'linux') {
    const [file, args] = await getWSLCommandArgs('bash', ['-i'], normalizedCwd)
    return {
      file,
      args,
      spawnCwd: process.cwd(),
      displayCwd: normalizedCwd,
      shellLabel: 'wsl bash',
    }
  }

  const configuredShell = process.env.YGG_TERMINAL_SHELL?.trim()
  const shellPath = configuredShell || 'powershell.exe'
  const shellBaseName = path.win32.basename(shellPath).toLowerCase()
  const args = shellBaseName === 'powershell.exe' || shellBaseName === 'pwsh.exe' ? ['-NoLogo'] : []

  return {
    file: shellPath,
    args,
    spawnCwd: normalizedCwd,
    displayCwd: normalizedCwd,
    shellLabel: path.win32.basename(shellPath) || shellPath,
  }
}

function sendTerminalEvent(sender: Electron.WebContents, channel: string, payload: Record<string, any>): void {
  if (!sender.isDestroyed()) {
    sender.send(channel, payload)
  }
}

function destroyTerminalSession(sessionId: string): boolean {
  const session = activeTerminalSessions.get(sessionId)
  if (!session) return false
  activeTerminalSessions.delete(sessionId)
  try {
    session.pty.kill()
  } catch (error) {
    console.warn('[Electron Terminal] Failed to kill session:', error)
  }
  return true
}

function cleanupTerminalSessionsForSender(sender: Electron.WebContents): void {
  const ownedSessionIds: string[] = []

  for (const [sessionId, session] of activeTerminalSessions.entries()) {
    if (session.sender.id === sender.id) {
      ownedSessionIds.push(sessionId)
    }
  }

  for (const sessionId of ownedSessionIds) {
    destroyTerminalSession(sessionId)
  }
}

// Custom protocol for OAuth callbacks
const PROTOCOL = hadronProtocol
const UPDATE_FEED_BASE_URL =
  process.env.SUPABASE_UPDATE_FEED_BASE_URL || 'https://auth.yggchat.com/storage/v1/object/public/updates/updates'
const CLIENT_ERROR_LOG_FILENAME = 'client-errors.ndjson'
let autoUpdaterConfigured = false

function getClientErrorLogPath(): string {
  const logsDir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }
  return path.join(logsDir, CLIENT_ERROR_LOG_FILENAME)
}

const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on'])

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  return TRUTHY_ENV_VALUES.has(value.trim().toLowerCase())
}

function isEnvDevMode(): boolean {
  const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase()
  if (nodeEnv === 'development' || nodeEnv === 'dev') {
    return true
  }

  return isTruthyEnv(process.env.DEBUG) || isTruthyEnv(process.env.ELECTRON_DEVTOOLS)
}

const isNpmElectronRun = (process.env.npm_lifecycle_event || '').trim().toLowerCase() === 'electron'
const hasDebugModeArg = process.argv.includes('--debug-mode')
const isDebugMode = isEnvDevMode() || isNpmElectronRun || hasDebugModeArg
const shouldOpenDetachedDevTools = isDebugMode

// Set App User Model ID for Windows taskbar icon
if (process.platform === 'win32') {
  app.setAppUserModelId(hadronAppId)
}

// Use system theme by default for native UI (context menus, dialogs, mica material).
// Renderer can override this via ipc "theme:update".
nativeTheme.themeSource = 'system'


// Persistent storage for session data (initialized async)
let store: any = null
let storeInitialized = false

// In-memory fallback storage
const memoryStore = new Map<string, any>()

// Initialize conf (ESM module)
async function initializeStore() {
  try {
    const configDir = runtimeConfOptions().cwd!
    const configFile = path.join(configDir, 'config.json')

    // Check if config file exists and is corrupted
    if (fs.existsSync(configFile)) {
      try {
        const content = fs.readFileSync(configFile, 'utf-8')
        // Try to parse to validate JSON
        JSON.parse(content)
      } catch (parseError) {
        console.warn('[Electron] Config file corrupted, removing:', configFile)
        try {
          fs.unlinkSync(configFile)
        } catch (unlinkError) {
          console.warn('[Electron] Failed to remove corrupted config file:', unlinkError)
        }
      }
    }

    // Initialize conf (ESM library)
    store = new Conf({
      ...runtimeConfOptions(),
      configFileMode: 0o600,
    })
    storeInitialized = true
    console.log('[Electron] Storage initialized successfully (conf)')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('[Electron] Failed to initialize conf storage')
    console.error('[Electron] Error message:', errorMsg)
    console.error('[Electron] Error stack:', errorStack)
    console.warn('[Electron] ⚠️  Using in-memory fallback storage')
    console.warn('[Electron] Note: Data will not persist after app restart')
    storeInitialized = true // Mark as initialized even with fallback
  }
}

// Helper functions for storage access with fallback
function getFromStore(key: string): any {
  if (!storeInitialized) {
    console.warn('[Electron] Store not yet initialized')
    return null
  }

  try {
    if (store) {
      return store.get(key)
    } else {
      // Use in-memory fallback
      return memoryStore.get(key) || null
    }
  } catch (error) {
    console.error('[Electron] Error reading from store:', error)
    return memoryStore.get(key) || null
  }
}

function setInStore(key: string, value: any): boolean {
  if (!storeInitialized) {
    console.warn('[Electron] Store not yet initialized')
    return false
  }

  try {
    if (store) {
      store.set(key, value)
      return true
    } else {
      // Use in-memory fallback
      memoryStore.set(key, value)
      return true
    }
  } catch (error) {
    console.error('[Electron] Error writing to store:', error)
    // Fallback to memory
    memoryStore.set(key, value)
    return false
  }
}

function deleteFromStore(key: string): boolean {
  if (!storeInitialized) {
    console.warn('[Electron] Store not yet initialized')
    return false
  }

  try {
    if (store) {
      store.delete(key)
      return true
    } else {
      memoryStore.delete(key)
      return true
    }
  } catch (error) {
    console.error('[Electron] Error deleting from store:', error)
    memoryStore.delete(key)
    return false
  }
}
function clearStore(): boolean {
  if (!storeInitialized) {
    console.warn('[Electron] Store not yet initialized')
    return false
  }

  try {
    if (store) {
      store.clear()
      return true
    } else {
      memoryStore.clear()
      return true
    }
  } catch (error) {
    console.error('[Electron] Error clearing storage:', error)
    memoryStore.clear()
    return false
  }
}

function isGuestBrowserDevToolsEnabled(): boolean {
  if (!storeInitialized) {
    return DEFAULT_GUEST_DEVTOOLS_ENABLED
  }

  try {
    const storedSettings = getFromStore(BROWSER_SETTINGS_STORAGE_KEY)
    if (storedSettings && typeof storedSettings === 'object' && typeof storedSettings.guestDevToolsEnabled === 'boolean') {
      return storedSettings.guestDevToolsEnabled
    }
  } catch (error) {
    console.error('[Electron] Failed to read browser settings from storage:', error)
  }

  return DEFAULT_GUEST_DEVTOOLS_ENABLED
}

function syncLmStudioBaseUrlFromStore(): void {
  try {
    const providerSettings = getFromStore('ygg_provider_settings')
    const rawValue = typeof providerSettings?.lmStudioBaseUrl === 'string' ? providerSettings.lmStudioBaseUrl.trim() : ''
    if (rawValue) {
      const normalized = rawValue.replace(/\/+$/, '').replace(/\/v1$/i, '')
      process.env.LMSTUDIO_BASE_URL = `${normalized}/v1`
      return
    }
  } catch (error) {
    console.error('[Electron] Failed to sync LM Studio base URL from storage:', error)
  }

  delete process.env.LMSTUDIO_BASE_URL
}

function syncOpenAiChatGptMaxContextFromStore(): void {
  try {
    const providerSettings = getFromStore('ygg_provider_settings')
    const rawValue = providerSettings?.openAiChatGptMaxContextTokens
    if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
      process.env.YGG_OPENAI_CHATGPT_MAX_CONTEXT_TOKENS = String(Math.floor(rawValue))
      return
    }
  } catch (error) {
    console.error('[Electron] Failed to sync ChatGPT max context from storage:', error)
  }

  delete process.env.YGG_OPENAI_CHATGPT_MAX_CONTEXT_TOKENS
}

function getOpenAiPromptCacheRetentionFromStore(): 'in_memory' | '24h' {
  try {
    const providerSettings = getFromStore('ygg_provider_settings')
    return providerSettings?.openAiPromptCacheRetention === '24h' ? '24h' : 'in_memory'
  } catch {
    return 'in_memory'
  }
}

// Helper to get icon path

function getIconPath(_isDark?: boolean) {
  const logoFile = isHadronDesktop() ? (process.platform === 'win32' ? 'hadron.ico' : 'hadron.png') : (process.platform === 'win32' ? 'graviton-dark1.ico' : 'graviton-dark.png')
  const iconBasePath = app.isPackaged ? path.join(__dirname, '../dist-electron/img') : path.join(__dirname, '../public/img')
  const preferredIconPath = path.join(iconBasePath, logoFile)

  if (process.platform === 'win32' && !fs.existsSync(preferredIconPath)) {
    return path.join(iconBasePath, 'graviton-dark.png')
  }

  return preferredIconPath
}

// function applyTitleBarTheme(win: BrowserWindow, isDark?: boolean) {
//   // Only apply overlay on Windows where it's supported and requested, AND ONLY IN PRODUCTION
//   if (process.platform === 'win32' && app.isPackaged) {
//     // Use provided isDark value, or fall back to system preference
//     const useDark = isDark !== undefined ? isDark : nativeTheme.shouldUseDarkColors
//     win.setTitleBarOverlay({
//       color: 'transparent',
//       symbolColor: useDark ? '#f2f4f7' : '#0f172a',
//       height: 35, // Ensure there is a grippable area
//     })
//   }

//   // Update Window Icon
//   const useDark = isDark !== undefined ? isDark : nativeTheme.shouldUseDarkColors
//   win.setIcon(getIconPath(useDark))
// }

// nativeTheme.on('updated', () => {
//   if (mainWindow) applyTitleBarTheme(mainWindow)
// })

function isWindows11(): boolean {
  return process.platform === 'win32' && Number(os.release().split('.')[2] ?? 0) >= 22000
}

function createWindow() {
  const iconPath = getIconPath(nativeTheme.shouldUseDarkColors)
  const isWin11 = isWindows11()

  mainWindow = new BrowserWindow({
    title: hadronName,
    icon: iconPath,
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      backgroundThrottling: false, // Keep task completion checks timely while minimized.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true, // Enable webview for YouTube embeds (fixes Error 153)
      spellcheck: true,
    },
    // Platform-specific title bar settings
    ...(process.platform === 'win32'
      ? {
          frame: false,
          titleBarOverlay: false,
          backgroundMaterial: isWin11 ? 'acrylic' : 'none',
        }
      : process.platform === 'darwin'
        ? {
            titleBarStyle: 'hiddenInset',
            vibrancy: 'under-window',
            visualEffectState: 'active',
          }
        : {
            // Linux needs a frameless transparent window so the renderer can clip
            // the app shell into rounded corners consistently across WMs.
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            hasShadow: true,
          }),
    show: false, // Don't show until ready
  })

  if (process.platform === 'win32' && isWin11) {
    mainWindow.setBackgroundMaterial('acrylic')
  }

  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonPosition({ x: 14, y: 13 })
  }

  const sendWindowState = () => {
    if (!mainWindow || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send('window:state-changed', {
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
    })
  }

  mainWindow.on('maximize', sendWindowState)
  mainWindow.on('unmaximize', sendWindowState)
  mainWindow.on('enter-full-screen', sendWindowState)
  mainWindow.on('leave-full-screen', sendWindowState)
  mainWindow.webContents.once('did-finish-load', sendWindowState)
  mainWindow.on('focus',()=>{if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.flashFrame(false);mainWindow.setProgressBar(-1)}})

  // Never let target=_blank/window.open create an untrusted Electron window.
  // Route ordinary web links to the user's OS default browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        void openHadronExternalWeb(parsedUrl.toString(), value => shell.openExternal(value)).catch(error => {
          console.error('[Electron] Failed to open external link:', error)
        })
      }
    } catch (error) {
      console.error('[Electron] Refused invalid external link:', url, error)
    }

    return { action: 'deny' }
  })

  // applyTitleBarTheme(mainWindow)

  // Show window when ready to avoid flicker
  mainWindow.once('ready-to-show', () => {
    if (isHadronDesktop()) mainWindow?.maximize()
    mainWindow?.show()
  })

  // Load the app
  // Use app.isPackaged for reliable detection (true when running from installer)
  const isDev = !app.isPackaged && !(isHadronDesktop() && process.env.HADRON_USE_BUILT_RENDERER === '1')

  if (!isDev) {
    mainWindow.setMenu(null) // removes File/Edit/View in production
    mainWindow.removeMenu() // defensive (older Electron versions)
  }

  if (isDev) {
    // Development: Load from Vite dev server
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // Production: Load from built files
    const indexPath = path.join(__dirname, '../dist-electron/index.html')
    console.log('[Electron] Production mode - loading from:', indexPath)

    // Add error listeners BEFORE loading
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[Electron] Failed to load:', { errorCode, errorDescription, validatedURL })
    })

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Electron] Page finished loading')
    })

    // mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    //   // console.log('[Renderer Console]', { level, message, line, sourceId })
    // })

    mainWindow.loadFile(indexPath)

    // DEBUG: Force DevTools to open after a delay
    if (!app.isPackaged && process.env.HADRON_USE_BUILT_RENDERER !== '1') {
      // if (true) {
      setTimeout(() => {
        console.log('[Electron] Force opening DevTools...')
        mainWindow?.webContents.openDevTools({ mode: 'detach' })
      }, 3000)
    }
  }

  if (shouldOpenDetachedDevTools) {
    // Open detached devtools as soon as possible, then retry once after load for reliability.
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    mainWindow.webContents.once('did-finish-load', () => {
      if (!mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow?.webContents.openDevTools({ mode: 'detach' })
      }
    })
  }

  mainWindow.on('close', event => {
    if (isHadronDesktop() && !isQuitting) {
      event.preventDefault()
      app.quit()
      return
    }
    // In debug/dev mode we want a normal close so each `npm run electron` starts fresh.
    if (!isQuitting && !isDebugMode) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Custom context menu with spell check
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    // Spell check suggestions
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        menuItems.push({
          label: suggestion,
          click: () => mainWindow?.webContents.replaceMisspelling(suggestion),
        })
      }
      if (params.dictionarySuggestions.length > 0) {
        menuItems.push({ type: 'separator' })
      }
      menuItems.push({
        label: 'Add to Dictionary',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      })
      menuItems.push({ type: 'separator' })
    }

    // Standard edit actions
    menuItems.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    )

    Menu.buildFromTemplate(menuItems).popup()
  })
}

function createTray() {
  if (tray) return

  const iconPath = getIconPath(nativeTheme.shouldUseDarkColors)
  let trayIcon = nativeImage.createFromPath(iconPath)

  if (process.platform === 'darwin') {
    // Menu-bar icons use point dimensions, unlike application/window icons.
    // Keep the full-color app artwork rather than converting it to a monochrome template glyph.
    trayIcon = trayIcon.resize({ width: 18, height: 18 })
  }

  tray = new Tray(trayIcon)
  tray.setToolTip(hadronName)
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
}

// Create a floating popup window (like picture-in-picture)
function createFloatingWindow() {
  if (floatingWindow) {
    floatingWindow.focus()
    return
  }

  const iconPath = getIconPath(nativeTheme.shouldUseDarkColors)

  floatingWindow = new BrowserWindow({
    title: `${hadronName} - Floating`,
    icon: iconPath,
    width: 600,
    height: 400,
    minWidth: 300,
    minHeight: 200,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true, // Enable webview for YouTube embeds (fixes Error 153)
      spellcheck: true,
    },
  })

  // Set floating level for better visibility over fullscreen apps
  floatingWindow.setAlwaysOnTop(true, 'floating', 1)
  // Make window visible on all workspaces (including fullscreen apps)
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Disable fullscreen to keep it as a floating window
  floatingWindow.setFullScreenable(false)

  // Show window when ready to avoid flicker
  floatingWindow.once('ready-to-show', () => {
    floatingWindow?.show()
  })

  // Load the app - use the same URL as main window
  const isDev = !app.isPackaged && !(isHadronDesktop() && process.env.HADRON_USE_BUILT_RENDERER === '1')

  if (isDev) {
    floatingWindow.loadURL('http://localhost:5173')
  } else {
    const indexPath = path.join(__dirname, '../dist-electron/index.html')
    floatingWindow.loadFile(indexPath)
  }

  if (shouldOpenDetachedDevTools) {
    floatingWindow.webContents.openDevTools({ mode: 'detach' })
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null
  })

  // Custom context menu with spell check
  floatingWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    // Spell check suggestions
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        menuItems.push({
          label: suggestion,
          click: () => floatingWindow?.webContents.replaceMisspelling(suggestion),
        })
      }
      if (params.dictionarySuggestions.length > 0) {
        menuItems.push({ type: 'separator' })
      }
      menuItems.push({
        label: 'Add to Dictionary',
        click: () => floatingWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      })
      menuItems.push({ type: 'separator' })
    }

    // Standard edit actions
    menuItems.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    )

    Menu.buildFromTemplate(menuItems).popup()
  })
}

// Toggle floating window on/off
function toggleFloatingWindow() {
  if (floatingWindow) {
    floatingWindow.close()
    floatingWindow = null
  } else {
    createFloatingWindow()
  }
}

// Private diagnostics/fixtures must never replace the normal sign-in handler.
if (!hadronIsolatedTestProfile) {
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}
}

// Handle protocol on macOS
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleOAuthCallback(url)
})

// Handle protocol on Windows/Linux (via second instance)
// In debug mode, allow multiple instances so `npm run electron` always opens its own fresh window.
if (!isDebugMode) {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    diagnosticRecorder?.fail('instance_lock_denied')
    app.quit()
  } else {
    diagnosticRecorder?.mark('instance_lock_acquired')
    app.on('second-instance', (_event, commandLine) => {
      // Someone tried to run a second instance, we should focus our window.
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }

      // The commandLine is an array of strings in which the last element is the deep link url
      // On Windows/Linux, the protocol URL will be in the command line arguments
      const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`))
      if (url) {
        handleOAuthCallback(url)
      }
    })
  }
} else {
  console.log('[Electron] Debug mode enabled: single-instance lock disabled')
}

async function syncAuthenticatedProfile(user: any): Promise<void> {
  if (!localServerPort) throw new Error('Local service is not ready')
  const response = await fetch(`http://127.0.0.1:${localServerPort}/api/local/users/merge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromUserId: 'a7c485cb-99e7-4cf2-82a9-6e23b55cdfc3', toUserId: user.id, toUsername: user.user_metadata?.name || user.email?.split('@')[0] || 'user', toCreatedAt: user.created_at }),
  })
  if (!response.ok) throw new Error('Signed in, but local profile synchronization failed. Retry signing in.')
}
// Handle OAuth callback from external browser
function handleOAuthCallback(url: string) {
  void completeAppCallback(url).then(async result => { await syncAuthenticatedProfile(result.user); mainWindow?.webContents.send('auth:changed', publicAuthState()) }).catch(() => mainWindow?.webContents.send('auth:login-error', 'Sign-in could not be completed. Please try again.'))
  if (mainWindow && mainWindow.webContents) {

    // Focus the window
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
}

// App lifecycle
app.whenReady().then(async () => {
  diagnosticRecorder?.mark('app_ready')
  try {
    await initializeStore()
    syncLmStudioBaseUrlFromStore()
    syncOpenAiChatGptMaxContextFromStore()
    process.env.YGG_APP_USER_DATA = app.getPath('userData')
    // themeManager resolves its directories from the injected host context,
    // which createYggServer configures only later in this function. These env
    // overrides (first in its resolution chain, inherited by the tool sandbox
    // child) pin the pre-migration desktop paths for the early init below.
    // Without them a Finder launch (cwd "/") hit the cwd fallback, failed
    // mkdir '/.ygg', and the catch below quit the app.
    process.env.YGG_THEME_DIRECTORY ||= path.join(app.getPath('userData'), '.ygg', 'custom-themes')
    process.env.YGG_THEME_TEMPLATE_DIRECTORY ||= path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      '.ygg',
      'custom-themes'
    )
    if(!executionStartup.holdsLegacyStartup()){
      const managedHooksDirectory = await ensureManagedHooksInitialized()
      console.log(`[Electron] Managed hooks directory ready at: ${managedHooksDirectory}`)
      const managedCustomToolsDirectory = await ensureManagedCustomToolsInitialized()
      console.log(`[Electron] Managed custom tools directory ready at: ${managedCustomToolsDirectory}`)
    }
    try {
      const managedThemesDirectory = await ensureManagedThemesInitialized()
      console.log(`[Electron] Managed themes directory ready at: ${managedThemesDirectory}`)
    } catch (themeInitError) {
      // Theme seeding must never take the whole app down.
      console.warn('[Electron] Managed themes initialization failed (continuing):', themeInitError)
    }

    if (isDebugMode) {
      const debugReasons: string[] = []
      if (isEnvDevMode()) debugReasons.push('NODE_ENV/developer env')
      if (isNpmElectronRun) debugReasons.push('npm_lifecycle_event=electron')
      if (hasDebugModeArg) debugReasons.push('--debug-mode arg')
      console.log(`[Electron] Debug mode enabled (${debugReasons.join(', ') || 'manual'})`)
    }

    // Hadron uses an OS-assigned loopback port; never shadow Graviton on 3002.
    console.log(
      `[Electron] Local server bind host: ${LOCAL_SERVER_HOST}, advertise host: ${LOCAL_SERVER_ADVERTISE_HOST}, remote access: ${LOCAL_SERVER_ALLOW_REMOTE}`
    )
    try {
      // Shared factory (Phase 1 server/client separation): Electron supplies
      // paths/capabilities; the runtime-neutral graph owns everything else.
      localServerHandle = await createYggServer(
        buildElectronServerConfig({
          bindHost: LOCAL_SERVER_HOST,
          preferredPort: LOCAL_SERVER_PREFERRED_PORT,
          fallbackPorts: LOCAL_SERVER_FALLBACK_PORTS,
          allowEphemeralPort: LOCAL_SERVER_ALLOW_EPHEMERAL_PORT,
        }),
        buildElectronHostCapabilities({
          get: key => getFromStore(key),
          set: (key, value) => { if (key.startsWith('managed_auth') && !store) throw new Error('Durable authentication storage is unavailable'); if (!setInStore(key, value)) throw new Error('Settings persistence failed') },
          delete: key => { if (!deleteFromStore(key)) throw new Error('Settings deletion failed') },
        })
      )
      powerMonitor.on('resume', () => { void getAuthManager().check().catch(() => undefined) })
      localServerStarted = true
      diagnosticRecorder?.mark('server_ready')
      localServerPort = localServerHandle.port
      localServerUrl = `http://${LOCAL_SERVER_ADVERTISE_HOST}:${localServerHandle.port}`
      const detectedLanHost = LOCAL_SERVER_ALLOW_REMOTE ? detectPreferredLanIpv4() : null
      localServerLanUrl = detectedLanHost ? `http://${detectedLanHost}:${localServerHandle.port}` : null
      localServerError = null
      process.env.YGG_LOCAL_SERVER_PORT = String(localServerHandle.port)
      process.env.YGG_LOCAL_SERVER_URL = localServerUrl
      if (localServerLanUrl) {
        process.env.YGG_LOCAL_SERVER_LAN_URL = localServerLanUrl
      } else {
        delete process.env.YGG_LOCAL_SERVER_LAN_URL
      }
      console.log(
        `[Electron] Local sync server started on ${localServerHandle.origin} (renderer endpoint: ${localServerUrl}, lan endpoint: ${localServerLanUrl || 'n/a'})`
      )
    } catch (localServerStartError) {
      console.warn('[Electron] Failed to start local sync server:', localServerStartError)
      console.warn('[Electron] Continuing without local sync - data will not be synced locally')
      localServerStarted = false
      localServerHandle = null
      localServerPort = null
      localServerUrl = null
      localServerLanUrl = null
      delete process.env.YGG_LOCAL_SERVER_PORT
      delete process.env.YGG_LOCAL_SERVER_URL
      delete process.env.YGG_LOCAL_SERVER_LAN_URL
      localServerError =
        localServerStartError instanceof Error
          ? localServerStartError.message
          : `Failed to start local server: ${localServerStartError}`
    }

    // console.log('[Electron] Creating window...')
    createWindow()
    if (!isDebugMode) {
      createTray()
    }
    configureAutoUpdater()
  } catch (error) {
    diagnosticRecorder?.fail('startup_failed')
    console.error('[Electron] Failed to start:', error)
    isQuitting = true // Startup failure is not a user-initiated quit.
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (!isQuitting && !isDebugMode) {
    return
  }
  // Stop local sync server (close() is single-flight and idempotent)
  if (localServerStarted) {
    console.log('[Electron] Stopping local sync server...')
    localServerShutdown=localServerHandle?.close()??null
    void localServerShutdown?.catch(err => console.error('[Electron] Error stopping local server:', err))
    localServerHandle = null
    localServerStarted = false
    localServerPort = null
    localServerUrl = null
    localServerLanUrl = null
    delete process.env.YGG_LOCAL_SERVER_PORT
    delete process.env.YGG_LOCAL_SERVER_URL
    delete process.env.YGG_LOCAL_SERVER_LAN_URL
    localServerError = null
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Electron's updater emits this before its quit sequence; never block a restart
// that the user already requested by installing an update.
nativeAutoUpdater.on('before-quit-for-update', () => {
  isQuitting = true
  desktopContinuousHost.service?.beginShutdown()
})

app.on('before-quit', event => {
  if (!isQuitting && !confirmQuit()) {
    event.preventDefault()
    return
  }

  isQuitting = true
  getClaudeRuntime()?.cancelSignIn()
  hadronChatgpt?.cancelSignIn()
  void hadronCodex?.cancelSignIn()
  hadronCodex?.cancelConnectionTest()
  hadronCodex?.cancelJobs()
  // A cancellation request alone does not prove a status/login/provider child
  // has closed. Repeated Quit cannot bypass this current-host worker join.
  if(!codexShutdownFinished){
    event.preventDefault()
    codexShutdown??=Promise.all([hadronCodex?.shutdown(),getClaudeRuntime()?.shutdown()]).then(()=>{})
    void codexShutdown.then(()=>{if(!codexShutdownFinished){codexShutdownFinished=true;app.quit()}})
    return
  }
  for (const sessionId of Array.from(activeTerminalSessions.keys())) {
    destroyTerminalSession(sessionId)
  }
  // Wait for confirmed project-worker termination and draft lease closure before
  // destroying the main process. Repeated Quit never bypasses this join.
  if(!projectShutdownFinished&&(localServerShutdown||desktopProjectDraftHost.service&&localServerHandle)){
    event.preventDefault()
    if(!localServerShutdown)localServerShutdown=localServerHandle!.close()
    void localServerShutdown.catch(error=>console.error('[Hadron] Project shutdown retained recovery state:',error))
      .finally(()=>{if(!projectShutdownFinished){projectShutdownFinished=true;app.quit()}})
    return
  }
  // Ensure local sync server is stopped (close() is single-flight and idempotent)
  if (localServerStarted) {
    localServerHandle?.close().catch(err => console.error('[Electron] Error stopping local server on quit:', err))
    localServerHandle = null
    localServerStarted = false
    localServerPort = null
    localServerUrl = null
    localServerLanUrl = null
    delete process.env.YGG_LOCAL_SERVER_PORT
    delete process.env.YGG_LOCAL_SERVER_URL
    delete process.env.YGG_LOCAL_SERVER_LAN_URL
    localServerError = null
  }

  if (tray) {
    tray.destroy()
    tray = null
  }
})

// IPC Handlers for Electron-specific features

// Authentication (optional - for cloud sync)
authHandle('auth:login', async (_event, _credentials) => {
  // In Electron, we can store credentials securely using electron-store or keytar
  // For now, return a simple success
  // console.log('[Electron IPC] auth:login called')
  if (_credentials?.email || _credentials?.password) throw new Error('Use Google or GitHub sign-in')
  return enableLocalLogin()
})

authHandle('auth:logout', async () => {
  desktopContinuousHost.service?.stopAll()
  projectReadHost.clear()
  projectAgentHost.clear()
  desktopProjectDraftHost.service?.revokeSelections()
  // console.log('[Electron IPC] auth:logout called')
  cancelAppLogin()
  hadronCodex?.cancelJobs();getClaudeRuntime()?.cancelJobs();desktopCollaborationHost.allowedClaudeModels.clear();desktopContinuousHost.service?.stopAll();desktopCollaborationHost.allowedModels.clear(); collaborationAccess.revoke()
  return disconnectAuth('app')
})

// Phase 4 Slice 2 — server as sole Supabase-token refresher.
// The renderer delegates its token refresh here; the shared single-flight
// AppAuthTokenManager (same instance the cloud gateway uses) rotates the Conf
// `auth_session` at most once process-wide. Gated on the server `gateway.tokenOwner`
// flag: when off we report ownerEnabled:false so the renderer keeps self-refreshing
// (safe fallback / no half-rollout). Never throws — errors degrade to ownerEnabled:false.
function authHandle(channel: string, handler: (...args: any[]) => any): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted auth caller')
    return handler(event, ...args)
  })
}
authHandle('auth:status', () => publicAuthState())
const collaborationAccess = createDesktopCollaborationAccess(() => {
  const state = publicAuthState()
  if (!state.user) return null
  return { ownerId: state.user.id,
    sessionId: `${process.pid}:${getAuthManager().generation('app')}:${state.codex.sessionId ?? 'none'}:${getClaudeRuntime()?.generation ?? 0}:${hadronChatgpt?.generation ?? 0}:${hadronCodex?.generation ?? 0}` }
})
desktopCollaborationHost.install(collaborationAccess.authenticatedOwner)
desktopCollaborationHost.installNativeProvider((input, emit) => getHadronCodexRuntime().generate(input, emit))
desktopCollaborationHost.installNativeClaude((input,emit)=>{const runtime=getClaudeRuntime();if(!runtime)throw Error('Claude runtime unavailable');return runtime.generate(input,emit)})
if(HADRON_LIVE_COLLABORATION_ENABLED)desktopProjectDraftHost.enable()

function projectDraftOwner():string{
  const owner=publicAuthState().user?.id
  if(!owner)throw Error('Local project owner unavailable')
  return owner
}
projectApplicationAuthority.install(async request=>{
  if(projectDraftOwner()!==request.owner)throw Error('Local project owner changed')
  const result=await dialog.showMessageBox(mainWindow!,{type:'question',title:'Allow file changes?',
    message:`Apply ${request.files.length} file change(s)?`,
    detail:`${request.task}\n\n${request.files.map(file=>`${file.before===null?'Create':'Replace'}: ${file.path}`).join('\n')}\n\nThe changes are available in Hadron if you want to inspect them. Original files are backed up. Tests and checks are reported separately.`,
    buttons:['Cancel','Apply changes'],defaultId:0,cancelId:0,noLink:true})
  if(projectDraftOwner()!==request.owner)throw Error('Local project owner changed')
  return result.response===1
})
projectApplicationAuthority.installAutomation(async request=>{
  if(projectDraftOwner()!==request.owner)throw Error('Local project owner changed')
  const result=await dialog.showMessageBox(mainWindow!,{type:'question',title:'Approve bounded build/test/fix run',message:'Apply, test and repair within this scope?',
    detail:`Project: ${request.root}\nGoal: ${request.task}\n\nFiles allowed to change:\n${request.paths.join('\n')}\n\nFixed Node tests:\n${request.tests.map(file=>file.path+' · '+file.hash).join('\n')}\n\nBuild script:\n${request.builds?.map(file=>file.path+' · '+file.hash).join('\n')||'(none selected)'}\n\nHadron may apply the current reviewed snapshot and up to two independently reviewed repairs, then run these checks after each application. At most8 additional AI requests,3 test runs and3 build runs; no package installation. Unapproved paths and changed test/build scripts stop the run. Project code executes with your Windows permissions and may write files or access the network. Stop remains available. This approval expires in30 minutes and cannot survive restart.`,
    buttons:['Cancel','Run build/test/fix'],defaultId:0,cancelId:0,noLink:true})
  if(projectDraftOwner()!==request.owner)throw Error('Local project owner changed')
  return result.response===1
})
projectCheckHost.install(async(root,files,signal,kind,approval)=>{
  const owner=projectDraftOwner()
  signal.throwIfAborted()
  if(approval)projectApplicationAuthority.assertAutomationCheck(approval,root,files,kind)
  const approved=approval?{response:1}:await dialog.showMessageBox(mainWindow!,{type:'question',title:kind==='test'?'Run project tests':'Run project build',message:kind==='test'?'Run these Node tests?':'Run this Node build script?',
    detail:`Project: ${root}\n\n${files.map(file=>file.path+'\nSHA-256: '+file.hash).join('\n\n')}\n\nThis executes project code with your Windows permissions. It may write files or access the network. Hadron limits this run to two minutes and stops its process tree. No package installation is performed.`,
    buttons:['Cancel','Run tests'],defaultId:0,cancelId:0,noLink:true})
  signal.throwIfAborted()
  if(projectDraftOwner()!==owner)throw Error('Local project owner changed during test approval')
  if(approved.response!==1)return null
  if(JSON.stringify(freezeProjectChecks(root,files.map(file=>file.path),kind))!==JSON.stringify(files))throw Error('A selected file changed during approval; choose it again')
  const host=new WindowsOwnedWorkerHost(app.isPackaged?path.join(process.resourcesPath,'hadron-worker'):path.resolve(__dirname,'..','vendor','hadron-worker'),app.getPath('userData'),executionStartup.workerEpochId())
  const result=await host.run({executable:process.execPath,args:[...(kind==='test'?['--test']:[]),...files.map(file=>path.join(root,file.path))],cwd:root,signal,
    env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,ELECTRON_RUN_AS_NODE:'1'},
    consume:child=>{const result=captureOwnedProcess(child,{signal,timeout:120000,maxBytes:131072});child.stdin.end();return result}})
  return {code:result.code,output:result.text}
})
const workspaceArchive=()=>{if(!workspaceArchiveHost.service)throw Error('Saved workspace unavailable');return workspaceArchiveHost.service}
authHandle('workspace-archive:load',(_event,id:string)=>workspaceArchive().load(projectDraftOwner(),id))
authHandle('workspace-archive:save',(_event,chat:import('../src/features/collaboration/unifiedWorkspace.js').WorkspaceChat,revision:number)=>workspaceArchive().save(projectDraftOwner(),chat,revision))
authHandle('workspace-archive:copy-new',(_event,input:import('../server/hadronTools/workspaceArchive.js').NewSelectionDestination)=>{if(!workspaceArchiveHost.copyNew)throw Error('New destination unavailable');return workspaceArchiveHost.copyNew(projectDraftOwner(),input)})
authHandle('workspace-archive:copy',(_event,input:Parameters<import('../server/hadronTools/workspaceArchive.js').WorkspaceArchive['copy']>[1])=>workspaceArchive().copy(projectDraftOwner(),input))
authHandle('workspace-archive:trash',(_event,id:string,ids:string[],revision:number,excerpts?:import('../server/hadronTools/workspaceArchive.js').MessageExcerpts)=>workspaceArchive().trash(projectDraftOwner(),id,ids,revision,excerpts))
authHandle('workspace-archive:note',(_event,id:string,ids:string[],text:string,revision:number)=>workspaceArchive().note(projectDraftOwner(),id,ids,text,revision))

authHandle('recycle-bin:list',()=>{const owner=projectDraftOwner();if(!recycleBinHost.current)throw Error('Recycle Bin unavailable');return recycleBinHost.current.list(owner)})
authHandle('recycle-bin:restore',(_event,kind:any,id:string)=>{const owner=projectDraftOwner();if(!recycleBinHost.current)throw Error('Recycle Bin unavailable');recycleBinHost.current.restore(kind,id,owner)})

let archiveBusy=false
authHandle('chat-archive:export',async()=>{
 if(archiveBusy)throw Error('A chat archive operation is already open')
 archiveBusy=true
 try{
  const owner=projectDraftOwner()
  const selected=await dialog.showSaveDialog({title:'Back up saved Hadron chats',defaultPath:'Hadron-chats-'+new Date().toISOString().slice(0,10)+'.hadron',filters:[{name:'Hadron chat archive',extensions:['hadron']}]})
  if(selected.canceled||!selected.filePath)return {cancelled:true}
  if(owner!==projectDraftOwner()||!chatArchiveHost.export)throw Error('Chat archive unavailable')
  const archive=chatArchiveHost.export(owner),temporary=selected.filePath+'.'+crypto.randomUUID()+'.tmp'
  try{fs.writeFileSync(temporary,JSON.stringify(archive),{flag:'wx',mode:0o600});fs.renameSync(temporary,selected.filePath)}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
  return {cancelled:false,...archiveSummary(archive)}
 }finally{archiveBusy=false}
})
authHandle('chat-archive:import',async()=>{
 if(archiveBusy)throw Error('A chat archive operation is already open')
 archiveBusy=true
 try{
  const owner=projectDraftOwner(),selected=await dialog.showOpenDialog({title:'Import saved Hadron chats',properties:['openFile'],filters:[{name:'Hadron chat archive',extensions:['hadron']}]})
  if(selected.canceled||selected.filePaths.length!==1)return {cancelled:true}
  const fd=fs.openSync(selected.filePaths[0],'r');let raw:string
  try{const size=fs.fstatSync(fd);if(!size.isFile()||size.size>ARCHIVE_BYTES)throw Error('Choose a Hadron archive of at most 64 MiB');const buffer=Buffer.alloc(Math.min(size.size+1,ARCHIVE_BYTES+1));const length=fs.readSync(fd,buffer,0,buffer.length,0);if(length!==size.size)throw Error('Archive changed while being read');raw=buffer.subarray(0,length).toString('utf8')}finally{fs.closeSync(fd)}
  const archive=validateChatArchive(raw),summary=archiveSummary(archive)
  const confirmation=await dialog.showMessageBox({type:'question',title:'Import saved chats',message:`Create ${summary.projects} new imported project(s) with ${summary.chats} chats and ${summary.messages} messages?`,detail:'Existing projects stay intact. Imported text is historical reference, not verified evidence. Accounts, attached files, project access, approvals and running agents are not imported. No AI request will be sent.',buttons:['Cancel','Import as new projects'],defaultId:0,cancelId:0,noLink:true})
  if(confirmation.response!==1)return {cancelled:true}
  if(owner!==projectDraftOwner()||!chatArchiveHost.import)throw Error('Chat import unavailable')
  return {cancelled:false,...chatArchiveHost.import(owner,archive)}
 }finally{archiveBusy=false}
})

authHandle('context-copy:list',(_event,workspace:string)=>{const owner=projectDraftOwner();if(!contextCopyHost.list)throw Error('Context copying unavailable');return contextCopyHost.list(owner,workspace)})
authHandle('context-copy:copy',(_event,input:any)=>{const owner=projectDraftOwner();if(!contextCopyHost.copy)throw Error('Context copying unavailable');return contextCopyHost.copy(owner,input)})
authHandle('context-copy:copy-many',(_event,input:any)=>{const owner=projectDraftOwner();if(!contextCopyHost.copyMany)throw Error('Context copying unavailable');return contextCopyHost.copyMany(owner,input)})
authHandle('helpers:list',(_event,workspace:string)=>{const owner=projectDraftOwner();desktopProjectDraftHost.get().validateWorkspace(owner,workspace);return helperHost.list?.(owner,workspace)??[]})
authHandle('helpers:preference',(_event,enabled?:boolean)=>{const owner=projectDraftOwner();if(enabled!==undefined&&typeof enabled!=='boolean')throw Error('Invalid helper preference');if(!helperHost.preference)throw Error('Helper settings are unavailable in this host');return helperHost.preference(owner,enabled)})
const announcedCompletions=new Set<string>(),completionNotices=new Set<Notification>()
authHandle('completion-alert:ping',()=>{projectDraftOwner();shell.beep()})
authHandle('completion-alert:notify',(_event,input:CompletionAlert,mode:'ping'|'voice')=>{
 const owner=projectDraftOwner()
 if(!input||typeof input!=='object'||!['a','b','both'].includes(input.agent)||!['completed','failed','stopped'].includes(input.outcome)||!['ping','voice'].includes(mode)||[input.id,input.projectId,input.chatId].some(value=>typeof value!=='string'||!value||value.length>160))throw Error('Invalid completion alert')
 const target=mainWindow;if(!target||target.isDestroyed())return false
 const key=owner+':'+input.chatId+':'+input.id
 if(announcedCompletions.has(key))return false
 announcedCompletions.add(key);if(announcedCompletions.size>200)announcedCompletions.delete(announcedCompletions.values().next().value!)
 const text=completionAlertText(input)
 if(!target.isFocused()){target.flashFrame(true);target.setProgressBar(1,{mode:input.outcome==='completed'?'normal':'error'})}
 if(mode==='ping')shell.beep()
 if(Notification.isSupported()){
  const notice=new Notification({title:text.title,body:text.body,silent:true})
  completionNotices.add(notice)
  notice.on('close',()=>completionNotices.delete(notice));notice.on('failed',()=>completionNotices.delete(notice))
  notice.on('click',()=>{if(target.isDestroyed())return;try{if(projectDraftOwner()!==owner)return;if(target.isMinimized())target.restore();target.show();target.focus();target.webContents.send('completion-alert:open',{projectId:input.projectId,chatId:input.chatId})}catch{/* Account or window closed. */}})
  try{notice.show()}catch{completionNotices.delete(notice)}
 }
 return true
})

authHandle('hadron:setup',()=>{projectDraftOwner();return hadronSetupReport(app.isPackaged?process.resourcesPath:path.resolve(__dirname,'..'),app.isPackaged,app.getVersion())})

authHandle('project-draft:milestones',(_event,workspace:string)=>desktopProjectDraftHost.get().milestones(projectDraftOwner(),workspace))
authHandle('project-draft:accept',(_event,id:string,checked:string[],waived:boolean)=>desktopProjectDraftHost.get().accept(projectDraftOwner(),id,checked,waived))
authHandle('project-draft:next',(_event,id:string)=>desktopProjectDraftHost.get().nextMilestone(projectDraftOwner(),id))
authHandle('project-draft:availability',()=>desktopProjectDraftHost.availability())
authHandle('continuous:start',(_event,input:import('../../../shared/continuousChat.js').ContinuousChatInput)=>desktopContinuousHost.get().start(projectDraftOwner(),input))
authHandle('continuous:claude-models',async()=>{projectDraftOwner();const models=await getClaudeRuntime()?.models()??[];desktopCollaborationHost.allowedClaudeModels.clear();for(const model of models)desktopCollaborationHost.allowedClaudeModels.add(model.id);return models})
authHandle('continuous:continue',(_event,id:string,input:import('../../../shared/continuousChat.js').ContinuousContinuationInput)=>desktopContinuousHost.get().continueSaved(projectDraftOwner(),id,input))
authHandle('continuous:status',(_event,id:string)=>desktopContinuousHost.get().status(projectDraftOwner(),id))
authHandle('continuous:check',(_event,workspace:string,id:string)=>{desktopProjectDraftHost.get().validateWorkspace(projectDraftOwner(),workspace);return desktopContinuousHost.get().check(projectDraftOwner(),workspace,id)})
authHandle('continuous:list',(_event,workspace:string)=>{desktopProjectDraftHost.get().validateWorkspace(projectDraftOwner(),workspace);return desktopContinuousHost.get().list(projectDraftOwner(),workspace)})
authHandle('continuous:pause',(_event,id:string)=>desktopContinuousHost.get().pause(projectDraftOwner(),id))
authHandle('continuous:stop',(_event,id:string)=>desktopContinuousHost.get().stop(projectDraftOwner(),id))
authHandle('continuous:resume',(_event,id:string,revision:number,extraTurns:number)=>desktopContinuousHost.get().resume(projectDraftOwner(),id,revision,extraTurns))
authHandle('continuous:inject',(_event,id:string,messageId:string,text:string)=>desktopContinuousHost.get().inject(projectDraftOwner(),id,messageId,text))
authHandle('project-draft:from-folder',(_event,workspace:string,slot:'a'|'b'|'shared'|'continuous',grantId:string)=>{
  const owner=projectDraftOwner(),service=desktopProjectDraftHost.get()
  service.validateWorkspace(owner,workspace)
  if(!service.availability().ready)throw Error('Other project work is still active or needs recovery')
  const root=projectReadHost.selectionDirectory(owner,grantId,workspace,slot),home=app.getPath('home')
  return service.select(owner,workspace,root,[app.getPath('appData'),app.getPath('userData'),app.getAppPath(),path.resolve(__dirname,'..'),process.resourcesPath,process.env.HADRON_TOOLS_LIBRARY!,path.join(home,'.codex'),path.join(home,'.claude'),path.join(home,'AppData','Local','Programs','graviton')].filter(Boolean))
})
authHandle('project-draft:as-read',(_event,workspace:string,grantId:string,target:'a'|'b'|'shared'|'continuous')=>{
  if(!['a','b','shared','continuous'].includes(target))throw Error('Invalid conversation destination')
  const owner=projectDraftOwner(),root=desktopProjectDraftHost.get().selectionForWorkspace(owner,grantId,workspace)
  return projectReadHost.grant(owner,workspace,target,root)
})
authHandle('project-draft:choose',async(_event,workspace:string)=>{
  const owner=projectDraftOwner(),service=desktopProjectDraftHost.get()
  // Ownership is checked before displaying a native dialog as well as after it.
  service.validateWorkspace(owner,workspace)
  const selected=await dialog.showOpenDialog(mainWindow!,{title:'Choose the project folder',properties:['openDirectory']})
  if(selected.canceled||!selected.filePaths[0])return null
  if(projectDraftOwner()!==owner)throw Error('Local account changed during project selection')
  const home=app.getPath('home')
  return service.select(owner,workspace,selected.filePaths[0],[app.getPath('appData'),app.getPath('userData'),app.getAppPath(),path.resolve(__dirname,'..'),process.resourcesPath,
    process.env.HADRON_TOOLS_LIBRARY!,path.join(home,'.codex'),path.join(home,'.claude'),path.join(home,'AppData','Local','Programs','graviton')].filter(Boolean))
})
authHandle('project-draft:sources',async(_event,grantId:string)=>{
  const owner=projectDraftOwner(),service=desktopProjectDraftHost.get(),directory=service.selectionDirectory(owner,grantId)
    const selected=await dialog.showOpenDialog(mainWindow!,{title:'Add source files for both agents (existing selections are kept)',defaultPath:directory,properties:['openFile','multiSelections']})
  if(selected.canceled||!selected.filePaths.length)return null
  if(projectDraftOwner()!==owner)throw Error('Local account changed during file selection')
  return service.selectSources(owner,grantId,selected.filePaths)
})
authHandle('project-draft:start',(_event,grant:string,input:ProjectDraftInput)=>desktopProjectDraftHost.get().start(projectDraftOwner(),grant,input))
authHandle('project-draft:clear-sources',(_event,grant:string)=>desktopProjectDraftHost.get().selectSources(projectDraftOwner(),grant,[]))
authHandle('project-draft:status',(_event,id:string)=>desktopProjectDraftHost.get().status(projectDraftOwner(),id))
authHandle('project-draft:apply',(_event,id:string)=>desktopProjectDraftHost.get().apply(projectDraftOwner(),id))
authHandle('project-draft:repair',(_event,id:string)=>desktopProjectDraftHost.get().repair(projectDraftOwner(),id))
authHandle('project-draft:automate',async(_event,id:string)=>{
  const owner=projectDraftOwner(),service=desktopProjectDraftHost.get(),root=service.checkDirectory(owner,id)
  const selected=await dialog.showOpenDialog(mainWindow!,{title:'Choose Node tests for build/test/fix',defaultPath:root,properties:['openFile','multiSelections'],filters:[{name:'JavaScript tests',extensions:['js','mjs','cjs']}]})
  if(selected.canceled)return service.status(owner,id)
  const build=await dialog.showOpenDialog(mainWindow!,{title:'Optional: choose a Node build script (Cancel for tests only)',defaultPath:root,properties:['openFile'],filters:[{name:'JavaScript build script',extensions:['js','mjs','cjs']}]})
  if(projectDraftOwner()!==owner)throw Error('Local project owner changed')
  return service.automate(owner,id,selected.filePaths.map(file=>path.relative(root,file).split(path.sep).join('/')),!build.canceled&&build.filePaths[0]?path.relative(root,build.filePaths[0]).split(path.sep).join('/'):undefined)
})
authHandle('project-draft:checks',async(_event,id:string)=>{
  const owner=projectDraftOwner(),service=desktopProjectDraftHost.get(),root=service.checkDirectory(owner,id)
  const selected=await dialog.showOpenDialog(mainWindow!,{title:'Choose Node test files',defaultPath:root,properties:['openFile','multiSelections'],filters:[{name:'JavaScript tests',extensions:['js','mjs','cjs']}]})
  if(selected.canceled)return service.status(owner,id)
  if(projectDraftOwner()!==owner)throw Error('Local project owner changed')
  return service.runChecks(owner,id,selected.filePaths.map(file=>path.relative(root,file).split(path.sep).join('/')))
})
authHandle('project-draft:build',async(_event,id:string)=>{
  const owner=projectDraftOwner(),service=desktopProjectDraftHost.get(),root=service.checkDirectory(owner,id)
  const selected=await dialog.showOpenDialog(mainWindow!,{title:'Choose a Node build script',defaultPath:root,properties:['openFile'],filters:[{name:'JavaScript build script',extensions:['js','mjs','cjs']}]})
  if(selected.canceled)return service.status(owner,id)
  if(projectDraftOwner()!==owner)throw Error('Local project owner changed')
  return service.runChecks(owner,id,selected.filePaths.map(file=>path.relative(root,file).split(path.sep).join('/')),'build')
})
authHandle('project-draft:check',(_event,workspace:string,id:string)=>desktopProjectDraftHost.get().check(projectDraftOwner(),workspace,id))
authHandle('project-draft:list',(_event,workspace:string)=>desktopProjectDraftHost.get().list(projectDraftOwner(),workspace))
authHandle('project-draft:stop',(_event,id:string)=>desktopProjectDraftHost.get().stop(projectDraftOwner(),id))
authHandle('project-draft:close',(_event,id:string)=>desktopProjectDraftHost.get().close(projectDraftOwner(),id))
authHandle('project-draft:journal',(_event,id:string,role:'a'|'b')=>desktopProjectDraftHost.get().journal(projectDraftOwner(),id,role))
  authHandle('project-draft:inspect',(_event,id:string)=>desktopProjectDraftHost.get().inspect(projectDraftOwner(),id))

authHandle('collaboration:setup', async () => {
  const state = publicAuthState()
  const runtime = getHadronCodexRuntime()
  const generation = runtime.generation
  let models: Array<{ id: string; label: string }> = []
  const connected = (await runtime.status()).connected
  try { if (connected && state.user) models = await runtime.models() } catch { /* Empty picker keeps admission closed. */ }
  if (generation !== runtime.generation) models = []
  if (generation === runtime.generation) {
    desktopCollaborationHost.allowedModels.clear()
    for (const model of models) desktopCollaborationHost.allowedModels.add(model.id)
  }
  return { schemaVersion: 1, liveEnabled: HADRON_LIVE_COLLABORATION_ENABLED, ownerAvailable: !!state.user,
    provider: { id: 'openaichatgpt', connected: connected && generation === runtime.generation, models } }
})

const rememberedFolders=()=>new RememberedFolders(path.join(app.getPath('userData'),'remembered-project-folders.json'))
const projectProtectedRoots=()=>[app.getPath('appData'),path.join(app.getPath('home'),'.codex'),path.join(app.getPath('home'),'.claude'),path.join(app.getPath('home'),'AppData','Local','Programs','graviton')]
authHandle('collaboration:provider-allowance',async(_event,provider:unknown)=>{
 if(provider==='openaichatgpt')return getHadronCodexRuntime().usage()
 if(provider==='claudecode')return getClaudeRuntime()?.usage()??null
 return null
})
authHandle('collaboration:project-restore',(_event,workspace:string,slot:'a'|'b'|'shared'|'continuous')=>{
 const owner=projectDraftOwner();desktopProjectDraftHost.get().validateWorkspace(owner,workspace)
 if(!['a','b','shared','continuous'].includes(slot))throw Error('Invalid conversation destination')
 const root=rememberedFolders().restore(owner,workspace,slot)
 return root?projectReadHost.grant(owner,workspace,slot,root,projectProtectedRoots()):null
})
authHandle('collaboration:project-select',async (_event,workspace:unknown,slot:unknown,options?:{mode?:'add'|'replace';existingId?:string;source?:'a'|'b'|'shared'|'continuous'})=>{
  const owner=publicAuthState().user?.id
  if(!owner||typeof workspace!=='string'||!workspace||workspace.length>128||!['a','b','shared','continuous'].includes(slot as string))throw Error('Project selection unavailable')
  desktopProjectDraftHost.get().validateWorkspace(owner,workspace)
  if(options?.mode!==undefined&&!['add','replace'].includes(options.mode))throw Error('Invalid folder selection')
  const previous=options?.mode==='add'&&options.existingId?projectReadHost.selectionDirectories(owner,options.existingId,workspace,options.source??slot as 'a'|'b'|'shared'|'continuous'):[]
  const selected=await dialog.showOpenDialog(mainWindow!,{title:'Choose working folders',properties:['openDirectory','multiSelections']})
  if(selected.canceled||!selected.filePaths[0])return null
  if(publicAuthState().user?.id!==owner)throw Error('Local account changed during selection')
  const grant=projectReadHost.grant(owner,workspace,slot as 'a'|'b'|'shared'|'continuous',[...previous,...selected.filePaths],projectProtectedRoots())
  rememberedFolders().remember(owner,workspace,slot as 'a'|'b'|'shared'|'continuous',grant.paths)
  return grant
})
authHandle('collaboration:project-retain',(_event,workspace:string,source:'a'|'b'|'shared'|'continuous',id:string,target:'a'|'b'|'shared'|'continuous',indexes:unknown)=>{
 const owner=projectDraftOwner();desktopProjectDraftHost.get().validateWorkspace(owner,workspace)
 if(!['a','b','shared','continuous'].includes(target)||!Array.isArray(indexes)||indexes.some(index=>!Number.isSafeInteger(index)))throw Error('Invalid folder selection')
 const roots=projectReadHost.selectionDirectories(owner,id,workspace,source,false)
 if(indexes.some(index=>index<0||index>=roots.length)||new Set(indexes).size!==indexes.length)throw Error('Invalid folder selection')
 if(!indexes.length){
  rememberedFolders().forget(owner,workspace,target)
  if(source!==target)rememberedFolders().forget(owner,workspace,source)
  projectReadHost.revoke(owner,id);return null
 }
 const grant=projectReadHost.grant(owner,workspace,target,indexes.map(index=>roots[index]),projectProtectedRoots())
 rememberedFolders().remember(owner,workspace,target,grant.paths)
 if(source!==target)projectReadHost.revoke(owner,id)
 return grant
})
authHandle('collaboration:project-agent',(_event,workspace:unknown,slot:unknown,readGrantId:unknown)=>{
  const owner=publicAuthState().user?.id
  if(!owner||typeof workspace!=='string'||!workspace||workspace.length>128||!['a','b','shared'].includes(String(slot))||typeof readGrantId!=='string')throw Error('Agent permission unavailable')
  return projectAgentHost.grant(owner,workspace,slot as 'a'|'b'|'shared',readGrantId)
})
authHandle('collaboration:agent-revoke',(_event,id:unknown)=>{const owner=publicAuthState().user?.id;if(owner&&typeof id==='string')projectAgentHost.revoke(owner,id)})

authHandle('collaboration:project-revoke',(_event,id:unknown)=>{const owner=publicAuthState().user?.id;if(owner&&typeof id==='string')projectReadHost.revoke(owner,id)})
authHandle('collaboration:project-use',(_event,workspace:string,source:'a'|'b'|'shared'|'continuous',id:string,target:'a'|'b'|'shared'|'continuous')=>{
  const owner=projectDraftOwner();desktopProjectDraftHost.get().validateWorkspace(owner,workspace)
  if(!['a','b','shared','continuous'].includes(target))throw Error('Invalid conversation destination')
  const roots=projectReadHost.selectionDirectories(owner,id,workspace,source)
  rememberedFolders().remember(owner,workspace,target,roots)
  if(source===target)return {id,label:roots[0],paths:roots}
  return projectReadHost.grant(owner,workspace,target,roots,projectProtectedRoots())
})

authHandle('collaboration:claude-status', async () => {
  const runtime = getClaudeRuntime()
  return runtime ? runtime.status() : { installed: false, version: null, connected: false, reason: 'not_installed', loginState: 'idle' }
})
authHandle('collaboration:claude-sign-in', () => {
  const runtime = getClaudeRuntime()
  if (!runtime) throw new Error('Claude runtime unavailable')
  collaborationAccess.revoke(); runtime.startSignIn()
  return { started: true }
})
authHandle('collaboration:claude-cancel-sign-in', () => {
  collaborationAccess.revoke(); getClaudeRuntime()?.cancelSignIn()
  return { cancelled: true }
})

authHandle('collaboration:chatgpt-status', () => getHadronChatgptConnection().status())
authHandle('collaboration:codex-status', () => getHadronCodexRuntime().status())
authHandle('collaboration:codex-sign-in', (_event, method: unknown = 'browser') => {
  if (method !== 'browser' && method !== 'device') throw new Error('Unknown Codex sign-in method')
  getHadronCodexRuntime().startSignIn(method); return { started: true }
})
authHandle('collaboration:codex-cancel-sign-in', async () => { await getHadronCodexRuntime().cancelSignIn(); return { cancelled: true } })
authHandle('collaboration:codex-open-sign-in', () => getHadronCodexRuntime().openSignInPage())
authHandle('collaboration:codex-disconnect', async () => { await getHadronCodexRuntime().disconnect(); return { disconnected: true } })
authHandle('collaboration:codex-test', () => getHadronCodexRuntime().testConnection())
const chatgptProbe = new HadronChatgptProbe({ resolveAccount: signal => getHadronChatgptConnection().resolveAccount(signal) })
authHandle('collaboration:chatgpt-test-models', () => chatgptProbe.models())
authHandle('collaboration:chatgpt-test', (_event, model: unknown) => chatgptProbe.run(model))
authHandle('collaboration:chatgpt-sign-in', async () => {
  await getHadronChatgptConnection().startSignIn()
  return { started: true }
})
authHandle('collaboration:chatgpt-cancel-sign-in', () => {
  getHadronChatgptConnection().cancelSignIn()
  return { cancelled: true }
})
authHandle('collaboration:chatgpt-disconnect', async () => {
  await getHadronChatgptConnection().disconnect()
  return { disconnected: true }
})

authHandle('collaboration:availability', () => ({ liveEnabled: HADRON_LIVE_COLLABORATION_ENABLED, previewEnabled: true }))
authHandle('collaboration:capability', () => {
  if (!HADRON_LIVE_COLLABORATION_ENABLED) throw new Error('Live collaboration is disabled')
  return collaborationAccess.issue()
})
authHandle('auth:start', (_event, provider: string, oob: boolean) => ({ url: startAppLogin(provider, oob) }))
authHandle('auth:code', async (_event, code: string) => { const result = await completeAppCode(code); await syncAuthenticatedProfile(result.user); return publicAuthState() })
authHandle('auth:cancel', () => { cancelAppLogin(); return true })
authHandle('auth:migrate', (_event, values) => { importLegacyRenderer(values); return publicAuthState() })
authHandle('auth:check', async () => { await getAuthManager().check(); return publicAuthState() })
let authEventsAttached = false
authHandle('auth:subscribe', () => {
  if (!authEventsAttached) {
    authEventsAttached = true
    getAuthManager().subscribe(() => {
      collaborationAccess.revoke()
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('auth:changed', publicAuthState())
    })
  }
  return publicAuthState()
})

// Storage - Persistent storage using electron-store with fallback
const isAuthStorageKey = (key: string) => !key || ['managed_auth_v1', 'managed_auth_migration_v1', 'auth_session', 'openai_chatgpt_tokens'].some(root => key === root || key.startsWith(`${root}.`) || root.startsWith(`${key}.`))
ipcMain.handle('storage:get', async (_event, key: string) => {
  if (isAuthStorageKey(key)) throw new Error('Use the authentication API')
  // console.log('[Electron IPC] storage:get called for key:', key)

  if (!storeInitialized) {
    console.error('[Electron IPC] Storage not initialized yet')
    return null
  }

  try {
    const value = getFromStore(key)
    // console.log('[Electron IPC] Retrieved value:', value ? 'found' : 'not found')
    return value || null
  } catch (error) {
    console.error('[Electron IPC] Failed to get from storage:', error)
    return null
  }
})

ipcMain.handle('storage:set', async (_event, key: string, value: any) => {
  if (isAuthStorageKey(key)) throw new Error('Use the authentication API')
  // console.log('[Electron IPC] storage:set called for key:', key)

  if (!storeInitialized) {
    console.error('[Electron IPC] Storage not initialized yet')
    return { success: false, error: 'Storage not initialized' }
  }

  try {
    if (value === null || value === undefined) {
      // Delete key if value is null/undefined
      const success = deleteFromStore(key)
      if (key === 'ygg_provider_settings') {
        syncLmStudioBaseUrlFromStore()
        syncOpenAiChatGptMaxContextFromStore()
      }
      // console.log('[Electron IPC] Deleted key from storage')
      return { success }
    } else {
      const success = setInStore(key, value)
      if (key === 'ygg_provider_settings') {
        syncLmStudioBaseUrlFromStore()
        syncOpenAiChatGptMaxContextFromStore()
      }
      // console.log('[Electron IPC] Stored successfully')
      return { success }
    }
  } catch (error) {
    console.error('[Electron IPC] Failed to set storage:', error)
    return { success: false, error: String(error) }
  }
})

// Clear all storage (for logout/account switching)
ipcMain.handle('storage:clear', async () => {
  cancelAppLogin()
  disconnectAuth('app')
  disconnectAuth('codex')
  // console.log('[Electron IPC] storage:clear called - clearing all stored data')

  if (!storeInitialized) {
    console.error('[Electron IPC] Storage not initialized yet')
    return { success: false, error: 'Storage not initialized' }
  }

  try {
    const success = clearStore()
    syncLmStudioBaseUrlFromStore()
    syncOpenAiChatGptMaxContextFromStore()
    return { success }
  } catch (error) {
    console.error('[Electron IPC] Failed to clear storage:', error)
    return { success: false, error: String(error) }
  }
})

authHandle('secrets:consolidate', async () => {
  try {
    const result = await consolidateSecureSecrets()
    await mcpManager.consolidatePlaintextCredentials()
    return { success: true, ...result }
  } catch {
    // Native enumeration errors must not expose credential payloads over IPC.
    return { success: false, error: 'Credential consolidation did not finish. Original credentials are retained unless their vault copy was verified. Allow Keychain access and retry.' }
  }
})

authHandle('secrets:braveSearch:get', async () => {
  try {
    const value = await getBraveApiKey()
    return { success: true, value }
  } catch (error) {
    console.error('[Electron IPC] Failed to get Brave API key:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error), value: null }
  }
})

authHandle('secrets:braveSearch:has', async () => {
  try {
    const configured = await hasBraveApiKey()
    return { success: true, configured }
  } catch (error) {
    console.error('[Electron IPC] Failed to check Brave API key:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error), configured: false }
  }
})

authHandle('secrets:braveSearch:set', async (_event, value: string) => {
  try {
    if (typeof value !== 'string') throw new Error('Secret value must be a string')
    await setBraveApiKey(value)
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to set Brave API key:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

authHandle('secrets:braveSearch:delete', async () => {
  try {
    await deleteBraveApiKey()
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to delete Brave API key:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Get platform info
ipcMain.handle('platform:info', async () => {
  return {
    platform: process.platform,
    version: app.getVersion(),
    isElectron: true,
  }
})

ipcMain.handle('autoUpdater:check', async () => {
  if (!autoUpdaterConfigured) {
    return { success: false, error: 'Auto-updater not configured' }
  }

  try {
    await autoUpdater.checkForUpdates()
    return { success: true }
  } catch (error) {
    console.error('[Electron] Manual update check failed:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('autoUpdater:installNow', async () => {
  return { success: false, error: 'Hadron updates are disabled until a release channel is configured' }
})

// Open OAuth URL in external browser
authHandle('auth:openExternal', async (_event, url: string) => {
  // console.log('[Electron IPC] Opening external URL for OAuth:', url)
  try {
    await openHadronExternalWeb(url, value => shell.openExternal(value))
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to open external URL:', error)
    return { success: false, error: String(error) }
  }
})

// Open files in their default application and folders in the system file manager.
authHandle('shell:openPath', async (_event, path: string) => {
  // console.log('[Electron IPC] Opening path:', path)
  try {
    const result = await openHadronExternalPath(path, normalizeShellPath, value => shell.openPath(value))
    if (result) {
      // openPath returns empty string on success, error message on failure
      return { success: false, error: result }
    }
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to open path:', error)
    return { success: false, error: String(error) }
  }
})

// File dialog for custom tool widgets
ipcMain.handle(
  'dialog:openFile',
  async (
    _event,
    options?: {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
      properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[]
    }
  ) => {
    // console.log('[Electron IPC] Opening file dialog with options:', options)
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: options?.title || 'Select File',
        defaultPath: options?.defaultPath,
        filters: options?.filters,
        properties: options?.properties || ['openFile'],
      })
      return {
        success: !result.canceled,
        canceled: result.canceled,
        filePaths: result.filePaths,
      }
    } catch (error) {
      console.error('[Electron IPC] Failed to open file dialog:', error)
      return { success: false, error: String(error), filePaths: [] }
    }
  }
)

// Save dialog for custom tool widgets
ipcMain.handle(
  'dialog:saveFile',
  async (
    _event,
    options?: {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
    }
  ) => {
    // console.log('[Electron IPC] Opening save dialog with options:', options)
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: options?.title || 'Save File',
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      })
      return {
        success: !result.canceled,
        canceled: result.canceled,
        filePath: result.filePath,
      }
    } catch (error) {
      console.error('[Electron IPC] Failed to open save dialog:', error)
      return { success: false, error: String(error), filePath: undefined }
    }
  }
)

// Select folder dialog
ipcMain.handle('dialog:selectFolder', async (_event, options?: { title?: string; defaultPath?: string }) => {
  // console.log('[Electron IPC] Opening folder selection dialog')
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: options?.title || 'Select Folder',
      defaultPath: options?.defaultPath,
      properties: ['openDirectory'],
    })
    return {
      success: !result.canceled,
      path: result.filePaths[0],
    }
  } catch (error) {
    console.error('[Electron IPC] Failed to open folder dialog:', error)
    return { success: false, error: String(error) }
  }
})

// Read file content for custom tool widgets
ipcMain.handle('fs:readFile', async (_event, filePath: string, encoding?: BufferEncoding) => {
  // console.log('[Electron IPC] Reading file:', filePath)
  try {
    const content = fs.readFileSync(filePath, encoding || 'utf-8')
    return { success: true, content }
  } catch (error) {
    console.error('[Electron IPC] Failed to read file:', error)
    return { success: false, error: String(error) }
  }
})

// Stat file for custom tool widgets
ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  // console.log('[Electron IPC] Stating file:', filePath)
  try {
    const stats = await fs.promises.stat(filePath)
    return {
      success: true,
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      mtimeMs: stats.mtimeMs,
    }
  } catch (error) {
    console.error('[Electron IPC] Failed to stat file:', error)
    return { success: false, error: String(error) }
  }
})

// Stream file content for custom tool widgets
ipcMain.handle(
  'fs:readFileStream',
  async (
    event,
    filePath: string,
    options?: {
      encoding?: BufferEncoding
      highWaterMark?: number
    }
  ) => {
    // console.log('[Electron IPC] Streaming file:', filePath)
    try {
      const stats = await fs.promises.stat(filePath)
      const total = Number.isFinite(stats.size) ? stats.size : null
      const streamId = `stream_${Date.now()}_${Math.random().toString(16).slice(2)}`
      const stream = fs.createReadStream(filePath, {
        encoding: options?.encoding,
        highWaterMark: options?.highWaterMark,
      })

      const meta = {
        stream,
        sender: event.sender,
        loaded: 0,
        total,
        aborted: false,
        abortedSent: false,
      }
      activeReadStreams.set(streamId, meta)

      const sendToRenderer = (channel: string, payload: Record<string, any>) => {
        if (!meta.sender.isDestroyed()) {
          meta.sender.send(channel, payload)
        }
      }

      stream.on('data', (chunk: Buffer | string) => {
        const chunkSize =
          typeof chunk === 'string' ? Buffer.byteLength(chunk, options?.encoding || 'utf-8') : chunk.length
        meta.loaded += chunkSize
        sendToRenderer('fs:readFileStream:chunk', {
          streamId,
          chunk,
          loaded: meta.loaded,
          total: meta.total,
        })
        sendToRenderer('fs:readFileStream:progress', {
          streamId,
          loaded: meta.loaded,
          total: meta.total,
          percent: meta.total ? (meta.loaded / meta.total) * 100 : null,
        })
      })

      stream.on('end', () => {
        if (!meta.aborted) {
          sendToRenderer('fs:readFileStream:end', {
            streamId,
            loaded: meta.loaded,
            total: meta.total,
          })
        }
        activeReadStreams.delete(streamId)
      })

      stream.on('error', (error: Error) => {
        if (meta.aborted) {
          if (!meta.abortedSent) {
            sendToRenderer('fs:readFileStream:aborted', {
              streamId,
              loaded: meta.loaded,
              total: meta.total,
            })
            meta.abortedSent = true
          }
        } else {
          console.error('[Electron IPC] Stream error:', error)
          sendToRenderer('fs:readFileStream:error', {
            streamId,
            error: error.message,
            loaded: meta.loaded,
            total: meta.total,
          })
        }
        activeReadStreams.delete(streamId)
      })

      return { success: true, streamId, total }
    } catch (error) {
      console.error('[Electron IPC] Failed to stream file:', error)
      return { success: false, error: String(error) }
    }
  }
)

// Abort an active file stream
ipcMain.handle('fs:abortReadFileStream', async (_event, streamId: string) => {
  // console.log('[Electron IPC] Aborting file stream:', streamId)
  const meta = activeReadStreams.get(streamId)
  if (!meta) {
    return { success: false, error: 'Stream not found' }
  }

  meta.aborted = true
  if (!meta.abortedSent && !meta.sender.isDestroyed()) {
    meta.sender.send('fs:readFileStream:aborted', {
      streamId,
      loaded: meta.loaded,
      total: meta.total,
    })
    meta.abortedSent = true
  }
  meta.stream.destroy()
  activeReadStreams.delete(streamId)
  return { success: true }
})

// Write file content for custom tool widgets
ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string, encoding?: BufferEncoding) => {
  // console.log('[Electron IPC] Writing file:', filePath)
  try {
    assertLegacyExecutionAllowed('widget_write')
    // Handle base64 encoding for binary files (e.g., PDFs, images)
    if (encoding === 'base64') {
      fs.writeFileSync(filePath, Buffer.from(content, 'base64'))
    } else {
      fs.writeFileSync(filePath, content, encoding || 'utf-8')
    }
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to write file:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('logs:getClientErrorLogPath', async () => {
  try {
    const filePath = getClientErrorLogPath()
    return { success: true, filePath }
  } catch (error) {
    console.error('[Electron IPC] Failed to resolve client error log path:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('logs:appendClientError', async (_event, content: string) => {
  if (typeof content !== 'string' || content.length === 0) {
    return { success: true }
  }

  try {
    const filePath = getClientErrorLogPath()
    fs.appendFileSync(filePath, content, 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    console.error('[Electron IPC] Failed to append client error log:', error)
    return { success: false, error: String(error) }
  }
})

// Create directory for custom tool widgets
ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
  // console.log('[Electron IPC] Creating directory:', dirPath)
  try {
    assertLegacyExecutionAllowed('widget_directory')
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to create directory:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle(
  'terminal:create',
  async (
    event,
    options?: {
      cwd?: string
      cols?: number
      rows?: number
      title?: string
    }
  ) => {
    try {
      assertLegacyExecutionAllowed('terminal')
      const launch = await resolveTerminalLaunch(options?.cwd)
      const { spawn } = getNodePtyModule()
      const cols = clampTerminalDimension(options?.cols, 120, 20, 400)
      const rows = clampTerminalDimension(options?.rows, 32, 5, 200)
      const sessionId = makeTerminalSessionId()
      const pty = spawn(launch.file, launch.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: launch.spawnCwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
        ...(process.platform === 'win32' ? { useConpty: true } : {}),
      })

      const session: TerminalSessionRecord = {
        sessionId,
        pty,
        sender: event.sender,
        cwd: launch.displayCwd,
        shell: launch.shellLabel,
        cols,
        rows,
      }
      activeTerminalSessions.set(sessionId, session)

      event.sender.once('destroyed', () => {
        cleanupTerminalSessionsForSender(event.sender)
      })

      pty.onData(data => {
        const activeSession = activeTerminalSessions.get(sessionId)
        if (!activeSession) return
        sendTerminalEvent(activeSession.sender, 'terminal:data', {
          sessionId,
          data,
        })
      })

      pty.onExit(({ exitCode, signal }) => {
        const activeSession = activeTerminalSessions.get(sessionId)
        if (!activeSession) return
        activeTerminalSessions.delete(sessionId)
        sendTerminalEvent(activeSession.sender, 'terminal:exit', {
          sessionId,
          exitCode,
          signal,
          cwd: activeSession.cwd,
          shell: activeSession.shell,
        })
      })

      return {
        success: true,
        sessionId,
        cwd: launch.displayCwd,
        shell: launch.shellLabel,
        cols,
        rows,
        title: options?.title || 'Terminal',
      }
    } catch (error) {
      console.error('[Electron Terminal] Failed to create terminal session:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
)

ipcMain.handle('terminal:write', async (event, sessionId: string, data: string) => {
  const session = activeTerminalSessions.get(sessionId)
  if (!session || session.sender.id !== event.sender.id) {
    return { success: false, error: 'Terminal session not found' }
  }

  try {
    assertLegacyExecutionAllowed('terminal')
    session.pty.write(typeof data === 'string' ? data : String(data ?? ''))
    return { success: true }
  } catch (error) {
    console.error('[Electron Terminal] Failed to write to terminal session:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('terminal:resize', async (event, sessionId: string, cols: number, rows: number) => {
  const session = activeTerminalSessions.get(sessionId)
  if (!session || session.sender.id !== event.sender.id) {
    return { success: false, error: 'Terminal session not found' }
  }

  try {
    const nextCols = clampTerminalDimension(cols, session.cols || 120, 20, 400)
    const nextRows = clampTerminalDimension(rows, session.rows || 32, 5, 200)
    session.cols = nextCols
    session.rows = nextRows
    session.pty.resize(nextCols, nextRows)
    return { success: true }
  } catch (error) {
    console.error('[Electron Terminal] Failed to resize terminal session:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('terminal:kill', async (event, sessionId: string) => {
  const session = activeTerminalSessions.get(sessionId)
  if (!session || session.sender.id !== event.sender.id) {
    return { success: false, error: 'Terminal session not found' }
  }

  destroyTerminalSession(sessionId)
  return { success: true }
})

// Execute shell command for custom tool widgets
ipcMain.handle('shell:exec', async (_event, command: string, options?: { cwd?: string; timeout?: number }) => {
  assertLegacyExecutionAllowed('widget_shell')
  // console.log('[Electron IPC] Executing command:', command)
  const { spawn } = require('child_process')

  return new Promise(resolve => {
    const timeout = options?.timeout || 300000 // 5 min default
    let stdout = ''
    let stderr = ''
    let killed = false

    const child = spawn(command, [], {
      shell: true,
      cwd: options?.cwd,
    })

    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGTERM')
    }, timeout)

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('close', (code: number | null) => {
      clearTimeout(timer)
      resolve({
        success: code === 0,
        code,
        stdout,
        stderr,
        killed,
      })
    })

    child.on('error', (err: Error) => {
      clearTimeout(timer)
      resolve({
        success: false,
        error: err.message,
        stdout,
        stderr,
      })
    })
  })
})

// HTTP request handler for custom tool widgets (enables calling local/remote APIs)
ipcMain.handle(
  'http:request',
  async (
    _event,
    options: {
      url: string
      method?: string
      headers?: Record<string, string>
      body?: string
      timeout?: number
    }
  ) => {
    // console.log('[Electron IPC] HTTP request:', options.method || 'GET', options.url)

    const http = require('http')
    const https = require('https')
    const { URL } = require('url')

    return new Promise(resolve => {
      try {
        const url = new URL(options.url)
        const isHttps = url.protocol === 'https:'
        const lib = isHttps ? https : http

        const timeout = options.timeout || 30000

        const reqOptions = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          timeout,
        }

        const req = lib.request(reqOptions, (res: any) => {
          let data = ''

          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()
          })

          res.on('end', () => {
            let parsedData: any = data
            try {
              parsedData = JSON.parse(data)
            } catch {
              // Keep as string if not JSON
            }

            resolve({
              success: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: res.headers,
              data: parsedData,
            })
          })
        })

        req.on('error', (err: Error) => {
          console.error('[Electron IPC] HTTP request error:', err)
          resolve({
            success: false,
            error: err.message,
          })
        })

        req.on('timeout', () => {
          req.destroy()
          resolve({
            success: false,
            error: 'Request timeout',
          })
        })

        if (options.body) {
          req.write(options.body)
        }

        req.end()
      } catch (err) {
        console.error('[Electron IPC] HTTP request setup error:', err)
        resolve({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })
  }
)

// Custom tool module execution - runs tool's index.js in Electron's Node.js environment
// This allows custom tools with node_modules to work without user having Node.js installed
const loadedToolModules = new Map<string, any>()

ipcMain.handle(
  'customTool:execute',
  async (
    _event,
    toolPath: string,
    args?: Record<string, any>
  ): Promise<{ success: boolean; result?: any; error?: string }> => {
    console.log('[Electron IPC] Executing custom tool module:', toolPath)

    try {
      assertLegacyExecutionAllowed('custom_module')
      // Validate path exists
      if (!fs.existsSync(toolPath)) {
        return { success: false, error: `Tool path does not exist: ${toolPath}` }
      }

      // Determine the entry point
      let entryPoint = toolPath
      const stats = fs.statSync(toolPath)

      if (stats.isDirectory()) {
        // Look for package.json to find main entry
        const packageJsonPath = path.join(toolPath, 'package.json')
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
            entryPoint = path.join(toolPath, packageJson.main || 'index.js')
          } catch {
            entryPoint = path.join(toolPath, 'index.js')
          }
        } else {
          entryPoint = path.join(toolPath, 'index.js')
        }
      }

      if (!fs.existsSync(entryPoint)) {
        return { success: false, error: `Entry point not found: ${entryPoint}` }
      }

      // Clear require cache to allow hot reloading during development
      const resolvedPath = require.resolve(entryPoint)
      if (loadedToolModules.has(resolvedPath)) {
        // Use cached module for performance, but allow cache bust via args
        if (!args?._bustCache) {
          const cachedModule = loadedToolModules.get(resolvedPath)
          if (typeof cachedModule?.execute === 'function') {
            const result = await cachedModule.execute(args || {})
            return { success: true, result }
          }
        }
      }

      // Clear from Node's require cache to get fresh module
      delete require.cache[resolvedPath]

      // Load the tool module using Electron's Node.js runtime
      const toolModule = require(resolvedPath)
      loadedToolModules.set(resolvedPath, toolModule)

      // Check if module exports an execute function
      if (typeof toolModule?.execute !== 'function') {
        return {
          success: false,
          error: `Tool module must export an 'execute' function. Found: ${Object.keys(toolModule || {}).join(', ') || 'nothing'}`,
        }
      }

      // Execute the tool with provided args
      const result = await toolModule.execute(args || {})
      return { success: true, result }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : ''
      console.error('[Electron IPC] Custom tool execution failed:', errorMsg)
      console.error('[Electron IPC] Stack:', errorStack)
      return { success: false, error: errorMsg }
    }
  }
)

// Clear a specific tool from cache (for development/hot reload)
ipcMain.handle('customTool:clearCache', async (_event, toolPath?: string) => {
  if (toolPath) {
    const resolvedPath = require.resolve(toolPath)
    loadedToolModules.delete(resolvedPath)
    delete require.cache[resolvedPath]
    return { success: true, cleared: 1 }
  } else {
    const count = loadedToolModules.size
    loadedToolModules.clear()
    // Clear all tool modules from require cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('custom-tools')) {
        delete require.cache[key]
      }
    })
    return { success: true, cleared: count }
  }
})

ipcMain.handle('browser:isGuestDevToolsEnabled', async () => {
  return isGuestBrowserDevToolsEnabled()
})

ipcMain.handle('browser:openGuestDevTools', async (event, guestWebContentsId: number) => {
  if (!isGuestBrowserDevToolsEnabled()) {
    return { success: false, error: 'Browser DevTools are currently disabled in Settings.' }
  }

  if (!Number.isInteger(guestWebContentsId) || guestWebContentsId <= 0) {
    return { success: false, error: 'A valid guest webContentsId is required.' }
  }

  try {
    const guestContents = webContents.fromId(guestWebContentsId)
    if (!guestContents || guestContents.isDestroyed()) {
      return { success: false, error: 'Browser tab contents were not found.' }
    }

    if (guestContents.getType() !== 'webview') {
      return { success: false, error: 'DevTools can only be opened for embedded browser tabs.' }
    }

    const owningHostId = (guestContents as any).hostWebContents?.id
    if (typeof owningHostId === 'number' && owningHostId !== event.sender.id) {
      return { success: false, error: 'The requested browser tab belongs to a different renderer.' }
    }

    guestContents.openDevTools({ mode: 'detach', activate: true })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open browser DevTools.',
    }
  }
})

// Floating window controls
ipcMain.handle('window:openFloating', async () => {
  // console.log('[Electron IPC] Opening floating window')
  try {
    createFloatingWindow()
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to open floating window:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('window:closeFloating', async () => {
  // console.log('[Electron IPC] Closing floating window')
  try {
    if (floatingWindow) {
      floatingWindow.close()
      floatingWindow = null
      return { success: true }
    }
    return { success: true }
  } catch (error) {
    console.error('[Electron IPC] Failed to close floating window:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('window:toggleFloating', async () => {
  // console.log('[Electron IPC] Toggling floating window')
  try {
    toggleFloatingWindow()
    return { success: true, isOpen: floatingWindow !== null }
  } catch (error) {
    console.error('[Electron IPC] Failed to toggle floating window:', error)
    return { success: false, error: String(error), isOpen: false }
  }
})

ipcMain.handle('window:isFloatingOpen', async () => {
  return floatingWindow !== null
})

// Compact mode controls (uses main window instead of spawning a new one)
ipcMain.handle('window:toggleCompact', async () => {
  // console.log('[Electron IPC] Toggling compact mode')
  try {
    const compact = toggleCompactMode()
    return { success: true, compact }
  } catch (error) {
    console.error('[Electron IPC] Failed to toggle compact mode:', error)
    return { success: false, error: String(error), compact: compactMode }
  }
})

ipcMain.handle('window:isCompact', async () => {
  return compactMode
})

ipcMain.handle('window:getState', async () => {
  return {
    isMaximized: Boolean(mainWindow?.isMaximized()),
    isFullScreen: Boolean(mainWindow?.isFullScreen()),
  }
})

// Open OAuth URL in a new BrowserWindow (for WSL/Linux compatibility)
authHandle('auth:openOAuthWindow', async (_event, url: string) => {
  // console.log('[Electron IPC] Opening OAuth window:', url)
  try {
    url = externalWebUrl(url)
    projectExecutionGate.assertExternalLaunchAllowed()
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'OAuth window unavailable' }
  }

  return new Promise(resolve => {
    // Create a modal window for OAuth
    const oauthWindow = new BrowserWindow({
      width: 500,
      height: 700,
      modal: true,
      parent: mainWindow || undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
      title: 'Sign in',
      autoHideMenuBar: true,
    })

    oauthWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    // Load the validated web URL. Generic OAuth windows cannot acquire the
    // dedicated host-owned ChatGPT device-login exception.
    oauthWindow.loadURL(url)

    // Handle navigation to callback URL
    const handleNavigation = (navigationUrl: string) => {
      // console.log('[Electron OAuth] Navigation detected:', navigationUrl)

      // Check if this is our callback URL
      if (navigationUrl.startsWith(`${PROTOCOL}://`)) {
        // console.log('[Electron OAuth] Callback URL detected, closing window')

        // Close the OAuth window
        oauthWindow.close()

        // Send the callback to handleOAuthCallback function
        handleOAuthCallback(navigationUrl)

        resolve({ success: true })
        return true
      }
      try {
        externalWebUrl(navigationUrl)
        projectExecutionGate.assertExternalLaunchAllowed()
        return false
      } catch { return true }
    }

    // Listen for redirects (works for most OAuth providers)
    oauthWindow.webContents.on('will-redirect', (event, navigationUrl) => {
      if (handleNavigation(navigationUrl)) {
        event.preventDefault()
      }
    })

    // Listen for navigation (backup for providers that don't redirect)
    oauthWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      if (handleNavigation(navigationUrl)) {
        event.preventDefault()
      }
    })

    // Handle window close
    oauthWindow.on('closed', () => {
      // console.log('[Electron OAuth] Window closed')
      resolve({ success: true })
    })

    // Handle errors
    oauthWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[Electron OAuth] Failed to load:', errorCode, errorDescription)
      oauthWindow.close()
      resolve({ success: false, error: errorDescription })
    })
  })
})

// Local sync server status
//
// `localServerRunning` is a LIVE answer: it is true only when this process's own
// server just answered `/api/health` on the port it is actually bound to. A server
// that died after boot now reports false instead of true-forever.
//
// The port/url are still the last real binding even when the probe fails. That is
// deliberate: nulling them would make the renderer fall back to the hardcoded
// :3002, which is the cross-instance hazard we are trying to close. The renderer
// gates on `localServerRunning` (see `isLocalServerOriginVerified` in utils/api.ts).
ipcMain.handle('sync:status', async () => {
  const health = await probeLocalServerHealth()

  return {
    localServerRunning: health.ok,
    localServerPort,
    localServerUrl,
    localServerLanUrl,
    localServerError: health.ok ? null : (health.error ?? localServerError),
    localServerForeign: health.foreign,
  }
})

// Window controls for custom title bar
ipcMain.handle('window:minimize', async () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('window:maximize', async () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window:close', async () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// Theme synchronization for native UI + Windows material.
ipcMain.handle('theme:update', async (_event, themePreference?: boolean | 'light' | 'dark' | 'system') => {
  let resolvedThemeSource: 'light' | 'dark' | 'system' = 'system'

  if (themePreference === 'light' || themePreference === 'dark' || themePreference === 'system') {
    resolvedThemeSource = themePreference
  } else if (typeof themePreference === 'boolean') {
    resolvedThemeSource = themePreference ? 'dark' : 'light'
  }

  nativeTheme.themeSource = resolvedThemeSource
})

function configureAutoUpdater() {
  if (isHadronDesktop()) return // No Graviton update channel in Hadron.
  if (autoUpdaterConfigured) {
    return
  }

  if (!app.isPackaged) {
    // console.log('[Electron] Auto-updater skipped: not packaged')
    return
  }

  if (!UPDATE_FEED_BASE_URL) {
    console.warn('[Electron] Auto-updater skipped: SUPABASE_UPDATE_FEED_BASE_URL missing')
    return
  }

  const platformDir = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'

  const normalizedBase = UPDATE_FEED_BASE_URL.replace(/\/+$/, '')
  const feedUrl = `${normalizedBase}/${platformDir}`

  try {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
    })
  } catch (error) {
    console.error('[Electron] Failed to set feed URL:', error)
    return
  }

  autoUpdaterConfigured = true

  autoUpdater.on('checking-for-update', () => {
    // console.log('[Electron] Checking for updates...')
    mainWindow?.webContents.send('autoUpdater:checking')
  })

  autoUpdater.on('update-available', info => {
    // console.log('[Electron] Update available:', info?.version)
    mainWindow?.webContents.send('autoUpdater:update-available', info)
  })

  autoUpdater.on('update-not-available', info => {
    // console.log('[Electron] No updates available')
    mainWindow?.webContents.send('autoUpdater:update-not-available', info)
  })

  autoUpdater.on('download-progress', progressObj => {
    mainWindow?.webContents.send('autoUpdater:download-progress', progressObj)
  })

  autoUpdater.on('update-downloaded', info => {
    // console.log('[Electron] Update downloaded, ready to install')
    mainWindow?.webContents.send('autoUpdater:update-downloaded', info)
    // Don't auto-install - let user choose via modal
  })

  autoUpdater.on('error', error => {
    // console.error('[Electron] Auto-updater error:', error)
    mainWindow?.webContents.send('autoUpdater:error', error ? error.message || String(error) : 'Unknown error')
  })

  setTimeout(() => {
    autoUpdater
      .checkForUpdatesAndNotify()
      .then(result => {
        if (!result?.downloadPromise) {
          console.log('[Electron] No update download triggered')
        }
      })
      .catch(error => {
        console.error('[Electron] Failed to check for updates:', error)
      })
  }, 3000)
}

function enterCompactMode() {
  if (!mainWindow) return

  // Save current bounds to restore later
  savedBounds = mainWindow.getBounds()

  // Remove fullscreen if active and prevent entering fullscreen
  mainWindow.setFullScreen(false)
  mainWindow.setFullScreenable(false)

  // Always on top over fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'floating', 1)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Reduce minimum size constraints for compact mode
  mainWindow.setMinimumSize(280, 200)

  // Compute a compact size and position (bottom-right of primary display)
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea
  const width = Math.min(Math.max(360, workArea.width * 0.32), 520)
  const height = Math.min(Math.max(480, workArea.height * 0.6), 760)
  const x = Math.floor(workArea.x + workArea.width - width - 16)
  const y = Math.floor(workArea.y + workArea.height - height - 16)

  mainWindow.setBounds({ x, y, width, height })

  compactMode = true
}

function exitCompactMode() {
  if (!mainWindow) return

  // Restore original minimum size constraints
  mainWindow.setMinimumSize(800, 600)

  // Restore previous bounds if available
  if (savedBounds) {
    mainWindow.setBounds(savedBounds)
  }

  mainWindow.setAlwaysOnTop(false)
  mainWindow.setVisibleOnAllWorkspaces(false)
  mainWindow.setFullScreenable(true)

  compactMode = false
}

function toggleCompactMode() {
  if (compactMode) {
    exitCompactMode()
  } else {
    enterCompactMode()
  }
  return compactMode
}

// Electron-side OpenAI ChatGPT streaming bridge. Renderer never receives raw OAuth tokens.
const activeOpenAIStreams = new Map<string, { aborted: boolean; controller: AbortController }>()

function openAIStorageAdapter() {
  return {
    get: (key: string) => getFromStore(key),
    set: (key: string, value: any) => setInStore(key, value),
    delete: (key: string) => deleteFromStore(key),
  }
}

function sendOpenAIStreamEvent(sender: Electron.WebContents, streamId: string, chunk: any): void {
  if (!sender.isDestroyed()) {
    sender.send('openai:chatgpt:stream-event', { streamId, chunk })
  }
}

ipcMain.handle('openai:chatgpt:isAuthenticated', async () => {
  const status = getAuthManager().snapshot('codex').status
  return status === 'ready' || status === 'refreshing'
})

ipcMain.handle('openai:chatgpt:clearTokens', async () => {
  disconnectAuth('codex')
  return { success: true }
})

ipcMain.handle('openai:chatgpt:usage', async () => {
  return fetchOpenAIUsageStatus()
})

ipcMain.handle('openai:chatgpt:stream-start', async (event, payload: any) => {
  const streamId = `openai_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const state = { aborted: false, controller: new AbortController() }
  activeOpenAIStreams.set(streamId, state)

  void (async () => {
    try {
      const provider = new OpenAiChatgptProvider({
        tokenStore: {
          get: () => null,
          getLatest: () => null,
          upsert: () => {},
          delete: () => {},
        } as any,
      })
      const credential = await getAuthManager().resolve('codex')
      const tokens = { accessToken: credential.accessToken, accountId: credential.userId }
      if (!tokens) {
        throw new Error('OpenAI authentication required. Please sign in with your ChatGPT Plus/Pro account.')
      }
      const output = await provider.generate(
        {
          modelName: payload.modelName,
          systemPrompt: payload.systemPrompt || '',
          history: Array.isArray(payload.messages) ? payload.messages : [],
          userContent: '',
          accessToken: tokens.accessToken,
          accountId: tokens.accountId,
          tools: Array.isArray(payload.tools) ? payload.tools.map((tool: any) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema || tool.parameters })) : [],
          signal: state.controller.signal,
          railwayTurn: {
            conversationId: String(payload.conversationId || ''),
            parentId: payload.parentId ?? null,
            think: payload.think,
            attachmentsBase64: payload.attachmentsBase64 ?? null,
            imageConfig: payload.imageConfig,
            reasoningConfig: payload.reasoningConfig,
            serviceTier: payload.serviceTier,
            promptCacheRetention: payload.promptCacheRetention ?? getOpenAiPromptCacheRetentionFromStore(),
            openaiHostedTools: payload.openaiHostedTools,
            runId: streamId,
            isElectron: true,
          },
        },
        chunk => {
          if (!state.aborted) sendOpenAIStreamEvent(event.sender, streamId, chunk)
        }
      )
      if (!state.aborted) {
        sendOpenAIStreamEvent(event.sender, streamId, {
          type: 'complete',
          message: {
            id: payload.assistantMessageId || streamId,
            conversation_id: payload.conversationId,
            parent_id: payload.parentId ?? null,
            children_ids: [],
            role: 'assistant',
            content: output.content,
            content_plain_text: output.content,
            thinking_block: output.reasoning || '',
            tool_calls: output.toolCalls || [],
            toolCalls: output.toolCalls || [],
            model_name: payload.modelName,
            partial: false,
            created_at: new Date().toISOString(),
            artifacts: [],
            pastedContext: [],
            content_blocks: output.contentBlocks || [],
            context_usage: output.contextUsage || null,
            responses_output_items: output.raw?.responses_output_items,
            generatedImagesDirectoryHint: output.raw?.generatedImagesDirectoryHint,
          },
        })
      }
    } catch (error) {
      if (!state.aborted) {
        console.error('[OpenAIChatGPTBridgeMain] stream failed', {
          streamId,
          error: error instanceof Error ? error.message : String(error),
        })
        sendOpenAIStreamEvent(event.sender, streamId, { type: 'error', error: error instanceof Error ? error.message : String(error) })
      }
    } finally {
      activeOpenAIStreams.delete(streamId)
    }
  })()

  return { success: true, streamId }
})

ipcMain.handle('openai:chatgpt:stream-abort', async (_event, streamId: string) => {
  const state = activeOpenAIStreams.get(streamId)
  if (state) {
    state.aborted = true
    state.controller.abort()
  }
  activeOpenAIStreams.delete(streamId)
  return { success: true }
})
