import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertCloudAccess, runtimeConfOptions, runtimeContextHome, hadronServerBinding, isOwnedHadronHealth } from '../runtimeIdentity.js'

const app = vi.hoisted(() => ({ isPackaged: false, getPath: vi.fn(() => 'C:/synthetic-appdata'),
  setName: vi.fn(), setPath: vi.fn(), setAppUserModelId: vi.fn() }))
vi.mock('electron', () => ({ app }))
vi.mock('node:fs', async importOriginal => ({ ...await importOriginal<typeof import('node:fs')>(), mkdirSync: vi.fn(), lstatSync: vi.fn(() => ({isSymbolicLink:()=>false})) }))
const keys = ['HADRON_TOOLS_LIBRARY', 'HADRON_DESKTOP', 'HADRON_CONFIG_DIR', 'YGG_APP_USER_DATA', 'YGG_LOCAL_SERVER_ALLOW_REMOTE', 'YGG_LOCAL_SERVER_HOST',
  'YGG_CUSTOM_TOOLS_DIRECTORY', 'YGG_HOOKS_DIRECTORY', 'YGG_THEME_DIRECTORY', 'YGG_AUTO_MEMORY_DIRECTORY']
const originalResourcesPath = process.resourcesPath
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key]
    else process.env[key] = original[key]
  }
  if (originalResourcesPath === undefined) delete (process as any).resourcesPath
  else process.resourcesPath = originalResourcesPath
  vi.restoreAllMocks(); vi.resetModules()
})

describe('Hadron desktop isolation', () => {
  it.each([false, true])('bootstraps separate paths before server imports (packaged: %s)', async packaged => {
    app.isPackaged = packaged
    process.resourcesPath = 'C:/synthetic-resources'
    await import('../../electron/hadronBootstrap.js')
    const data = path.join('C:/synthetic-appdata', packaged ? 'Hadron-Harness' : 'Hadron-Harness-Development')
    expect(app.setPath).toHaveBeenCalledWith('userData', data)
    expect(app.setPath).toHaveBeenCalledWith('sessionData', path.join(data, 'chromium'))
    expect(app.setAppUserModelId).toHaveBeenCalledWith('com.hadron.harness')
    expect(runtimeConfOptions()).toEqual({ projectName: 'hadron-harness', cwd: path.join(data, 'settings') })
    expect(runtimeContextHome()).toBe(path.join(data, 'context-home'))
    expect(process.env.YGG_LOCAL_SERVER_HOST).toBe('127.0.0.1')
    expect(process.env.YGG_CUSTOM_TOOLS_DIRECTORY).toBe(path.join(data, 'tool-storage'))
    expect(process.env.YGG_HOOKS_DIRECTORY).toBe(path.join(data, '.ygg'))
    expect(() => assertCloudAccess()).toThrow('disabled')
    const main = readFileSync(new URL('../../electron/main.ts', import.meta.url), 'utf8')
    expect(main.startsWith("import './hadronBootstrap.js'")).toBe(true)
    expect(main).toContain('if (isHadronDesktop()) return // No Graviton update channel')
  })

  it('refuses an uninitialized Hadron settings store instead of opening legacy config', () => {
    process.env.HADRON_DESKTOP = '1'
    delete process.env.HADRON_CONFIG_DIR
    expect(() => runtimeConfOptions()).toThrow('not initialized')
    delete process.env.HADRON_DESKTOP
    expect(runtimeConfOptions()).toEqual({ projectName: 'ygg-chat-r' })
  })

  it('uses its own vault and never probes or deletes legacy Graviton keychain entries', async () => {
    process.env.HADRON_DESKTOP = '1'
    const { CredentialVault, CREDENTIAL_SERVICE, CREDENTIAL_VAULT_ACCOUNT } = await import('../credentialVault.js')
    const entries = new Map<string, string>()
    const backend = { getPassword: vi.fn(async (service: string, account: string) => entries.get(`${service}/${account}`) ?? null),
      setPassword: vi.fn(async (service: string, account: string, value: string) => { entries.set(`${service}/${account}`, value) }),
      deletePassword: vi.fn(async () => true), findCredentials: vi.fn(async () => []) }
    const vault = new CredentialVault(async () => backend, async work => work())
    await vault.set('api-key:brave-search', 'synthetic')
    await vault.consolidate()
    expect(CREDENTIAL_SERVICE).toBe('hadron-harness')
    expect(CREDENTIAL_VAULT_ACCOUNT).toBe('hadron-credential-vault')
    expect(backend.getPassword.mock.calls.every(([service]) => service === 'hadron-harness')).toBe(true)
    expect(backend.findCredentials).not.toHaveBeenCalled()
    expect(backend.deletePassword).not.toHaveBeenCalled()
  })

  it('packages a separate application with no upstream publishing configuration', () => {
    const config = JSON.parse(readFileSync(new URL('../../electron-builder.json', import.meta.url), 'utf8'))
    expect(config.appId).toBe('com.hadron.harness')
    expect(config.productName).toBe('The Hadron Harness')
    expect(config.publish).toBeNull()
    expect(config.extraResources.map((entry: any) => entry.from)).not.toContain('.ygg/settings.local.json')
    expect(config.extraResources.map((entry: any) => entry.from)).not.toContain('.ygg/hooks')
  })

  it('blocks cloud reads and writes before auth refresh or network access', async () => {
    process.env.HADRON_DESKTOP = '1'
    const { createRailwayClient } = await import('../headlessServer/services/railwayClient.js')
    const auth = { getFreshAppToken: vi.fn() }
    const fetch = vi.spyOn(globalThis, 'fetch')
    const client = createRailwayClient({ auth: auth as any })
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      await expect(client.request({ method, path: '/conversations' })).rejects.toThrow('disabled')
    }
    expect(auth.getFreshAppToken).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('blocks direct upstream app credential refresh before network access', async () => {
    process.env.HADRON_DESKTOP = '1'
    const { refreshCredential } = await import('../auth/refreshAdapters.js')
    const fetch = vi.spyOn(globalThis, 'fetch')
    await expect(refreshCredential('app', { refreshToken: 'synthetic' } as any, new AbortController().signal))
      .rejects.toThrow('disabled')
    expect(fetch).not.toHaveBeenCalled()
  })
})

it('never binds Hadron to the legacy Graviton port, even when wildcard and loopback listeners could coexist', () => {
  expect(hadronServerBinding()).toEqual({ bindHost: '127.0.0.1', preferredPort: 0, fallbackPorts: [], allowEphemeralPort: true, allowNonLoopbackBind: false })
  const own = { status: 'ok', mode: 'local-sync', pid: 123, appId: 'com.hadron.harness' }
  expect(isOwnedHadronHealth(own, 123)).toBe(true)
  expect(isOwnedHadronHealth({ ...own, pid: 456 }, 123)).toBe(false)
  expect(isOwnedHadronHealth({ status: 'ok', mode: 'local-sync', pid: 123 }, 123)).toBe(false)
  expect(isOwnedHadronHealth({ ...own, appId: 'graviton' }, 123)).toBe(false)
})
