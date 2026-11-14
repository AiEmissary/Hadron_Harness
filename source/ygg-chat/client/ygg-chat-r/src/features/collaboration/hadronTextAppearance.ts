export type HadronTextAppearance = { mode: 'auto' | 'contrast' | 'custom'; light: string; dark: string }
export const defaultHadronTextAppearance: HadronTextAppearance = { mode: 'auto', light: '#202020', dark: '#f5f5f5' }
export function normaliseHadronTextAppearance(value: unknown): HadronTextAppearance {
  const input = value as Partial<HadronTextAppearance> | null
  const colour = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
  return { mode: input?.mode === 'contrast' || input?.mode === 'custom' ? input.mode : 'auto', light: colour(input?.light, defaultHadronTextAppearance.light), dark: colour(input?.dark, defaultHadronTextAppearance.dark) }
}
export function savedHadronTextAppearance(): HadronTextAppearance {
  try { return normaliseHadronTextAppearance(JSON.parse(localStorage.getItem('hadron:text-appearance') || 'null')) } catch { return { ...defaultHadronTextAppearance } }
}
export function applyHadronTextAppearance(value: HadronTextAppearance, persist = false) {
  const settings = normaliseHadronTextAppearance(value)
  const root = document.documentElement
  if (settings.mode === 'auto') delete root.dataset.hadronText
  else root.dataset.hadronText = settings.mode
  root.style.setProperty('--hadron-reading-light', settings.mode === 'contrast' ? '#000000' : settings.light)
  root.style.setProperty('--hadron-reading-dark', settings.mode === 'contrast' ? '#ffffff' : settings.dark)
  if (persist) { try { localStorage.setItem('hadron:text-appearance', JSON.stringify(settings)) } catch { /* Session still changes. */ } }
  window.dispatchEvent(new Event('hadron-text-appearance-changed'))
}
