import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Windows only lets ordinary accounts create symbolic links when Developer Mode is on.
 * Symlink-specific checks run wherever links can be made and are skipped elsewhere,
 * instead of failing with EPERM on a normal Windows PC.
 */
export const canCreateSymlinks = (() => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hadron-symlink-probe-'))
  try {
    fs.writeFileSync(path.join(directory, 'target.txt'), '')
    fs.symlinkSync(path.join(directory, 'target.txt'), path.join(directory, 'link.txt'), 'file')
    return true
  } catch {
    return false
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})()
