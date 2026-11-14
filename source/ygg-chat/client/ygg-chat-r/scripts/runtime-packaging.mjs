import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { claudeResource } from './claude-packaging.mjs'
import { codexResource } from './codex-packaging.mjs'
import {patchHadronNsis} from './patch-hadron-nsis.mjs'

// Bundled JS does not need a second copy of its npm package. Keep the native
// externals, the dynamically loaded vector extension, and updater resources.
// Preserve their complete dependency trees (including install-time helpers) so
// native rebuilding and nested package versions remain electron-builder's job.
export const runtimePackages = ['better-sqlite3', 'keytar', 'node-pty', 'sqlite-vec', 'electron-updater']

function resolveManifest(name, from) {
  const require = createRequire(path.join(from, 'package.json'))
  // Looking up package.json directly fails for packages with an exports map.
  for (const directory of require.resolve.paths(`${name}/package.json`) || []) {
    const candidate = path.join(directory, name, 'package.json')
    if (fs.existsSync(candidate)) return fs.realpathSync(candidate)
  }
  return null
}

export function collectRuntimePackages(appDir, roots = runtimePackages) {
  const names = new Set()
  const visited = new Set()
  function visit(name, from, optional = false) {
    const manifestPath = resolveManifest(name, from)
    if (!manifestPath) {
      if (optional) return
      throw new Error(`Missing packaged runtime dependency ${name} (required from ${from})`)
    }
    names.add(name)
    if (visited.has(manifestPath)) return
    visited.add(manifestPath)
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const optionalDependencies = manifest.optionalDependencies || {}
    const dependencies = { ...manifest.dependencies, ...optionalDependencies }
    for (const dependency of Object.keys(dependencies)) {
      visit(dependency, path.dirname(manifestPath), dependency in optionalDependencies)
    }
    for (const peer of Object.keys(manifest.peerDependencies || {})) {
      visit(peer, path.dirname(manifestPath), manifest.peerDependenciesMeta?.[peer]?.optional === true)
    }
  }
  for (const root of roots) visit(root, appDir)
  return [...names].sort()
}

export function runtimeExclusions(names) {
  // Filter only top-level packages. An allowed package's nested node_modules
  // must remain intact: e.g. bindings needs file-uri-to-path v1, not root v2.
  const topLevel = new Set()
  const scopes = new Map()
  for (const name of names) {
    if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) {
      throw new Error(`Invalid runtime package name: ${name}`)
    }
    if (name.startsWith('@')) {
      const [scope, packageName] = name.split('/')
      topLevel.add(scope)
      if (!scopes.has(scope)) scopes.set(scope, [])
      scopes.get(scope).push(packageName)
    } else {
      topLevel.add(name)
    }
  }
  if (topLevel.size === 0) throw new Error('Runtime package allowlist cannot be empty')
  return [
    `!node_modules/!(${[...topLevel].sort().join('|')}){,/**/*}`,
    ...[...scopes].sort().map(([scope, packages]) =>
      `!node_modules/${scope}/!(${packages.sort().join('|')}){,/**/*}`),
  ]
}

let previousExclusions = []

// Runs for every electron-builder entry point, including direct/CI packaging.
// Leave the source manifest untouched so updater detection and native rebuilds
// keep working. Only the packaged copy is filtered, not development installs.
export default async function beforePack(context) {
  const { appDir, config } = context.packager.info
  if(context.electronPlatformName==='win32')console.log('[packaging] NSIS Windows path fix: '+JSON.stringify(patchHadronNsis(appDir)))
  // Require working target binaries before packaging. Do not rebuild node-pty:
  // its official Windows N-API prebuild avoids requiring recipients/builders
  // to install Spectre-enabled Visual Studio libraries.
  if (context.electronPlatformName === 'win32' && process.platform === 'win32') {
    const require = createRequire(path.join(appDir, 'package.json'))
    const probe = spawnSync(require('electron'), ['-e', `
      const DB=require('better-sqlite3');const db=new DB(':memory:');
      require('sqlite-vec').load(db);db.close();require('keytar');
      const pty=require('node-pty').spawn(process.env.ComSpec||'cmd.exe',['/d','/c','echo HADRON_NATIVE_OK'],{cols:80,rows:24});
      let text='';pty.onData(chunk=>text+=chunk);pty.onExit(({exitCode})=>process.exit(exitCode===0&&text.includes('HADRON_NATIVE_OK')?0:1));
    `], {cwd:appDir, env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'utf8',timeout:15000,windowsHide:true})
    if (probe.status !== 0) throw Error(`Target Electron native dependency check failed. Run rebuild:client before packaging. ${probe.stderr||probe.error||probe.status}`)
    console.log('[packaging] Target Electron SQLite/vector, keytar and Windows PTY prebuild passed')
  }
  const names = collectRuntimePackages(appDir)
  const arch = ['ia32', 'x64', 'armv7l', 'arm64', 'universal'][context.arch]
  const claude = claudeResource(appDir, context.electronPlatformName, arch)
  const codex = codexResource(appDir, context.electronPlatformName, arch)
  config.extraResources = [...(config.extraResources || []).filter(entry => !['claude-code', 'codex'].includes(entry.to)), claude, codex]
  const platform = context.electronPlatformName === 'win32' ? 'windows' : context.electronPlatformName
  if (!names.includes(`sqlite-vec-${platform}-${arch}`)) {
    throw new Error(`Missing sqlite-vec native package for ${platform}-${arch}; install target dependencies before packaging`)
  }
  const exclusions = runtimeExclusions(names)
  // electron-builder normalizes strings into { filter: [...] } before hooks.
  // Append to that matcher, not a new exclude-only matcher (which would imply
  // **/* and accidentally ship the entire project, including local files).
  const fileSet = config.files.find(entry => typeof entry === 'object' && entry.from == null && entry.to == null)
  if (!fileSet || !Array.isArray(fileSet.filter)) {
    throw new Error('Expected electron-builder normalized root files filter')
  }
  fileSet.filter = fileSet.filter.filter(entry => !previousExclusions.includes(entry))
  fileSet.filter.push(...exclusions)
  previousExclusions = exclusions
  console.log(`[packaging] Keeping ${names.length} runtime packages; excluding already-bundled dependencies`)
}
