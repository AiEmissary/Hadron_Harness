import {afterEach,expect,it,vi} from 'vitest'
import {rememberWorkspace,startupWorkspace} from './startupWorkspace'
import type {Conversation} from '../conversations/conversationTypes'
const chat=(id:string,user_id='owner')=>({id,user_id,project_id:'project',storage_mode:'local'}) as Conversation
afterEach(()=>vi.unstubAllGlobals())
function storage(value:unknown=null){const data=new Map<string,string>();if(value)data.set('hadron:last-workspace:owner',JSON.stringify(value));vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)});return data}
it('prefers the workspace actually viewed over a newer private proposal artifact',async()=>{
 storage();rememberWorkspace('owner','workspace')
 const get=vi.fn(async(id:string)=>chat(id)),open=vi.fn()
 expect((await startupWorkspace('owner',chat('hadron-proposal-b'),get,open))?.id).toBe('workspace')
 expect(open).not.toHaveBeenCalled()
})
it('migrates startup from a private proposal to its owning shared workspace',async()=>{
 storage();const open=vi.fn(async()=>({workspaceConversationId:'shared-workspace'}))
 expect((await startupWorkspace('owner',chat('hadron-proposal-b'),async id=>chat(id),open))?.id).toBe('shared-workspace')
 expect(open).toHaveBeenCalledOnce()
})
it('ignores stale, deleted or foreign preferences without blocking startup',async()=>{
 storage({schemaVersion:1,conversationId:'foreign'})
 const recent=chat('recent')
 expect(await startupWorkspace('owner',recent,async id=>chat(id,'someone-else'),vi.fn())).toEqual(recent)
 expect(await startupWorkspace('owner',recent,async()=>{throw Error('deleted')},vi.fn())).toEqual(recent)
})
it('scopes remembered IDs to the local owner and rejects malformed IDs',async()=>{
 const data=storage();rememberWorkspace('owner','workspace');rememberWorkspace('owner','../unsafe')
 expect(JSON.parse(data.get('hadron:last-workspace:owner')!).conversationId).toBe('workspace')
 const get=vi.fn();expect(await startupWorkspace('another-owner',undefined,get,vi.fn())).toBeUndefined();expect(get).not.toHaveBeenCalled()
})
