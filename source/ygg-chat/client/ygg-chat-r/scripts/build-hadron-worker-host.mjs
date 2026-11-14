import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const root=path.resolve(import.meta.dirname,'..')
if(process.platform!=='win32'||process.arch!=='x64')throw Error('Native worker host currently requires Windows x64')
const systemRoot=process.env.SystemRoot??process.env.WINDIR
if(!systemRoot||!path.isAbsolute(systemRoot))throw Error('Trusted Windows system directory required')
const compiler=path.join(systemRoot,'Microsoft.NET','Framework64','v4.0.30319','csc.exe')
if(!fs.lstatSync(compiler).isFile()||fs.lstatSync(compiler).isSymbolicLink())throw Error('Native worker compiler unavailable')
const directory=path.join(root,'vendor','hadron-worker');fs.mkdirSync(directory,{recursive:true})
const source=path.join(root,'native','windows','HadronWorkerHost.cs'),binary=path.join(directory,'HadronWorkerHost.exe')
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const recipeHash=createHash('sha256').update(digest(source)+digest(compiler)+digest(import.meta.filename)).digest('hex')
let reusable=false
try{const recorded=JSON.parse(fs.readFileSync(path.join(directory,'build.json'),'utf8'));reusable=fs.lstatSync(binary).isFile()&&!fs.lstatSync(binary).isSymbolicLink()&&recorded.version===1&&recorded.recipeHash===recipeHash&&recorded.sourceHash===digest(source)&&recorded.binaryHash===digest(binary)}catch{}
if(reusable){console.log('Reused verified Windows x64 worker; unchanged source, compiler, recipe and binary')}
else{
const result=spawnSync(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/reference:System.Web.Extensions.dll','/out:'+binary,source],{shell:false,windowsHide:true,encoding:'utf8',timeout:30000})
if(result.status!==0||result.error)throw Error('Native worker compilation failed: '+result.stdout+result.stderr)
fs.writeFileSync(path.join(directory,'build.json'),JSON.stringify({version:1,recipeHash,sourceHash:digest(source),binaryHash:digest(binary)},null,2)+'\n')
console.log('Built Windows x64 HadronWorkerHost with source/binary hashes')

}
