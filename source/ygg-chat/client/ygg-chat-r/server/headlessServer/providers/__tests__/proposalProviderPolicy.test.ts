import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../auth/runtime.js', () => ({ getAuthManager: () => ({
  snapshot: () => ({ sessionId: 'test' }),
  resolve: async () => ({ sessionId: 'test', revision: 0, accessToken: 'fake', userId: 'fake' }),
}) }))
import { OpenAiChatgptProvider } from '../openaiChatgptProvider.js'
import { CodexResponsesProvider } from '../codex/codexResponsesProvider.js'

const input = { modelName: 'gpt-5.5', history: [], userContent: 'proposal', requestPolicy: 'single_attempt' as const }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('trusted proposal provider policy', () => {
  it('preserves ordinary provider auth retry behavior when the policy is absent', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('expired', { status: 401 }))
      .mockResolvedValueOnce(new Response('data: {"type":"response.completed","response":{"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"recovered"}]}]}}\n\ndata: [DONE]\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      }))
    const result = await new OpenAiChatgptProvider().generate({ ...input, requestPolicy: undefined })
    expect(result.content).toBe('recovered')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('aborts a pending HTTP open without retrying', async () => {
    const controller = new AbortController()
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true })
    }))
    const outcome = new OpenAiChatgptProvider().generate({ ...input, signal: controller.signal }).catch(error => error)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    controller.abort()
    expect((await outcome).name).toBe('AbortError')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([401, 429, 503, 'network'])('makes one HTTP attempt on %s', async status => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (status === 'network') throw new Error('fetch failed')
      return new Response('injected failure', { status: status as number })
    })
    await expect(new OpenAiChatgptProvider().generate(input)).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not dispatch after cancellation during auth resolution', async () => {
    const controller = new AbortController()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const auth = { snapshot: () => ({ sessionId: 'test' }), resolve: vi.fn(async () => {
      await gate
      return { sessionId: 'test', revision: 0, accessToken: 'fake', userId: 'fake' }
    }) }
    const fetch = vi.spyOn(globalThis, 'fetch')
    const pending = new OpenAiChatgptProvider({ auth: auth as any }).generate({ ...input, signal: controller.signal })
    const outcome = pending.catch(error => error)
    controller.abort(); release()
    expect((await outcome).name).toBe('AbortError')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cancels a stalled stream after first byte and preserves partial output', async () => {
    const controller = new AbortController()
    const cancel = vi.fn()
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({ start(c) {
      c.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"partial"}\n\n'))
    }, cancel })
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, {
      headers: { 'content-type': 'text/event-stream' },
    }))
    const emit = vi.fn()
    const outcome = new OpenAiChatgptProvider().generate({ ...input, signal: controller.signal }, emit).catch(error => error)
    await vi.waitFor(() => expect(emit).toHaveBeenCalled())
    controller.abort()
    const error = await outcome
    expect(error.name).toBe('AbortError')
    expect(error.partialOutput.content).toContain('partial')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('blocks websocket-to-HTTP fallback under the single-attempt policy', async () => {
    const provider = new CodexResponsesProvider({ auth: { accessToken: 'fake', accountId: 'fake' }, transport: 'auto' })
    const websocket = vi.spyOn(provider as any, 'generateWebSocket').mockRejectedValue(new Error('connection lost'))
    const http = vi.spyOn(provider as any, 'generateHttp').mockResolvedValue({})
    await expect(provider.generate({ model: input.modelName, providerInput: input, messages: [], tools: [] })).rejects.toThrow('connection lost')
    expect(websocket).toHaveBeenCalledTimes(1)
    expect(http).not.toHaveBeenCalled()
  })
})
