import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useQueryClient} from '@tanstack/react-query'
import {useProjects} from '../../hooks/useQueries'
import {useChatNavigate} from '../ChatSelection/ChatSelectionProvider'
export function CopyIntoProject({workspaceId}:{workspaceId:string}){
 const [open,setOpen]=useState(false),[sources,setSources]=useState<Array<{id:string;mode:string;label:string}>>([]),[source,setSource]=useState(''),[project,setProject]=useState(''),[newProjectName,setNewProjectName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [extraSources,setExtraSources]=useState<string[]>([]),[showMore,setShowMore]=useState(false),[copied,setCopied]=useState<{projectId:string;chats:Array<{conversationId:string;label:string}>}|null>(null)
 const operation=useRef(''),dialog=useRef<HTMLDialogElement>(null),nameInput=useRef<HTMLInputElement>(null),navigate=useChatNavigate(),queries=useQueryClient(),{data:projects=[]}=useProjects()
 // A native Windows select can restore its own focus after React mounts an
 // autoFocus input. Move focus after the picker closes, and also offer a button
 // that does not depend on the native dropdown for creating a destination.
 useEffect(()=>{if(!open||project!=='__new__')return;const frame=requestAnimationFrame(()=>nameInput.current?.focus());return()=>cancelAnimationFrame(frame)},[open,project])
 useEffect(()=>{if(open){setExtraSources([]);setShowMore(false);setCopied(null)}},[open,workspaceId])
 useEffect(()=>{if(!open)return;const prior=document.activeElement as HTMLElement|null;let current=true;dialog.current?.showModal();operation.current=crypto.randomUUID();setError('');setSources([]);setSource('');setProject('');setNewProjectName('');void window.electronAPI.contextCopy.list(workspaceId).then(rows=>{if(current)setSources(rows)}).catch(()=>{if(current)setError('Saved conversations could not be loaded. Try again.')});return()=>{current=false;dialog.current?.close();prior?.focus()}},[open,workspaceId])
 const selected=[source,...extraSources.filter(index=>index!==source)].filter(index=>index!=='').map(index=>sources[Number(index)]).filter(Boolean)
 const openChat=(projectId:string,conversationId:string)=>{setOpen(false);navigate(`/chat/${projectId}/${conversationId}`,{state:{storageMode:'local'}})}
 const copy=async()=>{
  if(!selected.length||selected.length>20||!project||(project==='__new__'&&!newProjectName.trim()))return
  setBusy(true);setError('')
  try{
   const destination={id:operation.current,workspace:workspaceId,project:project==='__new__'?'':project,...(project==='__new__'?{newProjectName:newProjectName.trim()}:{})}
   const result=await window.electronAPI.contextCopy.copyMany({...destination,items:selected.map(item=>({mode:item.mode,source:item.id}))})
   for(const chat of result.conversations)try{localStorage.setItem(`hadron:agent-tree-view:${chat.conversationId}`,JSON.stringify({schemaVersion:1,mode:'independent',leftView:'main',selectedNodes:{}}))}catch{/* Optional navigation preference. */}
   await Promise.all([queries.invalidateQueries({queryKey:['conversations']}),queries.invalidateQueries({queryKey:['projects']})])
   if(result.conversations.length===1)openChat(result.projectId,result.conversations[0].conversationId)
   else setCopied({projectId:result.projectId,chats:result.conversations.map((chat,index)=>({...chat,label:selected[index].label}))})
  }catch(error){setError(error instanceof Error?error.message:'Copy failed. The originals remain unchanged.')}finally{setBusy(false)}
 }
 return <><button type='button' className='rounded-xl border px-3 py-2 text-sm' onClick={()=>setOpen(true)}>Copy into project</button>{open&&createPortal(<dialog ref={dialog} style={{margin:'auto'}} aria-labelledby='hadron-copy-title' onKeyDown={event=>event.stopPropagation()} onCancel={event=>{if(busy)event.preventDefault();else setOpen(false)}} className='hadron-shell w-[min(640px,94vw)] max-h-[85vh] overflow-y-auto rounded-2xl border bg-white p-5 text-slate-800 backdrop:bg-slate-950/30 dark:bg-slate-900 dark:text-slate-100'>
  <h2 id='hadron-copy-title' className='text-xl font-semibold'>Copy a conversation into a project</h2><p className='my-3 text-sm'>Keep the original and create a new reference chat in the chosen project. This copies saved text only. Running jobs, file permissions, approvals and attached files are not transferred. Opening the copy sends no AI request.</p>
  {copied?<><p role='status' className='my-3 font-semibold'>{copied.chats.length} chats copied into the same project. Each is saved separately; nothing was replaced.</p><p className='my-2 text-sm'>Choose a chat to open below. Both are also in the destination project's sidebar list.</p><ul className='space-y-2'>{copied.chats.map(chat=><li key={chat.conversationId}><button type='button' className='w-full rounded-xl border p-3 text-left' onClick={()=>openChat(copied.projectId,chat.conversationId)}>Open {chat.label}</button></li>)}</ul><button type='button' className='mt-4 rounded-xl border px-3 py-2' onClick={()=>setOpen(false)}>Close</button></>:<>
  <label className='block text-sm'>Saved conversation or branch<select autoFocus className='my-2 w-full rounded-xl border p-2' value={source} onChange={event=>{setSource(event.target.value);operation.current=crypto.randomUUID()}} disabled={busy}><option value=''>Choose saved work</option>{sources.map((item,index)=><option key={item.mode+item.id} value={index}>{item.label}</option>)}</select></label>
  <button type='button' className='mb-2 rounded-xl border px-3 py-2 text-sm' disabled={busy||source===''} onClick={()=>setShowMore(value=>!value)} aria-expanded={showMore}>Add more chats</button>
  {showMore&&<fieldset disabled={busy} className='mb-3 max-h-48 overflow-y-auto rounded-xl border p-3'><legend className='text-sm'>Also copy these chats</legend>{sources.map((item,index)=>String(index)!==source&&<label key={item.mode+item.id} className='my-2 flex gap-2 text-sm'><input type='checkbox' checked={extraSources.includes(String(index))} onChange={event=>{setExtraSources(values=>event.target.checked?[...values,String(index)]:values.filter(value=>value!==String(index)));operation.current=crypto.randomUUID()}}/>{item.label}</label>)}</fieldset>}
  {source!==''&&<p className='my-2 text-sm'>{selected.length} chat{selected.length===1?'':'s'} selected · up to 20. Each copy becomes a separate saved chat.</p>}
  <label className='block text-sm'>Destination project<select className='my-2 w-full rounded-xl border p-2' value={project} onChange={event=>{setProject(event.target.value);operation.current=crypto.randomUUID()}} disabled={busy}><option value=''>Choose project</option><option value='__new__'>+ Create new project</option>{projects.filter(item=>item.storage_mode==='local').map(item=><option key={item.id} value={String(item.id)}>{item.name}</option>)}</select></label>
  <button type='button' disabled={busy} className='mb-3 rounded-xl border px-3 py-2 text-sm' onClick={()=>{setProject('__new__');operation.current=crypto.randomUUID();requestAnimationFrame(()=>nameInput.current?.focus())}}>New project</button>
  {project==='__new__'&&<label className='block text-sm'>New project name<input ref={nameInput} aria-label='New project name' type='text' maxLength={120} value={newProjectName} disabled={busy} onChange={event=>{setNewProjectName(event.target.value);operation.current=crypto.randomUUID()}} placeholder='Name your new project' className='my-2 w-full rounded-xl border bg-transparent p-2'/><span className='mb-2 block text-xs'>Enter a name, then choose Copy and open.</span></label>}
  <p className='my-2 text-xs'>Copies preserve text up to 128 KiB. Longer conversations require selecting a smaller branch or answer; nothing is silently truncated. AI follow-ups still have the chosen mode’s context limit.</p>
  {error&&<p role='alert' className='my-2 text-sm'>{error}</p>}<div className='mt-4 flex flex-wrap gap-3'><button type='button' className='rounded-xl border px-3 py-2' disabled={busy||source===''||selected.length>20||!project||(project==='__new__'&&!newProjectName.trim())} onClick={()=>void copy()}>{busy?'Copying…':selected.length>1?'Copy selected chats':'Copy and open'}</button><button type='button' className='rounded-xl border px-3 py-2' disabled={busy} onClick={()=>setOpen(false)}>Cancel</button></div>
  </>}
 </dialog>,document.body)}</>
}
