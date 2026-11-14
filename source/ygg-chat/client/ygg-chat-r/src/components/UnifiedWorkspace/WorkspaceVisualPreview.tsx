import {useEffect,useMemo,useRef,useState} from 'react'
import {X,Download} from 'lucide-react'
import {safeWorkspaceSvg,type WorkspaceVisual} from '../../features/collaboration/workspaceVisuals'

export function WorkspaceVisualPreview({visuals,onClose}:{visuals:WorkspaceVisual[];onClose():void}){
 const [index,setIndex]=useState(0),close=useRef<HTMLButtonElement>(null)
 useEffect(()=>setIndex(0),[visuals[0]?.source])
 const visual=visuals[index]??visuals[0]
 const prepared=useMemo(()=>{try{const source=visual.kind==='svg'?safeWorkspaceSvg(visual.source):visual.source;return {source,url:visual.kind==='svg'?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source):source,error:''}}catch(error){return {source:'',url:'',error:(error as Error).message}}},[visual])
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus()}},[])
 const save=()=>{const blob=visual.kind==='svg'?new Blob([prepared.source],{type:'image/svg+xml'}):null,url=blob?URL.createObjectURL(blob):prepared.url;const link=document.createElement('a');link.href=url;link.download=visual.kind==='svg'?'hadron-design.svg':`hadron-image.${visual.source.startsWith('data:image/jpeg')?'jpg':visual.source.startsWith('data:image/webp')?'webp':'png'}`;link.click();if(blob)setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <div role='dialog' aria-label='Visual preview' aria-modal='false' className='hadron-v2-visual-preview' onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose()}}}>
  <header><strong>Visual preview</strong><span>{visuals.length>1&&<select aria-label='Choose visual' value={index} onChange={event=>setIndex(Number(event.target.value))}>{visuals.map((item,index)=><option key={index} value={index}>{item.title}</option>)}</select>}<button aria-label='Save visual' disabled={!!prepared.error} onClick={save}><Download size={18}/> Save</button><button ref={close} aria-label='Close visual preview' onClick={onClose}><X size={20}/></button></span></header>
  {prepared.error?<p role='alert'>{prepared.error}</p>:<div className='hadron-v2-visual-content'><img src={prepared.url} alt={visual.title}/></div>}
 </div>
}
