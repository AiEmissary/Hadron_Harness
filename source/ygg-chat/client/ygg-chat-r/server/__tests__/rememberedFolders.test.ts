import {expect,it} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {RememberedFolders} from '../hadronTools/rememberedFolders.js'
it('restores only the same owned workspace folder after a restart, across work modes',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-bookmark-')),root=path.join(directory,'project'),file=path.join(directory,'bookmarks.json')
 try{
  fs.mkdirSync(root);new RememberedFolders(file).remember('owner','workspace','a',root)
  const reopened=new RememberedFolders(file)
  expect(reopened.restore('owner','workspace','shared')).toBe(fs.realpathSync(root))
  expect(reopened.restore('other','workspace','a')).toBeNull()
  expect(reopened.restore('owner','other','a')).toBeNull()
  fs.renameSync(root,root+'-moved');fs.mkdirSync(root)
  expect(()=>reopened.restore('owner','workspace','a')).toThrow('changed')
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
})
