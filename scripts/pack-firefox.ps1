# Pack dist-firefox/ into the AMO submission zip + a source archive for review.
# Usage: npm run build:firefox; .\scripts\pack-firefox.ps1
#
# Compress-Archive and .NET Framework ZipFile write '\' entry names on Windows —
# AMO rejects them ("Invalid file name in archive"). Windows bsdtar writes
# proper '/' entries, so both archives go through System32 tar.exe.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$version = (Get-Content package.json | ConvertFrom-Json).version
$extZip = "tihoka-firefox-$version.zip"
$srcZip = "tihoka-source-$version.tar.gz"
$bsdtar = "$env:WINDIR\System32\tar.exe"

if (-not (Test-Path 'dist-firefox\manifest.json')) {
  throw "dist-firefox missing — run 'npm run build:firefox' first."
}

if (Test-Path $extZip) { Remove-Item $extZip -Force }
Push-Location dist-firefox
& $bsdtar -a -cf "..\$extZip" *
Pop-Location
if ($LASTEXITCODE -ne 0) { throw "extension zip failed" }

if (Test-Path $srcZip) { Remove-Item $srcZip -Force }
& $bsdtar -czf $srcZip `
  --exclude=$srcZip --exclude=$extZip `
  --exclude=node_modules --exclude=.git --exclude=dist --exclude=dist-firefox `
  --exclude=build --exclude=coverage --exclude=e2e-results --exclude=.playwright-mcp `
  --exclude=tmp --exclude=data --exclude=loop --exclude=Tihoka-worktrees `
  --exclude='*.pem' --exclude='.env.local' --exclude='*.crx' --exclude='*.zip' --exclude='*.rar' .
if ($LASTEXITCODE -ne 0) { throw "source archive failed" }

$extEntries = (& $bsdtar -tf $extZip)
if ($extEntries -notcontains 'manifest.json') { throw "$extZip missing manifest.json at zip root" }
$bad = @($extEntries | Where-Object { $_ -match '\\' }).Count
if ($bad -gt 0) { throw "$extZip has $bad backslash entries" }

Write-Output "$extZip  ($('{0:N1}' -f ((Get-Item $extZip).Length / 1MB)) MB, $($extEntries.Count) entries)"
Write-Output "$srcZip  ($('{0:N1}' -f ((Get-Item $srcZip).Length / 1MB)) MB)"
Write-Output 'Done — upload the .zip to AMO, .tar.gz at the source-code step.'
