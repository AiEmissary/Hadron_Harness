import { expect, it } from 'vitest'
import { buildJobContinuity } from '../collaboration/jobContinuity.js'
it('keeps the goal and bounded recovery data, explicitly labelling missing context and unverified claims', () => {
  const result = buildJobContinuity({ id: 'a', task: 'Original goal', context: '\\"'.repeat(8000) }, 'interrupted', 'Old notes\n'.repeat(10000))
  expect(result.task).toBe('Original goal'); expect(result.context.length).toBeLessThanOrEqual(16000)
  const packet = JSON.parse(result.context)
  expect(packet.sourceJobId).toBe('a'); expect(packet.previousStatus).toBe('interrupted')
  expect(packet.contextTruncated).toBe(true); expect(packet.logTruncated).toBe(true)
  expect(packet.note).toContain('do not assume'); expect(result.excerpted).toBe(true)
})
it('preserves small context and logs completely without a provider request', () => {
  const result = buildJobContinuity({ id: 'b', task: 'Goal', context: 'Original file' }, 'completed', 'Work done; remaining fix')
  expect(JSON.parse(result.context)).toMatchObject({ originalContext: 'Original file', jobLogExcerpt: 'Work done; remaining fix', contextTruncated: false, logTruncated: false })
  expect(result.excerpted).toBe(false)
})
