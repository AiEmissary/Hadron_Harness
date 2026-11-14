import { expect, it, vi } from 'vitest'
import { HadronChatgptConnection } from '../auth/hadronChatgptConnection.js'
import type { HadronChatgptAccount, HadronChatgptRegistration } from '../auth/hadronChatgptSignIn.js'
import { HadronChatgptSignInError } from '../auth/hadronChatgptDiagnostics.js'

function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const verified: HadronChatgptAccount = { issuer: 'https://auth.openai.com', clientId: 'oaiapp_fixture', hostId: 'host', subject: 'subject',
  accessToken: 'private-access', refreshToken: 'private-refresh', idToken: 'private-id', expiresAt: 2000000000000,
  scopes: ['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'] }
function fixture() {
  const completion = deferred<HadronChatgptAccount>(), preparation = deferred<any>()
  const flow = { authorizationUrl: 'https://auth.openai.com/fixture', completion: completion.promise, cancel: vi.fn() }
  const store = { hostId: vi.fn(() => 'host'), account: vi.fn((): HadronChatgptAccount | null => null), save: vi.fn(), disconnect: vi.fn(),
    registration: vi.fn((): HadronChatgptRegistration | null => null), rememberRegistration: vi.fn() }
  const browser = vi.fn(async () => {}), startLoopback = vi.fn(() => preparation.promise)
  const connection = new HadronChatgptConnection({ store, openBrowser: browser, startLoopback, now: () => 1900000000000 })
  return { connection, flow, store, browser, startLoopback, completion, preparation }
}
it('deduplicates Start and never publishes a verified result after cancellation', async () => {
  const f = fixture(), start = f.connection.startSignIn()
  await f.connection.startSignIn()
  await vi.waitFor(() => expect(f.startLoopback).toHaveBeenCalledTimes(1))
  expect(f.startLoopback).toHaveBeenCalledTimes(1)
  f.preparation.resolve(f.flow); await start
  expect(f.browser).toHaveBeenCalledOnce()
  f.connection.cancelSignIn(); f.completion.resolve(verified)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(f.store.save).not.toHaveBeenCalled(); expect(f.flow.cancel).toHaveBeenCalledOnce()
  expect(f.connection.status()).toMatchObject({ loginState: 'idle', connected: false })
})
it('closes a listener prepared after Cancel without opening the browser', async () => {
  const f = fixture(), start = f.connection.startSignIn()
  await vi.waitFor(() => expect(f.startLoopback).toHaveBeenCalledOnce())
  f.connection.cancelSignIn(); f.preparation.resolve(f.flow); await start
  expect(f.flow.cancel).toHaveBeenCalledOnce(); expect(f.browser).not.toHaveBeenCalled()
})
it('commits only verified credentials, keeps them private and advances account generation', async () => {
  const f = fixture(), start = f.connection.startSignIn()
  f.preparation.resolve(f.flow); await start
  const generation = f.connection.generation
  f.completion.resolve(verified)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(f.store.save).toHaveBeenCalledWith(verified)
  expect(f.connection.generation).toBeGreaterThan(generation)
  f.store.account.mockReturnValue(verified)
  expect(f.connection.status()).toEqual({ connected: true, reason: 'ready', loginState: 'idle' })
  expect(JSON.stringify(f.connection.status())).not.toContain('private')
})
it('preserves the previous account on persistence failure and exposes a generic failed state', async () => {
  const f = fixture(), start = f.connection.startSignIn()
  f.store.account.mockReturnValue(verified)
  f.store.save.mockImplementation(() => { throw new Error('private storage diagnostic') })
  f.preparation.resolve(f.flow); await start; f.completion.resolve(verified)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(f.connection.status()).toMatchObject({ connected: true, reason: 'ready', loginState: 'failed', loginError: { code: 'storage' } })
  expect(JSON.stringify(f.connection.status())).not.toContain('private storage diagnostic')
  expect(f.store.disconnect).not.toHaveBeenCalled()
})
it('disconnect fences pending login before clearing the saved account', async () => {
  const f = fixture(), start = f.connection.startSignIn()
  f.preparation.resolve(f.flow); await start
  await f.connection.disconnect(); f.completion.resolve(verified)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(f.flow.cancel).toHaveBeenCalledOnce(); expect(f.store.disconnect).toHaveBeenCalledOnce()
  expect(f.store.save).not.toHaveBeenCalled()
})
it('fences Cancel while verified publication is waiting for the profile lease', async () => {
  const completion = deferred<HadronChatgptAccount>(), leaseGate = deferred<void>()
  const flow = { authorizationUrl: 'https://auth.openai.com/fixture', completion: completion.promise, cancel: vi.fn() }
  const save = vi.fn(), lease = vi.fn(async <T>(work: () => Promise<T>): Promise<T> => {
    if (lease.mock.calls.length === 2) await leaseGate.promise
    return work()
  })
  const connection = new HadronChatgptConnection({
    store: { hostId: () => 'host', account: () => null, save, disconnect: () => {}, registration: () => null, rememberRegistration: () => {} },
    openBrowser: async () => {}, startLoopback: async () => flow, withLease: lease,
  })
  await connection.startSignIn(); completion.resolve(verified)
  await vi.waitFor(() => expect(lease).toHaveBeenCalledTimes(2))
  connection.cancelSignIn(); leaseGate.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(save).not.toHaveBeenCalled(); expect(connection.status().loginState).toBe('idle')
})
it('exposes private account resolution only to the host and aborts its lifetime on disconnect', async () => {
  const f = fixture(); f.store.account.mockReturnValue(verified)
  const account = await f.connection.resolveAccount(new AbortController().signal)
  expect(account.accessToken).toBe('private-access')
  expect(JSON.stringify(f.connection.status())).not.toContain('private-access')
  await f.connection.disconnect()
  expect(account.signal.aborted).toBe(true)
})

it('retains the issued registration after invalid_grant and uses it for a fresh user-initiated attempt', async () => {
  const f = fixture()
  f.store.rememberRegistration.mockImplementation(clientId => f.store.registration.mockReturnValue({ clientId }))
  const start = f.connection.startSignIn(); f.preparation.resolve(f.flow); await start
  f.completion.reject(new HadronChatgptSignInError('token_http', 400, { category: 'invalid_grant', format: 'json' }, 'oaiapp_issued'))
  await vi.waitFor(() => expect(f.connection.status().loginState).toBe('failed'))
  expect(f.store.rememberRegistration).toHaveBeenCalledWith('oaiapp_issued')
  expect(f.store.save).not.toHaveBeenCalled()
  expect(f.connection.status().connected).toBe(false)
  expect(JSON.stringify(f.connection.status())).not.toContain('oaiapp_issued')
  expect(f.startLoopback).toHaveBeenCalledTimes(1) // No automatic auth replay.
  const next = deferred<HadronChatgptAccount>()
  f.startLoopback.mockResolvedValueOnce({ ...f.flow, completion: next.promise })
  await f.connection.startSignIn()
  expect(f.startLoopback.mock.calls[1][0]).toMatchObject({ registration: { clientId: 'oaiapp_issued' } })
  expect(f.store.save).not.toHaveBeenCalled()
  next.resolve(verified)
  await vi.waitFor(() => expect(f.store.save).toHaveBeenCalledWith(verified))
})

it('does not retain a recovery registration after cancellation while the lease is pending', async () => {
  const f = fixture(), gate = deferred<void>()
  const lease = vi.fn(async <T>(work: () => Promise<T>): Promise<T> => {
    if (lease.mock.calls.length === 2) await gate.promise
    return work()
  })
  const connection = new HadronChatgptConnection({ store: f.store, openBrowser: f.browser,
    startLoopback: async () => f.flow, withLease: lease })
  await connection.startSignIn()
  f.completion.reject(new HadronChatgptSignInError('token_http', 400, { category: 'invalid_grant', format: 'json' }, 'oaiapp_issued'))
  await vi.waitFor(() => expect(lease).toHaveBeenCalledTimes(2))
  connection.cancelSignIn(); gate.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(f.store.rememberRegistration).not.toHaveBeenCalled()
  expect(connection.status().loginState).toBe('idle')
})
