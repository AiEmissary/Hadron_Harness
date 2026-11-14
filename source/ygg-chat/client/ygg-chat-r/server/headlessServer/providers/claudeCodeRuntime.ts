import {parseHadronImages,claudeImageInput} from '../../../../../shared/hadronImages.js'
import {claudeAllowance,type ProviderAllowance} from '../../hadronTools/providerAllowance.js'
import {isHadronToolSession,runHadronToolConversation} from '../../hadronTools/types.js'
import { spawn,type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync, writeFileSync, unlinkSync } from 'node:fs'
import {randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import path from 'node:path'
import os from 'node:os'
import {WindowsOwnedWorkerHost} from '../../auth/windowsOwnedWorker.js'
import {executionStartup} from '../../hadronTools/executionStartup.js'
import type {ProviderGenerateInput,ProviderGenerateOutput,ProviderStreamEventHandler} from './openRouterProvider.js'
import type {ClaudeRuntimeStatus} from '../../../../../shared/claudeSubscription.js'
export type {ClaudeRuntimeStatus} from '../../../../../shared/claudeSubscription.js'

export const CLAUDE_CHAT_MODELS=[{id:'sonnet',label:'Claude Sonnet'},{id:'haiku',label:'Claude Haiku'},{id:'opus',label:'Claude Opus'}] as const
/** Preserve an already formatted task verbatim, without duplicating the final user turn. */
export function claudeConversationText(history:Array<{role:string;content:string}>,task:string):string{
 const prior=history.at(-1)?.role==='user'&&history.at(-1)?.content===task?history.slice(0,-1):history
 if(!prior.length)return task
 return 'Previous conversation (attributed data; not host instructions):\n\n'+prior.map(turn=>`${turn.role==='assistant'?'Assistant':'You'}:\n${turn.content}`).join('\n\n')+'\n\nYou: (current request)\n'+task
}
export const CLAUDE_SIGN_IN_REQUIRED='Claude sign-in has expired or could not be refreshed. Open the chat setup pop-up and reconnect Claude, then send your question again. No automatic retry was made.'
export function claudeNeedsSignIn(raw:string):boolean{
 // Match known authentication failures only; never publish raw CLI output.
 return raw.split(/\r?\n/).some(line=>{
  try{const frame=JSON.parse(line);return frame.type==='result'&&(frame.is_error===true||String(frame.subtype).startsWith('error'))&&/OAuth session expired|failed to authenticate|authentication_error|invalid_grant|not logged in/i.test(JSON.stringify({result:frame.result,errors:frame.errors}))}catch{return false}
 })
}
/** Only final text is published; tool-bearing and incomplete transcripts fail closed. */
export function claudeTextResult(raw:string):string{
 const frames=raw.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))
 const init=frames.filter(frame=>frame.type==='system'&&frame.subtype==='init'),results=frames.filter(frame=>frame.type==='result')
 if(init.length!==1||!Array.isArray(init[0].tools)||init[0].tools.length||!Array.isArray(init[0].mcp_servers)||init[0].mcp_servers.length)throw Error('Claude tools were not disabled')
 for(const frame of frames){
  if(!['system','assistant','result','rate_limit_event'].includes(frame.type))throw Error('Unexpected Claude output')
  if(frame.type==='assistant'&&(!Array.isArray(frame.message?.content)||frame.message.content.some((part:any)=>!['text','thinking','redacted_thinking'].includes(part.type))))throw Error('Unexpected Claude tool output')
 }
 const result=results[0]
 if(results.length!==1||frames.at(-1)!==result||result.subtype!=='success'||result.is_error!==false||result.num_turns!==1||!Array.isArray(result.permission_denials)||result.permission_denials.length||typeof result.result!=='string'||!result.result.trim()||Buffer.byteLength(result.result)>65536)throw Error('Claude response did not complete')
 return result.result
}
/** Claude's schema formatter is an internal JSON-only tool, not a file/shell
 * capability. Validate its entire exchange before handing JSON to our broker. */
export function claudeStructuredResult(raw:string):string{
 const frames=raw.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))
 const init=frames.filter(frame=>frame.type==='system'&&frame.subtype==='init'),results=frames.filter(frame=>frame.type==='result')
 if(init.length!==1||JSON.stringify(init[0].tools)!=='["StructuredOutput"]'||!Array.isArray(init[0].mcp_servers)||init[0].mcp_servers.length)throw Error('Claude formatter capability changed')
 const calls=new Map<string,unknown>(),acknowledgements=new Map<string,boolean>(),unavailable=new Map<string,boolean>()
 for(const frame of frames){
  if(!['system','assistant','user','result','rate_limit_event'].includes(frame.type)||frame.subtype==='permission_denied')throw Error('Unexpected Claude formatting output')
  if(frame.type==='assistant')for(const part of frame.message?.content??[]){
   if(part.type==='tool_use'){
    if(typeof part.id!=='string'||typeof part.name!=='string'||calls.has(part.id)||unavailable.has(part.id))throw Error('Unexpected Claude tool output')
    if(part.name!=='StructuredOutput'){
     // No native tools were offered. The CLI may reject a hallucinated native
     // call before correcting to the formatter. Accept only explicit errors;
     // never treat its arguments as an operation or its output as evidence.
     if(unavailable.size>=4)throw Error('Too many unavailable Claude tool calls')
     unavailable.set(part.id,false);continue
    }
    if(calls.size>=2||!part.input||typeof part.input!=='object'||Array.isArray(part.input))throw Error('Unexpected Claude tool output')
    calls.set(part.id,part.input)
   }else if(!['text','thinking','redacted_thinking'].includes(part.type))throw Error('Unexpected Claude content')
  }
  if(frame.type==='user'){
   if(!Array.isArray(frame.message?.content)||!frame.message.content.length)throw Error('Unexpected Claude tool result')
   for(const part of frame.message.content){
    if(part.type==='text'&&part.text==='[structured-output-enforce] You MUST call the StructuredOutput tool to complete this request. Call this tool now.')continue
    if(part.type!=='tool_result')throw Error('Unexpected Claude tool result')
    if(unavailable.has(part.tool_use_id)){if(part.is_error!==true||unavailable.get(part.tool_use_id))throw Error('Unconfirmed native Claude tool denial');unavailable.set(part.tool_use_id,true);continue}
    if(!calls.has(part.tool_use_id)||acknowledgements.has(part.tool_use_id))throw Error('Unexpected Claude tool result');acknowledgements.set(part.tool_use_id,part.is_error!==true)
   }
  }
 }
 const result=results[0],output=result?.structured_output
 if(results.length!==1||frames.at(-1)!==result||result.subtype!=='success'||result.is_error!==false||(!Number.isSafeInteger(result.num_turns)||result.num_turns<2||result.num_turns>7||result.num_turns>calls.size+unavailable.size+2)||!Array.isArray(result.permission_denials)||result.permission_denials.length||[...unavailable.values()].some(denied=>!denied)||!calls.size||acknowledgements.size!==calls.size||acknowledgements.get([...calls.keys()].at(-1)!)!==true||!output||typeof output!=='object'||Array.isArray(output)||!isDeepStrictEqual(output,[...calls.values()].at(-1)))throw Error('Claude formatted response did not complete')
 // The CLI schema may fill optional protocol fields with empty placeholders.
 // Remove only those empty placeholders; conflicting nonempty actions stay
 // intact and are rejected by the host's existing exact-shape validation.
 const protocol={...output}
 if(protocol.answer==='')delete protocol.answer
 if(protocol.tool==='')delete protocol.tool
 if(!('tool' in protocol)&&protocol.arguments&&typeof protocol.arguments==='object'&&!Array.isArray(protocol.arguments)&&!Object.keys(protocol.arguments).length)delete protocol.arguments
 const text=JSON.stringify(protocol);if(Buffer.byteLength(text)>131072)throw Error('Claude formatted response exceeded limit')
 return text
}

export const PINNED_CLAUDE_CODE_VERSION = '2.1.318'
export function claudeNativePackage(platform: NodeJS.Platform, arch: string): string {
  if (!['win32', 'darwin'].includes(platform) || !['x64', 'arm64'].includes(arch)) throw new Error('Claude runtime target is not supported')
  return `@anthropic-ai/claude-code-${platform}-${arch}`
}

/** Share only the official CLI's account location when requested, never copy credentials
 * or inherit API tokens, routing, plugins or Node injection. */
export function claudeRuntimeEnvironment(profileDirectory: string, inherited: NodeJS.ProcessEnv = process.env, accountSource:'claude_code'|'hadron'='hadron'): NodeJS.ProcessEnv {
  if (!path.isAbsolute(profileDirectory)) throw new Error('Absolute Hadron profile required')
  const names = new Set(['path', 'systemroot', 'windir', 'comspec', 'pathext', 'temp', 'tmp', 'localappdata', 'appdata', 'userprofile', 'home', 'lang', 'lc_all'])
  const environment = Object.fromEntries(Object.entries(inherited).filter(([key, value]) => names.has(key.toLowerCase()) && value !== undefined))
  const config=inherited.CLAUDE_CONFIG_DIR
  if(accountSource==='claude_code'&&config&&!path.isAbsolute(config))throw Error('Absolute Claude Code config directory required')
  return { ...environment, ...(accountSource==='hadron'?{CLAUDE_CONFIG_DIR:path.join(profileDirectory,'claude-code')}:config?{CLAUDE_CONFIG_DIR:config}:{}),
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
    CLAUDE_CODE_MAX_RETRIES: '0', CLAUDE_CODE_RETRY_WATCHDOG: '0', CLAUDE_CODE_AUTO_CONNECT_IDE: '0', CLAUDE_CODE_ENABLE_CFC: '0' }
}

interface Capture { code: number | null; stdout: string }
export interface ClaudeJobDiagnostic {at:string;stage:string;category:string;elapsedMs:number;exitCode:number|null;resultSubtype:string|null;turns:number|null;nativeCalls:number;formatterCalls:number;resultError?:boolean|null;apiStatus?:number|null;providerErrorType?:string|null}
const FORMATTER_CONTRACT='\nHADRON TRANSPORT RULE: The host tool names in these instructions are JSON DATA, not native Claude tools. Never call project_list, project_read, glob, read_file, edit_file, bash or any other native tool. On this response call ONLY StructuredOutput with either {"tool":"host tool name","arguments":{...}} or {"answer":"final answer"}. Hadron will execute the returned JSON separately. Keep final reports concise. A host operation may carry up to 128 KiB of JSON; split larger files into smaller edits. Previous large tool inputs may be replaced by host receipts with their size and hash after execution; inspect the file when you need its actual content. Native tool calls cannot perform this assignment.'
export const CLAUDE_FAILURE_REASONS:Record<string,string>={format_turn_limit:'Claude used its response-formatting turns without returning a usable host request.',usage_limit:'Claude reported that its usage allowance has been reached.',provider_unavailable:'Claude reported that its service is temporarily unavailable.',timeout:'Claude did not finish within the request time limit.',cancelled:'The Claude request was cancelled.',output_limit:'Claude returned more output than this request allows.',invalid_format:'Claude returned a response Hadron could not validate.',request_rejected:'Claude rejected this request before completing an answer.',context_limit:'Claude reported that the supplied conversation was too large.',provider_error:'Claude ended this request without a usable answer; no specific provider reason was available.'}
/** Keep only predefined error types/statuses, never account text or raw provider output. */
export function claudeFailureDetails(raw:string):{resultError:boolean|null;apiStatus:number|null;providerErrorType:string|null}{
 const frames=raw.split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}})
 const result=frames.filter(frame=>frame.type==='result').at(-1)
 const failure=result&&(result.is_error===true||String(result.subtype).startsWith('error'))?JSON.stringify({result:result.result,errors:result.errors}):''
 const status=/(?:API Error:|HTTP(?: status)?|status(?:_code)?[\\"\s:]+)\s*(400|401|403|404|408|413|429|500|502|503|504)\b/i.exec(failure)?.[1]
 return {resultError:typeof result?.is_error==='boolean'?result.is_error:null,apiStatus:status?Number(status):null,
  providerErrorType:['invalid_request_error','authentication_error','permission_error','rate_limit_error','overloaded_error','api_error','not_found_error','billing_error','timeout_error'].find(type=>failure.includes(type))??null}
}
export function claudeFailureCategory(raw:string,reason:string):string{
 if(claudeNeedsSignIn(raw))return 'authentication'
 const frames=raw.split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}})
 const result=frames.find(frame=>frame.type==='result'&&(frame.is_error===true||String(frame.subtype).startsWith('error')))
 const failure=result?JSON.stringify({subtype:result.subtype,errors:result.errors,result:result.result}):''
 if(result?.subtype==='error_max_turns')return 'format_turn_limit'
 if(/rate_limit_error|usage limit|out of extra usage|hit your limit/i.test(failure))return 'usage_limit'
 if(/overloaded_error|overloaded|temporarily unavailable/i.test(failure))return 'provider_unavailable'
 const details=claudeFailureDetails(raw)
 if(details.apiStatus===401||details.providerErrorType==='authentication_error')return 'authentication'
 if(/prompt is too long|context length|context window|too many tokens/i.test(failure))return 'context_limit'
 if(details.apiStatus===429)return 'usage_limit'
 if(details.apiStatus&&details.apiStatus>=500)return 'provider_unavailable'
 if(details.apiStatus===408)return 'timeout'
 if(details.apiStatus||['invalid_request_error','permission_error','not_found_error','billing_error'].includes(details.providerErrorType??''))return 'request_rejected'
 if(/timed out/i.test(reason))return 'timeout'
 if(/cancelled/i.test(reason))return 'cancelled'
 if(/exceeded limit/i.test(reason))return 'output_limit'
 if(/formatted|formatting|Unexpected Claude|native Claude tool/.test(reason))return 'invalid_format'
 return 'provider_error'
}


type ClaudeAccountSource='claude_code'|'hadron'
/** Official CLI owns its account storage. Prefer its existing login; retain older
 * Hadron accounts as a compatibility fallback. Never read/copy credential files. */
export class ClaudeCodeRuntime {
  private lastAllowance:ProviderAllowance|null=null
  async usage(){return (await this.status()).connected?this.lastAllowance:null}

  private readonly environments:Record<ClaudeAccountSource,NodeJS.ProcessEnv>
  private accountSource:ClaudeAccountSource='claude_code'
  private accountResolved=false
  private localConfigurationValid=true
  private statusPending?:Promise<ClaudeRuntimeStatus>
  readonly workingDirectory: string
  private login?: AbortController
  private loginFailed = false
  private generationNeedsSignIn=false
  private epoch = 0
  readonly allowedModels=new Set<string>()
  private nativeHost?:WindowsOwnedWorkerHost
  private closing=false
  private readonly toolJobs=new Map<Promise<void>,AbortController>()
  private readonly captures=new Map<Promise<Capture>,AbortController>()
  get generation(): number { return this.epoch }
  constructor(private readonly options: { runtimeDirectory: string; profileDirectory: string; platform?: NodeJS.Platform; arch?: string;nativeHostDirectory?:string;reuseExistingLogin?:boolean;onJobDiagnostic?(value:ClaudeJobDiagnostic):void }) {
    const hadron=claudeRuntimeEnvironment(options.profileDirectory)
    let local=hadron
    try{local=claudeRuntimeEnvironment(options.profileDirectory,process.env,'claude_code')}catch{this.localConfigurationValid=false}
    this.environments={claude_code:local,hadron}
    if(options.reuseExistingLogin===false){this.accountSource='hadron';this.accountResolved=true}
    this.workingDirectory = path.join(options.profileDirectory, 'claude-runtime-work')
  }
  binary(): string {
    const platform = this.options.platform ?? process.platform, arch = this.options.arch ?? process.arch
    const root = realpathSync(this.options.runtimeDirectory)
    const packageName = claudeNativePackage(platform, arch)
    const directory = path.join(root, 'node_modules', packageName)
    const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
    if (manifest.name !== packageName || manifest.version !== PINNED_CLAUDE_CODE_VERSION) throw new Error('Unsupported Claude runtime version')
    const binary = realpathSync(path.join(directory, platform === 'win32' ? 'claude.exe' : 'claude'))
    const relative = path.relative(root, binary)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Claude binary must belong to Hadron vendor directory')
    return binary
  }
  private async capture(args: string[], options: { timeoutMs: number; signal?: AbortSignal; input?: string; keepInputOpen?: boolean;maxOutputBytes?:number;accountSource?:ClaudeAccountSource } ): Promise<Capture> {
    if(this.closing)throw Error('Claude runtime is closing')
    const controller=new AbortController(),signal=options.signal?AbortSignal.any([controller.signal,options.signal]):controller.signal
    const pending=this.captureChild(args,{...options,signal,accountSource:options.accountSource??this.accountSource});this.captures.set(pending,controller)
    try{return await pending}finally{this.captures.delete(pending)}
  }
  private runChild<T>(binary:string,args:string[],environment:NodeJS.ProcessEnv,signal:AbortSignal|undefined,consume:(child:ChildProcessWithoutNullStreams)=>Promise<T>):Promise<T>{
    if(process.platform==='win32'&&this.options.nativeHostDirectory){
      this.nativeHost??=new WindowsOwnedWorkerHost(this.options.nativeHostDirectory,this.options.profileDirectory,executionStartup.workerEpochId())
      return this.nativeHost.run({executable:binary,args,cwd:this.workingDirectory,env:environment,signal,consume})
    }
    return consume(spawn(binary,args,{cwd:this.workingDirectory,env:environment,shell:false,windowsHide:true,stdio:'pipe'}))
  }
  private async captureChild(args:string[],options:{timeoutMs:number;signal?:AbortSignal;input?:string;keepInputOpen?:boolean;maxOutputBytes?:number;accountSource?:ClaudeAccountSource}):Promise<Capture>{
    options.signal?.throwIfAborted()
    const binary = this.binary()
    const source=options.accountSource??this.accountSource,environment=this.environments[source]
    if(source==='hadron')mkdirSync(environment.CLAUDE_CONFIG_DIR!, { recursive: true })
    mkdirSync(this.workingDirectory, { recursive: true })
    return this.runChild(binary,args,environment,options.signal,child=>new Promise<Capture>((resolve, reject) => {
      const chunks: Buffer[] = []; let bytes = 0, failure: Error | undefined, force: ReturnType<typeof setTimeout> | undefined
      const stop = (error: Error) => {
        failure ??= error
        child.kill('SIGTERM')
        force ??= setTimeout(() => child.kill('SIGKILL'), 1500)
      }
      const abort = () => stop(new Error('Claude process cancelled'))
      const timeout = setTimeout(() => stop(new Error('Claude process timed out')), options.timeoutMs)
      options.signal?.addEventListener('abort', abort, { once: true })
      const clean = () => { clearTimeout(timeout); if (force) clearTimeout(force); options.signal?.removeEventListener('abort', abort) }
      child.stdout.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > (options.maxOutputBytes??262144)) stop(new Error('Claude administrative response exceeded limit'))
        else chunks.push(chunk)
      })
      // Never forward raw stderr: CLI diagnostics can contain account/connection details.
      child.stderr.on('data', () => {})
      child.stdin.on('error', () => {})
      child.on('error', () => { clean(); reject(new Error('Claude runtime could not be launched')) })
      child.on('close', code => { clean(); failure ? reject(failure) : resolve({ code, stdout: Buffer.concat(chunks).toString('utf8') }) })
      if (options.signal?.aborted) abort()
      if (!options.keepInputOpen) child.stdin.end(options.input)
    }))
  }
  async models(){const epoch=this.epoch;if(!(await this.status()).connected||epoch!==this.epoch||this.closing||this.login){this.allowedModels.clear();return []}this.allowedModels.clear();for(const model of CLAUDE_CHAT_MODELS)this.allowedModels.add(model.id);return [...CLAUDE_CHAT_MODELS]}
  async generate(input:ProviderGenerateInput,emit?:ProviderStreamEventHandler):Promise<ProviderGenerateOutput>{
    if(!input.hadronToolSession)return this.generateText(input,emit)
    if(!isHadronToolSession(input.hadronToolSession)||input.requestPolicy!=='single_attempt'||input.tools?.length||!this.allowedModels.has(input.modelName)||this.closing||this.login||this.toolJobs.size>=2)throw Error('Claude tool capability was not admitted')
    const controller=new AbortController(),epoch=this.epoch
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(300000),...(input.signal?[input.signal]:[])])
    let finish!:()=>void;const done=new Promise<void>(resolve=>{finish=resolve});this.toolJobs.set(done,controller)
    try{
      const content=await runHadronToolConversation({session:input.hadronToolSession,task:input.userContent,signal,contextLength:input.contextLength,
        generate:async(packet,instructions)=>{signal.throwIfAborted();if(epoch!==this.epoch)throw Error('Claude account changed');return (await this.generateText({...input,hadronToolSession:undefined,signal,systemPrompt:`${input.systemPrompt??''}\n${instructions}`,history:[{role:'user',content:packet}],userContent:packet},()=>emit?.({type:'chunk',part:'reasoning',delta:''}),true)).content}})
      signal.throwIfAborted();if(epoch!==this.epoch)throw Error('Claude account changed')
      emit?.({type:'chunk',part:'text',delta:content});return {content}
    }finally{controller.abort();this.toolJobs.delete(done);finish()}
  }
  private async generateText(input:ProviderGenerateInput,emit?:ProviderStreamEventHandler,structured=false):Promise<ProviderGenerateOutput>{
    if((this.options.platform??process.platform)!=='win32'||!this.options.nativeHostDirectory)throw Error('Contained Claude generation is available on Windows only')
    if(this.closing||this.login||input.requestPolicy!=='single_attempt'||input.tools?.length||input.hadronToolSession||!this.allowedModels.has(input.modelName))throw Error('Claude text job is not admitted')
    const epoch=this.epoch
    if(!(await this.status()).connected||epoch!==this.epoch)throw Error('Claude subscription is not connected')
    if(!Array.isArray(input.history)||input.history.some(item=>!['user','assistant'].includes(item?.role)||typeof item.content!=='string'))throw Error('Unsupported Claude context')
    const images=parseHadronImages(input.images)
    const content=claudeConversationText(input.history,input.userContent)
    if(Buffer.byteLength(content)+Buffer.byteLength(input.systemPrompt??'')>131072)throw Error('Claude job context exceeded limit')
    // Safe mode preserves official subscription auth; --bare explicitly disables OAuth.
    // Coding schemas exceed Windows' command-line limit after quoting. Keep
    // trusted instructions separate from task data without putting them on argv.
    mkdirSync(this.workingDirectory,{recursive:true})
    const promptFile=path.join(this.workingDirectory,`system-prompt-${randomUUID()}.txt`)
    writeFileSync(promptFile,(input.systemPrompt??'Respond only to the supplied task. You have no tools.')+(structured?FORMATTER_CONTRACT:''),{flag:'wx',mode:0o600})
    const args=[...(images.length?['--input-format','stream-json']:[]),'--safe-mode','--restricted','--disable-slash-commands','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--tools','',...(structured?['--allowedTools','StructuredOutput']:['--disallowedTools','*']),'--no-chrome','--no-session-persistence','--setting-sources','','--permission-mode','dontAsk','--max-turns',structured?'6':'1','--output-format','stream-json','--verbose','--model',input.modelName,'--system-prompt-file',promptFile,...(structured?['--json-schema',JSON.stringify({type:'object',properties:{tool:{type:'string'},arguments:{type:'object',additionalProperties:true},answer:{type:'string'}},additionalProperties:true})]:[]),'--print']
    let raw='',exitCode:number|null=null,stage='process';const started=Date.now()
    try{
      const result=await this.capture(args,{timeoutMs:120000,signal:input.signal,input:images.length?claudeImageInput(content,images):content,maxOutputBytes:2097152})
      raw=result.stdout;exitCode=result.code
      if(epoch===this.epoch)this.lastAllowance=claudeAllowance(result.stdout)??this.lastAllowance
      input.signal?.throwIfAborted()
      if(claudeNeedsSignIn(result.stdout)){
        this.generationNeedsSignIn=true;this.allowedModels.clear();throw Error(CLAUDE_SIGN_IN_REQUIRED)
      }
      if(result.code!==0||epoch!==this.epoch||this.closing)throw Error('Claude job stopped')
      stage='format'
      const text=structured?claudeStructuredResult(result.stdout):claudeTextResult(result.stdout);emit?.({type:'chunk',part:'text',delta:text});return {content:text}
    }catch(error){
      const reason=error instanceof Error?error.message:'',category=claudeFailureCategory(raw,reason)
      const frames=raw.split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}}),result=frames.find(frame=>frame.type==='result')
      const calls=frames.flatMap(frame=>frame.type==='assistant'&&Array.isArray(frame.message?.content)?frame.message.content.filter((part:any)=>part.type==='tool_use'):[])
      try{this.options.onJobDiagnostic?.({at:new Date().toISOString(),stage,category,elapsedMs:Date.now()-started,exitCode,...claudeFailureDetails(raw),resultSubtype:['success','error_max_turns','error_during_execution','error_max_structured_output_retries'].includes(result?.subtype)?result.subtype:null,turns:Number.isSafeInteger(result?.num_turns)?result.num_turns:null,nativeCalls:calls.filter(call=>call.name!=='StructuredOutput').length,formatterCalls:calls.filter(call=>call.name==='StructuredOutput').length})}catch{}

      throw Error(category==='authentication'?CLAUDE_SIGN_IN_REQUIRED:(CLAUDE_FAILURE_REASONS[category]??'Claude could not complete this provider request.')+' Completed conversation replies remain saved; no host retry was made.')
    }
    finally{unlinkSync(promptFile)}
  }
  async shutdown(){this.closing=true;this.cancelSignIn();for(const controller of [...this.captures.values(),...this.toolJobs.values()])controller.abort();await Promise.allSettled([...this.captures.keys(),...this.toolJobs.keys()])}
  cancelJobs(){this.lastAllowance=null;for(const controller of [...this.captures.values(),...this.toolJobs.values()])controller.abort();this.allowedModels.clear()}
  /** User-triggered only: the official process owns browser login and credential storage. */
  startSignIn(): void {
    this.lastAllowance=null
    if(this.closing)throw Error('Claude runtime is closing')
    if(this.options.reuseExistingLogin!==false&&!this.localConfigurationValid)throw Error('Claude Code requires an absolute CLAUDE_CONFIG_DIR')
    if (this.login) return
    this.cancelJobs()
    this.binary()
    // Sign in to the normal CLI account when no reusable sign-in is available.
    if(this.options.reuseExistingLogin!==false)this.accountSource='claude_code'
    this.accountResolved=true
    const controller = new AbortController(); this.login = controller; this.loginFailed = false; this.generationNeedsSignIn=false; this.epoch++;this.allowedModels.clear()
    void this.capture(['auth', 'login'], { timeoutMs: 600000, signal: controller.signal, keepInputOpen: true })
      .then(result => { if (result.code !== 0 && !controller.signal.aborted) this.loginFailed = true })
      .catch(() => { if (!controller.signal.aborted) this.loginFailed = true })
      .finally(() => { if (this.login === controller) { this.login = undefined; this.epoch++ } })
  }
  cancelSignIn(): void { this.login?.abort(); this.loginFailed = false; this.epoch++ }
  async status(): Promise<ClaudeRuntimeStatus> {
    const status = await (this.statusPending??=this.probe().finally(()=>{this.statusPending=undefined}))
    return { ...status, accountSource:this.accountSource, loginState: this.login ? 'running' : this.loginFailed ? 'failed' : 'idle' }
  }
  private async probe(): Promise<ClaudeRuntimeStatus> {
    try { this.binary() } catch (error) {
      return { installed: false, version: null, connected: false, reason: (error as Error).message.includes('version') ? 'unsupported_version' : 'not_installed' }
    }
    let version: string | null = null
    const epoch=this.epoch
    if(this.accountSource==='claude_code'&&!this.localConfigurationValid)return {installed:true,version:null,connected:false,reason:'status_unavailable'}
    try {
      const versionResult = await this.capture(['--version'], { timeoutMs: 15000 })
      version = versionResult.stdout.trim().match(/^(\d+\.\d+\.\d+)\b/)?.[1] ?? null
      if (versionResult.code !== 0 || version !== PINNED_CLAUDE_CODE_VERSION) return { installed: true, version, connected: false, reason: 'unsupported_version' }
      const check=async(source:ClaudeAccountSource):Promise<ClaudeRuntimeStatus>=>{
        const auth=await this.capture(['auth','status'],{timeoutMs:15000,accountSource:source}),state=JSON.parse(auth.stdout)
        const expected=path.resolve(this.environments[source].CLAUDE_CONFIG_DIR??path.join(os.homedir(),'.claude'))
        if(typeof state.configDirectory!=='string'||path.resolve(state.configDirectory)!==expected)return {installed:true,version,connected:false,reason:'profile_mismatch'}
        if(auth.code!==0||state.loggedIn!==true)return {installed:true,version,connected:false,reason:'signed_out'}
        return {installed:true,version,connected:state.authMethod==='claude.ai',reason:state.authMethod==='claude.ai'?'ready':'different_auth_method'}
      }
      let selected=this.accountSource,result=await check(selected)
      if(!this.accountResolved&&selected==='claude_code'&&['signed_out','different_auth_method'].includes(result.reason)){
        const legacy=await check('hadron')
        if(legacy.connected){selected='hadron';result=legacy}
      }
      if(epoch!==this.epoch||this.closing)return {installed:true,version,connected:false,reason:'status_unavailable'}
      if(result.connected){
        if(selected!==this.accountSource){this.accountSource=selected;this.allowedModels.clear()}
        this.accountResolved=true
      }
      if(this.generationNeedsSignIn)return {installed:true,version,connected:false,reason:'signed_out'}
      return result
    } catch { return { installed: true, version, connected: false, reason: 'status_unavailable' } }
  }
}
