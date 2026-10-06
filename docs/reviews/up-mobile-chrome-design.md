# Design Review — up-mobile-chrome (all-mode, vision-reader equivalent)

> Artifacts: `docs/intent/up-mobile-chrome-design-brief.md` · `docs/intent/up-mobile-chrome-component-mapping.md` · mockup `src/entrypoints/mockup-up-mobile-chrome/` · evidence `tmp/up-mobile-chrome/` (13 PNGs + DOM measurement + pixel scan)
> `check-design-brief.mjs up-mobile-chrome` → `VERDICT: PASS` (9 component refs resolved).

## Rendered evidence (Playwright Chromium, bare stage = full viewport)

| Case | Result |
|---|---|
| 320px en | 5 items, zero clipped labels, pill 20×2px primary on active, title "Dictionary", capsule 90px+1px seam, peek 56px "Card Creator" |
| 320px vi | identical pass — title "Từ điển", peek "Tạo thẻ", no clipping (vi is the wider set) |
| 390px en+vi | all labels complete, pill painted (pixel run = 20px), bottom edge uniform (nav owns edge) |
| 390px demoted active (Playlist) | no bar pill anywhere; title "Playlist"; Tools sheet row `aria-current="true"`; no grabber; close 44×44px |
| 320px vocabulary | toolbar is a scroll region; no chip clipped; last chip reachable by scroll |
| 768px | same resolved chrome — fullscreen, 5 slots, pill, title (hybrid gone) |
| closed state | badge renders on host page; absent whenever panel open |
| real 390px baseline | 7 items, stretched capsule (284px), anonymous 32px peek, badge painted above panel — contrast confirmed |

Pixel scan (sampled PNGs): non-blank (28–45 unique colors), primary painted at expected positions, sheet surface elevated over dimmed overlay, bottom-edge row uniform (no host-page strip).

## DS-faithfulness judgment (surfaces / shape / type / targets / states)

1. **Surfaces:** solid token fills only (`surface`, `surface-elevated`, `background`, `color-overlay` scrim) — no glass/blur. PASS
2. **Shape:** `radius-full` pill, `radius-pill` capsule, `radius-xl` tool rows, `radius-element` sheet — all existing system radii; small `radius-sm` right-caps on the sheet-row pill per the NavItem vertical recipe. PASS
3. **Typography:** nav `sizes-xs` (12px floor, never below), title `sizes-sm` `weights-semibold`, peek `sizes-xs` `weights-medium` `color-text-tertiary`, sheet title unchanged. Rhythm matches sibling panels. PASS
4. **Touch targets:** close 44×44px (`touchTarget-mobile`), rows ≥44px, rail items 52px tall. Not cramped at 320px. PASS
5. **States:** active pill + color (never color alone), `aria-current` on bar + sheet rows, `aria-expanded`/`aria-haspopup` on Tools, `aria-pressed` capsule halves, focus ring preserved, `:focus` fill suppression kept. PASS
6. **Deviations vs shipped panel:** all intentional (7→5 destinations, stretched→natural capsule, anonymous→named peek, decorative grabber→absent, ~32px→44px close, color-only→pill indicator, badge over→suppressed, 94% hybrid→fullscreen ≤839px). No unintended deviation observed.

## Recorded DESIGN decisions (spec gates)

- **600–839px band:** fullscreen phone chrome (REQ-5 primary) — hybrid removed; card model rejected (second chrome model for an unmeasured user class; phone chrome already active in-band). Recorded in brief §ASCII + States.
- **Demoted pair: playlist + recap — CONFIRMED.** Measured intrinsic label widths at `sizes-xs`: "Dictionary" 59px, "Vocab" 36px, "Study" 33px, "Settings" 47px, "Tools" 31px; vi "Từ điển/Từ vựng/Cài đặt/Công cụ" all ≤~47px. Widest ("Dictionary", 59px) fits a ~61px slot at 320px **only after horizontal padding yields** — the label-budget rule was discovered by measurement and is now a brief State (item padding `spacing-0`, label `min-width:0`). No new i18n keys needed.
- **Grabber:** `hideDragHandle` per consumer (absent, honest) — real drag-to-dismiss not designed (low-RAM jitter risk).
- **REQ-9 mechanism:** horizontal scroll region (not overflow Menu) — one CSS mechanism, no new semantics.
- **Bottom-edge guard:** extra bottom inset (`spacing-8` padding + `scroll-padding-bottom`); scroll-fade optional per spec's "and/or".
- **Badge channel:** `PanelMountController.onOpenChange` → `hide()`/`show()`; suppressed flag consulted inside `onFullscreenChange`. Mockup demonstrates open→absent / closed→rendered loop.
- **44px floor caveat:** `touchTarget` var resolves 40px under fine pointer — the coarse floor is `touchTarget-mobile`; REQ-8's implementation must bind the mobile floor (or consume item 30's mechanism), not the adaptive var.

## Deviations / needs

none — mockup is a design-time artifact; hashed-class overrides in `mockup.module.css` are for demonstration only.

VERDICT: PASS
