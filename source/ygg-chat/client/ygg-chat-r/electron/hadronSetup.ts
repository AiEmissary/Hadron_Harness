import fs from 'node:fs'
import path from 'node:path'
import type {HadronSetupReport} from '../../../shared/hadronSetup.js'
/** Read-only inventory. Never execute PATH programs or silently install software. */
export function hadronSetupReport(resources:string,packaged:boolean,version:string):HadronSetupReport{
 const file=(name:string)=>{try{return fs.statSync(name).isFile()}catch{return false}}
 const available=(name:string)=>(process.env.PATH??'').split(path.delimiter).filter(path.isAbsolute).some(dir=>['.exe','.cmd','.bat'].some(ext=>file(path.join(dir,name+ext))))
 const vendor=packaged?resources:path.join(resources,'vendor')
 return {packaged,version,items:[
  {id:'electron',name:'Hadron application engine',ready:true,required:true,detail:`Electron ${process.versions.electron??'development'} and Node ${process.versions.node} are included. Do not install Electron separately.`},
  {id:'codex',name:'ChatGPT subscription engine',ready:file(path.join(vendor,'codex','node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe')),required:true,detail:'Bundled with Hadron. Connect your own ChatGPT subscription in Subscriptions.'},
  {id:'claude',name:'Claude subscription engine',ready:file(path.join(vendor,'claude-code','node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe')),required:true,detail:'Bundled with Hadron. Connect your own Claude subscription if you want Claude agents.'},
  {id:'worker',name:'Windows worker controller',ready:file(path.join(vendor,'hadron-worker','HadronWorkerHost.exe')),required:true,detail:'Included. Controls the lifetime of AI and project-check processes.'},
  {id:'licences',name:'Licences and source information',ready:file(path.join(packaged?path.join(resources,'licences'):path.resolve(resources,'../../../../distribution/licences'),'HADRON-AGPL-3.0.md')),required:true,detail:'Included licence and third-party notices. The corresponding Hadron source archive and build instructions accompany the installer.'},
  {id:'powershell',name:'Windows PowerShell',ready:file(path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe')),required:true,detail:'Windows component used to preserve file permissions when applying reviewed changes. If missing, repair this Windows component before project editing.'},
  {id:'vscode',name:'Visual Studio Code',ready:available('code'),required:false,detail:'Optional editor for opening your project yourself. Hadron does not require it.',download:'https://code.visualstudio.com/download'},
  {id:'git',name:'Git',ready:available('git'),required:false,detail:'Optional for projects that use Git version control.',download:'https://git-scm.com/install/windows'},
  {id:'node',name:'External Node.js and npm',ready:available('node')&&available('npm'),required:false,detail:'Optional for projects requiring npm package installation or external Node commands. Hadron’s built-in Node test/build-script checks use its bundled engine.',download:'https://nodejs.org/en/download'},
 ]}
}
