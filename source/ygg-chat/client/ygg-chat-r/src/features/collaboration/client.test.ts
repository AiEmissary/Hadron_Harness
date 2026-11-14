import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../../utils/api', () => ({ getLocalServerOrigin: async () => 'http://127.0.0.1:3012' }))
import { createCollaborationClient } from './client'
afterEach(() => vi.restoreAllMocks())
it('accepts saved review/synthesis results and rejects malformed stage projections without retrying', async () => {
  const status = { schemaVersion: 1, sessionId: 's', phase: 'independent_proposals', status: 'completed', revision: 9,
    limits: { deadlineMs: 360000, maxRequestsPerParticipant: 1 },
    participants: ['a', 'b'].map(id => ({ id, provider: 'openaichatgpt', modelName: 'model' })), artifacts: [],
    collaboration: { phase: 'finished', maxRequests: 5, stages: ['review_a', 'review_b', 'final'].map(id => ({
      id, participantId: id === 'review_b' ? 'b' : 'a', modelName: 'model', status: 'completed', text: 'Saved evidence', verified: false,
    })) } }
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(status)))
  const client = createCollaborationClient(async () => 'a'.repeat(64))
  expect((await client.status('s')).collaboration!.stages).toHaveLength(3)
  for (const invalid of [
    { ...status.collaboration, maxRequests: 6 },
    { ...status.collaboration, stages: [status.collaboration.stages[0]] },
    { ...status.collaboration, stages: status.collaboration.stages.map(stage => ({ ...stage, verified: true })) },
    { ...status.collaboration, stages: status.collaboration.stages.map(stage => ({ ...stage, text: 'x'.repeat(32001) })) },
  ]) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...status, collaboration: invalid })))
    await expect(client.status('s')).rejects.toThrow('Unsupported collaboration workflow')
  }
  expect(fetch).toHaveBeenCalledTimes(5)
})
it('uses header-only desktop capability and encodes resource IDs without retries', async () => {
  const token = 'a'.repeat(64)
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    schemaVersion: 1, sessionId: 's', phase: 'independent_proposals', status: 'running', revision: 1,
    limits: { deadlineMs: 120000, maxRequestsPerParticipant: 1 },
    participants: ['a', 'b'].map(id => ({ id, provider: 'openaichatgpt', modelName: 'model-a' })), artifacts: [],
  })))
  await createCollaborationClient(async () => token).status('s/other')
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:3012/api/collaboration/proposals/s%2Fother')
  expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ authorization: `Bearer ${token}` })
  expect(String(fetch.mock.calls[0][0])).not.toContain(token)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('fails before HTTP when the trusted capability is missing', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  await expect(createCollaborationClient(async () => '').status('s')).rejects.toThrow()
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects unknown status versions without retrying', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 2 })))
  await expect(createCollaborationClient(async () => 'a'.repeat(64)).status('s')).rejects.toThrow('Unsupported')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('opens scoped replay with a header capability and never starts or stops inference on stream detach', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('data: {"type":"complete","seq":3}\n\n'))
  const frames: number[] = []
  const result = await createCollaborationClient(async () => 'a'.repeat(64))
    .stream('session', 'stream', 2, new AbortController().signal, frame => frames.push(frame.seq))
  expect(result).toEqual({ cursor: 3, terminal: true })
  expect(frames).toEqual([3])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:3012/api/collaboration/proposals/session/streams/stream?fromSeq=2')
  expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ authorization: `Bearer ${'a'.repeat(64)}` })
})


it('discovers saved sessions with encoded conversation scope and header grant only', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, sessions: [], nextBefore: null })))
  expect(await createCollaborationClient(async () => 'a'.repeat(64)).list('c / other', 'last/id')).toEqual({ schemaVersion: 1, sessions: [], nextBefore: null })
  const url = new URL(String(fetch.mock.calls[0][0]))
  expect(url.searchParams.get('conversationId')).toBe('c / other')
  expect(url.searchParams.get('before')).toBe('last/id')
  expect(fetch.mock.calls[0][1]?.headers).toEqual({ authorization: `Bearer ${'a'.repeat(64)}` })
  expect(fetch).toHaveBeenCalledTimes(1)
})


it('rejects unsupported or cross-conversation discovery pages without retry', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const client = createCollaborationClient(async () => 'a'.repeat(64))
  for (const page of [{ schemaVersion: 2, sessions: [], nextBefore: null },
    { schemaVersion: 1, sessions: [{ sessionId: 'private', conversationId: 'other' }], nextBefore: null }]) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(page)))
    await expect(client.list('c')).rejects.toThrow('Unsupported collaboration page')
  }
  expect(fetch).toHaveBeenCalledTimes(2)
})


it('reads only scoped saved output and distinguishes missing live replay from other HTTP failures', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ schemaVersion: 1,
    sessionId: 'saved/id', participantId: 'a', runId: 'run', status: 'completed', text: 'Saved output', verified: false })))
  const client = createCollaborationClient(async () => 'a'.repeat(64))
  expect((await client.transcript('saved/id', 'a')).text).toBe('Saved output')
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:3012/api/collaboration/proposals/saved%2Fid/participants/a/transcript')
  fetch.mockResolvedValueOnce(new Response('', { status: 410 }))
  await expect(client.stream('saved/id', 's', 0, new AbortController().signal, () => {})).rejects.toThrow('Live replay unavailable')
  fetch.mockResolvedValueOnce(new Response(JSON.stringify({ schemaVersion: 1, sessionId: 'other', participantId: 'a' })))
  await expect(client.transcript('saved/id', 'a')).rejects.toThrow('Unsupported saved response')
})

it('accepts bounded verification receipts but rejects fabricated verification flags and oversized evidence',async()=>{
 const base={schemaVersion:1,sessionId:'s',phase:'independent_proposals',status:'completed',revision:1,limits:{deadlineMs:600000,maxRequestsPerParticipant:1},participants:['a','b'].map(id=>({id,provider:'openaichatgpt',modelName:'model'})),artifacts:[],collaboration:{phase:'finished',maxRequests:13,stages:['review_a','review_b','verification','final'].map(id=>({id,participantId:id==='review_b'?'b':'a',modelName:'model',status:'completed',text:'Report',verified:false})),evidence:{receipts:[{id:'check-1',tool:'web_read',recordedAt:'now',result:'source excerpt',truncated:true}],omitted:0},toolActivity:[]}}
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(base)))
 const client=createCollaborationClient(async()=>'a'.repeat(64));expect((await client.status('s')).collaboration!.maxRequests).toBe(13)
 fetch.mockResolvedValueOnce(new Response(JSON.stringify({...base,collaboration:{...base.collaboration,evidence:{...base.collaboration.evidence,receipts:[{...base.collaboration.evidence.receipts[0],result:'x'.repeat(1601)}]}}})))
 await expect(client.status('s')).rejects.toThrow('Unsupported verification evidence')
 fetch.mockResolvedValueOnce(new Response(JSON.stringify({...base,collaboration:{...base.collaboration,stages:base.collaboration.stages.map(item=>({...item,verified:true}))}})))
 await expect(client.status('s')).rejects.toThrow('Unsupported collaboration workflow')
})
