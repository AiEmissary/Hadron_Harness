import {publicUrl} from './publicWeb.js'

export function providerSearchFailure(provider:string,query:string,error:unknown){
  const message=error instanceof Error?error.message:''
  const reason=/sign-in|not connected|connection changed|account changed/i.test(message)?'needs its provider connection checked in the setup pop-up':/usage allowance|usage limit|rate limit/i.test(message)?'has reached its provider usage allowance':/selected model|with this model/i.test(message)?'did not execute web search with the selected model; choose a search-capable model':/time limit|timed out/i.test(message)?'did not finish its provider web search before the time limit':'did not return a confirmed provider web-search result'
  return {success:false,query,code:'service_unavailable' as const,error:provider+' '+reason+'. Public-page reading is still available. No Brave API key is required for provider search.'}
}

/** Keep source URLs from actual search receipts, never promote links invented in the final prose. */
export function providerSearchEvidence(provider:string,query:string,summary:string,sources:unknown){
  const results:Array<{title:string;url:string;description:string}>=[]
  const add=(value:string,title?:string)=>{
    try{
      const url=publicUrl(value.replace(/[.,;]+$/,'')).href
      if(url.length>2048||results.some(item=>item.url===url)||results.length>=5)return
      results.push({title:(title||new URL(url).hostname).slice(0,250),url,description:'Source returned by '+provider+' web search.'})
    }catch{/* Non-public and non-URL source entries are omitted. */}
  }
  const visit=(value:unknown,depth=0):void=>{
    if(depth>8)return
    if(typeof value==='string')for(const match of value.slice(0,100000).matchAll(/https?:\/\/[^\s<>"\\)\]}]+/g))add(match[0])
    else if(Array.isArray(value))for(const item of value.slice(0,100))visit(item,depth+1)
    else if(value&&typeof value==='object'){
      const source=value as Record<string,unknown>
      if(typeof source.url==='string')add(source.url,typeof source.title==='string'?source.title:undefined)
      for(const [key,item] of Object.entries(source))if(key!=='url')visit(item,depth+1)
    }
  }
  visit(sources)
  return {success:true,query,provider,summary:summary.slice(0,6000),results}
}

/** A dedicated Claude -p search run has only WebSearch; it cannot read/write files or run commands. */
export function claudeWebSearchResult(raw:string){
  const frames=raw.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))
  const init=frames.filter(frame=>frame.type==='system'&&frame.subtype==='init'),ends=frames.filter(frame=>frame.type==='result')
  if(init.length!==1||JSON.stringify(init[0].tools)!=='["WebSearch"]'||!Array.isArray(init[0].mcp_servers)||init[0].mcp_servers.length)throw Error('Claude search capability changed')
  const calls=new Set<string>(),receipts=new Map<string,unknown>()
  for(const frame of frames){
    if(!['system','assistant','user','result','rate_limit_event'].includes(frame.type)||frame.subtype==='permission_denied')throw Error('Unexpected search output')
    if(frame.type==='assistant')for(const part of frame.message?.content??[]){
      if(part.type==='tool_use'){
        if(part.name!=='WebSearch'||typeof part.id!=='string'||calls.has(part.id)||calls.size>=3)throw Error('Unexpected search tool')
        calls.add(part.id)
      }else if(!['text','thinking','redacted_thinking'].includes(part.type))throw Error('Unexpected search content')
    }
    if(frame.type==='user'){
      if(!Array.isArray(frame.message?.content)||!frame.message.content.length)throw Error('Missing search receipt')
      for(const part of frame.message.content){
        if(part.type!=='tool_result'||!calls.has(part.tool_use_id)||receipts.has(part.tool_use_id)||part.is_error===true)throw Error('Search did not return confirmed evidence')
        receipts.set(part.tool_use_id,part.content)
      }
    }
  }
  const end=ends[0]
  if(ends.length!==1||frames.at(-1)!==end||end.subtype!=='success'||end.is_error!==false||!Number.isInteger(end.num_turns)||end.num_turns<2||end.num_turns>6||!Array.isArray(end.permission_denials)||end.permission_denials.length||!calls.size||calls.size!==receipts.size||typeof end.result!=='string'||!end.result.trim()||end.result.length>16000)throw Error('Claude search did not complete')
  return {summary:end.result,sources:[...receipts.values()]}
}
