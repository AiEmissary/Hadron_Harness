import {hadronProtocolSnapshot} from './hadron-protocol-snapshot.mjs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawn} from 'node:child_process'
const appDir=path.resolve(import.meta.dirname,'..')
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-release-check-'))
const executable=path.join(appDir,'release/win-unpacked/The Hadron Harness.exe')
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.HADRON_DESKTOP_SMOKE_PROFILE
const protocolBefore=hadronProtocolSnapshot()
const child=spawn(executable,[`--hadron-diagnose=${profile}`],{env,windowsHide:true,stdio:['ignore','pipe','pipe']})
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>fs.appendFileSync(path.join(profile,'process.log'),chunk))
console.log('Private packaged diagnostic: '+profile)
const timer=setTimeout(()=>child.kill(),55000)
child.on('error',error=>{console.error(error);clearTimeout(timer);process.exitCode=1})
child.on('exit',code=>{clearTimeout(timer);try{const result=JSON.parse(fs.readFileSync(path.join(profile,'release-check.json'),'utf8'));const trace=JSON.parse(fs.readFileSync(path.join(profile,'startup-trace.json'),'utf8'));const traceMatches=!!result.diagnosticRunId&&result.diagnosticRunId===trace.runId&&trace.stage==='diagnostic_passed';result.startupTraceMatches=traceMatches;result.signInProtocolPreserved=hadronProtocolSnapshot()===protocolBefore;console.log(JSON.stringify(result,null,2));process.exitCode=code===0&&result.success&&traceMatches&&result.signInProtocolPreserved?0:1}catch(error){let trace;try{trace=JSON.parse(fs.readFileSync(path.join(profile,'startup-trace.json'),'utf8'))}catch{};const failure={success:false,exitCode:code,diagnosticRunId:trace?.runId,lastStartupStage:trace?.stage??'before_startup_checkpoint',error:'Packaged UI exited without a complete matching diagnostic report'};fs.writeFileSync(path.join(profile,'launcher-result.json'),JSON.stringify(failure,null,2));console.error(JSON.stringify(failure,null,2));process.exitCode=1}})
