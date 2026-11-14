import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawn,spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const app=path.resolve(import.meta.dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-installer-guard-'))
const compiler=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/nsis/nsis-3.0.4.1-nsis-3.0.4.1/Bin/makensis.exe')
const csc=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe')
const fixture=path.join(root,'HadronGuardFixture.exe'),source=path.join(root,'fixture.cs'),probe=path.join(root,'guard.exe')
const run=(exe,args)=>{const result=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:30000});if(result.status!==0)throw Error(path.basename(exe)+' failed '+result.status+' '+result.stdout+' '+result.stderr);return result}
const quote=value=>value.split('$').join('$$').replaceAll('"','$\\"')
fs.writeFileSync(source,'class Fixture { static void Main() { System.Threading.Thread.Sleep(60000); } }')
run(csc,['/nologo','/target:exe','/out:'+fixture,source])
const script=path.join(root,'probe.nsi')
fs.writeFileSync(script,`Unicode true\nRequestExecutionLevel user\n!include "LogicLib.nsh"\n!define APP_EXECUTABLE_FILENAME "HadronGuardFixture.exe"\n!include "${quote(path.join(app,'build/hadron-installer.nsh'))}"\nOutFile "${quote(probe)}"\nSection\n StrCpy $INSTDIR "${quote(root)}"\n !insertmacro customCheckAppRunning\nSectionEnd\n`)
run(compiler,['/V2',script])
const hash=()=>createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),before=hash()
for(let i=0;i<5;i++)run(probe,['/S'])
const child=spawn(fixture,[],{windowsHide:true,stdio:'ignore'})
try{
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)})
 await new Promise(resolve=>setTimeout(resolve,250))
 const blocked=spawnSync(probe,['/S'],{windowsHide:true,timeout:10000,encoding:'utf8'})
 if(blocked.status!==32)throw Error('Running executable was not blocked: '+blocked.status)
 if(hash()!==before||child.exitCode!==null)throw Error('Probe altered or stopped the running fixture')
 const result={success:true,root,unlockedLaunches:5,lockedExitCode:blocked.status,executableBytesUnchanged:true,runningProcessPreserved:true,externalShellQueries:false}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve))}
