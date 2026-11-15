import {admitHadronToolSession,type HadronToolSession} from './types.js'

/** A shared folder grant adds only its bounded read tools to verification. */
export function withProjectVerification(web:HadronToolSession,folder:HadronToolSession,
  onEvidence:(tool:string,result:unknown)=>void,onAttempt:()=>void):HadronToolSession{
 let folderAttempted=false
 return admitHadronToolSession({
  bindWebSearch:web.bindWebSearch,
  maxRequests:8,requireEvidenceAttempt:true,
  evidenceAttempted:()=>folderAttempted||!!web.evidenceAttempted?.(),
  evidenceInstruction:'Use project_search/project_read for a claim about the selected folder, or web_read/web_search for a public claim, through the supplied JSON host protocol. Native CLI tools remain disabled; the named host tools work. Do not send private folder text to web tools. Attempt a relevant operation before the final report.',
  instructions:web.instructions+'\n'+folder.instructions+'\nVERIFICATION PERMISSIONS: Both the public-web tools above and the selected shared-folder read tools are available through this same JSON protocol. Choose evidence relevant to the claim. Do not send private folder contents to web tools. No writes, commands or additional folders are granted.',
  async invoke(name,args,signal){
   if(!name.startsWith('project_'))return web.invoke(name,args,signal)
   if(!['project_list','project_search','project_read'].includes(name))throw Error('Only shared-folder read tools are granted')
   signal.throwIfAborted();onAttempt();folderAttempted=true
   const result=await folder.invoke(name,args,signal);onEvidence(name,result);return result
  },
 })
}
