export type FileAccessMode = 'chat' | 'read' | 'edit'
export function FileAccess({label,value,disabled,onChange}:{label:string;value:FileAccessMode;disabled?:boolean;onChange(value:FileAccessMode):void;onEdit?():void}){
 return <section aria-label={`${label} access`} className='space-y-2 rounded-xl border p-3 text-sm'>
  <label className='block'>Access<select aria-label={`${label} access mode`} value={value} disabled={disabled} onChange={event=>onChange(event.target.value as FileAccessMode)} className='mt-1 w-full rounded-lg border bg-transparent p-2'>
   <option value='chat'>Chat only</option><option value='read'>Read files</option><option value='edit'>Work on files</option>
  </select></label>
  <p className='text-xs'>{value==='chat'?'No folder tools. Explicitly attached text can still be read.':value==='read'?'Search and read only within the folder you choose. No file changes or commands. Access expires when Hadron restarts.':'Give an instruction and Go. The selected agents work on files, with approval when changes or checks are ready.'}</p>
 </section>
}
