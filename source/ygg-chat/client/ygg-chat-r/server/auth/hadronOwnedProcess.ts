import type {ChildProcess} from 'node:child_process'

export interface OwnedProcessCapture {code:number|null;text:string;category?:string}
export interface OwnedProcessCaptureOptions {
 signal?:AbortSignal;timeout:number;jsonOutput?:boolean;input?:string;maxBytes?:number;onText?(text:string):void
}

/** Join the actual child and its pipes. An error/exit/kill request alone is not
 * completion. This is current-host ownership, not descendant or restart proof. */
export function captureOwnedProcess(child:ChildProcess,options:OwnedProcessCaptureOptions):Promise<OwnedProcessCapture>{
 return new Promise((resolve,reject)=>{
  let text='',size=0,closed=false,timedOut=false,failed=false,stopping=false,category='other'
  const maxBytes=options.maxBytes??65536
  const stop=()=>{
   if(closed||stopping)return
   stopping=true
   // A failed kill must leave the join pending until an actual close event.
   try{child.kill()}catch{failed=true}
  }
  const fail=()=>{if(closed)return;failed=true;stop()}
  const timer=setTimeout(()=>{timedOut=true;stop()},options.timeout)
  const receive=(chunk:Buffer,stdout=true)=>{
   if(closed||failed||size>maxBytes)return
   size+=chunk.length
   if(size>maxBytes){stop();return}
   if(options.jsonOutput&&!stdout){
    if(/missing field|invalid.*config|error.*config|unrecognized/i.test(chunk.toString('utf8')))category='configuration'
    return
   }
   text+=chunk.toString('utf8')
   try{options.onText?.(text)}catch{fail()}
  }
  child.on('error',fail)
  child.stdout?.on('data',chunk=>receive(chunk))
  child.stderr?.on('data',chunk=>receive(chunk,false))
  child.stdout?.on('error',fail);child.stderr?.on('error',fail);child.stdin?.on('error',fail)
  child.once('close',code=>{
   if(closed)return
   closed=true;clearTimeout(timer);options.signal?.removeEventListener('abort',stop)
   if(failed){reject(Error('Hadron worker failed; process closure was observed'));return}
   resolve({code:timedOut||size>maxBytes||options.signal?.aborted?null:code,text,
    category:timedOut?'timeout':size>maxBytes?'output_limit':options.signal?.aborted?'cancelled':category})
  })
  options.signal?.addEventListener('abort',stop,{once:true})
  if(options.signal?.aborted)stop()
  else if(options.input!==undefined){
   if(!child.stdin)fail()
   else try{child.stdin.end(options.input)}catch{fail()}
  }
 })
}
