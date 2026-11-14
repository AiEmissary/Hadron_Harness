import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createDesktopCollaborationHost } from '../headlessServer/services/collaboration/desktopHost.js'
import { createDesktopCollaborationAccess } from '../headlessServer/services/collaboration/desktopAccess.js'

// Execute actual guard/registration source without loading Electron's full app.
const source = readFileSync(new URL('../../electron/main.ts', import.meta.url), 'utf8')
const start = source.indexOf('function authHandle(')
const end = source.indexOf("authHandle('auth:start'", start)
if (start < 0 || end < 0) throw new Error('Main-frame bridge boundaries changed')
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function bridge(enabled: boolean, runtime?: any) {
  const handlers = new Map<string, (...args: any[]) => any>()
  const frame = {}
  const contents = { mainFrame: frame }
  const host = createDesktopCollaborationHost(() => enabled)
  const projectCalls:any[]=[]
  const projectService={start:(owner:string,grant:string,input:any)=>{projectCalls.push({owner,grant,input});return {canApply:false}},
    status:()=>({canApply:false}),availability:()=>({available:true,ready:true}),list:()=>[],apply:(owner:string,id:string)=>{projectCalls.push({owner,id,action:'apply'});return {canApply:false}}}
  runInNewContext(code, { ipcMain: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) },
    mainWindow: { webContents: contents }, publicAuthState: () => ({ user: { id: 'local-owner' }, codex: { sessionId: 'fake-codex-session' } }),
    getAuthManager: () => ({ generation: () => 1 }), getClaudeRuntime: () => runtime, hadronChatgpt: undefined, hadronCodex: undefined,
    getHadronCodexRuntime: () => ({ status: () => ({ connected: false }), startSignIn: () => {}, cancelSignIn: async () => {}, openSignInPage: async () => {}, disconnect: async () => {} }),
    getHadronChatgptConnection: () => ({ status: () => ({ connected: false }), startSignIn: () => {}, cancelSignIn: () => {}, disconnect: () => {} }), process: { pid: 123 },
    HadronChatgptProbe: class { models() { return [] } run() { return {} } },
    desktopProjectDraftHost:{enable:()=>{},get:()=>projectService,availability:()=>projectService.availability()},
    projectApplicationAuthority:{install:()=>{},installAutomation:()=>{}},projectCheckHost:{install:()=>{}},desktopContinuousHost:{get:()=>({})},
    HADRON_LIVE_COLLABORATION_ENABLED: enabled, createDesktopCollaborationAccess, desktopCollaborationHost: host })
  return { host, call: (name: string, event = { sender: contents, senderFrame: frame },...args:any[]) => handlers.get(name)!(event,...args), contents,projectCalls,hasChannel:(name:string)=>handlers.has(name) }
}
describe('trusted main-frame collaboration bridge', () => {
  it('reports preview availability but refuses live capability while disabled', () => {
    const b = bridge(false)
    expect(b.call('collaboration:availability')).toEqual({ liveEnabled: false, previewEnabled: true })
    expect(() => b.call('collaboration:capability')).toThrow('disabled')
  })
  it('rejects other windows and subframes before capability issuance', () => {
    const b = bridge(true) // fixture only: the production constant remains false
    expect(() => b.call('collaboration:capability', { sender: b.contents, senderFrame: {} })).toThrow('Untrusted')
    expect(() => b.call('collaboration:availability', { sender: { mainFrame: {} }, senderFrame: {} })).toThrow('Untrusted')
    expect(b.call('collaboration:capability')).toMatch(/^[a-f0-9]{64}$/)
    for (const name of ['status', 'sign-in', 'cancel-sign-in', 'disconnect', 'test-models', 'test']) {
      expect(() => b.call(`collaboration:chatgpt-${name}`, { sender: b.contents, senderFrame: {} })).toThrow('Untrusted')
    }
    for (const name of ['status', 'sign-in', 'cancel-sign-in', 'open-sign-in', 'disconnect', 'test']) {
      expect(() => b.call(`collaboration:codex-${name}`, { sender: b.contents, senderFrame: {} })).toThrow('Untrusted')
    }
  })
})
it('protects every project IPC action including apply and commands from subframes; never exposes recovery unlock',()=>{
 const b=bridge(true)
 for(const name of ['availability','choose','sources','clear-sources','start','status','check','list','stop','close','journal','inspect','apply','checks','build','repair','automate']){
  expect(()=>b.call('project-draft:'+name,{sender:b.contents,senderFrame:{}})).toThrow('Untrusted')
 }
 expect(b.projectCalls).toHaveLength(0)
 expect(b.hasChannel('project-draft:apply')).toBe(true)
 expect(b.hasChannel('project-draft:reconcile')).toBe(false)
 b.call('project-draft:start',undefined,'native-grant',{ownerId:'forged',workspaceId:'owned'})
 expect(b.projectCalls[0]).toMatchObject({owner:'local-owner',grant:'native-grant'})
 b.call('project-draft:apply',undefined,'proposal')
 expect(b.projectCalls[1]).toMatchObject({owner:'local-owner',id:'proposal',action:'apply'})
})
it('protects all automatic conversation controls from subframes before scheduling or reading',()=>{
 const b=bridge(true)
 for(const action of ['start','continue','claude-models','status','check','list','pause','stop','resume','inject'])expect(()=>b.call('continuous:'+action,{sender:b.contents,senderFrame:{}})).toThrow('Untrusted')
})

it('Claude account actions require the main frame and invalidate older collaboration grants', async () => {
  let started = 0, cancelled = 0
  const runtime = { generation: 0, status: async () => ({ installed: true, connected: false, reason: 'signed_out' }),
    startSignIn() { started++; this.generation++ }, cancelSignIn() { cancelled++; this.generation++ } }
  const b = bridge(true, runtime)
  const request = (token: string) => ({ socket: { remoteAddress: '127.0.0.1' }, get: () => `Bearer ${token}` }) as any
  const token = b.call('collaboration:capability')
  expect(b.host.authenticatedOwner(request(token))).toBe('local-owner')
  for (const channel of ['collaboration:claude-status', 'collaboration:claude-sign-in', 'collaboration:claude-cancel-sign-in']) {
    expect(() => b.call(channel, { sender: b.contents, senderFrame: {} })).toThrow('Untrusted')
  }
  expect(started).toBe(0)
  expect(await b.call('collaboration:claude-status')).toMatchObject({ reason: 'signed_out' })
  b.call('collaboration:claude-sign-in')
  expect(started).toBe(1); expect(b.host.authenticatedOwner(request(token))).toBeNull()
  const next = b.call('collaboration:capability')
  b.call('collaboration:claude-cancel-sign-in')
  expect(cancelled).toBe(1); expect(b.host.authenticatedOwner(request(next))).toBeNull()
})


it('the backend consumes the same desktop grant and never trusts request identity', () => {
  const b = bridge(true)
  const request = (token: string, address = '127.0.0.1') => ({ socket: { remoteAddress: address },
    get: () => `Bearer ${token}`, body: { ownerId: 'forged-owner' } }) as any
  expect(b.host.authenticatedOwner(request('a'.repeat(64)))).toBeNull()
  const token = b.call('collaboration:capability')
  expect(b.host.authenticatedOwner(request(token))).toBe('local-owner')
  expect(b.host.authenticatedOwner(request(token, '192.0.2.1'))).toBeNull()
  expect(bridge(false).host.authenticatedOwner(request(token))).toBeNull()
})


it('provides setup metadata without a grant, credentials or approved models while disabled', async () => {
  const b = bridge(false)
  expect(await b.call('collaboration:setup')).toEqual({ schemaVersion: 1, liveEnabled: false, ownerAvailable: true,
    provider: { id: 'openaichatgpt', connected: false, models: [] } })
  expect(() => b.call('collaboration:setup', { sender: b.contents, senderFrame: {} })).toThrow('Untrusted')
  expect(() => b.call('collaboration:capability')).toThrow('disabled')
})
