import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/** Run immediately after document load, before the ordinary workspace audit. */
export async function auditHadronEntry(window:BrowserWindow,profile:string){
 const start=await window.webContents.executeJavaScript(`(async()=>{
  const entry=()=>document.querySelector('[data-hadron-entry]');
  for(let i=0;i<60&&!entry()?.dataset.logoReadyAt;i++)await new Promise(resolve=>setTimeout(resolve,50));
  const start=Number(entry()?.dataset.logoReadyAt),logo=entry()?.querySelector('img'),tagline=entry()?.querySelector('[data-hadron-tagline]');
  if(!Number.isFinite(start)||!logo?.naturalWidth)throw Error('Hadron entry logo did not load');
  if(tagline?.textContent!=="Where AI's Collide"||tagline.getBoundingClientRect().top<logo.getBoundingClientRect().bottom)throw Error('Startup tagline missing or not below the logo');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return start;
 })()`)
 fs.writeFileSync(path.join(profile,'entry-tagline.png'),(await window.webContents.capturePage()).toPNG())
 const result=await window.webContents.executeJavaScript(`(async()=>{
  const start=${JSON.stringify(start)},entry=()=>document.querySelector('[data-hadron-entry]');
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,2500-(performance.now()-start))));
  if(!entry())throw Error('Opening logo disappeared before the requested minimum');
  for(let i=0;i<200&&entry();i++)await new Promise(resolve=>setTimeout(resolve,50));
  const elapsedMs=performance.now()-start;
  if(entry()||elapsedMs<3950)throw Error('Opening screen timing or workspace transition failed');
  return {success:true,logoLoaded:true,tagline:"Where AI's Collide",taglineBelowLogo:true,visibleAt2500ms:true,minimumDisplayMs:4000,elapsedMs:Math.round(elapsedMs)};
 })()`)
 fs.writeFileSync(path.join(profile,'entry-result.json'),JSON.stringify(result,null,2))
}
