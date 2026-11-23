import {useEffect,useState} from 'react'
import type {ProviderAllowance as Allowance} from '../../../server/hadronTools/providerAllowance'
export function ProviderAllowance({provider,refreshKey}:{provider:string|undefined;refreshKey?:string}){
 const [state,setState]=useState<{provider:string;value:Allowance|null;done:boolean}>()
 useEffect(()=>{
  if(!provider)return
  let current=true
  const refresh=()=>{const read=window.electronAPI?.collaboration.providerAllowance;if(!read){setState({provider,value:null,done:true});return}void read(provider).then(value=>{if(current)setState({provider,value,done:true})}).catch(()=>{if(current)setState({provider,value:null,done:true})})}
  refresh();window.addEventListener('focus',refresh)
  return()=>{current=false;window.removeEventListener('focus',refresh)}
 },[provider,refreshKey])
 if(!provider)return null
 const value=state?.provider===provider?state.value:null
 return <div className='hadron-v2-hint' aria-label='Provider allowance' aria-live='polite'>
  {!state||state.provider!==provider?'Checking provider allowance…':!value?'Remaining allowance is not reported yet.':<>
   {value.limited&&<strong>Provider usage limit reached. </strong>}
   {value.windows.map(item=><div key={item.label}>{item.label}: {item.remainingPercent}% remaining{item.resetsAt?` · resets ${new Date(item.resetsAt).toLocaleString()}`:''}</div>)}
   {value.note&&<div>{value.note}</div>}
   <div>Last reported: {new Date(value.reportedAt).toLocaleString()}</div>
  </>}
  <div>Providers do not report an exact number of tokens or minutes left.</div>
 </div>
}
