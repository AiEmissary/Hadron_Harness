import type { Conversation } from '../conversations/conversationTypes'

const key = (owner: string) => `hadron:last-workspace:${owner}`
const validId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,128}$/.test(id)

/** Navigation only: never persist chat text, credentials or a request to execute. */
export function rememberWorkspace(owner: string, conversationId: string): void {
  if (!owner || !validId(conversationId)) return
  try { localStorage.setItem(key(owner), JSON.stringify({schemaVersion:1,conversationId})) } catch { /* Optional preference. */ }
}

export async function startupWorkspace(owner: string, recent: Conversation | undefined,
  get: (id:string)=>Promise<Conversation>, open: (id:string)=>Promise<{workspaceConversationId:string}>): Promise<Conversation | undefined> {
  try {
    const saved=JSON.parse(localStorage.getItem(key(owner))??'null')
    if(saved?.schemaVersion===1 && validId(saved.conversationId)) {
      const conversation=await get(saved.conversationId)
      if(conversation.user_id===owner && conversation.project_id && String(conversation.id)===saved.conversationId) return conversation
    }
  } catch { /* Deleted or unavailable preferences fall back to existing startup. */ }
  // Migrate older installs: proposal chats are storage artifacts, not the last workspace.
  if(recent && /^(hadron-job-|hadron-proposal-)/.test(String(recent.id))) {
    try {
      const navigation=await open(String(recent.id))
      const conversation=await get(navigation.workspaceConversationId)
      if(conversation.user_id===owner && conversation.project_id) return conversation
    } catch { /* Keep existing recent-chat fallback if recovery is unavailable. */ }
  }
  return recent
}
