import type {AgentConversationNode,AgentConversationTree} from '../../../../../shared/independentJobs'
import type {ContinuousChatView} from '../../../../../shared/continuousChat'
import type {ProjectDraftView} from '../../../../../shared/projectBuild'
import {blankWorkspaceChat,type WorkspaceChat,type WorkspaceMessage} from './unifiedWorkspace'
import {isHadronIncompleteRecord} from '../../../../../shared/hadronWorkOutcome'

export function workspaceReplyState(state:string,text=''):WorkspaceMessage['state'] {
 if(isHadronIncompleteRecord(text))return 'failed'
 if(['completed','finished','applied','passed'].includes(state))return 'completed'
 if(['cancelled','stopped','aborted','paused'].includes(state))return 'stopped'
 if(['failed','error','interrupted'].includes(state))return 'failed'
 return 'running'
}

/** Read-only projections. Native identities survive; opening a history never grants access or runs work. */
export function agentHistoryChats(projectId:string,tree:AgentConversationTree):WorkspaceChat[] {
 return treeChats(projectId,tree.nodes,'independent',tree.slot)
}
export function sharedHistoryChat(projectId:string,workspaceId:string,nodes:AgentConversationNode[]):WorkspaceChat {
 if(nodes.some(node=>node.conversationId!==workspaceId))throw Error('Shared chat belongs to another workspace')
 return treeChats(projectId,nodes,'shared','a',`shared:${workspaceId}`)[0]??{
  ...blankWorkspaceChat(projectId,`shared:${workspaceId}`),workType:'together',
 }
}
function treeChats(projectId:string,nodes:AgentConversationNode[],kind:'independent'|'shared',agent:'a'|'b',singleId?:string):WorkspaceChat[] {
 const grouped=new Map<string,AgentConversationNode[]>(),byId=new Map(nodes.map(node=>[node.id,node]))
 if(byId.size!==nodes.length)throw Error('Duplicate saved message')
 for(const node of nodes){
  if(node.parentId&&byId.get(node.parentId)?.conversationId!==node.conversationId)throw Error('Missing or foreign branch parent')
  const seen=new Set([node.id]);let parent=node.parentId
  while(parent){if(seen.has(parent))throw Error('Invalid saved branch cycle');seen.add(parent);parent=byId.get(parent)?.parentId??null}
  const key=singleId??`agent:${agent}:${node.conversationId}`
  grouped.set(key,[...(grouped.get(key)??[]),node])
 }
 return [...grouped].map(([id,items])=>{
  const chat=blankWorkspaceChat(projectId,id,agent)
  chat.workType=kind==='shared'?'together':'individual'
  chat.messages=items.map(node=>({id:node.id,parentId:node.parentId,role:node.kind==='task'?'user':'assistant',
   agent:kind==='shared'?'both':agent,text:node.text,state:node.kind==='task'?'completed':workspaceReplyState(node.status,node.text),
   provider:node.provider,modelName:node.modelName,origin:{kind,id:node.jobId,nodeId:node.id}}))
  chat.title=items.find(node=>node.kind==='task')?.text.slice(0,85)??''
  // Preserve native order; select a leaf rather than silently dropping sibling branches.
  chat.selectedId=items.at(-1)?.id??null
  const active=items.find(node=>workspaceReplyState(node.status)==='running')
  if(active){chat.jobId=active.jobId;chat.jobState='unknown';chat.nativeJob={kind,id:active.jobId.replace(/^shared:/,'')}}
  const latest=items.at(-1)
  if(latest&&kind==='independent')chat.models[agent]={provider:latest.provider,modelName:latest.modelName}
  return chat
 })
}

export function continuousHistoryChat(projectId:string,view:ContinuousChatView):WorkspaceChat {
 const chat=blankWorkspaceChat(projectId,`continuous:${view.id}`)
 chat.workType='continuous';chat.maxTurns=view.input.maxTurns;chat.title=view.input.goal.slice(0,85)
 for(const agent of ['a','b'] as const)chat.models[agent]={provider:view.input.providers?.[agent]??'openaichatgpt',modelName:view.input.models[agent]}
 const append=(id:string,role:WorkspaceMessage['role'],text:string,state:WorkspaceMessage['state'],agent?:'a'|'b')=>{
  chat.messages.push({id,parentId:chat.messages.at(-1)?.id??null,role,text,state,agent,
   ...(agent?chat.models[agent]:{}),origin:{kind:'continuous',id:view.id,nodeId:id}})
 }
 append(`continuous:${view.id}:goal`,'user',view.input.goal,'completed')
 // Saved continuation history is context, not a new provider request or a new user instruction.
 if(view.history?.memory)append(`continuous:${view.id}:memory`,'assistant',view.history.memory.text,'completed')
 for(const [index,turn] of (view.history?.turns??[]).entries())append(`continuous:${view.id}:history:${index}`,'assistant',turn.text,'completed',turn.role)
 const injected=[...view.messages].sort((a,b)=>a.afterTurn-b.afterTurn)
 const injectThrough=(ordinal:number)=>{while(injected.length&&injected[0].afterTurn<=ordinal){const message=injected.shift()!;append(`continuous:${view.id}:message:${message.id}`,'user',message.text,'completed')}}
 injectThrough(0)
 for(const turn of [...view.turns].sort((a,b)=>a.ordinal-b.ordinal)){
  if(turn.kind!=='memory')append(`continuous:${view.id}:turn:${turn.ordinal}`,'assistant',turn.text??'',workspaceReplyState(turn.state),turn.role)
  injectThrough(turn.ordinal)
 }
 if(injected.length)throw Error('Saved conversation has a message beyond its last turn')
 const last=chat.messages.at(-1)
 if(last?.role==='assistant'&&view.workersEnded&&(view.state==='failed'||view.state==='stopped'))last.state=workspaceReplyState(view.state)
 if(last?.role==='assistant'&&last.origin)last.origin.fullContext=view.workersEnded
 chat.selectedId=last?.id??null
 // History has no live folder authority; status/reconnect decides whether the native job still exists.
 if(!view.workersEnded){chat.jobId=view.id;chat.jobState='unknown';chat.nativeJob={kind:chat.workType==='continuous'?'continuous':'project',id:view.id}}
 return chat
}

export function projectHistoryChat(projectId:string,view:ProjectDraftView):WorkspaceChat {
 const agent=view.input.participation==='b'?'b':'a',chat=blankWorkspaceChat(projectId,`project:${view.id}`,agent)
 chat.workType=view.input.participation==='both'||!view.input.participation?'together':'individual'
 chat.title=view.input.task.slice(0,85)
 for(const slot of ['a','b'] as const)chat.models[slot]={provider:view.input.providers?.[slot]??'openaichatgpt',modelName:view.input.models[slot]}
 const append=(id:string,role:WorkspaceMessage['role'],text:string,state:WorkspaceMessage['state'],agent?:'a'|'b')=>{
  chat.messages.push({id,parentId:chat.messages.at(-1)?.id??null,role,text,state,agent,origin:{kind:'project',id:view.id,nodeId:id}})
 }
 append(`project:${view.id}:question`,'user',view.input.task,'completed')
 for(const [index,attempt] of view.attempts.entries()){
  // Empty reserved stages are not answers. Keep failed/running attempts explicit.
  if(!attempt.response&&['reserved','queued','prepared'].includes(attempt.state))continue
  append(`project:${view.id}:attempt:${index}`,'assistant',attempt.response??'',workspaceReplyState(attempt.state),attempt.role==='b'?'b':'a')
 }
 const changed=view.projectFilesChanged===true?'yes':view.projectFilesChanged==='uncertain'?'uncertain':'no'
 const feedback=[`Files changed: ${changed}. Tests: ${view.tests.status.replaceAll('_',' ')}. Build: ${view.builds?.status??'not run'}.`,
  ...view.drafts.map(draft=>`${draft.path}: ${draft.state}.`),...(view.failure?[view.failure]:[])].join('\n')
 append(`project:${view.id}:result`,'assistant',feedback,view.failure?'failed':view.workersEnded?'completed':'running',agent)
 chat.selectedId=chat.messages.at(-1)?.id??null
 if(!view.workersEnded){chat.jobId=view.id;chat.jobState='unknown';chat.nativeJob={kind:'project',id:view.id}}
 return chat
}
