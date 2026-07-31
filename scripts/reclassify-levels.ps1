# Reclassify showcases from atoms to molecules/organisms based on audit
# Usage: pwsh scripts/reclassify-levels.ps1

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/.."

# file => new level
$mapping = @{
  # ORGANISMS (2) — complex sections composing multiple components
  'src/features/dictionaryPopup/ui/PopupDictionary.showcase.tsx' = 'organisms'
  'src/features/cardCreator/ui/CardCreatorDialog.showcase.tsx'   = 'organisms'

  # MOLECULES (27) — compose 2+ atoms
  # Shared UI (16)
  'src/shared/ui/Button.showcase.tsx'         = 'molecules'
  'src/shared/ui/IconButton.showcase.tsx'     = 'molecules'
  'src/shared/ui/CloseButton.showcase.tsx'    = 'molecules'
  'src/shared/ui/CopyButton.showcase.tsx'     = 'molecules'
  'src/shared/ui/PinButton.showcase.tsx'      = 'molecules'
  'src/shared/ui/BackButton.showcase.tsx'     = 'molecules'
  'src/shared/ui/InfoButton.showcase.tsx'     = 'molecules'
  'src/shared/ui/CollapseButton.showcase.tsx' = 'molecules'
  'src/shared/ui/MinimizeButton.showcase.tsx' = 'molecules'
  'src/shared/ui/MaximizeButton.showcase.tsx' = 'molecules'
  'src/shared/ui/Link.showcase.tsx'           = 'molecules'
  'src/shared/ui/Select.showcase.tsx'         = 'molecules'
  'src/shared/ui/Alert.showcase.tsx'          = 'molecules'
  'src/shared/ui/Dialog.showcase.tsx'         = 'molecules'
  'src/shared/ui/Drawer.showcase.tsx'         = 'molecules'
  'src/shared/ui/Thumbnail.showcase.tsx'      = 'molecules'

  # Features (2)
  'src/features/dictionaryPopup/ui/OrbitalBadge.showcase.tsx' = 'molecules'
  'src/features/tokenize/ui/TokenizeFab.showcase.tsx'         = 'molecules'

  # Domain (11)
  'src/shared/domain/subtitle/atoms/LanguageSelector.showcase.tsx'      = 'molecules'
  'src/shared/domain/dictionary/atoms/PronunciationButton.showcase.tsx' = 'molecules'
  'src/shared/domain/learning/atoms/MasteryBadge.showcase.tsx'          = 'molecules'
  'src/shared/domain/video/atoms/PlayPauseButton.showcase.tsx'          = 'molecules'
  'src/shared/domain/video/atoms/MuteButton.showcase.tsx'               = 'molecules'
  'src/shared/domain/video/atoms/FullscreenButton.showcase.tsx'         = 'molecules'
  'src/shared/domain/video/atoms/PiPButton.showcase.tsx'               = 'molecules'
  'src/shared/domain/video/atoms/SkipButton.showcase.tsx'              = 'molecules'
  'src/shared/domain/video/atoms/CaptionsButton.showcase.tsx'          = 'molecules'
  'src/shared/domain/video/atoms/VolumeControl.showcase.tsx'           = 'molecules'
  'src/shared/domain/video/atoms/Timeline.showcase.tsx'                = 'molecules'
}

$changed = 0
$skipped = 0

foreach ($rel in $mapping.Keys) {
  $abs = Join-Path $root $rel
  if (-not (Test-Path $abs)) {
    Write-Warning "MISSING: $rel"
    continue
  }
  $content = Get-Content $abs -Raw
  $newLevel = $mapping[$rel]
  # Replace level: 'atoms' (or any level) with the new level
  if ($content -match "level:\s*'atoms'") {
    $content = $content -replace "level:\s*'atoms'", "level: '$newLevel'"
    Set-Content $abs $content -NoNewline
    Write-Host "  $newLevel  $rel"
    $changed++
  } elseif ($content -match "level:\s*'(foundations|molecules|organisms)'") {
    Write-Host "  SKIP (already $($matches[1]))  $rel"
    $skipped++
  } else {
    Write-Warning "NO level: field in $rel"
  }
}

Write-Host ""
Write-Host "Changed: $changed  Skipped: $skipped  Total mapped: $($mapping.Count)"
