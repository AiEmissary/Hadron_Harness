export type HadronProvider = 'openaichatgpt' | 'claudecode'
export const isHadronProvider = (value: unknown): value is HadronProvider => value === 'openaichatgpt' || value === 'claudecode'
export interface HadronModelAdmission { allowedModels: ReadonlySet<string>; admitModel?(provider: HadronProvider, model: string): boolean }
export const admittedHadronModel = (host: HadronModelAdmission, provider: HadronProvider, model: string): boolean =>
  host.admitModel ? host.admitModel(provider, model) : provider === 'openaichatgpt' && host.allowedModels.has(model)
