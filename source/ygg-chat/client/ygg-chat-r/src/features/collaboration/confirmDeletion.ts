/** Keep deletion confirmation inside the renderer. Native blocking confirm
 * dialogs can leave Windows Electron text fields without keyboard focus. */
export function confirmDeletion(message:string):Promise<boolean>{
 return new Promise(resolve=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null
  const dialog=document.createElement('dialog')
  dialog.className='hadron-v2-destination';dialog.setAttribute('aria-label','Confirm deletion')
  const title=document.createElement('h2');title.textContent='Confirm deletion'
  const text=document.createElement('p');text.textContent=message
  const footer=document.createElement('footer')
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.autofocus=true
  const accept=document.createElement('button');accept.type='button';accept.textContent=message.startsWith('Move ')?'Move to bin':'Delete'
  let done=false
  const finish=(accepted:boolean)=>{
   if(done)return;done=true;dialog.close();dialog.remove()
   if(previous?.isConnected)previous.focus({preventScroll:true})
   resolve(accepted)
  }
  cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true)
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false)})
  footer.append(cancel,accept);dialog.append(title,text,footer);document.body.append(dialog)
  dialog.showModal();cancel.focus()
 })
}
