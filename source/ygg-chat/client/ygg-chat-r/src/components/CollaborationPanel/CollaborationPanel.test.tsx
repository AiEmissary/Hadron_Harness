import { ChatCollaborationLayout } from './ChatCollaborationLayout'
import { CollaborationSessionView } from './CollaborationSessionView'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CollaborationPanel } from './CollaborationPanel'
import { CollaborationPreview } from './CollaborationPreview'
import { CollaborationStreams } from './CollaborationStreams'

it('renders separate A/B provider and model controls with live admission disabled', () => {
  const start = vi.fn()
  const html = renderToStaticMarkup(<CollaborationPanel enabled={false} options={[
    { provider: 'openaichatgpt', label: 'ChatGPT', connected: false, models: [] },
  ]} onStart={start} onStop={async () => {}} />)
  expect(html).toContain('Agent A provider')
  expect(html).toContain('Agent B provider')
  expect(html).toContain('Agent A model')
  expect(html).toContain('Agent B model')
  expect(html).toContain('Shared task')
  expect(html).toContain('Choose shared task files')
  expect(html).toContain('type="file" multiple=""')
  expect(html).toContain('Add files')
  expect(html).toContain('disabled="" class="rounded-full bg-violet-600')
  expect(start).not.toHaveBeenCalled()
})

it('renders an explicitly simulated two-pane preview without a provider connection', () => {
  const html = renderToStaticMarkup(<CollaborationPreview />)
  expect(html).toContain('Simulation only.')
  expect(html).toContain('Agent A response')
  expect(html).toContain('Agent B response')
  expect(html).toContain('ChatGPT (simulation)')
  expect(html).toContain('Live collaboration remains disabled')
})


it('renders waiting panes without a session or automatic network request', () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    const html = renderToStaticMarkup(<CollaborationSessionView sessionId={null} />)
    expect(html).toContain('Agent A response')
    expect(html).toContain('Agent B response')
    expect(html).not.toContain('Reconnect Agent')
    expect(html).not.toContain('no peer review in this saved session')
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})

it('offers continuation on finished proposals and recovery only for disconnected responses', () => {
  const props = { text: { a: 'Proposal A', b: 'Proposal B' }, status: 'completed', reviewedSession: true,
    onReconnect: vi.fn(), onContinue: vi.fn(), continueReady: { a: true, b: true } }
  const complete = renderToStaticMarkup(<CollaborationStreams {...props} />)
  expect(complete).toContain('Continue with Agent A')
  expect(complete).toContain('Continue with Agent B')
  expect(complete).not.toContain('Recover Agent')
  expect(complete).toContain('Initial independent proposal')
  const disconnected = renderToStaticMarkup(<CollaborationStreams {...props} recoverable={{ b: true }} />)
  expect(disconnected).toContain('Recover Agent B response')
  expect(disconnected).not.toContain('Recover Agent A response')
})


it('keeps chat/tree and the dock in separate coordinate spaces without a modal overlay', () => {
  const html = renderToStaticMarkup(<ChatCollaborationLayout workspaceOpen={true} workspace={<aside>Workspace</aside>}><div>Chat and tree</div></ChatCollaborationLayout>)
  expect(html).toContain('data-existing-chat-area="true"')
  expect(html).toContain('data-collaboration-dock="true"')
  expect(html).not.toMatch(/<dialog|aria-modal/)
  expect(html.indexOf('Chat and tree')).toBeLessThan(html.indexOf('Workspace'))
})
