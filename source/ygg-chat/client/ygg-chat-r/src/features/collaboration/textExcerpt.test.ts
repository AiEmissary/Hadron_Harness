import {expect,it} from 'vitest'
import {textExcerpt} from './textExcerpt'
it('identifies selected lines and omitted content explicitly',()=>{
 const part=textExcerpt('first\nsecond\nthird','debug.log',2,1)
 expect(part.text).toContain('lines 2–2 of 3');expect(part.text).toContain('not supplied');expect(part.text.endsWith('\nsecond')).toBe(true)
 expect(()=>textExcerpt('one','f',2,1)).toThrow('end of the file')
})
it('caps very long lines without claiming their full contents were supplied',()=>{
 const part=textExcerpt('x'.repeat(9000),'long.log',1,1)
 expect(part.clipped).toBe(true);expect(part.text).toContain('clipped at 8,000');expect(part.text.split('\n').at(-1)?.length).toBe(8000)
})
it('extracts a late line from a large local log',()=>{
 const part=textExcerpt('log\n'.repeat(100000)+'needle','debug.log',100001,1)
 expect(part.totalLines).toBe(100001);expect(part.text.endsWith('\nneedle')).toBe(true)
})
