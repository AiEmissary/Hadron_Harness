import { useEffect, useRef, useState } from 'react'
import { getLocalServerOrigin } from '../../utils/api'

interface Tool { definition: { name: string; description: string; inputSchema: unknown }; hash: string; enabled: boolean }
export function HadronToolLibrary() {
  const [open, setOpen] = useState(false), [tools, setTools] = useState<Tool[]>([]), [root, setRoot] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [review, setReview] = useState<{ tool: Tool; code: string } | null>(null)
  const [adding, setAdding] = useState(false), [name, setName] = useState(''), [description, setDescription] = useState('')
  const [schema, setSchema] = useState('{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}')
  const [code, setCode] = useState('function* run(args) {\n  return {text: args.text};\n}')
  const [testInput, setTestInput] = useState('{}'), [testResult, setTestResult] = useState('')
  const testAbort = useRef<AbortController | null>(null)
  useEffect(() => () => testAbort.current?.abort(), [])
  const request = async (suffix = '', body?: unknown, signal?: AbortSignal) => {
    if (!window.electronAPI?.collaboration) throw new Error('Desktop connection unavailable')
    const token = await window.electronAPI.collaboration.capability(), origin = await getLocalServerOrigin()
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop connection unavailable')
    const response = await fetch(`${origin}/api/collaboration/tools${suffix}`, { method: body === undefined ? 'GET' : 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const value = await response.json().catch(() => null)
    if (!response.ok) throw new Error(typeof value?.error === 'string' ? value.error : 'Tool library request failed. Refresh and review the current version before enabling it.')
    return value
  }
  const refresh = async () => {
    const value = await request()
    if (!Array.isArray(value.tools) || typeof value.root !== 'string') throw new Error('Invalid tool library response')
    setTools(value.tools); setRoot(value.root)
  }
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await fn() } catch (error) { setError(error instanceof Error ? error.message : 'Tool library unavailable') }
    finally { setBusy(false) }
  }
  return <section aria-label='Hadron tool library' className='rounded-xl border p-3 space-y-3'>
    <button type='button' aria-expanded={open} disabled={busy} onClick={() => { setOpen(!open); if (!open) void act(refresh) }} className='px-3 py-2 text-sm'>Tool library</button>
    {open && <>
      <p className='text-sm'>Choose Web research or Create and test tools in an agent’s setup. New tools remain disabled until you review and enable their exact version here.</p>
      <p className='text-xs text-neutral-500'>Tools use isolated JavaScript with public web operations. They cannot access Node, your filesystem, personal browser cookies or other applications. Shared collaboration can use these tools during its optional verification stage.</p>
      {root && <p className='break-all text-xs'>Hadron folder: {root}</p>}
      <button type='button' disabled={busy} onClick={() => void act(refresh)} className='px-3 py-2 text-sm'>Refresh tools</button>
      <button type='button' disabled={busy} onClick={() => { setAdding(!adding); setError('') }} className='px-3 py-2 text-sm'>Add a tool</button>
      {adding && <section aria-label='Create a tool' className='space-y-3 rounded-lg border p-3'>
        <p className='text-sm'>Define a JavaScript generator named run(args). It can return JSON or yield a supported web operation. Saving creates a disabled version.</p>
        <label className='block text-sm'>Name<input aria-label='New tool name' value={name} onChange={event => setName(event.target.value)} className='mt-1 block w-full rounded-lg border p-2' placeholder='my_tool' /></label>
        <label className='block text-sm'>Description<input aria-label='New tool description' value={description} onChange={event => setDescription(event.target.value)} className='mt-1 block w-full rounded-lg border p-2' /></label>
        <label className='block text-sm'>Input schema<textarea aria-label='New tool input schema' value={schema} onChange={event => setSchema(event.target.value)} rows={4} className='mt-1 block w-full rounded-lg border p-2 font-mono text-xs' /></label>
        <label className='block text-sm'>JavaScript<textarea aria-label='New tool JavaScript' value={code} onChange={event => setCode(event.target.value)} rows={7} className='mt-1 block w-full rounded-lg border p-2 font-mono text-xs' /></label>
        <div className='flex flex-wrap gap-3'>
          <button type='button' disabled={busy || !name.trim() || !description.trim() || !code.trim()} onClick={() => void act(async () => { const created = await request('', { definition: { name, description, inputSchema: JSON.parse(schema) }, code }); setAdding(false); setTestResult(''); setReview({ tool: created, code }); await refresh() })} className='px-3 py-2 text-sm'>Save disabled tool</button>
          <button type='button' disabled={busy} onClick={() => setAdding(false)} className='px-3 py-2 text-sm'>Cancel</button>
        </div>
      </section>}
      {!tools.length && <p className='text-sm'>No custom tools yet. Ask an agent in Create and test tools mode to build one.</p>}
      {tools.map(tool => <article key={tool.definition.name + tool.hash} className='rounded-lg border p-3 space-y-2'>
        <h3 className='font-semibold'>{tool.definition.name} · {tool.enabled ? 'Enabled' : 'Disabled draft'}</h3>
        <p className='text-sm'>{tool.definition.description}</p>
        <div className='flex flex-wrap gap-3'>
          <button type='button' disabled={busy} onClick={() => void act(async () => { const value = await request(`/${encodeURIComponent(tool.definition.name)}/${tool.hash}/source`); if (typeof value.code !== 'string') throw new Error('Source unavailable'); setTestResult(''); setReview({ tool, code: value.code }) })} className='px-3 py-2 text-sm'>Review source</button>
          {tool.enabled && <button type='button' disabled={busy} onClick={() => void act(async () => { await request(`/${encodeURIComponent(tool.definition.name)}/enabled`, { hash: null }); setReview(null); await refresh() })} className='px-3 py-2 text-sm'>Disable {tool.definition.name}</button>}
        </div>
      </article>)}
      {review && <section aria-label='Review tool version' className='rounded-lg border p-3 space-y-3'>
        <h3 className='font-semibold'>{review.tool.definition.name} source and input schema</h3>
        <pre className='max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs'>{JSON.stringify(review.tool.definition.inputSchema, null, 2)}{'\n\n'}{review.code}</pre>
        <p className='text-xs break-all'>Version: {review.tool.hash}</p>
        <label className='block text-sm'>Test inputs (JSON)<textarea aria-label='Tool test inputs' value={testInput} onChange={event => setTestInput(event.target.value)} rows={3} className='mt-1 block w-full rounded-lg border p-2 font-mono text-xs' /></label>
        <p className='text-xs'>Testing runs this source in the sandbox and can read public web pages/search results. It does not enable the tool.</p>
        <button type='button' disabled={busy} onClick={() => void act(async () => {
          setTestResult(''); const args = JSON.parse(testInput), controller = new AbortController(); testAbort.current = controller
          try { const value = await request(`/${encodeURIComponent(review.tool.definition.name)}/${review.tool.hash}/test`, { arguments: args }, controller.signal); setTestResult(JSON.stringify(value.result, null, 2)) }
          finally { if (testAbort.current === controller) testAbort.current = null }
        })} className='px-3 py-2 text-sm'>Test this version</button>
        {busy && testAbort.current && <button type='button' onClick={() => testAbort.current?.abort()} className='px-3 py-2 text-sm'>Cancel test</button>}
        {testResult && <pre aria-label='Tool test result' className='max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs'>{testResult}</pre>}
        <div className='flex flex-wrap gap-3'>
          <button type='button' disabled={busy || review.tool.enabled} onClick={() => void act(async () => { await request(`/${encodeURIComponent(review.tool.definition.name)}/enabled`, { hash: review.tool.hash }); setReview(null); await refresh() })} className='px-3 py-2 text-sm'>Enable reviewed version</button>
          <button type='button' disabled={busy} onClick={() => setReview(null)} className='px-3 py-2 text-sm'>Close review</button>
        </div>
      </section>}
    </>}
    {error && <p role='alert' className='text-sm'>{error}</p>}
  </section>
}
