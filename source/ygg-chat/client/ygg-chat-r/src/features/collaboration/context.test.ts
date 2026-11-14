import { expect, it } from 'vitest'
import { captureCollaborationAnchor } from './context'
const messages = [
  { id: 'a', conversation_id: 'c', role: 'user', content: 'Task' },
  { id: 'b', conversation_id: 'c', role: 'assistant', content: 'Evidence' },
  { id: 'tool', conversation_id: 'c', role: 'tool', content: 'private tool output' },
  { id: 'sibling', conversation_id: 'c', role: 'assistant', content: 'Sibling secret' },
]
it('freezes only selected branch text and retains the exact anchor', () => {
  const snapshot = captureCollaborationAnchor('c', 'l', ['a', 'tool', 'b'], messages)
  expect(JSON.parse(snapshot.context).messages).toEqual([{ role: 'user', text: 'Task' }, { role: 'assistant', text: 'Evidence' }])
  expect(snapshot.anchorMessageId).toBe('b')
  expect(Object.isFrozen(snapshot)).toBe(true)
  const changed = messages.map(message => ({ ...message, content: 'edited later' }))
  captureCollaborationAnchor('c', 'l', ['a'], changed)
  expect(snapshot.context).toContain('Evidence')
  expect(snapshot.context).not.toMatch(/private tool output|Sibling secret/)
})
it('rejects missing, duplicate, cross-conversation and oversized branch context without truncation', () => {
  for (const path of [[], ['missing'], ['a', 'a']]) expect(() => captureCollaborationAnchor('c', 'l', path, messages)).toThrow()
  expect(() => captureCollaborationAnchor('other', 'l', ['a'], messages)).toThrow()
  expect(() => captureCollaborationAnchor('c', null, ['a'], messages)).toThrow()
  expect(() => captureCollaborationAnchor('c', 'l', ['a'], [{ ...messages[0], content: 'x'.repeat(16001) }])).toThrow('too long')
})
