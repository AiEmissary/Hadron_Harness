import {useEffect,useState} from 'react'

/** Elapsed time measures this observed activity, not provider token generation. */
export function WorkIndicator({label}:{label:string}){
 const [seconds,setSeconds]=useState(0)
 useEffect(()=>{const started=Date.now();setSeconds(0);const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer)},[label])
 return <div role='status' className='flex items-center gap-3 rounded-xl border border-cyan-300 bg-cyan-50/50 p-3 text-sm'>
  <span aria-hidden='true' className='h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 motion-reduce:animate-none'/>
  <div><p className='font-medium'>{label}</p><p className='text-xs'>Waiting for completion · {seconds}s observed. This timer is not a progress estimate.</p></div>
 </div>
}
