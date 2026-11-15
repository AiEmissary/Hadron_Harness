import {fixtureImage} from '../../../../shared/__fixtures__/hadronImage.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import {continuousFailure,similarRepeatedReplies} from '../hadronTools/continuousMemory.js'
import {ContinuousChatService} from '../hadronTools/continuousChat.js'
import {continuousWorkspaceTransport} from '../../src/features/collaboration/workspaceContinuousTransport'
import {composeSharedContext} from '../../src/features/collaboration/attachmentContext'
import type {ContinuousChatApi} from '../../../../shared/continuousChat.js'
import type {WorkspaceRunRequest} from '../../src/features/collaboration/workspaceRunner'
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')
let root:string,db:any,service:ContinuousChatService,calls:any[],hold:boolean,release:()=>void,joinFails:boolean
let holdMemory:boolean
let consensusResponse:((packet:any)=>string)|undefined
let rejections:number,failureMessage:string,delays:number[],holdRetry:boolean,holdJoin:boolean,releaseJoin:()=>void,claudeAdmitted:boolean
const input=()=>({id:'conversation',workspaceId:'workspace',anchorMessageId:'anchor',goal:'Exchange evidence-based ideas.',models:{a:'model-a',b:'model-b'},maxTurns:20,maxSeconds:60})
const authorize=(owner:string)=>{if(owner!=='owner')throw Error('Owner denied')}
function make(authorizeRead?:()=>void){return new ContinuousChatService(db,{authorize,authorizeRead,allowedModels:new Set(['model-a','model-b']),
 admitModel:(provider,model)=>provider==='claudecode'?claudeAdmitted&&model==='haiku':['model-a','model-b'].includes(model),
 generate:async(_owner,config,role,prompt,signal,onPrepared,packet)=>{
  const ordinal=calls.length+1,binding={runId:'run-'+ordinal,handle:'handle-'+ordinal,streamId:'stream-'+ordinal}
  calls.push({images:config.images,role,packet,prompt,model:config.models[role],provider:config.providers?.[role]??'openaichatgpt'});onPrepared(binding)
  if(rejections-->0)throw Error(failureMessage)
  if(hold||(holdMemory&&packet.kind==='continuous_memory'))await new Promise<void>(resolve=>{release=resolve;signal.addEventListener('abort',resolve,{once:true})})
  signal.throwIfAborted();return {text:consensusResponse?consensusResponse(packet):packet.inputSummary?'Condensed supplied report: preserve original units, compare evidence, do not trade.':packet.kind==='continuous_memory'?`Memory through ${packet.transcript.at(-1).turn}: retain decisions, uncertainty and accessibility.`:`Agent ${role} turn ${ordinal}: evidence considered.`,binding}
 },cancel:vi.fn(),join:async()=>{if(joinFails)throw Error('No termination evidence');if(holdJoin)await new Promise<void>(resolve=>{releaseJoin=resolve})},waitForRetry:async(milliseconds,signal)=>{delays.push(milliseconds);if(holdRetry)await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}))}})}
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-continuous-'));db=new DatabaseSync(path.join(root,'chat.db'));calls=[];consensusResponse=undefined;hold=false;holdMemory=false;joinFails=false;rejections=0;holdRetry=false;holdJoin=false;claudeAdmitted=false;releaseJoin=()=>{};failureMessage='Hadron ChatGPT temporarily unavailable [upstream_http_503]';delays=[];release=()=>{};service=make()})
afterEach(async()=>{await service.shutdown();if(path.dirname(root)!==fs.realpathSync(os.tmpdir())||!path.basename(root).startsWith('hadron-continuous-'))throw Error('Invalid cleanup root');fs.rmSync(root,{recursive:true,force:true})})
async function wait(condition:()=>boolean){for(let step=0;step<500;step++){if(condition())return;await new Promise(resolve=>setImmediate(resolve))}throw Error('Conversation did not settle')}
it('carries a real composed text attachment through the workspace transport into native continuation and both agents',async()=>{
 service.start('owner',{...input(),maxTurns:2});await wait(()=>service.status('owner','conversation').workersEnded)
 const supplied='Original attached report. '+ 'Figures, units and qualifications. '.repeat(300)
 const context=composeSharedContext('',[{id:'report',name:'report.txt',text:supplied}])
 const request:WorkspaceRunRequest={id:'native-ui-follow-up',chatId:'ui',projectId:'project',workType:'continuous',permission:'chat',agent:'a',models:{a:{provider:'openaichatgpt',modelName:'model-a'},b:{provider:'openaichatgpt',modelName:'model-b'}},maxTurns:2,folder:undefined,answerId:'reply',question:{id:'question',parentId:'last',role:'user',text:'Read the text file, compare and reach consensus.',context,state:'completed'},path:[{id:'last',parentId:null,role:'assistant',text:'Previous consensus.',state:'completed',origin:{kind:'continuous',id:'conversation',nodeId:'turn:2',fullContext:true}}]}
 const api={start:async value=>service.start('owner',value),continueSaved:async(id,value)=>service.continueSaved('owner',id,value),status:async id=>service.status('owner',id),stop:async id=>service.stop('owner',id)} as ContinuousChatApi
 const events:any[]=[],before=calls.length,handle=continuousWorkspaceTransport({api,workspaceId:'workspace',anchor:async()=>'anchor',remember:()=>{},pollMs:100000}).create(request,event=>events.push(event))
 try{
  await handle.start();await wait(()=>service.status('owner',request.id).workersEnded);await handle.recover()
  const fresh=calls.slice(before);expect(fresh).toHaveLength(2)
  for(const call of fresh){expect(call.packet.userMessages.at(-1).text).toBe(request.question.text+'\n\n'+context);expect(call.prompt).toContain(supplied);expect(call.prompt.match(/Original attached report\./g)).toHaveLength(1)}
  expect(events.at(-1).state).toBe('completed');expect(events.at(-1).replies).toHaveLength(2)
  expect(request.question.context).toBe(context)
 }finally{handle.dispose()}
})
it('accepts full attached text beyond the old continuation cap and sends it once to each agent',async()=>{
 service.start('owner',{...input(),maxTurns:2});await wait(()=>service.status('owner','conversation').workersEnded)
 const instruction='Read the attached report and compare it.\n'+JSON.stringify({files:[{name:'report.txt',text:'Supplied evidence. '.repeat(600)}]})
 expect(Buffer.byteLength(instruction)).toBeGreaterThan(4000)
 const before=calls.length
 service.continueSaved('owner','conversation',{id:'attached-report',models:input().models,maxTurns:2,maxSeconds:60,instruction})
 await wait(()=>service.status('owner','attached-report').workersEnded)
 expect(service.status('owner','attached-report').input.continuationInstruction).toBe(instruction)
 expect(calls.slice(before)).toHaveLength(2)
 for(const call of calls.slice(before)){expect(call.packet.userMessages.at(-1).text).toBe(instruction);expect(call.prompt.match(/Read the attached report and compare it\./g)).toHaveLength(1)}
})
it('summarises every part of long new input before conversation replies and retains the full original',async()=>{
 const goal='Compare this complete supplied report.\n'+'🌙 Trading evidence and units.\n'.repeat(3000)+'END: do not trade.'
 service.start('owner',{...input(),goal,maxTurns:2})
 await wait(()=>service.status('owner','conversation').workersEnded)
 const view=service.status('owner','conversation'),parts=calls.filter(call=>call.packet.inputSummary),replies=calls.filter(call=>call.packet.kind==='continuous_conversation')
 expect(view.reason).toBe('turn_budget');expect(view.input.goal).toBe(goal)
 expect(parts.length).toBeGreaterThan(1);expect(parts.map(call=>call.packet.userMessages[0].text).join('')).toBe(goal)
 expect(replies).toHaveLength(2);expect(replies[0].packet.goal).toContain('lossy summary')
 expect(view.turns.filter(turn=>turn.kind==='reply')).toHaveLength(2)
 for(const call of calls)expect(Buffer.byteLength(call.prompt)).toBeLessThanOrEqual(64000)
})
it('Stop during supplied-input condensation saves no partial summary and starts no peer reply',async()=>{
 holdMemory=true
 service.start('owner',{...input(),goal:'Report evidence. '.repeat(6000),maxTurns:2})
 await wait(()=>!!calls.at(-1)?.packet.inputSummary)
 const view=await service.stop('owner','conversation')
 expect(view).toMatchObject({state:'stopped',workersEnded:true})
 expect(view.turns.filter(turn=>turn.kind==='reply')).toHaveLength(0)
 expect(db.prepare('SELECT COUNT(*) AS count FROM hadron_continuous_input_memory').get().count).toBe(0)
 expect(calls).toHaveLength(1)
})
it('resumes supplied-input preparation after a committed part without processing that part again',async()=>{
 const goal='LONG REPORT\n'+'evidence and constraints\n'.repeat(4000)
 holdMemory=true;service.start('owner',{...input(),goal,maxTurns:2});await wait(()=>!!calls.at(-1)?.packet.inputSummary)
 service.pause('owner','conversation');holdMemory=false;release();await wait(()=>service.status('owner','conversation').workersEnded)
 const paused=service.status('owner','conversation'),first=calls[0].packet.inputSummary
 expect(paused.state).toBe('paused')
 expect(db.prepare('SELECT through_character AS through FROM hadron_continuous_input_memory').get().through).toBe(first.to)
 service.resume('owner','conversation',paused.revision,0);await wait(()=>service.status('owner','conversation').workersEnded)
 const parts=calls.filter(call=>call.packet.inputSummary)
 expect(parts[1].packet.inputSummary.from).toBe(first.to)
 expect(parts.map(call=>call.packet.userMessages[0].text).join('')).toBe(goal)
 expect(service.status('owner','conversation').reason).toBe('turn_budget')
})
it('admits long in-conversation instructions at a turn boundary and keeps injection idempotent',async()=>{
 hold=true;service.start('owner',{...input(),maxTurns:2});await wait(()=>calls.length===1)
 const text='Compare these additional figures. '+ 'Keep the units and uncertainty. '.repeat(300)
 service.inject('owner','conversation','long-instruction',text);service.inject('owner','conversation','long-instruction',text)
 hold=false;release();await wait(()=>service.status('owner','conversation').workersEnded)
 expect(service.status('owner','conversation').messages).toHaveLength(1)
 expect(calls[1].packet.userMessages.at(-1).text).toBe(text)
 expect(calls[1].prompt.match(/Compare these additional figures\./g)).toHaveLength(1)
})
it('ends after both agents explicitly agree on the same settled conclusion and saves readable feedback',async()=>{
 consensusResponse=packet=>packet.consensus.peerProposal
  ?'I checked the proposal. Use the existing tested solution.\n'+packet.consensus.peerProposal.confirmMarker
  :'Conclusion: use the existing tested solution.\n'+packet.consensus.proposeMarker
 service.start('owner',{...input(),maxTurns:100});await wait(()=>service.status('owner','conversation').workersEnded)
 const view=service.status('owner','conversation')
 expect(view).toMatchObject({state:'paused',reason:'consensus_reached',workersEnded:true})
 expect(calls).toHaveLength(2)
 expect(view.turns.at(-1)?.text).toContain('Consensus reached')
 expect(view.turns.every(turn=>!turn.text?.includes('HADRON_CONSENSUS'))).toBe(true)
 expect(calls[1].packet.consensus.peerProposal.conclusion).toBe('Conclusion: use the existing tested solution.')
 const before=calls.length,reopened=make()
 expect(reopened.status('owner',view.id).reason).toBe('consensus_reached');expect(calls).toHaveLength(before)
 consensusResponse=undefined
 service.continueSaved('owner',view.id,{id:'after-consensus',models:input().models,maxTurns:2,maxSeconds:60,instruction:'Now consider a different requirement.'})
 await wait(()=>service.status('owner','after-consensus').workersEnded)
 expect(calls[before].packet.consensus.peerProposal).toBeNull()
 expect(service.status('owner','after-consensus').turns).toHaveLength(2)
})
it('continues when the peer disagrees instead of treating one proposal or ordinary agreement as consensus',async()=>{
 consensusResponse=packet=>packet.turn===1?'My proposed conclusion.\n'+packet.consensus.proposeMarker:'I agree on that detail, but the user goal still has an unresolved requirement.'
 service.start('owner',{...input(),maxTurns:3});await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls).toHaveLength(3)
 expect(calls[1].packet.consensus.peerProposal).not.toBeNull()
 expect(calls[2].packet.consensus.peerProposal).toBeNull()
 expect(service.status('owner','conversation').reason).toBe('turn_budget')
})
it('does not accept a stale confirmation when a new user instruction arrives during the confirming turn',async()=>{
 consensusResponse=packet=>{
  if(packet.turn===1)return 'My conclusion.\n'+packet.consensus.proposeMarker
  if(packet.turn===2){service.inject('owner','conversation','changed-goal','Also address the missing requirement.');return 'I agree.\n'+packet.consensus.peerProposal.confirmMarker}
  return 'The new requirement needs more work.'
 }
 service.start('owner',{...input(),maxTurns:3});await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls).toHaveLength(3)
 expect(calls[2].packet.userMessages.at(-1).text).toBe('Also address the missing requirement.')
 expect(service.status('owner','conversation').reason).toBe('turn_budget')
 expect(service.status('owner','conversation').turns[1].text).not.toContain('Consensus reached')
})
it('automatically exchanges20 alternating turns, supplies peer history, persists bindings and pauses at the budget',async()=>{
 service.start('owner',input());await wait(()=>service.status('owner','conversation').workersEnded)
 const view=service.status('owner','conversation')
 expect(view).toMatchObject({state:'paused',reason:'turn_budget',workersEnded:true,canResume:true})
 expect(calls).toHaveLength(23);expect(view.turns).toHaveLength(23)
 const replies=calls.filter(call=>call.packet.kind==='continuous_conversation')
 for(let index=0;index<replies.length;index++){expect(replies[index].role).toBe(index%2?'b':'a');expect(replies[index].packet.transcript.length).toBeLessThanOrEqual(6)}
 expect(calls.filter(call=>call.packet.kind==='continuous_memory')).toHaveLength(3)
 expect(view.memory?.throughTurn).toBe(15)
 expect(view.turns.filter(turn=>turn.kind==='reply'&&turn.state==='completed')).toHaveLength(20)
 expect(replies.at(-1).packet.memory.text).toContain('uncertainty')
 expect(calls[1].packet.transcript[0].text).toContain('Agent a turn1'.replace('turn1','turn 1'))
 expect(service.ownsRun('run-20')).toBe(true)
 expect(()=>service.resume('owner','conversation',view.revision-1,2)).toThrow('revision')
 service.resume('owner','conversation',view.revision,2);await wait(()=>service.status('owner','conversation').workersEnded)
 expect(service.status('owner','conversation').turns.filter(turn=>turn.kind==='reply')).toHaveLength(22)
 expect(service.list('owner','workspace')).toHaveLength(1)
})
it('pause waits for the current turn; injection is idempotent and arrives at the next boundary',async()=>{
 hold=true;service.start('owner',input());await wait(()=>calls.length===1)
 service.pause('owner','conversation');service.inject('owner','conversation','message','Consider accessibility.')
 service.inject('owner','conversation','message','Consider accessibility.')
 expect(service.status('owner','conversation').workersEnded).toBe(false)
 release();await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls).toHaveLength(1)
 const view=service.status('owner','conversation');expect(view.reason).toBe('paused_by_user')
 hold=false;service.resume('owner','conversation',view.revision,0);await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls[1].packet.userMessages).toHaveLength(1)
 expect(calls[1].packet.userMessages[0]).toMatchObject({text:'Consider accessibility.',afterTurn:1})
})
it('Stop cancels a running turn, joins it and starts no successor',async()=>{
 hold=true;service.start('owner',input());await wait(()=>calls.length===1)
 const view=await service.stop('owner','conversation')
 expect(view).toMatchObject({state:'stopped',workersEnded:true,canResume:false})
 expect(calls).toHaveLength(1);expect(view.turns[0].state).toBe('failed')
})
it('duplicate Start spends no second request, foreign owners and conflicting IDs are refused',async()=>{
 hold=true;service.start('owner',input());service.start('owner',input());await wait(()=>calls.length===1)
 expect(()=>service.start('owner',{...input(),goal:'changed'})).toThrow('already used')
 expect(()=>service.status('foreign','conversation')).toThrow('unavailable')
 expect(()=>service.start('owner',{...input(),id:'parallel'})).toThrow()
 await service.stop('owner','conversation');expect(calls).toHaveLength(1)
})
it('cold recovery never dispatches or adopts a historical worker',async()=>{
 service.start('owner',{...input(),maxTurns:2});await wait(()=>service.status('owner','conversation').workersEnded)
 const before=calls.length
 const reopened=make()
 expect(reopened.status('owner','conversation')).toMatchObject({state:'paused',canResume:false,workersEnded:false})
 expect(()=>reopened.resume('owner','conversation',2,2)).toThrow()
 expect(calls).toHaveLength(before)
})
it('unknown child termination remains recovery-only rather than reporting workers ended',async()=>{
 joinFails=true;service.start('owner',input());await wait(()=>service.status('owner','conversation').state==='needs_recovery')
 expect(service.status('owner','conversation')).toMatchObject({workersEnded:false,canResume:false,reason:'storage_or_worker_failure'})
 expect(calls).toHaveLength(1)
})
it('recovers an explicit 503 with a fresh bound attempt, preserving failures and correct speaker order',async()=>{
 rejections=1;service.start('owner',{...input(),maxTurns:4});await wait(()=>service.status('owner','conversation').workersEnded)
 const view=service.status('owner','conversation')
 expect(view.turns.map(turn=>turn.state)).toEqual(['failed','completed','completed','completed'])
 expect(view.turns[0].errorCode).toBe('upstream_http_503')
 expect(calls.map(call=>call.role)).toEqual(['a','a','b','a'])
 expect(calls[1].packet.transcript).toEqual([])
 expect(calls[2].packet.transcript).toHaveLength(1)
 expect(delays).toEqual([3000]);expect(view.reason).toBe('turn_budget')
})
it('caps temporary recovery at two fresh attempts and supports explicit continuation without losing replies',async()=>{
 rejections=3;service.start('owner',input());await wait(()=>service.status('owner','conversation').workersEnded)
 const view=service.status('owner','conversation')
 expect(view).toMatchObject({state:'failed',reason:'upstream_http_503',canResume:true})
 expect(calls).toHaveLength(3);expect(delays).toEqual([3000,6000])
 service.resume('owner',view.id,view.revision,0);await wait(()=>service.status('owner',view.id).workersEnded)
 expect(service.status('owner',view.id).turns.filter(turn=>turn.kind==='reply'&&turn.state==='completed')).toHaveLength(17)
})
it('never retries an ambiguous failure or an unjoined rejected worker',async()=>{
 rejections=1;failureMessage='Connection lost after dispatch';service.start('owner',input());await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls).toHaveLength(1);expect(delays).toEqual([])
 const view=service.status('owner','conversation');expect(view.reason).toBe('connection_lost')
 rejections=1;failureMessage='Hadron ChatGPT temporarily unavailable [upstream_http_503]';joinFails=true
 service.resume('owner',view.id,view.revision,0);await wait(()=>service.status('owner',view.id).state==='needs_recovery')
 expect(calls).toHaveLength(2);expect(delays).toEqual([])
})
it('Stop interrupts rejection backoff without dispatching a successor',async()=>{
 rejections=1;holdRetry=true;service.start('owner',input());await wait(()=>delays.length===1)
 expect(service.status('owner','conversation').reason).toBe('retrying_temporary_rejection')
 const view=await service.stop('owner','conversation')
 expect(view).toMatchObject({state:'stopped',workersEnded:true});expect(calls).toHaveLength(1)
})
it('429 recovery still counts attempts toward the chosen request budget',async()=>{
 rejections=3;failureMessage='Hadron ChatGPT temporarily unavailable [upstream_http_429]'
 service.start('owner',{...input(),maxTurns:2});await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls).toHaveLength(2);expect(delays).toEqual([3000])
 expect(service.status('owner','conversation')).toMatchObject({state:'failed',reason:'upstream_http_429'})
})
it('keeps a failed current worker observable until join, then enables explicit continuation',async()=>{
 rejections=1;failureMessage='Ambiguous connection failure';holdJoin=true
 service.start('owner',input());await wait(()=>service.status('owner','conversation').state==='failed')
 expect(service.status('owner','conversation')).toMatchObject({currentHost:true,workersEnded:false,canResume:false})
 releaseJoin();await wait(()=>service.status('owner','conversation').workersEnded)
 expect(service.status('owner','conversation').canResume).toBe(true)
})
it('explicitly continues cold saved history with new runs, preserved messages and no replay',async()=>{
 hold=true;service.start('owner',{...input(),maxTurns:3});await wait(()=>calls.length===1)
 service.inject('owner','conversation','direction','Remember accessibility.');hold=false;release()
 await wait(()=>service.status('owner','conversation').workersEnded)
 const before=calls.length,original=service.status('owner','conversation'),reopened=make()
 expect(calls).toHaveLength(before)
 const request={id:'continuation',models:input().models,maxTurns:2,maxSeconds:60,instruction:'Now prioritise the next implementation step.'}
 reopened.continueSaved('owner','conversation',request)
 reopened.continueSaved('owner','conversation',request)
 await wait(()=>reopened.status('owner','continuation').workersEnded)
 const view=reopened.status('owner','continuation')
 expect(calls).toHaveLength(before+2);expect(calls[before].role).toBe('b')
 expect(calls[before].packet.transcript).toHaveLength(3)
 expect(calls[before].packet.userMessages.map((item:any)=>item.text)).toEqual(['Remember accessibility.',request.instruction])
 expect(view.history?.turns).toHaveLength(3);expect(view.input.continuationOf).toBe('conversation')
 expect(service.status('owner','conversation').turns).toEqual(original.turns)
 expect(()=>reopened.continueSaved('owner','conversation',{...request,instruction:'Changed'})).toThrow('identity')
 const again=make();expect(again.status('owner','continuation').history).toEqual(view.history)
 expect(calls).toHaveLength(before+2)
})
it('refuses foreign, live, empty and forged continuation sources without dispatch',async()=>{
 hold=true;service.start('owner',input());await wait(()=>calls.length===1)
 const request={id:'child',models:input().models,maxTurns:2,maxSeconds:60}
 expect(()=>service.continueSaved('foreign','conversation',request)).toThrow('unavailable')
 expect(()=>service.continueSaved('owner','conversation',request)).toThrow('Stop')
 expect(()=>service.start('owner',{...input(),id:'forged',continuationOf:'conversation'})).toThrow('continuation action')
 await service.stop('owner','conversation')
 expect(()=>service.continueSaved('owner','conversation',request)).toThrow('no completed replies')
 expect(calls).toHaveLength(1)
})
it('continuation chains preserve all completed ancestry, omit failed attempts and pause unprocessable oversized recent replies without dispatch',async()=>{
 service.start('owner',{...input(),maxTurns:2});await wait(()=>service.status('owner','conversation').workersEnded)
 rejections=1;failureMessage='Ambiguous failure'
 service.continueSaved('owner','conversation',{id:'child',models:input().models,maxTurns:2,maxSeconds:60})
 await wait(()=>service.status('owner','child').workersEnded)
 service.continueSaved('owner','child',{id:'grandchild',models:input().models,maxTurns:2,maxSeconds:60})
 await wait(()=>service.status('owner','grandchild').workersEnded)
 expect(service.status('owner','grandchild').history?.turns).toHaveLength(2)
 expect(calls[3].packet.transcript).toHaveLength(2)
 db.prepare("UPDATE hadron_continuous_turns SET text=? WHERE session_id='conversation'").run('x'.repeat(40000))
 const before=calls.length
 service.continueSaved('owner','conversation',{id:'large',models:input().models,maxTurns:2,maxSeconds:60})
 await wait(()=>service.status('owner','large').workersEnded)
 expect(service.status('owner','large').reason).toBe('context_budget');expect(calls).toHaveLength(before)
})
it('freezes mixed provider/model choices and allows explicit switching in a saved continuation',async()=>{
 claudeAdmitted=true
 const mixed={...input(),maxTurns:2,providers:{a:'openaichatgpt' as const,b:'claudecode' as const},models:{a:'model-a',b:'haiku'}}
 service.start('owner',mixed);await wait(()=>service.status('owner',mixed.id).workersEnded)
 expect(calls.map(call=>[call.provider,call.model])).toEqual([['openaichatgpt','model-a'],['claudecode','haiku']])
 expect(calls[1].packet.transcript[0].text).toContain('Agent a')
 service.continueSaved('owner',mixed.id,{id:'switched',models:{a:'haiku',b:'model-b'},providers:{a:'claudecode',b:'openaichatgpt'},maxTurns:2,maxSeconds:60})
 await wait(()=>service.status('owner','switched').workersEnded)
 expect(calls.slice(2).map(call=>call.provider)).toEqual(['claudecode','openaichatgpt'])
 const reopened=make();expect(reopened.status('owner','switched').input.providers).toEqual({a:'claudecode',b:'openaichatgpt'})
 expect(calls).toHaveLength(4)
})
it('rejects unadmitted Claude models rather than dispatching them as ChatGPT',()=>{
 expect(()=>service.start('owner',{...input(),providers:{a:'openaichatgpt',b:'claudecode'}})).toThrow('supported models')
 expect(calls).toHaveLength(0)
})

it('persists compacted memory, full originals and source references across cold continuation without replay',async()=>{
 service.start('owner',input());await wait(()=>service.status('owner','conversation').workersEnded)
 const source=service.status('owner','conversation'),before=calls.length,reopened=make()
 expect(source.turns[0].text).toBe('Agent a turn 1: evidence considered.')
 expect(source.turns.filter(turn=>turn.kind==='memory')).toHaveLength(3)
 expect(reopened.status('owner','conversation').memory).toEqual(source.memory)
 expect(calls).toHaveLength(before)
 reopened.continueSaved('owner','conversation',{id:'compact-child',models:input().models,maxTurns:2,maxSeconds:60,instruction:'Keep unresolved disagreements explicit.'})
 await wait(()=>reopened.status('owner','compact-child').workersEnded)
 expect(calls[before].packet.memory).toEqual(source.memory)
 expect(calls[before].packet.transcript).toHaveLength(5)
 expect(calls[before].role).toBe('a')
 expect(calls[before].packet.userMessages.at(-1).text).toBe('Keep unresolved disagreements explicit.')
 expect(reopened.status('owner','compact-child').history?.turns).toHaveLength(20)
 expect(service.status('owner','conversation').turns).toEqual(source.turns)
})
it('compacts large historical ancestry in bounded requests before sending another reply',async()=>{
 service.start('owner',{...input(),maxTurns:20});await wait(()=>service.status('owner','conversation').workersEnded)
 db.prepare("DELETE FROM hadron_continuous_memory WHERE session_id='conversation'").run()
 db.prepare("UPDATE hadron_continuous_turns SET text=? WHERE session_id='conversation' AND kind='reply'").run('Historical evidence. '.repeat(500))
 const before=calls.length
 service.continueSaved('owner','conversation',{id:'large-ancestry',models:input().models,maxTurns:10,maxSeconds:60})
 await wait(()=>service.status('owner','large-ancestry').workersEnded)
 const fresh=calls.slice(before)
 expect(fresh[0].packet.kind).toBe('continuous_memory')
 expect(fresh.some(call=>call.packet.kind==='continuous_conversation')).toBe(true)
 for(const call of fresh)expect(Buffer.byteLength(JSON.stringify(call.packet))).toBeLessThanOrEqual(64000)
 expect(service.status('owner','large-ancestry').history?.turns[0].text).toHaveLength(10500)
})
it('failed compaction preserves the last memory, never becomes a peer reply, and requires explicit continuation',async()=>{
 hold=true;service.start('owner',input());await wait(()=>calls.length===1)
 hold=false;release()
 await wait(()=>calls.length>=7)
 // Pause at the next safe boundary, then arrange a rejected summary request.
 service.pause('owner','conversation');await wait(()=>service.status('owner','conversation').workersEnded)
 const paused=service.status('owner','conversation')
 rejections=1;failureMessage='maximum context length exceeded: secret-token-DO-NOT-EXPOSE'
 service.resume('owner','conversation',paused.revision,0)
 await wait(()=>service.status('owner','conversation').workersEnded)
 const failed=service.status('owner','conversation')
 expect(failed.reason).toBe('context_limit')
 expect(failed.turns.at(-1)?.kind).toBe('memory')
 expect(failed.memory).toEqual(paused.memory)
 expect(JSON.stringify(failed)).not.toContain('secret-token')
 const before=calls.length
 service.resume('owner','conversation',failed.revision,0)
 await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls[before].packet.kind).toBe('continuous_memory')
 expect(service.status('owner','conversation').memory?.throughTurn).toBeGreaterThan(0)
})
it('classifies known provider failures without returning raw diagnostic text',()=>{
 for(const [message,expected] of [['rate limit exceeded','rate_limit'],['401 unauthorized','authentication_required'],['request timeout','provider_timeout'],['ECONNRESET connection lost','connection_lost'],['maximum context length exceeded','context_limit'],['unknown private error','turn_failed_no_retry']])expect(continuousFailure(Error(message))).toBe(expected)
})

it('conservatively recognises long near-repeated pairs while allowing concise moves and new evidence',()=>{
 const text='Agreed proceed with validation of mobile task creation completion reopening and persistence across timezone changes using the same acceptance criteria and record actual evidence before making further scope decisions'
 const repeats=Array.from({length:6},(_,index)=>({role:index%2?'b' as const:'a' as const,text:text+(index>3?' now':'')}))
 expect(similarRepeatedReplies(repeats)).toBe(true)
 expect(similarRepeatedReplies(repeats.map(reply=>({...reply,text:'e4 e5 Nf3'})))).toBe(false)
 expect(similarRepeatedReplies(repeats.map((reply,index)=>({...reply,text:reply.text+' '+Array.from({length:20},(_,word)=>'new'+index+'evidence'+word).join(' ')})))).toBe(false)
})
it('keeps 100 reply attempts bounded without counting internal memory as conversation',async()=>{
 service.start('owner',{...input(),maxTurns:100});await wait(()=>service.status('owner','conversation').workersEnded)
 const view=service.status('owner','conversation')
 expect(view.turns.filter(turn=>turn.kind!=='memory')).toHaveLength(100)
 expect(calls.length).toBeGreaterThan(100)
 expect(calls.length).toBeLessThan(130)
 expect(view.reason).toBe('turn_budget')
 expect(view.turns.filter(turn=>turn.kind==='reply').every(turn=>turn.text?.includes('evidence considered'))).toBe(true)
 expect(view.memory?.throughTurn).toBeGreaterThanOrEqual(75)
 for(const call of calls)expect(Buffer.byteLength(JSON.stringify(call.packet))).toBeLessThan(64000)
})

it('Stop during compaction cancels and joins the memory worker without saving a partial summary or successor',async()=>{
 holdMemory=true;service.start('owner',input())
 await wait(()=>calls.at(-1)?.packet.kind==='continuous_memory')
 const view=await service.stop('owner','conversation')
 expect(view.state).toBe('stopped');expect(view.workersEnded).toBe(true)
 expect(view.memory).toBeUndefined()
 expect(view.turns.filter(turn=>turn.kind==='reply'&&turn.state==='completed')).toHaveLength(7)
 expect(view.turns.at(-1)).toMatchObject({kind:'memory',state:'failed'})
 expect(calls).toHaveLength(8)
})
it('compacts early when large replies would exceed the prompt budget before the fifth older reply',async()=>{
 service.start('owner',{...input(),maxTurns:6});await wait(()=>service.status('owner','conversation').workersEnded)
 db.prepare("UPDATE hadron_continuous_turns SET text=? WHERE session_id='conversation'").run('x'.repeat(11000))
 const before=calls.length
 service.continueSaved('owner','conversation',{id:'size-trigger',models:input().models,maxTurns:3,maxSeconds:60})
 await wait(()=>service.status('owner','size-trigger').workersEnded)
 expect(calls[before].packet.kind).toBe('continuous_memory')
 expect(calls[before].packet.transcript).toHaveLength(3)
 expect(calls[before+1].packet.kind).toBe('continuous_conversation')
 expect(calls[before+1].packet.transcript).toHaveLength(3)
 expect(Buffer.byteLength(JSON.stringify(calls[before+1].packet))).toBeLessThan(64000)
})

it('checks read authority before a request or resume, retains readable history, and never inherits a stale grant in continuation',async()=>{
 await service.shutdown();db=new DatabaseSync(path.join(root,'chat.db'));let allowed=true;service=make(()=>{if(!allowed)throw Error('Select the folder again')})
 service.start('owner',{...input(),maxTurns:2,projectGrantId:'opaque-folder-grant'});await wait(()=>service.status('owner','conversation').workersEnded)
 service.recordFolder('owner','conversation','a:project_read','completed')
 expect(service.status('owner','conversation').folderActivity).toHaveLength(1)
 allowed=false;const priorCalls=calls.length,view=service.status('owner','conversation')
 expect(()=>service.resume('owner',view.id,view.revision,2)).toThrow('Select the folder again');expect(calls).toHaveLength(priorCalls)
 expect(()=>service.start('owner',{...input(),id:'denied',projectGrantId:'forged'})).toThrow('Select the folder again');expect(calls).toHaveLength(priorCalls)
 const next=service.continueSaved('owner','conversation',{id:'read-free-continuation',models:input().models,maxTurns:2,maxSeconds:60})
 expect(next.input.projectGrantId).toBeUndefined();await wait(()=>service.status('owner',next.id).workersEnded)
})

it('honours a one-turn conversation limit without starting the other agent',async()=>{
 service.start('owner',{...input(),maxTurns:1})
 await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls).toHaveLength(1)
 expect(calls[0].role).toBe('a')
 expect(service.status('owner','conversation')).toMatchObject({state:'paused',reason:'turn_budget',workersEnded:true})
 expect(()=>service.start('owner',{...input(),id:'zero',maxTurns:0})).toThrow('1–100')
})

it('sends readable attributed history, role-specific guidance, and persists the exact dispatched text',async()=>{
 hold=true;service.start('owner',{...input(),goal:'Compare two designs, preserving quotes: "A" and paths C:\\work.',maxTurns:3})
 await wait(()=>calls.length===1)
 service.inject('owner','conversation','clarification','Prioritise maintainability.');hold=false;release()
 await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls[0].prompt).toContain('Role: proposer.')
 expect(calls[1].prompt).toContain('Role: critic.')
 expect(calls[1].prompt).toContain('Agent A: (turn 1)\n> Agent a turn 1: evidence considered.')
 expect(calls[1].prompt).toContain('You: (after turn 1) — current instruction shown in full above.')
 expect(calls[1].prompt.match(/Prioritise maintainability\./g)).toHaveLength(1)
 expect(calls[1].prompt.indexOf('Agent A: (turn 1)')).toBeLessThan(calls[1].prompt.indexOf('You: (after turn 1)'))
 expect(calls[1].prompt).not.toContain('You:\nAgent a turn')
 expect(()=>JSON.parse(calls[1].prompt)).toThrow()
 const logged=db.prepare('SELECT prompt FROM hadron_continuous_turns ORDER BY ordinal').all()
 expect(logged.map((row:any)=>row.prompt)).toEqual(calls.map(call=>call.prompt))
})

it('sends pictures to both continuous agents and retains them after reopening and continuing the saved conversation',async()=>{
 service.start('owner',{...input(),images:[fixtureImage],maxTurns:2});await wait(()=>service.status('owner','conversation').workersEnded)
 expect(calls).toHaveLength(2);expect(calls.every(call=>call.images?.[0]?.dataUrl===fixtureImage.dataUrl)).toBe(true)
 const reopened=make();expect(reopened.status('owner','conversation').input.images).toEqual([fixtureImage])
 reopened.continueSaved('owner','conversation',{id:'continued',models:input().models,maxTurns:2,maxSeconds:60,instruction:'Check that picture again.'});await wait(()=>reopened.status('owner','continued').workersEnded)
 expect(calls.slice(2).every(call=>call.images?.[0]?.dataUrl===fixtureImage.dataUrl)).toBe(true);service=reopened
})
