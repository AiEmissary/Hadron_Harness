import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { RecycleEntry } from '../../../server/hadronTools/recycleBin'

export function RecycleBin() {
  const [open, setOpen] = useState(false), [items, setItems] = useState<RecycleEntry[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), queries = useQueryClient()
  const load = async () => setItems(await window.electronAPI.recycleBin.list())
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal(); setError('')
    void load().catch(error => setError(error.message))
    const timer = setInterval(() => void load().catch(error => setError(error.message)), 60000)
    return () => { clearInterval(timer); dialog.current?.close(); previous?.focus() }
  }, [open])
  if (typeof window==='undefined'||!window.electronAPI?.recycleBin) return null
  return <><button type='button' className='rounded-xl border px-3 py-2 text-sm' onClick={() => setOpen(true)}>Recycle Bin</button>
    {open && createPortal(<dialog ref={dialog} aria-labelledby='hadron-bin-title' onKeyDown={event => event.stopPropagation()} onCancel={event => { if (busy) event.preventDefault(); else setOpen(false) }} style={{ margin: 'auto' }} className='hadron-shell w-[min(640px,94vw)] max-h-[85vh] overflow-y-auto rounded-2xl border bg-white p-5 text-slate-800 dark:bg-slate-900 dark:text-slate-100'>
      <h2 id='hadron-bin-title' className='text-xl font-semibold'>Recycle Bin</h2>
      <p className='my-3 text-sm'>Deleted local projects, chats and conversation selections stay here for 30 days, then are permanently removed. Restore a project to bring back its chats. Chats deleted separately stay in the bin until you restore them.</p>
      {error && <p role='alert' className='my-3 text-sm'>{error}</p>}
      {!items.length && <p className='my-3 text-sm'>The Recycle Bin is empty.</p>}
      <ul className='space-y-3'>{items.map(item => <li key={item.kind + item.id} className='rounded-xl border p-3'>
        <strong className='block break-words'>{item.title}</strong>
        <p className='my-2 text-xs'>{item.kind === 'project' ? 'Project and its chats' : item.kind==='branch'?'Conversation selection':'Chat'} · {Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 86400000))} days remaining · Expires {new Date(item.expiresAt).toLocaleString()}</p>
        {item.parentDeleted && <p className='mb-2 text-xs'>Restore its project or chat first.</p>}
        <button type='button' disabled={busy || item.parentDeleted} className='rounded-xl border px-3 py-2 text-sm' onClick={() => {
          setBusy(true); setError('')
          void window.electronAPI.recycleBin.restore(item.kind, item.id).then(async () => { window.dispatchEvent(new Event('hadron-workspace-restored')); await load(); await Promise.all([queries.invalidateQueries({ queryKey: ['projects'] }), queries.invalidateQueries({ queryKey: ['conversations'] })]) }).catch(error => setError(error.message)).finally(() => setBusy(false))
        }}>Restore {item.kind === 'project' ? 'project' : item.kind==='branch'?'selection':'chat'}</button>
      </li>)}</ul>
      <button type='button' disabled={busy} className='mt-4 rounded-xl border px-3 py-2' onClick={() => setOpen(false)}>Close Recycle Bin</button>
    </dialog>, document.body)}
  </>
}
