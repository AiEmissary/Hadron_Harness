import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const app=path.resolve(import.meta.dirname,'..'),root=path.resolve(app,'../../../..')
const compiler=path.join(process.env.SystemRoot,'Microsoft.NET','Framework64','v4.0.30319','csc.exe')
const directory=path.join(root,'local-launcher');fs.mkdirSync(directory,{recursive:true})
const output=path.join(directory,'HadronLauncher.exe')
const build=spawnSync(compiler,['/nologo','/target:winexe','/platform:x64','/optimize+','/out:'+output,path.join(app,'native','windows','HadronTestLauncher.cs')],{windowsHide:true,encoding:'utf8',timeout:30000})
if(build.status!==0)throw Error('GUI launcher build failed: '+build.stdout+build.stderr)
const check=spawnSync(output,['--check'],{windowsHide:true,timeout:10000})
if(check.status!==0)throw Error('GUI launcher configuration check failed')
// Verify the PE subsystem is WINDOWS_GUI, rather than a console application.
const binary=fs.readFileSync(output),pe=binary.readUInt32LE(0x3c)
if(binary.readUInt16LE(pe+24+68)!==2)throw Error('Launcher must use the Windows GUI subsystem')
console.log(JSON.stringify({output,guiSubsystem:true,configurationCheck:true,installerChanged:false}))
