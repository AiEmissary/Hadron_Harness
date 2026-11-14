import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AgentConversationNode } from '../../../../../shared/independentJobs'
import type { ParticipantOption } from '../../features/collaboration/setup'
import { secondOpinionPacket } from '../../features/collaboration/secondOpinion'
import { browserJobStore, emptyIndependentJob, IndependentJobController, jobTerminal } from '../../features/collaboration/independentJobController'
import { createIndependentJobClient } from '../../features/collaboration/independentClient'
import { useJobTreeWorkspace } from './JobTreeWorkspace'

export function SecondOpinion({ conversationId, sourceSlot, node, nodes, options, enabled }: {
  conversationId: string; sourceSlot: 'a' | 'b'; node: AgentConversationNode; nodes: AgentConversationNode[]; options: ReadonlyArray<ParticipantOption>; enabled: boolean
}) {
  const workspace = useJobTreeWorkspace(), peer = sourceSlot === 'a' ? 'b' : 'a'
  const sourceLabel = `Agent ${sourceSlot.toUpperCase()}`, peerLabel = `Agent ${peer.toUpperCase()}`
  const [open, setOpen] = useState(false), [provider, setProvider] = useState(''), [modelName, setModel] = useState('')
  const [view, setView] = useState(emptyIndependentJob), [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<IndependentJobController | null>(null), trigger = useRef<HTMLButtonElement>(null)
  const refresh = workspace?.refresh
  let packet: ReturnType<typeof secondOpinionPacket> | null = null, packetError = ''
  try { packet = secondOpinionPacket(nodes, node.id) } catch (error) { packetError = (error as Error).message }
  useEffect(() => () => { controller.current?.dispose(); controller.current = null }, [])
  useEffect(() => {
    if (view.status && jobTerminal(view.status.status)) refresh?.()
  }, [view.status?.status, refresh])
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [open])
  const close = () => { dialog.current?.close(); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()) }
  const show = () => {
    setOpen(true); setError('')
    const choice = workspace?.agentChoices[peer]
    const last = workspace?.trees[peer]?.nodes.at(-1)
    setProvider(current => current || choice?.provider || last?.provider || '')
    setModel(current => current || choice?.modelName || last?.modelName || '')
    if (!controller.current) {
      try {
        const client = createIndependentJobClient(async () => {
          if (!window.electronAPI?.collaboration) throw Error('Desktop authentication unavailable')
          return window.electronAPI.collaboration.capability()
        })
        controller.current = new IndependentJobController(client, conversationId, peer, browserJobStore(conversationId, peer, `second-opinion:${node.id}`), setView)
        void controller.current.recover()
      } catch { setError('Saved evaluation could not be recovered. No new request was started.') }
    }
  }
  const option = options.find(item => item.provider === provider)
  const running = ['preparing', 'submitting'].includes(view.phase) || (!!view.status && !jobTerminal(view.status.status))
  const submit = async () => {
    if (!controller.current || !packet || view.phase !== 'ready' || !option?.connected || !option.models.some(model => model.id === modelName)) return
    setError('')
    try { await controller.current.submit({ task: packet.task, context: packet.context, provider: option.provider, modelName }) } catch { setError('The evaluation could not be started. Check its status before trying again.') }
  }
  return <>
    <button ref={trigger} type='button' onClick={show} className='px-2 py-1 text-xs'>Get a second opinion</button>
    {open && createPortal(<dialog ref={dialog} aria-labelledby={`second-opinion-${node.id}`} onCancel={event => { event.preventDefault(); close() }} className='m-auto w-[min(48rem,94vw)] max-h-[88vh] overflow-y-auto rounded-2xl border bg-white p-6 text-neutral-900 shadow-2xl backdrop:bg-black/50 dark:bg-neutral-900 dark:text-neutral-100'>
      <header className='flex flex-wrap items-center justify-between gap-3'><h2 id={`second-opinion-${node.id}`} className='text-xl font-semibold'>Second opinion from {peerLabel}</h2><button type='button' onClick={close} aria-label='Close second opinion' className='rounded-lg border px-3 py-2'>Close</button></header>
      <p className='my-3 text-sm'>A quick evaluation of {sourceLabel}’s selected answer. Your conversation, draft and selected branch stay in place. This is a text review, not independent verification.</p>
      {view.phase === 'ready' && <div className='my-4 grid gap-3 sm:grid-cols-2'>
        <label className='text-sm'>{peerLabel} provider<select aria-label='Second opinion provider' value={provider} onChange={event => { setProvider(event.target.value); setModel('') }} className='mt-1 block w-full rounded-lg border bg-transparent p-2'><option value=''>Choose provider</option>{options.map(item => <option key={item.provider} value={item.provider} disabled={!item.connected}>{item.label}{item.connected ? '' : ' — connect first'}</option>)}</select></label>
        <label className='text-sm'>Model<select aria-label='Second opinion model' value={modelName} onChange={event => setModel(event.target.value)} className='mt-1 block w-full rounded-lg border bg-transparent p-2'><option value=''>Choose model</option>{option?.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
      </div>}
      {packet?.excerpted && <p className='mb-3 text-sm'>This long conversation is excerpted for a quick review. The selected question and answer take priority; omitted text is marked in the review packet.</p>}
      {(error || packetError || view.error) && <p role='alert' className='my-3 text-sm'>{error || packetError || view.error}</p>}
      {running && <p role='status' aria-live='polite' className='my-4 flex items-center gap-3 rounded-xl border p-4'><span aria-hidden='true' className='inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent' />{peerLabel} is evaluating the answer… You can close this window while it works.</p>}
      {view.text && <section aria-label='Second opinion evaluation' style={{color:'var(--hadron-reading)'}} className='my-4 max-h-[48vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border p-5 text-base leading-7'>{view.text}</section>}
      {view.status && jobTerminal(view.status.status) && <p role='status' className='my-3 text-sm'>Evaluation {view.status.status}. Saved separately in {peerLabel}’s history. Your original answer is unchanged.</p>}
      <footer className='mt-5 flex flex-wrap gap-3'>
        {view.phase === 'ready' && <button type='button' disabled={!enabled || !packet || !controller.current || !option?.connected || !option.models.some(model => model.id === modelName)} onClick={() => void submit()} className='rounded-xl border px-4 py-2 disabled:opacity-40'>Evaluate with {peerLabel}</button>}
        {view.phase !== 'ready' && !['preparing','submitting'].includes(view.phase) && <button type='button' onClick={() => void controller.current?.reconnect()} className='rounded-xl border px-4 py-2'>Check evaluation</button>}
        {view.phase === 'accepted' && running && <button type='button' onClick={() => void controller.current?.stop().catch(() => setError('Stop was not confirmed. Check evaluation before continuing.'))} className='rounded-xl border px-4 py-2'>Stop evaluation</button>}
        <button type='button' onClick={close} className='rounded-xl border px-4 py-2 font-semibold'>Close and continue with {sourceLabel}</button>
      </footer>
      <p className='mt-3 text-xs'>Closing does not send a message or cancel an evaluation. Reopen this answer’s second-opinion button to read it again. Files, tools and the other agent’s conversations are not shared.</p>
    </dialog>, document.body)}
  </>
}
