import { afterEach, expect, it, vi } from 'vitest'
import { createIndependentJobClient } from './independentClient'
vi.mock('../../utils/api', () => ({ getLocalServerOrigin: async () => 'http://localhost:1234' }))
afterEach(() => vi.unstubAllGlobals())
it('opens saved project entries with an authenticated read and rejects mismatched navigation', async () => {
  const entry = { schemaVersion: 1, requestedConversationId: 'private', workspaceConversationId: 'source', slot: 'b', nodeId: 'saved-response' }
  const fetcher = vi.fn(async () => new Response(JSON.stringify(entry)))
  vi.stubGlobal('fetch', fetcher)
  const client = createIndependentJobClient(async () => 'a'.repeat(64))
  expect(await client.openWorkspace('private')).toEqual(entry)
  expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('GET')
  await expect(client.openWorkspace('other')).rejects.toThrow('Unsupported saved workspace navigation')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('accepts an owned shared workspace and rejects shared/private navigation mixtures', async () => {
  const entry = { schemaVersion: 1, requestedConversationId: 'managed', workspaceConversationId: 'managed', slot: null, nodeId: null, sharedSessionId: 'shared' }
  const fetcher = vi.fn(async () => new Response(JSON.stringify(entry)))
  vi.stubGlobal('fetch', fetcher)
  const client = createIndependentJobClient(async () => 'a'.repeat(64))
  expect(await client.openWorkspace('managed')).toEqual(entry)
  fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ ...entry, workspaceConversationId: 'parent', slot: 'a', nodeId: 'private' })))
  await expect(client.openWorkspace('managed')).rejects.toThrow('Unsupported')
  fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ ...entry, sharedSessionId: '' })))
  await expect(client.openWorkspace('managed')).rejects.toThrow('Unsupported')
})
const input = { schemaVersion: 1 as const, id: 'a', conversationId: 'chat-a', anchorMessageId: 'anchor', task: 'First job', context: '', provider: 'openaichatgpt' as const, modelName: 'approved' }
const state = { schemaVersion: 1, id: 'a', conversationId: 'chat-a', status: 'running', revision: 1, provider: 'openaichatgpt', modelName: 'approved', runId: 'run-a', streamId: 'stream-a' }
it('keeps job requests scoped and never launches while reading or stopping', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(state), { status: 202 }))
  vi.stubGlobal('fetch', fetcher)
  const client = createIndependentJobClient(async () => 'a'.repeat(64))
  await client.start(input); await client.status('a'); await client.stop('a')
  expect(fetcher.mock.calls.map(call => (call as unknown as [string, RequestInit])[0])).toEqual([
    'http://localhost:1234/api/collaboration/jobs', 'http://localhost:1234/api/collaboration/jobs/a', 'http://localhost:1234/api/collaboration/jobs/a/stop',
  ])
  expect(JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual(input)
})
it('rejects mismatched replies, invalid authority and unknown delivery without retry', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ ...state, id: 'b' })))
  vi.stubGlobal('fetch', fetcher)
  const client = createIndependentJobClient(async () => 'a'.repeat(64))
  await expect(client.start(input)).rejects.toThrow('Unsupported')
  expect(fetcher).toHaveBeenCalledTimes(1)
  await expect(createIndependentJobClient(async () => 'invalid').status('a')).rejects.toThrow('capability')
  expect(fetcher).toHaveBeenCalledTimes(1)
  fetcher.mockRejectedValueOnce(new Error('Connection lost'))
  await expect(client.start(input)).rejects.toThrow('Connection lost')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('checks prepared contexts and log identity before exposing any saved data', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, id: 'b', filename: `hadron-job-${'a'.repeat(64)}.md`, markdown: 'Other job' })))
  vi.stubGlobal('fetch', fetcher)
  const client = createIndependentJobClient(async () => 'a'.repeat(64))
  await expect(client.journal('a')).rejects.toThrow('identity')
  await expect(client.prepare({ schemaVersion: 1, id: 'a', sourceConversationId: 'source', slot: 'a' })).rejects.toThrow('Unsupported')
  await expect(client.continuity('a')).rejects.toThrow('Unsupported')
  expect(fetcher).toHaveBeenCalledTimes(3)
})
it('rejects a cross-linked tree and validates the task/response topology without launching anything', async () => {
  const tree = { schemaVersion: 1, id: 'a', conversationId: 'chat-a', nodes: [
    { id: 'anchor-a', parentId: null, kind: 'task', status: 'saved', text: 'Task A', verified: false },
    { id: 'run-a', parentId: 'anchor-a', kind: 'response', status: 'completed', text: 'Answer A', verified: false },
  ] }
  const fetcher = vi.fn(async () => new Response(JSON.stringify(tree)))
  vi.stubGlobal('fetch', fetcher)
  const client = createIndependentJobClient(async () => 'a'.repeat(64))
  expect((await client.tree('a')).nodes[1].text).toBe('Answer A')
  tree.nodes[1].parentId = 'anchor-b'
  await expect(client.tree('a')).rejects.toThrow('Unsupported job tree')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('validates the full persisted branch forest and refuses cross-conversation parent links', async () => {
  const base = { provider: 'openaichatgpt', modelName: 'approved', status: 'completed', conversationId: 'chat-a' }
  const data = { schemaVersion: 1, sourceConversationId: 'source', slot: 'a', nodes: [
    { ...base, id: 'question', jobId: 'a', kind: 'task', parentId: null, text: 'Original question' },
    { ...base, id: 'answer', jobId: 'a', kind: 'response', parentId: 'question', text: 'Original answer' },
    { ...base, id: 'left', jobId: 'left', kind: 'task', parentId: 'answer', text: 'Left follow-up' },
    { ...base, id: 'right', jobId: 'right', kind: 'task', parentId: 'answer', text: 'Right follow-up' },
  ] }
  const fetcher = vi.fn(async () => new Response(JSON.stringify(data))); vi.stubGlobal('fetch', fetcher)
  const client = createIndependentJobClient(async () => 'a'.repeat(64))
  expect((await client.workspace('source', 'a')).nodes).toHaveLength(4)
  data.nodes[3].conversationId = 'other-agent'
  await expect(client.workspace('source', 'a')).rejects.toThrow('topology')
  expect(fetcher.mock.calls.every(call => (call as unknown as [string, RequestInit])[1].method === 'GET')).toBe(true)
})

it('accepts historical-only saved text while rejecting execution/private-navigation mixtures',async()=>{
 const entry={schemaVersion:1,requestedConversationId:'saved',workspaceConversationId:'saved',slot:null,nodeId:null,historicalOnly:true}
 const fetcher=vi.fn(async()=>new Response(JSON.stringify(entry)));vi.stubGlobal('fetch',fetcher)
 const client=createIndependentJobClient(async()=>'a'.repeat(64))
 expect(await client.openWorkspace('saved')).toEqual(entry)
 for(const change of [{historicalOnly:'true'},{sharedSessionId:'session'},{slot:'a',nodeId:'old-response',workspaceConversationId:'source'}]){
  fetcher.mockImplementationOnce(async()=>new Response(JSON.stringify({...entry,...change})))
  await expect(client.openWorkspace('saved')).rejects.toThrow('Unsupported')
 }
})

it('encodes history navigation and rejects malformed server cursors',async()=>{
  const reply={schemaVersion:1,sourceConversationId:'source',slot:'a',nodes:[],page:{size:32,nextCursor:'12:j'}}
  const fetcher=vi.fn(async()=>new Response(JSON.stringify(reply)));vi.stubGlobal('fetch',fetcher)
  const client=createIndependentJobClient(async()=>'a'.repeat(64))
  expect((await client.workspace('source','a',undefined,{cursor:'44:p',focusNodeId:'answer:id'})).page?.nextCursor).toBe('12:j')
  expect((fetcher.mock.calls[0] as unknown as [string])[0]).toContain('cursor=44%3Ap&focusNodeId=answer%3Aid')
  fetcher.mockImplementationOnce(async()=>new Response(JSON.stringify({...reply,page:{size:32,nextCursor:'../../other'}})))
  await expect(client.workspace('source','a')).rejects.toThrow('Unsupported history page')
})
