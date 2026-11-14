import { useEffect, useRef, useState } from 'react'
import type { HadronCodexStatus } from '../../../server/auth/hadronCodexTypes'

export function CodexConnection({compact=false}:{compact?:boolean}={}) {
  const bridge = window.electronAPI!.collaboration
  const [status, setStatus] = useState<HadronCodexStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [test, setTest] = useState('')
  const alive = useRef(true), generation = useRef(0)
  const lastAvailability = useRef<string | null>(null)
  async function refresh() {
    const current = ++generation.current
    try {
      const next = await bridge.codexStatus()
      if (alive.current && current === generation.current) {
        setStatus(next); setFailed(false); if (!next.connected) setTest('')
        const availability = `${next.connected}:${next.loginState}`
        if (lastAvailability.current !== availability) {
          lastAvailability.current = availability
          window.dispatchEvent(new Event('hadron-subscription-changed'))
        }
      }
    } catch { if (alive.current && current === generation.current) setFailed(true) }
  }
  useEffect(() => { alive.current = true; void refresh(); return () => { alive.current = false; generation.current++ } }, [])
  useEffect(() => {
    if (status?.loginState !== 'running' || pending) return
    const timer = setTimeout(() => void refresh(), 2000)
    return () => clearTimeout(timer)
  }, [status, pending])
  async function act(action: () => Promise<unknown>) {
    if (pending) return
    generation.current++; setPending(true); setFailed(false)
    try { await action(); if (alive.current) await refresh() }
    catch { if (alive.current) setFailed(true) }
    finally { if (alive.current) { setPending(false); window.dispatchEvent(new Event('hadron-subscription-changed')) } }
  }
  const running = status?.loginState === 'running'
  const description = failed ? 'Connection check failed. Try again.' : !status ? 'Checking connection...' :
    running ? status.loginMethod === 'browser' ? 'Finish signing in in your browser. If it did not open, use Open sign-in page below.' : status.device ? 'Enter the code below on the OpenAI sign-in page.' : 'Preparing device-code sign-in...' :
    status.connected ? 'Subscription connected through Codex' : !status.installed ? 'The Hadron Codex runtime is unavailable' :
    status.loginState === 'failed' ? status.loginMethod === 'device' ? 'Device-code sign-in did not finish. It may need enabling in your ChatGPT security settings or by your workspace administrator. Try browser sign-in instead.' : 'Browser sign-in did not finish. Try again; your account or workspace must allow Codex access.' :
    status.reason === 'status_unavailable' ? 'Codex status could not be checked. Use Check ChatGPT to try again.' :
    status.reason === 'different_auth_method' ? 'Sign in using your ChatGPT subscription.' : 'Not connected'
  return <div data-auth-method='codex' className='min-w-0 rounded-lg border bg-white p-3 dark:bg-neutral-900'>
    <h3 className='font-medium'>ChatGPT</h3>
    <p className='mt-2 text-xs text-neutral-500'>Official Codex sign-in, saved separately for Hadron.</p>
    <p role='status' className='my-2 text-xs text-neutral-500'>{description}</p>
    {running && status?.loginMethod === 'browser' && status.browserReady && <button type='button' className='mb-3 px-3 py-2 text-xs' disabled={pending} onClick={() => void act(bridge.codexOpenSignIn)}>Open sign-in page</button>}
    {running && status?.device && <div className='my-3 rounded-lg border p-3 text-sm'>
      <p className='mb-2 text-xs'>Enter this one-time code in your browser:</p>
      <code className='select-text text-lg font-semibold tracking-widest'>{status.device.userCode}</code>
      <button type='button' className='mt-3 block px-3 py-2 text-xs' disabled={pending} onClick={() => void act(bridge.codexOpenSignIn)}>Open sign-in page</button>
      <p className='mt-2 text-xs text-neutral-500'>Use this only for the sign-in you started here. Do not send the code in chat.</p>
    </div>}
    <div className='flex flex-wrap gap-2 text-xs'>
      {running ? <button type='button' className='px-3 py-2' disabled={pending} onClick={() => void act(bridge.codexCancelSignIn)}>Cancel ChatGPT sign-in</button> :
        !status?.connected && <button type='button' className='px-3 py-2' disabled={pending || !status?.installed || status.reason === 'status_unavailable'} onClick={() => void act(() => bridge.codexSignIn('browser'))}>Continue with ChatGPT</button>}
      <button type='button' className='px-3 py-2' disabled={pending} onClick={() => void act(async () => {})}>Check ChatGPT</button>
      {status?.connected && !compact && <button type='button' className='px-3 py-2' disabled={pending} onClick={() => void act(bridge.codexDisconnect)}>Disconnect ChatGPT</button>}
      {status?.connected && !compact && <button type='button' className='px-3 py-2' disabled={pending} onClick={() => void act(async () => {
        setTest('Testing ChatGPT...')
        try { const result = await bridge.codexTest(); if (alive.current) setTest(result.text) }
        catch { if (alive.current) setTest('The connection test did not complete.'); throw new Error('Connection test failed') }
      })}>Test ChatGPT</button>}
    </div>
    {!running && !status?.connected && <details className='mt-3 text-xs'>
      <summary className='cursor-pointer'>Optional: device-code sign-in</summary>
      <p className='my-2 text-neutral-500'>Use browser sign-in above normally. Device-code sign-in must be enabled for your account or by your workspace administrator; it does not bypass their policy.</p>
      <button type='button' className='px-3 py-2' disabled={pending || !status?.installed || status.reason === 'status_unavailable'} onClick={() => void act(() => bridge.codexSignIn('device'))}>Sign in with a device code</button>
    </details>}
    {status?.connected && !compact && <p className='mt-3 text-xs text-neutral-500'>Connected. Choose ChatGPT and a model below to run agent tasks. Each job saves its response and log.</p>}
    {status?.connected && test && <p role='status' className='mt-3 text-xs'>{test}</p>}
  </div>
}
