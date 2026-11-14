const owners=new Map<object,{has(id:string):boolean;save(id:string):Promise<unknown>}>()
export function registerWorkspaceMoveOwner(token:object,owner:{has(id:string):boolean;save(id:string):Promise<unknown>}){owners.set(token,owner);return()=>{owners.delete(token)}}
/** The existing sidebar Move action checkpoints a local draft first. */
export async function prepareWorkspaceMove(id:string){await Promise.all([...owners.values()].filter(owner=>owner.has(id)).map(owner=>owner.save(id)))}
