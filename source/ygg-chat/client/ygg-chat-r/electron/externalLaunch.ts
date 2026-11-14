import {projectExecutionGate} from '../server/hadronTools/executionGate.js'
import {codexBrowserSignInUrl} from '../server/auth/hadronCodexSignIn.js'

/** All Electron shell handoffs pass here. The login exception is host-only;
 * a URL supplied through a generic renderer channel remains a generic link. */
export function externalWebUrl(raw:unknown,providerLogin=false):string{
  if(typeof raw!=='string'||raw.length>16384||/[\u0000-\u0020\u007f]/.test(raw))throw Error('Invalid external web address')
  const url=new URL(raw)
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Only HTTP or HTTPS web addresses can be opened')
  if(/(^|\.)(yggchat\.com|graviton\.app|graviton\.ai|yggdrasil\.ai)$/i.test(url.hostname))throw Error('Upstream service links are not available in Hadron')
  if(providerLogin&&!codexBrowserSignInUrl(raw)&&(url.origin!=='https://auth.openai.com'||
    !['/codex/device','/api/accounts/authorize'].includes(url.pathname)||url.hash))throw Error('Unexpected Hadron provider sign-in address')
  return url.toString()
}

export async function openHadronExternalWeb(raw:unknown,open:(url:string)=>Promise<unknown>,providerLogin=false):Promise<void>{
  const url=externalWebUrl(raw,providerLogin)
  projectExecutionGate.assertExternalLaunchAllowed(providerLogin)
  await open(url)
}

export async function openHadronExternalPath(raw:unknown,normalize:(value:string)=>string,open:(value:string)=>Promise<string>):Promise<string>{
  if(typeof raw!=='string'||!raw||raw.length>32768||raw.includes('\0'))throw Error('Invalid external file path')
  const normalized=normalize(raw)
  projectExecutionGate.assertExternalLaunchAllowed()
  return open(normalized)
}
