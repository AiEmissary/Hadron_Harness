import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { boundedChatgptJson, type HadronChatgptAccount } from './hadronChatgptSignIn.js'
const issuer = 'https://auth.openai.com'
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { timeoutDuration: 20000 })

/** Caller must hold an exclusive profile lease across the entire rotation.
 * No automatic retry: a durable pending marker precedes transmission. A crash,
 * uncertain reply or failed commit requires reconnect rather than token replay.
 * This helper remains unwired until the cross-process lease/resolver is installed.
 */
export class HadronChatgptRefresh {
  private pending?: Promise<HadronChatgptAccount>
  constructor(private readonly options: {
    read(): HadronChatgptAccount | null; save(account: HadronChatgptAccount): void
    fetch?: typeof fetch; verificationKey?: JWTVerifyGetKey; now?: () => number
  }) {}
  refresh(signal: AbortSignal): Promise<HadronChatgptAccount> {
    if (this.pending) return this.pending
    const work = this.rotate(signal)
    this.pending = work
    void work.finally(() => { if (this.pending === work) this.pending = undefined }).catch(() => {})
    return work
  }
  private async rotate(signal: AbortSignal): Promise<HadronChatgptAccount> {
    const account = this.options.read()
    signal.throwIfAborted()
    if (!account || account.refreshPending) throw new Error('Reconnect ChatGPT to renew this session')
    this.options.save({ ...account, refreshPending: true })
    const scoped = AbortSignal.any([signal, AbortSignal.timeout(20000)])
    try {
      const response = await (this.options.fetch ?? fetch)(`${issuer}/api/accounts/oauth/token`, {
        method: 'POST', redirect: 'error', signal: scoped, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: account.clientId,
          refresh_token: account.refreshToken, resource: 'https://api.openai.com/v1' }),
      })
      const tokens = await boundedChatgptJson(response)
      if (typeof tokens?.access_token !== 'string' || !tokens.access_token || tokens.access_token.length > 65536 ||
        typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer' ||
        !Number.isSafeInteger(tokens.expires_in) || tokens.expires_in <= 0 || tokens.expires_in > 31536000 ||
        (tokens.refresh_token !== undefined && (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || tokens.refresh_token.length > 65536))) throw new Error('Invalid renewal')
      const scopes = tokens.scope === undefined ? account.scopes : typeof tokens.scope === 'string' ? [...new Set<string>(tokens.scope.split(/\s+/).filter(Boolean))] : []
      if (!['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'].every(scope => scopes.includes(scope))) throw new Error('Missing plan permission')
      let idToken = account.idToken
      const now = (this.options.now ?? Date.now)()
      if (tokens.id_token !== undefined) {
        if (typeof tokens.id_token !== 'string') throw new Error('Invalid renewed identity')
        const { payload } = await jwtVerify(tokens.id_token, this.options.verificationKey ?? jwks, {
          issuer, audience: account.clientId, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 30, currentDate: new Date(now),
        })
        if (payload.sub !== account.subject || typeof payload.iat !== 'number' || payload.iat > now / 1000 + 30) throw new Error('Renewed account mismatch')
        idToken = tokens.id_token
      }
      scoped.throwIfAborted()
      const current = this.options.read()
      if (!current?.refreshPending || current.clientId !== account.clientId || current.subject !== account.subject || current.refreshToken !== account.refreshToken) throw new Error('Account changed')
      const next: HadronChatgptAccount = { ...account, accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? account.refreshToken, idToken, scopes, expiresAt: now + tokens.expires_in * 1000, refreshPending: false }
      this.options.save(next)
      return next
    } catch { throw new Error('ChatGPT renewal was not confirmed; reconnect before continuing') }
  }
}
