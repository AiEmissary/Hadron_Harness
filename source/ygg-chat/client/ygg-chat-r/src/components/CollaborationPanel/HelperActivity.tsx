import {useEffect,useState} from 'react'
import {WorkIndicator} from './WorkIndicator'
type Helper=Awaited<ReturnType<Window['electronAPI']['helpers']['list']>>[number]
export function HelperActivity({workspaceId}:{workspaceId?:string}){
 const [rows,setRows]=useState<Helper[]>([]),[enabled,setEnabled]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState(false)
 useEffect(()=>{
  if(!workspaceId||!window.electronAPI?.helpers)return;let current=true
  const refresh=()=>void Promise.all([window.electronAPI.helpers.list(workspaceId),window.electronAPI.helpers.preference()]).then(([rows,enabled])=>{if(current){setRows(rows);setEnabled(enabled);setError('')}}).catch(()=>{if(current)setError('Helper status is unavailable. Saved replies remain available.')})
  refresh();const timer=setInterval(refresh,2000);return()=>{current=false;clearInterval(timer)}
 },[workspaceId])
 const active=rows.filter(row=>['reserved','running'].includes(row.state)),visible=history?rows:active
 return <section aria-label='Agent helper activity' className='max-h-64 shrink-0 overflow-y-auto border-b border-violet-200 p-3 text-sm'>
  <div className='flex flex-wrap items-center justify-between gap-2'><label className='flex items-center gap-2'><input type='checkbox' checked={enabled} onChange={event=>{const next=event.target.checked;void window.electronAPI?.helpers?.preference(next).then(setEnabled).catch(()=>setError('Helper preference could not be saved.'))}}/>Automatic lightweight helpers</label><button type='button' className='rounded-lg border px-2 py-1 text-xs' onClick={()=>setHistory(value=>!value)}>{history?'Show active only':`Helper history (${rows.length})`}</button></div>
  <p className='mt-1 text-xs text-neutral-500'>Same provider as the parent · known lightweight tier · up to 2 helpers per agent/job · no nested helpers. Automatic conversation can read a selected folder; helpers remain off in that mode.</p>
  {error&&<p role='alert' className='mt-2 text-xs'>{error}</p>}
  {visible.map(row=><article key={row.id} className='mt-2 ml-3 border-l-2 border-cyan-300 pl-3'><strong>{row.role.length===1?`Agent ${row.role.toUpperCase()}`:row.role} → helper</strong><p className='text-xs'>{row.provider==='claudecode'?'Claude':'ChatGPT'} · {row.model} · {row.state}</p><p className='text-xs'>{row.task}</p>{['reserved','running'].includes(row.state)&&<WorkIndicator label='Helper working on the parent’s assignment'/>}<details className='text-xs'><summary>Parent and saved result</summary><p>Parent run: {row.parentRun}</p><p className='whitespace-pre-wrap'>{row.result??'No completed helper result was saved.'}</p></details></article>)}
 </section>
}
