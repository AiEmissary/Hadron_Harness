import {CopyIntoProject} from './CopyIntoProject'
import { CollaborationAdmission, browserAdmissionStore, emptyAdmission } from '../../features/collaboration/admission'
import { createCollaborationClient } from '../../features/collaboration/client'
import { buildProposalInput } from '../../features/collaboration/setup'
import { SavedCollaborationSessions } from './SavedCollaborationSessions'
import { useEffect, useId, useRef, useState } from 'react'
import { HADRON_LIVE_COLLABORATION_ENABLED } from '../../../../../shared/collaboration'
import type { ProposalSessionStatus } from '../../../../../shared/collaboration'
import type { CollaborationAnchor } from '../../features/collaboration/context'
import type { ParticipantOption } from '../../features/collaboration/setup'
import { CollaborationPanel } from './CollaborationPanel'
import { CollaborationSessionView } from './CollaborationSessionView'
import { IndependentJobs } from './IndependentJobs'
import { HadronToolLibrary } from './HadronToolLibrary'
import { SubscriptionConnections } from './SubscriptionConnections'
import { useJobTreeWorkspace } from './JobTreeWorkspace'
import hadronLogo from '../../assets/hadron/eyehadron.jpg'
import {ProjectBuildPanel} from './ProjectBuildPanel'
import {ContinuousChatPanel} from './ContinuousChatPanel'
import {HadronHelp} from './HadronHelp'
import {refreshProviderChoices} from '../../features/collaboration/providerChoices'

const unavailableProviders = [{ provider: 'openaichatgpt' as const, label: 'ChatGPT', connected: false,
  connectionLabel: 'Collaboration connection and model approval are pending', models: [] }]

/** Docked workspace beside chat/tree. Its contents remain provisional for design review. */
export function CollaborationWorkspace({ open, conversationId, captureAnchor, onClose }: {
  open: boolean; conversationId: string; captureAnchor?: () => CollaborationAnchor; onClose(): void
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const title = useId()
  const capture = useRef(captureAnchor); capture.current = captureAnchor
  const [anchor, setAnchor] = useState<CollaborationAnchor | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)
  const [taskOnly, setTaskOnly] = useState(false)
  useEffect(() => setTaskOnly(false), [conversationId])
  const [options, setOptions] = useState<ParticipantOption[]>(unavailableProviders)
  const [ownerAvailable, setOwnerAvailable] = useState(false)
  const [liveAvailable, setLiveAvailable] = useState(false)
  const [connectionRevision, setConnectionRevision] = useState(0)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [providerError, setProviderError] = useState<string | null>(null)
  useEffect(() => { const changed = () => setConnectionRevision(value => value + 1); window.addEventListener('hadron-subscription-changed', changed); return () => window.removeEventListener('hadron-subscription-changed', changed) }, [])
  const [localMode, setLocalMode] = useState<'together' | 'independent' | 'project'|'continuous'>('together')
  const treeWorkspace = useJobTreeWorkspace()
  const mode = treeWorkspace?.mode ?? localMode
  const setMode = treeWorkspace?.setMode ?? setLocalMode
  useEffect(() => {
    if (!open) return
    try { const captured=capture.current?.()??null;setAnchor(captured);if(!captured)setTaskOnly(true);setContextError(null) }
    catch (error) { setAnchor(null);setTaskOnly(true);setContextError(error instanceof Error ? error.message : 'Branch context unavailable.') }
  }, [open, conversationId])
  useEffect(() => {
    if (!open) return
    let current = true
    setLoadingProviders(true); setProviderError(null)
    void refreshProviderChoices({
      setup: () => window.electronAPI.collaboration.setup(),
      claudeModels: () => window.electronAPI.continuousChat.claudeModels(),
    }, {
      setup: (owner, live) => { if (current) { setOwnerAvailable(owner); setLiveAvailable(HADRON_LIVE_COLLABORATION_ENABLED && live) } },
      provider: option => { if (current) setOptions(previous => [...previous.filter(item => item.provider !== option.provider), option].sort((a,b) => a.provider === b.provider ? 0 : a.provider === 'openaichatgpt' ? -1 : 1)) },
      error: provider => { if (current) setProviderError(previous => previous ? `${previous} ${provider} could not be checked.` : `${provider} could not be checked. Refresh providers and models to try again.`) },
    }).finally(() => { if (current) setLoadingProviders(false) })
    return () => { current = false }
  }, [open, conversationId, connectionRevision])
  const [continuation, setContinuation] = useState<ProposalSessionStatus | null>(null)
  const [includeParentContext, setIncludeParentContext] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  useEffect(() => { setSelectedSessionId(null); setContinuation(null); setOwnerAvailable(false) }, [conversationId])
  const [admissionState, setAdmissionState] = useState(emptyAdmission)
  const [admissionReady, setAdmissionReady] = useState(false)
  const admission = useRef<CollaborationAdmission | null>(null)
  useEffect(() => { if(treeWorkspace?.requestedSharedSession) setSelectedSessionId(treeWorkspace.requestedSharedSession.id) }, [treeWorkspace?.requestedSharedSession])
  const status = selectedSessionId === admissionState.sessionId ? admissionState.status : null
  const [draftRevision, setDraftRevision] = useState(0)
  const [keepFilesOnReset, setKeepFilesOnReset] = useState(false), [newRequestRevision, setNewRequestRevision] = useState(0)
  const canPrepareNew = admissionState.phase === 'ready' || (admissionState.phase === 'accepted' && !!admissionState.status && ['completed', 'cancelled', 'failed', 'interrupted'].includes(admissionState.status.status))
  const prepareNewCollaboration = (keepFiles: boolean) => {
    if (!canPrepareNew) throw new Error('Confirm the existing session first')
    if (admissionState.phase !== 'ready') {
      if (!admission.current) throw new Error('Session recovery unavailable')
      admission.current.prepareNext()
    }
    setContinuation(null); setSelectedSessionId(null); setTaskOnly(true); setKeepFilesOnReset(keepFiles); setDraftRevision(value => value + 1)
    treeWorkspace?.setSharedSession(null); treeWorkspace?.setTreeScope('current')
  }
  const continueBoth = (previous: ProposalSessionStatus) => {
    if (!canPrepareNew || previous.status !== 'completed' || !previous.collaboration || previous.conversationId !== conversationId) return
    if (admissionState.phase !== 'ready') admission.current?.prepareNext()
    setContinuation(previous); setIncludeParentContext(true); setSelectedSessionId(previous.sessionId); setTaskOnly(true)
    treeWorkspace?.setSharedSession(previous.sessionId); treeWorkspace?.setTreeScope('current'); treeWorkspace?.showPane('shared')
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Shared task"]')?.focus())
  }
  const client = () => createCollaborationClient(async () => {
    if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
    return window.electronAPI.collaboration.capability()
  })
  useEffect(() => {
    setAdmissionReady(false)
    if (!liveAvailable || !ownerAvailable) return
    let current = true
    try {
      const coordinator = new CollaborationAdmission(client(), next => {
        if (!current) return
        setAdmissionState(next)
        if (next.sessionId) setSelectedSessionId(current => next.phase === 'submitting' || !current ? next.sessionId : current)
      }, browserAdmissionStore(conversationId))
      admission.current = coordinator
      setAdmissionReady(true)
      // Confirm the last admission with GET even when viewing an earlier saved answer.
      // A failed read retains the existing fence; it never retries the paid request.
      void coordinator.recover()
      return () => { current = false; admission.current = null; coordinator.dispose() }
    } catch { setAdmissionState({ phase: 'unknown', status: null, sessionId: null, error: 'Saved session recovery is unavailable. Start remains disabled.' }) }
  }, [conversationId, ownerAvailable, liveAvailable])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [open])
  return <aside hidden={!open} id='hadron-collaboration-workspace' aria-labelledby={title} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
  }} data-collaboration-conversation={conversationId}
    className='h-full min-h-0 w-full overflow-y-auto overscroll-contain bg-neutral-50 p-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100'>
    <header className='mb-4 flex items-center justify-between gap-4'>
      <div className='flex min-w-0 items-center gap-3'>
        <img src={hadronLogo} alt='Hadron Harness logo' className='h-12 w-18 shrink-0 rounded-lg bg-black object-contain' />
        <div><h1 id={title} className='text-lg font-semibold'>Hadron Harness</h1>
          <p className='text-sm text-neutral-500'>Agent A and Agent B each have their own provider and model selection.</p></div>
      </div>
      <div className='flex flex-wrap justify-end gap-2'><HadronHelp onChoose={setMode}/><CopyIntoProject workspaceId={conversationId}/><button ref={closeButton} type='button' onClick={onClose} aria-label='Collapse agent workspace' title='Collapse to the Agents tab' className='rounded-full border px-4 py-2 text-sm'>Collapse</button></div>
    </header>
    <h2 className='mb-2 font-semibold'>1. Mode</h2>
    <nav aria-label='Agent workspace mode' className='mb-4 flex flex-wrap gap-2'>
      <button type='button' aria-pressed={mode === 'together'} onClick={() => setMode('together')} className='rounded-full border px-3 py-2 text-sm aria-pressed:bg-violet-100 dark:aria-pressed:bg-violet-950'>Work together</button>
      <button type='button' aria-pressed={mode === 'independent'} onClick={() => setMode('independent')} className='rounded-full border px-3 py-2 text-sm aria-pressed:bg-violet-100 dark:aria-pressed:bg-violet-950'>Independent jobs</button>
      <button type='button' aria-pressed={mode === 'project'} onClick={() => setMode('project')} className='rounded-full border px-3 py-2 text-sm aria-pressed:bg-violet-100 dark:aria-pressed:bg-violet-950'>Build a project</button>
      <button type='button' aria-pressed={mode === 'continuous'} onClick={() => setMode('continuous')} className='rounded-full border px-3 py-2 text-sm aria-pressed:bg-violet-100 dark:aria-pressed:bg-violet-950'>Automatic conversation</button>
    </nav>
    <p className='mb-3 text-sm'>Setup here → instructions on the left → responses above them.</p>
    <div aria-label='Provider availability' className='mb-3 space-y-2 text-sm'>
      <button type='button' disabled={loadingProviders} onClick={() => setConnectionRevision(value => value + 1)} className='rounded-lg border px-3 py-2'>{loadingProviders ? 'Loading providers and models…' : 'Refresh providers and models'}</button>
      {providerError && <p role='status'>{providerError}</p>}
    </div>
    <details open={!options.some(option=>option.connected)} className='mb-4 rounded-xl border p-3'><summary className='cursor-pointer text-sm'>Subscription connections · {options.some(option=>option.connected)?'connected':'connect an account'}</summary><div className='mt-3'><SubscriptionConnections/></div></details>
    <ProjectBuildPanel key={conversationId} conversationId={conversationId} options={options} enabled={liveAvailable&&ownerAvailable} active={mode==='project'} />
    <ContinuousChatPanel key={`continuous:${conversationId}`} conversationId={conversationId} options={options} active={mode==='continuous'}/>
    <div hidden={mode !== 'independent'}>
      <IndependentJobs conversationId={conversationId} options={options} enabled={liveAvailable && ownerAvailable} />
    </div>
    <div hidden={mode !== 'together'} className='space-y-4'>
      <div className='rounded-xl border p-3 text-sm'>
        <p>{taskOnly ? 'Task only: chat history will not be shared.' : anchor ? `Selected branch: ${anchor.messageCount} text messages captured.` : contextError ?? 'Select a saved branch or start from the shared task below.'}</p>
        {!anchor && !taskOnly && <button type='button' className='mt-2 px-3 py-2 text-xs' onClick={() => setTaskOnly(true)}>Use task only</button>}
        <p className='mt-1 text-xs text-neutral-500'>{ownerAvailable ? 'Local user available.' : 'Local user status is unavailable.'} Branch context excludes files and tool output. Add shared files below.</p>
        {anchor && !taskOnly && <details className='mt-2'><summary className='cursor-pointer'>Review shared context</summary><pre className='mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs'>{anchor.context}</pre></details>}
      </div>
      {continuation && <section aria-label='Shared follow-up context' className='rounded-xl border p-3 space-y-2 text-sm'>
        <p>Continuing with both agents from the selected combined answer. Only this conversation path is carried forward.</p>
        <label className='flex items-start gap-2'><input type='checkbox' checked={includeParentContext} onChange={event => setIncludeParentContext(event.target.checked)} />Include previous shared context and attached-file text</label>
        <p className='text-xs text-neutral-500'>Previous questions and combined answers are retained. Add any new files below. Sending starts a new saved follow-up; preparing it sends no AI request.</p>
      </section>}
      <CollaborationPanel workEnabled={liveAvailable&&ownerAvailable&&canPrepareNew} workspaceId={conversationId} continuation={continuation} sharedContext={taskOnly ? '' : anchor?.context} options={options} enabled={liveAvailable && ownerAvailable && (!!anchor || taskOnly) && admissionReady && admissionState.phase === 'ready'} status={status}
        onReopen={async () => { const saved = await client().list(conversationId); const latest = saved.sessions.find(item => item.status === 'completed'); if (!latest) throw Error('No completed shared answer was found on the latest saved page. Use Saved sessions to browse earlier work.'); setSelectedSessionId(latest.sessionId); treeWorkspace?.requestSharedSession(latest.sessionId) }}
        onNew={prepareNewCollaboration} canPrepareNew={canPrepareNew} draftRevision={draftRevision} keepFilesOnReset={keepFilesOnReset} newRequestRevision={newRequestRevision}
        disabledReason={!HADRON_LIVE_COLLABORATION_ENABLED ? 'Live collaboration is disabled while integration checks are completed.' : admissionState.phase !== 'ready' ? 'Prepare another task to start a new collaboration.' : !anchor && !taskOnly ? 'Choose Use task only, or select a saved branch.' : 'Connect an available subscription to start collaboration.'}
        onStart={async draft => {
          if (!liveAvailable || !ownerAvailable || (!anchor && !taskOnly) || !admission.current) throw new Error('Collaboration admission is unavailable')
          const sessionId = crypto.randomUUID()
          treeWorkspace?.setTreeScope('current')
          treeWorkspace?.setSharedSession(sessionId)
          const source = taskOnly ? await client().prepareTask(sessionId, conversationId, draft.task.trim() || 'Work on the attached files.') : anchor!
          const input = buildProposalInput(draft, options, { sessionId, conversationId: source.conversationId,
            sourceLineageId: source.sourceLineageId, anchorMessageId: source.anchorMessageId, context: source.context, ...(continuation ? { parentSessionId: continuation.sessionId, includeParentContext } : {}) })
          if (continuation) await client().preflight(input)
          await admission.current.submit(input)
        }}
        onStop={async () => {
          if (!HADRON_LIVE_COLLABORATION_ENABLED || !admissionState.sessionId) throw new Error('No active collaboration session')
          await client().stop(admissionState.sessionId); await admission.current?.recover()
        }} />
      {admissionState.error && <p role='alert' className='text-sm'>{admissionState.error}</p>}
      <div className='flex flex-wrap items-center gap-4' aria-label='Collaboration session actions'>
        {HADRON_LIVE_COLLABORATION_ENABLED && admissionState.phase !== 'ready' && <button type='button' className='rounded-lg px-3 py-2 text-sm'
          disabled={admissionState.phase === 'submitting'} onClick={() => void admission.current?.recover()}>Check existing session</button>}
        {status && ['completed', 'cancelled', 'failed', 'interrupted'].includes(status.status) && <button type='button' className='rounded-lg px-3 py-2 text-sm'
          onClick={() => setNewRequestRevision(value => value + 1)}>Prepare another task</button>}
      </div>
      {open && liveAvailable && <SavedCollaborationSessions conversationId={conversationId} onSelected={id => { if (id) { setSelectedSessionId(id); treeWorkspace?.setTreeScope('current') } }} />}
      {liveAvailable && <CollaborationSessionView sessionId={selectedSessionId} onContinueBoth={continueBoth} canContinueBoth={canPrepareNew} onStatus={next => { if (next.sessionId === admissionState.sessionId && next.revision > (admissionState.status?.revision ?? -1)) void admission.current?.recover() }} />}
      <p className='text-xs text-neutral-500'>Two independent sessions can use the same provider and model. This does not require two accounts.</p>
    </div>
    {HADRON_LIVE_COLLABORATION_ENABLED&&mode!=='project'&&<div className='mt-4'><HadronToolLibrary/></div>}
  </aside>
}
