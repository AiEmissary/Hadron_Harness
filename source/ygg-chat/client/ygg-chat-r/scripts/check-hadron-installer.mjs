import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawn,spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
if(!process.argv.includes('--run-install-test'))throw Error('Explicit --run-install-test required')
const app=path.resolve(import.meta.dirname,'..')
const baselineIndex=process.argv.indexOf('--baseline');let installer=baselineIndex>=0?path.resolve(process.argv[baselineIndex+1]??''):path.join(app,'release/Hadron-Harness-0.4.0-win-x64.exe')
if(path.dirname(installer)!==path.join(app,'release')||!/^Hadron-Harness-[0-9.]+-win-x64\.exe$/.test(path.basename(installer)))throw Error('Only an explicit Hadron baseline release can be tested')
const upgradeIndex=process.argv.indexOf('--upgrade'),upgrade=upgradeIndex>=0?path.resolve(process.argv[upgradeIndex+1]??''):null
if(upgrade&&(path.dirname(upgrade)!==path.join(app,'release')||!/^Hadron-Harness-[0-9.]+-win-x64\.exe$/.test(path.basename(upgrade))))throw Error('Only a Hadron release candidate can be tested')
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-installer-check-')),destination=path.join(root,'application')
const diagnostic=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-release-check-install-'))
const fixtureIndex=process.argv.indexOf('--fixture-profile')
if(fixtureIndex>=0){const fixture=path.resolve(process.argv[fixtureIndex+1]??'');if(path.dirname(fixture)!==path.resolve(os.tmpdir())||!path.basename(fixture).startsWith('hadron-desktop-smoke-'))throw Error('Only a disposable smoke fixture may be restored');const proof=JSON.parse(fs.readFileSync(path.join(fixture,'jobs-result.json'),'utf8'));if(!proof.success||!proof.syntheticInference||proof.realCredentialsUsed!==false)throw Error('Fixture credentials/scope not confirmed');fs.cpSync(fixture,diagnostic,{recursive:true})}
const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe')
function ps(code){const r=spawnSync(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:20000});if(r.status!==0)throw Error(r.stderr||'PowerShell check failed');return r.stdout.trim()}
const q=value=>"'"+value.replaceAll("'","''")+"'"
function rawRegistrations(){const text=ps("@(Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' -ErrorAction SilentlyContinue | Get-ItemProperty -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Hadron*' } | Select-Object DisplayName,InstallLocation,UninstallString,PSPath) | ConvertTo-Json -Compress");return text?JSON.parse(text):[]}
const protectedRegistrations=[rawRegistrations()].flat()
const preserveMachine=process.argv.includes('--preserve-stale-machine-entry')
if(protectedRegistrations.length&&(!preserveMachine||protectedRegistrations.length!==1||!protectedRegistrations[0].PSPath?.includes('HKEY_LOCAL_MACHINE')||protectedRegistrations[0].UninstallString!=='"C:UsersrajkaAppDataLocalProgramsHadron-Harness\\Uninstall The Hadron Harness.exe" /allusers'))throw Error('Existing installed Hadron found; installer test refused to replace it')
function registered(){return [rawRegistrations()].flat().filter(item=>!protectedRegistrations.some(original=>JSON.stringify(original)===JSON.stringify(item)))}
const desktop=ps("[Environment]::GetFolderPath('Desktop')"),programs=ps("[Environment]::GetFolderPath('Programs')")
const desktopCopy=process.argv.includes('--desktop-copy')
if(desktopCopy){
 const delivered=path.join(desktop,path.basename(installer)),expected=createHash('sha256').update(fs.readFileSync(installer)).digest('hex')
 if(!fs.existsSync(delivered))fs.copyFileSync(installer,delivered,fs.constants.COPYFILE_EXCL)
 if(createHash('sha256').update(fs.readFileSync(delivered)).digest('hex')!==expected)throw Error('Desktop file differs from the owned installer; nothing was replaced')
 installer=delivered
}
function links(directory){if(!fs.existsSync(directory))return [];return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const file=path.join(directory,entry.name);return entry.isDirectory()?links(file):entry.isFile()&&/hadron.*\.lnk$/i.test(entry.name)?[file]:[]})}
const saved=new Map([...links(desktop),...links(programs)].map(file=>[file,fs.readFileSync(file)]))
const defaultMode=process.argv.includes('--test-default-mode')
const installArguments=['/S',...(defaultMode?[]:['/currentuser']),'/D='+destination]
const installerLauncher=process.argv.includes('--debug-installer')?'debug':process.argv.includes('--native-installer')?'windows-native':'node'
if(process.argv.includes('--debug-installer')&&process.argv.includes('--native-installer'))throw Error('Choose one installer launcher')
if(process.argv.includes('--legacy-baseline')&&!upgrade)throw Error('Legacy baseline exemption requires a version-upgrade test')
const report={success:false,installerLauncher,defaultInstallMode:defaultMode,desktopCopy,root,cleanWindows:false,scope:'Real NSIS current-user installation, same-version repair install and uninstall on this existing Windows host; isolated installation directory and diagnostic profile.',personalProfilesUsed:false}
const run=(file,args,timeout=120000,env=process.env)=>{
 let target=file,parameters=args,childTimeout=timeout
 const nsis=/^Hadron-Harness-[0-9.]+-win-x64\.exe$/.test(path.basename(file))
 if(nsis&&installerLauncher!=='node'){
  let command
  if(installerLauncher==='debug'){
   const body=fs.readFileSync(path.join(app,'scripts/debug-hadron-installer.ps1'),'utf8').replace(/^param[^\n]*\n/,'').replaceAll('$PSScriptRoot',q(path.join(app,'scripts')))
   command='$Installer='+q(file)+';$ArgumentsJson='+q(JSON.stringify(args))+';$Report='+q(path.join(root,'installer-debug-'+Date.now()+'.json'))+';'+body
   childTimeout=150000
  }else{
   command='$p=Start-Process -FilePath '+q(file)+' -ArgumentList @('+args.map(q).join(',')+') -PassThru -WindowStyle Hidden;if(-not $p.WaitForExit('+timeout+')){$p.Kill();exit 1460};exit $p.ExitCode'
   childTimeout=timeout+10000
  }
  target=powershell;parameters=['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')]
 }
 const r=spawnSync(target,parameters,{encoding:'utf8',windowsHide:true,timeout:childTimeout,env})
 fs.appendFileSync(path.join(root,'process-output.log'),r.stdout||'');fs.appendFileSync(path.join(root,'process-output.log'),r.stderr||'')
 if(r.status!==0)throw Error('Test process failed: '+path.basename(file)+' exit '+r.status+' '+(r.stderr||r.error||''))
 return r
}
const executable=path.join(destination,'The Hadron Harness.exe')
function chatSnapshot(){const code=`const {createRequire}=require('node:module');const r=createRequire(${JSON.stringify(path.join(destination,'resources/probe.cjs'))});const DB=r('better-sqlite3');const db=new DB(${JSON.stringify(path.join(diagnostic,'local-sync.db'))},{readonly:true});console.log(JSON.stringify(db.prepare('SELECT id,content FROM messages ORDER BY id').all()));db.close()`;return JSON.parse(run(executable,['-e',code],20000,{...process.env,ELECTRON_RUN_AS_NODE:'1'}).stdout)}
let installed=false
try{
 if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('hadron-installer-check-')||fs.existsSync(destination))throw Error('Unsafe test destination')
 run(installer,installArguments);installed=true
 if(!fs.existsSync(executable))throw Error('Installer did not respect isolated destination')
 report.installed=true
 const created=links(desktop).find(file=>!saved.has(file)||!saved.get(file).equals(fs.readFileSync(file)))
 if(!created)throw Error('Desktop shortcut missing')
 const target=ps(`(New-Object -ComObject WScript.Shell).CreateShortcut(${q(created)}).TargetPath`)
 if(path.resolve(target)!==executable)throw Error('Desktop shortcut target incorrect')
 report.shortcutCorrect=true
 run(executable,['--hadron-diagnose='+diagnostic],55000)
 const first=JSON.parse(fs.readFileSync(path.join(diagnostic,'release-check.json'),'utf8'));if(!first.success)throw Error('Installed application diagnostic failed')
 report.installedStartupPassed=true
 if(!process.argv.includes('--legacy-baseline')){
 const held=spawn(executable,['-e',"process.stdout.write('READY');setInterval(()=>{},1000)"],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}})
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Mapped executable fixture did not start')),10000);held.once('error',error=>{clearTimeout(timer);reject(error)});held.stdout.once('data',()=>{clearTimeout(timer);resolve()})})
  const blocked=spawnSync(installer,installArguments,{windowsHide:true,encoding:'utf8',timeout:20000})
  if(blocked.status!==32||held.exitCode!==null)throw Error('Setup failed to preserve the in-use executable: '+blocked.status)
  report.runningTargetBlockedWithoutTermination=true
 }finally{if(held.exitCode===null){held.kill();await new Promise(resolve=>held.once('exit',resolve))}}

 }
 const dbFile=path.join(diagnostic,'local-sync.db'),backup=path.join(root,'conversation-backup.db')
 const dbPrefix=`const {createRequire}=require('node:module');const r=createRequire(${JSON.stringify(path.join(destination,'resources/probe.cjs'))});const DB=r('better-sqlite3');const db=new DB(${JSON.stringify(dbFile)});`
 run(executable,['-e',dbPrefix+`const {randomUUID}=require('node:crypto');const chat=db.prepare('SELECT id,user_id FROM conversations LIMIT 1').get();const q=randomUUID(),a=randomUUID(),lineage=randomUUID();db.prepare('INSERT INTO messages(id,conversation_id,role,content,children_ids) VALUES (?,?,?,?,?)').run(q,chat.id,'user','HADRON_UPGRADE_QUESTION',JSON.stringify([a]));db.prepare('INSERT INTO messages(id,conversation_id,parent_id,role,content) VALUES (?,?,?,?,?)').run(a,chat.id,q,'assistant','HADRON_UPGRADE_ANSWER');db.prepare("INSERT INTO lineages(id,conversation_id,root_message_id,head_message_id,status) VALUES (?,?,?,?,'active')").run(lineage,chat.id,q,a);db.prepare('UPDATE messages SET lineage_id=? WHERE id IN (?,?)').run(lineage,q,a);db.prepare("INSERT INTO hadron_helpers(id,owner,workspace,job,role,parent_run,provider,model,task,state) VALUES ('installer-helper-check',?,?,'installer-job','a','no-running-worker','openaichatgpt','gpt-6-luna','Interrupted recovery fixture','reserved')").run(chat.user_id,chat.id);db.backup(${JSON.stringify(backup)}).then(()=>db.close())`],20000,{...process.env,ELECTRON_RUN_AS_NODE:'1'})
 const before=chatSnapshot();report.savedMessagesBefore=before.length
 fs.renameSync(dbFile,path.join(diagnostic,'local-sync.original-before-corruption.db'));fs.writeFileSync(dbFile,'HADRON_SIMULATED_CORRUPT_DATABASE')
 run(executable,['-e',`const {createRequire}=require('node:module');const r=createRequire(${JSON.stringify(path.join(destination,'resources/probe.cjs'))});try{const db=new (r('better-sqlite3'))(${JSON.stringify(dbFile)});db.prepare('SELECT * FROM messages').all();process.exitCode=2}catch(error){if(error.code!=='SQLITE_NOTADB')process.exitCode=3}`],20000,{...process.env,ELECTRON_RUN_AS_NODE:'1'})
 fs.renameSync(dbFile,path.join(diagnostic,'local-sync.simulated-corrupt.db'));fs.copyFileSync(backup,dbFile)
 run(executable,['--hadron-diagnose='+diagnostic],55000)
 run(executable,['-e',dbPrefix+`if(db.prepare("SELECT state FROM hadron_helpers WHERE id='installer-helper-check'").get().state!=='interrupted')process.exitCode=1;db.close()`],20000,{...process.env,ELECTRON_RUN_AS_NODE:'1'})
 report.sqliteBackupRestored=true;report.simulatedCorruptionDetected=true;report.unfinishedHelperNotReplayed=true
 const sentinel=path.join(diagnostic,'upgrade-sentinel.txt');fs.writeFileSync(sentinel,'HADRON_USER_DATA_PRESERVED')
 run(installer,installArguments);report.sameVersionReinstallPassed=true
 run(executable,['--hadron-diagnose='+diagnostic],55000)
 if(fs.readFileSync(sentinel,'utf8')!=='HADRON_USER_DATA_PRESERVED')throw Error('Private data changed during reinstall')
 report.privateDataPreserved=true
 if(upgrade){run(upgrade,installArguments);run(executable,['--hadron-diagnose='+diagnostic],55000);const check=JSON.parse(fs.readFileSync(path.join(diagnostic,'release-check.json'),'utf8'));if(!check.success||check.setup.version===first.setup.version)throw Error('Version upgrade failed');report.versionUpgrade={from:first.setup.version,to:check.setup.version}}
 const after=chatSnapshot();if(!before.every(row=>after.some(item=>item.id===row.id&&item.content===row.content)))throw Error('Saved messages lost during upgrade');report.savedMessagesAfter=after.length;report.savedMessagesPreserved=true
 const uninstaller=fs.readdirSync(destination).find(file=>/^Uninstall.*\.exe$/i.test(file));if(!uninstaller)throw Error('Uninstaller missing')
 run(path.join(destination,uninstaller),['/S','/currentuser'])
 const uninstallDeadline=Date.now()+30000
 while(Date.now()<uninstallDeadline&&(fs.existsSync(executable)||[registered()].flat().length))await new Promise(resolve=>setTimeout(resolve,250))
 if(fs.existsSync(executable)||[registered()].flat().length)throw Error('Uninstall did not remove application/registration')
 if(!fs.existsSync(sentinel))throw Error('Uninstall removed diagnostic user data')
 installed=false;report.uninstallPassed=true;report.success=true
}catch(error){report.failure=String(error.message);process.exitCode=1}
finally{
 if(installed){const name=fs.existsSync(destination)&&fs.readdirSync(destination).find(file=>/^Uninstall.*\.exe$/i.test(file));if(name){try{run(path.join(destination,name),['/S','/currentuser']);const deadline=Date.now()+30000;while(Date.now()<deadline&&(fs.existsSync(executable)||[registered()].flat().length))await new Promise(resolve=>setTimeout(resolve,250));if(fs.existsSync(executable)||[registered()].flat().length)report.cleanupRequired=true}catch{report.cleanupRequired=true}}}
 for(const file of [...links(desktop),...links(programs)])if(!saved.has(file)){const target=ps(`(New-Object -ComObject WScript.Shell).CreateShortcut(${q(file)}).TargetPath`);if(path.resolve(target).startsWith(destination+path.sep))fs.rmSync(file)}
 for(const [file,bytes] of saved){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)}
 report.existingMachineRegistrationPreserved=JSON.stringify([rawRegistrations()].flat().filter(item=>item.PSPath?.includes('HKEY_LOCAL_MACHINE')))===JSON.stringify(protectedRegistrations.filter(item=>item.PSPath?.includes('HKEY_LOCAL_MACHINE')))
 if(!report.existingMachineRegistrationPreserved){report.success=false;process.exitCode=1}
 report.originalShortcutsRestored=[...saved].every(([file,bytes])=>fs.existsSync(file)&&createHash('sha256').update(fs.readFileSync(file)).digest('hex')===createHash('sha256').update(bytes).digest('hex'))
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}
