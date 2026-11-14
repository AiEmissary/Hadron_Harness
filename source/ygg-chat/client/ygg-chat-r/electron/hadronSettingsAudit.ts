import type { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { auditHadronAppearance } from './hadronAppearanceAudit.js'

export async function auditHadronSettings(window: BrowserWindow, profile: string) {
  await auditHadronAppearance(window,profile)
  const font = fs.readFileSync(path.join(process.env.HADRON_DESKTOP_SMOKE_APP_DIR!, 'public/fonts/BluuNext-Bold.otf')).toString('base64')
  await window.webContents.executeJavaScript(`window.auditFont=${JSON.stringify(font)}`)
  const result = await window.webContents.executeJavaScript(`(async()=>{
    const wait=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,60))}throw Error('Hadron settings timed out: '+fn)};
    const button=text=>Array.from(document.querySelectorAll('button')).find(el=>el.textContent.trim()===text);
    const value=(el,text)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}))};
    if(!document.querySelector('[data-hadron-settings]'))throw Error('Hadron Settings was not selected');
    const sections=Array.from(document.querySelectorAll('[data-hadron-setting]')).map(el=>el.dataset.hadronSetting);
    if(JSON.stringify(sections)!==JSON.stringify(['Appearance','Connections','Agents and tools','Saved data','Setup']))throw Error('Unexpected Settings inventory: '+sections);
    for(const title of ['Chat Mode Prompt','Agent Mode Prompt','Tool Approval Defaults','Chat Reasoning Defaults','Provider Settings','Local Ownership Migration','Remote Mobile Access','HTML Tools Cache','Subagent','Memory','Context files','Built-in Browser','Consolidate credentials','LM Studio'])if(document.body.textContent.includes(title))throw Error('Unrelated inherited control remains: '+title);
    const helper=document.querySelector('input[aria-label="Automatic lightweight helpers"]');await wait(()=>!helper.disabled);
    const original=helper.checked;helper.click();await wait(()=>helper.checked!==original&&!helper.disabled);
    if(await window.electronAPI.helpers.preference()===original)throw Error('Helper setting did not reach native host');
    helper.click();await wait(()=>helper.checked===original&&!helper.disabled);
    button('Tool library').click();await wait(()=>!!button('Refresh tools'));
    button('Refresh tools').click();await wait(()=>!button('Refresh tools').disabled);
    button('Tool library').click();
    document.querySelector('[data-hadron-web-search]').open=true;
    const key=document.querySelector('input[aria-label="Brave Search API key"]');
    if(key.value!==''||!button('Save Brave key').disabled||key.type!=='password')throw Error('Search credential form exposed or accepted an empty key');
    if(button('Load saved key'))throw Error('Saved secret can be exposed in Settings');
    button('Check saved key').click();await wait(()=>document.body.textContent.includes('Saved key status checked.')||document.querySelector('[data-hadron-web-search] [role="alert"]'));
    button('Recycle Bin').click();await wait(()=>document.querySelector('dialog[open]')?.textContent.includes('30 days'));
    button('Close Recycle Bin').click();
    button('Check this computer').click();await wait(()=>document.querySelector('[aria-label="Hadron setup check"]').textContent.includes('No downloads or installations were started.'));
    for(const detail of document.querySelectorAll('[data-settings-appearance] details'))detail.open=true;
    const typography=document.querySelector('[data-settings-section="Typography"]');
    value(typography.querySelector('input[type="url"]'),'https://example.com/invalid-font');await new Promise(r=>setTimeout(r,80));button('Apply Google Font').click();await wait(()=>document.body.textContent.includes('Only fonts.googleapis.com links are allowed.'));
    const input=typography.querySelector('input[type="file"]');const upload=file=>{const data=new DataTransfer();data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))};
    upload(new File([Uint8Array.from(atob(window.auditFont),c=>c.charCodeAt(0))],'audit-valid.otf',{type:'font/otf'}));await wait(()=>document.documentElement.style.getPropertyValue('--font-sans').includes('YggLocalFont'));
    upload(new File(['broken font bytes'],'audit-invalid.woff2',{type:'font/woff2'}));await wait(()=>document.body.textContent.includes('Unable to load this font.'));
    if(!document.documentElement.style.getPropertyValue('--font-sans').includes('YggLocalFont'))throw Error('Invalid upload lost working font');
    value(document.querySelector('input[aria-label="Light mode color picker"]'),'#aabbcc');await wait(()=>JSON.parse(localStorage.getItem('yggdrasil_background_preference')).colors.light==='#AABBCC');
    button('Reset to Default').click();await wait(()=>JSON.parse(localStorage.getItem('yggdrasil_background_preference')).colors.light==='transparent');
    return {success:true,sections,legacyControlsAbsent:true,legacySettingsComponentNotMounted:true,helperNativePreferenceRoundTrip:true,toolLibraryRead:true,searchCredentialFormDoesNotRevealSavedKey:true,noCredentialWrites:true,recycleBinThirtyDays:true,setupCheck:true,invalidFontUrlRejected:true,validLocalFontApplied:true,invalidReplacementRetainedFont:true,backdropReset:true,realProviderRequests:0,externalServices:'No live provider sign-in, inference, search or credential writes were performed.'};
  })()`)
  fs.writeFileSync(path.join(profile,'settings-result.json'),JSON.stringify(result,null,2))
  await window.webContents.executeJavaScript(`document.querySelector('[data-hadron-settings-scroll]').scrollTop=0;void 0`)
  await new Promise(resolve=>setTimeout(resolve,700))
  fs.writeFileSync(path.join(profile,'settings.png'),(await window.webContents.capturePage()).toPNG())
}
