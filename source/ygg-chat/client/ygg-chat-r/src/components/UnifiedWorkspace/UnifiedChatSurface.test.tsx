import {expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {UnifiedChatSurface} from './UnifiedChatSurface'
import {blankWorkspaceChat} from '../../features/collaboration/unifiedWorkspace'
import {workspaceActivity} from '../../features/collaboration/workspaceActivity'
it('offers a collapsed activity disclosure containing public tool receipts',()=>{
 const chat=blankWorkspaceChat('project','chat');chat.selectedId='answer'
 chat.messages=[{id:'answer',parentId:null,role:'assistant',agent:'a',text:'Done.',state:'completed',activity:workspaceActivity([{time:'2026-11-11T22:00:00Z',tool:'edit_file',state:'completed'}],[{id:'a',status:'completed'}])}]
 const noop=vi.fn(),html=renderToStaticMarkup(<UnifiedChatSurface chat={chat} providers={[]} help={<span>Help</span>} canSend={false} onDraft={noop} onSend={noop} onStop={noop} onAgent={noop} onConfigure={noop} onFile={noop} onFolder={noop} onLatest={noop} onSelect={noop} onSelection={noop} onMessageAction={noop} onScroll={noop}/> )
 expect(html).toContain('<details class="hadron-v2-activity">')
 expect(html).toContain('Activity and progress');expect(html).toContain('Edit file');expect(html).toContain('Agent A: Reply finished')
 expect(html).not.toContain('<details open')
})
