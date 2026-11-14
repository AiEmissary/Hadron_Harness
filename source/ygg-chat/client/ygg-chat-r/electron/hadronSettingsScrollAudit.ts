import type { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/** Actual Chromium wheel and keyboard scrolling in an owned temporary profile. */
export async function auditHadronSettingsScroll(window: BrowserWindow, profile: string) {
  const run=(code:string)=>window.webContents.executeJavaScript(code)
  const wait=async(condition:string)=>{for(let i=0;i<100;i++){if(await run(condition))return;await new Promise(resolve=>setTimeout(resolve,60))}throw Error('Settings scroll timed out: '+condition)}
  await run(`location.hash='#/settings';void 0`)
  await wait(`!!document.querySelector('[data-hadron-settings-scroll]')`)
  await new Promise(resolve=>setTimeout(resolve,700))
  window.unmaximize();window.setSize(1100,700)
  await new Promise(resolve=>setTimeout(resolve,400))
  await run(`for(const detail of document.querySelectorAll('[data-settings-appearance] details'))detail.open=true;document.querySelector('[data-hadron-settings-scroll]').scrollTop=0;void 0`)
  const geometry=await run(`(()=>{const s=document.querySelector('[data-hadron-settings-scroll]'),r=s.getBoundingClientRect(),n=document.querySelector('[data-hadron-settings-navigation]').getBoundingClientRect();return {x:Math.round(r.left+24),y:Math.round(r.top+r.height/2),height:s.clientHeight,total:s.scrollHeight,gutter:s.offsetWidth-s.clientWidth,navTop:n.top,navBottom:n.bottom,bottom:r.bottom,viewport:innerHeight}})()`)
  if(geometry.total<=geometry.height||geometry.gutter<=0||geometry.height<100||geometry.bottom>geometry.viewport+1)throw Error('Settings has no bounded visible scroll area: '+JSON.stringify(geometry))
  window.webContents.sendInputEvent({type:'mouseMove',x:geometry.x,y:geometry.y})
  window.webContents.sendInputEvent({type:'mouseWheel',x:geometry.x,y:geometry.y,deltaY:-550,deltaX:0,canScroll:true})
  await wait(`document.querySelector('[data-hadron-settings-scroll]').scrollTop>100`)
  const down=await run(`document.querySelector('[data-hadron-settings-scroll]').scrollTop`)
  window.webContents.sendInputEvent({type:'mouseWheel',x:geometry.x,y:geometry.y,deltaY:400,deltaX:0,canScroll:true})
  await wait(`document.querySelector('[data-hadron-settings-scroll]').scrollTop<${down}-50`)
  const navVisible=await run(`(()=>{const r=document.querySelector('[data-hadron-settings-navigation]').getBoundingClientRect();return Math.abs(r.top-${geometry.navTop})<1&&r.bottom<=document.querySelector('[data-hadron-settings-scroll]').getBoundingClientRect().top+1})()`)
  if(!navVisible)throw Error('Settings navigation scrolled out of view')
  await run(`Array.from(document.querySelectorAll('nav[aria-label="Settings sections"] button')).find(b=>b.textContent==='Setup').click()`)
  await wait(`document.querySelector('[data-hadron-settings-scroll]').scrollTop>${down}`)
  await new Promise(resolve=>setTimeout(resolve,600))
  fs.writeFileSync(path.join(profile,'settings-scrolled-down.png'),(await window.webContents.capturePage()).toPNG())
  await run(`Array.from(document.querySelectorAll('nav[aria-label="Settings sections"] button')).find(b=>b.textContent==='Appearance').click()`)
  await wait(`document.querySelector('[data-hadron-settings-scroll]').scrollTop<1`)
  await run(`document.querySelector('[data-hadron-settings-scroll]').focus();void 0`)
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'End'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'End'})
  await wait(`document.querySelector('[data-hadron-settings-scroll]').scrollTop>100`)
  await run(`Array.from(document.querySelectorAll('nav[aria-label="Settings sections"] button')).find(b=>b.textContent==='Back to top').click()`)
  await wait(`document.querySelector('[data-hadron-settings-scroll]').scrollTop<1`)
  if(!await run(`document.querySelector('.app-content').scrollTop===0`))throw Error('Hidden app shell was scrolled instead of Settings')
  fs.writeFileSync(path.join(profile,'settings-scroll-top.png'),(await window.webContents.capturePage()).toPNG())
  fs.writeFileSync(path.join(profile,'settings-scroll-result.json'),JSON.stringify({success:true,realWheelDown:true,realWheelUp:true,visibleScrollbar:true,persistentNavigation:true,sectionJumpAndReturn:true,keyboardEnd:true,backToTop:true,hiddenShellNotScrolled:true,viewport:{width:1100,height:700},expandedAppearance:true,geometry,realProviderRequests:0},null,2))
}
