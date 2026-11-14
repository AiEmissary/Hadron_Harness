import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { claudeResource } from './claude-packaging.mjs'

test('Claude packaging requires the exact target binary and excludes profiles/other targets', () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'hadron-claude-packaging-'))
  const root = path.join(app, 'vendor', 'claude-code')
  const native = path.join(root, 'node_modules', '@anthropic-ai', 'claude-code-win32-x64')
  try {
    fs.mkdirSync(native, { recursive: true })
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { '@anthropic-ai/claude-code': '2.1.318' } }))
    const manifest = path.join(native, 'package.json')
    fs.writeFileSync(manifest, JSON.stringify({ name: '@anthropic-ai/claude-code-win32-x64', version: '2.1.318' }))
    assert.throws(() => claudeResource(app, 'win32', 'x64'), /ENOENT/)
    fs.writeFileSync(path.join(native, 'claude.exe'), 'synthetic executable fixture')
    const resource = claudeResource(app, 'win32', 'x64')
    assert.equal(resource.to, 'claude-code')
    assert.ok(resource.filter.includes('node_modules/@anthropic-ai/claude-code-win32-x64/**/*'))
    assert.ok(!resource.filter.includes('**/*'))
    assert.throws(() => claudeResource(app, 'win32', 'arm64'), /ENOENT/)
    assert.throws(() => claudeResource(app, 'darwin', 'arm64'), /Windows only/)
    fs.writeFileSync(manifest, JSON.stringify({ name: '@anthropic-ai/claude-code-win32-x64', version: 'other' }))
    assert.throws(() => claudeResource(app, 'win32', 'x64'), /mismatch/)
  } finally { fs.rmSync(app, { recursive: true, force: true }) }
})
