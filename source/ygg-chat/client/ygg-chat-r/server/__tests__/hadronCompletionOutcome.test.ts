import {expect,it,vi} from 'vitest'
import {runHadronToolConversation,type HadronToolSession} from '../hadronTools/types.js'

const controller=()=>new AbortController().signal
const session=(extra:Partial<HadronToolSession>={}):HadronToolSession=>({execution:'agent',requireCompletionStatus:true,maxRequests:5,instructions:'Complete only the assigned request',invoke:vi.fn(async()=>({success:true,path:'fixture.ts'})),...extra})

it('asks once for an omitted outcome while retaining evidence and never repeating the completed edit',async()=>{
 const current=session(),packets:any[]=[]
 const generate=vi.fn(async(raw:string,instructions:string)=>{
  expect(instructions).toContain('boolean finished is REQUIRED')
  const packet=JSON.parse(raw);packets.push(packet)
  if(packets.length===1)return JSON.stringify({tool:'edit_file',arguments:{path:'fixture.ts'}})
  if(packets.length===2)return JSON.stringify({answer:'One part is fixed; the assigned tests remain blocked.'})
  expect(packet.transcript.some((entry:any)=>entry.content?.includes?.('HOST OUTCOME CORRECTION'))).toBe(true)
  expect(packet.transcript.some((entry:any)=>entry.role==='tool_evidence'&&entry.content.result.success)).toBe(true)
  return JSON.stringify({answer:'One part is fixed; tests remain blocked by the missing fixture dependency.',finished:false})
 })
 const result=await runHadronToolConversation({session:current,task:'Fix and test the fixture',signal:controller(),generate})
 expect(result).toContain('tests remain blocked');expect(current.outcome?.incompleteReason).toBe('agent_incomplete')
 expect(current.invoke).toHaveBeenCalledTimes(1);expect(generate).toHaveBeenCalledTimes(3)
})

it.each(['plain','json'] as const)('keeps an unconfirmed %s report as unfinished after one correction',async format=>{
 const current=session(),answer='Partial findings; more assigned investigation remains.'
 const generate=vi.fn(async()=>format==='plain'?answer:JSON.stringify({answer}))
 expect(await runHadronToolConversation({session:current,task:'Investigate',signal:controller(),generate})).toBe(answer)
 expect(generate).toHaveBeenCalledTimes(2);expect(current.invoke).not.toHaveBeenCalled()
 expect(current.outcome?.incompleteReason).toBe('completion_unconfirmed')
})

it.each([true,false])('retains the explicit %s outcome after at most one completion check without replaying operations',async finished=>{
 const current=session(),answer=finished?'The requested analysis is complete; no edits or tests were requested.':'The assigned repair is unfinished; the required dependency is unavailable.'
 const generate=vi.fn(async()=>JSON.stringify({answer,finished}))
 expect(await runHadronToolConversation({session:current,task:'Answer the assigned request',signal:controller(),generate})).toBe(answer)
 expect(current.outcome?.incompleteReason).toBe(finished?undefined:'agent_incomplete')
 expect(generate).toHaveBeenCalledTimes(finished?1:2);expect(current.invoke).not.toHaveBeenCalled()
})

it('continues possible authorized work after an early partial answer inside the same budget and transcript',async()=>{
 const current=session(),packets:any[]=[]
 const generate=vi.fn(async(raw:string)=>{
  const packet=JSON.parse(raw);packets.push(packet)
  if(packets.length===1)return JSON.stringify({answer:'The assigned change is still pending.',finished:false})
  if(packets.length===2){expect(packet.transcript.at(-1).content).toContain('continue any remaining work');return JSON.stringify({tool:'edit_file',arguments:{path:'fixture.ts'}})}
  expect(packet.transcript.some((entry:any)=>entry.role==='tool_evidence')).toBe(true)
  return JSON.stringify({answer:'The assigned change is complete.',finished:true})
 })
 expect(await runHadronToolConversation({session:current,task:'Apply the fixture change',signal:controller(),generate})).toBe('The assigned change is complete.')
 expect(current.outcome?.incompleteReason).toBeUndefined();expect(current.invoke).toHaveBeenCalledTimes(1);expect(generate).toHaveBeenCalledTimes(3)
})

it('does not dispatch another request to clarify completion when the request budget is exhausted',async()=>{
 const current=session({maxRequests:1}),generate=vi.fn(async()=>JSON.stringify({answer:'Available findings.'}))
 expect(await runHadronToolConversation({session:current,task:'Investigate',signal:controller(),generate})).toBe('Available findings.')
 expect(generate).toHaveBeenCalledOnce();expect(current.outcome?.incompleteReason).toBe('completion_unconfirmed')
})

it('does not dispatch another request to clarify completion near the task deadline',async()=>{
 const current=session({deadlineAt:Date.now()+10000}),generate=vi.fn(async()=>JSON.stringify({answer:'Available findings.'}))
 await runHadronToolConversation({session:current,task:'Investigate',signal:controller(),generate})
 expect(generate).toHaveBeenCalledOnce();expect(current.outcome?.incompleteReason).toBe('completion_unconfirmed')
})

it('honours Stop during the outcome correction before another request or operation',async()=>{
 const current=session(),stop=new AbortController(),generate=vi.fn(async()=>{stop.abort();return JSON.stringify({answer:'Partial findings.'})})
 await expect(runHadronToolConversation({session:current,task:'Investigate',signal:stop.signal,generate})).rejects.toThrow()
 expect(generate).toHaveBeenCalledOnce();expect(current.invoke).not.toHaveBeenCalled()
})
