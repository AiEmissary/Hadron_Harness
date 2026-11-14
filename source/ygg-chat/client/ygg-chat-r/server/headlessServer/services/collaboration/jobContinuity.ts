/** Bounded handoff data for a NEW, explicit job; never an automatic replay of inference. */
export function buildJobContinuity(input: { id: string; task: string; context: string }, status: string, markdown: string) {
  let originalContext = input.context.slice(0, 8000), jobLogExcerpt = markdown.slice(-6000)
  const packet = () => ({ schemaVersion: 1, sourceJobId: input.id, previousStatus: status, originalContext, jobLogExcerpt,
    contextTruncated: originalContext.length < input.context.length, logTruncated: jobLogExcerpt.length < markdown.length,
    note: 'Continuity data only. Review unresolved work and do not assume claimed tests or fixes were verified. Reattach original files if needed.' })
  let context = JSON.stringify(packet())
  while (context.length > 16000 && (originalContext.length || jobLogExcerpt.length)) {
    if (originalContext.length >= jobLogExcerpt.length) originalContext = originalContext.slice(0, Math.floor(originalContext.length * 0.8))
    else jobLogExcerpt = jobLogExcerpt.slice(-Math.floor(jobLogExcerpt.length * 0.8))
    context = JSON.stringify(packet())
  }
  return { schemaVersion: 1 as const, sourceJobId: input.id, task: input.task, context,
    excerpted: originalContext.length < input.context.length || jobLogExcerpt.length < markdown.length }
}
