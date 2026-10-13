# Release Tihoka to GitHub Releases (tihoka-official/tihoka) — artifacts only, no source.
#
#   Chrome lane: packs dist/ -> Tihoka_<version>.crx (signed with tihoka-key.pem), generates
#     updates.xml whose codebase points at the release asset, injects
#     update_url=https://github.com/<repo>/releases/latest/download/updates.xml
#     into the packed manifest (restored afterwards). Chrome clients poll that
#     stable URL, so the repo never needs a commit per release.
#   Firefox lane: packs dist-firefox/ via bsdtar (forward-slash entries — AMO
#     rejects Compress-Archive output) and attaches it for the record. AMO is the
#     real update channel; this asset is the submitted artifact.
#
# The release tag needs one commit to attach to. If the repo is empty the script
# bootstraps a throwaway commit containing only README.md + LICENSE via a temp
# dir — the working repo is never touched and no source is pushed.
#
# Prereqs: gh auth login (repo tihoka-official/tihoka), npm run build:firefox done.
# Usage:  .\scripts\release-github.ps1                    # release current version
#         .\scripts\release-github.ps1 -Bump patch        # bump 0.1.3 -> 0.1.4, then release
#         .\scripts\release-github.ps1 -Bump 0.2.0        # explicit version, then release
#         -SkipBuild reuses existing dist/ + dist-firefox/
[CmdletBinding()]
param([switch]$SkipBuild, [string]$Bump)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$ship = Get-Content 'scripts/ship.config.json' | ConvertFrom-Json
$repo = if ($ship.githubRepo) { $ship.githubRepo } else { 'tihoka-official/tihoka' }
$version = (Get-Content package.json | ConvertFrom-Json).version

if ($Bump) {
  $p = $version -split '\.'
  switch -Regex ($Bump) {
    '^major$' { $p[0] = [int]$p[0] + 1; $p[1] = 0; $p[2] = 0 }
    '^minor$' { $p[1] = [int]$p[1] + 1; $p[2] = 0 }
    '^patch$' { $p[2] = [int]$p[2] + 1 }
    '^\d+\.\d+\.\d+$' { $p = $Bump -split '\.' }
    default { throw "-Bump must be major|minor|patch or an explicit x.y.z version" }
  }
  $newVersion = $p -join '.'
  foreach ($f in 'package.json', 'public/manifest.json', 'manifest.json') {
    $path = Join-Path $root $f
    $t = Get-Content $path -Raw
    $t = [regex]::Replace($t, '"version"\s*:\s*"' + [regex]::Escape($version) + '"', '"version": "' + $newVersion + '"', 1)
    [IO.File]::WriteAllText($path, $t, (New-Object Text.UTF8Encoding $false))
  }
  Write-Output "  [bump] $version -> $newVersion (package.json, public/manifest.json, manifest.json)"
  $version = $newVersion
}

$tag = "v$version"
$manifestVer = (Get-Content public/manifest.json | ConvertFrom-Json).version
if ($manifestVer -ne $version) {
  throw "version mismatch: package.json=$version vs public/manifest.json=$manifestVer — run with -Bump"
}

$ghAuthed = $true
try { & gh auth status *>$null; if ($LASTEXITCODE -ne 0) { $ghAuthed = $false } } catch { $ghAuthed = $false }
if (-not $ghAuthed) { throw "gh not authenticated — run 'gh auth login' first" }

$crxAssetName = (($ship.crxAssetName) ? $ship.crxAssetName : 'Tihoka_{version}.crx') -replace '\{version\}', $version
$crxURL = "https://github.com/$repo/releases/download/$tag/$crxAssetName"
$updateURL = "https://github.com/$repo/releases/latest/download/updates.xml"
$bsdtar = "$env:WINDIR\System32\tar.exe"
$keyFile = Join-Path $root 'tihoka-key.pem'
$work = Join-Path $env:TEMP "tihoka-release-$version"
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force -Path $work | Out-Null

if (-not $SkipBuild) {
  & npm.cmd run build:firefox
  if ($LASTEXITCODE -ne 0) { throw 'build:firefox failed' }
}

foreach ($d in 'dist', 'dist-firefox') {
  if (-not (Test-Path "$d\manifest.json")) { throw "$d missing — run 'npm run build:firefox' first" }
}

$manifestPath = Join-Path $root 'dist\manifest.json'
$manifestBackup = "$manifestPath.relbackup"
Copy-Item $manifestPath $manifestBackup -Force

try {
  $manifest = (Get-Content $manifestPath -Raw | ConvertFrom-Json)
  $manifest | Add-Member -Name 'update_url' -Value $updateURL -MemberType NoteProperty -Force
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 100), (New-Object Text.UTF8Encoding $false))

  $crx = Join-Path $work $crxAssetName
  $updates = Join-Path $work 'updates.xml'
  $crx3 = Join-Path $root 'node_modules\.bin\crx3.cmd'
  if (Test-Path $crx3) {
    & $crx3 -p $keyFile -o $crx -x $updates --crxURL $crxURL --appVersion $version dist
  } else {
    & npx --yes crx3 -p $keyFile -o $crx -x $updates --crxURL $crxURL --appVersion $version dist
  }
  if ($LASTEXITCODE -ne 0) { throw 'crx3 pack failed' }
} finally {
  Move-Item $manifestBackup $manifestPath -Force
}

$ffZip = Join-Path $work "Tihoka_firefox-$version.zip"
Push-Location dist-firefox
& $bsdtar -a -cf $ffZip *
Pop-Location
if ($LASTEXITCODE -ne 0) { throw 'firefox zip failed' }
if ((& $bsdtar -tf $ffZip) -notcontains 'manifest.json') { throw 'firefox zip missing manifest.json at root' }

# Bootstrap: gh release needs a commit to tag; if the repo has none, push a
# README-only commit from a temp dir (no source ever leaves this repo).
$refs = $null
try { $refs = & git ls-remote "https://github.com/$repo.git" 2>$null } catch { $refs = $null }
if (-not $refs) {
  $seed = Join-Path $work 'seed'
  New-Item -ItemType Directory -Force -Path $seed | Out-Null
  Push-Location $seed
  & git init -q; & git checkout -qb main
  "# Tihoka`n`nReleases for the Tihoka browser extension. Source is private.`n" | Out-File -Encoding utf8 README.md
  Copy-Item (Join-Path $root 'LICENSE') .
  & git add README.md LICENSE; & git -c user.email=release@tihoka.dev -c user.name=tihoka commit -qm 'init: releases landing'
  & git remote add origin "https://github.com/$repo.git"
  & git push -qu origin main
  $pushOk = ($LASTEXITCODE -eq 0)
  Pop-Location
  if (-not $pushOk) { throw 'bootstrap push failed — check gh auth has repo push access' }
  Write-Output '  [OK] bootstrapped repo with README + LICENSE (no source)'
}

$notes = "Tihoka $version`n`n- Chrome (self-hosted): $crxAssetName — auto-update via updates.xml`n- Firefox: Tihoka_firefox-$version.zip — install/update via addons.mozilla.org`n"
& gh release create $tag $crx $updates $ffZip --repo $repo --title "Tihoka $version" --notes $notes
if ($LASTEXITCODE -ne 0) { throw 'gh release create failed' }

Remove-Item $work -Recurse -Force
Write-Output "Done: https://github.com/$repo/releases/tag/$tag"
Write-Output "update_url (already embedded): $updateURL"
