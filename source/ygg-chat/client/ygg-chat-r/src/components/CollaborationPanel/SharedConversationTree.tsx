import { useEffect, useState } from 'react'
import { createCollaborationClient } from '../../features/collaboration/client'
import type { AgentConversationNode } from '../../../../../shared/independentJobs'
import { AgentBranchGraph } from './AgentBranchGraph'

export function SharedConversationTree({conversationId,selectedSessionId,revision,all,onSelect}:{conversationId:string;selectedSessionId:string|null;revision:string;all:boolean;onSelect(id:string):void}){
 const [nodes,setNodes]=useState<AgentConversationNode[]>([]),[error,setError]=useState('')
 useEffect(()=>{const abort=new AbortController();setError('');void createCollaborationClient(async()=>{if(!window.electronAPI?.collaboration)throw Error('Desktop unavailable');return window.electronAPI.collaboration.capability()}).tree(conversationId,abort.signal).then(data=>{if(!abort.signal.aborted)setNodes(data.nodes)}).catch(()=>{if(!abort.signal.aborted)setError('Shared history could not be loaded. Refresh trees to try again.')});return()=>abort.abort()},[conversationId,selectedSessionId,revision])
 let shown=nodes
 if(!all&&selectedSessionId){
  const byId=new Map(nodes.map(node=>[node.id,node]));const root=(id:string):string=>{const seen=new Set<string>();let node=byId.get(id);while(node?.parentId){if(seen.has(node.id))throw Error('Invalid shared tree');seen.add(node.id);node=byId.get(node.parentId)}return node?.id??id}
  const current=root('shared-task:'+selectedSessionId);shown=nodes.filter(node=>root(node.id)===current)
 }
 return <section aria-label='Shared conversation tree' className='mt-3 rounded-xl border p-3'><h3 className='font-semibold mb-2'>Shared conversations</h3><p className='text-xs text-neutral-500 mb-2'>Select a combined answer to reopen it and continue with both agents. Forks preserve separate follow-ups.</p>{error?<p role='alert'>{error}</p>:shown.length?<AgentBranchGraph slot='shared' nodes={shown} selectedId={selectedSessionId?'shared-answer:'+selectedSessionId:null} onSelect={id=>{const node=nodes.find(item=>item.id===id);if(node)onSelect(node.jobId.slice('shared:'.length))}}/>:<p className='text-sm text-neutral-500'>Your shared tasks and combined answers will appear here.</p>}</section>
}
