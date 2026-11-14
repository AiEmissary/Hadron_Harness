import { expect, it, vi } from 'vitest'
import { HadronChatgptProbe, HADRON_CHATGPT_PROBE_PROMPT } from '../auth/hadronChatgptProbe.js'

const model = 'gpt-6.1-sol'
const catalog = () => new Response(JSON.stringify({ models: [{ slug: model, display_name: 'Test model', visibility: 'list' }] }))
const completed = () => new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hadron connection OK' }] }] } })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
function fixture(send = vi.fn(async (url: any) => String(url).endsWith('/models') ? catalog() : completed())) {
  const account = new AbortController()
  const resolveAccount = vi.fn(async () => ({ accessToken: 'fixture-secret', signal: account.signal }))
  return { account, send, resolveAccount, probe: new HadronChatgptProbe({ resolveAccount, fetch: send as any }) }
}
it('sends exactly one bounded fixed-prompt request using the selected account catalog', async () => {
  const f = fixture()
  expect(await f.probe.run(model)).toEqual({ model, text: 'Hadron connection OK' })
  expect(f.resolveAccount).toHaveBeenCalledTimes(1)
  expect(f.send).toHaveBeenCalledTimes(2)
  const [url, request] = f.send.mock.calls[1] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.openai.com/v1/responses')
  expect(JSON.parse(request.body as string)).toEqual({ model, input: [{ role: 'user', content: HADRON_CHATGPT_PROBE_PROMPT }], max_output_tokens: 256, stream: true, store: false })
})
it('rejects unapproved or structured input without reading credentials', async () => {
  const f = fixture()
  for (const value of ['other-model', { model, prompt: 'arbitrary' }, null]) await expect(f.probe.run(value)).rejects.toThrow('Choose')
  expect(f.resolveAccount).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled()
})
it('does not infer when the account catalog does not offer the qualified model', async () => {
  const f = fixture(vi.fn(async () => new Response(JSON.stringify({ models: [] }))))
  await expect(f.probe.run(model)).rejects.toThrow('did not complete')
  expect(f.send).toHaveBeenCalledTimes(1)
})
it('prevents overlapping requests and fences account changes during discovery', async () => {
  let release!: (value: Response) => void
  const f = fixture(vi.fn(() => new Promise<Response>(resolve => { release = resolve })))
  const first = f.probe.run(model)
  await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(1))
  await expect(f.probe.run(model)).rejects.toThrow('already running')
  f.account.abort(); release(catalog())
  await expect(first).rejects.toThrow('did not complete')
  expect(f.send).toHaveBeenCalledTimes(1)
})
it('never retries an HTTP rejection or exposes its private body', async () => {
  const f = fixture(vi.fn(async (url: any) => String(url).endsWith('/models') ? catalog() : new Response('private diagnostic', { status: 429 })))
  await expect(f.probe.run(model)).rejects.toThrow(/^Hadron ChatGPT connection test did not complete; no automatic retry was made$/)
  expect(f.send).toHaveBeenCalledTimes(2)
})
