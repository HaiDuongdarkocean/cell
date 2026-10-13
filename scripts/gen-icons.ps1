# Regenerate public/icons/icon-{16,32,48,64,128}.png by rendering extras/icon-circle-shadow.svg
# through headless Chrome at each target size — vector rasterization, no blur.
# Source asset: extras/icon-circle-shadow.svg (traced from extras/icon-512.png).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\gen-icons.ps1
[CmdletBinding()]
param([string]$Source = '', [string]$OutDir = '', [string]$ChromeExe = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $Source) { $Source = Join-Path $root 'extras\icon-circle-shadow.svg' }
if (-not $OutDir) { $OutDir = Join-Path $root 'public\icons' }
if (-not (Test-Path $Source)) { throw "source svg not found: $Source" }
if (-not $ChromeExe) {
  foreach ($c in "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
                  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
                  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe") {
    if (Test-Path $c) { $ChromeExe = $c; break }
  }
}
if (-not $ChromeExe) { throw 'no Chrome/Edge/Brave binary found for svg rasterization' }

$svg = Get-Content $Source -Raw
$tmp = Join-Path $env:TEMP 'tihoka-icon-render.svg'
try {
  foreach ($size in 16, 32, 48, 64, 128) {
    $out = Join-Path $OutDir "icon-$size.png"
    ($svg -replace 'width="512" height="512"', "width=`"$size`" height=`"$size`"") |
      Set-Content $tmp -Encoding utf8
    & $ChromeExe --headless=new --disable-gpu --hide-scrollbars `
      --default-background-color=00000000 `
      --window-size="$size,$size" --screenshot="$out" ([uri]$tmp).AbsoluteUri | Out-Null
    if (-not (Test-Path $out)) { throw "render failed: $out" }
    Write-Output "wrote $out"
  }
} finally {
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
