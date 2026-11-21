import {expect,it} from 'vitest'
import {blankWorkspaceChat,initialUnifiedWorkspace,unifiedWorkspaceReducer as reduce,workspaceMessagePath} from './unifiedWorkspace'

it('opens another chat without replacing a running chat, its draft, branch or scroll position',()=>{
 let state=initialUnifiedWorkspace('project','chat-a')
 state=reduce(state,{type:'draft',chatId:'chat-a',text:'An unsent question'})
 state=reduce(state,{type:'scroll',chatId:'chat-a',top:480})
 state=reduce(state,{type:'message',chatId:'chat-a',message:{id:'q',parentId:null,role:'user',text:'Working question',state:'completed'}})
 state=reduce(state,{type:'job',chatId:'chat-a',id:'running-a',state:'running'})
 const a=state.chats['chat-a']
 state=reduce(state,{type:'open',chat:blankWorkspaceChat('project','chat-b','b')})
 expect(state.activeChatId).toBe('chat-b');expect(state.chats['chat-a']).toBe(a)
 state=reduce(state,{type:'draft',chatId:'chat-b',text:'B draft'})
 state=reduce(state,{type:'select-chat',id:'chat-a'})
 expect(state.activeChatId).toBe('chat-a');expect(state.chats['chat-a']).toBe(a)
 expect(state.chats['chat-b'].draft).toBe('B draft')
 expect(()=>reduce(state,{type:'job',chatId:'chat-a',id:'replacement',state:'running'})).toThrow('cannot be replaced')
})
it('keeps the same conversation and folder when choosing work type or permissions',()=>{
 let state=initialUnifiedWorkspace('project','chat')
 state=reduce(state,{type:'folder',chatId:'chat',folder:{id:'live-grant',label:'project folder'}})
 state=reduce(state,{type:'draft',chatId:'chat',text:'Keep this question'})
 state=reduce(state,{type:'configure',chatId:'chat',workType:'together'})
 expect(state.chats.chat.permission).toBe('chat')
 state=reduce(state,{type:'configure',chatId:'chat',permission:'agent'})
 expect(state.activeChatId).toBe('chat');expect(state.chats.chat.folder.id).toBe('live-grant');expect(state.chats.chat.draft).toBe('Keep this question')
 state=reduce(state,{type:'configure',chatId:'chat',workType:'continuous',maxTurns:100})
 expect(state.chats.chat.permission).toBe('chat');expect(state.chats.chat.maxTurns).toBe(100)
 expect(()=>reduce(state,{type:'configure',chatId:'chat',maxTurns:101})).toThrow('1 to 100')
})
it('keeps the current chat and selected branch when changing agents',()=>{
 const folder={id:'project-folder',label:'Working folder'}
 const attachments=[{id:'notes',name:'notes.md',text:'Research notes'}]
 const messages=[{id:'question',parentId:null,role:'user' as const,text:'Earlier question',state:'completed' as const},
  {id:'answer',parentId:'question',role:'assistant' as const,agent:'a' as const,text:'Agent A reply',state:'completed' as const}]
 const current={...blankWorkspaceChat('project','chat'),messages,selectedId:'question',folder,attachments,draft:'Unsent follow-up',scrollTop:480,permission:'agent' as const}
 const other={...blankWorkspaceChat('project','other','b'),draft:'Different chat'}
 let state=initialUnifiedWorkspace('project','other')
 state={...state,chats:{other}}
 state=reduce(state,{type:'open',chat:current})
 state=reduce(state,{type:'configure',chatId:'chat',agent:'b'})
 expect(state.activeChatId).toBe('chat')
 expect(state.chats.chat).toMatchObject({...current,agent:'b'})
 expect(state.chats.other).toBe(other)
 state=reduce(state,{type:'configure',chatId:'chat',agent:'a'})
 expect(state.chats.chat).toMatchObject(current)
 expect(Object.keys(state.chats)).toEqual(['other','chat'])
 state=reduce(state,{type:'job',chatId:'chat',id:'in-progress',state:'running'})
 expect(()=>reduce(state,{type:'configure',chatId:'chat',agent:'b'})).toThrow('finish')
})
it('reuses both individual model choices when switching from B to shared work, without copying chats or replacing explicit choices',()=>{
 let state=initialUnifiedWorkspace('project','a')
 state=reduce(state,{type:'configure',chatId:'a',models:{a:{provider:'openaichatgpt',modelName:'chosen-a'}}})
 state=reduce(state,{type:'draft',chatId:'a',text:'A draft stays separate'})
 state=reduce(state,{type:'open',chat:blankWorkspaceChat('project','b','b')})
 state=reduce(state,{type:'configure',chatId:'b',models:{b:{provider:'claudecode',modelName:'chosen-b'}}})
 const originalA=state.chats.a
 state=reduce(state,{type:'configure',chatId:'b',workType:'together'})
 expect(state.chats.b.models).toEqual({a:{provider:'openaichatgpt',modelName:'chosen-a'},b:{provider:'claudecode',modelName:'chosen-b'}})
 expect(state.chats.a).toBe(originalA);expect(state.chats.b.messages).toEqual([])
 state=reduce(state,{type:'configure',chatId:'b',models:{...state.chats.b.models,a:{provider:'openaichatgpt',modelName:'explicit-a'}},workType:'continuous'})
 expect(state.chats.b.models.a?.modelName).toBe('explicit-a')
})
it('keeps branch histories while a different branch is streaming',()=>{
 let state=initialUnifiedWorkspace('project','chat')
 for(const message of [
  {id:'q',parentId:null,role:'user' as const,text:'Question',state:'completed' as const},
  {id:'a',parentId:'q',role:'assistant' as const,text:'Answer',state:'completed' as const},
  {id:'left',parentId:'a',role:'user' as const,text:'Left branch',state:'completed' as const},
  {id:'right',parentId:'a',role:'user' as const,text:'Right branch',state:'completed' as const},
 ])state=reduce(state,{type:'message',chatId:'chat',message})
 state=reduce(state,{type:'select-message',chatId:'chat',id:'left'})
 state=reduce(state,{type:'message',chatId:'chat',message:{id:'reply',parentId:'right',role:'assistant',text:'Right reply',state:'running'}})
 expect(workspaceMessagePath(state.chats.chat).map(message=>message.id)).toEqual(['q','a','left'])
 expect(state.chats.chat.messages).toHaveLength(5)
})
it('does not reload a stale saved snapshot over in-progress local work',()=>{
 let state=initialUnifiedWorkspace('project','chat')
 state=reduce(state,{type:'draft',chatId:'chat',text:'New draft'})
 const chat=state.chats.chat
 state=reduce(state,{type:'open',chat:blankWorkspaceChat('project','chat')})
 expect(state.chats.chat).toBe(chat)
 expect(()=>reduce(state,{type:'open',chat:blankWorkspaceChat('another-project','foreign')})).toThrow('another project')
})
it('lets a free agent continue a newly imported selection without abandoning it or overwriting another saved chat',()=>{
 let state=initialUnifiedWorkspace('project','a')
 state=reduce(state,{type:'open',chat:blankWorkspaceChat('project','old-b','b')})
 state=reduce(state,{type:'draft',chatId:'old-b',text:'B draft stays here'})
 const imported={...blankWorkspaceChat('project','imported'),selectedId:'selection',messages:[{id:'selection',parentId:null,role:'assistant' as const,text:'Copied findings',state:'completed' as const,reference:{chatId:'source',messageId:'answer',capturedAt:1,state:'completed' as const}}]}
 state=reduce(state,{type:'open',chat:imported})
 state=reduce(state,{type:'configure',chatId:'imported',agent:'b'})
 expect(state.activeChatId).toBe('imported');expect(state.chats.imported.agent).toBe('b');expect(state.chats.imported.messages[0].text).toBe('Copied findings')
 expect(state.chats['old-b'].draft).toBe('B draft stays here');expect(Object.keys(state.chats)).toEqual(['a','old-b','imported'])
})

it('distinguishes an intentional scroll to the top from following the latest reply',()=>{
 let state=initialUnifiedWorkspace('project','a')
 state=reduce(state,{type:'scroll',chatId:'a',top:0,following:false})
 state=reduce(state,{type:'open',chat:blankWorkspaceChat('project','b','b')})
 state=reduce(state,{type:'select-chat',id:'a'})
 expect(state.chats.a.scrollTop).toBe(0)
 expect(state.chats.a.followLatest).toBe(false)
})
it('uses current agent ownership when opening an obsolete saved snapshot',()=>{
 let state=initialUnifiedWorkspace('project','a')
 const snapshot={...blankWorkspaceChat('project','a'),agent:'b' as const}
 state=reduce(state,{type:'open',chat:snapshot})
 expect(state.agentChats.b).toBeUndefined()
 expect(state.agentChats.a).toBe('a')
})
it('does not pull the reader off an explicitly selected earlier question while its answer streams',()=>{
 let state=initialUnifiedWorkspace('project','chat')
 const question={id:'q',parentId:null,role:'user' as const,text:'Question',state:'completed' as const}
 const answer={id:'answer',parentId:'q',role:'assistant' as const,text:'Working answer',state:'running' as const}
 state=reduce(state,{type:'message',chatId:'chat',message:question})
 state=reduce(state,{type:'message',chatId:'chat',message:answer})
 state=reduce(state,{type:'select-message',chatId:'chat',id:'q'})
 state=reduce(state,{type:'message',chatId:'chat',message:{...answer,text:'More answer'}})
 expect(state.chats.chat.selectedId).toBe('q')
})

it('hands the same shared discussion to either single agent without replacing existing private chats',()=>{
 let state=initialUnifiedWorkspace('project','old-a')
 state=reduce(state,{type:'draft',chatId:'old-a',text:'A private draft'})
 state=reduce(state,{type:'open',chat:blankWorkspaceChat('project','old-b','b')})
 state=reduce(state,{type:'draft',chatId:'old-b',text:'B private draft'})
 state=reduce(state,{type:'open',chat:{...blankWorkspaceChat('project','shared'),workType:'together',permission:'agent',folder:{id:'folder',label:'fixture'},draft:'Next instruction',selectedId:'answer',messages:[{id:'answer',parentId:null,role:'assistant',agent:'both',text:'Shared conclusions',state:'completed'}]}})
 state=reduce(state,{type:'configure',chatId:'shared',workType:'individual'})
 state=reduce(state,{type:'configure',chatId:'shared',agent:'b'})
 expect(state.activeChatId).toBe('shared');expect(state.chats.shared.agent).toBe('b')
 expect(state.chats.shared.messages[0].text).toBe('Shared conclusions');expect(state.chats.shared.draft).toBe('Next instruction')
 expect(state.chats.shared.permission).toBe('agent');expect(state.chats.shared.folder?.id).toBe('folder')
 expect(state.chats['old-a'].draft).toBe('A private draft');expect(state.chats['old-b'].draft).toBe('B private draft');expect(Object.keys(state.chats)).toEqual(['old-a','old-b','shared'])
 state=reduce(state,{type:'configure',chatId:'shared',workType:'together'})
 expect(state.chats.shared.messages).toHaveLength(1)
})

it('chooses a single agent atomically when leaving shared mode and keeps the same branch',()=>{
 let state=initialUnifiedWorkspace('project','chat')
 state=reduce(state,{type:'configure',chatId:'chat',workType:'together',models:{a:{provider:'openaichatgpt',modelName:'model-a'},b:{provider:'claudecode',modelName:'model-b'}}})
 state=reduce(state,{type:'message',chatId:'chat',message:{id:'answer',parentId:null,role:'assistant',agent:'both',text:'Shared result',state:'completed'}})
 state=reduce(state,{type:'draft',chatId:'chat',text:'Give me your own opinion'})
 state=reduce(state,{type:'configure',chatId:'chat',workType:'individual',agent:'b'})
 expect(state.activeChatId).toBe('chat');expect(state.chats.chat.agent).toBe('b');expect(state.chats.chat.selectedId).toBe('answer');expect(state.chats.chat.draft).toBe('Give me your own opinion')
 state=reduce(state,{type:'configure',chatId:'chat',workType:'together'})
 state=reduce(state,{type:'configure',chatId:'chat',workType:'individual',agent:'a'})
 expect(state.chats.chat.agent).toBe('a');expect(state.chats.chat.messages[0].text).toBe('Shared result');expect(Object.keys(state.chats)).toEqual(['chat'])
})

it('inherits the last chosen A and B models when creating another independent agent chat',()=>{
 let state=initialUnifiedWorkspace('project','a')
 state=reduce(state,{type:'configure',chatId:'a',models:{a:{provider:'openaichatgpt',modelName:'chosen-a'},b:{provider:'claudecode',modelName:'chosen-b'}}})
 state=reduce(state,{type:'open',chat:blankWorkspaceChat('project','b','b')})
 expect(state.chats.b.models).toEqual(state.chats.a.models)
 expect(state.chats.b.messages).toEqual([])
 expect(state.chats.b.folder).toBeUndefined()
})
