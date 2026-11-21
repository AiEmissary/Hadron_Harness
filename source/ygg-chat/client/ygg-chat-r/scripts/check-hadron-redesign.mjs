import {build} from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
const require=createRequire(import.meta.url),app=path.resolve(import.meta.dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-redesign-'))
await build({entryPoints:[path.join(app,'electron/fixtures/unifiedWorkspace.tsx')],outfile:path.join(profile,'renderer.js'),bundle:true,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}})
fs.writeFileSync(path.join(profile,'index.html'),'<html><head><link rel="stylesheet" href="renderer.css"></head><body><div id="root"></div><script src="renderer.js"></script></body></html>')
async function auditInElectron(){
 const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path')
 app.setPath('userData',process.env.HADRON_REDESIGN_PROFILE)
 await app.whenReady()
 const window=new BrowserWindow({show:false,width:1440,height:930,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}})
 try{
  await window.loadFile(path.join(process.env.HADRON_REDESIGN_PROFILE,'index.html'))
  await window.webContents.executeJavaScript('new Promise(resolve=>setTimeout(resolve,200))')
  fs.writeFileSync(path.join(process.env.HADRON_REDESIGN_PROFILE,'empty.png'),(await window.capturePage()).toPNG())
  const audit=async()=>{
   const wait=async fn=>{const end=Date.now()+10000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,50))}throw Error('Timed out: '+fn)}
   const button=label=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===label)
   const field=()=>document.querySelector('textarea[aria-label="Message"]')
   const type=value=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field(),value);field().dispatchEvent(new Event('input',{bubbles:true}))}
   const choose=(label,value)=>{const el=document.querySelector('select[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))}
   const menu=()=>document.querySelector('[aria-label="Chat setup"][role="dialog"]')
   const toggle=()=>document.querySelector('button[aria-label="Chat setup"]').click()
   const agentButton=letter=>Array.from(menu().querySelectorAll('[aria-label="Choose agent"] button')).find(button=>button.textContent.trim()==='Agent '+letter)
   await wait(()=>!!field())
   const mainBounds=field().getBoundingClientRect()
   if(mainBounds.left>window.innerWidth/2||mainBounds.top<window.innerHeight/2)throw Error('Composer moved away from bottom left')
   if(document.querySelector('select')||menu())throw Error('Setup leaked onto the main page')
   type('Question A');await wait(()=>!document.querySelector('button[aria-label="Send"]').disabled);document.querySelector('button[aria-label="Send"]').click()
   await wait(()=>document.body.textContent.includes('Reply from Agent A: Question A'))
   const workspace=()=>JSON.parse(document.querySelector('[data-fixture-state]').textContent).state
   const original=workspace().chats['chat-a']
   type('Keep this draft');toggle();await wait(()=>!!menu())
   agentButton('B').click();await wait(()=>agentButton('B').getAttribute('aria-pressed')==='true')
   const afterSwitch=workspace()
   if(afterSwitch.activeChatId!=='chat-a'||Object.keys(afterSwitch.chats).length!==1||field().value!=='Keep this draft'||
      afterSwitch.chats['chat-a'].selectedId!==original.selectedId||JSON.stringify(afterSwitch.chats['chat-a'].messages)!==JSON.stringify(original.messages))
     throw Error('Switching to Agent B changed the chat, transcript, selected branch or draft')
   agentButton('A').click();await wait(()=>agentButton('A').getAttribute('aria-pressed')==='true')
   choose('Work type','together');await wait(()=>document.querySelectorAll('select[aria-label$=" provider"]').length===2)
   if(button('Chat').getAttribute('aria-pressed')!=='true')throw Error('Permissions missing')
   button('Agent').click();await wait(()=>button('Agent').getAttribute('aria-pressed')==='true');button('Chat').click()
   choose('Work type','continuous');await wait(()=>!!document.querySelector('input[aria-label="Conversation turns"]'))
   const turns=document.querySelector('input[aria-label="Conversation turns"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(turns,'100');turns.dispatchEvent(new Event('input',{bubbles:true}))
   if(!menu().contains(turns))throw Error('Turn limit is outside pop-up')
   for(const el of document.querySelectorAll('.hadron-v2-workspace button,.hadron-v2-workspace textarea,.hadron-v2-workspace input,.hadron-v2-workspace select,.hadron-v2-menu,.hadron-v2-menu fieldset')){
    const style=getComputedStyle(el)
    if(['Top','Bottom','Left','Right'].some(side=>parseFloat(style['border'+side+'Width'])>0))throw Error('Decorative border remains on '+el.tagName)
   }
   choose('Work type','individual:a');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(()=>!menu())
   if(document.querySelector('select'))throw Error('Setup stays visible after closing pop-up')
   if(document.querySelectorAll('textarea').length!==1)throw Error('Multiple composers')
   const after=field().getBoundingClientRect();if(Math.abs(after.left-mainBounds.left)>1||Math.abs(after.bottom-mainBounds.bottom)>1)throw Error('Mode switch moved composer')
   button('How to use Hadron').click();await wait(()=>!!document.querySelector('dialog.hadron-v2-help[open]'))
   if(!document.querySelector('dialog.hadron-v2-help').textContent.includes('Continuous conversation'))throw Error('New guide is missing the shared workflow')
   document.querySelector('button[aria-label="Close guide"]').click();await wait(()=>!document.querySelector('dialog.hadron-v2-help'))
   const treeButtons=Array.from(document.querySelectorAll('.hadron-v2-tree-node'))
   treeButtons.forEach(node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true})))
   const treeMore=document.querySelector('.hadron-v2-tree-item button[aria-label="More message options"]');treeMore.click()
   await wait(()=>!!document.querySelector('.hadron-v2-tree-item [role="menu"]'))
   const copyTo=Array.from(document.querySelectorAll('.hadron-v2-tree-item [role="menuitem"]')).find(item=>item.textContent==='Copy into chat or project');copyTo.click()
   await wait(()=>JSON.parse(document.querySelector('[data-fixture-state]').textContent).info.includes('copy-to'))
   const selection=JSON.parse(JSON.parse(document.querySelector('[data-fixture-state]').textContent).info)
   if(selection.ids.length!==2)throw Error('Tree action lost selected messages')
   button('Cancel').click();await wait(()=>!document.querySelector('.hadron-v2-destination'))
   const rightClick=el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:window.innerWidth-10,clientY:window.innerHeight-10}))
   rightClick(treeButtons[0]);await wait(()=>!!document.querySelector('[aria-label="Conversation selection actions"]'))
   let context=document.querySelector('[aria-label="Conversation selection actions"]')
   if(context.getBoundingClientRect().right>window.innerWidth||context.getBoundingClientRect().bottom>window.innerHeight)throw Error('Right-click menu is clipped')
   Array.from(context.querySelectorAll('button')).find(el=>el.textContent==='Move into a new chat').click()
   await wait(()=>JSON.parse(document.querySelector('[data-fixture-state]').textContent).info.includes('move-new'))
   const moved=JSON.parse(JSON.parse(document.querySelector('[data-fixture-state]').textContent).info)
   if(moved.ids.length!==2)throw Error('Right-click lost multiple branch selection')
   await wait(()=>!!document.querySelector('.hadron-v2-destination[open]'))
   choose('Destination project','new');await wait(()=>!!document.querySelector('input[aria-label="New project name"]'))
   for(const [label,value] of [['New project name','Andromeda Profitability'],['New chat name','Selected conclusions']]){
    const el=document.querySelector('input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))
   }
   await wait(()=>document.querySelector('input[aria-label="New chat name"]').value==='Selected conclusions')
   button('Move and open').click();await wait(()=>!document.querySelector('.hadron-v2-destination'))
   const named=JSON.parse(document.querySelector('[data-fixture-state]').textContent).chosen
   if(named.projectName!=='Andromeda Profitability'||named.title!=='Selected conclusions')throw Error('New destination names were not accepted')
   const article=document.querySelector('article[data-message-id]'),text=article.querySelector('.hadron-v2-message-text'),range=document.createRange()
   range.setStart(text.firstChild,0);range.setEnd(text.firstChild,8);window.getSelection().removeAllRanges();window.getSelection().addRange(range)
   rightClick(text);await wait(()=>!!document.querySelector('[aria-label="Conversation selection actions"]'))
   context=document.querySelector('[aria-label="Conversation selection actions"]')
   Array.from(context.querySelectorAll('button')).find(el=>el.textContent==='Move into chat or project').click()
   await wait(()=>JSON.parse(document.querySelector('[data-fixture-state]').textContent).info.includes('excerpts'))
   const excerpt=JSON.parse(JSON.parse(document.querySelector('[data-fixture-state]').textContent).info)
   if(excerpt.ids.length!==1||excerpt.excerpts[article.dataset.messageId].text!=='Question')throw Error('Highlighted text was not captured exactly')
   button('Cancel').click();await wait(()=>!document.querySelector('.hadron-v2-destination'))
   window.getSelection().removeAllRanges();rightClick(text);await wait(()=>!!document.querySelector('[aria-label="Conversation selection actions"]'))
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(()=>!document.querySelector('[aria-label="Conversation selection actions"]'))
   const state=JSON.parse(document.querySelector('[data-fixture-state]').textContent).state
   if(Object.keys(state.chats).length!==1||state.activeChatId!=='chat-a'||state.chats['chat-a'].draft!=='Keep this draft')throw Error('Agent switching changed the chat or lost the draft')
   toggle();await wait(()=>!!menu())
   agentButton('B').click();await wait(()=>agentButton('B').getAttribute('aria-pressed')==='true')
   choose('Agent B provider','claudecode');await wait(()=>document.querySelector('select[aria-label="Agent B model"]').options.length===2)
   choose('Agent B model','fixture-b')
   const send=document.querySelector('button[aria-label="Send"]')
   await wait(()=>!send.disabled);send.click()
   await wait(()=>document.body.textContent.includes('Reply from Agent B: Keep this draft'))
   const [question,reply]=workspace().chats['chat-a'].messages.slice(-2)
   if(question.parentId!==original.selectedId||reply.parentId!==question.id||reply.agent!=='b')throw Error('Agent B did not continue the selected branch')
   return {success:true,oneBottomLeftComposer:true,twoPanes:true,popUpOnlySetup:true,borderlessControls:true,newHelpGuide:true,multiMessageActionSelection:true,rightClickChatAndTree:true,highlightedTextSelection:true,newChatMoveAction:true,newProjectAndChatNames:true,chatAgentPermissionChoice:true,turnLimit100InPopUp:true,agentSwitchStaysInChat:true,chronologicalReply:true,realProviderRequests:0,syntheticUIFixture:true}
  }
  const result=await window.webContents.executeJavaScript('('+audit.toString()+')()')
  await window.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,100))))');
  fs.writeFileSync(path.join(process.env.HADRON_REDESIGN_PROFILE,'conversation.png'),(await window.capturePage()).toPNG())
  fs.writeFileSync(path.join(process.env.HADRON_REDESIGN_PROFILE,'result.json'),JSON.stringify(result,null,2));app.exit(0)
 }catch(error){fs.writeFileSync(path.join(process.env.HADRON_REDESIGN_PROFILE,'failure.json'),JSON.stringify({error:String(error),stack:error.stack}));app.exit(1)}
}
fs.writeFileSync(path.join(profile,'main.cjs'),'('+auditInElectron.toString()+')()')
const env={...process.env,HADRON_REDESIGN_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE
console.log(profile)
const child=spawn(require('electron'),[path.join(profile,'main.cjs')],{env,windowsHide:true,stdio:'ignore'})
const timer=setTimeout(()=>child.kill(),45000)
child.on('exit',code=>{clearTimeout(timer);const report=path.join(profile,code===0?'result.json':'failure.json');console.log(fs.existsSync(report)?fs.readFileSync(report,'utf8'):'No redesign report produced');process.exitCode=code??1})
