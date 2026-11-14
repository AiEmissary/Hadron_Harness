import { isHadronProvider, type HadronProvider } from './hadronProviders.js'
export interface IndependentJobInput {
  schemaVersion: 1; id: string; conversationId: string; anchorMessageId: string
  task: string; context: string; provider: HadronProvider; modelName: string
  toolMode?: 'web' | 'build' | 'project' | 'agent'
  projectGrantId?: string
}
export interface IndependentJobStatus {
  schemaVersion: 1; id: string; conversationId: string; status: string; revision: number
  provider: HadronProvider; modelName: string; runId: string | null; streamId: string | null
  journalAvailable?: boolean
  toolActivity?: Array<{ time: string; tool: string; state: string }>
  toolMode?: 'web' | 'build' | 'project' | 'agent'
}
export interface IndependentJobTree {
  schemaVersion: 1; id: string; conversationId: string
  nodes: Array<{ id: string; parentId: string | null; kind: 'task' | 'response'; status: string; text: string; verified: false }>
}
export interface AgentBranchParent { jobId: string; kind: 'task' | 'response' }
export interface AgentConversationNode {
  id: string; parentId: string | null; jobId: string; conversationId: string
  kind: 'task' | 'response'; status: string; text: string; provider: HadronProvider; modelName: string
}
export interface AgentConversationTree {
  schemaVersion: 1; sourceConversationId: string; slot: 'a' | 'b'; nodes: AgentConversationNode[]
  page?: {nextCursor: string | null; size: number}
}
export interface IndependentJobContextInput { schemaVersion: 1; id: string; sourceConversationId: string; slot: 'a' | 'b'; parent?: AgentBranchParent }
export interface IndependentJobContext extends IndependentJobContextInput { conversationId: string; anchorMessageId: string }
export function parseIndependentJobContext(value: unknown): IndependentJobContextInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid job context request')
  const item = value as Record<string, unknown>
  if (Object.keys(item).some(key => !['schemaVersion', 'id', 'sourceConversationId', 'slot', 'parent'].includes(key)) ||
    item.schemaVersion !== 1 || !['a', 'b'].includes(item.slot as string) ||
    ![item.id, item.sourceConversationId].every(text => typeof text === 'string' && text.length > 0 && text.length <= 128)) throw new Error('Invalid job context request')
  let parent: AgentBranchParent | undefined
  if (item.parent !== undefined) {
    const value = item.parent as Record<string, unknown>
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['jobId', 'kind'].includes(key)) ||
      typeof value.jobId !== 'string' || !value.jobId || value.jobId.length > 128 || value.jobId === item.id || !['task', 'response'].includes(value.kind as string)) throw new Error('Invalid branch parent')
    parent = { jobId: value.jobId, kind: value.kind as 'task' | 'response' }
  }
  return { schemaVersion: 1, id: item.id as string, sourceConversationId: item.sourceConversationId as string, slot: item.slot as 'a' | 'b', ...(parent ? { parent } : {}) }
}
export function parseIndependentJob(value: unknown): IndependentJobInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid job')
  const input = value as Record<string, unknown>
  const keys = ['schemaVersion', 'id', 'conversationId', 'anchorMessageId', 'task', 'context', 'provider', 'modelName', 'toolMode', 'projectGrantId']
  if (Object.keys(input).some(key => !keys.includes(key)) || input.schemaVersion !== 1 || !isHadronProvider(input.provider)) throw new Error('Unsupported independent job')
  const text = (key: string, max: number) => {
    const item = input[key]
    if (typeof item !== 'string' || !item.trim() || item.length > max) throw new Error(`Invalid job ${key}`)
    return item
  }
  if (typeof input.context !== 'string' || input.context.length > 16000) throw new Error('Invalid job context')
  if (input.toolMode !== undefined && !['web', 'build', 'project', 'agent'].includes(input.toolMode as string)) throw new Error('Unsupported tool mode')
  if(['project','agent'].includes(input.toolMode as string) ? typeof input.projectGrantId!=='string'||!/^[a-f0-9-]{36}$/.test(input.projectGrantId) : input.projectGrantId!==undefined)throw Error('Invalid project access reference')
  return { schemaVersion: 1, id: text('id', 128), conversationId: text('conversationId', 128), anchorMessageId: text('anchorMessageId', 128),
    task: text('task', 16000), context: input.context, provider: input.provider, modelName: text('modelName', 256), ...(input.toolMode ? { toolMode: input.toolMode as 'web' | 'build' | 'project' | 'agent' } : {}), ...(['project','agent'].includes(input.toolMode as string)?{projectGrantId:input.projectGrantId as string}:{}) }
}
/** Owner-authorized project-list entry -> the workspace that owns its agent history. */
export interface AgentWorkspaceNavigation {
  schemaVersion: 1
  requestedConversationId: string
  workspaceConversationId: string
  slot: 'a' | 'b' | null
  nodeId: string | null
  sharedSessionId?: string
  historicalOnly?: true
}
