import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {ExecutionStartup,executionStartup} from '../hadronTools/executionStartup.js'
import {ProjectExecutionGate} from '../hadronTools/executionGate.js'
import {AgentJobJournal,type AgentJournalSnapshot} from '../headlessServer/services/collaboration/agentJobJournal.js'

let temporary:string,profile:string,project:string,directory:string,startup:ExecutionStartup,gate:ProjectExecutionGate,journal:AgentJobJournal
const snapshot=():AgentJournalSnapshot=>({ownerId:'owner',jobId:'job',participantId:'a',task:'Small task',context:'Selected context',provider:'openaichatgpt',modelName:'model',status:'running',revision:1,runId:'run',text:'Saved progress'})
beforeEach(()=>{
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-private-journal-'));profile=path.join(temporary,'profile');project=path.join(temporary,'project')
 fs.mkdirSync(profile);fs.mkdirSync(project);directory=path.join(profile,'hadron-job-logs')
 gate=new ProjectExecutionGate();startup=new ExecutionStartup(gate);startup.initialize(profile,'project')
 vi.spyOn(executionStartup,'isConfigured').mockImplementation(()=>startup.isConfigured())
 vi.spyOn(executionStartup,'assertPrivatePath').mockImplementation(target=>startup.assertPrivatePath(target))
 journal=new AgentJobJournal(directory)
})
afterEach(()=>{
 vi.restoreAllMocks()
 const resolved=fs.realpathSync(temporary)
 if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('hadron-private-journal-'))throw Error('Invalid journal test cleanup')
 fs.rmSync(resolved,{recursive:true,force:true})
})
const file=()=>path.join(directory,journal.read('owner','job','a').filename)
it('keeps private atomic continuity logs usable while project execution is held',()=>{
 const scope=gate.enter('owner','workspace'),marker=fs.readFileSync(path.join(profile,'project-execution','execution.json'),'utf8')
 journal.checkpoint(snapshot());journal.checkpoint({...snapshot(),revision:2,text:'Saved progress\nNext observation'})
 const markdown=journal.read('owner','job','a').markdown
 expect(markdown).toContain('Saved progress');expect(markdown).toContain('Next observation')
 expect(fs.readdirSync(directory)).toHaveLength(1);expect(fs.readdirSync(project)).toEqual([])
 expect(fs.readFileSync(path.join(profile,'project-execution','execution.json'),'utf8')).toBe(marker)
 gate.release(scope,'owner','workspace')
})
it('rejects linked log folders and external configured log destinations before writes',()=>{
 fs.symlinkSync(project,directory,process.platform==='win32'?'junction':'dir')
 expect(()=>journal.checkpoint(snapshot())).toThrow('Linked or invalid private storage')
 expect(()=>new AgentJobJournal(project).checkpoint(snapshot())).toThrow('pinned profile')
 expect(fs.readdirSync(project)).toEqual([])
})
it('rejects hard-linked log leaves even for an unchanged cached checkpoint',()=>{
 journal.checkpoint(snapshot());const target=file(),outside=path.join(project,'outside.md')
 fs.writeFileSync(outside,'KEEP_EXTERNAL');fs.unlinkSync(target);fs.linkSync(outside,target)
 expect(()=>journal.read('owner','job','a')).toThrow('Linked or invalid private storage')
 expect(()=>journal.checkpoint(snapshot())).toThrow('Linked or invalid private storage')
 expect(fs.readFileSync(outside,'utf8')).toBe('KEEP_EXTERNAL')
})
it('recreates a removed checkpoint with full notes rather than trusting the memory cache',()=>{
 journal.checkpoint(snapshot());fs.unlinkSync(file());journal.checkpoint(snapshot())
 expect(journal.read('owner','job','a').markdown).toContain('Saved progress')
 expect(fs.readdirSync(directory)).toHaveLength(1)
})
it('bounds reads and refuses invalid saved encoding before accepting a cached checkpoint',()=>{
 journal.checkpoint(snapshot());const target=file();fs.writeFileSync(target,Buffer.alloc(2*1024*1024+1))
 expect(()=>journal.read('owner','job','a')).toThrow('oversized journal')
 expect(()=>journal.checkpoint(snapshot())).toThrow('oversized journal')
 fs.writeFileSync(target,Buffer.from([0xff,0xfe,0xff]))
 expect(()=>journal.read('owner','job','a')).toThrow()
})
it('rejects a log changed during the bounded read instead of returning a mixed checkpoint',()=>{
 journal.checkpoint(snapshot());const target=file(),read=fs.readSync.bind(fs);let changed=false
 vi.spyOn(fs,'readSync').mockImplementation(((...args:any[])=>{
  const result=(read as any)(...args)
  if(!changed){changed=true;fs.appendFileSync(target,'\nChanged while reading')}
  return result
 }) as any)
 expect(()=>journal.read('owner','job','a')).toThrow('Journal changed while reading')
})
