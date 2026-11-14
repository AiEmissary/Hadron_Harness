import type { ParticipantOption } from './setup'

/** Load providers independently: one unavailable runtime must not hide the other. */
export async function refreshProviderChoices(bridge: {
  setup(): Promise<{schemaVersion: number; ownerAvailable: boolean; liveEnabled: boolean; provider: {id: string; connected: boolean; models: Array<{id: string; label: string}>}}>
  claudeModels(): Promise<Array<{id: string; label: string}>>
}, callbacks: {
  setup(owner: boolean, live: boolean): void
  provider(option: ParticipantOption): void
  error(provider: string): void
}) {
  await Promise.allSettled([
    Promise.resolve().then(() => bridge.setup()).then(setup => {
      if (setup.schemaVersion !== 1 || setup.provider.id !== 'openaichatgpt') throw Error('Unsupported setup')
      callbacks.setup(setup.ownerAvailable, setup.liveEnabled)
      callbacks.provider({provider: 'openaichatgpt', label: 'ChatGPT', connected: setup.provider.connected,
        models: setup.provider.models, connectionLabel: setup.provider.connected
          ? setup.provider.models.length ? 'Connected. Ready for agent tasks.' : 'No task models available. Refresh providers and models to try again.'
          : 'Connect ChatGPT above to use agent tasks.'})
    }).catch(() => {callbacks.provider({provider:'openaichatgpt',label:'ChatGPT',connected:false,models:[],connectionLabel:'Connection could not be checked. Check ChatGPT in setup.'});callbacks.error('ChatGPT')}),
    Promise.resolve().then(() => bridge.claudeModels()).then(models => callbacks.provider({
      provider: 'claudecode', label: 'Claude subscription', connected: models.length > 0, models,
      connectionLabel: models.length ? 'Connected. Ready for agent tasks.' : 'Connect Claude above, then refresh providers and models.',
    })).catch(() => {callbacks.provider({provider:'claudecode',label:'Claude subscription',connected:false,models:[],connectionLabel:'Connection could not be checked. Check Claude in setup.'});callbacks.error('Claude')}),
  ])
}
