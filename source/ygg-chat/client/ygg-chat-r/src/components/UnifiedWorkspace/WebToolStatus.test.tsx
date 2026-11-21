import {expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {WorkspaceMenu} from './WorkspaceMenu'
import {blankWorkspaceChat} from '../../features/collaboration/unifiedWorkspace'
it.each(['chat','agent'] as const)('explains included online tools in the existing %s setup popup without requiring a key or folder',permission=>{
 const chat=blankWorkspaceChat('project','chat');chat.permission=permission
 const noop=vi.fn(),html=renderToStaticMarkup(<WorkspaceMenu open chat={chat} providers={[]} onClose={noop} onConfigure={noop}/> )
 expect(html).toContain('Online tools');expect(html).toContain('No extra key or folder is needed')
 expect(html).toContain('Optional Brave search');expect(html).toContain('do not sign in to websites or submit forms')
 expect(html).not.toContain('type="password"')
})
