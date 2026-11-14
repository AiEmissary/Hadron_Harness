import { useEffect, useRef, useState } from 'react'
import type { JournalDocument } from '../../features/collaboration/journal'

/** Journal content is displayed as plain text, never HTML or execution instructions. */
export function AgentJobLog({ label, read }: { label: string; read(): Promise<JournalDocument> }) {
  const [document, setDocument] = useState<JournalDocument | null>(null), [pending, setPending] = useState(false), [error, setError] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  return <div className='mt-3 space-y-2'>
    <button type='button' disabled={pending} className='rounded-lg border px-3 py-2 text-sm' onClick={async () => {
      setPending(true); setError(false)
      try { const value = await read(); if (mounted.current) setDocument(value) }
      catch { if (mounted.current) setError(true) }
      finally { if (mounted.current) setPending(false) }
    }}>{pending ? 'Reading log...' : `View ${label} job log`}</button>
    {error && <p role='alert' className='text-sm'>The job log could not be read. Check the job status and local storage.</p>}
    {document && <details open><summary className='cursor-pointer text-sm'>{label} Markdown log</summary>
      <pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 text-xs'>{document.markdown}</pre>
      <button type='button' className='mt-2 text-sm underline' onClick={() => {
        const url = URL.createObjectURL(new Blob([document.markdown], { type: 'text/markdown;charset=utf-8' }))
        const link = window.document.createElement('a'); link.href = url; link.download = document.filename; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}>Save .md copy</button>
    </details>}
  </div>
}
