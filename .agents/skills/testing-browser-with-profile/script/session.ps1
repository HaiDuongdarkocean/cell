$ErrorActionPreference = 'Stop'

if ($env:Tihoka_DEBUG_SESSION) { Write-Output $env:Tihoka_DEBUG_SESSION; exit 0 }

function Get-AcpPid {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
  while ($p) {
    if ($p.Name -eq 'devin.exe' -and $p.CommandLine -match 'acp') { return $p.ProcessId }
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" -ErrorAction SilentlyContinue
  }
}

$acp = Get-AcpPid
if ($acp) {
  $src = @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class Rm {
  [StructLayout(LayoutKind.Sequential)]
  struct RM_UNIQUE_PROCESS { public int dwProcessId; public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct RM_PROCESS_INFO {
    public RM_UNIQUE_PROCESS Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string strAppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string strServiceShortName;
    public int ApplicationType; public uint AppStatus; public uint TSSessionId; [MarshalAs(UnmanagedType.Bool)] public bool bRestartable;
  }
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);
  [DllImport("rstrtmgr.dll")] static extern int RmEndSession(uint pSessionHandle);
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, IntPtr rgApplications, uint nServices, IntPtr rgsServiceNames);
  [DllImport("rstrtmgr.dll")]
  static extern int RmGetList(uint dwSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);
  public static List<int> Owners(string file) {
    var pids = new List<int>();
    uint h; string key = Guid.NewGuid().ToString();
    if (RmStartSession(out h, 0, key) != 0) return pids;
    try {
      if (RmRegisterResources(h, 1, new[]{file}, 0, IntPtr.Zero, 0, IntPtr.Zero) != 0) return pids;
      uint needed = 0, count = 0, reasons = 0;
      RmGetList(h, out needed, ref count, null, ref reasons);
      if (needed == 0) return pids;
      var arr = new RM_PROCESS_INFO[needed];
      count = needed;
      if (RmGetList(h, out needed, ref count, arr, ref reasons) == 0)
        foreach (var p in arr) pids.Add(p.Process.dwProcessId);
    } finally { RmEndSession(h); }
    return pids;
  }
}
'@
  Add-Type -TypeDefinition $src -Language CSharp
  $locks = Get-ChildItem "$env:APPDATA\devin\cli\session_locks\*.lock" -ErrorAction SilentlyContinue
  $mine = @($locks | Where-Object { [Rm]::Owners($_.FullName) -contains $acp })
  if ($mine.Count -eq 1) { Write-Output $mine[0].BaseName; exit 0 }
  if ($mine.Count -gt 1) { Write-Warning "acp $acp holds $($mine.Count) session locks - set Tihoka_DEBUG_SESSION to pick"; Write-Output $mine[0].BaseName; exit 0 }
  Write-Output "devin-$acp"; exit 0
}

if ($env:Tihoka_AGENT_ID) { Write-Output $env:Tihoka_AGENT_ID; exit 0 }
throw 'cannot prove which agent session this is - export Tihoka_DEBUG_SESSION=<name> once, then retry'
