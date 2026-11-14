import express from 'express'
import { afterEach, beforeEach, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { registerHadronToolRoutes } from '../hadronToolRoutes.js'
let server: Server, root: string, base: string, previous: string | undefined
const definition = { name: 'counter', description: 'Count characters', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } }
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hadron-tool-routes-')); previous = process.env.HADRON_TOOLS_LIBRARY; process.env.HADRON_TOOLS_LIBRARY = root
  const app = express(); app.use(express.json()); registerHadronToolRoutes(app, { enabled: true, authenticatedOwner: req => req.headers.authorization === 'Bearer owner-a' ? 'owner-a' : req.headers.authorization === 'Bearer owner-b' ? 'owner-b' : null })
  server = app.listen(0, '127.0.0.1'); base = ''
})
afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
  if (previous === undefined) delete process.env.HADRON_TOOLS_LIBRARY; else process.env.HADRON_TOOLS_LIBRARY = previous
  if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('hadron-tool-routes-')) throw new Error('Unexpected temporary test directory')
  fs.rmSync(root, { recursive: true, force: true })
})
const request = async (suffix = '', body?: unknown, owner = 'owner-a') => {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/collaboration/tools`
  return fetch(base + suffix, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${owner}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
const create = async (code = 'function* run(args){return {count:args.text.length};}') => {
  const response = await request('', { definition, code }); expect(response.status).toBe(201); return response.json() as Promise<any>
}
it('requires authentication before library reads, creation or enablement', async () => {
  expect((await request('', undefined, 'unknown')).status).toBe(401)
  expect((await request('', { definition, code: 'x' }, 'unknown')).status).toBe(401)
  expect((await request('/counter/enabled', { hash: null }, 'unknown')).status).toBe(401)
  expect(fs.readdirSync(root)).toEqual([])
})
it('supports manual creation, source review, actual testing and exact-version enable/disable', async () => {
  const tool = await create(); expect(tool.enabled).toBe(false)
  expect((await (await request(`/counter/${tool.hash}/source`)).json()).code).toContain('function* run')
  expect(await (await request(`/counter/${tool.hash}/test`, { arguments: { text: 'hello' } })).json()).toEqual({ success: true, result: { count: 5 } })
  expect((await request('/counter/enabled', { hash: '0'.repeat(64) })).status).toBe(409)
  expect((await request('/counter/enabled', { hash: tool.hash })).status).toBe(200)
  expect((await (await request()).json()).tools[0].enabled).toBe(true)
  expect((await request('/counter/enabled', { hash: null })).status).toBe(200)
  expect((await (await request()).json()).tools[0].enabled).toBe(false)
})
it('does not allow another owner to read, test or enable a saved tool version', async () => {
  const tool = await create()
  expect((await (await request('', undefined, 'owner-b')).json()).tools).toEqual([])
  expect((await request(`/counter/${tool.hash}/source`, undefined, 'owner-b')).status).toBe(404)
  expect((await request(`/counter/${tool.hash}/test`, { arguments: { text: 'x' } }, 'owner-b')).status).toBe(409)
  expect((await request('/counter/enabled', { hash: tool.hash }, 'owner-b')).status).toBe(409)
})
it('rejects invalid inputs and unavailable host capabilities without enabling the draft', async () => {
  const tool = await create("function* run(){yield {tool:'bash',arguments:{command:'x'}};}")
  expect((await request(`/counter/${tool.hash}/test`, { arguments: {} })).status).toBe(409)
  expect((await request(`/counter/${tool.hash}/test`, { arguments: { text: 'x' } })).status).toBe(409)
  expect((await (await request()).json()).tools[0].enabled).toBe(false)
  expect((await request('/counter/enabled', { hash: tool.hash, fullAccess: true })).status).toBe(400)
})
