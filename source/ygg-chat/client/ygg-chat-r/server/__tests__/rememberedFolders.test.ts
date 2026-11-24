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

it('restores all selected folders, preserves explicit removals and rejects a changed secondary folder',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-bookmark-'))
 try{
  const a=path.join(directory,'a'),b=path.join(directory,'b'),file=path.join(directory,'bookmarks.json');fs.mkdirSync(a);fs.mkdirSync(b)
  const bookmarks=new RememberedFolders(file);bookmarks.remember('owner','workspace','a',[a,b])
  expect(new RememberedFolders(file).restore('owner','workspace','shared')).toEqual([fs.realpathSync(a),fs.realpathSync(b)])
  bookmarks.forget('owner','workspace','shared')
  expect(new RememberedFolders(file).restore('owner','workspace','shared')).toBeNull()
  expect(bookmarks.restore('owner','workspace','a')).toEqual([fs.realpathSync(a),fs.realpathSync(b)])
  fs.renameSync(b,b+'-old');fs.mkdirSync(b)
  expect(()=>bookmarks.restore('owner','workspace','a')).toThrow('changed')
  bookmarks.remember('owner','workspace','shared',a)
  expect(bookmarks.restore('owner','workspace','shared')).toBe(fs.realpathSync(a))
 }finally{
  const target=fs.realpathSync(directory),temporary=fs.realpathSync(os.tmpdir())
  if(path.dirname(target)!==temporary||!path.basename(target).startsWith('hadron-bookmark-'))throw Error('Invalid fixture cleanup')
  fs.rmSync(target,{recursive:true,force:true})
 }
})

it('saves one folder once when it is chosen under different spellings',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-bookmark-'))
 try{
  const a=path.join(directory,'a'),b=path.join(directory,'b'),file=path.join(directory,'bookmarks.json');fs.mkdirSync(a);fs.mkdirSync(b)
  // A trailing separator, a `..` detour and (on Windows) different letter case all name folder a.
  const spellings=[a,a+path.sep,path.join(b,'..','a'),...(process.platform==='win32'?[a.toUpperCase()]:[])]
  new RememberedFolders(file).remember('owner','workspace','a',[...spellings,b])
  expect(new RememberedFolders(file).restore('owner','workspace','a')).toEqual([fs.realpathSync(a),fs.realpathSync(b)])
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
})
