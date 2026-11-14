import {admitHadronToolSession} from '../../../hadronTools/types.js'
import { expect, it, vi } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import {readFileSync,existsSync} from 'node:fs'
import { ClaudeCodeRuntime, claudeConversationText, claudeNativePackage, claudeRuntimeEnvironment,claudeTextResult,claudeStructuredResult,claudeNeedsSignIn,CLAUDE_SIGN_IN_REQUIRED,claudeFailureDetails,claudeFailureCategory } from '../claudeCodeRuntime.js'

it('identifies provider rejections even when the terminal subtype says success and retains no raw account text',()=>{
 const raw=JSON.stringify({type:'result',subtype:'success',is_error:true,result:'API Error: 400 invalid_request_error PRIVATE ACCOUNT DETAIL'})
 expect(claudeFailureDetails(raw)).toEqual({resultError:true,apiStatus:400,providerErrorType:'invalid_request_error'})
 expect(claudeFailureCategory(raw,'Claude job stopped')).toBe('request_rejected')
 expect(JSON.stringify(claudeFailureDetails(raw))).not.toContain('PRIVATE')
 for(const [status,category] of [[401,'authentication'],[429,'usage_limit'],[503,'provider_unavailable']] as const){
  expect(claudeFailureCategory(JSON.stringify({type:'result',subtype:'success',is_error:true,result:`API Error: ${status} PRIVATE`}), 'Claude job stopped')).toBe(category)
 }
 expect(claudeFailureCategory(JSON.stringify({type:'result',subtype:'success',is_error:true,result:'Unknown private failure'}),'Claude job stopped')).toBe('provider_error')
 expect(claudeFailureDetails(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'An example of API Error: 400'})).apiStatus).toBeNull()
})
const frames=(overrides:Record<string,unknown>={})=>[
 {type:'system',subtype:'init',tools:[],mcp_servers:[]},
 {type:'assistant',message:{content:[{type:'text',text:'Ready.'}]}},
 {type:'result',subtype:'success',is_error:false,num_turns:1,permission_denials:[],result:'Ready.',...overrides}
].map(frame=>JSON.stringify(frame)).join('\n')
it('preserves task and tool JSON verbatim without nested envelopes or a duplicated final user message',()=>{
 const task='{"tool":"project_read","arguments":{"path":"src/file.ts"}}'
 expect(claudeConversationText([],task)).toBe(task)
 expect(claudeConversationText([{role:'user',content:task}],task)).toBe(task)
 const text=claudeConversationText([{role:'user',content:'Question "one"'},{role:'assistant',content:'Peer-independent answer'},{role:'user',content:task}],task)
 expect(text).toContain('You:\nQuestion "one"')
 expect(text).toContain('Assistant:\nPeer-independent answer')
 expect(text.split(task)).toHaveLength(2)
})
const structuredFrames=()=>[
 {type:'system',subtype:'init',tools:['StructuredOutput'],mcp_servers:[]},
 {type:'assistant',message:{content:[{type:'tool_use',id:'formatter',name:'StructuredOutput',input:{tool:'create_file',arguments:{path:'game.txt',content:'Test game'}}}]}},
 {type:'user',message:{content:[{type:'tool_result',tool_use_id:'formatter',content:'Formatted.'}]}},
 {type:'result',subtype:'success',is_error:false,num_turns:2,permission_denials:[],structured_output:{tool:'create_file',arguments:{path:'game.txt',content:'Test game'}}},
].map(frame=>JSON.stringify(frame)).join('\n')
it('accepts only the completed internal JSON formatter, rejecting native execution tools and forged results',()=>{
 const raw=structuredFrames()
 expect(JSON.parse(claudeStructuredResult(raw)).tool).toBe('create_file')
 expect(()=>claudeTextResult(raw)).toThrow()
 for(const invalid of [raw.replaceAll('StructuredOutput','Bash'),raw.replace('"tools":["StructuredOutput"]','"tools":["StructuredOutput","Read"]'),raw.replace('"tool_use_id":"formatter"','"tool_use_id":"foreign"'),raw.replace('"num_turns":2','"num_turns":4'),raw.replace('"is_error":false','"is_error":true'),raw.replace('"structured_output":{"tool":"create_file"','"structured_output":{"tool":"delete_file"'),raw.split('\n').slice(0,-1).join('\n')])expect(()=>claudeStructuredResult(invalid)).toThrow()
})
it('uses only the final acknowledged formatting result and removes empty schema placeholders',()=>{
 const frames=structuredFrames().split('\n').map(line=>JSON.parse(line)),final=frames.pop()
 const output={answer:'Done.',tool:'',arguments:{}}
 frames.push({type:'assistant',message:{content:[{type:'tool_use',id:'formatter-2',name:'StructuredOutput',input:output}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'formatter-2',content:'Formatted.'}]}},{...final,num_turns:3,structured_output:output})
 expect(JSON.parse(claudeStructuredResult(frames.map(frame=>JSON.stringify(frame)).join('\n')))).toEqual({answer:'Done.'})
})
it('accepts the CLI formatting reminder without treating it as a user task or a tool result',()=>{
 const frames=structuredFrames().split('\n').map(line=>JSON.parse(line))
 frames.splice(1,0,{type:'user',message:{content:[{type:'text',text:'[structured-output-enforce] You MUST call the StructuredOutput tool to complete this request. Call this tool now.'}]}})
 expect(JSON.parse(claudeStructuredResult(frames.map(frame=>JSON.stringify(frame)).join('\n'))).tool).toBe('create_file')
 frames[1].message.content[0].text='Do something else.'
 expect(()=>claudeStructuredResult(frames.map(frame=>JSON.stringify(frame)).join('\n'))).toThrow()
})
it('grants only the JSON formatter inside the CLI; file operations remain in the host broker',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-formatting-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir()})
 vi.spyOn(runtime,'status').mockResolvedValue({installed:true,version:'2.1.318',connected:true,reason:'ready'});await runtime.models()
 const capture=vi.spyOn(runtime as any,'capture').mockResolvedValue({code:0,stdout:structuredFrames()})
 const response=await (runtime as any).generateText({modelName:'sonnet',requestPolicy:'single_attempt',history:[],userContent:'Test'},undefined,true)
 expect(JSON.parse(response.content).tool).toBe('create_file')
 const args=capture.mock.calls[0][0] as string[]
 expect(args).toContain('--print') // Official `claude -p` non-interactive mode, including tool-broker requests.
 expect(args[args.indexOf('--tools')+1]).toBe('');expect(args[args.indexOf('--allowedTools')+1]).toBe('StructuredOutput');expect(args).toContain('--strict-mcp-config');expect(args).toContain('--json-schema')
})
it('ignores a native call only when the CLI confirms it was unavailable, then returns only the final host JSON',()=>{
 const frames=structuredFrames().split('\n').map(line=>JSON.parse(line))
 frames.splice(1,0,{type:'assistant',message:{content:[{type:'tool_use',id:'unavailable',name:'read_file',input:{path:'outside'}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'unavailable',is_error:true,content:'Tool unavailable.'}]}})
 frames.at(-1).num_turns=3
 expect(JSON.parse(claudeStructuredResult(frames.map(frame=>JSON.stringify(frame)).join('\n'))).tool).toBe('create_file')
 frames[2].message.content[0].is_error=false
 expect(()=>claudeStructuredResult(frames.map(frame=>JSON.stringify(frame)).join('\n'))).toThrow('denial')
})
it('reports an expired OAuth session clearly without publishing raw diagnostics or retrying',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-expired-auth-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir()})
 vi.spyOn(runtime,'status').mockResolvedValue({installed:true,version:'2.1.318',connected:true,reason:'ready'})
 await runtime.models()
 const output=frames({is_error:true,result:'Failed to authenticate: OAuth session expired and could not be refreshed private diagnostic'})
 const capture=vi.spyOn(runtime as any,'capture').mockResolvedValue({code:1,stdout:output})
 await expect(runtime.generate({modelName:'sonnet',requestPolicy:'single_attempt',history:[],userContent:'Reply.'})).rejects.toThrow(CLAUDE_SIGN_IN_REQUIRED)
 expect(capture).toHaveBeenCalledTimes(1);expect(runtime.allowedModels.size).toBe(0)
 expect(claudeNeedsSignIn(frames({result:'Explain what OAuth session expired means.'}))).toBe(false)
})
it('selects native packages explicitly and never falls back to a system binary', () => {
  expect(claudeNativePackage('win32', 'x64')).toBe('@anthropic-ai/claude-code-win32-x64')
  expect(claudeNativePackage('darwin', 'arm64')).toBe('@anthropic-ai/claude-code-darwin-arm64')
  expect(claudeNativePackage('darwin', 'x64')).toBe('@anthropic-ai/claude-code-darwin-x64')
  expect(() => claudeNativePackage('linux', 'x64')).toThrow('not supported')
  expect(() => claudeNativePackage('win32', 'ia32')).toThrow('not supported')
})

it('launches only one official login per click sequence and cancels its own process', async () => {
  const runtime = new ClaudeCodeRuntime({ runtimeDirectory: os.tmpdir(), profileDirectory: path.join(os.tmpdir(), 'hadron-login-fixture') })
  vi.spyOn(runtime, 'binary').mockReturnValue('fixture-only')
  let signal: AbortSignal | undefined
  const capture = vi.spyOn(runtime as any, 'capture').mockImplementation((_args: unknown, options: any) => {
    signal = options.signal
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
  })
  runtime.startSignIn(); runtime.startSignIn()
  expect(capture).toHaveBeenCalledTimes(1)
  expect(capture.mock.calls[0][0]).toEqual(['auth', 'login'])
  expect(capture.mock.calls[0][1]).toMatchObject({ keepInputOpen: true, timeoutMs: 600000 })
  const generation = runtime.generation
  runtime.cancelSignIn()
  expect(signal?.aborted).toBe(true); expect(runtime.generation).toBeGreaterThan(generation)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect((runtime as any).login).toBeUndefined()
  expect((runtime as any).loginFailed).toBe(false)
})

it('reports login failure without exposing the original diagnostic and permits a new explicit attempt', async () => {
  const runtime = new ClaudeCodeRuntime({ runtimeDirectory: os.tmpdir(), profileDirectory: path.join(os.tmpdir(), 'hadron-login-failed-fixture') })
  vi.spyOn(runtime, 'binary').mockReturnValue('fixture-only')
  const capture = vi.spyOn(runtime as any, 'capture').mockRejectedValue(new Error('private diagnostic credential'))
  runtime.startSignIn()
  await new Promise(resolve => setTimeout(resolve, 0))
  vi.spyOn(runtime as any, 'probe').mockResolvedValue({ installed: true, version: '2.1.318', connected: false, reason: 'signed_out' })
  expect(await runtime.status()).toMatchObject({ loginState: 'failed', connected: false })
  expect(JSON.stringify(await runtime.status())).not.toContain('private diagnostic')
  runtime.startSignIn()
  expect(capture).toHaveBeenCalledTimes(2)
  await new Promise(resolve => setTimeout(resolve, 0))
})
it('keeps a separate config and drops inherited tokens, injection, routing and plugin overrides', () => {
  const profile = path.join(os.tmpdir(), 'hadron-env-fixture')
  const env = claudeRuntimeEnvironment(profile, { Path: 'system path', SystemRoot: 'windows', HOME: 'home',
    ANTHROPIC_API_KEY: 'must-not-inherit', CLAUDE_CODE_OAUTH_TOKEN: 'must-not-inherit', CLAUDE_CONFIG_DIR: 'other-app',
    CLAUDE_CODE_USE_BEDROCK: '1', NODE_OPTIONS: '--require injected', ELECTRON_RUN_AS_NODE: '1', CLAUDE_CODE_PLUGIN_DIRS: 'other-app-plugins' })
  expect(env.Path).toBe('system path'); expect(env.HOME).toBe('home')
  expect(env.CLAUDE_CONFIG_DIR).toBe(path.join(profile, 'claude-code'))
  expect(env.CLAUDE_CODE_MAX_RETRIES).toBe('0'); expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
  expect(JSON.stringify(env)).not.toMatch(/must-not-inherit|injected|other-app|BEDROCK|NODE_OPTIONS/)
  expect(() => claudeRuntimeEnvironment('relative')).toThrow('Absolute')
})

it('reuses the standard Claude Code account without changing HOME or copying credentials',()=>{
 const env=claudeRuntimeEnvironment(os.tmpdir(),{USERPROFILE:'fixture-home',ANTHROPIC_API_KEY:'private',CLAUDE_CODE_OAUTH_TOKEN:'private',NODE_OPTIONS:'injected'},'claude_code')
 expect(env.USERPROFILE).toBe('fixture-home');expect(env).not.toHaveProperty('CLAUDE_CONFIG_DIR')
 expect(JSON.stringify(env)).not.toMatch(/private|injected/)
 const custom=path.join(os.tmpdir(),'existing-cli-account')
 expect(claudeRuntimeEnvironment(os.tmpdir(),{CLAUDE_CONFIG_DIR:custom},'claude_code').CLAUDE_CONFIG_DIR).toBe(custom)
})
it('handles invalid local configuration without crashing startup or opening sign-in',async()=>{
 vi.stubEnv('CLAUDE_CONFIG_DIR','relative-account')
 try{
  const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:os.tmpdir()})
  vi.spyOn(runtime,'binary').mockReturnValue('official-fixture')
  const capture=vi.spyOn(runtime as any,'capture')
  expect(await runtime.status()).toMatchObject({connected:false,reason:'status_unavailable'})
  expect(capture).not.toHaveBeenCalled()
  expect(()=>runtime.startSignIn()).toThrow('absolute')
 }finally{vi.unstubAllEnvs()}
})

function accountFixture(local=true,legacy=false){
 const profile=path.join(os.tmpdir(),'hadron-cli-reuse-fixture'),runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:profile,platform:'win32',nativeHostDirectory:os.tmpdir()})
 const accounts={claude_code:local,hadron:legacy}
 vi.spyOn(runtime,'binary').mockReturnValue('official-fixture')
 const capture=vi.spyOn(runtime as any,'captureChild').mockImplementation(async(args:any,options:any)=>{
  if(args[0]==='--version')return {code:0,stdout:'2.1.318 (Claude Code)'}
  if(args[0]==='auth'&&args[1]==='status'){
   const source=options.accountSource as keyof typeof accounts
   return {code:accounts[source]?0:1,stdout:JSON.stringify({loggedIn:accounts[source],authMethod:accounts[source]?'claude.ai':'none',configDirectory:source==='hadron'?path.join(profile,'claude-code'):(process.env.CLAUDE_CONFIG_DIR??path.join(os.homedir(),'.claude'))})}
  }
  if(args.includes('--print'))return {code:0,stdout:frames()}
  if(args[0]==='auth'&&args[1]==='login'){accounts.claude_code=true;return {code:0,stdout:''}}
  throw Error('Unexpected fixture invocation')
 })
 return {runtime,capture,accounts}
}
it('automatically recognises an existing CLI login and uses it for print requests without another sign-in',async()=>{
 const f=accountFixture(true,true)
 expect(await f.runtime.models()).toHaveLength(3)
 expect(await f.runtime.status()).toMatchObject({connected:true,accountSource:'claude_code'})
 expect(await f.runtime.generate({modelName:'sonnet',requestPolicy:'single_attempt',history:[],userContent:'Respond.'})).toEqual({content:'Ready.'})
 const call=f.capture.mock.calls.find(([args]:any)=>args.includes('--print'))!
 expect(call[1]).toMatchObject({accountSource:'claude_code',input:'Respond.'})
 expect(f.capture.mock.calls.some(([args,options]:any)=>args[1]==='login'||options.accountSource==='hadron')).toBe(false)
})
it('preserves an existing Hadron sign-in as fallback and admits models on the first check',async()=>{
 const f=accountFixture(false,true)
 expect(await f.runtime.models()).toHaveLength(3)
 expect(await f.runtime.status()).toMatchObject({connected:true,accountSource:'hadron'})
 f.accounts.claude_code=true
 expect(await f.runtime.status()).toMatchObject({connected:true,accountSource:'hadron'})
 expect(await f.runtime.generate({modelName:'haiku',requestPolicy:'single_attempt',history:[],userContent:'Respond.'})).toEqual({content:'Ready.'})
 expect(f.capture.mock.calls.find(([args]:any)=>args.includes('--print'))![1]).toMatchObject({accountSource:'hadron'})
 expect(f.capture.mock.calls.some(([args]:any)=>args[1]==='login')).toBe(false)
})
it('does not open sign-in during checks when neither account is connected; explicit login uses the normal CLI account',async()=>{
 const f=accountFixture(false,false)
 expect(await f.runtime.models()).toEqual([])
 expect(await f.runtime.status()).toMatchObject({connected:false,accountSource:'claude_code'})
 expect(f.capture.mock.calls.some(([args]:any)=>args[1]==='login')).toBe(false)
 f.runtime.startSignIn()
 await vi.waitFor(async()=>expect(await f.runtime.status()).toMatchObject({connected:true,accountSource:'claude_code',loginState:'idle'}))
 expect(f.capture.mock.calls.find(([args]:any)=>args[1]==='login')![1]).toMatchObject({accountSource:'claude_code'})
})
it('deduplicates simultaneous account checks without inference',async()=>{
 const f=accountFixture()
 await Promise.all([f.runtime.status(),f.runtime.status(),f.runtime.status()])
 expect(f.capture.mock.calls.filter(([args]:any)=>args[1]==='status')).toHaveLength(1)
 expect(f.capture.mock.calls.some(([args]:any)=>args.includes('--print'))).toBe(false)
})
it('rejects unexpected credential locations without falling back or publishing account text',async()=>{
 const f=accountFixture()
 f.capture.mockResolvedValueOnce({code:0,stdout:'2.1.318 (Claude Code)'}).mockResolvedValueOnce({code:0,stdout:JSON.stringify({loggedIn:true,authMethod:'claude.ai',configDirectory:path.join(os.tmpdir(),'unexpected'),email:'private-account'})})
 const status=await f.runtime.status()
 expect(status).toMatchObject({connected:false,reason:'profile_mismatch'})
 expect(JSON.stringify(status)).not.toContain('private-account');expect(f.capture).toHaveBeenCalledTimes(2)
})
it('fences an account check invalidated while it was running',async()=>{
 const f=accountFixture();let complete!:(value:any)=>void
 f.capture.mockImplementationOnce(async()=>({code:0,stdout:'2.1.318 (Claude Code)'})).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve}))
 const pending=f.runtime.status()
 await vi.waitFor(()=>expect(complete).toBeTypeOf('function'))
 f.runtime.cancelSignIn()
 complete({code:0,stdout:JSON.stringify({loggedIn:true,authMethod:'claude.ai',configDirectory:process.env.CLAUDE_CONFIG_DIR??path.join(os.homedir(),'.claude')})})
 expect(await pending).toMatchObject({connected:false,reason:'status_unavailable'})
})
it('publishes only a completed one-turn text result and rejects tool-bearing/incomplete output',()=>{
 expect(claudeTextResult(frames())).toBe('Ready.')
 for(const raw of [frames({is_error:true}),frames({num_turns:2}),frames({permission_denials:[{tool_name:'Bash'}]}),frames().replace('"tools":[]','"tools":["Read"]'),frames().replace('"type":"text"','"type":"tool_use"'),frames().split('\n').slice(0,-1).join('\n')])expect(()=>claudeTextResult(raw)).toThrow()
})
it('requires admitted models and a tool-free request, fixes native isolation flags, and never retries failures',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-generation-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir()})
 vi.spyOn(runtime,'status').mockResolvedValue({installed:true,version:'2.1.318',connected:true,reason:'ready'})
 await runtime.models()
 let promptPath=''
 const capture=vi.spyOn(runtime as any,'capture').mockImplementation(async(args:any)=>{promptPath=args[args.indexOf('--system-prompt-file')+1];expect(readFileSync(promptPath,'utf8')).toBe('Trusted contract');return {code:0,stdout:frames()}})
 const input={modelName:'sonnet',requestPolicy:'single_attempt' as const,history:[],userContent:'Respond.',systemPrompt:'Trusted contract',tools:[]}
 expect(await runtime.generate(input)).toEqual({content:'Ready.'})
 expect((capture.mock.calls[0][1] as any).input).toBe('Respond.')
 const args=capture.mock.calls[0][0] as string[]
 for(const flag of ['--print','--safe-mode','--restricted','--strict-mcp-config','--no-chrome','--no-session-persistence'])expect(args).toContain(flag)
 expect(args).not.toContain('--bare')
 expect(args[args.indexOf('--tools')+1]).toBe('');expect(args[args.indexOf('--max-turns')+1]).toBe('1')
 expect(args).not.toContain('--system-prompt');expect(args).toContain('--system-prompt-file');expect(existsSync(promptPath)).toBe(false)
 await expect(runtime.generate({...input,modelName:'unknown'})).rejects.toThrow('not admitted')
 await expect(runtime.generate({...input,tools:[{name:'Read'}]})).rejects.toThrow('not admitted')
 capture.mockResolvedValue({code:1,stdout:'private diagnostic'})
 await expect(runtime.generate(input)).rejects.toThrow('no host retry')
 expect(existsSync(capture.mock.calls[1][0][args.indexOf('--system-prompt-file')+1])).toBe(false)
 expect(capture).toHaveBeenCalledTimes(2)
})
it('shutdown cancels and joins an in-flight capture before returning without logging out',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-generation-join-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir()})
 runtime.allowedModels.add('haiku');vi.spyOn(runtime,'status').mockResolvedValue({installed:true,version:'2.1.318',connected:true,reason:'ready'})
 let complete!:(value:any)=>void,signal!:AbortSignal
 vi.spyOn(runtime as any,'captureChild').mockImplementation((_args,options:any)=>{signal=options.signal;return new Promise(resolve=>{complete=resolve})})
 const job=runtime.generate({modelName:'haiku',requestPolicy:'single_attempt',history:[],userContent:'Reply.'}).catch(error=>error)
 await vi.waitFor(()=>expect(complete).toBeTypeOf('function'))
 let ended=false;const closing=runtime.shutdown().then(()=>{ended=true})
 expect(signal.aborted).toBe(true);expect(ended).toBe(false)
 complete({code:null,stdout:''});await closing;expect(ended).toBe(true);expect(await job).toBeInstanceOf(Error)
 await expect(runtime.generate({modelName:'haiku',requestPolicy:'single_attempt',history:[],userContent:'Reply.'})).rejects.toThrow('not admitted')
})
it('passes a coding-sized trusted prompt through a private file and removes it after completion',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-long-generation-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir()})
 vi.spyOn(runtime,'status').mockResolvedValue({installed:true,version:'2.1.318',connected:true,reason:'ready'});await runtime.models()
 const prompt='Long coding schema with "quotes". '.repeat(1200);let file=''
 const capture=vi.spyOn(runtime as any,'capture').mockImplementation(async(args:any)=>{file=args[args.indexOf('--system-prompt-file')+1];expect(args.join(' ').length).toBeLessThan(4000);expect(readFileSync(file,'utf8')).toBe(prompt);return {code:0,stdout:frames()}})
 await runtime.generate({modelName:'sonnet',requestPolicy:'single_attempt',history:[],systemPrompt:prompt,userContent:'Reply.',tools:[]})
 expect(capture).toHaveBeenCalledTimes(1);expect(existsSync(file)).toBe(false)
})
it('keeps admission during an unchanged model refresh, but clears it if the connection is lost',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-model-refresh-fixture')})
 runtime.allowedModels.add('haiku')
 let complete!:(value:any)=>void
 vi.spyOn(runtime,'status').mockImplementation(()=>new Promise(resolve=>{complete=resolve}))
 const pending=runtime.models();expect(runtime.allowedModels.has('haiku')).toBe(true)
 complete({installed:true,version:'2.1.318',connected:false,reason:'signed_out'})
 expect(await pending).toEqual([]);expect(runtime.allowedModels.size).toBe(0)
})

it('executes only trusted host tool requests through text turns; the CLI receives no tools',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-claude-broker-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir()})
 runtime.allowedModels.add('haiku')
 const generate=vi.spyOn(runtime as any,'generateText').mockResolvedValueOnce({content:JSON.stringify({tool:'web_read',arguments:{url:'https://example.com'}})}).mockResolvedValueOnce({content:JSON.stringify({answer:'Observed example title.'})})
 const invoke=vi.fn(async()=>({title:'Example Domain'})),session=admitHadronToolSession({instructions:'Use supplied public-web tools only.',invoke})
 const input={modelName:'haiku',requestPolicy:'single_attempt' as const,history:[],userContent:'Read title',hadronToolSession:session}
 expect(await runtime.generate(input)).toEqual({content:'Observed example title.'})
 expect(invoke).toHaveBeenCalledOnce();expect(generate).toHaveBeenCalledTimes(2)
 for(const [request] of generate.mock.calls as any){expect(request.hadronToolSession).toBeUndefined();expect(request.tools).toBeUndefined();expect(request.requestPolicy).toBe('single_attempt')}
 expect(generate.mock.calls.every(call=>(call as unknown[])[2]===true)).toBe(true)
 expect((generate.mock.calls[1][0] as any).userContent).toContain('Example Domain')
 await expect(runtime.generate({...input,hadronToolSession:{...session}})).rejects.toThrow('not admitted')
 await runtime.shutdown()
})

it('records provider quota from a reply, without issuing an extra inference request',async()=>{
 const runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-allowance-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir()})
 const status=vi.spyOn(runtime,'status').mockResolvedValue({installed:true,version:'2.1.318',connected:true,reason:'ready'});await runtime.models()
 const quota={type:'rate_limit_event',rate_limit_info:{status:'allowed',unifiedWindows:{five_hour:{utilization:0.25,resetsAt:1794433200}}}}
 const capture=vi.spyOn(runtime as any,'capture').mockResolvedValue({code:0,stdout:frames().replace('\n{"type":"result"','\n'+JSON.stringify(quota)+'\n{"type":"result"')})
 await runtime.generate({modelName:'sonnet',requestPolicy:'single_attempt',history:[],userContent:'Reply.'})
 expect((await runtime.usage())?.windows[0].remainingPercent).toBe(75);expect(capture).toHaveBeenCalledOnce()
 status.mockResolvedValue({installed:true,version:'2.1.318',connected:false,reason:'signed_out'});expect(await runtime.usage()).toBeNull()
})

it('allows a bounded formatter correction after two explicitly denied native tool attempts',()=>{
 const frames=structuredFrames().split('\n').map(line=>JSON.parse(line))
 for(const [id,name] of [['denied-a','project_list'],['denied-b','glob']])frames.splice(1,0,{type:'assistant',message:{content:[{type:'tool_use',id,name,input:{path:'example'}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:id,is_error:true,content:'Unavailable.'}]}})
 frames.at(-1).num_turns=4
 expect(JSON.parse(claudeStructuredResult(frames.map(frame=>JSON.stringify(frame)).join('\n'))).tool).toBe('create_file')
 frames.at(-1).num_turns=8
 expect(()=>claudeStructuredResult(frames.map(frame=>JSON.stringify(frame)).join('\n'))).toThrow('did not complete')
})
it('identifies a native formatting-turn failure and records only safe diagnostic metadata',async()=>{
 const diagnostic=vi.fn(),runtime=new ClaudeCodeRuntime({runtimeDirectory:os.tmpdir(),profileDirectory:path.join(os.tmpdir(),'hadron-format-error-fixture'),platform:'win32',nativeHostDirectory:os.tmpdir(),onJobDiagnostic:diagnostic})
 vi.spyOn(runtime,'status').mockResolvedValue({installed:true,version:'2.1.318',connected:true,reason:'ready'});await runtime.models()
 vi.spyOn(runtime as any,'capture').mockResolvedValue({code:1,stdout:JSON.stringify({type:'result',subtype:'error_max_turns',is_error:true,num_turns:7,errors:['Reached maximum number of turns (6)','private detail']})})
 await expect((runtime as any).generateText({modelName:'sonnet',requestPolicy:'single_attempt',history:[],userContent:'Test'},undefined,true)).rejects.toThrow('response-formatting turns')
 expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({category:'format_turn_limit',exitCode:1,resultSubtype:'error_max_turns',turns:7}))
 expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private detail')
})

it('accepts a coding operation larger than the old 12 KB cap while enforcing the new bound',()=>{
 const raw=structuredFrames().split('\n').map(line=>JSON.parse(line)),value={tool:'create_file',arguments:{path:'fixture.py',content:'# Code comment\n'.repeat(3000)}}
 raw[1].message.content[0].input=value;raw.at(-1).structured_output=value
 expect(JSON.parse(claudeStructuredResult(raw.map(line=>JSON.stringify(line)).join('\n'))).arguments.content).toBe(value.arguments.content)
 value.arguments.content='x'.repeat(131072)
 expect(()=>claudeStructuredResult(raw.map(line=>JSON.stringify(line)).join('\n'))).toThrow('exceeded limit')
})
