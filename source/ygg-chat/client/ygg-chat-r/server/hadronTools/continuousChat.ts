import {CONTINUOUS_MEMORY_MAX_BYTES,continuousFailure,fitContinuousMemory,MEMORY_INSTRUCTION,similarRepeatedReplies} from './continuousMemory.js'
import {randomUUID} from 'node:crypto'
import {continuousPrompt,type ContinuousPromptPacket} from './continuousPrompt.js'
import {continuousInputContext} from './continuousInputContext.js'
import {consensusPacket,consensusReply,agreementCheckOffer,type ConsensusOffer} from './continuousConsensus.js'
import {CONTINUOUS_INPUT_MAX_BYTES,type ContinuousChatInput,type ContinuousChatView,type ContinuousChatHistory,type ContinuousContinuationInput} from '../../../../shared/continuousChat.js'
interface Database {exec(sql:string):unknown;prepare(sql:string):any;close():void}
export interface ContinuousBinding {runId:string;handle:string;streamId:string}
interface Control {promise:Promise<void>;controller?:AbortController;handle?:string;ended:boolean;uncertain?:boolean}
const bounded=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.trim()||Buffer.byteLength(value)>max)throw Error('Invalid continuous conversation text');return value}
/** Durable conversation scheduler. One reply or memory run per reserved ordinal; only
 * explicit 429/503 rejections receive bounded fresh-attempt recovery. No
 * auto-resume on restart, shell, edits or model delegation. Explicit read grants may supply bounded host file tools. */
import {parseHadronImages} from '../../../../shared/hadronImages.js'
import {parseHadronDocuments,type HadronDocument} from '../../../../shared/hadronDocuments.js'
import {admitHadronToolSession,type HadronToolSession} from './types.js'
import {withDocumentTools} from './documentTools.js'
/** Tools for one conversation turn. Keeps the document tool list in the instructions, and a turn that reports
 * "finished":false is still a valid contribution: the discussion continues, so it must not fail the conversation. */
export function continuousTurnToolSession(research:HadronToolSession,documents:readonly HadronDocument[]):HadronToolSession{
 const session=withDocumentTools(research,[...documents])
 let checked=false
 const evidenceTools=new Set(['web_search','web_read','project_search','project_read','document_search','document_read'])
 const reading=documents.length?'\nAttached documents: when the discussion concerns them, read the relevant sections with document_search and document_read in this turn before relying on earlier summaries, memory or peer claims, and cite page numbers.':''
 return admitHadronToolSession({...session,assessmentOnly:true,maxRequests:documents.length?24:8,requireEvidenceAttempt:true,evidenceAttempted:()=>checked,
  evidenceInstruction:'Check a relevant factual claim now using the granted web_search/web_read, document_search/document_read or project_search/project_read tool. Report unavailable or failed checks honestly; do not claim verification from a peer statement.',
  async invoke(name,args,signal){if(evidenceTools.has(name))checked=true;return session.invoke(name,args,signal)},
  instructions:session.instructions+'\nFor each debate or fact-checking contribution, attempt a relevant source check with the granted tools before answering, including on the final checking pass. Prefer primary sources, cite only URLs or file/page/line references actually consulted, distinguish facts from inference/opinion, and report failed checks or missing evidence honestly. Prior peer claims and working memory are not independent verification. Do not search private supplied text on the public web.'+reading+' Each reply is one turn of an ongoing discussion: return {"answer":"your contribution","finished":true} when your contribution for this turn is ready, even though the discussion continues. Never claim edits, test execution or verification beyond recorded results.'})
}
export class ContinuousChatService {
 private readonly instance=randomUUID()
 private readonly controls=new Map<string,Control>()
 private closing=false
 constructor(private readonly db:Database,private readonly deps:{
  authorize(owner:string,input:ContinuousChatInput):void;allowedModels:ReadonlySet<string>;
  authorizeRead?(owner:string,input:ContinuousChatInput):void;
  admitModel?(provider:'openaichatgpt'|'claudecode',model:string):boolean;
  generate(owner:string,input:ContinuousChatInput,role:'a'|'b',prompt:string,signal:AbortSignal,onPrepared:(binding:ContinuousBinding)=>void,packet:ContinuousPromptPacket):Promise<{text:string;binding:ContinuousBinding}>;
  cancel(handle:string):void;join(handle:string):Promise<void>;
  waitForRetry?(milliseconds:number,signal:AbortSignal):Promise<void>;
  checkpoint?(owner:string,input:ContinuousChatInput,role:'a'|'b',ordinal:number,text:string,state:string,runId:string|null):void;
 }){
  if(![2,3].includes(Number(db.prepare('PRAGMA synchronous').get()?.synchronous)))throw Error('Continuous conversation requires durable SQLite')
  db.exec(`CREATE TABLE IF NOT EXISTS hadron_continuous_sessions (
   id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,workspace_id TEXT NOT NULL,instance_id TEXT NOT NULL,
   config_json TEXT NOT NULL,state TEXT NOT NULL,reason TEXT,revision INTEGER NOT NULL DEFAULT 0,deadline INTEGER NOT NULL);
   CREATE UNIQUE INDEX IF NOT EXISTS hadron_continuous_active_workspace ON hadron_continuous_sessions(workspace_id) WHERE state IN ('running','pause_requested','stop_requested');
   CREATE TABLE IF NOT EXISTS hadron_continuous_turns (
   session_id TEXT NOT NULL REFERENCES hadron_continuous_sessions(id),ordinal INTEGER NOT NULL,role TEXT NOT NULL,
   prompt TEXT NOT NULL,state TEXT NOT NULL,text TEXT,run_id TEXT UNIQUE,handle TEXT,stream_id TEXT,PRIMARY KEY(session_id,ordinal));
   CREATE TABLE IF NOT EXISTS hadron_continuous_messages (
   id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES hadron_continuous_sessions(id),after_turn INTEGER NOT NULL,text TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS hadron_continuous_context (
   session_id TEXT PRIMARY KEY REFERENCES hadron_continuous_sessions(id),source_id TEXT NOT NULL REFERENCES hadron_continuous_sessions(id),context_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS hadron_continuous_memory (session_id TEXT PRIMARY KEY REFERENCES hadron_continuous_sessions(id),through_turn INTEGER NOT NULL,text TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS hadron_continuous_input_memory (session_id TEXT NOT NULL REFERENCES hadron_continuous_sessions(id) ON DELETE CASCADE,source_key TEXT NOT NULL,through_character INTEGER NOT NULL,text TEXT NOT NULL,PRIMARY KEY(session_id,source_key));
   CREATE TABLE IF NOT EXISTS hadron_continuous_documents (session_id TEXT NOT NULL REFERENCES hadron_continuous_sessions(id) ON DELETE CASCADE,part INTEGER NOT NULL,name TEXT NOT NULL,text TEXT NOT NULL,PRIMARY KEY(session_id,part));
   CREATE TABLE IF NOT EXISTS hadron_continuous_folder_activity (session_id TEXT NOT NULL REFERENCES hadron_continuous_sessions(id),time TEXT NOT NULL,tool TEXT NOT NULL,state TEXT NOT NULL);
   UPDATE hadron_continuous_sessions SET state='needs_recovery',reason='interrupted_host',revision=revision+1 WHERE state IN ('running','pause_requested','stop_requested');`)
  if(!db.prepare('PRAGMA table_info(hadron_continuous_turns)').all().some((column:any)=>column.name==='kind'))db.exec("ALTER TABLE hadron_continuous_turns ADD COLUMN kind TEXT NOT NULL DEFAULT 'reply'")
  if(!db.prepare('PRAGMA table_info(hadron_continuous_turns)').all().some((column:any)=>column.name==='error_code'))db.exec('ALTER TABLE hadron_continuous_turns ADD COLUMN error_code TEXT')
  if(!db.prepare('PRAGMA table_info(hadron_continuous_turns)').all().some((column:any)=>column.name==='consensus_token'))db.exec('ALTER TABLE hadron_continuous_turns ADD COLUMN consensus_token TEXT')
 }
 private input(value:ContinuousChatInput){
  if(!value||!Number.isSafeInteger(value.maxTurns)||value.maxTurns<1||value.maxTurns>100||!Number.isSafeInteger(value.maxSeconds)||value.maxSeconds<10||value.maxSeconds>3600)throw Error('Choose 1–100 turns and 10–3600 seconds')
  if(value.providers&&(!['openaichatgpt','claudecode'].includes(value.providers.a)||!['openaichatgpt','claudecode'].includes(value.providers.b)))throw Error('Unsupported conversation provider')
  return {...(value.images!==undefined?{images:parseHadronImages(value.images)}:{}),id:bounded(value.id,128),workspaceId:bounded(value.workspaceId,128),anchorMessageId:bounded(value.anchorMessageId,128),goal:bounded(value.goal,CONTINUOUS_INPUT_MAX_BYTES),models:{a:bounded(value.models?.a,128),b:bounded(value.models?.b,128)},maxTurns:value.maxTurns,maxSeconds:value.maxSeconds,
   ...(value.projectGrantId?{projectGrantId:bounded(value.projectGrantId,128)}:{}),...(value.providers?{providers:{a:value.providers.a,b:value.providers.b}}:{}),...(value.continuationOf?{continuationOf:bounded(value.continuationOf,128)}:{}),...(value.continuationInstruction?{continuationInstruction:bounded(value.continuationInstruction,CONTINUOUS_INPUT_MAX_BYTES)}:{})}
 }
 private admitted(input:ContinuousChatInput,role:'a'|'b'){const provider=input.providers?.[role]??'openaichatgpt';return this.deps.admitModel?this.deps.admitModel(provider,input.models[role]):provider==='openaichatgpt'&&this.deps.allowedModels.has(input.models[role])}
 private owned(owner:string,id:string){
  const row=this.db.prepare('SELECT * FROM hadron_continuous_sessions WHERE id=? AND owner_id=?').get(id,owner)
  if(!row)throw Error('Continuous conversation unavailable')
  const input=this.input(JSON.parse(row.config_json));this.deps.authorize(owner,input)
  return {row,input}
 }
 private state(id:string,state:string,reason:string|null=null){this.db.prepare('UPDATE hadron_continuous_sessions SET state=?,reason=?,revision=revision+1 WHERE id=?').run(state,reason,id)}
 start(owner:string,raw:ContinuousChatInput):ContinuousChatView{
  if(raw?.continuationOf||raw?.continuationInstruction)throw Error('Use the saved-conversation continuation action')
  return this.create(owner,this.input(raw),undefined,raw.documents===undefined?[]:parseHadronDocuments(raw.documents))
 }
 /** Large attached documents for the conversation's document tools. Kept out of config_json so status polls stay small. */
 documents(id:string):HadronDocument[]{
  return this.db.prepare('SELECT name,text FROM hadron_continuous_documents WHERE session_id=? ORDER BY part').all(id).map((row:any)=>({name:row.name,text:row.text}))
 }
 private history(id:string):ContinuousChatHistory|undefined{
  const context=this.db.prepare('SELECT context_json FROM hadron_continuous_context WHERE session_id=?').get(id)
  return context?JSON.parse(context.context_json):undefined
 }
 continueSaved(owner:string,sourceId:string,raw:ContinuousContinuationInput):ContinuousChatView{
  const {row,input:source}=this.owned(owner,sourceId)
  const input=this.input({...source,images:raw.images??source.images,projectGrantId:raw.projectGrantId,id:raw.id,models:raw.models,providers:raw.providers??source.providers,maxTurns:raw.maxTurns,maxSeconds:raw.maxSeconds,continuationOf:sourceId,continuationInstruction:raw.instruction?.trim()||undefined})
  // A retried UI handoff checks the existing child; it never dispatches twice.
  const documents=raw.documents===undefined?this.documents(sourceId):parseHadronDocuments(raw.documents)
  if(this.db.prepare('SELECT 1 FROM hadron_continuous_sessions WHERE id=?').get(input.id))return this.create(owner,input,undefined,documents)
  if(['running','pause_requested','stop_requested'].includes(row.state)||this.controls.get(sourceId)?.ended===false)throw Error('Stop the source conversation and wait for its worker before continuing')
  const prior=this.status(owner,sourceId),completed=prior.turns.filter(turn=>turn.state==='completed'&&turn.kind!=='memory'&&turn.text!==null),base=prior.history
  const history:ContinuousChatHistory={sourceId,memory:prior.memory,turns:[...(base?.turns??[]),...completed.map(turn=>({role:turn.role,text:turn.text!,provider:source.providers?.[turn.role]??'openaichatgpt' as const,model:source.models[turn.role]}))],
   messages:[...(base?.messages??[]),...prior.messages.map(message=>({afterTurn:(base?.turns.length??0)+completed.filter(turn=>turn.ordinal<=message.afterTurn).length,text:message.text}))]}
  if(!history.turns.length)throw Error('There are no completed replies to continue. Start a new conversation instead.')
  return this.create(owner,input,history,documents)
 }
 private create(owner:string,input:ContinuousChatInput,history?:ContinuousChatHistory,documents:HadronDocument[]=[]):ContinuousChatView{
  if(this.closing)throw Error('Conversations are closing')
  this.deps.authorize(owner,input)
  if(!this.admitted(input,'a')||!this.admitted(input,'b'))throw Error('Choose connected supported models')
  const prior=this.db.prepare('SELECT owner_id,config_json FROM hadron_continuous_sessions WHERE id=?').get(input.id)
  if(prior){if(prior.owner_id!==owner||prior.config_json!==JSON.stringify(input))throw Error('Conversation identity already used');return this.status(owner,input.id)}
  if(input.projectGrantId){if(!this.deps.authorizeRead)throw Error('Folder reading is unavailable');this.deps.authorizeRead(owner,input)}
  if(input.continuationOf&&!history)throw Error('Saved continuation history is required')
  this.db.exec('BEGIN IMMEDIATE')
  try{
   this.db.prepare("INSERT INTO hadron_continuous_sessions(id,owner_id,workspace_id,instance_id,config_json,state,deadline) VALUES (?,?,?,?,?,'running',?)").run(input.id,owner,input.workspaceId,this.instance,JSON.stringify(input),Date.now()+input.maxSeconds*1000)
   documents.forEach((document,part)=>this.db.prepare('INSERT INTO hadron_continuous_documents(session_id,part,name,text) VALUES (?,?,?,?)').run(input.id,part,document.name,document.text))
   if(history)this.db.prepare('INSERT INTO hadron_continuous_context(session_id,source_id,context_json) VALUES (?,?,?)').run(input.id,history.sourceId,JSON.stringify(history))
   if(input.continuationInstruction)this.db.prepare('INSERT INTO hadron_continuous_messages(id,session_id,after_turn,text) VALUES (?,?,0,?)').run(input.id+':continuation',input.id,input.continuationInstruction)
   this.db.exec('COMMIT')
  }catch(error){this.db.exec('ROLLBACK');throw error}
  try{for(const role of ['a','b'] as const)this.deps.checkpoint?.(owner,input,role,0,'','prepared',null)}catch(error){this.state(input.id,'needs_recovery','journal_unavailable');throw error}
  this.launch(owner,input.id)
  return this.status(owner,input.id)
 }
 private memory(id:string){
  const row=this.db.prepare('SELECT through_turn AS throughTurn,text FROM hadron_continuous_memory WHERE session_id=?').get(id)
  return row??this.history(id)?.memory
 }
 private launch(owner:string,id:string){
  const control:Control={promise:Promise.resolve(),ended:false};this.controls.set(id,control)
  control.promise=this.loop(owner,id,control)
  void control.promise.catch(()=>{})
 }
 private async loop(owner:string,id:string,control:Control){
  try{
   while(true){
    // Commit each terminal response before yielding; Pause/Stop can interpose.
    await new Promise<void>(resolve=>setImmediate(resolve))
    const {row,input}=this.owned(owner,id)
    if(row.state==='stop_requested'||this.closing){this.state(id,'stopped','stopped_by_user');return}
    if(row.state==='pause_requested'){this.state(id,'paused','paused_by_user');return}
    if(row.state!=='running')return
    const turns=this.status(owner,id).turns,completed=turns.filter(turn=>turn.state==='completed'&&turn.kind!=='memory')
    // Internal memory summaries do not consume the user's conversation turns.
    if(turns.filter(turn=>turn.kind!=='memory').length>=input.maxTurns){this.state(id,'paused','turn_budget');return}
    if(Date.now()>=row.deadline){this.state(id,'paused','time_budget');return}
    if(completed.length>=4&&completed.at(-1)?.text===completed.at(-3)?.text&&completed.at(-2)?.text===completed.at(-4)?.text){this.state(id,'paused','repeated_replies');return}
    if(similarRepeatedReplies(completed)&&!this.status(owner,id).messages.some(message=>message.afterTurn>=(completed.at(-6)?.ordinal??0))){this.state(id,'paused','similar_replies');return}
    const history=this.history(id),base=history?.turns??[],last=completed.at(-1)??base.at(-1)
    const ordinal=turns.length+1,role=last?.role==='a'?'b':'a',messages=this.status(owner,id).messages
    const prior=completed.at(-1)
    const priorToken=prior&&this.db.prepare('SELECT consensus_token AS token FROM hadron_continuous_turns WHERE session_id=? AND ordinal=?').get(id,prior.ordinal)?.token
    const peer:ConsensusOffer|undefined=prior&&priorToken&&prior.role!==role&&!messages.some(message=>message.afterTurn>=prior.ordinal)?{token:priorToken,ordinal:prior.ordinal,role:prior.role,text:prior.text!}:undefined
    const consensusToken=randomUUID()
    const participants={a:{provider:input.providers?.a??'openaichatgpt',model:input.models.a},b:{provider:input.providers?.b??'openaichatgpt',model:input.models.b}}
    const all=[...base,...completed.map(turn=>({...turn,...participants[turn.role]}))],memory=this.memory(id),through=memory?.throughTurn??0
    const remaining=all.length-through
    // Summarise five older replies at a time, keeping at least two recent replies verbatim.
    // Oversized historical continuations are processed in smaller bounded batches.
    let compact=!peer&&(remaining>=7||(remaining>=3&&Buffer.byteLength(JSON.stringify(all.slice(through)))>36000))
    let target=through,packet:ContinuousPromptPacket
    const userMessages=[...(history?.messages??[]),...messages.map(message=>({id:message.id,afterTurn:base.length+completed.filter(turn=>turn.ordinal<=message.afterTurn).length,text:message.text}))]
    if(compact){
     const older:ContinuousPromptPacket['transcript']=[]
     for(let index=through;index<Math.min(through+5,all.length-2);index++){
      const candidate={turn:index+1,speaker:all[index].role,text:all[index].text!,provider:all[index].provider,model:all[index].model}
      if(Buffer.byteLength(JSON.stringify([...older,candidate]))>36000)break
      older.push(candidate);target=index+1
     }
     if(!older.length){this.state(id,'paused','context_budget');return}
     packet={kind:'continuous_memory',instruction:MEMORY_INSTRUCTION,goal:input.goal,previousMemory:memory??null,transcript:older,userMessages}
    }else packet={kind:'continuous_conversation',goal:input.goal,speaker:role,turn:all.length+1,memory:memory??null,consensus:consensusPacket(consensusToken,peer),
      transcript:all.slice(through).map((turn,index)=>({turn:through+index+1,speaker:turn.role,text:turn.text,provider:turn.provider,model:turn.model})),userMessages}
    packet.participants=participants
    const projected=continuousInputContext(packet,key=>this.db.prepare('SELECT through_character AS through,text FROM hadron_continuous_input_memory WHERE session_id=? AND source_key=?').get(id,key))
    packet=projected.packet
    if(projected.part)compact=true
    const prompt=continuousPrompt(packet)
    if(Buffer.byteLength(prompt)>64000){this.state(id,'paused','context_budget');return}
    if(!this.admitted(input,role))throw Error('Model no longer available')
    this.db.prepare("INSERT INTO hadron_continuous_turns(session_id,ordinal,role,prompt,state,kind) VALUES (?,?,?,?,'reserved',?)").run(id,ordinal,role,prompt,compact?'memory':'reply')
    control.controller=new AbortController();let binding:ContinuousBinding|undefined
    const timer=setTimeout(()=>control.controller?.abort(),Math.max(1,Math.min(120000,row.deadline-Date.now())))
    let retry=false
    try{
     const result=await this.deps.generate(owner,input,role,prompt,control.controller.signal,prepared=>{
      if(binding||!prepared.handle||!prepared.runId||!prepared.streamId||control.controller!.signal.aborted||this.owned(owner,id).row.state==='stop_requested')throw Error('Conversation admission closed')
      binding={...prepared};control.handle=prepared.handle
      this.db.prepare("UPDATE hadron_continuous_turns SET run_id=?,handle=?,stream_id=?,state='bound' WHERE session_id=? AND ordinal=? AND state='reserved'").run(prepared.runId,prepared.handle,prepared.streamId,id,ordinal)
      this.deps.checkpoint?.(owner,input,role,ordinal,'','bound',prepared.runId)
     },packet)
     if(!binding||result.binding.handle!==binding.handle||result.binding.runId!==binding.runId||result.binding.streamId!==binding.streamId)throw Error('Conversation result binding changed')
     const parsed=compact?{text:result.text,proposed:false,confirmed:false}:consensusReply(result.text,consensusToken,peer)
     // A new user instruction received while the peer was thinking invalidates
     // that confirmation. It must be considered by a subsequent turn.
     const fresh=!this.status(owner,id).messages.some(message=>message.afterTurn>=(prior?.ordinal??ordinal))
     const finalCheck=!!peer&&!compact&&fresh
     const confirmed=parsed.confirmed&&fresh
     const response=compact
      ?bounded(fitContinuousMemory(parsed.text),CONTINUOUS_MEMORY_MAX_BYTES)
      :bounded(parsed.text+(confirmed?'\n\nConsensus reached — both agents agree on this conclusion.':finalCheck?'\n\nDiscussion paused after one final checking pass. Agreement was not confirmed; see the remaining concerns above.':''),12000)
     if(control.controller.signal.aborted)throw Error('Conversation turn stopped')
     this.db.exec('BEGIN IMMEDIATE')
     try{
     this.db.prepare("UPDATE hadron_continuous_turns SET state='completed',text=? WHERE session_id=? AND ordinal=? AND state='bound'").run(response,id,ordinal)
      if(!compact&&(parsed.proposed||agreementCheckOffer(parsed.text)))this.db.prepare('UPDATE hadron_continuous_turns SET consensus_token=? WHERE session_id=? AND ordinal=?').run(consensusToken,id,ordinal)
      if(projected.part)this.db.prepare('INSERT INTO hadron_continuous_input_memory(session_id,source_key,through_character,text) VALUES (?,?,?,?) ON CONFLICT(session_id,source_key) DO UPDATE SET through_character=excluded.through_character,text=excluded.text').run(id,projected.part.key,projected.part.to,response)
      else if(compact)this.db.prepare('INSERT INTO hadron_continuous_memory(session_id,through_turn,text) VALUES (?,?,?) ON CONFLICT(session_id) DO UPDATE SET through_turn=excluded.through_turn,text=excluded.text').run(id,target,response)
      this.db.exec('COMMIT')
     }catch(error){this.db.exec('ROLLBACK');throw error}
     this.deps.checkpoint?.(owner,input,role,ordinal,response,'completed',binding.runId)
     this.db.prepare('UPDATE hadron_continuous_sessions SET revision=revision+1 WHERE id=?').run(id)
     if(finalCheck&&this.owned(owner,id).row.state==='running')this.state(id,'paused',confirmed?'consensus_reached':'final_check_complete')
    }catch(error){
     const code=error instanceof Error?/^Hadron ChatGPT temporarily unavailable \[(upstream_http_(?:503|429))\]$/.exec(error.message)?.[1]:undefined
     const failureCode=code??continuousFailure(error,control.controller.signal.aborted)
     this.db.prepare("UPDATE hadron_continuous_turns SET state='failed',error_code=? WHERE session_id=? AND ordinal=? AND state!='completed'").run(failureCode,id,ordinal)
     const requested=this.owned(owner,id).row.state
     const failuresSinceReply=turns.slice(completed.at(-1)?.ordinal??0).length
     const totalRecoveries=turns.filter(turn=>['upstream_http_503','upstream_http_429'].includes(turn.errorCode??'')).length
     retry=!!code&&!control.controller.signal.aborted&&!this.closing&&requested==='running'&&failuresSinceReply<2&&totalRecoveries<6&&turns.filter(turn=>turn.kind!=='memory').length+(compact?0:1)<input.maxTurns&&Date.now()+3000<row.deadline
     this.state(id,retry?'running':requested==='stop_requested'||this.closing?'stopped':'failed',retry?'retrying_temporary_rejection':requested==='stop_requested'?'stopped_by_user':failureCode)
     if(!retry)return
    }finally{
     clearTimeout(timer);control.controller.abort()
     // Deliberate: an unconfirmed worker join must override any earlier outcome so no successor starts.
     // eslint-disable-next-line no-unsafe-finally
     if(control.handle){this.deps.cancel(control.handle);try{await this.deps.join(control.handle)}catch(error){control.uncertain=true;throw error}}
     control.handle=undefined;control.controller=undefined
    }
    if(retry&&this.owned(owner,id).row.state==='running'&&!this.closing){
     control.controller=new AbortController()
     const delay=Math.min(10000,3000*(turns.slice(completed.at(-1)?.ordinal??0).length+1))
     try{
      if(this.deps.waitForRetry)await this.deps.waitForRetry(delay,control.controller.signal)
      else await new Promise<void>(resolve=>{const signal=control.controller!.signal;const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve()};const timer=setTimeout(done,delay);signal.addEventListener('abort',done,{once:true});if(signal.aborted)done()})
     }finally{control.controller=undefined}
     const current=this.owned(owner,id).row
     if(current.state==='running')this.state(id,'running')
    }
   }
  }catch{
   try{this.state(id,'needs_recovery','storage_or_worker_failure')}catch{/* Preserve durable reserved/bound record. */}
  }finally{control.ended=!control.uncertain}
 }
 status(owner:string,id:string):ContinuousChatView{
  const {row,input}=this.owned(owner,id),control=this.controls.get(id)
  return {id,input,folderActivity:this.db.prepare('SELECT time,tool,state FROM hadron_continuous_folder_activity WHERE session_id=? ORDER BY rowid DESC LIMIT 200').all(id).reverse(),memory:this.memory(id),history:this.history(id),state:row.state,reason:row.reason,revision:row.revision,currentHost:row.instance_id===this.instance&&!!control,workersEnded:control?.ended??row.instance_id===this.instance,
   canResume:!this.closing&&row.instance_id===this.instance&&['paused','failed'].includes(row.state)&&!!control?.ended,
   turns:this.db.prepare('SELECT ordinal,role,state,text,kind,run_id AS runId,error_code AS errorCode FROM hadron_continuous_turns WHERE session_id=? ORDER BY ordinal').all(id),
   messages:this.db.prepare('SELECT id,after_turn AS afterTurn,text FROM hadron_continuous_messages WHERE session_id=? ORDER BY rowid').all(id)}
 }
 recordFolder(owner:string,id:string,tool:string,state:string){
  this.owned(owner,id)
  this.db.prepare('INSERT INTO hadron_continuous_folder_activity(session_id,time,tool,state) VALUES (?,?,?,?)').run(id,new Date().toISOString(),tool,state)
 }
 archiveIds(owner:string,workspace:string){const rows=this.db.prepare('SELECT id FROM hadron_continuous_sessions WHERE owner_id=? AND workspace_id=? ORDER BY rowid LIMIT 10001').all(owner,workspace) as Array<{id:string}>;if(rows.length>10000)throw Error('Too many conversations to archive');return rows.map(row=>row.id)}
 list(owner:string,workspace:string){
  return (this.db.prepare('SELECT id FROM hadron_continuous_sessions WHERE owner_id=? AND workspace_id=? ORDER BY rowid DESC LIMIT 100').all(owner,workspace) as Array<{id:string}>).map(({id})=>{const view=this.status(owner,id);return {id,goal:view.input.goal,state:view.state}})
 }
 check(owner:string,workspace:string,id:string){
  const row=this.db.prepare('SELECT owner_id,workspace_id FROM hadron_continuous_sessions WHERE id=?').get(id)
  if(!row)return null
  if(row.owner_id!==owner||row.workspace_id!==workspace)throw Error('Continuous conversation unavailable')
  return this.status(owner,id)
 }
 pause(owner:string,id:string){const {row}=this.owned(owner,id);if(row.state==='running')this.state(id,'pause_requested');return this.status(owner,id)}
 async stop(owner:string,id:string){
  const {row}=this.owned(owner,id),control=this.controls.get(id)
  if(row.instance_id!==this.instance||!control)throw Error('Historical conversation is inspection-only')
  if(!control.ended){this.state(id,'stop_requested');control.controller?.abort();if(control.handle)this.deps.cancel(control.handle);await control.promise}
  else this.state(id,'stopped','stopped_by_user')
  return this.status(owner,id)
 }
 resume(owner:string,id:string,revision:number,extraTurns:number){
  const {row,input}=this.owned(owner,id),view=this.status(owner,id)
  if(!view.canResume||revision!==row.revision||!Number.isSafeInteger(extraTurns)||extraTurns<0||extraTurns>100||input.maxTurns+extraTurns>100)throw Error('Resume requires the current paused revision and a total budget up to100 turns')
  if(input.projectGrantId)this.deps.authorizeRead?.(owner,input)
  const next={...input,maxTurns:input.maxTurns+extraTurns}
  if(view.turns.filter(turn=>turn.kind!=='memory').length>=next.maxTurns)throw Error('Extend the turn budget before resuming')
  this.db.prepare("UPDATE hadron_continuous_sessions SET config_json=?,state='running',reason=NULL,deadline=?,revision=revision+1 WHERE id=?").run(JSON.stringify(next),Date.now()+input.maxSeconds*1000,id)
  this.launch(owner,id);return this.status(owner,id)
 }
 inject(owner:string,id:string,messageId:string,text:string){
  const {row}=this.owned(owner,id);bounded(messageId,128);bounded(text,CONTINUOUS_INPUT_MAX_BYTES)
  if(row.instance_id!==this.instance||!['running','paused','pause_requested'].includes(row.state))throw Error('This conversation cannot accept a message')
  const prior=this.db.prepare('SELECT session_id,text FROM hadron_continuous_messages WHERE id=?').get(messageId)
  if(prior){if(prior.session_id!==id||prior.text!==text)throw Error('Message identity conflict');return this.status(owner,id)}
  if(this.status(owner,id).messages.length>=20)throw Error('Message limit reached')
  const last=this.db.prepare('SELECT COALESCE(MAX(ordinal),0) AS ordinal FROM hadron_continuous_turns WHERE session_id=?').get(id).ordinal
  this.db.prepare('INSERT INTO hadron_continuous_messages(id,session_id,after_turn,text) VALUES (?,?,?,?)').run(messageId,id,last,text)
  return this.status(owner,id)
 }
 ownsRun(id:string){return !!this.db.prepare('SELECT 1 FROM hadron_continuous_turns WHERE run_id=?').get(id)}
 stopAll(){for(const [id,control] of this.controls)if(!control.ended){this.state(id,'stop_requested');control.controller?.abort();if(control.handle)this.deps.cancel(control.handle)}}
 beginShutdown(){this.closing=true;this.stopAll()}
 async shutdown(){this.beginShutdown();await Promise.allSettled([...this.controls.values()].map(control=>control.promise));this.db.close()}
}
export const desktopContinuousHost={service:undefined as ContinuousChatService|undefined,install(service:ContinuousChatService){if(this.service)throw Error('Continuous host already installed');this.service=service},get(){if(!this.service)throw Error('Continuous conversation unavailable');return this.service},async shutdown(){const service=this.service;this.service=undefined;if(service)await service.shutdown()}}
