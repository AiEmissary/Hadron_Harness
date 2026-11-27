import {CODEX_FAILURE_REASONS} from '../../../auth/hadronCodexRuntime.js'
import {CLAUDE_FAILURE_REASONS} from '../../providers/claudeCodeRuntime.js'
import { admittedHadronModel, type HadronProvider } from '../../../../../../shared/hadronProviders.js'
import { parseProposalSession, type ProposalSessionInput, type ProposalSessionStatus, type ProposalSessionPage, type ProposalTranscript } from '../../../../../../shared/collaboration.js'
import type { CollaborationRepo } from '../../persistence/collaborationRepo.js'
import type { MessageRepo } from '../../persistence/messageRepo.js'
import type { LineageRepo } from '../../persistence/lineageRepo.js'
import type { SubagentRunRepo } from '../../persistence/subagentRunRepo.js'
import type { SubagentRunService } from '../subagentRunService.js'
import { ProposalSpike } from './proposalSpike.js'
import { proposalHash, publishProposalCheckpoints, type ProposalCheckpoint } from './proposalCheckpoints.js'
import type { AgentJobJournal } from './agentJobJournal.js'
import { freezeSharedContinuation, readProposalConfig } from './sharedContinuation.js'
import { CollaborationReview } from './collaborationReview.js'
import {withHadronToolDeadline,withHadronAssessment} from '../../../hadronTools/types.js'
import {hadronTimeFailure} from './timeFailure.js'
import {hadronAgentOutcomeFailure,hadronOutcomeNeedsUser,HADRON_READ_ONLY_UNFINISHED,HADRON_LEGACY_AGENT_INCOMPLETE} from '../../../../../../shared/hadronWorkOutcome.js'

export interface ProposalSessionDeps {
  sessions: CollaborationRepo
  agents: SubagentRunService
  messages: MessageRepo
  lineages: LineageRepo
  runs: SubagentRunRepo
  /** Explicit server-controlled snapshot. No default model/provider substitution. */
  allowedModels: ReadonlySet<string>; admitModel?(provider:HadronProvider,model:string):boolean
  /** Server policy: whole-session deadline, including preparation. Default two minutes. */
  deadlineMs?: number
  /** Existing authenticated owner/workspace access check; must throw on denial. */
  authorizeConversation(ownerId: string, conversationId: string): void
  authorize(ownerId: string, input: ProposalSessionInput): void
  verificationSession?(owner: string, input: ProposalSessionInput, evidence: (tool: string, result: unknown) => void, authorize: () => void, onCheckAttempt: () => void): import('../../../hadronTools/types.js').HadronToolSession
  verificationActivity?(owner: string, input: ProposalSessionInput): Array<{ time: string; tool: string; state: string }>
  projectSession?(owner:string,input:ProposalSessionInput,stage:string,authorize:()=>void):import('../../../hadronTools/types.js').HadronToolSession
  projectActivity?(owner:string,input:ProposalSessionInput):Array<{time:string;tool:string;state:string}>
  researchSession?(owner:string,input:ProposalSessionInput,stage:string,authorize:()=>void):import('../../../hadronTools/types.js').HadronToolSession
  researchActivity?(owner:string,input:ProposalSessionInput):Array<{time:string;tool:string;state:string}>
  journal?: AgentJobJournal
  visibleProgress?(streamId: string): { text: string; truncated: boolean } | undefined
}

export class ProposalAccessDenied extends Error {
  constructor() { super('Access denied') }
}

/** Durable proposal admission, with explicit opt-in to bounded review and synthesis. */
export class ProposalSessionService {
  private readonly active = new Map<string, { ownerId: string; spike: ProposalSpike; review?: CollaborationReview; promise: Promise<ProposalCheckpoint[]> }>()
  private readonly journalErrors = new Set<string>()
  constructor(private readonly deps: ProposalSessionDeps) {}
  refreshJournals(ownerId: string, sessionId: string): void {
    try { this.checkpoint(ownerId, sessionId); this.journalErrors.delete(sessionId) } catch { this.journalErrors.add(sessionId) }
  }
  private checkpoint(ownerId: string, sessionId: string): void {
    if (!this.deps.journal) return
    const row = this.deps.sessions.get(sessionId, ownerId); if (!row) return
    const config = JSON.parse(row.config_json)
    for (const participant of this.deps.sessions.participants(sessionId, ownerId)) {
      const selection = config.participants.find((item: any) => item.id === participant.participant_id)
      const run = participant.run_id ? this.deps.runs.getRunById(participant.run_id) : null
      const progress = participant.stream_id ? this.deps.visibleProgress?.(participant.stream_id) : undefined
      this.deps.journal.checkpoint({ ownerId, jobId: sessionId, participantId: participant.participant_id, task: config.task, context: config.continuationSnapshot?.context ?? config.context,
        provider: selection.provider, modelName: selection.modelName, status: `${row.status} / ${run?.status ?? participant.status}`,
        revision: row.revision, runId: participant.run_id,...(config.projectGrantId?{toolMode:config.projectMode==='agent'&&participant.participant_id==='a'?'agent' as const:'project' as const}:this.deps.researchSession?{toolMode:'web' as const}:{}), text: run?.final_response || (progress?.text ? `${progress.truncated ? '[Retained stream excerpt; earlier text may be missing.]\n' : ''}${progress.text}` : '') })
    }
    const workflow = this.deps.sessions.workflow(sessionId, ownerId)
    if (workflow) for (const stage of this.deps.sessions.workflowRuns(sessionId, ownerId)) {
      const run = stage.run_id ? this.deps.runs.getRunById(stage.run_id) : null
      const progress = stage.stream_id ? this.deps.visibleProgress?.(stage.stream_id) : undefined
      this.deps.journal.checkpoint({ ownerId, jobId: sessionId, participantId: stage.stage_id,
        task: config.task, context: config.continuationSnapshot?.context ?? config.context, provider: config.participants.find((p:any)=>p.id===stage.participant_id)?.provider ?? 'openaichatgpt', modelName: stage.model_name,
        status: `${workflow.status} / ${stage.stage_id} / ${run?.status ?? 'reserved'}`,
        revision: row.revision + workflow.revision, runId: stage.run_id, ...(stage.stage_id === 'verification' ? { toolMode: 'web' as const } : stage.stage_id.startsWith('review_') ? config.projectGrantId?{toolMode:'project' as const}:this.deps.researchSession?{toolMode:'web' as const}:{} : {}), text: run?.final_response || progress?.text || '' })
    }
  }
  journal(ownerId: string, sessionId: string, participantId: string) {
    const status = this.status(ownerId, sessionId)
    if (!status || !this.deps.journal || (!status.participants.some(item => item.id === participantId) &&
      !status.collaboration?.stages.some(item => item.id === participantId))) return null
    this.checkpoint(ownerId, sessionId)
    return { schemaVersion: 1 as const, sessionId, participantId, ...this.deps.journal.read(ownerId, sessionId, participantId) }
  }

  private authorize(ownerId: string, input: ProposalSessionInput): void {
    try { this.deps.authorize(ownerId, input) }
    catch { throw new ProposalAccessDenied() }
  }

  list(ownerId: string, conversationId: string, limit = 20, before?: string): ProposalSessionPage {
    if (!ownerId || !conversationId || conversationId.length > 128 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      (before !== undefined && (!before || before.length > 128))) throw new Error('Invalid session page')
    try { this.deps.authorizeConversation(ownerId, conversationId) } catch { throw new ProposalAccessDenied() }
    const ids = this.deps.sessions.listIds(ownerId, conversationId, limit + 1, before)
    const sessions = ids.slice(0, limit).map(id => {
      const status = this.status(ownerId, id)!
      return { sessionId: status.sessionId, conversationId: status.conversationId, phase: status.phase,
        status: status.status, revision: status.revision,
        participants: status.participants.map(({ id, provider, modelName }) => ({ id, provider, modelName })) }
    })
    return { schemaVersion: 1, sessions, nextBefore: ids.length > limit ? ids[limit - 1] : null }
  }

  preflight(ownerId: string, raw: unknown) {
    const input = parseProposalSession(raw); this.authorize(ownerId, input)
    if(input.projectGrantId){if(!this.deps.projectSession)throw Error('Folder tools unavailable');this.deps.projectSession(ownerId,input,'preflight',()=>this.authorize(ownerId,input))}
    const snapshot = freezeSharedContinuation(this.deps, ownerId, input)
    return {schemaVersion:1 as const,contextChars:(snapshot?.context ?? input.context).length,contextLimit:16000}
  }

  tree(ownerId: string, conversationId: string) {
    if(!ownerId || !conversationId || conversationId.length>128)throw Error('Invalid shared tree')
    this.deps.authorizeConversation(ownerId,conversationId)
    const nodes: import('../../../../../../shared/independentJobs.js').AgentConversationNode[]=[]
    for(const id of this.deps.sessions.treeIds(ownerId,conversationId)){
      const row=this.deps.sessions.get(id,ownerId)!,input=readProposalConfig(JSON.parse(row.config_json));this.authorize(ownerId,input)
      const workflow=this.deps.sessions.workflow(id,ownerId),stage=this.deps.sessions.workflowRuns(id,ownerId).find(item=>item.stage_id==='final')
      const run=stage?.run_id?this.deps.runs.getRunById(stage.run_id):null
      const base={jobId:'shared:'+id,conversationId,provider:input.participants[0].provider,modelName:input.participants[0].modelName,status:workflow?.status??row.status}
      nodes.push({...base,id:'shared-task:'+id,parentId:input.parentSessionId?'shared-answer:'+input.parentSessionId:null,kind:'task',text:input.task})
      if(workflow?.status==='completed'&&run?.status==='completed'&&run.conversation_id===conversationId&&run.parent_message_id===row.anchor_message_id&&run.final_response)nodes.push({...base,id:'shared-answer:'+id,parentId:'shared-task:'+id,kind:'response',text:run.final_response})
    }
    const ids=new Set(nodes.map(node=>node.id));for(const node of nodes)if(node.parentId&&!ids.has(node.parentId))node.parentId=null
    return {schemaVersion:1 as const,conversationId,nodes}
  }

  /** Re-check current conversation/workspace access on every read. */
  status(ownerId: string, sessionId: string): ProposalSessionStatus | null {
    const row = this.deps.sessions.get(sessionId, ownerId)
    if (!row) return null
    const config = JSON.parse(row.config_json)
    if (!Number.isSafeInteger(config.limits?.deadlineMs) || config.limits.deadlineMs < 1 ||
      config.limits.deadlineMs > 600_000 || config.limits.maxRequestsPerParticipant !== 1) {
      throw new Error('Stored proposal limits require explicit recovery')
    }
    const input = readProposalConfig(config)
    this.authorize(ownerId, input)
    const participants = this.deps.sessions.participants(sessionId, ownerId)
    const workflow = this.deps.sessions.workflow(sessionId, ownerId)
    const researchFailure=participants.find(participant=>{
      const run=participant.run_id?this.deps.runs.getRunById(participant.run_id):null
      return run?.status==='error'&&/request budget|tool request limit|tool conversation context limit/i.test(run.error??'')
    })
    const failedStage=workflow?.status==='failed'?this.deps.sessions.workflowRuns(sessionId,ownerId).find(stage=>stage.run_id&&this.deps.runs.getRunById(stage.run_id)?.status==='error'):undefined
    const failedParticipant=failedStage??participants.find(participant=>participant.run_id&&this.deps.runs.getRunById(participant.run_id)?.status==='error')
    const failedSelection=failedParticipant&&input.participants.find(item=>item.id===failedParticipant.participant_id)
    const claudeSignIn=failedSelection?.provider==='claudecode'&&failedParticipant?.run_id&&this.deps.runs.getRunById(failedParticipant.run_id)?.error?.startsWith('Claude sign-in has expired or could not be refreshed.')
    const failedRun=failedParticipant?.run_id?this.deps.runs.getRunById(failedParticipant.run_id):null
    const failedRunError=failedRun?.error??''
    const workIncomplete=hadronAgentOutcomeFailure(failedRunError)
    const failureReason=workIncomplete??hadronTimeFailure(failedRunError,failedRun?.created_at,failedRun?.updated_at)??Object.values(failedSelection?.provider==='claudecode'?CLAUDE_FAILURE_REASONS:CODEX_FAILURE_REASONS).find(reason=>failedRunError.startsWith(reason))
    const failedPhase=failedStage?.stage_id.startsWith('review_')?'review':failedStage?.stage_id==='verification'?'verification':failedStage?.stage_id==='final'?'combined answer':'reply'
    const stoppedPeers=participants.filter(participant=>participant.participant_id!==failedParticipant?.participant_id&&participant.run_id&&this.deps.runs.getRunById(participant.run_id)?.status==='aborted')
    const needsUser=hadronOutcomeNeedsUser(workIncomplete)
    // Older saved records: in a read-only run an "unfinished" proposal only meant the requested edits were outside that run's access.
    const readOnlyRun=input.projectMode!=='agent'&&!failedStage&&(workIncomplete===HADRON_READ_ONLY_UNFINISHED||
      workIncomplete===HADRON_LEGACY_AGENT_INCOMPLETE&&!(failedRun?.final_response??'').startsWith('Not finished'))
    const peers=stoppedPeers.map(peer=>'Agent '+peer.participant_id.toUpperCase()).join(' and ')
    const peerNote=!stoppedPeers.length?'':workIncomplete?` ${peers} ${stoppedPeers.length>1?'were':'was'} stopped only because a combined answer needs every agent's part; ${stoppedPeers.length>1?'they':'it'} did not fail.`:` ${peers} ${stoppedPeers.length>1?'were':'was'} stopped when the shared task failed.`
    const who=failedSelection?`Agent ${failedSelection.id.toUpperCase()} (${failedSelection.provider==='claudecode'?'Claude':'ChatGPT'})`:''
    const participantFailure=!failedSelection?undefined:readOnlyRun
      ?`${who} answered, but reported that the request needs file edits or tests this read-only Work together run cannot do, so Hadron stopped the run. This is a permissions mismatch, not a provider error, and nothing is needed from you to fix it. To have the changes made, start the request again with coding (Agent) mode on.${peerNote} Your question and each agent's saved reply are kept; no combined answer was produced.`
      :`${who} ${needsUser?'is waiting for you.':workIncomplete?'did not finish its part of the shared task.':claudeSignIn?'needs you to reconnect Claude because its sign-in expired or could not be refreshed. Open the chat setup pop-up and reconnect Claude.':`could not complete its ${failedPhase}.`}${failureReason?' '+(workIncomplete?'':'Reason: ')+failureReason:''}${peerNote} Your question is saved; no combined answer was produced.`
    return { schemaVersion: 1, sessionId, conversationId: row.conversation_id,
      ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
      phase: 'independent_proposals', status: workflow?.status ?? row.status, revision: row.revision + (workflow?.revision ?? 0),
      limits: { deadlineMs: config.limits.deadlineMs, maxRequestsPerParticipant: 1 },
      participants: input.participants.map(selection => {
        const participant = participants.find(p => p.participant_id === selection.id)!
        const run = participant.run_id ? this.deps.runs.getRunById(participant.run_id) : null
        return { ...selection, status: run?.status ?? participant.status,
          runId: participant.run_id, streamId: participant.stream_id }
      }),
      artifacts: (JSON.parse(row.checkpoints_json ?? '[]') as ProposalCheckpoint[]).map(checkpoint =>
        ({ ...checkpoint, kind: 'proposal', verified: false })), error: researchFailure?`Agent ${researchFailure.participant_id.toUpperCase()} reached Hadron’s research limit before returning a final answer. The collaboration stopped before review. Saved folder activity and job logs remain available; this is not a sign-in or folder-permission error.`:participantFailure??(row.error==='Proposal deadline exceeded'?'Work together reached Hadron’s task time limit. Available work is saved; no complete combined answer was produced.':workflow?.error ?? row.error),
      ...(workflow ? { collaboration: { phase: workflow.phase === 'reviews' && this.deps.sessions.workflowRuns(sessionId, ownerId).some(stage => stage.stage_id === 'verification' && stage.run_id) ? 'verification' as const : workflow.phase, maxRequests: input.workflow === 'review_verify_and_synthesis' ? 13 as const : 5 as const,
        researchLimited:[...participants.map(item=>item.run_id),...this.deps.sessions.workflowRuns(sessionId,ownerId).map(item=>item.run_id)].some(id=>id&&this.deps.runs.getRunById(id)?.final_response?.startsWith('### Partial research — limit reached')),
        ...(input.projectGrantId?{folderAccess:true,folderActivity:(this.deps.projectActivity?.(ownerId,input)??[]).slice(-200)}:{}),
        toolActivity: [...(this.deps.researchActivity?.(ownerId,input)??[]), ...(input.workflow === 'review_verify_and_synthesis' ? this.deps.verificationActivity?.(ownerId,input)??[] : [])].slice(-200),
        ...(input.workflow === 'review_verify_and_synthesis' ? { evidence: this.deps.sessions.verificationEvidence(sessionId, ownerId) } : {}),
        stages: this.deps.sessions.workflowRuns(sessionId, ownerId).map(stage => {
          const run = stage.run_id ? this.deps.runs.getRunById(stage.run_id) : null
          const text = run?.final_response ?? (stage.stream_id ? this.deps.visibleProgress?.(stage.stream_id)?.text : '') ?? ''
          return { id: stage.stage_id, participantId: stage.participant_id, modelName: stage.model_name,
            status: run?.status ?? 'reserved', text: text.slice(0, 32_000), verified: false as const }
        }) } } : {}),
      ...(this.deps.journal ? { journalAvailable: !this.journalErrors.has(sessionId) } : {}) }
  }

  /** Recover visible saved output only after the attempt has settled. Never resumes work. */
  transcript(ownerId: string, sessionId: string, participantId: string): ProposalTranscript | null {
    const session = this.status(ownerId, sessionId)
    const participant = session?.participants.find(item => item.id === participantId)
    if (!session || !participant?.runId) return null
    const run = this.deps.runs.getRunById(participant.runId)
    if (!run || run.conversation_id !== session.conversationId || !['completed', 'aborted', 'error'].includes(run.status)) return null
    const text = run.final_response ?? this.deps.runs.getMessages(run.id)
      .filter(message => message.role === 'assistant').map(message => message.content ?? '').join('\n\n')
    if (text.length > 1_000_000) throw new Error('Transcript exceeds recovery limit')
    return { schemaVersion: 1, sessionId, participantId, runId: run.id,
      status: run.status as ProposalTranscript['status'], text, verified: false }
  }

  /** Future stream route must check ownership before touching the replay registry. */
  ownsStream(ownerId: string, sessionId: string, streamId: string): boolean {
    const status = this.status(ownerId, sessionId)
    return !!status && (status.participants.some(participant => participant.streamId === streamId) ||
      this.deps.sessions.workflowRuns(sessionId, ownerId).some(stage => stage.stream_id === streamId))
  }

  start(ownerId: string, raw: unknown): Promise<ProposalCheckpoint[]> {
    if (!ownerId.trim() || ownerId.length > 128) throw new Error('Invalid owner')
    const input = parseProposalSession(raw)
    const deadlineMs = this.deps.deadlineMs ?? (input.projectGrantId||input.workflow === 'review_verify_and_synthesis' ? 600_000 : input.workflow ? 360_000 : 120_000)
    if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 600_000) {
      throw new Error('Invalid proposal deadline')
    }
    this.authorize(ownerId, input)
    if(input.projectGrantId){if(!this.deps.projectSession)throw Error('Folder tools unavailable');this.deps.projectSession(ownerId,input,'admission',()=>this.authorize(ownerId,input))}
    if (input.workflow === 'review_verify_and_synthesis' && !this.deps.verificationSession) throw new Error('Verification tools are unavailable in this host')
    for (const participant of input.participants) {
      if (!admittedHadronModel(this.deps,participant.provider,participant.modelName)) throw new Error('Model is not admitted')
    }
    const validateAnchor = () => {
      const detail = this.deps.lineages.getDetail(input.conversationId, input.sourceLineageId)
      if (!detail || detail.status !== 'active' || !detail.pathMessageIds.includes(input.anchorMessageId)) {
        throw new Error('Invalid source anchor')
      }
    }
    validateAnchor()
    const continuationSnapshot = freezeSharedContinuation(this.deps, ownerId, input)
    const executionInput = continuationSnapshot ? { ...input, context: continuationSnapshot.context } : input
    const configJson = JSON.stringify({ ...input, ...(continuationSnapshot ? { continuationSnapshot } : {}), limits: { deadlineMs, maxRequestsPerParticipant: 1 } })
    const row = this.deps.sessions.create({ id: input.sessionId, ownerId,
      conversationId: input.conversationId, sourceLineageId: input.sourceLineageId,
      anchorMessageId: input.anchorMessageId, configJson, configHash: proposalHash(configJson),
      participantIds: input.participants.map(p => p.id) })
    const active = this.active.get(input.sessionId)
    if (active) return active.promise
    const existingWorkflow = this.deps.sessions.workflow(input.sessionId, ownerId)
    if (existingWorkflow) {
      if (existingWorkflow.status === 'completed') return Promise.resolve(JSON.parse(row.checkpoints_json!))
      throw new Error('Workflow already claimed or interrupted; start a new explicit session')
    }
    if (row.status === 'completed' && !input.workflow) return Promise.resolve(JSON.parse(row.checkpoints_json!))
    this.checkpoint(ownerId, input.sessionId)
    if (!this.deps.sessions.claim(input.sessionId, ownerId)) {
      throw new Error('Session already claimed or interrupted; explicit recovery required')
    }
    if (input.workflow) this.deps.sessions.createWorkflow(input.sessionId, ownerId, input.participants, input.workflow === 'review_verify_and_synthesis')
    const deadlineAt = Date.now() + deadlineMs
    let timedOut = false
    const checkDeadline = () => {
      if (Date.now() >= deadlineAt) {
        timedOut = true
        throw new Error('Proposal deadline exceeded')
      }
    }
    const review = input.workflow ? new CollaborationReview(this.deps, ownerId, executionInput,
      () => this.checkpoint(ownerId, input.sessionId), checkDeadline,deadlineAt) : undefined
    const spike = new ProposalSpike({ agents: this.deps.agents, providerUserId: ownerId,
      implementerId:input.projectMode==='agent'?'a':undefined,
      toolSession:(participantId:string)=>{
        const authorize=()=>{checkDeadline();this.deps.sessions.assertRunning(input.sessionId,ownerId);this.authorize(ownerId,input)}
        const session=input.projectGrantId ? this.deps.projectSession!(ownerId,executionInput,'proposal_'+participantId,authorize) : this.deps.researchSession?.(ownerId,executionInput,'proposal_'+participantId,authorize)
        // Only Agent A in coding mode implements. Every other stage (all stages of a read-only run) is an assessment:
        // reporting that the overall request still needs edits is a valid finished assessment, not a failed participant.
        const implementer=input.projectMode==='agent'&&participantId==='a'
        return session?withHadronToolDeadline(implementer?session:withHadronAssessment(session),deadlineAt):undefined
      },
      validateAnchor: () => { this.deps.sessions.assertRunning(input.sessionId, ownerId); validateAnchor() },
      onPrepared: (participantId, child) => {
        checkDeadline()
        if (!child.handle) throw new Error('Missing owned child handle')
        this.deps.sessions.bind(input.sessionId, ownerId, participantId,
          { runId: child.runId, handle: child.handle, streamId: child.streamId })
        this.checkpoint(ownerId, input.sessionId)
      },
      publish: (snapshot, proposals) => {
        checkDeadline()
        return this.deps.sessions.complete(input.sessionId, ownerId,
          () => publishProposalCheckpoints(this.deps, snapshot, proposals)) as ProposalCheckpoint[]
      },
    }, executionInput)
    const timer = setTimeout(() => { timedOut = true; spike.stop(); review?.stop() }, deadlineMs)
    const journalTimer = this.deps.journal ? setInterval(() => this.refreshJournals(ownerId, input.sessionId), 5000) : undefined
    const promise = spike.start().then(async checkpoints => {
      if (review) await review.run()
      return checkpoints
    }).finally(async () => {
      clearTimeout(timer)
      if (journalTimer) clearInterval(journalTimer)
      // Spike's finally has already cancelled/drained every returned owned handle.
      for (const participant of this.deps.sessions.participants(input.sessionId, ownerId)) {
        if (!participant.run_id) continue
        const run = this.deps.runs.getRunById(participant.run_id)
        if (run && ['completed', 'aborted', 'error'].includes(run.status)) {
          this.deps.sessions.finishParticipant(input.sessionId, ownerId, run.id, run.status)
        }
      }
      const latest = this.deps.sessions.get(input.sessionId, ownerId)!
      if (latest.status === 'stopping') this.deps.sessions.finish(input.sessionId, ownerId, 'cancelled')
      else if (latest.status === 'running') this.deps.sessions.finish(input.sessionId, ownerId, 'failed',
        timedOut ? 'Proposal deadline exceeded' : 'Proposal session failed')
      const workflow = this.deps.sessions.workflow(input.sessionId, ownerId)
      if (workflow && ['running', 'stopping'].includes(workflow.status)) {
        this.deps.sessions.updateWorkflow(input.sessionId, ownerId, workflow.status === 'stopping' ? 'cancelled' : 'failed', workflow.phase,
          timedOut ? 'Collaboration deadline exceeded' : 'Collaboration stopped before a complete combined answer; saved proposals and reviews remain available')
      }
      this.active.delete(input.sessionId)
      this.refreshJournals(ownerId, input.sessionId)
    })
    this.active.set(input.sessionId, { ownerId, spike, review, promise })
    return promise
  }

  /** Durable Stop prevents onPrepared/publication even if another instance owns execution. */
  stop(ownerId: string, sessionId: string): void {
    this.status(ownerId, sessionId) // Stop cannot bypass revoked workspace access.
    const row = this.deps.sessions.get(sessionId, ownerId)
    if (!row) return
    const active = this.active.get(sessionId)
    const workflow = this.deps.sessions.workflow(sessionId, ownerId)
    if (workflow?.status === 'running') this.deps.sessions.updateWorkflow(sessionId, ownerId, 'stopping', workflow.phase)
    const stoppedProposal = this.deps.sessions.stop(sessionId, ownerId)
    if (!stoppedProposal && workflow?.status !== 'running' && workflow?.status !== 'stopping') return
    active?.review?.stop()
    active?.spike.stop()
    for (const participant of this.deps.sessions.participants(sessionId, ownerId)) {
      if (participant.handle) this.deps.agents.cancel(participant.handle)
    }
    if (!active && row.status === 'created') this.deps.sessions.finish(sessionId, ownerId, 'cancelled')
    this.refreshJournals(ownerId, sessionId)
  }
}
