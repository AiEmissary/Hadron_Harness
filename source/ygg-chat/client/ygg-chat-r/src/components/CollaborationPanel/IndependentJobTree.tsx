import { useEffect, useState } from 'react'
import type { IndependentJobTree as JobTree, IndependentJobStatus } from '../../../../../shared/independentJobs'
import { createIndependentJobClient } from '../../features/collaboration/independentClient'

const readSavedTree = (id: string, signal: AbortSignal) => createIndependentJobClient(async () => {
  if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
  return window.electronAPI.collaboration.capability()
}).tree(id, signal)

/** Each mounted tree owns its selection and fetch; it never changes Chat's selected branch. */
export function IndependentJobTree({ label, slot, status, liveText, expanded = false, readTree = readSavedTree }: {
  label: string; slot: 'a' | 'b'; status: IndependentJobStatus | null; liveText: string
  expanded?: boolean; readTree?: typeof readSavedTree
}) {
  const [tree, setTree] = useState<JobTree | null>(null), [error, setError] = useState(false)
  const [selected, setSelected] = useState<'task' | 'response'>('task')
  useEffect(() => { setTree(null); setSelected('task'); setError(false) }, [status?.id])
  useEffect(() => {
    if (!status) return
    const abort = new AbortController()
    setError(false)
    void readTree(status.id, abort.signal).then(value => {
      if (!abort.signal.aborted) {
        if (value.conversationId !== status.conversationId) throw new Error('Job tree conversation mismatch')
        setTree(value)
      }
    }).catch(() => { if (!abort.signal.aborted) setError(true) })
    return () => abort.abort()
  }, [status?.id, status?.revision, status?.runId, status?.conversationId, readTree])
  const current = tree?.id === status?.id ? tree : null
  const node = current?.nodes.find(item => item.kind === selected)
  return <details open={expanded || undefined} className='mt-3 rounded-lg border p-3'>
    <summary className='cursor-pointer text-sm font-medium'>{label} tree</summary>
    {!status && <p className='mt-2 text-xs text-neutral-500'>This job's saved task and response will appear here after Start.</p>}
    {error && <p role='alert' className='mt-2 text-sm'>This job's tree could not be read. Check the job to refresh it.</p>}
    {status && !current && !error && <p className='mt-2 text-xs'>Loading saved tree...</p>}
    {current && <>
      <div role='group' aria-label={`${label} tree nodes`} className='relative my-3 space-y-3 pl-1'>
        {current.nodes.length > 1 && <span aria-hidden='true' className={`absolute bottom-5 left-[0.7rem] top-5 w-0.5 ${slot === 'a' ? 'bg-violet-300' : 'bg-teal-300'}`} />}
        {current.nodes.map(item => <button type='button' key={item.id} aria-pressed={selected === item.kind} onClick={() => setSelected(item.kind)}
          aria-label={`${label} tree ${item.kind}`} className='relative flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-sm aria-pressed:bg-neutral-100 dark:aria-pressed:bg-neutral-800'>
          <span aria-hidden='true' className={`h-4 w-4 shrink-0 rounded-full border-2 border-white dark:border-neutral-900 ${slot === 'a' ? 'bg-violet-500' : 'bg-teal-500'}`} />
          <span>{item.kind === 'task' ? 'Task' : 'Response'}<span className='ml-2 text-xs text-neutral-500'>{item.kind === 'response' ? status?.status : item.status}</span></span>
        </button>)}
      </div>
      <div role='region' aria-label={`${label} selected tree node`} className='max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5'>
        {node?.kind === 'response' ? liveText || node.text || 'No visible response has been saved yet.' : node?.text}
      </div>
      <p className='mt-2 text-xs text-neutral-500'>This tree belongs to {label}'s job. Agent notes are unverified.</p>
    </>}
  </details>
}
