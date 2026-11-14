import os from 'node:os'
import path from 'node:path'
/** Hadron's desktop bootstrap sets this before importing the server graph. */
export const isHadronDesktop = () => process.env.HADRON_DESKTOP === '1'
export const hadronName = 'The Hadron Harness'
export const hadronAppId = 'com.hadron.harness'
export const hadronProtocol = 'hadron-harness'

/** Call before importing runtime singletons, with an explicitly owned profile. */
export function configureHadronEnvironment(dataDir: string): void {
  process.env.HADRON_DESKTOP = '1'
  process.env.HADRON_CONFIG_DIR = path.join(dataDir, 'settings')
  process.env.YGG_APP_USER_DATA = dataDir
  process.env.YGG_LOCAL_SERVER_ALLOW_REMOTE = 'false'
  process.env.YGG_LOCAL_SERVER_HOST = '127.0.0.1'
  process.env.YGG_CUSTOM_TOOLS_DIRECTORY = path.join(dataDir, 'tool-storage')
  process.env.HADRON_TOOLS_LIBRARY = path.join(dataDir, 'hadron-tools')
  process.env.YGG_HOOKS_DIRECTORY = path.join(dataDir, '.ygg')
  process.env.YGG_THEME_DIRECTORY = path.join(dataDir, '.ygg', 'custom-themes')
  delete process.env.YGG_AUTO_MEMORY_DIRECTORY
}

/** Explicit cwd prevents Conf from reading Graviton's OS-specific legacy store. */
export function runtimeConfOptions(): { projectName: string; cwd?: string } {
  if (!isHadronDesktop()) return { projectName: 'ygg-chat-r' }
  const cwd = process.env.HADRON_CONFIG_DIR
  if (!cwd) throw new Error('Hadron config directory was not initialized')
  return { projectName: 'hadron-harness', cwd }
}

export function assertCloudAccess(): void {
  if (isHadronDesktop()) throw new Error('Upstream cloud access is disabled in Hadron development')
}

/** User-scope instructions/skills/agents belong to the Hadron profile. */
export function runtimeContextHome(): string {
  if (!isHadronDesktop()) return os.homedir()
  if (!process.env.YGG_APP_USER_DATA) throw new Error('Hadron profile was not initialized')
  return path.join(process.env.YGG_APP_USER_DATA, 'context-home')
}

/** Never compete with Graviton's wildcard listener: Windows may accept both wildcard and specific-address binds on the same port. */
export function hadronServerBinding() {
  return { bindHost: '127.0.0.1', preferredPort: 0, fallbackPorts: [] as number[], allowEphemeralPort: true, allowNonLoopbackBind: false }
}
export function isOwnedHadronHealth(payload: unknown, pid: number): boolean {
  const value = payload as Record<string, unknown> | null
  return !!value && value.status === 'ok' && value.mode === 'local-sync' && value.appId === hadronAppId && value.pid === pid
}
