import {WORKSPACE_VISUAL_INSTRUCTION} from './workspaceVisuals'
import {afterEach,expect,it,vi} from 'vitest'
import {WorkspaceRunner,type WorkspaceRunEvent,type WorkspaceRunRequest} from './workspaceRunner'
import {individualWorkspaceTransport} from './workspaceIndependentTransport'
import {blankWorkspaceChat,initialUnifiedWorkspace,unifiedWorkspaceReducer as reduce,workspaceMessagePath,workspaceTranscriptPath} from './unifiedWorkspace'
import type {JobReference} from './independentJobController'
import {fixtureImage} from '../../../../../shared/__fixtures__/hadronImage'
it('does not include a picture from a sibling branch, and preserves the draft when the selected branch has too many pictures',async()=>{
 const f=fixture();await f.runner.send();f.emit({text:'Starting point.',state:'completed'})
 const branchPoint=f.state().chats.a.selectedId!
 f.deps.dispatch({type:'attachments',chatId:'a',files:Array.from({length:5},(_,index)=>{const image={...fixtureImage,id:`picture-${index}`};return {id:image.id,name:image.name,text:'',image}})})
 f.deps.dispatch({type:'draft',chatId:'a',text:'Describe these pictures.'});await f.runner.send();f.emit({text:'Five pictures.',state:'completed'})
 f.deps.dispatch({type:'attachments',chatId:'a',files:[{id:fixtureImage.id,name:fixtureImage.name,text:'',image:fixtureImage}]})
 f.deps.dispatch({type:'draft',chatId:'a',text:'A sixth picture.'});await expect(f.runner.send()).rejects.toThrow('five')
 expect(f.state().chats.a.draft).toBe('A sixth picture.');expect(f.state().chats.a.attachments).toHaveLength(1)
 f.deps.dispatch({type:'attachments',chatId:'a',files:[]})
 f.deps.dispatch({type:'select-message',chatId:'a',id:branchPoint});f.deps.dispatch({type:'draft',chatId:'a',text:'Another branch without pictures.'})
 await f.runner.send();expect(f.request().images).toBeUndefined()
})
it('keeps images on their message and selected branch, retains them for follow-ups and never shares them with a new chat',async()=>{
 const f=fixture()
 f.deps.dispatch({type:'attachments',chatId:'a',files:[{id:fixtureImage.id,name:fixtureImage.name,text:'',image:fixtureImage}]})
 await f.runner.send();f.emit({text:'Red square and blue circle.',state:'completed'})
 const original=f.state().chats.a.messages[0]
 expect(original.images).toEqual([fixtureImage]);expect(original.context).not.toContain(fixtureImage.dataUrl)
 f.deps.dispatch({type:'draft',chatId:'a',text:'Which shape is blue?'})
 await f.runner.send();expect(f.request().images).toEqual([fixtureImage]);f.emit({text:'The circle.',state:'completed'})
 f.deps.dispatch({type:'open',chat:blankWorkspaceChat('project','fresh')})
 f.deps.dispatch({type:'configure',chatId:'fresh',models:{a:{provider:'openaichatgpt',modelName:'model'}}})
 f.deps.dispatch({type:'draft',chatId:'fresh',text:'Hello'})
 await f.runner.send();expect(f.request().images).toBeUndefined();expect(JSON.stringify(f.request())).not.toContain(fixtureImage.dataUrl)
})

const runners:WorkspaceRunner[]=[]
it.each(['individual','together','continuous'] as const)('branches a question as an alternative in %s mode without repeating it or using later replies',async workType=>{
 const f=fixture()
 f.deps.dispatch({type:'configure',chatId:'a',workType,permission:'agent',models:{a:{provider:'openaichatgpt',modelName:'model'},b:{provider:'claudecode',modelName:'sonnet'}}})
 f.deps.dispatch({type:'folder',chatId:'a',folder:{id:'chosen',label:'Chosen folder'}})
 await f.runner.send();f.emit({text:'First answer',state:'completed'})
 const parent=f.state().chats.a.selectedId
 f.deps.dispatch({type:'draft',chatId:'a',text:'Original question'});await f.runner.send();f.emit({text:'OLD ANSWER MUST NOT BE SENT',state:'completed'})
 const source=f.state().chats.a.messages.at(-2)!
 const original=structuredClone(f.state().chats.a.messages)
 f.deps.dispatch({type:'draft',chatId:'a',text:'Keep my bottom draft'})
 const files=[{id:'pending',name:'Unsent.txt',text:'PRIVATE UNSENT ATTACHMENT'}]
 f.deps.dispatch({type:'attachments',chatId:'a',files})
 await f.runner.send({chatId:'a',messageId:source.id,text:'Alternative question'})
 const current=f.state().chats.a,request=f.request()
 expect(request.question).toMatchObject({text:'Alternative question',parentId:parent})
 expect(request).toMatchObject({workType,permission:current.permission,folder:{id:'chosen'},models:current.models})
 expect(request.path.map(message=>message.text)).toEqual(['Do this task','First answer'])
 expect(JSON.stringify(request)).not.toContain('OLD ANSWER');expect(JSON.stringify(request)).not.toContain('PRIVATE UNSENT')
 expect(current.messages.slice(0,original.length)).toEqual(original)
 expect(current.draft).toBe('Keep my bottom draft');expect(current.attachments).toEqual(files)
 expect(workspaceMessagePath(current).filter(message=>message.text==='Alternative question')).toHaveLength(1)
 expect(workspaceTranscriptPath(current).map(message=>message.text)).not.toContain('Original question')
 expect(current.messages.filter(message=>message.parentId===parent&&message.role==='user')).toHaveLength(2)
})
it('retains the source question’s supplied context and pictures on an alternative root branch',async()=>{
 const f=fixture()
 f.deps.dispatch({type:'attachments',chatId:'a',files:[{id:'text',name:'Facts.txt',text:'ORIGINAL FACTS'},{id:fixtureImage.id,name:fixtureImage.name,text:'',image:fixtureImage}]})
 await f.runner.send();f.emit({text:'Original answer',state:'completed'})
 const source=f.state().chats.a.messages[0]
 await f.runner.send({chatId:'a',messageId:source.id,text:'Try an alternative'})
 expect(f.request().question).toMatchObject({parentId:null,context:source.context,images:[fixtureImage]})
 expect(f.request().path).toEqual([]);expect(f.request().images).toEqual([fixtureImage])
 expect(f.request().question.context).toContain('ORIGINAL FACTS')
})
it('branches from an assistant answer as a follow-up and keeps another active chat untouched',async()=>{
 const f=fixture();await f.runner.send();f.emit({text:'Source answer',state:'completed'})
 const source=f.state().chats.a.messages.at(-1)!
 f.deps.dispatch({type:'open',chat:{...blankWorkspaceChat('project','elsewhere'),draft:'Other chat draft'}})
 await f.runner.send({chatId:'a',messageId:source.id,text:'New follow-up'})
 expect(f.request().chatId).toBe('a');expect(f.request().question.parentId).toBe(source.id)
 expect(f.request().path.map(message=>message.text)).toEqual(['Do this task','Source answer'])
 expect(f.state().activeChatId).toBe('elsewhere');expect(f.state().chats.elsewhere.draft).toBe('Other chat draft')
 expect(f.state().chats.elsewhere.messages).toEqual([])
})
it('does not admit a blank, missing-source or busy branch and preserves the original messages and draft',async()=>{
 const f=fixture();await f.runner.send();f.emit({text:'Original answer',state:'completed'})
 const source=f.state().chats.a.messages[0],original=structuredClone(f.state().chats.a.messages)
 f.deps.dispatch({type:'draft',chatId:'a',text:'Unsent draft'})
 await expect(f.runner.send({chatId:'a',messageId:source.id,text:' '})).rejects.toThrow('Write a message')
 await expect(f.runner.send({chatId:'a',messageId:'gone',text:'Alternative'})).rejects.toThrow('source')
 expect(f.state().chats.a.messages).toEqual(original);expect(f.state().chats.a.draft).toBe('Unsent draft')
 expect(f.deps.transport.create).toHaveBeenCalledTimes(1)
 await f.runner.send({chatId:'a',messageId:source.id,text:'Alternative'})
 await expect(f.runner.send({chatId:'a',messageId:source.id,text:'Duplicate'})).rejects.toThrow('in progress')
 expect(f.deps.transport.create).toHaveBeenCalledTimes(2)
})
it('does not carry another chat’s private instructions, picture or folder into a new chat in the same project',async()=>{
 const f=fixture()
 f.deps.dispatch({type:'instructions',chatId:'a',text:'PRIVATE_CHAT_A_NOT_FOR_B'})
 f.deps.dispatch({type:'folder',chatId:'a',folder:{id:'private-folder',label:'Only A folder'}})
 await f.runner.send();f.emit({text:'PRIVATE_COW_SVG_A',state:'completed'})
 f.deps.dispatch({type:'open',chat:blankWorkspaceChat('project','fresh')})
 f.deps.dispatch({type:'configure',chatId:'fresh',models:{a:{provider:'openaichatgpt',modelName:'model'}}})
 f.deps.dispatch({type:'draft',chatId:'fresh',text:'Draw my new cow'})
 await f.runner.send()
 expect(f.request().path).toEqual([])
 expect(f.request().folder).toBeUndefined()
 expect(JSON.stringify(f.request())).not.toContain('PRIVATE_')
 expect(f.state().chats.a.messages.at(-1)?.text).toBe('PRIVATE_COW_SVG_A')
})
it('allows questions to both agents without a folder, with no file or coding capability',async()=>{
 const f=fixture()
 f.deps.dispatch({type:'configure',chatId:'a',workType:'together',permission:'agent',models:{a:{provider:'openaichatgpt',modelName:'model'},b:{provider:'claudecode',modelName:'sonnet'}}})
 await f.runner.send()
 expect(f.handle.start).toHaveBeenCalledTimes(1)
 expect(f.request()).toMatchObject({workType:'together',permission:'chat',folder:undefined})
 expect(f.state().chats.a.permission).toBe('agent')
})
it('still uses coding permissions only when the user attached a folder',async()=>{
 const f=fixture();f.deps.dispatch({type:'configure',chatId:'a',permission:'agent'})
 f.deps.dispatch({type:'folder',chatId:'a',folder:{id:'selected-grant',label:'Selected folder'}})
 await f.runner.send()
 expect(f.request()).toMatchObject({permission:'agent',folder:{id:'selected-grant'}})
})
afterEach(()=>{for(const runner of runners)runner.dispose();runners.length=0})
function fixture(){
 let state=initialUnifiedWorkspace('project','a'),count=0,event:(event:WorkspaceRunEvent)=>void=()=>{},request:WorkspaceRunRequest|undefined
 state=reduce(state,{type:'configure',chatId:'a',models:{a:{provider:'openaichatgpt',modelName:'model'}}})
 state=reduce(state,{type:'draft',chatId:'a',text:'Do this task'})
 const handle={start:vi.fn(async()=>{}),recover:vi.fn(async()=>{}),stop:vi.fn(async()=>{}),dispose:vi.fn()}
 const deps={getState:()=>state,dispatch:(action:Parameters<typeof reduce>[1])=>{state=reduce(state,action)},id:()=>`id-${++count}`,error:vi.fn(),
  transport:{create:vi.fn((input:WorkspaceRunRequest,changed:(event:WorkspaceRunEvent)=>void)=>{request=input;event=changed;return handle})}}
 const runner=new WorkspaceRunner(deps);runners.push(runner)
 return {runner,deps,handle,state:()=>state,request:()=>request!,emit:(input:WorkspaceRunEvent)=>event(input)}
}
it('keeps streaming output in its original chat while switching agents and preserves the next draft',async()=>{
 const f=fixture();await f.runner.send()
 expect(f.state().chats.a.messages.map(message=>message.role)).toEqual(['user','assistant'])
 expect(f.state().chats.a.draft).toBe('')
 f.deps.dispatch({type:'draft',chatId:'a',text:'Next question'})
 f.deps.dispatch({type:'switch-agent',agent:'b',newChatId:'b'})
 f.emit({text:'Task completed with details',state:'completed'})
 expect(f.state().activeChatId).toBe('b')
 expect(f.state().chats.a.messages.at(-1)?.text).toBe('Task completed with details')
 expect(f.state().chats.a.draft).toBe('Next question')
 expect(f.state().chats.a.jobState).toBe('idle')
 expect(f.deps.transport.create).toHaveBeenCalledTimes(1)
})
it('checks uncertain admission without replaying the instruction or enabling a second send',async()=>{
 const f=fixture();f.handle.start.mockRejectedValueOnce(Error('lost response'))
 await f.runner.send()
 expect(f.handle.start).toHaveBeenCalledTimes(1);expect(f.handle.recover).toHaveBeenCalledTimes(1)
 expect(f.state().chats.a.jobState).toBe('unknown')
 f.deps.dispatch({type:'draft',chatId:'a',text:'Do it again'})
 await expect(f.runner.send()).rejects.toThrow('in progress')
 expect(f.deps.transport.create).toHaveBeenCalledTimes(1)
})
it('returns Stop to that chat only and ignores late chunks after final feedback',async()=>{
 const f=fixture();await f.runner.send();await f.runner.stop('a')
 expect(f.handle.stop).toHaveBeenCalledTimes(1)
 f.emit({text:'Stopped after one edit.',state:'stopped'})
 f.emit({text:'Late output',state:'running'})
 expect(f.state().chats.a.messages.at(-1)?.text).toBe('Stopped after one edit.')
 expect(f.state().chats.a.jobState).toBe('idle')
 f.runner.dispose();expect(f.handle.stop).toHaveBeenCalledTimes(1)
})
it('preserves the draft if local validation fails before launch',async()=>{
 const f=fixture();f.deps.transport.create.mockImplementationOnce(()=>{throw Error('Folder no longer available')})
 await expect(f.runner.send()).rejects.toThrow('Folder no longer available')
 expect(f.state().chats.a.draft).toBe('Do this task');expect(f.state().chats.a.messages).toHaveLength(0)
})
it('marks the overall conversation not finished when stopped between completed continuous replies',async()=>{
 const f=fixture();await f.runner.send()
 f.emit({text:'',state:'stopped',replies:[{id:'last',text:'Last saved reply',state:'completed',agent:'a'}]})
 expect(f.state().chats.a.messages.at(-1)).toMatchObject({text:'Last saved reply',state:'stopped'})
 expect(f.state().chats.a.jobState).toBe('idle')
})
it('connects the common Send flow to native admission, streams, final output and the next saved branch',async()=>{
 const f=fixture();let saved:JobReference|null=null,frame:(value:any)=>void=()=>{}
 const store={read:()=>saved,write:(value:JobReference)=>{saved=value},clear:()=>{saved=null}}
 const status=(id:string,terminal=false)=>({schemaVersion:1 as const,id,conversationId:'native-chat',status:terminal?'completed':'running',revision:terminal?2:1,provider:'openaichatgpt' as const,modelName:'model',runId:'native-answer',streamId:'stream'})
 const client={
  prepare:vi.fn(async(input:any)=>({...input,conversationId:'native-chat',anchorMessageId:'anchor'})),
  start:vi.fn(async(input:any)=>{expect(saved?.stage).toBe('submitted');return status(input.id)}),
  status:vi.fn(async(id:string)=>status(id,true)),stop:vi.fn(async(id:string)=>status(id,true)),
  transcript:vi.fn(async(id:string)=>({schemaVersion:1 as const,id,status:'completed',text:'Actual saved answer',verified:false as const})),
  stream:vi.fn(async(_id:string,_stream:string,_cursor:number,_signal:AbortSignal,callback:(value:any)=>void)=>{frame=callback;return {cursor:0,terminal:true as const}}),
 }
 f.deps.transport.create=individualWorkspaceTransport({client,workspaceId:'source-workspace',store:()=>store,pollMs:100000}).create as typeof f.deps.transport.create
 await f.runner.send()
 frame({type:'chunk',part:'text',delta:'Visible work',seq:1})
 expect(f.state().chats.a.messages.at(-1)?.text).toBe('Visible work')
 await f.runner.recover('a')
 expect(f.state().chats.a.messages.at(-1)?.text).toBe('Actual saved answer')
 expect(f.state().chats.a.jobState).toBe('idle');expect(saved).toBeNull()
 f.deps.dispatch({type:'draft',chatId:'a',text:'Continue from there'})
 await f.runner.send()
 expect(client.start).toHaveBeenCalledTimes(2)
 expect(client.prepare.mock.calls[1][0].parent).toEqual({jobId:client.start.mock.calls[0][0].id,kind:'response'})
 expect(client.start.mock.calls[1][0].task).toBe('Continue from there')
 expect(client.start.mock.calls[1][0].context).toBe(WORKSPACE_VISUAL_INSTRUCTION)
})
