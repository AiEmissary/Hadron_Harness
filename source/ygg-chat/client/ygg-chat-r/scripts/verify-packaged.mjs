import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
import {collectRuntimePackages} from './runtime-packaging.mjs'
import {codexResource} from './codex-packaging.mjs'
import {claudeResource} from './claude-packaging.mjs'

// Hoisted workspace dependencies and nested vendor node_modules can be omitted
// by electron-builder's collectors. Copy only the admitted npm package trees,
// never the workspace or a user profile. This hook runs before NSIS creation.
export default async function afterPack(context){
 const appDir=context.packager.info.appDir,resources=path.join(context.appOutDir,'resources')
 if(context.electronPlatformName!=='win32')throw Error('Release validation currently supports Windows only')
 const require=createRequire(path.join(appDir,'package.json'))
 for(const name of collectRuntimePackages(appDir)){
  const manifest=require.resolve.paths(name+'/package.json').map(root=>path.join(root,name,'package.json')).find(file=>fs.existsSync(file))
  if(!manifest)throw Error('Missing runtime package '+name)
  fs.cpSync(path.dirname(manifest),path.join(resources,'node_modules',name),{recursive:true})
 }
 for(const entry of [codexResource(appDir,'win32','x64'),claudeResource(appDir,'win32','x64')]){
  const relative=entry.to==='codex'?'node_modules/@openai/codex-win32-x64':'node_modules/@anthropic-ai/claude-code-win32-x64'
  fs.cpSync(path.join(entry.from,relative),path.join(resources,entry.to,relative),{recursive:true})
  // Preserve the vendor's wrapper package notices as well as native notices.
  const wrapper=entry.to==='codex'?'@openai/codex':'@anthropic-ai/claude-code'
  const source=path.join(entry.from,'node_modules',wrapper)
  for(const name of fs.readdirSync(source).filter(name=>/^(package\.json|LICENSE.*|NOTICE.*|README.*)$/.test(name))){
   const target=path.join(resources,entry.to,'node_modules',wrapper,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,name),target)
  }
 }
 const executable=path.join(context.appOutDir,'The Hadron Harness.exe')
 const code=`const {createRequire}=require('node:module');const r=createRequire(${JSON.stringify(path.join(resources,'validation.cjs'))});const DB=r('better-sqlite3');const db=new DB(':memory:');r('sqlite-vec').load(db);db.close();r('keytar');r('node-pty');console.log('PACKAGED_NATIVE_OK')`
 const native=spawnSync(executable,['-e',code],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'utf8',windowsHide:true,timeout:15000})
 if(native.status!==0||!native.stdout.includes('PACKAGED_NATIVE_OK'))throw Error('Packaged native dependency check failed: '+native.stderr)
 const binaries=[['codex','node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'],['claude-code','node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe']]
 for(const [directory,relative] of binaries){const result=spawnSync(path.join(resources,directory,relative),['--version'],{encoding:'utf8',windowsHide:true,timeout:20000});if(result.status!==0)throw Error('Packaged vendor engine failed: '+directory);console.log('[packaging] '+result.stdout.trim())}
 console.log('[packaging] Packaged native dependencies and both vendor engines passed')
}
