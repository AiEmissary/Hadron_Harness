import {ProviderAllowance} from './ProviderAllowance'
import {WebToolStatus} from './WebToolStatus'
import {useEffect,useRef,type ReactNode} from 'react'
import type {ParticipantOption} from '../../features/collaboration/setup'
import type {WorkspaceAgent,WorkspaceChat,WorkspaceModel,WorkspacePermission,WorkspaceWorkType} from '../../features/collaboration/unifiedWorkspace'

export interface WorkspaceMenuProps {
 open:boolean;chat:WorkspaceChat;providers:ReadonlyArray<ParticipantOption>;connections?:ReactNode;
 onClose():void;
 onConfigure(next:{workType?:WorkspaceWorkType;agent?:WorkspaceAgent;permission?:WorkspacePermission;models?:WorkspaceChat['models'];maxTurns?:number}):void;
}
/** The requested setup controls live exclusively in the composer's three-dot pop-up. */
export function WorkspaceMenu({open,chat,providers,connections,onClose,onConfigure}:WorkspaceMenuProps){
 const panel=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  if(!open)return
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!(event.target as Element)?.closest?.('[data-workspace-menu-toggle]'))onClose()}
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose()}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key)
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}
 },[open,onClose])
 if(!open)return null
 const busy=chat.jobState!=='idle'
 const choose=(agent:WorkspaceAgent,change:Partial<WorkspaceModel>)=>onConfigure({models:{...chat.models,[agent]:{...chat.models[agent],...change} as WorkspaceModel}})
 return <div ref={panel} role='dialog' aria-label='Chat setup' className='hadron-v2-menu'>
  <label>Work type<select aria-label='Work type' disabled={busy} value={chat.workType==='individual'?`individual:${chat.agent}`:chat.workType} onChange={event=>{const value=event.target.value;if(value==='individual:a'||value==='individual:b')onConfigure({workType:'individual',agent:value==='individual:a'?'a':'b'});else onConfigure({workType:value as WorkspaceWorkType})}}>
   <option value='individual:a'>Agent A only</option><option value='individual:b'>Agent B only</option><option value='together'>Work together</option><option value='continuous'>Continuous conversation</option>
  </select></label>
  {chat.workType==='individual'&&<div className='hadron-v2-choice' aria-label='Choose agent'>{(['a','b'] as const).map(agent=><button key={agent} type='button' aria-pressed={chat.agent===agent} disabled={busy} onClick={()=>{if(agent!==chat.agent)onConfigure({agent})}}>Agent {agent.toUpperCase()}</button>)}</div>}
  <div className='hadron-v2-choice' aria-label='Chat or Agent permissions'>
   <button type='button' aria-pressed={chat.permission==='chat'} disabled={busy} onClick={()=>onConfigure({permission:'chat'})}>Chat</button>
   <button type='button' aria-pressed={chat.permission==='agent'} disabled={busy||chat.workType==='continuous'} onClick={()=>onConfigure({permission:'agent'})}>Agent</button>
  </div>
  <p className='hadron-v2-hint'>{chat.permission==='chat'?'Chat, search online and read public pages or attached files.':'Search online, read public pages, change files and run project work in your chosen folder.'}</p>
  <WebToolStatus/>
  {chat.workType==='continuous'&&<section aria-label='Conversation turn limit' className='hadron-v2-turn-limit'><label>Conversation turns<input aria-label='Conversation turns' type='number' min={1} max={100} value={chat.maxTurns} disabled={busy} onChange={event=>{const maxTurns=Number(event.target.value);if(Number.isInteger(maxTurns)&&maxTurns>=1&&maxTurns<=100)onConfigure({maxTurns})}}/></label><p className='hadron-v2-hint'>Stops when both agents agree on a conclusion, or at your turn limit (up to 100).</p></section>}
  {(chat.workType==='individual'?[chat.agent]:['a','b'] as const).map(agent=><fieldset key={agent} disabled={busy}>
   <legend>Agent {agent.toUpperCase()}</legend>
   <label>Provider<select aria-label={`Agent ${agent.toUpperCase()} provider`} value={chat.models[agent]?.provider??''} onChange={event=>choose(agent,{provider:event.target.value as WorkspaceModel['provider'],modelName:''})}>
    <option value=''>Choose provider</option>{chat.models[agent]?.provider&&!providers.some(item=>item.provider===chat.models[agent]?.provider)&&<option value={chat.models[agent]!.provider} disabled>{chat.models[agent]!.provider==='openaichatgpt'?'ChatGPT':'Claude'} · checking connection</option>}{providers.map(provider=><option key={provider.provider} value={provider.provider} disabled={!provider.connected}>{provider.label}{provider.connected?'':' · sign in'}</option>)}
   </select></label>
   <label>Model<select aria-label={`Agent ${agent.toUpperCase()} model`} value={chat.models[agent]?.modelName??''} onChange={event=>choose(agent,{modelName:event.target.value})}>
    <option value=''>Choose model</option>{chat.models[agent]?.modelName&&!providers.find(provider=>provider.provider===chat.models[agent]?.provider)?.models.some(model=>model.id===chat.models[agent]?.modelName)&&<option value={chat.models[agent]!.modelName} disabled>{chat.models[agent]!.modelName} · unavailable</option>}{providers.find(provider=>provider.provider===chat.models[agent]?.provider)?.models.map(model=><option key={model.id} value={model.id}>{model.label}</option>)}
   </select></label>
   <ProviderAllowance provider={chat.models[agent]?.provider} refreshKey={chat.jobState}/>
  </fieldset>)}
  {connections&&<div className='hadron-v2-connections'>{connections}</div>}
 </div>
}
