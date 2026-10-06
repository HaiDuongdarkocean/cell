# Verify — player-mode-mobile-layout

Item: `player-mode-mobile-layout` (deliver → shipped gate)
Commit: `f676bc19 feat(subtitle): mobile Player Mode reading-deck layout for <600px`
Spec: `docs/specs/player-mode-mobile-layout.md`
Mockup: `docs/mockups/player-mode-mobile-layout.png`

## Deterministic gates (recorded on committed HEAD f676bc19)

| Gate | Result |
|---|---|
| `npm run typecheck` | pass — 0 errors |
| `npm run lint` | pass — 0 errors (4 pre-existing warnings in srs/, untouched) |
| `npm run test:unit` | pass — 677 suites / 8043 tests (includes 12 new mobile tests) |
| `npm run build` | pass — vite build + postbuild patches OK |
| `browser` | pass — real Chrome, emulated 390×780 mobile + 1280×800 desktop, screenshots below |

## Browser evidence (dev-server harness `concept=real&bare`, real `PlayerModeOverlay`)

- `docs/mockups/player-mode-mobile-layout-impl-dark.png` — 390×780 dark: cue-card stack, active card with `border 4px primary` + elevated surface, `pm-card-actions` (zap/pencil) inside the active card top-right, peek card fading under the transparent anchor band via `mask-image`, CC left + generate-native right rail, bottom bar `X ‹ ↻ ▶ › ⋯` with hero `warningSubtle` xl.
- `docs/mockups/player-mode-mobile-layout-impl-light.png` — light theme: tokens resolve, same geometry.
- `docs/mockups/player-mode-mobile-layout-impl-menu.png` — `pm-more-menu` open: canonical `Menu` aligned right, anchored above the bar (contains cue-list toggle + OCR in harness; production adds study modes/speed/practice — props-driven).
- `docs/mockups/player-mode-mobile-layout-impl-desktop.png` — 1280×800: desktop branch pixel-identical to previous dock layout (video stage + side cue list + `overlay-player-action` dock). No regression.

## DOM/runtime assertions (Chrome devtools)

- `document.documentElement[data-cell-player-mode-mobile]` = `"true"` while mobile PM mounted; removed on unmount (unit test).
- `--pm-anchor-bottom` = `109px` — computed from real bottomBar + caption + anchorRow heights; pill re-docks via `:host-context` in `ComprehensionPill.module.css` (pill ships via `allModuleCss` glob, verified in manifest).
- Cue region: `overflow-y: hidden`, `scrollbar-width: none`, `::-webkit-scrollbar` hidden — no user scroll; `scrollTop` still writable by the system's align() logic (system-driven positioning per spec).
- Menu stacking: `pm-more-menu` portals into `.overlay` via new `Popover.container` prop — escapes the `.portal` wrapper's `z-popover`(1500) stacking context which was painting it behind `z-overlay-settings`(10001). `elementFromPoint` on the menu returns `panel-toggle-btn` — verified topmost.

## AC trace (docs/specs/player-mode-mobile-layout.md)

- AC-1/2 stack + geometry: ✅ branch at `viewport.w < 600` exactly; `PM_MOBILE_BAR_HEIGHT_PX` feeds `resolvePlayerModeLayout`; video inset `space-3` + `radius-2xl`.
- AC-3 adaptive nav: ✅ unit-tested both directions (`nav-prev`/`nav-next` vs `nav-rewind`/`nav-forward`); menu contains none of them.
- AC-4 action placement: ✅ `pm-card-actions` inside active card; `player-mode-actions` rail = `pm-fab-slot` + `generate-native-btn`; `manager-toggle-btn` on anchor row.
- AC-5 anchor band + pill centering: ✅ transparent band overlays cue region; pill centers via `:host-context` (remount-safe, self-restoring).
- AC-6/7 display modes: ✅ `PLAYER_MODE_CUE_DISPLAY` persisted + `storage.onChanged` live-update (unit test fires the listener); `active` mode renders current cue or next-upcoming dimmed; `showAllCues` session escape via menu item; Manager panel row (`pm-cue-display-row`, InkTabs) writes the same key.
- AC-8 practice: ✅ `practiceMode` gates `SubtitlePracticeSession`; `data-practice-active` preserved; `@media max-height:568px` hides bar+band during practice.
- AC-9 dock removal: ✅ no `overlay-player-action`/dock on mobile (asserted absent in tests + screenshot).
- AC-10/15 non-scroll cue region: ✅ CSS + runtime assertion.
- AC-11/12 menu + Escape order: ✅ menu closes on capture-phase Escape (escapeLayerStack) before cue-list/exit handlers; unit-tested.
- AC-13/14 desktop + split view: ✅ desktop screenshot unchanged; `pmMobile`/`mobile` props default off — Split View path untouched; `subtitle-split-view-ac.md` surfaces (panel chrome, drag handle, scroll behavior) only change under `mobile` prop which split view never sets.
- i18n: all new strings in en+vi (`subtitle.playerMode.{more,menuLabel,hideCueList,showCueList,showAllCues,trackCaption,speedValue,displayMode,.list,.active}`).
- Touch targets: transport `lg` (48px), hero `xl` (56px→64px visual), rail/md (40px), exit/more `md`+`ghost` — all ≥40px.
- Reduced-motion block preserved; safe-area `env(safe-area-inset-bottom)` in `.bottomBar`.

## Known limitations (harness-scoped, not defects)

- Comprehension pill absent from screenshots — it mounts via `mountComprehensionPill` content script, not in the mock harness; its reposition is pure CSS (`:host-context`) and the trigger attribute + runtime var are asserted live.
- `pm-caption` track label and cue-filter FAB not visible in harness (no manager state / `cueFilter` props) — both wired in production via `SubtitlePanels` and `SubtitlePanel` portal; `pm-fab-slot` + `pm-caption` nodes verified present.
- Mockup entrypoint `src/entrypoints/mockup-player-mode-mobile-layout/` left untracked (design-time); to be removed at ship per repo hygiene rule.

VERDICT: PASS
