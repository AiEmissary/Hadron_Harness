import type { AgentConversationNode } from '../../../../../shared/independentJobs'

/** Display only: keep the loaded conversation branches for the focused task,
 * including sibling branches. Never alter the nodes used to build model context. */
export function currentTaskNodes(nodes: AgentConversationNode[], focus: {
  shared: boolean; sessionId: string | null; slot: 'a' | 'b'; selectedId?: string | null; jobId?: string | null; newTask?: boolean
}): AgentConversationNode[] {
  if (focus.newTask && !focus.shared) return []
  const current = focus.shared
    ? nodes.find(node => node.jobId === `proposal:${focus.sessionId}:${focus.slot}`)
    : focus.selectedId ? nodes.find(node => node.id === focus.selectedId)
      : focus.jobId ? nodes.find(node => node.jobId === focus.jobId) : nodes.at(-1)
  return current ? nodes.filter(node => node.conversationId === current.conversationId) : []
}
export function agentConversationPath(nodes: AgentConversationNode[], selectedId: string | null): AgentConversationNode[] {
  if (!selectedId) return []
  const byId = new Map(nodes.map(node => [node.id, node])), path: AgentConversationNode[] = [], seen = new Set<string>()
  let current = byId.get(selectedId)
  if (!current) throw new Error('Selected branch is unavailable')
  const conversationId = current.conversationId
  while (current) {
    if (seen.has(current.id) || path.length >= 256 || current.conversationId !== conversationId) throw new Error('Invalid selected branch')
    seen.add(current.id); path.unshift(current)
    if (current.parentId === null) break
    const parent = byId.get(current.parentId)
    if (!parent) throw new Error('Missing branch parent')
    current = parent
  }
  return path
}

/** Forest layout: every sibling gets its own horizontal lane; parents sit above their children. */
export function layoutAgentBranches(nodes: AgentConversationNode[]) {
  const children = new Map<string | null, AgentConversationNode[]>()
  for (const node of nodes) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node])
  const points = new Map<string, { x: number; y: number }>(), visiting = new Set<string>()
  let lane = 0, maxDepth = 0
  const place = (node: AgentConversationNode, depth: number): number => {
    if (visiting.has(node.id) || depth >= 256) throw new Error('Invalid branch graph')
    visiting.add(node.id); maxDepth = Math.max(maxDepth, depth)
    const descendants = children.get(node.id) ?? []
    const xs = descendants.map(child => place(child, depth + 1))
    const x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : 90 + lane++ * 180
    points.set(node.id, { x, y: 36 + depth * 116 }); visiting.delete(node.id)
    return x
  }
  for (const root of children.get(null) ?? []) place(root, 0)
  if (points.size !== nodes.length) throw new Error('Missing branch roots')
  return { points, width: Math.max(180, lane * 180), height: Math.max(118, maxDepth * 116 + 124) }
}
