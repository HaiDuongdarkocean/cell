$ErrorActionPreference = 'Stop'

$id = (& "$PSScriptRoot\session.ps1") | Select-Object -Last 1
$id = ($id.Trim() -replace '[^\w.-]', '-')
if (-not $id) { throw 'session.ps1 returned empty id' }

$sessions = 'C:\Tihoka-browser-sessions'
$regDir = Join-Path $sessions 'sessions'
$regFile = Join-Path $regDir "$id.json"
$profiles = Join-Path $sessions 'profiles'
$profile = Join-Path $profiles $id
New-Item -ItemType Directory -Force $regDir, $profiles | Out-Null

function Test-Mine($entry) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.pid)" -ErrorAction SilentlyContinue
  return $p -and $p.CommandLine -and
    $p.CommandLine.Contains("--user-data-dir=$($entry.profile)") -and
    $p.CommandLine.Contains("--remote-debugging-port=$($entry.port)")
}

$repo = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$dist = Join-Path $repo 'dist'

function Ensure-Junction($name, $target) {
  $p = Join-Path $sessions $name
  $existing = Get-Item $p -ErrorAction SilentlyContinue
  if ($existing) {
    if ($existing.LinkType -eq 'Junction' -and $existing.Target -eq $target) { return }
    cmd /c rmdir "$p"
    if (Test-Path $p) { Remove-Item $p -Force }
  }
  New-Item -ItemType Junction -Path $p -Target $target | Out-Null
}

if (Test-Path $regFile) {
  $entry = Get-Content $regFile | ConvertFrom-Json
  if (Test-Mine $entry) {
    if ($entry.dist -eq $dist) {
      Write-Output "ALREADY RUNNING: session=$id :$($entry.port) profile=$profile"
      exit 0
    }
    Write-Output "worktree changed ($($entry.dist) -> $dist) - restarting for a fresh install"
    node -e "setTimeout(()=>process.exit(0),8000);fetch('http://127.0.0.1:$($entry.port)/json/version').then(r=>r.json()).then(v=>{const w=new WebSocket(v.webSocketDebuggerUrl);w.onopen=()=>w.send(JSON.stringify({id:1,method:'Browser.close'}))}).catch(()=>{})"
    $wait = 0
    while ((Get-Process -Id $entry.pid -ErrorAction SilentlyContinue) -and $wait++ -lt 15) { Start-Sleep 1 }
    if (Get-Process -Id $entry.pid -ErrorAction SilentlyContinue) { throw "old browser (pid $($entry.pid)) did not exit within 15s" }
  }
}

$claimed = @{}
Get-ChildItem $regDir -Filter '*.json' | ForEach-Object {
  try {
    $e = Get-Content $_.FullName | ConvertFrom-Json
    if (Test-Mine $e) { $claimed[[int]$e.port] = $true }
    else { Remove-Item $_.FullName -Force }
  } catch { Remove-Item $_.FullName -Force }
}

$port = 0
if ($env:Tihoka_DEBUG_PORT) {
  $port = [int]$env:Tihoka_DEBUG_PORT
} else {
  for ($p = 9330; $p -lt 9430; $p++) {
    if ($claimed[$p]) { continue }
    if (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) { continue }
    $port = $p; break
  }
}
if (-not $port) { throw 'no free debug port in 9330-9429 - set Tihoka_DEBUG_PORT' }

if (-not (Test-Path $profile)) {
  New-Item -ItemType Directory -Force "$profile\Default" | Out-Null
  $template = Join-Path $sessions 'brave-debug'
  foreach ($f in 'Local State', 'Default\Cookies', 'Default\Login Data', 'Default\Web Data',
                'Default\Preferences', 'Default\Secure Preferences') {
    $src = Join-Path $template $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $profile $f) -Force }
  }
  foreach ($d in 'Default\Local Storage', 'Default\Session Storage', 'Default\IndexedDB') {
    $src = Join-Path $template $d
    if (Test-Path $src) {
      robocopy $src (Join-Path $profile $d) /E /NFL /NDL /NJH /NJS | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "robocopy profile seed failed ($LASTEXITCODE) for $d" }
    }
  }
}

if (-not (Test-Path "$dist\manifest.json")) { throw "dist/manifest.json missing - run npm run build first" }

$extDirs = @("ext-dist-$id")
Ensure-Junction "ext-dist-$id" $dist
$ublock = Join-Path $repo 'data\extension\uBOLite'
if (Test-Path $ublock) {
  $extDirs += "ext-ublock-$id"
  Ensure-Junction "ext-ublock-$id" $ublock
}
$extArg = ($extDirs | ForEach-Object { "C:\Tihoka-browser-sessions\$_" }) -join ','

$brave = if ($env:BRAVE_EXE) { $env:BRAVE_EXE } else { 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe' }
if (-not (Test-Path $brave)) { throw "Brave not found at $brave - set BRAVE_EXE" }

Start-Process -FilePath $brave -ArgumentList @(
  "--user-data-dir=$profile",
  "--remote-debugging-port=$port",
  '--remote-allow-origins=*',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-blink-features=AutomationControlled',
  "--disable-extensions-except=$extArg",
  "--load-extension=$extArg"
)

$deadline = (Get-Date).AddSeconds(15)
$up = $false
do {
  Start-Sleep -Milliseconds 800
  try {
    $v = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
    $up = $true; break
  } catch {}
} while ((Get-Date) -lt $deadline)
if (-not $up) { throw "Brave did not open CDP on :$port within 15s - check for a stale process using $profile" }

$proc = Get-CimInstance Win32_Process -Filter "name='brave.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine.Contains("--user-data-dir=$profile") -and
  $_.CommandLine.Contains("--remote-debugging-port=$port")
} | Select-Object -First 1
if (-not $proc) { throw "launched but cannot find brave.exe owning $profile :$port" }

@{ id = $id; port = $port; pid = $proc.ProcessId; profile = $profile; out = "debug-brave-$id"; dist = $dist } |
  ConvertTo-Json | Set-Content $regFile

Write-Output "LAUNCHED: $($v.Browser) on :$port session=$id profile=$profile"
Write-Output "logs -> tmp/debug-brave-$id/console.jsonl ; override with Tihoka_DEBUG_SESSION=<name> for a stable named profile"
