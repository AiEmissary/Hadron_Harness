import { afterEach, expect, it, vi } from 'vitest'
import { confirmDraftReplacement, receiveWorkflowDraft, sendWorkflowDraft } from './workflowDraft'
afterEach(() => vi.unstubAllGlobals())
function browser() { const target = new EventTarget(); vi.stubGlobal('window', { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target), confirm: () => false }) }
it('delivers only to the selected workspace and destination, without starting work', () => {
  browser(); const receive = vi.fn(), wrong = vi.fn()
  const clean = receiveWorkflowDraft('project', 'a', receive), cleanWrong = receiveWorkflowDraft('other', 'a', wrong)
  sendWorkflowDraft('project', 'a', 'Conclusion')
  expect(receive).toHaveBeenCalledWith('Conclusion'); expect(wrong).not.toHaveBeenCalled()
  clean(); cleanWrong(); expect(() => sendWorkflowDraft('project', 'a', 'Conclusion')).toThrow('destination workspace')
})
it('preserves held jobs, cancelled replacement and oversized drafts', () => {
  browser(); const receive = vi.fn(() => { throw Error('Existing job is running') })
  const clean = receiveWorkflowDraft('project', 'b', receive)
  expect(() => sendWorkflowDraft('project', 'b', 'Conclusion')).toThrow('Existing job')
  expect(() => sendWorkflowDraft('project', 'b', 'x'.repeat(16001))).toThrow('16,000')
  expect(receive).toHaveBeenCalledTimes(1)
  expect(() => confirmDraftReplacement(true)).toThrow('kept')
  expect(() => confirmDraftReplacement(false)).not.toThrow(); clean()
})
