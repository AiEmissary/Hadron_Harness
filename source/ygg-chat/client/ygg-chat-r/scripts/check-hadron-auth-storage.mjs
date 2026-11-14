import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'

const require = createRequire(import.meta.url), appDir = path.resolve(import.meta.dirname, '..')
const profile = await mkdtemp(path.join(os.tmpdir(), 'hadron-auth-smoke-'))
const outfile = path.join(appDir, 'node_modules/.cache/hadron/subscription-storage-smoke.mjs')
await mkdir(path.dirname(outfile), { recursive: true })
await build({ entryPoints: [path.join(appDir, 'electron/hadronSubscriptionStorageSmoke.ts')], outfile,
  bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['electron'] })
const env = { ...process.env, HADRON_AUTH_SMOKE_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE
async function phase(name) {
  await new Promise((resolve, reject) => {
    const child = spawn(require('electron'), [outfile], { cwd: appDir, windowsHide: true,
      env: { ...env, HADRON_AUTH_SMOKE_PHASE: name }, stdio: 'inherit' })
    const timer = setTimeout(() => { child.kill(); reject(new Error('Storage smoke timed out')) }, 30000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Storage smoke failed (${code})`)) })
  })
}
await phase('registration'); await phase('seed'); await phase('recover')
