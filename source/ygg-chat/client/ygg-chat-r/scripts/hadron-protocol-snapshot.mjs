import {spawnSync} from 'node:child_process'
import path from 'node:path'
/** Read-only snapshot; callers persist equality only, never the actual registry commands. */
export function hadronProtocolSnapshot(){
 if(process.platform!=='win32')return null
 const script=String.raw`$entry=Get-Item -LiteralPath 'HKCU:\Software\Classes\hadron-harness' -ErrorAction SilentlyContinue;$command=Get-Item -LiteralPath 'HKCU:\Software\Classes\hadron-harness\shell\open\command' -ErrorAction SilentlyContinue;$icon=Get-Item -LiteralPath 'HKCU:\Software\Classes\hadron-harness\DefaultIcon' -ErrorAction SilentlyContinue;[ordered]@{root=if($entry){$entry.GetValue('')}else{$null};command=if($command){$command.GetValue('')}else{$null};icon=if($icon){$icon.GetValue('')}else{$null}}|ConvertTo-Json -Compress`
 const result=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',timeout:10000})
 if(result.status!==0)throw Error('Hadron protocol snapshot unavailable')
 return result.stdout.trim()
}
