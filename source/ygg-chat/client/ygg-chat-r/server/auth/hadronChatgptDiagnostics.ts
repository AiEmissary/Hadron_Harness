const messages = {
  start: 'Hadron could not start sign-in. Check the browser and protected account storage.',
  callback: 'The browser callback could not be matched to this sign-in. Start a fresh sign-in.',
  registration: 'OpenAI did not return the expected Hadron client registration.',
  declined: 'ChatGPT plan access was not granted.',
  token_network: 'Hadron could not reach the OpenAI token endpoint.',
  token_http: 'OpenAI rejected the authorization-code exchange. Start a fresh sign-in.',
  token_response: 'OpenAI returned an unexpected token response.',
  permission: 'The sign-in did not grant permission to use your ChatGPT plan.',
  verification: 'Hadron could not verify the OpenAI identity token or signing keys.',
  identity: 'The verified OpenAI account did not match this sign-in.',
  storage: 'Hadron could not save the verified connection in protected storage.',
} as const
export type ChatgptDiagnosticCode = keyof typeof messages
const oauthErrors = new Set(['invalid_grant', 'invalid_client', 'invalid_request', 'unsupported_grant_type', 'invalid_scope',
  'invalid_resource', 'access_denied', 'unauthorized_client', 'server_error', 'temporarily_unavailable'])
const oauthFields = new Set(['client_id', 'code', 'code_verifier', 'redirect_uri', 'resource', 'grant_type', 'ext_agent_host_id', 'scope'])
export interface ChatgptTokenRejection {
  category?: string; field?: string; format: 'json' | 'non_json' | 'unreadable' | 'too_large' | 'empty'
}
/** Read once with a hard cap; return only standard categories/field names, never raw descriptions. */
export async function readChatgptTokenRejection(response: Response): Promise<ChatgptTokenRejection> {
  if (!response.body) return { format: 'empty' }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > 16384) return { format: 'too_large' }
      chunks.push(next.value)
    }
    if (!size) return { format: 'empty' }
    let data: any
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { return { format: 'non_json' } }
    const candidates = [data?.error, data?.error?.code, data?.error?.type, data?.code]
    const category = candidates.find(value => typeof value === 'string' && oauthErrors.has(value))
    const field = [data?.error?.param, data?.param].find(value => typeof value === 'string' && oauthFields.has(value))
    return { format: 'json', ...(category ? { category } : {}), ...(field ? { field } : {}) }
  } catch { return { format: 'unreadable' } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
export class HadronChatgptSignInError extends Error {
  constructor(readonly diagnosticCode: ChatgptDiagnosticCode, readonly httpStatus?: number,
    readonly tokenRejection?: ChatgptTokenRejection,
    /** Host-only recovery metadata. Never included in public diagnostics. */
    readonly recoveryClientId?: string) { super('ChatGPT sign-in failed; start a new sign-in') }
}
/** Only fixed codes/copy cross the host boundary; never exception text or OAuth data. */
export function chatgptDiagnostic(error: unknown, fallback: ChatgptDiagnosticCode = 'callback') {
  const code = error instanceof HadronChatgptSignInError && Object.hasOwn(messages, error.diagnosticCode) ? error.diagnosticCode : fallback
  const status = error instanceof HadronChatgptSignInError && code === 'token_http' && Number.isInteger(error.httpStatus) && error.httpStatus! >= 400 && error.httpStatus! <= 599 ? error.httpStatus : undefined
  const rejection = error instanceof HadronChatgptSignInError && code === 'token_http' ? error.tokenRejection : undefined
  const category = rejection?.category && oauthErrors.has(rejection.category) ? rejection.category : undefined
  const field = rejection?.field && oauthFields.has(rejection.field) ? rejection.field : undefined
  const format = rejection && ['json', 'non_json', 'unreadable', 'too_large', 'empty'].includes(rejection.format) ? rejection.format : undefined
  const safeRejection: ChatgptTokenRejection | undefined = rejection ? { format: (format ?? 'unreadable') as ChatgptTokenRejection['format'], ...(category ? { category } : {}), ...(field ? { field } : {}) } : undefined
  const details = [status ? `HTTP ${status}` : '', category, field ? `field: ${field}` : '', format && !category ? `response: ${format}` : ''].filter(Boolean).join('; ')
  return { code, message: messages[code] + (details ? ` (${details})` : ''), ...(status ? { httpStatus: status } : {}),
    ...(safeRejection ? { tokenRejection: safeRejection } : {}) }
}
