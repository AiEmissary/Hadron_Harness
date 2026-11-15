import {expect,it} from 'vitest'
import {claudeWebSearchResult,providerSearchEvidence} from '../hadronTools/providerWebSearch.js'
const frames=()=>[
 {type:'system',subtype:'init',tools:['WebSearch'],mcp_servers:[]},
 {type:'assistant',message:{content:[{type:'tool_use',id:'search',name:'WebSearch',input:{query:'public query'}}]}},
 {type:'user',message:{content:[{type:'tool_result',tool_use_id:'search',content:[{type:'text',text:'Links: [{"title":"Official source","url":"https://example.com/"}]'}]}]}},
 {type:'assistant',message:{content:[{type:'text',text:'Current findings.'}]}},
 {type:'result',subtype:'success',is_error:false,num_turns:2,permission_denials:[],result:'Current findings.'},
]
const raw=()=>frames().map(frame=>JSON.stringify(frame)).join('\n')
it('requires actual acknowledged WebSearch execution before accepting Claude research',()=>{
 const result=claudeWebSearchResult(raw())
 expect(result.summary).toBe('Current findings.')
 expect(providerSearchEvidence('Claude','query',result.summary,result.sources).results[0].url).toBe('https://example.com/')
})
it('rejects native file/shell tools, foreign receipts, errors and incomplete search runs',()=>{
 const source=raw()
 for(const bad of [
  source.replaceAll('WebSearch','Bash'),
  source.replace('"tools":["WebSearch"]','"tools":["WebSearch","Read"]'),
  source.replace('"tool_use_id":"search"','"tool_use_id":"foreign"'),
  source.replace('"tool_result",','"tool_result","is_error":true,'),
  source.replace('"num_turns":2','"num_turns":1'),
  frames().filter(frame=>!['assistant','user'].includes(frame.type)).map(frame=>JSON.stringify(frame)).join('\n'),
  frames().slice(0,-1).map(frame=>JSON.stringify(frame)).join('\n')
 ])expect(()=>claudeWebSearchResult(bad)).toThrow()
})
it('takes source links from search receipts, omitting invented final-answer links and unsafe schemes',()=>{
 const result=providerSearchEvidence('ChatGPT','query','See https://invented.invalid/',[{title:'Source',url:'https://example.com/'},{url:'file:///secret'},{url:'https://user:password@example.com/'},{url:'http://localhost/'}])
 expect(result.results).toEqual([{title:'Source',url:'https://example.com/',description:'Source returned by ChatGPT web search.'}])
})
