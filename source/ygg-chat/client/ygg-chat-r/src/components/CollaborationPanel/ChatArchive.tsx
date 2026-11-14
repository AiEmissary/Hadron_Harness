import {useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
export function ChatArchive(){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),queries=useQueryClient()
 const run=async(kind:'export'|'import')=>{
  setBusy(true);setError('');setStatus('')
  try{const result=await window.electronAPI.chatArchive[kind]();if(result.cancelled){setStatus('Cancelled. Saved chats were not changed.');return}
   if(kind==='import'){await queries.invalidateQueries();setStatus(result.alreadyImported?'This archive has already been imported. No duplicate projects were created.':`Imported ${result.projects} projects and ${result.chats} chats. Open Projects on the left to find “Imported” projects.`)}
   else setStatus(`Backup saved: ${result.projects} projects and ${result.chats} chats.`)
  }catch(e){setError(e instanceof Error?e.message:'The chat archive operation failed.')}finally{setBusy(false)}
 }
 return <div data-hadron-chat-archive className='space-y-3 rounded-xl border p-4'><h3 className='font-semibold'>Portable chat backup</h3>
  <p className='text-sm'>Save your active local projects, chat branches and workflow transcripts in a .hadron file. Keep it somewhere private: the text is not encrypted and may contain information from files you shared.</p>
  <div className='flex flex-wrap gap-3'><button type='button' disabled={busy} onClick={()=>void run('export')} className='rounded-xl border px-3 py-2'>Back up saved chats</button><button type='button' disabled={busy} onClick={()=>void run('import')} className='rounded-xl border px-3 py-2'>Import chat backup</button></div>
  <p className='text-sm'>Import creates new projects and keeps existing work. Workflow transcripts become reference chats; accounts, attached files, Recycle Bin items, live sessions and project permissions are not transferred. Importing sends no AI request.</p>
  {busy&&<p role='status'>Working on your chat archive…</p>}{status&&<p role='status'>{status}</p>}{error&&<p role='alert'>{error}</p>}
 </div>
}
