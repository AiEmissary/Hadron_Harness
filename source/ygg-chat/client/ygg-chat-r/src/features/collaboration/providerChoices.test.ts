import {expect,it,vi} from 'vitest'
import {refreshProviderChoices} from './providerChoices'

const setup = () => Promise.resolve({schemaVersion:1,ownerAvailable:true,liveEnabled:true,provider:{id:'openaichatgpt',connected:true,models:[{id:'gpt-test',label:'GPT'}]}})
const callbacks = () => ({setup:vi.fn(),provider:vi.fn(),error:vi.fn()})
it('keeps Claude available when ChatGPT setup fails', async () => {
 const cb=callbacks()
 await refreshProviderChoices({setup:async()=>{throw Error('unavailable')},claudeModels:async()=>[{id:'sonnet',label:'Sonnet'}]},cb)
 expect(cb.provider).toHaveBeenCalledWith(expect.objectContaining({provider:'claudecode',connected:true}))
 expect(cb.error).toHaveBeenCalledWith('ChatGPT')
})
it('keeps ChatGPT available when Claude fails and exposes recovery',async()=>{
 const cb=callbacks()
 await refreshProviderChoices({setup,claudeModels:async()=>{throw Error('unavailable')}},cb)
 expect(cb.setup).toHaveBeenCalledWith(true,true)
 expect(cb.provider).toHaveBeenCalledWith(expect.objectContaining({provider:'openaichatgpt',connected:true}))
 expect(cb.error).toHaveBeenCalledWith('Claude')
 expect(cb.provider).toHaveBeenCalledWith(expect.objectContaining({provider:'claudecode',connected:false,models:[]}))
})
it('publishes a ready provider without waiting for the other runtime',async()=>{
 const cb=callbacks();let finish!:(models:[])=>void
 const pending=refreshProviderChoices({setup,claudeModels:()=>new Promise(resolve=>{finish=resolve})},cb)
 await vi.waitFor(()=>expect(cb.provider).toHaveBeenCalledWith(expect.objectContaining({provider:'openaichatgpt',connected:true})))
 finish([]);await pending
})
it('refresh replaces disconnected choices with actual models',async()=>{
 const cb=callbacks()
 await refreshProviderChoices({setup:async()=>({...await setup(),provider:{id:'openaichatgpt',connected:false,models:[]}}),claudeModels:async()=>[]},cb)
 expect(cb.provider).toHaveBeenCalledWith(expect.objectContaining({provider:'openaichatgpt',connected:false}))
 cb.provider.mockClear()
 await refreshProviderChoices({setup,claudeModels:async()=>[{id:'sonnet',label:'Sonnet'}]},cb)
 expect(cb.provider.mock.calls.map(([option])=>option.connected)).toEqual([true,true])
})
