import './HadronSettings.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HadronAppearanceSettings } from '../components/CollaborationPanel/HadronAppearanceSettings'
import { SubscriptionConnections } from '../components/CollaborationPanel/SubscriptionConnections'
import { HadronToolLibrary } from '../components/CollaborationPanel/HadronToolLibrary'
import { RecycleBin } from '../components/CollaborationPanel/RecycleBin'
import { ChatArchive } from '../components/CollaborationPanel/ChatArchive'
import { HadronSetup } from '../components/CollaborationPanel/HadronSetup'
import {CompletionAlertSettings} from '../components/UnifiedWorkspace/CompletionAlertSettings'

function HadronAgentSettings() {
  const [helpers,setHelpers] = useState<boolean|null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const load = async () => {setError('');setBusy(true);try{setHelpers(await window.electronAPI.helpers.preference())}catch{setError('Helper preference could not be read. Try again.')}finally{setBusy(false)}}
  useEffect(()=>{void load()},[])
  return <section aria-labelledby='hadron-agent-settings' data-hadron-setting='Agents and tools' className='space-y-4 rounded-2xl border bg-white/70 p-5 dark:bg-neutral-900'>
    <h2 id='hadron-agent-settings' className='text-xl font-semibold'>Agents and tools</h2>
    <p className='text-sm'>Choose each agent’s provider, model, task, tool access and review options beside the workflow you are using. Those choices belong to that task.</p>
    <label className='flex items-center gap-3'><input aria-label='Automatic lightweight helpers' type='checkbox' checked={helpers===true} disabled={busy||helpers===null} onChange={event=>{const next=event.target.checked;setBusy(true);setError('');void window.electronAPI.helpers.preference(next).then(setHelpers).catch(()=>setError('Helper preference could not be saved.')).finally(()=>setBusy(false))}}/>Automatic lightweight helpers</label>
    <p className='text-sm'>Allows up to two routine helpers per agent/job, using an available lightweight model from that agent’s provider. Helpers cannot start more helpers or edit project files. Automatic conversation remains text only. The middle pane shows helper activity and results.</p>
    {error&&<div><p role='alert'>{error}</p><button type='button' disabled={busy} onClick={()=>void load()}>Retry helper preference</button></div>}
    <HadronToolLibrary />
    <CompletionAlertSettings />
    <HadronWebSearchSettings />
  </section>
}
function HadronWebSearchSettings() {
  const [key,setKey] = useState(''), [configured,setConfigured] = useState<boolean|null>(null), [busy,setBusy] = useState(false), [status,setStatus] = useState(''), [error,setError] = useState('')
  const check = async () => {const result=await window.electronAPI.secrets.braveSearch.has();if(!result.success)throw Error(result.error||'Saved key status is unavailable.');setConfigured(result.configured);return result.configured}
  useEffect(()=>{let mounted=true;void window.electronAPI.secrets.braveSearch.has().then(result=>{if(!mounted)return;if(!result.success)throw Error(result.error||'Saved key status is unavailable.');setConfigured(result.configured)}).catch(()=>{if(mounted)setError('Saved search-key status could not be checked.')});return()=>{mounted=false}},[])
  const act = async (operation:()=>Promise<void>) => {setBusy(true);setError('');setStatus('');try{await operation()}catch(error){setError(error instanceof Error?error.message:'Search settings could not be updated.')}finally{setBusy(false)}}
  return <details className='rounded-xl border p-4' data-hadron-web-search><summary className='cursor-pointer font-semibold'>Optional web search</summary>
    <p className='my-3 text-sm'>Brave Search provides web search when a task enables web tools. Reading a supplied public page does not require this key. Your ChatGPT and Claude subscriptions are connected separately above.</p>
    <p role='status' className='text-sm'>Saved Brave Search key: {configured===null?'not checked':configured?'configured':'not configured'}.</p>
    <label className='mt-3 block text-sm'>Brave Search API key<input aria-label='Brave Search API key' type='password' autoComplete='off' value={key} onChange={event=>setKey(event.target.value)} className='mt-1 block w-full rounded-lg border bg-transparent p-2' placeholder='Enter a new key to save' /></label>
    <div className='my-3 flex flex-wrap gap-3'>
      <button type='button' className='rounded-xl border px-3 py-2' disabled={busy||!key.trim()} onClick={()=>void act(async()=>{const result=await window.electronAPI.secrets.braveSearch.set(key.trim());if(!result.success)throw Error(result.error||'The key could not be saved.');if(!await check())throw Error('Saved key could not be confirmed.');setKey('');setStatus('Search key saved securely.')})}>Save Brave key</button>
      <button type='button' className='rounded-xl border px-3 py-2' disabled={busy} onClick={()=>void act(async()=>{await check();setStatus('Saved key status checked.')})}>Check saved key</button>
      <button type='button' className='rounded-xl border px-3 py-2' disabled={busy||configured!==true} onClick={()=>void act(async()=>{const result=await window.electronAPI.secrets.braveSearch.delete();if(!result.success)throw Error(result.error||'The key could not be removed.');if(await check())throw Error('The key still appears configured.');setKey('');setStatus('Search key removed.')})}>Remove Brave key</button>
    </div>
    <p className='text-xs'>Stored in Hadron’s secure desktop credential store. The saved key is never loaded into this form or browser storage. These buttons do not perform a web search.</p>
    {status&&<p role='status' className='mt-3 text-sm'>{status}</p>}{error&&<p role='alert' className='mt-3 text-sm'>{error}</p>}
  </details>
}
export function HadronSettings() {
  const navigate = useNavigate(), content = useRef<HTMLDivElement>(null)
  const jump = (index: number) => {
    const target = document.getElementById(`hadron-settings-${index}`), scroll = content.current
    if (target && scroll) scroll.scrollTo({top: scroll.scrollTop + target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 16, behavior:'smooth'})
  }
  return <main data-hadron-settings className='hadron-settings-page flex h-full min-h-0 flex-col overflow-hidden text-stone-900 dark:text-stone-100'>
    <div data-hadron-settings-navigation className='mx-auto w-full max-w-5xl shrink-0 space-y-3 px-4 py-3'>
    <header className='flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white/70 p-5 dark:bg-neutral-900'><div><h1 className='text-3xl font-semibold'>Hadron Settings</h1><p className='mt-2 text-sm'>Appearance, connections and tools for your Hadron workspace.</p></div><button type='button' className='rounded-xl border px-4 py-2' onClick={()=>navigate(-1)}>Back to workspace</button></header>
    <nav aria-label='Settings sections' className='flex flex-wrap gap-3'>{['Appearance','Connections','Agents and tools','Saved data','Setup'].map((title,index)=><button key={title} type='button' className='rounded-xl border px-3 py-2 text-sm' onClick={()=>jump(index)}>{title}</button>)}<button type='button' className='rounded-xl border px-3 py-2 text-sm' onClick={()=>content.current?.scrollTo({top:0,behavior:'smooth'})}>Back to top</button></nav>
    </div>
    <div ref={content} data-hadron-settings-scroll tabIndex={0} role='region' aria-label='Settings content' className='hadron-settings-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-scroll'>
    <div className='mx-auto max-w-5xl space-y-6 px-4 pb-8 pt-4'>
    <div id='hadron-settings-0' data-hadron-setting='Appearance'><HadronAppearanceSettings /></div>
    <section id='hadron-settings-1' data-hadron-setting='Connections' aria-labelledby='hadron-connections-title' className='space-y-4 rounded-2xl border bg-white/70 p-5 dark:bg-neutral-900'><h2 id='hadron-connections-title' className='text-xl font-semibold'>Connections</h2><p className='text-sm'>Connect your ChatGPT and Claude subscriptions here. Both agents can use the same subscription; choose their models in each workflow.</p><SubscriptionConnections /></section>
    <div id='hadron-settings-2'><HadronAgentSettings /></div>
    <section id='hadron-settings-3' data-hadron-setting='Saved data' aria-labelledby='hadron-data-title' className='space-y-3 rounded-2xl border bg-white/70 p-5 dark:bg-neutral-900'><h2 id='hadron-data-title' className='text-xl font-semibold'>Saved data and recovery</h2><p className='text-sm'>Sessions and job logs save automatically. Deleted projects and chats can be restored from the Recycle Bin for 30 days. This does not delete files in your project folders.</p><RecycleBin /><ChatArchive /></section>
    <div id='hadron-settings-4' data-hadron-setting='Setup'><HadronSetup /></div>
    </div>
    </div>
  </main>
}
