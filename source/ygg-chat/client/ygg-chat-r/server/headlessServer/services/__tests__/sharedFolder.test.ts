import {expect,it,vi} from 'vitest'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {proposalSqlite} from './fixtures/proposalSqlite.js'
import {initializeCollaborationSchema} from '../../persistence/collaborationSchema.js'
import {CollaborationRepo} from '../../persistence/collaborationRepo.js'
import {ProposalSessionService} from '../collaboration/proposalSessionService.js'
import {ProjectReadHost} from '../../../hadronTools/projectRead.js'
import {ProjectAgentHost} from '../../../hadronTools/projectAgent.js'
import {editFile} from '../../../tools/editFile.js'
import {admitHadronToolSession,isHadronToolSession} from '../../../hadronTools/types.js'

it('performs shared coding through explicit native Agent permission with no separate preview workflow',async()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'hadron-shared-agent-test-'))
 writeFileSync(path.join(root,'value.cjs'),'exports.value = 1;\n')
 const reads=new ProjectReadHost(),agents=new ProjectAgentHost(reads),read=reads.grant('owner','c1','shared',root),grant=agents.grant('owner','c1','shared',read.id)
 let changed=false
 const generate=vi.fn(async(_provider:string,request:any)=>{
  const packet=JSON.parse(request.userContent)
  if(packet.kind==='combined_answer_packet')return {content:'Changed value.cjs to 2. Tests were not run.'}
  const session=request.hadronToolSession
  expect(session.execution).toBe(request.systemPrompt.includes('sole implementer')?'agent':undefined)
  await session.invoke('project_read',{path:'value.cjs'},request.signal)
  if(session.execution==='agent'&&!changed){
   changed=true
   const result=await session.invoke('edit_file',{path:'value.cjs',operation:'replace',searchPattern:'= 1',replacement:'= 2'},request.signal)
   expect(result.success).toBe(true)
  }
  return {content:'Inspected value.cjs. The value is now 2. Tests not run.'}
 })
 const f=proposalSqlite({generate} as any);initializeCollaborationSchema(f.db)
 const authorize=(owner:string)=>{if(owner!=='owner')throw Error('Denied')}
 const service=new ProposalSessionService({...f,sessions:new CollaborationRepo({db:f.db}),allowedModels:new Set(['a','b']),authorize,authorizeConversation:authorize,
  projectSession:(owner,input,_stage,check)=>input.projectMode==='agent'?agents.session({owner,workspace:input.conversationId,slot:'shared',grantId:input.projectGrantId!,conversationId:input.conversationId,anchorMessageId:input.anchorMessageId,
   definitions:[{name:'read_file',inputSchema:{}},{name:'edit_file',inputSchema:{}}],authorize:check,readOnly:_stage==='proposal_b'||_stage.startsWith('review_')||_stage==='verification',
   execute:async(call,context)=>{const args=JSON.parse(String(call.arguments));return editFile(args.path,args.operation,{...args,cwd:context.rootPath!,operationMode:'execute'})},
  }):reads.session(owner,input.projectGrantId!,input.conversationId,'shared',check),
 })
 const input={schemaVersion:1 as const,sessionId:'agent-work',conversationId:'c1',sourceLineageId:f.source.id,anchorMessageId:f.anchor.id,workflow:'review_and_synthesis' as const,projectMode:'agent' as const,task:'Change value to 2',context:'',projectGrantId:grant.id,
  participants:[{id:'a',provider:'openaichatgpt' as const,modelName:'a'},{id:'b',provider:'openaichatgpt' as const,modelName:'b'}]}
 try{
  service.preflight('owner',input);await service.start('owner',input)
  expect(service.status('owner',input.sessionId)?.status).toBe('completed')
  expect(readFileSync(path.join(root,'value.cjs'),'utf8')).toContain('= 2')
  const count=generate.mock.calls.length;await service.start('owner',input);expect(generate).toHaveBeenCalledTimes(count)
  expect(()=>service.preflight('owner',{...input,sessionId:'ungranted',projectGrantId:read.id})).toThrow('Agent permission')
 }finally{
  f.close();agents.clear();reads.clear()
  if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('hadron-shared-agent-test-'))throw Error('Invalid fixture cleanup')
  rmSync(root,{recursive:true,force:true})
 }
})

it.each([false,true])('gives both proposals and reviews real shared-folder reads, with verification=%s',async verify=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'hadron-shared-folder-test-'))
 mkdirSync(path.join(root,'src'));writeFileSync(path.join(root,'src/value.ts'),'export const marker = "SHARED_FOLDER_SENTINEL"\n')
 const stages:string[]=[]
 const generate=vi.fn(async(_provider:string,request:any)=>{
  expect(request.tools??[]).toEqual([])
  const packet=JSON.parse(request.userContent)
  if(packet.kind==='combined_answer_packet'){
   expect(request.hadronToolSession).toBeUndefined()
   expect(JSON.stringify(packet.proposals)).toContain('SHARED_FOLDER_SENTINEL')
   expect(JSON.stringify(packet.reviews)).toContain('SHARED_FOLDER_SENTINEL')
   if(verify)expect(packet.hostEvidence.receipts.map((item:any)=>item.tool)).toContain('project_read')
   return {content:'Combined: SHARED_FOLDER_SENTINEL. No edits or tests.'}
  }
  expect(isHadronToolSession(request.hadronToolSession)).toBe(true)
  const session=request.hadronToolSession
  const search=await session.invoke('project_search',{query:'marker'},request.signal)
  expect(search.matches[0].path).toBe('src/value.ts')
  const read=await session.invoke('project_read',{path:'src/value.ts'},request.signal)
  expect(read.text).toContain('SHARED_FOLDER_SENTINEL')
  await expect(session.invoke('project_write',{path:'src/value.ts',text:'changed'},request.signal)).rejects.toThrow()
  return {content:'Observed SHARED_FOLDER_SENTINEL in src/value.ts, hash '+read.sha256+'. No edits or tests.'}
 })
 const f=proposalSqlite({generate} as any);initializeCollaborationSchema(f.db)
 const host=new ProjectReadHost(),grant=host.grant('owner','c1','shared',root)
 const authorize=(owner:string)=>{if(owner!=='owner')throw Error('Denied')}
 const deps={...f,sessions:new CollaborationRepo({db:f.db}),allowedModels:new Set(['a','b']),authorize,authorizeConversation:authorize,
  projectSession:(owner:string,input:any,stage:string,check:()=>void)=>{stages.push(stage);return host.session(owner,input.projectGrantId,input.conversationId,'shared',check)},
  verificationSession:()=>admitHadronToolSession({instructions:'Public-web evidence',requireEvidenceAttempt:true,evidenceAttempted:()=>false,invoke:async()=>{throw Error('No web needed for this folder claim')}}),
 }
 const service=new ProposalSessionService(deps),input={schemaVersion:1 as const,sessionId:'folder',conversationId:'c1',sourceLineageId:f.source.id,anchorMessageId:f.anchor.id,workflow:verify?'review_verify_and_synthesis' as const:'review_and_synthesis' as const,task:'Find marker',context:'',projectGrantId:grant.id,participants:[{id:'a',provider:'openaichatgpt' as const,modelName:'a'},{id:'b',provider:'openaichatgpt' as const,modelName:'b'}]}
 try{
  service.preflight('owner',input)
  await service.start('owner',input)
  expect(stages).toEqual(expect.arrayContaining(['proposal_a','proposal_b','review_a','review_b']))
  expect(generate).toHaveBeenCalledTimes(verify?6:5)
  expect(service.status('owner','folder')).toMatchObject({status:'completed',collaboration:{folderAccess:true}})
  host.clear()
  expect(service.status('owner','folder')?.status).toBe('completed')
  expect(()=>service.preflight('owner',{...input,sessionId:'new'})).toThrow('access is unavailable')
  expect(generate).toHaveBeenCalledTimes(verify?6:5)
  expect(readFileSync(path.join(root,'src/value.ts'),'utf8')).toContain('SHARED_FOLDER_SENTINEL')
 }finally{f.close();if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('hadron-shared-folder-test-'))throw Error('Unexpected fixture path');rmSync(root,{recursive:true,force:true})}
})

it('rejects independent, foreign-workspace and foreign-owner grants for a shared read',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'hadron-shared-folder-test-')),host=new ProjectReadHost()
 try{
  for(const [owner,workspace,slot] of [['owner','c1','a'],['owner','other','shared'],['other','c1','shared']] as const){
   const grant=host.grant(owner,workspace,slot,root)
   expect(()=>host.session('owner',grant.id,'c1','shared')).toThrow('access is unavailable')
  }
 }finally{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('hadron-shared-folder-test-'))throw Error('Unexpected fixture path');rmSync(root,{recursive:true,force:true})}
})
