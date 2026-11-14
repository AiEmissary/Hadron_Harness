import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
type Slot='a'|'b'|'shared'|'continuous'
interface Selection {owner:string;workspace:string;slot:Slot;root:string;device:string;inode:string}
/** Native bookmarks only. Renderer archives never carry persistent grants. */
export class RememberedFolders {
 constructor(private file:string){}
 private read():Selection[]{
  if(!fs.existsSync(this.file))return []
  const value=JSON.parse(fs.readFileSync(this.file,'utf8'))
  if(!Array.isArray(value)||value.length>5000||value.some(v=>!v||!['owner','workspace','root','device','inode'].every(k=>typeof v[k]==='string')||!['a','b','shared','continuous'].includes(v.slot)))throw Error('Saved folder selections could not be read')
  return value
 }
 remember(owner:string,workspace:string,slot:Slot,root:string){
  const canonical=fs.realpathSync(root),stat=fs.lstatSync(canonical,{bigint:true})
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Choose a project folder')
  const values=this.read().filter(v=>v.owner!==owner||v.workspace!==workspace||v.slot!==slot)
  values.push({owner,workspace,slot,root:canonical,device:String(stat.dev),inode:String(stat.ino)})
  fs.mkdirSync(path.dirname(this.file),{recursive:true})
  const temporary=this.file+'.'+randomUUID()+'.tmp'
  try{fs.writeFileSync(temporary,JSON.stringify(values),{flag:'wx',mode:0o600});fs.renameSync(temporary,this.file)}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
 }
 restore(owner:string,workspace:string,slot:Slot):string|null{
  const items=this.read().filter(v=>v.owner===owner&&v.workspace===workspace),value=items.find(v=>v.slot===slot)??items.at(-1)
  if(!value)return null
  try{
   const canonical=fs.realpathSync(value.root),stat=fs.lstatSync(value.root,{bigint:true})
   if(canonical!==value.root||!stat.isDirectory()||stat.isSymbolicLink()||String(stat.dev)!==value.device||String(stat.ino)!==value.inode)throw Error('Changed folder')
   return canonical
  }catch{throw Error('The saved project folder is unavailable or has changed. Attach its folder again.')}
 }
}
