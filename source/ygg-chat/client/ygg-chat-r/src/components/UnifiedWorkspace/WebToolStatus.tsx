import {useEffect,useState} from 'react'

export function WebToolStatus(){
  const [brave,setBrave]=useState<'checking'|'configured'|'missing'|'unknown'>('checking')
  useEffect(()=>{
    let active=true
    void Promise.resolve().then(()=>window.electronAPI.secrets.braveSearch.has()).then(result=>{
      if(active)setBrave(result.success?(result.configured?'configured':'missing'):'unknown')
    }).catch(()=>{if(active)setBrave('unknown')})
    return()=>{active=false}
  },[])
  return <section aria-label='Online tools' className='hadron-v2-hint'>
    <strong>Online tools</strong>
    <p>Web search uses the selected agent’s signed-in provider. No extra key or folder is needed. Public-page reading is included in Chat and Agent.</p>
    <p role='status'>Optional Brave search: {brave==='configured'?'key configured (not a connection test).':brave==='missing'?'not configured; provider search is used.':brave==='checking'?'checking saved-key status…':'key status unavailable; provider sign-in is separate.'}</p>
    <p>Brave setup: Settings → Agents and tools → Web search. Model support, account restrictions and usage limits can still block provider search. These tools read public pages; they do not sign in to websites or submit forms.</p>
  </section>
}
