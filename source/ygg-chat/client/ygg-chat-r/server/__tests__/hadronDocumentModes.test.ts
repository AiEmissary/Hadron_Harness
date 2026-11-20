import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {ContinuousChatService,continuousTurnToolSession} from '../hadronTools/continuousChat.js'
import {withDocumentTools,DOCUMENT_MIN_REQUESTS} from '../hadronTools/documentTools.js'
import {admitHadronToolSession,runHadronToolConversation} from '../hadronTools/types.js'
import {parseProposalSession} from '../../../../shared/collaboration.js'
import {continuousWorkspaceTransport} from '../../src/features/collaboration/workspaceContinuousTransport'
import {sharedWorkspaceTransport} from '../../src/features/collaboration/workspaceSharedTransport'
import type {WorkspaceRunRequest} from '../../src/features/collaboration/workspaceRunner'
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')

const book={name:'Book.pdf',text:'Page 1\n'+'A long chapter about eagles. '.repeat(20000)}
let root:string,db:any,service:ContinuousChatService,seen:Array<{id:string;documents:number}>
beforeEach(()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-docmodes-'));db=new DatabaseSync(path.join(root,'chat.db'));db.exec('PRAGMA synchronous=FULL');seen=[]
 service=new ContinuousChatService(db,{authorize:()=>{},allowedModels:new Set(['model-a','model-b']),
  generate:async(_owner,input,_role,_prompt,_signal,onPrepared,packet)=>{
   const binding={runId:'run-'+seen.length+input.id,handle:'h-'+seen.length+input.id,streamId:'s-'+seen.length+input.id}
   if(packet.kind!=='continuous_memory')seen.push({id:input.id,documents:service.documents(input.id).length});onPrepared(binding)
   return {text:'Reply',binding}
  },cancel:vi.fn(),join:async()=>{}})
})
afterEach(async()=>{await service.shutdown();fs.rmSync(root,{recursive:true,force:true})})
async function ended(id:string){for(let step=0;step<500;step++){if(service.status('owner',id).workersEnded)return;await new Promise(resolve=>setImmediate(resolve))}throw Error('Conversation did not settle')}
const start=(extra:object={})=>({id:'c1',workspaceId:'w',anchorMessageId:'anchor',goal:'Read the attached book.',models:{a:'model-a',b:'model-b'},maxTurns:2,maxSeconds:60,...extra})

it('keeps continuous conversation documents beside the session, out of its polled view, and through continuations',async()=>{
 service.start('owner',start({documents:[book]}));await ended('c1')
 expect(service.documents('c1')).toEqual([book])
 const view=service.status('owner','c1')
 expect(JSON.stringify(view)).not.toContain('eagles')
 expect(seen.every(turn=>turn.documents===1)).toBe(true)
 service.continueSaved('owner','c1',{id:'c2',models:{a:'model-a',b:'model-b'},maxTurns:2,maxSeconds:60,instruction:'Continue with chapter 2.'});await ended('c2')
 expect(service.documents('c2')).toEqual([book])
 const replacement={name:'Notes.txt',text:'Other notes'}
 service.continueSaved('owner','c2',{id:'c3',documents:[replacement],models:{a:'model-a',b:'model-b'},maxTurns:2,maxSeconds:60,instruction:'Now the notes.'});await ended('c3')
 expect(service.documents('c3')).toEqual([replacement])
})

it('accepts documents in a Work together task and rejects malformed ones',()=>{
 const base={schemaVersion:1,sessionId:'s',conversationId:'w',sourceLineageId:'l',anchorMessageId:'a',task:'Read it',context:'',participants:[{id:'a',provider:'openaichatgpt',modelName:'m'},{id:'b',provider:'claudecode',modelName:'n'}]}
 expect(parseProposalSession({...base,documents:[book]}).documents).toEqual([book])
 expect(()=>parseProposalSession({...base,documents:[{name:'x'}]})).toThrow()
})

it('gives document tools enough requests to read a long document',()=>{
 const session=admitHadronToolSession({maxRequests:4,instructions:'Base',invoke:async()=>'unused'} as any)
 expect(withDocumentTools(session,[book]).maxRequests).toBe(DOCUMENT_MIN_REQUESTS)
 expect(withDocumentTools(admitHadronToolSession({maxRequests:100,instructions:'Base',invoke:async()=>'unused'} as any),[book]).maxRequests).toBe(100)
})

const request=(workType:'together'|'continuous'):WorkspaceRunRequest=>({id:'r',chatId:'c',projectId:'p',workType,permission:'chat',agent:'a',models:{a:{provider:'openaichatgpt',modelName:'model-a'},b:{provider:'claudecode',modelName:'model-b'}},maxTurns:4,folder:undefined,
 question:{id:'q',parentId:null,role:'user',text:'Summarise chapter 1',state:'completed'},answerId:'ans',path:[],documents:[book]})

it('sends large documents from Work together and Continuous conversation chats',async()=>{
 let shared:any,continuous:any
 const client={prepareTask:async()=>({sourceLineageId:'l',anchorMessageId:'a'}),preflight:async(input:any)=>{shared=input;throw Error('captured')}} as any
 await expect(sharedWorkspaceTransport({client,workspaceId:'w',store:()=>({read:()=>null,write:()=>{},clear:()=>{}})}).create(request('together'),()=>{}).start()).rejects.toThrow('captured')
 expect(shared.documents).toEqual([book])
 const api={start:async(input:any)=>{continuous=input;throw Error('captured')}} as any
 await expect(continuousWorkspaceTransport({api,workspaceId:'w',anchor:async()=>'a',remember:()=>{}}).create(request('continuous'),()=>{}).start()).rejects.toThrow('captured')
 expect(continuous.documents).toEqual([book])
})

it('runs the tool loop with the larger document budget instead of rejecting it',async()=>{
 const session=withDocumentTools(admitHadronToolSession({maxRequests:4,instructions:'Base',invoke:async()=>'unused'} as any),[book])
 const replies=[JSON.stringify({tool:'document_search',arguments:{query:'eagles'}}),JSON.stringify({answer:'Chapter 1 is about eagles.',finished:true})]
 const result=await runHadronToolConversation({session,task:'Summarise chapter 1',signal:new AbortController().signal,generate:async()=>replies.shift()!} as any)
 expect(JSON.stringify(result)).toContain('Chapter 1 is about eagles.')
})

it('gives each continuous turn the document tool list and does not fail a turn that says the discussion continues',async()=>{
 const research=admitHadronToolSession({maxRequests:8,instructions:'Web research tools',invoke:async()=>'unused'} as any)
 const session=continuousTurnToolSession(research,[book])
 expect(session.instructions).toContain('Web research tools')
 expect(session.instructions).toContain('document_read {')
 expect(session.instructions).toContain('"Book.pdf"')
 expect(session.readsDocuments).toBe(true)
 const replies=[JSON.stringify({tool:'document_search',arguments:{query:'eagles'}}),JSON.stringify({answer:'My view on chapter 1; over to you.',finished:false})]
 const result=await runHadronToolConversation({session,task:'Discuss chapter 1',signal:new AbortController().signal,generate:async()=>replies.shift()!} as any)
 expect(JSON.stringify(result)).toContain('over to you')
 expect(session.outcome?.incompleteReason).toBeUndefined()
 expect(continuousTurnToolSession(research,[]).maxRequests).toBe(4)
})
