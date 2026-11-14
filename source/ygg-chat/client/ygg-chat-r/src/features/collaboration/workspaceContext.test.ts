import {expect,it} from 'vitest'
import {workspaceHandoverContext} from './workspaceContext'
import type {WorkspaceMessage} from './unifiedWorkspace'
it('hands a drawing-heavy chat to another agent within the cap without changing saved originals',()=>{
 const path:WorkspaceMessage[]=[{id:'goal',parentId:null,role:'user',text:'Compare the garden designs.',state:'completed'},
  {id:'drawing',parentId:'goal',role:'assistant',agent:'a',text:'Earlier design.\n```svg\n<svg>'+'.'.repeat(30000)+'</svg>\n```',state:'completed'},
  {id:'latest',parentId:'drawing',role:'assistant',agent:'b',text:'Keep the blue roof and the two windows.',state:'completed'}]
 const before=JSON.stringify(path),context=workspaceHandoverContext(path,'Current file: do not remove this text.','b')
 expect(context.length).toBeLessThanOrEqual(16000)
 expect(context).toContain('You: Compare the garden designs.')
 expect(context).toContain('Agent B: Keep the blue roof and the two windows.')
 expect(context).toContain('Current file: do not remove this text.')
 expect(context).toContain('not a complete history')
 expect(JSON.stringify(path)).toBe(before)
})
it('preserves a small latest drawing for follow-up edits and handles oversized prose honestly',()=>{
 const path:WorkspaceMessage[]=Array.from({length:20},(_,index)=>({id:String(index),parentId:index?String(index-1):null,role:index%2?'assistant':'user',text:'Turn '+index+' '+'.'.repeat(2000),state:'completed'}))
 path.push({id:'svg',parentId:'19',role:'assistant',text:'```svg\n<svg viewBox="0 0 10 10"><circle r="3"/></svg>\n```',state:'completed'})
 const context=workspaceHandoverContext(path,'New attachment stays intact.','b',6000)
 expect(context.length).toBeLessThanOrEqual(6000)
 expect(context).toContain('<circle r="3"/>')
 expect(context).toContain('excerpt omitted')
 expect(context.endsWith('New attachment stays intact.')).toBe(true)
})
