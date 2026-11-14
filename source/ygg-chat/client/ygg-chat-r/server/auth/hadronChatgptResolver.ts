import { HadronChatgptRefresh } from './hadronChatgptRefresh.js'
import type { HadronChatgptAccount } from './hadronChatgptSignIn.js'

/** Private account resolver for the new transport. Host must invalidate on every
 * account action and use the SAME exclusive lease for all credential writers.
 * Not installed in production until host lifecycle integration is complete.
 */
export class HadronChatgptResolver {
  private lifetime = new AbortController()
  private pending?: Promise<HadronChatgptAccount>
  constructor(private readonly options: {
    read(): HadronChatgptAccount | null; save(account: HadronChatgptAccount): void
    withLease<T>(work: () => Promise<T>): Promise<T>
    fetch?: typeof fetch; now?: () => number
  }) {}
  invalidate(): void { this.lifetime.abort(); this.lifetime = new AbortController(); this.pending = undefined }
  async resolve(signal: AbortSignal): Promise<{ accessToken: string; signal: AbortSignal }> {
    signal.throwIfAborted()
    const lifetime = this.lifetime
    let account = this.options.read()
    if (!account || (account.refreshPending && !this.pending)) throw new Error('Reconnect ChatGPT before continuing')
    if (this.pending || account.expiresAt <= (this.options.now ?? Date.now)() + 60000) {
      if (!this.pending) {
        const work = this.options.withLease(async () => {
          lifetime.signal.throwIfAborted()
          const current = this.options.read()
          if (!current || current.refreshPending) throw new Error('Reconnect ChatGPT before continuing')
          if (current.expiresAt > (this.options.now ?? Date.now)() + 60000) return current
          return new HadronChatgptRefresh(this.options).refresh(lifetime.signal)
        })
        this.pending = work
        void work.finally(() => { if (this.pending === work) this.pending = undefined }).catch(() => {})
      }
      account = await this.pending
    }
    signal.throwIfAborted(); lifetime.signal.throwIfAborted()
    const current = this.options.read()
    if (!current || current.refreshPending || current.clientId !== account.clientId || current.subject !== account.subject || current.accessToken !== account.accessToken) {
      throw new Error('Hadron ChatGPT account changed')
    }
    return { accessToken: account.accessToken, signal: lifetime.signal }
  }
}
