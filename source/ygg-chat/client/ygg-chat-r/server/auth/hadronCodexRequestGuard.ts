import http from 'node:http'
import { randomBytes } from 'node:crypto'

const upstream = 'https://chatgpt.com/backend-api/codex'
/** Per-invocation transport ceiling around the official CLI. Credentials are
 * forwarded in memory only; never returned to callers or stored in diagnostics.
 * No tool request can reach the model and no tool call can reach the CLI.
 */
export async function startCodexRequestGuard(options: {
  model: string; instructions: string; messages: Array<{ role: string; content: string }>
  signal: AbortSignal; onViolation(): void; fetch?: typeof fetch
  onText?(delta: string): void
  onProgress?():void
}) {
  const secret = '/' + randomBytes(32).toString('hex')
  let requests = 0, completed = false, text = '', violated = false, stage = 'waiting'
  const deny = () => { violated = true; options.onViolation() }
  const server = http.createServer(async (req, res) => {
    const reject = (status = 403) => { res.writeHead(status); res.end('{"error":{"message":"Hadron request policy rejected this operation"}}') }
    try {
      const address = req.socket.remoteAddress
      if (address !== '127.0.0.1' || !req.url?.startsWith(secret + '/') || req.headers.upgrade) { reject(); return }
      const url = new URL(req.url.slice(secret.length), 'http://guard.invalid')
      if (['/api/codex/accounts/check', '/api/codex/settings/user'].includes(url.pathname) && req.method === 'GET') {
        stage = 'account_settings'
        if (!req.headers.authorization?.startsWith('Bearer ')) { reject(401); return }
        if (accountReads++ > 1) { reject(); return }
        const response = await (options.fetch ?? fetch)('https://chatgpt.com' + url.pathname + url.search,
          { signal: options.signal, redirect: 'error', headers: headers(req) })
        stage = `account_http_${response.status}`
        if (!response.headers.get('content-type')?.includes('application/json')) { await response.body?.cancel(); reject(502); return }
        const body = await boundedBody(response, 4_000_000)
        res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(body); return
      }
      // chatgpt_base_url is the ChatGPT origin; the CLI adds its Codex prefix.
      if (url.pathname.startsWith('/backend-api/codex/')) url.pathname = url.pathname.slice('/backend-api/codex'.length)
      stage = ['models', 'responses'].includes(url.pathname.slice(1)) ? url.pathname.slice(1) : 'endpoint'
      if (req.method === 'GET' && url.pathname === '/models') {
        // Native startup model refresh, not inference. Bound separately below.
        if (modelReads++ > 0) { reject(); return }
        const response = await (options.fetch ?? fetch)(upstream + '/models' + url.search, {
          signal: options.signal, redirect: 'error', headers: headers(req),
        })
        const body = await boundedBody(response, 2_000_000)
        res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(body); return
      }
      if (req.method === 'GET') { reject(404); return } // Optional native discovery cannot reach arbitrary upstream routes.
      if (req.method !== 'POST' || url.pathname !== '/responses' || url.search || requests++) { reject(); deny(); return }
      let body = '', bytes = 0
      stage = 'input'
      for await (const chunk of req) {
        bytes += chunk.length
        if (bytes > 524288) throw new Error('Request exceeded limit')
        body += chunk.toString('utf8')
      }
      const original = JSON.parse(body)
      if (!original || original.model !== options.model || !Array.isArray(original.input)) throw new Error('Unexpected native request')
      // Replace all context/authority-bearing fields with the host-owned packet.
      const payload = { ...original, model: options.model, instructions: options.instructions,
        input: options.messages, tools: [], tool_choice: 'none', parallel_tool_calls: false, store: false, stream: true }
      for (const key of ['previous_response_id', 'conversation', 'context_management', 'background', 'metadata']) delete payload[key]
      const response = await (options.fetch ?? fetch)(upstream + '/responses', { method: 'POST', redirect: 'error',
        signal: options.signal, headers: { ...headers(req), 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(payload) })
      stage = `upstream_http_${response.status}`
      if (!response.ok || !response.body) {
        await response.body?.cancel(); reject(502); deny(); return
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
      const reader = response.body.getReader(), decoder = new TextDecoder()
      stage = 'stream'
      let buffer = '', total = 0
      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          total += next.value.byteLength
          if (total > 2_000_000) throw new Error('Response exceeded limit')
          buffer = (buffer + decoder.decode(next.value, { stream: true })).replace(/\r\n/g, '\n')
          let end: number
          while ((end = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2)
            if (frame.split('\n').some(line => line && !/^(data:|event:|id:|retry:|:)/.test(line))) throw new Error('Invalid stream framing')
            const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
            if (data && data !== '[DONE]') {
              const event = JSON.parse(data)
              validateEvent(event)
              options.onProgress?.()
              if (event.type === 'response.output_text.delta') {
                if (typeof event.delta !== 'string' || text.length + event.delta.length > 200000) throw new Error('Invalid text output')
                text += event.delta
                options.onText?.(event.delta)
              }
              if (event.type === 'response.completed') {
                if (event.response?.status !== 'completed' || !Array.isArray(event.response.output)) throw new Error('Incomplete response')
                // Deltas may contain commentary followed by the final message. Only the
                // completed final output is authoritative; concatenating both corrupts JSON.
                const messages = event.response.output.filter((item: any) => item.type === 'message')
                const finals = messages.filter((item: any) => item.phase === 'final_answer')
                const selected = finals.length ? finals : messages.filter((item: any) => item.phase !== 'commentary')
                if (selected.length) {
                  const canonical = selected.flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
                    .filter((part: any) => part.type === 'output_text').map((part: any) => part.text)
                  if (canonical.some((part: unknown) => typeof part !== 'string') || canonical.join('').length > 200000) throw new Error('Invalid final text')
                  text = canonical.join('')
                }
                completed = true; stage = 'completed'
              }
            }
            // Filter before forwarding any bytes of a tool-bearing frame.
            res.write(frame + '\n\n')
          }
        }
        if (buffer.trim() || !completed) throw new Error('Truncated response')
        res.end()
      } finally { await reader.cancel().catch(() => {}) }
    } catch (error: any) {
      const code = String(error?.cause?.code ?? error?.code ?? '')
      if (/CERT|ISSUER|SELF_SIGNED/.test(code)) stage = 'network_tls'
      else if (/ENOTFOUND|ECONN|ETIMEDOUT|UND_ERR/.test(code)) stage = 'network_transport'
      else if (/redirect/i.test(error?.cause?.message ?? '')) stage = 'network_redirect'
      else if (error?.message === 'Missing response body') stage = 'missing_body'
      else if (error?.message === 'Response too large') stage = 'body_limit'
      else if (error instanceof TypeError) stage = 'type_error'
      if (!res.headersSent) reject(502); else res.destroy(); deny()
    }
  })
  let modelReads = 0, accountReads = 0
  server.on('upgrade', (_req, socket) => { stage = 'websocket'; socket.destroy(); deny() })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Hadron request guard unavailable')
  const close = () => { server.closeAllConnections(); server.close() }
  options.signal.addEventListener('abort', close, { once: true })
  if (options.signal.aborted) close()
  return { baseUrl: `http://127.0.0.1:${address.port}${secret}`,
    result: () => ({ completed: completed && !violated, text, requests, stage }),
    close: () => { options.signal.removeEventListener('abort', close); close() } }
}

function headers(req: http.IncomingMessage): Record<string, string> {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) throw new Error('Native subscription authorization required')
  return { Authorization: authorization, ...Object.fromEntries(['chatgpt-account-id', 'originator', 'version', 'openai-beta', 'user-agent', 'session_id', 'x-codex-turn-metadata', 'x-codex-beta-features']
    .flatMap(key => typeof req.headers[key] === 'string' ? [[key, req.headers[key] as string]] : [])) }
}
async function boundedBody(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) throw new Error('Missing response body')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > limit) throw new Error('Response too large'); chunks.push(next.value) }
    return Buffer.concat(chunks)
  } finally { await reader.cancel().catch(() => {}) }
}
function validateEvent(event: any) {
  if (!event || typeof event.type !== 'string') throw new Error('Invalid response event')
  const item = event.item
  if (item && !['message', 'reasoning'].includes(item.type)) throw new Error('Tools are unavailable')
  if (event.response?.output) for (const output of event.response.output) {
    if (!['message', 'reasoning'].includes(output.type)) throw new Error('Tools are unavailable')
  }
  if (/function_call|tool_call|web_search|code_interpreter|computer|file_search|mcp|apply_patch|shell|custom_tool/.test(event.type) ||
    ['error', 'response.failed', 'response.incomplete'].includes(event.type)) throw new Error('Unsupported response event')
}
