// Dedicated windowless Electron startup check, not the interactive main entry.
import { app } from 'electron'
import fs from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { AgentJobJournal } from '../server/headlessServer/services/collaboration/agentJobJournal.js'
import { configureHadronEnvironment, hadronName } from '../server/runtimeIdentity.js'

const dataDir = process.env.HADRON_SMOKE_DATA_DIR!
const appDir = process.env.HADRON_SMOKE_APP_DIR!
if (!dataDir || !appDir) throw new Error('Run through check:hadron-startup')
mkdirSync(path.join(dataDir, 'chromium'), { recursive: true })
app.setName(hadronName)
app.setPath('userData', dataDir)
app.setPath('sessionData', path.join(dataDir, 'chromium'))
configureHadronEnvironment(dataDir)
const blockedNetwork: string[] = []
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: any) => {
  blockedNetwork.push(new URL(typeof input === 'string' ? input : input.url ?? input.toString()).origin)
  throw new Error('Network is disabled in the Hadron startup smoke')
}) as typeof fetch

async function runSmoke(): Promise<void> {
  let handle: import('../server/createYggServer.js').YggServerHandle | undefined
  let exitCode = 1
  const report: Record<string, unknown> = { dataDir, electron: process.versions.electron, pid: process.pid }
  try {
    await app.whenReady()
    // Dynamic import is deliberate: Hadron profile/env precedes singleton evaluation.
    const { createYggServer } = await import('../server/createYggServer.js')
    const { resolveYggServerConfig } = await import('../server/serverConfig.js')
    const config = resolveYggServerConfig({ bindHost: '127.0.0.1', preferredPort: 0,
      fallbackPorts: [], allowEphemeralPort: true, dataDir, tempDir: path.join(dataDir, 'temp'),
      dbPath: path.join(dataDir, 'local-sync.db'), resourcesDir: appDir,
      promptsDir: path.join(appDir, 'src/features/chats/prompts'),
      cors: { mode: 'loopback', allowedOrigins: [] }, oauth: { enabled: false, callbackHost: '127.0.0.1', callbackPort: 1455 },
      toolRuntime: { mode: 'local', allowInProcessFallback: false }, allowNonLoopbackBind: false })
    const settings = new Map<string, unknown>()
    handle = await createYggServer(config, {
      configStore: { get: key => settings.get(key), set: (key, value) => { settings.set(key, value) }, delete: key => { settings.delete(key) } },
      secretStore: { getSecret: async () => null, setSecret: async () => { throw new Error('Secrets disabled') }, deleteSecret: async () => {} },
      toolSandbox: { initialize: async () => {}, shutdown: async () => {},
        executeTool: async () => { throw new Error('Tool execution disabled in startup smoke') },
        reloadCustomTools: async () => ({ success: true, totalCount: 0 }) },
    })
    const response = await originalFetch(`${handle.origin}/api/health`)
    const health = await response.json() as any
    if (!response.ok || health.pid !== process.pid || health.status !== 'ok') throw new Error('Server ownership check failed')
    report.health = health
    report.port = handle.port
  const missingStream = await originalFetch(`${handle.origin}/api/streams/hadron-smoke-unowned`)
  await missingStream.text()
  if (missingStream.status !== 410) throw new Error('Generic stream ownership lookup failed')
  report.genericUnownedStreamStatus = missingStream.status
    const disabledStatuses: number[] = []
    for (const [method, suffix] of [['GET', '?conversationId=smoke'], ['POST', ''], ['GET', '/smoke'], ['POST', '/smoke/stop'], ['GET', '/smoke/streams/stream'], ['GET', '/smoke/participants/a/transcript'], ['GET', '/smoke/participants/a/journal']]) {
      const disabled = await originalFetch(`${handle.origin}/api/collaboration/proposals${suffix}`, { method,
        headers: { Authorization: `Bearer ${'a'.repeat(64)}`, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}) })
      await disabled.text()
      if (disabled.status !== 401) throw new Error('Unauthenticated collaboration endpoint accepted a request')
      disabledStatuses.push(disabled.status)
    }
    report.disabledCollaborationStatuses = disabledStatuses
    const disabledJobStatuses: number[] = []
    for (const [method, suffix] of [['POST',''], ['POST','/contexts'], ['GET','/smoke'], ['POST','/smoke/stop'], ['GET','/smoke/transcript'], ['GET','/smoke/streams/stream'], ['GET','/smoke/journal'], ['GET','/smoke/continuity'], ['GET','/smoke/tree']]) {
      const response = await originalFetch(`${handle.origin}/api/collaboration/jobs${suffix}`, { method,
        headers: { Authorization: `Bearer ${'a'.repeat(64)}`, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) })
      await response.text(); if (response.status !== 401) throw new Error('Unauthenticated independent job endpoint accepted a request')
      disabledJobStatuses.push(response.status)
    }
    report.disabledIndependentJobStatuses = disabledJobStatuses

    await fs.access(path.join(dataDir, 'tool-storage', 'custom-tools', 'CUSTOM_TOOLS_GUIDE.md'))
    await handle.close()
    await handle.close() // lifecycle close is single-flight/idempotent
    const require = createRequire(path.join(appDir, 'package.json'))
    const Database = require('better-sqlite3')
    const db = new Database(config.dbPath)
    try {
      report.schemaVersion = db.pragma('user_version', { simple: true })
      report.tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'hadron_%' ORDER BY name").all()
      const tableNames=new Set((report.tables as Array<{name:string}>).map(table=>table.name))
      const requiredTables=['hadron_sessions','hadron_participants','hadron_independent_jobs','hadron_helpers','hadron_verification_runs','hadron_workspace_chats','hadron_workspace_bin']
      if ((report.schemaVersion as number) < 11 || !requiredTables.every(name=>tableNames.has(name))) throw new Error('Collaboration schema missing')
      const journal = new AgentJobJournal(path.join(dataDir, 'hadron-job-logs'))
      if (process.env.HADRON_SMOKE_PHASE === 'seed') {
        const owner = 'hadron-recovery-smoke', id = 'recovery-job', conversationId = 'recovery-conversation', anchorMessageId = 'recovery-anchor'
        db.prepare('INSERT INTO users(id,username) VALUES (?,?)').run(owner, owner)
        db.prepare("INSERT INTO conversations(id,user_id,storage_mode) VALUES (?,?,'local')").run(conversationId, owner)
        db.prepare("INSERT INTO messages(id,conversation_id,role,content) VALUES (?,?,'user','Fixture anchor')").run(anchorMessageId, conversationId)
        const configJson = JSON.stringify({ schemaVersion: 1, id, conversationId, anchorMessageId, task: 'Restart fixture goal', context: '', provider: 'openaichatgpt', modelName: 'fixture-only', deadlineMs: 10000 })
        db.prepare("INSERT INTO hadron_independent_jobs(id,owner_id,conversation_id,anchor_message_id,config_json,config_hash,status) VALUES (?,?,?,?,?,?,'running')")
          .run(id, owner, conversationId, anchorMessageId, configJson, 'fixture')
        journal.checkpoint({ ownerId: owner, jobId: id, participantId: 'independent', task: 'Restart fixture goal', context: '', provider: 'openaichatgpt', modelName: 'fixture-only',
          status: 'running', revision: 0, runId: null, text: 'Saved visible notes before restart' })
        report.restartSeeded = true
      } else if (process.env.HADRON_SMOKE_PHASE === 'recover') {
        const row = db.prepare("SELECT status FROM hadron_independent_jobs WHERE id='recovery-job'").get()
        const saved = journal.read('hadron-recovery-smoke', 'recovery-job', 'independent')
        if (row?.status !== 'interrupted' || !saved.markdown.includes('Saved visible notes before restart') || !saved.markdown.includes('Status: interrupted')) throw new Error('Restart lost job continuity')
        report.restartRecovery = true
      }
    } finally { db.close() }
    try { await originalFetch(`${handle.origin}/api/health`, { signal: AbortSignal.timeout(2000) }); throw new Error('Server still listening after close') }
    catch (error) { if ((error as Error).message === 'Server still listening after close') throw error }
    report.shutdown = 'closed'
    if (blockedNetwork.length) throw new Error('Startup attempted network access')
    report.success = true
    exitCode = 0
  } catch (error) {
    report.success = false
    report.error = (error as Error).message
    console.error(error)
  } finally {
    await handle?.close().catch(() => {})
    report.blockedNetwork = blockedNetwork
    await fs.writeFile(path.join(dataDir, 'smoke-result.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    app.exit(exitCode)
  }
}
void runSmoke().catch(error => { console.error(error); app.exit(1) })
