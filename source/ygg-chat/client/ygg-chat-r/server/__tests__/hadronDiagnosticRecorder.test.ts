import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach,expect,it} from 'vitest'
import {createDiagnosticRecorder} from '../../electron/hadronDiagnosticRecorder.js'
const roots:string[]=[]
const folder=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-release-check-recorder-'));roots.push(root);return root}
const read=(root:string,file:string)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))
afterEach(()=>{for(const root of roots.splice(0)){if(path.dirname(fs.realpathSync(root))!==fs.realpathSync(os.tmpdir())||!path.basename(root).startsWith('hadron-release-check-recorder-'))throw Error('Unexpected fixture');fs.rmSync(root,{recursive:true,force:true})}})
it('records the last completed startup phase and creates a matching safe report for early exit',()=>{
 const root=folder(),recorder=createDiagnosticRecorder(root)
 recorder.mark('bootstrap_started');recorder.mark('profile_ready');recorder.fail('unexpected_exit',17)
 const trace=read(root,'startup-trace.json'),report=read(root,'release-check.json')
 expect(trace.events.map((event:any)=>event.stage)).toEqual(['bootstrap_started','profile_ready','unexpected_exit'])
 expect(report).toMatchObject({success:false,diagnosticRunId:recorder.runId,stage:'unexpected_exit',exitCode:17})
 expect(trace.runId).toBe(report.diagnosticRunId)
})
it('retains the original failure rather than replacing it on process exit',()=>{
 const root=folder(),recorder=createDiagnosticRecorder(root)
 recorder.mark('main_loaded');recorder.fail('instance_lock_denied');recorder.fail('unexpected_exit',0)
 expect(read(root,'release-check.json').stage).toBe('instance_lock_denied')
 expect(read(root,'startup-trace.json').stage).toBe('instance_lock_denied')
})
it('does not overwrite successful diagnostics with an exit event and separates repeated runs',()=>{
 const root=folder(),first=createDiagnosticRecorder(root)
 first.mark('renderer_loaded');first.complete();first.fail('unexpected_exit',0)
 expect(read(root,'startup-trace.json').stage).toBe('diagnostic_passed')
 expect(fs.existsSync(path.join(root,'release-check.json'))).toBe(false)
 const next=createDiagnosticRecorder(root);next.mark('bootstrap_started')
 expect(next.runId).not.toBe(first.runId)
 expect(read(root,'startup-trace.json').events).toHaveLength(1)
})
it('refuses arbitrary folders instead of writing reports outside the private diagnostic area',()=>{
 expect(()=>createDiagnosticRecorder(os.tmpdir())).toThrow('Diagnostic directory')
})
