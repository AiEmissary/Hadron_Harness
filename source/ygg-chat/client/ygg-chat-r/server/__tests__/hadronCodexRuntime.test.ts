import { expect, it, vi } from 'vitest'
import path from 'node:path'
import { codexBrowserSignInUrl, parseCodexBrowserPrompt } from '../auth/hadronCodexSignIn.js'
import { HADRON_CODEX_JOB_TIMEOUT_MS, CODEX_FAILURE_REASONS, CODEX_DEVICE_URL, CODEX_CONNECTION_ARGS, HADRON_CODEX_VERSION, HadronCodexRuntime, hadronCodexEnvironment, parseCodexDevicePrompt } from '../auth/hadronCodexRuntime.js'
const prompt = `Open ${CODEX_DEVICE_URL}\n2. Enter this one-time code (expires in 15 minutes)\n   TEST-CODE\n`
const oauthUrl = 'https://auth.openai.com/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: 'fixture-client',
  redirect_uri: 'http://localhost:1455/auth/callback', state: 'synthetic-state', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256' })
const profile = path.resolve('fixture-hadron-codex')
function fixture() {
  let finish!: (value: { code: number; text: string }) => void
  let connected = false
  const browser = vi.fn(async () => {})
  const run = vi.fn(async (args: string[], options: any) => {
    if (args[0] === '--version') return { code: 0, text: `codex-cli ${HADRON_CODEX_VERSION}` }
    if (args[0] === 'logout') { connected = false; return { code: 0, text: '' } }
    if (args[1] === 'status') return { code: connected ? 0 : 1, text: connected ? 'Logged in using ChatGPT' : 'Not logged in' }
    options.onText?.('private diagnostic\n' + (args.includes('--device-auth') ? prompt : `Open your browser:\n${oauthUrl}\n`))
    return new Promise<{ code: number; text: string }>(resolve => {
      finish = value => { connected = value.code === 0; resolve(value) }
      options.signal.addEventListener('abort', () => resolve({ code: 1, text: '' }), { once: true })
    })
  })
  const runtime = new HadronCodexRuntime({ runtimeDirectory: profile, profileDirectory: profile, openBrowser: browser, run })
  return { runtime, run, browser, finish: () => finish({ code: 0, text: '' }) }
}
it('uses a separate home and drops inherited API keys, profiles and Node injection', () => {
  const env = hadronCodexEnvironment(profile, { PATH: 'fixture-path', OPENAI_API_KEY: 'private', CODEX_HOME: 'other', NODE_OPTIONS: 'injected', HTTP_PROXY: 'proxy' })
  expect(env.CODEX_HOME).toBe(path.join(profile, 'codex-runtime'))
  expect(env.PATH).toBe('fixture-path')
  expect(env).not.toHaveProperty('OPENAI_API_KEY'); expect(env).not.toHaveProperty('NODE_OPTIONS'); expect(env).not.toHaveProperty('HTTP_PROXY')
})

function probeFixture(events: unknown[], code = 0) {
  const run = vi.fn(async (args: string[]) => args[0] === '--version' ? { code: 0, text: `codex-cli ${HADRON_CODEX_VERSION}` } :
    args[0] === 'login' ? { code: 0, text: 'Logged in using ChatGPT' } : { code, text: events.map(event => JSON.stringify(event)).join('\n') })
  const diagnostic = vi.fn()
  return { run, diagnostic, runtime: new HadronCodexRuntime({ runtimeDirectory: profile, profileDirectory: profile,
    run, openBrowser: vi.fn(), onTestDiagnostic: diagnostic }) }
}
const answer = { type: 'item.completed', item: { type: 'agent_message', text: 'Hadron connection OK.' } }
const complete = { type: 'turn.completed', usage: {} }
it('runs only the fixed probe in a read-only ephemeral invocation and requires completed output', async () => {
  const f = probeFixture([{ type: 'item.completed', item: { type: 'error', message: 'private startup detail' } }, answer, complete])
  expect(await f.runtime.testConnection()).toEqual({ text: 'Hadron connection OK' })
  expect(f.run.mock.calls[2][0]).toEqual(CODEX_CONNECTION_ARGS)
  expect(CODEX_CONNECTION_ARGS).toContain('read-only'); expect(CODEX_CONNECTION_ARGS).toContain('--ignore-user-config')
  expect(JSON.stringify(f.diagnostic.mock.calls)).not.toContain('private startup detail')
})
it.each([
  ['partial output', [answer], 0],
  ['fatal error', [answer, { type: 'turn.failed', error: { message: 'private error' } }, complete], 0],
  ['unexpected tool', [{ type: 'item.started', item: { type: 'command_execution' } }, answer, complete], 0],
  ['process failure', [answer, complete], 1],
] as const)('rejects %s without retrying or returning raw diagnostics', async (_name, events, code) => {
  const f = probeFixture([...events], code)
  await expect(f.runtime.testConnection()).rejects.toThrow('No automatic retry')
  expect(f.run.mock.calls.filter(call => call[0][0] === 'exec')).toHaveLength(1)
})
it('cancels a probe and waits for its process before logout', async () => {
  const f = probeFixture([])
  let stopped = false
  f.run.mockImplementation(async (args: string[], options?: any) => {
    if (args[0] === '--version') return { code: 0, text: `codex-cli ${HADRON_CODEX_VERSION}` }
    if (args[0] === 'login') return { code: 0, text: 'Logged in using ChatGPT' }
    if (args[0] === 'logout') { expect(stopped).toBe(true); return { code: 0, text: '' } }
    return await new Promise(resolve => options.signal.addEventListener('abort', () => { stopped = true; resolve({ code: 1, text: '' }) }, { once: true }))
  })
  const probe = f.runtime.testConnection().catch(error => error)
  await vi.waitFor(() => expect(f.run.mock.calls.some(call => call[0][0] === 'exec')).toBe(true))
  await expect(f.runtime.testConnection()).rejects.toThrow('Another')
  await f.runtime.disconnect()
  expect(await probe).toBeInstanceOf(Error)
})
it('only accepts the fixed official device page and a labelled code', () => {
  expect(parseCodexDevicePrompt(prompt)).toEqual({ verificationUri: CODEX_DEVICE_URL, userCode: 'TEST-CODE' })
  expect(parseCodexDevicePrompt(prompt.replace(CODEX_DEVICE_URL, 'https://example.invalid/codex/device'))).toBeNull()
  expect(parseCodexDevicePrompt(`${CODEX_DEVICE_URL}\nunlabelled TEST-CODE`)).toBeNull()
})
it('checks local status without opening a browser or starting sign-in', async () => {
  const f = fixture()
  expect(await f.runtime.status()).toMatchObject({ installed: true, connected: false, reason: 'signed_out' })
  expect(f.browser).not.toHaveBeenCalled()
  expect(f.run.mock.calls.map(call => call[0])).toEqual([['--version'], ['login', 'status']])
})
it('starts one official device login, exposes only its prompt, and handles completion', async () => {
  const f = fixture(); f.runtime.startSignIn('device'); f.runtime.startSignIn('device')
  await vi.waitFor(() => expect(f.browser).toHaveBeenCalledOnce())
  expect(f.browser).toHaveBeenCalledWith(CODEX_DEVICE_URL)
  const status = await f.runtime.status()
  expect(status).toMatchObject({ loginState: 'running', device: { userCode: 'TEST-CODE' } })
  expect(JSON.stringify(status)).not.toContain('private diagnostic')
  expect(f.run.mock.calls.filter(call => call[0][1] === '--device-auth')).toHaveLength(1)
  f.finish()
  await vi.waitFor(async () => expect(await f.runtime.status()).toMatchObject({ connected: true, loginState: 'idle' }))
  expect(await f.runtime.status()).not.toHaveProperty('device')
})
it('cancels the owned process before logging out and removes the displayed one-time code', async () => {
  const f = fixture(); f.runtime.startSignIn('device')
  await vi.waitFor(() => expect(f.browser).toHaveBeenCalledOnce())
  await f.runtime.disconnect()
  expect(await f.runtime.status()).toMatchObject({ connected: false, loginState: 'idle' })
  expect(await f.runtime.status()).not.toHaveProperty('device')
  expect(f.run.mock.calls.some(call => call[0][0] === 'logout')).toBe(true)
})

it('joins an in-flight status helper on shutdown and never signs the account out', async () => {
  let complete!: () => void, stopped = false
  const run = vi.fn((_args: string[], options: any) => new Promise<{ code: number | null; text: string }>(resolve => {
    options.signal.addEventListener('abort', () => { stopped = true }, { once: true })
    complete = () => resolve({ code: null, text: '' })
  }))
  const runtime = new HadronCodexRuntime({ runtimeDirectory: profile, profileDirectory: profile, run, openBrowser: vi.fn() })
  const status = runtime.status(); let finished = false
  const shutdown = runtime.shutdown().then(() => { finished = true })
  await Promise.resolve(); expect(stopped).toBe(true); expect(finished).toBe(false)
  expect(runtime.shutdown()).toBe(runtime.shutdown())
  complete(); await shutdown; await status
  expect(finished).toBe(true); expect(run).toHaveBeenCalledOnce()
  runtime.startSignIn(); expect(await runtime.models()).toEqual([])
  await runtime.status(); expect(run).toHaveBeenCalledOnce()
  await expect(runtime.testConnection()).rejects.toThrow('closed')
  expect(run.mock.calls.some(call => call[0][0] === 'logout')).toBe(false)
})

it('shutdown cancels and joins device sign-in without opening a new flow or logging out', async () => {
  const f = fixture(); f.runtime.startSignIn('device')
  await vi.waitFor(() => expect(f.browser).toHaveBeenCalledOnce())
  await f.runtime.shutdown()
  expect(f.run.mock.calls.some(call => call[0][0] === 'logout')).toBe(false)
  const count = f.run.mock.calls.length; f.runtime.startSignIn()
  await f.runtime.openSignInPage(); await f.runtime.status()
  expect(f.run).toHaveBeenCalledTimes(count); expect(f.browser).toHaveBeenCalledOnce()
})

it('defaults to official browser OAuth, keeps its URL host-only, and opens a fallback only on request', async () => {
  const f = fixture(); f.runtime.startSignIn(); f.runtime.startSignIn('device')
  await vi.waitFor(async () => expect(await f.runtime.status()).toMatchObject({ loginState: 'running', loginMethod: 'browser', browserReady: true }))
  expect(f.run.mock.calls.filter(call => call[0][0] === 'login' && call[0][1] !== 'status').map(call => call[0])).toEqual([['login']])
  expect(f.browser).not.toHaveBeenCalled() // The official CLI owns automatic browser launch.
  const status = await f.runtime.status()
  expect(status).not.toHaveProperty('device')
  for (const secret of [oauthUrl, 'synthetic-state', 'fixture-client', 'private diagnostic']) expect(JSON.stringify(status)).not.toContain(secret)
  await f.runtime.openSignInPage(); expect(f.browser).toHaveBeenCalledWith(oauthUrl)
  f.finish()
  await vi.waitFor(async () => expect(await f.runtime.status()).toMatchObject({ connected: true, loginState: 'idle' }))
  expect(await f.runtime.status()).not.toHaveProperty('loginMethod')
  expect(await f.runtime.status()).not.toHaveProperty('browserReady')
  await f.runtime.openSignInPage(); expect(f.browser).toHaveBeenCalledOnce()
})

it('clears cancelled OAuth URLs and ignores a late prompt from the old process', async () => {
  const f = fixture(); f.runtime.startSignIn()
  await vi.waitFor(async () => expect((await f.runtime.status()).browserReady).toBe(true))
  const onText = f.run.mock.calls.find(call => call[0].length === 1 && call[0][0] === 'login')![1].onText
  await f.runtime.cancelSignIn(); onText(`Late prompt\n${oauthUrl}`)
  await f.runtime.openSignInPage()
  expect(f.browser).not.toHaveBeenCalled()
  expect(await f.runtime.status()).toMatchObject({ loginState: 'idle', connected: false })
  expect(await f.runtime.status()).not.toHaveProperty('browserReady')
})

it('reports the chosen failed method without silently falling back to device sign-in', async () => {
  const f = fixture()
  f.run.mockImplementation(async args => args[0] === '--version' ? { code: 0, text: `codex-cli ${HADRON_CODEX_VERSION}` } :
    args[1] === 'status' ? { code: 1, text: 'Not logged in' } : { code: 1, text: 'private failure' })
  f.runtime.startSignIn()
  await vi.waitFor(async () => expect(await f.runtime.status()).toMatchObject({ loginState: 'failed', loginMethod: 'browser' }))
  expect(f.run.mock.calls.some(call => call[0].includes('--device-auth'))).toBe(false)
  f.runtime.startSignIn('device')
  await vi.waitFor(async () => expect(await f.runtime.status()).toMatchObject({ loginState: 'failed', loginMethod: 'device' }))
  expect(JSON.stringify(await f.runtime.status())).not.toContain('private')
  expect(() => f.runtime.startSignIn('unexpected' as any)).toThrow('Unknown')
})

it('only accepts official browser OAuth addresses with PKCE and a loopback callback', () => {
  expect(parseCodexBrowserPrompt(`\x1b[32mOpen\x1b[0m\n${oauthUrl}\n`)).toBe(oauthUrl)
  for (const url of [oauthUrl.replace('auth.openai.com', 'auth.openai.com.evil.invalid'),
    oauthUrl.replace('/oauth/authorize', '/other'), oauthUrl + '#fragment', oauthUrl + '&state=duplicate',
    oauthUrl.replace('http%3A%2F%2Flocalhost%3A1455', 'https%3A%2F%2Fevil.invalid'),
    oauthUrl.replace('S256', 'plain'), oauthUrl.replace('code_challenge=' + 'a'.repeat(43), 'code_challenge=short'),
    oauthUrl.replace('auth.openai.com', 'auth.openai.com@evil.invalid')]) {
    expect(codexBrowserSignInUrl(url)).toBeNull(); expect(parseCodexBrowserPrompt(`Open ${url}\n`)).toBeNull()
  }
  expect(parseCodexBrowserPrompt(prompt)).toBeNull()
})

it('reads account allowance without a model turn, deduplicates checks and avoids work admission slots',async()=>{
 const f=probeFixture([]),rpc=vi.spyOn(f.runtime as any,'readAccountRpc').mockResolvedValue({ordinaryUsageAllowed:true,rateLimits:{primary:{usedPercent:40,resetsAt:1794433200}}})
 const [a,b]=await Promise.all([f.runtime.usage(),f.runtime.usage()])
 expect(a?.windows[0].remainingPercent).toBe(60);expect(b).toEqual(a)
 expect(rpc).toHaveBeenCalledOnce();expect(rpc).toHaveBeenCalledWith('account/rateLimits/read',{excludeResetCreditDetails:true})
 expect(f.run.mock.calls.some(call=>call[0][0]==='exec')).toBe(false)
 await f.runtime.shutdown();expect(await f.runtime.usage()).toBeNull()
})

it.each(['timeout','output_limit'] as const)('reports the bounded %s failure and uses the longer job deadline without retrying',async category=>{
 const diagnostic=vi.fn(),run=vi.fn(async(args:string[],options:any)=>{
  if(args[0]==='--version')return{code:0,text:`codex-cli ${HADRON_CODEX_VERSION}`}
  if(args[0]==='login')return{code:0,text:'Logged in using ChatGPT'}
  expect(options.timeout).toBe(HADRON_CODEX_JOB_TIMEOUT_MS)
  expect(options.timeout).toBe(600000)
  return{code:null,text:'private provider detail',category}
 })
 const runtime=new HadronCodexRuntime({runtimeDirectory:profile,profileDirectory:profile,openBrowser:vi.fn(),run,onJobDiagnostic:diagnostic})
 runtime.allowedModels.add('fixture-model')
 await expect(runtime.generate({requestPolicy:'single_attempt',modelName:'fixture-model',history:[],userContent:'Test'} as any)).rejects.toThrow(CODEX_FAILURE_REASONS[category])
 expect(run.mock.calls.filter(([args])=>args[0]==='exec')).toHaveLength(1)
 expect(diagnostic.mock.calls.at(-1)?.[0].category).toBe(category)
 expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private provider detail')
 await runtime.shutdown()
})
