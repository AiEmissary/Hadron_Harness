import { useEffect, useState } from 'react'
import { HadronPalettePicker } from './HadronPalettePicker'
import { applyHadronTextAppearance, defaultHadronTextAppearance, savedHadronTextAppearance, type HadronTextAppearance } from '../../features/collaboration/hadronTextAppearance'

export function HadronAppearance() {
  const [text, setText] = useState(savedHadronTextAppearance)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system')
  useEffect(() => {
    const changed = () => setText(savedHadronTextAppearance())
    window.addEventListener('hadron-text-appearance-changed', changed)
    return () => window.removeEventListener('hadron-text-appearance-changed', changed)
  }, [])
  const update = (next: HadronTextAppearance) => { applyHadronTextAppearance(next, true); setText(next) }
  return <div className='space-y-5' data-hadron-appearance-controls>
    <div className='flex flex-wrap items-center gap-5'>
      <HadronPalettePicker />
      <label className='text-sm'>Display mode <select aria-label='Display mode' value={theme} className='ml-2 rounded-xl border bg-transparent px-3 py-2' onChange={event => {
        const next = event.target.value
        localStorage.setItem('theme', next); setTheme(next)
        window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: next }))
      }}><option value='system'>Follow system</option><option value='light'>Light</option><option value='dark'>Dark</option></select></label>
    </div>
    <p className='text-sm'>Hadron colours set the workspace panels and buttons. Each palette includes light and dark colours.</p>
    <div className='space-y-3 rounded-xl border p-4'>
      <label className='block font-semibold'>Workspace text colour <select aria-label='Workspace text colour' value={text.mode} className='ml-2 rounded-xl border bg-transparent px-3 py-2 text-sm' onChange={event => update({ ...text, mode: event.target.value as HadronTextAppearance['mode'] })}>
        <option value='auto'>Automatic — follow theme</option><option value='contrast'>High contrast — black / white</option><option value='custom'>Custom colours</option>
      </select></label>
      <p className='text-sm'>Applies to ordinary conversation text and headings across the workspace. Code highlighting, links, status colours and button labels keep their own colours.</p>
      {text.mode === 'custom' && <div className='flex flex-wrap gap-5'>
        {(['light', 'dark'] as const).map(mode => <label key={mode} className='flex items-center gap-2 text-sm'>Text in {mode} mode <input type='color' aria-label={`Workspace text in ${mode} mode`} value={text[mode]} onChange={event => update({ ...text, [mode]: event.target.value })} /><span>{text[mode]}</span></label>)}
        <p className='w-full text-sm'>Choose dark text for pale panels and light text for dark panels. Use Automatic to return to the palette’s readable defaults.</p>
      </div>}
      <div aria-label='Text colour preview' className='rounded-xl border p-4' style={{ color: text.mode === 'auto' ? undefined : document.documentElement.classList.contains('dark') ? (text.mode === 'contrast' ? '#ffffff' : text.dark) : (text.mode === 'contrast' ? '#000000' : text.light) }}>Your questions, answers and project conclusions will use this text style.</div>
      <button type='button' className='rounded-xl border px-3 py-2 text-sm' onClick={() => update({ ...defaultHadronTextAppearance })}>Reset text colours</button>
    </div>
  </div>
}
