import { parseCodexSseResponse } from './codex/codexSse.js'
import { attachPartialOutput, type HeadlessProvider, type ProviderGenerateInput, type ProviderGenerateOutput, type ProviderStreamEventHandler } from './openRouterProvider.js'

/** Subscription Responses transport, deliberately separate from legacy Codex.
 * Not registered in ProviderRouter until refresh/admission integration is ready.
 */
export class HadronResponsesProvider implements HeadlessProvider {
  readonly name = 'openaichatgpt'
  constructor(private readonly options: {
    resolveAccount(signal: AbortSignal): Promise<{ accessToken: string; signal: AbortSignal }>
    fetch?: typeof fetch
    maxOutputTokens?: number
  }) {}
  async generate(input: ProviderGenerateInput, emit?: ProviderStreamEventHandler): Promise<ProviderGenerateOutput> {
    const limit = this.options.maxOutputTokens
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 4096)) throw new Error('Invalid Hadron output limit')
    if (input.requestPolicy !== 'single_attempt' || input.tools?.length || input.accessToken || input.accountId || input.railwayTurn) {
      throw new Error('Hadron Responses requires a trusted tool-free single attempt')
    }
    if (!input.modelName.trim() || input.modelName.length > 200) throw new Error('Explicit Hadron model required')
    const messages = input.history.map(message => {
      if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.tool_calls?.length || message.toolCalls?.length) {
        throw new Error('Hadron Responses accepts text-only user/assistant history')
      }
      return { role: message.role, content: message.content }
    })
    messages.push({ role: 'user', content: input.userContent })
    if (JSON.stringify(messages).length + (input.systemPrompt?.length ?? 0) > 131072) throw new Error('Hadron Responses context exceeded limit')
    const signal = AbortSignal.any([...(input.signal ? [input.signal] : []), AbortSignal.timeout(120000)])
    signal.throwIfAborted()
    const account = await this.options.resolveAccount(signal)
    const scoped = AbortSignal.any([signal, account.signal]); scoped.throwIfAborted()
    if (!account.accessToken) throw new Error('Hadron ChatGPT connection required')
    const response = await (this.options.fetch ?? fetch)('https://api.openai.com/v1/responses', {
      method: 'POST', redirect: 'error', signal: scoped,
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ model: input.modelName, input: messages,
        ...(input.systemPrompt ? { instructions: input.systemPrompt } : {}),
        ...(limit !== undefined ? { max_output_tokens: limit } : {}), store: false, stream: true }),
    })
    // Raw error bodies can contain credentials or request text; never surface them.
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Hadron ChatGPT request failed (${response.status})`) }
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.body?.cancel(); throw new Error('Hadron ChatGPT returned an unexpected response')
    }
    const parsed = await parseCodexSseResponse(response, { signal: scoped, modelName: input.modelName, emit })
    scoped.throwIfAborted()
    if (parsed.providerStopReason !== 'response.completed' || parsed.toolCalls.length) {
      throw attachPartialOutput(new Error('Hadron ChatGPT response did not complete as text'), { content: parsed.content })
    }
    return { content: parsed.content }
  }
}
