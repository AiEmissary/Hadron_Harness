import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createIndependentJobClient } from '../../features/collaboration/independentClient'
import type { AgentWorkspaceNavigation } from '../../../../../shared/independentJobs'
import { AgentConversationPane, JobTreeWorkspaceProvider } from './JobTreeWorkspace'
import './HadronLayout.css'
import './HadronButtons.css'
import { rememberWorkspace } from '../../features/collaboration/startupWorkspace'

/** Keep the existing chat/tree coordinate space separate from the collaboration dock. */
export function ChatCollaborationLayout({ children, workspace, workspaceOpen, chatAreaRef, onOpenWorkspace, conversationId, restoreSavedAgent = false, ownerId }: {
  ownerId?: string | null
  conversationId?: string; children: ReactNode; workspace: ReactNode; workspaceOpen: boolean; chatAreaRef?: Ref<HTMLDivElement>; onOpenWorkspace?(): void; restoreSavedAgent?: boolean
}) {
  const [navigation, setNavigation] = useState<AgentWorkspaceNavigation | null>(null)
  const [restoreError, setRestoreError] = useState(false), [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!restoreSavedAgent || !conversationId) return
    const abort = new AbortController(); setRestoreError(false)
    const client = createIndependentJobClient(async () => {
      if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
      return window.electronAPI.collaboration.capability()
    })
    void client.openWorkspace(conversationId, abort.signal).then(value => { if (!abort.signal.aborted) setNavigation(value) })
      .catch(() => { if (!abort.signal.aborted) setRestoreError(true) })
    return () => abort.abort()
  }, [restoreSavedAgent, conversationId, retry])
  const restored = restoreSavedAgent && navigation?.requestedConversationId === conversationId ? navigation : null
  const workspaceId = restored?.workspaceConversationId ?? conversationId
  useEffect(() => {
    if(ownerId && workspaceId && (!restoreSavedAgent || restored)) rememberWorkspace(ownerId,workspaceId)
  },[ownerId,workspaceId,restoreSavedAgent,restored])
  const initialSelection = restored?.slot && restored.nodeId ? { slot: restored.slot, nodeId: restored.nodeId } : undefined
  const workspaceContent = restored && isValidElement<Record<string, unknown>>(workspace)
    ? cloneElement(workspace, { conversationId: workspaceId, ...(initialSelection ? { captureAnchor: undefined } : {}) }) : workspace
  const reopen = useRef<HTMLButtonElement>(null)
  const previouslyOpen = useRef(workspaceOpen)
  useEffect(() => {
    if (previouslyOpen.current && !workspaceOpen) reopen.current?.focus()
    previouslyOpen.current = workspaceOpen
  }, [workspaceOpen])
  if (restoreSavedAgent && !restored) return <div className='hadron-shell h-full w-full p-6' role={restoreError ? 'alert' : 'status'}>
    {restoreError ? <>Saved chats could not be opened. <button type='button' className='px-3 py-2' onClick={() => setRetry(value => value + 1)}>Retry opening saved chats</button></> : 'Opening saved workspace…'}
  </div>
  return <JobTreeWorkspaceProvider key={`${conversationId}:${workspaceId}`} conversationId={workspaceId} initialPane={restored?.historicalOnly?'main':undefined} initialSelection={initialSelection} initialSharedSessionId={restored?.sharedSessionId}><div className='hadron-shell flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden lg:flex-row' data-collaboration-layout='true'>
    <div ref={chatAreaRef} className='relative flex min-h-0 min-w-0 flex-1 overflow-hidden' data-existing-chat-area='true'>{Children.map(children, child => isValidElement<Record<string, unknown>>(child) && child.props['data-chat-pane-kind'] === 'primary' ? cloneElement(child, {}, <AgentConversationPane legacyChat={<>{restored?.historicalOnly&&<p role='status' className='m-3 rounded-xl border p-3 text-sm'>Saved chat history is available. Its original agent-session record is no longer available, so Hadron has opened the saved messages in Main chat. No old agent job has been restarted.</p>}{child.props.children as ReactNode}</>} />) : child)}</div>
    <div className={workspaceOpen ? 'h-[48%] min-h-56 w-full shrink-0 overflow-hidden border-t border-neutral-200 lg:h-full lg:min-h-0 lg:w-[clamp(360px,38vw,640px)] lg:border-l lg:border-t-0 dark:border-neutral-700' : 'hidden'}
      data-collaboration-dock='true'>{workspaceContent}</div>
    {!workspaceOpen && onOpenWorkspace && <aside aria-label='Collapsed agent workspace' className='shrink-0 border-t border-violet-300 bg-violet-50 p-2 lg:w-12 lg:border-l lg:border-t-0 dark:border-violet-800 dark:bg-violet-950'>
      <button ref={reopen} type='button' aria-label='Open agent workspace' aria-controls='hadron-collaboration-workspace' aria-expanded={false}
        onClick={onOpenWorkspace} className='flex w-full items-center justify-center gap-2 rounded-lg px-2 py-3 text-sm font-semibold text-violet-800 hover:bg-violet-100 focus-visible:outline focus-visible:outline-2 dark:text-violet-100 dark:hover:bg-violet-900 lg:[writing-mode:vertical-rl]'>
        <span aria-hidden='true'>◀</span>Agents
      </button>
    </aside>}
  </div></JobTreeWorkspaceProvider>
}
