import { parseIndependentJob, type IndependentJobInput, type IndependentJobStatus, AgentBranchParent } from '../../../../../shared/independentJobs'
import type { createIndependentJobClient } from './independentClient'
import { CollaborationReplayUnavailable } from './client'

type Client = Pick<ReturnType<typeof createIndependentJobClient>, 'prepare' | 'start' | 'status' | 'stop' | 'transcript' | 'stream'>
export interface JobReference { schemaVersion: 1; id: string; sourceConversationId: string; slot: 'a' | 'b'; stage: 'preparing' | 'submitted'; conversationId: string | null }
export interface JobStore { read(): JobReference | null; write(value: JobReference): void; clear(): void }
export interface IndependentJobView {
  phase: 'ready' | 'preparing' | 'submitting' | 'unknown' | 'accepted'
  id: string | null; status: IndependentJobStatus | null; text: string; error: string | null; cursor: number; outputComplete: boolean
}
export const emptyIndependentJob = (): IndependentJobView => ({ phase: 'ready', id: null, status: null, text: '', error: null, cursor: 0, outputComplete: false })
export const jobTerminal = (status: string) => ['completed', 'cancelled', 'failed', 'interrupted'].includes(status)
export function browserJobStore(sourceConversationId: string, slot: 'a' | 'b', namespace = 'independent'): JobStore {
  const key = `hadron:${namespace}:${sourceConversationId}:${slot}`
  return {
    read() {
      const raw = localStorage.getItem(key); if (!raw) return null
      const value = JSON.parse(raw)
      if (value?.schemaVersion !== 1 || value.sourceConversationId !== sourceConversationId || value.slot !== slot ||
        typeof value.id !== 'string' || !value.id || value.id.length > 128 || !['preparing', 'submitted'].includes(value.stage) ||
        (value.stage === 'preparing' ? value.conversationId !== null : typeof value.conversationId !== 'string' || !value.conversationId || value.conversationId.length > 128)) throw new Error('Job recovery reference is invalid')
      return { schemaVersion: 1, id: value.id, sourceConversationId, slot, stage: value.stage, conversationId: value.conversationId }
    },
    // Identity only: no task, file contents or credentials in localStorage.
    write(value) { localStorage.setItem(key, JSON.stringify(value)) },
    clear() { localStorage.removeItem(key) },
  }
}

/** Owns one UI slot. Closing/detaching never cancels inference or repeats admission. */
export class IndependentJobController {
  private view = emptyIndependentJob()
  private reference?: JobReference
  private disposed = false
  private poll?: ReturnType<typeof setTimeout>
  private reading?: Promise<void>
  private stream?: AbortController
  private streamId?: string
  private loadedTranscript = false
  constructor(private readonly client: Client, private readonly sourceConversationId: string, private readonly slot: 'a' | 'b',
    private readonly store: JobStore, private readonly changed: (view: IndependentJobView) => void, private readonly pollMs = 1000) {
    const saved = store.read()
    if (saved) { this.reference = saved; this.update({ phase: 'unknown', id: saved.id, error: 'Check the saved job before starting another.' }) }
  }
  private update(patch: Partial<IndependentJobView>) {
    this.view = { ...this.view, ...patch }; if (!this.disposed) this.changed(this.view)
  }
  async submit(draft: Pick<IndependentJobInput, 'images' | 'task' | 'context' | 'provider' | 'modelName' | 'toolMode' | 'projectGrantId'>, parent?: AgentBranchParent): Promise<boolean> {
    if (this.disposed || this.view.phase !== 'ready') throw new Error('Check the existing job first')
    const id = crypto.randomUUID()
    const frozen = parseIndependentJob({ schemaVersion: 1, id, conversationId: 'preparing', anchorMessageId: 'preparing', ...draft })
    const initial: JobReference = { schemaVersion: 1, id, sourceConversationId: this.sourceConversationId, slot: this.slot, stage: 'preparing', conversationId: null }
    this.store.write(initial); this.reference = initial
    this.update({ phase: 'preparing', id, error: null })
    try {
      const context = await this.client.prepare({ schemaVersion: 1, id, sourceConversationId: this.sourceConversationId, slot: this.slot, ...(parent ? { parent } : {}) })
      if (this.disposed) return false
      if (context.id !== id || context.sourceConversationId !== this.sourceConversationId || context.slot !== this.slot || context.conversationId === this.sourceConversationId) throw new Error('Job context mismatch')
      const input = parseIndependentJob({ ...frozen, conversationId: context.conversationId, anchorMessageId: context.anchorMessageId })
      const submitted: JobReference = { ...initial, stage: 'submitted', conversationId: context.conversationId }
      this.store.write(submitted); this.reference = submitted // Must persist before the only inference POST.
      this.update({ phase: 'submitting' })
      const status = await this.client.start(input)
      if (this.disposed) return false
      this.accept(status)
      if (jobTerminal(status.status)) await this.recover()
      else this.schedule()
      return true
    } catch {
      this.update({ phase: 'unknown', error: 'Start could not be confirmed. Check this job before starting another.' })
      return false
    }
  }
  private accept(status: IndependentJobStatus) {
    if (!this.reference || status.id !== this.reference.id || status.conversationId !== this.reference.conversationId) throw new Error('Job identity mismatch')
    if (this.view.status && status.revision < this.view.status.revision) throw new Error('Stale job status')
    this.update({ phase: 'accepted', status, error: null })
    if (!jobTerminal(status.status) && status.streamId && !this.streamId) this.attach(status.streamId)
  }
  recover(): Promise<void> {
    if (this.disposed || !this.reference || ['preparing', 'submitting'].includes(this.view.phase)) return Promise.resolve()
    if (this.reference.stage === 'preparing') {
      // No inference POST can precede the persisted 'submitted' marker.
      this.store.clear(); this.reference = undefined
      this.update({ ...emptyIndependentJob(), error: 'Preparation ended before launch. You can prepare the task again.' })
      return Promise.resolve()
    }
    return this.reading ??= this.readStatus().finally(() => { this.reading = undefined })
  }
  private async readStatus() {
    const id = this.reference!.id
    try {
      const status = await this.client.status(id)
      if (this.disposed) return
      this.accept(status)
      if (jobTerminal(status.status) && !this.loadedTranscript) {
        this.stream?.abort()
        if (status.runId) {
          const saved = await this.client.transcript(id)
          if (this.disposed) return
          if (saved.id !== id || saved.status !== status.status) throw new Error('Job output mismatch')
          this.loadedTranscript = true; this.update({ text: saved.text, outputComplete: true })
        } else { this.loadedTranscript = true; this.update({ outputComplete: true }) }
      }
      this.schedule()
    } catch {
      if (!this.disposed) this.update({ error: 'Job status or saved output is unavailable. No new job has been launched.' })
    }
  }
  private schedule() {
    if (this.poll) clearTimeout(this.poll)
    if (!this.disposed && this.view.status && !jobTerminal(this.view.status.status)) {
      this.poll = setTimeout(() => void this.recover(), this.pollMs)
    }
  }
  private attach(streamId: string) {
    const controller = new AbortController(); this.stream = controller; this.streamId = streamId
    const id = this.reference!.id
    const current = () => !this.disposed && !controller.signal.aborted && this.stream === controller
    void this.client.stream(id, streamId, this.view.cursor, controller.signal, frame => {
      if (!current() || frame.seq <= this.view.cursor) return
      if (frame.seq !== this.view.cursor + 1) throw new Error('Job stream gap')
      let text = this.view.text
      if (frame.type === 'chunk' && frame.part === 'text' && typeof frame.delta === 'string') text += frame.delta
      if (frame.type === 'complete' && typeof frame.result === 'string') text = frame.result
      if (text.length > 1_000_000) throw new Error('Job output exceeds limit')
      this.update({ text, cursor: frame.seq })
    }).catch(error => {
      if (!current()) return
      if (error instanceof CollaborationReplayUnavailable) void this.recover()
      else this.update({ error: 'Response disconnected. Check this job to reconnect.' })
    })
  }
  async reconnect() {
    if (this.disposed) return
    this.stream?.abort(); this.stream = undefined; this.streamId = undefined
    await this.recover()
  }
  async stop() {
    if (this.disposed || this.view.phase !== 'accepted' || !this.reference || !this.view.status || jobTerminal(this.view.status.status)) return
    const status = await this.client.stop(this.reference.id)
    if (!this.disposed) {
      this.accept(status)
      if (this.reading) await this.reading // Drain an older poll before asking for the post-Stop state.
      if (!this.disposed) await this.recover()
    }
  }
  prepareNext() {
    if (this.disposed || this.reading || this.view.phase !== 'accepted' || !this.view.status || (!jobTerminal(this.view.status.status) || !this.view.outputComplete)) throw new Error('Confirm that the current job ended first')
    this.store.clear(); this.stream?.abort(); this.stream = undefined; this.streamId = undefined; this.loadedTranscript = false
    this.reference = undefined; this.update(emptyIndependentJob())
  }
  dispose() { this.disposed = true; if (this.poll) clearTimeout(this.poll); this.stream?.abort() }
}
