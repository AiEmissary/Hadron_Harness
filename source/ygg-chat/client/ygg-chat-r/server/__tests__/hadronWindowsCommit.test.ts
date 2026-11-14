import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {ProjectWriteStore} from '../hadronTools/projectWrites.js'
import {fileExecutionLedger,ProjectExecutionGate,type ProjectExecutionScope} from '../hadronTools/executionGate.js'

const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
const digest=(value:string)=>createHash('sha256').update(value).digest('hex')
let temporary:string,project:string,file:string,db:any,store:ProjectWriteStore,execution:ProjectExecutionGate,scope:ProjectExecutionScope
function fixture(action:'prepare'|'inspect'|'readonly'|'unprotect'){
 const code=String.raw`
 $ErrorActionPreference='Stop'
 [Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
 [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
 $p=[Console]::In.ReadToEnd() | ConvertFrom-Json
 $sections=[Security.AccessControl.AccessControlSections]::Access -bor [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Group
 if($p.action -eq 'prepare') {
  $acl=[IO.File]::GetAccessControl($p.path,$sections)
  $acl.SetAccessRuleProtection($true,$true)
  [IO.File]::SetAccessControl($p.path,$acl)
  [IO.File]::SetCreationTimeUtc($p.path,[DateTime]::Parse('2020-01-02T03:04:05Z').ToUniversalTime())
  [IO.File]::SetAttributes($p.path,[IO.File]::GetAttributes($p.path) -bor [IO.FileAttributes]::Hidden)
 }
 if($p.action -eq 'unprotect'){$acl=[IO.File]::GetAccessControl($p.path,$sections);$acl.SetAccessRuleProtection($false,$true);[IO.File]::SetAccessControl($p.path,$acl)}
 if($p.action -eq 'readonly'){[IO.File]::SetAttributes($p.path,[IO.File]::GetAttributes($p.path) -bor [IO.FileAttributes]::ReadOnly)}
 $acl=[IO.File]::GetAccessControl($p.path,$sections)
 $data=@{sddl=$acl.GetSecurityDescriptorSddlForm($sections);protected=$acl.AreAccessRulesProtected;attributes=[int][IO.File]::GetAttributes($p.path);created=[IO.File]::GetCreationTimeUtc($p.path).Ticks.ToString()}
 [Console]::Out.Write(($data|ConvertTo-Json -Compress))
 `
 const result=spawnSync(path.join(process.env.SystemRoot!,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{windowsHide:true,shell:false,encoding:'utf8',timeout:10000,maxBuffer:8192,input:JSON.stringify({action,path:file})})
 if(result.error||result.status!==0)throw Error(`Windows fixture setup/inspection failed: ${result.error?.message??result.stderr.slice(0,1800)}`)
 const data=JSON.parse(result.stdout);data.securityHash=digest(data.sddl);delete data.sddl;data.stream=fs.readFileSync(file+':hadron-proof','utf8');return data
}
beforeEach(()=>{
 if(process.platform!=='win32')return
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-windows-commit-'));project=path.join(temporary,'project');fs.mkdirSync(project)
 file=path.join(project,"café-$(must-not-run)-'literal'.txt");fs.writeFileSync(file,'original')
 fs.writeFileSync(file+':hadron-proof','stream survives')
 execution=new ProjectExecutionGate();execution.configure(fileExecutionLedger(path.join(temporary,'execution')));scope=execution.enter('owner','workspace')
 db=new DatabaseSync(path.join(temporary,'journal.db'));store=new ProjectWriteStore(db,{assertExecution:(owner,workspace)=>execution.assert(scope,owner,workspace)})
})
afterEach(()=>{
 if(process.platform!=='win32')return
 vi.restoreAllMocks();db.close()
 if(path.dirname(temporary)!==fs.realpathSync(os.tmpdir())||!path.basename(temporary).startsWith('hadron-windows-commit-'))throw Error('Invalid test cleanup root')
 if(fs.existsSync(file))fs.chmodSync(file,0o666)
 fs.rmSync(temporary,{recursive:true,force:true})
})
function approved(){
 const lease=store.acquire('owner','workspace',project)
 store.propose(lease,'owner','edit',path.basename(file),digest('original'),'replacement')
 store.recordReview(lease,'owner','b',store.snapshot(lease,'owner').snapshotHash,'approve','Reviewed the exact text replacement.')
 return lease
}
it.runIf(process.platform==='win32')('uses actual Windows replacement and preserves protected DACL, owner/group, creation time and an alternate stream',()=>{
 const before=fixture('prepare');expect(before.protected).toBe(true)
 const lease=approved();store.apply(lease,'owner','edit',new AbortController().signal)
 expect(fs.readFileSync(file,'utf8')).toBe('replacement');expect(fixture('inspect')).toEqual(before)
 const receipt=db.prepare('SELECT * FROM hadron_project_writes WHERE id=?').get('edit')
 expect(receipt.metadata_hash).toMatch(/^[a-f0-9]{64}$/)
 expect(fs.readFileSync(path.join(project,receipt.backup_name),'utf8')).toBe('original')
 const plan=store.recoveryPlan('owner',lease.id)
 expect(plan.reconcilable).toBe(true);expect(plan.files[0].metadataStatus).toBe('verified-against-backup')
},20000)
it.runIf(process.platform==='win32')('does not clear read-only flags or fall back to a permission-losing rename',()=>{
 fixture('prepare');const before=fixture('readonly'),lease=approved()
 expect(()=>store.apply(lease,'owner','edit',new AbortController().signal)).toThrow('not confirmed')
 expect(fs.readFileSync(file,'utf8')).toBe('original');expect(fixture('inspect')).toEqual(before)
 expect(store.inspect('owner',lease.id).interventionRequired).toBe(true)
},20000)
it.runIf(process.platform==='win32')('reconciles an actual replacement with a lost receipt only after read-only native metadata verification',()=>{
 const before=fixture('prepare'),lease=approved(),prepare=db.prepare.bind(db)
 const fault=vi.spyOn(db,'prepare').mockImplementation((sql:unknown)=>{if(String(sql).includes("SET state='applied'"))throw Error('Simulated receipt disk failure');return prepare(sql)})
 expect(()=>store.apply(lease,'owner','edit',new AbortController().signal)).toThrow('receipt disk failure');fault.mockRestore()
 const plan=store.recoveryPlan('owner',lease.id)
 expect(plan).toMatchObject({reconcilable:true,files:[{state:'uncertain',observed:'matches-replacement',metadataStatus:'verified-against-backup'}]})
 store.reconcileAfterStop(lease,'owner',plan.inspectionHash,()=>{})
 store.assertRecoveryClosed(lease,'owner')
 expect(fs.readFileSync(file,'utf8')).toBe('replacement');expect(fixture('inspect')).toEqual(before)
 expect(()=>store.apply(lease,'owner','edit',new AbortController().signal)).toThrow('capability')
},30000)
it.runIf(process.platform==='win32')('keeps recovery and normal release blocked if Windows permissions change after replacement',()=>{
 fixture('prepare');const lease=approved();store.apply(lease,'owner','edit',new AbortController().signal)
 expect(fixture('unprotect').protected).toBe(false)
 const plan=store.recoveryPlan('owner',lease.id)
 expect(plan.reconcilable).toBe(false);expect(plan.files[0].metadataStatus).toBe('unknown')
 expect(()=>store.reconcileAfterStop(lease,'owner',plan.inspectionHash,()=>{})).toThrow('manual inspection')
 expect(()=>store.release(lease,'owner')).toThrow('intervention')
 expect(fs.readFileSync(file,'utf8')).toBe('replacement')
},20000)
