import { useEffect, useState } from 'react'
import { applyHadronPalette, hadronPalettes, savedHadronPalette } from '../../features/collaboration/hadronPalettes'
import { setCustomChatThemeEnabled } from '../ThemeManager/themeConfig'
export function HadronPalettePicker() {
  const [selected,setSelected] = useState(savedHadronPalette)
  useEffect(() => { const changed=()=>setSelected(savedHadronPalette()); window.addEventListener('hadron-palette-changed',changed); return()=>window.removeEventListener('hadron-palette-changed',changed) },[])
  return <label className='block text-sm'>Hadron colours<select aria-label='Hadron colours' className='ml-2 rounded-xl border bg-transparent px-3 py-2 text-sm' value={selected} onChange={event=>{setCustomChatThemeEnabled(false); applyHadronPalette(event.target.value,true);setSelected(event.target.value)}}>{hadronPalettes.map(palette=><option key={palette.id} value={palette.id}>{palette.name}</option>)}</select></label>
}
