import type { Request } from 'express'
import { HADRON_LIVE_COLLABORATION_ENABLED } from '../../../../../../shared/collaboration.js'
import type { ProviderGenerateInput, ProviderGenerateOutput, ProviderStreamEventHandler } from '../../providers/openRouterProvider.js'

/** In-process host boundary: HTTP callers cannot install an authenticator or issue grants. */
export function createDesktopCollaborationHost(enabled: () => boolean) {
  let authenticate: ((req: Request) => string | null) | undefined
  let nativeGenerate: ((input: ProviderGenerateInput, emit?: ProviderStreamEventHandler) => Promise<ProviderGenerateOutput>) | undefined
  let nativeClaude:typeof nativeGenerate
  return {
    allowedModels: new Set<string>(),
    allowedClaudeModels:new Set<string>(),
    installNativeClaude(generate:NonNullable<typeof nativeGenerate>){nativeClaude=generate},
    generateClaude(input:ProviderGenerateInput,emit?:ProviderStreamEventHandler){if(!enabled()||!nativeClaude)throw Error('Hadron Claude provider unavailable');return nativeClaude(input,emit)},
    installNativeProvider(generate: NonNullable<typeof nativeGenerate>): void { nativeGenerate = generate },
    get hasNativeProvider(): boolean { return !!nativeGenerate },
    generate(input: ProviderGenerateInput, emit?: ProviderStreamEventHandler) {
      if (!enabled() || !nativeGenerate) throw new Error('Hadron native provider unavailable')
      return nativeGenerate(input, emit)
    },
    install(authenticator: (req: Request) => string | null): void { authenticate = authenticator },
    authenticatedOwner(req: Request): string | null {
      if (!enabled() || !authenticate) return null
      return authenticate(req)
    },
  }
}

export const desktopCollaborationHost = createDesktopCollaborationHost(() => HADRON_LIVE_COLLABORATION_ENABLED)
