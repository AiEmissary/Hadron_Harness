import type { SubagentRunService } from '../subagentRunService.js'
import { buildHadronWorkerPrompt } from './hadronWorkerPrompt.js'

export interface IndependentJobInput {
  id: string; conversationId: string; anchorMessageId: string
  task: string; context: string; provider: 'openaichatgpt'; modelName: string
}
interface JobEntry { controller: AbortController; handle?: string; runId?: string; streamId?: string }
export interface IndependentJobResult { id: string; status: 'completed' | 'aborted' | 'failed'; runId: string | null; streamId: string | null; text: string }

/** Internal read-only feasibility runner; unregistered, no live model approval or durable recovery. */
export class IndependentJobsSpike {
  private readonly jobs: readonly IndependentJobInput[]
  private readonly entries = new Map<string, JobEntry>()
  private execution?: Promise<IndependentJobResult[]>
  constructor(private readonly deps: {
    agents: Pick<SubagentRunService, 'spawnDetached' | 'cancel' | 'waitForTerminal'>
    ownerId: string; allowedModels: ReadonlySet<string>; deadlineMs: number
    authorize(job: IndependentJobInput): void
    onPrepared(jobId: string, child: { runId: string; handle: string | null; streamId: string }): void
  }, jobs: readonly IndependentJobInput[]) {
    if (!deps.ownerId || jobs.length !== 2 || new Set(jobs.map(job => job.id)).size !== 2 ||
      new Set(jobs.map(job => job.conversationId)).size !== 2 || !Number.isSafeInteger(deps.deadlineMs) || deps.deadlineMs < 1 || deps.deadlineMs > 600000) throw new Error('Expected two isolated bounded jobs')
    for (const job of jobs) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(job.id) || !job.conversationId || !job.anchorMessageId || !job.task.trim() ||
        job.task.length > 16000 || job.context.length > 16000 || job.provider !== 'openaichatgpt' || !deps.allowedModels.has(job.modelName)) throw new Error('Unsupported independent job')
      deps.authorize(job)
    }
    this.jobs = jobs.map(job => Object.freeze({ ...job }))
    for (const job of this.jobs) this.entries.set(job.id, { controller: new AbortController() })
  }
  start(): Promise<IndependentJobResult[]> { return this.execution ??= Promise.all(this.jobs.map(job => this.run(job))) }
  stopJob(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) throw new Error('Unknown job')
    entry.controller.abort()
    if (entry.handle) this.deps.agents.cancel(entry.handle)
  }
  stopAll(): void { for (const id of this.entries.keys()) this.stopJob(id) }
  private async run(job: IndependentJobInput): Promise<IndependentJobResult> {
    const entry = this.entries.get(job.id)!, { signal } = entry.controller
    const timer = setTimeout(() => this.stopJob(job.id), this.deps.deadlineMs)
    try {
      signal.throwIfAborted(); this.deps.authorize(job)
      const child = await this.deps.agents.spawnDetached({ conversationId: job.conversationId, parentMessageId: job.anchorMessageId,
        prompt: JSON.stringify({ schemaVersion: 1, task: job.task, context: job.context }),
        systemPrompt: buildHadronWorkerPrompt('independent_job'),
        provider: job.provider, modelName: job.modelName, userId: this.deps.ownerId,
        lineageId: null, rootPath: null, fullAccess: false, autoApprove: false, operationMode: 'plan', tools: [], maxTurns: 1, autoCompactionEnabled: false,
      }, { signal, toolPolicy: 'none', onPrepared: prepared => {
        entry.handle = prepared.handle ?? undefined; entry.runId = prepared.runId; entry.streamId = prepared.streamId
        signal.throwIfAborted(); this.deps.authorize(job); this.deps.onPrepared(job.id, prepared)
      } })
      entry.handle = child.handle ?? undefined; entry.runId = child.runId; entry.streamId = child.streamId
      if (!entry.handle) throw new Error('Owned handle required')
      const result = await this.deps.agents.waitForTerminal(entry.handle)
      return { id: job.id, runId: entry.runId, streamId: entry.streamId,
        status: result?.status === 'completed' ? 'completed' : signal.aborted || result?.status === 'aborted' ? 'aborted' : 'failed', text: result?.final_response ?? '' }
    } catch {
      return { id: job.id, status: signal.aborted ? 'aborted' : 'failed', runId: entry.runId ?? null, streamId: entry.streamId ?? null, text: '' }
    } finally {
      clearTimeout(timer)
      if (entry.handle) { this.deps.agents.cancel(entry.handle); await this.deps.agents.waitForTerminal(entry.handle).catch(() => null) }
    }
  }
}
