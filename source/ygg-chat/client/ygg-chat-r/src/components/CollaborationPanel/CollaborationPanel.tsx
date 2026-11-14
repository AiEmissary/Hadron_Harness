import {rememberConversationFolder,startConversationWork} from '../../features/collaboration/conversationWork'
import {AttachmentPicker} from './AttachmentPicker'
import {WorkflowComposer} from './WorkflowComposer'
import {FileAccess,type FileAccessMode} from './FileAccess'
import {useJobTreeWorkspace} from './JobTreeWorkspace'
import {receiveWorkflowDraft,confirmDraftReplacement,sendWorkflowDraft} from '../../features/collaboration/workflowDraft'
import { composeSharedContext } from '../../features/collaboration/attachments'
import { useEffect, useId, useRef, useState } from 'react'
import type { ProposalSessionStatus } from '../../../../../shared/collaboration'
import { chooseModel, chooseProvider, initialDraft, type CollaborationDraft, type ParticipantOption } from '../../features/collaboration/setup'

interface Props {
  workspaceId?: string
  continuation?: ProposalSessionStatus | null
  options: ReadonlyArray<ParticipantOption>
  enabled: boolean
  workEnabled?:boolean
  sharedContext?: string
  disabledReason?: string
  status?: ProposalSessionStatus | null
  onStart(draft: CollaborationDraft): Promise<void>
  onStop(): Promise<void>
  onNew?(keepFiles: boolean): void
  onReopen?(): Promise<void>
  canPrepareNew?: boolean
  draftRevision?: number
  keepFilesOnReset?: boolean
  newRequestRevision?: number
}

/** Shared text/files and independent A/B selection; live admission remains gated. */
export function CollaborationPanel({ workspaceId, continuation, options, enabled, workEnabled=enabled, sharedContext: suppliedContext = '', disabledReason, status, onStart, onStop, onNew, onReopen, canPrepareNew = true, draftRevision = 0, keepFilesOnReset = false, newRequestRevision = 0 }: Props) {
  const [draft, setDraft] = useState(initialDraft)
  const [incomingContext,setIncomingContext]=useState('')
  const sharedContext=suppliedContext
  const [folder,setFolder]=useState<{id:string;label:string}|null>(null)
  const [access,setAccess]=useState<FileAccessMode>('chat'),workspace=useJobTreeWorkspace()
  useEffect(()=>{setFolder(null);setDraft(current=>({...current,projectGrantId:undefined}))},[workspaceId])
  useEffect(()=>{if(workspaceId)rememberConversationFolder(workspaceId,'shared',folder,access==='read')},[workspaceId,folder,access])
  const pendingHandoff = useRef<string | null>(null)
  useEffect(() => {
    if (!continuation) return
    setAccess(folder || continuation.collaboration?.folderAccess ? 'read' : 'chat')
    setDraft(current => ({ ...current, verification: continuation.collaboration?.maxRequests === 13, participants: continuation.participants.map(p => ({ id: p.id, provider: p.provider, modelName: p.modelName })) as CollaborationDraft['participants'] }))
  }, [continuation?.sessionId])
  const [preparingFiles, setPreparingFiles] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taskId = useId(), taskInput = useRef<HTMLTextAreaElement>(null)
  const [choosingFiles, setChoosingFiles] = useState(false)
  const prepareNew = (keepFiles: boolean) => {
    try { onNew?.(keepFiles); setChoosingFiles(false) } catch { setError('Check the existing session before starting a new collaboration.') }
  }
  const requestNew = () => {
    if (locked || !canPrepareNew) return
    if (draft.attachments.length) setChoosingFiles(true)
    else prepareNew(false)
  }
  useEffect(() => { if (newRequestRevision) requestNew() }, [newRequestRevision])
  useEffect(() => {
    if (!draftRevision) return
    const handoff = pendingHandoff.current; pendingHandoff.current = null
    setDraft(current => ({ ...current, task: handoff ?? '', attachments: keepFilesOnReset ? current.attachments : [] })); setFileError(null); setError(null)
    taskInput.current?.focus()
  }, [draftRevision])
  const active = !!status && ['created', 'running', 'stopping'].includes(status.status)
  const verification = active ? status?.collaboration?.maxRequests === 13 : !!draft.verification
  const locked = pending || active || preparingFiles
  useEffect(() => {
    if (!workspaceId) return
    return receiveWorkflowDraft(workspaceId, 'shared', (text,nextAccess,details) => {
      if (locked || !canPrepareNew || !onNew) throw Error('Check or finish the existing collaboration before preparing a new one.')
      confirmDraftReplacement(!!draft.task.trim() || draft.attachments.length > 0)
      onNew(false); pendingHandoff.current = text;setIncomingContext(details?.context??'');setAccess(details?.folder?(nextAccess??'read'):nextAccess??'chat');if(details?.folder)setFolder(details.folder);else if(nextAccess)setFolder(null);if(details?.choices)setDraft(current=>({...current,participants:current.participants.map(p=>details.choices?.[p.id]?{...p,...details.choices[p.id]}:p) as CollaborationDraft['participants']}))
    })
  }, [workspaceId, locked, canPrepareNew, onNew, draft.task, draft.attachments])
  let contextError: string | null = null
  try { composeSharedContext([sharedContext,incomingContext].filter(Boolean).join('\n'), draft.attachments) } catch (error) { contextError = (error as Error).message }
  const ready = !contextError && (draft.task.trim() || draft.attachments.length > 0) && draft.participants.every(p => options.some(option =>
    option.provider === p.provider && option.connected && option.models.some(model => model.id === p.modelName)))
  const act = async (operation: () => Promise<void>) => {
    setPending(true); setError(null)
    try { await operation() } catch (error) { setError(error instanceof Error ? error.message : 'The request could not be completed. Check the session status before retrying.') }
    finally { setPending(false) }
  }
  const instructions=<WorkflowComposer mode='shared' label='4. Instructions — Work together · both agents'>
    <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
      <label htmlFor={taskId} className='text-sm font-medium'>{continuation ? 'Follow-up to both agents' : 'Shared task'}</label>
      {onReopen && <button type='button' disabled={locked} className='rounded-lg border px-3 py-2 text-sm' onClick={() => void act(onReopen)}>Reopen last saved answer</button>}
      {onNew && <button type='button' className='rounded-lg px-3 py-2 text-sm' disabled={locked || !canPrepareNew} onClick={requestNew}>New collaboration</button>}
    </div>
    {continuation && <p role='status' className='rounded-lg border border-teal-400 p-2 text-sm'>Continuing the selected combined answer with both agents. The previous questions and combined answers stay in this conversation. Write below, then Send follow-up to both agents.</p>}
    {choosingFiles && <div role='group' aria-label='Files for new collaboration' className='my-3 space-y-3 rounded-xl border border-violet-200 p-3 text-sm'>
      <p>Keep the {draft.attachments.length} attached {draft.attachments.length === 1 ? 'file' : 'files'} for the next task? Your old collaboration stays saved.</p>
      <div className='flex flex-wrap gap-3'>
        <button type='button' disabled={locked || !canPrepareNew} className='px-3 py-2' onClick={() => prepareNew(true)}>Keep attached files</button>
        <button type='button' disabled={locked || !canPrepareNew} className='px-3 py-2' onClick={() => prepareNew(false)}>Remove attached files</button>
        <button type='button' className='px-3 py-2' onClick={() => setChoosingFiles(false)}>Cancel</button>
      </div>
    </div>}
      <textarea id={taskId} ref={taskInput} aria-label='Shared task' value={draft.task} disabled={locked} onChange={event => setDraft({ ...draft, task: event.target.value })}
        rows={3} className='mt-1 block w-full resize-y rounded-xl border bg-transparent p-3 font-normal' placeholder='What should both agents work on?' />
    {access==='edit'&&<p className='text-sm'>Go starts work with both agents using this conversation and folder. File changes are approved when ready.</p>}
    {access==='read'&&!folder&&<p role='status' className='text-sm'>Choose Add folder on the right before sending. Folder access must be selected again after restart.</p>}
    {!enabled && <p className='mt-2 text-sm text-neutral-500'>{disabledReason ?? 'Collaboration is not enabled in this build.'}</p>}
    {error && <p role='alert' className='mt-2 text-sm text-red-600'>{error}</p>}
    <div className='mt-3 flex items-center justify-between gap-3'>
      <p className='text-xs text-neutral-500'>{folder&&access==='read'?'Folder search: up to 8 model requests per proposal/review stage, plus bounded helpers and final synthesis.':verification ? 'Up to 27 model requests with helpers · Evidence tools in verification' : 'Up to 19 model requests with helpers · No external tools'} {folder&&access==='read'&&verification?'Verification also has a bounded evidence-tool budget. ':''}· Final answer uses Agent A’s model</p>
      {active ? <button type='button' disabled={pending || status?.status === 'stopping'} onClick={() => void act(onStop)} className='rounded-full border px-4 py-2 text-sm'>Stop both</button>
        : <button type='button' disabled={!(access==='edit'?workEnabled:enabled) || !ready || locked || choosingFiles || access==='read'&&!folder} onClick={() => void act(async() => {if(access==='edit'){if(!workspaceId)throw Error('Open a workspace first');if(await startConversationWork({workspace:workspaceId,slot:'shared',text:draft.task,context:[sharedContext,incomingContext,...draft.attachments.map(file=>'Attached file: '+file.name+'\n'+file.text),continuation?.collaboration?.stages.find(stage=>stage.id==='final')?.text??''].filter(Boolean).join('\n'),actor:'both',choices:Object.fromEntries(draft.participants.map(p=>[p.id,p])),permission:'ask'})){workspace?.setMode('project');workspace?.showPane('project')}return}await onStart({ ...draft, importedContext:incomingContext, projectGrantId:access==='read'?folder?.id:undefined,attachments: draft.attachments.map(file => ({ ...file })), participants: draft.participants.map(p => ({ ...p })) as CollaborationDraft['participants'] });})}
          className='rounded-full bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-40'>{access==='edit'?'Go':continuation ? 'Send follow-up to both agents' : 'Start collaboration'}</button>}
    </div>
  </WorkflowComposer>
  return <section aria-label='Hadron collaboration' className='rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'>
    <div className='mb-4 flex items-center justify-between gap-3'>
      <div><h2 className='font-semibold'>Work together</h2><p className='text-sm text-neutral-500'>Two proposals, cross-review, then one combined answer</p></div>
      <span className='text-xs text-neutral-500'>{status?.status ?? 'Ready to set up'}</span>
    </div>
    <h3 className='font-semibold'>2. Folder and files</h3>
    <FileAccess label='Work together' value={access} disabled={locked} onChange={setAccess} onEdit={()=>void act(async()=>{if(!workspaceId||!draft.task.trim())throw Error('Write the task on the left before preparing a reviewed edit.');sendWorkflowDraft(workspaceId,'project',draft.task);workspace?.setMode('project');workspace?.showPane('project')})}/>
    <div className='mt-2 space-y-2'>
      <AttachmentPicker label='Choose shared task files' files={draft.attachments} disabled={locked} onBusy={setPreparingFiles} onFiles={attachments=>{setDraft(current=>({...current,attachments}));setFileError(null)}}/>
      <button type='button' disabled={locked||!workspaceId} className='ml-2 rounded-lg border px-3 py-2 text-sm' onClick={()=>void act(async()=>{const selected=await window.electronAPI.collaboration.projectSelect(workspaceId!,'shared');if(selected){setFolder(selected);setAccess(current=>current==='edit'?'edit':'read');setDraft(current=>({...current,projectGrantId:selected.id}))}})}>Add folder</button>
      {access==='read'&&!folder&&<p role='status' className='text-xs'>Choose Add folder to enable reading.</p>}
      {folder&&access!=='read'&&<p role='status' className='text-xs'>Folder reading is off for the next collaboration.</p>}
      {folder&&<section aria-label='Shared task folder' className='space-y-2 rounded-xl border p-3 text-sm'><p className='break-all'>{folder.label}</p><p className='text-xs'>{access==='read'?'Both agents can search this folder and its subfolders, read relevant files and check their proposals during cross-review. Read-only: no edits or commands.':'Folder reading is off for the next collaboration.'} The folder stays selected for the next task until removed or Hadron restarts.</p><button type='button' disabled={locked} className='underline' onClick={()=>void act(async()=>{await window.electronAPI.collaboration.projectRevoke(folder.id);setFolder(null);setDraft(current=>({...current,projectGrantId:undefined}))})}>Remove folder</button></section>}
      <p className='text-xs text-neutral-500'>PDF, Word (.docx), text and code files, shared with both agents. You can add instructions above.</p>
      {draft.attachments.length > 0 && <ul aria-label='Shared task files' className='space-y-1 text-sm'>
        {draft.attachments.map(file => <li key={file.id} className='flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2'>
          <span className='min-w-0 truncate' title={file.name}>{file.name}</span>
          <button type='button' disabled={locked} aria-label={`Remove file ${file.name}`} onClick={() => setDraft(current => ({ ...current, attachments: current.attachments.filter(item => item.id !== file.id) }))} className='shrink-0 text-xs underline'>Remove</button>
        </li>)}
      </ul>}
      {(fileError || contextError) && <p role='alert' className='text-sm text-red-600'>{fileError ?? contextError}</p>}
    </div>
    <h3 className='font-semibold'>3. Models</h3>
    <div className='grid gap-4' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))' }}>
      {draft.participants.map((participant, i) => {
        const index = i as 0 | 1
        const option = options.find(p => p.provider === participant.provider)
        return <fieldset key={participant.id} disabled={locked} className={`rounded-xl border p-3 ${i === 0 ? 'border-violet-300' : 'border-teal-300'}`}>
          <legend className='px-1 font-medium'>Agent {i === 0 ? 'A' : 'B'}</legend>
          <label className='block text-sm'>Provider
            <select aria-label={`Agent ${i === 0 ? 'A' : 'B'} provider`} value={participant.provider}
              onChange={event => setDraft(chooseProvider(draft, index, event.target.value))} className='my-1 block w-full rounded-lg border bg-transparent p-2'>
              <option value=''>Choose provider</option>
              {options.map(provider => <option key={provider.provider} value={provider.provider} disabled={!provider.connected}>{provider.label}{provider.connected ? '' : ' — connect first'}</option>)}
            </select>
          </label>
          <label className='block text-sm'>Model
            <select aria-label={`Agent ${i === 0 ? 'A' : 'B'} model`} value={participant.modelName} disabled={!option?.connected || locked}
              onChange={event => setDraft(chooseModel(draft, index, event.target.value))} className='my-1 block w-full rounded-lg border bg-transparent p-2'>
              <option value=''>Choose model</option>
              {option?.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </label>
          <p className='mt-2 text-xs text-neutral-500'>{option?.connectionLabel ?? (option ? option.connected ? 'Connected' : 'Connection required' : 'No provider selected')}</p>
        </fieldset>
      })}
    </div>
    <label className='mt-4 block text-sm'>Review mode
      <select aria-label='Collaboration review mode' disabled={locked} value={verification ? 'verification' : 'review'} onChange={event => setDraft({ ...draft, verification: event.target.value === 'verification' })} className='mt-1 block w-full rounded-lg border bg-transparent p-2'>
        <option value='review'>Cross-review</option>
        <option value='verification'>Review + verification</option>
      </select>
    </label>
    <p className='mt-2 text-xs text-neutral-500'>Verification checks disputed claims with public-web reads and user-enabled tools before the combined answer. No shell, private browsing or project edits. Missing evidence remains explicit.</p>
    {instructions}

  </section>
}
