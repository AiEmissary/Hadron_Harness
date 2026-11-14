import fs from 'node:fs'
import path from 'node:path'

// Keep the executable unmodified and outside ASAR. Never package a user profile.
export function claudeResource(appDir, platform, arch) {
  if (platform !== 'win32' || !['x64', 'arm64'].includes(arch)) {
    throw new Error('Claude packaging currently validated for Windows only')
  }
  const root = fs.realpathSync(path.join(appDir, 'vendor', 'claude-code'))
  const wrapper = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const version = wrapper.dependencies?.['@anthropic-ai/claude-code']
  if (version !== '2.1.318') throw new Error('Unexpected pinned Claude runtime version')
  const name = `@anthropic-ai/claude-code-${platform}-${arch}`
  const relative = `node_modules/${name}`
  const directory = fs.realpathSync(path.join(root, relative))
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  if (manifest.name !== name || manifest.version !== version) throw new Error('Claude target package/version mismatch')
  const binary = fs.realpathSync(path.join(directory, 'claude.exe'))
  for (const candidate of [directory, binary]) {
    const within = path.relative(root, candidate)
    if (within.startsWith('..') || path.isAbsolute(within)) throw new Error('Claude package escapes vendor directory')
  }
  if (!fs.statSync(binary).isFile() || fs.statSync(binary).size === 0) throw new Error('Claude executable is missing')
  return { from: root, to: 'claude-code', filter: [
    'package.json', 'package-lock.json', 'README.md',
    `${relative}/**/*`,
    'node_modules/@anthropic-ai/claude-code/package.json',
    'node_modules/@anthropic-ai/claude-code/LICENSE*',
    'node_modules/@anthropic-ai/claude-code/NOTICE*',
    'node_modules/@anthropic-ai/claude-code/README*',
  ] }
}
