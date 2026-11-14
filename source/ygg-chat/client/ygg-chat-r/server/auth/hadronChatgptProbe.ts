import { listHadronChatgptModels } from './hadronChatgptModels.js'
import { HadronResponsesProvider } from '../headlessServer/providers/hadronResponsesProvider.js'

// Qualified only for the small, user-initiated connection test, not general jobs.
const probeModels = new Set(['gpt-6.1-sol'])
export const HADRON_CHATGPT_PROBE_PROMPT = 'Reply with exactly: Hadron connection OK'

/** Main-process only. No renderer-supplied prompt, credentials, tools or endpoint. */
export class HadronChatgptProbe {
  private busy = false
  constructor(private readonly options: {
    resolveAccount(signal: AbortSignal): Promise<{ accessToken: string; signal: AbortSignal }>
    fetch?: typeof fetch
  }) {}
  models(signal = AbortSignal.timeout(20000)) {
    return listHadronChatgptModels({ ...this.options, approvedModels: probeModels, signal })
  }
  async run(model: unknown): Promise<{ model: string; text: string }> {
    if (typeof model !== 'string' || !probeModels.has(model)) throw new Error('Choose an available connection-test model')
    if (this.busy) throw new Error('A Hadron connection test is already running')
    this.busy = true
    try {
      const signal = AbortSignal.timeout(30000)
      const account = await this.options.resolveAccount(signal)
      const scoped = AbortSignal.any([signal, account.signal]); scoped.throwIfAborted()
      const resolveAccount = async () => { scoped.throwIfAborted(); return account }
      const models = await listHadronChatgptModels({ approvedModels: probeModels, signal: scoped, resolveAccount, fetch: this.options.fetch })
      if (!models.some(choice => choice.id === model)) throw new Error('Connection-test model is unavailable for this account')
      const provider = new HadronResponsesProvider({ resolveAccount, fetch: this.options.fetch, maxOutputTokens: 256 })
      const result = await provider.generate({ modelName: model, history: [], userContent: HADRON_CHATGPT_PROBE_PROMPT,
        requestPolicy: 'single_attempt', signal: scoped })
      scoped.throwIfAborted()
      if (!result.content.trim() || result.content.length > 4096) throw new Error('Connection test returned an unexpected answer')
      return { model, text: result.content }
    } catch { throw new Error('Hadron ChatGPT connection test did not complete; no automatic retry was made') }
    finally { this.busy = false }
  }
}
