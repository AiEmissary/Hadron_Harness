import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {ExecutionStartup} from '../hadronTools/executionStartup.js'
import {ProjectExecutionGate,projectExecutionGate} from '../hadronTools/executionGate.js'
import {ToolOrchestrator} from '../tools/orchestrator/ToolOrchestrator.js'

const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
let temporary:string,gate:ProjectExecutionGate,startup:ExecutionStartup
const databases:any[]=[]
const orchestrators:ToolOrchestrator[]=[]
beforeEach(()=>{
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-execution-startup-'))
 gate=new ProjectExecutionGate();startup=new ExecutionStartup(gate)
})
afterEach(()=>{
 for(const orchestrator of orchestrators.splice(0))orchestrator.shutdown()
 for(const database of databases.splice(0))database.close()
 vi.restoreAllMocks();vi.unstubAllEnvs()
 if(path.dirname(temporary)!==fs.realpathSync(os.tmpdir())||!path.basename(temporary).startsWith('hadron-execution-startup-'))throw Error('Invalid test cleanup root')
 fs.rmSync(temporary,{recursive:true,force:true})
})
it('freezes the boot mode and canonical profile without creating an execution claim',()=>{
 startup.initialize(temporary,'project');startup.initialize(temporary,'project')
 expect(startup.status()).toEqual({mode:'project',startupBlocked:false,execution:{ready:true,reason:'clean'}})
 expect(()=>startup.initialize(temporary,'standard')).toThrow('cannot switch')
 expect(()=>startup.initialize(path.join(temporary,'other'),'project')).toThrow('cannot switch')
 expect(fs.existsSync(path.join(temporary,'project-execution/execution.json'))).toBe(false)
})
it('refuses all inherited starts even between project attempts and does not taint a clean ledger',()=>{
 startup.initialize(temporary,'project')
 const scope=gate.enter('owner','workspace');gate.release(scope,'owner','workspace')
 for(const kind of ['custom_module','tool_job','utility_process','utility_request','shell','terminal','mcp','lsp','legacy_chat','delegation','repl','git','undo'] as const){
  expect(()=>gate.legacyStart(kind)).toThrow('project-only session')
 }
 expect(startup.status().execution.ready).toBe(true)
})
it('shares the canonical ledger with standard hosts without clearing previous activity',()=>{
 startup.initialize(temporary,'standard');gate.legacyStart('utility_process')
 const second=new ProjectExecutionGate(),project=new ExecutionStartup(second)
 project.initialize(temporary,'project')
 expect(project.status().execution.reason).toBe('intervention_required')
 expect(()=>second.enter('owner','workspace')).toThrow('Persisted execution')
 expect(()=>second.legacyStart('utility_process')).toThrow('project-only session')
})
it('blocks standard hosts while a project scope is held',()=>{
 startup.initialize(temporary,'project');const scope=gate.enter('owner','workspace')
 const standardGate=new ProjectExecutionGate();new ExecutionStartup(standardGate).initialize(temporary,'standard')
 expect(()=>standardGate.legacyStart('utility_process')).toThrow('requires intervention')
 gate.release(scope,'owner','workspace');standardGate.legacyStart('utility_process')
 expect(()=>gate.enter('owner','workspace')).toThrow('Persisted execution')
})
it('pins child bootstrap to the frozen profile despite mutable environment variables',()=>{
 startup.initialize(temporary,'project')
 vi.stubEnv('HADRON_EXECUTION_PROFILE',path.join(temporary,'forged'));vi.stubEnv('HADRON_EXECUTION_SESSION','standard')
 const environment=startup.childEnvironment()
 expect(environment.HADRON_EXECUTION_PROFILE).toBe(fs.realpathSync(temporary))
 expect(environment.HADRON_EXECUTION_SESSION).toBe('project')
 expect(new ExecutionStartup(new ProjectExecutionGate()).childEnvironment().HADRON_EXECUTION_PROFILE).toBeUndefined()
})
it('holds corrupt persistence and late project boot without losing read-only inspection',()=>{
 gate.legacyStart('shell');startup.initialize(temporary,'project')
 expect(startup.status()).toMatchObject({mode:'project',startupBlocked:true,execution:{ready:false}})
 expect(()=>gate.legacyStart('shell')).toThrow('intervention')
 const second=new ProjectExecutionGate();new ExecutionStartup(second).initialize(temporary,'project')
 expect(()=>second.enter('owner','workspace')).toThrow('Persisted execution')
 const root=path.join(temporary,'corrupt');fs.mkdirSync(path.join(root,'project-execution'),{recursive:true})
 fs.writeFileSync(path.join(root,'project-execution/execution.json'),'partial')
 const corruptGate=new ProjectExecutionGate(),corrupt=new ExecutionStartup(corruptGate)
 corrupt.initialize(root,'project')
 expect(corrupt.status()).toMatchObject({mode:'project',startupBlocked:true,execution:{reason:'intervention_required'}})
 expect(()=>corruptGate.enter('owner','workspace')).toThrow()
})
it('refuses unfenced execution if the ledger cannot be constructed and never resets that boot failure',()=>{
 fs.writeFileSync(path.join(temporary,'project-execution'),'not a directory')
 startup.initialize(temporary,'standard')
 expect(startup.holdsLegacyStartup()).toBe(true)
 expect(startup.status()).toMatchObject({mode:'standard',startupBlocked:true,execution:{reason:'intervention_required'}})
 expect(()=>gate.legacyStart('utility_process')).toThrow('intervention')
 expect(()=>gate.enter('owner','workspace')).toThrow()
 startup.initialize(temporary,'standard')
 expect(startup.status().startupBlocked).toBe(true)
})
it('holds persisted pending jobs unchanged and marks lost running work without executing any handler',()=>{
 const db=new DatabaseSync(path.join(temporary,'queue.db'));databases.push(db)
 const setup=new ToolOrchestrator();orchestrators.push(setup);setup.initialize(db);setup.shutdown()
 const insert=db.prepare(`INSERT INTO tool_jobs (id,tool_name,args,status,priority,timeout_ms,created_at) VALUES (?,?,?,?,?,?,?)`)
 insert.run('pending','fixture','{"keep":"original"}','pending','normal',1000,'2026-01-01')
 insert.run('running','fixture','{}','running','normal',1000,'2026-01-01')
 startup.initialize(temporary,'project')
 vi.spyOn(projectExecutionGate,'legacyStart').mockImplementation(kind=>gate.legacyStart(kind))
 const held=new ToolOrchestrator();orchestrators.push(held);const handler=vi.fn();held.registerTool('fixture',handler)
 held.initialize(db,{holdPending:true})
 expect(handler).not.toHaveBeenCalled()
 expect(held.getStats()).toMatchObject({pending:1,running:0,failed:1,activeWorkers:0})
 expect(db.prepare('SELECT status,args FROM tool_jobs WHERE id=?').get('pending')).toEqual({status:'pending',args:'{"keep":"original"}'})
 expect(held.getJob('running')?.error).toContain('not replayed')
 expect(startup.status().execution.ready).toBe(true)
 expect(()=>held.submit('fixture',{})).toThrow('project-only session')
 // Cancellation is still available; neither cancel nor queue processing starts work.
 expect(held.cancel('pending')).toBe(true);expect(handler).not.toHaveBeenCalled()
})
