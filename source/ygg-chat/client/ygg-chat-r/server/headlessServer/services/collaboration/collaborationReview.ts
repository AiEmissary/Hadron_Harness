import { admittedHadronModel } from '../../../../../../shared/hadronProviders.js'
import type { ProposalSessionInput } from '../../../../../../shared/collaboration.js'
import type { ProposalSessionDeps } from './proposalSessionService.js'
import { buildCommittedReviewPacket } from './reviewPacket.js'
import { buildHadronWorkerPrompt } from './hadronWorkerPrompt.js'
import {withProjectVerification} from '../../../hadronTools/projectVerification.js'
import {withHadronToolDeadline,withHadronAssessment} from '../../../hadronTools/types.js'

/** One review round, optional tool verification and one synthesis, with durable stage bindings.
 * No retries, automatic resumption or direct peer messaging. Synthesis uses the recorded evidence. */
export class CollaborationReview {
  readonly controller = new AbortController()
  private readonly children: Array<{ handle: string; runId: string }> = []
  constructor(private readonly deps: ProposalSessionDeps, private readonly owner: string,
    private readonly input: ProposalSessionInput, private readonly checkpoint: () => void,
    private readonly checkDeadline: () => void,private readonly deadlineAt?:number) {}

  stop(): void {
    this.controller.abort()
    for (const child of this.children) this.deps.agents.cancel(child.handle)
  }

  private check(): void {
    this.checkDeadline()
    this.controller.signal.throwIfAborted()
    this.deps.authorize(this.owner, this.input)
    if (this.deps.sessions.workflow(this.input.sessionId, this.owner)?.status !== 'running') throw new Error('Workflow admission closed')
    const detail = this.deps.lineages.getDetail(this.input.conversationId, this.input.sourceLineageId)
    if (detail?.status !== 'active' || !detail.pathMessageIds.includes(this.input.anchorMessageId)) throw new Error('Source unavailable')
  }

  private async attempt(stage: string, role: 'review' | 'verification' | 'synthesis', packet: unknown): Promise<{ authorId: string; runId: string; text: string; verified: false }> {
    this.check()
    const selection = this.deps.sessions.workflowRuns(this.input.sessionId, this.owner).find(row => row.stage_id === stage)!
    const provider=this.input.participants.find(item=>item.id===selection.participant_id)?.provider
    if (!provider || !admittedHadronModel(this.deps,provider,selection.model_name)) throw new Error('Model is not admitted')
    const prompt = JSON.stringify(packet)
    if (Buffer.byteLength(prompt, 'utf8') > 160_000) throw new Error('Collaboration packet too large')
    let toolSession = role === 'verification' ? this.deps.verificationSession!(this.owner, this.input, (tool, result) => {
      this.check(); this.deps.sessions.recordVerificationEvidence(this.input.sessionId, this.owner, tool, result)
    }, () => this.check(), () => { this.check(); this.deps.sessions.recordVerificationAttempt(this.input.sessionId, this.owner) }) : undefined
    if(this.input.projectGrantId&&role!=='synthesis'){
      const folder=this.deps.projectSession!(this.owner,this.input,stage,()=>this.check())
      toolSession=toolSession?withProjectVerification(toolSession,folder,(tool,result)=>{this.check();this.deps.sessions.recordVerificationEvidence(this.input.sessionId,this.owner,tool,result)},()=>{this.check();this.deps.sessions.recordVerificationAttempt(this.input.sessionId,this.owner)}):folder
    }
    if(!toolSession&&role==='review')toolSession=this.deps.researchSession?.(this.owner,this.input,stage,()=>this.check())
    if(toolSession&&role!=='synthesis')toolSession=withHadronAssessment(toolSession)
    if(toolSession&&this.deadlineAt!==undefined)toolSession=withHadronToolDeadline(toolSession,this.deadlineAt)
    const child = await this.deps.agents.spawnDetached({
      conversationId: this.input.conversationId, parentMessageId: this.input.anchorMessageId,
      lineageId: null, rootPath: null, fullAccess: false,
      images:this.input.images, prompt, systemPrompt: buildHadronWorkerPrompt(role)+(role==='synthesis'?'\nASSESSMENT AND IMPLEMENTATION: A read-only assessment can finish while reporting missing evidence or unfinished implementation. Preserve those limitations in the combined answer. Explicitly list outstanding requested work and any blocker; never imply that the whole job, audit, edits or tests were completed merely because the assessment stages returned replies.':''), provider,
      modelName: selection.model_name, userId: this.owner, autoApprove: false,
      operationMode: 'plan', tools: [], maxTurns: 1, autoCompactionEnabled: false,
    }, { signal: this.controller.signal, toolPolicy: 'none', toolSession,helpers:{jobId:this.input.sessionId,role:selection.participant_id}, onPrepared: binding => {
      this.check()
      this.deps.sessions.bindWorkflow(this.input.sessionId, this.owner, stage, binding)
      this.checkpoint()
    } })
    if (!child.handle) throw new Error('Missing owned collaboration handle')
    this.children.push({ handle: child.handle, runId: child.runId })
    this.check()
    const terminal = await this.deps.agents.waitForTerminal(child.handle, this.controller.signal)
    this.check()
    const run = this.deps.runs.getRunById(child.runId)
    if (!terminal || terminal.id !== child.runId || terminal.status !== 'completed' || !run || run.status !== 'completed' ||
      run.conversation_id !== this.input.conversationId || run.parent_message_id !== this.input.anchorMessageId ||
      run.model_name !== selection.model_name || run.provider !== provider || run.prompt !== prompt ||
      !run.final_response?.trim() || run.final_response.length > (role === 'synthesis' ? 32_000 : 8_000)) {
      throw new Error('Collaboration stage did not produce a bounded complete answer')
    }
    this.checkpoint()
    return { authorId: selection.participant_id, runId: run.id, text: run.final_response, verified: false }
  }

  async run(): Promise<void> {
    try {
      this.check()
      const packets = this.input.participants.map(participant => {
        const packet = buildCommittedReviewPacket(this.deps, this.owner, this.input.sessionId, participant.id)
        // The prepared helper exposes excerpts. Execution requires the full bounded originals.
        const proposals = packet.proposals.map(proposal => {
          const text = this.deps.runs.getRunById(proposal.runId)!.final_response!
          if (text.length > 8_000) throw new Error('Proposal too large for full review')
          return { ...proposal, text, truncated: false }
        })
        return { ...packet, proposals }
      })
      this.deps.sessions.updateWorkflow(this.input.sessionId, this.owner, 'running', 'reviews')
      this.checkpoint()
      // All stage promises settle before cleanup; a failed peer immediately closes admission.
      const attempts = packets.map((packet, index) => this.attempt(index === 0 ? 'review_a' : 'review_b', 'review', packet)
        .catch(error => { this.stop(); throw error }))
      const settled = await Promise.allSettled(attempts)
      const failure = settled.find(result => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
      const reviews = settled.map(result => (result as PromiseFulfilledResult<Awaited<ReturnType<CollaborationReview['attempt']>>>).value)
      this.check()
      const verification = this.input.workflow === 'review_verify_and_synthesis'
        ? await this.attempt('verification', 'verification', { schemaVersion: 1, kind: 'verification_packet',
          task: this.input.task, context: this.input.context, proposals: packets[0].proposals, reviews }) : undefined
      this.check()
      this.deps.sessions.updateWorkflow(this.input.sessionId, this.owner, 'running', 'synthesis')
      this.checkpoint()
      await this.attempt('final', 'synthesis', { schemaVersion: 1, kind: 'combined_answer_packet',
        task: this.input.task, context: this.input.context, proposals: packets[0].proposals, reviews, ...(verification ? { verification, hostEvidence: this.deps.sessions.verificationEvidence(this.input.sessionId, this.owner) } : {}) })
      this.check()
      this.deps.sessions.updateWorkflow(this.input.sessionId, this.owner, 'completed', 'finished')
    } finally {
      this.stop()
      await Promise.all(this.children.map(child => this.deps.agents.waitForTerminal(child.handle)))
    }
  }
}
