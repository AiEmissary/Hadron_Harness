import type { ProposalSessionPage, ProposalSessionStatus } from '../../../../../shared/collaboration'
import type { createCollaborationClient } from './client'

type Client = Pick<ReturnType<typeof createCollaborationClient>, 'list' | 'status'>
export interface SavedSessionsState {
  conversationId: string | null
  sessions: ProposalSessionPage['sessions']
  nextBefore: string | null
  selected: ProposalSessionStatus | null
  loading: boolean
  selecting: boolean
  error: string | null
}
export const emptySavedSessions = (): SavedSessionsState => ({ conversationId: null, sessions: [], nextBefore: null,
  selected: null, loading: false, selecting: false, error: null })

/** Saved references are never authority. Every selection gets fresh server authorization. */
export class SavedSessionsController {
  private state = emptySavedSessions()
  private generation = 0
  private page?: AbortController
  private selection?: AbortController
  private disposed = false
  constructor(private readonly client: Client, private readonly changed: (state: SavedSessionsState) => void) {}
  private update(patch: Partial<SavedSessionsState>): void { this.state = { ...this.state, ...patch }; this.changed(this.state) }
  open(conversationId: string): void {
    if (this.disposed) throw new Error('Session browser disposed')
    this.generation++; this.page?.abort(); this.selection?.abort()
    this.state = { ...emptySavedSessions(), conversationId }; this.changed(this.state)
    void this.load()
  }
  async more(): Promise<void> { if (this.state.nextBefore) await this.load(this.state.nextBefore) }
  private async load(before?: string): Promise<void> {
    const { conversationId } = this.state, generation = this.generation
    if (!conversationId || this.state.loading || this.disposed) return
    const controller = new AbortController(); this.page = controller
    this.update({ loading: true, error: null })
    const current = () => !this.disposed && generation === this.generation && this.page === controller && !controller.signal.aborted
    try {
      const result = await this.client.list(conversationId, before, controller.signal)
      if (!current()) return
      if (result.sessions.some(session => session.conversationId !== conversationId)) throw new Error('Conversation mismatch')
      if (result.nextBefore && (result.sessions.length === 0 || result.nextBefore !== result.sessions[result.sessions.length - 1].sessionId || result.nextBefore === before)) {
        throw new Error('Invalid pagination progress')
      }
      const merged = new Map((before ? this.state.sessions : []).map(session => [session.sessionId, session]))
      for (const session of result.sessions) merged.set(session.sessionId, session)
      this.update({ sessions: [...merged.values()], nextBefore: result.nextBefore, loading: false })
    } catch {
      if (current()) this.update({ loading: false, error: 'Saved sessions unavailable. Refresh to check access again.' })
    }
  }
  async select(sessionId: string): Promise<void> {
    const { conversationId } = this.state, generation = this.generation
    if (!conversationId || this.disposed) return
    this.selection?.abort()
    const controller = new AbortController(); this.selection = controller
    this.update({ selected: null, selecting: true, error: null })
    const current = () => !this.disposed && generation === this.generation && this.selection === controller && !controller.signal.aborted
    try {
      if (!this.state.sessions.some(session => session.sessionId === sessionId)) throw new Error('Undiscovered session')
      const status = await this.client.status(sessionId, controller.signal)
      if (!current()) return
      if (status.conversationId !== conversationId || status.sessionId !== sessionId) throw new Error('Session mismatch')
      this.update({ selected: status, selecting: false })
    } catch {
      if (current()) this.update({ selected: null, selecting: false, error: 'Session access could not be confirmed. Refresh before trying again.' })
    }
  }
  dispose(): void { this.disposed = true; this.generation++; this.page?.abort(); this.selection?.abort() }
}
