# ADR-025: Unified Subtitle Block

## Status

Accepted

## Date

2026-07-10

## Context

Current subtitle overlay uses 3 separate floating elements:

- `SubtitleOverlayController` renders two independent `div` layers (`target` + `native`), each with its own drag handle and `yOffsetPercent`.
- `NavClusterController` renders a 6-button floating cluster at its own `position` (x/y).

Problems surfaced in production:

- 3 elements move independently → settings UI has 3 separate position controls.
- Cluster drag handle (pill) and half-circle collapsed state add visual noise.
- Target + native `yOffsetPercent` are easy to misalign; drag on one does not affect the other.
- Fullscreen re-parenting must be handled for each element separately.

## Decision

Merge target, native, and nav cluster into one **Subtitle Block** container.

### Layout

- Container spans full width of the video container.
- 3-column grid: `[cluster] [subtitle] [cluster]` where left/right columns have equal width.
- Cluster: 2 vertical columns of buttons (prev/repeat/next + rewind/forward) on the left.
- Target line on top, native line below it, both centered horizontally relative to the video.
- Move handle removed — the entire block background is draggable.

### Drag

- Drag only on block background (empty areas).
- Subtitle text (`user-select: text`) and cluster buttons are excluded from drag.
- Block background/border only appear while dragging.
- Position is one shared `yOffsetPercent` (0–95, top edge).

### Auto-scale

- Each element has a `baseFontSize` / `baseButtonSize`.
- Runtime size = `baseSize * globalScale * (sqrt(videoWidth * videoHeight) / 1000)` clamped to min/max.
- `ResizeObserver` on video updates sizes when video resizes or enters fullscreen.

### Settings

- `subtitleBlockYOffsetPercent` (0–95)
- `subtitleBlockGlobalScale` (0.5–2)
- `subtitleBlockBgOpacity` (0–1)
- `subtitleOverlayTargetStyle` keeps `fontSize` (base), `textColor`, `backgroundColor`, `backgroundOpacity`, `textOpacity`, `textShadow`, `fontFamily`, `horizontalAlign`, `visible` — `yOffsetPercent` removed.
- `subtitleOverlayNativeStyle` same as target.
- `navClusterEnabled`, `navClusterButtonSize`, `navClusterButtonOpacity` — `position`, `bgOpacity`, `collapsed` removed.

### Migration

- v8 → v9:
  - Remove `navClusterPosition`, `navClusterBgOpacity`, `navClusterCollapsed`.
  - Remove `yOffsetPercent` from `OverlayStyleConfig`.
  - Create `subtitleBlockYOffsetPercent` from average of old `target.yOffsetPercent` and `native.yOffsetPercent` (or one if the other is missing).
  - Create `subtitleBlockGlobalScale` = 1.0, `subtitleBlockBgOpacity` = old `navClusterBgOpacity`.

## Consequences

- One DOM container, one drag listener, one fullscreen re-parent target.
- Settings panel is reorganized into Block / Cluster / Target / Native sections.
- Subtitle is always centered over the video and cannot overflow into cluster or handle area.
- `OverlayStyleConfig` loses `yOffsetPercent` — affects any caller that assumed it.

## Amends

- ADR-013: 2 independent overlay layers replaced by single block.
- ADR-018: Nav cluster position/collapse removed; cluster becomes part of block.
