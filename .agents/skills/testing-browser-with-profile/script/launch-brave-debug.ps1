$ErrorActionPreference = 'Stop'
$port = if ($env:CELL_DEBUG_PORT) { [int]$env:CELL_DEBUG_PORT } else { 9223 }

try {
  $v = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
  Write-Output "ALREADY RUNNING: $($v.Browser) on :$port"
  exit 0
} catch {}

$repo = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$dist = Join-Path $repo 'dist'
if (-not (Test-Path "$dist\manifest.json")) { throw "dist/manifest.json missing - run npm run build first" }

$sessions = 'C:\cell-browser-sessions'
New-Item -ItemType Directory -Force $sessions | Out-Null
function Ensure-Junction($name, $target) {
  $p = Join-Path $sessions $name
  $existing = Get-Item $p -ErrorAction SilentlyContinue
  if ($existing) {
    if ($existing.LinkType -ne 'Junction') { Write-Warning "$p exists and is not a junction - using it anyway" }
    return
  }
  New-Item -ItemType Junction -Path $p -Target $target | Out-Null
}
Ensure-Junction 'ext-dist' $dist
Ensure-Junction 'ext-ublock' (Join-Path $repo 'data\extension\uBOLite')

$brave = if ($env:BRAVE_EXE) { $env:BRAVE_EXE } else { 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe' }
if (-not (Test-Path $brave)) { throw "Brave not found at $brave - set BRAVE_EXE" }
$profile = if ($env:CELL_DEBUG_PROFILE) { $env:CELL_DEBUG_PROFILE } else { "$sessions\brave-debug" }

Start-Process -FilePath $brave -ArgumentList @(
  "--user-data-dir=$profile",
  "--remote-debugging-port=$port",
  '--remote-allow-origins=*',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-blink-features=AutomationControlled',
  '--disable-extensions-except=C:\cell-browser-sessions\ext-dist,C:\cell-browser-sessions\ext-ublock',
  '--load-extension=C:\cell-browser-sessions\ext-dist,C:\cell-browser-sessions\ext-ublock'
)

$deadline = (Get-Date).AddSeconds(15)
do {
  Start-Sleep -Milliseconds 800
  try {
    $v = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
    Write-Output "LAUNCHED: $($v.Browser) on :$port profile=$profile"
    exit 0
  } catch {}
} while ((Get-Date) -lt $deadline)
throw "Brave did not open CDP on :$port within 15s - check for a stale process using $profile"
