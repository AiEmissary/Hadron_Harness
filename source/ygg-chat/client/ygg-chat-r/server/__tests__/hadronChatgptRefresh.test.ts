import { expect, it, vi } from 'vitest'
import { HadronChatgptRefresh } from '../auth/hadronChatgptRefresh.js'
import type { HadronChatgptAccount } from '../auth/hadronChatgptSignIn.js'
function fixture() {
  let account: HadronChatgptAccount | null = { issuer: 'https://auth.openai.com', clientId: 'oaiapp_fixture', subject: 'subject',
    hostId: 'host', accessToken: 'old-access', refreshToken: 'old-refresh', idToken: 'retained-id', expiresAt: 1,
    scopes: ['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'] }
  const save = vi.fn((next: HadronChatgptAccount) => { account = { ...next } })
  const send = vi.fn(async () => {
    expect(account?.refreshPending).toBe(true)
    return new Response(JSON.stringify({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 3600 }))
  })
  const make = () => new HadronChatgptRefresh({ read: () => account, save, fetch: send as any, now: () => 100000 })
  return { refresh: make(), make, send, save, read: () => account, replace: (next: HadronChatgptAccount | null) => { account = next } }
}
it('marks before transmission, coalesces overlapping refreshes and commits the whole rotation', async () => {
  const f = fixture(), signal = new AbortController().signal
  const a = f.refresh.refresh(signal), b = f.refresh.refresh(signal)
  expect(a).toBe(b)
  expect(await a).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh', refreshPending: false, expiresAt: 3700000, idToken: 'retained-id' })
  expect(f.send).toHaveBeenCalledTimes(1)
  const [url, request] = f.send.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://auth.openai.com/api/accounts/oauth/token')
  const form = request.body as URLSearchParams
  expect(form.get('client_id')).toBe('oaiapp_fixture'); expect(form.has('scope')).toBe(false)
  expect(form.get('resource')).toBe('https://api.openai.com/v1'); expect(request.redirect).toBe('error')
})
it('does not replay a rotating token after an ambiguous network failure, including a new process owner', async () => {
  const f = fixture(); f.send.mockRejectedValueOnce(new Error('private diagnostic'))
  await expect(f.refresh.refresh(new AbortController().signal)).rejects.toThrow('renewal was not confirmed')
  expect(f.read()?.refreshPending).toBe(true)
  await expect(f.make().refresh(new AbortController().signal)).rejects.toThrow('Reconnect')
  expect(f.send).toHaveBeenCalledTimes(1)
})
it('does not dispatch if the pending marker cannot be persisted', async () => {
  const f = fixture(); f.save.mockImplementationOnce(() => { throw new Error('storage unavailable') })
  await expect(f.refresh.refresh(new AbortController().signal)).rejects.toThrow('storage unavailable')
  expect(f.send).not.toHaveBeenCalled()
})
it('does not publish late credentials after disconnect', async () => {
  const f = fixture()
  f.send.mockImplementationOnce(async () => { f.replace(null); return new Response(JSON.stringify({ access_token: 'late', token_type: 'Bearer', expires_in: 3600 })) })
  await expect(f.refresh.refresh(new AbortController().signal)).rejects.toThrow('not confirmed')
  expect(f.read()).toBeNull(); expect(f.save).toHaveBeenCalledTimes(1)
})
it('retains a pending marker if final persistence fails', async () => {
  const f = fixture(), save = f.save.getMockImplementation()!
  f.save.mockImplementation(next => { if (!next.refreshPending) throw new Error('disk failure'); save(next) })
  await expect(f.refresh.refresh(new AbortController().signal)).rejects.toThrow('not confirmed')
  expect(f.read()).toMatchObject({ refreshPending: true, accessToken: 'old-access' })
})
it('rejects loss of plan permission without installing the response', async () => {
  const f = fixture()
  f.send.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'new', token_type: 'Bearer', expires_in: 3600, scope: 'openid' })))
  await expect(f.refresh.refresh(new AbortController().signal)).rejects.toThrow('not confirmed')
  expect(f.read()?.accessToken).toBe('old-access')
})
