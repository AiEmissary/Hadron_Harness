import {expect,it,vi} from 'vitest'
import {runHadronToolConversation,type HadronToolSession} from '../hadronTools/types.js'
import {isOversizedContextError,toolContextBudget,toolContextTokens} from '../hadronTools/toolContext.js'

it('continues beyond the old 90,000-character cutoff and produces a report with the supplied model budget',async()=>{
 let calls=0;const sizes:number[]=[],invoke=vi.fn(async()=>({text:'source line and observed evidence. '.repeat(450)}))
 const answer=await runHadronToolConversation({session:{execution:'agent',maxRequests:30,instructions:'Inspect and report',invoke},contextLength:200000,task:'Keep the original task and constraints.',signal:new AbortController().signal,generate:async packet=>{sizes.push(packet.length);return ++calls<=12?JSON.stringify({tool:'project_read',arguments:{path:'fixture.md'}}):JSON.stringify({answer:'Report from the actual returned evidence.'})}})
 expect(answer).toContain('Report');expect(Math.max(...sizes)).toBeGreaterThan(90000);expect(invoke).toHaveBeenCalledTimes(12)
})
it('uses a helper summary as untrusted evidence and preserves the task and recent results while keeping packets bounded',async()=>{
 let calls=0;const packets:any[]=[],condense=vi.fn(async()=> 'Observed file.ts:12. Reads succeeded. Investigation remains incomplete; check the recent results.')
 const task='Investigate only the last two weeks. Do not change files.'
 const session:HadronToolSession={execution:'agent',maxRequests:30,instructions:'Use the evidence',condense,invoke:vi.fn(async()=>({path:'file.ts',success:true,text:'line of actual source evidence. '.repeat(450)}))}
 const answer=await runHadronToolConversation({session,contextLength:24000,task,signal:new AbortController().signal,generate:async packet=>{packets.push(JSON.parse(packet));return ++calls<=14?JSON.stringify({tool:'project_read',arguments:{path:'file.ts'}}):JSON.stringify({answer:'Investigation report; original files unchanged.'})}})
 expect(answer).toContain('report');expect(condense).toHaveBeenCalled();expect(condense.mock.calls.length).toBeLessThanOrEqual(2)
 expect(packets.some(packet=>packet.transcript.some((entry:any)=>entry.role==='host_memory'&&entry.content.untrustedContent===true))).toBe(true)
 for(const packet of packets){expect(packet.transcript[0]).toEqual({role:'user',content:task});expect(toolContextTokens(JSON.stringify(packet)+session.instructions)).toBeLessThanOrEqual(toolContextBudget(24000))}
 expect(session.outcome?.incompleteReason).toBeUndefined()
})
it('falls back to bounded receipts if a summary helper fails, without re-executing operations',async()=>{
 let calls=0;const invoke=vi.fn(async()=>({path:'file.ts',success:true,text:'observed fact '.repeat(900)}))
 const answer=await runHadronToolConversation({session:{execution:'agent',maxRequests:20,instructions:'Inspect',invoke,condense:async()=>{throw Error('Helper allowance unavailable')}},contextLength:20000,task:'Investigate',signal:new AbortController().signal,generate:async()=>++calls<=10?JSON.stringify({tool:'project_read',arguments:{path:'file.ts'}}):JSON.stringify({answer:'Bounded report with limitations.'})})
 expect(answer).toContain('report');expect(invoke).toHaveBeenCalledTimes(10)
})
it('retries only an explicitly oversized generation with smaller context and never repeats the already completed edit',async()=>{
 let calls=0;const invoke=vi.fn(async()=>({success:true,path:'edited.ts',text:'observed output '.repeat(700)})),sizes:number[]=[]
 const answer=await runHadronToolConversation({session:{execution:'agent',maxRequests:5,instructions:'Finish the task',invoke},contextLength:200000,task:'Apply the requested change once.',signal:new AbortController().signal,generate:async packet=>{
  sizes.push(packet.length);calls++
  if(calls===1)return JSON.stringify({tool:'edit_file',arguments:{path:'edited.ts',oldText:'a',newText:'b'}})
  if(calls===2)throw Object.assign(new Error('maximum context length exceeded'),{code:'context_length_exceeded'})
  return JSON.stringify({answer:'One edit completed; report based on its receipt.'})
 }})
 expect(answer).toContain('One edit');expect(invoke).toHaveBeenCalledTimes(1);expect(sizes[2]).toBeLessThan(sizes[1])
})
it('does not treat quota or output-capacity failures as input context rejections',()=>{
 expect(isOversizedContextError(new Error('Usage limit reached'))).toBe(false)
 expect(isOversizedContextError(new Error('Claude returned more output than this request allows.'))).toBe(false)
 expect(isOversizedContextError({code:'context_length_exceeded'})).toBe(true)
})
it('records an incomplete outcome when the request cap is exhausted and the agent ignores final-report instructions',async()=>{
 const session:HadronToolSession={execution:'agent',maxRequests:2,instructions:'Inspect',invoke:vi.fn(async()=>({path:'file.ts',success:true}))}
 const generate=vi.fn(async()=>JSON.stringify({tool:'project_read',arguments:{path:'file.ts'}}))
 expect(await runHadronToolConversation({session,task:'Inspect',signal:new AbortController().signal,generate})).toContain('Work stopped')
 expect(session.outcome?.incompleteReason).toBe('request_limit');expect(generate).toHaveBeenCalledTimes(2)
})
it('honours Stop during summarisation without a later request or operation',async()=>{
 const controller=new AbortController();let calls=0
 const invoke=vi.fn(async()=>({text:'some evidence '.repeat(1000)}))
 await expect(runHadronToolConversation({session:{execution:'agent',maxRequests:20,instructions:'Inspect',invoke,condense:async()=>{controller.abort();return 'summary'}},contextLength:16000,task:'Inspect',signal:controller.signal,generate:async()=>{calls++;return JSON.stringify({tool:'project_read',arguments:{path:'file.ts'}})}})).rejects.toThrow()
 expect(calls).toBeLessThan(20);expect(invoke).toHaveBeenCalledTimes(calls)
})
it('retains an explicitly unfinished answer while exposing its outcome to job status',async()=>{
 const session:HadronToolSession={execution:'agent',instructions:'Investigate',invoke:vi.fn()}
 const text='Only part of the requested investigation could be completed. These are the available findings.'
 expect(await runHadronToolConversation({session,task:'Investigate',signal:new AbortController().signal,generate:async()=>JSON.stringify({answer:text,finished:false})})).toBe(text)
 expect(session.outcome?.incompleteReason).toBe('agent_incomplete')
 expect(session.invoke).not.toHaveBeenCalled()
})
it('bounds large arrays of results as well as individual strings during repeated compactions',async()=>{
 let calls=0
 const session:HadronToolSession={execution:'agent',maxRequests:30,instructions:'Inspect',invoke:async()=>({matches:Array.from({length:16},(_,i)=>({path:'file-'+i+'.ts',line:i,text:'observed line '.repeat(45)}))})}
 const result=await runHadronToolConversation({session,contextLength:16000,task:'Keep investigating',signal:new AbortController().signal,generate:async()=>++calls<20?JSON.stringify({tool:'project_search',arguments:{query:'needle'}}):JSON.stringify({answer:'Bounded search report.'})})
 expect(result).toBe('Bounded search report.');expect(session.outcome?.incompleteReason).toBeUndefined()
})
it('condenses a single oversized tool result instead of failing after an operation already ran',async()=>{
 let calls=0;const packets:string[]=[],condense=vi.fn(async()=> 'The file was created successfully; the returned diagnostic text was oversized.')
 const invoke=vi.fn(async()=>({success:true,path:'created.ts',output:'Large diagnostic result. '.repeat(2500)}))
 const answer=await runHadronToolConversation({session:{execution:'agent',instructions:'Create once',invoke,condense},contextLength:200000,task:'Create the file once and report.',signal:new AbortController().signal,generate:async packet=>{packets.push(packet);return ++calls===1?JSON.stringify({tool:'create_file',arguments:{path:'created.ts',content:'fixture'}}):JSON.stringify({answer:'File created; diagnostic output was condensed.'})}})
 expect(answer).toContain('File created');expect(invoke).toHaveBeenCalledTimes(1);expect(condense).toHaveBeenCalledTimes(1)
 expect(packets[1]).toContain('toolResultShortened');expect(packets[1]).toContain('created.ts');expect(packets[1].length).toBeLessThan(12000)
})
