import { getBraveApiKey } from '../keytarSecrets.js'
import { setTimeout as delay } from 'node:timers/promises'

interface BraveSearchResult {
  title: string
  url: string
  description: string
  age?: string
  language?: string
}

interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string
      url: string
      description: string
      age?: string
      language?: string
    }>
  }
  news?: {
    results: Array<{
      title: string
      url: string
      description: string
      age?: string
    }>
  }
}

interface BraveSearchOptions {
  count?: number
  offset?: number
  safesearch?: 'strict' | 'moderate' | 'off'
  country?: string
  search_lang?: string
  ui_lang?: string
  spellcheck?: boolean
  result_filter?: string
  goggles_id?: string
  units?: 'metric' | 'imperial'
  extra_snippets?: boolean
  summary?: boolean
}

/**
 * Search the web using Brave Search API
 * @param query The search query
 * @param options Optional search parameters
 * @returns Promise with search results
 */
export async function braveSearch(
  query: string,
  options: BraveSearchOptions = {},
  signal?: AbortSignal,
): Promise<{
  success: boolean
  results?: BraveSearchResult[]
  error?: string
  code?: 'not_configured' | 'invalid_key' | 'rate_limited' | 'service_unavailable'
  provider?: string
  summary?: string
  query: string
  total_results?: number
}> {
  const apiKey = (await getBraveApiKey()) || process.env.BRAVE_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'Brave Search needs an API key. Add your own in Settings → Agents and tools → Web search. Claude and ChatGPT sign-ins do not include this key.',
      code: 'not_configured',
      query,
    }
  }

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      error: 'Search query cannot be empty',
      query,
    }
  }

  try {
    // Add 2 second delay to avoid rate limits
    await delay(2000, undefined, { signal })

    const baseUrl = 'https://api.search.brave.com/res/v1/web/search'
    const searchParams = new URLSearchParams({
      q: query.trim(),
      count: (options.count || 10).toString(),
      offset: (options.offset || 0).toString(),
      safesearch: options.safesearch || 'moderate',
      ...(options.country && { country: options.country }),
      ...(options.search_lang && { search_lang: options.search_lang }),
      ...(options.ui_lang && { ui_lang: options.ui_lang }),
      ...(options.spellcheck !== undefined && { spellcheck: options.spellcheck.toString() }),
      ...(options.result_filter && { result_filter: options.result_filter }),
      ...(options.goggles_id && { goggles_id: options.goggles_id }),
      ...(options.units && { units: options.units }),
      ...(options.extra_snippets !== undefined && { extra_snippets: options.extra_snippets.toString() }),
      ...(options.summary !== undefined && { summary: options.summary.toString() }),
    })

    const response = await fetch(`${baseUrl}?${searchParams}`, {
      signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    })

    if (!response.ok) {
      await response.body?.cancel()
      return {
        success: false,
        error: response.status === 429 ? 'Brave Search reached its rate or usage limit. Try again later or check the Brave account allowance.' : [401,403].includes(response.status) ? 'Brave Search rejected its API key. Check the key and its search subscription in Settings → Agents and tools → Web search.' : 'Brave Search is temporarily unavailable. Try again later.',
        code: response.status === 429 ? 'rate_limited' : [401,403].includes(response.status) ? 'invalid_key' : 'service_unavailable',
        query,
      }
    }

    const data = (await response.json()) as BraveSearchResponse

    // Extract web results
    const webResults = data.web?.results || []
    const newsResults = data.news?.results || []

    // Combine and format results
    const allResults: BraveSearchResult[] = [
      ...webResults.map(result => ({
        title: result.title,
        url: result.url,
        description: result.description,
        age: result.age,
        language: result.language,
      })),
      ...newsResults.map(result => ({
        title: result.title,
        url: result.url,
        description: result.description,
        age: result.age,
      })),
    ]

    return {
      success: true,
      results: allResults,
      query,
      total_results: allResults.length,
    }
  } catch (error) {
    return {
      success: false,
      error: 'Brave Search could not connect. Check the internet connection and try again.',
      code: 'service_unavailable',
      query,
    }
  }
}
