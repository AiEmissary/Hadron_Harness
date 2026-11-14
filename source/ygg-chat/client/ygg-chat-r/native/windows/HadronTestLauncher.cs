using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

// A Windows GUI entry point: no console is allocated before PowerShell starts.
internal static class HadronTestLauncher {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  private static extern int MessageBox(IntPtr owner,string text,string title,uint flags);
  [STAThread]
  private static int Main(string[] args) {
    try {
      string root=Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,".."));
      string script=Path.Combine(root,"Test Hadron.ps1");
      string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe");
      if(!File.Exists(script)||!File.Exists(powershell))throw new FileNotFoundException("Hadron's local launcher files are missing. Return to the Hadron build chat.");
      if(args.Length==1&&args[0]=="--check")return 0;
      if(args.Length!=0)throw new ArgumentException("Unsupported launcher arguments.");
      var start=new ProcessStartInfo(powershell,"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+script+"\"") {
        UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=root
      };
      start.EnvironmentVariables["HADRON_QUIET_LAUNCH"]="1";
      using(var process=Process.Start(start)) { if(process==null)throw new InvalidOperationException("Hadron could not start."); }
      return 0;
    } catch(Exception error) {
      MessageBox(IntPtr.Zero,error.Message,"Hadron could not open",0x10);
      return 1;
    }
  }
}
