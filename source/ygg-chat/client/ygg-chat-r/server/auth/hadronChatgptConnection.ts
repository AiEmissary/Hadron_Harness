import { startHadronChatgptLoopback } from './hadronChatgptLoopback.js'
import type { HadronChatgptStore } from './hadronChatgptStore.js'
import { HadronChatgptResolver } from './hadronChatgptResolver.js'
import { chatgptDiagnostic, HadronChatgptSignInError } from './hadronChatgptDiagnostics.js'

export interface HadronChatgptStatus {
  connected: boolean; reason: 'ready' | 'signed_out' | 'expired' | 'storage_unavailable' | 'reconnect_required'
  loginState: 'idle' | 'running' | 'failed'
  loginError?: ReturnType<typeof chatgptDiagnostic>
}

/** Trusted host coordinator. Every await is fenced; credential publication is
 * synchronous after the final fence, so Cancel cannot race a deferred disk write.
 * Existing credentials remain active until a fully verified replacement commits.
 */
export class HadronChatgptConnection {
  private epoch = 0
  private busy = false
  private failed = false
  private failure?: ReturnType<typeof chatgptDiagnostic>
  private flow?: Awaited<ReturnType<typeof startHadronChatgptLoopback>>
  private readonly resolver: HadronChatgptResolver
  get generation(): number { return this.epoch }
  constructor(private readonly options: {
    store: Pick<HadronChatgptStore, 'hostId' | 'account' | 'save' | 'disconnect' | 'registration' | 'rememberRegistration'>
    openBrowser(url: string): Promise<unknown>
    startLoopback?: typeof startHadronChatgptLoopback
    now?: () => number
    onChanged?(): void
    withLease?<T>(work: () => Promise<T>): Promise<T>
    fetch?: typeof fetch
  }) {
    this.resolver = new HadronChatgptResolver({ read: () => options.store.account(), save: account => options.store.save(account),
      withLease: work => this.withLease(work), now: options.now, fetch: options.fetch })
  }
  private withLease<T>(work: () => Promise<T>): Promise<T> { return this.options.withLease ? this.options.withLease(work) : work() }
  /** Trusted provider use only. Never expose the credential-bearing result over IPC. */
  resolveAccount(signal: AbortSignal) { return this.resolver.resolve(signal) }
  private changed(): void {
    this.epoch++
    this.resolver.invalidate()
    try { this.options.onChanged?.() } catch { /* Detached status listeners cannot undo a committed account. */ }
  }
  status(): HadronChatgptStatus {
    const loginState = this.busy ? 'running' : this.failed ? 'failed' : 'idle'
    const details = this.failed && this.failure ? { loginError: this.failure } : {}
    try {
      const account = this.options.store.account()
      const connected = !!account && !account.refreshPending && account.expiresAt > (this.options.now ?? Date.now)()
      return { connected, reason: account?.refreshPending ? 'reconnect_required' : connected ? 'ready' : account ? 'expired' : 'signed_out', loginState, ...details }
    } catch { return { connected: false, reason: 'storage_unavailable', loginState, ...details } }
  }
  async startSignIn(): Promise<void> {
    if (this.busy) return
    this.busy = true; this.failed = false; this.failure = undefined; this.changed()
    const epoch = this.epoch
    try {
      const { hostId, registration } = await this.withLease(async () => ({ hostId: this.options.store.hostId(), registration: this.options.store.registration() }))
      if (this.epoch !== epoch) return
      const flow = await (this.options.startLoopback ?? startHadronChatgptLoopback)({ hostId,
        ...(registration ? { registration } : {}) })
      if (this.epoch !== epoch) { flow.cancel(); return }
      this.flow = flow
      void flow.completion.then(async verified => {
        if (this.epoch !== epoch || this.flow !== flow) return
        try {
          await this.withLease(async () => {
            if (this.epoch !== epoch || this.flow !== flow) return
            this.options.store.save(verified)
          })
        } catch { throw new HadronChatgptSignInError('storage') }
        if (this.epoch !== epoch || this.flow !== flow) return
        this.busy = false; this.failed = false; this.flow = undefined; this.changed()
      }).catch(async error => {
        if (this.epoch !== epoch || this.flow !== flow) return
        if (error instanceof HadronChatgptSignInError && error.tokenRejection?.category === 'invalid_grant' && error.recoveryClientId) {
          try {
            await this.withLease(async () => {
              if (this.epoch !== epoch || this.flow !== flow) return
              this.options.store.rememberRegistration(error.recoveryClientId!)
            })
          } catch { error = new HadronChatgptSignInError('storage') }
          if (this.epoch !== epoch || this.flow !== flow) return
        }
        this.failure = chatgptDiagnostic(error)
        this.busy = false; this.failed = true; this.flow = undefined; this.changed()
      })
      await this.options.openBrowser(flow.authorizationUrl)
    } catch (error) {
      if (this.epoch !== epoch) return
      this.failure = chatgptDiagnostic(error, 'start')
      this.flow?.cancel(); this.flow = undefined; this.busy = false; this.failed = true; this.changed()
      throw new Error('ChatGPT sign-in could not start')
    }
  }
  cancelSignIn(): void {
    const flow = this.flow
    this.flow = undefined; this.busy = false; this.failed = false; this.failure = undefined; this.changed(); flow?.cancel()
  }
  async disconnect(): Promise<void> {
    this.cancelSignIn()
    const epoch = this.epoch
    await this.withLease(async () => {
      if (this.epoch !== epoch) throw new Error('Hadron account changed during disconnect')
      this.options.store.disconnect()
    })
    this.changed()
  }
}
