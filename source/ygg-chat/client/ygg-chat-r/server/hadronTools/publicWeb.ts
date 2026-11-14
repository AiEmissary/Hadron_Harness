import http from 'node:http'
import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import sanitizeHtml from 'sanitize-html'

/** Public web only. Pin the checked DNS result into the connection, including redirects. */
export function publicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a === 169 && b === 254) &&
      !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b)) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && [18, 19].includes(b))
  }
  // Only global-unicast IPv6; reject mapped IPv4, loopback, ULA, multicast and link-local.
  return isIP(ip) === 6 && /^[23][0-9a-f]{3}:/.test(ip) && !ip.startsWith('2001:db8:') && !ip.startsWith('2002:') && !ip.startsWith('2001:0:')
}
export function publicUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Expected a public HTTP(S) URL')
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    (url.port && url.port !== '80' && url.port !== '443') || /^(localhost|.*\.localhost|.*\.local)$/i.test(url.hostname)) throw new Error('Only public web addresses are available')
  return url
}
export async function readPublicWeb(value: unknown, signal: AbortSignal, redirects = 0): Promise<{ url: string; contentType: string; body: string }> {
  signal.throwIfAborted()
  if (redirects > 4) throw new Error('Too many web redirects')
  const url = publicUrl(value), host = url.hostname.replace(/^\[|\]$/g, '')
  const operationSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)])
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
    const abort = () => reject(operationSignal.reason)
    operationSignal.addEventListener('abort', abort, { once: true })
    lookup(host, { all: true, verbatim: true }).then(resolve, reject).finally(() => operationSignal.removeEventListener('abort', abort))
    if (operationSignal.aborted) abort()
  })
  signal.throwIfAborted()
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('Private/local web addresses are unavailable')
  const target = addresses[0]
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'GET', agent: false, signal: operationSignal,
      headers: { Accept: 'text/html,application/json,text/plain,application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': 'Hadron-Harness-Web/1.0' },
      lookup: ((_hostname: string, options: any, done: any) => options?.all ? done(null, [target]) : done(null, target.address, target.family)) as any,
    }, response => {
      if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.destroy()
        if (!response.headers.location) { reject(new Error('Missing redirect address')); return }
        try { resolve(readPublicWeb(new URL(response.headers.location, url).href, signal, redirects + 1)) } catch (error) { reject(error) }
        return
      }
      const type = response.headers['content-type'] ?? ''
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300 || !/text\/|application\/(json|xhtml\+xml)/i.test(type)) {
        response.destroy(); reject(new Error('The page could not be read as text')); return
      }
      const chunks: Buffer[] = []; let size = 0
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1_000_000) response.destroy(new Error('Page exceeds 1 MB')); else chunks.push(chunk) })
      response.on('error', reject)
      response.on('end', () => resolve({ url: url.href, contentType: type, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject); request.end()
  })
}

const entities = (text: string) => text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, match => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[match]!)
export function webPage(page: { url: string; body: string; contentType: string }) {
  const html = /html/i.test(page.contentType)
  const links: Array<{ text: string; url: string }> = []; let title = ''
  // Parse malformed remote HTML with a real parser; never evaluate it or run a regex parser over raw hostile markup.
  const source = html ? sanitizeHtml(page.body, {
    allowedTags: ['a', 'title', 'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'section'], allowedAttributes: { a: ['href'] },
    nonTextTags: ['script', 'style', 'noscript', 'svg', 'iframe', 'textarea'],
    exclusiveFilter(frame) {
      if (frame.tag === 'title' && !title) title = entities(frame.text).slice(0, 250)
      if (frame.tag === 'a' && links.length < 20 && frame.attribs.href) {
        try {
          const url = publicUrl(new URL(entities(frame.attribs.href), page.url).href).href
          if (url.length <= 2048 && !links.some(item => item.url === url) && JSON.stringify(links).length + url.length < 6000) links.push({ text: entities(frame.text).trim().slice(0, 80), url })
        } catch { /* Non-web links are omitted. */ }
      }
      return false
    },
  }) : page.body
  const cleaned = html ? source.replace(/<\/(?:p|div|h[1-6]|li|tr|section)>/gi, '\n').replace(/<[^>]*>/g, ' ') : source
  const text = entities(cleaned).replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim()
  return { url: page.url, title,
    text: text.slice(0, 8000), truncated: text.length > 8000, links, fetchedAt: new Date().toISOString(), untrustedContent: true }
}
