# Verify review — up-mobile-chrome (Universal Panel mobile chrome)

Reviewer: fresh-context VERIFY (did not implement). Scope: uncommitted working-tree diff vs `docs/specs/up-mobile-chrome.md` (REQ-1…9, AC-1…11), design per `docs/intent/up-mobile-chrome-design-brief.md` + PASS review `docs/reviews/up-mobile-chrome-design.md`.

Evidence: Playwright persistent Chromium (`--load-extension=dist`, headed, `hasTouch`/`isMobile` → coarse pointer) against mock YouTube (`PW_PORT_OFFSET=100` → `127.0.0.1:4422`). Captures + scripts + `results.json` under `tmp/up-mobile-chrome-verify/` (gitignored). Panel opened via real orbital-badge pointer path; all DOM reads traverse shadow roots.

## Per-AC verdict

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 (≤5 destinations, complete ≥12px labels, en+vi) | PASS | Real Chromium 390×844 + 320×844: nav renders exactly 5 destinations (Dictionary · Vocab · Study · Settings · Tools), all labels 12px, `scrollWidth ≤ clientWidth` for every label. vi @320: Từ điển / Từ vựng / Học / Cài đặt / Công cụ — all complete at 12px. ≤359px 10px+ellipsis rule removed from `UniversalPanelBottomNav.module.css`. Captures: `390-panel.png`, `320-panel.png`, `320-vi-panel.png` (pixel scan: nav strip painted, 70 distinct colors). |
| AC-2 (demoted reachable ≤2 taps, identifiable) | PASS | Tools sheet lists Playlist + Recap as nav rows above a `Separator` + tool rows. Tap row → `onTabChange` + sheet close → playlist pane activates (1st tap Tools, 2nd tap row). Active demoted row carries `aria-current="page"` + left-edge `::before` pill + active fg; header title names it. Capture: `390-tools-sheet.png`, `390-tools-active-playlist.png`, `390-playlist-demoted.png`. |
| AC-3 (positional indicator) | PASS | Active item `::after` = bottom-centered bar `var(--space-5)`×`var(--border-width-thick)` (20×2px measured), `radius-full`, `--color-primary` — the NavItem `.horizontal .pill` recipe ported, not a 6th recipe. Pixel scan confirmed primary-color pixels at the active slot's bottom edge. |
| AC-4 (mobile header names active surface) | PASS | `headerTitle` renders full `panel.tab.*` label ("Dictionary" en / "Từ điển" vi / "Playlist" for the demoted tab — any `UniversalPanelTab` covered via `PANEL_TABS.find`). Updates on every switch; `display:none` ≥840px; `flex:1;min-width:0` ellipsis-only-after-capsule+close. |
| AC-5 (capsule natural width + seam, all viewports) | PASS | `flex:1`/`fullWidth` removed; capsule measures 89.3px at both 390px and 1280px (identical — shared fix, no media query). `.half + .half` hairline seam via `--color-divider`. `role="group"`, `aria-pressed`, disabled-media path unchanged. |
| AC-6 (zero host-page pixels ≤839px, browser-chrome dynamics) | PASS (emulation ceiling noted) | Panel rect = `0,0,W,H` exactly at 320/390/768; `border-radius:0`; `height:100%;height:100dvh` with `100%` documented fallback inside `fixed;inset:0` host; inner flex intact (`.body`/`.content` `flex:1;min-height:0`). Chrome show/hide exercised via viewport resize (dvh tracking); literal mobile browser-chrome toggle is not Playwright-emulatable — residual risk on real forks (Kiwi/Quetta) is a documented spec open-question, fallback present. |
| AC-7 (badge suppressed while open, restored, fullscreen-safe) | PASS | Live: `display:none` on the badge host while panel open (390 + playlist active), restored `''` after close. Fullscreen survival: `panelSuppressed` flag consulted inside `onFullscreenChange`'s display-restore (the spec-mandated channel — no parallel override); iframe-fullscreen early-return preserved; covered by 3 new unit tests (open→hide, mount-while-open, fullscreenchange respects flag). Z-index untouched. |
| AC-8 (one chrome model 600–839px) | PASS | At 768: `width:100%;height:100dvh;radius:0`, bottom nav visible, sidebar hidden — the former ≤599px fullscreen sizing remapped to ≤839px, hybrid band removed. Decision recorded in design brief §States + design review "Recorded DESIGN decisions". |
| AC-9 (named Card Creator peek) | PASS | Collapsed `MobileSheet` = 68px = 44px `--touch-target` handle + 24px `header` row (spec's "32+24 per MobileSheet constants" resolves to the item-30-bound `--touch-target` constant — design brief records 64/68px). Header text "Card Creator" (`cardCreator.title`, xs/medium/tertiary, single-line ellipsis). Pill handle intact; tap/drag machinery untouched. `DictionaryTab` right-pane reservation updated to the identical `calc(var(--touch-target) + var(--space-6))`. |
| AC-10 (honest sheet affordances, ≥44px close, clean bottom edge) | PASS | `hideDragHandle` on all five real `BottomSheet` consumers (Tools sheet, `CardCreatorBottomSheet`, `SrsReviewCard`, `ImportWizard`, `CustomModeBuilder`). Close measured 44×44px under coarse pointer (item-30 `--touch-target` floor consumed via `CloseButton`, not re-derived). Bottom guard: `padding-bottom: var(--space-8)` + `scroll-padding-bottom` — inset mechanism per spec's "inset and/or fade". SrsReviewCard pairs `hideHeader`+`hideDragHandle` — its own `SrsEditCardPanel.closeButton` keeps a close affordance; Escape/overlay-click/focus-trap unchanged (`BottomSheet.tsx` itself untouched). |
| AC-11 (320px vocab toolbar unclipped) | PASS | `.toolbar` = `overflow-x:auto` scroll region (scrollbar hidden), controls `flex-shrink:0`, spacer `min-width:0`. At 320: `scrollWidth 314 > clientWidth 287`; no sliced chevron/half-button; after scroll-to-end the Edit toggle renders fully inside the toolbar. No overflow Menu needed (allowed alternative). Capture: `320-vocabulary.png`. |

## Cross-item contracts (regression hunt)

- **Item 30 (a11y/hit-targets):** `aria-current="page"` on bar items + sheet rows; `aria-expanded`/`aria-haspopup` on Tools preserved; `:focus` fill-suppression + `:focus-visible` ring rules intact; no `tablist`/`tab`/`tabpanel` adoption; 44px floor consumed not re-derived. PASS.
- **Item 29 (Escape stack):** `pushEscapeLayer` wiring in `UniversalPanel.tsx` and `BottomSheet.tsx` unchanged; tools sheet closes on Escape (exercised in the verify flow); focus-trap restore returns focus inside the panel after a demoted-row activation. PASS.
- **Item 28 (scrollport/gutter):** `.content` flush clip host + `--universal-panel-tab-gutter`/`-scroll-inset` on `.body` untouched; keep-alive `.tabPane[hidden]` contract untouched. PASS.
- **TABS SSOT (deferred to item 29):** no dedup refactor — `PANEL_TABS` extended with `mobileNav:'bar'|'tools'` + derived `PANEL_BAR_TABS`/`PANEL_TOOLS_TABS`; sidebar still consumes the full registry. Within the item's permitted extension. PASS.
- **Desktop ≥840px:** verified at 1280 — 94% card + sidebar visible, bottom nav hidden, header title hidden; only intentional change is the REQ-4 capsule (shared across viewports by spec). PASS.

## Gates

- `npm run typecheck` — PASS
- `npm run lint` — PASS (0 errors; 4 pre-existing `exhaustive-deps` warnings in `srs-study`/`srs` files, none touched by this diff)
- `npm run test:unit` — PASS, 682 suites / 8074 tests, incl. new `UniversalPanelBottomNav.test.tsx` (7 tests: registry split, 5 destinations, aria-current contracts, demoted rows ≤2 taps, sheet-row active mark, no drag handle) and `mountOrbitalBadge.test.tsx` suppression suite (3 tests). `MobileSheet` header prop was already covered.
- `npm run build` — PASS
- `npm run check-design-system-css:features` — 0 violations (44 files)
- `docs/2-architechture-system.md` updated (chrome model + `mobileNav` split + badge suppression); `docs/0-wiki.md` entry added.

## Defects

None found.

## Minor observations (non-blocking)

1. The active bar item's `::after` is repurposed from Button's hover/pressed overlay to the indicator bar, so the active item no longer paints the pressed-state overlay — the spec-sanctioned mechanism ("a `::after` or pill element"); `:focus` suppression and the keyboard ring are preserved.
2. The demoted-row active `::before` sits at `left: var(--space-1)` (NavItem recipe uses `left: 0`) — deliberate inset inside the rounded sheet row; cosmetic.
3. `.vertical .label` retains `text-overflow: ellipsis` as a last-resort backstop; the ≥12px/no-truncation contract is held by the measured label budget (verified en+vi at 320px, the widest shipped label "Dictionary" fits).
4. `BottomSheet` bottom edge uses padding + `scroll-padding` (no fade) — spec's "and/or" permits it; resting scroll positions end cleanly (mid-scroll clipping is inherent to any scroll region).
5. AC-6 browser-chrome show/hide was verified via viewport resize, not a literal Android chrome toggle — the `100%`/`svh`-class fallback documented in the CSS comment covers forks without `dvh`.

## Scope-leak

- `settings.nav.scrollLeft` / `settings.nav.scrollRight` i18n additions in `en.json`/`vi.json` belong to item 32 (`up-settings-subnav`) — they sit uncommitted in shared message files; they are NOT part of this item and must be excluded from its commit.
- `package.json` version bump 0.1.3→0.1.4 + `release:github` script, plus untracked `scripts/release-github.ps1`, `scripts/pack-firefox.ps1`, `LICENSE`, `public/LICENSE.txt`, `tihoka-*.zip/tar.gz` — release-prep artifacts, unrelated to this item; exclude from its commit.
- `docs/mockups/player-mode-mobile-layout-impl-v*.png` modifications and new `docs/audits/20261005-screen-atomic-map.md`, `docs/audits/penpot-atomic-audit.md`, `tasks/plan-figma-atomic-design-system.md` — other work items'/coordinator artifacts, not attributable here.
- `src/entrypoints/mockup-up-mobile-chrome/` — this item's own design mockup; per repo convention it is design-time and removed at ship.
- Inside the source diff itself: every hunk maps to a REQ; no settings-subnav or recipe-convergence (items 32/33) code creep found.

VERDICT: PASS
