import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
vi.mock('../keytarSecrets.js',()=>({hasBraveApiKey:vi.fn(async()=>false),getBraveApiKey:vi.fn(async()=>null)}))
import {createHadronToolSession,readHadronToolActivity} from '../hadronTools/toolSession.js'
import {withWebResearch} from '../hadronTools/webResearch.js'
import {ProjectReadHost} from '../hadronTools/projectRead.js'
import {ProjectAgentHost} from '../hadronTools/projectAgent.js'
import {isHadronToolSession,runHadronToolConversation} from '../hadronTools/types.js'
import {hasBraveApiKey} from '../keytarSecrets.js'

let root:string,reads:ProjectReadHost
const signal=()=>new AbortController().signal
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-web-research-'));reads=new ProjectReadHost();fs.writeFileSync(path.join(root,'source.txt'),'local source')})
afterEach(()=>{
 reads.clear()
 if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('hadron-web-research-'))throw Error('Invalid fixture cleanup')
 fs.rmSync(root,{recursive:true,force:true})
})
function web(){
 return createHadronToolSession({root:path.join(root,'tools'),owner:'owner',job:'job',mode:'web',read:async url=>({url:String(url),contentType:'text/html',body:'<title>Source</title><p>Public evidence</p>'})})
}
const search=()=>vi.fn(async(query:string)=>({success:true,query,provider:'Claude',summary:'Current public findings.',results:[{title:'Source',url:'https://example.com/',description:'Evidence'}]}))
it('searches through the signed-in provider without a Brave key or selected folder and records actual receipts',async()=>{
 const session=web(),provider=search();session.bindWebSearch!(provider)
 const answer=await runHadronToolConversation({session,task:'Search online',signal:signal(),generate:vi.fn().mockResolvedValueOnce('{"tool":"web_search","arguments":{"query":"public query"}}').mockResolvedValueOnce('{"answer":"Found https://example.com/"}')})
 expect(answer).toContain('example.com');expect(provider).toHaveBeenCalledOnce()
 expect(readHadronToolActivity(path.join(root,'tools'),'owner','job').map(e=>e.state)).toEqual(['started','completed'])
 await expect(session.invoke('edit_file',{},signal())).rejects.toThrow('not enabled')
})
it('keeps selected-folder reads and web research together without granting writes',async()=>{
 const grant=reads.grant('owner','workspace','a',root),folder=reads.session('owner',grant.id,'workspace','a')
 const session=withWebResearch(web(),folder),provider=search();session.bindWebSearch!(provider)
 expect(isHadronToolSession(session)).toBe(true)
 expect(await session.invoke('web_search',{query:'public query'},signal())).toMatchObject({success:true,provider:'Claude'})
 expect(session.evidenceAttempted!()).toBe(true)
 expect(await session.invoke('project_read',{path:'source.txt'},signal())).toMatchObject({text:'local source'})
 await expect(session.invoke('edit_file',{},signal())).rejects.toThrow()
})
it('retains the admitted Agent grant and work budget alongside provider web search',async()=>{
 const read=reads.grant('owner','workspace','a',root),agents=new ProjectAgentHost(reads),grant=agents.grant('owner','workspace','a',read.id),execute=vi.fn(async()=>({success:true}))
 const folder=agents.session({owner:'owner',workspace:'workspace',slot:'a',grantId:grant.id,conversationId:'chat',anchorMessageId:'question',definitions:['read_file','edit_file'].map(name=>({name,inputSchema:{type:'object'}})),execute,authorize:()=>{}})
 const session=withWebResearch(web(),folder);session.bindWebSearch!(search())
 expect(session.execution).toBe('agent');expect(session.maxRequests).toBe(100)
 expect(await session.invoke('web_search',{query:'public docs'},signal())).toMatchObject({success:true})
 expect(await session.invoke('edit_file',{path:'source.txt',operation:'replace'},signal())).toMatchObject({success:true})
 expect(execute.mock.calls[0][1]).toMatchObject({rootPath:root})
 agents.revoke('owner',grant.id)
 await expect(session.invoke('edit_file',{},signal())).rejects.toThrow('permission')
})
it('retains public-page reading without provider search or a Brave key',async()=>{
 expect(await web().invoke('web_read',{url:'https://example.com/'},signal())).toMatchObject({title:'Source',untrustedContent:true})
})
it('does not require a working optional key vault for provider-backed search on a new PC',async()=>{
 vi.mocked(hasBraveApiKey).mockRejectedValueOnce(Error('Optional credential vault unavailable'))
 const session=web(),provider=search();session.bindWebSearch!(provider)
 expect(await session.invoke('web_search',{query:'public query'},signal())).toMatchObject({success:true})
 expect(provider).toHaveBeenCalledOnce()
})
it('reports provider search failure as failed activity rather than successful evidence',async()=>{
 const activity=vi.fn(),evidence=vi.fn()
 const session=createHadronToolSession({root:path.join(root,'tools'),owner:'owner',job:'failed',mode:'web',activity,onEvidence:evidence})
 session.bindWebSearch!(async query=>({success:false,query,code:'service_unavailable',error:'Provider search allowance exhausted.'}))
 expect(await session.invoke('web_search',{query:'public query'},signal())).toMatchObject({success:false,error:'Provider search allowance exhausted.'})
 expect(activity.mock.calls).toEqual([['web_search','started'],['web_search','failed']]);expect(evidence).not.toHaveBeenCalled()
})
it('checks cancellation and workspace authority before dispatching search',async()=>{
 const provider=search(),authorize=vi.fn(()=>{throw Error('Workspace closed')})
 const session=createHadronToolSession({root:path.join(root,'tools'),owner:'owner',job:'closed',mode:'web',authorize});session.bindWebSearch!(provider)
 await expect(session.invoke('web_search',{query:'public query'},signal())).rejects.toThrow('Workspace closed')
 const controller=new AbortController();controller.abort()
 await expect(web().invoke('web_search',{query:'public query'},controller.signal)).rejects.toThrow()
 expect(provider).not.toHaveBeenCalled()
})
