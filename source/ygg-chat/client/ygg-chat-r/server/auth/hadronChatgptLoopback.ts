import { createServer } from 'node:http'
import { HadronChatgptSignIn, type HadronChatgptAccount } from './hadronChatgptSignIn.js'
import { chatgptDiagnostic, HadronChatgptSignInError } from './hadronChatgptDiagnostics.js'

/** Starts only on explicit user action. Port zero avoids Graviton's fixed listener.
 * Caller opens authorizationUrl externally and handles completion immediately.
 * No token/authorization code is returned in the callback page or logged.
 */
export async function startHadronChatgptLoopback(options: Omit<ConstructorParameters<typeof HadronChatgptSignIn>[0], 'redirectUri'>): Promise<{
  authorizationUrl: string; completion: Promise<HadronChatgptAccount>; cancel(): void
}> {
  let attempt: HadronChatgptSignIn | undefined, processing = false, done = false
  let resolve!: (account: HadronChatgptAccount) => void, reject!: (error: Error) => void
  const completion = new Promise<HadronChatgptAccount>((yes, no) => { resolve = yes; reject = no })
  // Pending browser work can outlive the caller's tick; attach a rejection handler
  // immediately while retaining the rejected promise for the owner's await.
  void completion.catch(() => {})
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = (account?: HadronChatgptAccount, failure?: Error) => {
    if (done) return
    done = true; if (timer) clearTimeout(timer)
    if (!account) attempt?.cancel()
    server.close(); server.closeIdleConnections()
    account ? resolve(account) : reject(failure ?? new Error('ChatGPT sign-in ended without a connection'))
  }
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const address = server.address()
    if (!address || typeof address === 'string' || request.method !== 'GET' ||
      request.headers.host !== `127.0.0.1:${address.port}` || !request.url || !request.url.startsWith('/') || request.url.startsWith('//') || request.url.length > 16384 ||
      !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) {
      response.writeHead(400); response.end('Invalid callback.'); return
    }
    const callback = new URL(request.url, `http://127.0.0.1:${address.port}`)
    if (callback.pathname !== '/auth/callback') { response.writeHead(404); response.end(); return }
    if (!attempt || processing || done) { response.writeHead(409); response.end('Sign-in already handled.'); return }
    processing = true
    try {
      const account = await attempt.complete(callback.toString())
      if (done) { response.writeHead(409); response.end('Sign-in ended.'); return }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end('<!doctype html><title>Hadron Harness</title><h1>ChatGPT connected</h1><p>Return to Hadron Harness.</p>')
      finish(account)
    } catch (error) {
      const diagnostic = chatgptDiagnostic(error)
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(`Sign-in could not complete. ${diagnostic.message} [${diagnostic.code}] Return to Hadron Harness.`)
      // A stray local request with the wrong state must not cancel the real flow.
      if (attempt.ended) finish(undefined, error instanceof HadronChatgptSignInError ? error : new HadronChatgptSignInError(diagnostic.code, diagnostic.httpStatus, diagnostic.tokenRejection))
    } finally { processing = false }
  })
  server.requestTimeout = 25000; server.headersTimeout = 10000; server.maxHeadersCount = 30
  await new Promise<void>((yes, no) => {
    server.once('error', no)
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', no); yes() })
  })
  server.on('error', () => finish())
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No callback port')
    attempt = new HadronChatgptSignIn({ ...options, redirectUri: `http://127.0.0.1:${address.port}/auth/callback` })
    timer = setTimeout(() => finish(), 600000); timer.unref()
    return { authorizationUrl: attempt.authorizationUrl(), completion, cancel: () => finish() }
  } catch (error) { finish(); throw error }
}
