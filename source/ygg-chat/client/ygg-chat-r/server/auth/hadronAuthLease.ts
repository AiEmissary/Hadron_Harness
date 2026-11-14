import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { PrivateProfilePaths } from '../hadronTools/privateProfilePaths.js'
import { executionStartup } from '../hadronTools/executionStartup.js'

/** Exclusive profile mutation lease. Never auto-steal a crashed owner's lock:
 * rotating tokens may already have been consumed. Recovery requires reconnect.
 * All sign-in publication, disconnect and refresh writers must use this lease.
 */
export async function withHadronAuthLease<T>(profile: string, work: () => Promise<T>): Promise<T> {
  if (!path.isAbsolute(profile)) throw new Error('Absolute Hadron profile required')
  if (executionStartup.isConfigured()) executionStartup.assertPrivatePath(profile)
  const paths = new PrivateProfilePaths(profile)
  const check = (target: string) => {
    if (executionStartup.isConfigured()) executionStartup.assertPrivatePath(target)
    paths.absolute(target)
  }
  const directory = path.join(profile, 'subscription-auth')
  const filename = path.join(directory, 'mutation.lock'), identity = JSON.stringify({ pid: process.pid, id: randomUUID() })
  check(filename)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  check(filename)
  let descriptor: number
  try { descriptor = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600) }
  catch { throw new Error('Hadron account storage is locked; another operation may be running or interrupted') }
  const owned = fs.fstatSync(descriptor, { bigint: true })
  try {
    fs.writeFileSync(descriptor, identity); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = -1
    check(filename)
    const named = fs.lstatSync(filename, { bigint: true })
    if (named.dev !== owned.dev || named.ino !== owned.ino) throw Error('Hadron account lock identity changed')
    return await work()
  } finally {
    if (descriptor !== -1) fs.closeSync(descriptor)
    // Do not delete another owner's replacement if the directory was changed externally.
    check(filename)
    if (fs.existsSync(filename)) {
      const named = fs.lstatSync(filename, { bigint: true })
      if (named.dev === owned.dev && named.ino === owned.ino && named.size === BigInt(Buffer.byteLength(identity))) {
        const reader = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0))
        try {
          const opened = fs.fstatSync(reader, { bigint: true }), bytes = Buffer.alloc(Buffer.byteLength(identity) + 1)
          if (opened.dev === owned.dev && opened.ino === owned.ino && opened.nlink === 1n &&
            fs.readSync(reader, bytes, 0, bytes.length, 0) === Buffer.byteLength(identity) && bytes.subarray(0, -1).toString('utf8') === identity) {
            check(filename)
            const current = fs.lstatSync(filename, { bigint: true })
            if (current.dev === owned.dev && current.ino === owned.ino) fs.unlinkSync(filename)
          }
        } finally { fs.closeSync(reader) }
      }
    }
  }
}
