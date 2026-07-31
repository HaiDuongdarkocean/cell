# Migration script: update showcaseMeta from group → level + category
# Maps old technical groups to new Foundations/Atoms taxonomy

$ErrorActionPreference = 'Stop'

# Mapping: old group → { level, category }
# All current showcases are either Foundations (tokens) or Atoms (primitives)
$groupMap = @{
  'Tokens'                = @{ level = 'foundations'; category = 'Spacing' }  # Spacing Scale
  # Color Scale has group 'Tokens' too — handle separately below
  'Generic Core'          = @{ level = 'atoms'; category = 'Content' }
  'Shared UI — Action'    = @{ level = 'atoms'; category = 'Action' }
  'Shared UI — Input'     = @{ level = 'atoms'; category = 'Input' }
  'Shared UI — Feedback'  = @{ level = 'atoms'; category = 'Feedback' }
  'Shared UI — Data'      = @{ level = 'atoms'; category = 'Display' }
  'Shared UI — Overlay'   = @{ level = 'atoms'; category = 'Overlay' }
  'Shared UI — Navigation'= @{ level = 'atoms'; category = 'Navigation' }
  'Layout'                = @{ level = 'atoms'; category = 'Layout' }
  'Display'               = @{ level = 'atoms'; category = 'Content' }
  'Extension'             = @{ level = 'atoms'; category = 'Action' }
  'Utility'               = @{ level = 'atoms'; category = 'Utility' }
  'Domain — Video'        = @{ level = 'atoms'; category = 'Action' }
  'Domain — Subtitle'     = @{ level = 'atoms'; category = 'Content' }
  'Domain — Dictionary'   = @{ level = 'atoms'; category = 'Content' }
  'Domain — Learning'     = @{ level = 'atoms'; category = 'Feedback' }
  'Features'              = @{ level = 'atoms'; category = 'Display' }
}

# Special per-file overrides for Foundations
$foundationsMap = @{
  'src/shared/ui/Spacing.showcase.tsx'    = @{ level = 'foundations'; category = 'Spacing' }
  'src/shared/ui/ColorScale.showcase.tsx' = @{ level = 'foundations'; category = 'Color' }
}

$srcRoot = 'src'
$showcaseFiles = Get-ChildItem -Path $srcRoot -Filter '*.showcase.tsx' -Recurse

$updated = 0
$skipped = 0
$missing = @()

foreach ($file in $showcaseFiles) {
  $relativePath = $file.FullName -replace [regex]::Escape((Get-Location).Path + '\'), '' -replace '\\','/'
  $content = Get-Content $file.FullName -Raw -Encoding UTF8

  # Check if already has level field
  if ($content -match 'level:\s*[''"]?(foundations|atoms)') {
    $skipped++
    continue
  }

  # Extract current group
  $groupMatch = [regex]::Match($content, "group:\s*['""]([^'""]+)['""]")
  if (-not $groupMatch.Success) {
    $missing += $relativePath
    continue
  }

  $oldGroup = $groupMatch.Groups[1].Value

  # Check special foundations override
  if ($foundationsMap.ContainsKey($relativePath)) {
    $mapping = $foundationsMap[$relativePath]
  }
  elseif ($groupMap.ContainsKey($oldGroup)) {
    $mapping = $groupMap[$oldGroup]
  }
  else {
    $missing += "$relativePath (unknown group: $oldGroup)"
    continue
  }

  $level = $mapping.level
  $category = $mapping.category

  # Replace group: 'X' with level + category
  # Keep group as-is for backward compat but add level + category after it
  $newMeta = "level: '$level',`n  category: '$category',`n  group: '$oldGroup'"
  $newContent = $content -replace "group:\s*['""]$([regex]::Escape($oldGroup))['""]", $newMeta

  if ($newContent -ne $content) {
    Set-Content $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
    $updated++
    Write-Host "  MIGRATED: $relativePath -> level=$level category=$category"
  }
  else {
    $missing += "$relativePath (no replacement made)"
  }
}

Write-Host ""
Write-Host "=== Migration Summary ==="
Write-Host "Updated: $updated"
Write-Host "Skipped (already migrated): $skipped"
Write-Host "Missing/Errors: $($missing.Count)"
if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Missing files:"
  foreach ($m in $missing) { Write-Host "  $m" }
}
