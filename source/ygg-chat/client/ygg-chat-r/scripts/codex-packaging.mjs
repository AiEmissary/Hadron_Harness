import fs from 'node:fs'
import path from 'node:path'
export function codexResource(appDir, platform, arch) {
  if (platform !== 'win32' || arch !== 'x64') throw new Error('Hadron Codex packaging is currently validated for Windows x64 only')
  const root = fs.realpathSync(path.join(appDir, 'vendor/codex'))
  const wrapper = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (wrapper.dependencies?.['@openai/codex'] !== '0.166.0') throw new Error('Unexpected pinned Codex version')
  const relative = 'node_modules/@openai/codex-win32-x64'
  const directory = fs.realpathSync(path.join(root, relative))
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  if (manifest.name !== '@openai/codex' || manifest.version !== '0.166.0-win32-x64') throw new Error('Unexpected Codex native package')
  const binary = fs.realpathSync(path.join(directory, 'vendor/x86_64-pc-windows-msvc/bin/codex.exe'))
  for (const target of [directory, binary]) {
    const within = path.relative(root, target)
    if (within.startsWith('..') || path.isAbsolute(within)) throw new Error('Codex target escapes vendor directory')
  }
  if (!fs.statSync(binary).size) throw new Error('Codex executable is empty')
  for (const name of ['LICENSE', 'NOTICE']) if (!fs.statSync(path.join(root, name)).isFile()) throw new Error('Missing Codex notices')
  return { from: root, to: 'codex', filter: ['package.json', 'package-lock.json', 'README.md', 'LICENSE', 'NOTICE', `${relative}/**/*`,
    'node_modules/@openai/codex/package.json', 'node_modules/@openai/codex/README*'] }
}
