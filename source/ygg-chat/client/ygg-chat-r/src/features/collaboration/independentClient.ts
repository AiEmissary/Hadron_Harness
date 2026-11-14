import type { IndependentJobContext, IndependentJobContextInput, IndependentJobInput, IndependentJobStatus, IndependentJobTree, AgentConversationTree, AgentConversationNode } from '../../../../../shared/independentJobs'
import { parseIndependentJob, parseIndependentJobContext } from '../../../../../shared/independentJobs'
import { getLocalServerOrigin } from '../../utils/api'
import { consumeCollaborationStream, type CollaborationFrame } from './stream'
import { CollaborationReplayUnavailable } from './client'
import { parseJournal } from './journal'

const states = ['created', 'running', 'stopping', 'completed', 'cancelled', 'failed', 'interrupted']

/** One explicit launch per job; reads and Stop never launch or retry inference. */
export function createIndependentJobClient(getCapability: () => Promise<string>) {
  const request = async (id: string | null, method: string, suffix = '', body?: unknown, signal?: AbortSignal) => {
    const origin = await getLocalServerOrigin(), token = await getCapability()
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
    const response = await fetch(`${origin}/api/collaboration/jobs${id === null ? '' : `/${encodeURIComponent(id)}`}${suffix}`, {
      method, signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Independent job request failed (${response.status})`)
    return response.json()
  }
  const status = (value: any, id: string, conversationId?: string): IndependentJobStatus => {
    if (value?.schemaVersion !== 1 || value.id !== id || typeof value.conversationId !== 'string' || !value.conversationId ||
      (conversationId !== undefined && value.conversationId !== conversationId) || !states.includes(value.status) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || !['openaichatgpt','claudecode'].includes(value.provider) ||
      typeof value.modelName !== 'string' || !value.modelName ||
      ![value.runId, value.streamId].every(item => item === null || (typeof item === 'string' && item.length > 0)) ||
      ((value.runId === null) !== (value.streamId === null))) throw new Error('Unsupported independent job status')
    return value
  }
  return {
    openWorkspace: async (conversationId: string, signal?: AbortSignal): Promise<import('../../../../../shared/independentJobs').AgentWorkspaceNavigation> => {
      const result = await request(null, 'GET', `/open?conversationId=${encodeURIComponent(conversationId)}`, undefined, signal)
      if (result?.schemaVersion !== 1 || result.requestedConversationId !== conversationId ||
        typeof result.workspaceConversationId !== 'string' || !result.workspaceConversationId || result.workspaceConversationId.length > 128 ||
        (result.historicalOnly !== undefined && (result.historicalOnly !== true || result.slot !== null || result.sharedSessionId !== undefined)) ||
        (result.sharedSessionId !== undefined && (typeof result.sharedSessionId !== 'string' || !result.sharedSessionId || result.sharedSessionId.length > 128 || result.slot !== null)) ||
        (result.slot === null ? result.nodeId !== null || result.workspaceConversationId !== conversationId :
          !['a', 'b'].includes(result.slot) || typeof result.nodeId !== 'string' || !result.nodeId || result.nodeId.length > 256 || result.workspaceConversationId === conversationId)) {
        throw new Error('Unsupported saved workspace navigation')
      }
      return result
    },
    workspace: async (conversationId: string, slot: 'a' | 'b', signal?: AbortSignal, page: {cursor?: string; focusNodeId?: string} = {}): Promise<AgentConversationTree> => {
      const result = await request(null, 'GET', `/workspace?conversationId=${encodeURIComponent(conversationId)}&slot=${slot}${page.cursor ? `&cursor=${encodeURIComponent(page.cursor)}` : ''}${page.focusNodeId ? `&focusNodeId=${encodeURIComponent(page.focusNodeId)}` : ''}`, undefined, signal)
      if (result?.schemaVersion !== 1 || result.sourceConversationId !== conversationId || result.slot !== slot || !Array.isArray(result.nodes) || result.nodes.length > 512) throw new Error('Unsupported agent conversation')
      if (result.page !== undefined && (result.page?.size !== 32 || (result.page.nextCursor !== null && (typeof result.page.nextCursor !== 'string' || !/^[1-9]\d{0,14}:[jp]$/.test(result.page.nextCursor))))) throw new Error('Unsupported history page')
      const seen = new Map<string, AgentConversationNode>()
      let textSize = 0
      for (const node of result.nodes) {
        if (!node || typeof node.id !== 'string' || !node.id || node.id.length > 256 || seen.has(node.id) ||
          !['task', 'response'].includes(node.kind) || !states.includes(node.status) || !['openaichatgpt','claudecode'].includes(node.provider) ||
          ![node.jobId, node.conversationId, node.modelName].every((item: unknown) => typeof item === 'string' && !!item && item.length <= 256) ||
          typeof node.text !== 'string' || node.text.length > (node.kind === 'task' ? 16000 : 1_000_000) ||
          (node.parentId !== null && (typeof node.parentId !== 'string' || !seen.has(node.parentId) || seen.get(node.parentId)!.conversationId !== node.conversationId)) ||
          (node.kind === 'response' && (seen.get(node.parentId)?.jobId !== node.jobId || seen.get(node.parentId)?.kind !== 'task'))) throw new Error('Unsupported agent conversation topology')
        textSize += node.text.length; if (textSize > 4_000_000) throw new Error('Agent conversation exceeds display limit')
        seen.set(node.id, node)
      }
      return result
    },
    tree: async (id: string, signal?: AbortSignal): Promise<IndependentJobTree> => {
      const result = await request(id, 'GET', '/tree', undefined, signal)
      const nodes = result?.nodes
      if (result?.schemaVersion !== 1 || result.id !== id || typeof result.conversationId !== 'string' || !result.conversationId ||
        !Array.isArray(nodes) || nodes.length < 1 || nodes.length > 2 || new Set(nodes.map((node: any) => node?.id)).size !== nodes.length ||
        nodes.some((node: any, index: number) => !node || typeof node.id !== 'string' || !node.id || node.verified !== false || typeof node.status !== 'string' ||
          typeof node.text !== 'string' || node.text.length > (index === 0 ? 16000 : 1_000_000) ||
          (index === 0 ? node.kind !== 'task' || node.parentId !== null : node.kind !== 'response' || node.parentId !== nodes[0].id))) throw new Error('Unsupported job tree')
      return result
    },
    trashConversation:async(id:string)=>{const result=await request(id,'POST','/trash-conversation');if(result?.removed!==true||typeof result.conversationId!=='string')throw Error('Conversation could not be moved to the bin');return result},
    editDraft: async(id:string):Promise<{schemaVersion:1;sourceJobId:string;workspace:string;slot:'a'|'b';task:string;context:string;provider:'openaichatgpt'|'claudecode';modelName:string;toolMode?:''|'web'|'build'|'project'|'agent';parent:import('../../../../../shared/independentJobs').AgentBranchParent|null}>=>{
      const result=await request(id,'GET','/edit-draft')
      if(result?.schemaVersion!==1||result.sourceJobId!==id||typeof result.workspace!=='string'||!result.workspace||!['a','b'].includes(result.slot)||typeof result.task!=='string'||result.task.length>16000||typeof result.context!=='string'||result.context.length>16000||!['openaichatgpt','claudecode'].includes(result.provider)||typeof result.modelName!=='string'||!result.modelName||(result.parent!==null&&(!result.parent||typeof result.parent.jobId!=='string'||!['task','response'].includes(result.parent.kind))))throw Error('Unsupported saved question draft')
      if(result.toolMode!==undefined&&!['','web','build','project','agent'].includes(result.toolMode))throw Error('Unsupported saved question tool mode')
      return result
    },
    continuity: async (id: string): Promise<{schemaVersion: 1; sourceJobId: string; task: string; context: string; excerpted: boolean}> => {
      const result = await request(id, 'GET', '/continuity')
      if (result?.schemaVersion !== 1 || result.sourceJobId !== id || typeof result.task !== 'string' || !result.task.trim() || result.task.length > 16000 ||
        typeof result.context !== 'string' || result.context.length > 16000 || typeof result.excerpted !== 'boolean') throw new Error('Unsupported job continuity packet')
      return result
    },
    journal: async (id: string) => {
      const result = await request(id, 'GET', '/journal')
      if (result?.schemaVersion !== 1 || result.id !== id) throw new Error('Job journal identity mismatch')
      return parseJournal(result)
    },
    prepare: async (raw: IndependentJobContextInput): Promise<IndependentJobContext> => {
      const input = parseIndependentJobContext(raw), result = await request(null, 'POST', '/contexts', input)
      if (result?.schemaVersion !== 1 || result.id !== input.id || result.sourceConversationId !== input.sourceConversationId || result.slot !== input.slot ||
        ![result.conversationId, result.anchorMessageId].every(item => typeof item === 'string' && item.length > 0 && item.length <= 128) ||
        result.conversationId === input.sourceConversationId || JSON.stringify(result.parent) !== JSON.stringify(input.parent)) throw new Error('Unsupported independent job context')
      return result
    },
    start: async (input: IndependentJobInput) => {
      const frozen = parseIndependentJob(input)
      return status(await request(null, 'POST', '', frozen), frozen.id, frozen.conversationId)
    },
    status: async (id: string, signal?: AbortSignal) => status(await request(id, 'GET', '', undefined, signal), id),
    stop: async (id: string) => status(await request(id, 'POST', '/stop', {}), id),
    stream: async (id: string, streamId: string, fromSeq: number, signal: AbortSignal, onFrame: (frame: CollaborationFrame) => void) => {
      if (!Number.isSafeInteger(fromSeq) || fromSeq < 0) throw new Error('Invalid stream cursor')
      const origin = await getLocalServerOrigin(), token = await getCapability()
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop capability unavailable')
      const response = await fetch(`${origin}/api/collaboration/jobs/${encodeURIComponent(id)}/streams/${encodeURIComponent(streamId)}?fromSeq=${fromSeq}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' }, signal,
      })
      if (response.status === 410) throw new CollaborationReplayUnavailable()
      if (!response.ok) throw new Error(`Independent job replay unavailable (${response.status})`)
      return consumeCollaborationStream(response, fromSeq, signal, onFrame)
    },
    transcript: async (id: string, signal?: AbortSignal): Promise<{schemaVersion: 1; id: string; status: string; text: string; verified: false}> => {
      const result = await request(id, 'GET', '/transcript', undefined, signal)
      if (result?.schemaVersion !== 1 || result.id !== id || !['completed', 'cancelled', 'failed', 'interrupted'].includes(result.status) ||
        typeof result.text !== 'string' || result.text.length > 1_000_000 || result.verified !== false) throw new Error('Unsupported independent job transcript')
      return result
    },
  }
}
