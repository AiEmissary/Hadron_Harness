import {ConversationActions} from './ConversationActions'
import {rememberConversationFolder,startConversationWork} from '../../features/collaboration/conversationWork'
import {containsRawToolInvocation} from '../../../../../shared/toolOutput'
import {AttachmentPicker} from './AttachmentPicker'
import { SecondOpinion } from './SecondOpinion'
import {FileAccess} from './FileAccess'
import {receiveWorkflowDraft,confirmDraftReplacement} from '../../features/collaboration/workflowDraft'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { composeSharedContext, type SharedAttachment } from '../../features/collaboration/attachments'
import { browserJobStore, emptyIndependentJob, IndependentJobController, jobTerminal } from '../../features/collaboration/independentJobController'
import { createCollaborationClient } from '../../features/collaboration/client'
import { createIndependentJobClient } from '../../features/collaboration/independentClient'
import { agentConversationPath } from '../../features/collaboration/agentConversation'
import type { ParticipantOption } from '../../features/collaboration/setup'
import { useJobTreeWorkspace } from './JobTreeWorkspace'
import { AgentJobLog } from './AgentJobLog'

const client = () => createIndependentJobClient(async () => {
  if (!window.electronAPI?.collaboration) throw new Error('Desktop authentication unavailable')
  return window.electronAPI.collaboration.capability()
})
export function IndependentJobs({ conversationId, options, enabled }: {
  conversationId: string; options: ReadonlyArray<ParticipantOption>; enabled: boolean
}) {
  return <section aria-label='Independent jobs' className='space-y-4'>
    <div><h2 className='font-semibold'>Independent jobs</h2>
      <p className='text-sm text-neutral-500'>Choose each agent's connection here. Write messages on the left and explore their branches in the middle.</p>
      <p className='mt-1 text-xs text-neutral-500'>Each agent keeps its own conversations, files and branches.</p>
    </div>
    <div className='grid gap-4' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))' }}>
      {(['a', 'b'] as const).map(slot => <IndependentJob key={`${conversationId}:${slot}`} {...{ conversationId, slot, options, enabled }} />)}
    </div>
    {!enabled && <p className='text-sm text-neutral-500'>Connect an available subscription to send messages. Saved branches can still be viewed.</p>}
  </section>
}

function IndependentJob({ conversationId, slot, options, enabled }: {
  conversationId: string; slot: 'a' | 'b'; options: ReadonlyArray<ParticipantOption>; enabled: boolean
}) {
  const label = `Agent ${slot.toUpperCase()}`
  const [incomingContext,setIncomingContext]=useState('')
  const [task, setTask] = useState(''), [provider, setProvider] = useState(''), [modelName, setModel] = useState('')
  const [toolMode, setToolMode] = useState<'' | 'web' | 'build' | 'project'>('')
  const [reviewedEdit,setReviewedEdit]=useState(false)
  const [projectAccess,setProjectAccess]=useState<{id:string;label:string}|null>(null)
  const [files, setFiles] = useState<SharedAttachment[]>([]), [readingFiles, setReadingFiles] = useState(false)
  const [newRoot, setNewRoot] = useState(false), [submittedTask, setSubmittedTask] = useState('')
  const [editOrigin,setEditOrigin]=useState<{selected:string|null;parent:import('../../../../../shared/independentJobs').AgentBranchParent|null;context:string;action:string}|null>(null)
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [view, setView] = useState(emptyIndependentJob), [controllerReady, setControllerReady] = useState(false)
  const workspace = useJobTreeWorkspace(), publishTree = workspace?.publish, refreshTrees = workspace?.refresh, select = workspace?.select
  useEffect(() => { publishTree?.(slot, view) }, [publishTree, slot, view])
  const controller = useRef<IndependentJobController | null>(null), taskInput = useRef<HTMLTextAreaElement>(null), transcript = useRef<HTMLDivElement>(null), stickToEnd = useRef(true)
  useEffect(() => {
    setControllerReady(false)
    if (!enabled) return
    let current = true
    try {
      const job = new IndependentJobController(client(), conversationId, slot, browserJobStore(conversationId, slot), next => { if (current) setView(next) })
      controller.current = job; setControllerReady(true)
      void job.recover() // Read/status only; never repeats Start after a restart.
      return () => { current = false; controller.current = null; job.dispose() }
    } catch { setError('Saved job recovery is unavailable. Sending remains disabled.') }
  }, [conversationId, slot, enabled])
  useEffect(() => {
    if (!view.status) return
    setProvider(current => current || view.status!.provider); setModel(current => current || view.status!.modelName)
  }, [view.status?.provider, view.status?.modelName])
  const publishChoice = workspace?.setAgentChoice
  useEffect(() => { publishChoice?.(slot, {provider, modelName}) }, [publishChoice, slot, provider, modelName])
  useEffect(()=>{rememberConversationFolder(conversationId,slot,projectAccess,toolMode==='project'&&!reviewedEdit)},[conversationId,slot,projectAccess,toolMode,reviewedEdit])
  const option = options.find(item => item.provider === provider), nodes = workspace?.trees[slot]?.nodes ?? []
  const selectedId = workspace?.selectedNodes[slot] ?? null
  useEffect(()=>{if(editOrigin&&selectedId!==editOrigin.selected)setEditOrigin(null)},[selectedId,editOrigin])
  useEffect(() => { if (selectedId) setNewRoot(false) }, [selectedId])
  const tail = nodes.filter(node => node.jobId === view.id).at(-1) ?? nodes.at(-1)
  const effectiveId = newRoot ? null : selectedId ?? tail?.id ?? null
  const awaitingTree = !!workspace && !!view.id && !!view.status && !newRoot && !selectedId && !nodes.some(node => node.jobId === view.id)
  let path = [] as typeof nodes, pathError: string | null = null
  try { path = agentConversationPath(nodes, effectiveId) } catch { pathError = 'This branch could not be loaded. Refresh trees before sending.' }
  const parentNode = path.at(-1)
  useEffect(() => {
    if (!parentNode) return
    setProvider(current => current || parentNode.provider); setModel(current => current || parentNode.modelName)
  }, [parentNode?.provider, parentNode?.modelName])
  let context = '', contextError: string | null = null
  try { context = composeSharedContext(editOrigin?.context??incomingContext, files) } catch (error) { contextError = (error as Error).message }
  const canCompose = view.phase === 'ready' || (view.phase === 'accepted' && !!view.status && jobTerminal(view.status.status))
  const locked = !canCompose || busy || readingFiles
  const displayedToolMode = !canCompose && view.status ? view.status.toolMode ?? '' : toolMode
  const ready = enabled && controllerReady && !locked && !reviewedEdit && !contextError && !pathError && !awaitingTree && (!workspace?.errors[slot] || newRoot) && (task.trim() || files.length > 0) &&
    option?.connected && option.models.some(model => model.id === modelName) && (toolMode!=='project'||!!projectAccess)
  const act = async (operation: () => Promise<void> | void) => {
    setBusy(true); setError(null)
    try { await operation() } catch(error) { setError(error instanceof Error?error.message:'The request could not be completed. Check the job and selected branch before continuing.') }
    finally { setBusy(false) }
  }
  const prepareReviewedEdit=()=>void act(async()=>{const instruction=task.trim();if(!instruction)throw Error('Write the instruction first.');if(await startConversationWork({workspace:conversationId,slot,text:instruction,context:context+'\n'+path.map(node=>(node.kind==='task'?'User':label)+': '+node.text).join('\n'),actor:slot,choices:{[slot]:{provider,modelName}},permission:'ask'})){workspace?.setMode('project');workspace?.showPane('project')}})
  const sendBlockReason = !enabled ? 'Connect a subscription in the setup pane.' : !controllerReady ? 'Loading saved job status...' : locked ? 'Wait for the current operation to finish, or check this agent job.' : contextError || pathError ? null : awaitingTree ? 'Loading the selected branch...' : workspace?.errors[slot]&&!newRoot ? 'Refresh trees to load this branch.' : !task.trim()&&!files.length ? 'Write a question before sending.' : !option?.connected ? 'Choose a connected provider on the right.' : !option.models.some(model=>model.id===modelName) ? 'Choose an available model on the right.' : toolMode==='project'&&!projectAccess ? 'Add the folder below before sending. Access expires when Hadron restarts.' : null
  const chooseFolder=()=>void act(async()=>{const selected=await window.electronAPI!.collaboration.projectSelect(conversationId,slot);if(selected){setProjectAccess(selected);if(!reviewedEdit)setToolMode('project')}})
  const removeFolder=()=>void act(async()=>{if(projectAccess)await window.electronAPI!.collaboration.projectRevoke(projectAccess.id);setProjectAccess(null)})
  const newTask = () => {
    setEditOrigin(null);setIncomingContext('')
    if (view.phase !== 'ready') controller.current?.prepareNext()
    setNewRoot(true); setTask(''); setFiles([]); select?.(slot, null); workspace?.beginTask(slot)
    requestAnimationFrame(() => taskInput.current?.focus())
  }
  useEffect(() => receiveWorkflowDraft(conversationId, slot, (text,_access,details) => {
    if (locked) throw Error(`Wait for Agent ${slot.toUpperCase()}'s existing job to finish, then try again.`)
    confirmDraftReplacement(!!task.trim() || files.length > 0)
    newTask();setIncomingContext(details?.context??'');setTask(text);setReviewedEdit(false);if(details?.folder){setProjectAccess(details.folder);setToolMode(_access==='chat'?'':'project')}else setToolMode('');const choice=details?.choices?.[slot];if(choice){setProvider(choice.provider);setModel(choice.modelName)}
  }), [conversationId, slot, locked, task, files, view.phase])
  const send = async () => {
    if (!ready || !controller.current) return
    if (view.phase !== 'ready') controller.current.prepareNext()
    const question = task.trim() || 'Work on the attached files.'
    setSubmittedTask(question); select?.(slot, null)
    const accepted = await controller.current.submit({ task: question, context, provider: option!.provider, modelName, ...(toolMode ? { toolMode } : {}), ...(toolMode==='project'&&projectAccess?{projectGrantId:projectAccess.id}:{}) }, editOrigin ? editOrigin.parent??undefined : parentNode ? { jobId: parentNode.jobId, kind: parentNode.kind } : undefined)
    if (accepted) { setTask(''); setFiles([]); setNewRoot(false);setEditOrigin(null) }
    refreshTrees?.()
  }
  const pendingOutsideTree = view.id && !nodes.some(node => node.jobId === view.id) && !canCompose
  const displayedPath = path.map(node => node.kind === 'response' && view.id === node.jobId && view.text ? { ...node, text: view.text, status: view.status?.status ?? node.status } : node)
  const lastVisibleText = pendingOutsideTree ? view.text : displayedPath.at(-1)?.text
  useEffect(() => { stickToEnd.current = true }, [effectiveId])
  useEffect(() => { if (stickToEnd.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight }, [effectiveId, lastVisibleText])
  const saveAnswer = (text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `hadron-agent-${slot}-answer.md`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const revise=(jobId:string,action:string)=>void act(async()=>{
    confirmDraftReplacement(!!task.trim()||files.length>0)
    const draft=await client().editDraft(jobId)
    if(draft.toolMode==='agent')throw Error('Open this coding conversation in the new workspace to edit its question.')
    if(draft.workspace!==conversationId||draft.slot!==slot)throw Error('Saved question belongs to another agent')
    const target=draft.parent?nodes.find(n=>n.jobId===draft.parent!.jobId&&n.kind===draft.parent!.kind):null
    if(draft.parent&&!target)throw Error('Load the earlier branch before editing this question')
    if(view.phase!=='ready')controller.current?.prepareNext()
    const selected=target?.id??null
    select?.(slot,selected);setNewRoot(!draft.parent);setTask(draft.task);setFiles([]);setReviewedEdit(false);setToolMode(draft.toolMode??toolMode);setProvider(draft.provider);setModel(draft.modelName)
    setEditOrigin({selected,parent:draft.parent,context:draft.context,action})
    requestAnimationFrame(()=>taskInput.current?.focus())
  })
  const conversation = <section aria-label={`${label} conversation`} className='flex h-full min-h-0 flex-col p-4'>
    <header className='mb-3 flex flex-wrap items-center justify-between gap-2'><h2 className='text-lg font-semibold'>{label}</h2>
      <span className='text-xs text-neutral-500'>{newRoot ? 'New conversation' : parentNode ? 'Selected branch' : 'Ready for a new task'}</span>
    </header>
    {parentNode&&<button type='button' disabled={!canCompose||busy} className='mb-3 self-start px-3 py-2 text-sm' onClick={()=>void act(async()=>{
      if(!window.confirm('Move this agent conversation and all its alternative branches to Hadron’s Recycle Bin? Other conversations stay saved. You can restore it from Settings → Saved data for 30 days.'))return
      await client().trashConversation(parentNode.jobId);newTask();refreshTrees?.()
    })}>Move conversation to bin</button>}
    {!newRoot && (parentNode?.jobId === view.id || pendingOutsideTree) && !!view.status?.toolActivity?.length && <details className='mb-3 rounded-lg border p-2 text-xs'><summary>Tool activity · {view.status.toolActivity.length} events</summary><ul className='max-h-36 overflow-auto'>{view.status.toolActivity.map((event, index) => <li key={index}>{event.tool} · {event.state}</li>)}</ul></details>}
    <div ref={transcript} onScroll={event => { const element = event.currentTarget; stickToEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight < 70 }} className='min-h-0 flex-1 space-y-3 overflow-y-auto pr-1' aria-label={`${label} conversation messages`}>
      {!displayedPath.length && !pendingOutsideTree && <p className='text-sm text-neutral-500'>{newRoot ? 'Start a separate task. Your other branches stay saved.' : 'Write your first question below, or select a saved branch in the middle pane.'}</p>}
      {displayedPath.map(node => <article key={node.id} data-agent-node={node.id} className={`rounded-xl border p-3 ${node.kind === 'task' ? 'bg-violet-50 dark:bg-neutral-800' : 'bg-white dark:bg-neutral-900'}`}>
        <div className='mb-2 flex flex-wrap items-center justify-between gap-2 text-xs'><strong>{node.kind === 'task' ? 'You' : label}</strong><span>{node.kind==='response'&&containsRawToolInvocation(node.text)?'Tool request not completed':node.status}{node.kind === 'response' && node.status !== 'completed' ? ' - partial' : ''}</span></div>
        <div role='region' aria-label={node.kind === 'response' && node.id === displayedPath.filter(item => item.kind === 'response').at(-1)?.id ? `${label} job response` : `${label} earlier ${node.kind}`} className='whitespace-pre-wrap break-words text-sm leading-6'>{node.kind==='response'&&containsRawToolInvocation(node.text)?<><p role='alert'>This response contains an unsupported tool request, not a completed answer. The displayed request was not executed. Earlier tool activity, if any, is separate. Send a new question to try the task again.</p><details><summary>Technical response</summary><pre className='whitespace-pre-wrap'>{node.text}</pre></details></>:node.text || 'Waiting for response...'}</div>
        {node.kind==='response'&&node.text&&!containsRawToolInvocation(node.text)&&<ConversationActions workspaceId={conversationId} slot={slot} defaultActor={slot} context={context+'\n'+path.slice(0,path.findIndex(item=>item.id===node.id)+1).map(item=>(item.kind==='task'?'User':label)+': '+item.text).join('\n')} choices={{[slot]:{provider:node.provider,modelName:node.modelName}}} disabled={locked}/>}
        <div className='mt-2 flex flex-wrap gap-2'>
          <button type='button' disabled={!canCompose || busy} onClick={() => { setEditOrigin(null);select?.(slot, node.id); setNewRoot(false); requestAnimationFrame(() => taskInput.current?.focus()) }} className='px-2 py-1 text-xs'>Branch from here</button>
          {jobTerminal(node.status)&&<button type='button' disabled={!canCompose||busy} onClick={()=>revise(node.jobId,node.kind==='task'?'Edit question':'Regenerate answer')} className='px-2 py-1 text-xs'>{node.kind==='task'?'Edit question':'Regenerate answer'}</button>}
          {node.kind === 'response' && node.text && <button type='button' onClick={() => saveAnswer(node.text)} className='px-2 py-1 text-xs'>Save answer</button>}
          {node.kind === 'response' && node.status === 'completed' && node.text && !containsRawToolInvocation(node.text) && <SecondOpinion conversationId={conversationId} sourceSlot={slot} node={node} nodes={nodes} options={options} enabled={enabled} />}
        </div>
      </article>)}
      {pendingOutsideTree && <article className='rounded-xl border p-3 text-sm'><strong>You</strong><p className='whitespace-pre-wrap'>{submittedTask || 'Loading the saved question...'}</p><div aria-label={`${label} job response`} role='region' className='mt-3 whitespace-pre-wrap'>{view.text || 'Waiting for response...'}</div></article>}
    </div>
    <div data-workflow-composer={slot} aria-label={`Instructions — ${label}`} className='mt-4 shrink-0 rounded-xl border-2 border-cyan-400 p-3 focus-within:ring-2 focus-within:ring-cyan-400'>
      <h3 className='mb-2 font-semibold'>4. Instructions — {label}</h3>
      {editOrigin&&<p role='status' className='mb-2 rounded-lg border p-2 text-sm'>{editOrigin.action} prepared. Review the question below, then press Send. The original answer stays saved. Original supplied text is included. The original task tools are restored for this retry, and your current folder stays selected. Saved questions never grant new access. No request has been sent.</p>}
      {reviewedEdit&&<p className='mb-2 text-sm'>Your instruction will start work on the selected conversation and files. Changes are approved when ready.</p>}
      {!ready&&!reviewedEdit&&sendBlockReason&&<p role='status' aria-label={`${label} send status`} className='mb-2 rounded-lg border p-2 text-sm'>{sendBlockReason}</p>}
      <p className='mb-2 text-xs text-neutral-500'>{parentNode ? `Your next message continues from the selected ${parentNode.kind === 'task' ? 'question' : 'answer'}. Only this branch is shared with ${label}.` : 'This message starts a separate conversation.'}</p>
      {(error || contextError || pathError || view.error || workspace?.errors[slot]) && <p role='alert' className='mb-2 text-sm'>{error ?? contextError ?? pathError ?? view.error ?? workspace?.errors[slot]}</p>}
      <fieldset disabled={locked}>
        <label className='block text-sm'>Message to {label}
          <textarea ref={taskInput} aria-label={`${label} job task`} rows={3} maxLength={16000} value={task} onChange={event => setTask(event.target.value)} placeholder='Ask a question or follow up on this branch...' className='mt-1 block w-full resize-y rounded-xl border bg-transparent p-3' />
        </label>
        <AttachmentPicker label={`Choose ${label} job files`} files={files} disabled={locked} onBusy={setReadingFiles} onFiles={setFiles}/>
        {files.length > 0 && <ul aria-label={`${label} job files`} className='my-2 space-y-1 text-xs'>{files.map(file => <li key={file.id} className='flex items-center justify-between gap-2'><span className='truncate'>{file.name}</span><button type='button' onClick={() => setFiles(current => current.filter(item => item.id !== file.id))} aria-label={`Remove ${file.name} from ${label}`}>Remove</button></li>)}</ul>}
      </fieldset>
      <div className='mt-2 flex flex-wrap gap-2'>
        <button type='button' disabled={locked} onClick={chooseFolder} className='px-3 py-2 text-sm'>Add folder</button>
        <button type='button' disabled={reviewedEdit?(!enabled||!controllerReady||locked||!task.trim()||!option?.connected||!option.models.some(model=>model.id===modelName)):!ready} onClick={() => reviewedEdit?prepareReviewedEdit():void act(send)} className='rounded-full bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-40'>{reviewedEdit?'Go':'Send to '+label}</button>
        {view.status && !jobTerminal(view.status.status) && <button type='button' disabled={busy || view.status.status === 'stopping'} onClick={() => void act(() => controller.current?.stop())}>Stop {label}</button>}
      </div>
      {projectAccess&&<div aria-label={`${label} attached folder`} className='mt-2 rounded-lg border p-2 text-xs'><p className='break-all'>{projectAccess.label}</p><p>{toolMode==='project'?'Folder search and read enabled for this agent only.':'Folder is selected; choose Read a project folder under Tools to use it.'} Read-only; choose again after restarting.</p><button type='button' disabled={locked} className='mt-1 underline' onClick={removeFolder}>Remove folder</button></div>}
      {awaitingTree && <p className='mt-2 text-xs'>Loading this conversation branch...</p>}
      {!enabled && <p className='mt-2 text-xs'>Connect {label}'s subscription in the setup pane to send a message.</p>}
      <p className='mt-2 text-xs text-neutral-500'>Branch history and file text stay with this agent; each response has an automatic job log. Tool mode applies only to the next message you send.</p>
    </div>
  </section>
  const journalId = parentNode?.jobId ?? view.id
  return <>
    <section aria-label={`${label} independent job`} className={`min-w-0 rounded-xl border bg-white p-3 dark:bg-neutral-900 ${slot === 'a' ? 'border-violet-300' : 'border-teal-300'}`}>
      <div className='mb-3 flex items-center justify-between gap-2'><h3 className='font-semibold'>{label}</h3><span className='text-xs' aria-live='polite'>{view.status?.status ?? view.phase}</span></div>
      <fieldset disabled={!canCompose || busy} className='space-y-2'>
        <FileAccess label={label} value={reviewedEdit?'edit':toolMode==='project'?'read':'chat'} disabled={locked} onChange={value=>{setReviewedEdit(value==='edit');if(value!=='edit')setToolMode(value==='read'?'project':'')}} onEdit={prepareReviewedEdit}/>
        <button type='button' className='px-3 py-2 text-sm' aria-label={`Add folder for ${label}`} onClick={chooseFolder}>Add folder</button>
        <label className='block text-sm'>Tools<select aria-label={`${label} tool mode`} value={displayedToolMode} onChange={event => {setReviewedEdit(false);setToolMode(event.target.value as typeof toolMode)}} className='mt-1 block w-full rounded-lg border bg-transparent p-2'><option value=''>Text and attached files</option><option value='web'>Web research</option><option value='build'>Create and test tools</option><option value='project'>Read a project folder</option></select></label>
        {toolMode==='project'&&<section aria-label={`${label} project access`} className='rounded-lg border p-3 space-y-2 text-sm'>
          <p>{projectAccess?projectAccess.label:'Choose the folder this agent may inspect.'}</p>
          <p className='text-xs text-neutral-500'>Read-only access for this agent and workspace. No edits or commands. Choose again after restarting Hadron.</p>
          <div className='flex flex-wrap gap-2'><button type='button' className='px-3 py-2' onClick={chooseFolder}>Choose project for {label}</button>
          {projectAccess&&<button type='button' className='px-3 py-2' onClick={removeFolder}>Remove {label} project access</button>}</div>
        </section>}
        <label className='block text-sm'>Provider<select aria-label={`${label} job provider`} value={provider} onChange={event => { setProvider(event.target.value); setModel('') }} className='mt-1 block w-full rounded-lg border bg-transparent p-2'><option value=''>Choose provider</option>{options.map(item => <option key={item.provider} value={item.provider} disabled={!item.connected}>{item.label}{item.connected ? '' : ' - connect first'}</option>)}</select></label>
        <label className='block text-sm'>Model<select aria-label={`${label} job model`} value={modelName} disabled={!option?.connected} onChange={event => setModel(event.target.value)} className='mt-1 block w-full rounded-lg border bg-transparent p-2'><option value=''>Choose model</option>{option?.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
      </fieldset>
      <p className='mt-2 text-xs text-neutral-500'>{displayedToolMode==='project'?'Up to 10 model requests including helpers. Bounded file listings and relevant text excerpts from the selected folder. Linked paths and common credential files are excluded.':displayedToolMode ? 'Up to 10 model requests per response including helpers. Public page reading/search; private navigation per job. New tools stay disabled until you review and enable them.' : 'Text response with optional lightweight helpers: up to 5 model requests total. Choose a tool mode above when needed.'}</p>
      <p className='mt-2 text-xs text-neutral-500'>{option?.connectionLabel ?? 'Choose an available connection.'}</p>
      <div className='my-3 flex flex-wrap gap-2'>
        <button type='button' onClick={() => workspace?.showPane(slot)} className='px-3 py-2 text-sm'>Open {label} conversation</button>
        <button type='button' disabled={!canCompose || busy} onClick={() => void act(newTask)} className='px-3 py-2 text-sm'>New task for {label}</button>
        {view.phase !== 'ready' && <button type='button' disabled={busy || ['preparing', 'submitting'].includes(view.phase)} onClick={() => void act(() => controller.current?.reconnect())} className='px-3 py-2 text-sm'>Check {label} job</button>}
        {view.status && !jobTerminal(view.status.status) && <button type='button' disabled={busy || view.status.status === 'stopping'} onClick={() => void act(() => controller.current?.stop())}>Stop {label}</button>}
      </div>
      <p className='text-xs text-neutral-500'>Follow up directly in the left conversation. Select an earlier tree node to create an alternative branch.</p>
      {view.status?.journalAvailable === false && <p role='alert' className='mt-2 text-sm'>The automatic job log could not be saved. Check local storage before continuing.</p>}
      {journalId && <AgentJobLog key={journalId} label={label} read={() => {
        const proposal = /^proposal:([^:]+):(a|b)$/.exec(journalId)
        return proposal ? createCollaborationClient(async () => window.electronAPI!.collaboration.capability()).journal(proposal[1], proposal[2] as 'a' | 'b') : client().journal(journalId)
      }} />}
    </section>
    {workspace?.targets[slot] ? createPortal(conversation, workspace.targets[slot]!) : !workspace ? conversation : null}
  </>
}
