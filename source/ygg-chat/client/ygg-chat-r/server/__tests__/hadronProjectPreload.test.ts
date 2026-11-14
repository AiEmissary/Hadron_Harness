import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {transformSync} from 'esbuild'
import {expect,it,vi} from 'vitest'

it('the actual preload exposes the complete typed project bridge and forwards all milestone arguments unchanged',async()=>{
 let bridge:any
 const invoke=vi.fn(async(channel:string,...args:unknown[])=>({channel,args}))
 const source=fs.readFileSync(path.resolve(import.meta.dirname,'../../electron/preload.ts'),'utf8')
 const {code}=transformSync(source,{loader:'ts',format:'cjs',target:'node20'})
 vm.runInNewContext(code,{require:(name:string)=>{if(name!=='electron')throw Error('Unexpected preload dependency');return {contextBridge:{exposeInMainWorld:(name:string,value:any)=>{if(name==='electronAPI')bridge=value}},ipcRenderer:{invoke,on:vi.fn()}}},process:{platform:'win32',env:{}},console:{log:vi.fn()}})
 for(const name of ['milestones','accept','nextMilestone','availability','choose','sources','clearSources','start','status','check','list','stop','close','journal','inspect','apply','runChecks','runBuild','repair','automate'])expect(typeof bridge.projectDraft[name],name).toBe('function')
 expect(await bridge.projectDraft.milestones('workspace')).toEqual({channel:'project-draft:milestones',args:['workspace']})
 expect(await bridge.projectDraft.accept('proposal',['Deliverable'],false)).toEqual({channel:'project-draft:accept',args:['proposal',['Deliverable'],false]})
 expect(await bridge.projectDraft.nextMilestone('proposal')).toEqual({channel:'project-draft:next',args:['proposal']})
 expect(invoke).toHaveBeenCalledTimes(3)
})
