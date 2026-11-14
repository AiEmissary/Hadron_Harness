import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../tools/bash.js', () => ({ runBashCommand: vi.fn() }))
import { runBashCommand } from '../tools/bash.js'

let temp: string | undefined
afterEach(async () => {
  vi.unstubAllEnvs(); vi.resetModules()
  if (temp) await fs.rm(temp, { recursive: true, force: true })
})

it('does not fall back to project hook commands when the Hadron profile has no settings', async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'hadron-hook-isolation-'))
  const project = path.join(temp, 'project')
  await fs.mkdir(path.join(project, '.ygg'), { recursive: true })
  await fs.writeFile(path.join(project, '.ygg', 'settings.json'), JSON.stringify({
    hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'must-never-run' }] }] },
  }))
  vi.stubEnv('HADRON_DESKTOP', '1')
  vi.stubEnv('YGG_HOOKS_DIRECTORY', path.join(temp, 'hadron-profile'))
  const { runHookRequest } = await import('../hooks/hookRunner.js')
  const result = await runHookRequest({ event: 'PreToolUse', conversationId: 'test', cwd: project,
    toolCall: { id: 't', name: 'read_file', arguments: {} } })
  expect(result.matched).toBe(false)
  expect(runBashCommand).not.toHaveBeenCalled()
})
