import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {ProjectExecutionGate,projectExecutionGate} from '../hadronTools/executionGate.js'
import {ExecutionStartup} from '../hadronTools/executionStartup.js'
import {externalWebUrl,openHadronExternalWeb,openHadronExternalPath} from '../../electron/externalLaunch.js'

let root:string,gate:ProjectExecutionGate
beforeEach(()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-external-launch-'));gate=new ProjectExecutionGate()
 vi.spyOn(projectExecutionGate,'assertExternalLaunchAllowed').mockImplementation(provider=>gate.assertExternalLaunchAllowed(provider))
})
afterEach(()=>{
 vi.restoreAllMocks()
 const resolved=fs.realpathSync(root)
 if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('hadron-external-launch-'))throw Error('Invalid external-launch test cleanup')
 fs.rmSync(resolved,{recursive:true,force:true})
})
it('preserves ordinary standard-session browser/file handoffs without creating an execution marker',async()=>{
 new ExecutionStartup(gate).initialize(root,'standard')
 const browser=vi.fn(async()=>{}),file=vi.fn(async()=>''),normalize=vi.fn((value:string)=>value)
 await openHadronExternalWeb('https://example.com/',browser)
 expect(await openHadronExternalPath(path.join(root,'notes.txt'),normalize,file)).toBe('')
 expect(browser).toHaveBeenCalledOnce();expect(browser).toHaveBeenCalledWith('https://example.com/')
 expect(file).toHaveBeenCalledOnce();expect(normalize).toHaveBeenCalledOnce()
 expect(gate.status()).toEqual({ready:true,reason:'clean'})
 expect(fs.existsSync(path.join(root,'project-execution','execution.json'))).toBe(false)
})
it('blocks generic browser/file launches throughout a project-only session without tainting it',async()=>{
 new ExecutionStartup(gate).initialize(root,'project')
 const browser=vi.fn(async()=>{}),file=vi.fn(async()=>''),normalize=(value:string)=>value
 await expect(openHadronExternalWeb('https://example.com/',browser)).rejects.toThrow('project-only session')
 await expect(openHadronExternalPath(path.join(root,'program.exe'),normalize,file)).rejects.toThrow('project-only session')
 // An official-looking URL on a generic renderer channel is still generic.
 await expect(openHadronExternalWeb('https://auth.openai.com/codex/device',browser)).rejects.toThrow('project-only session')
 expect(browser).not.toHaveBeenCalled();expect(file).not.toHaveBeenCalled()
 expect(gate.status()).toEqual({ready:true,reason:'clean'})
 const scope=gate.enter('owner','workspace');gate.release(scope,'owner','workspace')
})
it('permits only the dedicated host login handoff in a clean project-only session',async()=>{
 new ExecutionStartup(gate).initialize(root,'project')
 const browser=vi.fn(async()=>{})
 await openHadronExternalWeb('https://auth.openai.com/codex/device',browser,true)
 await openHadronExternalWeb('https://auth.openai.com/api/accounts/authorize?state=synthetic',browser,true)
 const oauth='https://auth.openai.com/oauth/authorize?'+new URLSearchParams({response_type:'code',client_id:'fixture',redirect_uri:'http://localhost:1455/auth/callback',state:'synthetic',code_challenge:'a'.repeat(43),code_challenge_method:'S256'})
 await openHadronExternalWeb(oauth,browser,true)
 expect(browser).toHaveBeenCalledTimes(3);expect(gate.status().ready).toBe(true)
 await expect(openHadronExternalWeb(oauth.replace('S256','plain'),browser,true)).rejects.toThrow()
 await expect(openHadronExternalWeb(oauth,browser)).rejects.toThrow('project-only session')
})
it.each(['file:///C:/program.exe','javascript:alert(1)','https://auth.openai.com@evil.invalid/codex/device',
 'https://auth.openai.com.evil.invalid/codex/device','https://auth.openai.com:444/codex/device',
 'https://auth.openai.com/codex/device/','https://auth.openai.com/codex/device#fragment',
 'https://auth.openai.com/other','https://example.com/\n'])('refuses unsafe or unexpected provider address %s',async(url)=>{
 const browser=vi.fn(async()=>{})
 await expect(openHadronExternalWeb(url,browser,true)).rejects.toThrow()
 expect(browser).not.toHaveBeenCalled()
})
it('blocks generic and dedicated handoffs while a current project scope is held',async()=>{
 new ExecutionStartup(gate).initialize(root,'standard');const scope=gate.enter('owner','workspace')
 const marker=fs.readFileSync(path.join(root,'project-execution','execution.json')),browser=vi.fn(async()=>{}),file=vi.fn(async()=>'')
 await expect(openHadronExternalWeb('https://example.com/',browser)).rejects.toThrow('held')
 await expect(openHadronExternalWeb('https://auth.openai.com/codex/device',browser,true)).rejects.toThrow('held')
 await expect(openHadronExternalPath(path.join(root,'program.exe'),value=>value,file)).rejects.toThrow('held')
 expect(browser).not.toHaveBeenCalled();expect(file).not.toHaveBeenCalled()
 expect(fs.readFileSync(path.join(root,'project-execution','execution.json'))).toEqual(marker)
 gate.release(scope,'owner','workspace')
})
it('blocks a second standard host from launching through a persisted project marker',async()=>{
 new ExecutionStartup(gate).initialize(root,'project');const scope=gate.enter('owner','workspace')
 const second=new ProjectExecutionGate();new ExecutionStartup(second).initialize(root,'standard')
 expect(()=>second.assertExternalLaunchAllowed()).toThrow('saved project execution')
 expect(()=>second.assertExternalLaunchAllowed(true)).toThrow('saved project execution')
 gate.release(scope,'owner','workspace')
})
it('keeps ordinary links usable after known standard legacy activity without clearing its marker',async()=>{
 new ExecutionStartup(gate).initialize(root,'standard');gate.legacyStart('utility_process')
 const marker=fs.readFileSync(path.join(root,'project-execution','execution.json')),browser=vi.fn(async()=>{})
 await openHadronExternalWeb('https://example.com/',browser)
 expect(browser).toHaveBeenCalledOnce()
 expect(fs.readFileSync(path.join(root,'project-execution','execution.json'))).toEqual(marker)
 expect(()=>gate.enter('owner','workspace')).toThrow()
})
it('refuses both handoffs when startup persistence is corrupt, preserving the evidence',async()=>{
 fs.mkdirSync(path.join(root,'project-execution'));const marker=path.join(root,'project-execution','execution.json')
 fs.writeFileSync(marker,'partial');new ExecutionStartup(gate).initialize(root,'standard')
 expect(()=>gate.assertExternalLaunchAllowed()).toThrow('recovery')
 expect(()=>gate.assertExternalLaunchAllowed(true)).toThrow('recovery')
 expect(fs.readFileSync(marker,'utf8')).toBe('partial')
})
it('rejects non-web generic protocols and invalid file arguments before shell invocation',async()=>{
 const browser=vi.fn(async()=>{}),file=vi.fn(async()=>'')
 expect(()=>externalWebUrl('mailto:fixture@example.com')).toThrow('HTTP')
 await expect(openHadronExternalWeb('https://user:password@example.com/',browser)).rejects.toThrow()
 await expect(openHadronExternalPath(42,value=>value,file)).rejects.toThrow('Invalid')
 expect(browser).not.toHaveBeenCalled();expect(file).not.toHaveBeenCalled()
})

it('refuses upstream service links and their subdomains in Hadron',()=>{for(const url of ['https://yggchat.com/payment','https://auth.yggchat.com/','https://graviton.app/'])expect(()=>externalWebUrl(url)).toThrow('Upstream service')})
