import http from 'node:http'
import {parseHadronImages,type HadronImage} from '../../../../shared/hadronImages.js'
import { randomBytes } from 'node:crypto'

const upstream = 'https://chatgpt.com/backend-api/codex'
// Bound retained data, not cumulative SSE traffic. Reasoning/delta envelopes can
// exceed 2 MB even when the completed answer is short.
export const CODEX_STREAM_FRAME_MAX_BYTES = 8 * 1024 * 1024
export const CODEX_TEXT_MAX_CHARS = 200000
export type CodexGuardFailure = 'stream_ended' | 'invalid_stream' | 'frame_limit' | 'text_limit' |
  'unsupported_tool' | 'context_limit' | 'usage_limit' | 'provider_output_limit' |
  'provider_failed' | 'provider_incomplete' | 'empty_answer' | 'network' | 'request_policy'
class GuardFailure extends Error {
  constructor(readonly category: CodexGuardFailure) { super(category) }
}
const diagnosticEvents = new Set(['response.created', 'response.in_progress', 'response.completed', 'response.failed',
  'response.incomplete', 'error', 'response.output_item.added', 'response.output_item.done',
  'response.output_text.delta', 'response.output_text.done', 'response.content_part.added', 'response.content_part.done',
  'response.reasoning_summary_text.delta', 'response.reasoning_summary_text.done', 'response.reasoning_text.delta',
  'response.reasoning_text.done', 'response.web_search_call.in_progress', 'response.web_search_call.searching', 'response.web_search_call.completed'])
const diagnosticItems = new Set(['message', 'reasoning', 'web_search_call', 'function_call', 'custom_tool_call'])
/** Per-invocation transport ceiling around the official CLI. Credentials are
 * forwarded in memory only; never returned to callers or stored in diagnostics.
 * No tool request can reach the model and no tool call can reach the CLI.
 */
export async function startCodexRequestGuard(options: {
  images?:HadronImage[];
  model: string; instructions: string; messages: Array<{ role: string; content: string }>
  signal: AbortSignal; onViolation(): void; fetch?: typeof fetch
  onText?(delta: string): void
  onProgress?():void
  /** Trusted dedicated search invocation only; ordinary text jobs keep tools disabled. */
  webSearch?: boolean
}) {
  const images=parseHadronImages(options.images)
  const messages=options.messages.map((message,index)=>images.length&&index===options.messages.length-1&&message.role==='user'?{...message,content:[{type:'input_text',text:message.content},...images.map(image=>({type:'input_image',image_url:image.dataUrl}))]}:message)
  const secret = '/' + randomBytes(32).toString('hex')
  let requests = 0, completed = false, text = '', violated = false, stage = 'waiting'
  const searchCalls=new Set<string>(),webSources:unknown[]=[]
  let lastEvent='',lastItem='',receivedBytes=0,eventCount=0,failure:CodexGuardFailure|undefined
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
        input: messages, tools: options.webSearch ? [{type:'web_search',external_web_access:true}] : [], tool_choice: options.webSearch ? 'required' : 'none', parallel_tool_calls: false, store: false, stream: true,
        ...(options.webSearch?{include:['web_search_call.action.sources']}:{}), }
      for (const key of ['previous_response_id', 'conversation', 'context_management', 'background', 'metadata']) delete payload[key]
      const response = await (options.fetch ?? fetch)(upstream + '/responses', { method: 'POST', redirect: 'error',
        signal: options.signal, headers: { ...headers(req), 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(payload) })
      stage = `upstream_http_${response.status}`
      if (!response.ok || !response.body) {
        await response.body?.cancel(); reject(502); deny(); return
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
      const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', {fatal:true})
      stage = 'stream'
      let buffer = ''
      try {
        while (!completed) {
          const next = await reader.read()
          if (next.done) throw new GuardFailure('stream_ended')
          receivedBytes += next.value.byteLength
          buffer = (buffer + decoder.decode(next.value, { stream: true })).replace(/\r\n/g, '\n')
          let end: number
          while ((end = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2)
            if (Buffer.byteLength(frame) > CODEX_STREAM_FRAME_MAX_BYTES) throw new GuardFailure('frame_limit')
            if (frame.split('\n').some(line => line && !/^(data:|event:|id:|retry:|:)/.test(line))) throw new GuardFailure('invalid_stream')
            const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
            if (data && data !== '[DONE]') {
              const event = JSON.parse(data)
              eventCount++
              lastEvent=diagnosticEvents.has(event?.type)?event.type:'other'
              lastItem=diagnosticItems.has(event?.item?.type)?event.item.type:''
              validateEvent(event,options.webSearch===true)
              if(options.webSearch&&event.type==='response.output_item.done'&&event.item?.type==='web_search_call'&&event.item.status==='completed'&&typeof event.item.id==='string'){
                searchCalls.add(event.item.id);webSources.push(event.item.action?.sources??[])
              }
              options.onProgress?.()
              if (event.type === 'response.output_text.delta') {
                if (typeof event.delta !== 'string') throw new GuardFailure('invalid_stream')
                if (text.length + event.delta.length > CODEX_TEXT_MAX_CHARS) throw new GuardFailure('text_limit')
                text += event.delta
                options.onText?.(event.delta)
              }
              if (event.type === 'response.completed') {
                if (event.response?.status !== 'completed' || !Array.isArray(event.response.output)) throw new GuardFailure('invalid_stream')
                if(options.webSearch){
                  for(const item of event.response.output){
                    if(item.type==='web_search_call'&&item.status==='completed'&&typeof item.id==='string'){searchCalls.add(item.id);webSources.push(item.action?.sources??[])}
                    if(item.type==='message')for(const part of item.content??[])if(part.type==='output_text')webSources.push(part.annotations??[])
                  }
                  if(!searchCalls.size){stage='search_receipt_missing:'+event.response.output.map((item:any)=>item.type+(typeof item.status==='string'&&/^[a-z_]{1,30}$/.test(item.status)?':'+item.status:'')).join(',');throw Error('Provider did not execute web search')}
                }
                // Deltas may contain commentary followed by the final message. Only the
                // completed final output is authoritative; concatenating both corrupts JSON.
                const messages = event.response.output.filter((item: any) => item.type === 'message')
                const finals = messages.filter((item: any) => item.phase === 'final_answer')
                const selected = finals.length ? finals : messages.filter((item: any) => item.phase !== 'commentary')
                const canonical = selected.flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
                  .filter((part: any) => part.type === 'output_text').map((part: any) => part.text)
                if (canonical.some((part: unknown) => typeof part !== 'string')) throw new GuardFailure('invalid_stream')
                if (canonical.join('').length > CODEX_TEXT_MAX_CHARS) throw new GuardFailure('text_limit')
                text = canonical.join('')
                if (!text.trim()) throw new GuardFailure('empty_answer')
                completed = true; stage = 'completed'
              }
            }
            // Filter before forwarding any bytes of a tool-bearing frame.
            res.write(frame + '\n\n')
            // The validated terminal event is sufficient. Do not wait for an
            // upstream socket close or forward any later frame to the CLI.
            if (completed) break
          }
          if (!completed && Buffer.byteLength(buffer) > CODEX_STREAM_FRAME_MAX_BYTES) throw new GuardFailure('frame_limit')
        }
        res.end()
      } finally { await reader.cancel().catch(() => {}) }
    } catch (error: any) {
      failure=error instanceof GuardFailure?error.category:stage==='stream'?'invalid_stream':'request_policy'
      if(options.webSearch&&stage==='stream')stage='stream_rejected:'+lastEvent+(lastItem?':'+lastItem:'')
      const code = String(error?.cause?.code ?? error?.code ?? '')
      if (/CERT|ISSUER|SELF_SIGNED/.test(code)) {stage = 'network_tls';failure='network'}
      else if (/ENOTFOUND|ECONN|ETIMEDOUT|UND_ERR/.test(code)) {stage = 'network_transport';failure='network'}
      else if (/redirect/i.test(error?.cause?.message ?? '')) {stage = 'network_redirect';failure='network'}
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
    result: () => ({ completed: completed && !violated, text, requests, stage, failure,
      receivedBytes,eventCount,lastEvent,lastItem,outputChars:text.length,
      ...(options.webSearch?{webSearchCalls:searchCalls.size,webSources}:{}) }),
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
function validateEvent(event: any, webSearch=false) {
  if (!event || typeof event.type !== 'string') throw new GuardFailure('invalid_stream')
  if (['error', 'response.failed', 'response.incomplete'].includes(event.type)) {
    // Only known machine codes affect feedback. Never retain provider messages.
    const code=event.response?.error?.code??event.error?.code??event.code??event.response?.incomplete_details?.reason
    if (code==='context_length_exceeded') throw new GuardFailure('context_limit')
    if (['rate_limit_exceeded','usage_limit_reached','insufficient_quota','quota_exceeded'].includes(code)) throw new GuardFailure('usage_limit')
    if (code==='max_output_tokens') throw new GuardFailure('provider_output_limit')
    throw new GuardFailure(event.type==='response.incomplete'?'provider_incomplete':'provider_failed')
  }
  const item = event.item
  const allowed=['message','reasoning',...(webSearch?['web_search_call']:[])]
  if (item && !allowed.includes(item.type)) throw new GuardFailure('unsupported_tool')
  if (event.response?.output) for (const output of event.response.output) {
    if (!allowed.includes(output.type)) throw new GuardFailure('unsupported_tool')
  }
  if (/function_call|tool_call|code_interpreter|computer|file_search|mcp|apply_patch|shell|custom_tool/.test(event.type) ||
    (/web_search/.test(event.type)&&(!webSearch||!/^response\.web_search_call\.(in_progress|searching|completed)$/.test(event.type))) ||
    ['error', 'response.failed', 'response.incomplete'].includes(event.type)) throw new GuardFailure('unsupported_tool')
}
