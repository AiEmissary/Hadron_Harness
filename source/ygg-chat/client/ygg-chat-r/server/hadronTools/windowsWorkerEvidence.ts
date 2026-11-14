import fs from 'node:fs'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {PrivateProfilePaths} from './privateProfilePaths.js'
import {executionStartup} from './executionStartup.js'

export interface WindowsWorkerRecord {
 version:1;epoch:string;job:string;sessionId:number;parentPid:number;parentCreated:string;workerPid:number;workerCreated:string
}
export interface WindowsWorkerObservation {
 parent:'alive'|'ended'|'unknown';worker:'alive'|'ended'|'unknown';job:'active'|'empty'|'absent'|'unknown';active:number|null
}
export function verifiedWindowsWorkerBinary(nativeDirectory:string):string{
 if(process.platform!=='win32'||process.arch!=='x64')throw Error('Windows x64 worker host required')
 const paths=new PrivateProfilePaths(nativeDirectory)
 const manifest=JSON.parse(boundedRead(paths,path.join(nativeDirectory,'build.json'),16384).toString('utf8'))
 const binary=paths.relative('HadronWorkerHost.exe'),bytes=boundedRead(paths,binary,4*1024*1024)
 if(manifest.version!==1||!/^[a-f0-9]{64}$/.test(manifest.binaryHash)||createHash('sha256').update(bytes).digest('hex')!==manifest.binaryHash)throw Error('Native worker build integrity unavailable')
 return binary
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const unknown=():WindowsWorkerObservation=>({parent:'unknown',worker:'unknown',job:'unknown',active:null})
function record(value:unknown):WindowsWorkerRecord{
 const item=value as WindowsWorkerRecord
 if(!item||Object.keys(item).sort().join(',')!=='epoch,job,parentCreated,parentPid,sessionId,version,workerCreated,workerPid'||item.version!==1||
  typeof item.epoch!=='string'||!uuid.test(item.epoch)||typeof item.job!=='string'||!/^Local\\HadronWorker-[a-f0-9]{32}$/.test(item.job)||
  ![item.parentPid,item.workerPid].every(pid=>Number.isSafeInteger(pid)&&pid>0&&pid<=0xffffffff)||
  !Number.isSafeInteger(item.sessionId)||item.sessionId<0||item.sessionId>0xffffffff||
  ![item.parentCreated,item.workerCreated].every(created=>typeof created==='string'&&/^[0-9]{15,20}$/.test(created)))throw Error('Invalid native worker evidence')
 return item
}
function boundedRead(paths:PrivateProfilePaths,file:string,max:number):Buffer{
 paths.absolute(file)
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
 try{
  const before=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(file,{bigint:true})
  if(!before.isFile()||before.nlink!==1n||before.size>BigInt(max)||named.dev!==before.dev||named.ino!==before.ino)throw Error('Invalid worker evidence storage')
  const bytes=Buffer.alloc(Number(before.size)+1);let length=0
  while(length<bytes.length){const count=fs.readSync(fd,bytes,length,bytes.length-length,length);if(!count)break;length+=count}
  paths.absolute(file)
  const after=fs.fstatSync(fd,{bigint:true}),current=fs.lstatSync(file,{bigint:true})
  if(BigInt(length)!==before.size||after.size!==before.size||after.ctimeNs!==before.ctimeNs||after.mtimeNs!==before.mtimeNs||current.dev!==before.dev||current.ino!==before.ino)throw Error('Worker evidence changed while reading')
  return bytes.subarray(0,length)
 }finally{fs.closeSync(fd)}
}

/** Read-only OS observer. Unknown/denied/corrupt cases cannot assert termination.
 * These observations are not permission to clear an execution record. */
export function observeWindowsWorker(nativeDirectory:string,input:WindowsWorkerRecord):WindowsWorkerObservation{
 try{
  if(process.platform!=='win32'||process.arch!=='x64')return unknown()
  const item=record(input),binary=verifiedWindowsWorkerBinary(nativeDirectory)
  const systemRoot=process.env.SystemRoot??process.env.WINDIR
  if(!systemRoot||!path.isAbsolute(systemRoot))return unknown()
  const result=spawnSync(binary,['inspect',item.job,String(item.parentPid),item.parentCreated,String(item.workerPid),item.workerCreated,String(item.sessionId)],{
   shell:false,windowsHide:true,timeout:5000,maxBuffer:4096,encoding:'utf8',cwd:nativeDirectory,env:{SystemRoot:systemRoot,WINDIR:systemRoot}})
  if(result.error||result.status!==0)return unknown()
  const value=JSON.parse(result.stdout)
  if(value.version!==1||value.readOnly!==true||!['alive','ended','unknown'].includes(value.parent)||!['alive','ended','unknown'].includes(value.worker)||
   !['active','empty','absent','unknown'].includes(value.job)||!(value.active===null||Number.isSafeInteger(value.active)&&value.active>=0&&value.active<=0xffffffff)||
   value.job==='empty'&&value.active!==0||value.job==='active'&&!(value.active>0)||value.job==='absent'&&value.active!==null)return unknown()
  return {parent:value.parent,worker:value.worker,job:value.job,active:value.active}
 }catch{return unknown()}
}

/** Durable admission evidence, not a resumed lease or a write capability.
 * Host transport must call recordPrepared before acknowledging native start. */
export class WindowsWorkerEvidenceStore {
 private readonly paths:PrivateProfilePaths
 private readonly directory:string
 constructor(profile:string,private readonly epoch:string,private readonly observe:(record:WindowsWorkerRecord)=>WindowsWorkerObservation){
  if(!uuid.test(epoch))throw Error('Invalid worker epoch')
  if(executionStartup.isConfigured())executionStartup.assertPrivatePath(profile)
  this.paths=new PrivateProfilePaths(profile);this.directory=this.paths.relative(path.join('worker-process-evidence',epoch))
 }
 private check(file:string){if(executionStartup.isConfigured())executionStartup.assertPrivatePath(file);this.paths.absolute(file)}
 recordPrepared(packet:any,expected:{job:string;nonce:string;workerPid:number}):string{
  if(!packet||packet.version!==1||packet.type!=='prepared'||!expected||!/^Local\\HadronWorker-[a-f0-9]{32}$/.test(expected.job)||
   !/^[a-f0-9]{64}$/.test(expected.nonce)||packet.nonce!==expected.nonce||packet.job!==expected.job||packet.parentPid!==process.pid||packet.workerPid!==expected.workerPid)throw Error('Native worker preparation does not match this owned launch')
  const value=record({version:1,epoch:this.epoch,job:packet.job,sessionId:packet.sessionId,parentPid:packet.parentPid,parentCreated:packet.parentCreated,workerPid:packet.workerPid,workerCreated:packet.workerCreated})
  this.check(this.directory);fs.mkdirSync(this.directory,{recursive:true,mode:0o700});this.check(this.directory)
  const id=randomUUID(),file=path.join(this.directory,id+'.json');this.check(file)
  const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW??0),0o600)
  try{fs.writeFileSync(fd,JSON.stringify(value)+'\n','utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  // A partial/ambiguous record is deliberately retained if validation fails.
  this.check(file);record(JSON.parse(boundedRead(this.paths,file,4096).toString('utf8')))
  return id
 }
 inspect(){
  const base={readOnly:true as const,canResume:false as const,epoch:this.epoch}
  try{
   this.check(this.directory)
   const names=fs.readdirSync(this.directory)
   if(!names.length||names.length>256||names.some(name=>!uuid.test(name.slice(0,-5))||!name.endsWith('.json')))return {...base,state:'unknown' as const,workers:0}
   const observations=names.map(name=>{
    const file=path.join(this.directory,name);this.check(file)
    const value=record(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(boundedRead(this.paths,file,4096))))
    if(value.epoch!==this.epoch)throw Error('Worker epoch mismatch')
    return this.observe(value)
   })
   const ended=observations.every(value=>value.parent==='ended'&&value.worker==='ended'&&(value.job==='absent'&&value.active===null||value.job==='empty'&&value.active===0))
   const alive=observations.some(value=>value.parent==='alive'||value.worker==='alive'||value.job==='active')
   return {...base,state:ended?'ended' as const:alive?'active' as const:'unknown' as const,workers:names.length}
  }catch{return {...base,state:'unknown' as const,workers:0}}
 }
}

/** Installed by the trusted desktop host, never by IPC or model input. */
let desktopObservation:{profile:string;nativeDirectory:string}|undefined
export function installWindowsWorkerEvidenceHost(profile:string,nativeDirectory:string):void{
 if(!path.isAbsolute(profile)||!path.isAbsolute(nativeDirectory))throw Error('Absolute worker observation paths required')
 executionStartup.assertPrivatePath(profile)
 if(desktopObservation&&(desktopObservation.profile!==profile||desktopObservation.nativeDirectory!==nativeDirectory))throw Error('Worker observation host cannot change paths')
 desktopObservation=Object.freeze({profile,nativeDirectory})
}
export function inspectSavedWindowsWorkerEpoch(epoch:string):'ended'|'active'|'unknown'{
 if(!desktopObservation)return 'unknown'
 try{return new WindowsWorkerEvidenceStore(desktopObservation.profile,epoch,item=>observeWindowsWorker(desktopObservation!.nativeDirectory,item)).inspect().state}
 catch{return 'unknown'}
}
