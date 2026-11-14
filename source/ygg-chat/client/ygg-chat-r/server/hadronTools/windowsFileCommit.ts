import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

// Fixed trusted code only. Paths/hashes travel as JSON on stdin, never as code or
// interpolated command arguments. No profiles, plugins, user commands or children.
const script=String.raw`
$ErrorActionPreference='Stop'
$PSModuleAutoLoadingPreference='None'
Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1')) -ErrorAction Stop
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$stage='preflight'
$step='packet'
try {
 $p=[Console]::In.ReadToEnd() | ConvertFrom-Json
 if ($p.version -ne 1) { throw 'protocol' }
 $target=[IO.Path]::GetFullPath([string]$p.target)
 $temporary=[IO.Path]::GetFullPath([string]$p.temporary)
 $backup=[IO.Path]::GetFullPath([string]$p.backup)
 if ([IO.Path]::GetDirectoryName($target) -ne [IO.Path]::GetDirectoryName($temporary) -or
     [IO.Path]::GetDirectoryName($target) -ne [IO.Path]::GetDirectoryName($backup) -or
     [IO.Path]::GetFileName($temporary) -notmatch '^\.hadron-write-[a-f0-9-]{36}\.tmp$' -or
     [IO.Path]::GetFileName($backup) -notmatch '^\.hadron-write-[a-f0-9-]{36}\.backup$' -or
     $target -eq $temporary -or $target -eq $backup) { throw 'paths' }
 $sections=[Security.AccessControl.AccessControlSections]::Access -bor [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Group
 function Digest([string]$file) {
  $stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try { $sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()} } finally{$stream.Dispose()}
 }
 function SecurityText([string]$file) { return [IO.File]::GetAccessControl($file,$sections).GetSecurityDescriptorSddlForm($sections) }
 $step='attributes'
 $attributes=[IO.File]::GetAttributes($target)
 # Support ordinary text files. Never clear read-only/security/special flags.
 $allowed=2 -bor 32 -bor 128 -bor 8192
 if (([int]$attributes -band (-bnot $allowed)) -ne 0) { throw 'unsupported_attributes' }
 if ($p.action -eq 'verify_metadata') {
  if ((Digest $target) -ne $p.afterHash -or (Digest $backup) -ne $p.beforeHash -or
      (SecurityText $target) -ne (SecurityText $backup) -or [IO.File]::GetAttributes($target) -ne [IO.File]::GetAttributes($backup) -or
      [IO.File]::GetCreationTimeUtc($target) -ne [IO.File]::GetCreationTimeUtc($backup)) { throw 'recovery_metadata' }
  $before=SecurityText $target
  $created=[IO.File]::GetCreationTimeUtc($target)
 } else {
 if ($p.action -ne 'replace') { throw 'action' }
 if (([int][IO.File]::GetAttributes($temporary) -band 1024) -ne 0 -or [IO.File]::Exists($backup)) { throw 'temporary_or_backup' }
 $step='hashes'
 if ((Digest $target) -ne $p.beforeHash -or (Digest $temporary) -ne $p.afterHash) { throw 'content_changed' }
 $before=SecurityText $target
 $security=New-Object Security.AccessControl.FileSecurity
 $security.SetSecurityDescriptorSddlForm($before,$sections)
 $created=[IO.File]::GetCreationTimeUtc($target)
 # All metadata preparation affects our temporary file, never the original.
 $step='set_acl'
 [IO.File]::SetAccessControl($temporary,$security)
 [IO.File]::SetAttributes($temporary,$attributes)
 [IO.File]::SetCreationTimeUtc($temporary,$created)
 $step='metadata_check'
 if ((SecurityText $temporary) -ne $before -or (Digest $target) -ne $p.beforeHash) { throw 'metadata_or_content_changed' }
 $stage='replace_started'
 # false is critical: never ignore metadata/ACL merge failures. A backup keeps
 # the original recoverable even for documented partial ReplaceFile failures.
 [IO.File]::Replace($temporary,$target,$backup,$false)
 $stage='replace_returned'
 if ((Digest $target) -ne $p.afterHash -or (Digest $backup) -ne $p.beforeHash -or
     (SecurityText $target) -ne $before -or [IO.File]::GetAttributes($target) -ne $attributes -or
     [IO.File]::GetCreationTimeUtc($target) -ne $created) { throw 'postcondition' }
 }
 $bytes=[Text.Encoding]::UTF8.GetBytes($before+'|'+[int]$attributes+'|'+$created.Ticks)
 $sha=[Security.Cryptography.SHA256]::Create()
 try { $metadataHash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() }finally{$sha.Dispose()}
 [Console]::Out.Write((@{version=1;ok=$true;stage='verified';metadataHash=$metadataHash}|ConvertTo-Json -Compress))
 exit 0
} catch {
 # No raw paths, file contents, SIDs or exception text in diagnostics.
 [Console]::Out.Write((@{version=1;ok=$false;stage=$stage;step=$step;category=$_.Exception.GetType().Name}|ConvertTo-Json -Compress))
 exit 1
}
`

/** A fixed Windows metadata operation, not general shell/project command access.
 * A failure may be partial: caller must retain the started receipt and backup. */
function windowsMetadataOperation(action:'replace'|'verify_metadata',target:string,temporary:string,backup:string,beforeHash:string,afterHash:string):{metadataHash:string}{
  if(process.platform!=='win32')throw Error('Windows metadata replacement is unavailable')
  if(![target,temporary,backup].every(value=>typeof value==='string'&&path.isAbsolute(value))||
    path.dirname(target)!==path.dirname(temporary)||path.dirname(target)!==path.dirname(backup)||
    !/^[a-f0-9]{64}$/.test(beforeHash)||!/^[a-f0-9]{64}$/.test(afterHash))throw Error('Invalid Windows commit packet')
  const systemRoot=process.env.SystemRoot??process.env.WINDIR
  if(!systemRoot||!path.isAbsolute(systemRoot))throw Error('Trusted Windows system directory unavailable')
  const binary=path.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe')
  if(!fs.lstatSync(binary).isFile()||fs.lstatSync(binary).isSymbolicLink())throw Error('Windows metadata helper unavailable')
  const result=spawnSync(binary,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{
    shell:false,windowsHide:true,timeout:10000,maxBuffer:8192,encoding:'utf8',cwd:path.dirname(binary),
    env:{SystemRoot:systemRoot,WINDIR:systemRoot,TEMP:process.env.TEMP??systemRoot,TMP:process.env.TMP??systemRoot,PSModulePath:path.join(path.dirname(binary),'Modules')},
    input:JSON.stringify({version:1,action,target,temporary,backup,beforeHash,afterHash}),
  })
  let report:any
  try{report=JSON.parse(result.stdout??'')}catch{/* Missing acknowledgement remains uncertain. */}
  if(result.error||result.status!==0||report?.version!==1||report.ok!==true||report.stage!=='verified'||!/^[a-f0-9]{64}$/.test(report.metadataHash)){
    const step=['packet','attributes','hashes','set_acl','metadata_check'].includes(report?.step)?report.step:'unknown'
    throw Error(`Windows metadata replacement was not confirmed (${['preflight','replace_started','replace_returned'].includes(report?.stage)?report.stage:'unknown'}; ${step}); inspect the saved checkpoint`)
  }
  return {metadataHash:report.metadataHash}
}
export function replaceWindowsFile(target:string,temporary:string,backup:string,beforeHash:string,afterHash:string){
  return windowsMetadataOperation('replace',target,temporary,backup,beforeHash,afterHash)
}
/** Read-only comparison with the retained original backup; never writes/retries. */
export function verifyWindowsReplacement(target:string,backup:string,beforeHash:string,afterHash:string){
  return windowsMetadataOperation('verify_metadata',target,backup.replace(/\.backup$/,'.tmp'),backup,beforeHash,afterHash)
}
