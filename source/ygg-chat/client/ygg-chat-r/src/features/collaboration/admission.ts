import { parseProposalSession, type ProposalSessionInput, type ProposalSessionStatus } from '../../../../../shared/collaboration'
import type { createCollaborationClient } from './client'
type Client = Pick<ReturnType<typeof createCollaborationClient>, 'start' | 'status'>
export interface AdmissionState {
  phase: 'ready' | 'submitting' | 'unknown' | 'accepted'
  sessionId: string | null
  status: ProposalSessionStatus | null
  error: string | null
}
export interface AdmissionReference { schemaVersion: 1; sessionId: string; conversationId: string }
export interface AdmissionStore { read(): AdmissionReference | null; write(reference: AdmissionReference): void; clear(): void }

export function browserAdmissionStore(conversationId: string, namespace = 'collaboration'): AdmissionStore {
  const key = `hadron:${namespace}:admission:${conversationId}`
  return {
    read() {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const reference = JSON.parse(raw)
      if (reference?.schemaVersion !== 1 || reference.conversationId !== conversationId || typeof reference.sessionId !== 'string' || !reference.sessionId || reference.sessionId.length > 128) throw new Error('Saved admission reference requires recovery')
      return { schemaVersion: 1, sessionId: reference.sessionId, conversationId }
    },
    write(reference) { localStorage.setItem(key, JSON.stringify(reference)) },
    clear() { localStorage.removeItem(key) },
  }
}
export const emptyAdmission = (): AdmissionState => ({ phase: 'ready', sessionId: null, status: null, error: null })

/** A POST is sent once. An uncertain reply can only be recovered with GET, never another POST. */
export class CollaborationAdmission {
  private state = emptyAdmission()
  private frozen?: ProposalSessionInput
  private reference?: AdmissionReference
  private disposed = false
  private recovery?: Promise<void>
  constructor(private readonly client: Client, private readonly changed: (state: AdmissionState) => void, private readonly store?: AdmissionStore) {
    const saved = store?.read()
    if (saved) {
      this.reference = saved
      this.update({ phase: 'unknown', sessionId: saved.sessionId, error: 'Check the saved session before starting another.' })
    }
  }
  private update(patch: Partial<AdmissionState>): void {
    this.state = { ...this.state, ...patch }; if (!this.disposed) this.changed(this.state)
  }
  async submit(input: ProposalSessionInput): Promise<void> {
    if (this.disposed || this.state.phase !== 'ready') throw new Error('Check the existing session before starting again')
    const copy = parseProposalSession(input)
    // Keep the id and exact frozen input even if POST fails or the view disappears.
    this.reference = { schemaVersion: 1, sessionId: copy.sessionId, conversationId: copy.conversationId }
    this.store?.write(this.reference) // Must succeed before POST; never persist task/context/credentials.
    this.frozen = structuredClone(copy)
    this.update({ phase: 'submitting', sessionId: copy.sessionId, error: null })
    try {
      const status = await this.client.start(structuredClone(this.frozen))
      this.check(status)
      this.update({ phase: 'accepted', status, error: null })
    } catch {
      this.update({ phase: 'unknown', error: 'Start could not be confirmed. Check this session before starting another.' })
    }
  }
  private check(status: ProposalSessionStatus): void {
    if (!this.reference || status.sessionId !== this.reference.sessionId || status.conversationId !== this.reference.conversationId) {
      throw new Error('Session identity mismatch')
    }
  }
  recover(): Promise<void> {
    if (this.disposed || !this.reference || this.state.phase === 'ready' || this.state.phase === 'submitting') return Promise.resolve()
    return this.recovery ??= this.readStatus().finally(() => { this.recovery = undefined })
  }
  private async readStatus(): Promise<void> {
    try {
      const status = await this.client.status(this.reference!.sessionId)
      this.check(status)
      this.update({ phase: 'accepted', status, error: null })
    } catch {
      // Even 404 is not proof that a delayed POST was never admitted. Retain the fence.
      this.update({ error: 'Session status is unavailable. No new request has been sent.' })
    }
  }
  /** A new explicit attempt is allowed only after confirmed terminal state. */
  prepareNext(): void {
    if (this.disposed || this.recovery || this.state.phase !== 'accepted' || !this.state.status ||
      !['completed', 'cancelled', 'failed', 'interrupted'].includes(this.state.status.status)) {
      throw new Error('Confirm the previous session has ended first')
    }
    this.store?.clear()
    this.frozen = undefined; this.reference = undefined; this.state = emptyAdmission(); this.changed(this.state)
  }
  dispose(): void { this.disposed = true } // Detach the UI only; never stop or relaunch inference.
}
