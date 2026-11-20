import { afterEach, expect, it } from 'vitest'
import { proposalSqlite } from '../../services/__tests__/fixtures/proposalSqlite.js'
import { createIndependentJobsSchema } from '../independentJobsSchema.js'
import { IndependentJobsRepo } from '../independentJobsRepo.js'
import type { ProviderRouter } from '../../services/providerRouter.js'
const stores: ReturnType<typeof proposalSqlite>[] = []
afterEach(() => { for (const f of stores.splice(0)) f.close() })
function fixture() {
  const f = proposalSqlite({ generate: async () => { throw new Error('No inference in repository test') } } as unknown as ProviderRouter)
  stores.push(f)
  f.db.exec('PRAGMA foreign_keys=ON; CREATE TABLE streaming_runs (stream_id TEXT PRIMARY KEY);')
  createIndependentJobsSchema(f.db); createIndependentJobsSchema(f.db)
  const repo = new IndependentJobsRepo(f.db)
  const input = { id: 'job-a', ownerId: 'owner', conversationId: 'c1', anchorMessageId: f.anchor.id, configJson: '{"task":"private A"}', configHash: 'hash-a' }
  const run = f.runs.createRun({ conversationId: 'c1', parentMessageId: f.anchor.id, prompt: 'private A' })
  const child = { runId: run.id, handle: run.handle!, streamId: 'stream-a' }
  f.db.prepare('INSERT INTO streaming_runs VALUES (?)').run(child.streamId)
  return { ...f, repo, input, child }
}
it('reserves exact owner/config identities and claims a job once', () => {
  const { repo, input } = fixture()
  expect(repo.create(input).status).toBe('created')
  expect(repo.create(input).id).toBe('job-a')
  expect(() => repo.create({ ...input, ownerId: 'intruder' })).toThrow('owner')
  expect(() => repo.create({ ...input, configJson: '{"task":"changed"}' })).toThrow('conflict')
  expect(repo.claim('job-a', 'owner')).toBe(true)
  expect(repo.claim('job-a', 'owner')).toBe(false)
  expect(() => repo.get('job-a', 'intruder')).toThrow('owner')
})
it('binds only the owned source and keeps Stop/recovery independent per job', () => {
  const { repo, input, child } = fixture()
  repo.create(input); repo.create({ ...input, id: 'job-b', configHash: 'hash-b' })
  repo.claim('job-a', 'owner'); repo.claim('job-b', 'owner')
  expect(() => repo.bind('job-a', 'owner', { ...child, runId: 'missing' })).toThrow('ownership')
  repo.bind('job-a', 'owner', child); repo.bind('job-a', 'owner', child)
  expect(repo.ownsRunId(child.runId)).toBe(true); expect(repo.ownsStreamId(child.streamId)).toBe(true)
  expect(() => repo.bind('job-a', 'owner', { ...child, streamId: 'other' })).toThrow('conflict')
  repo.stop('job-a', 'owner')
  expect(repo.get('job-b', 'owner')?.status).toBe('running')
  expect(() => repo.finish('job-a', 'owner', 'completed')).toThrow('Stopped')
  repo.finish('job-a', 'owner', 'cancelled')
  expect(repo.reconcileInterrupted()).toBe(1)
  expect(repo.get('job-a', 'owner')?.status).toBe('cancelled')
  expect(repo.get('job-b', 'owner')?.status).toBe('interrupted')
  expect(repo.reconcileInterrupted()).toBe(0)
})
it('fences parent deletion while active and cleans only its owned records after termination', () => {
  const { db, repo, input, child, runs, anchor } = fixture()
  const ordinary = runs.createRun({ conversationId: 'c1', parentMessageId: anchor.id, prompt: 'ordinary' })
  repo.create(input); repo.claim(input.id, 'owner'); repo.bind(input.id, 'owner', child)
  runs.appendMessage(child.runId, { role: 'assistant', content: 'Private output' })
  expect(() => db.prepare('DELETE FROM messages WHERE id=?').run(anchor.id)).toThrow('Stop independent job')
  expect(repo.get(input.id, 'owner')?.status).toBe('running')
  repo.stop(input.id, 'owner'); repo.finish(input.id, 'owner', 'cancelled')
  db.prepare('DELETE FROM hadron_independent_jobs WHERE id=?').run(input.id)
  expect(runs.getRunById(child.runId)).toBeNull()
  expect(db.prepare('SELECT * FROM subagent_messages WHERE run_id=?').all(child.runId)).toEqual([])
  expect(db.prepare('SELECT * FROM streaming_runs WHERE stream_id=?').get(child.streamId)).toBeUndefined()
  expect(runs.getRunById(ordinary.id)).toBeTruthy()
})


it('atomically caps active jobs at two per owner, including jobs still draining after Stop', () => {
  const { repo, input } = fixture()
  for (const id of ['a','b','c']) repo.create({ ...input, id })
  expect(repo.claim('a','owner')).toBe(true)
  expect(repo.claim('b','owner')).toBe(true)
  expect(repo.claim('c','owner')).toBe(false)
  repo.stop('a','owner')
  expect(repo.claim('c','owner')).toBe(false)
  repo.finish('a','owner','cancelled')
  expect(repo.claim('c','owner')).toBe(true)
})
import {largeFixtureImage} from '../../../../../../shared/__fixtures__/hadronImage.js'
it('stores JPEG bytes outside the legacy 64 KiB envelope, retains exact replay identity, and cleans them up with the job',()=>{
 const f=fixture(),configJson=JSON.stringify({task:'Inspect the attached picture',images:[largeFixtureImage]}),input={...f.input,configJson}
 expect(configJson.length).toBeGreaterThan(65536)
 expect(f.repo.create(input).config_json).toBe(configJson);expect(f.repo.create(input).config_json).toBe(configJson)
 expect(f.db.prepare('SELECT length(config_json) AS size FROM hadron_independent_jobs WHERE id=?').get(input.id).size).toBeLessThan(65536)
 expect(f.db.prepare("SELECT sum(length(payload)) AS size FROM hadron_saved_job_media WHERE kind='image'").get().size).toBeGreaterThan(65536)
 expect(()=>f.repo.get(input.id,'intruder')).toThrow()
 f.repo.claim(input.id,'owner');f.repo.finish(input.id,'owner','cancelled');f.db.prepare('DELETE FROM hadron_independent_jobs WHERE id=?').run(input.id)
 expect(f.db.prepare('SELECT count(*) AS n FROM hadron_saved_job_media').get().n).toBe(0)
})
it('fences an absent admission atomically and refuses to close an existing job',()=>{
 const f=fixture()
 expect(f.repo.closeUnstarted('missing','owner','c1')).toBe(true)
 expect(f.repo.closeUnstarted('missing','owner','c1')).toBe(true)
 expect(()=>f.repo.create({...f.input,id:'missing'})).toThrow('closed')
 f.repo.create(f.input);expect(f.repo.closeUnstarted(f.input.id,'owner','c1')).toBe(false)
 expect(()=>f.repo.closeUnstarted('missing','intruder','c1')).toThrow()
})
