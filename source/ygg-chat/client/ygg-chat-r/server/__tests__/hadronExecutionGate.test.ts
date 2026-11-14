import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {fileExecutionLedger,ProjectExecutionGate,projectExecutionGate} from '../hadronTools/executionGate.js'
import {ToolRuntimeSandboxHost} from '../tools/runtime/toolRuntimeSandbox.js'
import {ToolOrchestrator} from '../tools/orchestrator/ToolOrchestrator.js'
import {customToolRegistry} from '../tools/customToolLoader.js'
import {runBoundedShell} from '../tools/shellRunner.js'
import {ReplSessions} from '../headlessServer/services/replExecutor.js'
import {restoreStreamUndo} from '../tools/streamUndoManager.js'
import {mcpManager} from '../mcp/mcpManager.js'
import {installFromZipUrl,installFromLocal} from '../skills/skillInstaller.js'

let temporary:string,gate:ProjectExecutionGate
beforeEach(()=>{
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-execution-gate-'));gate=new ProjectExecutionGate()
 gate.configure(fileExecutionLedger(path.join(temporary,'ledger')))
})
afterEach(()=>{
 vi.restoreAllMocks()
 if(path.dirname(temporary)!==fs.realpathSync(os.tmpdir())||!path.basename(temporary).startsWith('hadron-execution-gate-'))throw Error('Invalid test cleanup root')
 fs.rmSync(temporary,{recursive:true,force:true})
})
function held(){
 const scope=gate.enter('owner','workspace')
 vi.spyOn(projectExecutionGate,'legacyStart').mockImplementation(kind=>gate.legacyStart(kind))
 return scope
}
it('requires durable configuration and opaque owner/workspace-bound authority',()=>{
 const fresh=new ProjectExecutionGate();expect(fresh.status()).toMatchObject({ready:false,reason:'unconfigured'})
 expect(()=>fresh.enter('owner','workspace')).toThrow('not configured')
 const scope=gate.enter('owner','workspace');gate.assert(scope,'owner','workspace')
 expect(()=>gate.assert({id:scope.id},'owner','workspace')).toThrow('capability')
 expect(()=>gate.assert(scope,'other','workspace')).toThrow('capability')
 expect(()=>gate.assert(scope,'owner','other')).toThrow('capability')
 expect(()=>gate.enter('owner','workspace')).toThrow('existing project')
 gate.release(scope,'owner','workspace');expect(gate.status().ready).toBe(true)
})
it('legacy activity prevents a project even after its promise has settled',async()=>{
 await Promise.resolve().then(()=>gate.legacyStart('custom_module'))
 expect(()=>gate.enter('owner','workspace')).toThrow('Legacy activity')
 const restarted=new ProjectExecutionGate();restarted.configure(fileExecutionLedger(path.join(temporary,'ledger')))
 expect(()=>restarted.enter('owner','workspace')).toThrow('Persisted execution')
 expect(restarted.status().reason).toBe('intervention_required')
 restarted.legacyStart('shell') // normal legacy use continues; no project scope was admitted
})
it('retains bootstrap observations when the host later configures persistence',()=>{
 const fresh=new ProjectExecutionGate();fresh.legacyStart('utility_process')
 fresh.configure(fileExecutionLedger(path.join(temporary,'bootstrap')))
 const restarted=new ProjectExecutionGate();restarted.configure(fileExecutionLedger(path.join(temporary,'bootstrap')))
 expect(()=>restarted.enter('owner','workspace')).toThrow('Persisted execution')
})
it('coordinates distinct hosts through exclusive marker creation and does not clear stale records',()=>{
 const scope=gate.enter('owner','workspace'),other=new ProjectExecutionGate()
 other.configure(fileExecutionLedger(path.join(temporary,'ledger')))
 expect(()=>other.enter('other','another')).toThrow('Persisted execution')
 expect(()=>other.legacyStart('mcp')).toThrow('requires intervention')
 expect(()=>other.release(scope,'owner','workspace')).toThrow('capability')
 gate.release(scope,'owner','workspace');expect(other.enter('other','another').id).toBeTruthy()
})
it('blocks every legacy category while the scope is held, without overwriting its marker',()=>{
 const scope=gate.enter('owner','workspace'),marker=fs.readFileSync(path.join(temporary,'ledger/execution.json'),'utf8')
 for(const kind of ['tool_job','custom_module','widget_write','widget_directory','widget_shell','terminal','shell','utility_process','utility_request','mcp','lsp','git','skill_install','legacy_chat','delegation','repl','undo'] as const){
  expect(()=>gate.legacyStart(kind)).toThrow('disabled')
 }
 expect(fs.readFileSync(path.join(temporary,'ledger/execution.json'),'utf8')).toBe(marker)
 gate.release(scope,'owner','workspace')
})
it('does not release uncertain scopes or reinterpret corrupted storage as clean',()=>{
 const scope=gate.enter('owner','workspace');gate.block(scope,'owner','workspace')
 expect(()=>gate.release(scope,'owner','workspace')).toThrow('capability')
 expect(gate.status().reason).toBe('intervention_required')
 const corrupt=path.join(temporary,'corrupt');fs.mkdirSync(corrupt);fs.writeFileSync(path.join(corrupt,'execution.json'),'partial write')
 const restarted=new ProjectExecutionGate();expect(()=>restarted.configure(fileExecutionLedger(corrupt))).toThrow()
 expect(restarted.status().reason).toBe('intervention_required')
 expect(()=>restarted.legacyStart('shell')).toThrow('intervention')
})
it('rejects changed directories, oversized markers and linked marker files',()=>{
 const directory=path.join(temporary,'replace'),ledger=fileExecutionLedger(directory)
 fs.renameSync(directory,directory+'-old');fs.mkdirSync(directory)
 expect(()=>ledger.read()).toThrow('directory changed')
 const large=path.join(temporary,'large'),largeLedger=fileExecutionLedger(large);fs.writeFileSync(path.join(large,'execution.json'),'x'.repeat(5000))
 expect(()=>largeLedger.read()).toThrow('Invalid execution ledger')
 const linked=path.join(temporary,'linked'),linkedLedger=fileExecutionLedger(linked),source=path.join(temporary,'source.json')
 fs.writeFileSync(source,'{}');fs.linkSync(source,path.join(linked,'execution.json'))
 expect(()=>linkedLedger.read()).toThrow('Invalid execution ledger')
})
it('never starts a utility process or dispatches an existing utility request under a project scope',async()=>{
 held();const fork=vi.fn(),host=new ToolRuntimeSandboxHost({fork,entryPath:'fixture.mjs'})
 await expect(host.initialize()).rejects.toThrow('disabled');expect(fork).not.toHaveBeenCalled()
 await expect(host.executeTool('edit_file',{})).rejects.toThrow('disabled');expect(fork).not.toHaveBeenCalled()
})
it('does not enter cached custom JavaScript or schedule an orchestrator retry under a project scope',async()=>{
 held();const execute=vi.fn()
 await expect((customToolRegistry as any).loadImplementation({implementation:{execute}})).rejects.toThrow('disabled')
 const orchestrator=new ToolOrchestrator({persistJobs:false}),job:any={id:'job',toolName:'custom',status:'pending',retriesRemaining:3}
 orchestrator.registerTool('custom',execute)
 expect(()=>orchestrator.submit('custom',{})).toThrow('disabled')
 await (orchestrator as any).executeJob(job)
 expect(execute).not.toHaveBeenCalled();expect(job.status).toBe('failed');expect(job.retriesRemaining).toBe(3)
})
it('blocks shell preparation, direct REPL execution and undo before they can reach external side effects',async()=>{
 held();const prepare=vi.fn(async()=>({cmd:'must-not-run',args:[]}))
 expect(await runBoundedShell(prepare)).toMatchObject({success:false,error:expect.stringContaining('disabled')})
 expect(prepare).not.toHaveBeenCalled()
 await expect(new ReplSessions().run({action:'exec',code:'1+1'},{conversationId:'workspace'} as any,vi.fn())).rejects.toThrow('disabled')
 await expect(restoreStreamUndo('does-not-exist')).rejects.toThrow('disabled')
})
it('does not reinterpret a failed durable legacy claim as a harmless competing legacy claim',()=>{
 let record:any=null
 const fresh=new ProjectExecutionGate();fresh.configure({read:()=>record,claim(value){record=value;throw Object.assign(Error('Simulated fsync failure'),{code:'EIO'})},release(){throw Error('Must not release')}})
 expect(()=>fresh.legacyStart('custom_module')).toThrow('fsync failure')
 expect(fresh.status().reason).toBe('intervention_required')
 expect(()=>fresh.enter('owner','workspace')).toThrow('requires intervention')
})
it('blocks MCP before connection/auth and skill/custom-tool installation before external side effects',async()=>{
 held();const connect=vi.spyOn(mcpManager as any,'ensureServerConnected')
 await expect(mcpManager.callServerTool('fixture','write',{})).rejects.toThrow('disabled')
 await expect(mcpManager.readResource('fixture','file:///fixture')).rejects.toThrow('disabled')
 await expect(mcpManager.getPrompt('fixture','fixture')).rejects.toThrow('disabled')
 expect(connect).not.toHaveBeenCalled()
 await expect(installFromZipUrl('https://must-not-fetch.invalid/fixture.zip','fixture')).rejects.toThrow('disabled')
 await expect(installFromLocal(path.join(temporary,'missing'))).rejects.toThrow('disabled')
 await expect(customToolRegistry.addToolFromDirectory(path.join(temporary,'missing'))).rejects.toThrow('disabled')
 await expect(customToolRegistry.removeTool('fixture')).rejects.toThrow('disabled')
})
it('retains an interrupted legacy tool as failed instead of queuing an ambiguous operation for replay',()=>{
 const orchestrator=new ToolOrchestrator({persistJobs:false}),execute=vi.fn()
 vi.spyOn(projectExecutionGate,'legacyStart').mockImplementation(kind=>gate.legacyStart(kind))
 orchestrator.registerTool('custom',execute)
 const row={id:'interrupted',tool_name:'custom',args_json:'{}',status:'running',priority:0,retries_remaining:2,timeout_ms:1000,created_at:new Date().toISOString()}
 ;(orchestrator as any).db={prepare:()=>({all:()=>[row]})}
 ;(orchestrator as any).loadPendingJobs()
 expect(orchestrator.getJob('interrupted')).toMatchObject({status:'failed',error:expect.stringContaining('not replayed')})
 expect(execute).not.toHaveBeenCalled()
 expect(()=>gate.enter('owner','workspace')).toThrow('Legacy activity')
})
it('recovery can close only the original owned project scope after trusted reconciliation',()=>{
 const scope=gate.enter('owner','workspace');gate.block(scope,'owner','workspace')
 expect(()=>gate.reconcileRelease({id:scope.id},'owner','workspace',()=>{})).toThrow('original execution')
 expect(()=>gate.reconcileRelease(scope,'other','workspace',()=>{})).toThrow('original execution')
 expect(()=>gate.reconcileRelease(scope,'owner','workspace',()=>{throw Error('Unresolved receipt')})).toThrow('Unresolved receipt')
 expect(gate.status().reason).toBe('intervention_required')
 gate.reconcileRelease(scope,'owner','workspace',()=>{});expect(gate.status().ready).toBe(true)
})
