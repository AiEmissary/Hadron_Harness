import { afterEach, expect, it, vi } from 'vitest'
import { startCodexRequestGuard } from '../auth/hadronCodexRequestGuard.js'
const cleanups: Array<() => void> = []
afterEach(() => { for (const close of cleanups.splice(0)) close() })
const frame = (event: unknown) => 'data: ' + JSON.stringify(event) + '\n\n'
const delta = { type: 'response.output_text.delta', delta: '12' }
const completed = { type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '12' }] }] } }
async function fixture(events: unknown[] = [delta, completed]) {
  const forward = vi.fn(async () => new Response(events.map(frame).join(''), { headers: { 'content-type': 'text/event-stream' } }))
  const progress=vi.fn(),violation = vi.fn(), controller = new AbortController()
  const guard = await startCodexRequestGuard({ model: 'fixture-model', instructions: 'Trusted role', messages: [{ role: 'user', content: 'Trusted task' }],
    signal: controller.signal, onViolation: violation,onProgress:progress, fetch: forward as typeof fetch })
  cleanups.push(guard.close)
  const send = (override: Record<string, unknown> = {}, endpoint = '/backend-api/codex/responses') => fetch(guard.baseUrl + endpoint, {
    method: 'POST', headers: { Authorization: 'Bearer fixture-private-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'fixture-model', input: [{ role: 'user', content: 'Untrusted native context' }], tools: [{ type: 'function', name: 'shell' }],
      instructions: 'Untrusted native instructions', previous_response_id: 'other-session', ...override }) })
  return { guard, forward, violation, controller, send,progress }
}
it('replaces native context with the trusted packet and removes tool and continuation authority', async () => {
  const f = await fixture()
  const response = await f.send(); expect(await response.text()).toContain('response.completed')
  expect(f.forward).toHaveBeenCalledOnce()
  const call = f.forward.mock.calls[0] as unknown as [string, RequestInit]
  expect(call[0]).toBe('https://chatgpt.com/backend-api/codex/responses')
  const body = JSON.parse(String(call[1].body))
  expect(body).toMatchObject({ instructions: 'Trusted role', input: [{ role: 'user', content: 'Trusted task' }], tools: [], tool_choice: 'none', store: false })
  expect(body).not.toHaveProperty('previous_response_id')
  expect(f.guard.result()).toMatchObject({ completed: true, text: '12', requests: 1 })
})
it('forwards at most one inference request, including retry attempts', async () => {
  const f = await fixture(); await (await f.send()).text()
  expect((await f.send()).status).toBe(403)
  expect(f.forward).toHaveBeenCalledOnce(); expect(f.violation).toHaveBeenCalledOnce()
  expect(f.guard.result().completed).toBe(false)
})
it.each([
  [{ type: 'response.output_item.added', item: { type: 'function_call', name: 'shell' } }],
  [{ type: 'response.completed', response: { status: 'completed', output: [{ type: 'custom_tool_call', name: 'apply_patch' }] } }],
  [delta],
])('blocks tool-bearing or incomplete streams before a completed result can escape', async events => {
  const f = await fixture(events)
  await f.send().then(response => response.text()).catch(() => {})
  expect(f.guard.result().completed).toBe(false); expect(f.violation).toHaveBeenCalledOnce()
})
it('rejects a different model and compaction without forwarding a request', async () => {
  const f = await fixture()
  expect((await f.send({ model: 'other-model' })).status).toBe(502)
  expect((await f.send({}, '/backend-api/codex/responses/compact')).status).toBe(403)
  expect(f.forward).not.toHaveBeenCalled()
})
it('requires its private local route and authorization; cancellation closes the listener', async () => {
  const f = await fixture()
  const untrusted = new URL(f.guard.baseUrl); untrusted.pathname = '/responses'
  expect((await fetch(untrusted, { method: 'POST' })).status).toBe(403)
  expect((await fetch(f.guard.baseUrl + '/responses', { method: 'POST', body: JSON.stringify({ model: 'fixture-model', input: [] }) })).status).toBe(502)
  expect(f.forward).not.toHaveBeenCalled()
  f.controller.abort()
  await expect(fetch(f.guard.baseUrl)).rejects.toThrow()
})

it('uses completed final text instead of concatenated commentary and final tool JSON', async()=>{
 const request='{"tool":"web_read","arguments":{"url":"https://example.com"}}'
 const f=await fixture([{type:'response.output_text.delta',delta:request},{type:'response.output_text.delta',delta:request},{type:'response.completed',response:{status:'completed',output:[{type:'message',phase:'commentary',content:[{type:'output_text',text:request}]},{type:'message',phase:'final_answer',content:[{type:'output_text',text:request}]}]}}])
 await(await f.send()).text();expect(f.guard.result().text).toBe(request);expect(JSON.parse(f.guard.result().text).tool).toBe('web_read')
})
it.each([429,503])('records an explicit HTTP %s rejection without exposing the provider body or retrying',async status=>{
 const f=await fixture()
 f.forward.mockImplementation(async()=>new Response('private provider detail',{status}))
 await f.send().then(response=>response.text()).catch(()=>{})
 expect(f.guard.result()).toMatchObject({stage:`upstream_http_${status}`,requests:1,completed:false,text:''})
 expect(f.forward).toHaveBeenCalledOnce()
 expect(JSON.stringify(f.guard.result())).not.toContain('private provider detail')
})

it('reports validated upstream activity even before visible answer text',async()=>{
 const f=await fixture([{type:'response.created',response:{status:'in_progress'}},delta,completed])
 await(await f.send()).text()
 expect(f.progress).toHaveBeenCalledTimes(3)
 expect(f.guard.result().completed).toBe(true)
})
