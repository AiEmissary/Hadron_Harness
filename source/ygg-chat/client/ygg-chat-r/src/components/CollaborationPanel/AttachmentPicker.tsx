import {useRef,useState,type RefObject} from 'react'
import {createPortal} from 'react-dom'
import {composeSharedContext,readSharedFiles,SHARED_ATTACHMENT_MAX_COUNT,SHARED_FILE_ACCEPT,type SharedAttachment} from '../../features/collaboration/attachments'
import {textExcerpt} from '../../features/collaboration/textExcerpt'
import {HADRON_DOCUMENT_INLINE_CHARS,HADRON_DOCUMENT_MAX_CHARS,HADRON_DOCUMENT_MAX_COUNT} from '../../../../../shared/hadronDocuments'

/** Large text stays local until the user confirms the exact excerpt shown. */
export function AttachmentPicker({label,files,disabled,onFiles,onBusy,pickerRef,compact=false}:{pickerRef?:RefObject<HTMLInputElement|null>;compact?:boolean;label:string;files:SharedAttachment[];disabled?:boolean;onFiles(files:SharedAttachment[]):void;onBusy(value:boolean):void}){
 const input=useRef<HTMLInputElement>(null),[error,setError]=useState(''),[pending,setPending]=useState<{file:SharedAttachment;rest:File[];prepared:SharedAttachment[]}|null>(null)
 const [start,setStart]=useState(1),[count,setCount]=useState(40),[query,setQuery]=useState('')
 const next=async(queue:File[],prepared:SharedAttachment[])=>{
  try{
   while(queue.length){
    // Pass what is already attached so a video's frames fit the remaining attachment space.
    const added=(await readSharedFiles([queue[0]],prepared)).slice(prepared.length)
    if(added.length!==1){queue=queue.slice(1);prepared=[...prepared,...added];continue}
    let [file]=added
    // Large text is kept whole for the agent's document tools; an excerpt is offered only beyond the document limits.
    if(!file.image&&file.text.length>HADRON_DOCUMENT_INLINE_CHARS&&file.text.length<=HADRON_DOCUMENT_MAX_CHARS&&prepared.filter(item=>item.searchable).length<HADRON_DOCUMENT_MAX_COUNT)file={...file,searchable:true}
    queue=queue.slice(1)
    try{composeSharedContext('',[...prepared,file]);if(!file.searchable&&file.text.length>HADRON_DOCUMENT_INLINE_CHARS)throw Error('Choose excerpt')}
    catch{setStart(1);setCount(40);setQuery('');setPending({file,rest:queue,prepared});return}
    prepared=[...prepared,file]
   }
   onFiles(prepared);setPending(null);onBusy(false)
  }catch(e){setError((e as Error).message);setPending(null);onBusy(false)}
 }
 let preview='',previewError=''
 if(pending)try{preview=textExcerpt(pending.file.text,pending.file.name,start,count).text;composeSharedContext('',[...pending.prepared,{...pending.file,name:pending.file.name+' (excerpt)',text:preview}])}catch(e){previewError=(e as Error).message}
 return <>
  <input ref={node=>{input.current=node;if(pickerRef)pickerRef.current=node}} type='file' multiple accept={SHARED_FILE_ACCEPT} disabled={disabled} aria-label={label} className='sr-only' onChange={event=>{const selected=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';if(!selected.length)return;setError('');if(files.length+selected.length>SHARED_ATTACHMENT_MAX_COUNT){setError(`Choose up to ${SHARED_ATTACHMENT_MAX_COUNT} files.`);return}onBusy(true);void next(selected,[...files])}}/>
  {!compact&&<button type='button' disabled={disabled} className='rounded-lg border px-3 py-2 text-sm' onClick={()=>input.current?.click()}>Add files</button>}
  {!compact&&<p className='text-xs text-neutral-500'>Pictures (JPEG, PNG, WebP, GIF, BMP), videos (MP4, WebM, MOV), PDF, Word, text or code. Hadron limits: 20 attachments; pictures up to 30 MiB, videos up to 500 MiB, other files 8 MiB; a video is sent as up to 12 still frames (no motion or sound); pictures are prepared at up to 2048 pixels and 1 MiB for the AI. Short text is included directly (16,000 characters combined). Large PDF, Word or text files (up to 2,000,000 characters, 5 per chat) are kept whole for one agent to search and read. Add folder lets agents search relevant sections.</p>}
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
