import { expect, it } from 'vitest'
import { agentConversationPath, layoutAgentBranches, currentTaskNodes } from './agentConversation'
const node = (id: string, parentId: string | null, conversationId = 'a') => ({ id, parentId, conversationId, jobId: id, kind: 'task' as const, status: 'completed', text: id, provider: 'openaichatgpt' as const, modelName: 'model' })
it('filters the current conversation while keeping all its sibling/nested branches and leaving the full forest intact', () => {
  const nodes = [node('root', null), node('left', 'root'), node('right', 'root'), node('nested', 'left'), node('other', null, 'other')]
  expect(currentTaskNodes(nodes, { slot: 'a', shared: false, sessionId: null, selectedId: 'left' }).map(item => item.id)).toEqual(['root', 'left', 'right', 'nested'])
  expect(currentTaskNodes(nodes, { slot: 'a', shared: false, sessionId: null, jobId: 'other' })).toEqual([nodes[4]])
  expect(currentTaskNodes(nodes, { slot: 'a', shared: false, sessionId: null, jobId: 'pending' })).toEqual([])
  expect(currentTaskNodes(nodes, { slot: 'a', shared: false, sessionId: null, selectedId: 'root', newTask: true })).toEqual([])
  expect(nodes).toHaveLength(5)
})
it('shows only the selected collaboration and its private branches, never an unrelated previous session', () => {
  const nodes = [{ ...node('proposal', null, 'shared-a'), jobId: 'proposal:session:a' }, node('continuation', 'proposal', 'shared-a'),
    { ...node('previous', null, 'old'), jobId: 'proposal:old:a' }, node('independent', null)]
  expect(currentTaskNodes(nodes, { slot: 'a', shared: true, sessionId: 'session' }).map(item => item.id)).toEqual(['proposal', 'continuation'])
  expect(currentTaskNodes(nodes, { slot: 'a', shared: true, sessionId: null })).toEqual([])
  expect(currentTaskNodes(nodes, { slot: 'b', shared: true, sessionId: 'session' })).toEqual([])
})
it('opens just the selected branch and leaves its sibling intact', () => {
  const nodes = [node('root', null), node('answer', 'root'), node('left', 'answer'), node('right', 'answer'), node('nested', 'left')]
  expect(agentConversationPath(nodes, 'nested').map(item => item.id)).toEqual(['root', 'answer', 'left', 'nested'])
  expect(agentConversationPath(nodes, 'right').map(item => item.id)).toEqual(['root', 'answer', 'right'])
  expect(nodes).toHaveLength(5)
})
it('rejects missing parents, cycles and crossing conversation boundaries', () => {
  expect(() => agentConversationPath([node('a', 'missing')], 'a')).toThrow()
  expect(() => agentConversationPath([node('a', 'b'), node('b', 'a')], 'a')).toThrow()
  expect(() => agentConversationPath([node('a', 'b'), node('b', null, 'other')], 'a')).toThrow()
  expect(agentConversationPath([], null)).toEqual([])
})

it('draws siblings in separate lanes and keeps a parent centred above the fork', () => {
  const nodes = [node('root', null), node('left', 'root'), node('right', 'root'), node('nested', 'left')]
  const layout = layoutAgentBranches(nodes)
  expect(layout.points.get('left')!.x).toBeLessThan(layout.points.get('right')!.x)
  expect(layout.points.get('root')!.x).toBe((layout.points.get('left')!.x + layout.points.get('right')!.x) / 2)
  expect(layout.points.get('nested')!.y).toBeGreaterThan(layout.points.get('left')!.y)
  expect(() => layoutAgentBranches([node('a', 'missing')])).toThrow()
})
