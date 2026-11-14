import {agentConversationPath} from '../../features/collaboration/agentConversation'
import {ConversationActions} from './ConversationActions'
import type { ProposalSessionStatus } from '../../../../../shared/collaboration'
import { createPortal } from 'react-dom'
import { useJobTreeWorkspace } from './JobTreeWorkspace'
import { useEffect, useRef, useState } from 'react'
import { HADRON_LIVE_COLLABORATION_ENABLED } from '../../../../../shared/collaboration'
import { createCollaborationClient } from '../../features/collaboration/client'
import { CollaborationSupervisor, emptyCollaborationView } from '../../features/collaboration/supervisor'
import { CollaborationStreams } from './CollaborationStreams'
import { AgentJobLog } from './AgentJobLog'

/** Existing-session viewer. Start/admission stays a separate explicit operation. */
export function CollaborationSessionView({ sessionId, onStatus, onContinueBoth, canContinueBoth = true }: { sessionId: string | null; onContinueBoth?(status: ProposalSessionStatus): void; canContinueBoth?: boolean; onStatus?(status: ProposalSessionStatus): void }) {
  const workspace = useJobTreeWorkspace(), statusListener = useRef(onStatus); statusListener.current = onStatus
  const [view, setView] = useState(emptyCollaborationView)
  const [pending, setPending] = useState(false)
  const [stopError, setStopError] = useState(false)
  const observer = useRef<CollaborationSupervisor | null>(null)
  useEffect(() => {
    setView(emptyCollaborationView()); setStopError(false); setPending(false)
    if (!HADRON_LIVE_COLLABORATION_ENABLED || !sessionId) return
    const client = createCollaborationClient(async () => {
      if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
      return window.electronAPI.collaboration.capability()
    })
    const supervisor = new CollaborationSupervisor(client, setView)
    observer.current = supervisor; supervisor.watch(sessionId)
    return () => { observer.current = null; supervisor.dispose() }
  }, [sessionId])
  // Never show a previous conversation's response while its cleanup effect waits.
  const current = view.sessionId === sessionId ? view : emptyCollaborationView()
  const refreshTrees = workspace?.refresh
  const setSharedSession = workspace?.setSharedSession
  useEffect(() => { setSharedSession?.(sessionId) }, [sessionId, setSharedSession])
  useEffect(() => { if (current.status && ['completed','failed','cancelled','interrupted'].includes(current.status.status)) refreshTrees?.() }, [current.sessionId, current.status?.status, refreshTrees])
  useEffect(() => { if (current.status) statusListener.current?.(current.status) }, [current.status?.sessionId, current.status?.revision])
  const active = current.status && ['created', 'running'].includes(current.status.status)
  const proposalNodes = {
    a: workspace?.trees.a?.nodes.find(node => node.jobId === `proposal:${sessionId}:a` && node.kind === 'response'),
    b: workspace?.trees.b?.nodes.find(node => node.jobId === `proposal:${sessionId}:b` && node.kind === 'response'),
  }
  const sourceContext=(slot:'a'|'b')=>{try{const nodes=workspace?.trees[slot]?.nodes??[],node=proposalNodes[slot];return node?agentConversationPath(nodes,node.id).map(item=>(item.kind==='task'?'User':'Agent '+slot.toUpperCase())+': '+item.text).join('\n'):current.panes[slot].text}catch{return '[Earlier branch could not be loaded; selected visible answer follows.]\n'+current.panes[slot].text}}
  const stop = async () => {
    const target = observer.current
    if (!target) return
    setPending(true); setStopError(false)
    try { await target.stop() } catch { if (observer.current === target) setStopError(true) }
    finally { if (observer.current === target) setPending(false) }
  }
  const responses = <section aria-label='Collaboration session responses' className='space-y-3'>
    {!HADRON_LIVE_COLLABORATION_ENABLED && <p className='text-sm text-neutral-500'>Live collaboration is disabled in this build.</p>}
    {current.status?.collaboration && <section aria-label='Combined answer' className='rounded-xl border border-violet-200 bg-white dark:bg-neutral-900 p-4 space-y-3'>
      <h2 className='font-semibold'>Combined answer</h2>
      <p role='status' className='text-sm text-neutral-500'>{
        current.status.status === 'completed' ? current.status.collaboration.maxRequests === 13 ? current.status.collaboration.evidence?.receipts.length ? 'Collaboration complete · tool evidence recorded; review its scope below' : 'Collaboration complete · no successful tool evidence recorded' : 'Proposals and cross-review complete' :
        current.status.status === 'running' ? ({ proposals: 'Writing independent proposals…', reviews: 'Agents are reviewing both proposals…', verification: 'Checking evidence with Hadron tools…', synthesis: 'Preparing the combined answer…', finished: 'Finishing…' }[current.status.collaboration.phase]) :
        `Collaboration ${current.status.status}. Saved work is available below.`
      }</p>
      {current.status.status==='failed'&&current.status.error&&<p role='alert' className='rounded-lg border p-3 text-sm'>{current.status.error}</p>}
      {current.status.collaboration.researchLimited&&<p role='status' aria-label='Partial research warning' className='rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950'>Research reached its limit. At least one stage contains a host-saved partial evidence record instead of the agent’s final assessment. The combined answer must be read with those limitations; agreement does not complete the missing research.</p>}
      {current.status.status === 'completed' && current.status.collaboration.stages.find(stage => stage.id === 'final')?.status === 'completed'
        ? <>
          <div className='whitespace-pre-wrap break-words'>{current.status.collaboration.stages.find(stage => stage.id === 'final')!.text}</div>
          <ConversationActions workspaceId={current.status.conversationId} slot='shared' context={current.status.collaboration.stages.filter(stage=>stage.id==='final').map(stage=>stage.text).join('\n')} choices={Object.fromEntries(current.status.participants.map(p=>[p.id,p]))} disabled={!canContinueBoth} onContinueBoth={()=>onContinueBoth?.(current.status!)}/>
          <button type='button' className='rounded-lg px-3 py-2 text-sm' onClick={() => {
            const text = current.status!.collaboration!.stages.find(stage => stage.id === 'final')!.text
            const url = URL.createObjectURL(new Blob([`# Hadron combined answer\n\n${text}\n\n---\nModel output; not independently verified.\n`], { type: 'text/markdown;charset=utf-8' }))
            const link = document.createElement('a'); link.href = url; link.download = `hadron-combined-${sessionId}.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
          }}>Save combined answer</button>
        </>
        : current.status.collaboration.stages.find(stage => stage.id === 'final')?.text && <details><summary>Incomplete synthesis (not a final answer)</summary><div className='whitespace-pre-wrap break-words'>{current.status.collaboration.stages.find(stage => stage.id === 'final')!.text}</div></details>}
      {current.status.parentSessionId && <p className='text-xs text-neutral-500'>Shared follow-up · previous session {current.status.parentSessionId}</p>}
      <p className='text-xs text-neutral-500'>Agent A’s model combines both proposals and reviews. Agreement is not independent verification; unresolved disagreements should remain explicit.</p>
      {current.status.collaboration.folderAccess&&<section aria-label='Shared folder activity' className='rounded-xl border p-3 text-sm'><h3 className='font-semibold'>Folder search and reads</h3><p className='my-2 text-xs'>Read-only access was selected for this collaboration. Completed operations show execution, not proof that every conclusion is correct. Folder permission expires on restart.</p><details><summary>Folder activity · {current.status.collaboration.folderActivity?.length??0} events</summary>{current.status.collaboration.folderActivity?.map((event,index)=><p key={index} className='text-xs'>{event.time} · {event.tool} · {event.state}</p>)}</details></section>}
      {current.status.collaboration.maxRequests === 13 && <section aria-label='Verification results' className='space-y-3'>
        <h3 className='font-semibold'>Verification</h3>
        {!current.status.collaboration.evidence?.receipts.length && <p role='status' className='text-sm'>{current.status.collaboration.evidence?.attempts ? 'Checks were attempted but no successful evidence was recorded. This answer remains unverified.' : 'No evidence check is recorded for this session. This answer remains unverified.'}</p>}
        <p className='text-xs text-neutral-500'>The report is an AI interpretation. Receipts below record successful host tool operations; they do not certify the whole answer.</p>
        <details><summary>Verification report · {current.status.collaboration.stages.find(stage => stage.id === 'verification')?.status ?? 'reserved'}</summary><div className='whitespace-pre-wrap break-words'>{current.status.collaboration.stages.find(stage => stage.id === 'verification')?.text || 'Waiting for both reviews.'}</div></details>
        <details><summary>Tool evidence · {current.status.collaboration.evidence?.receipts.length ?? 0} recorded results</summary>
          <p className='text-xs text-neutral-500'>Results may be excerpts. No recorded result means no successful tool check is established here.</p>
          {current.status.collaboration.evidence?.receipts.map(receipt => <article key={receipt.id} className='mt-2 rounded-lg border p-3 text-sm'><p>{receipt.id} · {receipt.tool} · {receipt.recordedAt}{receipt.truncated ? ' · excerpt' : ''}</p><pre className='whitespace-pre-wrap break-words'>{receipt.result}</pre></article>)}
          {!!current.status.collaboration.evidence?.omitted && <p>{current.status.collaboration.evidence.omitted} additional results omitted from the bounded receipt record.</p>}
        </details>
        <details><summary>Verification tool activity</summary>{current.status.collaboration.toolActivity?.map((item, index) => <p key={index} className='text-xs'>{item.time} · {item.tool} · {item.state}</p>)}</details>
      </section>}
      {(['review_a', 'review_b'] as const).map((id, index) => {
        const stage = current.status!.collaboration!.stages.find(item => item.id === id)
        return <details key={id}><summary>Agent {index === 0 ? 'A' : 'B'} review · {stage?.status ?? 'reserved'}</summary><div className='whitespace-pre-wrap break-words'>{stage?.text || 'Waiting for both proposals.'}</div></details>
      })}
    </section>}
    {current.status && !current.status.collaboration && <p className='text-sm text-neutral-500'>Saved proposal-only session. Start a new collaboration for cross-review and a combined answer.</p>}
    <CollaborationStreams text={{ a: current.panes.a.text, b: current.panes.b.text }} status={current.status?.status ?? 'Waiting'}
      renderActions={slot=>current.panes[slot].text&&current.panes[slot].terminal&&current.status?<ConversationActions workspaceId={current.status.conversationId} slot='shared' defaultActor={slot} context={sourceContext(slot)} choices={Object.fromEntries(current.status.participants.map(p=>[p.id,p]))}/>:null}
      reviewedSession={!!current.status?.collaboration}
      recoverable={{ a: !!current.panes.a.error && !current.panes.a.terminal, b: !!current.panes.b.error && !current.panes.b.terminal }}
      participantStatus={{ a: current.panes.a.error ?? (current.panes.a.terminal ? 'Finished' : current.panes.a.attached ? 'Receiving' : 'Waiting'),
        b: current.panes.b.error ?? (current.panes.b.terminal ? 'Finished' : current.panes.b.attached ? 'Receiving' : 'Waiting') }}
      continueReady={{ a: !!proposalNodes.a, b: !!proposalNodes.b }}
      onContinue={current.status?.status === 'completed' && workspace ? slot => {
        const node = proposalNodes[slot]
        if (!node) return
        workspace.select(slot, node.id)
        requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="Agent ${slot.toUpperCase()} job task"]`)?.focus())
      } : undefined}
      onReconnect={HADRON_LIVE_COLLABORATION_ENABLED && sessionId ? id => observer.current?.reconnect(id) : undefined} />
    {current.error && <p role='alert'>{current.error} <button type='button' onClick={() => observer.current?.reconnect()}>Reload session</button></p>}
    {current.status?.error && <p role='alert'>{current.status.error}</p>}
    {stopError && <p role='alert'>Stop could not be confirmed. Check session status before retrying.</p>}
    {current.status?.journalAvailable === false && <p role='alert'>The automatic agent logs could not be saved. Check local storage before continuing.</p>}
    {active && <button type='button' disabled={pending} onClick={() => void stop()}>Stop both</button>}
    {HADRON_LIVE_COLLABORATION_ENABLED && sessionId && current.status && <div className='flex flex-wrap gap-3'>
      {(['a', 'b'] as const).map(id => <AgentJobLog key={`${sessionId}:${id}`} label={`Agent ${id.toUpperCase()}`} read={() => createCollaborationClient(async () => {
        if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
        return window.electronAPI.collaboration.capability()
      }).journal(sessionId, id)} />)}
      {current.status.collaboration?.stages.map(stage => <AgentJobLog key={`${sessionId}:${stage.id}`} label={stage.id === 'final' ? 'Combined answer' : stage.id === 'verification' ? 'Verification' : stage.id === 'review_a' ? 'Agent A review' : 'Agent B review'} read={() => createCollaborationClient(async () => {
        if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
        return window.electronAPI.collaboration.capability()
      }).journal(sessionId, stage.id)} />)}
    </div>}
    <p className='text-xs text-neutral-500'>Closing this view only disconnects the viewer. Use Stop both to cancel the session.</p>
  </section>
  return workspace?.targets.shared ? createPortal(responses, workspace.targets.shared) : workspace ? null : responses
}
