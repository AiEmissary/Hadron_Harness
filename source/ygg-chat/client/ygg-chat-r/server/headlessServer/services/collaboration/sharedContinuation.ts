import { parseProposalSession, PROPOSAL_CONTEXT_MAX_CHARS, type ProposalSessionInput } from '../../../../../../shared/collaboration.js'
import type { CollaborationRepo } from '../../persistence/collaborationRepo.js'
import type { SubagentRunRepo } from '../../persistence/subagentRunRepo.js'

/** Snapshot is host-owned and never accepted by the HTTP parser. */
export function readProposalConfig(config: any): ProposalSessionInput {
 const input = parseProposalSession(Object.fromEntries(Object.entries(config).filter(([key])=> !['limits','continuationSnapshot'].includes(key))))
 if (!input.parentSessionId) { if(config.continuationSnapshot)throw Error('Unexpected continuation snapshot'); return input }
 const snapshot=config.continuationSnapshot
 if(snapshot?.schemaVersion!==1 || typeof snapshot.context!=='string' || snapshot.context.length>PROPOSAL_CONTEXT_MAX_CHARS || !Array.isArray(snapshot.parents) || !snapshot.parents.length || snapshot.parents.length>12 || snapshot.parents[0]!==input.parentSessionId)throw Error('Shared continuation snapshot unavailable')
 return {...input,context:snapshot.context}
}

/** Freeze only the selected chain. Prior critiques/hidden reasoning and siblings are excluded. */
export function freezeSharedContinuation(deps:{sessions:CollaborationRepo;runs:SubagentRunRepo;authorize(owner:string,input:ProposalSessionInput):void},owner:string,input:ProposalSessionInput){
 if(!input.parentSessionId)return undefined
 const parents:string[]=[],history:Array<{task:string;combinedAnswer:string;context?:string}>=[]
 let parent:string|undefined=input.parentSessionId
 while(parent){
  if(parents.includes(parent)||parents.length>=12)throw Error('Shared history limit reached; start a new task with a summary')
  parents.push(parent)
  const row=deps.sessions.get(parent,owner)
  if(!row||row.conversation_id!==input.conversationId||deps.sessions.workflow(parent,owner)?.status!=='completed')throw Error('Completed shared parent unavailable in this workspace')
  const config=JSON.parse(row.config_json),prior=readProposalConfig(config);deps.authorize(owner,prior)
  const stage=deps.sessions.workflowRuns(parent,owner).find(item=>item.stage_id==='final'),run=stage?.run_id?deps.runs.getRunById(stage.run_id):null
  if(!run||run.status!=='completed'||run.conversation_id!==input.conversationId||run.parent_message_id!==row.anchor_message_id||run.model_name!==stage?.model_name||run.provider!==prior.participants[0].provider||!run.final_response?.trim())throw Error('Completed shared answer unavailable')
  history.unshift({task:prior.task,combinedAnswer:run.final_response,...(input.includeParentContext!==false&&config.context?{context:config.context}:{})})
  parent=prior.parentSessionId
 }
 const context=JSON.stringify({sharedConversationHistory:history,historyIsUnverified:true,currentContextAndFiles:input.context})
 if(context.length>PROPOSAL_CONTEXT_MAX_CHARS)throw Error('Shared history and files exceed 16000 characters; start a new task with a shorter summary')
 return {schemaVersion:1,parents,context}
}
