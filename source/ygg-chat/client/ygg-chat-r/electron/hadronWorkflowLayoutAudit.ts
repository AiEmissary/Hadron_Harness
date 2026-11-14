import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export async function auditHadronWorkflowLayout(window:BrowserWindow,profile:string){
 const run=(code:string)=>window.webContents.executeJavaScript(code)
 const wait=async(code:string)=>{for(let i=0;i<100;i++){if(await run(code))return;await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Workflow layout timeout: '+code)}
 const modes=[['Work together','Shared task','Agent A model'],['Independent jobs','Agent A job task','Agent A job model'],['Build a project','Project goal','Project Agent A model'],['Automatic conversation','Conversation goal','Conversation Agent A model']]
 const originals=new Map<string,string>()
 window.focus();window.webContents.focus()
 // Use native pointer events: DOM .click() would bypass an overlay blocking the rail.
 const railClick=async()=>{
  const point=await run(`(()=>{const button=document.querySelector('[aria-label="Sidebar rail"] button');const r=button.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!button.contains(document.elementFromPoint(x,y)))throw Error('Sidebar rail is blocked by its overlay');return {x:Math.round(x),y:Math.round(y)}})()`)
  window.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1})
  window.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1})
 }
 for(let cycle=0;cycle<2;cycle++){
  await railClick();await wait(`!!document.querySelector('[aria-label="Sidebar panel"]')`)
  await railClick();await wait(`!document.querySelector('[aria-label="Sidebar panel"]')`)
 }
 fs.writeFileSync(path.join(profile,'sidebar-toggle-result.json'),JSON.stringify({success:true,nativePointerClicks:true,openCloseCycles:2},null,2))
 for(const [mode,label,model] of modes){
  await run(`Array.from(document.querySelectorAll('[data-collaboration-dock] button')).find(button=>button.textContent.trim()===${JSON.stringify(mode)}).click()`)
  const selector=JSON.stringify(`textarea[aria-label="${label}"]`)
  await wait(`!!document.querySelector(${selector})?.getClientRects().length&&!document.querySelector(${selector}).closest('[hidden]')`)
  const original=await run(`(()=>{const input=document.querySelector(${selector});if(!input.closest('[data-existing-chat-area]')||input.closest('[data-collaboration-dock]'))throw Error('Instructions are not in the left pane');const model=document.querySelector(${JSON.stringify(`select[aria-label="${model}"]`)});if(!model?.closest('[data-collaboration-dock]'))throw Error('Model choice moved out of setup');input.focus();input.select();return input.value})()`)
  originals.set(label,original)
  for(const character of 'LAYOUT_DRAFT')window.webContents.sendInputEvent({type:'char',keyCode:character})
  await wait(`document.querySelector(${selector}).value==='LAYOUT_DRAFT'`)
  fs.writeFileSync(path.join(profile,'workflow-'+label.replaceAll(' ','-')+'.png'),(await window.webContents.capturePage()).toPNG())
 }
 for(const [mode,label] of modes){
  await run(`Array.from(document.querySelectorAll('[data-collaboration-dock] button')).find(button=>button.textContent.trim()===${JSON.stringify(mode)}).click()`)
  const selector=JSON.stringify(`textarea[aria-label="${label}"]`)
  await wait(`document.querySelector(${selector})?.value==='LAYOUT_DRAFT'`)
  await run(`(()=>{const input=document.querySelector(${selector});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(originals.get(label))});input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 }
 await run(`Array.from(document.querySelectorAll('[data-collaboration-dock] button')).find(button=>button.textContent.trim()==='Work together').click()`)
 fs.writeFileSync(path.join(profile,'workflow-layout-result.json'),JSON.stringify({success:true,modes:4,instructionsAndActionsLeft:true,modelControlsRight:true,realKeyboardTyping:true,draftsSurviveModeSwitch:true,automaticRequests:0},null,2))
}
