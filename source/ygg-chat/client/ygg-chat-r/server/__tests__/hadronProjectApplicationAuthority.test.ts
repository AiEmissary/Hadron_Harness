import {expect,it,vi} from 'vitest'
import {ProjectApplicationAuthority} from '../hadronTools/projectApplicationAuthority.js'
const request={owner:'owner',id:'build',task:'Fix addition',snapshotHash:'snapshot',files:[{path:'calculator.js',before:'minus',after:'plus'}]}
it('requires exact native approval and revokes it after success or failure',async()=>{
 const authority=new ProjectApplicationAuthority(),confirm=vi.fn(async()=>true)
 authority.install(confirm)
 expect(()=>authority.assert('owner','build','snapshot')).toThrow('approval')
 await authority.confirm(request,async()=>{
  authority.assert('owner','build','snapshot')
  expect(()=>authority.assert('foreign','build','snapshot')).toThrow()
  expect(()=>authority.assert('owner','build','stale')).toThrow()
 })
 expect(()=>authority.assert('owner','build','snapshot')).toThrow()
 await expect(authority.confirm(request,async()=>{throw Error('write failure')})).rejects.toThrow('write failure')
 expect(()=>authority.assert('owner','build','snapshot')).toThrow()
 expect(()=>authority.install(confirm)).toThrow('already installed')
})
it('declining cannot execute the action and unavailable approval cannot enable editing',async()=>{
 const authority=new ProjectApplicationAuthority(),action=vi.fn(async()=>{})
 await expect(authority.confirm(request,action)).rejects.toThrow('unavailable')
 authority.install(async()=>false)
 expect(await authority.confirm(request,action)).toBeNull()
 expect(action).not.toHaveBeenCalled()
})
it('automation tokens are opaque, path restricted, fixed-test-bound, budgeted and revocable',async()=>{
 const authority=new ProjectApplicationAuthority()
 authority.installAutomation(async()=>true)
 const tests=[{path:'calculator.test.mjs',hash:'original-test'}]
 const token=(await authority.approveAutomation({owner:'owner',root:'root',task:'Fix',paths:['calculator.js'],tests}))!
 expect(()=>authority.assertAutomationCheck({},'root',tests)).toThrow('expired')
 expect(()=>authority.assertAutomationCheck(token,'other',tests)).toThrow()
 expect(()=>authority.assertAutomationCheck(token,'root',[{path:tests[0].path,hash:'changed'}])).toThrow('tests changed')
 await expect(authority.applyAutomated(token,'root',{...request,files:[{path:'outside.js',before:'x',after:'y'}]},async()=>{})).rejects.toThrow('scope')
 for(let count=0;count<3;count++){
  authority.assertAutomationCheck(token,'root',tests)
  await authority.applyAutomated(token,'root',request,async()=>authority.assert('owner','build','snapshot'))
 }
 expect(()=>authority.assertAutomationCheck(token,'root',tests)).toThrow('budget')
 await expect(authority.applyAutomated(token,'root',request,async()=>{})).rejects.toThrow('scope')
 authority.revokeAutomation(token)
 expect(()=>authority.assertAutomationCheck(token,'root',tests)).toThrow('expired')
})
it('an approval which expires during a batch cannot authorize its next file',async()=>{
 const now=vi.spyOn(Date,'now').mockReturnValue(1000),authority=new ProjectApplicationAuthority()
 try{
  authority.installAutomation(async()=>true)
  const token=(await authority.approveAutomation({owner:'owner',root:'root',task:'Fix',paths:['calculator.js'],tests:[]}))!
  await authority.applyAutomated(token,'root',request,async()=>{
   authority.assert('owner','build','snapshot')
   now.mockReturnValue(1801001)
   expect(()=>authority.assert('owner','build','snapshot')).toThrow('approval')
  })
 }finally{now.mockRestore()}
})
