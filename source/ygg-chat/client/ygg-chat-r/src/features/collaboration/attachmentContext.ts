import {PROPOSAL_CONTEXT_MAX_CHARS} from '../../../../../shared/collaboration'
import type {SharedAttachment} from './attachments'

/** Both agents receive this same frozen data packet; file text never grants tool permissions. */
export function composeSharedContext(branchContext: string, attachments: readonly SharedAttachment[]): string {
  if (attachments.length > 20) throw new Error('Choose up to 20 files.')
  const context = attachments.length ? JSON.stringify({ branchContext, files: attachments.map(({ name, text, image, searchable }) => image?({name,kind:'Picture; supplied as image content'}):searchable?({name,kind:'Large document; full text not included here. Read it with document_search and document_read.',characters:text.length}):({ name, text })) }) : branchContext
  if (context.length > PROPOSAL_CONTEXT_MAX_CHARS) throw new Error('The files and branch text exceed the current shared-context limit. Remove a file or choose a shorter branch.')
  return context
}
