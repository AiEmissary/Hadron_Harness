import {expect,it} from 'vitest'
import {consensusReply,agreementCheckOffer} from '../hadronTools/continuousConsensus.js'

it('accepts only a host-issued final-line handshake with a readable conclusion',()=>{
 const peer={token:'peer-token',ordinal:1,role:'a' as const,text:'Use the tested solution.'}
 expect(consensusReply('Agreed conclusion.\n[HADRON_CONSENSUS_CONFIRM:peer-token]','current',peer)).toEqual({text:'Agreed conclusion.',proposed:false,confirmed:true})
 for(const text of [
  'I agree with the general direction.',
  'Agreed.\n[HADRON_CONSENSUS_CONFIRM:stale-token]',
  'Quoted marker: [HADRON_CONSENSUS_CONFIRM:peer-token]',
  '[HADRON_CONSENSUS_CONFIRM:peer-token]',
  'Quoted example:\n[HADRON_CONSENSUS_CONFIRM:peer-token]\nBut this is not my conclusion.',
 ])expect(consensusReply(text,'current',peer).confirmed).toBe(false)
 expect(consensusReply('Settled conclusion.\n[HADRON_CONSENSUS_PROPOSE:current]','current',peer)).toEqual({text:'Settled conclusion.',proposed:true,confirmed:false})
 expect(consensusReply('Agreed.\n[HADRON_CONSENSUS_CONFIRM:peer-token]','current').confirmed).toBe(false)
})

it('opens one checking pass for clear agreement without confusing quoted or qualified agreement with consensus',()=>{
 for(const text of ['I agree. The evidence supports it.','Agreed — here is the conclusion.','We agree on the conclusion.'])expect(agreementCheckOffer(text)).toBe(true)
 for(const text of ['The source says "I agree".','I agree on that detail, but the task remains.','I partly agree.','> I agree.','I agree; however the central claim is unverified.'])expect(agreementCheckOffer(text)).toBe(false)
})
