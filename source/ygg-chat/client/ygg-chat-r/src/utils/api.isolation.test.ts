import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_ENVIRONMENT', 'electron')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
function install(status: () => Promise<unknown>) {
  vi.stubGlobal('window', { setTimeout, electronAPI: { sync: { status } } })
}

describe('Hadron renderer server isolation', () => {
  it.skipIf(!__IS_ELECTRON__)('uses verified desktop routing even when legacy environment says local', async () => {
    vi.stubEnv('VITE_ENVIRONMENT', 'local')
    install(async () => ({ localServerRunning: true, localServerUrl: 'http://127.0.0.1:3012' }))
    const api = await import('./api')
    expect(api.environment).toBe('electron')
    expect(await api.getLocalServerOrigin()).toBe('http://127.0.0.1:3012')
  })
  it.each([
    { localServerRunning: false, localServerUrl: null },
    { localServerRunning: true, localServerUrl: 'http://127.0.0.1:3002', localServerForeign: true },
  ])('rejects unavailable or foreign server status', async status => {
    install(async () => status)
    const api = await import('./api')
    await expect(api.getLocalServerOrigin()).rejects.toThrow()
    expect(() => api.getCachedLocalServerOrigin()).toThrow()
  })

  it('never falls back to port 3002 after an IPC failure or uses a stale cached endpoint', async () => {
    const status = vi.fn().mockResolvedValue({ localServerRunning: true, localServerUrl: 'http://127.0.0.1:3011' })
    install(status)
    const api = await import('./api')
    expect(await api.getLocalServerOrigin()).toBe('http://127.0.0.1:3011')
    status.mockRejectedValue(new Error('IPC disconnected'))
    await api.refreshLocalServerStatus()
    expect(() => api.getCachedLocalServerOrigin()).toThrow()
    await expect(api.getLocalServerOrigin()).rejects.toThrow()
  })

  it('requires IPC discovery and rejects configured origin overrides on desktop', async () => {
    vi.stubEnv('VITE_YGG_SERVER_ORIGIN', 'http://127.0.0.1:3002')
    vi.stubGlobal('window', { setTimeout })
    const api = await import('./api')
    await expect(api.getLocalServerOrigin()).rejects.toThrow()
    expect(() => api.buildCachedLocalApiUrl('/conversations')).toThrow()
  })

  it('builds requests only against the main process verified origin', async () => {
    install(async () => ({ localServerRunning: true, localServerUrl: 'http://127.0.0.1:3010', localServerPort: 3010 }))
    const api = await import('./api')
    expect(await api.buildLocalApiUrl('/conversations')).toBe('http://127.0.0.1:3010/api/conversations')
    expect(api.isLocalServerOriginVerified()).toBe(true)
    expect(api.buildCachedLocalApiUrl('/messages')).toBe('http://127.0.0.1:3010/api/messages')
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 15_001)
    expect(() => api.getCachedLocalServerOrigin()).toThrow()
  })

  it('rejects IPC timeouts without sending requests to a guessed port', async () => {
    vi.useFakeTimers()
    install(() => new Promise(() => {}))
    try {
      const api = await import('./api')
      const outcome = api.getLocalServerOrigin().catch(error => error)
      await vi.advanceTimersByTimeAsync(3001)
      expect(await outcome).toBeInstanceOf(Error)
      expect(() => api.getCachedLocalServerOrigin()).toThrow()
    } finally { vi.useRealTimers() }
  })
})
