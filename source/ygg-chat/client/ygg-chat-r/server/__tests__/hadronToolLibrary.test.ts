import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { HadronToolLibrary, validateToolDefinition } from '../hadronTools/toolLibrary.js'
import { createHadronToolSession, readHadronToolActivity } from '../hadronTools/toolSession.js'

const definition = { name: 'page_summary', description: 'Read page title', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } }
const code = `function* run(args){const page=yield {tool:'web_read',arguments:{url:args.url}};return {title:page.title,url:page.url};}`
const signal = () => new AbortController().signal
const read = async (url: unknown) => ({ url: String(url), contentType: 'text/html', body: '<title>Fixture</title><main>Page text</main>' })
let root: string, library: HadronToolLibrary
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'hadron-tool-library-')); library = new HadronToolLibrary(root) })
afterEach(() => {
  if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('hadron-tool-library-')) throw new Error('Refusing to remove an unexpected test directory')
  fs.rmSync(root, { recursive: true, force: true })
})

describe('Versioned Hadron JavaScript library', () => {
  it('creates disabled immutable versions, separates owners and pins user enablement to one hash', () => {
    const first = library.create('owner', 'job-a', definition, code)
    expect(first.enabled).toBe(false)
    expect(library.list('other')).toEqual([])
    library.enable('owner', definition.name, first.hash)
    expect(library.read('owner', definition.name, first.hash).enabled).toBe(true)
    const second = library.create('owner', 'job-b', definition, code + '\n//new version')
    expect(second.enabled).toBe(false)
    expect(library.read('owner', definition.name, first.hash).enabled).toBe(true)
    library.enable('owner', definition.name, second.hash)
    expect(library.read('owner', definition.name, first.hash).enabled).toBe(false)
  })
  it('runs real QuickJS generator tools using only the explicit web bridge', async () => {
    const tool = library.create('owner', 'job', definition, code)
    const calls: string[] = []
    const result = await library.execute('owner', definition.name, tool.hash, { url: 'https://example.com' }, signal(), async name => { calls.push(name); return { title: 'Evidence', url: 'https://example.com' } })
    expect(result).toEqual({ title: 'Evidence', url: 'https://example.com' })
    expect(calls).toEqual(['web_read'])
  })
  it('provides no Node, filesystem, networking or parent-process objects in JavaScript', async () => {
    const tool = library.create('owner', 'job', definition, `function* run(){return [typeof require,typeof process,typeof fetch,typeof window,typeof Deno,typeof Buffer];}`)
    expect(await library.execute('owner', definition.name, tool.hash, { url: 'unused' }, signal(), async () => { throw Error('unexpected') })).toEqual(Array(6).fill('undefined'))
  })
  it('interrupts infinite loops instead of blocking the host indefinitely', async () => {
    const tool = library.create('owner', 'job', definition, 'function* run(){while(true){};return null;}')
    await expect(library.execute('owner', definition.name, tool.hash, { url: 'unused' }, signal(), async () => null)).rejects.toThrow()
  })
  it('denies schema mismatches, forbidden yields and source tampering', async () => {
    const tool = library.create('owner', 'job', definition, `function* run(){yield {tool:'bash',arguments:{command:'anything'}};}`)
    await expect(library.execute('owner', definition.name, tool.hash, {}, signal(), async () => null)).rejects.toThrow('schema')
    await expect(library.execute('owner', definition.name, tool.hash, { url: 'unused' }, signal(), async () => null)).rejects.toThrow('granted web')
    const source = fs.readdirSync(path.join(root, 'library'))[0]
    fs.appendFileSync(path.join(root, 'library', source, definition.name, tool.hash, 'index.js'), '\n//modified')
    expect(() => library.enable('owner', definition.name, tool.hash)).toThrow('changed')
  })
  it('rejects dangerous or unbounded schema features and directory traversal', () => {
    for (const key of ['$ref', 'pattern', 'format', '$async']) expect(() => validateToolDefinition({ ...definition, inputSchema: { type: 'object', [key]: 'x' } })).toThrow()
    expect(() => library.create('owner', 'job', { ...definition, name: '../graviton' }, code)).toThrow()
    expect(() => library.create('owner', 'job', { ...definition, name: 'web_read' }, code)).toThrow()
    expect(() => library.source('owner', 'page_summary', '../graviton')).toThrow()
  })
  it('rejects a junction/symlink to an external library directory', () => {
    library.create('owner', 'job', definition, code)
    const ownerDir = fs.readdirSync(path.join(root, 'library'))[0], outside = path.join(root, 'outside')
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(root, 'library', ownerDir, 'outside_tool'), process.platform === 'win32' ? 'junction' : 'dir')
    expect(() => library.create('owner', 'job', { ...definition, name: 'outside_tool' }, code)).toThrow('links')
  })
})

describe('Agent-owned tool sessions', () => {
  it('keeps navigation independent between A and B and forbids authoring in web-only mode', async () => {
    const a = createHadronToolSession({ root, owner: 'owner', job: 'a', mode: 'web', read })
    const b = createHadronToolSession({ root, owner: 'owner', job: 'b', mode: 'web', read })
    await a.invoke('web_navigate', { url: 'https://example.com/a' }, signal())
    await a.invoke('web_navigate', { url: 'https://example.com/b' }, signal())
    expect(await a.invoke('web_back', {}, signal())).toMatchObject({ url: 'https://example.com/a' })
    await expect(b.invoke('web_back', {}, signal())).rejects.toThrow()
    await expect(a.invoke('tool_create', { definition, code }, signal())).rejects.toThrow('not granted')
  })
  it('lets a developer create/test a disabled tool, but only the user can enable it for another job', async () => {
    const a = createHadronToolSession({ root, owner: 'owner', job: 'a', mode: 'build', read })
    const created: any = await a.invoke('tool_create', { definition, code }, signal())
    expect(created).toMatchObject({ enabled: false, sourceSaved: true })
    expect(await a.invoke('tool_test', { name: definition.name, hash: created.hash, arguments: { url: 'https://example.com' } }, signal())).toMatchObject({ title: 'Fixture' })
    const b = createHadronToolSession({ root, owner: 'owner', job: 'b', mode: 'build', read })
    await expect(b.invoke('tool_test', { name: definition.name, hash: created.hash, arguments: { url: 'https://example.com' } }, signal())).rejects.toThrow()
    await expect(a.invoke('tool_enable', { name: definition.name, hash: created.hash }, signal())).rejects.toThrow()
    library.enable('owner', definition.name, created.hash)
    const c = createHadronToolSession({ root, owner: 'owner', job: 'c', mode: 'web', read })
    expect(await c.invoke(definition.name, { url: 'https://example.com' }, signal())).toMatchObject({ title: 'Fixture' })
    library.enable('owner', definition.name, null)
    await expect(c.invoke(definition.name, { url: 'https://example.com' }, signal())).rejects.toThrow()
  })
  it('records operation status without dumping code, queries or evidence into the activity log', async () => {
    const a = createHadronToolSession({ root, owner: 'owner', job: 'a', mode: 'web', read })
    await a.invoke('web_read', { url: 'https://example.com/private-query-marker' }, signal())
    const log = fs.readFileSync(path.join(root, 'job-logs', fs.readdirSync(path.join(root, 'job-logs'))[0]), 'utf8')
    expect(log).toContain('completed'); expect(log).not.toContain('private-query-marker'); expect(log).not.toContain('Page text')
    const controller = new AbortController(); controller.abort()
    await expect(a.invoke('web_read', { url: 'https://example.com' }, controller.signal)).rejects.toThrow()
  })
})

it('counts actual verification attempts, including unavailable checks but excluding discovery',async()=>{
 let attempts=0;const session=createHadronToolSession({root,owner:'o',job:'verify',mode:'web',verification:true,onCheckAttempt:()=>attempts++,read:async()=>{throw Error('offline')}})
 await session.invoke('tool_list',{},signal());expect(session.evidenceAttempted!()).toBe(false)
 await expect(session.invoke('web_read',{url:'https://example.com'},signal())).rejects.toThrow('offline')
 expect(session.evidenceAttempted!()).toBe(true);expect(attempts).toBe(1)
})

it('does not promote an unavailable search response into successful evidence',async()=>{
 const receipts:unknown[]=[]
 const session=createHadronToolSession({root,owner:'o',job:'search-unavailable',mode:'web',verification:true,onEvidence:(_tool,result)=>receipts.push(result),search:async()=>({success:false,error:'fixture unavailable'})})
 expect(await session.invoke('web_search',{query:'public fixture'},signal())).toEqual({success:false,error:'Hadron web search is unavailable. Check its API key and connection.'})
 expect(receipts).toEqual([]);expect(session.evidenceAttempted!()).toBe(true)
 expect(readHadronToolActivity(root,'o','search-unavailable').at(-1)?.state).toBe('failed')
})
