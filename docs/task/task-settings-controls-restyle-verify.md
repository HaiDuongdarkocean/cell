# G5 Verify Report — Settings Controls Restyle

> **Date**: 2026-07-04
> **Spec**: `docs/specs/spec-settings-controls-restyle.md`
> **Plan**: `docs/plan/plan-settings-controls-restyle.md`

## Acceptance Criteria Verification

### A1: Toggle atom (3 toggles) — PASS
- **Toggle auto select**: role=switch, aria-checked=false, aria-pressed=false, class `_toggle_10wyk_5` ✓
- **Toggle overlay auto-load**: role=switch, aria-checked=false, aria-pressed=false ✓
- **nav-cluster-enabled-toggle**: role=switch, aria-checked=true, aria-pressed=true, class `_toggle_10wyk_5 _on_10wyk_23` (ON state) ✓
- **Toggle ON visual**: bg `rgb(37,99,235)` (primary), 32×18px, thumb translateX(14px) via `matrix(1,0,0,1,14,0)` ✓
- **Dark mode**: toggle ON bg `rgb(96,165,250)` (dark primary `#60a5fa`) ✓
- **Unit tests**: 6/6 pass (Toggle.test.tsx) ✓

### A2: Slider atom (3 sliders) — PASS
- **nav-cluster-button-size**: testid present, value=40, aria-label="Nav cluster button size", class `_slider_7pgrw_5` ✓
- **nav-cluster-bg-opacity**: testid present, value=0.3 ✓
- **nav-cluster-button-opacity**: testid present, value=0.9 ✓
- **Track**: 4px height, bg `rgb(226,232,240)` (`#e2e8f0` border), radius 2px ✓
- **Dark mode**: track bg `rgb(51,65,85)` (`#334155` dark border) ✓
- **Snap logic preserved**: button size 40/48/56 snap ở parent NavClusterSettingsPanel ✓
- **Unit tests**: 5/5 pass (Slider.test.tsx) ✓

### A3: ShortcutInput atom (5 shortcuts) — PASS
- **shortcut-prev-cue**: value=a, class `_shortcutInput_1olrc_5` ✓
- **shortcut-next-cue**: value=d ✓
- **shortcut-replay-cue**: value=s ✓
- **shortcut-toggle-overlay**: value=w ✓
- **shortcut-toggle-panel**: value=t ✓
- **Dark mode**: bg `rgb(30,41,59)` (`#1e293b` dark surface), border `rgb(51,65,85)` (`#334155`) ✓
- **Unit tests**: 6/6 pass (ShortcutInput.test.tsx) ✓

### A4: SubtitlePreview component — PASS
- **subtitle-preview-target**: text "This is how the target subtitle will look." ✓
- **bg**: `rgba(0, 0, 0, 0.85)` (hex #000000 + alpha 0.85) ✓
- **color**: `rgb(255, 255, 255)` (white) ✓
- **fontSize**: 24px (from OverlayStyleConfig) ✓
- **Dark mode**: same (black bg + white text — preview is always black bg regardless of theme) ✓
- **Unit tests**: 8/8 pass (SubtitlePreview.test.tsx) ✓

### A5: Dark + light mode — PASS
- Light: toggle ON `#2563eb`, slider track `#e2e8f0`, shortcut bg `#f8fafc` surface, border `#e2e8f0` ✓
- Dark: toggle ON `#60a5fa`, slider track `#334155`, shortcut bg `#1e293b`, border `#334155` ✓
- All tokens from theme.css, no hardcoded color ✓

### A6: Quality gates — PASS
- `npm run test:unit`: 1474/1475 pass (1 pre-existing fail in conversionTimer.test.ts, unrelated) ✓
- `npx tsc --noEmit`: pass ✓
- `npm run build`: pass (308ms) ✓
- `npm run lint`: pre-existing warnings only (no new errors from this change) ✓

### A7: Browser verify (Edge MCP) — PASS
- Popover 480px, sidebar + 5 cards render ✓
- 3 toggle + 3 slider + 5 shortcut + 2 preview render correctly ✓
- Dark/light toggle correct tokens ✓
- a11y: aria-checked/aria-pressed/aria-label all present ✓

### A8: data-testid preserved — PASS
- `nav-cluster-enabled-toggle` ✓
- `nav-cluster-button-size` ✓
- `nav-cluster-bg-opacity` ✓
- `nav-cluster-button-opacity` ✓
- `shortcut-prev-cue`, `shortcut-next-cue`, `shortcut-replay-cue`, `shortcut-toggle-overlay`, `shortcut-toggle-panel` ✓
- `subtitle-preview-target`, `subtitle-preview-native` ✓

## Summary

All 8 acceptance criteria PASS. Settings panel "ruột" now matches mockup:
- 3 toggle = switch pill 32×18px with slide animation
- 3 slider = styled 4px track + 14px round thumb primary
- 5 shortcut input = uppercase + semibold + center
- 2 subtitle preview = black bg + white text + apply OverlayStyleConfig realtime

Behavior preserved: all data-testid, onChange handlers, settings keys, snap logic, persistence.
