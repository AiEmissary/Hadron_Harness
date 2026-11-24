import { describe, expect, it, vi } from 'vitest'
import { admitHadronToolSession, isHadronToolSession, runHadronToolConversation } from '../hadronTools/types.js'
import { publicAddress, publicUrl, webPage } from '../hadronTools/publicWeb.js'

it.each(['127.0.0.1', '10.2.3.4', '172.16.0.1', '192.168.1.3', '169.254.169.254', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fd00::1', '0.0.0.0'])('denies private/local address %s', ip => expect(publicAddress(ip)).toBe(false))
it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('accepts public address %s', ip => expect(publicAddress(ip)).toBe(true))
it.each(['file:///C:/Users/rajka/secret', 'javascript:alert(1)', 'https://user:pass@example.com', 'http://localhost/', 'http://example.com:3002/'])('rejects unusable web URL %s', url => expect(() => publicUrl(url)).toThrow())
it('extracts bounded text/links without executing page scripts', () => {
  const result = webPage({ url: 'https://example.com/start', contentType: 'text/html', body: '<title>Hi &amp; hello</title><script>SECRET</script><p>Evidence</p><a href="/next">Next</a><a href="file:///local">No</a>' })
  expect(result.title).toBe('Hi & hello'); expect(result.text).not.toContain('SECRET')
  expect(result.links).toEqual([{ text: 'Next', url: 'https://example.com/next' }]); expect(result.untrustedContent).toBe(true)
})
describe('Coordinator tool conversation', () => {
  it('runs a requested tool then returns the final answer with bounded evidence', async () => {
    const invoke = vi.fn().mockResolvedValue({ title: 'Evidence' })
    const generate = vi.fn().mockResolvedValueOnce('{"tool":"web_read","arguments":{"url":"https://example.com"}}').mockResolvedValueOnce('{"answer":"Read evidence."}')
    expect(await runHadronToolConversation({ session: { instructions: 'trusted', invoke }, task: 'Read', signal: new AbortController().signal, generate })).toBe('Read evidence.')
    expect(invoke).toHaveBeenCalledTimes(1); expect(generate.mock.calls[1][0]).toContain('tool_evidence')
  })
  it('cannot gain a capability by supplying a JSON object with matching fields', () => {
    expect(isHadronToolSession({ instructions: 'x', invoke: () => null })).toBe(false)
    expect(isHadronToolSession(admitHadronToolSession({ instructions: 'x', invoke: async () => null }))).toBe(true)
  })
  it('rejects parallel/malformed requests and stops at the request budget', async () => {
    const invoke = vi.fn().mockResolvedValue({}), session = { instructions: 'x', invoke }, signal = new AbortController().signal
    await expect(runHadronToolConversation({ session, task: 'x', signal, generate: async () => '{"tool":"x","arguments":{},"extra":true}' })).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
    let call = 0
    const generate = vi.fn(async () => JSON.stringify({ tool: 'web_read', arguments: { url: 'https://example.com/' + call++ } }))
    expect(await runHadronToolConversation({ session, task: 'x', signal, generate })).toContain('Partial research — limit reached')
    expect(generate).toHaveBeenCalledTimes(8); expect(invoke).toHaveBeenCalledTimes(7)
    expect(JSON.parse(generate.mock.calls[7][0]).finalAnswerRequired).toBe(true)
    expect(generate.mock.calls[7][1]).toContain('Tools are now closed')
  })
  it('does not execute an operation after Stop arrives during generation', async () => {
    const controller = new AbortController(), invoke = vi.fn()
    await expect(runHadronToolConversation({ session: { instructions: 'x', invoke }, task: 'x', signal: controller.signal,
      generate: async () => { controller.abort(); return '{"tool":"web_read","arguments":{}}' } })).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })
})

it('requires a real evidence attempt in verification, with at most one bounded correction',async()=>{
 let attempted=false;const invoke=vi.fn(async()=>{attempted=true;return {title:'Observed'}})
 const session={instructions:'host',requireEvidenceAttempt:true,evidenceAttempted:()=>attempted,invoke}
 const generate=vi.fn().mockResolvedValueOnce('{"answer":"No tools available"}').mockResolvedValueOnce('{"tool":"web_read","arguments":{"url":"https://example.com"}}').mockResolvedValueOnce('{"answer":"Observed"}')
 expect(await runHadronToolConversation({session,task:'Check',signal:new AbortController().signal,generate})).toBe('Observed')
 expect(generate).toHaveBeenCalledTimes(3);expect(generate.mock.calls[1][0]).toContain('HOST PROTOCOL CORRECTION')
 const refused=vi.fn().mockResolvedValue('{"answer":"No checks"}')
 await expect(runHadronToolConversation({session:{...session,evidenceAttempted:()=>false},task:'Check',signal:new AbortController().signal,generate:refused})).rejects.toThrow('without attempting')
 expect(refused).toHaveBeenCalledTimes(2)
})
it('reserves the last request for synthesis without increasing the configured budget',async()=>{
 const invoke=vi.fn(async()=>({text:'observed file evidence'}))
 const generate=vi.fn(async(packet:string,_instructions:string)=>JSON.parse(packet).finalAnswerRequired?JSON.stringify({answer:'Limited conclusion based on the inspected excerpt; the rest remains unknown.'}):JSON.stringify({tool:'project_read',arguments:{path:'sample.md',startLine:generate.mock.calls.length}}))
 const answer=await runHadronToolConversation({session:{instructions:'Read only',invoke,maxRequests:3},task:'Inspect a large project',signal:new AbortController().signal,generate})
 expect(answer).toContain('Limited conclusion');expect(generate).toHaveBeenCalledTimes(3);expect(invoke).toHaveBeenCalledTimes(2)
})
it('saves a bounded honest partial record if the model ignores final-only instructions, without inventing an edit proposal',async()=>{
 const invoke=vi.fn(async()=>({text:'x'.repeat(15000)})),generate=vi.fn(async()=>JSON.stringify({tool:'project_read',arguments:{path:'file'}}))
 const session={instructions:'Read only',invoke,maxRequests:2}
 const partial=await runHadronToolConversation({session,task:'Inspect',signal:new AbortController().signal,generate})
 expect(partial).toContain('not a completed recommendation');expect(partial.length).toBeLessThan(4000);expect(invoke).toHaveBeenCalledTimes(1)
 await expect(runHadronToolConversation({session:{...session,acceptStructuredAnswer:true},task:'Propose edits',signal:new AbortController().signal,generate})).rejects.toThrow('No changes were prepared')
})


it.each(['<invoke name="project_search"><parameter name="query">last 7 days</parameter></invoke>', '<function_calls><invoke name="project_search" /></function_calls>', JSON.stringify({answer:'<invoke name="project_search" />'})])('corrects native tool markup without executing it or accepting it as an answer: %s',async markup=>{
 const invoke=vi.fn(async()=>({text:'real evidence'})),generate=vi.fn().mockResolvedValueOnce(markup).mockResolvedValueOnce('{"tool":"project_read","arguments":{"path":"README.md"}}').mockResolvedValueOnce('{"answer":"Observed real evidence; no changes made."}')
 expect(await runHadronToolConversation({session:{instructions:'Read',invoke,maxRequests:4},task:'Inspect',signal:new AbortController().signal,generate})).toBe('Observed real evidence; no changes made.')
 expect(invoke).toHaveBeenCalledTimes(1);expect(invoke).toHaveBeenCalledWith('project_read',{path:'README.md'},expect.any(AbortSignal));expect(generate.mock.calls[1][0]).toContain('was not executed')
})
it('fails clearly on repeated native markup and respects the final-only budget',async()=>{
 const invoke=vi.fn(),generate=vi.fn(async()=>'<invoke name="project_read"/>')
 await expect(runHadronToolConversation({session:{instructions:'Read',invoke},task:'Inspect',signal:new AbortController().signal,generate})).rejects.toThrow('unsupported tool-request format')
 expect(generate).toHaveBeenCalledTimes(2);expect(invoke).not.toHaveBeenCalled()
 const last=vi.fn().mockResolvedValueOnce('{"tool":"project_read","arguments":{}}').mockResolvedValueOnce('<invoke name="project_read"/>');invoke.mockResolvedValue({text:'partial evidence'})
 expect(await runHadronToolConversation({session:{instructions:'Read',invoke,maxRequests:2},task:'Inspect',signal:new AbortController().signal,generate:last})).toContain('Partial research')
 expect(last).toHaveBeenCalledTimes(2);expect(invoke).toHaveBeenCalledTimes(1)
})

it('keeps literal XML search arguments separate from a native invocation response',async()=>{
 const invoke=vi.fn(async()=>({matches:[]})),generate=vi.fn().mockResolvedValueOnce(JSON.stringify({tool:'project_search',arguments:{query:'<invoke name='}})).mockResolvedValueOnce('{"answer":"No matching text was found in the bounded search."}')
 expect(await runHadronToolConversation({session:{instructions:'Read',invoke},task:'Find XML text',signal:new AbortController().signal,generate})).toContain('bounded search')
 expect(invoke).toHaveBeenCalledWith('project_search',{query:'<invoke name='},expect.any(AbortSignal))
})

it('executes the complete large coding payload and retains a bounded receipt in the next request',async()=>{
 const source='print("example")\n'.repeat(4000),invoke=vi.fn().mockResolvedValue({success:true,path:'fixture.py'}),packets:string[]=[]
 const result=await runHadronToolConversation({session:{execution:'agent',maxRequests:3,instructions:'trusted',invoke},task:'Write the fixture',signal:new AbortController().signal,generate:async(packet)=>{packets.push(packet);return packets.length===1?JSON.stringify({tool:'create_file',arguments:{path:'fixture.py',content:source}}):JSON.stringify({answer:'Wrote the file.'})}})
 expect(result).toBe('Wrote the file.');expect(invoke.mock.calls[0][1].content).toBe(source)
 expect(packets[1].length).toBeLessThan(4000)
 const input=JSON.parse(packets[1]).transcript[1].content.arguments.content
 expect(input.characters).toBe(source.length);expect(input.sha256).toMatch(/^[a-f0-9]{64}$/)
 expect(packets[1]).toContain('tool_evidence')
})
describe('Repeated read-only requests', () => {
  it('returns the earlier result for an identical read-only request instead of running it again', async () => {
    const invoke = vi.fn().mockResolvedValue({ matches: ['budgetStage.js:42'] })
    const generate = vi.fn()
      .mockResolvedValueOnce('{"tool":"project_search","arguments":{"query":"lane_open_cap","path":"src"}}')
      .mockResolvedValueOnce('{"tool":"project_search","arguments":{"path":"src","query":"lane_open_cap"}}')
      .mockResolvedValueOnce('{"answer":"Found it."}')
    expect(await runHadronToolConversation({ session: { instructions: 'x', invoke }, task: 'x', signal: new AbortController().signal, generate })).toBe('Found it.')
    expect(invoke).toHaveBeenCalledTimes(1)
    const packet = JSON.parse(generate.mock.calls[2][0])
    const reused = packet.transcript.at(-1).content
    expect(reused).toMatchObject({ repeatedRequest: true, notRunAgain: true, firstOperation: 1, result: { matches: ['budgetStage.js:42'] } })
    expect(packet.repeatedRequests).toBe(1)
  })
  it('runs a read again after a file-changing operation, and never reuses file-changing operations', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true })
    const read = '{"tool":"project_read","arguments":{"path":"a.js"}}', write = '{"tool":"project_write","arguments":{"path":"a.js","content":"x"}}'
    const generate = vi.fn().mockResolvedValueOnce(read).mockResolvedValueOnce(write).mockResolvedValueOnce(read).mockResolvedValueOnce(write).mockResolvedValueOnce('{"answer":"Done."}')
    await runHadronToolConversation({ session: { instructions: 'x', invoke }, task: 'x', signal: new AbortController().signal, generate })
    expect(invoke).toHaveBeenCalledTimes(4)
  })
  it('requires a final answer after repeated identical requests and reports an agent stall', async () => {
    const invoke = vi.fn().mockResolvedValue({ matches: [] })
    const session = admitHadronToolSession({ instructions: 'x', invoke, execution: 'agent', requireCompletionStatus: true, maxRequests: 30 })
    const generate = vi.fn().mockResolvedValue('{"tool":"project_search","arguments":{"query":"lane_open_cap"}}')
    const text = await runHadronToolConversation({ session, task: 'x', signal: new AbortController().signal, generate })
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledTimes(6)
    expect(JSON.parse(generate.mock.calls[5][0]).finalAnswerRequired).toBe(true)
    expect(JSON.parse(generate.mock.calls[5][0]).hostInstruction).toContain('repeatedly requested operations that already ran')
    expect(text).toContain('kept repeating the same read-only requests')
    expect(session.outcome?.incompleteReason).toBe('agent_stalled')
  })
  it('records an unfinished stalled answer as agent_stalled', async () => {
    const invoke = vi.fn().mockResolvedValue({ matches: [] })
    const session = admitHadronToolSession({ instructions: 'x', invoke, execution: 'agent', requireCompletionStatus: true, maxRequests: 30 })
    const generate = vi.fn().mockImplementation(async () => generate.mock.calls.length === 6 ? '{"answer":"Partial findings.","finished":false}' : '{"tool":"project_search","arguments":{"query":"q"}}')
    expect(await runHadronToolConversation({ session, task: 'x', signal: new AbortController().signal, generate })).toBe('Partial findings.')
    expect(session.outcome?.incompleteReason).toBe('agent_stalled')
  })
})
it('treats Agent-mode coding reads as read-only repeats, while a shell command clears earlier results', async () => {
  const invoke = vi.fn().mockResolvedValue({ success: true, content: 'source' })
  const read = '{"tool":"read_file","arguments":{"path":"budgetStage.js","startLine":1,"endLine":110}}', search = '{"tool":"ripgrep","arguments":{"pattern":"lane_open_cap"}}', shell = '{"tool":"powershell","arguments":{"command":"npm test"}}'
  const generate = vi.fn().mockResolvedValueOnce(read).mockResolvedValueOnce(search).mockResolvedValueOnce(read).mockResolvedValueOnce(search).mockResolvedValueOnce(shell).mockResolvedValueOnce(read).mockResolvedValueOnce('{"answer":"Done."}')
  await runHadronToolConversation({ session: { instructions: 'x', invoke, maxRequests: 8 }, task: 'x', signal: new AbortController().signal, generate })
  expect(invoke.mock.calls.map(call => call[0])).toEqual(['read_file', 'ripgrep', 'powershell', 'read_file'])
})
describe('Replies in an unusable format', () => {
  it('sends one correction and continues when the next reply is usable', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const generate = vi.fn()
      .mockResolvedValueOnce('{"tool":"read_file","arguments":{"path":"a.js"},"description":"why"}')
      .mockResolvedValueOnce('{"tool":"read_file","arguments":{"path":"a.js"}}')
      .mockResolvedValueOnce('{"answer":"Done."}')
    expect(await runHadronToolConversation({ session: { instructions: 'x', invoke }, task: 'x', signal: new AbortController().signal, generate })).toBe('Done.')
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[1][0]).toContain('HOST PROTOCOL CORRECTION')
  })
  it('saves the work instead of discarding the run after two unusable replies in a row', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true, content: 'evidence' })
    const session = admitHadronToolSession({ instructions: 'x', invoke, execution: 'agent', requireCompletionStatus: true, maxRequests: 30 })
    const generate = vi.fn()
      .mockResolvedValueOnce('{"tool":"read_file","arguments":{"path":"a.js"}}')
      .mockResolvedValue('{"answer":"Report","finished":false,"nextSteps":["x"]}')
    const text = await runHadronToolConversation({ session, task: 'x', signal: new AbortController().signal, generate })
    expect(text).toContain('twice replied in a format Hadron could not use')
    expect(text).toContain('nextSteps')
    expect(session.outcome?.incompleteReason).toBe('agent_incomplete')
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})
describe('Model request failures', () => {
  it('ends an Agent run with saved work as Not finished instead of discarding it, without retrying', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true, content: 'edited execute.js' })
    const session = admitHadronToolSession({ instructions: 'x', invoke, execution: 'agent', requireCompletionStatus: true, maxRequests: 30 })
    const generate = vi.fn().mockResolvedValueOnce('{"tool":"edit_file","arguments":{"path":"execute.js"}}').mockRejectedValueOnce(new Error('Claude ended this request without a usable answer'))
    const text = await runHadronToolConversation({ session, task: 'x', signal: new AbortController().signal, generate })
    expect(text).toContain('Not finished — the model request failed')
    expect(text).toContain('Claude ended this request without a usable answer')
    expect(text).toContain('edited execute.js')
    expect(generate).toHaveBeenCalledTimes(2); expect(invoke).toHaveBeenCalledTimes(1)
    expect(session.outcome?.incompleteReason).toBe('agent_incomplete')
  })
  it('still reports the error when nothing has been saved yet', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('provider down'))
    await expect(runHadronToolConversation({ session: admitHadronToolSession({ instructions: 'x', invoke: vi.fn(), execution: 'agent', requireCompletionStatus: true }), task: 'x', signal: new AbortController().signal, generate })).rejects.toThrow('provider down')
  })
})
