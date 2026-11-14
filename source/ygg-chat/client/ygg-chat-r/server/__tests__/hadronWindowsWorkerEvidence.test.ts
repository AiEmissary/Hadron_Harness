import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {WindowsWorkerEvidenceStore,type WindowsWorkerObservation} from '../hadronTools/windowsWorkerEvidence.js'
let root:string,epoch:string,observe:ReturnType<typeof vi.fn>,store:WindowsWorkerEvidenceStore
const ended=():WindowsWorkerObservation=>({parent:'ended',worker:'ended',job:'absent',active:null})
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-worker-evidence-'));epoch=randomUUID();observe=vi.fn(ended);store=new WindowsWorkerEvidenceStore(root,epoch,observe)})
afterEach(()=>{
 vi.restoreAllMocks();const resolved=fs.realpathSync(root)
 if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('hadron-worker-evidence-'))throw Error('Unexpected worker evidence cleanup')
 fs.rmSync(resolved,{recursive:true,force:true})
})
const packet=()=>({version:1,type:'prepared',nonce:'a'.repeat(64),job:'Local\\HadronWorker-'+'b'.repeat(32),sessionId:1,parentPid:process.pid,parentCreated:'134000000000000000',workerPid:12345,workerCreated:'134000000000000001'})
function prepare(){const value=packet();return store.recordPrepared(value,{job:value.job,nonce:value.nonce,workerPid:value.workerPid})}
const file=(id:string)=>path.join(root,'worker-process-evidence',epoch,id+'.json')
it('persists only bounded process identities before reporting admission evidence',()=>{
 const id=prepare(),value=JSON.parse(fs.readFileSync(file(id),'utf8'))
 expect(value.epoch).toBe(epoch);expect(value.parentPid).toBe(process.pid)
 expect(value).not.toHaveProperty('nonce');expect(value).not.toHaveProperty('type')
 expect(store.inspect()).toEqual({readOnly:true,canResume:false,epoch,state:'ended',workers:1})
 expect(new WindowsWorkerEvidenceStore(root,epoch,observe).inspect().state).toBe('ended')
})
it('refuses a wrong nonce, parent, job or owned helper identity without creating files',()=>{
 const value=packet(),expected={job:value.job,nonce:value.nonce,workerPid:value.workerPid}
 for(const replacement of [{nonce:'c'.repeat(64)},{parentPid:process.pid+1},{workerPid:12346},{job:'Local\\other'}]){
  expect(()=>store.recordPrepared({...value,...replacement},expected)).toThrow('does not match')
 }
 expect(fs.readdirSync(root)).toEqual([])
})
it('keeps missing evidence unknown rather than treating an empty registry as termination',()=>{
 expect(store.inspect().state).toBe('unknown');expect(observe).not.toHaveBeenCalled()
})
it('requires the original parent, helper and complete job all to have ended',()=>{
 prepare()
 for(const value of [{...ended(),parent:'alive'},{...ended(),worker:'alive'},{...ended(),job:'active',active:1}] as WindowsWorkerObservation[]){
  observe.mockReturnValue(value);expect(store.inspect().state).toBe('active')
 }
 observe.mockReturnValue({...ended(),job:'unknown'});expect(store.inspect().state).toBe('unknown')
 observe.mockReturnValue({...ended(),job:'empty',active:4});expect(store.inspect().state).toBe('unknown')
 observe.mockReturnValue({...ended(),job:'empty',active:0});expect(store.inspect().state).toBe('ended')
 expect(store.inspect().canResume).toBe(false)
})
it('refuses linked directories and hard-linked records before OS inspection',()=>{
 const outside=path.join(root,'outside');fs.mkdirSync(outside)
 fs.symlinkSync(outside,path.join(root,'worker-process-evidence'),process.platform==='win32'?'junction':'dir')
 expect(()=>prepare()).toThrow('Linked or invalid');expect(store.inspect().state).toBe('unknown')
 fs.unlinkSync(path.join(root,'worker-process-evidence'))
 const id=prepare();fs.linkSync(file(id),path.join(outside,'linked.json'))
 expect(store.inspect().state).toBe('unknown');expect(observe).not.toHaveBeenCalled()
})
it('preserves corrupt, oversized and wrong-epoch records and withholds termination',()=>{
 const id=prepare(),target=file(id),original=fs.readFileSync(target),value=JSON.parse(original.toString('utf8'))
 for(const bytes of [Buffer.from('partial'),Buffer.alloc(4097),Buffer.from(JSON.stringify({...value,epoch:randomUUID()}))]){
  fs.writeFileSync(target,bytes);expect(store.inspect().state).toBe('unknown');expect(fs.readFileSync(target)).toEqual(bytes)
 }
 expect(observe).not.toHaveBeenCalled()
})
it('does not publish admission after a durable checkpoint sync failure',()=>{
 vi.spyOn(fs,'fsyncSync').mockImplementationOnce(()=>{throw Error('synthetic durable failure')})
 expect(()=>prepare()).toThrow('synthetic durable failure')
 // Retain the attempted record; never clean away ambiguous admission evidence.
 expect(fs.readdirSync(path.join(root,'worker-process-evidence',epoch))).toHaveLength(1)
})
