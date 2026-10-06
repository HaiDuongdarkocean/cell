# Adversarial Verify — player-mode-mobile-layout (fresh context)

Scope: spec `docs/specs/player-mode-mobile-layout.md` + mockup `docs/mockups/player-mode-mobile-layout.png` + reference impl `src/entrypoints/mockup-player-mode-mobile-layout/` vs committed impl `f676bc19`. Prior review (`player-mode-mobile-layout-verify.md`, VERDICT PASS) NOT trusted — all claims re-checked in code.

## Gap list

1. **GAP: `data-cell-id="pm-cue-active-card"` missing entirely** — the C5 contract's "mới" row requires it; the active cue card carries only `data-current="true"`. Zero occurrences in `src/`. — evidence: `src/features/subtitle/ui/CueList.tsx:394-404`; grep `pm-cue-active-card` → spec only. — spec ref: C5 table / AC-13.

2. **GAP: `data-cell-id="player-mode-content"` dropped on <600px** — C5 table requires it kept ("content = cueRegion"); impl emits only `data-cell-id="pm-cue-region"`, and the unit test was written to assert the contract violation (`expect(screen.queryByTestId('player-mode-content')).toBeNull()`). Any existing selector/e2e/QA hook on `player-mode-content` silently breaks on mobile. — evidence: `src/features/subtitle/ui/PlayerModeOverlay.tsx:591`, `PlayerModeOverlay.test.tsx:286`. — spec ref: C5 table / AC-13.

3. **GAP: cue-filter FAB dropdown menu stacks behind the PM overlay — interaction dead** — `CueRecommendFab`'s internal `Menu` gets no `container` prop, so `getPortalContainer` falls through `closest('[data-cell-id="subtitle-panel"]')` (fab is portaled OUT of the panel into `pm-fab-slot` inside the rail — no panel ancestor) to `closest('[data-theme]')`, an ancestor *above* `.overlay`. The `Portal` wrapper uses `z-popover` (1500) vs `.overlay` `z-overlay-settings` (10001) → the filter menu paints behind the fullscreen overlay: invisible and unclickable. This is the exact bug the impl fixed for `pm-more-menu` via `container={overlayEl}` but did not propagate to the fab. — evidence: `src/features/subtitle/ui/CueRecommendFab.tsx:89-95` (Menu without `container`), `src/shared/ui/Popover.tsx:34-43`, `src/shared/ui/Portal.module.css:3`, `src/features/subtitle/ui/PlayerModeOverlay.module.css:12`. — spec ref: REQ-3 / AC-4, AC-6 parity.

4. **GAP: context (non-active) cue cards don't read as cards — region bg ≈ card bg** — `.pmMobile .cue` uses `background: var(--color-surface)` + `border: hairline transparent`, but sits inside `.panel` whose bg is `color-mix(surface 85%)` — card and region are effectively the same color. The mockup relies on `color-background` frame + `color-surface` cards (`.pmFrame` / `.cueCard` in `mockup.module.css:90-96,137-143`). In `impl-dark.png` the "jacket" card has no visible card boundary (flat text); in `impl-light.png` both context cards are indistinguishable from the background. Active card pops only via its border — context cards lose the "deck of cards" look entirely. — evidence: `CueList.module.css:187-193`, `SubtitlePanel.module.css:14`, screenshots vs mockup. — spec ref: REQ-7 / AC-7 / NFR-3.

5. **GAP: ⋯ menu labels render in host-page font (serif), not DS font** — the menu portals into `.overlay` via `container={overlayEl}`; `.overlay` sets no `font-family` (unlike `.panel` which does). In `impl-menu.png`, "Hide cue list" / "Enable OCR" render in a serif page font while the cue text inside the panel is sans — visible font inconsistency in one screenshot. — evidence: `PlayerModeOverlay.module.css:4-20` (no font-family), `SubtitlePanel.module.css:10`, `impl-menu.png`. — spec ref: REQ-5 / NFR-3.

6. **GAP: `trackLabel` fallback to `subtitleOverlayTargetLanguage` not implemented** — spec REQ-4 alt flow: source = manager active target track label, fallback = `subtitleOverlayTargetLanguage` code, none → caption hidden. Impl wires only `manager?.targetItems[manager.targetActiveIndex]?.name` — whenever manager state is absent/stale while subtitles play, `pm-caption` renders nothing (matches screenshots: no caption anywhere). — evidence: `src/features/subtitle/ui/SubtitlePanels.tsx:318`; config key exists at `src/shared/config/config.ts:303`. — spec ref: REQ-4 / AC-5.

7. **GAP: bottom-bar X and ⋯ buttons are 40px < 44px touch target** — both use `size="md"` → `iconbutton-size-md` = 40px < `--touch-target-mobile` = 44px. AC-2 says "nút ≥44px" for the bar. (Component mapping also chose md, so spec is internally inconsistent — but the testable AC fails.) Same applies to `generate-native` md (40px) on the rail. — evidence: `PlayerModeOverlay.tsx:667-676,742-753,642-655`; `tokens.css:148,550`. — spec ref: REQ-2 rules / AC-2 / NFR-1.

8. **GAP: "Show all cues" session override is one-way and leaks across mode changes** — `showAllCues` is only ever set `true` (never reset on `cueDisplayMode` change or PM state transitions). After picking the item once, an `active`-mode user can never return to single-card view in-session (menu item disappears, mode stays 'active' but region shows full list). — evidence: `PlayerModeOverlay.tsx:160, 781-789`; `CueList.tsx:297`. — spec ref: REQ-6 alt flow (session override "từ active xem tạm full list") / AC-10.

9. **GAP: `list` display mode renders ALL cues, not a window around the active cue** — REQ-10 mandates "render window quanh active + context"; impl maps `renderedCues = filteredCues` (whole list) in list mode. Visual result is similar (non-scroll + mask clip) but hundreds of card DOM nodes mount on mobile — hits the ≥1GB-RAM persona and violates the spec mechanism. — evidence: `CueList.tsx:301-307`. — spec ref: REQ-10 / AC-15.

10. **GAP: REQ-8 badge clearance rule unimplemented** — spec rule: "rail chừa ≥ badge size + `--space-2` tính từ mép phải khi badge preset `right`". No badge-aware spacing exists anywhere in the PM mobile code (grep `orbital|badge` in overlay/CueList → 0). The rail is fixed at `right: var(--space-5)`; a right-snapped orbital badge can overlap the rail/card-actions zone. — evidence: `PlayerModeOverlay.module.css:332-341`. — spec ref: REQ-8 rules / AC-8.

11. **GAP: bottom bar + frame use `color-overlay-background` instead of reference `color-background`** — reference `.pmFrame`/`.pmBottomBar` = `color-background`; impl `.overlay`/`.bottomBar` = `color-overlay-background`. Consequence visible in `impl-light.png`: the transport bar is a black strip under a fully light cue layout, whereas the reference yields a light bar in light theme. — evidence: `PlayerModeOverlay.module.css:11,361` vs `mockup.module.css:95,282`; `impl-light.png` bottom strip. — spec ref: REQ-7 / NFR-3 (mockup fidelity).

12. **GAP: `data-cell-pm-mobile` attribute is dead code** — set on `.panel` (`SubtitlePanel.tsx:425`) but consumed by no CSS/JS selector anywhere — the intended style hook was never used; `pmMobile` prop does the gating instead. Half-finished. — evidence: grep `data-cell-pm-mobile` in `*.css`/`*.ts*` → 1 hit (the setter only). — spec ref: REQ-7 rules (scoped variant hook).

13. **GAP: fab badge anchor is fragile in the rail** — `.pmRail [data-cell-id='cue-filter'] { position: static }` neutralizes `.fab`'s absolute positioning, so the badge (`position:absolute; top/right:-4px`) anchors to `.pmRail` (nearest positioned ancestor), not the button. It lands near-correctly only by coincidence (fab is the rail's top-right item); any rail reorder puts the count bubble at the container's corner, detached from the button. Fix = `position: relative`. — evidence: `PlayerModeOverlay.module.css:343-345`, `CueRecommendFab.module.css:1-12`. — spec ref: REQ-3.

14. **GAP: required transport handlers can't be absent** — REQ-2 exception: "handler vắng → nút không render". `onRepeat`, `onPrev`/`onNext`, `onPlayPause`, `onRewind`/`onForward` are required props rendered unconditionally — only quick-add/edit/generate/CC/OCR guard for absence. — evidence: `PlayerModeOverlay.tsx:678-740`. — spec ref: REQ-2 exception.

15. **GAP: spec-internal glyph contradiction, impl picked REQ-11 (likely right, AC-16 wrong)** — REQ-11 mandates `rotateCcw` replacing `navRepeat` ("khớp mẫu"); AC-16's checklist still says `navRepeat`. Impl uses `rotateCcw` — consistent with mockup and REQ-11, inconsistent with AC-16's literal text. Flagging because the AC will fail a literal audit; spec needs the AC fixed. — evidence: `PlayerModeOverlay.tsx:707`. — spec ref: REQ-11 vs AC-16.

## Screenshot vs mockup (visual diff summary)

- `impl-dark.png` vs mockup: bar order/hero/card-actions-inside-card/CC-left/mask-fade/active-border+elevation all match. **Missing vs mockup:** comprehension pill (conditional on store data — mechanism verified in `ComprehensionPill.module.css:21-27`, acceptable), `Subtitles:` caption (see gap 6), cue-filter FAB (conditional on tokenize — acceptable), distinct context-card surfaces (gap 4), peek-card visibility into the band (impl fades earlier, weaker peek than mockup).
- `impl-light.png`: same geometry; bottom bar stays black on light layout (gap 11); context cards flat (gap 4).
- `impl-menu.png`: menu shows only 2 items in the harness (production wiring passes `onStudyModeChange`/`onPlaybackSpeedChange`/`onPracticeModeChange` unconditionally via `SubtitlePanels.tsx:308-312`, so study/speed/practice sections do render — code-verified); labels in page serif font (gap 5).
- `impl-desktop.png`: unchanged dock layout — desktop regression surface OK.
- Video stage inset/radius: implemented (`videoStageMobile` margin `space-3` + `radius-2xl` + `overflow:hidden`) but invisible in screenshots — stage bg = `color-overlay-background` == overlay bg, so the inset reads full-bleed whenever the video letterboxes; mockup uses `color-surface` stage (visible card edge). Folded into gap 11 family — not separately must-fix.

## What checked out (not gaps)

Mobile branch gated solely on `viewport.w < 600`; dock/`overlay-player-action`/`subtitle-block`/`subtitle-panel-header`/`StudyModeActionBar`/`PracticeOptions`/`tools-*` all absent on mobile; adaptive prev/next↔rewind/forward works and is unit-tested; `pm-card-actions` inside active card; `pm-fab-slot` portal + `:empty` collapse; `player-mode-actions` rail reuse; `pm-anchor-band` transparent + `pointer-events:none` discipline; pill `:host-context` + `--pm-anchor-bottom` set/cleanup on `documentElement`; Escape order menu→cuelist→exit verified via capture-phase `escapeLayerStack` (stops propagation before window listener); `PLAYER_MODE_CUE_DISPLAY` persist + scoped `onChanged` + cleanup + Manager `pm-cue-display-row` (InkTabs) all present; `active` mode current/next-upcoming-dimmed/EmptyState fallback works; fab suppressed in active mode (`SubtitlePanel.tsx:233`); non-scroll `.pmMobile .list` (overflow hidden + scrollbar none + mask fade); icon tokens `iconbutton-icon-{xs..xl}`=16/18/20/24/28 + `iconbutton-size-xl`=56 exist; glyphs bare per REQ-11; subtle Button family + all required icons exist; i18n en+vi complete for new keys; new props default to old behavior → desktop/split-view safe; no new resize listeners; menu has no nav duplicates; practice modes cover full `SubtitlePracticeMode` union.

## Verdict

The skeleton, transport bar, anchor band, menu plumbing, storage-driven display modes, and Escape ordering are faithfully implemented — but the implementation does **not** faithfully deliver the spec+mockup: two C5 contract ids deviate (one dropped, one never emitted), the cue-filter menu is stacked behind the overlay and dead on mobile, context cards visually lose their card chrome (the single biggest mockup deviation), and the caption's required fallback is missing.

Top-3 must-fix:
1. **Cue-filter FAB menu behind overlay** (gap 3) — broken feature, same `container={overlayEl}` fix as `pm-more-menu`.
2. **Context cards invisible as cards** (gap 4) — cue region needs `color-background` (not panel's translucent surface) so `color-surface` cards pop per mockup.
3. **C5 contract: restore `player-mode-content` on the cue region + emit `pm-cue-active-card`** (gaps 1-2) — plus `trackLabel` fallback (gap 6) so `pm-caption` actually shows.

VERDICT: FAIL

---

## Round 2 — resolution pass (committed `3289c05c`)

All gaps above were fixed and re-verified in a real Chrome session (390×780 mobile emulation):

1. `pm-cue-active-card` → emitted on the active card's content wrapper (`CueList.tsx` — `cue-item` root contract kept; unit test asserts the marker resolves inside `[data-cue-index]` of the current cue).
2. `player-mode-content` → restored on the mobile content wrap (`player-mode-content` + `pm-cue-region` both present; test now asserts presence).
3. Fab menu z-dead → `CueRecommendFab` gained `menuContainer`; `SubtitlePanel` passes the overlay element (`fabPortalTarget.closest('[data-cell-id="player-mode-overlay"]')`) — same fix as `pm-more-menu`.
4. Context cards pop → `.panel[data-cell-pm-mobile='true']` flattens to `color-background` (no blur/slide) so `color-surface` cards read as cards; verified in v2 screenshots.
5. Serif menu leak → `.overlay` sets `font-family: var(--font-family)` (DOM check: menu item computes `Inter`).
6. `trackLabel` fallback → `SubtitlePanels` reads `subtitleOverlayTargetLanguage` from `STORAGE_KEYS.SETTINGS` with live `onChanged` sync; caption hides only when both sources empty.
7. Touch targets → exit/⋯/generate-native bumped `md`→`lg` (48px ≥ 44; DOM check `48x48`).
8. `showAllCues` one-way leak → reset effect on `cueDisplayMode` change.
9. REQ-10 window → `PM_MOBILE_LIST_WINDOW = 8` slice around the active cue in mobile list mode (20-cue test renders exactly 8, current included); align effect retargeted to `renderedCues` indexes.
10. REQ-8 badge clearance → overlay reads `orbitalBadgePosition` + `dictionaryPopup.badgePointerTrigger.size` (live `onChanged`), sets `data-orbital-edge` + `--pm-orbital-badge`; `.pmRail` right offset = badge + space-2 when edge=right (DOM check: `data-orbital-edge="right"` live in session).
11. `color-overlay-background` → `.overlayMobile` + `.bottomBar` use `color-background`; `.videoStageMobile` uses `color-surface` — light theme no longer shows a black strip (v2 light screenshot).
12. Dead `data-cell-pm-mobile` → now the actual style hook for the mobile panel chrome (gap-4 fix).
13. Fab badge anchor → `.pmRail [data-cell-id='cue-filter']` is `position: relative` (+ `inset: auto`) so the count badge anchors to the button.
14. REQ-2 absent-handler rule → every transport button is guard-rendered (`onPrev && …` etc.).
15. AC-16 spec text → corrected `navRepeat` → `rotateCcw` (impl follows REQ-11 + mockup).

New evidence: `docs/mockups/player-mode-mobile-layout-impl-v2-dark.png`, `-v2-light.png`.
Gates re-run on `3289c05c`: typecheck ✓, lint ✓ (0 errors), test:unit ✓ 8045, build ✓, browser ✓.

VERDICT: PASS

---

## Round 3 — user-reported defects (committed `2b90446a`)

User screenshot review found 3 new defects; spec gained AC-17/18/19 and all were fixed + browser-verified (390×780, light + dark):

1. **AC-17 — manager-toggle dead in PM**: `SubtitlePanels` early-returned `PlayerModeLayer`, so the `managerOpen` portal (non-PM branch) never rendered — button flipped state but showed nothing (desktop PM too). Fix: `managerPortal` hoisted above the branch; renders in both. Verified: CC tap opens `subtitle-manager-layer` Sheet over the PM overlay (mockup `real` concept wires the real `SubtitleManagerPanel`+`Sheet`); unit test `SubtitlePanels.test.tsx` covers both orders (open→PM, PM→open).
2. **AC-18 — non-uniform floating buttons**: CC was lg(48), fab md(40), generate lg(48); rail anchored `bottom: space-7` (off-axis). Fix: all rail buttons `size="lg"` 48×48; `pmRail` moved into `anchorRow` flow (generate shares the CC/pill center axis), `pm-fab-slot` absolutely anchored `bottom: calc(100% + space-2)` flush-right above it; `.anchorSpacer` removed; orbital clearance moved to `anchorRow` `padding-right`. DOM verify: cc 48×48 cy=650.7, generate 48×48 cy=650.7 — identical axis.
3. **AC-19 — active card border magnified the card**: `cueCurrent` used `border: space-1` (4px) vs `hairline` on siblings → +~7px/side. Fix: `border-color: primary` (width unchanged) + `box-shadow: var(--shadow-inset-selected)` (2px primary ring INSIDE the box) + `shadow-floating` + `surface-elevated` — emphasis inside bounds. DOM verify: all 5 cards `border-width: 0.667px` equal, width 366px equal; only the current card carries the inset ring.

Evidence: `docs/mockups/player-mode-mobile-layout-impl-v3-{manager,dark,anchor}.png`.
Gates re-run on `2b90446a`: typecheck ✓, lint ✓, test:unit ✓ 8047 (+2 new AC-17 tests), build ✓, browser ✓.

---

## Round 4 — user-reported defect: anchor row not axis-aligned with bottom bar

User screenshot `quetta_fE6uPRgoqB.png`: the CC button did not share a vertical axis with the bottom-bar `X`, and the right rail did not share an axis with `⋯`. Two root causes:

1. `.anchorRow` used `padding: space-1 space-5` while `.bottomBar` uses `space-2 space-3` → each side off by 8px. Fix: `anchorRow` horizontal padding → `space-3` (mockup `.pmAnchorRow` synced).
2. Round-3's REQ-8 clearance added `padding-right: badge + space-2` to `.anchorRow` when the orbital badge is on the right edge → rail pushed left, off-axis with `⋯` by ~32px. Replaced with a **vertical dodge**: `--pm-orbital-lift` raises the `pm-fab-slot` above the badge only when the badge's stored `y` ± size/2 actually overlaps the rail's fab zone (computed from `player-mode-actions` rect; default right/center badge → lift 0). Rail stays flush-right always — alignment is structural, not compensated.

Spec AC-18 extended: horizontal-center of `manager-toggle-btn` must equal `player-mode-exit-btn`, and `generate-native-btn`/`cue-filter-fab` must equal `pm-more-btn` (≤1px).

### E2E verification (real extension on StreamFlix, 390×780)

New spec `e2e/stage2/player-mode-mobile-alignment.spec.ts` (Playwright, headed Chromium + dist build):

- **AC-18**: measures `getBoundingClientRect()` of `manager-toggle-btn` / `player-mode-exit-btn` / `generate-native-btn` / `pm-more-btn` / `player-mode-actions` — asserts 48×48 boxes, `|Δcx|` ≤ 1.5px for both axes and `|Δcy|` ≤ 1.5px for manager/generate. **PASS**.
- **AC-17**: `manager-toggle-btn` click opens `subtitle-manager-layer` Sheet while PM stays mounted; `subtitle-manager-close` closes it without exiting PM. **PASS** (notes: PM runs fullscreen so the first Escape exits fullscreen — Sheet's escape layer intentionally ignores it; toggle button is open-only `setManagerOpen(true)`, close goes through the panel's close control).

Evidence: `docs/mockups/player-mode-mobile-layout-impl-v4-{alignment,manager}.png` (real extension, dark, 390×780 — CC/✕ and A/⋯ columns visibly flush).
Gates: typecheck ✓, eslint ✓ (0 errors), test:unit ✓ 8047, build ✓, e2e stage2 alignment spec ✓ 2/2.

VERDICT: PASS

---

## Round 5 — compact redesign: uniform 40px controls, Sheet menu, speed stepper

User screenshot `quetta_9RgqTYaaLU.png` + follow-ups: controls too spread out; play must match siblings (size + color); remove decorative cue-card footer icons; remove duplicated practice group; "tua" = playback speed — a `[-][N×][+]` stepper pinned at the bottom of a real `Sheet` (SSOT, not popup/list); all icon buttons → `md` 40px (system size); remove the speed chip from the bar (minimal); stepper must be the same component family as the Subtitle Manager latency stepper.

Changes:

1. **Uniform 40px**: every icon button in `pm-anchor-band` + `pm-bottom-bar` is `size="md"` (40×40); play/pause switched from `warningSubtle` hero to `primarySubtle` — same family/color/size as transport siblings. Bottom bar is a 3-col grid (`exit | transport | ⋯`); transport gap `space-1` = one thumb cluster. `pm-caption` ("Subtitles: …") removed; `--pm-anchor-bottom` no longer includes caption height; `trackLabel` + `subtitleOverlayTargetLanguage` fallback removed from overlay.
2. **Cue cards**: footer renders only the timestamp (`cardFooterIcons` dropped on the mobile branch).
3. **More menu → Sheet**: `pm-more-btn` opens `Sheet` (`pm-more-menu`) with panel-toggle / OCR / show-all-cues / study-mode MenuItems; `pm-practice-off/dictation/cloze` group removed (study modes are the SSOT); no popup `Menu` remains.
4. **Speed stepper via shared molecule**: `PLAYBACK_SPEEDS` extended to 0.25×–10×; the latency-stepper pattern was extracted from `SubtitleManagerPanel` into `src/shared/ui/StepperSection` (+`StepperValue`) — both the manager `OffsetStepper` and the PM sheet footer now render the same labeled pill group (`[-] [1.25×] [+]`) with dividers + `space-10` field-height center. `data-cell-id`s kept: `pm-speed-stepper/pm-speed-dec/pm-speed-value/pm-speed-inc`, `manager-offset-*` unchanged. `pm-speed-btn` chip removed from the bottom bar entirely (AC-23: must not exist in DOM).
5. `SpeedPill` min-boundary test updated for the new 0.25× floor.

### E2E verification (real extension on StreamFlix, 390×780)

`e2e/stage2/player-mode-mobile-alignment.spec.ts` — **4/4 PASS**:

- **AC-18**: all measured buttons 40×40; `cx(manager)==cx(exit)`, `cx(generate)==cx(more)`, `cy(manager)==cy(generate)` ≤1.5px; transport cluster shares one `cy` (measured over actual rendered buttons — covers prev/next OR rewind/forward adaptive case).
- **AC-20/21**: `pm-caption` count 0; context cue cards carry 0 svgs.
- **AC-22/23**: `pm-speed-btn` count 0; `pm-more-btn` opens `pm-more-menu` Sheet; no `pm-practice-*`; stepper pinned — sheet-bottom minus stepper-bottom ≤ 40px measured **after** the slide-up settles (polls sheet bottom ≤ viewport height first — earlier failures were mid-animation reads, not layout bugs); `pm-speed-inc` changes `pm-speed-value`.
- **AC-17**: manager Sheet opens/closes without exiting PM.

Evidence: `docs/mockups/player-mode-mobile-layout-impl-v5-{alignment,sheet}.png`.

Gates: typecheck ✓, lint ✓ (0 errors), test:unit ✓ 8049, build ✓, e2e ✓ 4/4.

VERDICT: PASS
