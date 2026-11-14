import { expect, it, vi } from 'vitest'
import { HadronChatgptResolver } from '../auth/hadronChatgptResolver.js'
import type { HadronChatgptAccount } from '../auth/hadronChatgptSignIn.js'
function fixture(expiry = 1000000) {
  let account: HadronChatgptAccount | null = { issuer: 'https://auth.openai.com', clientId: 'oaiapp_fixture', hostId: 'host', subject: 'subject',
    accessToken: 'old', refreshToken: 'refresh', idToken: 'id', expiresAt: expiry,
    scopes: ['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'] }
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const send = vi.fn(async () => { await gate; return new Response(JSON.stringify({ access_token: 'new', refresh_token: 'rotated', token_type: 'Bearer', expires_in: 3600 })) })
  const lease = vi.fn(async <T>(work: () => Promise<T>) => work())
  const resolver = new HadronChatgptResolver({ read: () => account, save: next => { account = next }, withLease: lease, fetch: send as any, now: () => 100000 })
  return { resolver, send, lease, release, replace: (next: HadronChatgptAccount | null) => { account = next } }
}
it('returns a current token without refresh and invalidates its lifetime on an account action', async () => {
  const f = fixture(), result = await f.resolver.resolve(new AbortController().signal)
  expect(result.accessToken).toBe('old'); expect(f.send).not.toHaveBeenCalled()
  f.resolver.invalidate(); expect(result.signal.aborted).toBe(true)
})
it('shares one leased rotation while cancellation of one job does not cancel another', async () => {
  const f = fixture(1), job = new AbortController()
  const first = f.resolver.resolve(job.signal).catch(error => error)
  await vi.waitFor(() => expect(f.send).toHaveBeenCalledOnce())
  const second = f.resolver.resolve(new AbortController().signal)
  job.abort(); f.release()
  expect(await first).toBeInstanceOf(Error)
  expect((await second).accessToken).toBe('new')
  expect(f.send).toHaveBeenCalledTimes(1); expect(f.lease).toHaveBeenCalledTimes(1)
})
it('does not return a late refreshed token after account invalidation', async () => {
  const f = fixture(1), pending = f.resolver.resolve(new AbortController().signal).catch(error => error)
  await vi.waitFor(() => expect(f.send).toHaveBeenCalledOnce())
  f.resolver.invalidate(); f.release()
  expect(await pending).toBeInstanceOf(Error)
})
it('does not publish a token when the account is removed during rotation', async () => {
  const f = fixture(1), pending = f.resolver.resolve(new AbortController().signal).catch(error => error)
  await vi.waitFor(() => expect(f.send).toHaveBeenCalledOnce())
  f.replace(null); f.release()
  expect(await pending).toBeInstanceOf(Error)
})
