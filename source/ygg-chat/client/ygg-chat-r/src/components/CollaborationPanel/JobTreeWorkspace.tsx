import {HelperActivity} from './HelperActivity'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { IndependentJobView } from '../../features/collaboration/independentJobController'
import { createIndependentJobClient } from '../../features/collaboration/independentClient'
import type { AgentConversationTree } from '../../../../../shared/independentJobs'
import { SharedConversationTree } from './SharedConversationTree'
import { AgentBranchGraph } from './AgentBranchGraph'
import { QueryClientContext } from '@tanstack/react-query'
import { currentTaskNodes } from '../../features/collaboration/agentConversation'

type Slot = 'a' | 'b'
type Mode = 'together' | 'independent' | 'project'|'continuous'
type Pane = Slot | 'shared' | 'main' | 'project'|'continuous'
type PortalTarget=Exclude<Pane,'main'>|'projectTree'|'continuousTree'|'sharedComposer'|'projectComposer'|'continuousComposer'
interface TreeWorkspace {
  conversationId?: string; revision: number
  agentChoices: Partial<Record<Slot, {provider: string; modelName: string}>>; setAgentChoice(slot: Slot, choice: {provider: string; modelName: string}): void
  requestedSharedSession: {id:string; revision:number} | null; requestSharedSession(id:string): void
  treeScope: 'current' | 'all'; setTreeScope(scope: 'current' | 'all'): void
  sharedSessionId: string | null; setSharedSession(id: string | null): void
  newTasks: Partial<Record<Slot, boolean>>; beginTask(slot: Slot): void
  mode: Mode; setMode(mode: Mode): void
  leftView: Pane; showPane(pane: Pane): void
  selectedNodes: Partial<Record<Slot, string | null>>; selection: { slot: Slot; nodeId: string | null }; select(slot: Slot, nodeId: string | null): void
  jobs: Partial<Record<Slot, IndependentJobView>>; publish(slot: Slot, view: IndependentJobView): void
  historyPages: Partial<Record<Slot, string>>; historyLoading: Partial<Record<Slot, boolean>>; historyPage(slot: Slot, cursor?: string): void
  trees: Partial<Record<Slot, AgentConversationTree>>; errors: Partial<Record<Slot, string>>; refresh(): void
  targets: Partial<Record<PortalTarget, HTMLDivElement>>; setTarget(pane: PortalTarget, target: HTMLDivElement | null): void
}
const JobTrees = createContext<TreeWorkspace | null>(null)
export const useJobTreeWorkspace = () => useContext(JobTrees)

function savedNavigation(conversationId?: string) {
  const fallback = { mode: 'together' as Mode, leftView: 'shared' as Pane, selectedNodes: {} as Partial<Record<Slot, string | null>>, sharedSessionId: null as string | null }
  if (!conversationId || typeof window === 'undefined') return fallback
  try {
    const item = JSON.parse(localStorage.getItem(`hadron:agent-tree-view:${conversationId}`) ?? 'null')
    if (item?.schemaVersion !== 1 || !['together', 'independent','project','continuous'].includes(item.mode) || !['a', 'b', 'shared', 'main','project','continuous'].includes(item.leftView) ||
      !item.selectedNodes || typeof item.selectedNodes !== 'object' || ['a', 'b'].some(slot => item.selectedNodes[slot] !== undefined && item.selectedNodes[slot] !== null && (typeof item.selectedNodes[slot] !== 'string' || !item.selectedNodes[slot] || item.selectedNodes[slot].length > 256))) return fallback
    return { mode: item.mode as Mode, leftView: item.leftView as Pane, selectedNodes: { a: item.selectedNodes.a ?? null, b: item.selectedNodes.b ?? null }, treeScope: item.treeScope === 'all' ? 'all' as const : 'current' as const,
      sharedSessionId: typeof item.sharedSessionId === 'string' && item.sharedSessionId.length > 0 && item.sharedSessionId.length <= 128 ? item.sharedSessionId : null }
  } catch { return fallback }
}

/** Display/navigation state only; existing slot controllers own admission, Stop and replay. */
export function JobTreeWorkspaceProvider({ children, conversationId, initialSelection, initialSharedSessionId, initialPane }: { initialPane?: 'main'; children: ReactNode; conversationId?: string; initialSelection?: { slot: Slot; nodeId: string }; initialSharedSessionId?: string }) {
  const queryClient = useContext(QueryClientContext)
  const [initial] = useState(() => {
    const saved = savedNavigation(conversationId)
    if(initialPane==='main')return {...saved,mode:'independent' as Mode,leftView:'main' as Pane,selectedNodes:{},sharedSessionId:null}
    if (initialSelection) return { ...saved, mode: 'independent' as Mode, leftView: initialSelection.slot as Pane,
      selectedNodes: { ...saved.selectedNodes, [initialSelection.slot]: initialSelection.nodeId }, sharedSessionId: null }
    return initialSharedSessionId && !saved.sharedSessionId && !['project','continuous'].includes(saved.mode)
      ? { ...saved, mode: 'together' as Mode, leftView: 'shared' as Pane, sharedSessionId: initialSharedSessionId } : saved
  })
  const [agentChoices, setAgentChoices] = useState<TreeWorkspace['agentChoices']>({})
  const setAgentChoice = useCallback((slot: Slot, choice: {provider: string; modelName: string}) => { setAgentChoices(current => current[slot]?.provider === choice.provider && current[slot]?.modelName === choice.modelName ? current : {...current, [slot]: choice}) }, [])
  const [mode, updateMode] = useState<Mode>(initial.mode), [leftView, updatePane] = useState<Pane>(initial.leftView)
  const [selection, updateSelection] = useState<TreeWorkspace['selection']>(initialSelection ?? { slot: 'a', nodeId: null })
  const [selectedNodes, setSelectedNodes] = useState<TreeWorkspace['selectedNodes']>(initial.selectedNodes)
  const [treeScope, setTreeScope] = useState<'current' | 'all'>('treeScope' in initial && initial.treeScope === 'all' && !initialSelection ? 'all' : 'current')
  const [requestedSharedSession,setRequestedSharedSession] = useState<{id:string;revision:number}|null>(() => initial.sharedSessionId ? { id: initial.sharedSessionId, revision: 1 } : null)
  const requestSharedSession = useCallback((id:string)=>{updateMode('together');updatePane('shared');setRequestedSharedSession(current=>({id,revision:(current?.revision??0)+1}))},[])
  const [sharedSessionId, updateSharedSession] = useState<string | null>(initial.sharedSessionId)
  const [newTasks, setNewTasks] = useState<Partial<Record<Slot, boolean>>>({})
  const setSharedSession = useCallback((id: string | null) => { updateSharedSession(id) }, [])
  const beginTask = useCallback((slot: Slot) => { setTreeScope('current'); setNewTasks(current => ({ ...current, [slot]: true })) }, [])
  useEffect(() => {
    if (!conversationId) return
    // Navigation IDs only. Questions, responses, files and credentials stay out of localStorage.
    try { localStorage.setItem(`hadron:agent-tree-view:${conversationId}`, JSON.stringify({ schemaVersion: 1, mode, leftView, selectedNodes, treeScope, sharedSessionId })) } catch { /* A view preference must not block job recovery. */ }
  }, [conversationId, mode, leftView, selectedNodes, treeScope, sharedSessionId])
  const selectedNodesRef = useRef(selectedNodes); selectedNodesRef.current = selectedNodes
  const [jobs, setJobs] = useState<TreeWorkspace['jobs']>({}), [trees, setTrees] = useState<TreeWorkspace['trees']>({})
  const [errors, setErrors] = useState<TreeWorkspace['errors']>({}), [revision, setRevision] = useState(0)
  const [historyPages, setHistoryPages] = useState<Partial<Record<Slot, string>>>({})
  const [historyLoading, setHistoryLoading] = useState<Partial<Record<Slot, boolean>>>({})
  const historyPage = useCallback((slot: Slot, cursor?: string) => setHistoryPages(current => ({...current, [slot]: cursor})), [])
  const [targets, setTargets] = useState<TreeWorkspace['targets']>({})
  const historySize = (trees.a?.nodes.length ?? 0) + (trees.b?.nodes.length ?? 0)
  useEffect(() => {
    if (!historySize || !queryClient) return
    // Agent records are created outside the inherited main-chat mutations.
    // Refresh cached project/recent lists when newly saved messages become visible.
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [queryClient, conversationId, historySize])
  const selectionRef = useRef(selection); selectionRef.current = selection
  const setMode = useCallback((next: Mode) => { updateMode(next); updatePane(next==='continuous'?'continuous':next === 'project'?'project':next === 'together' ? 'shared' : selectionRef.current.slot) }, [])
  const showPane = useCallback((pane: Pane) => { updatePane(pane); if (pane === 'a' || pane === 'b') { updateMode('independent'); updateSelection({ slot: pane, nodeId: selectedNodesRef.current[pane] ?? null }) } else if (pane === 'shared') updateMode('together');else if(pane==='project')updateMode('project');else if(pane==='continuous')updateMode('continuous') }, [])
  const select = useCallback((slot: Slot, nodeId: string | null) => { if (nodeId) setNewTasks(current => ({ ...current, [slot]: false })); setSelectedNodes(current => ({ ...current, [slot]: nodeId })); updateSelection({ slot, nodeId }); updatePane(slot); updateMode('independent') }, [])
  const publish = useCallback((slot: Slot, view: IndependentJobView) => {
    if (view.phase === 'preparing' || view.phase === 'submitting') { setTreeScope('current'); setNewTasks(current => current[slot] ? { ...current, [slot]: false } : current) }
    setJobs(current => current[slot] === view ? current : { ...current, [slot]: view })
  }, [])
  const setTarget = useCallback((pane: PortalTarget, target: HTMLDivElement | null) => { setTargets(current => current[pane] === target ? current : { ...current, [pane]: target ?? undefined }) }, [])
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  const jobKey = (['a', 'b'] as const).map(slot => `${jobs[slot]?.id ?? ''}:${jobs[slot]?.status?.revision ?? ''}`).join('|')
  useEffect(() => {
    if (!conversationId) return
    const abort = new AbortController()
    const client = createIndependentJobClient(async () => {
      if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
      return window.electronAPI.collaboration.capability()
    })
    for (const slot of ['a', 'b'] as const) {
      setHistoryLoading(current => ({...current, [slot]: true}))
      const focusNodeId = mode === 'together' && sharedSessionId
        ? `hadron-response-proposal:${sharedSessionId}:${slot}`
        : selectedNodesRef.current[slot] ?? (jobs[slot]?.id && jobs[slot]?.status ? `hadron-response-${jobs[slot]!.id}` : undefined)
      void client.workspace(conversationId, slot, abort.signal, {cursor: historyPages[slot], focusNodeId}).then(tree => {
      if (abort.signal.aborted) return
      setTrees(current => ({ ...current, [slot]: tree })); setErrors(current => ({ ...current, [slot]: undefined }))
    }).catch(() => { if (!abort.signal.aborted) setErrors(current => ({ ...current, [slot]: 'Saved agent history could not be loaded. Refresh trees or return to the first history page to try again.' })) }).finally(() => { if (!abort.signal.aborted) setHistoryLoading(current => ({...current, [slot]: false})) })
    }
    return () => abort.abort()
  }, [conversationId, mode, jobKey, revision, historyPages, sharedSessionId])
  const value = useMemo(() => ({ agentChoices, setAgentChoice, conversationId, revision, requestedSharedSession, requestSharedSession, treeScope, setTreeScope, sharedSessionId, setSharedSession, newTasks, beginTask, mode, setMode, leftView, showPane, selection, selectedNodes, select, jobs, publish, trees, errors, refresh, historyPages, historyLoading, historyPage, targets, setTarget }), [agentChoices, setAgentChoice, conversationId, revision, requestedSharedSession, requestSharedSession, treeScope, sharedSessionId, setSharedSession, newTasks, beginTask, mode, setMode, leftView, showPane, selection, selectedNodes, select, jobs, publish, trees, errors, refresh, historyPages, historyLoading, historyPage, targets, setTarget])
  return <JobTrees.Provider value={value}>{children}</JobTrees.Provider>
}

export function AgentConversationPane({ legacyChat }: { legacyChat: ReactNode }) {
  const workspace = useJobTreeWorkspace(), targetSetter = workspace?.setTarget
  const targetA = useCallback((target: HTMLDivElement | null) => targetSetter?.('a', target), [targetSetter])
  const targetB = useCallback((target: HTMLDivElement | null) => targetSetter?.('b', target), [targetSetter])
  const targetShared = useCallback((target: HTMLDivElement | null) => targetSetter?.('shared', target), [targetSetter])
  const targetProject = useCallback((target: HTMLDivElement | null) => targetSetter?.('project', target), [targetSetter])
  const targetContinuous = useCallback((target: HTMLDivElement | null) => targetSetter?.('continuous', target), [targetSetter])
  const sharedComposer=useCallback((target:HTMLDivElement|null)=>targetSetter?.('sharedComposer',target),[targetSetter])
  const projectComposer=useCallback((target:HTMLDivElement|null)=>targetSetter?.('projectComposer',target),[targetSetter])
  const continuousComposer=useCallback((target:HTMLDivElement|null)=>targetSetter?.('continuousComposer',target),[targetSetter])
  if (!workspace) return <>{legacyChat}</>
  return <>
    <nav aria-label='Conversation view' className='flex shrink-0 flex-wrap gap-2 border-b p-3'>
      {(['a', 'b', 'shared', 'project','continuous','main'] as const).map(pane => <button key={pane} type='button' aria-pressed={workspace.leftView === pane} onClick={() => workspace.showPane(pane)} className='px-3 py-2 text-sm'>{pane === 'a' ? 'Agent A' : pane === 'b' ? 'Agent B' : pane === 'shared' ? 'Shared task' : pane==='project'?'Project build':pane==='continuous'?'Conversation':'Main chat'}</button>)}
    </nav>
    <div style={{ display: workspace.leftView === 'main' ? 'contents' : 'none' }}>{legacyChat}</div>
    <div ref={targetA} hidden={workspace.leftView !== 'a'} className='min-h-0 flex-1 overflow-hidden' data-agent-conversation='a' />
    <div ref={targetB} hidden={workspace.leftView !== 'b'} className='min-h-0 flex-1 overflow-hidden' data-agent-conversation='b' />
    <div hidden={workspace.leftView!=='shared'} style={{display:workspace.leftView==='shared'?'flex':'none'}} className='min-h-0 flex-1 flex-col'><div ref={targetShared} className='min-h-0 flex-1 overflow-y-auto p-4' data-agent-conversation='shared'><h2 className='mb-2 text-lg font-semibold'>Work together · responses</h2><p className='mb-4 text-sm text-neutral-500'>Choose folder and models on the right. Write instructions below. Proposals, reviews and the combined answer appear here.</p></div><div ref={sharedComposer} className='max-h-[55%] min-h-36 shrink-0 overflow-y-auto border-t p-3' /></div>
    <div hidden={workspace.leftView!=='project'} style={{display:workspace.leftView==='project'?'flex':'none'}} className='min-h-0 flex-1 flex-col'><div ref={targetProject} className='min-h-0 flex-1 overflow-y-auto p-4' data-project-build='response' /><div ref={projectComposer} className='max-h-[60%] min-h-36 shrink-0 overflow-y-auto border-t p-3' /></div>
    <div hidden={workspace.leftView!=='continuous'} style={{display:workspace.leftView==='continuous'?'flex':'none'}} className='min-h-0 flex-1 flex-col'><div ref={targetContinuous} className='min-h-0 flex-1 overflow-y-auto p-4' data-continuous-chat='response' /><div ref={continuousComposer} className='max-h-[55%] min-h-36 shrink-0 overflow-y-auto border-t p-3' /></div>
  </>
}

export function CentralJobTrees({ chatTree }: { chatTree: ReactNode }) {
  const workspace = useJobTreeWorkspace()
  const targetSetter=workspace?.setTarget
  const targetProject=useCallback((target:HTMLDivElement|null)=>targetSetter?.('projectTree',target),[targetSetter])
  const targetContinuous=useCallback((target:HTMLDivElement|null)=>targetSetter?.('continuousTree',target),[targetSetter])
  const [selected, setSelected] = useState<'chat' | 'jobs' | 'project'|'continuous'>('chat')
  useEffect(() => { setSelected(workspace?.leftView==='continuous'?'continuous':workspace?.leftView==='project'?'project':workspace?.leftView === 'main' ? 'chat' : 'jobs') }, [workspace?.leftView])
  if (!workspace) return <>{chatTree}</>
  return <div className='flex h-full min-h-0 flex-col' aria-label='Tree workspace'>
    <HelperActivity workspaceId={workspace.conversationId}/>
    <nav aria-label='Tree views' className='flex shrink-0 flex-wrap gap-2 border-b p-3'>
      <button type='button' aria-pressed={selected === 'chat'} onClick={() => setSelected('chat')} className='px-3 py-2 text-sm'>Chat tree</button>
      <button type='button' aria-pressed={selected === 'jobs'} onClick={() => setSelected('jobs')} className='px-3 py-2 text-sm'>Agent trees</button>
      <button type='button' aria-pressed={selected === 'project'} onClick={() => {setSelected('project');workspace.setMode('project')}} className='px-3 py-2 text-sm'>Project plan</button>
      <button type='button' aria-pressed={selected === 'continuous'} onClick={() => {setSelected('continuous');workspace.setMode('continuous')}} className='px-3 py-2 text-sm'>Conversation turns</button>
    </nav>
    <div hidden={selected !== 'chat'} className='min-h-0 flex-1'>{chatTree}</div>
    <div ref={targetProject} hidden={selected!=='project'} className='min-h-0 flex-1 overflow-y-auto p-3' data-project-build='tree' />
    <div ref={targetContinuous} hidden={selected!=='continuous'} className='min-h-0 flex-1 overflow-y-auto p-3' data-continuous-chat='tree' />
    <section hidden={selected !== 'jobs'} aria-label='Independent agent trees' className='min-h-0 flex-1 overflow-y-auto p-3'>
      <div className='flex items-center justify-between gap-2'><h2 className='font-semibold'>Agent branches</h2><button type='button' onClick={workspace.refresh} className='px-2 py-1 text-xs'>Refresh trees</button></div>
      <nav aria-label='Agent tree scope' className='my-3 flex flex-wrap gap-3'>
        <button type='button' aria-pressed={workspace.treeScope === 'current'} onClick={() => workspace.setTreeScope('current')} className='px-3 py-2 text-sm'>Current task</button>
        <button type='button' aria-pressed={workspace.treeScope === 'all'} onClick={() => workspace.setTreeScope('all')} className='px-3 py-2 text-sm'>All workspace chats</button>
      </nav>
      <p className='mb-2 text-xs text-neutral-500'>{workspace.treeScope === 'all' ? 'Browse saved conversations in this workspace, 32 tasks at a time. A selected branch stays visible while you browse.' : workspace.mode === 'together' ? 'Showing this collaboration and its agent branches.' : 'Showing each agent’s current conversation, including its loaded alternative branches.'} This view does not change what the agents receive.</p>
      <p className='mt-1 text-xs text-neutral-500'>Select any question or answer to open that path on the left. Your next message branches from the selected node.</p>
      {workspace.mode === 'together' && workspace.conversationId && <SharedConversationTree conversationId={workspace.conversationId} selectedSessionId={workspace.sharedSessionId} revision={`${workspace.revision}:${workspace.trees.a?.nodes.length}:${workspace.trees.b?.nodes.length}`} all={workspace.treeScope==='all'} onSelect={workspace.requestSharedSession}/>}
      {(['a', 'b'] as const).map(slot => {
        const allNodes = workspace.trees[slot]?.nodes ?? []
        const selectedId = workspace.selectedNodes[slot] ?? allNodes.filter(node => node.jobId === workspace.jobs[slot]?.id).at(-1)?.id ?? null
        const nodes = workspace.treeScope === 'all' ? allNodes : currentTaskNodes(allNodes, { slot, shared: workspace.mode === 'together', sessionId: workspace.sharedSessionId, selectedId, jobId: workspace.jobs[slot]?.id, newTask: workspace.newTasks[slot] })
        return <section key={slot} aria-label={`Agent ${slot.toUpperCase()} branches`} className='mt-3 rounded-xl border p-3'>
        <button type='button' onClick={() => workspace.showPane(slot)} className='mb-2 px-2 py-1 font-semibold'>Agent {slot.toUpperCase()}</button>
        {workspace.treeScope === 'all' && <div className='mb-3 flex flex-wrap items-center gap-3' aria-label={`Agent ${slot.toUpperCase()} history pages`}>
          {workspace.historyPages[slot] && <button type='button' className='px-2 py-1 text-sm' disabled={workspace.historyLoading[slot]} onClick={() => workspace.historyPage(slot)}>First page</button>}
          {workspace.trees[slot]?.page?.nextCursor && <button type='button' className='px-2 py-1 text-sm' disabled={workspace.historyLoading[slot]} onClick={() => workspace.historyPage(slot, workspace.trees[slot]!.page!.nextCursor!)}>More saved chats</button>}
          {workspace.historyLoading[slot] && <span role='status' className='text-xs'>Loading saved chats…</span>}
        </div>}
        {workspace.errors[slot] && <p role='alert' className='text-xs'>{workspace.errors[slot]}</p>}
        {!nodes.length && !workspace.errors[slot] && <p className='text-xs text-neutral-500'>{workspace.treeScope === 'current' ? 'No branches for the current task yet. Start a task, or open All workspace chats to choose a saved conversation.' : 'Start a task for this agent to create its first branch.'}</p>}
        {!!nodes.length && <AgentBranchGraph nodes={nodes} slot={slot}
          selectedId={selectedId ?? nodes.at(-1)?.id ?? null} onSelect={id => workspace.select(slot, id)} />}

      </section>})}
    </section>
  </div>
}
