import type { ProposalSessionInput, ProposalSessionStatus, ProposalSessionPage, ProposalTranscript } from '../../../../../shared/collaboration'
import { getLocalServerOrigin } from '../../utils/api'
import { consumeCollaborationStream, type CollaborationFrame } from './stream'
import { parseJournal } from './journal'

export class CollaborationReplayUnavailable extends Error {
  constructor() { super('Live replay unavailable') }
}

/** Capability getter must be supplied by trusted main-frame IPC, never user settings. */
export function createCollaborationClient(getCapability: () => Promise<string>) {
  const request = async (path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<ProposalSessionStatus> => {
    const origin = await getLocalServerOrigin()
    const token = await getCapability()
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
    const response = await fetch(`${origin}/api/collaboration/proposals${path}`, {
      method, signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Collaboration request failed (${response.status})`)
    const status = await response.json()
    if (status?.schemaVersion !== 1 || typeof status.sessionId !== 'string' ||
      status.phase !== 'independent_proposals' || !['created', 'running', 'stopping', 'completed', 'cancelled', 'failed', 'interrupted'].includes(status.status) ||
      !Number.isSafeInteger(status.revision) || status.revision < 0 ||
      !Number.isSafeInteger(status.limits?.deadlineMs) || status.limits.deadlineMs < 1 || status.limits.maxRequestsPerParticipant !== 1 ||
      !Array.isArray(status.participants) || status.participants.length !== 2 ||
      status.participants.some((p: any) => !['a', 'b'].includes(p.id) || !['openaichatgpt','claudecode'].includes(p.provider) || typeof p.modelName !== 'string') ||
      new Set(status.participants.map((p: any) => p.id)).size !== 2 ||
      !Array.isArray(status.artifacts) || status.artifacts.some((artifact: any) => artifact.kind !== 'proposal' || artifact.verified !== false ||
        !['runId', 'lineageId', 'messageId', 'participantId'].every(key => typeof artifact[key] === 'string'))) {
      throw new Error('Unsupported collaboration status')
    }
    if (status.collaboration !== undefined) {
      const workflow = status.collaboration
      const verifying = workflow?.maxRequests === 13
      if(workflow?.researchLimited!==undefined&&typeof workflow.researchLimited!=='boolean')throw Error('Unsupported research-limit state')
      const stages = verifying ? ['review_a', 'review_b', 'verification', 'final'] : ['review_a', 'review_b', 'final']
      if(workflow?.folderAccess!==undefined&&(workflow.folderAccess!==true||!Array.isArray(workflow.folderActivity)||workflow.folderActivity.length>200||workflow.folderActivity.some((item:any)=>!item||typeof item.time!=='string'||typeof item.tool!=='string'||item.tool.length>80||!['started','completed','failed','cancelled'].includes(item.state))))throw Error('Unsupported folder activity')
      if (!workflow || !['proposals', 'reviews', ...(verifying ? ['verification'] : []), 'synthesis', 'finished'].includes(workflow.phase) || ![5,13].includes(workflow.maxRequests) ||
        !Array.isArray(workflow.stages) || workflow.stages.length !== stages.length || new Set(workflow.stages.map((stage: any) => stage.id)).size !== stages.length ||
        workflow.stages.some((stage: any) => !stages.includes(stage.id) ||
          !status.participants.some((participant: any) => participant.id === stage.participantId && participant.modelName === stage.modelName) ||
          !['reserved', 'queued', 'running', 'completed', 'aborted', 'error', 'interrupted'].includes(stage.status) ||
          typeof stage.text !== 'string' || stage.text.length > 32_000 || stage.verified !== false)) throw new Error('Unsupported collaboration workflow')
      if (verifying && (!workflow.evidence || (workflow.evidence.attempts !== undefined && (!Number.isSafeInteger(workflow.evidence.attempts) || workflow.evidence.attempts < 0 || workflow.evidence.attempts > 32)) || !Number.isSafeInteger(workflow.evidence.omitted) || workflow.evidence.omitted < 0 ||
        !Array.isArray(workflow.evidence.receipts) || workflow.evidence.receipts.length > 32 || JSON.stringify(workflow.evidence).length > 24000 ||
        workflow.evidence.receipts.some((item: any) => !item || typeof item.id !== 'string' || typeof item.tool !== 'string' || typeof item.recordedAt !== 'string' || typeof item.result !== 'string' || item.result.length > 1600 || typeof item.truncated !== 'boolean') ||
        (workflow.toolActivity !== undefined && (!Array.isArray(workflow.toolActivity) || workflow.toolActivity.length > 70 || workflow.toolActivity.some((item: any) => !item || typeof item.time !== 'string' || typeof item.tool !== 'string' || !['started','completed','failed','cancelled'].includes(item.state)))))) throw new Error('Unsupported verification evidence')
    }
    return status as ProposalSessionStatus
  }
  return {
    preflight: async (input: ProposalSessionInput) => {
      const origin=await getLocalServerOrigin(),token=await getCapability()
      if(!/^[a-f0-9]{64}$/.test(token))throw Error('Desktop capability unavailable')
      const response=await fetch(`${origin}/api/collaboration/proposals/preflight`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(input)})
      if(!response.ok)throw Error('Shared context or folder access is unavailable. Choose the folder again if selected. If context is too large, exclude previous file context, remove new files, or start a new collaboration with a short summary. No AI request was sent.')
      const value=await response.json();if(value?.schemaVersion!==1||!Number.isInteger(value.contextChars)||value.contextChars<0||value.contextChars>16000||value.contextLimit!==16000)throw Error('Invalid shared context preflight')
    },
    tree: async (conversationId: string, signal?: AbortSignal) => {
      const origin=await getLocalServerOrigin(),token=await getCapability()
      if(!/^[a-f0-9]{64}$/.test(token))throw Error('Desktop capability unavailable')
      const response=await fetch(`${origin}/api/collaboration/proposals/tree?${new URLSearchParams({conversationId})}`,{headers:{authorization:`Bearer ${token}`},signal})
      if(!response.ok)throw Error('Shared tree unavailable')
      const data=await response.json()
      if(data?.schemaVersion!==1||data.conversationId!==conversationId||!Array.isArray(data.nodes)||data.nodes.length>256||data.nodes.some((node:any)=>!node||node.conversationId!==conversationId||typeof node.id!=='string'||typeof node.jobId!=='string'||!node.jobId.startsWith('shared:')||!['task','response'].includes(node.kind)||typeof node.text!=='string'||node.text.length>32000||typeof node.modelName!=='string'||!['openaichatgpt','claudecode'].includes(node.provider)||(node.parentId!==null&&typeof node.parentId!=='string')))throw Error('Invalid shared tree')
      if(new Set(data.nodes.map((node:any)=>node.id)).size!==data.nodes.length||data.nodes.some((node:any)=>node.parentId&&!data.nodes.some((parent:any)=>parent.id===node.parentId)))throw Error('Invalid shared tree links')
      return data as {schemaVersion:1;conversationId:string;nodes:import('../../../../../shared/independentJobs').AgentConversationNode[]}
    },
    prepareTask: async (id: string, conversationId: string, task: string,workflow?:'continuous') => {
      const origin = await getLocalServerOrigin(), token = await getCapability()
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
      const response = await fetch(`${origin}/api/collaboration/proposals/context`, { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ schemaVersion: 1, id, conversationId, task,...(workflow?{workflow}:{}) }) })
      if (!response.ok) throw new Error('Shared task context could not be saved')
      const result = await response.json()
      if (result?.schemaVersion !== 1 || result.conversationId !== conversationId || typeof result.sourceLineageId !== 'string' ||
        !result.sourceLineageId || typeof result.anchorMessageId !== 'string' || !result.anchorMessageId || result.context !== '' || result.messageCount !== 0) throw new Error('Unexpected shared task context')
      return result as { conversationId: string; sourceLineageId: string; anchorMessageId: string; context: string; messageCount: number }
    },
    journal: async (sessionId: string, participantId: string) => {
      const origin = await getLocalServerOrigin(), token = await getCapability()
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
      const response = await fetch(`${origin}/api/collaboration/proposals/${encodeURIComponent(sessionId)}/participants/${encodeURIComponent(participantId)}/journal`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(`Job journal unavailable (${response.status})`)
      const result = await response.json()
      if (result?.schemaVersion !== 1 || result.sessionId !== sessionId || result.participantId !== participantId) throw new Error('Job journal identity mismatch')
      return parseJournal(result)
    },
    list: async (conversationId: string, before?: string, signal?: AbortSignal): Promise<ProposalSessionPage> => {
      const origin = await getLocalServerOrigin(), token = await getCapability()
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
      const query = new URLSearchParams({ conversationId, limit: '20', ...(before ? { before } : {}) })
      const response = await fetch(`${origin}/api/collaboration/proposals?${query}`, {
        headers: { authorization: `Bearer ${token}` }, signal,
      })
      if (!response.ok) throw new Error(`Collaboration discovery failed (${response.status})`)
      const page = await response.json()
      if (page?.schemaVersion !== 1 || !Array.isArray(page.sessions) || page.sessions.length > 20 ||
        (page.nextBefore !== null && (typeof page.nextBefore !== 'string' || !page.nextBefore)) ||
        page.sessions.some((item: any) => !item || item.conversationId !== conversationId || typeof item.sessionId !== 'string' || !item.sessionId ||
          item.phase !== 'independent_proposals' || !['created', 'running', 'stopping', 'completed', 'cancelled', 'failed', 'interrupted'].includes(item.status) ||
          !Number.isSafeInteger(item.revision) || item.revision < 0 || !Array.isArray(item.participants) || item.participants.length !== 2 ||
          new Set(item.participants.map((p: any) => p?.id)).size !== 2 || item.participants.some((p: any) => !p || !['a', 'b'].includes(p.id) || !['openaichatgpt','claudecode'].includes(p.provider) || typeof p.modelName !== 'string'))) {
        throw new Error('Unsupported collaboration page')
      }
      return page as ProposalSessionPage
    },
    transcript: async (sessionId: string, participantId: string, signal?: AbortSignal): Promise<ProposalTranscript> => {
      const origin = await getLocalServerOrigin(), token = await getCapability()
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
      const response = await fetch(`${origin}/api/collaboration/proposals/${encodeURIComponent(sessionId)}/participants/${encodeURIComponent(participantId)}/transcript`, {
        headers: { authorization: `Bearer ${token}` }, signal,
      })
      if (!response.ok) throw new Error(`Saved response unavailable (${response.status})`)
      const result = await response.json()
      if (result?.schemaVersion !== 1 || result.sessionId !== sessionId || result.participantId !== participantId ||
        typeof result.runId !== 'string' || !['completed', 'aborted', 'error'].includes(result.status) ||
        typeof result.text !== 'string' || result.text.length > 1_000_000 || result.verified !== false) throw new Error('Unsupported saved response')
      return result as ProposalTranscript
    },
    start: (input: ProposalSessionInput) => request('', 'POST', input),
    status: (id: string, signal?: AbortSignal) => request(`/${encodeURIComponent(id)}`, 'GET', undefined, signal),
    stop: (id: string) => request(`/${encodeURIComponent(id)}/stop`, 'POST', {}),
    stream: async (sessionId: string, streamId: string, fromSeq: number, signal: AbortSignal,
      onFrame: (frame: CollaborationFrame) => void) => {
      if (!Number.isSafeInteger(fromSeq) || fromSeq < 0) throw new Error('Invalid stream cursor')
      const origin = await getLocalServerOrigin(), token = await getCapability()
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
      const response = await fetch(`${origin}/api/collaboration/proposals/${encodeURIComponent(sessionId)}/streams/${encodeURIComponent(streamId)}?fromSeq=${fromSeq}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' }, signal,
      })
      if (response.status === 410) throw new CollaborationReplayUnavailable()
      if (!response.ok) throw new Error(`Collaboration replay unavailable (${response.status})`)
      return consumeCollaborationStream(response, fromSeq, signal, onFrame)
    },
  }
}
