import {largeFixtureImage as fixtureImage} from '../../../../../../shared/__fixtures__/hadronImage.js'
import { expect, it, vi } from 'vitest'
import { proposalSqlite } from './fixtures/proposalSqlite.js'
import { createIndependentJobsSchema } from '../../persistence/independentJobsSchema.js'
import { IndependentJobsRepo } from '../../persistence/independentJobsRepo.js'
import { IndependentJobService } from '../collaboration/independentJobService.js'
import type { ProviderRouter } from '../providerRouter.js'
import { AgentJobJournal } from '../collaboration/agentJobJournal.js'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
function fixture(deadlineMs = 10000) {
  const pending: Array<{ input: any; finish: () => void }> = []
  const generate = vi.fn(async (_provider, input) => new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Stop', 'AbortError'))
    if (input.signal.aborted) return abort()
    input.signal.addEventListener('abort', abort, { once: true })
    pending.push({ input, finish: () => { input.signal.removeEventListener('abort', abort); resolve({ content: 'Independent output' }) } })
  }))
  const f = proposalSqlite({ generate } as unknown as ProviderRouter)
  f.db.exec('CREATE TABLE streaming_runs (stream_id TEXT PRIMARY KEY)')
  createIndependentJobsSchema(f.db)
  const jobs = new IndependentJobsRepo(f.db)
  const authorize = vi.fn((owner: string) => { if (owner !== 'owner') throw new Error('denied') })
  const deps = { jobs, agents: f.agents, runs: f.runs, allowedModels: new Set(['model']), deadlineMs, authorize }
  const service = new IndependentJobService(deps)
  const second = f.messages.createMessage({ conversationId: 'other', parentId: null, role: 'user', content: 'Other anchor' })
  const a = { schemaVersion: 1 as const, id: 'a', conversationId: 'c1', anchorMessageId: f.anchor.id, images:undefined as import('../../../../../../shared/hadronImages.js').HadronImage[]|undefined, task: 'Task A', context: 'File A', provider: 'openaichatgpt' as const, modelName: 'model' }
  const b = { ...a, images:undefined, id: 'b', conversationId: 'other', anchorMessageId: second.id, task: 'Task B', context: 'File B' }
  return { ...f, jobs, service, deps, generate, pending, authorize, a, b }
}
it('binds two isolated durable jobs, deduplicates and stops only the selected job', async () => {
  const f = fixture();f.a.images=[fixtureImage];const a = f.service.start('owner', f.a), b = f.service.start('owner', f.b)
  try {
    expect(f.service.start('owner', f.a)).toBe(a)
    await vi.waitFor(() => expect(f.pending).toHaveLength(2))
    const ra = f.jobs.get('a', 'owner')!, rb = f.jobs.get('b', 'owner')!
    expect(f.pending[0].input.images).toEqual([fixtureImage]);expect(f.pending[1].input.images).toBeUndefined()
    expect(ra.run_id).not.toBe(rb.run_id); expect(ra.stream_id).not.toBe(rb.stream_id)
    expect(f.jobs.ownsRunId(ra.run_id!)).toBe(true)
    const treeA = f.service.tree('owner', 'a')!, treeB = f.service.tree('owner', 'b')!
    expect(treeA.conversationId).not.toBe(treeB.conversationId)
    expect(treeA.nodes[0].text).toBe('Task A'); expect(treeB.nodes[0].text).toBe('Task B')
    expect(treeA.nodes[1]).toMatchObject({ id: ra.run_id, parentId: f.a.anchorMessageId, text: '' })
    expect(() => f.service.tree('intruder', 'a')).toThrow()
    expect(() => f.service.status('intruder', 'a')).toThrow()
    f.service.stop('owner', 'a'); await a
    expect(f.service.status('owner', 'a')?.status).toBe('cancelled')
    expect(f.service.status('owner', 'b')?.status).toBe('running')
    const second = f.pending.find(p => JSON.parse(p.input.userContent).task === 'Task B')!
    expect(second.input.signal.aborted).toBe(false)
    expect(second.input.userContent).not.toContain('File A')
    second.finish(); await b
    expect(f.service.status('owner', 'b')?.status).toBe('completed')
    expect(f.service.tree('owner', 'b')!.nodes[1]).toMatchObject({ text: 'Independent output', status: 'completed', verified: false })
    await f.service.start('owner', f.b)
    expect(f.generate).toHaveBeenCalledTimes(2)
    expect(f.generate.mock.calls.every(([, request]) => request.userId === 'owner' && request.requestPolicy === 'single_attempt')).toBe(true)
  } finally { f.service.stop('owner', 'a'); f.service.stop('owner', 'b'); await Promise.all([a,b]); f.close() }
})
it('fences immediate Stop before dispatch and expires one job without rerun', async () => {
  const f = fixture(30)
  try {
    const stopped = f.service.start('owner', f.a); f.service.stop('owner', 'a'); await stopped
    expect(f.generate).not.toHaveBeenCalled()
    await f.service.start('owner', f.b)
    expect(f.service.status('owner', 'b')?.status).toBe('failed')
    expect(f.runs.getRunById(f.jobs.get('b', 'owner')!.run_id!)?.status).toBe('aborted')
    expect(f.generate).toHaveBeenCalledTimes(1)
  } finally { f.close() }
})
it('rejects unapproved authority/models/owners and cannot adopt an interrupted job', async () => {
  const f = fixture()
  try {
    expect(() => f.service.start('owner', { ...f.a, fullAccess: true })).toThrow()
    expect(() => f.service.start('owner', { ...f.a, modelName: 'unapproved' })).toThrow()
    expect(() => f.service.start('intruder', f.a)).toThrow()
    const configJson = JSON.stringify({ ...f.a, deadlineMs: 10000 })
    const { proposalHash } = await import('../collaboration/proposalCheckpoints.js')
    f.jobs.create({ id: 'a', ownerId: 'owner', conversationId: f.a.conversationId, anchorMessageId: f.a.anchorMessageId, configJson, configHash: proposalHash(configJson) })
    f.jobs.claim('a','owner'); f.jobs.reconcileInterrupted()
    await f.service.start('owner', f.a)
    expect(f.service.status('owner','a')?.status).toBe('interrupted')
    expect(f.generate).not.toHaveBeenCalled()
  } finally { f.close() }
})
it('automatically records both isolated jobs and never reports agent assertions as executed tests', async () => {
  const f = fixture(), directory = mkdtempSync(path.join(os.tmpdir(), 'hadron-job-service-'))
  const service = new IndependentJobService({ ...f.deps, journal: new AgentJobJournal(directory), visibleProgress: () => ({ text: 'Claimed fix; claimed tests passed', truncated: false }) })
  const a = service.start('owner', f.a), b = service.start('owner', f.b)
  try {
    await vi.waitFor(() => expect(f.pending).toHaveLength(2))
    const log = service.journal('owner', 'a')!
    expect(log.markdown).toContain('Task A'); expect(log.markdown).not.toContain('Task B')
    expect(log.markdown).toContain('Claimed fix'); expect(log.markdown).toContain('Hadron has not edited project files or run tests')
    expect(() => service.journal('intruder', 'a')).toThrow()
    expect(() => service.continuity('owner', 'a')).toThrow('ended first')
    service.stop('owner', 'a'); f.pending[1].finish(); await Promise.all([a,b])
    expect(service.journal('owner', 'a')!.markdown).toContain('Status: cancelled')
    expect(service.journal('owner', 'b')!.markdown).toContain('Independent output')
    expect(service.continuity('owner', 'a')).toMatchObject({ sourceJobId: 'a', task: 'Task A' })
    expect(f.generate).toHaveBeenCalledTimes(2)
  } finally { service.stop('owner', 'a'); service.stop('owner', 'b'); await Promise.all([a,b]); f.close(); rmSync(directory, { recursive: true, force: true }) }
})
it('refuses dispatch when the initial automatic log cannot be saved', () => {
  const f = fixture(), directory = mkdtempSync(path.join(os.tmpdir(), 'hadron-job-storage-')), blocked = path.join(directory, 'not-a-directory')
  writeFileSync(blocked, 'fixture')
  try {
    const service = new IndependentJobService({ ...f.deps, journal: new AgentJobJournal(blocked) })
    expect(() => service.start('owner', f.a)).toThrow()
    expect(f.generate).not.toHaveBeenCalled()
    expect(service.status('owner', 'a')?.journalAvailable).toBe(false)
  } finally { f.close(); rmSync(directory, { recursive: true, force: true }) }
})

it('admits Claude separately and retains the provider on independent jobs',async()=>{
 const f=fixture()
 try{
  const input={...f.a,provider:'claudecode' as const}
  expect(()=>f.service.start('owner',input)).toThrow('Model not admitted')
  Object.assign(f.deps,{admitModel:(provider:string,model:string)=>provider==='claudecode'&&model==='model'})
  const result=f.service.start('owner',input)
  await vi.waitFor(()=>expect(f.pending).toHaveLength(1));f.pending[0].finish();await result
  expect(f.generate.mock.calls[0][0]).toBe('claudecode')
  expect(f.service.status('owner','a')).toMatchObject({provider:'claudecode',status:'completed'})
 }finally{f.close()}
})
