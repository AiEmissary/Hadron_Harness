// Native Windows Job Object acceptance, using only disposable local Node trees.
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {spawn,spawnSync} from 'node:child_process'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {fileURLToPath,pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const appDir=path.resolve(import.meta.dirname,'..'),self=fileURLToPath(import.meta.url)
const binary=path.join(appDir,'vendor','hadron-worker','HadronWorkerHost.exe')
const evidenceBundle=path.join(appDir,'node_modules','.cache','hadron','worker-evidence.mjs')
if(process.argv[2]!=='--fixture-owner'){
 const {build}=await import('esbuild')
 await build({entryPoints:[path.join(appDir,'server','hadronTools','windowsWorkerEvidence.ts')],outfile:evidenceBundle,bundle:true,platform:'node',format:'esm'})
}
const {WindowsWorkerEvidenceStore,observeWindowsWorker}=await import(pathToFileURL(evidenceBundle))
let evidenceDirectory
const environment={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:os.tmpdir(),TMP:os.tmpdir()}
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds))
const ownChildren=new Set()
function trackedSpawn(...args){const child=spawn(...args);ownChildren.add(child);child.once('close',()=>ownChildren.delete(child));return child}
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timeout')),10000)})])}finally{clearTimeout(timer)}}
function inspect(record){
 const result=spawnSync(binary,['inspect',record.job,String(record.parentPid),record.parentCreated,String(record.workerPid),record.workerCreated,String(record.sessionId)],{shell:false,windowsHide:true,env:environment,encoding:'utf8',timeout:5000,maxBuffer:4096})
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout)
}
async function waitInspection(record,predicate){let result;for(let attempt=0;attempt<100;attempt++){result=inspect(record);if(predicate(result))return result;await sleep(30)}throw Error('Native termination observation remained '+JSON.stringify(result))}
async function launch(targetArgs,{job=String.raw`Local\HadronWorker-${randomUUID().replaceAll('-','')}`,admit=true}={}){
 const pipe='HadronWorker-'+randomUUID().replaceAll('-',''),nonce=randomBytes(32).toString('hex')
 const evidenceEpoch=randomUUID(),evidence=new WindowsWorkerEvidenceStore(evidenceDirectory,evidenceEpoch,value=>observeWindowsWorker(path.dirname(binary),value))
 let connection,record,acknowledged=false,closedProof=false,output='',errors='',resolveReady,rejectReady
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject})
 // Keep a rejection handler attached even while awaiting server.listen.
 void ready.catch(()=>{})
 const server=net.createServer(socket=>{
  if(connection){socket.destroy();return}connection=socket;let buffer=''
  socket.on('error',()=>{});socket.on('data',chunk=>{
   buffer+=chunk.toString('utf8');if(buffer.length>8192){socket.destroy();rejectReady(Error('control_limit'));return}
   let newline;while((newline=buffer.indexOf('\n'))>=0){
    const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1)
    try{
     const packet=JSON.parse(line);assert.equal(packet.nonce,nonce);assert.equal(packet.version,1)
     if(packet.type==='prepared'){
      assert.equal(packet.job,job);assert.equal(packet.parentPid,process.pid)
      assert.match(packet.parentCreated,/^[0-9]{15,20}$/);assert.match(packet.workerCreated,/^[0-9]{15,20}$/)
      assert.ok(Number.isSafeInteger(packet.workerPid)&&packet.workerPid>0)
      // The actual durable store must succeed before native start is admitted.
      evidence.recordPrepared(packet,{job,nonce,workerPid:child.pid});record=packet
      if(admit){socket.write('start:'+nonce+'\n');acknowledged=true}resolveReady(packet)
     }else if(packet.type==='closed'){assert.equal(packet.active,0);closedProof=true}
     else throw Error('Unexpected control packet')
    }catch(error){rejectReady(error);socket.destroy()}
   }
  })
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen('\\\\.\\pipe\\'+pipe,resolve)})
 const child=trackedSpawn(binary,['run',pipe,nonce,job,process.execPath,...targetArgs],{shell:false,windowsHide:true,env:environment,stdio:'pipe'})
 child.stdout.on('data',chunk=>{output+=chunk.toString('utf8')});child.stderr.on('data',chunk=>{errors+=chunk.toString('utf8')})
 const closed=new Promise(resolve=>child.once('close',code=>{if(!record)rejectReady(Error('Native preparation failed: '+errors));resolve(code)}))
 child.once('error',rejectReady)
 return {child,ready,closed,job,evidence,evidenceEpoch,get record(){return record},get output(){return output},get closedProof(){return closedProof},get acknowledged(){return acknowledged},
  admit(){connection.write('start:'+nonce+'\n');acknowledged=true},stop(){connection?.write('stop\n')},
  async dispose(){connection?.destroy();if(child.exitCode===null&&!child.signalCode)child.kill();await bounded(closed,'native close');await new Promise(resolve=>server.close(resolve))}}
}
async function waitOutput(worker){for(let attempt=0;attempt<200;attempt++){if(worker.output.includes('TREE_READY'))return;await sleep(20)}throw Error('Synthetic tree not ready')}
const tree=['-e','const{spawn}=require("node:child_process");const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{detached:true,stdio:"ignore"});process.stdout.write("TREE_READY "+process.pid+" "+child.pid+"\\n");setInterval(()=>{},1000)']

// A separate fixture owner lets the outer test actually crash the process
// which owns the authenticated named pipe, then observe fresh OS state.
if(process.argv[2]==='--fixture-owner'){
 const directory=path.resolve(process.argv[3]??'')
 if(path.dirname(directory)!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('hadron-worker-containment-'))throw Error('Explicit disposable fixture required')
 evidenceDirectory=directory
 const before=process.argv[4]==='before-admission'
 const args=before?['-e',`require('node:fs').writeFileSync(${JSON.stringify(path.join(directory,'UNADMITTED_WORKER'))},'must not run')`]:tree
 const worker=await launch(args,{admit:!before});await bounded(worker.ready,'prepared')
 if(!before)await waitOutput(worker)
 process.send({record:worker.record,evidenceEpoch:worker.evidenceEpoch,ready:true});setInterval(()=>{},1000)
}else{
 await import('./build-hadron-worker-host.mjs')
 const manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(binary),'build.json'),'utf8'))
 assert.equal(createHash('sha256').update(fs.readFileSync(binary)).digest('hex'),manifest.binaryHash)
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-worker-containment-')),results={}
 evidenceDirectory=directory
 console.log('Native worker containment: '+directory)
 try{
  // Stdio/argument preservation, empty argument and trailing slash/quote cases.
  const args=['plain','two words','a"b','C:\\trailing\\','',"literal $() & ;"]
  const normal=await launch(['-e','let input="";process.stdin.on("data",s=>input+=s);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({args:process.argv.slice(1),input})))',...args])
  try{await bounded(normal.ready,'normal preparation');normal.child.stdin.end('synthetic stdin');assert.equal(await bounded(normal.closed,'normal close'),0);assert.deepEqual(JSON.parse(normal.output),{args,input:'synthetic stdin'});assert.equal(normal.closedProof,true);results.exactArgumentsAndStdin=true}finally{await normal.dispose()}
  const cancellation=await launch(tree)
  try{await bounded(cancellation.ready,'cancel preparation');await waitOutput(cancellation);cancellation.stop();await bounded(cancellation.closed,'cancel close');assert.equal(cancellation.closedProof,true);const observed=await waitInspection(cancellation.record,value=>value.worker==='ended'&&['absent','empty'].includes(value.job));assert.equal(observed.parent,'alive');assert.equal(observed.ended,false);results.cancelJoinsDetachedDescendant=true}finally{await cancellation.dispose()}
  const crashed=await launch(tree)
  try{await bounded(crashed.ready,'crash preparation');await waitOutput(crashed);crashed.child.kill();await bounded(crashed.closed,'host crash close');assert.equal(crashed.closedProof,false);await waitInspection(crashed.record,value=>value.worker==='ended'&&['absent','empty'].includes(value.job));results.helperCrashKillsDescendants=true}finally{await crashed.dispose()}
  // A name collision must not alter/terminate the job owned by the first host.
  const first=await launch(['-e','process.stdout.write("first-job-intact")'],{admit:false})
  try{
   await bounded(first.ready,'first job preparation');const collision=await launch(['-e','process.exit(99)'],{job:first.job})
   try{assert.equal(await bounded(collision.closed,'collision close'),125);assert.equal(collision.record,undefined)}finally{await collision.dispose()}
   assert.equal(inspect(first.record).worker,'alive');first.admit();first.child.stdin.end();assert.equal(await bounded(first.closed,'first job close'),0);assert.equal(first.output,'first-job-intact');results.jobCollisionPreservesOwner=true
  }finally{await first.dispose()}
  for(const phase of ['running','before-admission']){
   const owner=trackedSpawn(process.execPath,[self,'--fixture-owner',directory,phase],{windowsHide:true,shell:false,env:environment,stdio:['ignore','ignore','pipe','ipc']})
   owner.stderr.on('data',()=>{})
   const ownerClosed=new Promise(resolve=>owner.once('close',resolve))
   try{
    const packet=await bounded(new Promise((resolve,reject)=>{owner.once('message',resolve);owner.once('error',reject);owner.once('exit',()=>reject(Error('Fixture owner exited before prepared')))}),'owner readiness')
    assert.equal(packet.ready,true);assert.equal(inspect(packet.record).parent,'alive')
    owner.kill();await bounded(ownerClosed,'owner death')
    const observed=await waitInspection(packet.record,value=>value.ended===true)
    assert.equal(observed.parent,'ended');assert.equal(observed.worker,'ended')
    const wrongSession=inspect({...packet.record,sessionId:packet.record.sessionId===0?1:0})
    assert.equal(wrongSession.job,'unknown');assert.equal(wrongSession.ended,false)
    const saved=new WindowsWorkerEvidenceStore(directory,packet.evidenceEpoch,value=>observeWindowsWorker(path.dirname(binary),value)).inspect()
    assert.equal(saved.state,'ended');assert.equal(saved.readOnly,true);assert.equal(saved.canResume,false)
    if(phase==='before-admission')assert.equal(fs.existsSync(path.join(directory,'UNADMITTED_WORKER')),false)
    results[phase==='running'?'parentCrashKillsWholeJob':'parentCrashBeforeAdmissionStartsNothing']=true
    fs.writeFileSync(path.join(directory,phase+'-record.json'),JSON.stringify(packet.record,null,2))
   }finally{if(owner.exitCode===null&&!owner.signalCode)owner.kill();await bounded(ownerClosed,'owner cleanup')}
  }
  const bad=spawnSync(binary,['inspect','not-a-job','1','1','1','1'],{shell:false,windowsHide:true,env:environment,encoding:'utf8',timeout:5000})
  assert.equal(bad.status,125);assert.equal(bad.stdout,'');results.invalidInspectionRefused=true
  const report={success:true,platform:process.platform,...results,durableEvidenceBeforeAdmission:true,freshReadOnlyInspectionAfterOwnerCrash:true,crossWindowsSessionRefused:true,canonicalEditingEnabled:false,realProviderRequests:0,realCredentialsUsed:false}
  fs.writeFileSync(path.join(directory,'containment-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
 }finally{for(const child of ownChildren)child.kill()}
}
