import {useRef,useState,type RefObject} from 'react'
import {createPortal} from 'react-dom'
import {composeSharedContext,readSharedFiles,SHARED_FILE_ACCEPT,type SharedAttachment} from '../../features/collaboration/attachments'
import {textExcerpt} from '../../features/collaboration/textExcerpt'

/** Large text stays local until the user confirms the exact excerpt shown. */
export function AttachmentPicker({label,files,disabled,onFiles,onBusy,pickerRef,compact=false}:{pickerRef?:RefObject<HTMLInputElement|null>;compact?:boolean;label:string;files:SharedAttachment[];disabled?:boolean;onFiles(files:SharedAttachment[]):void;onBusy(value:boolean):void}){
 const input=useRef<HTMLInputElement>(null),[error,setError]=useState(''),[pending,setPending]=useState<{file:SharedAttachment;rest:File[];prepared:SharedAttachment[]}|null>(null)
 const [start,setStart]=useState(1),[count,setCount]=useState(40),[query,setQuery]=useState('')
 const next=async(queue:File[],prepared:SharedAttachment[])=>{
  try{
   while(queue.length){
    const [file]=await readSharedFiles([queue[0]])
    queue=queue.slice(1)
    try{composeSharedContext('',[...prepared,file]);if(file.text.length>12000)throw Error('Choose excerpt')}
    catch{setStart(1);setCount(40);setQuery('');setPending({file,rest:queue,prepared});return}
    prepared=[...prepared,file]
   }
   onFiles(prepared);setPending(null);onBusy(false)
  }catch(e){setError((e as Error).message);setPending(null);onBusy(false)}
 }
 let preview='',previewError=''
 if(pending)try{preview=textExcerpt(pending.file.text,pending.file.name,start,count).text;composeSharedContext('',[...pending.prepared,{...pending.file,name:pending.file.name+' (excerpt)',text:preview}])}catch(e){previewError=(e as Error).message}
 return <>
  <input ref={node=>{input.current=node;if(pickerRef)pickerRef.current=node}} type='file' multiple accept={SHARED_FILE_ACCEPT} disabled={disabled} aria-label={label} className='sr-only' onChange={event=>{const selected=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';if(!selected.length)return;setError('');if(files.length+selected.length>5){setError('Choose up to five shared files.');return}onBusy(true);void next(selected,[...files])}}/>
  {!compact&&<button type='button' disabled={disabled} className='rounded-lg border px-3 py-2 text-sm' onClick={()=>input.current?.click()}>Add files</button>}
  {!compact&&<p className='text-xs text-neutral-500'>Hadron limits: 5 attachments, 8 MiB each; 16,000 characters of combined supplied text. Large text opens an excerpt preview. Add folder lets agents search relevant sections.</p>}
  {error&&<p role='alert' className='text-sm text-red-600'>{error}</p>}
  {pending&&createPortal(<div className='fixed inset-0 z-[1600] flex items-center justify-center bg-black/40 p-4'><section role='dialog' aria-modal='true' aria-label='Choose file excerpt' className='hadron-v2-attachment-dialog max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl bg-white p-5 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100'>
   <h2 className='font-semibold'>Choose an excerpt: {pending.file.name}</h2><p className='text-sm'>The full text would exceed the supplied-context budget. Only the preview below will be attached after you confirm. Your original file stays unchanged.</p>
   <div className='flex flex-wrap gap-3'><label>Start line<input aria-label='Excerpt start line' type='number' min={1} value={start} onChange={e=>setStart(Number(e.target.value))} className='ml-2 w-24 rounded border p-2'/></label><label>Lines<input aria-label='Excerpt lines' type='number' min={1} max={200} value={count} onChange={e=>setCount(Number(e.target.value))} className='ml-2 w-24 rounded border p-2'/></label></div>
   <div className='flex gap-2'><input aria-label='Find in attachment' value={query} onChange={e=>setQuery(e.target.value)} placeholder='Find text locally…' className='min-w-0 flex-1 rounded border p-2'/><button type='button' disabled={!query.trim()} onClick={()=>{const index=pending.file.text.toLowerCase().indexOf(query.toLowerCase());if(index<0){setError('No matching text found in this file.');return}setError('');setStart(pending.file.text.slice(0,index).split('\n').length)}}>Find first match</button></div>
   <pre aria-label='File excerpt preview' className='max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border p-3 text-xs'>{preview}</pre>
   {(previewError||error)&&<p role='alert'>{previewError||error}</p>}
   <div className='flex gap-3'><button type='button' disabled={!!previewError||!preview} onClick={()=>void next(pending.rest,[...pending.prepared,{...pending.file,name:pending.file.name+' (excerpt)',text:preview}])} className='rounded border px-3 py-2'>Attach this excerpt</button><button type='button' onClick={()=>{setPending(null);onBusy(false);setError('')}} className='rounded border px-3 py-2'>Cancel selection</button></div>
  </section></div>,document.body)}
 </>
}
