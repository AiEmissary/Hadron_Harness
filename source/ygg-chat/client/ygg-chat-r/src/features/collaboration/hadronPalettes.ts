export const hadronPalettes = [
  { id: 'original', name: 'Hadron Violet', light: [], dark: [], face: '', selected: '', accent: '', secondary: '' },
  { id: 'cream', name: 'Cream & Honey', light: ['#f2eadb','#fffdf6','#faf2df','#d7c5a2','#493a25','#76664c'], dark: ['#241e16','#30281e','#3a3023','#6e5a3a','#fff1d6','#d0bda0'], face: 'linear-gradient(120deg,#fff4c9,#f4dfb1,#f4e8cf)', selected: 'linear-gradient(120deg,#f8dda0,#eac58f,#f3d5a9)', accent: '#956125', secondary: '#9a713c' },
  { id: 'cocoa', name: 'Cocoa & Caramel', light: ['#eae0d8','#fcf7f2','#f1e6dc','#cbb3a0','#4a3228','#806354'], dark: ['#211916','#30231e','#3b2b24','#725044','#f7e8dc','#d0b0a0'], face: 'linear-gradient(120deg,#f4e0cb,#e5c8b1,#f0dac8)', selected: 'linear-gradient(120deg,#e7c19e,#d5aa90,#e7c0ae)', accent: '#8b5039', secondary: '#a16b37' },
  { id: 'rose', name: 'Rose Red', light: ['#f5e5e4','#fff9f7','#fbeeed','#ddb5b5','#572f34','#895e63'], dark: ['#28191d','#382329','#452c32','#794a53','#ffe8e9','#daaeb4'], face: 'linear-gradient(120deg,#ffe5dc,#f8cccc,#f6d9e2)', selected: 'linear-gradient(120deg,#f8beb4,#eda6b0,#efbdce)', accent: '#ad4051', secondary: '#b36143' },
  { id: 'ocean', name: 'Ocean Blue', light: ['#e0edf4','#f8fcff','#eaf4fa','#abc8da','#23445b','#57788d'], dark: ['#14212b','#1c2e3d','#263c4c','#466c86','#e1f4ff','#a7c8dc'], face: 'linear-gradient(120deg,#d3f4fc,#bfdff6,#d9e7ff)', selected: 'linear-gradient(120deg,#9ce0ee,#9fc6ed,#bdcff8)', accent: '#326da0', secondary: '#198596' },
] as const
const keys = ['bg','panel','soft','line','ink','muted']
export function savedHadronPalette() {
  try { const id = localStorage.getItem('hadron:palette'); return hadronPalettes.some(p => p.id === id) ? id! : 'original' } catch { return 'original' }
}
export function applyHadronPalette(id: string, persist = false) {
  const palette = hadronPalettes.find(p => p.id === id) ?? hadronPalettes[0]
  const root = document.documentElement
  if (palette.id === 'original') {
    delete root.dataset.hadronPalette
    for(const key of [...keys,...keys.map(key=>'dark-'+key),'face','selected','accent','secondary'])root.style.removeProperty('--hp-'+key)
  }
  else {
    root.dataset.hadronPalette = palette.id
    keys.forEach((key,index) => { root.style.setProperty('--hp-'+key,palette.light[index]); root.style.setProperty('--hp-dark-'+key,palette.dark[index]) })
    root.style.setProperty('--hp-face',palette.face); root.style.setProperty('--hp-selected',palette.selected)
    root.style.setProperty('--hp-accent',palette.accent); root.style.setProperty('--hp-secondary',palette.secondary)
  }
  if (persist) { try { localStorage.setItem('hadron:palette',palette.id) } catch { /* Current session still changes. */ } }
  window.dispatchEvent(new Event('hadron-palette-changed'))
}
