import {expect,it} from 'vitest'
import {blankWorkspaceChat,workspaceMessagePath,workspaceTranscriptPath,type WorkspaceChat,type WorkspaceMessage} from './unifiedWorkspace'
const message=(id:string,parentId:string|null):WorkspaceMessage=>({id,parentId,role:id.startsWith('q')?'user':'assistant',text:id,state:'completed'})
function fixture():WorkspaceChat{
 const chat=blankWorkspaceChat('project','chat')
 chat.messages=[message('q',null),message('a','q'),message('q-left','a'),message('a-left','q-left'),message('q-left-2','a-left'),message('a-left-2','q-left-2'),message('q-right','a'),message('a-right','q-right')]
 chat.selectedId='a-left-2';return chat
}
const ids=(messages:WorkspaceMessage[])=>messages.map(message=>message.id)
it('keeps later questions and answers visible when selecting an earlier node on a linear branch',()=>{
 const chat=fixture();chat.messages=chat.messages.slice(0,6);chat.selectedId='q-left'
 expect(ids(workspaceTranscriptPath(chat))).toEqual(['q','a','q-left','a-left','q-left-2','a-left-2'])
 expect(ids(workspaceMessagePath(chat))).toEqual(['q','a','q-left'])
 expect(chat.selectedId).toBe('q-left')
})
it('retains the branch being read when clicking one of its common ancestors',()=>{
 const chat=fixture();chat.selectedId='q'
 expect(ids(workspaceTranscriptPath(chat,'a-left-2'))).toEqual(['q','a','q-left','a-left','q-left-2','a-left-2'])
})
it('switches to a sibling branch and includes its descendants without mixing sibling replies',()=>{
 const chat=fixture();chat.selectedId='q-right'
 expect(ids(workspaceTranscriptPath(chat,'a-left-2'))).toEqual(['q','a','q-right','a-right'])
})
it('extends the displayed branch as new descendants arrive, without stealing it for an unrelated update',()=>{
 const chat=fixture();chat.selectedId='q'
 chat.messages.push(message('q-new','a-left-2'),message('a-new','q-new'))
 expect(ids(workspaceTranscriptPath(chat,'a-left-2')).at(-1)).toBe('a-new')
 chat.messages.push(message('q-other','a-right'),message('a-other','q-other'))
 expect(ids(workspaceTranscriptPath(chat,'a-new')).at(-1)).toBe('a-new')
})
it('ignores a removed preferred leaf and still resolves the selected branch',()=>{
 const chat=fixture();chat.selectedId='q-left'
 expect(ids(workspaceTranscriptPath(chat,'removed')).at(-1)).toBe('a-left-2')
})
it('keeps unrelated root conversations out of the display',()=>{
 const chat=fixture();chat.messages.push(message('q-foreign',null),message('a-foreign','q-foreign'));chat.selectedId='q-left'
 expect(ids(workspaceTranscriptPath(chat))).not.toContain('a-foreign')
})
it('retains the existing ancestry checks and does not mutate the saved chat or prompt path',()=>{
 const chat=fixture();chat.selectedId='q-left';chat.draft='Unsent question'
 const before=JSON.stringify(chat)
 workspaceTranscriptPath(chat,'a-left-2')
 expect(JSON.stringify(chat)).toBe(before)
 expect(ids(workspaceMessagePath(chat))).not.toContain('a-left-2')
 expect(workspaceTranscriptPath(blankWorkspaceChat('project','new'))).toEqual([])
 chat.messages[0].parentId='a-left'
 expect(()=>workspaceTranscriptPath(chat)).toThrow('cycle')
})
