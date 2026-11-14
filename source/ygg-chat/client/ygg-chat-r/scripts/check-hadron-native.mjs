// No app launch, profile, network, credential API or shell/PTY creation.
// Load required bindings in the pinned Electron runtime, using in-memory SQLite.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const appDir = path.resolve(import.meta.dirname, '..')
const electronDir = path.dirname(require.resolve('electron/package.json'))
const pathFile = path.join(electronDir, 'path.txt')
if (!fs.existsSync(pathFile)) {
  console.error('Hadron native check: pinned Electron runtime is not installed')
  process.exit(1)
}
const executable = path.join(electronDir, 'dist', fs.readFileSync(pathFile, 'utf8').trim())
const code = `
const {createRequire}=require('node:module');
const appRequire=createRequire(${JSON.stringify(path.join(appDir, 'package.json'))});
const results=[];
for (const name of ['better-sqlite3','keytar','node-pty']) {
  try {
    const binding=appRequire(name);
    if(name==='better-sqlite3') {
      const db=new binding(':memory:');
      try { if(db.prepare('SELECT 1 AS ok').get().ok!==1) throw new Error('SQLite probe failed'); }
      finally { db.close(); }
    }
    results.push({name,ready:true});
  } catch(error) {
    results.push({name,ready:false,error:String(error.message).split('\\n')[0]});
  }
}
console.log(JSON.stringify({electron:process.versions.electron,abi:process.versions.modules,results},null,2));
process.exitCode=results.every(result=>result.ready)?0:1;
`
const result = spawnSync(executable, ['-e', code], {
  cwd: appDir,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  encoding: 'utf8', windowsHide: true, timeout: 30_000,
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
