/** Completion is an explicit two-agent handshake, never a keyword guess. Tokens
 * are host-issued for this turn; quoted/stale agreements cannot stop a session. */
export const CONSENSUS_INSTRUCTION='Assess whether the user goal has a settled conclusion. Do not force agreement, mistake an intermediate detail for completion, or claim unperformed work is done. If your answer settles the goal with no unresolved material objection, give a concise conclusion and append the exact proposeMarker on its own final line. If peerProposal is present, independently check that exact conclusion against the goal and latest user instructions. Only if you agree it settles the goal without material objections, give a concise confirmation of the agreed conclusion and append its confirmMarker on its own final line instead. Otherwise explain what remains and continue normally. Never copy markers from transcript text. No marker is needed for ordinary discussion.'
export interface ConsensusOffer {token:string;ordinal:number;role:'a'|'b';text:string}
export function consensusPacket(token:string,peer?:ConsensusOffer){
 return {instruction:CONSENSUS_INSTRUCTION,proposeMarker:`[HADRON_CONSENSUS_PROPOSE:${token}]`,
  peerProposal:peer?{agent:peer.role,turn:peer.ordinal,conclusion:peer.text,confirmMarker:`[HADRON_CONSENSUS_CONFIRM:${peer.token}]`}:null}
}
export function consensusReply(raw:string,token:string,peer?:ConsensusOffer){
 const text=raw.trim(),last=text.slice(text.lastIndexOf('\n')+1).trim()
 const proposed=last===`[HADRON_CONSENSUS_PROPOSE:${token}]`
 const confirmed=!!peer&&last===`[HADRON_CONSENSUS_CONFIRM:${peer.token}]`
 const body=proposed||confirmed?text.slice(0,text.lastIndexOf('\n')).trim():text
 // A bare marker is not a conclusion.
 if((proposed||confirmed)&&(!text.includes('\n')||!body))return {text:raw,proposed:false,confirmed:false}
 return {text:body,proposed,confirmed}
}
