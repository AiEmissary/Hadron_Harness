import { expect, it, vi } from 'vitest'
import fs, { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { HadronChatgptStore } from '../auth/hadronChatgptStore.js'
import type { HadronChatgptAccount } from '../auth/hadronChatgptSignIn.js'
import { ExecutionStartup, executionStartup } from '../hadronTools/executionStartup.js'
import { ProjectExecutionGate } from '../hadronTools/executionGate.js'

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hadron-auth-store-')), key = randomBytes(32)
  // Fixture AES verifies persistence boundaries; production must inject safeStorage.
  const cipher = { isEncryptionAvailable: () => true,
    encryptString(value: string) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv)
      return Buffer.concat([iv, c.update(value, 'utf8'), c.final(), c.getAuthTag()]) },
    decryptString(value: Buffer) { const c = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); c.setAuthTag(value.subarray(-16))
      return Buffer.concat([c.update(value.subarray(12, -16)), c.final()]).toString('utf8') } }
  const store = new HadronChatgptStore(root, cipher)
  return { root, store, cipher, clean: () => {
    vi.restoreAllMocks()
    const target = path.resolve(root), temp = path.resolve(os.tmpdir())
    if (path.dirname(target) !== temp || !path.basename(target).startsWith('hadron-auth-store-')) throw Error('Unexpected fixture cleanup path')
    rmSync(target, { recursive: true, force: true })
  } }
}
function account(hostId: string): HadronChatgptAccount {
  return { issuer: 'https://auth.openai.com', clientId: 'oaiapp_test', hostId, subject: 'subject',
    accessToken: 'private-access', refreshToken: 'private-refresh', idToken: 'private-id', expiresAt: Date.now() + 3600000,
    scopes: ['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'] }
}
it('persists host identity before login and encrypts the complete account across restart', () => {
  const f = fixture()
  try {
    const host = f.store.hostId(); expect(f.store.account()).toBeNull()
    const saved = account(host); f.store.save(saved)
    expect(readFileSync(f.store.filename).toString('utf8')).not.toMatch(/private-access|private-refresh|subject|oaiapp_test/)
    const reopened = new HadronChatgptStore(f.root, f.cipher)
    expect(reopened.hostId()).toBe(host); expect(reopened.account()).toEqual(saved)
    reopened.disconnect(); expect(reopened.account()).toBeNull(); expect(reopened.hostId()).toBe(host)
  } finally { f.clean() }
})
it('fails closed without encryption and preserves corrupt or mismatched records', () => {
  const f = fixture()
  try {
    const host = f.store.hostId(), original = readFileSync(f.store.filename)
    expect(() => f.store.save(account('urn:uuid:00000000-0000-4000-8000-000000000000'))).toThrow('identity mismatch')
    expect(readFileSync(f.store.filename)).toEqual(original)
    vi.spyOn(f.cipher, 'isEncryptionAvailable').mockReturnValue(false)
    expect(() => f.store.save(account(host))).toThrow('unavailable')
    expect(readFileSync(f.store.filename)).toEqual(original)
    vi.mocked(f.cipher.isEncryptionAvailable).mockReturnValue(true)
    writeFileSync(f.store.filename, 'corrupt fixture')
    expect(() => f.store.hostId()).toThrow('existing data was preserved')
    expect(readFileSync(f.store.filename, 'utf8')).toBe('corrupt fixture')
  } finally { f.clean() }
})
it('an encryption/write failure retains the last committed account', () => {
  const f = fixture()
  try {
    const host = f.store.hostId(), saved = account(host); f.store.save(saved)
    vi.spyOn(f.cipher, 'encryptString').mockImplementationOnce(() => { throw new Error('fixture storage failure') })
    expect(() => f.store.disconnect()).toThrow('fixture storage failure')
    expect(f.store.account()).toEqual(saved)
  } finally { f.clean() }
})

it('retains only an encrypted issued client for recovery, without making it an authenticated account', () => {
  const f = fixture()
  try {
    const host = f.store.hostId()
    f.store.rememberRegistration('oaiapp_pending')
    const reopened = new HadronChatgptStore(f.root, f.cipher)
    expect(reopened.registration()).toEqual({ clientId: 'oaiapp_pending' })
    expect(reopened.account()).toBeNull()
    expect(reopened.hostId()).toBe(host)
    expect(readFileSync(f.store.filename).toString('utf8')).not.toContain('oaiapp_pending')
    const saved = account(host); reopened.save(saved)
    reopened.rememberRegistration('oaiapp_other')
    expect(reopened.registration()).toMatchObject({ clientId: saved.clientId, subject: saved.subject })
    reopened.disconnect(); expect(reopened.registration()).toBeNull()
  } finally { f.clean() }
})

it('refuses a linked account directory without reading or changing its target', () => {
  const f = fixture(), other = fixture()
  try {
    other.store.hostId()
    const original = readFileSync(other.store.filename)
    fs.symlinkSync(path.dirname(other.store.filename), path.join(f.root, 'subscription-auth'), 'junction')
    const decrypt = vi.spyOn(f.cipher, 'decryptString')
    expect(() => f.store.hostId()).toThrow('existing data was preserved')
    expect(() => f.store.disconnect()).toThrow('existing data was preserved')
    expect(decrypt).not.toHaveBeenCalled()
    expect(readFileSync(other.store.filename)).toEqual(original)
  } finally { f.clean(); other.clean() }
})

it('refuses hard-linked credential leaves, including sign-out', () => {
  const f = fixture()
  try {
    f.store.hostId()
    const original = readFileSync(f.store.filename), alias = path.join(f.root, 'retained.enc')
    fs.linkSync(f.store.filename, alias)
    const decrypt = vi.spyOn(f.cipher, 'decryptString')
    expect(() => f.store.account()).toThrow('existing data was preserved')
    expect(() => f.store.disconnect()).toThrow('existing data was preserved')
    expect(decrypt).not.toHaveBeenCalled()
    expect(readFileSync(alias)).toEqual(original)
  } finally { f.clean() }
})

it('rejects oversized and changed-during-read records before decryption', () => {
  const f = fixture()
  try {
    f.store.hostId()
    const original = readFileSync(f.store.filename), decrypt = vi.spyOn(f.cipher, 'decryptString')
    writeFileSync(f.store.filename, Buffer.alloc(262145))
    expect(() => f.store.account()).toThrow('existing data was preserved')
    writeFileSync(f.store.filename, original)
    const read = fs.readSync.bind(fs)
    vi.spyOn(fs, 'readSync').mockImplementationOnce(((...args: Parameters<typeof fs.readSync>) => {
      const count = read(...args)
      writeFileSync(f.store.filename, Buffer.concat([original, Buffer.from('changed')]))
      return count
    }) as typeof fs.readSync)
    expect(() => f.store.account()).toThrow('existing data was preserved')
    expect(decrypt).not.toHaveBeenCalled()
  } finally { f.clean() }
})

it('does not delete an existing temporary file when exclusive creation fails', () => {
  const f = fixture()
  try {
    f.store.hostId()
    const original = readFileSync(f.store.filename), open = fs.openSync.bind(fs)
    let collided = ''
    vi.spyOn(fs, 'openSync').mockImplementation(((filename: fs.PathLike, flags: string | number, mode?: fs.Mode) => {
      if (String(filename).endsWith('.tmp')) { collided = String(filename); writeFileSync(collided, 'unowned fixture') }
      return open(filename, flags, mode)
    }) as typeof fs.openSync)
    expect(() => f.store.disconnect()).toThrow()
    expect(collided).not.toBe('')
    expect(readFileSync(collided, 'utf8')).toBe('unowned fixture')
    expect(readFileSync(f.store.filename)).toEqual(original)
  } finally { f.clean() }
})

it('retains the committed account and removes only its own temporary on write failure', () => {
  const f = fixture()
  try {
    f.store.hostId()
    const original = readFileSync(f.store.filename), files = fs.readdirSync(path.dirname(f.store.filename))
    vi.spyOn(fs, 'fsyncSync').mockImplementationOnce(() => { throw Error('fixture sync failure') })
    expect(() => f.store.disconnect()).toThrow('fixture sync failure')
    expect(readFileSync(f.store.filename)).toEqual(original)
    expect(fs.readdirSync(path.dirname(f.store.filename))).toEqual(files)
  } finally { f.clean() }
})

it('does not adopt a replaced profile directory', () => {
  const f = fixture()
  const originalDirectory = path.join(f.root, 'original-profile'), profile = path.join(f.root, 'profile')
  try {
    fs.mkdirSync(profile)
    const store = new HadronChatgptStore(profile, f.cipher)
    store.hostId(); const original = readFileSync(store.filename)
    fs.renameSync(profile, originalDirectory); fs.mkdirSync(profile)
    expect(() => store.hostId()).toThrow('existing data was preserved')
    expect(fs.readdirSync(profile)).toEqual([])
    expect(readFileSync(path.join(originalDirectory, 'subscription-auth', 'chatgpt-v1.enc'))).toEqual(original)
  } finally { f.clean() }
})

it('uses the configured private profile without tainting or releasing a held project scope', () => {
  const f = fixture(), other = fixture()
  try {
    const gate = new ProjectExecutionGate(), startup = new ExecutionStartup(gate)
    startup.initialize(f.root, 'project')
    vi.spyOn(executionStartup, 'isConfigured').mockImplementation(() => startup.isConfigured())
    vi.spyOn(executionStartup, 'assertPrivatePath').mockImplementation(target => startup.assertPrivatePath(target))
    const scope = gate.enter('owner', 'workspace'), marker = path.join(f.root, 'project-execution', 'execution.json')
    const before = readFileSync(marker)
    expect(() => new HadronChatgptStore(other.root, other.cipher)).toThrow('pinned profile')
    expect(fs.readdirSync(other.root)).toEqual([])
    const host = f.store.hostId(); f.store.save(account(host)); f.store.disconnect()
    expect(f.store.hostId()).toBe(host); expect(f.store.account()).toBeNull()
    expect(readFileSync(marker)).toEqual(before)
    gate.assert(scope, 'owner', 'workspace'); gate.release(scope, 'owner', 'workspace')
  } finally { f.clean(); other.clean() }
})
