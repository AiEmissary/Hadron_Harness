import { describe, expect, it } from 'vitest'
import { buildHadronWorkerPrompt, HADRON_WORKER_PROMPT_VERSION } from '../collaboration/hadronWorkerPrompt.js'

describe('Hadron stage-specific worker instructions', () => {
  it('reserves comparison for review instead of declaring an initial proposal a failed consensus', () => {
    expect(HADRON_WORKER_PROMPT_VERSION).toBe(7)
    const proposal = buildHadronWorkerPrompt('proposal')
    expect(proposal).toContain('Do not add a Remaining disagreements section')
    expect(proposal).toContain('The coordinator will perform the comparison after both proposals finish')
    expect(buildHadronWorkerPrompt('independent_job')).not.toContain('### Shared task: independent proposal')
  })
  it('resolves preferences while protecting justified disagreement and execution limits', () => {
    expect(buildHadronWorkerPrompt('review')).toContain('Resolve differences of preference')
    const final = buildHadronWorkerPrompt('synthesis')
    expect(final).toContain('choose a practical default')
    expect(final).toContain('that earlier absence is not an unresolved issue')
    expect(final).toContain('Do not claim unanimous consensus where there is dissent')
    expect(final).toContain('Without that contract this attempt is tool-free')
    const verifier = buildHadronWorkerPrompt('verification')
    expect(verifier).toContain('These host operations work through JSON messages')
    expect(verifier).not.toContain('Report tests actually run as none')
  })
})

it('appoints a single implementer and keeps review assignments separate',()=>{
 expect(buildHadronWorkerPrompt('implementation')).toContain('sole implementer')
 expect(buildHadronWorkerPrompt('implementation')).toContain('If the user asked only a question')
 expect(buildHadronWorkerPrompt('implementation')).toContain('Do not stop at a partial investigation')
 expect(buildHadronWorkerPrompt('implementation')).toContain('finished:false')
 expect(buildHadronWorkerPrompt('synthesis')).toContain('does not establish that the appointed implementer lacked coding tools')
 expect(buildHadronWorkerPrompt('review')).not.toContain('sole implementer')
})
