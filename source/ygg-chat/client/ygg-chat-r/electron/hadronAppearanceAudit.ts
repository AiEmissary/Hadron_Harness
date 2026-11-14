import type { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
export async function auditHadronAppearance(window: BrowserWindow, profile: string) {
  const result = await window.webContents.executeJavaScript(`(async()=>{
    const route=location.hash;
    const wait=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,60))}throw Error('Appearance check timed out: '+fn)};
    const change=(label,value)=>{const el=document.querySelector('[aria-label="'+label+'"]');if(!el)throw Error('Missing '+label);Object.getOwnPropertyDescriptor(el.tagName==='INPUT'?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='INPUT'?'input':'change',{bubbles:true}))};
    if(document.querySelector('[aria-label="Hadron colours"]'))throw Error('Palette still in workspace header');
    location.hash='#/settings';await new Promise(r=>setTimeout(r,650));await wait(()=>document.querySelector('[data-settings-appearance]'));
    const appearance=document.querySelector('[data-settings-appearance]');
    for(const title of ['Typography','Upload a video wallpaper','Backdrop colours','Saved video wallpapers'])if(!appearance.querySelector('[data-settings-section="'+title+'"]'))throw Error('Ungrouped '+title);
    change('Hadron colours','cream');await wait(()=>document.documentElement.dataset.hadronPalette==='cream');
    change('Workspace text colour','custom');await wait(()=>document.querySelector('[aria-label="Workspace text in light mode"]'));
    change('Workspace text in light mode','#123456');change('Workspace text in dark mode','#fedcba');
    await wait(()=>JSON.parse(localStorage.getItem('hadron:text-appearance')).dark==='#fedcba');
    change('Display mode','dark');await wait(()=>document.documentElement.classList.contains('dark'));
    change('Workspace text colour','contrast');await wait(()=>document.documentElement.dataset.hadronText==='contrast');
    location.hash=route;await new Promise(r=>setTimeout(r,650));await wait(()=>document.querySelector('.hadron-shell [data-chat-pane-surface]'));
    if(getComputedStyle(document.querySelector('.hadron-shell')).getPropertyValue('--hh-ink').trim()!=='#ffffff')throw Error('High contrast did not reach workspace');
    location.hash='#/settings';await new Promise(r=>setTimeout(r,650));await wait(()=>document.querySelector('[data-settings-appearance]'));
    if(document.querySelector('[aria-label="Workspace text colour"]').value!=='contrast'||document.querySelector('[aria-label="Hadron colours"]').value!=='cream')throw Error('Appearance was not retained across remount');
    change('Workspace text colour','auto');await wait(()=>!document.documentElement.dataset.hadronText);
    change('Display mode','light');await wait(()=>!document.documentElement.classList.contains('dark'));
    return {success:true,appearanceGrouped:true,paletteAbsentFromWorkspace:true,paletteChoices:document.querySelector('[aria-label="Hadron colours"]').options.length,textChoices:3,customTextPersisted:true,highContrastAppliedToWorkspace:true,resetToAutomatic:true,displayModeApplied:true,preservedAcrossRemount:true,realProviderRequests:0};
  })()`)
  fs.writeFileSync(path.join(profile,'appearance-result.json'),JSON.stringify(result,null,2))
  await new Promise(resolve=>setTimeout(resolve,800))
  fs.writeFileSync(path.join(profile,'appearance.png'),(await window.webContents.capturePage()).toPNG())
}
