import { afterEach, expect, it, vi } from 'vitest'
import { applyHadronPalette, hadronPalettes, savedHadronPalette } from './hadronPalettes'
afterEach(() => vi.unstubAllGlobals())
it('offers cream, brown, red and blue palettes with legible light and dark surfaces', () => {
  const luminance = (hex: string) => {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4)
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722
  }
  expect(hadronPalettes.map(p => p.id)).toEqual(['original','cream','cocoa','rose','ocean'])
  for (const p of hadronPalettes.filter(p => p.id!=='original')) for (const colours of [p.light,p.dark]) {
    const panel=luminance(colours[1]),ink=luminance(colours[4]),muted=luminance(colours[5])
    expect((Math.max(panel,ink)+0.05)/(Math.min(panel,ink)+0.05)).toBeGreaterThan(4.5)
    expect((Math.max(panel,muted)+0.05)/(Math.min(panel,muted)+0.05)).toBeGreaterThan(4.5)
  }
})
it('persists the selected palette and can return to the original custom-theme behaviour', () => {
  const values = new Map<string,string>(), properties = new Map<string,string>(), root = {dataset:{} as Record<string,string>,style:{removeProperty:(key:string)=>properties.delete(key),setProperty:(key:string,value:string)=>properties.set(key,value)}}
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key),setItem:(key:string,value:string)=>values.set(key,value)})
  vi.stubGlobal('document',{documentElement:root});vi.stubGlobal('window',{dispatchEvent:vi.fn()})
  applyHadronPalette('cream',true)
  expect(savedHadronPalette()).toBe('cream'); expect(root.dataset.hadronPalette).toBe('cream');expect(properties.get('--hp-bg')).toBe('#f2eadb')
  applyHadronPalette('original',true)
  expect(root.dataset.hadronPalette).toBeUndefined();expect(properties.has('--hp-bg')).toBe(false);expect(savedHadronPalette()).toBe('original')
})
