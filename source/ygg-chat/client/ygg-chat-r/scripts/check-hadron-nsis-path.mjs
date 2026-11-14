import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
import {patchHadronNsis,fixNsisTemplate} from './patch-hadron-nsis.mjs'
const app=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url)
const proof=patchHadronNsis(app),templates=path.join(path.dirname(require.resolve('app-builder-lib/package.json')),'templates/nsis')
const text=fs.readFileSync(path.join(templates,'multiUser.nsh'),'utf8')
assert.equal(fixNsisTemplate(text),text)
assert.throws(()=>fixNsisTemplate(text+'\n# unexpected change'),/Unknown/)
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-nsis-path-')),probe=path.join(root,'path-probe.exe')
const compiler=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/nsis/nsis-3.0.4.1-nsis-3.0.4.1/Bin/makensis.exe')
const quote=value=>value.replaceAll('$','$$').replaceAll('"','$\\"')
// No registry writes or app installation. A fresh fixture GUID always exercises
// the default folder branch; command-line parsing is intentionally empty.
fs.writeFileSync(path.join(root,'probe.nsi'),`Unicode true
RequestExecutionLevel user
!include "LogicLib.nsh"
!include "WinVer.nsh"
!addincludedir "${quote(path.join(templates,'include'))}"
!define APP_GUID "hadron-path-fixture-${path.basename(root)}"
!define APP_FILENAME "HadronPathFixture"
!macro FixtureParameters output ignored
 StrCpy \${output} ""
!macroend
!define StdUtils.GetAllParameters "!insertmacro FixtureParameters"
!include "${quote(path.join(templates,'multiUser.nsh'))}"
OutFile "${quote(probe)}"
Section
 !insertmacro setInstallModePerUser
 StrCmp $INSTDIR "$LocalAppData\\Programs\\HadronPathFixture" correct
 SetErrorLevel 1
 Quit
 correct:
SectionEnd
`)
let result=spawnSync(compiler,['/V2',path.join(root,'probe.nsi')],{encoding:'utf8',windowsHide:true})
if(result.status!==0)throw Error(result.stdout+result.stderr)
for(let i=0;i<50;i++){result=spawnSync(probe,['/S'],{windowsHide:true,timeout:10000});assert.equal(result.status,0,'Fresh-path probe '+i)}
const report={success:true,freshPathLaunches:50,templateIntegrityAndIdempotence:true,registryWrites:0,applicationFilesChanged:false,...proof}
fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({root,...report},null,2))
