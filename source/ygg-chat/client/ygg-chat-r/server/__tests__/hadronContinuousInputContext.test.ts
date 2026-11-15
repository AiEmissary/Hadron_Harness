import {expect,it,vi} from 'vitest'
import {continuousInputContext,type ContinuousInputMemory} from '../hadronTools/continuousInputContext.js'
import {continuousPrompt,type ContinuousPromptPacket} from '../hadronTools/continuousPrompt.js'

it('leaves fitting input intact and includes the full current text exactly once',()=>{
 const text='Compare these supplied figures.\n'+ 'Report evidence. '.repeat(700)
 const packet:ContinuousPromptPacket={kind:'continuous_conversation',goal:'Original discussion',transcript:[],userMessages:[{afterTurn:2,text}]}
 const read=vi.fn(),result=continuousInputContext(packet,read)
 expect(result.packet).toBe(packet);expect(result.part).toBeUndefined();expect(read).not.toHaveBeenCalled()
 expect(continuousPrompt(packet).split(text.split('\n')[0]).length-1).toBe(1)
})
it('processes every Unicode character in oversized supplied input through bounded summary parts and keeps originals intact',()=>{
 const text='START: compare all evidence.\n'+'🌙 Résumé 数据\n'.repeat(6000)+'END: keep the original units.'
 const packet:ContinuousPromptPacket={kind:'continuous_conversation',goal:'Earlier goal',transcript:[],userMessages:[{afterTurn:2,text}]},original=JSON.stringify(packet)
 const cache=new Map<string,ContinuousInputMemory>(),chunks:string[]=[]
 let result=continuousInputContext(packet,key=>cache.get(key)),count=0
 while(result.part){
  const {part}=result,chunk=result.packet.userMessages![0].text
  expect(part.from).toBe(chunks.join('').length);expect(chunk).toBe(text.slice(part.from,part.to))
  expect(Buffer.byteLength(chunk)).toBeLessThanOrEqual(16000)
  expect(Buffer.byteLength(continuousPrompt(result.packet))).toBeLessThanOrEqual(64000)
  expect(Buffer.byteLength(JSON.stringify(result.packet))).toBeLessThanOrEqual(64000)
  expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/)
  chunks.push(chunk);cache.set(part.key,{through:part.to,text:'Summary preserves comparison, units and uncertainties.'})
  result=continuousInputContext(packet,key=>cache.get(key));if(++count>100)throw Error('Input summary did not progress')
 }
 expect(chunks.join('')).toBe(text)
 expect(result.packet.userMessages![0].text).toContain('lossy summary')
 expect(Buffer.byteLength(continuousPrompt(result.packet))).toBeLessThanOrEqual(64000)
 expect(JSON.stringify(packet)).toBe(original)
})
it('condenses accumulated background before touching a small new instruction',()=>{
 const latest='Do not trade. Compare the new report only.'
 const packet:ContinuousPromptPacket={kind:'continuous_conversation',goal:'Old goal '+'.'.repeat(20000),transcript:[],userMessages:[...Array.from({length:10},(_,afterTurn)=>({afterTurn,text:'Earlier constraints '+'.'.repeat(7000)})),{afterTurn:12,text:latest}]}
 const cache=new Map<string,ContinuousInputMemory>();let result=continuousInputContext(packet,key=>cache.get(key)),count=0
 while(result.part){expect(result.part.source).toContain('earlier');cache.set(result.part.key,{through:result.part.to,text:'Earlier goals were superseded. Retain evidence and uncertainty.'});result=continuousInputContext(packet,key=>cache.get(key));if(++count>100)throw Error('No summary progress')}
 expect(result.packet.userMessages![0].text).toBe(latest)
 expect(result.packet.goal).toContain('lossy summary');expect(continuousPrompt(result.packet).match(/Do not trade\./g)).toHaveLength(1)
})
