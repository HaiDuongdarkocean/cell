# Design Review — Player Mode mobile layout (<600px)

> Spec: `docs/specs/player-mode-mobile-layout.md` · Brief: `docs/intent/player-mode-mobile-layout-design-brief.md` · Mapping: `docs/intent/player-mode-mobile-layout-component-mapping.md` · Mockup code: `src/entrypoints/mockup-player-mode-mobile-layout/`

VERDICT: APPROVE

## Verdict: APPROVED — design khớp spec, sẵn sàng deliver

## Checklist

| Check | Kết quả |
|---|---|
| Mọi vùng mockup 1–14 map vào component/region | ✅ mapping table đầy đủ |
| C5 `data-tihoka-id` contract giữ/đổi đúng bảng branch-scoped | ✅ `nav-cluster`, `nav-*`, `pm-*` mới rõ ràng |
| Không component shared mới không cần thiết | ✅ mọi region là CSS trong `PlayerModeOverlay.module.css`; nút = `Button`/`Menu`/`MenuItem` shared |
| Tokens only, không hardcode | ✅ mapping leaf tokens; runtime var `--pm-anchor-bottom` là exception được justify (pill offset động) |
| i18n/a11y | ✅ menu items có label i18n; touch ≥44px; `env(safe-area-inset-bottom)` |
| Contrast | ✅ bảng ratio trong brief, tất cả ≥4.5:1 dark theme |
| Responsive boundary | ✅ <600px branch mới; ≥600px desktop giữ nguyên; split-view untouched |
| States đầy đủ | ✅ default/no-cues/active-mode/list-hidden/practice/menu-open/pill-absent/short-height/safe-area |
| Phá vỡ pattern không cần thiết | không — `pointer-events:none` rail/band guard tap-through |

## Quyết định design cần giữ khi implement

1. **Detach không scroll**: `pm-cue-region` `overflow:hidden` + `mask-image` fade; system điều khiển vị trí card — KHÔNG user scroll.
2. **Pill reposition thuần CSS**: `data-tihoka-player-mode-mobile` trên `documentElement` + `:host-context` — không sửa `mountComprehensionPill` internals.
3. **Adaptive transport**: `cues===0` → prev/next swap thành rewind/forward; KHÔNG có rewind/forward trong ⋯ menu.
4. **Button subtle-family**: `primarySubtle` transport+quick-add, `warningSubtle` hero, `errorSubtle` edit-card, `neutralSubtle` filter/generate/CC, `ghost` X/⋯.
5. **Icon scale theo `iconbutton-icon-{xs..xl}`** = 16/18/20/24/28 (~50–57% container); glyphs bare (`chevronLeft`/`rotateCcw`/`play`/`pause`/`chevronRight`/`captions`).
6. **Card rail trong card**: `pm-card-actions` nằm trong bounds active card; card có `padding-right` ≥ rail.
7. **⋯ menu = `Menu` shared**, align right, `pm-more-menu`; study modes + speed = radio MenuItems.

## Risk đã chấp nhận

- Landscape phone ≥600w giữ desktop branch (intent).
- `trackLabel` format: dùng manager state's active target track label, fallback `subtitleOverlayTargetLanguage`.
- Display-mode toggle sống trong Subtitle Manager row mới (i18n: en+vi).

## Gates khi deliver

`npm run typecheck && npm run lint && npm run test:unit && npm run build` + screenshot <600px so `docs/mockups/player-mode-mobile-layout.png` + AC-6.3/6.4 re-verify.
