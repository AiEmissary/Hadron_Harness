import type {ProjectDraftGrant} from '../../../../../shared/projectBuild'
import type {HadronProvider} from '../../../../../shared/hadronProviders'
export interface ProjectWork {
  grant:ProjectDraftGrant;context:string;participation:'a'|'b'|'both';permission:'ask'|'task';
  models:{a:string;b:string};providers:{a:HadronProvider;b:HadronProvider};
}
/** Explicit user handoff; the host revalidates all grants and approves file operations. */
export type WorkflowTarget = 'shared' | 'a' | 'b' | 'main' | 'project'
export type WorkflowDraft = { workspaceId: string; target: WorkflowTarget; text: string; access?:'chat'|'read';context?:string;choices?:Partial<Record<'a'|'b',{provider:string;modelName:string}>>;folder?:{id:string;label:string};projectWork?:ProjectWork;accepted?: boolean; error?: string }
const eventName = 'hadron-workflow-draft'
export function receiveWorkflowDraft(workspaceId: string, target: WorkflowTarget, receive: (text: string,access?:'chat'|'read',details?:WorkflowDraft) => void) {
  const listener = (event: Event) => {
    const draft = (event as CustomEvent<WorkflowDraft>).detail
    if (!draft || draft.accepted || draft.workspaceId !== workspaceId || draft.target !== target) return
    try {
      if (!draft.text.trim() || draft.text.length > 16000) throw Error('The conclusion must fit within 16,000 characters.')
      if(draft.context!==undefined&&(typeof draft.context!=='string'||draft.context.length>14000))throw Error('Conversation context is too large')
      if(draft.context!==undefined||draft.projectWork||draft.folder||draft.choices)receive(draft.text,draft.access,draft)
      else if(draft.access)receive(draft.text,draft.access)
      else receive(draft.text)
      draft.accepted = true
    } catch (error) { draft.error = error instanceof Error ? error.message : 'The destination draft is unavailable.' }
  }
  window.addEventListener(eventName, listener)
  return () => window.removeEventListener(eventName, listener)
}
export function sendWorkflowDraft(workspaceId: string, target: WorkflowTarget, text: string,access?:'chat'|'read',details?:Pick<WorkflowDraft,'context'|'projectWork'|'choices'|'folder'>) {
  const draft: WorkflowDraft = { workspaceId, target, text,...details,...(access?{access}:{}) }
  window.dispatchEvent(new CustomEvent(eventName, { detail: draft }))
  if (!draft.accepted) throw Error(draft.error ?? 'Open the destination workspace and try again. You can also copy the conclusion below.')
}
export function confirmDraftReplacement(hasDraft: boolean) {
  if (hasDraft && !window.confirm('Replace the unsent draft and its attachments with this project conclusion? Saved conversations will remain.')) throw Error('Your existing draft was kept.')
}
