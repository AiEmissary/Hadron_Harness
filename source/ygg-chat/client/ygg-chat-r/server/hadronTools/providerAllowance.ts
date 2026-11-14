export interface ProviderAllowance {reportedAt:string;windows:Array<{label:string;remainingPercent:number;resetsAt:string|null}>;limited:boolean}
function window(label:string,used:unknown,reset:unknown){
 if(typeof used!=='number'||!Number.isFinite(used)||used<0||used>100)return null
 const seconds=typeof reset==='number'&&Number.isFinite(reset)&&reset>0&&reset<253402300799?reset:null
 return {label,remainingPercent:Math.round((100-used)*10)/10,resetsAt:seconds?new Date(seconds*1000).toISOString():null}
}
export function codexAllowance(raw:any):ProviderAllowance|null{
 const limits=raw?.rateLimits;if(!limits)return null
 const label=(minutes:unknown,fallback:string)=>minutes===10080?'Weekly':typeof minutes==='number'&&minutes>0?`${minutes/60} hours`:fallback
 const windows=[window(label(limits.primary?.windowDurationMins,'Session'),limits.primary?.usedPercent,limits.primary?.resetsAt),window(label(limits.secondary?.windowDurationMins,'Longer window'),limits.secondary?.usedPercent,limits.secondary?.resetsAt)].filter(item=>item!==null)
 const limited=raw.ordinaryUsageAllowed===false||limits.spendControlReached===true||!!limits.rateLimitReachedType
 return windows.length||limited?{reportedAt:new Date().toISOString(),windows,limited}:null
}
export function claudeAllowance(raw:string):ProviderAllowance|null{
 let result:ProviderAllowance|null=null
 for(const line of raw.split(/\r?\n/))try{
  const event=JSON.parse(line);if(event.type!=='rate_limit_event')continue
  const info=event.rate_limit_info
  const windows=[['five_hour','5 hours'],['seven_day','Weekly']].map(([key,label])=>{const value=info?.unifiedWindows?.[key];return window(label,typeof value?.utilization==='number'?value.utilization*100:null,value?.resetsAt)}).filter(item=>item!==null)
  if(windows.length||info?.status==='rejected')result={reportedAt:new Date().toISOString(),windows,limited:info.status==='rejected'}
 }catch{/* Ignore non-usage frames; no raw provider data reaches the UI. */}
 return result
}
