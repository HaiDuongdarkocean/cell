# Universal Panel UX Audit Loop — Final Cross-Review + Loop Report

> Reviewer: fresh-context CROSS-REVIEW pass (did not implement any of the six items).
> Scope: integrated end-state at HEAD (`cf2f872b`), not per-item diffs — the six items were delivered sequentially against a shared file set, so this pass verifies they still compose correctly.
> Method: (1) full-doc read of the audit + all six verify reports; (2) source inspection of every P0 + the recurring space/alignment/grouping P1s at HEAD; (3) seam analysis between shipped mechanisms; (4) real-Chromium re-scan — Playwright persistent `--load-extension=dist` (fresh `npm run build` at HEAD), StreamFlix mock `node scripts/serve-mock-pages.mjs --stream --no-build` on `PW_PORT_OFFSET=200` (:4521), all six tabs swept at 1280×800 / 390×844 / 320×568 incl. combined states (tools sheet open, vocab menu open, settings strip arrows, MobileSheet peek, Escape ordering, badge suppress/restore); (5) pixel-scan + content-centering analysis of captures vs the original audit evidence.
> Evidence: `tmp/up-loop-final/` — `sweep.mjs`, `probe2.mjs`, `results.json`, 22 PNGs, `scan.py`, `voidcheck.py` (all gitignored).
> Audit: `docs/audits/20261006-universal-panel-ux-audit.md` (62 deduped findings; per-finding evidence `loop/universal-panel-ux/state/`, captures `loop/universal-panel-ux/image/`).

---

## (a) Audit → pipeline summary

The 2026-10-06 audit (84 screenshots × 5 viewports × 6 tabs, three independent passes) condensed 62 findings into five systemic root causes — no tab-layout contract, token/atom bypass, no canonical selected-state recipe, alpha washes in floating layers, mobile-as-edge-case — and routed them to six backlog items (#28–33) with declared dependencies:

| # | Item | Commit | Findings claimed | Verify verdict |
|---|---|---|---|---|
| 29 | `up-token-atom-debt` | `eb6e4600` | F-6, F-20, F-21, F-22, F-24 | PASS (+ Chromium run 8/8) |
| 28 | `up-tab-layout-contract` | `e41ed8b8` | F-1, F-3, F-5, F-9, F-10, F-19, M-3, V-11/M-14 | PASS (1 defect caught+fixed) |
| 30 | `up-a11y-hit-targets` | `e4d89e60` | V-1, M-8, M-9, F-4, F-2, F-8, F-16, F-17, F-18, M-10 | PASS (2 defects caught+fixed) |
| 31 | `up-mobile-chrome` | `c7b24317` | M-1, M-2, M-4..M-6, M-11..M-13, M-15, F-7, F-12, V-6 | PASS (0 defects) |
| 32 | `up-settings-subnav` | `70a5d597` | V-8, M-7 | PASS after re-verify (2 defects caught+fixed, D1 was blocking) |
| 33 | `up-visual-system-convergence` | `b0ea621a` | V-2..V-5, V-7, V-9, V-10, V-12..V-23 remainders, F-11, F-13..F-15, F-23, F-25 | PASS (8 defects caught+fixed) |

Every item passed an independent fresh-context verify before ship; 13 defects total were caught inside the loop and fixed pre-commit — the review gate did real work.

---

## (b) Per-item: what shipped + verify history

### `up-token-atom-debt` (eb6e4600) — tokens/atoms + shared Escape layer stack
Shipped: token-name typo fixes in panel scope; TABS-registry dedup; FieldRow/CandidateView onto shared atoms; ~20 hardcoded literal sites onto tokens; `pushEscapeLayer` shared LIFO stack adopted across UniversalPanel, Dialog, BottomSheet, Sheet, Drawer, Select, SearchableSelect, Menu, MultiSelect, HintIcon, popupLifecycle; `role=presentation` backdrop, docstring-vs-CSS mismatch, permanent `will-change`, render-phase `setVisitedTabs` craft fixes.
Verify (`up-token-atom-debt-verify.md`): PASS. Follow-up real-Chromium run (`up-token-atom-debt-chromium.md`): 8/8 checks — Escape pops exactly one layer per press in both push orders (popup-over-panel and popup-under-panel), tools sheet → panel LIFO, FieldAutoGrowInput autosize, TagInput IME guard, font deltas. Owner decisions: spec AC-1 amended (default CSS checker already exits 1 on 6 pre-existing runtime-injected props — false premise; behavior-preserved wording adopted); explanatory comments kept as deliberate AGENTS.md deviation; `hasEscapeLayers` documented delta (panel closes before Player Mode exit — one-Escape-one-layer preserved); foreign `package.json` hunks excluded from commit.

### `up-tab-layout-contract` (e41ed8b8) — scrollports, gutters, keep-alive, empty states
Shipped: shared `.scrollport` (`Scrollable.module.css`) consumed by every tab list/body; `.content` as flush clip host (all `data-cell-id` padding carve-outs deleted — 0 hits at HEAD); gutters via `--universal-panel-tab-gutter` (12/16) + `--universal-panel-tab-scroll-inset` (16) declared once on `.body`; all six tabs incl. Recap ride the identical `.tabPane[hidden]` keep-alive mount; `isActive` lifecycle bound at `mountUniversalPanel.ts` — Playlist tears down `<audio>` + revokes the blob URL on deactivate, Recap revalidates per activation with scroll/expansion preserved; surface remap hoisted to `.body` (`--card-background`/`--color-surface-card` → surface-elevated); `EmptyState` `flex:1 1 auto` centering; the long-dead `@container` wrap rule on playlist rows is finally live.
Verify (`up-tab-layout-contract-verify.md`): PASS on 11/11 ACs with real-Chromium scroll metrics per tab. **D1 caught + fixed:** `--universal-panel-tab-gutter`/`-scroll-inset` declared `inherit` without `var()` fallbacks → `VocabularyTab` lost all padding when mounted outside the panel; fixed by fallback values on the consuming side.

### `up-a11y-hit-targets` (e4d89e60) — 40/44px floors, focus trap + rescue, semantics
Shipped: `--touch-target` (pointer-adaptive 40 fine / 44 coarse) bound across Toggle (transparent-border inset-paint — track paint stays compact), IconButton, inputs/selects, dict-link controls, HintIcon, statusBadge, MobileSheet handle; panel-scope floor `.panel .body button`; focus trap picks first *visible* focusable (`offsetParent` filter) + tab-switch focus rescue (`UniversalPanel.tsx:110-122`); DOM order = visual order at all widths; nav landmarks + `aria-current="page"` + `role="region"` named panes; `radiogroup` for mode cards; Advanced-toggle disclosure contract; single `playlist-status-announcer` replacing per-card `aria-live`.
Verify (`up-a11y-hit-targets-verify.md`): APPROVE_WITH_CHANGES → PASS. Real coarse-pointer run (`Emulation.setTouchEmulationEnabled`, `matchMedia('(pointer: coarse)')` hard-asserted): **0 violations at 44px across all 6 tabs**, 0 overlaps, fine pass 0 at 40px. **D1 caught + fixed:** tools `BottomSheet` close was 32px (`.circle` reset) — now shared `CloseButton`. **D2 caught + fixed:** transient dual `role="status"` in playlist loading branch — announcer is now the sole status region.

### `up-mobile-chrome` (c7b24317) — fullscreen mobile model, 5-destination rail, tools sheet
Shipped: one resolved chrome model for the whole ≤839px band — `width:100%; height:100%; height:100dvh; radius:0; border:none` (the 600–839px hybrid no-man's-land eliminated); `PANEL_TABS` split into `PANEL_BAR_TABS` (4) + `PANEL_TOOLS_TABS` (Playlist/Recap demoted); bottom rail = 4 destinations + Tools (5 total, labels ≥12px en+vi at 320px, no truncation, 10px-ellipsis rule deleted); demoted tabs reachable ≤2 taps as `menuitemradio` nav rows with `aria-current="page"` + accent-pill; positional indicator = the NavItem `.horizontal .pill` recipe ported (not a 6th recipe); mobile header names the active tab; tokenize capsule natural width + hairline seam (89px at both 1280 and 390); orbital badge suppressed while panel open, restored on close, fullscreen-change aware; Card Creator collapsed peek = `--touch-target` handle + named 24px header; `hideDragHandle` on all 5 real BottomSheet consumers; vocabulary toolbar = `overflow-x:auto` scroll region (no clipped chevron at 320).
Verify (`up-mobile-chrome-verify.md`): PASS on 11/11 ACs, **zero defects**. Real-Chromium measured: exactly 5 rail destinations at 390/320 en+vi, panel rect `0,0,W,H` at 320/390/768, badge display none→restored, peek 68px under coarse, Escape ordering. Cross-item contracts re-checked (items 28/29/30 intact).

### `up-settings-subnav` (70a5d597) — scrollable settings strip, bound-aware arrows
Shipped: 13 unlabeled icons → labeled `NavItem` strip — horizontal scrollable with bound-aware arrows + edge fades ≤767px container width, expanded vertical sidebar ≥768 (`SIDEBAR_LABEL_MIN_WIDTH`); arrows page ±0.75, hide at bounds; scroll-spy + click-nav preserved; i18n `settings.nav.scrollLeft/Right` en+vi.
Verify (`up-settings-subnav-verify.md`): **initial FAIL on AC-3** — two defects caught in review. **D1 (blocking):** `.nav` `flex-shrink:0` + `width:100%` inside the new `.navWrap` pushed both arrows outside the clip box — right arrow rendered off-panel at every tested width and the nav's right ~44px clipped items mid-glyph with no cue. Fixed via `.navWrap > .nav { flex:1 1 auto; min-width:0 }`. **D2 (minor):** arrow visibility didn't react to label-width changes (locale switch) — fixed via `MutationObserver(characterData)` alongside ResizeObserver + scroll. Re-verify PASS at 320/390/700/1280 incl. a real en→vi `Select` drive proving the mutation path.

### `up-visual-system-convergence` (b0ea621a) — recipe convergence across shared atoms
Shipped: selected-state convergence (`MenuItem` checked = primary-subtle+accent text, QueueSidebar/LanguageProfilePanel/SegmentedControl/SelectableCard onto primary-subtle + `shadow-inset-selected` recipes; `aria-current` surfaces keep the nav recipe); floating layers opaque (`component.panel` border→`color-border`, shadow→`shadow-modal`, `component.popover` border→`color-border`; SearchableSelect hairline + solid option rest); every choice list through `Menu`/`MenuItem` (LPP kebab, profile switcher Dialog+RadioGroup→Menu, tools-sheet `.toolRow` hand-roll→MenuItem rows, vocab triggers→`Button secondary`); one `Chip status` molecule (RecapTab + VocabularyTab badges); `Button.secondary` recipe + footer emphasis trio (errorSubtle/secondary/primary); sidebar `Separator` between sections + single dictionary↔card-creator seam; `EmptyState` anatomy on playlist + vocabulary descriptions; all small-caps headings → `Text`/`Heading` recipes; affordance recipes (HintIcon neutral hover, track visibility, chrome-icon hairline rings + hover tint); AnkiConnect failure stated once (`suppressFailureDetail`); single lookup home; `slidersHorizontal` collision resolved (Study Modes→`flame`); Card geometry unity (playlist/mode overrides deleted); `useMenuPlacement` hidden-anchor fix (`visibility:hidden` + trigger ResizeObserver).
Verify (`up-visual-system-convergence-verify.md`): PASS — all 12 REQs verified live in real Chromium; **D1–D8 all resolved in a post-review fix pass** (`.offRow` border leak reset, `suppressFailureDetail` gated on `!settingsOpen`, chrome-ghost hover tint added, AC-2 tools-sheet carve-out recorded in spec, `.statusBadge` shim renamed `.rowChip`, retained dashed sites documented, orphan i18n keys removed, `Chip` `aria-pressed` conditional).

---

## (c) Cross-review findings at HEAD

### Sampled findings — confirmed resolved at HEAD (file + live evidence)

| Finding | HEAD state | Evidence |
|---|---|---|
| F-1 playlist/recap no scroll container | RESOLVED | `PlaylistTab.module.css:2` / `RecapTab.module.css:2` `composes: scrollport` (`overflow-y:auto; flex:1; min-height:0`); live scrollers measured 390px: studyModes 1343>739, settings 6763>691 |
| F-3 playlist `<audio autoPlay>` leak | RESOLVED | `PlaylistTab.tsx:143` `if (!isActive) setPreview(null,null)` unmounts audio + revokes blob; `isActive = open && currentTab === tab` bound at `mountUniversalPanel.ts:281` |
| V-1/M-8/F-4 sub-floor hit targets | RESOLVED | `--touch-target` bound in Toggle/IconButton/Button/Menu/NavItem/CloseButton + `.panel .body button` floor (`UniversalPanel.module.css:73-76`); item-30 coarse run: 0 violations all tabs |
| F-2 focus trap `display:none` pick | RESOLVED | `useFocusTrap.ts:36-38` `offsetParent !== null` filter + `UniversalPanel.tsx:110-122` rescue; DOM order sidebar→body→bottomNav |
| F-5 divergent gutters / 3 mount patterns | RESOLVED | zero `data-cell-id` selectors in `UniversalPanel.module.css`; uniform `.tabPane` ×6 — live: 6 panes / 1 visible / 6 `role="region"` |
| F-6 token-name typos | RESOLVED (panel scope) | grep clean in panel scope; residuals only in `CondensedAudioPill.module.css` (video overlay, out of scope — see XR-4) |
| F-7/M-1 7-item nav, clipped labels | RESOLVED | live: exactly 5 destinations, all labels 14px, `scrollWidth ≤ clientWidth` at 320 |
| V-2 translucent floating listboxes | RESOLVED | SearchableSelect opaque (`--color-surface` rest); live vocab menu bg `color(srgb 0.178…)` = opaque elevated |
| V-3 five selected-state recipes | RESOLVED | MenuItem checked recipe + card/segment/nav recipes live-verified (item-33 verify) |
| V-4 serif small-caps headings | RESOLVED (panel scope) | no `text-transform`/`serif` in universalPanel scope |
| V-5 vocab filter/sort bare links | RESOLVED | `Button secondary` triggers + `Menu`/`MenuItem` (live: 6-item menu opens) |
| V-8/M-7 13-icon unlabeled settings nav | RESOLVED | live at 390: 13 labeled items, right arrow painted inside wrap bounds (340–380 vs host edge 380) |
| V-9 panel barely separates | RESOLVED | tokens `component.panel` → `color-border` + `shadow-modal`; live `0.67px solid` + modal shadow |
| V-10 sidebar 64px void, no divider | RESOLVED | `CollapsibleSidebar.tsx:73` `Separator` between sections; live 1 separator |
| F-12/M-5 stretched tokenize capsule | RESOLVED | `.capsule` natural-width `inline-flex`; live 86px + hairline seam |
| M-2 badge above panel / chrome bleed | RESOLVED | live: `js-cell-orbital-badge-host` `display:none` while open → `block` after close |
| M-11 anonymous 180px pill | RESOLVED | MobileSheet `header` prop = "Card Creator"; live peek 64px collapsed |
| M-13 600–839px hybrid band | RESOLVED | one model: live panel `0,0,W,H`, `radius:0`, `border:none` at 390/320 |
| Seam: Escape × tools sheet × menus | PASS | `pushEscapeLayer` on all 10 overlay atoms; live: Escape closed tools sheet, panel stayed |
| Seam: settings arrows × sidebar Separator | PASS | separate surfaces, both verified live; `MutationObserver`+`ResizeObserver`+scroll in `Navigation.tsx:146-152` |
| Seam: hit-floor × convergence recipes | PASS | `Chip`/`MenuItem`/`NavItem` carry own `--touch-target` bindings independent of the panel-scope floor; `.panel .body button` covers anything inside panes/header |

### New issues found at HEAD (none blocking)

- **XR-1 (minor, environment-dependent) — `height:100dvh` vs classic scrollbars.** The panel host is `position:fixed; inset:0`, which shrinks to the viewport *minus* classic scrollbar strips; `.panel` uses `height:100dvh` (full viewport). On the mock page (real scrollbars) at 390×844 the host measured 380×834 while the panel measured 844 tall → the flex-centered panel overhangs −5px top / +5px bottom: the header's top ~5px clips above the viewport and the bottom nav's bottom ~5px lands over the page's horizontal-scrollbar strip. Invisible on real mobile/forks (overlay scrollbars → host == dvh — item-31's measured `0,0,W,H` is correct there); hits Windows desktop users who narrow a window ≤839px on a page with scrollbars. Cheapest fix: `height:100%` alone already tracks the dynamic viewport inside a `fixed inset:0` host (the `100dvh` override only diverges under classic scrollbars), or add `max-height:100%`.
- **XR-2 (minor, a11y) — tools sheet `role="menu"` has no arrow-key roving.** `UniversalPanelBottomNav.tsx:88-121` renders `MenuItem` rows inside a `role="menu"` div without the `Menu` wrapper — the APG menu pattern advertises ArrowUp/Down/Home/End navigation, but only Tab/Shift+Tab works (focus trap cycles correctly, all rows reachable). Either wrap in Menu's keydown machinery, demote to a plain group role, or add arrow handling to the sheet.
- **XR-3 (trivial, token hygiene) —** `PlaylistTab.module.css:45-48` `.itemActions :global(button) { min-width:44px; min-height:44px }` hardcodes the coarse floor instead of `var(--touch-target)`; under fine pointer it forces 44 where the contract floor is 40 — not a violation (above floor), just off-token.
- **XR-4 (trivial, out-of-scope residual) —** `CondensedAudioPill.module.css:60-61,135-136` uses `--motion-duration-fast` ×4 — a token that doesn't exist (canonical: `--duration-fast`); the `140ms` fallbacks prevent breakage. Same defect class as F-6 but outside the panel audit's scope; the audit's F-6 sites in panel scope are clean.
- **Evidence gap (process, not code) —** the `.offRow.offRow` chrome reset in `SubtitleManagerPanel.module.css` shipped without a recorded `subtitle-split-view-ac.md` re-verify. `SubtitleManagerPanel.tsx` is borderline against the AC doc's `SubtitlePanel*.tsx` glob and the change is CSS-chrome-only, but the evidence was never filed — flagged by the item-33 verify and still open.

### Browser-pass health notes

22 captures at 1280/390/320 across all six tabs — all painted (674–1873 distinct colors each), console clean except 2× mock-asset 404s (pre-existing font noise also reproduced without the extension). Content-centering scan: empty/sparse states render content mid-pane (median painted row ~54–55% vertical) — consistent with the EmptyState fill contract, no top-anchored void. Original worst offenders visibly gone in the after-captures: clipped rail labels (F-7), anonymous pill peek (M-11), top-anchored voids (V-11), the 600–839px hybrid (M-13 — verified at 768 in item-31's pass), translucent/detached listboxes (V-2 + the `useMenuPlacement` hidden-anchor defect observed detached in the browser-gate run).

---

## (d) Deferred debt / follow-ups (not covered by this loop)

- **CSS checker default scope** flags 6→10 violations in files untouched by this work (runtime-injected custom props, `Navigation.module.css` `#000` mask gradients). A runtime-prop whitelist follow-up is recorded in the item-29 owner decisions; scoped `check-design-system-css:features` stays at 0/44.
- **`vite dev` clobbers `dist/`** — `npx vite`/`npm run dev` rewrites `dist/` into a dev build, silently breaking `--load-extension=dist` verification (`featureInit` fetch 404). Documented in `up-visual-system-convergence-browser-gate.md`; no guard exists. Cheap fix candidates: a dist build-stamp check in the verify scripts, or serving mockups from `build/` instead.
- **Item-30 review notes N1/N2 still open:** opened-overlay interiors (BottomSheet/Dialog/MobileSheet controls) were never hit-target-measured — that's how the 32px sheet-close defect escaped one round; and `initialFocus` is sampled post-`clickTab`, not post-`open()`. Suggest one overlay-open measurement pass as standing evidence.
- **Literal mobile browser-chrome dynamics** — `100dvh` tracking under Android URL-bar show/hide was verified via viewport resize only; Kiwi/Quetta forks remain a documented residual risk (fallback `height:100%` present). See also XR-1.
- **Latency/benchmark work** (lookup hot path, audio tab, latency marks) lives in separate backlog items #15–17 — outside this loop's scope by design.
- **`loop/universal-panel-ux/` evidence dir is ephemeral** per the audit header (`state/` referenced by this report and the per-item verifies); retention/cleanup decision pending with the coordinator.

---

## (e) Verdict on the loop

The audit→pipeline flow shipped the right things. The 62 findings were correctly condensed into six independent-but-composable items; dependency ordering (31 ← {28,30}; 33 ← all) held — no cross-item mechanism collided at HEAD. Every item survived an adversarial fresh-context verify, and the gate caught 13 real defects pre-ship including one blocking layout defect (settings-strip arrows outside the clip box), one a11y floor miss (BottomSheet close), and a spec-level false premise (CSS checker AC). The integrated end-state re-scan in real Chromium confirms the combined mechanisms work together: Escape LIFO across stacked surfaces, 5-destination rail + labeled strip + named peek at every width, opaque floating layers, one scroll/gutter/keep-alive contract per tab. What remains is a handful of minor/nit issues (XR-1..XR-4) and evidence-gaps suitable for the normal backlog — none is an unresolved real defect in a shipped item.

VERDICT: PASS
