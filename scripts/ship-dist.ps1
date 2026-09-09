# Ship the current dist build:
#   1. Pack dist/ into a .crx using the project's private key.
#   2. Generate an update manifest (updates.xml) for Chrome auto-update.
#   3. Rotate release -> archive on the target drive.
#   4. Copy dist/, dist.zip, cell.crx and updates.xml into the release folder.
#   5. Optionally create a GitHub release and upload assets (when configured).
#
# Usage:
#   npm run build
#   .\scripts\ship-dist.ps1
#   npm run ship:dist
#
# Configuration: edit `scripts/ship.config.json` before shipping.
#
# Sources:
#   - Chrome extension update manifest: https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux
#   - CRX3 packer: https://www.npmjs.com/package/crx3

[CmdletBinding()]
param(
  [string]$SourceRoot = '',
  [string]$TargetRoot = 'G:\My Drive\Language\Tool',
  [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'

if (-not $SourceRoot) {
  $SourceRoot = if ($PSScriptRoot) { (Get-Item $PSScriptRoot).Parent.FullName } else { (Get-Location).Path }
}
if (-not $ConfigPath) {
  $ConfigPath = Join-Path $PSScriptRoot 'ship.config.json'
}

$sourceDist = Join-Path $SourceRoot 'dist'
$cellDir    = Join-Path $TargetRoot 'cell'
$release    = Join-Path $cellDir 'release'
$archive    = Join-Path $cellDir 'archive'
$keyFile    = Join-Path $SourceRoot 'cell-key.pem'

if (-not (Test-Path $sourceDist -PathType Container)) {
  throw "dist folder not found at: $sourceDist. Run 'npm run build' first."
}

# Load configuration. Missing config is OK: we will still pack a local .crx.
$shipConfig = @{}
if (Test-Path $ConfigPath) {
  $shipConfig = Get-Content $ConfigPath | ConvertFrom-Json
}

$githubRepo    = $shipConfig.githubRepo
$releaseBranch = if ($shipConfig.releaseBranch) { $shipConfig.releaseBranch } else { 'main' }
$updateXmlPath = if ($shipConfig.updateXmlPath) { $shipConfig.updateXmlPath } else { 'updates.xml' }
$crxAssetName  = if ($shipConfig.crxAssetName)  { $shipConfig.crxAssetName }  else { 'cell.crx' }
$publishToGitHub = [bool]$shipConfig.publishToGitHub

if (-not (Test-Path $keyFile)) {
  throw "Private key not found at: $keyFile. Generate one with 'npx crx3 -p <name>.pem dist' or copy an existing key."
}

# The .crx version and GitHub tag are driven by package.json, but must match the built manifest.
$packageJsonPath = Join-Path $SourceRoot 'package.json'
$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
$version = $packageJson.version

$manifestPath = Join-Path $sourceDist 'manifest.json'
$distManifest = Get-Content $manifestPath | ConvertFrom-Json
if ($distManifest.version -ne $version) {
  Write-Warning "package.json version ($version) does not match dist/manifest.json version ($($distManifest.version)). The .crx will use the dist manifest version for the update check."
}

# Derive the public update URL and the per-release .crx download URL.
$updateUrl = $null
$codebaseUrl = $null
if ($githubRepo) {
  $updateUrl = "https://raw.githubusercontent.com/$githubRepo/$releaseBranch/$updateXmlPath"
  $codebaseUrl = "https://github.com/$githubRepo/releases/download/v$version/$crxAssetName"
  Write-Host "Update URL:  $updateUrl"
  Write-Host "Codebase URL: $codebaseUrl"
} else {
  Write-Warning "No 'githubRepo' in $ConfigPath. The .crx will be packed without an update_url, and updates.xml will contain a placeholder codebase."
  $codebaseUrl = "https://example.com/$crxAssetName"
}

# Inject update_url into dist/manifest.json before packing, then restore the original.
$manifestBackup = $manifestPath + '.ship-backup'
$originalManifest = Get-Content $manifestPath -Raw
Copy-Item $manifestPath $manifestBackup -Force

try {
  $manifest = $originalManifest | ConvertFrom-Json
  if ($updateUrl) {
    $manifest | Add-Member -Name 'update_url' -Value $updateUrl -MemberType NoteProperty -Force
  }
  $manifest | ConvertTo-Json -Depth 100 | Set-Content $manifestPath
  Write-Host '  [OK] Injected update_url into dist/manifest.json for packing'

  # 1. Delete oldest archive.
  if (Test-Path $archive) {
    Remove-Item $archive -Recurse -Force
    Write-Host '  [OK] Deleted old archive'
  }

  # 2. Promote current release to archive.
  if (Test-Path $release) {
    Move-Item $release $archive -Force
    Write-Host '  [OK] Moved release -> archive'
  }

  # 3. Prepare new release directory.
  New-Item -ItemType Directory -Force -Path $release | Out-Null

  # 4. Pack .crx and write updates.xml in the release folder.
  $crxOutput = Join-Path $release $crxAssetName
  $xmlOutput = Join-Path $release $updateXmlPath

  # Use the local crx3 binary when installed, otherwise npx will fetch it.
  $crx3Bin = Join-Path $SourceRoot 'node_modules/.bin/crx3.cmd'
  if (Test-Path $crx3Bin) {
    & $crx3Bin -p "$keyFile" -o "$crxOutput" -x "$xmlOutput" --crxURL "$codebaseUrl" --appVersion "$version" "$sourceDist"
  } else {
    & npx --yes crx3 -p "$keyFile" -o "$crxOutput" -x "$xmlOutput" --crxURL "$codebaseUrl" --appVersion "$version" "$sourceDist"
  }
  if ($LASTEXITCODE -ne 0) { throw "crx3 pack failed with exit code $LASTEXITCODE" }
  Write-Host "  [OK] Packed $crxAssetName and $updateXmlPath"

  # 4b. Also write updates.xml into the repo at the path used by update_url,
  # so it can be committed to the configured branch (e.g. GitHub raw).
  if ($githubRepo) {
    $repoXmlOutput = Join-Path $SourceRoot $updateXmlPath
    $repoXmlDir = Split-Path $repoXmlOutput -Parent
    if ($repoXmlDir -and -not (Test-Path $repoXmlDir)) {
      New-Item -ItemType Directory -Force -Path $repoXmlDir | Out-Null
    }
    Copy-Item $xmlOutput $repoXmlOutput -Force
    Write-Host "  [OK] Copied $updateXmlPath to repo root for committing"
  }

  # 5. Copy dist folder into release.
  $destDist = Join-Path $release 'dist'
  Copy-Item $sourceDist $destDist -Recurse -Force
  Write-Host '  [OK] Copied dist folder'

  # 6. Zip the copied dist folder.
  $destZip = Join-Path $release 'dist.zip'
  Compress-Archive -Path $destDist -DestinationPath $destZip -Force
  Write-Host "  [OK] Created $destZip"

  # 7. Optionally publish to GitHub releases.
  if ($publishToGitHub -and $githubRepo) {
    if (Get-Command gh -ErrorAction SilentlyContinue) {
      $tag = "v$version"
      $releaseTitle = "Cell $version"
      gh release create $tag "$crxOutput#$crxAssetName" "$xmlOutput#$updateXmlPath" --repo $githubRepo --title $releaseTitle --generate-notes
      if ($LASTEXITCODE -ne 0) { throw "gh release create failed with exit code $LASTEXITCODE" }
      Write-Host "  [OK] Created GitHub release $tag"
    } else {
      Write-Warning "gh CLI not found. Skipping GitHub release. Install it from https://cli.github.com/"
    }
  }
} finally {
  # Always restore the original dist/manifest.json so the next build starts clean.
  if (Test-Path $manifestBackup) {
    Move-Item $manifestBackup $manifestPath -Force
    Write-Host '  [OK] Restored dist/manifest.json'
  }
}

Write-Host "Done. New release at: $release"
