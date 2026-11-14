import { useEffect, useRef, useState } from 'react'
import { HADRON_LIVE_COLLABORATION_ENABLED } from '../../../../../shared/collaboration'
import { createCollaborationClient } from '../../features/collaboration/client'
import { emptySavedSessions, SavedSessionsController } from '../../features/collaboration/sessions'

/** Functional session selector only; visual design remains provisional. */
export function SavedCollaborationSessions({ conversationId, onSelected }: { conversationId: string; onSelected(id: string | null): void }) {
  const [state, setState] = useState(emptySavedSessions)
  const controller = useRef<SavedSessionsController | null>(null)
  const selected = useRef(onSelected); selected.current = onSelected
  useEffect(() => {
    selected.current(null)
    if (!HADRON_LIVE_COLLABORATION_ENABLED) return
    const browser = new SavedSessionsController(createCollaborationClient(async () => {
      if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
      return window.electronAPI.collaboration.capability()
    }), next => { setState(next); selected.current(next.selected?.sessionId ?? null) })
    controller.current = browser; browser.open(conversationId)
    return () => { controller.current = null; browser.dispose() }
  }, [conversationId])
  if (!HADRON_LIVE_COLLABORATION_ENABLED) return null
  const current = state.conversationId === conversationId ? state : emptySavedSessions()
  return <section aria-label='Saved collaboration sessions' className='space-y-2 rounded-xl border p-3'>
    <label className='block text-sm'>Saved sessions
      <select aria-label='Saved collaboration session' value={current.selected?.sessionId ?? ''}
        disabled={current.loading || current.selecting} onChange={event => { if (event.target.value) void controller.current?.select(event.target.value) }}
        className='mt-1 w-full rounded-lg border bg-transparent p-2'>
        <option value=''>Choose a saved session</option>
        {current.sessions.map(session => <option key={session.sessionId} value={session.sessionId}>
          {session.participants.map(participant => participant.modelName).join(' / ')} - {session.status} ({session.sessionId})
        </option>)}
      </select>
    </label>
    <button type='button' disabled={current.loading || current.selecting} onClick={() => controller.current?.open(conversationId)}>Refresh sessions</button>
    {current.nextBefore && <button type='button' disabled={current.loading} onClick={() => void controller.current?.more()}>Load more</button>}
    {current.error && <p role='alert'>{current.error}</p>}
    <p className='text-xs text-neutral-500'>Opening saved responses does not start another AI request.</p>
  </section>
}
