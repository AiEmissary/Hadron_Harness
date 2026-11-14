import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'

export type LegacyExecutionKind='tool_job'|'custom_module'|'widget_write'|'widget_directory'|'widget_shell'|'terminal'|
  'shell'|'utility_process'|'utility_request'|'mcp'|'lsp'|'git'|'skill_install'|'legacy_chat'|'delegation'|'repl'|'undo'
const kinds:ReadonlySet<string>=new Set<LegacyExecutionKind>(['tool_job','custom_module','widget_write','widget_directory','widget_shell','terminal',
  'shell','utility_process','utility_request','mcp','lsp','git','skill_install','legacy_chat','delegation','repl','undo'])
export interface ExecutionRecord {version:1;id:string;kind:'project'|'legacy';source:LegacyExecutionKind|'project_coordinator'}
export interface ExecutionLedger {
  read():ExecutionRecord|null
  /** Atomic exclusive create; never overwrite another process's record. */
  claim(record:ExecutionRecord):void
  release(id:string):void
}
export interface ProjectExecutionScope {readonly id:string}

/** Host-wide cooperative exclusion, not an OS sandbox. A legacy start remains
 * unresolved even after its promise settles: JavaScript/children can outlive it.
 * No age/PID-based reset or model-callable force-unlock exists. */
export class ProjectExecutionGate {
  private ledger:ExecutionLedger|undefined
  private legacy:LegacyExecutionKind|undefined
  private unavailable=false
  private projectOnly=false
  private active:{scope:ProjectExecutionScope;owner:string;workspace:string;uncertain:boolean}|undefined
  /** Bootstrap storage failure permits inspection only, never an unfenced host. */
  blockHost():void{this.unavailable=true}
  /** Host external-application handoff. Generic renderer links never receive
   * the dedicated provider-login exception. This observes, but does not clear
   * or create, execution records and does not contain existing external apps. */
  assertExternalLaunchAllowed(providerLogin=false):void{
    if(this.unavailable||this.active)throw Error('External applications are unavailable while project work is held or requires recovery')
    if(this.projectOnly&&!providerLogin)throw Error('External applications are disabled in this project-only session; use a standard Hadron session to open links or files')
    if(this.ledger&&this.read()?.kind==='project')throw Error('External applications are unavailable until the saved project execution is resolved')
  }
  configure(ledger:ExecutionLedger,options:{projectOnly?:boolean}={}):void{
    if(this.ledger||this.active)throw Error('Execution ledger is already configured')
    if(options.projectOnly&&this.legacy){
      this.ledger=ledger
      // Persist a late-bootstrap observation before refusing the mode. Otherwise
      // a second host could mistake the empty ledger for a clean process epoch.
      try{this.legacyStart(this.legacy)}finally{this.projectOnly=true;this.unavailable=true}
      throw Error('Project-only startup requires a fresh host')
    }
    this.projectOnly=options.projectOnly===true
    this.ledger=ledger
    // Starts observed during bootstrap must survive later configuration/restart.
    if(this.legacy)this.legacyStart(this.legacy)
    else this.read()
  }
  private read():ExecutionRecord|null{
    if(!this.ledger)throw Error('Project execution ledger is not configured')
    try{return this.ledger.read()}catch(error){this.unavailable=true;throw error}
  }
  legacyStart(kind:LegacyExecutionKind):void{
    if(!kinds.has(kind))throw Error('Unknown legacy execution boundary')
    if(this.unavailable)throw Error('Execution ledger requires intervention')
    if(this.projectOnly)throw Error('Legacy execution is disabled in this project-only session; reopen a standard session to use these tools')
    if(this.active)throw Error('Legacy execution is disabled while a project execution scope is held')
    if(!this.ledger){this.legacy??=kind;return}
    const prior=this.read()
    if(prior?.kind==='project')throw Error('A project execution record requires intervention before legacy execution')
    if(!prior){
      try{this.ledger.claim({version:1,id:randomUUID(),kind:'legacy',source:kind})}
      catch(error){
        // A racing host may have claimed the file after our read. Only an
        // existing valid legacy marker permits legacy activity to continue.
        if((error as NodeJS.ErrnoException).code!=='EEXIST'||this.read()?.kind!=='legacy'){this.unavailable=true;throw error}
      }
    }
    this.legacy??=kind
  }
  enter(owner:string,workspace:string):ProjectExecutionScope{
    if(![owner,workspace].every(value=>typeof value==='string'&&value.length>0&&value.length<=128))throw Error('Invalid project execution ownership')
    if(this.active||this.legacy||this.unavailable)throw Error('Legacy activity or an existing project scope requires intervention')
    if(this.read())throw Error('Persisted execution activity requires intervention')
    const scope=Object.freeze({id:randomUUID()})
    this.ledger!.claim({version:1,id:scope.id,kind:'project',source:'project_coordinator'})
    this.active={scope,owner,workspace,uncertain:false};return scope
  }
  assert(scope:ProjectExecutionScope,owner:string,workspace:string):void{
    const active=this.active
    if(!active||active.scope!==scope||active.owner!==owner||active.workspace!==workspace||active.uncertain||this.unavailable)throw Error('Project execution capability is unavailable')
    const record=this.read()
    if(record?.kind!=='project'||record.id!==scope.id){active.uncertain=true;throw Error('Project execution record changed; intervention required')}
  }
  block(scope:ProjectExecutionScope,owner:string,workspace:string):void{
    this.assert(scope,owner,workspace);this.active!.uncertain=true
  }
  /** Trusted coordinator only, after all workers ended and receipts reconciled. */
  release(scope:ProjectExecutionScope,owner:string,workspace:string):void{
    this.assert(scope,owner,workspace)
    try{this.ledger!.release(scope.id)}catch(error){this.active!.uncertain=true;throw error}
    this.active=undefined
  }
  /** Explicit current-host intervention only. Never clears legacy/stale markers. */
  reconcileRelease(scope:ProjectExecutionScope,owner:string,workspace:string,assertReconciled:()=>void):void{
    const active=this.active
    if(!active||active.scope!==scope||active.owner!==owner||active.workspace!==workspace||!this.ledger)throw Error('Recovery requires the original execution capability')
    const record=this.ledger.read()
    if(record?.kind!=='project'||record.id!==scope.id)throw Error('Execution recovery marker does not match')
    if(typeof assertReconciled!=='function'||assertReconciled()!==undefined)throw Error('Synchronous trusted reconciliation assertion required')
    try{this.ledger.release(scope.id)}catch(error){active.uncertain=true;throw error}
    this.active=undefined;this.unavailable=false
  }
  status(){
    if(!this.ledger)return {ready:false,reason:this.unavailable?'intervention_required' as const:'unconfigured' as const,legacyObserved:!!this.legacy}
    if(this.active){
      try{this.assert(this.active.scope,this.active.owner,this.active.workspace);return {ready:false,reason:'project_active' as const}}
      catch{return {ready:false,reason:'intervention_required' as const}}
    }
    try{
      const record=this.read()
      return this.unavailable||this.legacy||record?{ready:false,reason:'intervention_required' as const}:{ready:true,reason:'clean' as const}
    }catch{return {ready:false,reason:'intervention_required' as const}}
  }
}

/** Dedicated private-profile marker. The directory is host-selected, never model input.
 * Exclusive create coordinates cooperating app hosts; no stale marker is auto-cleared. */
export function fileExecutionLedger(directory:string):ExecutionLedger{
  if(!path.isAbsolute(directory))throw Error('Absolute private execution directory required')
  fs.mkdirSync(directory,{recursive:true,mode:0o700})
  const root=fs.realpathSync(directory),rootStat=fs.lstatSync(directory,{bigint:true})
  if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw Error('Plain execution ledger directory required')
  const file=path.join(root,'execution.json')
  const checkRoot=()=>{
    const current=fs.lstatSync(directory,{bigint:true})
    if(current.isSymbolicLink()||current.ino!==rootStat.ino||current.dev!==rootStat.dev||fs.realpathSync(directory)!==root)throw Error('Execution ledger directory changed')
  }
  const read=():ExecutionRecord|null=>{
    checkRoot();let fd:number
    try{fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}
    try{
      const stat=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(file,{bigint:true})
      if(!stat.isFile()||stat.nlink!==1n||stat.size>4096n||named.isSymbolicLink()||named.ino!==stat.ino||named.dev!==stat.dev)throw Error('Invalid execution ledger file')
      const bytes=Buffer.alloc(4097);let length=0
      while(length<bytes.length){const count=fs.readSync(fd,bytes,length,bytes.length-length,length);if(!count)break;length+=count}
      const after=fs.fstatSync(fd,{bigint:true}),current=fs.lstatSync(file,{bigint:true})
      if(BigInt(length)!==stat.size||after.size!==stat.size||after.mtimeNs!==stat.mtimeNs||after.ctimeNs!==stat.ctimeNs||current.ino!==stat.ino||current.dev!==stat.dev||current.isSymbolicLink())throw Error('Execution ledger changed during read')
      const value=JSON.parse(bytes.subarray(0,length).toString('utf8')) as ExecutionRecord
      if(!value||Object.keys(value).sort().join(',')!=='id,kind,source,version'||value.version!==1||
        typeof value.id!=='string'||!/^[a-f0-9-]{36}$/.test(value.id)||!['legacy','project'].includes(value.kind)||
        (value.kind==='project'?value.source!=='project_coordinator':!kinds.has(value.source)))throw Error('Invalid execution ledger record')
      return value
    }finally{fs.closeSync(fd)}
  }
  return {read,claim(record){
    checkRoot();const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL,0o600)
    // A partial/failed claim is deliberately left for intervention, never unlinked.
    try{fs.writeFileSync(fd,JSON.stringify(record),'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  },release(id){
    if(read()?.id!==id)throw Error('Execution marker cannot be released by this capability')
    checkRoot();fs.unlinkSync(file)
  }}
}

// This singleton observes legacy entry points now. Production project admission
// stays unavailable until a trusted host configures its durable private ledger.
export const projectExecutionGate=new ProjectExecutionGate()
export const assertLegacyExecutionAllowed=(kind:LegacyExecutionKind)=>projectExecutionGate.legacyStart(kind)
