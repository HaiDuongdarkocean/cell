# Pack a store-upload zip for Chromium browsers (Chrome Web Store, Edge Add-ons,
# Opera, ...): copies dist/, KEEPS the pinned "key" (the store reads it and
# assigns item ID = ifceodogdeeaacmdigljgmafnhkbfnia, same as the CRX channel),
# strips update_url (store owns the update channel), zips with manifest.json
# at root. Do NOT upload release/dist.zip — it contains the injected update_url.
#
# Usage:  npm run build ; .\scripts\pack-store.ps1
# Output: <repo>\Tihoka_<version>.zip
[CmdletBinding()]
param([string]$Out = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root 'dist'
if (-not (Test-Path "$dist\manifest.json")) { throw "dist missing - run 'npm run build' first" }
if (-not $Out) {
  $version = (Get-Content (Join-Path $root 'package.json') | ConvertFrom-Json).version
  $Out = Join-Path $root "Tihoka_$version.zip"
}

$work = Join-Path $env:TEMP "tihoka-store-pack"
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
Copy-Item $dist $work -Recurse

$mp = Join-Path $work 'manifest.json'
$m = Get-Content $mp -Raw | ConvertFrom-Json
$m.PSObject.Properties.Remove('update_url')
[IO.File]::WriteAllText($mp, ($m | ConvertTo-Json -Depth 100), (New-Object Text.UTF8Encoding $false))

Push-Location $work
& "$env:WINDIR\System32\tar.exe" -a -cf $Out *
Pop-Location
if ($LASTEXITCODE -ne 0) { throw 'zip failed' }
if ((& "$env:WINDIR\System32\tar.exe" -tf $Out) -notcontains 'manifest.json') { throw 'zip missing manifest.json at root' }

Remove-Item $work -Recurse -Force
Write-Output "Done: $Out"
