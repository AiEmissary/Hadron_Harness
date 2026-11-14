import { useEffect, useRef, useState } from 'react'
import { CodexConnection } from './CodexConnection'
import { ProviderCliNotice } from './ProviderCliNotice'

interface Status { connected: boolean; reason: string; loginState?: 'idle' | 'running' | 'failed'; installed?: boolean; accountSource?:'claude_code'|'hadron';loginError?: { code: string; message: string } }
interface Connection {
  status(): Promise<Status>; signIn(): Promise<unknown>; cancel(): Promise<unknown>; disconnect?(): Promise<unknown>
}
function ChatgptConnectionTest() {
  const bridge = window.electronAPI?.collaboration
  const [models, setModels] = useState<Array<{ id: string; label: string }> | null>(null)
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  if (!bridge?.chatgptTestModels || !bridge.chatgptTest) return null
  async function loadModels() {
    setPending(true); setMessage(''); setSelected('')
    try {
      const choices = await bridge!.chatgptTestModels()
      if (alive.current) { setModels(choices); if (!choices.length) setMessage('No supported connection-test model is available for this account yet.') }
    } catch { if (alive.current) setMessage('Could not load test models. Check your ChatGPT connection.') }
    finally { if (alive.current) setPending(false) }
  }
  async function test() {
    setPending(true); setMessage('Sending one short connection test...')
    try {
      const result = await bridge!.chatgptTest(selected)
      if (alive.current) setMessage(`ChatGPT replied: ${result.text}`)
    } catch { if (alive.current) setMessage('The connection test did not complete. No automatic retry was made. Check your sign-in and plan availability.') }
    finally { if (alive.current) setPending(false) }
  }
  return <div aria-label='ChatGPT connection test' className='mt-4 border-t pt-3 text-xs'>
    <p className='mb-2 text-neutral-500'>Try one short response using your ChatGPT plan. This sends only “Reply with exactly: Hadron connection OK”.</p>
    <button type='button' className='px-3 py-2' disabled={pending} onClick={() => void loadModels()}>Load test models</button>
    {!!models?.length && <div className='mt-2 flex flex-wrap items-center gap-2'>
      <label className='min-w-0'>Test model
        <select aria-label='ChatGPT connection test model' className='mt-1 block max-w-full rounded border p-2' disabled={pending} value={selected} onChange={event => { setSelected(event.target.value); setMessage('') }}>
          <option value=''>Choose test model</option>
          {models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
      </label>
      <button type='button' className='px-3 py-2' disabled={pending || !selected} onClick={() => void test()}>Test ChatGPT</button>
    </div>}
    {message && <p role='status' className='mt-2 whitespace-pre-wrap break-words'>{message}</p>}
    <p className='mt-2 text-neutral-500'>One request, up to 256 output tokens. This checks the advanced app-registration connection only.</p>
  </div>
}
function AccountConnection({ name, connection,compact=false }: {compact?:boolean; name: 'ChatGPT' | 'Claude'; connection?: Connection }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const generation = useRef(0)
  const alive = useRef(true)
  const currentConnection = useRef(connection); currentConnection.current = connection
  const lastAvailability = useRef<string | null>(null)
  async function refresh() {
    const version = ++generation.current
    try {
      const next = await currentConnection.current?.status()
      if (!alive.current || generation.current !== version) return
      setStatus(next ?? null); setError(false)
      const availability = `${next?.connected}:${next?.loginState}`
      if (lastAvailability.current !== availability) {
        lastAvailability.current = availability
        window.dispatchEvent(new CustomEvent('hadron-subscription-changed',{detail:{provider:name,status:next}}))
      }
    } catch { if (alive.current && generation.current === version) setError(true) }
  }
  useEffect(() => {
    alive.current = true; void refresh()
    const changed=(event:Event)=>{
      const detail=(event as CustomEvent<{provider?:string;status?:Status}>).detail
      if(detail?.provider===name&&detail.status){generation.current++;setStatus(detail.status);setError(false)}
      else if(!detail?.provider)void refresh()
    }
    const focus=()=>void refresh()
    window.addEventListener('hadron-subscription-changed',changed);window.addEventListener('focus',focus)
    return () => { alive.current = false; generation.current++;window.removeEventListener('hadron-subscription-changed',changed);window.removeEventListener('focus',focus) }
  }, [])
  useEffect(() => {
    if (status?.loginState !== 'running' || pending) return
    const timer = setTimeout(() => void refresh(), 3000)
    return () => clearTimeout(timer)
  }, [status, pending])
  async function act(action: (() => Promise<unknown>) | undefined) {
    if (!action || pending) return
    generation.current++; setPending(true); setError(false)
    try { await action(); if (alive.current) await refresh() }
    catch { if (alive.current) setError(true) }
    finally { if (alive.current) { setPending(false); window.dispatchEvent(new Event('hadron-subscription-changed')) } }
  }
  const running = status?.loginState === 'running'
  const description = !connection ? 'Desktop connection unavailable' : error ? 'Connection check failed. Try again.' :
    !status ? 'Checking connection...' : running ? 'Finish signing in in your browser' :
    status.loginState === 'failed' && status.loginError ? `${status.loginError.message} [${status.loginError.code}]` :
    status.connected ? name==='Claude' ? status.accountSource==='hadron'?'Connected using your existing Hadron sign-in':'Connected using your Claude Code sign-in' : 'Subscription connected' : status.reason === 'not_installed' ? 'Claude runtime is not installed' :
    status.reason === 'storage_unavailable' ? 'Protected account storage is unavailable' :
    status.reason === 'profile_mismatch' ? 'Claude Code returned an unexpected account location. Check your CLI configuration.' :
    status.reason === 'status_unavailable' ? 'The account could not be checked. Try Check again.' :
    status.loginState === 'failed' ? 'Sign-in did not finish. Try again.' :
    status.reason === 'different_auth_method' ? 'Use your Claude subscription to sign in' :
    ['expired', 'reconnect_required'].includes(status.reason) ? 'Sign in again to reconnect' : 'Not connected'
  return <div data-auth-method={name === 'ChatGPT' ? 'siwc' : undefined} className='min-w-0 rounded-lg border bg-white p-3 dark:bg-neutral-900'>
    <h3 className='font-medium'>{name}</h3>
    {name==='Claude'&&<p className='mt-2 text-xs text-neutral-500'>Claude Code CLI · claude -p. Reuses your existing CLI sign-in automatically. No separate Hadron sign-in is needed.</p>}
    <p role='status' className='my-2 text-xs text-neutral-500'>{description}</p>
    <div className='flex flex-wrap gap-2 text-xs'>
      {running ? <button type='button' disabled={pending} onClick={() => void act(connection?.cancel)} className='rounded-full border px-3 py-2 disabled:opacity-50'>Cancel {name} sign-in</button> :
        !status?.connected&&<button type='button' disabled={!connection || pending || status?.installed === false} onClick={() => void act(connection?.signIn)} className='rounded-full border px-3 py-2 disabled:opacity-50'>{name === 'ChatGPT' ? 'Continue with ChatGPT' : 'Connect Claude'}</button>}
      <button type='button' disabled={!connection || pending} onClick={() => void act(async () => {})} className='rounded-full border px-3 py-2 disabled:opacity-50'>Check {name}</button>
      {status?.connected && connection?.disconnect && <button type='button' disabled={pending} onClick={() => void act(connection.disconnect)} className='rounded-full border px-3 py-2 disabled:opacity-50'>Disconnect {name}</button>}
    </div>
    {!compact && name === 'ChatGPT' && status?.connected && !running && !pending && <ChatgptConnectionTest />}
  </div>
}

export function SubscriptionConnections({compact=false}:{compact?:boolean}={}) {
  const bridge = window.electronAPI?.collaboration
  const chatgpt = bridge?.chatgptStatus && bridge?.chatgptSignIn && bridge?.chatgptCancelSignIn ? {
    status: bridge.chatgptStatus, signIn: bridge.chatgptSignIn, cancel: bridge.chatgptCancelSignIn, disconnect: bridge.chatgptDisconnect,
  } : undefined
  const claude = bridge?.claudeStatus && bridge?.claudeSignIn && bridge?.claudeCancelSignIn ? {
    status: bridge.claudeStatus, signIn: bridge.claudeSignIn, cancel: bridge.claudeCancelSignIn,
  } : undefined
  return <section aria-label='Hadron subscription connections' className='mb-4 rounded-xl border p-3'>
    <h2 className='text-sm font-semibold'>Subscriptions</h2>
    <p className='mb-3 text-xs text-neutral-500'>ChatGPT connects here. Claude reuses your Claude Code sign-in.</p>
    <ProviderCliNotice />
    <div className={compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>
      <div className='min-w-0'>{bridge?.codexStatus ? <>
        <CodexConnection compact={compact}/>
        {!compact&&<details className='mt-3 text-xs'><summary className='cursor-pointer text-neutral-500'>Advanced: app-registration sign-in</summary>
          <div className='mt-2'><AccountConnection compact={compact} name='ChatGPT' connection={chatgpt} /></div>
        </details>}
      </> : <AccountConnection compact={compact} name='ChatGPT' connection={chatgpt} />}</div>
      <AccountConnection compact={compact} name='Claude' connection={claude} />
    </div>
  </section>
}
