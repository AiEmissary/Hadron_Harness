import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { codexResource } from './codex-packaging.mjs'
test('Codex packaging includes only its pinned target and notices, and fails on unsupported targets', () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'hadron-codex-packaging-'))
  const root = path.join(app, 'vendor/codex'), native = path.join(root, 'node_modules/@openai/codex-win32-x64')
  try {
    const bin = path.join(native, 'vendor/x86_64-pc-windows-msvc/bin')
    fs.mkdirSync(bin, { recursive: true })
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { '@openai/codex': '0.166.0' } }))
    fs.writeFileSync(path.join(native, 'package.json'), JSON.stringify({ name: '@openai/codex', version: '0.166.0-win32-x64' }))
    fs.writeFileSync(path.join(bin, 'codex.exe'), 'fixture')
    fs.writeFileSync(path.join(root, 'LICENSE'), 'fixture'); fs.writeFileSync(path.join(root, 'NOTICE'), 'fixture')
    const resource = codexResource(app, 'win32', 'x64')
    assert.equal(resource.to, 'codex'); assert.ok(resource.filter.includes('LICENSE'))
    assert.ok(resource.filter.includes('node_modules/@openai/codex-win32-x64/**/*'))
    assert.ok(!resource.filter.some(item => item.includes('auth.json') || item.includes('codex-runtime')))
    assert.throws(() => codexResource(app, 'darwin', 'arm64'), /Windows/)
    fs.writeFileSync(path.join(native, 'package.json'), JSON.stringify({ name: '@openai/codex', version: 'wrong' }))
    assert.throws(() => codexResource(app, 'win32', 'x64'), /package/)
  } finally { fs.rmSync(app, { recursive: true, force: true }) }
})
