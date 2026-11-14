import { browserJobStore } from './independentJobController'
import { expect, it, vi } from 'vitest'
import { secondOpinionPacket } from './secondOpinion'
import type { AgentConversationNode } from '../../../../../shared/independentJobs'
const question = {id:'q',parentId:null,kind:'task',jobId:'j',conversationId:'c',text:'What is two plus two?',status:'completed',provider:'openaichatgpt',modelName:'model'} as AgentConversationNode
const answer = {...question,id:'a',parentId:'q',kind:'response',text:'Four.'} as AgentConversationNode
it('reviews the selected answer without sibling text or authority', () => {
  const sibling = {...question,id:'other',text:'SIBLING PRIVATE TEXT'}
  const packet = secondOpinionPacket([question,answer,sibling],'a')
  expect(JSON.parse(packet.context).answer).toBe('Four.')
  expect(packet.context).not.toContain('SIBLING')
  expect(packet.task).toContain('not independent verification')
  expect(packet.excerpted).toBe(false)
  expect(Object.keys(packet).sort()).toEqual(['context','excerpted','task'])
})
it('marks long inputs as excerpts and rejects unfinished or absent answers', () => {
  const packet = secondOpinionPacket([question,{...answer,text:'x'.repeat(20000)}],'a')
  expect(packet.excerpted).toBe(true);expect(packet.context.length).toBeLessThanOrEqual(16000)
  expect(packet.context).toContain('remaining text omitted')
  expect(()=>secondOpinionPacket([question,{...answer,status:'running'}],'a')).toThrow('completed answer')
  expect(()=>secondOpinionPacket([question],'missing')).toThrow()
})

it('stores review recovery independently of the other agent’s current task', () => {
  const values=new Map<string,string>()
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key),setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)})
  try {
    const normal=browserJobStore('workspace','b'),review=browserJobStore('workspace','b','second-opinion:answer')
    const reference={schemaVersion:1 as const,id:'normal-job',sourceConversationId:'workspace',slot:'b' as const,stage:'submitted' as const,conversationId:'normal-chat'}
    normal.write(reference);review.write({...reference,id:'review-job',conversationId:'review-chat'})
    expect(normal.read()?.id).toBe('normal-job');expect(review.read()?.id).toBe('review-job')
    review.clear();expect(normal.read()?.id).toBe('normal-job')
  } finally {vi.unstubAllGlobals()}
})
