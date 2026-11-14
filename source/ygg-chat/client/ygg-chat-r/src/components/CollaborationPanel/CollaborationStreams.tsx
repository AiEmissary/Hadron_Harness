import type {ReactNode} from 'react'
export function CollaborationStreams({ text, status, participantStatus, onReconnect, onContinue, continueReady, recoverable, reviewedSession,renderActions }: {
  text: Record<'a' | 'b', string>
  status: string
  participantStatus?: Partial<Record<'a' | 'b', string>>
  onReconnect?: (id: 'a' | 'b') => void
  onContinue?: (id: 'a' | 'b') => void
  continueReady?: Partial<Record<'a' | 'b', boolean>>
  recoverable?: Partial<Record<'a' | 'b', boolean>>
  renderActions?:(slot:'a'|'b')=>ReactNode
  reviewedSession?: boolean
}) {
  return <div className='grid gap-4' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))' }} aria-label='Participant responses'>
    {(['a', 'b'] as const).map((id, index) => <section key={id} aria-label={`Agent ${id.toUpperCase()} response`}
      className={`min-h-56 rounded-2xl border bg-white p-4 dark:bg-neutral-900 ${index ? 'border-teal-300' : 'border-violet-300'}`}>
      <header className='mb-3 flex items-center justify-between'><h2 className='font-semibold'>Agent {id.toUpperCase()}</h2><span className='text-xs text-neutral-500'>{participantStatus?.[id] ?? status}</span></header>
      {(text[id] || reviewedSession) && <p className='mb-3 text-xs text-neutral-500'>Initial independent proposal{reviewedSession ? ' — written before cross-review. Reviews and the combined answer appear above as they finish.' : ' — no peer review in this saved session.'}</p>}
      {renderActions?.(id)}
      <div className='mb-3 flex flex-wrap items-center gap-3'>
        {!renderActions && onContinue && <button type='button' disabled={!continueReady?.[id]} className='rounded-lg px-3 py-2 text-sm' title='Continue privately from this agent’s original proposal' onClick={() => onContinue(id)}>Continue with Agent {id.toUpperCase()}</button>}
        {onReconnect && recoverable?.[id] && <button type='button' className='rounded-lg border px-3 py-1 text-xs' title='Reload the existing response; this does not start another AI request' onClick={() => onReconnect(id)}>Recover Agent {id.toUpperCase()} response</button>}
      </div>
      <div className='whitespace-pre-wrap text-sm leading-7' aria-live='polite' aria-atomic='false'>{text[id] || 'The response will appear here.'}</div>
    </section>)}
  </div>
}
