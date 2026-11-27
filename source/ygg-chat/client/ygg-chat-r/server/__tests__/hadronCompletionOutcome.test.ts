import {expect,it,vi} from 'vitest'
import {runHadronToolConversation,admitHadronToolSession,withHadronAssessment,type HadronToolSession} from '../hadronTools/types.js'
import {hadronIncompleteMessage,hadronAgentOutcomeFailure,hadronOutcomeNeedsUser,HADRON_READ_ONLY_UNFINISHED} from '../../../../shared/hadronWorkOutcome.js'

const controller=()=>new AbortController().signal
it('keeps an assessment limitation without converting it to an implementation failure or weakening evidence requirements',async()=>{
 const current=withHadronAssessment(admitHadronToolSession({instructions:'Read only',requireEvidenceAttempt:true,evidenceAttempted:()=>true,invoke:vi.fn()}))
 const answer='Assessment complete; implementation and tests remain outstanding.'
 expect(await runHadronToolConversation({session:current,task:'Assess',signal:controller(),generate:async()=>JSON.stringify({answer,finished:false})})).toBe(answer)
 expect(current.outcome?.incompleteReason).toBeUndefined()
 expect(()=>withHadronAssessment(admitHadronToolSession({execution:'agent',instructions:'Implement',invoke:vi.fn()}))).toThrow('read-only')
 expect(()=>withHadronAssessment({...current})).toThrow('admitted')
})
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
  return JSON.stringify({answer:'One part is fixed; tests remain blocked by the missing fixture dependency.',finished:false,blocked:true,blocker:'The fixture dependency is unavailable.'})
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

it.each([true,false])('ends a completed request or an explicitly blocked request without replaying operations (%s)',async finished=>{
 const current=session(),answer=finished?'The requested analysis is complete; no edits or tests were requested.':'The assigned repair is unfinished; the required dependency is unavailable.'
 const generate=vi.fn(async()=>JSON.stringify({answer,finished,...(!finished?{blocked:true,blocker:'The required dependency is unavailable.'}:{})}))
 expect(await runHadronToolConversation({session:current,task:'Answer the assigned request',signal:controller(),generate})).toContain(answer)
 expect(current.outcome?.incompleteReason).toBe(finished?undefined:'agent_incomplete')
 expect(generate).toHaveBeenCalledOnce();expect(current.invoke).not.toHaveBeenCalled()
})

it('continues possible authorized work after an early partial answer inside the same budget and transcript',async()=>{
 const current=session(),packets:any[]=[]
 const generate=vi.fn(async(raw:string)=>{
  const packet=JSON.parse(raw);packets.push(packet)
  if(packets.length===1)return JSON.stringify({answer:'The assigned change is still pending.',finished:false})
  if(packets.length===2){expect(packet.transcript.at(-1).content).toContain('Continue the remaining authorized work');return JSON.stringify({tool:'edit_file',arguments:{path:'fixture.ts'}})}
  expect(packet.transcript.some((entry:any)=>entry.role==='tool_evidence')).toBe(true)
  return JSON.stringify({answer:'The assigned change is complete.',finished:true})
 })
 expect(await runHadronToolConversation({session:current,task:'Apply the fixture change',signal:controller(),generate})).toBe('The assigned change is complete.')
 expect(current.outcome?.incompleteReason).toBeUndefined();expect(current.invoke).toHaveBeenCalledTimes(1);expect(generate).toHaveBeenCalledTimes(3)
})

it('continues through multiple progressive partial reports rather than stopping after one check',async()=>{
 const current=session({maxRequests:9}),plan=[{tool:'read_file',arguments:{path:'fixture.ts'}},{answer:'Read completed; edit remains.',finished:false},{tool:'edit_file',arguments:{path:'fixture.ts'}},{answer:'Edit completed; test remains.',finished:false},{tool:'test_fixture',arguments:{}},{answer:'Assigned work completed and tested.',finished:true}]
 let index=0
 expect(await runHadronToolConversation({session:current,task:'Repair and test',signal:controller(),generate:async()=>JSON.stringify(plan[index++])})).toBe('Assigned work completed and tested.')
 expect(current.invoke).toHaveBeenCalledTimes(3);expect(index).toBe(6);expect(current.outcome?.incompleteReason).toBeUndefined()
})

it('stops repeated partial reports without progress instead of looping or inventing completion',async()=>{
 const current=session({maxRequests:20}),generate=vi.fn(async()=>JSON.stringify({answer:'The same assigned work is still pending.',finished:false}))
 expect(await runHadronToolConversation({session:current,task:'Repair',signal:controller(),generate})).toContain('still pending')
 expect(generate).toHaveBeenCalledTimes(3);expect(current.outcome?.incompleteReason).toBe('agent_stalled');expect(current.invoke).not.toHaveBeenCalled()
})

it('does not count repeated identical successful reads as new progress',async()=>{
 const current=session({maxRequests:20});let step=0
 const generate=vi.fn(async()=>JSON.stringify(++step%2?{tool:'read_file',arguments:{path:'fixture.ts'}}:{answer:'Nothing further has been done.',finished:false}))
 await runHadronToolConversation({session:current,task:'Repair',signal:controller(),generate})
 expect(current.outcome?.incompleteReason).toBe('agent_stalled');expect(generate).toHaveBeenCalledTimes(6)
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

it('records why unfinished work stopped so the message says whether the user must act',async()=>{
 const readOnly=admitHadronToolSession({instructions:'Read only',invoke:vi.fn()})
 await runHadronToolConversation({session:readOnly,task:'Implement',signal:controller(),generate:async()=>JSON.stringify({answer:'Findings; edits remain.',finished:false})})
 expect(readOnly.outcome).toEqual({incompleteReason:'agent_incomplete',kind:'read_only'})
 expect(hadronIncompleteMessage(readOnly.outcome!)).toBe(HADRON_READ_ONLY_UNFINISHED)
 const asking=session()
 await runHadronToolConversation({session:asking,task:'Implement',signal:controller(),generate:async()=>JSON.stringify({answer:'Step 1 done.',finished:false,blocked:true,blocker:'Which spending limit should the benchmark use?'})})
 expect(asking.outcome).toMatchObject({incompleteReason:'agent_incomplete',kind:'needs_user',detail:'Which spending limit should the benchmark use?'})
 const message=hadronIncompleteMessage(asking.outcome!)
 expect(message).toMatch(/^Waiting for you/);expect(message).toContain('Which spending limit should the benchmark use?')
 expect(hadronOutcomeNeedsUser(message)).toBe(true);expect(hadronAgentOutcomeFailure(message)).toBe(message)
 expect(hadronIncompleteMessage({incompleteReason:'agent_incomplete'})).toMatch(/^Partly done .*did not say it needs anything from you/)
 expect(hadronAgentOutcomeFailure('Some provider error')).toBeUndefined()
})
