import {afterEach,expect,it,vi} from 'vitest'
import {rememberConversationFolder,startConversationWork,workChoices,workContext,projectChoices} from './conversationWork'
import {receiveWorkflowDraft} from './workflowDraft'
afterEach(()=>vi.unstubAllGlobals())
function fixture(){const events=new EventTarget(),api={availability:vi.fn(async()=>({ready:true})),fromFolder:vi.fn(async()=>({id:'proposal',label:'selected project',sourcePaths:[]})),choose:vi.fn(async()=>null),list:vi.fn(async()=>[]),start:vi.fn(),apply:vi.fn()};vi.stubGlobal('window',{addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),electronAPI:{projectDraft:api}});return api}
const choices={a:{provider:'openaichatgpt',modelName:'model-a'},b:{provider:'claudecode',modelName:'model-b'}}
it('uses only the chosen main agent for a self-check and preserves both agents for peer work',()=>{
 expect(workChoices('b',choices)).toEqual({models:{a:'model-b',b:'model-b'},providers:{a:'claudecode',b:'claudecode'}})
 expect(workChoices('a',choices).models).toEqual({a:'model-a',b:'model-a'})
 expect(workChoices('both',choices).models).toEqual({a:'model-a',b:'model-b'})
 expect(()=>workChoices('both',{a:choices.a})).toThrow('Agent B')
 expect(projectChoices({participation:'b',models:{a:'model-b',b:'model-b'},providers:{a:'claudecode',b:'claudecode'}})).toEqual({b:choices.b})
})
it('transfers the selected conversation and a fresh host proposal grant without minting file approval',async()=>{
 const api=fixture(),receive=vi.fn(),stop=receiveWorkflowDraft('work','project',receive)
 rememberConversationFolder('work','b',{id:'read-b',label:'project'})
 expect(await startConversationWork({workspace:'work',slot:'b',text:'Fix it',context:'Earlier discussion',actor:'b',choices,permission:'ask'})).toBe(true)
 expect(api.fromFolder).toHaveBeenCalledWith('work','b','read-b')
 expect(receive.mock.calls[0][2].projectWork).toMatchObject({context:'Earlier discussion',participation:'b',grant:{id:'proposal'},permission:'ask',models:{a:'model-b',b:'model-b'}})
 expect(api.start).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();stop();rememberConversationFolder('work','b',null)
})
it('requires a new folder choice after expiry and leaves cancellation without work',async()=>{
 const api=fixture();rememberConversationFolder('work','b',null)
 expect(await startConversationWork({workspace:'work',slot:'b',text:'Fix it',context:'context',actor:'b',choices,permission:'ask'})).toBe(false)
 expect(api.choose).toHaveBeenCalledWith('work');expect(api.fromFolder).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled()
})
it('marks bounded context explicitly and keeps recent selected text',()=>{const text=workContext('EARLIER'+'.'.repeat(20000)+'RECENT');expect(text).toContain('Earlier conversation omitted');expect(text).toContain('RECENT');expect(text).not.toContain('EARLIER');expect(text.length).toBeLessThan(14000)})
