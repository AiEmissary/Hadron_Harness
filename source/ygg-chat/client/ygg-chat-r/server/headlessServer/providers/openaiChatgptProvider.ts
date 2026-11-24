import path from 'path'
import { getAuthManager } from '../../auth/runtime.js'
import { AuthFailure, type AuthSessionManager } from '../../auth/authSessionManager.js'
import type { ProviderTokenStore } from './tokenStore.js'
import { CodexResponsesProvider, toCodexMessages } from './codex/index.js'
import { normalizeOpenAIContextUsage, openAIContextUsageBlock } from '../../../../../shared/contextUsage.js'
import { attachPartialOutput } from './openRouterProvider.js'
import type {
  HeadlessProvider,
  ProviderGenerateInput,
  ProviderGenerateOutput,
  ProviderPartialOutput,
  ProviderStreamEventHandler,
} from './openRouterProvider.js'

interface OpenAiChatgptProviderDeps {
  tokenStore?: ProviderTokenStore
  auth?: AuthSessionManager
}

interface ResolvedAuth {
  accessToken: string
  accountId: string
}

export const DEFAULT_OPENAI_CHATGPT_CONTEXT_LENGTH = 258_000
export const MIN_OPENAI_CHATGPT_CONTEXT_LENGTH = 1_000
export const MAX_OPENAI_CHATGPT_CONTEXT_LENGTH = 2_000_000

export function resolveOpenAIChatGPTContextLength(configuredValue?: unknown): number {
  const storedGlobalValue = Number(process.env.YGG_OPENAI_CHATGPT_MAX_CONTEXT_TOKENS)
  const candidate =
    typeof configuredValue === 'number' && Number.isFinite(configuredValue) && configuredValue > 0
      ? configuredValue
      : Number.isFinite(storedGlobalValue) && storedGlobalValue > 0
        ? storedGlobalValue
        : DEFAULT_OPENAI_CHATGPT_CONTEXT_LENGTH

  if (!Number.isFinite(candidate) || candidate <= 0) return DEFAULT_OPENAI_CHATGPT_CONTEXT_LENGTH
  return Math.max(MIN_OPENAI_CHATGPT_CONTEXT_LENGTH, Math.min(MAX_OPENAI_CHATGPT_CONTEXT_LENGTH, Math.floor(candidate)))
}

export function normalizeOpenAIChatGPTModel(model: string): string {
  // Normalize display labels without substituting a different model.
  return (model || '').trim().replace(/^openaichatgpt\//i, '').toLowerCase().replace(/\s+/g, '-')
}

function getGeneratedImagesDirectoryHint(): { dir: string | null; pattern: string | null } {
  const userDataPath = process.env.YGG_APP_USER_DATA?.trim()
  if (!userDataPath) return { dir: null, pattern: null }
  const dir = path.join(userDataPath, 'generated_images')
  return { dir, pattern: path.join(dir, 'img-0001.<ext>') }
}

function getMimeTypeFromDataUrl(url: string): string {
  const match = /^data:([^;,]+)/i.exec(url)
  return match?.[1] || 'image/png'
}

function extractImageDataUrlFromOutputItem(item: any): string | null {
  if (!item || item.type !== 'image_generation_call') return null
  const result = typeof item.result === 'string' ? item.result.trim() : ''
  if (!result) return null
  if (/^data:image\//i.test(result) || /^https?:\/\//i.test(result)) return result
  return `data:image/png;base64,${result}`
}

function extractImageBlocksFromResponseItems(items: any[]): any[] {
  const blocks: any[] = []
  const seen = new Set<string>()

  for (const item of items || []) {
    const url = extractImageDataUrlFromOutputItem(item)
    if (!url || seen.has(url)) continue
    seen.add(url)
    blocks.push({
      type: 'image',
      url,
      mimeType: url.startsWith('data:image/') ? getMimeTypeFromDataUrl(url) : 'image/png',
    })
  }

  return blocks
}

function normalizeReasoningTextForDedupe(value: string): string {
  return value
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function areSimilarReasoningSegmentsForDedupe(normalizedA: string, normalizedB: string): boolean {
  if (!normalizedA || !normalizedB) return false

  const [headingA] = normalizedA.split(/\n|\. /)
  const [headingB] = normalizedB.split(/\n|\. /)
  if (headingA && headingB && headingA === headingB && Math.min(normalizedA.length, normalizedB.length) > 80) {
    return true
  }

  const wordsA = new Set(normalizedA.match(/[a-z0-9']+/g) || [])
  const wordsB = new Set(normalizedB.match(/[a-z0-9']+/g) || [])
  if (wordsA.size < 8 || wordsB.size < 8) return false

  let overlap = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++
  }

  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.65
}

function mergeReasoningSegmentForDedupe(segments: string[], value: string): void {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return

  const normalizedText = normalizeReasoningTextForDedupe(text)
  if (!normalizedText) return

  for (let index = segments.length - 1; index >= 0; index--) {
    const existing = segments[index]
    const normalizedExisting = normalizeReasoningTextForDedupe(existing)

    if (!normalizedExisting) {
      segments.splice(index, 1)
      continue
    }

    if (normalizedExisting === normalizedText || normalizedExisting.includes(normalizedText)) {
      return
    }

    if (normalizedText.includes(normalizedExisting)) {
      segments.splice(index, 1)
      continue
    }

    if (areSimilarReasoningSegmentsForDedupe(normalizedExisting, normalizedText)) {
      if (normalizedText.length > normalizedExisting.length) {
        segments.splice(index, 1)
        continue
      }
      return
    }
  }

  segments.push(text)
}

function canonicalReasoningText(values: any[]): string {
  const segments: string[] = []
  for (const value of values || []) {
    if (Array.isArray(value)) {
      for (const nested of value) mergeReasoningSegmentForDedupe(segments, String(nested ?? ''))
    } else {
      mergeReasoningSegmentForDedupe(segments, String(value ?? ''))
    }
  }
  return segments.join('\n\n').trim()
}

function stripDuplicateReasoningTextFromResponseItems(items: any[], canonicalReasoning: string): any[] {
  if (!Array.isArray(items)) return []
  const canonicalNormalized = normalizeReasoningTextForDedupe(canonicalReasoning || '')
  if (!canonicalNormalized) return items

  const stripReasoningParts = (parts: any): any => {
    if (!Array.isArray(parts)) return parts
    return parts.map(part => {
      if (!part || typeof part !== 'object' || typeof part.text !== 'string') return part
      const partNormalized = normalizeReasoningTextForDedupe(part.text)
      if (!partNormalized || canonicalNormalized === partNormalized || canonicalNormalized.includes(partNormalized)) {
        const { text: _text, ...rest } = part
        return rest
      }
      return part
    })
  }

  return items.map(item => {
    if (!item || typeof item !== 'object' || item.type !== 'reasoning') return item

    const stripped = { ...item }
    stripped.summary = stripReasoningParts(stripped.summary)
    stripped.content = stripReasoningParts(stripped.content)

    if (typeof stripped.text === 'string' && canonicalNormalized.includes(normalizeReasoningTextForDedupe(stripped.text))) {
      delete stripped.text
    }
    if (typeof stripped.delta === 'string' && canonicalNormalized.includes(normalizeReasoningTextForDedupe(stripped.delta))) {
      delete stripped.delta
    }

    return stripped
  })
}

type OpenAiResponseUsage = {
  input_tokens?: number
  input_tokens_details?: { cached_tokens?: number } | null
  output_tokens?: number
  output_tokens_details?: { reasoning_tokens?: number } | null
  total_tokens?: number
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isOpenAiChatgptDebugLoggingEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.YGG_OPENAI_CHATGPT_DEBUG_LOGS || '')
}

function isCodexDevLoggingEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.YGG_CODEX_DEV_LOGS || '')
}

function createOpenAiChatgptTraceId(input: ProviderGenerateInput): string {
  const base = input.railwayTurn?.conversationId?.trim() || input.userId || 'ygg-chat'
  return `${base}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
}

function logOpenAiChatgpt(level: 'info' | 'warn' | 'error', message: string, details?: Record<string, unknown>) {
  if (!isOpenAiChatgptDebugLoggingEnabled()) return
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
  logger(`[OpenAI ChatGPT] ${message}`, details || {})
}

function logCodexUsage(params: {
  model: string
  responseId?: string
  promptCacheKey?: string
  promptCacheRetention: 'in_memory' | '24h'
  requestMode?: 'full_replay' | 'qubit_exact_full_replay'
  inputItems?: number
  hasPreviousResponseId?: boolean
  usage?: OpenAiResponseUsage
}) {
  if (!isCodexDevLoggingEnabled()) return

  const usage = params.usage
  if (!usage) return

  const inputTokens = numberOrZero(usage.input_tokens)
  const cachedInputTokens = numberOrZero(usage.input_tokens_details?.cached_tokens)
  const outputTokens = numberOrZero(usage.output_tokens)
  const reasoningTokens = numberOrZero(usage.output_tokens_details?.reasoning_tokens)
  const totalTokens = numberOrZero(usage.total_tokens)
  const uncachedInputTokens = Math.max(inputTokens - cachedInputTokens, 0)
  const cacheHitRate = inputTokens > 0 ? cachedInputTokens / inputTokens : 0

  console.info('[Codex Usage]', {
    model: params.model,
    responseId: params.responseId,
    promptCacheKey: params.promptCacheKey,
    promptCacheRetention: params.promptCacheRetention,
    requestMode: params.requestMode,
    inputItems: params.inputItems,
    hasPreviousResponseId: params.hasPreviousResponseId,
    inputTokens,
    cachedInputTokens,
    uncachedInputTokens,
    cacheHitRate: `${(cacheHitRate * 100).toFixed(2)}%`,
    outputTokens,
    reasoningTokens,
    totalTokens,
  })
}

/**
 * R1(a): the Codex transports attach the text/reasoning/tool calls they accumulated,
 * but only this provider knows how those become content blocks. Build them from the
 * partial in the SAME order the success path uses (thinking, text, tool_use) so a
 * persisted partial row renders exactly like a completed one.
 *
 * `contextUsage` and `responses_output_items` are intentionally left out: neither
 * exists for a run that never completed.
 */
function contentBlocksFromPartialOutput(error: unknown): any[] {
  const partial = (error as any)?.partialOutput as ProviderPartialOutput | undefined
  if (!partial || typeof partial !== 'object') return []

  const blocks: any[] = []
  if (partial.reasoning) blocks.push({ type: 'thinking', content: partial.reasoning })
  if (partial.content) blocks.push({ type: 'text', content: partial.content })
  for (const toolCall of partial.toolCalls || []) {
    blocks.push({ type: 'tool_use', id: toolCall.id, name: toolCall.name, input: toolCall.arguments })
  }
  return blocks
}

export class OpenAiChatgptProvider implements HeadlessProvider {
  readonly name = 'openaichatgpt'
  private readonly auth: AuthSessionManager

  constructor(deps: OpenAiChatgptProviderDeps = {}) {
    this.auth = deps.auth ?? getAuthManager()
  }

  private async resolveAuth(input: ProviderGenerateInput): Promise<ResolvedAuth> {
    const credential = await this.auth.resolve('codex', { sessionId: input.authSessionId })
    return { accessToken: credential.accessToken, accountId: credential.userId }
  }

  async generate(input: ProviderGenerateInput, emit?: ProviderStreamEventHandler): Promise<ProviderGenerateOutput> {
    input.signal?.throwIfAborted()
    const sessionId = input.authSessionId ?? this.auth.snapshot('codex').sessionId ?? undefined
    let credential = await this.auth.resolve('codex', { sessionId })
    input.signal?.throwIfAborted()
    let emitted = false
    const relay: ProviderStreamEventHandler = event => { emitted = true; emit?.(event) }
    try { return await this.generateAttempt({ ...input, authSessionId: sessionId }, relay) }
    catch (error) {
      if (input.requestPolicy === 'single_attempt' || emitted || (error as any)?.partialOutput || (error as any)?.status !== 401 || input.signal?.aborted) throw error
      credential = await this.auth.resolve('codex', { sessionId, rejectedRevision: credential.revision })
      input.signal?.throwIfAborted()
      try { return await this.generateAttempt({ ...input, authSessionId: credential.sessionId }, relay) }
      catch (retryError) {
        if ((retryError as any)?.status === 401) {
          if (this.auth.snapshot('codex').sessionId === credential.sessionId) this.auth.requireReconnect('codex')
          throw new AuthFailure('codex', 'reauth_required', 'Reconnect your ChatGPT account to continue.')
        }
        throw retryError
      }
    }
  }

  private async generateAttempt(input: ProviderGenerateInput, emit?: ProviderStreamEventHandler): Promise<ProviderGenerateOutput> {
    const traceId = createOpenAiChatgptTraceId(input)
    const startedAt = Date.now()
    logOpenAiChatgpt('info', 'generate start', {
      traceId,
      requestedModel: input.modelName,
      normalizedModel: normalizeOpenAIChatGPTModel(input.modelName),
      userId: input.userId,
      conversationId: input.railwayTurn?.conversationId,
      hasAccessTokenInput: Boolean(input.accessToken),
      hasAccountIdInput: Boolean(input.accountId),
      historyItems: Array.isArray(input.history) ? input.history.length : 0,
      toolDefinitions: Array.isArray(input.tools) ? input.tools.length : 0,
      hasUserContent: typeof input.userContent === 'string' && input.userContent.length > 0,
      contextLength: resolveOpenAIChatGPTContextLength(input.contextLength),
    })

    const auth = await this.resolveAuth(input)
    input.signal?.throwIfAborted()
    const model = normalizeOpenAIChatGPTModel(input.modelName)
    const contextLength = resolveOpenAIChatGPTContextLength(input.contextLength)
    const sessionId = input.railwayTurn?.conversationId?.trim() || traceId
    const requestId = (input.railwayTurn as any)?.runId?.trim?.() || sessionId
    const messages = toCodexMessages(input)
    // BEHAVIOUR CHANGE: this read was `input.reasoningConfig?.effort`, but
    // ProviderGenerateInput has no such field — callers set reasoningConfig on
    // railwayTurn (toolLoopService.ts sets it there from ChatOrchestrator /
    // SubagentRunService). The old read was therefore always undefined and the
    // Codex provider never received a reasoning effort.
    const reasoningEffort = input.railwayTurn?.reasoningConfig?.effort
    const codexProvider = new CodexResponsesProvider({
      auth,
      reasoningEffort:
        reasoningEffort === 'minimal' || reasoningEffort === 'low' || reasoningEffort === 'medium' || reasoningEffort === 'high' || reasoningEffort === 'xhigh'
          ? reasoningEffort
          : undefined,
    })
    const parsed = await codexProvider
      .generate({
        model,
        providerInput: input,
        messages,
        tools: input.tools || [],
        sessionId,
        runId: requestId,
        signal: input.signal,
        emit,
        allowCommentaryFallbackText: input.railwayTurn?.allowCommentaryFallbackText === true,
      })
      .catch((error: unknown) => {
        // The transport already attached content/reasoning/toolCalls; only the block
        // mapping is missing. `attachPartialOutput` merges without overwriting, and
        // no-ops entirely when the run failed before producing anything.
        throw attachPartialOutput(error, { contentBlocks: contentBlocksFromPartialOutput(error) })
      })

    logOpenAiChatgpt('info', 'transport parsed output', {
      traceId,
      elapsedMs: Date.now() - startedAt,
      responseId: parsed.responseId,
      textLength: parsed.content.length,
      reasoningLength: parsed.reasoningContent?.length || 0,
      toolCalls: parsed.toolCalls.length,
      responseOutputItems: parsed.outputItems?.length || 0,
      usage: parsed.usage,
      requestMode: 'qubit_exact_full_replay',
    })

    logCodexUsage({
      model,
      responseId: parsed.responseId,
      promptCacheKey: parsed.promptCacheKey,
      promptCacheRetention: 'in_memory',
      requestMode: 'qubit_exact_full_replay',
      inputItems: parsed.diagnostics.inputItems,
      hasPreviousResponseId: false,
      usage: parsed.usage,
    })

    const contextUsage = normalizeOpenAIContextUsage(parsed.usage, {
      model,
      responseId: parsed.responseId,
    })
    const normalizedReasoning = canonicalReasoningText([parsed.reasoningContent || ''])
    const responseOutputItems = stripDuplicateReasoningTextFromResponseItems(parsed.outputItems || [], normalizedReasoning)
    const contentBlocks: any[] = []
    if (contextUsage) contentBlocks.push(openAIContextUsageBlock(contextUsage))
    if (normalizedReasoning) contentBlocks.push({ type: 'thinking', content: normalizedReasoning })
    if (parsed.content) contentBlocks.push({ type: 'text', content: parsed.content })

    const imageBlocks = extractImageBlocksFromResponseItems(responseOutputItems)
    for (const imageBlock of imageBlocks) {
      contentBlocks.push(imageBlock)
      emit?.({ type: 'chunk', part: 'image', url: imageBlock.url, mimeType: imageBlock.mimeType })
    }

    for (const toolCall of parsed.toolCalls) {
      contentBlocks.push({ type: 'tool_use', id: toolCall.id, name: toolCall.name, input: toolCall.arguments })
    }

    if (responseOutputItems.length > 0) {
      contentBlocks.push({ type: 'responses_output_items', items: responseOutputItems })
    }

    const output: ProviderGenerateOutput = {
      content: parsed.content,
      reasoning: normalizedReasoning || undefined,
      toolCalls: parsed.toolCalls,
      contentBlocks,
      ...(contextUsage ? { contextUsage } : {}),
      raw: {
        responses_output_items: responseOutputItems,
        response_items_added: parsed.responseItemsAdded || [],
        response_id: parsed.responseId,
        request_mode: 'qubit_exact_full_replay',
        used_previous_response_id: null,
        used_incremental_tool_output: false,
        usage: parsed.usage,
        request_shape: parsed.diagnostics,
        generatedImagesDirectoryHint: getGeneratedImagesDirectoryHint(),
        context_length_limit: contextLength,
      },
    }

    logOpenAiChatgpt('info', 'generate finish', {
      traceId,
      elapsedMs: Date.now() - startedAt,
      contentLength: output.content.length,
      reasoningLength: output.reasoning?.length || 0,
      toolCalls: output.toolCalls?.length || 0,
      contentBlocks: output.contentBlocks?.length || 0,
      rawResponseId: output.raw?.response_id,
    })
    return output
  }
}
