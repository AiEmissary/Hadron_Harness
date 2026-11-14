// Explicit live check of production job/subagent/persistence/journal layers.
// Synthetic task and fresh test database only; own Hadron subscription auth.
import { build } from 'esbuild'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
if (!process.argv.includes('--live')) throw Error('Explicit --live required')
const appDir = path.resolve(import.meta.dirname, '..'), cache = path.join(appDir, 'node_modules/.cache/hadron')
await mkdir(cache, { recursive: true })
const profile = await mkdtemp(path.join(os.tmpdir(), 'hadron-codex-service-'))
const entry = path.join(cache, 'codex-service-entry.ts'), outfile = path.join(cache, 'codex-service-check.mjs')
const module = relative => JSON.stringify(path.join(appDir, relative).replaceAll('\\', '/'))
await writeFile(entry, `import {HadronCodexRuntime} from ${module('server/auth/hadronCodexRuntime.ts')};
import {proposalSqlite} from ${module('server/headlessServer/services/__tests__/fixtures/proposalSqlite.ts')};
import {createIndependentJobsSchema} from ${module('server/headlessServer/persistence/independentJobsSchema.ts')};
import {IndependentJobsRepo} from ${module('server/headlessServer/persistence/independentJobsRepo.ts')};
import {IndependentJobService} from ${module('server/headlessServer/services/collaboration/independentJobService.ts')};
import {AgentJobJournal} from ${module('server/headlessServer/services/collaboration/agentJobJournal.ts')};
export {HadronCodexRuntime,proposalSqlite,createIndependentJobsSchema,IndependentJobsRepo,IndependentJobService,AgentJobJournal};`)
process.env.HADRON_DESKTOP = '1'
process.env.HADRON_CONFIG_DIR = path.join(profile, 'settings')
process.env.YGG_APP_USER_DATA = profile
process.env.YGG_HOOKS_DIRECTORY = path.join(profile, '.ygg')
process.env.YGG_CUSTOM_TOOLS_DIRECTORY = path.join(profile, 'tool-storage')
process.env.YGG_THEME_DIRECTORY = path.join(profile, 'themes')
await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  banner: { js: "import {createRequire as hadronProbeRequire} from 'node:module';const require=hadronProbeRequire(import.meta.url);" } })
const modules = await import(pathToFileURL(outfile))
const runtime = new modules.HadronCodexRuntime({ runtimeDirectory: path.join(appDir, 'vendor/codex'), profileDirectory: path.join(process.env.APPDATA, 'Hadron-Harness-Development'), openBrowser: async () => { throw Error('No auth flow') } })
const models = await runtime.models(); if (!models.length) throw Error('No models')
let requests = 0
const fixture = modules.proposalSqlite({ generate: async (_provider, input, emit) => { requests++; return runtime.generate(input, emit) } })
try {
  fixture.db.exec('CREATE TABLE streaming_runs (stream_id TEXT PRIMARY KEY)')
  modules.createIndependentJobsSchema(fixture.db)
  const journal = new modules.AgentJobJournal(path.join(profile, 'logs'))
  const service = new modules.IndependentJobService({ jobs: new modules.IndependentJobsRepo(fixture.db), agents: fixture.agents, runs: fixture.runs,
    allowedModels: runtime.allowedModels, journal, authorize: owner => { if (owner !== 'owner') throw Error('Wrong owner') } })
  await service.start('owner', { schemaVersion: 1, id: 'fixed-job-a', conversationId: 'c1', anchorMessageId: fixture.anchor.id,
    task: 'Calculate 7 plus 5. Give the answer and a concise handoff. Do not use tools.', context: '', provider: 'openaichatgpt', modelName: models[0].id })
  const status = service.status('owner', 'fixed-job-a'), transcript = service.transcript('owner', 'fixed-job-a'), log = service.journal('owner', 'fixed-job-a')
  if (status.status !== 'completed' || !transcript?.text.includes('12') || !log?.markdown.includes('12') || requests !== 1) throw Error('Production job pipeline failed')
  const report = { success: true, completed: true, responseSaved: true, journalSaved: true, requests, model: models[0].id, profile, realUserFilesSent: false }
  await writeFile(path.join(profile, 'service-result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
} finally { fixture.close(); runtime.cancelJobs() }
