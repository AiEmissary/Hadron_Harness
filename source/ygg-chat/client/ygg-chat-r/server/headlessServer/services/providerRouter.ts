import { HyperRouterBedrockProvider } from '../providers/hyperRouterBedrockProvider.js'
import { HyperRouterZaiProvider } from '../providers/hyperRouterZaiProvider.js'
import { LmStudioProvider } from '../providers/lmStudioProvider.js'
import {
  OpenAiChatgptProvider,
  resolveOpenAIChatGPTContextLength,
} from '../providers/openaiChatgptProvider.js'
import {
  OpenRouterProvider,
  type HeadlessProvider,
  type ProviderGenerateInput,
  type ProviderGenerateOutput,
  type ProviderStreamEventHandler,
} from '../providers/openRouterProvider.js'
import type { ProviderTokenStore } from '../providers/tokenStore.js'
import type { AppAuthTokenManager } from './appAuthTokenManager.js'
import { desktopCollaborationHost } from './collaboration/desktopHost.js'

export type ProviderRoute = 'openrouter' | 'openaichatgpt' | 'lmstudio' | 'zai' | 'bedrock' | 'claudecode'

export function normalizeProviderRoute(providerName: string): ProviderRoute {
  const normalized = providerName.trim().toLowerCase().replace(/\s+/g, '')
  if(normalized==='claudecode')return 'claudecode'
  if (normalized === 'openaichatgpt' || normalized === 'openai(chatgpt)' || normalized === 'openai') {
    return 'openaichatgpt'
  }
  if (normalized === 'lmstudio') return 'lmstudio'
  if (normalized === 'zai' || normalized === 'z.ai' || normalized === 'glm' || normalized === 'glmprovider' || normalized === 'z.ai/glm' || normalized === 'zai/glm') return 'zai'
  if (
    normalized === 'bedrock' ||
    normalized === 'awsbedrock' ||
    normalized === 'aws/bedrock' ||
    normalized === 'aws-bedrock' ||
    normalized === 'amazonbedrock' ||
    normalized === 'amazon-bedrock'
  ) {
    return 'bedrock'
  }
  if (normalized === 'openrouter') return 'openrouter'
  // MVP default path is OpenAI ChatGPT.
  return 'openaichatgpt'
}

interface ProviderRouterDeps {
  tokenStore?: ProviderTokenStore
  appAuth?: AppAuthTokenManager
}

export class ProviderRouter {
  private readonly providers: Record<Exclude<ProviderRoute,'claudecode'>, HeadlessProvider>

  constructor(deps: ProviderRouterDeps = {}) {
    this.providers = {
      openrouter: new OpenRouterProvider({ tokenStore: deps.tokenStore, appAuth: deps.appAuth }),
      openaichatgpt: new OpenAiChatgptProvider({ tokenStore: deps.tokenStore }),
      lmstudio: new LmStudioProvider(),
      zai: new HyperRouterZaiProvider({ tokenStore: deps.tokenStore }),
      bedrock: new HyperRouterBedrockProvider({ tokenStore: deps.tokenStore }),
    }
  }

  resolveContextLength(providerName: string, requestedContextLength: number | undefined): number | undefined {
    if (normalizeProviderRoute(providerName) === 'openaichatgpt') {
      return resolveOpenAIChatGPTContextLength(requestedContextLength)
    }
    return requestedContextLength
  }

  async generate(
    providerName: string,
    input: ProviderGenerateInput,
    emit?: ProviderStreamEventHandler
  ): Promise<ProviderGenerateOutput> {
    const route = normalizeProviderRoute(providerName)
    if(route==='claudecode'){
      if(input.requestPolicy!=='single_attempt'||input.tools?.length)throw Error('Claude requires an admitted Hadron job')
      return desktopCollaborationHost.generateClaude(input,emit)
    }
    // Trusted tool-free jobs use Hadron's native subscription. Main chat retains
    // its existing provider path; never fall back to legacy credentials on failure.
    if (route === 'openaichatgpt' && input.requestPolicy === 'single_attempt' && desktopCollaborationHost.hasNativeProvider) {
      return desktopCollaborationHost.generate(input, emit)
    }
    const provider = this.providers[route]
    return provider.generate(input, emit)
  }
}
