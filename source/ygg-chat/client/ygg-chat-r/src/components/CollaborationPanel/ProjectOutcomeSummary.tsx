import { useState } from 'react'
import type { ProjectDraftView } from '../../../../../shared/projectBuild'
import { projectOutcome } from '../../features/collaboration/projectOutcome'

export function ProjectOutcomeSummary({ view, working }: { view: ProjectDraftView; workspaceId: string; working: boolean }) {
  const result = projectOutcome(view)
  const [message, setMessage] = useState('')
  return <section aria-label='Project conclusion' className='space-y-3 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:bg-neutral-900'>
    <h3 className='text-lg font-semibold'>Project conclusion</h3>
    <p className='font-medium'>{result.outcome}</p>
    <p className='text-sm whitespace-pre-wrap break-words'>{view.input.task}</p>
    <dl className='space-y-2 text-sm'>
      <dt className='font-semibold'>{view.input.participation&&view.input.participation!=='both'?'Agent '+view.input.participation.toUpperCase():'Agent A'} recommendation</dt><dd className='whitespace-pre-wrap break-words'>{result.recommendation}</dd>
      <dt className='font-semibold'>{view.input.participation&&view.input.participation!=='both'?'Self-check by Agent '+view.input.participation.toUpperCase():'Agent B check'}</dt><dd className='whitespace-pre-wrap break-words'>{result.review}</dd>
      <dt className='font-semibold'>Actual progress</dt><dd>Files changed: {view.projectFilesChanged===true?'yes':view.projectFilesChanged===false?'no':'uncertain'} · Tests: {view.tests.status.replaceAll('_',' ')} · Build: {(view.builds?.status ?? 'not_run').replaceAll('_',' ')}</dd>
      <dt className='font-semibold'>Next step</dt><dd>{result.next}</dd>
    </dl>
    <p className='text-xs'>This summarises the saved proposal. Agent review alone does not mean the project is finished. Full stages, file changes and logs remain below.</p>
    <div className='flex flex-wrap gap-3'>
      <button type='button' className='rounded-xl border px-3 py-2 text-sm' onClick={() => void navigator.clipboard.writeText(result.text).then(() => setMessage('Conclusion copied.')).catch(() => setMessage('Clipboard unavailable. Select and copy the summary text below.'))}>Copy conclusion</button>
    </div>
    {working && <p className='text-xs'>Wait for this project step to finish before preparing a new workflow.</p>}
    <p className='text-xs'>Use Continue with Agent A, Agent B or both above this conclusion to talk about the result. Use Work on this to give another coding instruction. Saved history stays available.</p>
    {message && <p role='status' className='text-sm'>{message}</p>}
    <details><summary className='cursor-pointer text-sm'>Full handoff text</summary><pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs'>{result.text}</pre></details>
  </section>
}
