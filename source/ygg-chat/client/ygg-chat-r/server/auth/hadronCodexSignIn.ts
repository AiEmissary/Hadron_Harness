/** Official CLI-generated browser OAuth URL. Kept in the host, never in IPC or logs. */
export function codexBrowserSignInUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 16384 || /[\u0000-\u0020\u007f]/.test(raw)) return null
  try {
    const url = new URL(raw), query = url.searchParams
    if (url.origin !== 'https://auth.openai.com' || url.pathname !== '/oauth/authorize' || url.username || url.password || url.hash) return null
    for (const key of ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method']) {
      if (query.getAll(key).length !== 1 || !query.get(key)) return null
    }
    if (query.get('response_type') !== 'code' || query.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(query.get('code_challenge')!)) return null
    const redirect = new URL(query.get('redirect_uri')!)
    if (redirect.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname) ||
      redirect.username || redirect.password || redirect.pathname !== '/auth/callback' || redirect.search || redirect.hash) return null
    return url.toString()
  } catch { return null }
}

export function parseCodexBrowserPrompt(text: string): string | null {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '')
  for (const match of clean.matchAll(/https:\/\/[^\s<>"']+/g)) {
    const url = codexBrowserSignInUrl(match[0])
    if (url) return url
  }
  return null
}
