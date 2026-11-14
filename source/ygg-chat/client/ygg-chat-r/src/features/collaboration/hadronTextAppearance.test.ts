import { afterEach, expect, it, vi } from 'vitest'
import { applyHadronTextAppearance, savedHadronTextAppearance, normaliseHadronTextAppearance } from './hadronTextAppearance'
afterEach(() => vi.unstubAllGlobals())
it('ignores invalid stored colours and restores readable defaults', () => {
  expect(normaliseHadronTextAppearance({ mode: 'bad', light: 'url(example)', dark: '#fff' })).toEqual({mode:'auto',light:'#202020',dark:'#f5f5f5'})
  vi.stubGlobal('localStorage',{getItem:()=>'{broken'})
  expect(savedHadronTextAppearance().mode).toBe('auto')
})
it('persists text choices separately from palette and clears the override on reset', () => {
  const values = new Map<string,string>(), properties = new Map<string,string>()
  const root = {dataset:{} as Record<string,string>,style:{setProperty:(key:string,value:string)=>properties.set(key,value)}}
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key),setItem:(key:string,value:string)=>values.set(key,value)})
  vi.stubGlobal('document',{documentElement:root});vi.stubGlobal('window',{dispatchEvent:vi.fn()})
  applyHadronTextAppearance({mode:'contrast',light:'#123456',dark:'#abcdef'},true)
  expect(root.dataset.hadronText).toBe('contrast');expect(properties.get('--hadron-reading-light')).toBe('#000000');expect(properties.get('--hadron-reading-dark')).toBe('#ffffff')
  expect(values.has('hadron:palette')).toBe(false)
  applyHadronTextAppearance({mode:'custom',light:'#123456',dark:'#abcdef'},true)
  expect(savedHadronTextAppearance().light).toBe('#123456')
  applyHadronTextAppearance({...savedHadronTextAppearance(),mode:'auto'},true)
  expect(root.dataset.hadronText).toBeUndefined()
})
