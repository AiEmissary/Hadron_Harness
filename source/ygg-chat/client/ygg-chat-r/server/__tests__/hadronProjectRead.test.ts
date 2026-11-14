import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach,beforeEach,expect,it} from 'vitest'
import {ProjectReadHost} from '../hadronTools/projectRead.js'
import {isHadronToolSession,runHadronToolConversation} from '../hadronTools/types.js'
import {parseIndependentJob} from '../../../../shared/independentJobs.js'
let root:string,project:string,host:ProjectReadHost
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-project-read-'));project=path.join(root,'project');fs.mkdirSync(project);fs.writeFileSync(path.join(project,'README.md'),'First\nSecond\nThird');host=new ProjectReadHost()})
afterEach(()=>{fs.rmSync(root,{recursive:true,force:true})})
const signal=()=>new AbortController().signal
it('corrects an ungrounded answer once using the folder protocol and refuses repeated no-tool answers',async()=>{
 const first=session().session;let calls=0
 const answer=await runHadronToolConversation({session:first,task:'Read the selected folder',signal:signal(),generate:async packet=>{
  calls++
  if(calls===1)return 'I cannot inspect files.'
  if(calls===2){expect(packet).toContain('project_search');return JSON.stringify({tool:'project_read',arguments:{path:'README.md'}})}
  expect(packet).toContain('First');return JSON.stringify({answer:'Read First, Second, Third.'})
 }})
 expect(answer).toContain('First');expect(calls).toBe(3)
 const fresh=session().session
 await expect(runHadronToolConversation({session:fresh,task:'Inspect folder',signal:signal(),generate:async()=>JSON.stringify({answer:'Not inspected'})})).rejects.toThrow('without attempting')
})
function session(){const grant=host.grant('owner','workspace','a',project);return {grant,session:host.session('owner',grant.id,'workspace','a')}}
it('lists and reads selected excerpts through the actual host protocol without changing files',async()=>{
 const {session:tools}=session();expect(isHadronToolSession(tools)).toBe(true)
 const list=await tools.invoke('project_list',{path:''},signal()) as any
 expect(list.entries).toContainEqual({name:'README.md',kind:'file'})
 const read=await tools.invoke('project_read',{path:'README.md',startLine:2,maxLines:1},signal()) as any
 expect(read.text).toBe('Second');expect(read.sha256).toMatch(/^[a-f0-9]{64}$/);expect(read.truncated).toBe(true)
 let turn=0
 expect(await runHadronToolConversation({session:tools,task:'Read README',signal:signal(),generate:async()=>++turn===1?JSON.stringify({tool:'project_read',arguments:{path:'README.md'}}):JSON.stringify({answer:'First, Second, Third'})})).toBe('First, Second, Third')
 expect(fs.readFileSync(path.join(project,'README.md'),'utf8')).toBe('First\nSecond\nThird')
})
it('binds access to an owner, workspace and agent; revocation and replacement invalidate old sessions',async()=>{
 const {grant,session:tools}=session()
 for(const args of [['other',grant.id,'workspace','a'],['owner',grant.id,'other','a'],['owner',grant.id,'workspace','b'],['owner','forged','workspace','a']] as const)expect(()=>host.session(...args)).toThrow()
 host.revoke('other',grant.id);await expect(tools.invoke('project_list',{},signal())).resolves.toBeTruthy()
 host.grant('owner','workspace','a',project)
 await expect(tools.invoke('project_list',{},signal())).rejects.toThrow('access is unavailable')
 const next=session();host.revoke('owner',next.grant.id);await expect(next.session.invoke('project_list',{},signal())).rejects.toThrow()
})
it('rejects traversal, absolute/device paths, credential files and unknown write/command/web operations',async()=>{
 const {session:tools}=session();fs.writeFileSync(path.join(project,'.env'),'secret');fs.mkdirSync(path.join(project,'.git'))
 for(const file of ['../outside','C:/outside','/outside','README.md:stream','sub\\file','.env','.git/config','CON','README.md.'])await expect(tools.invoke('project_read',{path:file},signal())).rejects.toThrow()
 for(const tool of ['project_write','shell','web_read','tool_create'])await expect(tools.invoke(tool,{},signal())).rejects.toThrow()
 const list=await tools.invoke('project_list',{},signal()) as any
 expect(list.entries.map((entry:any)=>entry.name)).toEqual(['README.md'])
})
it('rejects linked files/directories and hard links without reading outside the selected folder',async()=>{
 const outside=path.join(root,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'private.txt'),'outside')
 fs.symlinkSync(outside,path.join(project,'linked'),process.platform==='win32'?'junction':'dir')
 fs.linkSync(path.join(outside,'private.txt'),path.join(project,'hard.txt'))
 const {session:tools}=session()
 await expect(tools.invoke('project_read',{path:'linked/private.txt'},signal())).rejects.toThrow()
 await expect(tools.invoke('project_read',{path:'hard.txt'},signal())).rejects.toThrow()
 expect(()=>host.grant('owner','workspace','b',project,[outside,project])).toThrow()
 const credentialRoot=path.join(root,'.ssh','nested');fs.mkdirSync(credentialRoot,{recursive:true})
 expect(()=>host.grant('owner','workspace','b',credentialRoot)).toThrow()
})
it('bounds file size, line count, output size and binary reads',async()=>{
 fs.writeFileSync(path.join(project,'large.txt'),'x'.repeat(16777217));fs.writeFileSync(path.join(project,'binary.bin'),Buffer.from([0,1,2]));fs.writeFileSync(path.join(project,'long.txt'),'x'.repeat(20000))
 const {session:tools}=session()
 await expect(tools.invoke('project_read',{path:'large.txt'},signal())).rejects.toThrow()
 await expect(tools.invoke('project_read',{path:'binary.bin'},signal())).rejects.toThrow()
 await expect(tools.invoke('project_read',{path:'README.md',maxLines:201},signal())).rejects.toThrow()
 const read=await tools.invoke('project_read',{path:'long.txt'},signal()) as any;expect(read.text.length).toBe(8000);expect(read.truncated).toBe(true)
})
it('checks cancellation, live authorization and folder identity on each operation',async()=>{
 const {grant,session:tools}=session();const abort=new AbortController();abort.abort()
 await expect(tools.invoke('project_list',{},abort.signal)).rejects.toThrow()
 let allowed=true
 const guarded=host.session('owner',grant.id,'workspace','a',()=>{if(!allowed)throw Error('signed out')})
 allowed=false;await expect(guarded.invoke('project_list',{},signal())).rejects.toThrow('signed out')
})
it('invalidates grants after folder replacement and after process host replacement',async()=>{
 const {grant,session:tools}=session();fs.renameSync(project,project+'-old');fs.mkdirSync(project)
 await expect(tools.invoke('project_list',{},signal())).rejects.toThrow('folder changed')
 expect(()=>new ProjectReadHost().session('owner',grant.id,'workspace','a')).toThrow()
})
it('records operation metadata and bounds the operation count without logging file contents',async()=>{
 const {grant}=session(),events:Array<{tool:string;state:string}>=[]
 const tools=host.session('owner',grant.id,'workspace','a',()=>{},(tool,state)=>events.push({tool,state}))
 await tools.invoke('project_read',{path:'README.md'},signal())
 await expect(tools.invoke('project_write',{},signal())).rejects.toThrow()
 expect(events).toEqual([{tool:'project_read',state:'started'},{tool:'project_read',state:'completed'},{tool:'project_write',state:'started'},{tool:'project_write',state:'failed'}])
 expect(JSON.stringify(events)).not.toContain('README')
 for(let i=0;i<30;i++)await tools.invoke('project_list',{},signal())
 await expect(tools.invoke('project_list',{},signal())).rejects.toThrow('operation limit')
})
it('parses only an opaque project grant paired with project mode, rejecting arbitrary roots',()=>{
 const input={schemaVersion:1,id:'job',conversationId:'chat',anchorMessageId:'anchor',task:'Inspect',context:'',provider:'openaichatgpt',modelName:'model',toolMode:'project',projectGrantId:crypto.randomUUID()}
 expect(parseIndependentJob(input).projectGrantId).toBe(input.projectGrantId)
 expect(()=>parseIndependentJob({...input,root:project})).toThrow()
 expect(()=>parseIndependentJob({...input,projectGrantId:undefined})).toThrow()
 expect(()=>parseIndependentJob({...input,toolMode:'web'})).toThrow()
})

it('searches nested text beyond the first read excerpt, and supports filename search',async()=>{
 fs.mkdirSync(path.join(project,'src'));fs.writeFileSync(path.join(project,'src','target.ts'),'line\n'.repeat(500)+'needleValue here\n')
 const {session:tools}=session()
 const found=await tools.invoke('project_search',{query:'needleValue'},signal()) as any
 expect(found.matches).toContainEqual({path:'src/target.ts',line:501,text:'needleValue here'})
 expect(found.truncated).toBe(false)
 expect((await tools.invoke('project_search',{query:'target.ts',mode:'path'},signal()) as any).matches).toEqual([{path:'src/target.ts'}])
})
it('does not search dependencies, generated content, credentials, links or escaped roots',async()=>{
 for(const name of ['node_modules','dist','.git']){fs.mkdirSync(path.join(project,name));fs.writeFileSync(path.join(project,name,'secret.txt'),'needle')}
 fs.writeFileSync(path.join(project,'.env'),'needle');fs.writeFileSync(path.join(project,'binary.bin'),Buffer.from([0,1,2]))
 const {session:tools}=session()
 expect((await tools.invoke('project_search',{query:'needle'},signal()) as any).matches).toEqual([])
 await expect(tools.invoke('project_search',{path:'../',query:'needle'},signal())).rejects.toThrow()
 await expect(tools.invoke('project_search',{query:'needle',mode:'regex'},signal())).rejects.toThrow()
 await expect(tools.invoke('project_search',{query:'needle',root:'C:/'},signal())).rejects.toThrow()
})
it('reports truncated searches and permits targeted subfolder searches rather than claiming completeness',async()=>{
 fs.writeFileSync(path.join(project,'README.md'),'needle\n'.repeat(100))
 const {session:tools}=session(),found=await tools.invoke('project_search',{query:'needle',maxResults:2},signal()) as any
 expect(found.matches).toHaveLength(2);expect(found.truncated).toBe(true)
 expect(JSON.stringify(found).length).toBeLessThan(20000)
})

it('reads a bounded excerpt from a log larger than one MiB and isolates continuous folder grants',async()=>{
 fs.writeFileSync(path.join(project,'debug.log'),'old log line\n'.repeat(100000)+'new evidence')
 const grant=host.grant('owner','workspace','continuous',project),tools=host.session('owner',grant.id,'workspace','continuous')
 expect(()=>host.session('owner',grant.id,'workspace','shared')).toThrow()
 const read=await tools.invoke('project_read',{path:'debug.log',startLine:100001,maxLines:1},signal()) as any
 const search=await tools.invoke('project_search',{query:'new evidence'},signal()) as any;expect(search.matches).toContainEqual(expect.objectContaining({path:'debug.log',line:100001}));expect(read.text).toBe('new evidence');expect(read.totalLines).toBe(100001);expect(read.sha256).toMatch(/^[a-f0-9]{64}$/)
 host.revoke('owner',grant.id);await expect(tools.invoke('project_read',{path:'debug.log'},signal())).rejects.toThrow('access is unavailable')
})

it('checks owner, workspace, slot, expiry and folder identity before reusing a selected root',()=>{
 const grant=host.grant('owner','workspace','b',project)
 expect(host.selectionDirectory('owner',grant.id,'workspace','b')).toBe(fs.realpathSync(project))
 for(const [owner,workspace,slot] of [['other','workspace','b'],['owner','other','b'],['owner','workspace','a']] as const)expect(()=>host.selectionDirectory(owner,grant.id,workspace,slot)).toThrow()
 host.revoke('owner',grant.id);expect(()=>host.selectionDirectory('owner',grant.id,'workspace','b')).toThrow()
})
