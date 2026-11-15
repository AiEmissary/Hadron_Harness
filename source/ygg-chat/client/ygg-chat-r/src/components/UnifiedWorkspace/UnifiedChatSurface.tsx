import {useEffect,useRef,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {isHadronIncompleteRecord} from '../../../../../shared/hadronWorkOutcome'
import {ArrowDown,ArrowUp,Copy,GitBranch,MessageSquare,MoreHorizontal,Paperclip,Pencil,Share2,Square,Trash2} from 'lucide-react'
import type {ParticipantOption} from '../../features/collaboration/setup'
import {workspaceTranscriptPath,type WorkspaceAgent,type WorkspaceChat,type WorkspaceMessage} from '../../features/collaboration/unifiedWorkspace'
import {layoutAgentBranches} from '../../features/collaboration/agentConversation'
import type {AgentConversationNode} from '../../../../../shared/independentJobs'
import {WorkspaceMenu,type WorkspaceMenuProps} from './WorkspaceMenu'
import './unifiedWorkspace.css'
import {workspaceVisuals,workspaceVisualText} from '../../features/collaboration/workspaceVisuals'
import {WorkspaceVisualPreview} from './WorkspaceVisualPreview'

export type MessageAction='copy'|'edit'|'branch'|'delete'|'copy-to'|'move-to'|'copy-new'|'move-new'|'note'|'info'
export type MessageExcerpts=Record<string,{start:number;end:number;text:string}>
export interface UnifiedChatSurfaceProps {
 chat:WorkspaceChat;providers:ReadonlyArray<ParticipantOption>;connections?:ReactNode;help:ReactNode;reasoningControl?:ReactNode;
 error?:string;canSend:boolean;canBranch?:boolean;selectedIds?:ReadonlySet<string>;
 onBranch?(messageId:string,text:string):Promise<boolean>;
 onDraft(text:string):void;onSend():void;onStop():void;onAgent(agent:WorkspaceAgent):void;
 onConfigure:WorkspaceMenuProps['onConfigure'];onFile():void;onFolder():void;
 onRemoveFile?(id:string):void;onLatest(id?:string):void;
 onSelect(id:string,multiple?:boolean):void;onSelection(ids:string[]):void;onMessageAction(action:MessageAction,ids:string[],excerpts?:MessageExcerpts):void;onScroll(top:number,following:boolean):void;
}
const colorAt=(index:number)=>['#2869e6','#268ed9','#12aab0','#56ad59','#c1b929','#e6a01d','#ed742c','#cb282d'][index%8]

/** One transcript/composer/tree surface for all work types and permissions. */
export function UnifiedChatSurface(props:UnifiedChatSurfaceProps){
 const {chat,providers,connections,help,reasoningControl,error,canSend,onDraft,onSend,onStop,onAgent,onConfigure,onFile,onFolder,onSelect,onMessageAction,onScroll}=props
 const [menu,setMenu]=useState(false),[attachments,setAttachments]=useState(false),[more,setMore]=useState<string|null>(null)
 const [visualMessage,setVisualMessage]=useState<string|null>(null)
 const visibleVisuals=workspaceVisuals(chat.messages.find(message=>message.id===visualMessage)?.text??'')
 useEffect(()=>setVisualMessage(null),[chat.id])
 const previousVisualReplies=useRef({chatId:chat.id,completed:new Set(chat.messages.filter(message=>message.state==='completed').map(message=>message.id))})
 useEffect(()=>{
  const previous=previousVisualReplies.current
  // Follow the new answer: visuals open, prose returns to the tree.
  // Opening saved history never opens an older picture automatically.
  if(previous.chatId===chat.id){
   const updated=chat.messages.filter(message=>message.role==='assistant'&&message.state==='completed'&&!previous.completed.has(message.id)).at(-1)
   if(updated)setVisualMessage(workspaceVisuals(updated.text).length>0?updated.id:null)
  }
  previousVisualReplies.current={chatId:chat.id,completed:new Set(chat.messages.filter(message=>message.state==='completed').map(message=>message.id))}
 },[chat.id,chat.messages])
 const [context,setContext]=useState<{x:number;y:number;ids:string[];excerpts?:MessageExcerpts}|null>(null)
 const [branchDrafts,setBranchDrafts]=useState<Record<string,{messageId:string;text:string;previousSelection:string|null;submitting?:boolean;error?:string}>>({})
 const activeChatId=useRef(chat.id);activeChatId.current=chat.id
 const branchDraft=branchDrafts[chat.id],branchInput=useRef<HTMLTextAreaElement>(null),branchSubmitting=useRef(new Set<string>())
 useEffect(()=>{if(branchDraft)branchInput.current?.focus({preventScroll:true})},[chat.id,branchDraft?.messageId])
 const contextMenu=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  if(!context)return
  const close=(event:Event)=>{if(!contextMenu.current?.contains(event.target as Node))setContext(null)}
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setContext(null);return}if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return
   event.preventDefault();const items=Array.from(contextMenu.current?.querySelectorAll<HTMLButtonElement>('button')??[]),index=items.indexOf(document.activeElement as HTMLButtonElement)
   items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus()
  }
  contextMenu.current?.querySelector('button')?.focus({preventScroll:true})
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',key)
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)}
 },[context])
 const transcript=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),follow=useRef(true)
 const branchLeaves=useRef(new Map<string,string>())
 const [browseTarget,setBrowseTarget]=useState<{chatId:string;id:string}|null>(null)
 const [away,setAway]=useState(false)
 const [search,setSearch]=useState(''),[selection,setSelection]=useState<{x:number;y:number;endX:number;endY:number}|null>(null)
 const treeViewport=useRef<HTMLDivElement>(null),pan=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null)
 const suppressTreeClick=useRef(false)
 const treeOffset=useRef({x:0,y:0}),treeSvg=useRef<SVGSVGElement>(null),treeFrame=useRef<number|null>(null)
 const moveTreeTo=(offset:{x:number;y:number})=>{
  treeOffset.current=offset
  if(treeFrame.current!==null)return
  treeFrame.current=requestAnimationFrame(()=>{treeFrame.current=null;const current=treeOffset.current;if(treeSvg.current)treeSvg.current.style.transform=`translate(calc(-50% + ${current.x}px), ${current.y}px)`})
 }
 useEffect(()=>()=>{if(treeFrame.current!==null){cancelAnimationFrame(treeFrame.current);treeFrame.current=null}},[])
 const [treeZoom,setTreeZoom]=useState(1)
 const zoomTree=(value:number)=>{
  const viewport=treeViewport.current,next=Math.max(.25,Math.min(3,Math.round(value*100)/100)),ratio=next/treeZoom
  const cy=(viewport?.clientHeight??0)/2-60
  setTreeZoom(next)
  moveTreeTo({x:treeOffset.current.x*ratio,y:(treeOffset.current.y-cy)*ratio+cy})
 }
 useEffect(()=>{setTreeZoom(1);moveTreeTo({x:0,y:0});pan.current=null;suppressTreeClick.current=false},[chat.id])
 useEffect(()=>{
  const viewport=treeViewport.current;if(!viewport)return
  const wheel=(event:WheelEvent)=>{event.preventDefault();if(event.ctrlKey||event.metaKey)zoomTree(treeZoom*(event.deltaY<0?1.15:1/1.15));else moveTreeTo({x:treeOffset.current.x-event.deltaX,y:treeOffset.current.y-event.deltaY})}
  viewport.addEventListener('wheel',wheel,{passive:false})
  return()=>viewport.removeEventListener('wheel',wheel)
 },[treeZoom,chat.id,chat.messages.length===0])
 const drag=useRef<{x:number;y:number;endX:number;endY:number}|null>(null)
 const path=workspaceTranscriptPath(chat,branchLeaves.current.get(chat.id)),busy=chat.jobState!=='idle'
 useEffect(()=>{const leaf=path.at(-1);if(leaf)branchLeaves.current.set(chat.id,leaf.id);if(branchLeaves.current.size>200)branchLeaves.current.delete(branchLeaves.current.keys().next().value!)},[chat.id,path.at(-1)?.id])
 useEffect(()=>{setContext(null);setMore(null);setAttachments(false);follow.current=chat.followLatest;setAway(!chat.followLatest);if(transcript.current)transcript.current.scrollTop=chat.scrollTop},[chat.id])
 const latest=path.at(-1)?.text
 useEffect(()=>{if(follow.current&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight},[latest,path.length])
 useEffect(()=>{
  if(!browseTarget||browseTarget.chatId!==chat.id||browseTarget.id!==chat.selectedId||!transcript.current)return
  const pane=transcript.current,selected=Array.from(pane.querySelectorAll<HTMLElement>('[data-message-id]')).find(element=>element.dataset.messageId===browseTarget.id)
  if(selected)pane.scrollTo({top:Math.max(0,pane.scrollTop+selected.getBoundingClientRect().top-pane.getBoundingClientRect().top-8),behavior:'instant'})
 },[browseTarget,chat.id,chat.selectedId])
 const selectNode=(id:string,multiple=false)=>{
  if(!multiple){follow.current=false;setAway(true);setBrowseTarget({chatId:chat.id,id})}
  onSelect(id,multiple)
 }
 const labels=(chat.workType==='individual'?[chat.agent]:['a','b'] as const).map(agent=>{
  const model=chat.models[agent],provider=providers.find(provider=>provider.provider===model?.provider)
  return `Agent ${agent.toUpperCase()}${model?.modelName?' · '+(provider?.models.find(option=>option.id===model.modelName)?.label??model.modelName):''}`
 }).join('  /  ')
 const selectionAction=(name:MessageAction,ids:string[],excerpts?:MessageExcerpts)=>{
  if(name==='branch'){
   const source=chat.messages.find(message=>message.id===ids.at(-1));if(!source)return
   setMore(null);setVisualMessage(null)
   if(branchDraft){
    selectNode(branchDraft.messageId)
    if(source.id!==branchDraft.messageId)setBranchDrafts(current=>({...current,[chat.id]:{...current[chat.id],error:'Send or cancel this branch draft before starting another.'}}))
    branchInput.current?.focus({preventScroll:true});return
   }
   setBranchDrafts(current=>({...current,[chat.id]:{messageId:source.id,text:source.role==='user'?source.text:'',previousSelection:chat.selectedId}}))
   selectNode(source.id);return
  }
  onMessageAction(name,ids,excerpts);if(name==='edit')input.current?.focus()
 }
 const action=(name:MessageAction,message:WorkspaceMessage)=>selectionAction(name,name==='branch'?[message.id]:props.selectedIds?.has(message.id)?[...props.selectedIds]:[message.id])
 const removeBranchDraft=(chatId:string)=>setBranchDrafts(current=>{const next={...current};delete next[chatId];return next})
 const cancelBranch=()=>{
  if(!branchDraft||branchSubmitting.current.has(chat.id))return
  removeBranchDraft(chat.id)
  if(branchDraft.previousSelection&&chat.messages.some(message=>message.id===branchDraft.previousSelection))onSelect(branchDraft.previousSelection)
 }
 const sendBranch=async()=>{
  if(!branchDraft||!branchDraft.text.trim()||!props.canBranch||!props.onBranch||branchSubmitting.current.has(chat.id))return
  const chatId=chat.id;branchSubmitting.current.add(chatId)
  setBranchDrafts(current=>({...current,[chatId]:{...current[chatId],submitting:true,error:undefined}}))
  try{
   if(await props.onBranch(branchDraft.messageId,branchDraft.text)){
    removeBranchDraft(chatId)
    if(activeChatId.current===chatId){follow.current=true;setAway(false);setBrowseTarget(null)
     requestAnimationFrame(()=>{if(activeChatId.current===chatId&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight})}
   }else setBranchDrafts(current=>({...current,[chatId]:{...current[chatId],submitting:false,error:'The branch has not been sent. Check the message below.'}}))
  }catch{
   setBranchDrafts(current=>({...current,[chatId]:{...current[chatId],submitting:false,error:'The branch could not be sent. Your draft is still here.'}}))
  }finally{branchSubmitting.current.delete(chatId)}
 }
 const openContext=(event:React.MouseEvent<HTMLElement>,message:WorkspaceMessage,allowText:boolean)=>{
  event.preventDefault();event.stopPropagation();setMore(null)
  let excerpts:MessageExcerpts|undefined
  const selected=window.getSelection(),text=event.currentTarget.querySelector('.hadron-v2-message-text')
  if(allowText&&text&&selected?.rangeCount&&!selected.isCollapsed){
   const range=selected.getRangeAt(0)
   if(text.contains(range.startContainer)&&text.contains(range.endContainer)){
    const before=range.cloneRange();before.selectNodeContents(text);before.setEnd(range.startContainer,range.startOffset)
    const start=before.toString().length,end=start+range.toString().length
    if(end>start&&message.text.slice(start,end)===range.toString())excerpts={[message.id]:{start,end,text:range.toString()}}
   }
  }
  setContext({x:Math.max(8,Math.min(event.clientX,window.innerWidth-272)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-350)),ids:excerpts?[message.id]:props.selectedIds?.has(message.id)?[...props.selectedIds]:[message.id],excerpts})
 }
 const options=[['copy','Copy'],['copy-to','Copy into chat or project'],['move-to','Move into chat or project'],['copy-new','Copy into a new chat'],['move-new','Move into a new chat'],['note','Add note'],['branch','Branch from here'],['delete','Move selection to bin'],['info','Message information']] as const
 const toolbar=(message:WorkspaceMessage)=><div className='hadron-v2-message-actions' aria-label='Message actions'>
  {message.modelName&&<span>{message.modelName}</span>}
  {message.role==='assistant'&&workspaceVisuals(message.text).length>0&&<button aria-label='Open visual preview' title='Open visual preview' onClick={()=>setVisualMessage(message.id)}>Visual</button>}
  <button title='Copy' aria-label='Copy message' onClick={()=>action('copy',message)}><Copy size={14}/></button>
  <button title='Edit' aria-label='Edit message' onClick={()=>action('edit',message)}><Pencil size={14}/></button>
  <button title='Branch' aria-label='Branch from message' onClick={()=>action('branch',message)}><GitBranch size={14}/></button>
  <button title='Delete' aria-label='Delete message' onClick={()=>action('delete',message)}><Trash2 size={14}/></button>
  <button title='More' aria-label='More message options' onClick={()=>setMore(current=>current===message.id?null:message.id)}><MoreHorizontal size={16}/></button>
  {more===message.id&&<div className='hadron-v2-message-menu' role='menu'>
   {options.filter(([name])=>!['copy','branch','delete'].includes(name)).map(([name,label])=><button role='menuitem' key={name} onClick={()=>{action(name,message);setMore(null)}}>{label}</button>)}
  </div>}
 </div>
 // A new chat is ready for typing independently of provider checks.
 useEffect(()=>{if(!document.querySelector('dialog[open]'))input.current?.focus({preventScroll:true})},[chat.id])
 const nodes:AgentConversationNode[]=chat.messages.map(message=>({id:message.id,parentId:message.parentId,kind:message.role==='user'?'task':'response',text:message.text,status:message.state==='stopped'?'cancelled':message.state,provider:message.provider??'openaichatgpt',modelName:message.modelName??'',jobId:chat.id,conversationId:chat.id}))
 const layout=layoutAgentBranches(nodes)
 const pointFor=(svg:SVGSVGElement,x:number,y:number)=>{
  const matrix=svg.getScreenCTM();if(!matrix)return null
  const point=new DOMPoint(x,y).matrixTransform(matrix.inverse())
  return {x:point.x/treeZoom,y:point.y/treeZoom}
 }
 return <div className='hadron-v2-workspace' data-unified-workspace='true'>
  <section className='hadron-v2-chat' aria-label='Conversation'>
   <div className='hadron-v2-transcript' ref={transcript} onScroll={event=>{const el=event.currentTarget;follow.current=el.scrollHeight-el.clientHeight-el.scrollTop<80;setAway(!follow.current);onScroll(el.scrollTop,follow.current)}}>
    {!path.length&&<div className='hadron-v2-empty'><MessageSquare size={66} strokeWidth={1}/><h2>Start a conversation</h2><p>Ask one or both agents a question. Files and folders are optional.</p><button onClick={onFolder}>Attach folder (optional)</button></div>}
    {path.map(message=><article key={message.id} className={`hadron-v2-message ${message.role}`} data-message-id={message.id} onContextMenu={branchDraft?.messageId===message.id?undefined:event=>openContext(event,message,true)}>
     {branchDraft?.messageId===message.id?<form className='hadron-v2-branch-editor' aria-label='New branch' onSubmit={event=>{event.preventDefault();void sendBranch()}}>
      <small>New branch</small>
      <p className='hadron-v2-hint'>{message.role==='user'?'Edit this question to start an alternative branch. The original stays saved.':'Write a follow-up to this answer. The original conversation stays saved.'}</p>
      <textarea ref={branchInput} aria-label='Branch message' value={branchDraft.text} disabled={branchDraft.submitting} onChange={event=>setBranchDrafts(current=>({...current,[chat.id]:{...current[chat.id],text:event.target.value,error:undefined}}))} onKeyDown={event=>{if(event.key==='Escape')cancelBranch();if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void sendBranch()}}}/>
      {branchDraft.error&&<p role='alert' className='hadron-v2-inline-error'>{branchDraft.error}</p>}
      {!props.canBranch&&<p className='hadron-v2-hint'>{busy?'Wait for the current reply to finish, or stop it before sending this branch.':'Choose a connected provider and model in the three-dot menu before sending.'}</p>}
      <div><button type='button' onClick={cancelBranch} disabled={branchDraft.submitting}>Cancel</button><button type='submit' disabled={!props.canBranch||!branchDraft.text.trim()||branchDraft.submitting}>{branchDraft.submitting?'Sending…':'Send branch'}</button></div>
     </form>:<>
     {toolbar(message)}<small>{message.role==='user'?'You':message.agent==='both'?'Agents A and B':`Agent ${(message.agent??chat.agent).toUpperCase()}`}</small>
     {message.images?.map(image=><img key={image.id} className='hadron-v2-attached-image' src={image.dataUrl} alt={image.name} title={image.name}/>)}
     <div className='hadron-v2-message-text'>{message.text?workspaceVisualText(message.text):(message.state==='running'?'':message.state==='stopped'?'Stopped before a reply was produced.':'No answer text was returned.')}</div>
     {message.role==='assistant'&&workspaceVisuals(message.text).length>0&&<button className='hadron-v2-visual-link' onClick={()=>setVisualMessage(message.id)}>Open visual preview</button>}
     {message.reference&&<span className='hadron-v2-hint'>Copied snapshot{message.reference.state==='running'?' · captured while the source was working':''}</span>}
     {message.note&&<aside className='hadron-v2-message-note'>{message.note}</aside>}
     {message.role==='assistant'&&(message.state==='running'||!!message.activity?.length)&&<details className='hadron-v2-activity'>
      <summary>Activity and progress{message.state==='running'?' · working…':''}</summary>
      {!message.activity?.length?<p>Waiting for the provider to report progress.</p>:<ul>{message.activity.map((item,index)=><li key={index}>{item.time&&Number.isFinite(Date.parse(item.time))&&<time dateTime={item.time}>{new Date(item.time).toLocaleTimeString()} · </time>}{item.label}{!item.label.endsWith(item.state)?` · ${item.state}`:''}</li>)}</ul>}
     </details>}
     {message.state==='running'&&<span role='status' className='hadron-v2-working'>{chat.jobState==='unknown'?'Checking saved task…':'Working…'}</span>}
     {(message.state==='failed'||message.role==='assistant'&&message.state==='completed'&&isHadronIncompleteRecord(message.text))&&<strong role='status' className='hadron-v2-not-finished'>Not finished</strong>}
     {message.state==='stopped'&&<strong role='status' className='hadron-v2-not-finished'>Not finished · Stopped</strong>}
     </>}
    </article>)}
   </div>
   {(away||path.length>0&&chat.selectedId!==path.at(-1)?.id)&&<button className='hadron-v2-latest' aria-label='Go to latest message' onClick={()=>{props.onLatest(path.at(-1)?.id);follow.current=true;setAway(false);onScroll(transcript.current?.scrollHeight??0,true);transcript.current?.scrollTo({top:transcript.current.scrollHeight,behavior:'smooth'})}}><ArrowDown size={18}/></button>}
   <div className='hadron-v2-composer' data-workspace-composer='true'>
    {error&&<p role='alert' className='hadron-v2-inline-error'>{error}</p>}
    {chat.folder&&<p className='hadron-v2-folder' title={chat.folder.label}>{chat.folder.label}</p>}
    {!chat.folder&&chat.permission==='agent'&&<p className='hadron-v2-hint'>No folder attached · questions use Chat permissions. Attach a folder when you want file or coding work.</p>}
    <textarea ref={input} aria-label='Message' placeholder='Type your message…' value={chat.draft} onChange={event=>onDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(canSend)onSend()}}}/>
    <div className='hadron-v2-toolbar'>
     <button className='hadron-v2-model-strip' aria-label='Agent and model setup' onClick={()=>setMenu(current=>!current)} data-workspace-menu-toggle>{labels}</button>
     <div className='hadron-v2-toolbar-actions'>
      {help}
      <div className='hadron-v2-setup-anchor'><button aria-label='Chat setup' aria-expanded={menu} data-workspace-menu-toggle onClick={()=>setMenu(current=>!current)}><MoreHorizontal size={20}/></button>
       <WorkspaceMenu open={menu} chat={chat} providers={providers} connections={connections} onAgent={onAgent} onConfigure={onConfigure} onClose={()=>setMenu(false)}/>
      </div>
      {reasoningControl}
      <div className='hadron-v2-setup-anchor'><button aria-label='Attach file or folder' aria-expanded={attachments} onClick={()=>setAttachments(value=>!value)}><Paperclip size={18}/></button>
       {attachments&&<div role='menu' className='hadron-v2-attachment-menu'><button role='menuitem' onClick={()=>{setAttachments(false);onFile()}}>Attach files</button><button role='menuitem' onClick={()=>{setAttachments(false);onFolder()}}>Attach folder</button>{chat.attachments?.map(file=><button key={file.id} role='menuitem' title={`Remove ${file.name}`} onClick={()=>props.onRemoveFile?.(file.id)}>{file.image&&<img className='hadron-v2-image-thumbnail' src={file.image.dataUrl} alt=''/>}{file.name} · Remove</button>)}</div>}
      </div>
      {busy?<button className='hadron-v2-send' aria-label='Stop' onClick={onStop}><Square size={16}/></button>:<button className='hadron-v2-send' aria-label='Send' disabled={!canSend} onClick={onSend}><ArrowUp size={20}/></button>}
     </div>
    </div>
   </div>
  </section>
  <section className='hadron-v2-tree' aria-label='Conversation tree'>
   {visibleVisuals.length>0&&<WorkspaceVisualPreview visuals={visibleVisuals} onClose={()=>setVisualMessage(null)}/>}
   {!!chat.messages.length&&<div className='hadron-v2-tree-controls' aria-label='Tree zoom'><button aria-label='Zoom tree out' title='Zoom out' onClick={()=>zoomTree(treeZoom/1.2)}>−</button><button aria-label='Reset tree view' title='Reset zoom and position' onClick={()=>{setTreeZoom(1);moveTreeTo({x:0,y:0})}}>{Math.round(treeZoom*100)}%</button><button aria-label='Zoom tree in' title='Zoom in' onClick={()=>zoomTree(treeZoom*1.2)}>+</button></div>}
   <input className='hadron-v2-search' aria-label='Search messages' placeholder='Search messages' value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{
    if(event.key!=='Enter'||!search.trim())return
    const matches=chat.messages.filter(message=>message.text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    const next=matches[(matches.findIndex(message=>message.id===chat.selectedId)+1)%matches.length]
    if(next)selectNode(next.id)
   }}/>
   {!chat.messages.length?<div className='hadron-v2-empty'><Share2 size={76} strokeWidth={1}/><h2>Conversation tree will appear here</h2><p>Your questions, replies and branches appear here as you chat.</p></div>:<div ref={treeViewport} className='hadron-v2-tree-scroll' tabIndex={0} aria-label='Tree canvas' title='Drag the tree in any direction. Click a branch to select it. Shift-drag selects branches. Ctrl + mouse wheel zooms.'
    onPointerDown={event=>{suppressTreeClick.current=false;if((event.button!==0&&event.button!==1)||event.shiftKey||event.ctrlKey||event.metaKey||(event.target as Element).closest('.hadron-v2-message-actions'))return;if(event.button===1)event.preventDefault();suppressTreeClick.current=false;pan.current={x:event.clientX,y:event.clientY,left:treeOffset.current.x,top:treeOffset.current.y,moved:false};if(event.button===1||!(event.target as Element).closest('.hadron-v2-tree-node'))event.currentTarget.setPointerCapture(event.pointerId)}}
    onPointerMove={event=>{const start=pan.current;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(!start.moved&&Math.hypot(dx,dy)<5)return;start.moved=true;suppressTreeClick.current=true;event.currentTarget.setPointerCapture(event.pointerId);moveTreeTo({x:start.left+dx,y:start.top+dy})}}
    onPointerUp={event=>{pan.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}} onPointerCancel={()=>{pan.current=null}}
    onClickCapture={event=>{if(suppressTreeClick.current){event.preventDefault();event.stopPropagation();suppressTreeClick.current=false}}}
    onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='+'||event.key==='='||event.key==='-'){event.preventDefault();zoomTree(treeZoom*(event.key==='-'?1/1.2:1.2))}}}>
    <svg ref={treeSvg} width={layout.width*treeZoom} height={layout.height*treeZoom} style={{'--tree-zoom':treeZoom,width:layout.width*treeZoom,height:layout.height*treeZoom,transform:`translate(calc(-50% + ${treeOffset.current.x}px), ${treeOffset.current.y}px)`} as React.CSSProperties} viewBox={`0 0 ${layout.width*treeZoom} ${layout.height*treeZoom}`} preserveAspectRatio='xMidYMin meet' role='group' aria-label='Conversation branches'
     onPointerDown={event=>{
      if(event.button!==0||!event.shiftKey||(event.target as Element).closest('.hadron-v2-tree-item'))return
      const point=pointFor(event.currentTarget,event.clientX,event.clientY);if(!point)return
      drag.current={x:point.x,y:point.y,endX:point.x,endY:point.y};setSelection(drag.current);event.currentTarget.setPointerCapture(event.pointerId)
     }} onPointerMove={event=>{
      if(!drag.current)return
      const point=pointFor(event.currentTarget,event.clientX,event.clientY);if(!point)return
      drag.current={...drag.current,endX:point.x,endY:point.y};setSelection(drag.current)
     }} onPointerUp={event=>{
      const box=drag.current;if(!box)return
      drag.current=null;setSelection(null);event.currentTarget.releasePointerCapture(event.pointerId)
      const left=Math.min(box.x,box.endX),right=Math.max(box.x,box.endX),top=Math.min(box.y,box.endY),bottom=Math.max(box.y,box.endY)
      if(right-left<4&&bottom-top<4)return
      props.onSelection(chat.messages.filter(message=>{const point=layout.points.get(message.id)!;return point.x+80>=left&&point.x-80<=right&&point.y+30>=top&&point.y-30<=bottom}).map(message=>message.id))
     }} onPointerCancel={()=>{drag.current=null;setSelection(null)}}>
     {nodes.filter(node=>node.parentId).map(node=>{const parent=layout.points.get(node.parentId!)!,child=layout.points.get(node.id)!;return <path key={node.id} d={`M ${parent.x*treeZoom} ${(parent.y+30)*treeZoom} V ${(parent.y+child.y)/2*treeZoom} H ${child.x*treeZoom} V ${(child.y-30)*treeZoom}`} fill='none' stroke='#81afbf' strokeWidth={2*treeZoom}/>})}
     {chat.messages.map((message,index)=>{const point=layout.points.get(message.id)!;return <foreignObject key={message.id} x={(point.x-80)*treeZoom} y={(point.y-30)*treeZoom} width={160*treeZoom} height={74*treeZoom} style={{overflow:'visible'}}>
      <div className='hadron-v2-tree-item' onContextMenu={event=>openContext(event,message,false)} data-search-match={!!search.trim()&&message.text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())}>
      {toolbar(message)}
      <button className='hadron-v2-tree-node' style={{background:colorAt(index),'--branch-color':colorAt(index)} as React.CSSProperties} aria-label={`Select branch: ${message.text.slice(0,60)}`} aria-pressed={chat.selectedId===message.id||props.selectedIds?.has(message.id)} onClick={event=>selectNode(message.id,event.ctrlKey||event.metaKey||event.shiftKey)}>{message.role==='assistant'&&(message.state==='failed'||message.state==='stopped'||isHadronIncompleteRecord(message.text))&&<strong>Not finished · </strong>}{message.text||(message.state==='running'?'Working…':'No answer text')}</button>
      </div>
     </foreignObject>})}
     {selection&&<rect x={Math.min(selection.x,selection.endX)*treeZoom} y={Math.min(selection.y,selection.endY)*treeZoom} width={Math.abs(selection.x-selection.endX)*treeZoom} height={Math.abs(selection.y-selection.endY)*treeZoom} fill='#4a90d922' stroke='#4a90d9' strokeWidth={treeZoom} pointerEvents='none'/>}
    </svg>
   </div>}
  </section>
  {context&&createPortal(<div ref={contextMenu} role='menu' aria-label='Conversation selection actions' className='hadron-v2-context-menu' style={{left:context.x,top:context.y}}>
   {options.map(([name,label])=><button key={name} role='menuitem' onClick={()=>{const chosen=context;setContext(null);selectionAction(name,chosen.ids,chosen.excerpts)}}>{label}</button>)}
  </div>,document.body)}
 </div>
}
