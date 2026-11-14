import { admittedHadronModel, type HadronProvider } from '../../../../../../shared/hadronProviders.js'
import { parseIndependentJob, type IndependentJobInput, type IndependentJobStatus, type IndependentJobTree } from '../../../../../../shared/independentJobs.js'
import type { IndependentJobsRepo } from '../../persistence/independentJobsRepo.js'
import type { SubagentRunRepo } from '../../persistence/subagentRunRepo.js'
import type { SubagentRunService } from '../subagentRunService.js'
import { buildHadronWorkerPrompt } from './hadronWorkerPrompt.js'
import { ProposalAccessDenied } from './proposalSessionService.js'
import { proposalHash } from './proposalCheckpoints.js'
import type { AgentJobJournal } from './agentJobJournal.js'
import { buildJobContinuity } from './jobContinuity.js'

interface ActiveJob { controller: AbortController; promise: Promise<void>; handle?: string }
/** One job owns exactly one protected provider attempt. No shared task, context or cancellation. */
export class IndependentJobService {
  private readonly active = new Map<string, ActiveJob>()
  private readonly journalErrors = new Set<string>()
  constructor(private readonly deps: { jobs: IndependentJobsRepo; agents: SubagentRunService; runs: SubagentRunRepo;
    toolSession?(ownerId: string, input: IndependentJobInput): import('../../../hadronTools/types.js').HadronToolSession;
    toolActivity?(ownerId: string, input: IndependentJobInput): Array<{ time: string; tool: string; state: string }>;
    allowedModels: ReadonlySet<string>; admitModel?(provider:HadronProvider,model:string):boolean; deadlineMs?: number; authorize(ownerId: string, input: IndependentJobInput): void;
    history?(ownerId: string, input: IndependentJobInput): Array<{ role: 'user' | 'assistant'; content: string; status?: string }>;
    journal?: AgentJobJournal; visibleProgress?(streamId: string): { text: string; truncated: boolean } | undefined }) {}
  private checkpoint(ownerId: string, id: string): void {
    if (!this.deps.journal) return
    const row = this.deps.jobs.get(id, ownerId); if (!row) return
    const config = JSON.parse(row.config_json), run = row.run_id ? this.deps.runs.getRunById(row.run_id) : null
    const progress = row.stream_id ? this.deps.visibleProgress?.(row.stream_id) : undefined
    const text = run?.final_response || (progress?.text ? `${progress.truncated ? '[Retained stream excerpt; earlier text may be missing.]\n' : ''}${progress.text}` : '')
    try {
      this.deps.journal.checkpoint({ ownerId, jobId: id, participantId: 'independent', task: config.task, context: config.context,
        provider: config.provider, modelName: config.modelName, status: row.status, revision: row.revision, runId: row.run_id, text, toolMode: config.toolMode, agentLabel: this.deps.jobs.agentLabel(id, ownerId), branch: this.deps.jobs.branchReference(id, ownerId) })
      this.journalErrors.delete(id)
    } catch (error) { this.journalErrors.add(id); throw error }
  }
  journal(ownerId: string, id: string) {
    if (!this.status(ownerId, id) || !this.deps.journal) return null
    this.checkpoint(ownerId, id)
    return { schemaVersion: 1 as const, id, ...this.deps.journal.read(ownerId, id, 'independent') }
  }
  continuity(ownerId: string, id: string) {
    const status = this.status(ownerId, id)
    if (!status || !['completed', 'cancelled', 'failed', 'interrupted'].includes(status.status)) throw new Error('Confirm the job has ended first')
    const journal = this.journal(ownerId, id)
    if (!journal) throw new Error('Job log unavailable')
    const config = JSON.parse(this.deps.jobs.get(id, ownerId)!.config_json)
    return buildJobContinuity({ id, task: config.task, context: config.context }, status.status, journal.markdown)
  }
  private authorize(ownerId: string, input: IndependentJobInput): void {
    try { this.deps.authorize(ownerId, input) } catch { throw new ProposalAccessDenied() }
  }
  status(ownerId: string, id: string): IndependentJobStatus | null {
    const row = this.deps.jobs.get(id, ownerId)
    if (!row) return null
    const config = JSON.parse(row.config_json)
    const input = parseIndependentJob(Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'deadlineMs')))
    this.authorize(ownerId, input)
    return { schemaVersion: 1, id, conversationId: row.conversation_id, status: row.status, revision: row.revision,
      provider: input.provider, modelName: input.modelName, runId: row.run_id, streamId: row.stream_id,
      ...(input.toolMode ? { toolMode: input.toolMode, toolActivity: this.deps.toolActivity?.(ownerId, input) ?? [] } : {}),
      ...(this.deps.journal ? { journalAvailable: !this.journalErrors.has(id) } : {}) }
  }
  ownsStream(ownerId: string, id: string, streamId: string): boolean { return this.status(ownerId, id)?.streamId === streamId }
  /** This job's actual saved task and owned run, not the main chat's tree. */
  tree(ownerId: string, id: string): IndependentJobTree | null {
    const status = this.status(ownerId, id); if (!status) return null
    const row = this.deps.jobs.get(id, ownerId)!, config = JSON.parse(row.config_json)
    const nodes: IndependentJobTree['nodes'] = [{ id: row.anchor_message_id, parentId: null, kind: 'task', status: 'saved', text: config.task, verified: false }]
    if (row.run_id) {
      const run = this.deps.runs.getRunById(row.run_id)
      if (!run || run.conversation_id !== row.conversation_id || run.parent_message_id !== row.anchor_message_id) throw new Error('Job tree ownership mismatch')
      const saved = this.transcript(ownerId, id)
      nodes.push({ id: run.id, parentId: row.anchor_message_id, kind: 'response', status: run.status, text: saved?.text ?? '', verified: false })
    }
    return { schemaVersion: 1, id, conversationId: row.conversation_id, nodes }
  }
  refreshJournal(ownerId: string, id: string): void { try { this.checkpoint(ownerId, id) } catch { /* Reported by status/journal read. */ } }
  start(ownerId: string, raw: unknown): Promise<void> {
    if (!ownerId || ownerId.length > 128) throw new Error('Invalid owner')
    const input = parseIndependentJob(raw); this.authorize(ownerId, input)
    if (!admittedHadronModel(this.deps,input.provider,input.modelName)) throw new Error('Model not admitted')
    const deadlineMs = this.deps.deadlineMs ?? (input.toolMode ? 300000 : 120000)
    if (input.toolMode && !this.deps.toolSession) throw new Error('Hadron tools are unavailable in this host')
    if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 600000) throw new Error('Invalid job deadline')
    const conversationHistory = this.deps.history?.(ownerId, input) ?? []
    const configJson = JSON.stringify({ ...input, deadlineMs })
    const row = this.deps.jobs.create({ id: input.id, ownerId, conversationId: input.conversationId, anchorMessageId: input.anchorMessageId,
      configJson, configHash: proposalHash(configJson) })
    const existing = this.active.get(input.id)
    if (existing) return existing.promise
    if (['completed', 'cancelled', 'failed', 'interrupted'].includes(row.status)) return Promise.resolve()
    this.checkpoint(ownerId, input.id) // No paid dispatch if the first recovery record cannot be saved.
    if (!this.deps.jobs.claim(input.id, ownerId)) throw new Error('Job already claimed or two jobs still active; check status')
    const entry: ActiveJob = { controller: new AbortController(), promise: Promise.resolve() }
    entry.promise = Promise.resolve().then(() => this.execute(ownerId, input, deadlineMs, entry, conversationHistory)).finally(() => {
      if (this.active.get(input.id) === entry) this.active.delete(input.id)
    })
    this.active.set(input.id, entry)
    return entry.promise
  }
  private async execute(ownerId: string, input: IndependentJobInput, deadlineMs: number, entry: ActiveJob, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; status?: string }>): Promise<void> {
    const { signal } = entry.controller
    let timedOut = false, completed = false
    const timer = setTimeout(() => { timedOut = true; entry.controller.abort(); if (entry.handle) this.deps.agents.cancel(entry.handle) }, deadlineMs)
    const journalTimer = this.deps.journal ? setInterval(() => { try { this.checkpoint(ownerId, input.id) } catch { /* Explicit journal read reports storage failure; inference is not relaunched. */ } }, 5000) : undefined
    try {
      this.checkpoint(ownerId, input.id)
      signal.throwIfAborted(); this.authorize(ownerId, input)
      const toolSession = input.toolMode ? this.deps.toolSession!(ownerId, input) : undefined
      const child = await this.deps.agents.spawnDetached({ conversationId: input.conversationId, parentMessageId: input.anchorMessageId,
        prompt: JSON.stringify({ schemaVersion: 1, task: input.task, context: input.context, ...(conversationHistory.length ? { conversationHistory } : {}) }),
        systemPrompt: buildHadronWorkerPrompt('independent_job'),
        provider: input.provider, modelName: input.modelName, userId: ownerId, lineageId: null, rootPath: null,
        tools: [], maxTurns: 1, operationMode: 'plan', autoApprove: false, fullAccess: false, autoCompactionEnabled: false,
      }, { signal, toolPolicy: 'none', toolSession,helpers:{jobId:input.id,role:this.deps.jobs.agentLabel(input.id,ownerId)??'agent'}, onPrepared: prepared => {
        entry.handle = prepared.handle ?? undefined
        signal.throwIfAborted(); this.authorize(ownerId, input)
        if (!prepared.handle) throw new Error('Owned job handle required')
        this.deps.jobs.bind(input.id, ownerId, { runId: prepared.runId, handle: prepared.handle, streamId: prepared.streamId })
        this.checkpoint(ownerId, input.id)
      } })
      entry.handle = child.handle ?? undefined
      if (!entry.handle) throw new Error('Owned job handle required')
      const result = await this.deps.agents.waitForTerminal(entry.handle)
      completed = result?.id === child.runId && result.status === 'completed'
    } catch { /* Public state records a generic failure; never raw provider diagnostics. */ }
    finally {
      clearTimeout(timer)
      if (journalTimer) clearInterval(journalTimer)
      if (entry.handle) { this.deps.agents.cancel(entry.handle); await this.deps.agents.waitForTerminal(entry.handle) }
      const latest = this.deps.jobs.get(input.id, ownerId)
      if (latest?.status === 'stopping' || (signal.aborted && !timedOut)) this.deps.jobs.finish(input.id, ownerId, 'cancelled')
      else this.deps.jobs.finish(input.id, ownerId, completed && !timedOut ? 'completed' : 'failed')
      try { this.checkpoint(ownerId, input.id) } catch { /* Preserve canonical completion even if local storage becomes unavailable. */ }
    }
  }
  transcript(ownerId: string, id: string): { schemaVersion: 1; id: string; status: string; text: string; verified: false } | null {
    const status = this.status(ownerId, id)
    if (!status?.runId || !['completed','cancelled','failed','interrupted'].includes(status.status)) return null
    const run = this.deps.runs.getRunById(status.runId)
    if (!run || run.conversation_id !== status.conversationId || !['completed','aborted','error'].includes(run.status)) return null
    const text = run.final_response ?? this.deps.runs.getMessages(run.id).filter(message => message.role === 'assistant').map(message => message.content ?? '').join('\n\n')
    if (text.length > 1_000_000) throw new Error('Job output exceeds recovery limit')
    return { schemaVersion: 1, id, status: status.status, text, verified: false }
  }
  stop(ownerId: string, id: string): void {
    this.status(ownerId, id)
    const before = this.deps.jobs.get(id, ownerId)
    if (!before || !this.deps.jobs.stop(id, ownerId)) return
    const entry = this.active.get(id); entry?.controller.abort()
    const row = this.deps.jobs.get(id, ownerId)
    if (row?.handle) this.deps.agents.cancel(row.handle)
    if (!entry && before.status === 'created') this.deps.jobs.finish(id, ownerId, 'cancelled')
    try { this.checkpoint(ownerId, id) } catch { /* Stop must still work if journal storage fails. */ }
  }
}
