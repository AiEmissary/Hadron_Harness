import { afterEach, expect, it, vi } from 'vitest'
import { CODEX_STREAM_FRAME_MAX_BYTES, CODEX_TEXT_MAX_CHARS, startCodexRequestGuard } from '../auth/hadronCodexRequestGuard.js'
import {fixtureImage} from '../../../../shared/__fixtures__/hadronImage.js'
const cleanups: Array<() => void> = []
it('delivers actual image content through the host guard without granting native tools',async()=>{
 const forward=vi.fn(async()=>new Response(frame(completed),{headers:{'content-type':'text/event-stream'}}))
 const guard=await startCodexRequestGuard({model:'fixture-model',instructions:'Describe',messages:[{role:'user',content:'What is shown?'}],images:[fixtureImage],signal:new AbortController().signal,onViolation:()=>{},fetch:forward as typeof fetch})
 cleanups.push(guard.close)
 await (await fetch(guard.baseUrl+'/backend-api/codex/responses',{method:'POST',headers:{Authorization:'Bearer fixture-private-token','Content-Type':'application/json'},body:JSON.stringify({model:'fixture-model',input:[],tools:[{name:'shell'}]})})).text()
 const body=JSON.parse(String((forward.mock.calls[0] as unknown as [string,RequestInit])[1].body))
 expect(body.input[0].content).toEqual([{type:'input_text',text:'What is shown?'},{type:'input_image',image_url:fixtureImage.dataUrl}])
 expect(body.tools).toEqual([])
})
afterEach(() => { for (const close of cleanups.splice(0)) close() })
const frame = (event: unknown) => 'data: ' + JSON.stringify(event) + '\n\n'
const delta = { type: 'response.output_text.delta', delta: '12' }
const completed = { type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '12' }] }] } }
async function fixture(events: unknown[] = [delta, completed],webSearch=false) {
  const forward = vi.fn(async () => new Response(events.map(frame).join(''), { headers: { 'content-type': 'text/event-stream' } }))
  const progress=vi.fn(),violation = vi.fn(), controller = new AbortController()
  const guard = await startCodexRequestGuard({ model: 'fixture-model', instructions: 'Trusted role', messages: [{ role: 'user', content: 'Trusted task' }],
    signal: controller.signal, onViolation: violation,onProgress:progress, fetch: forward as typeof fetch,webSearch })
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

it('permits only provider-hosted search in a dedicated search run and keeps confirmed source receipts',async()=>{
 const search={type:'web_search_call',id:'search-1',status:'completed',action:{type:'search',query:'public query',sources:[{type:'url',url:'https://example.com/'}]}}
 const f=await fixture([{type:'response.web_search_call.searching',item_id:'search-1'},{type:'response.completed',response:{status:'completed',output:[search,...completed.response.output]}}],true)
 await(await f.send()).text()
 expect(f.guard.result()).toMatchObject({completed:true,webSearchCalls:1})
 const body=JSON.parse(String((f.forward.mock.calls[0] as unknown as [string,RequestInit])[1].body))
 expect(body.tools).toEqual([{type:'web_search',external_web_access:true}]);expect(body.tool_choice).toBe('required')
 expect(JSON.stringify(f.guard.result().webSources)).toContain('https://example.com/')
})
it('cannot claim a search completed without a native search receipt, or invoke local tools in search mode',async()=>{
 for(const events of [[completed],[{type:'response.output_item.added',item:{type:'function_call',name:'shell'}}]]){
  const f=await fixture(events,true)
  await f.send().then(response=>response.text()).catch(()=>{})
  expect(f.guard.result().completed).toBe(false);expect(f.violation).toHaveBeenCalledOnce()
 }
})

it('retains a completed streamed search receipt when the terminal output contains only the answer',async()=>{
 const item={type:'web_search_call',id:'search-streamed',status:'completed',action:{type:'search',sources:[{url:'https://example.com/'}]}}
 const f=await fixture([{type:'response.output_item.done',item},completed],true)
 await(await f.send()).text()
 expect(f.guard.result()).toMatchObject({completed:true,webSearchCalls:1})
 expect(JSON.stringify(f.guard.result().webSources)).toContain('example.com')
})

it('accepts more than 2 MB of valid reasoning traffic with a short confirmed final answer',async()=>{
 const f=await fixture([...Array.from({length:1100},()=>({type:'response.reasoning_summary_text.delta',delta:'r'.repeat(2048)})),delta,completed])
 await(await f.send()).text()
 expect(f.guard.result()).toMatchObject({completed:true,text:'12',eventCount:1102,lastEvent:'response.completed',outputChars:2})
 expect(f.guard.result().receivedBytes).toBeGreaterThan(2_000_000)
 expect(f.violation).not.toHaveBeenCalled()
})

it('finishes at the validated terminal event without waiting for the upstream connection to close',async()=>{
 const f=await fixture(),cancel=vi.fn()
 f.forward.mockImplementation(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(frame(completed)))},cancel}),{headers:{'content-type':'text/event-stream'}}))
 expect(await(await f.send()).text()).toContain('response.completed')
 expect(f.guard.result().completed).toBe(true);expect(cancel).toHaveBeenCalledOnce()
})

it('decodes split UTF-8 characters and CRLF frames without corrupting the canonical answer',async()=>{
 const f=await fixture(),answer='Finished — 牛 🐄',bytes=new TextEncoder().encode(frame({type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:answer}]}]}}).replace(/\n/g,'\r\n'))
 let index=0
 f.forward.mockImplementation(async()=>new Response(new ReadableStream({pull(controller){if(index===bytes.length)controller.close();else controller.enqueue(bytes.slice(index,index+=1))}})))
 await(await f.send()).text()
 expect(f.guard.result()).toMatchObject({completed:true,text:answer})
})

it.each([
 ['stream_ended',[delta]],
 ['unsupported_tool',[{type:'response.output_item.added',item:{type:'function_call',name:'shell'}}]],
 ['context_limit',[{type:'response.failed',response:{error:{code:'context_length_exceeded',message:'private provider text'}}}]],
 ['usage_limit',[{type:'error',code:'rate_limit_exceeded',message:'private provider text'}]],
 ['provider_output_limit',[{type:'response.incomplete',response:{incomplete_details:{reason:'max_output_tokens'}}}]],
 ['provider_incomplete',[{type:'response.incomplete',response:{incomplete_details:{reason:'private-code'}}}]],
 ['provider_failed',[{type:'response.failed',response:{error:{code:'private-code',message:'private provider text'}}}]],
 ['text_limit',[{type:'response.output_text.delta',delta:'x'.repeat(CODEX_TEXT_MAX_CHARS+1)}]],
 ['empty_answer',[{type:'response.output_text.delta',delta:'commentary is not a final answer'},{type:'response.completed',response:{status:'completed',output:[{type:'message',phase:'commentary',content:[{type:'output_text',text:'commentary is not a final answer'}]}]}}]],
] as const)('identifies %s without treating partial text as completed or leaking provider error bodies',async(failure,events)=>{
 const f=await fixture([...events])
 await f.send().then(response=>response.text()).catch(()=>{})
 const {text,...diagnostic}=f.guard.result()
 expect(diagnostic).toMatchObject({completed:false,failure,requests:1})
 expect(JSON.stringify(diagnostic)).not.toMatch(/private-code|private provider text/)
 expect(f.violation).toHaveBeenCalledOnce();expect(f.forward).toHaveBeenCalledOnce()
})

it('bounds one unfinished frame even though cumulative stream traffic is not limited',async()=>{
 const f=await fixture()
 f.forward.mockImplementation(async()=>new Response('data: '+ 'x'.repeat(CODEX_STREAM_FRAME_MAX_BYTES)))
 await f.send().then(response=>response.text()).catch(()=>{})
 expect(f.guard.result()).toMatchObject({completed:false,failure:'frame_limit'})
})

it('identifies malformed JSON separately from a clean stream that ended too early',async()=>{
 const f=await fixture()
 f.forward.mockImplementation(async()=>new Response('data: {broken}\n\n'))
 await f.send().then(response=>response.text()).catch(()=>{})
 expect(f.guard.result()).toMatchObject({completed:false,failure:'invalid_stream'})
})
