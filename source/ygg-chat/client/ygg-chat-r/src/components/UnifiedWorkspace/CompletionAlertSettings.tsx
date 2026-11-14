import {useState} from 'react'
import {completionAlertMode,saveCompletionAlertMode} from '../../features/collaboration/workspaceCompletionAlerts'
import type {CompletionAlertMode} from '../../../../../shared/hadronCompletion'
export function CompletionAlertSettings(){
 const [mode,setMode]=useState(completionAlertMode),[error,setError]=useState('')
 return <section className='space-y-2' aria-label='Completion alerts'>
  <h3 className='font-semibold'>Completion alerts</h3>
  <label>When a reply finishes<select aria-label='Completion alerts' className='ml-3 rounded-lg bg-transparent p-2' value={mode} onChange={event=>{const value=event.target.value as CompletionAlertMode;try{saveCompletionAlertMode(value);setMode(value);setError('')}catch{setError('The alert preference could not be saved.')}}}><option value='ping'>Taskbar notification and ping</option><option value='voice'>Taskbar notification and voice</option><option value='off'>Off</option></select></label>
  <p className='text-sm'>Voice says “I am done” for one agent or “We are done” for joint work, without a ping. Unfinished or stopped tasks say “Not finished” and show the same status in their notification. Old saved replies stay quiet.</p>
  {error&&<p role='alert'>{error}</p>}
 </section>
}
