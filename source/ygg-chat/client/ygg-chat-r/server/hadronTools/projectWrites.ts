import fs from 'node:fs'
import path from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import {insideProject, projectPath, selectedProjectRoot} from './projectPaths.js'
import {replaceWindowsFile,verifyWindowsReplacement} from './windowsFileCommit.js'

interface WriteDatabase {exec(sql:string):unknown;prepare(sql:string):any}
export interface ProjectWriteLease {readonly id:string}
interface LeaseRow {id:string;owner_id:string;workspace_id:string;root:string;device:string;inode:string;state:string;instance_id:string;revision:number;batch_index:number}
interface WriteRow {id:string;lease_id:string;relative_path:string;expected_hash:string|null;replacement_hash:string;before_text:string|null;after_text:string;state:string;batch_index:number;temporary_name:string|null;backup_name:string|null;metadata_hash:string|null}
interface Replacement {target:string;temporary:string;backup:string;beforeHash:string;afterHash:string}
const hash=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex')
const bounded=(value:string,max:number)=>{if(typeof value!=='string'||!value||value.length>max)throw Error('Invalid project write identity');return value}
export class ProjectWriteConflict extends Error {}

/** Dedicated coordinator storage, never a model tool. Canonical writes require
 * the current opaque lease, exact review and trusted execution/approval checks. */
export class ProjectWriteStore {
  private readonly instance=randomUUID()
  private readonly handles=new WeakMap<ProjectWriteLease,string>()
  private readonly blocked=new Set<string>()
  constructor(private readonly db:WriteDatabase,private readonly options:{replaceFile?:(packet:Replacement)=>{metadataHash?:string}|void;
    assertExecution?:(owner:string,workspace:string,leaseId:string)=>void}={}){
    if(![2,3].includes(Number(db.prepare('PRAGMA synchronous').get()?.synchronous)))throw Error('Project write journal requires FULL SQLite synchronization')
    db.exec(`
      CREATE TABLE IF NOT EXISTS hadron_project_leases (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
        root TEXT NOT NULL, device TEXT NOT NULL, inode TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('active','blocked','released')),
        instance_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, batch_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS hadron_project_live_root ON hadron_project_leases(root) WHERE state!='released';
      CREATE TABLE IF NOT EXISTS hadron_project_writes (
        id TEXT PRIMARY KEY, lease_id TEXT NOT NULL REFERENCES hadron_project_leases(id),
        relative_path TEXT NOT NULL, expected_hash TEXT, replacement_hash TEXT NOT NULL,
        before_text TEXT, after_text TEXT NOT NULL, batch_index INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('prepared','started','applied','conflict','uncertain')),
        temporary_name TEXT,backup_name TEXT,metadata_hash TEXT,
        UNIQUE(lease_id,relative_path,batch_index)
      );
      CREATE TABLE IF NOT EXISTS hadron_project_directories(lease_id TEXT NOT NULL,relative_path TEXT NOT NULL,state TEXT NOT NULL,PRIMARY KEY(lease_id,relative_path));
      CREATE TABLE IF NOT EXISTS hadron_project_reviews (
        lease_id TEXT PRIMARY KEY REFERENCES hadron_project_leases(id), snapshot_hash TEXT NOT NULL,
        verdict TEXT NOT NULL CHECK(verdict IN ('approve','changes_required')), review_text TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS hadron_project_review_history (
        id TEXT PRIMARY KEY,lease_id TEXT NOT NULL REFERENCES hadron_project_leases(id),
        snapshot_hash TEXT NOT NULL,verdict TEXT NOT NULL,review_text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS hadron_project_recoveries (
        id TEXT PRIMARY KEY,lease_id TEXT NOT NULL REFERENCES hadron_project_leases(id),
        inspection_hash TEXT NOT NULL,observations_json TEXT NOT NULL,
        decision TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
  }
  private transaction<T>(work:()=>T):T{
    this.db.exec('BEGIN IMMEDIATE')
    try{const result=work();this.db.exec('COMMIT');return result}
    catch(error){this.db.exec('ROLLBACK');throw error}
  }
  acquire(owner:string,workspace:string,root:string,protectedRoots:string[]=[]):ProjectWriteLease{
    bounded(owner,128);bounded(workspace,128)
    const canonical=selectedProjectRoot(root,protectedRoots),stat=fs.lstatSync(canonical,{bigint:true}),id=randomUUID()
    this.transaction(()=>{
      const live=this.db.prepare("SELECT root FROM hadron_project_leases WHERE state!='released'").all() as Array<{root:string}>
      if(live.some(item=>insideProject(item.root,canonical)||insideProject(canonical,item.root)))throw Error('An overlapping project writer already holds this folder')
      this.db.prepare("INSERT INTO hadron_project_leases (id,owner_id,workspace_id,root,device,inode,state,instance_id) VALUES (?,?,?,?,?,?,'active',?)").run(id,owner,workspace,canonical,stat.dev.toString(),stat.ino.toString(),this.instance)
    })
    const handle=Object.freeze({id});this.handles.set(handle,id);return handle
  }
  private lease(handle:ProjectWriteLease,owner:string,ready=true):LeaseRow{
    const id=this.handles.get(handle),row=id?this.db.prepare('SELECT * FROM hadron_project_leases WHERE id=? AND owner_id=?').get(id,owner) as LeaseRow:undefined
    if(!row||row.instance_id!==this.instance||row.state==='released')throw Error('Project write capability is unavailable')
    if(ready&&(this.blocked.has(row.id)||row.state!=='active'||this.db.prepare("SELECT 1 FROM hadron_project_writes WHERE lease_id=? AND state IN ('started','uncertain')").get(row.id)))throw Error('Interrupted project write requires intervention; no replay is permitted')
    const stat=fs.lstatSync(row.root,{bigint:true})
    if(stat.isSymbolicLink()||!stat.isDirectory()||stat.dev.toString()!==row.device||stat.ino.toString()!==row.inode||fs.realpathSync(row.root)!==row.root)throw Error('Selected project folder changed')
    return row
  }
  private read(row:LeaseRow,relative:string):{text:string;hash:string}|null{
    const file=projectPath(row.root,relative,{missingLeaf:true,missingParents:true})
    let fd:number
    try{fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}
    try{
      const before=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(file,{bigint:true})
      if(!before.isFile()||before.nlink!==1n||before.size>131072n||named.isSymbolicLink()||before.ino!==named.ino||before.dev!==named.dev)throw Error('Expected a plain text file up to 128 KiB')
      const bytes=Buffer.alloc(Number(before.size)+1);let length=0
      while(length<bytes.length){const got=fs.readSync(fd,bytes,length,bytes.length-length,length);if(!got)break;length+=got}
      const after=fs.fstatSync(fd,{bigint:true}),current=fs.lstatSync(projectPath(row.root,relative),{bigint:true})
      if(BigInt(length)!==before.size||after.size!==before.size||after.mtimeNs!==before.mtimeNs||after.ctimeNs!==before.ctimeNs||current.ino!==before.ino||current.dev!==before.dev)throw new ProjectWriteConflict('File changed during read')
      // Preserve a UTF-8 BOM in persisted text so hashing the saved before-image
      // reproduces the original bytes exactly (TextDecoder otherwise strips it).
      const content=bytes.subarray(0,length),text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(content)
      if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw Error('Binary replacement is unavailable')
      return {text,hash:hash(content)}
    }finally{fs.closeSync(fd)}
  }
  /** Bounded source evidence for the trusted coordinator; does not grant a model file access. */
  selectedRoot(handle:ProjectWriteLease,owner:string):string{return this.lease(handle,owner).root}
  readForProposal(handle:ProjectWriteLease,owner:string,relative:string){
    const row=this.lease(handle,owner);bounded(relative,1024)
    const content=this.read(row,relative)
    return {path:relative,hash:content?.hash??null,text:content?.text??null}
  }
  /** Agent A's draft is persisted without changing the selected project. */
  propose(handle:ProjectWriteLease,owner:string,operationId:string,relative:string,expectedHash:string|null,text:string):void{
    const row=this.lease(handle,owner);bounded(operationId,128);bounded(relative,1024)
    if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>131072||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)||
      (expectedHash!==null&&!/^[a-f0-9]{64}$/.test(expectedHash)))throw Error('Invalid bounded text change')
    const current=this.read(row,relative),replacement=hash(text)
    if((current?.hash??null)!==expectedHash)throw new ProjectWriteConflict('Expected file hash no longer matches')
    this.transaction(()=>{
      const existing=this.db.prepare('SELECT * FROM hadron_project_writes WHERE id=?').get(operationId) as WriteRow|undefined
      if(existing){
        if(existing.lease_id!==row.id||existing.batch_index!==row.batch_index||existing.relative_path!==relative||existing.expected_hash!==expectedHash||existing.after_text!==text||existing.state!=='prepared')throw Error('Immutable write proposal conflict')
        return
      }
      const targetKey=(relativePath:string)=>{
        const target=projectPath(row.root,relativePath,{missingLeaf:true,missingParents:true})
        try{const stat=fs.lstatSync(target,{bigint:true});return `${stat.dev}:${stat.ino}`}
        catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return process.platform==='win32'?target.toLowerCase():target}
      }
      const key=targetKey(relative)
      const batchPaths=this.db.prepare('SELECT relative_path FROM hadron_project_writes WHERE lease_id=? AND batch_index=?').all(row.id,row.batch_index) as Array<{relative_path:string}>
      if(batchPaths.some(item=>targetKey(item.relative_path)===key))throw Error('Duplicate project target in the same edit batch')
      if(this.db.prepare("SELECT 1 FROM hadron_project_writes WHERE lease_id=? AND batch_index=? AND state!='prepared'").get(row.id,row.batch_index))throw Error('This edit batch is already closed')
      const count=this.db.prepare('SELECT COUNT(*) AS count FROM hadron_project_writes WHERE lease_id=? AND batch_index=?').get(row.id,row.batch_index).count
      if(count>=20)throw Error('Edit batch limit reached')
      this.db.prepare("INSERT INTO hadron_project_writes (id,lease_id,relative_path,expected_hash,replacement_hash,before_text,after_text,batch_index,state) VALUES (?,?,?,?,?,?,?,?,'prepared')").run(operationId,row.id,relative,expectedHash,replacement,current?.text??null,text,row.batch_index)
      this.db.prepare('UPDATE hadron_project_leases SET revision=revision+1 WHERE id=?').run(row.id)
      this.db.prepare('DELETE FROM hadron_project_reviews WHERE lease_id=?').run(row.id)
    })
  }
  snapshot(handle:ProjectWriteLease,owner:string){
    return this.snapshotRow(this.lease(handle,owner))
  }
  /** Read-only exact review assertion during the synchronous started/commit
   * interval. This never bypasses apply's separate no-replay readiness checks. */
  assertReviewedSnapshot(handle:ProjectWriteLease,owner:string,snapshotHash:string):void{
    const row=this.lease(handle,owner,false)
    if(this.blocked.has(row.id)||row.state!=='active')throw Error('Project review capability is blocked')
    const snapshot=this.snapshotRow(row),review=this.db.prepare('SELECT snapshot_hash,verdict FROM hadron_project_reviews WHERE lease_id=?').get(row.id)
    if(snapshot.snapshotHash!==snapshotHash||review?.snapshot_hash!==snapshotHash||review.verdict!=='approve')throw Error('Project reviewed snapshot changed')
  }
  private snapshotRow(row:LeaseRow){
    const writes=this.db.prepare('SELECT * FROM hadron_project_writes WHERE lease_id=? AND batch_index=? ORDER BY relative_path').all(row.id,row.batch_index) as WriteRow[]
    for(const item of writes)if(hash(item.after_text)!==item.replacement_hash||(item.expected_hash===null?item.before_text!==null:item.before_text===null||hash(item.before_text)!==item.expected_hash))throw Error('Stored proposal content hash mismatch')
    const snapshotHash=hash(JSON.stringify({leaseId:row.id,revision:row.revision,batch:row.batch_index,files:writes.map(item=>({id:item.id,path:item.relative_path,before:item.expected_hash,after:item.replacement_hash}))}))
    return {leaseId:row.id,revision:row.revision,batch:row.batch_index,snapshotHash,files:writes.map(item=>({id:item.id,path:item.relative_path,beforeHash:item.expected_hash,afterHash:item.replacement_hash,before:item.before_text,after:item.after_text,state:item.state}))}
  }
  /** The trusted coordinator authenticates Agent B; never expose this as a model-callable approval tool. */
  recordReview(handle:ProjectWriteLease,owner:string,reviewer:'b',snapshotHash:string,verdict:'approve'|'changes_required',text:string):void{
    const snapshot=this.snapshot(handle,owner)
    if(reviewer!=='b'||snapshot.snapshotHash!==snapshotHash||!snapshot.files.length||!['approve','changes_required'].includes(verdict))throw Error('Review must match the exact nonempty proposal snapshot')
    bounded(text,16000)
    this.transaction(()=>{
      const count=this.db.prepare('SELECT COUNT(*) AS count FROM hadron_project_review_history WHERE lease_id=?').get(handle.id).count
      if(count>=4)throw Error('Review history limit reached')
      this.db.prepare('INSERT INTO hadron_project_review_history (id,lease_id,snapshot_hash,verdict,review_text) VALUES (?,?,?,?,?)').run(randomUUID(),handle.id,snapshotHash,verdict,text)
      this.db.prepare('INSERT OR REPLACE INTO hadron_project_reviews VALUES (?,?,?,?)').run(handle.id,snapshotHash,verdict,text)
    })
  }
  /** One explicit staged correction; previous proposals stay immutable in the journal. */
  beginCorrection(handle:ProjectWriteLease,owner:string):void{
    const row=this.lease(handle,owner),snapshot=this.snapshot(handle,owner),review=this.db.prepare('SELECT * FROM hadron_project_reviews WHERE lease_id=?').get(row.id)
    if(row.batch_index!==0||review?.verdict!=='changes_required'||review.snapshot_hash!==snapshot.snapshotHash||snapshot.files.some(item=>item.state!=='prepared'))throw Error('One correction is available only for a rejected, unapplied first batch')
    this.transaction(()=>{
      this.db.prepare('UPDATE hadron_project_leases SET batch_index=1,revision=revision+1 WHERE id=? AND batch_index=0').run(row.id)
      this.db.prepare('DELETE FROM hadron_project_reviews WHERE lease_id=?').run(row.id)
    })
  }
  /** Only an explicit coordinator action may apply a reviewed operation. Never called during recovery. */
  apply(handle:ProjectWriteLease,owner:string,operationId:string,signal:AbortSignal):void{
    signal.throwIfAborted();const row=this.lease(handle,owner),snapshot=this.snapshot(handle,owner)
    const assertExecution=()=>{
      if(typeof this.options.assertExecution!=='function'||this.options.assertExecution(owner,row.workspace_id,row.id)!==undefined)throw Error('Canonical project write admission is unavailable')
    }
    assertExecution()
    const review=this.db.prepare('SELECT * FROM hadron_project_reviews WHERE lease_id=?').get(row.id)
    if(review?.verdict!=='approve'||review.snapshot_hash!==snapshot.snapshotHash)throw Error('A matching Agent B approval is required')
    const operation=this.db.prepare('SELECT * FROM hadron_project_writes WHERE id=? AND lease_id=?').get(operationId,row.id) as WriteRow|undefined
    if(!operation||operation.batch_index!==row.batch_index||operation.state!=='prepared')throw Error('Write is not prepared; completed, superseded or uncertain writes are never replayed')
    if(hash(operation.after_text)!==operation.replacement_hash)throw Error('Stored replacement hash mismatch')
    const target=projectPath(row.root,operation.relative_path,{missingLeaf:true,missingParents:true}),temporary=path.join(path.dirname(target),`.hadron-write-${randomUUID()}.tmp`),backup=path.join(path.dirname(target),`.hadron-write-${randomUUID()}.backup`)
    // This durable boundary precedes every possible project-file mutation.
    this.transaction(()=>this.db.prepare("UPDATE hadron_project_writes SET state='started',temporary_name=?,backup_name=? WHERE id=? AND state='prepared'").run(path.basename(temporary),process.platform==='win32'&&operation.expected_hash!==null?path.basename(backup):null,operationId))
    let temporaryOwned=false,retainArtifacts=false,metadataHash:string|null=null
    try{
      if(operation.expected_hash===null){
        const parts=operation.relative_path.split('/').slice(0,-1)
        for(let index=1;index<=parts.length;index++){
          signal.throwIfAborted();this.lease(handle,owner,false);assertExecution();this.assertReviewedSnapshot(handle,owner,snapshot.snapshotHash)
          const relative=parts.slice(0,index).join('/'),directory=projectPath(row.root,relative,{missingLeaf:true})
          try{if(!fs.lstatSync(directory).isDirectory())throw Error('Project parent is not a directory')}
          catch(error){
            if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error
            this.db.prepare("INSERT INTO hadron_project_directories VALUES (?,?,'started')").run(row.id,relative)
            try{fs.mkdirSync(directory);projectPath(row.root,relative);this.db.prepare("UPDATE hadron_project_directories SET state='created' WHERE lease_id=? AND relative_path=?").run(row.id,relative)}
            catch(error){this.db.prepare("UPDATE hadron_project_directories SET state='uncertain' WHERE lease_id=? AND relative_path=?").run(row.id,relative);throw error}
          }
        }
      }
      if((this.read(row,operation.relative_path)?.hash??null)!==operation.expected_hash)throw new ProjectWriteConflict('File changed after review')
      const fd=fs.openSync(temporary,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL,0o600);temporaryOwned=true
      try{fs.writeFileSync(fd,operation.after_text,'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
      signal.throwIfAborted();this.lease(handle,owner,false);assertExecution()
      if((this.read(row,operation.relative_path)?.hash??null)!==operation.expected_hash)throw new ProjectWriteConflict('File changed before commit')
      if(operation.expected_hash===null){
        try{fs.linkSync(temporary,target)}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new ProjectWriteConflict('New file appeared before commit');throw error}
        fs.unlinkSync(temporary);temporaryOwned=false
      }else{
        if(this.options.replaceFile){const receipt=this.options.replaceFile({target,temporary,backup,beforeHash:operation.expected_hash,afterHash:operation.replacement_hash});metadataHash=receipt?.metadataHash??null}
        else if(process.platform==='win32'){
          retainArtifacts=true
          metadataHash=replaceWindowsFile(target,temporary,backup,operation.expected_hash,operation.replacement_hash).metadataHash
          retainArtifacts=false
        }else{
          const original=fs.lstatSync(target)
          if(original.mode&0o6000)throw Error('Privileged file modes are unsupported')
          fs.chownSync(temporary,original.uid,original.gid);fs.chmodSync(temporary,original.mode&0o777)
          fs.renameSync(temporary,target)
          const committed=fs.lstatSync(target)
          if(committed.uid!==original.uid||committed.gid!==original.gid||(committed.mode&0o777)!==(original.mode&0o777))throw Error('File permission preservation could not be confirmed')
          metadataHash=hash(JSON.stringify({uid:committed.uid,gid:committed.gid,mode:committed.mode&0o777}))
        }
        temporaryOwned=false
      }
      if(this.read(row,operation.relative_path)?.hash!==operation.replacement_hash)throw Error('Committed file hash could not be confirmed')
      assertExecution()
      this.transaction(()=>this.db.prepare("UPDATE hadron_project_writes SET state='applied',metadata_hash=? WHERE id=? AND state='started'").run(metadataHash,operationId))
    }catch(error){
      this.blocked.add(row.id)
      try{this.transaction(()=>{
        this.db.prepare("UPDATE hadron_project_writes SET state=? WHERE id=?").run(error instanceof ProjectWriteConflict?'conflict':'uncertain',operationId)
        this.db.prepare("UPDATE hadron_project_leases SET state='blocked' WHERE id=?").run(row.id)
      })}catch{/* The durable started row and in-memory fence still prohibit replay. */}
      throw error
    }finally{
      if(temporaryOwned&&!retainArtifacts){try{fs.unlinkSync(temporary)}catch{/* Never delete or retry the target. */}}
    }
  }
  inspect(owner:string,leaseId:string){
    const row=this.db.prepare('SELECT * FROM hadron_project_leases WHERE id=? AND owner_id=?').get(leaseId,owner) as LeaseRow|undefined
    if(!row)throw Error('Project write record unavailable')
    const files=this.db.prepare('SELECT * FROM hadron_project_writes WHERE lease_id=? ORDER BY relative_path').all(row.id) as WriteRow[]
    const observed=files.map(item=>{
      let observedHash:string|null|undefined
      try{const root=fs.lstatSync(row.root,{bigint:true});if(root.isSymbolicLink()||root.ino.toString()!==row.inode||root.dev.toString()!==row.device)throw Error('Root changed');observedHash=this.read(row,item.relative_path)?.hash??null}catch{/* Unreadable remains unknown. */}
      return {id:item.id,path:item.relative_path,batch:item.batch_index,state:item.state,observed:observedHash===undefined?'unknown':observedHash===item.replacement_hash?'matches-replacement':observedHash===item.expected_hash?'matches-original':'different',expectedHash:item.expected_hash,replacementHash:item.replacement_hash}
    })
    const reviews=this.db.prepare('SELECT snapshot_hash AS snapshotHash,verdict,review_text AS text FROM hadron_project_review_history WHERE lease_id=? ORDER BY rowid').all(row.id)
    return {leaseId:row.id,state:row.state,batch:row.batch_index,interventionRequired:(row.state!=='released'&&row.instance_id!==this.instance)||row.state==='blocked'||observed.some(item=>['started','uncertain','conflict'].includes(item.state)||(item.state==='applied'&&item.observed!=='matches-replacement')),files:observed,reviews}
  }
  /** Saved diffs remain reviewable offline; this does not recreate any write capability. */
  savedProposals(owner:string,leaseId:string){
    if(!this.db.prepare('SELECT 1 FROM hadron_project_leases WHERE id=? AND owner_id=?').get(leaseId,owner))throw Error('Project write record unavailable')
    const files=this.db.prepare('SELECT * FROM hadron_project_writes WHERE lease_id=? ORDER BY batch_index,relative_path').all(leaseId) as WriteRow[]
    for(const item of files)if(hash(item.after_text)!==item.replacement_hash||(item.expected_hash===null?item.before_text!==null:item.before_text===null||hash(item.before_text)!==item.expected_hash))throw Error('Stored proposal content hash mismatch')
    return files.map(item=>({id:item.id,path:item.relative_path,batch:item.batch_index,beforeHash:item.expected_hash,afterHash:item.replacement_hash,before:item.before_text,after:item.after_text,state:item.state}))
  }
  /** Read-only recovery inspection. It neither reacquires a capability nor retries a write. */
  recoveryPlan(owner:string,leaseId:string){
    const row=this.db.prepare('SELECT * FROM hadron_project_leases WHERE id=? AND owner_id=?').get(leaseId,owner) as LeaseRow|undefined
    if(!row)throw Error('Project write record unavailable')
    this.savedProposals(owner,leaseId) // Reject corrupt saved before/after images.
    let rootValid=false
    try{const stat=fs.lstatSync(row.root,{bigint:true});rootValid=stat.isDirectory()&&!stat.isSymbolicLink()&&stat.dev.toString()===row.device&&stat.ino.toString()===row.inode&&fs.realpathSync(row.root)===row.root}catch{/* Unknown roots stay held. */}
    const operations=this.db.prepare('SELECT * FROM hadron_project_writes WHERE lease_id=? ORDER BY batch_index,rowid').all(leaseId) as WriteRow[]
    const latest=new Map<string,WriteRow>();for(const operation of operations)latest.set(operation.relative_path,operation)
    const identity=(stat:fs.BigIntStats)=>({device:stat.dev.toString(),inode:stat.ino.toString(),mode:Number(stat.mode),size:stat.size.toString(),modified:stat.mtimeNs.toString(),changed:stat.ctimeNs.toString()})
    const artifact=(operation:WriteRow,name:string|null)=>{
      if(!name)return null
      if(!/^\.hadron-write-[a-f0-9-]{36}\.(tmp|backup)$/.test(name))throw Error('Invalid saved operation artifact')
      try{
        if(!rootValid)throw Error('Unknown root')
        const file=path.join(path.dirname(projectPath(row.root,operation.relative_path,{missingLeaf:true,missingParents:true})),name)
        let fd:number
        try{fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {name,state:'absent' as const};throw error}
        try{
          const stat=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(file,{bigint:true})
          if(!stat.isFile()||stat.nlink!==1n||stat.size>131072n||named.isSymbolicLink()||named.ino!==stat.ino||named.dev!==stat.dev)throw Error('Unknown artifact')
          const bytes=Buffer.alloc(Number(stat.size)+1);let length=0
          while(length<bytes.length){const count=fs.readSync(fd,bytes,length,bytes.length-length,length);if(!count)break;length+=count}
          const after=fs.fstatSync(fd,{bigint:true}),current=fs.lstatSync(file,{bigint:true})
          if(BigInt(length)!==stat.size||after.ctimeNs!==stat.ctimeNs||after.mtimeNs!==stat.mtimeNs||current.ino!==stat.ino||current.dev!==stat.dev)throw Error('Artifact changed')
          return {name,state:'present' as const,hash:hash(bytes.subarray(0,length)),identity:identity(stat)}
        }finally{fs.closeSync(fd)}
      }catch{return {name,state:'unknown' as const}}
    }
    const files=[...latest.values()].map(operation=>{
      let observedHash:string|null|undefined,observedIdentity:ReturnType<typeof identity>|null=null
      try{
        if(!rootValid)throw Error('Unknown root')
        const target=projectPath(row.root,operation.relative_path,{missingLeaf:true,missingParents:true})
        let before:fs.BigIntStats|null=null
        try{before=fs.lstatSync(target,{bigint:true})}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
        observedHash=this.read(row,operation.relative_path)?.hash??null
        if(before){const after=fs.lstatSync(target,{bigint:true});if(JSON.stringify(identity(before))!==JSON.stringify(identity(after)))throw Error('File changed');observedIdentity=identity(after)}
        else if(fs.existsSync(target))throw Error('File appeared')
      }catch{observedHash=undefined}
      const temporary=artifact(operation,operation.temporary_name),backup=artifact(operation,operation.backup_name)
      let metadataStatus='not-required',observedMetadataHash:string|null=null
      if(process.platform==='win32'&&!this.options.replaceFile&&operation.expected_hash!==null&&observedHash===operation.replacement_hash&&operation.state!=='prepared'){
        metadataStatus='unknown'
        try{
          if(backup?.state!=='present'||backup.hash!==operation.expected_hash)throw Error('Original metadata backup unavailable')
          const target=projectPath(row.root,operation.relative_path),backupPath=path.join(path.dirname(target),backup.name)
          observedMetadataHash=verifyWindowsReplacement(target,backupPath,operation.expected_hash,operation.replacement_hash).metadataHash
          if(operation.metadata_hash&&operation.metadata_hash!==observedMetadataHash)throw Error('Metadata changed')
          metadataStatus='verified-against-backup'
        }catch{/* Unsupported/changed metadata retains the lease. */}
      }
      return {path:operation.relative_path,id:operation.id,state:operation.state,batch:operation.batch_index,
        beforeHash:operation.expected_hash,afterHash:operation.replacement_hash,observedHash:observedHash??null,identity:observedIdentity,
        observed:observedHash===undefined?'unknown':observedHash===operation.replacement_hash?'matches-replacement':observedHash===operation.expected_hash?'matches-original':'different',
        temporary,backup,metadataHash:operation.metadata_hash,metadataStatus,observedMetadataHash}
    })
    const observations={leaseId,state:row.state,batch:row.batch_index,revision:row.revision,rootValid,files,
      reconcilable:rootValid&&files.every(file=>['matches-original','matches-replacement'].includes(file.observed)&&file.temporary?.state!=='unknown'&&file.backup?.state!=='unknown'&&file.metadataStatus!=='unknown')}
    return {...observations,inspectionHash:hash(JSON.stringify(observations))}
  }
  /** Trusted coordinator only. The stop assertion must inspect actual owned runtime
   * state, never a user/model boolean. Keeps current files and artifacts unchanged. */
  reconcileAfterStop(handle:ProjectWriteLease,owner:string,inspectionHash:string,assertStopped:()=>void){
    const id=this.handles.get(handle),row=id?this.db.prepare('SELECT * FROM hadron_project_leases WHERE id=? AND owner_id=?').get(id,owner) as LeaseRow:undefined
    if(!row||row.instance_id!==this.instance)throw Error('Recovery requires the original live host capability; restart inspection is read-only')
    if(typeof assertStopped!=='function'||assertStopped()!==undefined)throw Error('Synchronous trusted worker-stop assertion required')
    return this.transaction(()=>{
      const plan=this.recoveryPlan(owner,row.id)
      if(!plan.reconcilable||plan.inspectionHash!==inspectionHash)throw Error('Recovery observations changed or require manual inspection')
      if(assertStopped()!==undefined)throw Error('Synchronous trusted worker-stop assertion required')
      const previous=this.db.prepare('SELECT id FROM hadron_project_recoveries WHERE lease_id=? ORDER BY rowid DESC LIMIT 1').get(row.id)
      if(row.state==='released'){
        if(!previous)throw Error('This lease was already released without a recovery checkpoint')
        return {recoveryId:previous.id,filesChanged:false as const}
      }
      const recoveryId=randomUUID()
      this.db.prepare('INSERT INTO hadron_project_recoveries (id,lease_id,inspection_hash,observations_json,decision) VALUES (?,?,?,?,?)').run(recoveryId,row.id,inspectionHash,JSON.stringify(plan),'keep_observed_files')
      this.db.prepare("UPDATE hadron_project_leases SET state='released' WHERE id=?").run(row.id)
      this.db.prepare('DELETE FROM hadron_project_reviews WHERE lease_id=?').run(row.id)
      // Keep the opaque handle only for an interrupted execution-marker release.
      // All ordinary proposal/apply methods reject the released lease.
      return {recoveryId,filesChanged:false as const}
    })
  }
  assertRecoveryClosed(handle:ProjectWriteLease,owner:string):void{
    const id=this.handles.get(handle),row=id?this.db.prepare('SELECT * FROM hadron_project_leases WHERE id=? AND owner_id=?').get(id,owner) as LeaseRow:undefined
    const receipt=row?this.db.prepare('SELECT observations_json FROM hadron_project_recoveries WHERE lease_id=? ORDER BY rowid DESC LIMIT 1').get(row.id):undefined
    if(!row||row.instance_id!==this.instance||row.state!=='released'||!receipt)throw Error('Recovery checkpoint is not closed')
    const saved=JSON.parse(receipt.observations_json),current=this.recoveryPlan(owner,row.id)
    if(!current.reconcilable||saved.revision!==current.revision||JSON.stringify(saved.files)!==JSON.stringify(current.files))throw Error('Files changed after recovery reconciliation')
  }
  release(handle:ProjectWriteLease,owner:string):void{
    const row=this.lease(handle,owner)
    if(this.inspect(owner,row.id).interventionRequired||!this.recoveryPlan(owner,row.id).reconcilable)throw Error('Changed or uncertain project files require intervention')
    this.transaction(()=>this.db.prepare("UPDATE hadron_project_leases SET state='released' WHERE id=? AND state='active'").run(row.id))
    this.handles.delete(handle)
  }
}
