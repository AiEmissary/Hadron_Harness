import fs from 'node:fs'
import path from 'node:path'

/** Pinned host storage, not a model grant or a project-write capability.
 * Recheck existing ancestors/leaves on every operation; never follow links.
 * This does not claim protection against unrelated external filesystem races. */
export class PrivateProfilePaths {
  private readonly root:string
  private readonly device:bigint
  private readonly inode:bigint
  constructor(profile:string){
    if(!path.isAbsolute(profile))throw Error('Absolute private profile required')
    const stat=fs.lstatSync(profile,{bigint:true})
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Plain private profile required')
    this.root=fs.realpathSync(profile);this.device=stat.dev;this.inode=stat.ino
  }
  private rootIdentity():void{
    const stat=fs.lstatSync(this.root,{bigint:true})
    if(stat.isSymbolicLink()||!stat.isDirectory()||stat.dev!==this.device||stat.ino!==this.inode||fs.realpathSync(this.root)!==this.root)throw Error('Private profile identity changed')
  }
  relative(relative:string):string{
    if(typeof relative!=='string'||path.isAbsolute(relative))throw Error('Private storage requires a relative path')
    return this.absolute(path.resolve(this.root,relative))
  }
  absolute(raw:string):string{
    if(typeof raw!=='string'||!path.isAbsolute(raw)||raw.includes('\0')||raw.length>8192)throw Error('Invalid private storage path')
    const target=path.resolve(raw),relative=path.relative(this.root,target)
    if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Private storage must remain inside the pinned profile')
    this.rootIdentity()
    const parts=relative?relative.split(path.sep):[]
    if(parts.length>64||parts.some(part=>part.includes(':')))throw Error('Invalid private storage path')
    let current=this.root
    for(let index=0;index<parts.length;index++){
      current=path.join(current,parts[index])
      let stat:fs.BigIntStats
      try{stat=fs.lstatSync(current,{bigint:true})}
      catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){this.rootIdentity();return target}throw error}
      if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile())||(!stat.isDirectory()&&index<parts.length-1)||stat.isFile()&&stat.nlink!==1n)throw Error('Linked or invalid private storage is unavailable')
    }
    this.rootIdentity();return target
  }
}
