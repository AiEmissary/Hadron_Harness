// Trusted Windows x64 worker host. No shell, dynamic code or credential access.
// Job assignment occurs in CreateProcess, before the child's first thread runs.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

internal static class HadronWorkerHost {
 const uint KillOnClose=0x2000, QueryJob=4, ExtendedStartup=0x80000, UseStdHandles=0x100, NoWindow=0x08000000;
 const uint QueryProcess=0x1000, Synchronize=0x100000, WaitSignaled=0;
 static volatile bool StopRequested;
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 [StructLayout(LayoutKind.Sequential)] struct BasicLimit {
  public long ProcessTime,JobTime; public uint Flags; public UIntPtr MinWorkingSet,MaxWorkingSet;
  public uint ProcessLimit; public UIntPtr Affinity; public uint Priority,Scheduling;
 }
 [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] struct ExtendedLimit {
  public BasicLimit Basic; public IoCounters Io; public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory;
 }
 [StructLayout(LayoutKind.Sequential)] struct Accounting {
  public long User,Kernel,PeriodUser,PeriodKernel; public uint Faults,Total,Active,Terminated;
 }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {
  public int Size; public string Reserved,Desktop,Title; public uint X,Y,Width,Height,CharsX,CharsY,Fill,Flags;
  public short ShowWindow,ReservedBytes; public IntPtr ReservedPointer,Input,Output,Error;
 }
 [StructLayout(LayoutKind.Sequential)] struct StartupEx { public Startup Startup; public IntPtr Attributes; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process,Thread; public uint Pid,Tid; }
 [StructLayout(LayoutKind.Sequential)] struct FileTime { public uint Low,High; public ulong Value { get { return ((ulong)High<<32)|Low; } } }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObjectW(IntPtr attributes,string name);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenJobObjectW(uint access,bool inherit,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref ExtendedLimit info,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out Accounting info,uint size,IntPtr length);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exit);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr key,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref StartupEx startup,out ProcessInfo process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool inside);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool DuplicateHandle(IntPtr sourceProcess,IntPtr source,IntPtr targetProcess,out IntPtr target,uint access,bool inherit,uint options);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetNamedPipeServerProcessId(IntPtr pipe,out uint pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out FileTime creation,out FileTime exit,out FileTime kernel,out FileTime user);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 static void Check(bool success) { if(!success)throw new Win32Exception(Marshal.GetLastWin32Error()); }
 static ulong Created(IntPtr process) { FileTime a,b,c,d;Check(GetProcessTimes(process,out a,out b,out c,out d));return a.Value; }
 static bool JobName(string name) { return Regex.IsMatch(name,@"^Local\\HadronWorker-[a-f0-9]{32}$"); }
 static string Line(StreamReader reader) {
  var text=new StringBuilder();for(int i=0;i<8192;i++){int value=reader.Read();if(value<0)return null;if(value==10)return text.ToString();if(value==13)continue;text.Append((char)value);}
  throw new InvalidDataException("control_limit");
 }
 // Windows CommandLineToArgv-compatible escaping; no command interpreter.
 static string Quote(string value) {
  var result=new StringBuilder("\"");int slashes=0;
  foreach(char c in value){if(c=='\\'){slashes++;continue;}if(c=='\"'){result.Append('\\',slashes*2+1);result.Append(c);}else{result.Append('\\',slashes);result.Append(c);}slashes=0;}
  result.Append('\\',slashes*2);result.Append('"');return result.ToString();
 }
 static uint Active(IntPtr job) { Accounting info;Check(QueryInformationJobObject(job,1,out info,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero));return info.Active; }
 static string ProcessState(string pidText,string createdText) {
  uint pid;ulong created;if(!uint.TryParse(pidText,out pid)||pid==0||!ulong.TryParse(createdText,out created)||created==0)return "unknown";
  IntPtr process=OpenProcess(QueryProcess|Synchronize,false,pid);
  if(process==IntPtr.Zero)return Marshal.GetLastWin32Error()==87?"ended":"unknown";
  try {
   if(Created(process)!=created)return "ended";
   uint waited=WaitForSingleObject(process,0);return waited==WaitSignaled?"ended":waited==258?"alive":"unknown";
  }catch{return "unknown";}finally{CloseHandle(process);}
 }
 static int Inspect(string[] args) {
  uint session;if(args.Length!=7||!JobName(args[1])||!uint.TryParse(args[6],out session))throw new InvalidDataException("inspection_identity");
  string parent=ProcessState(args[2],args[3]),worker=ProcessState(args[4],args[5]),jobState="unknown";uint? active=null;
  // Local named jobs belong to a Windows session. Absence in a different
  // session is not evidence that the original job no longer exists.
  bool sameSession=session==(uint)Process.GetCurrentProcess().SessionId;
  IntPtr job=sameSession?OpenJobObjectW(QueryJob,false,args[1]):IntPtr.Zero;int jobError=Marshal.GetLastWin32Error();
  if(job==IntPtr.Zero){if(sameSession&&jobError==2)jobState="absent";}
  else try{active=Active(job);jobState=active==0?"empty":"active";}finally{CloseHandle(job);}
  bool ended=parent=="ended"&&worker=="ended"&&(jobState=="absent"||jobState=="empty");
  Console.WriteLine(Json.Serialize(new {version=1,readOnly=true,parent=parent,worker=worker,job=jobState,active=active,ended=ended}));return 0;
 }
 static int Run(string[] args) {
  if(args.Length<5||!Regex.IsMatch(args[1],@"^HadronWorker-[a-f0-9]{32}$")||!Regex.IsMatch(args[2],"^[a-f0-9]{64}$")||!JobName(args[3])||!Path.IsPathRooted(args[4]))throw new InvalidDataException("launch_identity");
  IntPtr job=IntPtr.Zero,attributes=IntPtr.Zero,jobValue=IntPtr.Zero,handleValues=IntPtr.Zero;bool initialized=false,ownsJob=false;
  ProcessInfo process=new ProcessInfo();var handles=new List<IntPtr>();
  try {
   job=CreateJobObjectW(IntPtr.Zero,args[3]);int jobError=Marshal.GetLastWin32Error();
   if(job==IntPtr.Zero||jobError==183)throw new InvalidDataException("job_unavailable");
   ownsJob=true;
   var limits=new ExtendedLimit();limits.Basic.Flags=KillOnClose;
   Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimit))));
   using(var pipe=new NamedPipeClientStream(".",args[1],PipeDirection.InOut,PipeOptions.Asynchronous)){
    pipe.Connect(10000);
    uint parentPid;Check(GetNamedPipeServerProcessId(pipe.SafePipeHandle.DangerousGetHandle(),out parentPid));
    IntPtr parent=OpenProcess(QueryProcess|Synchronize,false,parentPid);if(parent==IntPtr.Zero)throw new InvalidDataException("parent_unavailable");
    ulong parentCreated;try{parentCreated=Created(parent);}finally{CloseHandle(parent);}
    var reader=new StreamReader(pipe,new UTF8Encoding(false,true),false,1024,true);
    var writer=new StreamWriter(pipe,new UTF8Encoding(false),1024,true);writer.AutoFlush=true;
    writer.WriteLine(Json.Serialize(new {version=1,type="prepared",nonce=args[2],job=args[3],sessionId=Process.GetCurrentProcess().SessionId,parentPid=parentPid,parentCreated=parentCreated.ToString(),workerPid=Process.GetCurrentProcess().Id,workerCreated=Created(GetCurrentProcess()).ToString()}));
    if(Line(reader)!="start:"+args[2])throw new InvalidDataException("launch_not_admitted");
    var watcher=new Thread(()=>{try{Line(reader);}catch{}StopRequested=true;});watcher.IsBackground=true;watcher.Start();
    IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
    if(size==IntPtr.Zero)throw new InvalidDataException("attributes_unavailable");
    attributes=Marshal.AllocHGlobal(size);Check(InitializeProcThreadAttributeList(attributes,2,0,ref size));initialized=true;
    jobValue=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobValue,job);
    Check(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x2000D),jobValue,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
    foreach(int standard in new int[]{-10,-11,-12}){
     IntPtr duplicate;Check(DuplicateHandle(GetCurrentProcess(),GetStdHandle(standard),GetCurrentProcess(),out duplicate,0,true,2));handles.Add(duplicate);
    }
    handleValues=Marshal.AllocHGlobal(IntPtr.Size*3);for(int i=0;i<3;i++)Marshal.WriteIntPtr(handleValues,i*IntPtr.Size,handles[i]);
    Check(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x20002),handleValues,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero));
    var startup=new StartupEx();startup.Startup.Size=Marshal.SizeOf(typeof(StartupEx));startup.Startup.Flags=UseStdHandles;
    startup.Startup.Input=handles[0];startup.Startup.Output=handles[1];startup.Startup.Error=handles[2];startup.Attributes=attributes;
    var command=new StringBuilder();for(int i=4;i<args.Length;i++){if(i>4)command.Append(' ');command.Append(Quote(args[i]));}
    if(command.Length>32766)throw new InvalidDataException("command_limit");
    Check(CreateProcessW(args[4],command,IntPtr.Zero,IntPtr.Zero,true,ExtendedStartup|NoWindow,IntPtr.Zero,Environment.CurrentDirectory,ref startup,out process));
    bool inside;Check(IsProcessInJob(process.Process,job,out inside));if(!inside)throw new InvalidDataException("job_assignment");
    CloseHandle(process.Thread);process.Thread=IntPtr.Zero;
    // Only stdio duplicates are inherited; the kill-on-close job handle is not.
    foreach(IntPtr handle in handles)CloseHandle(handle);handles.Clear();
    bool terminated=false;uint exit=1;
    while(true){
     uint waited=WaitForSingleObject(process.Process,0);if(waited!=0&&waited!=258)throw new InvalidDataException("worker_wait");
     if(!terminated&&(StopRequested||waited==0)){Check(TerminateJobObject(job,1));terminated=true;}
     if(Active(job)==0){Check(GetExitCodeProcess(process.Process,out exit));break;}
     Thread.Sleep(20);
    }
    try{writer.WriteLine(Json.Serialize(new {version=1,type="closed",nonce=args[2],active=0}));}catch{}
    return StopRequested?1:unchecked((int)exit);
   }
  }finally{
   if(job!=IntPtr.Zero){if(ownsJob)TerminateJobObject(job,1);CloseHandle(job);}
   if(process.Thread!=IntPtr.Zero)CloseHandle(process.Thread);if(process.Process!=IntPtr.Zero)CloseHandle(process.Process);
   foreach(IntPtr handle in handles)CloseHandle(handle);
   if(initialized)DeleteProcThreadAttributeList(attributes);if(attributes!=IntPtr.Zero)Marshal.FreeHGlobal(attributes);
   if(jobValue!=IntPtr.Zero)Marshal.FreeHGlobal(jobValue);if(handleValues!=IntPtr.Zero)Marshal.FreeHGlobal(handleValues);
  }
 }
 static int Main(string[] args) {
  try{if(IntPtr.Size!=8||args.Length==0)throw new InvalidDataException("unsupported_host");if(args[0]=="inspect")return Inspect(args);if(args[0]=="run")return Run(args);throw new InvalidDataException("mode");}
  catch{Console.Error.WriteLine("Hadron native worker operation was not confirmed");return 125;}
 }
}
