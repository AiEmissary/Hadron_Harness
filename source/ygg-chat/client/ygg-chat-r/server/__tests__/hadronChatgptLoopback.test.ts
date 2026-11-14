import { expect, it, vi } from 'vitest'
import { generateKeyPair, SignJWT } from 'jose'
import { startHadronChatgptLoopback } from '../auth/hadronChatgptLoopback.js'
import { chatgptDiagnostic } from '../auth/hadronChatgptDiagnostics.js'

const hostId = 'urn:uuid:11111111-2222-4333-8444-555555555555'
it('owns an ephemeral listener, ignores forged state, and closes after verified sign-in', async () => {
  const key = await generateKeyPair('RS256')
  let auth: URL
  const exchange = vi.fn(async () => new Response(JSON.stringify({ access_token: 'private-access', refresh_token: 'private-refresh',
    token_type: 'Bearer', expires_in: 3600, scope: 'openid resource.invoke chatgpt.tokens.use.direct',
    id_token: await new SignJWT({ nonce: auth.searchParams.get('nonce') }).setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://auth.openai.com').setAudience('oaiapp_test').setSubject('subject')
      .setIssuedAt().setExpirationTime('5m').sign(key.privateKey) })))
  const flow = await startHadronChatgptLoopback({ hostId, fetch: exchange as any, verificationKey: async () => key.publicKey })
  try {
    auth = new URL(flow.authorizationUrl)
    const callback = new URL(auth.searchParams.get('redirect_uri')!)
    expect(callback.hostname).toBe('127.0.0.1'); expect(Number(callback.port)).toBeGreaterThan(0)
    callback.searchParams.set('state', 'forged')
    expect((await fetch(callback)).status).toBe(400)
    expect(exchange).not.toHaveBeenCalled()
    callback.searchParams.set('state', auth.searchParams.get('state')!)
    callback.searchParams.set('code', 'code'); callback.searchParams.set('client_id', 'oaiapp_test')
    const response = await fetch(callback)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const page = await response.text()
    expect(page).toContain('Return to Hadron Harness')
    expect(page).not.toMatch(/private-access|private-refresh|code=/)
    expect(await flow.completion).toMatchObject({ subject: 'subject', clientId: 'oaiapp_test' })
    expect(exchange).toHaveBeenCalledTimes(1)
    await expect(fetch(callback)).rejects.toThrow()
  } finally { flow.cancel() }
})
it('can have two listeners without a fixed port and cancellation closes only the owned listener', async () => {
  const first = await startHadronChatgptLoopback({ hostId })
  const second = await startHadronChatgptLoopback({ hostId })
  try {
    const one = new URL(first.authorizationUrl).searchParams.get('redirect_uri')!
    const two = new URL(second.authorizationUrl).searchParams.get('redirect_uri')!
    expect(one).not.toBe(two)
    first.cancel()
    await expect(first.completion).rejects.toThrow('without a connection')
    await expect(fetch(one)).rejects.toThrow()
    expect((await fetch(two)).status).toBe(400)
  } finally { first.cancel(); second.cancel() }
  await expect(second.completion).rejects.toThrow('without a connection')
})

it('shows a fixed callback diagnostic and preserves it for the connection card', async () => {
  const flow = await startHadronChatgptLoopback({ hostId, fetch: vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'private server diagnostic' }), { status: 400 })) as any })
  try {
    const auth = new URL(flow.authorizationUrl)
    const callback = new URL(auth.searchParams.get('redirect_uri')!)
    callback.searchParams.set('state', auth.searchParams.get('state')!)
    callback.searchParams.set('code', 'private-code'); callback.searchParams.set('client_id', 'oaiapp_test')
    const page = await (await fetch(callback)).text()
    expect(page).toContain('[token_http]')
    expect(page).toContain('HTTP 400')
    expect(page).toContain('invalid_grant')
    expect(page).not.toMatch(/private-code|private server diagnostic|oaiapp_test/)
    const failure = await flow.completion.catch(error => error)
    expect(failure.recoveryClientId).toBe('oaiapp_test')
    expect(chatgptDiagnostic(failure)).toMatchObject({ code: 'token_http', tokenRejection: { category: 'invalid_grant' } })
  } finally { flow.cancel() }
})
