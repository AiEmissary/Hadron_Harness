import type {WorkspaceMessage} from './unifiedWorkspace'
import {WORKSPACE_VISUAL_INSTRUCTION} from './workspaceVisuals'

const OMITTED='[Earlier conversation was reduced to fit this request. This is an excerpt, not a complete history or a summary. All originals remain saved in Hadron. Do not infer omitted details.]'
const visualExcerpt=(text:string,keepSvg:boolean)=>text
 .replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g,'[Saved image; binary data omitted from this handover.]')
 .replace(/```svg[^\S\r\n]*\r?\n([\s\S]*?)```/gi,(block)=>keepSvg?block:'[Saved drawing; older SVG source omitted from this handover.]')
const clip=(text:string,limit:number)=>text.length<=limit?text:limit<100?text.slice(0,limit):text.slice(0,Math.floor((limit-36)/2))+'\n[... excerpt omitted ...]\n'+text.slice(-Math.floor((limit-36)/2))
export const workspaceHistorySize=(path:WorkspaceMessage[])=>path.reduce((size,message)=>size+message.text.length+(message.context?.length??0),0)
/** Bound only the transmitted copy, never saved messages or the current attachments. */
export function workspaceHandoverContext(path:WorkspaceMessage[],current:string,agent:'a'|'b',limit=16000):string{
 if(current.length>limit)throw Error('The new attachments and instructions exceed this request’s limit. Attach a folder instead of supplying all file text.')
 const render=(message:WorkspaceMessage,text=message.text,context=message.context)=>`${message.role==='user'?'You':message.agent==='both'?'Agents A and B':'Agent '+(message.agent??agent).toUpperCase()}: ${text}${context?'\nAttached context: '+context:''}${message.note?'\nUser note: '+message.note:''}`
 const full=[...path.map(message=>render(message)),current].filter(Boolean).join('\n\n')
 if(full.length<=limit)return full
 const budget=limit-current.length-(current?2:0)
 if(budget<OMITTED.length+4)return current
 const entries=path.map((message,index)=>render(message,visualExcerpt(message.text,index===path.length-1),message.context?.replace(WORKSPACE_VISUAL_INSTRUCTION,'').trim()))
 const first=path[0]?.role==='user'?clip(entries[0],Math.min(1200,Math.floor(budget/4))):''
 let remaining=budget-OMITTED.length-(first?first.length+4:2)
 const recent:string[]=[]
 for(let index=entries.length-1;index>=(first?1:0)&&remaining>80;index--){
  let entry=entries[index]
  if(entry.length>remaining)entry=visualExcerpt(entry,false)
  const selected=clip(entry,remaining-2)
  recent.unshift(selected);remaining-=selected.length+2
 }
 return [first,OMITTED,...recent,current].filter(Boolean).join('\n\n').slice(0,limit)
}
