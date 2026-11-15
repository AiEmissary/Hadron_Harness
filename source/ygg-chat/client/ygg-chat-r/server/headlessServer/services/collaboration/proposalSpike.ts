import type { SubagentRunService } from '../subagentRunService.js'
import { buildHadronWorkerPrompt } from './hadronWorkerPrompt.js'
import { proposalTaskPacket, proposalHash, validParticipantId, type ProposalCheckpoint, type ProposalReference, type ProposalSnapshot } from './proposalCheckpoints.js'

export interface ProposalSpikeInput {
  sessionId: string
  conversationId: string
  sourceLineageId: string
  anchorMessageId: string
  task: string
  images?:import('../../../../../../shared/hadronImages.js').HadronImage[]
  context: string
  participants: readonly { id: string; modelName: string; provider?: 'openaichatgpt'|'claudecode' }[]
}

interface ProposalSpikeDeps {
  /** Trusted coordinator identity; never read from the task packet. */
  providerUserId?: string
  agents: Pick<SubagentRunService, 'spawnDetached' | 'cancel' | 'waitForTerminal'>
  validateAnchor(snapshot: ProposalSnapshot): void
  onPrepared?(participantId: string, child: { runId: string; handle: string | null; streamId: string }): void
  publish(snapshot: ProposalSnapshot, proposals: readonly ProposalReference[]): ProposalCheckpoint[]
  toolSession?(participantId:string):import('../../../hadronTools/types.js').HadronToolSession|undefined
  implementerId?:string
}

/**
 * Internal, unwired P0 coordinator: exactly two tool-free ChatGPT proposal runs.
 * A new instance is a new launch; start() is idempotent only on this instance.
 * Durable launch recovery, budgets, model availability and HTTP auth are not implemented.
 */
export class ProposalSpike {
  private readonly controller = new AbortController()
  private readonly input: ProposalSpikeInput
  private readonly packet: string
  private readonly snapshot: ProposalSnapshot
  private launch?: Promise<ProposalCheckpoint[]>

  constructor(private readonly deps: ProposalSpikeDeps, input: ProposalSpikeInput) {
    if (input.participants.length !== 2 || new Set(input.participants.map(p => p.id)).size !== 2 ||
      input.participants.some(p => !validParticipantId(p.id) || !p.modelName.trim() || p.modelName.length > 256) ||
      !input.sessionId.trim() || input.sessionId.length > 128 || !input.task.trim() || input.task.length + input.context.length > 32_000) {
      throw new Error('Expected two named models and a nonempty bounded task/context packet')
    }
    this.input = { ...input, ...(input.images?{images:structuredClone(input.images)}:{}), participants: input.participants.map(p => ({ ...p })) }
    this.packet = proposalTaskPacket(input)
    this.snapshot = Object.freeze({ sessionId: input.sessionId, conversationId: input.conversationId,
      sourceLineageId: input.sourceLineageId, anchorMessageId: input.anchorMessageId,
      contextHash: proposalHash(this.packet) })
  }

  start(): Promise<ProposalCheckpoint[]> {
    return this.launch ??= this.run()
  }

  /** Closes admission/publication immediately; start() settles after owned cleanup. */
  stop(): void {
    this.controller.abort()
  }

  private async run(): Promise<ProposalCheckpoint[]> {
    const { signal } = this.controller
    const children: Array<{ participantId: string; handle: string; runId: string }> = []
    const cancelOwned = () => {
      for (const child of children) this.deps.agents.cancel(child.handle)
    }
    signal.addEventListener('abort', cancelOwned)
    try {
      signal.throwIfAborted()
      this.deps.validateAnchor(this.snapshot)
      for (const participant of this.input.participants) {
        signal.throwIfAborted()
        // Trusted admission removes resolver defaults and denies every tool at
        // execution, binds ownership synchronously, and fences Stop before dispatch.
        const child = await this.deps.agents.spawnDetached({
          conversationId: this.input.conversationId, parentMessageId: this.input.anchorMessageId,
          lineageId: null, rootPath: null, fullAccess: false,
          images:this.input.images, prompt: this.packet, systemPrompt: buildHadronWorkerPrompt(this.deps.implementerId===participant.id?'implementation':'proposal'),
          provider: participant.provider ?? 'openaichatgpt', modelName: participant.modelName, userId: this.deps.providerUserId,
          autoApprove: false, operationMode: 'plan', tools: [], maxTurns: 1,
          autoCompactionEnabled: false,
        }, { signal, toolPolicy: 'none',toolSession:this.deps.toolSession?.(participant.id),helpers:{jobId:this.input.sessionId,role:participant.id},
          onPrepared: child => this.deps.onPrepared?.(participant.id, child),
        })
        if (!child.handle) throw new Error('Subagent did not allocate an owned handle')
        children.push({ participantId: participant.id, handle: child.handle, runId: child.runId })
        signal.throwIfAborted()
      }
      const proposals = await Promise.all(children.map(async child => {
        const terminal = await this.deps.agents.waitForTerminal(child.handle, signal)
        if (!terminal || terminal.id !== child.runId || terminal.status !== 'completed') {
          throw new Error(`Proposal participant ${child.participantId} did not complete`)
        }
        return { participantId: child.participantId, runId: child.runId, attempt: terminal.attempt }
      }))
      signal.throwIfAborted()
      // No await between the last Stop check and the synchronous atomic publisher.
      return this.deps.publish(this.snapshot, proposals)
    } finally {
      signal.removeEventListener('abort', cancelOwned)
      cancelOwned()
      // Includes a child whose asynchronous preparation finished after Stop.
      await Promise.all(children.map(child => this.deps.agents.waitForTerminal(child.handle)))
    }
  }
}
