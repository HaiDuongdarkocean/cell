# Overlay Appearance Settings (text opacity + bg opacity + feather blur)

## Problem Statement
How might we let users soften overlay buttons (cluster + upload/manager/toggle) and the subtitle manager panel so they feel "frosted glass" instead of hard solid blocks on video — without breaking readability?

## Recommended Direction
**2 sliders + 4 presets, no border, hardcoded feather blur 1px.**

Two sliders in NavClusterSettingsPanel:
- **Text opacity** (0-100%, default 100%) — controls icon/text clarity inside buttons. Lower = more subtle.
- **Background opacity** (0-100%, default 20%) — controls how solid the button bg is. 0% = transparent (only feather blur visible), 100% = solid.

**Feather blur hardcoded 1px**: `::before` pseudo-element mở rộng `inset: -1.5px` + `backdrop-filter: blur(1px)` + `mask-image: radial-gradient(ellipse, black 55%, transparent 100%)` → feathered edge mịn, button hòa vào video không có ranh giới rõ. Không cần slider cho blur.

**Border removed**: all overlay buttons (cluster + upload + manager + toggle) drop `border: 1px solid var(--color-border)`. Buttons rely on bg fill + feather blur for separation.

**Hover**: icon đổi sang `var(--color-primary)` (xanh) — không còn border-color feedback.

4 preset buttons:
- **Frosted** ← default: text 100%, bg 20%
- **Glass**: text 100%, bg 0%
- **Muted**: text 80%, bg 40%
- **Solid**: text 60%, bg 80%

## Key Assumptions to Validate
- [ ] `backdrop-filter: blur(1px)` + mask performs acceptably on 4GB RAM machines. 1px is minimal, should be fine.
- [ ] No-border buttons with 20% bg + 1px feather remain visible on bright video frames. Test on themoviebox.
- [ ] Firefox supports `backdrop-filter` + `mask-image` (Firefox 103+ yes). Add `-webkit-` prefixes.
- [ ] Settings persist + apply realtime (storage.onChanged → content-script updateSettings path).

## MVP Scope
**In:**
- 2 new settings fields: `textOpacity: number` (0-1), `bgOpacity: number` (0-1) in `NavClusterSettings` (replacing `buttonOpacity`)
- 4 preset buttons in NavClusterSettingsPanel
- CSS: `--sb-text-opacity`, `--sb-bg-opacity` custom properties on block + container + watch-video
- Feather `::before` in `subtitleBlockCss.ts` `.cluster-btn` + overlay buttons
- Remove `border` from overlay buttons
- Hover: `color: var(--color-primary)` thay vì `border-color`

**Out (Not Doing):**
- Background blur slider — hardcoded 1px, không cần user control.
- Feather spread/opacity slider — auto-calculated from blur.
- Live preview thumbnail in Settings dialog.
- Per-surface blur (separate for buttons vs panel).

## Not Doing (and Why)
- **Background blur slider** — 1px hardcoded đủ mịn, user không cần tinh chỉnh. Thêm slider = cognitive overload.
- **Feather spread/opacity slider** — auto từ blur, không cần control riêng.
- **3rd slider** — 2 slider + 4 presets đủ flexible.
- **Live preview in Settings** — requires rendering mini video frame, adds complexity.
- **Border toggle** — border removed entirely, no setting for it.

## Open Questions
- Should `buttonOpacity` (existing setting) be replaced by `bgOpacity`, or kept as alias?
- Does feather `::before` + `mask-image` work inside fullscreen video on all browsers?
- Default: Frosted (text 100%, bg 20%) — confirmed by Anh yêu.
