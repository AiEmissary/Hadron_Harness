import {expect,it,vi} from 'vitest'
import {loadWorkspace,legacyWorkspaceMessages,type WorkspaceLoaderApi} from './workspaceLoader'
import {blankWorkspaceChat,workspaceMessagePath} from './unifiedWorkspace'
const metadata=(id='root')=>({id,project_id:'project',user_id:'owner',title:'Saved title',storage_mode:'local'})
function fixture(){
 const api:WorkspaceLoaderApi={conversation:vi.fn(async id=>metadata(id)),messages:vi.fn(async()=>[]),archive:vi.fn(async()=>null),navigation:vi.fn(async id=>({schemaVersion:1 as const,requestedConversationId:id,workspaceConversationId:id,slot:null,nodeId:null})),agentTree:vi.fn(async(workspace,slot)=>({schemaVersion:1 as const,sourceConversationId:workspace,slot,nodes:[]})),sharedTree:vi.fn(async()=>({nodes:[]}))}
 return api
}
it('uses archived drafts and remembered A/B chats without fetching or restarting native history',async()=>{
 const api=fixture(),a={...blankWorkspaceChat('project','root'),draft:'Unsent question',peerChats:{a:'root',b:'b'}},b=blankWorkspaceChat('project','b','b')
 api.archive=vi.fn(async id=>({revision:1,chat:id==='root'?a:b}))
 const result=await loadWorkspace('owner','project','root',api)
 expect(result.primary.draft).toBe('Unsent question');expect(result.related[0].id).toBe('b');expect(api.navigation).not.toHaveBeenCalled();expect(api.messages).not.toHaveBeenCalled()
})
it('rejects a foreign project or account before reading private history',async()=>{
 const api=fixture();api.conversation=vi.fn(async()=>({...metadata(),user_id:'foreign'}))
 await expect(loadWorkspace('owner','project','root',api)).rejects.toThrow('local projects');expect(api.archive).not.toHaveBeenCalled()
})
it('opens the active chat when its remembered companion has been deleted, without discarding its draft',async()=>{
 const api=fixture(),chat={...blankWorkspaceChat('project','root'),draft:'Keep my unsent question',peerChats:{a:'root',b:'deleted'}}
 api.archive=vi.fn(async id=>id==='root'?{revision:7,chat}:null)
 const result=await loadWorkspace('owner','project','root',api)
 expect(result.primary.draft).toBe('Keep my unsent question')
 expect(result.primary.peerChats).toEqual({a:'root'})
 expect(result.related).toEqual([])
 expect(api.navigation).not.toHaveBeenCalled()
})
it('does not hide a database failure while loading a companion',async()=>{
 const api=fixture(),chat={...blankWorkspaceChat('project','root'),peerChats:{b:'peer'}}
 api.archive=vi.fn(async id=>{if(id==='peer')throw Error('Database unavailable');return{revision:1,chat}})
 await expect(loadWorkspace('owner','project','root',api)).rejects.toThrow('Database unavailable')
})
it('keeps original message IDs and reconnects visible descendants through internal rows',()=>{
 const messages=legacyWorkspaceMessages([
  {id:'q',role:'user',content:'Question',parent_id:null},
  {id:'system',role:'system',content:'Internal',parent_id:'q'},
  {id:'tool',role:'tool',content:'Read receipt',parent_id:'system'},
  {id:'answer',role:'assistant',content:'Answer',parent_id:'tool'},
 ] as any)
 const chat={...blankWorkspaceChat('project','root'),messages,selectedId:'answer'}
 expect(workspaceMessagePath(chat).map(message=>[message.id,message.text])).toEqual([['q','Question'],['answer','Answer']])
 expect(()=>legacyWorkspaceMessages([{id:'bad',role:'user',parent_id:'missing'}] as any)).toThrow('missing')
})
it('opens the correct native B branch and retains its source workspace identity',async()=>{
 const api=fixture()
 api.navigation=vi.fn(async()=>({schemaVersion:1 as const,requestedConversationId:'job-chat',workspaceConversationId:'root',slot:'b' as const,nodeId:'answer'}))
 api.agentTree=vi.fn(async(workspace,slot)=>({schemaVersion:1 as const,sourceConversationId:workspace,slot,nodes:slot==='a'?[]:[
  {id:'q',parentId:null,conversationId:'job-chat',jobId:'job',kind:'task' as const,text:'Original B question',status:'completed',provider:'claudecode' as const,modelName:'sonnet'},
  {id:'answer',parentId:'q',conversationId:'job-chat',jobId:'job',kind:'response' as const,text:'Original B answer',status:'completed',provider:'claudecode' as const,modelName:'sonnet'},
 ]}))
 const result=await loadWorkspace('owner','project','job-chat',api)
 expect(result.primary).toMatchObject({id:'job-chat',agent:'b',nativeWorkspaceId:'root',permission:'chat'})
 expect(workspaceMessagePath(result.primary).map(message=>message.text)).toEqual(['Original B question','Original B answer'])
})
it('does not substitute an empty conversation after a failed saved-history read',async()=>{
 const api=fixture();api.sharedTree=vi.fn(async()=>{throw Error('Database unavailable')})
 await expect(loadWorkspace('owner','project','root',api)).rejects.toThrow('Database unavailable')
})
it('fences a shared task that is still running even before its final answer exists',async()=>{
 const api=fixture();api.sharedTree=vi.fn(async()=>({nodes:[{id:'shared-task:active',parentId:null,conversationId:'root',jobId:'shared:active',kind:'task' as const,text:'Running shared task',status:'running',provider:'openaichatgpt' as const,modelName:'model'}]}))
 const result=await loadWorkspace('owner','project','root',api)
 expect(result.primary).toMatchObject({workType:'together',jobState:'unknown',nativeJob:{kind:'shared',id:'active'}})
})
it('uses the project prompts for the next message while retaining the conversation-specific instructions',async()=>{
 const api=fixture();api.project=vi.fn(async()=>({id:'project',user_id:'owner',context:'Project context',system_prompt:'Project instructions'}))
 api.conversation=vi.fn(async()=>({...metadata(),conversation_context:'Chat context',system_prompt:'Project instructions'}))
 const result=await loadWorkspace('owner','project','root',api)
 expect(result.primary.instructions).toBe('Project instructions\n\nProject context\n\nChat context')
})
it('retains the available B reply when an older shared task failed before producing a combined answer',async()=>{
 const api=fixture();api.sharedTree=vi.fn(async()=>({nodes:[{id:'shared-task:failed',parentId:null,conversationId:'root',jobId:'shared:failed',kind:'task' as const,text:'Saved shared question',status:'failed',provider:'openaichatgpt' as const,modelName:'model'}]}))
 api.sharedStatus=vi.fn(async()=>({sessionId:'failed',status:'failed',participants:[{id:'a',provider:'openaichatgpt',modelName:'model',runId:null},{id:'b',provider:'claudecode',modelName:'sonnet',runId:'b-run'}],collaboration:{stages:[]}} as any))
 api.sharedTranscript=vi.fn(async()=>({text:'B retained useful findings.'}))
 const result=await loadWorkspace('owner','project','root',api)
 expect(result.primary.messages.at(-1)?.text).toContain('B retained useful findings.')
 expect(result.primary.messages.at(-1)?.state).toBe('failed');expect(result.primary.models.b?.provider).toBe('claudecode')
})
