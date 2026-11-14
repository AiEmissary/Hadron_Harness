import {expect,it} from 'vitest'
import {workspaceVisuals,workspaceVisualText} from './workspaceVisuals'
it('keeps drawings in saved text while removing their markup from the readable reply',()=>{
 const source='<svg viewBox="0 0 20 20"><rect width="20" height="20"/></svg>'
 const reply=`Illustrative graph.\n\n\`\`\`svg\n${source}\n\`\`\`\n\nUnits: seconds.`
 expect(workspaceVisuals(reply)).toEqual([{title:'Visual 1',source,kind:'svg'}])
 expect(workspaceVisualText(reply)).toContain('Units: seconds.')
 expect(workspaceVisualText(reply)).not.toContain('<svg')
 expect(workspaceVisuals(JSON.parse(JSON.stringify({reply})).reply)).toHaveLength(1)
})
it('does not treat arbitrary code, unfinished output or remote tracking images as previews',()=>{
 expect(workspaceVisuals('```svg\n<svg>')).toEqual([])
 expect(workspaceVisuals('```html\n<script>alert(1)</script>\n```')).toEqual([])
 expect(workspaceVisuals('![image](https://example.com/tracking.png)')).toEqual([])
 expect(workspaceVisuals('```svg\n<svg>'+'.'.repeat(200001)+'</svg>\n```')).toEqual([])
})
it('supports embedded raster images without putting base64 text in the transcript',()=>{
 const reply='Picture\n![A sketch](data:image/png;base64,aGVsbG8=)'
 expect(workspaceVisuals(reply)[0]).toMatchObject({title:'A sketch',kind:'image'})
 expect(workspaceVisualText(reply)).toBe('Picture')
})
