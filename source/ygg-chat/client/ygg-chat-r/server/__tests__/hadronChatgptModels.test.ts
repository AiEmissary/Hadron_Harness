import { expect, it, vi } from 'vitest'
import { listHadronChatgptModels } from '../auth/hadronChatgptModels.js'
function fixture(models: unknown) {
  const lifetime = new AbortController()
  const send = vi.fn(async () => new Response(JSON.stringify({ models })))
  const resolveAccount = vi.fn(async () => ({ accessToken: 'private-token', signal: lifetime.signal }))
  return { lifetime, send, resolveAccount, options: { approvedModels: new Set(['one', 'two']), signal: new AbortController().signal, resolveAccount, fetch: send as any } }
}
it('keeps account order and intersects visible models with the trusted allowlist', async () => {
  const f = fixture([{ visibility: 'list', slug: 'two', display_name: 'Second' }, { visibility: 'hidden', slug: 'one' },
    { visibility: 'list', slug: 'other', display_name: 'Other' }, { visibility: 'list', slug: 'one', display_name: 'First' }])
  expect(await listHadronChatgptModels(f.options)).toEqual([{ id: 'two', label: 'Second' }, { id: 'one', label: 'First' }])
  expect(f.send).toHaveBeenCalledTimes(1)
  const [url, request] = f.send.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.openai.com/v1/models'); expect(request.redirect).toBe('error')
})
it('does not contact auth or models with an empty production approval list', async () => {
  const f = fixture([]); f.options.approvedModels.clear()
  expect(await listHadronChatgptModels(f.options)).toEqual([])
  expect(f.send).not.toHaveBeenCalled(); expect(f.resolveAccount).not.toHaveBeenCalled()
})
it('rejects malformed and ambiguous displayed catalogs', async () => {
  for (const models of [null, [{ visibility: 'list', slug: 'one', display_name: '' }],
    [{ visibility: 'list', slug: 'one', display_name: 'One' }, { visibility: 'list', slug: 'one', display_name: 'Duplicate' }]]) {
    const f = fixture(models)
    await expect(listHadronChatgptModels(f.options)).rejects.toThrow('choices are unavailable')
  }
})
it('fences account disconnection and never retries rejected requests', async () => {
  const f = fixture([]); f.lifetime.abort()
  await expect(listHadronChatgptModels(f.options)).rejects.toThrow('choices are unavailable')
  expect(f.send).not.toHaveBeenCalled()
  const rejected = fixture([])
  rejected.send.mockResolvedValueOnce(new Response('private-token diagnostic', { status: 401 }))
  await expect(listHadronChatgptModels(rejected.options)).rejects.toThrow(/^Hadron ChatGPT model choices are unavailable; check the connection$/)
  expect(rejected.send).toHaveBeenCalledTimes(1)
})
