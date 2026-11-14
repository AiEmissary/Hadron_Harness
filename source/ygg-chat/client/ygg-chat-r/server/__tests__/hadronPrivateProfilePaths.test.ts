import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {PrivateProfilePaths} from '../hadronTools/privateProfilePaths.js'
import {ExecutionStartup,executionStartup} from '../hadronTools/executionStartup.js'
import {ProjectExecutionGate} from '../hadronTools/executionGate.js'
import {execute,ensureManagedThemesInitialized} from '../tools/themeManager.js'

let temporary:string,profile:string,project:string,templates:string,startup:ExecutionStartup,gate:ProjectExecutionGate
beforeEach(()=>{
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-private-profile-'))
 profile=path.join(temporary,'profile');project=path.join(temporary,'project');templates=path.join(temporary,'templates')
 for(const directory of [profile,project,templates])fs.mkdirSync(directory)
 gate=new ProjectExecutionGate();startup=new ExecutionStartup(gate);startup.initialize(profile,'project')
 vi.spyOn(executionStartup,'isConfigured').mockImplementation(()=>startup.isConfigured())
 vi.spyOn(executionStartup,'privatePath').mockImplementation(relative=>startup.privatePath(relative))
 vi.spyOn(executionStartup,'assertPrivatePath').mockImplementation(target=>startup.assertPrivatePath(target))
 vi.stubEnv('YGG_THEME_DIRECTORY',path.join(profile,'.ygg','custom-themes'))
 vi.stubEnv('YGG_THEME_TEMPLATE_DIRECTORY',templates)
})
afterEach(()=>{
 vi.restoreAllMocks();vi.unstubAllEnvs()
 const resolved=fs.realpathSync(temporary)
 if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('hadron-private-profile-'))throw Error('Invalid private profile test cleanup')
 fs.rmSync(resolved,{recursive:true,force:true})
})
it('pins storage to the actual profile and permits missing descendants without creating them',()=>{
 const policy=new PrivateProfilePaths(profile),target=path.join(profile,'settings','new.json')
 expect(policy.relative('settings/new.json')).toBe(target)
 expect(fs.existsSync(path.dirname(target))).toBe(false)
 expect(()=>policy.absolute(path.join(project,'escape.json'))).toThrow('pinned profile')
 expect(()=>policy.relative('../project/escape.json')).toThrow('pinned profile')
 expect(()=>policy.relative(project)).toThrow('relative path')
 expect(()=>policy.relative('settings/file:stream')).toThrow('Invalid private storage')
})
it('refuses a replaced root even when its path and contents appear the same',()=>{
 const policy=new PrivateProfilePaths(profile)
 fs.renameSync(profile,path.join(temporary,'old-profile'));fs.mkdirSync(profile)
 expect(()=>policy.relative('settings/new.json')).toThrow('identity changed')
 expect(()=>startup.initialize(profile,'project')).toThrow('identity changed')
})
it('refuses linked ancestors before creating or copying any theme into a project',async()=>{
 fs.writeFileSync(path.join(templates,'seed.json'),'{}')
 fs.symlinkSync(project,path.join(profile,'.ygg'),process.platform==='win32'?'junction':'dir')
 await expect(ensureManagedThemesInitialized()).rejects.toThrow('Linked or invalid private storage')
 expect(fs.readdirSync(project)).toEqual([])
})
it('refuses a late external theme-directory override and keeps the actual project unchanged',async()=>{
 const scope=gate.enter('owner','workspace')
 vi.stubEnv('YGG_THEME_DIRECTORY',project)
 await expect(execute({action:'save',theme:{name:'Outside'}})).rejects.toThrow('pinned Hadron profile')
 expect(fs.readdirSync(project)).toEqual([]);expect(gate.status().reason).toBe('project_active')
 gate.release(scope,'owner','workspace')
})
it('keeps ordinary private theme CRUD usable during a held project scope without tainting it',async()=>{
 const scope=gate.enter('owner','workspace'),marker=fs.readFileSync(path.join(profile,'project-execution','execution.json'),'utf8')
 await execute({action:'save',theme:{name:'Private theme'}})
 await execute({action:'save',theme:{name:'Private theme',colors:{chatPanelBg:{light:'#abc123',dark:'#123abc'}}}})
 expect((await execute({action:'list'})).totalCount).toBe(1)
 expect((await execute({action:'read',name:'private-theme'})).theme?.colors.chatPanelBg.light).toBe('#abc123')
 expect((await execute({action:'delete',name:'private-theme'})).deleted).toBe(true)
 expect(fs.readdirSync(project)).toEqual([])
 expect(fs.readFileSync(path.join(profile,'project-execution','execution.json'),'utf8')).toBe(marker)
 gate.release(scope,'owner','workspace');expect(gate.status().ready).toBe(true)
})
it('refuses hard-linked theme leaves for reading, listing, overwriting and deleting',async()=>{
 const directory=await ensureManagedThemesInitialized(),outside=path.join(project,'outside.json')
 fs.writeFileSync(outside,'{"name":"Outside content"}')
 const target=path.join(directory,'linked.json');fs.linkSync(outside,target)
 for(const action of ['read','list','save','delete'] as const){
  await expect(execute({action,name:'linked',theme:{name:'linked'}})).rejects.toThrow('Linked or invalid private storage')
 }
 expect(fs.readFileSync(outside,'utf8')).toBe('{"name":"Outside content"}')
 expect(fs.existsSync(target)).toBe(true)
})
it('refuses a template directory junction rather than traversing external files',async()=>{
 const linked=path.join(templates,'external');fs.symlinkSync(project,linked,process.platform==='win32'?'junction':'dir')
 fs.writeFileSync(path.join(project,'private.json'),'DO_NOT_COPY')
 await expect(ensureManagedThemesInitialized()).rejects.toThrow('Linked theme templates')
 expect(fs.existsSync(path.join(profile,'.ygg','custom-themes','external'))).toBe(false)
 expect(fs.readFileSync(path.join(project,'private.json'),'utf8')).toBe('DO_NOT_COPY')
})
it('copies normal templates only into the pinned profile',async()=>{
 fs.mkdirSync(path.join(templates,'nested'));fs.writeFileSync(path.join(templates,'nested','seed.json'),'{}')
 const directory=await ensureManagedThemesInitialized()
 expect(fs.readFileSync(path.join(directory,'nested','seed.json'),'utf8')).toBe('{}')
 expect(fs.readdirSync(project)).toEqual([])
})
it('does not overwrite a linked destination that appears during template copying',async()=>{
 const outside=path.join(project,'outside.json');fs.writeFileSync(outside,'KEEP_EXTERNAL')
 fs.writeFileSync(path.join(templates,'seed.json'),'{}')
 const copy=fs.promises.copyFile.bind(fs.promises)
 vi.spyOn(fs.promises,'copyFile').mockImplementation(async(source,target,flags)=>{
  fs.linkSync(outside,target as string)
  return copy(source,target,flags)
 })
 await expect(ensureManagedThemesInitialized()).rejects.toThrow('Linked or invalid private storage')
 expect(fs.readFileSync(outside,'utf8')).toBe('KEEP_EXTERNAL')
})
it('tolerates simultaneous initialization without overwriting an existing theme',async()=>{
 fs.writeFileSync(path.join(templates,'seed.json'),'{}')
 const directories=await Promise.all(Array.from({length:3},()=>ensureManagedThemesInitialized()))
 expect(new Set(directories).size).toBe(1)
 expect(fs.readFileSync(path.join(directories[0],'seed.json'),'utf8')).toBe('{}')
})
