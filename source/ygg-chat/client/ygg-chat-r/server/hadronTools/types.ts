import {createHash} from 'node:crypto'
import {containsRawToolInvocation} from '../../../../shared/toolOutput.js'
import {boundedToolReceipt,compactToolTranscript,isOversizedContextError,toolContextBudget,toolContextTokens,type ToolTranscriptEntry} from './toolContext.js'
/** A capability supplied only by trusted in-process Hadron admission, never a request field. */
export interface HadronToolSession {
  /** Trusted runtime supplies its own subscription-backed search, never model/request data. */
  bindWebSearch?(search: typeof import('../tools/braveSearch.js').braveSearch): void
  /** Set only by native Agent-mode admission; ordinary read/review sessions retain their existing budget. */
  execution?:'agent'
  /** Native coding admission requires an explicit outcome, not just answer text. */
  requireCompletionStatus?:boolean
  /** Trusted coordinator: this stage reports an assessment, not implementation. */
  assessmentOnly?:boolean
  acceptStructuredAnswer?:boolean
  maxRequests?:number
  /** Absolute coordinator deadline, supplied only by trusted host admission. */
  deadlineAt?:number
  /** Trusted optional same-provider helper; shares the existing helper quota and cancellation. */
  condense?(text:string,signal:AbortSignal):Promise<string>
  outcome?:{incompleteReason?:'context_limit'|'request_limit'|'time_limit'|'agent_incomplete'|'completion_unconfirmed'|'agent_stalled'}
  requireEvidenceAttempt?: boolean
  evidenceAttempted?(): boolean
  evidenceInstruction?:string
  instructions: string
  invoke(name: string, args: unknown, signal: AbortSignal): Promise<unknown>
}
const trusted = new WeakSet<object>()
export function admitHadronToolSession(session: HadronToolSession): HadronToolSession { trusted.add(session); return session }
export function isHadronToolSession(value: unknown): value is HadronToolSession { return !!value && typeof value === 'object' && trusted.has(value) }
export function withHadronAssessment(session:HadronToolSession):HadronToolSession{
 if(!isHadronToolSession(session)||session.execution==='agent'||session.requireCompletionStatus)throw Error('Assessment requires a read-only admitted session')
 return admitHadronToolSession({...session,assessmentOnly:true,instructions:session.instructions+'\nASSESSMENT SCOPE: Complete your assigned read-only assessment using available evidence. Report missing evidence, blockers and outstanding implementation plainly. You are not assigned to perform the implementer\'s remaining edits or tests. A report that the overall project is unfinished does not mean this assessment failed. Never claim that unfinished implementation or unavailable verification was completed.'})
}
export function withHadronToolDeadline(session:HadronToolSession,deadlineAt:number):HadronToolSession{
 if(!isHadronToolSession(session)||!Number.isSafeInteger(deadlineAt)||deadlineAt<=0)throw Error('Invalid host tool deadline')
 return admitHadronToolSession({...session,deadlineAt:Math.min(session.deadlineAt??deadlineAt,deadlineAt)})
}

/** Keep evidence of large operations without echoing their entire source payload. */
export function compactHostRequest(value:unknown):unknown{
 const visit=(item:unknown,depth:number):unknown=>{
  if(typeof item==='string'&&Buffer.byteLength(item)>4000)return {hostReceipt:'Input omitted from history; check the tool result for execution and inspect the file for its current contents.',characters:item.length,sha256:createHash('sha256').update(item).digest('hex')}
  if(depth>12)return {hostReceipt:'Nested input omitted after operation.'}
  if(Array.isArray(item))return item.map(value=>visit(value,depth+1))
  if(item&&typeof item==='object')return Object.fromEntries(Object.entries(item).map(([key,value])=>[key,visit(value,depth+1)]))
  return item
 }
 return visit(value,0)
}

export async function runHadronToolConversation(input: {
  session: HadronToolSession; task: string; signal: AbortSignal
  contextLength?:number
  generate(packet: string, instructions: string): Promise<string>
}): Promise<string> {
  let transcript:ToolTranscriptEntry[] = [{ role: 'user', content: input.task }]
  const outcome:NonNullable<HadronToolSession['outcome']>=input.session.outcome={}
  let budget=toolContextBudget(input.contextLength),contextRetries=0,condensations=0
  const condense=async(aggressive=false)=>{transcript=await compactToolTranscript({transcript,signal:input.signal,aggressive,condense:condensations++<2?input.session.condense:undefined})}
  let correctedNoCheck = false, correctedToolMarkup = false, correctedCompletion = false
  const progress=new Set<string>()
  let partialProgress=-1,stalledReports=0
  const finish = (answer: string,finished?:boolean,canCorrect=false,blocker?:string,stopReason?:'time_limit'|'request_limit'): string | undefined => {
    if (input.session.requireEvidenceAttempt && !input.session.evidenceAttempted?.()) {
      if (correctedNoCheck) throw new Error('An answer was returned without attempting the required evidence check; no check completed')
      correctedNoCheck = true
      transcript.push({ role: 'assistant', content: answer }, { role: 'user', content: 'HOST PROTOCOL CORRECTION: The required evidence operation has not been attempted. '+(input.session.evidenceInstruction??'Use the supplied JSON host tool protocol now to attempt a relevant web_read, web_search or enabled tool. Native tools being disabled does not disable this protocol. tool_list alone is not evidence. If an operation is unavailable its actual host error can establish that limitation. Return a final report only after the attempt.')+' This correction uses the existing request budget; do not invent results.' })
      return undefined
    }
    if (input.session.requireCompletionStatus && finished!==true) {
      if(finished===false){
        if(blocker){outcome.incompleteReason='agent_incomplete';return answer+'\n\nAgent-reported blocker: '+blocker}
        stalledReports=progress.size===partialProgress?stalledReports+1:0
        partialProgress=progress.size
        if(canCorrect&&stalledReports<2){
          transcript.push({role:'assistant',content:answer},{role:'user',content:'HOST CONTINUE ASSIGNED WORK: The current request remains unfinished, and no external blocker was reported. Continue the remaining authorized work using the granted host tools and actual recorded results. Keep the same task and scope; do not merely repeat recommendations or claim completion. Do not repeat completed file-changing operations. Narrow truncated searches and correct failed inputs. When the current request is fulfilled return {"answer":"report of actual work and checks","finished":true}. Only if a real external blocker prevents further work, return {"answer":"available findings and remaining work","finished":false,"blocked":true,"blocker":"the concrete blocker or question for the user"}. This stays within the existing request/time budget.'})
          return undefined
        }
        outcome.incompleteReason=outcome.incompleteReason??stopReason??(stalledReports>=2?'agent_stalled':'agent_incomplete')
        return answer
      }
      if (!correctedCompletion && canCorrect) {
        correctedCompletion=true
        transcript.push({role:'assistant',content:answer},{role:'user',content:'HOST OUTCOME CORRECTION: Your reply did not confirm whether the assigned work is finished. Return {"answer":"your report","finished":true} only when the current request is fulfilled, or {"answer":"available findings and remaining work","finished":false} to continue possible authorized work. For a genuine external blocker also supply blocked:true and a concise blocker string. A partial investigation is not a finished repair. Answering a question can be complete without edits or tests. Do not broaden the request, invent completion or repeat completed file operations. This correction uses the existing request/time budget.'})
        return undefined
      }
      outcome.incompleteReason='completion_unconfirmed'
    } else if (finished===false&&!input.session.assessmentOnly) outcome.incompleteReason='agent_incomplete'
    return answer
  }
  const maximum=input.session.maxRequests??8
  if(!Number.isSafeInteger(maximum)||maximum<1||maximum>(input.session.execution==='agent'?100:8))throw Error('Invalid host protocol budget')
  const partial = (reason:'context_limit'|'request_limit'|'time_limit'='request_limit'):string => {
    outcome.incompleteReason=reason
    const timedOut='Not finished — the task time limit was reached before a final answer. Saved work is available.'
    if(input.session.acceptStructuredAnswer)throw Error(reason==='time_limit'?timedOut:'Research budget reached before a usable structured proposal. No changes were prepared.')
    const evidence=transcript.filter(item=>item.role==='tool_evidence'||item.role==='host_memory')
    if(!evidence.length||input.session.requireEvidenceAttempt&&!input.session.evidenceAttempted?.())throw Error(reason==='time_limit'?timedOut:'Research budget reached without the required evidence check')
    if(reason==='time_limit')return 'Not finished — Hadron stopped before a final answer was produced.\nThe task time limit was approaching. The agent requested another operation instead of returning its final answer; that operation was not run. Earlier operations may already have changed files. Saved evidence follows; it does not establish completion.\n\n'+evidence.slice(-8).map((item,index)=>'Operation '+(index+1)+':\n```json\n'+JSON.stringify(item.content).slice(0,1200)+'\n```').join('\n\n')
    if(input.session.execution==='agent')return 'Work stopped at the request or context limit before a final answer was produced. Some operations may already have changed files. The recorded results below show what ran; they do not establish that the task is finished.\n\n'+evidence.slice(-8).map((item,index)=>'Operation '+(index+1)+':\n```json\n'+JSON.stringify(item.content).slice(0,1200)+'\n```').join('\n\n')
    return '### Partial research — limit reached\nHadron stopped further research at the configured request or context limit. The agent did not supply a final assessment. This is a host-saved evidence record, not a completed recommendation or verification. No additional request or tool operation was started.\n\n'+evidence.slice(-8).map((item,index)=>'Evidence '+(index+1)+' (untrusted tool result; may be incomplete):\n```json\n'+JSON.stringify(item.content).slice(0,1200)+'\n```').join('\n\n')+'\n\n### Remaining uncertainty\nOnly the recorded excerpts were inspected. Missing or truncated evidence cannot establish the wider project state. Further focused research may be needed; do not treat this limit as consensus.'
  }
  for (let turn = 0; turn < maximum; turn++) {
    input.signal.throwIfAborted()
    const timeRemainingMs=input.session.deadlineAt===undefined?undefined:Math.max(0,input.session.deadlineAt-Date.now())
    if(timeRemainingMs===0)return partial('time_limit')
    const finalForTime=timeRemainingMs!==undefined&&timeRemainingMs<=60_000
    let finalAnswerRequired=turn===maximum-1||finalForTime
    const makePacket=()=>JSON.stringify({ kind: 'hadron_tool_conversation', transcript, remainingRequests: maximum - turn,finalAnswerRequired,...(timeRemainingMs!==undefined?{timeRemainingMs}:{}),
      ...(finalAnswerRequired?{hostInstruction:'FINAL RESPONSE REQUIRED. No more tool calls are allowed. Return your final answer now, using only evidence already returned. State incomplete research and uncertainty explicitly. If a structured proposal is required, return that schema only when supported; never invent file changes.'}:{}) })
    let packet=makePacket()
    if(toolContextTokens(input.session.instructions+packet)>budget){await condense();packet=makePacket()}
    if(toolContextTokens(input.session.instructions+packet)>budget){await condense(true);packet=makePacket()}
    if(toolContextTokens(input.session.instructions+packet)>budget){
      // Preserve the user's task and the evidence; never silently call a partial record a completed answer.
      finalAnswerRequired=true;outcome.incompleteReason='context_limit';packet=makePacket()
      if(toolContextTokens(input.session.instructions+packet)>budget)return partial('context_limit')
    }
    let text:string
    try{text=await input.generate(packet, input.session.instructions+'\nHOST FORMAT: Return one JSON object: {"tool":"name","arguments":{...}} or '+(input.session.requireCompletionStatus?'{"answer":"your final answer","finished":true}. The boolean finished is REQUIRED for a final answer; it refers to fulfilling the current user request, not merely writing a reply.':'{"answer":"your final answer"}.')+' If assigned work remains, return {"answer":"available findings and remaining work","finished":false}. Continue through granted tool requests while useful authorized work remains. Only a real external blocker, unavailable required permission/resource or question requiring the user should end unfinished work early: add "blocked":true and "blocker":"concise concrete reason" to that unfinished answer. A recoverable failed search or partial investigation is not an external blocker. Ordinary uncertainty in a completed analysis does not by itself mean unfinished work. Native XML/invoke markup is never executed and is not a final answer.'+(finalAnswerRequired?'\nHOST BUDGET: This is the final allowed response. Tools are now closed. Return the final answer from existing evidence, with explicit limitations.':''))}
    catch(error){
      input.signal.throwIfAborted()
      // Only retry a rejected text-generation request. No prior tool operation is repeated.
      if(isOversizedContextError(error)&&contextRetries++<2&&turn<maximum-1&&transcript.length>1){budget=Math.max(1024,Math.floor(budget/2));await condense(true);continue}
      throw error
    }
    input.signal.throwIfAborted()
    let value: any, parsed = false
    try { value = JSON.parse(text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '')); parsed = true } catch { /* Plain answers and native markup are handled below. */ }
    const answerText = parsed ? (typeof value?.answer === 'string' ? value.answer : '') : text
    if (containsRawToolInvocation(answerText)) {
      if(finalAnswerRequired)return partial()
      if(correctedToolMarkup)throw Error('The agent repeated an unsupported tool-request format instead of returning an answer. That request was not executed. No final answer was produced.')
      correctedToolMarkup=true
      transcript.push({role:'assistant',content:text.slice(0,4000)},{role:'user',content:'HOST PROTOCOL CORRECTION: The preceding XML/native tool request was not executed. Do not present it as an answer or claim it ran. Return exactly one JSON object using the supplied host protocol: {"tool":"name","arguments":{...}} for an allowed operation, or {"answer":"final answer based on actual evidence"}. This correction uses the remaining existing request budget. Do not invent tool results.'})
      continue
    }
    if (!parsed) { if (text.trim() && !text.trim().startsWith('{')) { const answer = finish(text,undefined,!finalAnswerRequired); if (answer !== undefined) return answer; continue }; throw new Error('Invalid tool response; no tool was run') }
    if (value && Object.keys(value).every(key=>['answer','finished','blocked','blocker'].includes(key))&&(!Object.hasOwn(value,'finished')||typeof value.finished==='boolean')&&(!Object.hasOwn(value,'blocked')||typeof value.blocked==='boolean')&&(!Object.hasOwn(value,'blocker')||typeof value.blocker==='string'&&value.blocker.length<=2000)&&(!value.blocked||value.finished===false&&value.blocker?.trim())&&typeof value.answer === 'string' && value.answer.trim()) {
      const answer = finish(value.answer,value.finished,!finalAnswerRequired,value.blocked?value.blocker.trim():undefined,finalForTime?'time_limit':finalAnswerRequired?'request_limit':undefined)
      if (answer !== undefined)return answer
      continue
    }
    if(input.session.acceptStructuredAnswer&&value&&typeof value==='object'&&!Array.isArray(value)&&!('tool' in value)&&!('arguments' in value)){const answer=finish(JSON.stringify(value));if(answer!==undefined)return answer;continue}
    if (!value || Object.keys(value).sort().join(',') !== 'arguments,tool' || typeof value.tool !== 'string') throw new Error('Expected a tool request or final answer within the request budget')
    if(finalAnswerRequired)return partial(finalForTime?'time_limit':'request_limit')
    transcript.push({ role: 'assistant', content: compactHostRequest(value) })
    let result: unknown
    try { result = await input.session.invoke(value.tool, value.arguments, input.signal) }
    catch { input.signal.throwIfAborted(); result = { error: 'Tool request failed or was denied. Check its name, inputs and granted mode; do not claim success.' } }
    const serialized=JSON.stringify(result)??'null'
    if(result!==undefined&&!(result&&typeof result==='object'&&((result as any).success===false||(result as any).error)))progress.add(createHash('sha256').update(JSON.stringify([value.tool,value.arguments,result])).digest('hex'))
    if(serialized.length>20000){
      let summary:string|undefined
      if(input.session.condense&&condensations++<2){
        try{
          const evidence=JSON.stringify({name:value.tool,truncated:true,characters:serialized.length,beginning:serialized.slice(0,13000),end:serialized.slice(-8500)})
          const text=await input.session.condense(evidence.slice(0,24000),input.signal)
          input.signal.throwIfAborted()
          if(typeof text==='string'&&text.trim()&&text.length<=6000)summary=text
        }catch{input.signal.throwIfAborted()}
      }
      result={toolResultShortened:true,untrustedContent:true,summary,receipt:boundedToolReceipt({name:value.tool,result}),originalCharacters:serialized.length,sha256:createHash('sha256').update(serialized).digest('hex'),omitted:true,notice:'The operation already ran. This is shortened evidence, not a complete result. Read a relevant source excerpt if necessary; do not repeat a file-changing operation to recover output.'}
    }
    transcript.push({ role: 'tool_evidence', content: { name: value.tool, result } })
  }
  throw new Error('Hadron tool request limit reached')
}
