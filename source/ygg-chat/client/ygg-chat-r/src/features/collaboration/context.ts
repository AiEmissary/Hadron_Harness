import { PROPOSAL_CONTEXT_MAX_CHARS } from '../../../../../shared/collaboration'
export interface CollaborationAnchor {
  conversationId: string; sourceLineageId: string; anchorMessageId: string; context: string; messageCount: number
}
/** Copy selected-branch text only. No files, tool results, credentials or sibling branches. */
export function captureCollaborationAnchor(conversationId: string, lineageId: string | null,
  path: readonly string[], messages: readonly { id: string; conversation_id: string; role: string; content: unknown }[]): CollaborationAnchor {
  if (!conversationId || !lineageId || !path.length || new Set(path).size !== path.length) throw new Error('Select a saved branch first.')
  const byId = new Map(messages.map(message => [message.id, message]))
  const selected = path.map(id => {
    const message = byId.get(id)
    if (!message || message.conversation_id !== conversationId) throw new Error('Wait for this branch to finish loading.')
    return message
  })
  const text = selected.filter(message => ['user', 'assistant', 'ex_agent'].includes(message.role))
    .map(message => ({ role: message.role, text: typeof message.content === 'string' ? message.content : '' }))
  const context = JSON.stringify({ messages: text })
  if (context.length > PROPOSAL_CONTEXT_MAX_CHARS) throw new Error('This branch is too long for the current collaboration limit. Choose a shorter branch.')
  return Object.freeze({ conversationId, sourceLineageId: lineageId, anchorMessageId: path[path.length - 1], context, messageCount: text.length })
}
