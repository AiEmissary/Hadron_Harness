param([string]$Installer,[string]$ArgumentsJson,[string]$Report)
$ErrorActionPreference='Stop'
if([IntPtr]::Size -ne 8){throw '64-bit diagnostic host required'}
$release=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../release'))
$exe=[IO.Path]::GetFullPath($Installer)
$argsList=ConvertFrom-Json -InputObject $ArgumentsJson
if([IO.Path]::GetDirectoryName($exe) -ne $release -or [IO.Path]::GetFileName($exe) -notmatch '^Hadron-Harness-[0-9.]+-win-x64\.exe$'){throw 'Only an owned release installer is supported'}
if($argsList.Count -ne 2 -or $argsList[0] -ne '/S' -or -not $argsList[1].StartsWith('/D=')){throw ('Only the isolated silent-install fixture is supported; count='+$argsList.Count+' first='+$argsList[0]+' last='+$argsList[-1])}
$dest=[IO.Path]::GetFullPath($argsList[1].Substring(3));$root=[IO.Path]::GetDirectoryName($dest)
if([IO.Path]::GetDirectoryName($root) -ne [IO.Path]::GetTempPath().TrimEnd('\') -or [IO.Path]::GetFileName($root) -notlike 'hadron-installer-check-*' -or [IO.Path]::GetFileName($dest) -ne 'application' -or [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Report)) -ne $root){throw 'Diagnostic destination is outside the fixture'}
Add-Type -TypeDefinition @'
using System;using System.Text;using System.Runtime.InteropServices;using System.Collections.Generic;using System.Diagnostics;using System.IO;
public static class HadronInstallerDebug {
[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct SI{public uint cb;public string reserved,desktop,title;public uint x,y,xs,ys,xc,yc,fill,flags;public ushort show,cb2;public IntPtr reserved2,stdin,stdout,stderr;}
[StructLayout(LayoutKind.Sequential)]struct PI{public IntPtr process,thread;public uint pid,tid;}
[StructLayout(LayoutKind.Explicit,Size=176)]struct DE{[FieldOffset(0)]public uint code;[FieldOffset(4)]public uint pid;[FieldOffset(8)]public uint tid;[FieldOffset(16)]public uint exception;[FieldOffset(32)]public IntPtr address;[FieldOffset(168)]public uint first;[FieldOffset(16)]public IntPtr file;}
[StructLayout(LayoutKind.Sequential)]struct MBI{public IntPtr address,allocation;public uint allocationProtect,pad;public UIntPtr size;public uint state,protect,type,pad2;}
[DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessW(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SI si,out PI pi);
[DllImport("kernel32.dll",SetLastError=true)]static extern bool WaitForDebugEvent(out DE value,uint ms);
[DllImport("kernel32.dll")]static extern bool ContinueDebugEvent(uint pid,uint tid,uint status);
[DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
[DllImport("kernel32.dll")]static extern bool TerminateProcess(IntPtr h,uint code);
[DllImport("kernel32.dll")]static extern UIntPtr VirtualQueryEx(IntPtr process,IntPtr address,out MBI info,UIntPtr size);
[DllImport("psapi.dll",CharSet=CharSet.Unicode)]static extern uint GetMappedFileNameW(IntPtr process,IntPtr address,StringBuilder name,uint length);
public class Result{public uint ExitCode;public bool TimedOut;public List<string> Exceptions=new List<string>();}
public static Result Run(string exe,string args){var si=new SI();si.cb=(uint)Marshal.SizeOf(si);PI pi;var result=new Result();
if(!CreateProcessW(exe,new StringBuilder("\""+exe+"\" "+args),IntPtr.Zero,IntPtr.Zero,false,2,IntPtr.Zero,Path.GetDirectoryName(exe),ref si,out pi))throw new Exception("Installer debug creation failed: "+Marshal.GetLastWin32Error());
var clock=Stopwatch.StartNew();bool finished=false;try{while(clock.ElapsedMilliseconds<120000){DE e;if(!WaitForDebugEvent(out e,500))continue;uint status=0x10002;
if(e.code==1){if(e.exception!=0x80000003 && e.exception!=0x4000001f){var name=new StringBuilder(1024);GetMappedFileNameW(pi.process,e.address,name,1024);MBI info;VirtualQueryEx(pi.process,e.address,out info,(UIntPtr)Marshal.SizeOf(typeof(MBI)));if(result.Exceptions.Count<32)result.Exceptions.Add("code=0x"+e.exception.ToString("x8")+" firstChance="+e.first+" module="+Path.GetFileName(name.ToString())+" offset=0x"+(e.address.ToInt64()-info.allocation.ToInt64()).ToString("x"));status=0x80010001;}}
if(e.code==3||e.code==6){if(e.file!=IntPtr.Zero)CloseHandle(e.file);}
if(e.code==5){result.ExitCode=e.exception;finished=true;}
ContinueDebugEvent(e.pid,e.tid,status);if(finished)break;
}if(!finished){result.TimedOut=true;result.ExitCode=1460;TerminateProcess(pi.process,1460);}return result;}finally{CloseHandle(pi.thread);CloseHandle(pi.process);}}
}
'@
$result=[HadronInstallerDebug]::Run($exe,('/S '+$argsList[1]))
$result|ConvertTo-Json -Depth 4|Set-Content -LiteralPath $Report -Encoding UTF8
exit ([BitConverter]::ToInt32([BitConverter]::GetBytes([uint32]$result.ExitCode),0))
