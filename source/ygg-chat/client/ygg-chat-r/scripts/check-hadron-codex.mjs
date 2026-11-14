import { build } from 'esbuild'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const appDir = path.resolve(import.meta.dirname, '..')
const output = path.join(appDir, 'node_modules/.cache/hadron/codex-probe.mjs')
await mkdir(path.dirname(output), { recursive: true })
await build({ entryPoints: [path.join(appDir, 'server/auth/hadronCodexRuntime.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm' })
const { HadronCodexRuntime } = await import(pathToFileURL(output))
const profile = await mkdtemp(path.join(os.tmpdir(), 'hadron-codex-smoke-'))
const runtime = new HadronCodexRuntime({ runtimeDirectory: path.join(appDir, 'vendor/codex'), profileDirectory: profile,
  openBrowser: async () => { throw Error('Browser must not open during local status probe') } })
const status = await runtime.status()
if (!status.installed || status.connected || status.reason !== 'signed_out') throw Error(`Unexpected isolated Codex status: ${status.reason}`)
const report = { success: true, installed: status.installed, connected: status.connected, reason: status.reason,
  ownProfile: runtime.environment.CODEX_HOME.startsWith(profile), browserOpened: false, realCredentialsUsed: false, profile }
await writeFile(path.join(profile, 'codex-result.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
