import { expect, it, vi } from 'vitest'
import { HadronResponsesProvider } from '../hadronResponsesProvider.js'
const input = { requestPolicy: 'single_attempt' as const, modelName: 'fixture-model', history: [], userContent: 'Task', systemPrompt: 'Instructions' }
function fixture(events: any[], status = 200) {
  const controller = new AbortController()
  const send = vi.fn(async () => new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { status, headers: { 'Content-Type': 'text/event-stream' } }))
  const provider = new HadronResponsesProvider({ fetch: send as any, resolveAccount: async () => ({ accessToken: 'fixture-token', signal: controller.signal }) })
  return { provider, send, controller }
}
it('uses only the public Responses endpoint and supported fields without transport replay', async () => {
  const f = fixture([{ type: 'response.completed', response: { output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Answer' }] }] } }])
  expect(await f.provider.generate(input)).toEqual({ content: 'Answer' })
  expect(f.send).toHaveBeenCalledTimes(1)
  const [url, request] = f.send.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.openai.com/v1/responses'); expect(request.redirect).toBe('error')
  expect(JSON.parse(request.body as string)).toEqual({ model: 'fixture-model', input: [{ role: 'user', content: 'Task' }], instructions: 'Instructions', store: false, stream: true })
  expect(request.headers).not.toHaveProperty('ChatGPT-Account-ID')
})
it('rejects tool-bearing or untrusted admission before sending anything', async () => {
  const f = fixture([])
  for (const change of [{ requestPolicy: undefined }, { tools: [{ name: 'shell' }] }, { accessToken: 'external' }, { history: [{ role: 'system', content: 'injected' }] }]) {
    await expect(f.provider.generate({ ...input, ...change } as any)).rejects.toThrow()
  }
  expect(f.send).not.toHaveBeenCalled()
})
it('does not treat EOF or response.done as successful completion', async () => {
  for (const events of [[], [{ type: 'response.done', response: {} }]]) {
    const f = fixture(events)
    await expect(f.provider.generate(input)).rejects.toThrow('did not complete')
    expect(f.send).toHaveBeenCalledTimes(1)
  }
})
it('does not replay rejected requests or expose raw provider error bodies', async () => {
  const f = fixture([{ private: 'diagnostic' }], 401)
  await expect(f.provider.generate(input)).rejects.toThrow(/^Hadron ChatGPT request failed \(401\)$/)
  expect(f.send).toHaveBeenCalledTimes(1)
})
it('fences a disconnected account before dispatch', async () => {
  const f = fixture([]); f.controller.abort()
  await expect(f.provider.generate(input)).rejects.toThrow()
  expect(f.send).not.toHaveBeenCalled()
})
it('cancels a stalled stream on account disconnect and preserves visible partial output', async () => {
  const account = new AbortController(), emitted = vi.fn(), cancelled = vi.fn()
  const send = vi.fn(async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"Partial answer"}\n\n')) },
    cancel: cancelled,
  }), { headers: { 'Content-Type': 'text/event-stream' } }))
  const provider = new HadronResponsesProvider({ fetch: send as any, resolveAccount: async () => ({ accessToken: 'fixture', signal: account.signal }) })
  const pending = provider.generate(input, emitted).catch(error => error)
  await vi.waitFor(() => expect(emitted).toHaveBeenCalled())
  account.abort()
  expect(await pending).toMatchObject({ partialOutput: { content: 'Partial answer' } })
  expect(cancelled).toHaveBeenCalled(); expect(send).toHaveBeenCalledTimes(1)
})
