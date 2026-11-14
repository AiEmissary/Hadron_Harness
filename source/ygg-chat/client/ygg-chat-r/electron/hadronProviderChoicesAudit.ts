import type {BrowserWindow} from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export async function auditHadronProviderChoices(window:BrowserWindow,profile:string,setConnected:(value:boolean)=>void){
 const run=(code:string)=>window.webContents.executeJavaScript(code)
 const wait=async(code:string)=>{for(let i=0;i<120;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,100))}throw Error('Provider refresh timeout: '+code)}
 await run(`globalThis.providerButton=text=>Array.from(document.querySelectorAll('[data-collaboration-dock] button')).find(b=>b.textContent.trim()===text);globalThis.selectProvider=(label,value)=>{const s=document.querySelector('select[aria-label="'+label+'"]');if(!s||s.matches(':disabled'))throw Error('Disabled selector '+label);const o=Array.from(s.options).find(o=>o.value===value);if(!o||o.disabled)throw Error('Unavailable option '+label+':'+value);s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}))};providerButton('Work together').click()`)
 await wait(`!!providerButton('Refresh providers and models')&&!providerButton('Refresh providers and models').disabled`)
 setConnected(false)
 await run(`providerButton('Refresh providers and models').click()`)
 await wait(`!!providerButton('Refresh providers and models')&&document.querySelector('select[aria-label="Agent A provider"] option[value="openaichatgpt"]').disabled&&document.querySelector('select[aria-label="Agent A provider"] option[value="claudecode"]').disabled`)
 // The connection card must invalidate an earlier disconnected workflow result.
 setConnected(true)
 await run(`providerButton('Check ChatGPT').click();providerButton('Check Claude').click()`)
 await wait(`!!providerButton('Refresh providers and models')&&!document.querySelector('select[aria-label="Agent A provider"] option[value="openaichatgpt"]').disabled&&!document.querySelector('select[aria-label="Agent A provider"] option[value="claudecode"]').disabled`)
 const modes=[['Work together','Agent A','Agent B'],['Independent jobs','Agent A job','Agent B job'],['Build a project','Project Agent A','Project Agent B'],['Automatic conversation','Conversation Agent A','Conversation Agent B']]
 for(const [mode,a,b] of modes){
  await run(`providerButton(${JSON.stringify(mode)}).click()`)
  for(const [label,provider,model] of [[a,'openaichatgpt','fixture-model'],[b,'claudecode','fixture-claude']]){
   await run(`selectProvider(${JSON.stringify(label+' provider')},${JSON.stringify(provider)})`)
   await wait(`!!document.querySelector(${JSON.stringify('select[aria-label="'+label+' model"] option[value="'+model+'"]')})`)
   await run(`selectProvider(${JSON.stringify(label+' model')},${JSON.stringify(model)})`)
   await wait(`document.querySelector(${JSON.stringify('select[aria-label="'+label+' model"]')}).value===${JSON.stringify(model)}`)
  }
 }
 // Rechecking account availability must not replace any prepared task or choices.
 await run(`providerButton('Work together').click();const task=document.querySelector('textarea[aria-label="Shared task"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(task,'PRESERVED_UNSENT_TASK');task.dispatchEvent(new Event('input',{bubbles:true}))`)
 await wait(`document.querySelector('textarea[aria-label="Shared task"]').value==='PRESERVED_UNSENT_TASK'`)
 await run(`providerButton('Refresh providers and models').click()`)
 await wait(`!!providerButton('Refresh providers and models')`)
 if(!await run(`document.querySelector('textarea[aria-label="Shared task"]').value==='PRESERVED_UNSENT_TASK'&&document.querySelector('select[aria-label="Agent B provider"]').value==='claudecode'&&document.querySelector('select[aria-label="Agent B model"]').value==='fixture-claude'`))throw Error('Provider refresh discarded prepared task or choices')
 fs.writeFileSync(path.join(profile,'provider-choices-result.json'),JSON.stringify({success:true,staleDisconnectedChoicesRecovered:true,connectionChecksRefreshChoices:true,modesTested:4,bothProvidersAndModelsSelectable:true,refreshPreservesUnsentTaskAndSelections:true,realProviderRequests:0},null,2))
}
