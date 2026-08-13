# ADR: Subtitle Appearance in Manager Panel

**Date:** 2026-08-13
**Status:** Accepted

## Context

Subtitle appearance customization (Target style, Native style, Block position/scale/opacity, NavCluster appearance) previously lived in the Settings Dialog. Users had to open Settings separately to change font size, color, opacity, or block position — disconnected from where they manage subtitle tracks.

The Subtitle Manager Panel already handles track selection, import, sync offset, and Generate native. Moving appearance controls into the Manager Panel creates a single, cohesive subtitle management surface.

## Decision

Move all subtitle appearance customization from the Settings Dialog to a new "Appearance" view within the Subtitle Manager Panel.

### Key choices

1. **Two-view panel**: Manager has `'tracks' | 'appearance'` view state. "Customize appearance" button in footer switches to appearance view. "← Back to subtitles" at top of body content switches back.

2. **Component ownership**: `SubtitleStylePanel`, `SubtitlePreview`, `SubtitleBlockSettingsPanel`, `NavClusterSettingsPanel` moved from `src/features/settings/ui/` to `src/features/subtitle/ui/appearance/`. Both Settings and Manager import from the new location. Avoids cross-feature coupling `subtitle → settings`.

3. **CSS manifest**: `appearanceShadowCss.ts` is the single source of truth for appearance-related CSS in shadow DOM. Both `mountSubtitle.tsx` and `mountSettingsDialog.ts` consume it.

4. **Debounced persistence**: Style/block/cluster changes debounced 300ms before `saveSettings()`. Partial updates merged with current engine state before persisting (prevents field wipe from shallow merge).

5. **Settings cleanup**: Target, Native, Cluster sections removed from Settings Dialog. Block section keeps behavior (auto-load, languages, auto-translate, ASR). Sidebar items `target`, `native`, `cluster` removed. Orphaned functions (`updateOverlayStyle`, `resetOverlayStyle`, `updateBlock`, `updateNavCluster`) removed.

6. **Layout**: Header sticky (title + close), body scrollable, footer sticky (tracks view only). Appearance view: "← Back to subtitles" at top of body → Block → Target → Native → Cluster sections.

## Consequences

- Settings Dialog is simpler — only behavior settings remain for subtitles.
- Manager Panel is larger but more cohesive — all subtitle UI in one place.
- `features/settings` no longer owns subtitle appearance components.
- `appearanceShadowCss.ts` must be updated when adding new appearance CSS modules.
- `overlayVisible` refactor (per-role visible) is deferred — current global toggle still works, but per-role `visible` in appearance view will need `contentScriptController` refactor to take effect.
