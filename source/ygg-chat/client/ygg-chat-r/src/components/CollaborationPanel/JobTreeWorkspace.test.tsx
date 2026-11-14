import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { JobTreeWorkspaceProvider, useJobTreeWorkspace } from './JobTreeWorkspace'

afterEach(() => vi.unstubAllGlobals())
function Snapshot() {
  const workspace = useJobTreeWorkspace()!
  return <output>{JSON.stringify({ mode: workspace.mode, pane: workspace.leftView, requested: workspace.requestedSharedSession?.id, selected: workspace.sharedSessionId, node: workspace.selection.nodeId })}</output>
}
function snapshot(saved: unknown, props: {initialSharedSessionId?: string; initialSelection?: {slot:'a'|'b';nodeId:string}} = {}) {
  vi.stubGlobal('window', {})
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved) })
  return renderToStaticMarkup(<JobTreeWorkspaceProvider conversationId='managed' {...props}><Snapshot /></JobTreeWorkspaceProvider>)
}
it('restores the earlier selected shared answer instead of the latest admission', () => {
  const html = snapshot({schemaVersion:1,mode:'together',leftView:'shared',selectedNodes:{},sharedSessionId:'earlier'}, {initialSharedSessionId:'latest'})
  expect(html).toContain('earlier')
  expect(html).not.toContain('latest')
  expect(html).toContain('together')
})
it('repairs legacy private navigation when the managed chat owns a shared workspace', () => {
  const html = snapshot({schemaVersion:1,mode:'independent',leftView:'a',selectedNodes:{}}, {initialSharedSessionId:'latest'})
  expect(html).toContain('together')
  expect(html).toContain('latest')
})
it('preserves explicitly opened private project entries', () => {
  const html = snapshot({schemaVersion:1,mode:'together',leftView:'shared',selectedNodes:{},sharedSessionId:'earlier'}, {initialSelection:{slot:'b',nodeId:'private-response'}})
  expect(html).toContain('independent')
  expect(html).toContain('private-response')
  expect(html).not.toContain('earlier')
})
it('restores an explicitly selected project-build view instead of a previous shared task',()=>{
 const html=snapshot({schemaVersion:1,mode:'project',leftView:'project',selectedNodes:{}},{initialSharedSessionId:'latest-shared'})
 expect(html).toContain('project');expect(html).not.toContain('latest-shared')
})
