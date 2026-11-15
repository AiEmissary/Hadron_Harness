import {createRoot} from 'react-dom/client'
import {UnifiedWorkspace} from '../../src/components/UnifiedWorkspace/UnifiedWorkspace'
import {WorkspaceSession} from '../../src/features/collaboration/workspaceSession'
import {blankWorkspaceChat,workspaceMessagePath,type WorkspaceMessage} from '../../src/features/collaboration/unifiedWorkspace'
const chat=blankWorkspaceChat('fixture','transcript')
let parentId:string|null=null
for(let i=0;i<10;i++){
 const question:WorkspaceMessage={id:'q'+i,parentId,role:'user',text:'Question '+i+' — '+('Question context. '.repeat(20)),state:'completed'}
 const answer:WorkspaceMessage={id:'a'+i,parentId:question.id,role:'assistant',agent:'a',text:'Answer '+i+' — '+('Detailed answer line.\n'.repeat(12)),state:'completed'}
 chat.messages.push(question,answer);parentId=answer.id
}
chat.messages.push(
 {id:'fork-q',parentId:'a3',role:'user',text:'Alternative branch question',state:'completed'},
 {id:'fork-a',parentId:'fork-q',role:'assistant',text:'Alternative branch answer.\n'.repeat(12),state:'completed'},
 {id:'fork-q2',parentId:'fork-a',role:'user',text:'Alternative follow-up',state:'completed'},
 {id:'fork-a2',parentId:'fork-q2',role:'assistant',text:'Later alternative reply.\n'.repeat(12),state:'completed'},
)
chat.selectedId='a9';chat.draft='Keep this unsent message.'
const calls:{starts:number;creates:number}={starts:0,creates:0}
const session=new WorkspaceSession('fixture','transcript',{create:()=>{calls.creates++;throw Error('No provider calls in transcript browsing')}} ,undefined,chat)
Object.assign(window,{
 fixture:()=>({selected:session.getSnapshot().state.chats.transcript.selectedId,draft:session.getSnapshot().state.chats.transcript.draft,context:workspaceMessagePath(session.getSnapshot().state.chats.transcript).map(message=>message.id),calls}),
 fixtureUpdate:()=>session.dispatch({type:'message',chatId:'transcript',message:{...chat.messages.find(message=>message.id==='fork-a2')!,text:'Updated alternative reply.\n'.repeat(16)}}),
})
const noop=()=>{}
createRoot(document.getElementById('root')!).render(<UnifiedWorkspace session={session} providers={[]} help={<span>How to use Hadron</span>} attachFiles={async()=>{}} chooseFolder={async()=>null} messageAction={noop}/>)
