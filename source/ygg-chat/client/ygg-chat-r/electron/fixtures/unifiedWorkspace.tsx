import React,{useState,useSyncExternalStore} from 'react'
import {createRoot} from 'react-dom/client'
import {UnifiedWorkspace} from '../../src/components/UnifiedWorkspace/UnifiedWorkspace'
import {WorkspaceDestination,type SelectionDestination} from '../../src/components/UnifiedWorkspace/WorkspaceDestination'
import {UnifiedWorkspaceHelp} from '../../src/components/UnifiedWorkspace/UnifiedWorkspaceHelp'
import type {MessageAction,MessageExcerpts} from '../../src/components/UnifiedWorkspace/UnifiedChatSurface'
import {WorkspaceSession} from '../../src/features/collaboration/workspaceSession'
import type {WorkspaceChat} from '../../src/features/collaboration/unifiedWorkspace'
import type {ParticipantOption} from '../../src/features/collaboration/setup'

const providers:ParticipantOption[]=[{provider:'openaichatgpt',label:'ChatGPT',connected:true,models:[{id:'fixture-a',label:'Model A'}]},{provider:'claudecode',label:'Claude',connected:true,models:[{id:'fixture-b',label:'Model B'}]}]
const session=new WorkspaceSession('fixture-project','chat-a',{create(request,changed){return {
 async start(){changed({text:`Reply from ${request.workType==='individual'?'Agent '+request.agent.toUpperCase():'both agents'}: ${request.question.text}`,state:'completed'})},
 async stop(){changed({text:'Stopped.',state:'stopped'})},async recover(){},dispose(){},
}}})
session.dispatch({type:'configure',chatId:'chat-a',models:{a:{provider:'openaichatgpt',modelName:'fixture-a'}}})
function Fixture(){
 const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot),[info,setInfo]=useState(''),[destination,setDestination]=useState<{move:boolean;newChat:boolean}|null>(null),[chosen,setChosen]=useState<SelectionDestination|null>(null)
 const action=(chat:WorkspaceChat,action:MessageAction,ids:string[],excerpts?:MessageExcerpts)=>{
  const message=chat.messages.find(message=>message.id===ids[0])
  if(action==='branch')session.dispatch({type:'select-message',chatId:chat.id,id:ids[0]})
  else if(action==='edit'&&message)session.dispatch({type:'draft',chatId:chat.id,text:message.text})
  else {setInfo(JSON.stringify({action,ids,excerpts}));if(['copy-to','move-to','copy-new','move-new'].includes(action))setDestination({move:action.startsWith('move'),newChat:action.endsWith('new')})}
 }
 return <><UnifiedWorkspace session={session} providers={providers} connections={<p>Subscription connections</p>}
  help={<UnifiedWorkspaceHelp/>}
  attachFiles={async()=>{setInfo('attach-files')}} chooseFolder={async()=>({id:'fixture-grant',label:'Fixture project folder'})}
  messageAction={action}/>
  {destination&&<WorkspaceDestination {...destination} projects={[{id:'fixture-project',title:'Fixture project',chats:[{id:'destination-chat',title:'Existing chat'}]}]} sourceChatId={snapshot.state.activeChatId} sourceProjectId='fixture-project' onApply={async value=>setChosen(value)} onClose={()=>setDestination(null)}/>}
  <output hidden data-fixture-state>{JSON.stringify({...snapshot,info,chosen})}</output></>
}

document.body.style.cssText='margin:0;height:100vh;font-family:Arial,sans-serif;background:#e5e7eb;padding:8px;box-sizing:border-box'
document.getElementById('root')!.style.height='100%'
createRoot(document.getElementById('root')!).render(<Fixture/> )
