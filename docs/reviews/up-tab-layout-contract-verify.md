# Verify Review — up-tab-layout-contract

> Reviewer: fresh-context VERIFY agent (did not implement). Spec `docs/specs/up-tab-layout-contract.md`; design review PASS at `docs/reviews/up-tab-layout-contract-design.md`.
> Method: full diff audit of the item's file set, REQ-by-REQ source check, gates re-run, real-Chromium probes (Playwright, vite dev server `:5220`) against the mockup `real` variant (production `UniversalPanel` + production tab module CSS inside `ViewportFrame`), plus a dedicated real-audio probe mounting the production `PlaylistTab`.
> Captures + probe artifacts: `tmp/up-tab-layout-contract-verify/` (`probe.cjs`, `probe2.cjs`, `probe3.cjs`, `audio-probe.{html,tsx}`, `probe-results.json`, `desktop-*.png`, `mobile-*.png`, `empty-*.png`, `audio-playing.png`, `mobile-playlist-wrap.png`).

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (0 errors) |
| `npm run lint` | PASS — 0 errors, 4 warnings, all pre-existing SRS (`SrsNoteEditorPanel.tsx:63`, `SrsReviewCardBack.tsx:263`, `srsCardShared.tsx:216,244`); zero new |
| `npm run test:unit` | PASS — 680 suites / 8058 tests |
| `npm run build` | PASS — chained `composes` resolved (`._scrollport_1pays_71` + `._themed` emitted in `allModuleCss` bundle); prebuild CSS/token/icon/cycle checks 0 violations |

## Per-AC verdict

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 scroll reachability | PASS | Real Chromium (iframe viewport): playlist `.list` `scrollHeight 1620 > clientHeight 694` desktop, `2516 > 733` mobile, `overflow-y:auto`, `container-type:inline-size`; recap `.body` `957 > 694`; vocabulary `.list` `800 > 614`; studyModes `.tab` `1229 > 733` mobile; settings `.mainCol` `5954 > 645`; dictionary `.integratedMode` scrolls internally. All measured scrollers `reachesEnd: true`. |
| AC-2 preview teardown | PASS | Real Chromium (`audio-probe.tsx`, production `PlaylistTab` + real `<audio autoplay>` WAV blob): audio confirmed playing (`paused:false`, `currentTime` advancing) → `isActive→false` + `[hidden]` → audio element unmounted, `URL.revokeObjectURL` called once (blob released, not just muted). Unit tests cover the mid-read-race path (`previewUrl` dep — spec's second pinned option) and unmount revoke. Mount-level test proves `isActive = open && currentTab === tab` incl. close→inactive. |
| AC-3 uniform mount | PASS | `UniversalPanel.tsx:275-277` — recap rides `(visitedTabs.has('recap') \|\| activeTab === 'recap') && recapPanel && <div className={styles.tabPane} hidden>` identical to siblings; `{activeTab === 'recap' && recapPanel}` gone. Flipped test asserts same-node persistence. Live probe: recap pane node identity preserved across round-trip (`backSameNode: true`, `display:none` while hidden). |
| AC-4 recap place + revalidate | PASS | Live: `expandedId` + `scrollTop=150` survive round-trip on the same DOM node. `useEffect([isActive, load])` fires `GET_SESSION_RECAP` once per activation (unit: 1→2 calls). `failed && sessions === null` keeps the stale list on failed refresh (unit). |
| AC-5 gutter single-authority | PASS | `grep data-tihoka-id UniversalPanel.module.css` → 0 hits; `.content` computed `padding:0px` at both breakpoints; all page-gutter tabs compute `12px 16px 16px` (block 12 / inline 16 / block-end inset 16). Dictionary/settings keep internal guttering. |
| AC-6 single surface remap | PASS | `.body` is the sole declaration site; 3 tab-level copies deleted; `.modeCard` `--color-field` whitelist intact. Live: playlist + recap cards compute `color(srgb 0.976 …)` (surface-elevated) — previously no remap on those tabs (intended N6 delta). |
| AC-7 nav-hairline clearance | PASS | `padding-block-end:16px` measured on playlist/recap/studyModes scrollports; vocabulary `.tab` root provides the inset (alt flow — `.list` sits 16px above pane edge; measured last-row clearance 28px). Settings `.mainCol` padB 12px mobile (≥ `--space-3`). Dictionary: `.rightPane.dictionaryTab__sheet` is in-flow `height:56px` (`--space-14`) at ≤839px, so the collapsed MobileSheet (peek 32px, no header) overlays the reserved strip, not the `.leftPane` scroller edge — `.integratedMode` 16px inset suffices. |
| AC-8 empty states fill | PASS | `EmptyState .root{flex:1 1 auto}`, `.bordered{flex:none}`. Live metrics: playlist `.empty` fills pane 733px + centers; recap `.stateWrap` fills (top/bottom gap 12px = gutter); vocabulary `.tab` fills below fixed toolbar (chrome-fixed layout, intended); studyModes `.tab` fills. ≥3 non-panel consumers checked: `SubtitlePanel`/`CueList` (pre-existing `flex:1`, now redundant), `LinksPanel`/dictionary sub-panels (sole-child in column hosts), `sidepanel` `App` — all sole-child fill or inert. |
| AC-9 `@container` live | PASS | `.list` has `container-type:inline-size`; at 390px the container is 384px < 480px → `.itemInner` `flex-wrap:wrap` measured live, `.itemActions` wraps to second line (top offset 64px), hang-indent `padding-left:32px` = `space-3 + 20px`. First-ever visual QA of this rule — renders correctly. |
| AC-10 single lifecycle signal | PASS | `isActive` bound once at `mountUniversalPanel.ts:230-237,295-296`; no `MutationObserver`/`[hidden]` polling anywhere (grep clean). |
| AC-11 delta bound | PASS | Declared deltas verified (scroll regions, 12/16 gutters, elevated cards on playlist/recap/dictionary, bottom insets, centered empties, ≤480px wrap). D1 (out-of-panel padding) fixed — see re-verify below. |

## Defects

### D1 — RESOLVED — gutter/inset contract vars lacked fallbacks → `VocabularyTab` lost all padding outside the panel

`VocabularyTab.module.css:2-8` declares `padding: var(--universal-panel-tab-gutter)` + `padding-block-end: var(--universal-panel-tab-scroll-inset)` with **no `var()` fallback**, and `--universal-panel-tab-gutter: inherit` cannot supply one (it inherits the guaranteed-invalid value when no ancestor sets the property). Empirically verified in real Chromium: the same `.tab` class computes `padding: 12px 16px 16px` inside `.body` and **`padding: 0px`** when mounted outside it (`probe3.cjs`).

Blast radius — `VocabularyTab` has two non-panel consumers, both shipped/dev-visible:
- `src/entrypoints/srs-study/SrsVocabularyView.tsx:36` — shipped `srs-study` entrypoint; the vocabulary list now renders flush to the view edges (was `padding: var(--space-3)` = 12px all sides).
- `src/entrypoints/design-system-showcase/pages/VocabularyPanelPage.showcase.tsx:160` — showcase page.

Same hazard pattern on `StudyModesTab` / `RecapTab` / `PlaylistTab` gutters (no non-panel consumers today, but the contract is fragile by construction — a mockup already does this; e.g. `mockup-up-a11y-hit-targets/Specimen.tsx` imports vocab module CSS, though only chip classes so unaffected). Notably `.integratedMode` in `DictionaryPanelView.module.css:60` DID get `var(--universal-panel-tab-scroll-inset, var(--space-4))` — the implementer knew the pattern and missed the other four.

Minimal fix: add fallbacks preserving pre-change values — e.g. `padding: var(--universal-panel-tab-gutter, var(--space-3)); padding-block-end: var(--universal-panel-tab-scroll-inset, var(--space-3));` on `VocabularyTab .tab` (and mirror the defensive fallback on the other three tabs' gutter/inset usages for contract robustness). Re-verify the SRS vocabulary view padding after.

Related sub-note: removing the per-tab `--card-background`/`--color-surface-card` remap also reverts card shade to `--color-surface` on non-panel hosts — same root cause, but vocab rows aren't `Card`s so the visible impact is the padding loss.

## Scope-leak check

- Item 30 (hit-targets): no touch — `.itemActions :global(button)` min-size + `.itemInner` `min-height:44px` are pre-existing, untouched by the diff.
- Item 31 (nav chrome/badges): `UniversalPanelBottomNav`, `CollapsibleSidebar`, `panelTabs.ts` untouched.
- Item 32 (settings subnav): `SettingsTab` only gained a `.loading` centering class; the `settings.nav.scroll*` i18n keys in the tree are a different agent's dirty files — ignored.
- Item 33 (recipe convergence): no typography/recipe/shadow changes; `.modeCard` override preserved by design.
- `data-tihoka-id` stays as test hook only; `setVisitedTabs`-during-render left alone (item 29), as required.
- Foreign dirty files present and correctly ignored: `package.json` release hunks, `docs/mockups/player-mode-*.png`, `LICENSE`/`scripts/*.ps1`/`tihoka-*` artifacts, sibling `mockup-up-*/` dirs.
- `docs/2-architechture-system.md` + `docs/0-wiki.md` updated per DoD.

## Notes / non-blocking observations

- `useEffect([isActive, previewUrl])` teardown implements spec's second pinned option; a sub-frame window exists between commit and effect for a mid-read-resolved preview, but the spec explicitly pins this option — acceptable.
- `mobile-settings` probe `bottomClearance:-2848` is a probe artifact (picked a nested inner scroller, not `.mainCol`); `.mainCol` itself scrolls 5954>645 with 12–16px block-end pad — conforms.
- `mockup-up-tab-layout-contract/` still in tree — design-time artifact, expected to be deleted at ship per convention.
- Dev server on `:5220` was already running (not started by this review) — left running.

## Re-verify D1 (post-fix)

Usage sites in `VocabularyTab.module.css:7-8`, `StudyModesTab.module.css:5-6`, `PlaylistTab.module.css:8-9`, `RecapTab.module.css:8-9` + `:213` (`.stateWrap`) now read `var(--universal-panel-tab-gutter, var(--space-3))` / `var(--universal-panel-tab-scroll-inset, var(--space-3))` — pre-item standalone padding (`12px` all sides) restored when the contract vars are unset, while `.body`'s values still win inside the panel. `DictionaryPanelView.module.css:60` already carried its `var(--space-4)` fallback.

- Grep over `src/`: zero unguarded `var(--universal-panel-tab-*)` usages remain; the only bare uses are inside `mockup-up-tab-layout-contract/mockup.module.css`, which declares the vars itself (self-contained).
- Real Chromium re-measure (`probe3.cjs`, fresh module hash `_tab_1ld7c_1`): same `.tab` class now computes `padding: 12px` / `padding-block-end: 12px` **outside** the panel (matches pre-item `var(--space-3)`) and `padding: 12px 16px 16px` **inside** (contract unchanged).
- CSS-only change; vite dev re-transformed cleanly. D1 closed.

VERDICT: PASS
