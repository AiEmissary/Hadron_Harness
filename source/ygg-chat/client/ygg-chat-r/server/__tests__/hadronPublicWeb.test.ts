import { EventEmitter } from 'node:events'
import http from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
import { lookup } from 'node:dns/promises'
import { readPublicWeb } from '../hadronTools/publicWeb.js'
beforeEach(() => vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as any))
afterEach(() => vi.restoreAllMocks())
function response(status: number, location?: string) {
  const request = vi.spyOn(http, 'request').mockImplementation(((url: URL, options: any, callback: any) => {
    const req = new EventEmitter() as any
    req.end = () => queueMicrotask(() => {
      const res = new EventEmitter() as any
      res.statusCode = status; res.headers = { 'content-type': 'text/html', ...(location ? { location } : {}) }; res.destroy = () => {}
      callback(res)
      if (status === 200) { res.emit('data', Buffer.from('<title>Fixture</title>')); res.emit('end') }
    })
    return req
  }) as any)
  return request
}
it('pins the checked public DNS address into the socket lookup, with no cookies or authorization', async () => {
  const request = response(200)
  const page = await readPublicWeb('http://example.com/', new AbortController().signal)
  expect(page.body).toContain('Fixture')
  const options = request.mock.calls[0][1] as any, callback = vi.fn()
  options.lookup('example.com', { all: true }, callback)
  expect(callback).toHaveBeenCalledWith(null, [{ address: '8.8.8.8', family: 4 }])
  expect(options.headers).not.toHaveProperty('Cookie'); expect(options.headers).not.toHaveProperty('Authorization'); expect(options.agent).toBe(false)
})
it('rejects private and mixed DNS answers before opening a connection', async () => {
  const request = response(200)
  vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] as any)
  await expect(readPublicWeb('http://example.com/', new AbortController().signal)).rejects.toThrow('Private/local')
  expect(request).not.toHaveBeenCalled()
})
it('rechecks redirects and cannot reach a local Graviton listener', async () => {
  const request = response(302, 'http://127.0.0.1/')
  await expect(readPublicWeb('http://example.com/', new AbortController().signal)).rejects.toThrow('Private/local')
  expect(request).toHaveBeenCalledTimes(1)
})
it('Stop interrupts pending DNS without allowing its late result to connect', async () => {
  const request = response(200); let finish!: (value: any) => void
  vi.mocked(lookup).mockImplementation(() => new Promise(resolve => { finish = resolve }) as any)
  const controller = new AbortController(), pending = readPublicWeb('http://example.com/', controller.signal)
  controller.abort(); await expect(pending).rejects.toThrow()
  finish([{ address: '8.8.8.8', family: 4 }]); await Promise.resolve()
  expect(request).not.toHaveBeenCalled()
})
