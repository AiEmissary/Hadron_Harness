import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const appDir = path.resolve(import.meta.dirname, '..')
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hadron-startup-'))
const bundleDir = path.join(appDir, 'node_modules', '.cache', 'hadron')
await fs.mkdir(bundleDir, { recursive: true })
const outfile = path.join(bundleDir, 'startup-smoke.mjs')
await build({ entryPoints: [path.join(appDir, 'electron/hadronStartupSmoke.ts')], outfile,
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  external: ['electron', 'better-sqlite3', 'keytar', 'node-pty'],
  banner: { js: "import { createRequire as smokeBannerRequire } from 'node:module'; const require = smokeBannerRequire(import.meta.url);" } })
const executable = require('electron')
const env = { ...process.env, HADRON_SMOKE_DATA_DIR: dataDir, HADRON_SMOKE_APP_DIR: appDir }
delete env.ELECTRON_RUN_AS_NODE
console.log(`Hadron startup smoke profile: ${dataDir}`)
async function phase(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [outfile], { cwd: appDir, env: { ...env, HADRON_SMOKE_PHASE: name }, windowsHide: true, stdio: 'inherit' })
    const timer = setTimeout(() => { child.kill(); reject(new Error('Hadron startup smoke timed out')) }, 60_000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Hadron ${name} phase failed (${code})`)) })
  })
}
try { await phase('seed'); await phase('recover') }
catch (error) { console.error(error); process.exitCode = 1 }
