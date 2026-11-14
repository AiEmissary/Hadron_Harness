import {PROPOSAL_CONTEXT_MAX_CHARS} from '../../../../../shared/collaboration'
import type {SharedAttachment} from './attachments'

/** Both agents receive this same frozen data packet; file text never grants tool permissions. */
export function composeSharedContext(branchContext: string, attachments: readonly SharedAttachment[]): string {
  if (attachments.length > 5) throw new Error('Choose up to five shared files.')
  const context = attachments.length ? JSON.stringify({ branchContext, files: attachments.map(({ name, text }) => ({ name, text })) }) : branchContext
  if (context.length > PROPOSAL_CONTEXT_MAX_CHARS) throw new Error('The files and branch text exceed the current shared-context limit. Remove a file or choose a shorter branch.')
  return context
}
