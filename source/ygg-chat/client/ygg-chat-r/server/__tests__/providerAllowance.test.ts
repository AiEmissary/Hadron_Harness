import {expect,it} from 'vitest'
import {codexAllowance,claudeAllowance} from '../hadronTools/providerAllowance.js'
it('reports bounded subscription windows without exposing account metadata',()=>{
 const value=codexAllowance({ordinaryUsageAllowed:false,rateLimits:{primary:{usedPercent:20,resetsAt:1794433200},secondary:{usedPercent:100,resetsAt:1794564000}},accountId:'private'})
 expect(value?.windows.map(w=>w.remainingPercent)).toEqual([80,0]);expect(value?.limited).toBe(true)
 expect(JSON.stringify(value)).not.toContain('private')
 expect(codexAllowance({rateLimits:{primary:{usedPercent:NaN},secondary:{usedPercent:120}}})).toBeNull()
})
it('reads the latest real Claude allowance event and ignores conversation text',()=>{
 const frame={type:'rate_limit_event',rate_limit_info:{status:'allowed',unifiedWindows:{five_hour:{utilization:0.07,resetsAt:1794433200},seven_day:{utilization:0.09,resetsAt:1794564000}}}}
 const result=claudeAllowance(JSON.stringify(frame)+'\n'+JSON.stringify({type:'assistant',text:'private account'}))
 expect(result?.windows.map(w=>w.remainingPercent)).toEqual([93,91]);expect(result?.limited).toBe(false)
 expect(claudeAllowance('not json')).toBeNull()
})

it('does not infer blocked service from an exhausted included window when extra usage is allowed',()=>{expect(codexAllowance({ordinaryUsageAllowed:true,rateLimits:{primary:{usedPercent:100}}})?.limited).toBe(false)})
