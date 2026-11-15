import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,copyFile,mkdir} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
if(!process.argv.includes('--live'))throw Error('Explicit --live required: two bounded public searches using existing provider sign-ins; no new login or user-chat changes.')
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),temporary=await mkdtemp(path.join(os.tmpdir(),'hadron-web-search-'))
const outfile=path.join(root,'node_modules/.cache/hadron/web-search-acceptance.mjs')
await build({entryPoints:[path.join(root,'electron/hadronWebSearchAcceptance.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}})
const env={...process.env,HADRON_WEB_CHECK_DIRECTORY:temporary,HADRON_WEB_CHECK_APP:root,...(process.argv.includes('--chatgpt-only')?{HADRON_WEB_CHECK_ONLY:'chatgpt'}:{})};delete env.ELECTRON_RUN_AS_NODE
console.log('Isolated web-search check: '+temporary)
const child=spawn(require('electron'),[outfile],{cwd:root,env,windowsHide:true,stdio:'ignore'})
const timer=setTimeout(()=>child.kill(),300000)
child.on('exit',async code=>{
 clearTimeout(timer)
 try{
  const file=path.join(temporary,'result.json'),report=await readFile(file,'utf8')
  const evidence=path.resolve(root,'../../../..','test-results');await mkdir(evidence,{recursive:true});await copyFile(file,path.join(evidence,'web-search-live.json'))
  console.log(report)
 }catch{console.log('No completed live-search report was produced.')}
 process.exitCode=code??1
})
