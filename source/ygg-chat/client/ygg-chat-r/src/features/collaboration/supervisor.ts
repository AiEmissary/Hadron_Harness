import type { ProposalSessionStatus } from '../../../../../shared/collaboration'
import { CollaborationReplayUnavailable, type createCollaborationClient } from './client'
import type { CollaborationFrame } from './stream'

type Participant = 'a' | 'b'
type Client = Pick<ReturnType<typeof createCollaborationClient>, 'status' | 'stream' | 'stop' | 'transcript'>
export interface PaneState { text: string; cursor: number; streamId: string | null; attached: boolean; terminal: boolean; error: string | null }
export interface CollaborationView { sessionId: string | null; status: ProposalSessionStatus | null; panes: Record<Participant, PaneState>; error: string | null }
const pane = (): PaneState => ({ text: '', cursor: 0, streamId: null, attached: false, terminal: false, error: null })
export const emptyCollaborationView = (): CollaborationView => ({ sessionId: null, status: null, panes: { a: pane(), b: pane() }, error: null })
const terminal = (status: string) => ['completed', 'cancelled', 'failed', 'interrupted'].includes(status)

/** Observe/replay only: never launches inference, retries Start or implicitly sends Stop. */
export class CollaborationSupervisor {
  private view = emptyCollaborationView()
  private generation = 0
  private poll?: ReturnType<typeof setTimeout>
  private statusController?: AbortController
  private streams: Partial<Record<Participant, AbortController>> = {}
  private disposed = false
  constructor(private readonly client: Client, private readonly changed: (view: CollaborationView) => void, private readonly pollMs = 1000) {}
  private emit(): void { this.changed(this.view) }
  private update(id: Participant, patch: Partial<PaneState>): void {
    this.view = { ...this.view, panes: { ...this.view.panes, [id]: { ...this.view.panes[id], ...patch } } }; this.emit()
  }
  watch(sessionId: string): void {
    if (this.disposed) throw new Error('Observer disposed')
    this.detach()
    this.view = { ...emptyCollaborationView(), sessionId }; this.emit()
    void this.refresh(this.generation)
  }
  private async refresh(generation: number): Promise<void> {
    const id = this.view.sessionId
    if (!id || this.disposed || generation !== this.generation) return
    const controller = new AbortController(); this.statusController = controller
    try {
      const status = await this.client.status(id, controller.signal)
      if (controller.signal.aborted || generation !== this.generation || this.disposed) return
      if (status.sessionId !== id) throw new Error('Session mismatch')
      if (this.view.status && status.revision < this.view.status.revision) return
      this.view = { ...this.view, status, error: null }; this.emit()
      for (const participant of status.participants) {
        if (participant.id !== 'a' && participant.id !== 'b') continue
        const key = participant.id
        if (participant.streamId !== this.view.panes[key].streamId) {
          this.streams[key]?.abort(); delete this.streams[key]
          this.update(key, { ...pane(), streamId: participant.streamId })
          if (participant.streamId) this.attach(key, generation)
        }
      }
    } catch {
      if (!controller.signal.aborted && generation === this.generation && !this.disposed) {
        this.view = { ...this.view, error: 'Session status unavailable. Reconnect to check again.' }; this.emit()
      }
    } finally {
      if (generation === this.generation && !this.disposed && !controller.signal.aborted &&
        this.view.status && !terminal(this.view.status.status) && !this.view.error) {
        this.poll = setTimeout(() => void this.refresh(generation), this.pollMs)
      }
    }
  }
  private attach(id: Participant, generation: number): void {
    const { sessionId } = this.view, state = this.view.panes[id]
    if (!sessionId || !state.streamId || state.terminal || this.streams[id]) return
    const controller = new AbortController(); this.streams[id] = controller
    this.update(id, { attached: true, error: null })
    const current = () => !this.disposed && generation === this.generation && this.streams[id] === controller && !controller.signal.aborted
    void this.client.stream(sessionId, state.streamId, state.cursor, controller.signal, (frame: CollaborationFrame) => {
      if (!current()) return
      const previous = this.view.panes[id]
      if (previous.terminal || frame.seq <= previous.cursor) return
      if (frame.seq !== previous.cursor + 1) throw new Error('Stream sequence gap')
      let text = previous.text
      if (frame.type === 'chunk' && frame.part === 'text' && typeof frame.delta === 'string') text += frame.delta
      if (frame.type === 'complete' && typeof frame.result === 'string') text = frame.result
      if (text.length > 1_000_000) throw new Error('Response too large')
      this.update(id, { text, cursor: frame.seq, terminal: frame.type === 'complete' || frame.type === 'error',
        error: frame.type === 'error' ? 'Participant ended with an error. Check session status.' : null })
    }).then(() => {
      if (current()) this.update(id, { attached: false, terminal: true })
    }).catch(async error => {
      if (current() && error instanceof CollaborationReplayUnavailable) {
        try {
          const saved = await this.client.transcript(sessionId, id, controller.signal)
          if (current()) this.update(id, { text: saved.text, attached: false, terminal: true,
            error: saved.status === 'completed' ? null : 'Saved partial response. This attempt did not complete.' })
          return
        } catch { /* Recovery failure stays explicit; never starts another attempt. */ }
      }
      if (current()) this.update(id, { attached: false, error: 'Response disconnected. Reconnect to replay from the saved position.' })
    }).finally(() => { if (this.streams[id] === controller) delete this.streams[id] })
  }
  /** Explicit GET replay/status recovery, never a provider request. */
  reconnect(id?: Participant): void {
    if (this.disposed || !this.view.sessionId) return
    if (this.poll) clearTimeout(this.poll)
    this.statusController?.abort(); void this.refresh(this.generation)
    for (const key of id ? [id] : ['a', 'b'] as Participant[]) this.attach(key, this.generation)
  }
  async stop(): Promise<void> {
    const { sessionId } = this.view, generation = this.generation
    if (!sessionId || this.disposed) return
    const status = await this.client.stop(sessionId)
    if (generation !== this.generation || this.disposed) return
    if (status.sessionId !== sessionId) throw new Error('Session mismatch')
    if (!this.view.status || status.revision >= this.view.status.revision) { this.view = { ...this.view, status }; this.emit() }
    if (this.poll) clearTimeout(this.poll)
    this.statusController?.abort(); void this.refresh(generation)
  }
  private detach(): void {
    this.generation++
    if (this.poll) clearTimeout(this.poll)
    this.statusController?.abort()
    for (const controller of Object.values(this.streams)) controller?.abort()
    this.streams = {}
  }
  dispose(): void { this.disposed = true; this.detach() }
}
