// Stage application resources for a local test. Never builds or changes an EXE.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),asar=require('@electron/asar')
const app=path.resolve(import.meta.dirname,'..'),installed=path.join(process.env.LOCALAPPDATA,'Programs/Hadron-Harness')
const original=path.join(installed,'resources/app.asar'),exe=path.join(installed,'The Hadron Harness.exe')
const parent=path.join(process.env.LOCALAPPDATA,'Hadron-Harness/Local-Test-Builds')
fs.mkdirSync(parent,{recursive:true})
const root=fs.mkdtempSync(path.join(parent,'access-')),source=path.join(root,'application'),candidate=path.join(root,'app.asar')
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const installedVersion=JSON.parse(asar.extractFile(original,'package.json').toString()).version
if(installedVersion!=='0.4.17')throw Error('Expected the current installed 0.4.17 baseline')
asar.extractAll(original,source)
const renderer=path.resolve(source,'dist-electron')
if(!renderer.startsWith(path.resolve(root)+path.sep))throw Error('Invalid staging directory')
fs.rmSync(renderer,{recursive:true,force:true})
fs.cpSync(path.join(app,'dist-electron'),renderer,{recursive:true})
for(const name of ['main.mjs','preload.mjs','toolRuntimeUtility.mjs','localAnalyticsWorker.mjs'])fs.copyFileSync(path.join(app,'electron',name),path.join(source,'electron',name))
fs.cpSync(path.join(app,'server/headlessServer/ui/mobile'),path.join(source,'server/headlessServer/ui/mobile'),{recursive:true})
const manifest=path.join(source,'package.json'),data=JSON.parse(fs.readFileSync(manifest,'utf8'))
data.hadronLocalTest='Conversation actions and direct file work; installer unchanged'
fs.writeFileSync(manifest,JSON.stringify(data,null,2))
// Preserve each installed entry's unpacked status; platform glob syntax must not
// accidentally pack a utility worker that Electron starts as a real disk file.
const streams=[]
function entries(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){
 const file=path.join(directory,item.name),relative=path.relative(source,file);let unpacked=false
 try{unpacked=asar.statFile(original,relative,false).unpacked===true}catch{/* New renderer assets stay packed. */}
 const stat=fs.lstatSync(file)
 if(item.isSymbolicLink())throw Error('Unexpected staged application link')
 if(item.isDirectory()){streams.push({path:relative,type:'directory',unpacked});entries(file)}
 else streams.push({path:relative,type:'file',unpacked,stat,streamGenerator:()=>fs.createReadStream(file)})
}}
entries(source)
await asar.createPackageFromStreams(candidate,streams)
const unpacked=path.join(root,'app.asar.unpacked'),files=[]
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw Error('Unexpected unpacked link');if(entry.isDirectory())walk(file);else files.push(file)}}
walk(unpacked)
for(const file of files){
 const relative=path.relative(unpacked,file)
 if(relative===path.join('electron','localAnalyticsWorker.mjs'))continue
 const baseline=path.join(original+'.unpacked',relative)
 if(!fs.existsSync(baseline)||hash(file)!==hash(baseline))throw Error('Native/unpacked baseline changed: '+relative)
}
if(!asar.extractFile(candidate,'electron/main.mjs').equals(fs.readFileSync(path.join(app,'electron/main.mjs'))))throw Error('Staged main differs from tested build')
const result={root,installedVersion,installedExeSha256:hash(exe),baselineArchiveSha256:hash(original),candidateArchiveSha256:hash(candidate),unpackedNativeFilesUnchanged:true,installerRebuilt:false,exeChanged:false}
fs.writeFileSync(path.join(root,'staging.json'),JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))
