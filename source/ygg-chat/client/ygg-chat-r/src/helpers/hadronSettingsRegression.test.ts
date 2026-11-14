import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LMSTUDIO_BASE_URL, loadProviderSettings } from './providerSettingsStorage'
import { loadChatReasoningSettings } from './chatReasoningSettingsStorage'
import { buildRemoteMobileUrl, normalizeRemoteBaseUrl } from './remoteServerSettingsStorage'
import { loadSubagentToolSettings } from './subagentToolSettings'
import { validateGoogleFontUrl, saveUploadedLocalFont } from './fontSettingsStorage'

vi.mock('./fontSettingsDb', () => ({ storeActiveLocalFontBlob: vi.fn(), getActiveLocalFontBlob: vi.fn(), clearActiveLocalFontBlob: vi.fn() }))
import { storeActiveLocalFontBlob } from './fontSettingsDb'

describe('Hadron settings regressions', () => {
  let saved: Map<string, string>
  beforeEach(() => {
    saved = new Map()
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null })
    vi.clearAllMocks()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps a hidden Main chat provider selector hidden after loading', () => {
    saved.set('ygg_provider_settings', JSON.stringify({ showProviderSelector: false }))
    expect(loadProviderSettings().showProviderSelector).toBe(false)
    expect(DEFAULT_LMSTUDIO_BASE_URL).toBe('http://127.0.0.1:1234')
  })
  it('preserves reasoning defaults for older partial settings and explicit off', () => {
    saved.set('ygg_chat_reasoning_settings', JSON.stringify({ defaultReasoningEffort: 'low' }))
    expect(loadChatReasoningSettings()).toEqual({ defaultThinkingEnabled: true, defaultReasoningEffort: 'low' })
    saved.set('ygg_chat_reasoning_settings', JSON.stringify({ defaultThinkingEnabled: false }))
    expect(loadChatReasoningSettings().defaultThinkingEnabled).toBe(false)
  })
  it.each(['javascript:alert(1)', 'file:///tmp/server', 'https://user:pass@example.com', 'https://example.com?token=private', 'https://example.com#fragment', 'not a URL'])('rejects an unusable remote address: %s', value => {
    expect(normalizeRemoteBaseUrl(value)).toBeNull()
  })
  it('normalizes mobile paths without duplicating their suffix', () => {
    expect(buildRemoteMobileUrl(' http://127.0.0.1:45000/ ')).toBe('http://127.0.0.1:45000/mobile')
    expect(buildRemoteMobileUrl('https://example.com/app/mobile/')).toBe('https://example.com/app/mobile')
  })
  it('repairs malformed subagent types and never rounds a positive turn count to zero', () => {
    saved.set('ygg_subagent_tool_settings', JSON.stringify({ maxTurns: 0.5, enabledTools: 'bash', orchestratorEnabled: 'false' }))
    const settings = loadSubagentToolSettings()
    expect(settings.maxTurns).toBe(1)
    expect(Array.isArray(settings.enabledTools)).toBe(true)
    expect(settings.orchestratorEnabled).toBe(true)
  })
  it('keeps deliberate empty tool lists and explicit orchestrator off', () => {
    saved.set('ygg_subagent_tool_settings', JSON.stringify({ enabledTools: [], orchestratorEnabled: false }))
    expect(loadSubagentToolSettings()).toMatchObject({ enabledTools: [], orchestratorEnabled: false })
  })
  it('rejects malformed Google family encoding without throwing', () => {
    expect(validateGoogleFontUrl('https://fonts.googleapis.com/css2?family=%')).toMatchObject({ valid: false })
    expect(validateGoogleFontUrl('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400')).toMatchObject({ valid: true, family: 'Open Sans' })
  })
  it('does not replace a working local font with invalid font data', async () => {
    vi.stubGlobal('FontFace', class { load() { return Promise.reject(new Error('invalid font')) } })
    const file = { name: 'broken.woff2', size: 4, arrayBuffer: async () => new ArrayBuffer(4) } as File
    await expect(saveUploadedLocalFont(file)).rejects.toThrow('invalid font')
    expect(storeActiveLocalFontBlob).not.toHaveBeenCalled()
  })
  it('stores a valid local font only after the browser accepts it', async () => {
    vi.stubGlobal('FontFace', class { async load() { return this } })
    const file = { name: 'valid.ttf', size: 4, arrayBuffer: async () => new ArrayBuffer(4) } as File
    await saveUploadedLocalFont(file)
    expect(storeActiveLocalFontBlob).toHaveBeenCalledWith(file)
  })
})
