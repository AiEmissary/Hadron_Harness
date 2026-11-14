import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'

export interface SelectionProject {id:string;title:string;chats:Array<{id:string;title:string}>}
export type SelectionDestination={projectId:string;chatId:string}|{projectId:string;title:string}|{projectName:string;title:string}
export interface WorkspaceDestinationProps {
 move:boolean;newChat:boolean;projects:SelectionProject[];sourceChatId:string;sourceProjectId:string;
 onApply(destination:SelectionDestination):Promise<void>;onClose():void;
}
/** Naming and destination choice stay in a single contextual pop-up. Opening it
 * neither creates a chat nor sends a request. Native success owns navigation. */
export function WorkspaceDestination(props:WorkspaceDestinationProps){
 const dialog=useRef<HTMLDialogElement>(null),[project,setProject]=useState(props.sourceProjectId)
 const [chat,setChat]=useState(props.newChat?'new':''),[projectName,setProjectName]=useState(''),[title,setTitle]=useState('')
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const choices=props.projects.find(item=>item.id===project)?.chats.filter(item=>item.id!==props.sourceChatId)??[]
 useEffect(()=>{const prior=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();prior?.focus()}},[])
 const apply=async()=>{
  if(busy)return
  if(project==='new'&&!projectName.trim()||(project==='new'||chat==='new')&&!title.trim()){setError('Give the new destination a name.');return}
  const destination:SelectionDestination=project==='new'?{projectName:projectName.trim(),title:title.trim()}:chat==='new'?{projectId:project,title:title.trim()}:{projectId:project,chatId:chat}
  if('chatId' in destination&&!choices.some(item=>item.id===destination.chatId)){setError('Choose a destination chat.');return}
  setBusy(true);setError('')
  try{await props.onApply(destination);props.onClose()}catch(error){setError(error instanceof Error?error.message:'The selection could not be transferred.');setBusy(false)}
 }
 return createPortal(<dialog ref={dialog} className='hadron-v2-destination' aria-labelledby='hadron-destination-title' onCancel={event=>{if(busy)event.preventDefault();else props.onClose()}}>
  <form onSubmit={event=>{event.preventDefault();void apply()}}>
   <h2 id='hadron-destination-title'>{props.move?'Move':'Copy'} selection</h2>
   <p>Add the selected portion to a chat, then open it. Existing messages stay in place.</p>
   <label>Project<select aria-label='Destination project' value={project} disabled={busy} onChange={event=>{setProject(event.target.value);setChat(event.target.value==='new'||props.newChat?'new':'')}}>
    {props.projects.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}<option value='new'>+ New project</option>
   </select></label>
   {project==='new'&&<label>New project name<input aria-label='New project name' autoFocus maxLength={120} value={projectName} disabled={busy} onChange={event=>setProjectName(event.target.value)}/></label>}
   {project!=='new'&&<label>Chat<select aria-label='Destination chat' value={chat} disabled={busy} onChange={event=>setChat(event.target.value)}>
    <option value=''>Choose a chat</option>{choices.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}<option value='new'>+ New chat</option>
   </select></label>}
   {(project==='new'||chat==='new')&&<label>New chat name<input aria-label='New chat name' autoFocus={project!=='new'} maxLength={200} value={title} disabled={busy} onChange={event=>setTitle(event.target.value)}/></label>}
   {error&&<p role='alert'>{error}</p>}
   <footer><button type='button' disabled={busy} onClick={props.onClose}>Cancel</button><button type='submit' disabled={busy}>{busy?'Saving…':`${props.move?'Move':'Copy'} and open`}</button></footer>
  </form>
 </dialog>,document.body)
}
