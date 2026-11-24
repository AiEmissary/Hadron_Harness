import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
type Slot='a'|'b'|'shared'|'continuous'
interface Identity {root:string;device:string;inode:string}
interface Selection extends Identity {owner:string;workspace:string;slot:Slot;roots?:Identity[];removed?:boolean}
/** Native bookmarks only. Renderer archives never carry persistent grants. */
export class RememberedFolders {
 constructor(private file:string){}
 private read():Selection[]{
  if(!fs.existsSync(this.file))return []
  const value=JSON.parse(fs.readFileSync(this.file,'utf8'))
  const identity=(item:any)=>item&&['root','device','inode'].every(key=>typeof item[key]==='string')
  if(!Array.isArray(value)||value.length>5000||value.some(v=>!identity(v)||typeof v.owner!=='string'||typeof v.workspace!=='string'||!['a','b','shared','continuous'].includes(v.slot)||(v.removed!==undefined&&typeof v.removed!=='boolean')||(v.roots!==undefined&&(!Array.isArray(v.roots)||!v.roots.length||v.roots.length>12||!v.roots.every(identity)))))throw Error('Saved folder selections could not be read')
  return value
 }
 private write(owner:string,workspace:string,slot:Slot,selection:Selection){
  const values=this.read().filter(v=>v.owner!==owner||v.workspace!==workspace||v.slot!==slot)
  values.push(selection)
  fs.mkdirSync(path.dirname(this.file),{recursive:true})
  const temporary=this.file+'.'+randomUUID()+'.tmp'
  try{fs.writeFileSync(temporary,JSON.stringify(values),{flag:'wx',mode:0o600});fs.renameSync(temporary,this.file)}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
 }
 remember(owner:string,workspace:string,slot:Slot,root:string|string[]){
  const paths=Array.isArray(root)?root:[root]
  if(!paths.length||paths.length>12)throw Error('Choose between 1 and 12 project folders')
  const seen=new Set<string>()
  const roots=paths.map(value=>{
   const canonical=fs.realpathSync(value),stat=fs.lstatSync(value,{bigint:true})
   if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Choose a project folder')
   return {root:canonical,device:String(stat.dev),inode:String(stat.ino)}
  }).filter(item=>{
   // Different spellings of one folder (such as letter case on Windows) are saved once.
   const key=item.device+':'+item.inode
   if(seen.has(key))return false
   seen.add(key);return true
  })
  this.write(owner,workspace,slot,{owner,workspace,slot,...roots[0],roots})
 }
 forget(owner:string,workspace:string,slot:Slot){
  // An explicit removal must not fall back to another mode's older selection.
  this.write(owner,workspace,slot,{owner,workspace,slot,root:'',device:'',inode:'',removed:true})
 }
 restore(owner:string,workspace:string,slot:Slot):string|string[]|null{
  const items=this.read().filter(v=>v.owner===owner&&v.workspace===workspace),value=items.find(v=>v.slot===slot)??items.at(-1)
  if(!value||value.removed)return null
  try{
   const roots=(value.roots??[value]).map(item=>{
    const canonical=fs.realpathSync(item.root),stat=fs.lstatSync(item.root,{bigint:true})
    if(canonical!==item.root||!stat.isDirectory()||stat.isSymbolicLink()||String(stat.dev)!==item.device||String(stat.ino)!==item.inode)throw Error('Changed folder')
    return canonical
   })
   return roots.length===1?roots[0]:roots
  }catch{throw Error('The saved project folder is unavailable or has changed. Attach its folder again.')}
 }
}
