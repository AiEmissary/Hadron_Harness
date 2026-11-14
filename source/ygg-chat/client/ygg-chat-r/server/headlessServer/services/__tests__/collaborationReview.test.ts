import { expect, it, vi } from 'vitest'
import type { ProviderRouter } from '../providerRouter.js'
import { proposalSqlite } from './fixtures/proposalSqlite.js'
import { createCollaborationSchema, createCollaborationDeletionGuards } from '../../persistence/collaborationSchema.js'
import { CollaborationRepo } from '../../persistence/collaborationRepo.js'
import { ProposalSessionService } from '../collaboration/proposalSessionService.js'
import { createHadronToolSession } from '../../../hadronTools/toolSession.js'
import { isHadronToolSession } from '../../../hadronTools/types.js'
import { AgentJobJournal } from '../collaboration/agentJobJournal.js'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function fixture(verify = false) {
  const pending: Array<(text: string) => void> = [], failures:Array<(error:Error)=>void>=[], packets: any[] = []
  const generate = vi.fn(async (_provider: string, request: any) => new Promise((resolve, reject) => {
    packets.push(request)
    const abort = () => reject(new DOMException('Stopped', 'AbortError'))
    if (request.signal.aborted) return abort()
    request.signal.addEventListener('abort', abort, { once: true })
    pending.push(text => { request.signal.removeEventListener('abort', abort); resolve({ content: text }) });failures.push(error=>{request.signal.removeEventListener('abort',abort);reject(error)})
  }))
  const f = proposalSqlite({ generate } as unknown as ProviderRouter)
  f.db.exec('CREATE TABLE streaming_runs(stream_id TEXT PRIMARY KEY)')
  createCollaborationSchema(f.db); createCollaborationDeletionGuards(f.db)
  f.db.exec('PRAGMA foreign_keys = ON')
  const sessions = new CollaborationRepo({ db: f.db })
  const directory = mkdtempSync(path.join(os.tmpdir(), 'hadron-review-test-'))
  const authorize = vi.fn((owner: string) => { if (owner !== 'owner') throw new Error('Access denied') })
  const deps = { ...f, sessions, allowedModels: new Set(['a-model', 'b-model']), authorize,
    authorizeConversation: authorize,
    ...(verify ? { verificationSession: (owner: string, input: any, onEvidence: (tool: string, result: unknown) => void, authorize: () => void, onCheckAttempt: () => void) => createHadronToolSession({ root: directory, owner, job: input.sessionId + ':verification', mode: 'web', verification: true, onEvidence, authorize, onCheckAttempt,
      read: async (url, signal) => { signal.throwIfAborted(); return {url, body: '<title>Official evidence</title><p>The value is 42.</p>', contentType: 'text/html'} } }) } : {}),
    journal: new AgentJobJournal(directory) }
  const service = new ProposalSessionService(deps)
  const input = { schemaVersion: 1 as const, workflow: verify ? 'review_verify_and_synthesis' as const : 'review_and_synthesis' as const, sessionId: 'full',
    conversationId: 'c1', sourceLineageId: f.source.id, anchorMessageId: f.anchor.id,
    task: 'Choose a plan', context: 'Only supplied evidence', participants: [
      { id: 'a', provider: 'openaichatgpt' as const, modelName: 'a-model' },
      { id: 'b', provider: 'openaichatgpt' as const, modelName: 'b-model' },
    ] }
  return { ...f, deps, service, sessions, input, pending, packets, generate, failures,
    cleanup: () => { f.close(); if (path.dirname(path.resolve(directory)).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() || !path.basename(directory).startsWith('hadron-review-test-')) throw Error('Unsafe cleanup path'); rmSync(directory, { recursive: true, force: true }) } }
}
const observe = <T>(promise: Promise<T>) => promise.then(value => ({ value, error: null }), error => ({ value: null, error }))
const count = async (f: ReturnType<typeof fixture>, n: number) => vi.waitFor(() => expect(f.pending).toHaveLength(n))

it('executes independent proposals, both canonical cross-reviews and one final using A, with durable logs and no replay', async () => {
  const f = fixture(), result = observe(f.service.start('owner', f.input))
  try {
    await count(f, 2)
    expect(f.service.start('owner', f.input)).toBeInstanceOf(Promise)
    f.pending[0]('Plan A'); await new Promise(resolve => setTimeout(resolve, 10))
    expect(f.pending).toHaveLength(2)
    f.pending[1]('Plan B'); await count(f, 4)
    const rows = f.sessions.workflowRuns('full', 'owner')
    for (const stage of rows.filter(row => row.stage_id !== 'final')) {
      expect(f.sessions.ownsRunId(stage.run_id!)).toBe(true)
      expect(f.sessions.ownsStreamId(stage.stream_id!)).toBe(true)
      expect(f.service.ownsStream('owner', 'full', stage.stream_id!)).toBe(true)
      const run = f.runs.getRunById(stage.run_id!)!, packet = JSON.parse(run.prompt)
      expect(packet.recipientId).toBe(stage.participant_id)
      expect(packet.proposals.map((proposal: any) => proposal.text)).toEqual(['Plan A', 'Plan B'])
      expect(run.system_prompt).toContain('one bounded cross-review')
      expect(run.tool_calls_used).toBe(0)
    }
    expect(f.service.status('owner', 'full')).toMatchObject({ status: 'running', collaboration: { phase: 'reviews', maxRequests: 5 } })
    // Direct source deletion is always fenced, even after the initial session completes.
    expect(() => f.db.prepare('DELETE FROM hadron_sessions WHERE id = ?').run('full')).toThrow('Stop collaboration')
    expect(() => f.db.prepare('DELETE FROM conversations WHERE id = ?').run('c1')).toThrow('Stop collaboration')
    f.pending[2]('A review: accept B with uncertainty'); await new Promise(resolve => setTimeout(resolve, 10))
    expect(f.pending).toHaveLength(4)
    f.pending[3]('B review: retain dissent'); await count(f, 5)
    const final = f.sessions.workflowRuns('full', 'owner').find(stage => stage.stage_id === 'final')!
    const run = f.runs.getRunById(final.run_id!)!, packet = JSON.parse(run.prompt)
    expect(run.model_name).toBe('a-model')
    expect(packet.reviews.map((review: any) => review.text)).toEqual(['A review: accept B with uncertainty', 'B review: retain dissent'])
    expect(run.system_prompt).toContain('Do not claim unanimous consensus where there is dissent')
    f.pending[4]('Combined plan. Remaining disagreements: deadline uncertain.')
    expect((await result).error).toBeNull()
    const status = f.service.status('owner', 'full')!
    expect(status.status).toBe('completed')
    expect(status.collaboration!.stages.find(stage => stage.id === 'final')).toMatchObject({ status: 'completed', text: 'Combined plan. Remaining disagreements: deadline uncertain.', verified: false })
    for (const id of ['a', 'b', 'review_a', 'review_b', 'final']) expect(f.service.journal('owner', 'full', id)!.markdown).toContain('Status: completed')
    expect(() => f.service.status('intruder', 'full')).toThrow()
    expect(() => f.service.journal('intruder', 'full', 'final')).toThrow()
    await f.service.start('owner', f.input)
    const reopened = new ProposalSessionService(f.deps)
    await reopened.start('owner', f.input)
    expect(f.generate).toHaveBeenCalledTimes(5)
    expect(reopened.status('owner', 'full')!.collaboration!.stages).toEqual(status.collaboration!.stages)
    f.db.prepare('DELETE FROM hadron_sessions WHERE id = ?').run('full')
    expect(f.db.prepare('SELECT count(*) n FROM subagent_runs').get().n).toBe(0)
  } finally { f.service.stop('owner', 'full'); await result; f.cleanup() }
})

it.each(['reviews', 'synthesis'] as const)('Stop during %s drains owned work and never publishes a final answer', async phase => {
  const f = fixture(), result = observe(f.service.start('owner', f.input))
  try {
    await count(f, 2); f.pending[0]('A'); f.pending[1]('B'); await count(f, 4)
    if (phase === 'synthesis') { f.pending[2]('Review A'); f.pending[3]('Review B'); await count(f, 5) }
    f.service.stop('owner', 'full')
    expect((await result).error).toBeTruthy()
    expect(f.service.status('owner', 'full')).toMatchObject({ status: 'cancelled', collaboration: { phase } })
    const calls = f.pending.length
    expect(() => f.service.start('owner', f.input)).toThrow('already claimed')
    expect(f.pending).toHaveLength(calls)
    expect(f.sessions.workflowRuns('full', 'owner').filter(row => row.run_id).every(row => ['completed', 'aborted', 'error'].includes(f.runs.getRunById(row.run_id!)!.status))).toBe(true)
  } finally { f.service.stop('owner', 'full'); await result; f.cleanup() }
})

it('preserves proposals on review failure, does not synthesize or retry, and startup interrupts without replay', async () => {
  const f = fixture(), result = observe(f.service.start('owner', f.input))
  try {
    await count(f, 2); f.pending[0]('A'); f.pending[1]('B'); await count(f, 4)
    f.pending[2]('x'.repeat(8001)); f.pending[3]('B review')
    expect((await result).error).toBeTruthy()
    expect(f.service.status('owner', 'full')!.status).toBe('failed')
    expect(f.service.status('owner', 'full')!.artifacts).toHaveLength(2)
    expect(f.generate).toHaveBeenCalledTimes(4)
    f.db.prepare("UPDATE hadron_workflows SET status = 'running' WHERE session_id = ?").run('full')
    f.sessions.reconcileInterrupted()
    const reopened = new ProposalSessionService(f.deps)
    expect(reopened.status('owner', 'full')!.status).toBe('interrupted')
    expect(() => reopened.start('owner', f.input)).toThrow('already claimed')
    expect(f.generate).toHaveBeenCalledTimes(4)
  } finally { f.service.stop('owner', 'full'); await result; f.cleanup() }
})

it('expires during cross-review, drains the pair and retains the initial proposals', async () => {
  const f = fixture(), service = new ProposalSessionService({ ...f.deps, deadlineMs: 500 })
  const result = observe(service.start('owner', f.input))
  try {
    await count(f, 2); f.pending[0]('A'); f.pending[1]('B'); await count(f, 4)
    expect((await result).error).toBeTruthy()
    expect(service.status('owner', 'full')).toMatchObject({ status: 'failed', error: 'Collaboration deadline exceeded', artifacts: [expect.anything(), expect.anything()] })
    expect(f.generate).toHaveBeenCalledTimes(4)
    expect(f.sessions.workflowRuns('full', 'owner').filter(row => row.run_id).every(row => f.runs.getRunById(row.run_id!)!.status === 'aborted')).toBe(true)
  } finally { service.stop('owner', 'full'); await result; f.cleanup() }
})

it('does not begin synthesis after access is revoked between reviews and publication', async () => {
  const f = fixture(), result = observe(f.service.start('owner', f.input))
  try {
    await count(f, 2); f.pending[0]('A'); f.pending[1]('B'); await count(f, 4)
    f.deps.authorize.mockImplementation(() => { throw new Error('Revoked') })
    f.pending[2]('Review A'); f.pending[3]('Review B')
    expect((await result).error).toBeTruthy()
    expect(f.sessions.workflow('full', 'owner')!.status).toBe('failed')
    expect(f.generate).toHaveBeenCalledTimes(4)
    expect(() => f.service.status('owner', 'full')).toThrow('Access denied')
  } finally { await result; f.cleanup() }
})

it('verifies only after both reviews, persists actual host receipts independently of model claims, and never replays', async () => {
  const f = fixture(true), result = observe(f.service.start('owner', f.input))
  try {
    await count(f, 2); f.pending[0]('A says 41'); f.pending[1]('B says 42'); await count(f, 4)
    f.pending[2]('Check the value'); await new Promise(resolve => setTimeout(resolve, 10)); expect(f.pending).toHaveLength(4)
    f.pending[3]('Consult the public source'); await count(f, 5)
    expect(f.service.status('owner', 'full')).toMatchObject({ collaboration: { phase: 'verification', maxRequests: 13, evidence: { receipts: [] } } })
    expect(f.packets.slice(0, 4).every(packet => !packet.hadronToolSession)).toBe(true)
    const capability = f.packets[4].hadronToolSession
    expect(isHadronToolSession(capability)).toBe(true)
    await expect(capability.invoke('tool_create', {}, new AbortController().signal)).rejects.toThrow()
    await capability.invoke('web_read', {url:'https://example.com/proof'}, new AbortController().signal)
    const saved = f.sessions.verificationEvidence('full', 'owner')!
    expect(saved.receipts).toHaveLength(1); expect(saved.receipts[0].result).toContain('The value is 42')
    f.pending[4]('42 supported by the source; other claims not checked.'); await count(f, 6)
    const final = JSON.parse(f.packets[5].userContent)
    expect(final.verification.text).toContain('42 supported'); expect(final.hostEvidence).toEqual(saved)
    expect(f.packets[5].hadronToolSession).toBeUndefined()
    f.pending[5]('Use 42. Confidence moderate; other claims unverified.')
    expect((await result).error).toBeNull()
    expect(f.service.journal('owner', 'full', 'verification')!.markdown).toContain('Mode: web')
    expect(f.service.status('owner', 'full')!.collaboration!.stages.every(stage => stage.verified === false)).toBe(true)
    const reopened = new ProposalSessionService(f.deps); await reopened.start('owner', f.input)
    expect(reopened.status('owner', 'full')!.collaboration!.evidence).toEqual(saved)
    expect(f.generate).toHaveBeenCalledTimes(6)
    expect(() => f.sessions.verificationEvidence('full', 'intruder')).toThrow()
    f.db.prepare('DELETE FROM hadron_sessions WHERE id = ?').run('full')
    expect(f.db.prepare('SELECT count(*) n FROM subagent_runs').get().n).toBe(0)
    expect(f.db.prepare('SELECT count(*) n FROM hadron_verification_runs').get().n).toBe(0)
  } finally { f.service.stop('owner', 'full'); await result; f.cleanup() }
})

it('keeps a no-check verifier report separate from evidence and caps the saved receipt record', async () => {
  const f = fixture(true), result = observe(f.service.start('owner', f.input))
  try {
    await count(f,2);f.pending[0]('A');f.pending[1]('B');await count(f,4);f.pending[2]('R1');f.pending[3]('R2');await count(f,5)
    f.pending[4]('Claimed verification without actually calling tools');await count(f,6)
    expect(JSON.parse(f.packets[5].userContent).hostEvidence.receipts).toEqual([])
    for(let i=0;i<32;i++) f.sessions.recordVerificationEvidence('full','owner','fixture', {text:'x'.repeat(2000)})
    const record=f.sessions.verificationEvidence('full','owner')!
    expect(record.omitted).toBeGreaterThan(0);expect(JSON.stringify(record).length).toBeLessThan(24000)
    expect(record.receipts[0].truncated).toBe(true)
    f.pending[5]('No actual checks.');expect((await result).error).toBeNull()
  } finally {f.service.stop('owner','full');await result;f.cleanup()}
})

it.each(['stop','failure','revoked'] as const)('does not synthesize or retry when verification is %s', async reason => {
  const f=fixture(true),result=observe(f.service.start('owner',f.input))
  try {
    await count(f,2);f.pending[0]('A');f.pending[1]('B');await count(f,4);f.pending[2]('R1');f.pending[3]('R2');await count(f,5)
    if(reason==='stop')f.service.stop('owner','full')
    else {if(reason==='revoked'){f.deps.authorize.mockImplementation(()=>{throw Error('Revoked')});await expect(f.packets[4].hadronToolSession.invoke('web_read',{url:'https://example.com'},new AbortController().signal)).rejects.toThrow('Revoked');expect(f.sessions.verificationEvidence('full','owner')!.receipts).toEqual([])};f.pending[4](reason==='failure'?'x'.repeat(8001):'Report')}
    expect((await result).error).toBeTruthy();expect(f.generate).toHaveBeenCalledTimes(5)
    expect(f.sessions.workflowRuns('full','owner').find(row=>row.stage_id==='final')!.run_id).toBeNull()
    f.sessions.reconcileInterrupted();expect(f.generate).toHaveBeenCalledTimes(5)
  } finally {await result;f.cleanup()}
})

it('refuses verification without a trusted host factory before creating any records',()=>{
  const f=fixture()
  try{expect(()=>f.service.start('owner',{...f.input,workflow:'review_verify_and_synthesis'})).toThrow('unavailable');expect(f.sessions.get('full','owner')).toBeNull();expect(f.generate).not.toHaveBeenCalled()}
  finally{f.cleanup()}
})

async function finishRound(f:ReturnType<typeof fixture>,base:number,answer:string){
 await count(f,base+2);f.pending[base]('Proposal A');f.pending[base+1]('Proposal B');await count(f,base+4);f.pending[base+2]('Review A');f.pending[base+3]('Review B');await count(f,base+5);f.pending[base+4](answer)
}
it.each([true,false])('freezes shared follow-up ancestry, explicit prior-file choice %s and sibling forks',async includeParentContext=>{
 const f=fixture();f.input.context='ROOT FILE PRIVATE TEXT';let active:Promise<any>|undefined
 try{
  active=observe(f.service.start('owner',f.input));await finishRound(f,0,'Root combined answer');expect((await active).error).toBeNull()
  const first={...f.input,sessionId:'follow-one',parentSessionId:'full',includeParentContext,task:'First follow-up',context:'NEW FILE'}
  active=observe(f.service.start('owner',first));await count(f,7)
  const context=JSON.parse(f.packets[5].userContent).context
  expect(context).toContain('Root combined answer');expect(context).toContain('Choose a plan');expect(context).toContain('NEW FILE');expect(context.includes('ROOT FILE PRIVATE TEXT')).toBe(includeParentContext)
  await finishRound(f,5,'First follow-up combined answer');expect((await active).error).toBeNull()
  expect(f.service.status('owner','follow-one')!.parentSessionId).toBe('full')
  const sibling={...first,sessionId:'follow-sibling',task:'Alternate follow-up'}
  active=observe(f.service.start('owner',sibling));await count(f,12);expect(JSON.parse(f.packets[10].userContent).context).not.toContain('First follow-up combined answer')
  await finishRound(f,10,'Sibling combined');expect((await active).error).toBeNull()
  const tree=f.service.tree('owner','c1')
  expect(tree.nodes.find(n=>n.id==='shared-task:follow-one')!.parentId).toBe('shared-answer:full')
  expect(tree.nodes.find(n=>n.id==='shared-task:follow-sibling')!.parentId).toBe('shared-answer:full')
  const reopened=new ProposalSessionService(f.deps);await reopened.start('owner',first);expect(f.generate).toHaveBeenCalledTimes(15)
  expect(()=>reopened.tree('intruder','c1')).toThrow()
 }finally{for(const id of ['full','follow-one','follow-sibling'])f.service.stop('owner',id);await active;f.cleanup()}
})
it('rejects unfinished, self-linked or oversized shared ancestry before launching work',async()=>{
 const f=fixture();let active:Promise<any>|undefined
 try{
  expect(()=>f.service.start('owner',{...f.input,sessionId:'child',parentSessionId:'missing'})).toThrow()
  expect(()=>f.service.start('owner',{...f.input,parentSessionId:'full'})).toThrow('itself')
  active=observe(f.service.start('owner',f.input));await count(f,2)
  expect(()=>f.service.start('owner',{...f.input,sessionId:'child',parentSessionId:'full'})).toThrow('Completed shared parent')
  await finishRound(f,0,'x'.repeat(17000));expect((await active).error).toBeNull()
  expect(()=>f.service.preflight('owner',{...f.input,sessionId:'child',parentSessionId:'full'})).toThrow('16000')
  expect(f.sessions.get('child','owner')).toBeNull()
  expect(()=>f.service.start('owner',{...f.input,sessionId:'child',parentSessionId:'full'})).toThrow('16000')
  expect(f.generate).toHaveBeenCalledTimes(5)
 }finally{f.service.stop('owner','full');await active;f.cleanup()}
})

it('keeps mixed providers through proposals, cross-review, synthesis and journals',async()=>{
 const f=fixture()
 try{
  Object.assign(f.deps,{admitModel:(provider:string,model:string)=>provider==='claudecode'?model==='b-model':model==='a-model'})
  const input={...f.input,participants:[f.input.participants[0],{...f.input.participants[1],provider:'claudecode' as const}]}
  const result=observe(f.service.start('owner',input))
  await count(f,2);f.pending[0]('A plan');f.pending[1]('B plan')
  await count(f,4);f.pending[2]('A critique');f.pending[3]('B critique')
  await count(f,5);f.pending[4]('Combined plan with remaining uncertainties.')
  expect((await result).error).toBeNull()
  expect(f.generate.mock.calls.map(call=>call[0])).toEqual(['openaichatgpt','claudecode','openaichatgpt','claudecode','openaichatgpt'])
  expect(f.service.journal('owner','full','review_b')!.markdown).toContain('claudecode')
  expect(f.service.status('owner','full')!.participants[1].provider).toBe('claudecode')
 }finally{f.cleanup()}
})

it('names a failed review and retains the completed peer review without retrying or claiming synthesis',async()=>{
 const f=fixture(),work=observe(f.service.start('owner',f.input))
 try{
  await count(f,2);f.pending[0]('Implemented calculator');f.pending[1]('Independent analysis');await count(f,4)
  f.pending[3]('B completed review: inspect the arithmetic tests')
  await vi.waitFor(()=>expect(f.sessions.workflowRuns('full','owner').find(stage=>stage.stage_id==='review_b')?.run_id).toBeTruthy())
  f.failures[2](Error('ChatGPT reached Hadron’s 10-minute request limit. No automatic retry was made.'))
  expect((await work).error).toBeTruthy()
  const status=f.service.status('owner','full')!
  expect(status.status).toBe('failed')
  expect(status.error).toContain('Agent A (ChatGPT) could not complete its review.')
  expect(f.runs.getRunById(f.sessions.workflowRuns('full','owner').find(stage=>stage.stage_id==='review_a')!.run_id!)?.error).toBe('ChatGPT reached Hadron’s 10-minute request limit. No automatic retry was made.')
  expect(status.error).toContain('10-minute request limit')
  expect(status.collaboration!.stages.find(stage=>stage.id==='review_b')?.text).toContain('B completed review')
  expect(f.generate).toHaveBeenCalledTimes(4)
 }finally{f.service.stop('owner','full');await work;f.cleanup()}
})
