import {ConversationActions} from './ConversationActions'
import {rememberConversationFolder,startConversationWork} from '../../features/collaboration/conversationWork'
import {WorkflowComposer} from './WorkflowComposer'
import {FileAccess,type FileAccessMode} from './FileAccess'
import {sendWorkflowDraft} from '../../features/collaboration/workflowDraft'
import {useEffect,useRef,useState} from 'react'
import {useLocation} from 'react-router-dom'
import {createPortal} from 'react-dom'
import type {ContinuousChatView,ContinuousProviders} from '../../../../../shared/continuousChat'
import type {ParticipantOption} from '../../features/collaboration/setup'
import {createCollaborationClient} from '../../features/collaboration/client'
import {useJobTreeWorkspace} from './JobTreeWorkspace'
import {WorkIndicator} from './WorkIndicator'
const reasonText=(reason:string)=>({final_check_complete:'Paused after the final checking pass. Read the remaining concerns before continuing.',similar_replies:'Paused because recent replies strongly overlap. Add a new direction for both agents, then Resume.',context_limit:'The provider rejected the context size. Continue in a new saved session after compacting the history.',rate_limit:'The provider reported a rate limit. Wait before explicitly continuing.',service_unavailable:'The provider is temporarily unavailable. Try continuing later.',authentication_required:'Sign in to the affected subscription again, then continue.',provider_timeout:'The provider response timed out. Completed replies are saved; continuing starts a new request.',connection_lost:'The provider connection was lost. The request may have run; check its log before continuing.',context_budget:'The context exceeds the supported size. Start a new conversation with a shorter goal or fewer instructions.',turn_failed_no_retry:'The provider did not return a completed response. The cause is unknown; inspect the job log before starting a new request.'} as Record<string,string>)[reason]??reason.replaceAll('_',' ')
const button='rounded-xl border px-3 py-2 text-sm'
const api=()=>{if(!window.electronAPI?.continuousChat)throw Error('Automatic conversation requires Hadron desktop');return window.electronAPI.continuousChat}
export function ContinuousChatPanel({conversationId,options,active}:{conversationId:string;options:ReadonlyArray<ParticipantOption>;active:boolean}){
 const location=useLocation(),openedVisit=useRef<string|null>(null)
 const workspace=useJobTreeWorkspace(),[goal,setGoal]=useState(''),[models,setModels]=useState({a:'',b:''}),[maxTurns,setMaxTurns]=useState(20),[maxSeconds,setMaxSeconds]=useState(600)
 const [view,setView]=useState<ContinuousChatView|null>(null),[saved,setSaved]=useState<Array<{id:string;goal:string;state:string}>>([]),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[selected,setSelected]=useState<number|null>(null),[pendingId,setPendingId]=useState<string|null>(null)
 const [pollError,setPollError]=useState('')
 const [access,setAccess]=useState<FileAccessMode>('chat'),[folder,setFolder]=useState<{id:string;label:string}|null>(null)
 useEffect(()=>{rememberConversationFolder(conversationId,'continuous',folder,access==='read')},[conversationId,folder,access])
 const [continuing,setContinuing]=useState(false),[instruction,setInstruction]=useState('')
 const [providers,setProviders]=useState<ContinuousProviders>({a:'openaichatgpt',b:'openaichatgpt'}),[claudeChoices,setClaudeChoices]=useState<Array<{id:string;label:string}>>([])
 useEffect(()=>{if(!active)return;let current=true;void api().claudeModels().then(models=>{if(current)setClaudeChoices(models)}).catch(()=>{if(current)setClaudeChoices([])});return()=>{current=false}},[active,options])
 useEffect(()=>{setContinuing(false);setPollError('')},[view?.id])
 useEffect(()=>{if(view)setSaved(current=>current.map(item=>item.id===view.id?{...item,goal:view.input.goal,state:view.state}:item))},[view?.id,view?.state,view?.input.goal])
 const running=!!view&&['running','pause_requested','stop_requested'].includes(view.state)
 const finishing=!!view&&view.state==='failed'&&!view.workersEnded&&view.currentHost===true
 const unconfirmedContinuation=!!view&&!!pendingId&&pendingId!==view.id
 const currentTurn=view?.turns.at(-1)
 const activity=view?.state==='stop_requested'?'Stopping conversation and waiting for the worker to end':view?.reason==='retrying_temporary_rejection'?'ChatGPT temporarily unavailable · waiting briefly before a bounded fresh attempt':currentTurn&&['reserved','bound'].includes(currentTurn.state)?`${currentTurn.kind==='memory'?'Compacting older replies':`Agent ${currentTurn.role.toUpperCase()} is working on turn ${currentTurn.ordinal}`}${view?.state==='pause_requested'?' · pause requested':''}`:'Preparing the next agent turn'
 const progress=<>{(running||finishing||pending)&&!pollError&&<WorkIndicator label={finishing?'Waiting for the failed worker to finish closing':running?activity:'Waiting for Hadron to confirm the action'}/>} {(running||finishing)&&pollError&&<p role='alert' className='rounded-xl border p-3 text-sm'>Live status is unavailable. The last known state may be out of date. Use Check conversation before starting another task.</p>}</>
 const choices=options.filter(option=>option.connected&&option.provider==='openaichatgpt').flatMap(option=>option.models)
 const roleChoices=(role:'a'|'b')=>providers[role]==='claudecode'?claudeChoices:choices
 const validModels=()=>roleChoices('a').some(choice=>choice.id===models.a)&&roleChoices('b').some(choice=>choice.id===models.b)
 const remember=(id:string|null)=>{setPendingId(id);try{if(id)localStorage.setItem(`hadron:continuous:${conversationId}`,id);else localStorage.removeItem(`hadron:continuous:${conversationId}`)}catch{}}
 const act=async(operation:()=>Promise<void>)=>{setPending(true);setError('');try{await operation();setSaved(await api().list(conversationId))}catch(error){setError(error instanceof Error?error.message:String(error))}finally{setPending(false)}}
 useEffect(()=>{
  const requested=location.state?.hadronContinuousWorkspaceId===conversationId&&typeof location.state?.hadronContinuousSessionId==='string'&&openedVisit.current!==location.key?location.state.hadronContinuousSessionId:null
  if(!active&&!requested)return;let current=true
  if(requested){openedVisit.current=location.key;remember(requested);setView(null);setSelected(null);workspace?.showPane('continuous')}
  void(async()=>{
   const saved=await api().list(conversationId);if(current)setSaved(saved)
   const id=requested??localStorage.getItem(`hadron:continuous:${conversationId}`)
   if(id){const result=await api().check(conversationId,id);if(current){if(!result)throw Error('This saved conversation is unavailable in this workspace.');remember(id);setView(result);setError('')}}
  })().catch(error=>{if(current)setError(error.message)})
  return()=>{current=false}
 },[active,conversationId,location.key])
 useEffect(()=>{
  if(!active||!view||(!running&&!finishing))return;let current=true
  const timer=setInterval(()=>{void api().status(view.id).then(next=>{if(current){setView(next);setPollError('')}}).catch(error=>{if(current)setPollError(error.message)})},500)
  return()=>{current=false;clearInterval(timer)}
 },[active,view?.id,running,finishing])
 const workNow=async()=>{const text=instruction.trim()||goal.trim()||view?.input.goal;if(!text)throw Error('Write an instruction first.');if(await startConversationWork({workspace:conversationId,slot:'continuous',text,context:[view?.input.goal??'',...(view?.history?.turns.map(turn=>turn.role+': '+turn.text)??[]),...(view?.turns.filter(turn=>turn.text).map(turn=>turn.role+': '+turn.text)??[])].join('\n'),actor:'both',choices:{a:{provider:providers.a,modelName:models.a},b:{provider:providers.b,modelName:models.b}},permission:'ask'})){workspace?.setMode('project');workspace?.showPane('project')}}
 const transcript=<section aria-label='Automatic conversation transcript' className='space-y-4'>
  <h2 className='text-lg font-semibold'>Agent conversation</h2><p className='whitespace-pre-wrap'>{view?.input.goal||'Write a shared goal in the instructions box below. Agent A and Agent B will take turns automatically.'}</p>
  {progress}
  {view&&<p className='text-xs'>Agent A: {view.input.providers?.a==='claudecode'?'Claude':'ChatGPT'} · {view.input.models.a}. Agent B: {view.input.providers?.b==='claudecode'?'Claude':'ChatGPT'} · {view.input.models.b}.</p>}
  {view?.memory&&<details className='rounded-xl border p-3'><summary>Conversation memory · earlier replies 1–{view.memory.throughTurn}</summary><p className='mt-2 text-xs'>AI-generated summary used with recent replies. It may omit details; all original replies remain below.</p><p className='mt-2 whitespace-pre-wrap'>{view.memory.text}</p></details>}
  {view?.history&&<p className='rounded-xl border p-3 text-sm'>Continuing a saved conversation with {view.history.turns.length} earlier replies. The original session remains saved.</p>}
  {view&&<p className='text-sm'>{view.state.replaceAll('_',' ')} · {view.turns.length} / {view.input.maxTurns} requests{view.reason?` · ${reasonText(view.reason)}`:''}</p>}
  {view?.history?.turns.filter((_turn,index)=>selected===null||selected===-(index+1)).map((turn,index)=><article key={'saved-'+index} className={`rounded-xl border p-4 ${turn.role==='a'?'border-violet-300':'border-cyan-300'}`}><strong>Saved Agent {turn.role.toUpperCase()} reply</strong><p className='mt-2 whitespace-pre-wrap break-words'>{turn.text}</p></article>)}
  {view?.turns.filter(turn=>selected===null||turn.ordinal===selected).map(turn=><article key={turn.ordinal} className={`rounded-xl border p-4 ${turn.role==='a'?'border-violet-300':'border-cyan-300'}`}><div className='mb-2 flex justify-between gap-3'><strong>{turn.kind==='memory'?`Memory compaction · request ${turn.ordinal}`:`Agent ${turn.role.toUpperCase()} · turn ${turn.ordinal}`}</strong><span className='text-xs'>{turn.state}</span></div><p className='whitespace-pre-wrap break-words'>{turn.text??(turn.state==='failed'?'This attempt ended without a completed response. It is not still thinking.':running?'Waiting for the confirmed response.':'No completed response was recorded. This saved turn is not running.')}</p>{turn.kind!=='memory'&&turn.state==='completed'&&turn.text&&<ConversationActions workspaceId={conversationId} slot='continuous' defaultActor={turn.role} context={[view.input.goal,...(view.history?.turns.map(item=>item.role+': '+item.text)??[]),...view.turns.filter(item=>item.ordinal<=turn.ordinal&&item.text).map(item=>item.role+': '+item.text)].join('\n')} choices={{a:{provider:view.input.providers?.a??'openaichatgpt',modelName:view.input.models.a},b:{provider:view.input.providers?.b??'openaichatgpt',modelName:view.input.models.b}}} disabled={running}/>} {turn.errorCode&&<p className='mt-2 text-xs'>Reason: {reasonText(turn.errorCode)}. Completed replies remain saved.</p>}</article>)}
  {!!view?.messages.length&&<details><summary>Your messages to both agents</summary>{view.messages.map(item=><p key={item.id} className='my-2 whitespace-pre-wrap text-sm'>After turn {item.afterTurn}: {item.text}</p>)}</details>}
 </section>
 const tree=<section aria-label='Automatic conversation turns' className='space-y-3'><h2 className='font-semibold'>Conversation turns</h2><button className={button} onClick={()=>setSelected(null)}>Show full conversation</button>{view?.history?.turns.map((turn,index)=><div key={'saved-'+index} className='ml-5 border-l-2 border-cyan-300 pl-4'><button aria-pressed={selected===-(index+1)} className={`${button} w-full text-left`} onClick={()=>{setSelected(-(index+1));workspace?.showPane('continuous')}}><strong>Saved Agent {turn.role.toUpperCase()} · {index+1}</strong><p className='mt-1 text-xs'>{turn.text.slice(0,90)}</p></button></div>)}{view?.turns.map((turn,index)=><div key={turn.ordinal} className='ml-5 border-l-2 border-violet-300 pl-4'><button aria-pressed={selected===turn.ordinal} className={`${button} w-full text-left`} onClick={()=>{setSelected(turn.ordinal);workspace?.showPane('continuous')}}><strong>{turn.kind==='memory'?`Memory · ${turn.ordinal}`:`Agent ${turn.role.toUpperCase()} · ${turn.ordinal}`}</strong><p className='mt-1 text-xs'>{turn.text?.slice(0,90)??turn.state}</p></button>{index<view.turns.length-1&&<div className='h-3'/>}</div>)}</section>
 const composer=<WorkflowComposer mode='continuous' label='4. Instructions — Automatic conversation · both agents'>
 {error&&<p role='alert' className='text-sm'>{error}</p>}
 {(!view||continuing)&&<fieldset disabled={pending||(!view&&!!pendingId)} className='space-y-3'>    {continuing?<><p className='text-sm'>Keep all completed replies and your earlier messages saved. The agents receive compacted memory and recent replies as needed. Choose a fresh request/time budget. Failed attempts are not replayed.</p><label className='block text-sm'>What should they do next? (optional)<textarea aria-label='Continuation instruction' className='mt-1 min-h-24 w-full rounded-xl border p-3' value={instruction} maxLength={4000} onChange={event=>setInstruction(event.target.value)} placeholder='Continue the original task, or give both agents a new direction.'/></label></>:
    <label className='block text-sm'>Shared goal<textarea aria-label='Conversation goal' className='mt-1 min-h-24 w-full rounded-xl border p-3' value={goal} maxLength={12000} onChange={event=>setGoal(event.target.value)}/></label>
    }
</fieldset>}
   {view&&!running&&!finishing&&!continuing&&<button className={button} disabled={pending||unconfirmedContinuation} onClick={()=>{setModels(view.input.models);setProviders(view.input.providers??{a:'openaichatgpt',b:'openaichatgpt'});setMaxTurns(20);setMaxSeconds(600);setInstruction('');setContinuing(true)}}>Continue this saved conversation</button>}
   {view&&continuing&&<div className='flex flex-wrap gap-3'><button className={button} disabled={pending||unconfirmedContinuation||!validModels()||access==='read'&&!folder||maxTurns<2||maxTurns>100||maxSeconds<10||maxSeconds>3600} onClick={()=>void act(async()=>{
    if(access==='edit'){await workNow();return}
    const id=crypto.randomUUID();remember(id)
    const next=await api().continueSaved(view.id,{id,models,providers,maxTurns,maxSeconds,instruction,projectGrantId:access==='read'?folder?.id:undefined})
    setView(next);setSelected(null);workspace?.showPane('continuous')
   })}>Start continuation</button><button className={button} disabled={pending} onClick={()=>setContinuing(false)}>Cancel continuation</button></div>}
   <div className='flex flex-wrap gap-3'>
    {!view&&<button className={button} disabled={pending||!!pendingId||!goal.trim()||!validModels()||access==='read'&&!folder||maxTurns<2||maxTurns>100||maxSeconds<10||maxSeconds>3600} onClick={()=>void act(async()=>{
     if(access==='edit'){await workNow();return}
     const id=crypto.randomUUID(),client=createCollaborationClient(async()=>window.electronAPI!.collaboration.capability()),context=await client.prepareTask(id,conversationId,goal.trim())
     remember(id);setView(await api().start({id,workspaceId:conversationId,anchorMessageId:context.anchorMessageId,goal:goal.trim(),models,providers,maxTurns,maxSeconds,projectGrantId:access==='read'?folder?.id:undefined}));workspace?.showPane('continuous')
    })}>{access==='edit'?'Go':'Start automatic conversation'}</button>}
    {running&&<><button className={button} disabled={pending||view.state!=='running'} onClick={()=>void act(async()=>setView(await api().pause(view.id)))}>Pause after this turn</button><button className={button} disabled={pending} onClick={()=>void act(async()=>setView(await api().stop(view.id)))}>Stop conversation</button></>}
    {view?.canResume&&<button className={button} disabled={pending||unconfirmedContinuation||view.turns.length>=100} onClick={()=>void act(async()=>setView(await api().resume(view.id,view.revision,view.turns.length>=view.input.maxTurns?Math.min(20,100-view.input.maxTurns):0)))}>{view.state==='failed'?'Continue after failure (new request)':'Resume conversation'}</button>}
    {pendingId&&<button className={button} disabled={pending} onClick={()=>void act(async()=>{const result=await api().check(conversationId,pendingId);if(result)setView(result);else if(unconfirmedContinuation){remember(view!.id);setError('The continuation was not created. You can try Start continuation again.')}else{setView(null);remember(null)}})}>Check conversation</button>}
    {view&&!running&&<button className={button} disabled={pending||finishing||unconfirmedContinuation} onClick={()=>{setView(null);remember(null);setSelected(null);setGoal('')}}>New conversation</button>}
   </div>
   {view&&<p className='text-sm'>{view.state.replaceAll('_',' ')} · {view.turns.filter(turn=>turn.state==='completed'&&turn.kind!=='memory').length} completed replies · {view.turns.length} / {view.input.maxTurns} requests. {view.reason?reasonText(view.reason):''}{view.canResume&&view.turns.length>=view.input.maxTurns?' Resume adds up to20 turns (100 total maximum).':''}{!view.canResume&&!running?' Saved sessions reopen without starting requests.':''}</p>}
   {view&&['running','paused','pause_requested'].includes(view.state)&&<div className='space-y-2'><label className='block text-sm'>Message to both agents<textarea aria-label='Conversation user message' className='mt-1 w-full rounded-xl border p-3' value={message} maxLength={4000} onChange={event=>setMessage(event.target.value)}/></label><button className={button} disabled={pending||!message.trim()} onClick={()=>void act(async()=>{setView(await api().inject(view.id,crypto.randomUUID(),message.trim()));setMessage('')})}>Add at next turn</button></div>}
 </WorkflowComposer>
 return <>
  {composer}
  {workspace?.targets.continuous&&createPortal(transcript,workspace.targets.continuous)}
  {workspace?.targets.continuousTree&&createPortal(tree,workspace.targets.continuousTree)}
  <section hidden={!active} aria-label='Automatic conversation setup' className='space-y-4 rounded-xl border p-4'>
   <h2 className='font-semibold'>Automatic conversation</h2><p className='text-sm text-neutral-500'>A and B exchange replies until a chosen limit or Pause/Stop. Choose Chat only or Read files below. Work on files starts project work from your instruction, with approval when changes and checks are ready. Older replies are summarised in batches of five, with at least two recent replies kept in full. Summaries count toward the request limit; original chats stay saved.</p>
   {progress}
   {error&&<p role='alert' className='rounded-xl border p-3 text-sm'>{error}</p>}
   {unconfirmedContinuation&&<p role='status' className='rounded-xl border p-3 text-sm'>Check conversation to confirm the continuation before starting another request.</p>}
   {(!view||continuing)&&<fieldset disabled={pending||(!view&&!!pendingId)} className='space-y-3'>
    <h3 className='font-semibold'>2. Folder and access</h3>
    <FileAccess label='Conversation' value={access} disabled={pending} onChange={setAccess} onEdit={()=>void act(async()=>{const text=goal.trim()||view?.input.goal;if(!text)throw Error('Write a goal on the left first.');sendWorkflowDraft(conversationId,'project',text);workspace?.setMode('project');workspace?.showPane('project')})}/>
    <button type='button' className={button} onClick={()=>void act(async()=>{const selected=await window.electronAPI.collaboration.projectSelect(conversationId,'continuous');if(selected){setFolder(selected);setAccess(current=>current==='edit'?'edit':'read')}})}>Add folder</button>
    {folder&&<div aria-label='Conversation folder' className='rounded-lg border p-3 text-sm'><p className='break-all'>{folder.label}</p><p>{access==='read'?'Read access enabled for both agents.':'Folder reading is off.'}</p><button type='button' className={button} onClick={()=>void act(async()=>{await window.electronAPI.collaboration.projectRevoke(folder.id);setFolder(null);setAccess('chat')})}>Remove folder</button></div>}
    {access==='read'&&!folder&&<p role='status' className='text-sm'>Choose Add folder before starting.</p>}
    <p className='text-xs'>With Read files, each reply allows up to 4 model requests for evidence and its answer. Memory summaries use one request and no tools. The turn limit counts replies/summaries; actual requests can be higher. File operations appear in Folder activity.</p><h3 className='font-semibold'>3. Models and limits</h3>
    {(['a','b'] as const).map(role=><fieldset key={role} className='space-y-2 rounded-xl border p-3'><legend>Agent {role.toUpperCase()}</legend><label className='block text-sm'>Provider<select aria-label={`Conversation Agent ${role.toUpperCase()} provider`} className='mt-1 w-full rounded-xl border p-2' value={providers[role]} onChange={event=>{setProviders(current=>({...current,[role]:event.target.value as ContinuousProviders['a']}));setModels(current=>({...current,[role]:''}))}}><option value='openaichatgpt'>ChatGPT</option><option value='claudecode'>Claude subscription</option></select></label><label className='block text-sm'>Model<select aria-label={`Conversation Agent ${role.toUpperCase()} model`} className='mt-1 w-full rounded-xl border p-2' value={models[role]} onChange={event=>setModels(current=>({...current,[role]:event.target.value}))}><option value=''>Choose model</option>{roleChoices(role).map(model=><option key={model.id} value={model.id}>{model.label}</option>)}</select></label>{!roleChoices(role).length&&<p className='text-xs'>Connect this subscription above, then use Refresh providers and models.</p>}</fieldset>)}
    <div className='grid grid-cols-2 gap-3'><label className='text-sm'>Maximum turns (including summaries)<input aria-label='Conversation maximum turns' type='number' min={2} max={100} className='mt-1 w-full rounded-xl border p-2' value={maxTurns} onChange={event=>setMaxTurns(Number(event.target.value))}/></label><label className='text-sm'>Time limit (seconds)<input aria-label='Conversation seconds' type='number' min={10} max={3600} className='mt-1 w-full rounded-xl border p-2' value={maxSeconds} onChange={event=>setMaxSeconds(Number(event.target.value))}/></label></div>
   </fieldset>}
   <p className='rounded-xl border p-3 text-sm'>4. Write instructions and start or continue the conversation in the highlighted box on the left.</p>
   {view?.folderActivity?.length?<details aria-label='Conversation folder activity' className='rounded-xl border p-3 text-xs'><summary>Folder activity · {view.folderActivity.length} events</summary><ul className='max-h-48 overflow-auto'>{view.folderActivity.map((item,index)=><li key={index}>{item.tool} · {item.state}</li>)}</ul></details>:null}<label className='block text-sm'>Saved conversations<select aria-label='Saved automatic conversations' className='mt-1 w-full rounded-xl border p-2' value={view?.id??''} disabled={pending||running||unconfirmedContinuation} onChange={event=>{const id=event.target.value;if(id)void act(async()=>{setView(await api().status(id));remember(id);setSelected(null)})}}><option value=''>Choose saved conversation</option>{saved.map(item=><option key={item.id} value={item.id}>{item.goal.slice(0,70)} · {item.state}</option>)}</select></label>
   {!workspace?.targets.continuous&&transcript}{!workspace?.targets.continuousTree&&tree}
  </section>
 </>
}
