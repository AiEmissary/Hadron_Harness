import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
export function WorkspaceTextDialog({title,initial,readOnly=false,onSave,onClose}:{title:string;initial:string;readOnly?:boolean;onSave?(text:string):Promise<void>;onClose():void}){
 const dialog=useRef<HTMLDialogElement>(null),[text,setText]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close()},[])
 return createPortal(<dialog ref={dialog} className='hadron-v2-destination' aria-label={title} onCancel={event=>{if(busy)event.preventDefault();else onClose()}}>
  <form onSubmit={event=>{event.preventDefault();if(busy||!onSave)return;setBusy(true);setError('');void onSave(text).then(onClose).catch(error=>{setBusy(false);setError(error instanceof Error?error.message:'This change could not be saved.')})}}>
   <h2>{title}</h2>{readOnly?<pre className='hadron-v2-message-text'>{text}</pre>:<textarea aria-label={title} autoFocus value={text} disabled={busy} onChange={event=>setText(event.target.value)} style={{width:'100%',minHeight:220,background:'#f2f4f6',border:0,borderRadius:12,padding:12,boxSizing:'border-box',font:'inherit'}}/>}
   {error&&<p role='alert'>{error}</p>}<footer><button type='button' disabled={busy} onClick={onClose}>{readOnly?'Close':'Cancel'}</button>{!readOnly&&<button type='submit' disabled={busy}>{busy?'Saving…':'Save'}</button>}</footer>
  </form>
 </dialog>,document.body)
}
