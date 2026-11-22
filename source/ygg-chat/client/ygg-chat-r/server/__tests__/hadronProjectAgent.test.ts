import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {ProjectReadHost} from '../hadronTools/projectRead.js'
import {ProjectAgentHost} from '../hadronTools/projectAgent.js'
import {editFile} from '../tools/editFile.js'
import {readTextFile} from '../tools/readFile.js'
import {runPowerShellCommand} from '../tools/powershell.js'
import {runHadronToolConversation} from '../hadronTools/types.js'

let root:string,reads:ProjectReadHost,agents:ProjectAgentHost,read:{id:string;label:string}
beforeEach(()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-agent-test-'))
 reads=new ProjectReadHost();agents=new ProjectAgentHost(reads);read=reads.grant('owner','workspace','a',root)
})
afterEach(()=>{
 agents.clear();reads.clear()
 const target=fs.realpathSync(root),temporary=fs.realpathSync(os.tmpdir())
 if(path.dirname(target)!==temporary||!path.basename(target).startsWith('hadron-agent-test-'))throw Error('Invalid fixture cleanup')
 fs.rmSync(target,{recursive:true,force:true})
})
const definitions=['read_file','edit_file','powershell','subagent','custom_module'].map(name=>({name,inputSchema:{type:'object'}}))
const config=(grantId:string,execute:any=vi.fn(async()=>({success:true})))=>({owner:'owner',workspace:'workspace',slot:'a' as const,grantId,conversationId:'chat',anchorMessageId:'question',definitions,execute,authorize:()=>{}})
it('requires an explicit native Agent grant; read access and model-supplied tool names cannot mint it',()=>{
 expect(()=>agents.session(config(read.id))).toThrow('Agent permission')
 const agent=agents.grant('owner','workspace','a',read.id)
 expect(()=>agents.session({...config(agent.id),owner:'foreign'})).toThrow('Agent permission')
 expect(()=>agents.session({...config(agent.id),slot:'b'})).toThrow('Agent permission')
})
it('allows real source reading, editing and a real passing test after native Agent admission',async()=>{
 fs.writeFileSync(path.join(root,'calculator.cjs'),'exports.add=(a,b)=>a-b;\n')
 fs.writeFileSync(path.join(root,'calculator.test.cjs'),"const {test}=require('node:test');const assert=require('node:assert/strict');const {add}=require('./calculator.cjs');test('negative operand',()=>assert.equal(add(-2,3),1));\n")
 const grant=agents.grant('owner','workspace','a',read.id),activity=vi.fn()
 const execute=vi.fn(async(call:any,context:any)=>{
  const args=JSON.parse(call.arguments)
  expect(context.rootPath).toBe(root);expect(context.operationMode).toBe('execute');expect(context.fullAccess).toBe(false)
  if(call.name==='read_file')return readTextFile(args.path,{cwd:context.rootPath})
  if(call.name==='edit_file')return editFile(args.path,args.operation,{...args,cwd:context.rootPath,operationMode:context.operationMode})
  return runPowerShellCommand(args.command,{cwd:context.rootPath,signal:context.signal,timeoutMs:15000,maxOutputChars:8000})
 })
 const session=agents.session({...config(grant.id,execute),activity})
 expect(session.requireCompletionStatus).toBe(true)
 const signal=new AbortController().signal
 await session.invoke('read_file',{path:'calculator.cjs'},signal)
 const edit=await session.invoke('edit_file',{path:'calculator.cjs',operation:'replace',searchPattern:'a-b',replacement:'a+b',createBackup:false},signal) as any
 expect(edit.success).toBe(true);expect(fs.readFileSync(path.join(root,'calculator.cjs'),'utf8')).toContain('a+b')
 expect(JSON.parse(execute.mock.calls[1][0].arguments).createBackup).toBe(true)
 const command=process.platform==='win32'?`& '${process.execPath.replaceAll("'","''")}' --test calculator.test.cjs`:`& '${process.execPath}' --test calculator.test.cjs`
 if(process.platform==='win32'){
  const result=await session.invoke('powershell',{command,description:'Run the fixture calculator test'},signal) as any
  expect(result.success).toBe(true);expect(JSON.stringify(result)).toContain('negative operand')
 }
 expect(activity).toHaveBeenCalledWith('edit_file','completed')
 await expect(session.invoke('subagent',{},signal)).rejects.toThrow('unavailable')
})
it('revokes writing when Agent permission or its selected folder is removed',async()=>{
 const grant=agents.grant('owner','workspace','a',read.id),execute=vi.fn(),session=agents.session(config(grant.id,execute))
 agents.revoke('owner',grant.id)
 await expect(session.invoke('edit_file',{},new AbortController().signal)).rejects.toThrow('permission')
 expect(execute).not.toHaveBeenCalled()
 const replacement=agents.grant('owner','workspace','a',read.id),other=agents.session(config(replacement.id,execute))
 reads.revoke('owner',read.id)
 await expect(other.invoke('edit_file',{},new AbortController().signal)).rejects.toThrow('Select the project folder')
})
it('serializes operations on one folder and checks Stop before a queued write starts',async()=>{
 const a=agents.grant('owner','workspace','a',read.id)
 let release!:()=>void;const first=vi.fn(()=>new Promise<void>(resolve=>{release=resolve})),second=vi.fn(async()=>({success:true}))
 const one=agents.session(config(a.id,first)),two=agents.session(config(a.id,second)),abort=new AbortController()
 const running=one.invoke('edit_file',{},new AbortController().signal)
 await new Promise(resolve=>setImmediate(resolve))
 const queued=two.invoke('edit_file',{},abort.signal);abort.abort();release()
 await running;await expect(queued).rejects.toThrow();expect(second).not.toHaveBeenCalled()
})
it('provides a larger Agent work budget without increasing the read-only protocol budget',async()=>{
 const invoke=vi.fn(async()=>({success:true})),generate=vi.fn(async()=>'{"tool":"edit_file","arguments":{}}')
 const result=await runHadronToolConversation({session:{execution:'agent',instructions:'Agent',maxRequests:12,invoke},task:'Fix',signal:new AbortController().signal,generate})
 expect(generate).toHaveBeenCalledTimes(12);expect(invoke).toHaveBeenCalledTimes(11)
 expect(result).toContain('Some operations may already have changed files')
 await expect(runHadronToolConversation({session:{instructions:'Chat',maxRequests:12,invoke},task:'Read',signal:new AbortController().signal,generate})).rejects.toThrow('budget')
})

it('gives shared reviewers reads but no write or command capability, and respects revocation',async()=>{
 fs.writeFileSync(path.join(root,'calculator.cjs'),'exports.add=(a,b)=>a+b')
 const grant=agents.grant('owner','workspace','a',read.id),execute=vi.fn()
 const session=agents.session({...config(grant.id,execute),readOnly:true}),signal=new AbortController().signal
 expect(session.execution).toBeUndefined()
 expect(session.requireCompletionStatus).toBeUndefined()
 expect(JSON.stringify(await session.invoke('project_read',{path:'calculator.cjs'},signal))).toContain('a+b')
 await expect(session.invoke('edit_file',{},signal)).rejects.toThrow()
 await expect(session.invoke('powershell',{},signal)).rejects.toThrow()
 expect(execute).not.toHaveBeenCalled()
 agents.revoke('owner',grant.id)
 await expect(session.invoke('project_list',{},signal)).rejects.toThrow('permission')
})

it('reads, edits and runs a real check in a second explicitly selected folder and fences unselected roots',async()=>{
 const first=path.join(root,'first'),second=path.join(root,'second');fs.mkdirSync(first);fs.mkdirSync(second)
 fs.writeFileSync(path.join(first,'value.txt'),'First unchanged');fs.writeFileSync(path.join(second,'value.txt'),'broken')
 const read=reads.grant('owner','workspace','a',[first,second]),grant=agents.grant('owner','workspace','a',read.id)
 const execute=vi.fn(async(call:any,context:any)=>{
  expect(context.rootPath).toBe(second)
  const args=JSON.parse(call.arguments);expect(args.folder).toBeUndefined()
  if(call.name==='edit_file')return editFile(args.path,args.operation,{...args,cwd:context.rootPath,operationMode:context.operationMode})
  return runPowerShellCommand(args.command,{cwd:context.rootPath,signal:context.signal,timeoutMs:15000,maxOutputChars:8000})
 })
 const tools=agents.session(config(grant.id,execute)),signal=new AbortController().signal
 expect((await tools.invoke('project_read',{folder:'folder2',path:'value.txt'},signal) as any).text).toBe('broken')
 expect((await tools.invoke('edit_file',{folder:'folder2',path:'value.txt',operation:'replace',searchPattern:'broken',replacement:'fixed'},signal) as any).success).toBe(true)
 expect(fs.readFileSync(path.join(first,'value.txt'),'utf8')).toBe('First unchanged')
 if(process.platform==='win32')expect((await tools.invoke('powershell',{folder:'folder2',command:"if ((Get-Content -LiteralPath value.txt) -ne 'fixed') { throw 'Check failed' }; Write-Output 'SECOND_FOLDER_CHECK_PASSED'",description:'Check saved second folder edit'},signal) as any).success).toBe(true)
 await expect(tools.invoke('edit_file',{folder:'folder3',path:'value.txt'},signal)).rejects.toThrow('folder')
 const reviewer=agents.session({...config(grant.id,execute),readOnly:true})
 expect((await reviewer.invoke('project_read',{folder:'folder2',path:'value.txt'},signal) as any).text).toBe('fixed')
 await expect(reviewer.invoke('edit_file',{folder:'folder2'},signal)).rejects.toThrow()
})
