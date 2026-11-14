import type {ProposalSessionStatus} from '../../../../../shared/collaboration'

/** A partial result stays useful without being presented as successful synthesis. */
export function workspaceSharedFailureText(status:Pick<ProposalSessionStatus,'error'|'collaboration'>,proposals:string):string{
 const reviews=status.collaboration?.stages.filter(stage=>stage.id!=='final'&&stage.status==='completed'&&stage.text)
  .map(stage=>`Agent ${stage.participantId.toUpperCase()} ${stage.id==='verification'?'verification':'review'}\n${stage.text}`).join('\n\n')
 const explanation=status.error??'This task ended before a combined answer was produced.'
 const partial=[proposals,reviews].filter(Boolean).join('\n\n')
 return explanation+(partial?'\n\nSaved work — not a combined answer:\n\n'+partial:'')
}
