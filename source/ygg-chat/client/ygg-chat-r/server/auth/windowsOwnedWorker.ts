import net from 'node:net'
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process'
import {randomBytes,randomUUID} from 'node:crypto'
import {WindowsWorkerEvidenceStore,observeWindowsWorker,verifiedWindowsWorkerBinary,type WindowsWorkerRecord} from '../hadronTools/windowsWorkerEvidence.js'

/** Host-only native transport. No HTTP/model/renderer adapter. A caller's
 * consumer cannot publish completion before native tree termination is joined. */
export class WindowsOwnedWorkerHost {
 private readonly evidence:WindowsWorkerEvidenceStore
 constructor(private readonly nativeDirectory:string,profile:string,readonly epoch:string){
  this.evidence=new WindowsWorkerEvidenceStore(profile,epoch,item=>observeWindowsWorker(nativeDirectory,item))
 }
 inspect(){return this.evidence.inspect()}
 async run<T>(options:{executable:string;args:string[];cwd:string;env:NodeJS.ProcessEnv;signal?:AbortSignal;
  consume:(child:ChildProcessWithoutNullStreams)=>Promise<T>}):Promise<T>{
  options.signal?.throwIfAborted()
  const binary=verifiedWindowsWorkerBinary(this.nativeDirectory)
  const pipe='HadronWorker-'+randomUUID().replaceAll('-',''),nonce=randomBytes(32).toString('hex'),job='Local\\HadronWorker-'+randomUUID().replaceAll('-','')
  let connection:net.Socket|undefined,child:ChildProcessWithoutNullStreams|undefined,record:WindowsWorkerRecord|undefined,treeClosed=false,admissionError:Error|undefined
  let nativeKill:(()=>boolean)|undefined
  const stop=()=>{
   try{if(connection&&!connection.destroyed){connection.write('stop\n');return}}catch{}
   try{nativeKill?.()}catch{/* Completion still awaits actual close and OS observation. */}
  }
  const server=net.createServer(socket=>{
   if(connection){socket.destroy();return}connection=socket;let buffer=''
   socket.on('error',()=>{})
   socket.on('data',chunk=>{
    buffer+=chunk.toString('utf8')
    if(buffer.length>8192){admissionError=Error('Native worker control limit');socket.destroy();stop();return}
    let newline:number
    while((newline=buffer.indexOf('\n'))>=0){
     const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1)
     try{
      const packet=JSON.parse(line)
      if(packet.version!==1||packet.nonce!==nonce)throw Error('Native worker control identity mismatch')
      if(packet.type==='prepared'){
       if(record||!child?.pid)throw Error('Native worker repeated preparation')
       this.evidence.recordPrepared(packet,{job,nonce,workerPid:child.pid})
       record={version:1,epoch:this.epoch,job,sessionId:packet.sessionId,parentPid:packet.parentPid,parentCreated:packet.parentCreated,workerPid:packet.workerPid,workerCreated:packet.workerCreated}
       if(options.signal?.aborted)stop();else socket.write('start:'+nonce+'\n')
      }else if(packet.type==='closed'&&record&&packet.active===0)treeClosed=true
      else throw Error('Unexpected native worker control message')
     }catch{admissionError=Error('Native worker admission or control could not be verified');socket.destroy();stop()}
    }
   })
  })
  try{
   await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen('\\\\.\\pipe\\'+pipe,resolve)})
   options.signal?.throwIfAborted()
   child=spawn(binary,['run',pipe,nonce,job,options.executable,...options.args],{cwd:options.cwd,env:options.env,shell:false,windowsHide:true,stdio:'pipe'})
   const realKill=child.kill.bind(child);nativeKill=()=>realKill()
   // Existing consumers request cancellation through kill(); give the native
   // owner a chance to terminate and join the complete job before exiting.
   child.kill=(()=>{stop();return true}) as typeof child.kill
   const closed=new Promise<void>(resolve=>child!.once('close',()=>resolve()))
   child.on('error',()=>{admissionError=Error('Native worker process could not be confirmed')})
   const timer=setTimeout(()=>{if(!record){admissionError=Error('Native worker admission timed out');stop()}},10000)
   options.signal?.addEventListener('abort',stop,{once:true})
   let outcome:{ok:true;value:T}|{ok:false;error:unknown}
   try{
    // Invoke synchronously so all consumer pipe/close listeners are attached
    // before the child can emit asynchronous process events.
    try{outcome=await options.consume(child).then(value=>({ok:true as const,value}),error=>{stop();return {ok:false as const,error}})}
    catch(error){stop();outcome={ok:false,error}}
    await closed
    if(record&&!treeClosed){
     // Abrupt helper failure may lose its final protocol message. Inspect
     // actual kernel identities/job state; never infer closure from a timer.
     while(true){
      const observed=observeWindowsWorker(this.nativeDirectory,record)
      if(observed.worker==='ended'&&(observed.job==='absent'&&observed.active===null||observed.job==='empty'&&observed.active===0))break
      await new Promise(resolve=>setTimeout(resolve,250))
     }
    }
   }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',stop)}
   if(admissionError)throw admissionError
   if(!record)throw Error('Native worker was not admitted')
   if(!outcome.ok)throw outcome.error
   return outcome.value
  }finally{
   connection?.destroy()
   await new Promise<void>(resolve=>server.close(()=>resolve()))
  }
 }
}
