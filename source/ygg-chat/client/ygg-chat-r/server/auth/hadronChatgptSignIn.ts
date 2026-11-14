import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { HadronChatgptSignInError, readChatgptTokenRejection, type ChatgptDiagnosticCode, type ChatgptTokenRejection } from './hadronChatgptDiagnostics.js'

const issuer = 'https://auth.openai.com'
const resource = 'https://api.openai.com/v1'
const scopes = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { timeoutDuration: 20000, cooldownDuration: 30000, cacheMaxAge: 600000 })

/** Private host-side record. Never expose this object through IPC or renderer state. */
export interface HadronChatgptAccount {
  issuer: typeof issuer; clientId: string; hostId: string; subject: string; email?: string
  accessToken: string; refreshToken: string; idToken: string; scopes: string[]; expiresAt: number
  refreshPending?: boolean
}
/** An issued registration may precede verified identity when its first code fails. */
export interface HadronChatgptRegistration { clientId: string; subject?: string; idToken?: string; email?: string }

function issuedClient(value: unknown): value is string {
  return typeof value === 'string' && /^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(value)
}
function equalSecret(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
export async function boundedChatgptJson(response: Response): Promise<any> {
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('ChatGPT token exchange failed') }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > 131072) throw new Error('ChatGPT token response exceeded limit')
      chunks.push(next.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

/** One public-client OAuth attempt; its listener must already own the callback port.
 * No legacy Codex client ID, fixed port, API key, retries or credential publication.
 * Caller persists hostId BEFORE constructing and atomically saves a verified result.
 */
export class HadronChatgptSignIn {
  private readonly state = randomBytes(32).toString('base64url')
  private readonly nonce = randomBytes(32).toString('base64url')
  private verifier = randomBytes(32).toString('base64url')
  private readonly createdAt: number
  private consumed = false
  get ended(): boolean { return this.consumed }
  private readonly controller = new AbortController()
  constructor(private readonly options: {
    hostId: string; redirectUri: string; registration?: HadronChatgptRegistration; now?: () => number
    fetch?: typeof fetch; verificationKey?: JWTVerifyGetKey
  }) {
    if (!/^urn:uuid:[0-9a-f-]{36}$/i.test(options.hostId)) throw new Error('Persistent Hadron host ID required')
    const callback = new URL(options.redirectUri)
    if (callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1' || !callback.port ||
      callback.pathname !== '/auth/callback' || callback.search || callback.hash || callback.username || callback.password) {
      throw new Error('Hadron requires its own IPv4 loopback callback')
    }
    const registration = options.registration
    if (registration && (!issuedClient(registration.clientId) ||
      (registration.subject !== undefined && (typeof registration.subject !== 'string' || !registration.subject)) ||
      (registration.subject === undefined && (registration.idToken !== undefined || registration.email !== undefined)))) throw new Error('Invalid saved ChatGPT registration')
    this.createdAt = this.now()
  }
  private now(): number { return (this.options.now ?? Date.now)() }
  authorizationUrl(): string {
    if (this.consumed) throw new Error('ChatGPT sign-in attempt ended')
    const url = new URL(`${issuer}/api/accounts/authorize`)
    const registration = this.options.registration
    const params: Record<string, string> = {
      client_id: registration?.clientId ?? 'dynamic_agent_client', ext_agent_host_id: this.options.hostId,
      response_type: 'code', redirect_uri: this.options.redirectUri, scope: scopes, resource,
      state: this.state, nonce: this.nonce, code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(this.verifier).digest('base64url'),
    }
    if (!registration) params.agent_name_hint = 'The Hadron Harness'
    else {
      if (registration.idToken) params.id_token_hint = registration.idToken
      if (registration.email) params.login_hint = registration.email
    }
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    return url.toString()
  }
  cancel(): void { this.consumed = true; this.verifier = ''; this.controller.abort() }
  async complete(callbackUrl: string): Promise<HadronChatgptAccount> {
    if (this.consumed || this.now() - this.createdAt > 600000) throw new Error('ChatGPT sign-in expired or cancelled')
    const callback = new URL(callbackUrl), expected = new URL(this.options.redirectUri)
    if (callback.origin !== expected.origin || callback.pathname !== expected.pathname || callback.hash) throw new Error('Unexpected ChatGPT callback')
    const query = callback.searchParams
    for (const key of ['state', 'code', 'client_id', 'error']) if (query.getAll(key).length > 1) throw new Error('Ambiguous ChatGPT callback')
    if (!equalSecret(query.get('state') ?? '', this.state)) throw new Error('ChatGPT callback state mismatch')
    // Consume before the first asynchronous operation: duplicate callbacks cannot exchange twice.
    this.consumed = true
    const verifier = this.verifier; this.verifier = ''
    const timeout = setTimeout(() => this.controller.abort(), 20000)
    let phase: ChatgptDiagnosticCode = 'registration'
    let httpStatus: number | undefined
    let tokenRejection: ChatgptTokenRejection | undefined
    let exchangeClient: string | undefined
    try {
      if (query.has('error')) { phase = 'declined'; throw new Error('ChatGPT sign-in was declined') }
      const registration = this.options.registration, callbackClient = query.get('client_id')
      const clientId = registration?.clientId ?? callbackClient
      if (!issuedClient(clientId) || (registration && callbackClient !== null && callbackClient !== clientId)) throw new Error('ChatGPT issued client mismatch')
      exchangeClient = clientId
      const code = query.get('code')
      if (!code || code.length > 8192) throw new Error('Missing ChatGPT authorization code')
      phase = 'token_network'
      const response = await (this.options.fetch ?? fetch)(`${issuer}/api/accounts/oauth/token`, {
        method: 'POST', redirect: 'error', signal: this.controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code,
          code_verifier: verifier, redirect_uri: this.options.redirectUri, resource }),
      })
      phase = response.ok ? 'token_response' : 'token_http'
      if (!response.ok) {
        httpStatus = response.status
        tokenRejection = await readChatgptTokenRejection(response)
        throw new Error('ChatGPT token exchange rejected')
      }
      const tokens = await boundedChatgptJson(response)
      if (!tokens || typeof tokens.access_token !== 'string' || !tokens.access_token ||
        typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || typeof tokens.id_token !== 'string' ||
        typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer' ||
        !Number.isSafeInteger(tokens.expires_in) || tokens.expires_in <= 0 || tokens.expires_in > 31536000 || typeof tokens.scope !== 'string') throw new Error('Invalid ChatGPT token response')
      const granted = [...new Set<string>(tokens.scope.split(/\s+/).filter(Boolean))]
      phase = 'permission'
      if (!['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'].every(scope => granted.includes(scope))) throw new Error('ChatGPT plan permission missing')
      phase = 'verification'
      const { payload } = await jwtVerify(tokens.id_token, this.options.verificationKey ?? jwks, {
        issuer, audience: clientId, requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
        algorithms: ['RS256'], clockTolerance: 30, currentDate: new Date(this.now()),
      })
      phase = 'identity'
      if (typeof payload.iat !== 'number' || payload.iat > this.now() / 1000 + 30 ||
        typeof payload.sub !== 'string' || !payload.sub || typeof payload.nonce !== 'string' || !equalSecret(payload.nonce, this.nonce) ||
        (registration?.subject !== undefined && payload.sub !== registration.subject)) throw new Error('ChatGPT verified account mismatch')
      this.controller.signal.throwIfAborted()
      return { issuer, clientId, hostId: this.options.hostId, subject: payload.sub,
        ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
        accessToken: tokens.access_token, refreshToken: tokens.refresh_token, idToken: tokens.id_token,
        scopes: granted, expiresAt: this.now() + tokens.expires_in * 1000 }
    } catch { throw new HadronChatgptSignInError(phase, httpStatus, tokenRejection,
      tokenRejection?.category === 'invalid_grant' ? exchangeClient : undefined) }
    finally { clearTimeout(timeout) }
  }
}
