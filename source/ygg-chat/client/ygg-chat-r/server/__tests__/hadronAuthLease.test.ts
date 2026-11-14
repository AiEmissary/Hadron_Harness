import { expect, it, vi } from 'vitest'
import fs, { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withHadronAuthLease } from '../auth/hadronAuthLease.js'
function cleanup(root: string) {
  const target = path.resolve(root)
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('hadron-lease-')) throw Error('Unexpected lease fixture cleanup')
  rmSync(target, { recursive: true, force: true })
}
it('excludes overlapping owners and releases after success or failure', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hadron-lease-'))
  try {
    await withHadronAuthLease(root, async () => {
      await expect(withHadronAuthLease(root, async () => {})).rejects.toThrow('locked')
    })
    await expect(withHadronAuthLease(root, async () => { throw new Error('fixture') })).rejects.toThrow('fixture')
    expect(await withHadronAuthLease(root, async () => 'released')).toBe('released')
  } finally { cleanup(root) }
})
it('preserves an externally replaced lock rather than deleting another identity', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hadron-lease-'))
  try {
    const lock = path.join(root, 'subscription-auth/mutation.lock')
    await withHadronAuthLease(root, async () => { writeFileSync(lock, 'replacement-owner') })
    expect(readFileSync(lock, 'utf8')).toBe('replacement-owner')
    await expect(withHadronAuthLease(root, async () => {})).rejects.toThrow('locked')
  } finally { cleanup(root) }
})

it('rejects a linked lock directory before creating a lock or calling provider work', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hadron-lease-'))
  try {
    const profile = path.join(root, 'profile'), outside = path.join(root, 'outside'), work = vi.fn()
    fs.mkdirSync(profile); fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(profile, 'subscription-auth'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(withHadronAuthLease(profile, work)).rejects.toThrow('Linked or invalid private storage')
    expect(work).not.toHaveBeenCalled(); expect(fs.readdirSync(outside)).toEqual([])
  } finally { cleanup(root) }
})

it('preserves a hard-linked replacement lock even if it has the same bytes', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hadron-lease-'))
  try {
    const lock = path.join(root, 'subscription-auth', 'mutation.lock'), alias = path.join(root, 'retained.lock')
    await expect(withHadronAuthLease(root, async () => { fs.linkSync(lock, alias) })).rejects.toThrow('Linked or invalid private storage')
    expect(readFileSync(lock)).toEqual(readFileSync(alias))
  } finally { cleanup(root) }
})

it('refuses oversized replacement lock content without treating it as owned', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hadron-lease-'))
  try {
    const lock = path.join(root, 'subscription-auth', 'mutation.lock')
    await withHadronAuthLease(root, async () => { writeFileSync(lock, Buffer.alloc(1024 * 1024, 65)) })
    expect(fs.statSync(lock).size).toBe(1024 * 1024)
    await expect(withHadronAuthLease(root, async () => {})).rejects.toThrow('locked')
  } finally { cleanup(root) }
})
