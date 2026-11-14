import { useEffect, useReducer } from 'react'
import { CollaborationPanel } from './CollaborationPanel'
import { CollaborationStreams } from './CollaborationStreams'
import { emptyPreview, previewReducer } from '../../features/collaboration/previewState'
import type { ParticipantOption } from '../../features/collaboration/setup'

const options: ParticipantOption[] = [{ provider: 'openaichatgpt', label: 'ChatGPT (simulation)', connected: true,
  connectionLabel: 'Simulated connection — no account used', models: [
    { id: 'demo-model-a', label: 'Demo model A' }, { id: 'demo-model-b', label: 'Demo model B' },
  ] }]

/** Fixture-only UI route. No API client, provider, login or branch writes. */
export function CollaborationPreview() {
  const [state, dispatch] = useReducer(previewReducer, undefined, emptyPreview)
  const id = state.status?.sessionId
  const running = state.status?.status === 'running'
  useEffect(() => {
    if (!running || !id) return
    const timers = [
      setTimeout(() => dispatch({ type: 'delta', sessionId: id, participant: 'a', seq: 1, text: 'I would begin by defining the goal and checking the evidence.\n\n' }), 500),
      setTimeout(() => dispatch({ type: 'delta', sessionId: id, participant: 'b', seq: 1, text: 'My independent approach starts with assumptions and possible failure cases.\n\n' }), 1100),
      setTimeout(() => dispatch({ type: 'delta', sessionId: id, participant: 'a', seq: 2, text: 'This is a simulated proposal, not an AI response.' }), 2200),
      setTimeout(() => dispatch({ type: 'delta', sessionId: id, participant: 'b', seq: 2, text: 'The next real phase will compare committed proposals.' }), 3000),
      setTimeout(() => dispatch({ type: 'complete', sessionId: id }), 4200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [id, running])
  return <main className='mx-auto w-full max-w-6xl space-y-5 overflow-y-auto p-5 text-neutral-900 dark:text-neutral-100'>
    <header><h1 className='text-2xl font-semibold'>Hadron collaboration preview</h1>
      <p className='mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900'>Simulation only. No provider connection, AI requests or saved chat branches. Live collaboration remains disabled.</p></header>
    <CollaborationPanel options={options} enabled status={state.status}
      onStart={async draft => dispatch({ type: 'start', sessionId: `preview-${crypto.randomUUID()}`, draft })}
      onStop={async () => { if (id) dispatch({ type: 'stop', sessionId: id }) }} />
    <p className='text-sm text-neutral-500'>Independent proposals{state.status?.status === 'completed' ? ' · Preview finished' : state.status?.status === 'cancelled' ? ' · Stopped' : ''}</p>
    <CollaborationStreams text={state.text} status={state.status?.status ?? 'Waiting'} />
  </main>
}
