import { build } from 'esbuild'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
const appDir = path.resolve(import.meta.dirname, '..')
const profile = await mkdtemp(path.join(os.tmpdir(), 'hadron-claude-probe-'))
const outfile = path.join(appDir, 'node_modules/.cache/hadron/claude-runtime-probe.mjs')
await mkdir(path.dirname(outfile), { recursive: true })
await build({ entryPoints: [path.join(appDir, 'server/headlessServer/providers/claudeCodeRuntime.ts')], outfile, platform: 'node', format: 'esm', bundle: true, target: 'node22' })
const { ClaudeCodeRuntime } = await import(pathToFileURL(outfile).href)
const runtime = new ClaudeCodeRuntime({ runtimeDirectory: path.join(appDir, 'vendor/claude-code'), profileDirectory: profile,reuseExistingLogin:false })
const status = await runtime.status()
const report = { profile, status, inferenceInvocations: 0, purpose: 'Fresh isolated profile: --version and auth status only; no sign-in or inference.' }
await writeFile(path.join(profile, 'probe-result.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!status.installed || status.reason !== 'signed_out') process.exitCode = 1
