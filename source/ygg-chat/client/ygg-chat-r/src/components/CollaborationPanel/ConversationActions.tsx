import {useState} from 'react'
import type {ProjectDraftGrant} from '../../../../../shared/projectBuild'
import {startConversationWork,workContext,conversationFolder,type Actor,type Choices,type FolderSlot} from '../../features/collaboration/conversationWork'
import {sendWorkflowDraft} from '../../features/collaboration/workflowDraft'
import {useJobTreeWorkspace} from './JobTreeWorkspace'

export function ConversationActions({workspaceId,context,slot,choices={},defaultActor='both',disabled=false,grant,onContinueBoth}:{workspaceId:string;context:string;slot:FolderSlot;choices?:Choices;defaultActor?:Actor;disabled?:boolean;grant?:ProjectDraftGrant;onContinueBoth?():void}){
  const workspace=useJobTreeWorkspace(),[open,setOpen]=useState(false),[actor,setActor]=useState<Actor>(defaultActor),[instruction,setInstruction]=useState(''),[permission,setPermission]=useState<'ask'|'task'>('ask'),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const allChoices={...workspace?.agentChoices,...choices}
  const act=async(operation:()=>Promise<void>)=>{setBusy(true);setError('');try{await operation()}catch(error){setError(error instanceof Error?error.message:String(error))}finally{setBusy(false)}}
  const continueWith=async(target:Actor)=>{
    if(target==='both'&&onContinueBoth){onContinueBoth();return}
    const folder=conversationFolder(workspaceId,slot),destination=target==='both'?'shared':target
    const nextFolder=grant?await window.electronAPI.projectDraft.asRead(workspaceId,grant.id,destination):folder?await window.electronAPI.collaboration.projectUse(workspaceId,slot,folder.id,destination):undefined
    sendWorkflowDraft(workspaceId,destination,'Continue this conversation.',grant||folder?.reading?'read':'chat',{context:workContext(context),choices:allChoices,folder:nextFolder})
    workspace?.setMode(target==='both'?'together':'independent');workspace?.showPane(target==='both'?'shared':target)
    requestAnimationFrame(()=>{const field=document.querySelector<HTMLTextAreaElement>('textarea[aria-label="'+(target==='both'?'Shared task':'Agent '+target.toUpperCase()+' job task')+'"]');field?.focus();field?.select()})
  }
  return <section aria-label='Conversation actions' className='my-3 space-y-2 text-sm'>
    <div className='flex flex-wrap gap-2'>
      {(['a','b','both'] as const).map(target=><button type='button' key={target} disabled={disabled||busy} className='rounded-lg border px-3 py-2' onClick={()=>void act(()=>continueWith(target))}>Continue with {target==='both'?'both agents':'Agent '+target.toUpperCase()}</button>)}
      <button type='button' disabled={disabled||busy} className='rounded-lg border px-3 py-2 font-semibold' onClick={()=>setOpen(value=>!value)}>Work on this</button>
    </div>
    {open&&<div aria-label='Work on this conversation' className='space-y-3 rounded-xl border border-cyan-400 p-3'>
      <label className='block'>Who should do it?<select aria-label='Work agent' value={actor} onChange={event=>setActor(event.target.value as Actor)} className='ml-2 rounded-lg border p-2'><option value='a'>Agent A</option><option value='b'>Agent B</option><option value='both'>Both agents</option></select></label>
      <textarea aria-label='Work instruction' placeholder='Tell the agent what to do with this conversation...' value={instruction} maxLength={16000} onChange={event=>setInstruction(event.target.value)} className='block min-h-24 w-full rounded-lg border p-2'/>
      <label className='block'>File changes<select aria-label='Work file permission' value={permission} onChange={event=>setPermission(event.target.value as 'ask'|'task')} className='ml-2 rounded-lg border p-2'><option value='ask'>Ask before applying changes</option><option value='task'>Approve changes and checks for this task</option></select></label>
      <p className='text-xs'>The selected conversation and current folder follow this task. {actor==='both'?'A implements and B checks the changes.':'The selected agent implements and checks its own changes; the other main agent is not used.'} Approvals appear when files or checks are ready. Built-in checks support Node projects.</p>
      {context.length>12000&&<p className='text-xs'>This long conversation uses its most recent 12,000 characters. Earlier text is explicitly marked as omitted.</p>}
      <button type='button' disabled={busy||!instruction.trim()} className='rounded-lg border px-4 py-2 font-semibold' onClick={()=>void act(async()=>{if(await startConversationWork({workspace:workspaceId,slot,text:instruction.trim(),context,actor,choices:allChoices,permission,grant})){setOpen(false);workspace?.setMode('project');workspace?.showPane('project')}})}>{busy?'Starting work...':'Go'}</button>
      <button type='button' disabled={busy} className='ml-2 rounded-lg border px-3 py-2' onClick={()=>setOpen(false)}>Cancel</button>
    </div>}
    {error&&<p role='alert'>{error}</p>}
  </section>
}
