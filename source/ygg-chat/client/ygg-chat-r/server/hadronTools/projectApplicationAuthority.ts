/** Host-only, short-lived approval for one exact reviewed snapshot. Native UI
 * installs the confirmer; renderer/model packets cannot install or mint it. */
export class ProjectApplicationAuthority {
 private automationConfirmer:((request:{owner:string;root:string;task:string;paths:string[];tests:Array<{path:string;hash:string}>;builds?:Array<{path:string;hash:string}>})=>Promise<boolean>)|undefined
 private readonly automation=new WeakMap<object,{owner:string;root:string;paths:Set<string>;tests:string;builds:string;writes:number;checks:number;buildChecks:number;expires:number}>()
 private confirmer:((request:{owner:string;id:string;task:string;snapshotHash:string;files:Array<{path:string;before:string|null;after:string}>})=>Promise<boolean>)|undefined
 private readonly approvals=new Set<string>()
 private readonly deadlines=new Map<string,number>()
 install(confirm:NonNullable<ProjectApplicationAuthority['confirmer']>){if(this.confirmer)throw Error('Application confirmer already installed');this.confirmer=confirm}
 available(){return !!this.confirmer}
 installAutomation(confirm:NonNullable<ProjectApplicationAuthority['automationConfirmer']>){if(this.automationConfirmer)throw Error('Automation confirmer already installed');this.automationConfirmer=confirm}
 async approveAutomation(request:Parameters<NonNullable<ProjectApplicationAuthority['automationConfirmer']>>[0]):Promise<object|null>{
  if(!this.automationConfirmer||!await this.automationConfirmer(request))return null
  const token=Object.freeze({})
  this.automation.set(token,{owner:request.owner,root:request.root,paths:new Set(request.paths),tests:JSON.stringify(request.tests),builds:JSON.stringify(request.builds??[]),writes:3,checks:3,buildChecks:3,expires:Date.now()+1800000})
  return token
 }
 private policy(token:object,root:string){const policy=this.automation.get(token);if(!policy||policy.root!==root||Date.now()>policy.expires)throw Error('Bounded project approval expired or changed');return policy}
 assertAutomationCheck(token:object,root:string,files:Array<{path:string;hash:string}>,kind:'test'|'build'='test'){
  const policy=this.policy(token,root),key=kind==='test'?'checks':'buildChecks',expected=kind==='test'?policy.tests:policy.builds
  if(policy[key]<1||expected!==JSON.stringify(files))throw Error('Approved tests changed or check budget exhausted');policy[key]--
 }
 async applyAutomated<T>(token:object,root:string,request:Parameters<NonNullable<ProjectApplicationAuthority['confirmer']>>[0],apply:()=>Promise<T>):Promise<T>{
  const policy=this.policy(token,root)
  if(policy.owner!==request.owner||policy.writes<1||request.files.some(file=>!policy.paths.has(file.path)))throw Error('Reviewed changes exceed the approved repair scope')
  policy.writes--
  const key=JSON.stringify([request.owner,request.id,request.snapshotHash]);this.approvals.add(key);this.deadlines.set(key,policy.expires)
  try{return await apply()}finally{this.approvals.delete(key);this.deadlines.delete(key)}
 }
 revokeAutomation(token:object){this.automation.delete(token)}
 assert(owner:string,id:string,hash:string){const key=JSON.stringify([owner,id,hash]);if(!this.approvals.has(key)||Date.now()>(this.deadlines.get(key)??Infinity))throw Error('Native approval of this exact snapshot is required')}
 async confirm<T>(request:Parameters<NonNullable<ProjectApplicationAuthority['confirmer']>>[0],apply:()=>Promise<T>):Promise<T|null>{
  if(!this.confirmer)throw Error('Native application approval unavailable')
  if(!await this.confirmer(request))return null
  const key=JSON.stringify([request.owner,request.id,request.snapshotHash])
  if(this.approvals.has(key))throw Error('Application approval is already in use')
  this.approvals.add(key)
  try{return await apply()}finally{this.approvals.delete(key)}
 }
}
export const projectApplicationAuthority=new ProjectApplicationAuthority()
