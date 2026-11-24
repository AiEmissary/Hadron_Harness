import { beforeAll, expect, it, vi } from 'vitest'
import { generateKeyPair, SignJWT } from 'jose'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { HadronChatgptSignIn } from '../auth/hadronChatgptSignIn.js'
import { chatgptDiagnostic } from '../auth/hadronChatgptDiagnostics.js'

let keys: Awaited<ReturnType<typeof generateKeyPair>>
beforeAll(async () => { keys = await generateKeyPair('RS256') })
const now = 1800000000000
const hostId = 'urn:uuid:11111111-2222-4333-8444-555555555555'
const redirectUri = 'http://127.0.0.1:55431/auth/callback'
function fixture(options: { registration?: any; claims?: Record<string, any>; scope?: string; key?: CryptoKey;
  issuer?: string; audience?: string; expiry?: number; issuedAt?: number } = {}) {
  const send = vi.fn(async () => {
    const token = await new SignJWT({ nonce: auth.searchParams.get('nonce'), ...options.claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setIssuer(options.issuer ?? 'https://auth.openai.com')
      .setAudience(options.audience ?? options.registration?.clientId ?? 'oaiapp_fixture').setSubject('account-one')
      .setIssuedAt(options.issuedAt ?? now / 1000).setExpirationTime(options.expiry ?? now / 1000 + 300)
      .sign(options.key ?? keys.privateKey)
    return new Response(JSON.stringify({ access_token: 'private-access', refresh_token: 'private-refresh', id_token: token,
      token_type: 'Bearer', expires_in: 3600, scope: options.scope ?? 'openid resource.invoke chatgpt.tokens.use.direct offline_access' }))
  })
  const attempt = new HadronChatgptSignIn({ hostId, redirectUri, now: () => now, registration: options.registration,
    fetch: send as any, verificationKey: async () => keys.publicKey })
  const auth = new URL(attempt.authorizationUrl())
  const callback = new URL(redirectUri)
  callback.searchParams.set('state', auth.searchParams.get('state')!)
  callback.searchParams.set('code', 'one-use-code')
  if (!options.registration) callback.searchParams.set('client_id', 'oaiapp_fixture')
  return { attempt, auth, callback, send }
}

it('creates a separate dynamic registration with fresh state/nonce and exact loopback URI', () => {
  const a = fixture(), b = fixture()
  expect(a.auth.origin + a.auth.pathname).toBe('https://auth.openai.com/api/accounts/authorize')
  expect(a.auth.searchParams.get('client_id')).toBe('dynamic_agent_client')
  expect(a.auth.searchParams.get('agent_name_hint')).toBe('The Hadron Harness')
  expect(a.auth.searchParams.get('redirect_uri')).toBe(redirectUri)
  expect(a.auth.searchParams.get('resource')).toBe('https://api.openai.com/v1')
  expect(a.auth.searchParams.get('state')).not.toBe(b.auth.searchParams.get('state'))
  expect(a.auth.searchParams.get('nonce')).not.toBe(b.auth.searchParams.get('nonce'))
  for (const bad of ['http://localhost:1455/auth/callback', 'http://127.0.0.1:1455/callback', 'https://127.0.0.1:1455/auth/callback']) {
    expect(() => new HadronChatgptSignIn({ hostId, redirectUri: bad })).toThrow('loopback')
  }
})
it('verifies a signed identity before returning private credentials and exchanges only once', async () => {
  const f = fixture()
  const first = f.attempt.complete(f.callback.toString())
  await expect(f.attempt.complete(f.callback.toString())).rejects.toThrow('expired or cancelled')
  const account = await first
  expect(account).toMatchObject({ clientId: 'oaiapp_fixture', subject: 'account-one', hostId, expiresAt: now + 3600000 })
  expect(f.send).toHaveBeenCalledTimes(1)
  const [endpoint, request] = f.send.mock.calls[0] as unknown as [string, RequestInit]
  expect(endpoint).toBe('https://auth.openai.com/api/accounts/oauth/token')
  const body = request.body as URLSearchParams
  expect(body.get('client_id')).toBe('oaiapp_fixture'); expect(body.get('redirect_uri')).toBe(redirectUri)
  expect(createHash('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(f.auth.searchParams.get('code_challenge'))
  expect(request.redirect).toBe('error')
})
it('rejects mismatched/ambiguous state before any request, and consumes a valid denial', async () => {
  const f = fixture(); f.callback.searchParams.set('state', 'forged')
  await expect(f.attempt.complete(f.callback.toString())).rejects.toThrow('state mismatch')
  f.callback.searchParams.set('state', f.auth.searchParams.get('state')!)
  f.callback.searchParams.append('state', 'duplicate')
  await expect(f.attempt.complete(f.callback.toString())).rejects.toThrow('Ambiguous')
  f.callback.searchParams.delete('state'); f.callback.searchParams.set('state', f.auth.searchParams.get('state')!)
  f.callback.searchParams.set('error', 'access_denied')
  await expect(f.attempt.complete(f.callback.toString())).rejects.toThrow('start a new sign-in')
  await expect(f.attempt.complete(f.callback.toString())).rejects.toThrow('expired or cancelled')
  expect(f.send).not.toHaveBeenCalled()
})
it('requires an issued client for registration and exact returning client/account identity', async () => {
  const missing = fixture(); missing.callback.searchParams.delete('client_id')
  await expect(missing.attempt.complete(missing.callback.toString())).rejects.toThrow('start a new sign-in')
  expect(missing.send).not.toHaveBeenCalled()
  const registration = { clientId: 'oaiapp_saved', subject: 'account-two', idToken: 'saved-hint' }
  const wrongClient = fixture({ registration }); wrongClient.callback.searchParams.set('client_id', 'oaiapp_other')
  await expect(wrongClient.attempt.complete(wrongClient.callback.toString())).rejects.toThrow('start a new sign-in')
  expect(wrongClient.send).not.toHaveBeenCalled()
  const wrongAccount = fixture({ registration })
  expect(wrongAccount.auth.searchParams.has('agent_name_hint')).toBe(false)
  expect(wrongAccount.auth.searchParams.get('id_token_hint')).toBe('saved-hint')
  await expect(wrongAccount.attempt.complete(wrongAccount.callback.toString())).rejects.toThrow('start a new sign-in')
})
it('rejects nonce/signature tampering and missing subscription permission', async () => {
  const other = await generateKeyPair('RS256')
  for (const settings of [{ claims: { nonce: 'wrong' } }, { key: other.privateKey }, { scope: 'openid profile email' }]) {
    const f = fixture(settings)
    await expect(f.attempt.complete(f.callback.toString())).rejects.toThrow('start a new sign-in')
  }
})
it('cancelled attempts never exchange and private token errors never reach the public diagnostic', async () => {
  const cancelled = fixture(); cancelled.attempt.cancel()
  await expect(cancelled.attempt.complete(cancelled.callback.toString())).rejects.toThrow('cancelled')
  expect(cancelled.send).not.toHaveBeenCalled()
  const failed = fixture(); failed.send.mockRejectedValueOnce(new Error('private-access server diagnostic'))
  await expect(failed.attempt.complete(failed.callback.toString())).rejects.toThrow(/^ChatGPT sign-in failed; start a new sign-in$/)
  expect(failed.send).toHaveBeenCalledTimes(1)
})

it('rejects correctly signed tokens for the wrong issuer/audience, expiry or future issuance', async () => {
  for (const settings of [{ issuer: 'https://other.example' }, { audience: 'oaiapp_other' },
    { expiry: now / 1000 - 100 }, { issuedAt: now / 1000 + 100 }]) {
    const f = fixture(settings)
    await expect(f.attempt.complete(f.callback.toString())).rejects.toThrow('start a new sign-in')
  }
})
it('reauthorizes only the selected registration when the callback omits its issued client ID', async () => {
  const f = fixture({ registration: { clientId: 'oaiapp_saved', subject: 'account-one', idToken: 'retained-hint' } })
  expect(f.callback.searchParams.has('client_id')).toBe(false)
  expect(await f.attempt.complete(f.callback.toString())).toMatchObject({ clientId: 'oaiapp_saved', subject: 'account-one' })
})

it('recovers an issued registration without treating its identity as already verified', async () => {
  const f = fixture({ registration: { clientId: 'oaiapp_saved' } })
  expect(f.auth.searchParams.get('client_id')).toBe('oaiapp_saved')
  expect(f.auth.searchParams.has('agent_name_hint')).toBe(false)
  expect(f.auth.searchParams.has('id_token_hint')).toBe(false)
  expect(await f.attempt.complete(f.callback.toString())).toMatchObject({ clientId: 'oaiapp_saved', subject: 'account-one' })
  const changed = fixture({ registration: { clientId: 'oaiapp_saved' } })
  changed.callback.searchParams.set('client_id', 'oaiapp_changed')
  await expect(changed.attempt.complete(changed.callback.toString())).rejects.toThrow()
  expect(changed.send).not.toHaveBeenCalled()
})

it('returns issued registration metadata only on invalid_grant without exposing it in diagnostics', async () => {
  const f = fixture()
  f.send.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
  const error = await f.attempt.complete(f.callback.toString()).catch(error => error)
  expect(error.recoveryClientId).toBe('oaiapp_fixture')
  expect(JSON.stringify(chatgptDiagnostic(error))).not.toContain('oaiapp_fixture')
  expect(f.send).toHaveBeenCalledTimes(1)
})

it('reports only fixed diagnostic stages without exposing callback or token data', async () => {
  const permission = fixture({ scope: 'openid profile email' })
  const verification = fixture({ audience: 'oaiapp_wrong' })
  const identity = fixture({ claims: { nonce: 'wrong' } })
  const network = fixture(); network.send.mockRejectedValueOnce(new Error('private-access one-use-code'))
  const rejected = fixture(); rejected.send.mockResolvedValueOnce(new Response('private-refresh', { status: 400 }))
  for (const [f, expected] of [[permission, 'permission'], [verification, 'verification'], [identity, 'identity'], [network, 'token_network'], [rejected, 'token_http']] as const) {
    const error = await f.attempt.complete(f.callback.toString()).catch(error => error)
    const diagnostic = chatgptDiagnostic(error)
    expect(diagnostic.code).toBe(expected)
    expect(JSON.stringify(diagnostic)).not.toMatch(/private-access|one-use-code|private-refresh/)
  }
})

it('serializes the code exchange correctly over real HTTP, including reserved characters and PKCE', async () => {
  let received: { method?: string; contentType?: string; body: URLSearchParams } | undefined
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk.toString()
    received = { method: request.method, contentType: request.headers['content-type'], body: new URLSearchParams(body) }
    response.writeHead(400, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'invalid_grant' }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw Error('No test listener')
    const attempt = new HadronChatgptSignIn({ hostId, redirectUri,
      fetch: async (url, init) => {
        expect(String(url)).toBe('https://auth.openai.com/api/accounts/oauth/token')
        return fetch(`http://127.0.0.1:${address.port}/token`, init)
      } })
    const auth = new URL(attempt.authorizationUrl()), callback = new URL(redirectUri)
    callback.searchParams.set('state', auth.searchParams.get('state')!)
    callback.searchParams.set('code', 'fixture+code /?=&')
    callback.searchParams.set('client_id', 'oaiapp_fixture')
    expect(chatgptDiagnostic(await attempt.complete(callback.toString()).catch(error => error))).toMatchObject({ tokenRejection: { category: 'invalid_grant' } })
    expect(received?.method).toBe('POST')
    expect(received?.contentType).toBe('application/x-www-form-urlencoded')
    expect(received?.body.get('grant_type')).toBe('authorization_code')
    expect(received?.body.get('client_id')).toBe('oaiapp_fixture')
    expect(received?.body.get('code')).toBe('fixture+code /?=&')
    expect(received?.body.get('redirect_uri')).toBe(redirectUri)
    expect(received?.body.get('resource')).toBe('https://api.openai.com/v1')
    expect(createHash('sha256').update(received!.body.get('code_verifier')!).digest('base64url')).toBe(auth.searchParams.get('code_challenge'))
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
