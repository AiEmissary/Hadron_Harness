import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {useParams,useLocation} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {useChatNavigate} from '../components/ChatSelection/ChatSelectionProvider'
import {useAuth} from '../hooks/useAuth'
import {gwApi} from '../utils/api'
import {DesktopWorkspaceRuntime} from '../features/collaboration/workspaceDesktop'
import {refreshProviderChoices} from '../features/collaboration/providerChoices'
import {rememberWorkspace} from '../features/collaboration/startupWorkspace'
import type {ParticipantOption} from '../features/collaboration/setup'
import type {WorkspaceChat} from '../features/collaboration/unifiedWorkspace'
import type {ConversationSelection} from '../features/collaboration/workspaceActions'
import {UnifiedWorkspace} from '../components/UnifiedWorkspace/UnifiedWorkspace'
import {UnifiedWorkspaceHelp} from '../components/UnifiedWorkspace/UnifiedWorkspaceHelp'
import {WorkspaceDestination,type SelectionProject} from '../components/UnifiedWorkspace/WorkspaceDestination'
import {WorkspaceTextDialog} from '../components/UnifiedWorkspace/WorkspaceTextDialog'
import {SubscriptionConnections} from '../components/CollaborationPanel/SubscriptionConnections'
import {AttachmentPicker} from '../components/CollaborationPanel/AttachmentPicker'
import type {MessageAction,MessageExcerpts} from '../components/UnifiedWorkspace/UnifiedChatSurface'

// Navigation detaches the viewer, not the task. Registries are scoped to the
// authenticated local owner; changing accounts disposes all old observers.
const runtimes=new Map<string,DesktopWorkspaceRuntime>()
let runtimeOwner:string|undefined
export default function DesktopWorkspace(){
 const {projectId,id}=useParams<{projectId:string;id:string}>(),{userId}=useAuth(),navigate=useChatNavigate(),location=useLocation(),queries=useQueryClient()
 const [runtime,setRuntime]=useState<DesktopWorkspaceRuntime|null>(null),[error,setError]=useState(''),[,setOpened]=useState(0)
 useLayoutEffect(()=>{
  if(!projectId||!id||!userId)return
  if(runtimeOwner!==userId){for(const runtime of runtimes.values())runtime.dispose();runtimes.clear();runtimeOwner=userId}
  let current=true,instance=runtimes.get(projectId)
  if(!instance){instance=new DesktopWorkspaceRuntime(userId,projectId,window.electronAPI,gwApi,async chat=>{const destination=runtimes.get(chat.projectId);if(destination?.session?.getSnapshot().state.chats[chat.id])await destination.reload(chat.id,true);navigate(`/chat/${chat.projectId}/${chat.id}`)});runtimes.set(projectId,instance)}
  setError('');setRuntime(instance)
  void instance.open(id).then(session=>{if(current&&session){setRuntime(instance!);setOpened(value=>value+1);rememberWorkspace(userId,id);void queries.invalidateQueries({queryKey:['conversations']});void queries.invalidateQueries({queryKey:['projects']});if(location.state?.hadronContinuousSessionId)void instance!.openContinuous(location.state.hadronContinuousWorkspaceId??id,location.state.hadronContinuousSessionId).catch(error=>setError(error.message));else if(location.hash){const selected=decodeURIComponent(location.hash.slice(1));if(session.getSnapshot().state.chats[id]?.messages.some(message=>message.id===selected))session.dispatch({type:'select-message',chatId:id,id:selected})}}}).catch(error=>{if(current)setError(error instanceof Error?error.message:'This saved chat could not be opened.')})
  return()=>{current=false}
 },[projectId,id,userId,navigate,location.key])
 if(error)return <div role='alert' style={{padding:24}}>{error} Your saved work has not been replaced. Choose the chat again in the sidebar to retry.</div>
 if(!runtime?.session||runtime.projectId!==projectId||!runtime.session.getSnapshot().state.chats[id??''])return <div role='status' style={{padding:24}}>Opening saved conversation…</div>
 return <DesktopConversation runtime={runtime} navigate={chat=>navigate(`/chat/${chat.projectId}/${chat.id}`)}/>
}
function DesktopConversation({runtime,navigate}:{runtime:DesktopWorkspaceRuntime;navigate(chat:WorkspaceChat):void}){
 const queries=useQueryClient(),picker=useRef<HTMLInputElement>(null),pickingChat=useRef<string|null>(null),agentNavigation=useRef(0)
 const [providers,setProviders]=useState<ParticipantOption[]>([]),[filesBusy,setFilesBusy]=useState(false),[revision,setRevision]=useState(0)
 const [destination,setDestination]=useState<{selection:ConversationSelection;move:boolean;newChat:boolean;projects:SelectionProject[];id:string}|null>(null)
 const [textDialog,setTextDialog]=useState<{title:string;initial:string;readOnly?:boolean;save?:(text:string)=>Promise<void>}|null>(null)
 const [attachmentChat,setAttachmentChat]=useState<WorkspaceChat|null>(null)
 useEffect(()=>{
  let alive=true
  void refreshProviderChoices({setup:()=>window.electronAPI.collaboration.setup(),claudeModels:()=>window.electronAPI.continuousChat.claudeModels()},{setup:()=>{},provider:provider=>{if(alive)setProviders(current=>[...current.filter(item=>item.provider!==provider.provider),provider])},error:provider=>{if(alive){const state=runtime.session.getSnapshot().state;runtime.session.error(state.activeChatId,`${provider} could not be checked. Open the three dots to check its connection.`)}}})
  return()=>{alive=false}
 },[runtime,revision])
 useEffect(()=>{const changed=()=>setRevision(value=>value+1);window.addEventListener('hadron-subscription-changed',changed);window.addEventListener('focus',changed);return()=>{window.removeEventListener('hadron-subscription-changed',changed);window.removeEventListener('focus',changed)}},[])
 useEffect(()=>{
  let previous=runtime.session.getSnapshot().state.chats
  return runtime.session.subscribe(()=>{const current=runtime.session.getSnapshot().state.chats;const ended=Object.values(current).some(chat=>chat.jobState==='idle'&&previous[chat.id]&&previous[chat.id].jobState!=='idle');previous=current;if(ended)window.dispatchEvent(new Event('hadron-subscription-changed'))})
 },[runtime])
 useEffect(()=>{const restore=()=>{const state=runtime.session.getSnapshot().state;void runtime.reload(state.activeChatId).catch(error=>runtime.session.error(state.activeChatId,error.message))};window.addEventListener('hadron-workspace-restored',restore);return()=>window.removeEventListener('hadron-workspace-restored',restore)},[runtime])
 const refresh=async()=>{await Promise.all([queries.invalidateQueries({queryKey:['projects']}),queries.invalidateQueries({queryKey:['conversations']}),queries.invalidateQueries({queryKey:['recentConversations']})])}
 const action=async(chat:WorkspaceChat,name:MessageAction,ids:string[],excerpts?:MessageExcerpts)=>{
  const selection={chatId:chat.id,ids,excerpts},messages=chat.messages.filter(message=>ids.includes(message.id))
  try{
   if(name==='copy'){await navigator.clipboard.writeText(messages.map(message=>excerpts?.[message.id]?.text??message.text).join('\n\n'));return}
   if(name==='branch'){runtime.session.dispatch({type:'select-message',chatId:chat.id,id:messages.at(-1)?.id??null});return}
   if(name==='delete'){await runtime.actions.remove(selection);await refresh();return}
   if(['copy-to','move-to','copy-new','move-new'].includes(name)){setDestination({selection,move:name.startsWith('move'),newChat:name.endsWith('new'),projects:await runtime.projects(),id:crypto.randomUUID()});return}
   if(name==='note'){setTextDialog({title:'Note for selection',initial:messages[0]?.note??'',save:async text=>{await runtime.actions.note(selection,text)}});return}
   if(name==='info'){setTextDialog({title:'Message information',readOnly:true,initial:JSON.stringify(messages.map(({text,context,images,...metadata})=>({...metadata,characters:text.length,attachedContextCharacters:context?.length??0,...(images?.length?{attachedPictures:images.map(image=>image.name)}:{})})),null,2)});return}
   if(name==='edit'&&messages.length===1){
    const message=messages[0]
    setTextDialog({title:'Edit message',initial:message.text,save:async text=>{
     await runtime.persistence.mutate([chat.id],async saved=>{
      const current=saved.get(chat.id)!
      if(current.chat.jobState!=='idle')throw Error('Wait for this reply to finish before editing it.')
      if(current.chat.messages.find(item=>item.id===message.id)?.text!==message.text)throw Error('This message changed. Open Edit again to use its latest text.')
      const next=await window.electronAPI.workspaceArchive.save({...current.chat,messages:current.chat.messages.map(item=>item.id===message.id?{...item,text,edited:true}:item)},current.revision)
      runtime.session.dispatch({type:'replace-messages',chatId:chat.id,messages:next.chat.messages,selectedId:next.chat.selectedId});runtime.persistence.accept(next)
     })
    }});return
   }
  }catch(error){runtime.session.error(chat.id,error instanceof Error?error.message:'This selection could not be used.')}
 }
 return <div className='hadron-desktop-workspace' style={{height:'100%',minHeight:0,padding:6,boxSizing:'border-box',position:'relative'}}>
  <UnifiedWorkspace session={runtime.session} disabled={filesBusy} providers={providers} help={<UnifiedWorkspaceHelp/>} connections={<SubscriptionConnections compact/>}
   onChatChange={chat=>{const version=++agentNavigation.current;void runtime.persistence.flush(chat.id).then(async()=>{await refresh();if(version===agentNavigation.current&&runtime.session.getSnapshot().state.activeChatId===chat.id)navigate(chat)}).catch(()=>{})}}
   attachFiles={async chat=>{if(filesBusy)throw Error('Finish the current attachment selection first.');pickingChat.current=chat.id;setAttachmentChat(chat);queueMicrotask(()=>picker.current?.click())}}
   chooseFolder={chat=>runtime.chooseFolder(chat)} messageAction={(...args)=>void action(...args)}/>
  <div className='hadron-v2-attachments' style={{position:'absolute',left:24,bottom:115,zIndex:5}}>
   <AttachmentPicker pickerRef={picker} compact label='Attach files to chat' files={attachmentChat?.attachments??[]} disabled={filesBusy} onBusy={setFilesBusy} onFiles={files=>{
    const id=pickingChat.current;if(id)runtime.session.dispatch({type:'attachments',chatId:id,files})
   }}/>
  </div>
  {destination&&<WorkspaceDestination projects={destination.projects} sourceProjectId={runtime.projectId} sourceChatId={destination.selection.chatId} move={destination.move} newChat={destination.newChat} onApply={async chosen=>{await runtime.actions.transfer(destination.selection,chosen,destination.move,destination.id);await refresh()}} onClose={()=>setDestination(null)}/>}
  {textDialog&&<WorkspaceTextDialog title={textDialog.title} initial={textDialog.initial} readOnly={textDialog.readOnly} onSave={textDialog.save} onClose={()=>setTextDialog(null)}/>}
 </div>
}
