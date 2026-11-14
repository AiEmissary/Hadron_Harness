import { boundedChatgptJson } from './hadronChatgptSignIn.js'

/** Account-specific choices intersected with trusted deployment approval.
 * No catalog, token or HTTP diagnostic is exposed directly to the renderer.
 */
export async function listHadronChatgptModels(options: {
  approvedModels: ReadonlySet<string>; signal: AbortSignal
  resolveAccount(signal: AbortSignal): Promise<{ accessToken: string; signal: AbortSignal }>
  fetch?: typeof fetch
}): Promise<Array<{ id: string; label: string }>> {
  const approved = new Set(options.approvedModels)
  options.signal.throwIfAborted()
  if (!approved.size) return []
  try {
    const requestSignal = AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
    const account = await options.resolveAccount(requestSignal)
    const signal = AbortSignal.any([requestSignal, account.signal]); signal.throwIfAborted()
    const response = await (options.fetch ?? fetch)('https://api.openai.com/v1/models', {
      method: 'GET', redirect: 'error', signal, headers: { Authorization: `Bearer ${account.accessToken}`, Accept: 'application/json' },
    })
    const catalog = await boundedChatgptJson(response)
    signal.throwIfAborted()
    if (!Array.isArray(catalog?.models) || catalog.models.length > 5000) throw new Error('Invalid catalog')
    const seen = new Set<string>(), models: Array<{ id: string; label: string }> = []
    for (const model of catalog.models) {
      if (model?.visibility !== 'list') continue
      if (typeof model.slug !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(model.slug) ||
        typeof model.display_name !== 'string' || !model.display_name.trim() || model.display_name.length > 200 ||
        /[\u0000-\u001f\u007f]/.test(model.display_name) || seen.has(model.slug)) throw new Error('Invalid displayed model')
      seen.add(model.slug)
      if (approved.has(model.slug)) models.push({ id: model.slug, label: model.display_name })
    }
    return models
  } catch { throw new Error('Hadron ChatGPT model choices are unavailable; check the connection') }
}
