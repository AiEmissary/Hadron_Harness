import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
export type StartupStage='bootstrap_started'|'profile_ready'|'main_loaded'|'instance_lock_acquired'|'instance_lock_denied'|'app_ready'|'server_ready'|'window_created'|'renderer_loaded'|'diagnostic_passed'|'startup_failed'|'renderer_failed'|'unexpected_exit'
/** Diagnostic-only checkpoints contain fixed codes, never prompts, URLs or account data. */
export function createDiagnosticRecorder(directory:string){
 const resolved=path.resolve(directory),temporary=fs.realpathSync(os.tmpdir())
 if(!path.isAbsolute(directory)||!path.basename(directory).startsWith('hadron-release-check-')||fs.lstatSync(directory).isSymbolicLink()||!fs.lstatSync(directory).isDirectory()||path.dirname(fs.realpathSync(directory)).toLowerCase()!==temporary.toLowerCase())throw Error('Diagnostic directory is not an owned temporary test folder')
 const runId=randomUUID(),events:Array<{stage:StartupStage;at:string}>=[]
 let terminal=false
 const save=(name:string,value:unknown)=>{
  const temporaryFile=path.join(resolved,`.hadron-report-${randomUUID()}.tmp`)
  const fd=fs.openSync(temporaryFile,'wx',0o600)
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  fs.renameSync(temporaryFile,path.join(resolved,name))
 }
 const mark=(stage:StartupStage)=>{
  if(terminal)return
  events.push({stage,at:new Date().toISOString()})
  save('startup-trace.json',{schemaVersion:1,runId,pid:process.pid,stage,events:events.slice(-32)})
 }
 const fail=(stage:'startup_failed'|'renderer_failed'|'unexpected_exit'|'instance_lock_denied',exitCode?:number)=>{
  if(terminal)return
  mark(stage)
  save('release-check.json',{success:false,diagnosticRunId:runId,stage,error:'Startup did not complete. See startup-trace.json and the local diagnostic process log.',...(Number.isSafeInteger(exitCode)?{exitCode}:{})})
  terminal=true
 }
 return {runId,mark,fail,complete(){if(!terminal){mark('diagnostic_passed');terminal=true}}}
}
