import {createRoot} from 'react-dom/client'
import {UnifiedWorkspace} from '../../src/components/UnifiedWorkspace/UnifiedWorkspace'
import {WorkspaceSession} from '../../src/features/collaboration/workspaceSession'
import {blankWorkspaceChat,workspaceMessagePath,type WorkspaceWorkType} from '../../src/features/collaboration/unifiedWorkspace'
import type {WorkspaceRunRequest} from '../../src/features/collaboration/workspaceRunner'

let count=0,fail=false
const requests:WorkspaceRunRequest[]=[],externalActions:string[]=[]
const makeChat=(id:WorkspaceWorkType)=>({...blankWorkspaceChat('fixture',id),workType:id,
 models:{a:{provider:'openaichatgpt' as const,modelName:'test-a'},b:{provider:'claudecode' as const,modelName:'test-b'}},
 draft:'Keep my bottom draft.',attachments:[{id:'pending',name:'Pending.txt',text:'UNSENT FACTS'}],
 messages:[
  {id:'q0',parentId:null,role:'user' as const,text:'First question',state:'completed' as const},
  {id:'a0',parentId:'q0',role:'assistant' as const,text:'First answer',state:'completed' as const},
  {id:'q1',parentId:'a0',role:'user' as const,text:'Original question',state:'completed' as const},
  {id:'a1',parentId:'q1',role:'assistant' as const,text:'Original answer',state:'completed' as const},
 ],selectedId:'a1'})
const session=new WorkspaceSession('fixture','individual',{create:(request,changed)=>{
 if(fail)throw Error('Fixture validation failure')
 requests.push(request)
 return {start:async()=>{changed({text:'New branch answer',state:'completed'})},recover:async()=>{},stop:async()=>{},dispose:()=>{}}
}},()=>`branch-${++count}`,makeChat('individual'))
for(const type of ['together','continuous'] as const)session.open(makeChat(type))
session.dispatch({type:'select-chat',id:'individual'})
Object.assign(window,{
 fixture:()=>{const snapshot=session.getSnapshot(),chat=snapshot.state.chats[snapshot.state.activeChatId];return {chat,requests,externalActions,path:workspaceMessagePath(chat),error:snapshot.errors[chat.id]}},
 fixtureSwitch:(id:string)=>session.dispatch({type:'select-chat',id}),
 fixtureFail:(value:boolean)=>{fail=value},
})
createRoot(document.getElementById('root')!).render(<UnifiedWorkspace session={session}
 providers={[{provider:'openaichatgpt',label:'ChatGPT',connected:true,models:[{id:'test-a',label:'Test A'}]},{provider:'claudecode',label:'Claude',connected:true,models:[{id:'test-b',label:'Test B'}]}]}
 help={<span>How to use Hadron</span>} attachFiles={async()=>{}} chooseFolder={async()=>null} messageAction={(_chat,name)=>externalActions.push(name)}/>)
