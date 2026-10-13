# Verification review — primer-tab-redesign (REQ-5, REQ-6)

- **Commit under review:** `6eda69e6` (parent `466f5391`), branch `feat/primer-tab-redesign`
- **Worktree:** `Tihoka-worktrees/primer-tab-redesign`
- **Spec:** `docs/specs/primer-tab-redesign.md` — REQ-5, REQ-6, NFR-6, SC-11..SC-13 only (REQ-1..4 out of scope)
- **Design brief:** `docs/intent/primer-tab-redesign-design-brief.md` — REQ-5/REQ-6 sections
- **Note:** branch HEAD has since advanced to `2f2a4e8f` ("disable scroll anchoring on cue list"), a post-review hardening commit. Findings below are evaluated at `6eda69e6`; where the follow-up changes the picture it is noted.

## What was checked

1. **REQ-5** (`SubtitlePanel.tsx:255`) — `showTabs = hasPlaylist || (primerAvailable && primerRows !== null)`.
   Renderable-tab count = 1 (Subtitles, always) + Playlist (`playlistContent !== undefined`, line 120) + Words
   (`primerAvailable && primerRows !== null`, lines 239–253). Since Subtitles is always renderable, `showTabs`
   is exactly "count ≥ 2". Single-tab renders the existing non-tabs `cueListWrap` path (lines 483–501) with no
   `Tabs`/`role="tablist"`/`subtitle-panel-tab-*` in the DOM (`Tabs.List` is the only `role="tablist"` source,
   `src/shared/ui/Tabs.tsx:94`). `buildPrimerList` returns `PrimerRow[]` and never `null`
   (`src/features/subtitle/logic/primerList.ts:33`), so `primerRows !== null` ⟺ `primerAvailable` — the strip
   appears reactively when primer resolves (alt flow) and the `activeTab==='words'` reset effect
   (lines 257–259) still covers the disappearing-tab exception. No prop/state contract changes. **PASS**

2. **REQ-6 state machine** (`CueList.tsx:140–141, 241–249, 259–299, 306–405`) —
   - FOLLOWING → DESYNCED: `handleListScroll` (line 290) compares `list.scrollTop` to `expectedScrollTopRef`;
     divergence `>2px` sets `desynced`. **O(1)**, reads `scrollTop` only — no `getBoundingClientRect` or layout
     reads in the handler. NFR-6 satisfied.
   - Programmatic writes record expected: `align()` writes `list.scrollTop` then stores the post-clamp value
     (lines 274–275); the `filterEpoch` reset stores `0` (lines 243–245). Both statements are synchronous inside
     the effect, so the async scroll event always sees `scrollTop === expected` → aligns never self-desync.
   - DESYNCED → FOLLOWING: (a) pill → `resumeFollow(true)` clears `highlightedRef` → effect re-runs → realign
     + expected updated (lines 296–299, 277–280); (b) cue-timestamp click → `resumeFollow(false)` + `onSeek`
     (lines 374–377) — no immediate realign by design; the landing cue change triggers `align()` via
     `highlightedRef !== currentCueIndex`; (c) `filterEpoch` → `scrollTop=0`, `expected=0`,
     `highlightedRef=null`, `desynced=false` (lines 241–249).
   - Desync gates the auto-align effect via early return + `desynced` in deps (lines 260, 288); ResizeObserver
     is torn down while desynced. `data-current` still advances because it is computed in render from
     `currentIndex` (line 328). `currentIndex < 0` exception handled: pill re-engages follow, next match
     realigns. External `scrollPositionPreserve` restore (`scrollPositionPreserve.ts:28`) writes `scrollTop`
     directly → registers as desynced per spec rule. **PASS**
   - Follow-up commit `2f2a4e8f` adds `overflow-anchor: none` to `.list`, closing the spec-accepted
     clamp/shrink misread risk (browser scroll-anchoring adjustments no longer fire divergent scroll events).
     Strictly hardening; not required by spec.

3. **Design-system conformance** —
   - New CSS uses tokens only: `--space-3`, `--space-4`, `--touch-target`, `--z-overlay-base`; no hex/px
     spacing. `.cueWrap` is layout-only (position/flex) and reproduces `.list`'s flex footprint
     (`flex:1; min-height:0`) so `.list` remains the sole scroll container inside `.cueListWrap`
     (SubtitlePanel.module.css:78–85) and `.session` (SubtitlePractice.module.css:1–7); showcase `.panelBody`
     is also flex-column — all three consumers keep working with the new wrapper.
   - Pill is the shared `Button` (`variant="overlay"`, `size="sm"`, `elevation="med"`, `leadingIcon`) — a real
     `<button type="button">`, keyboard-reachable, `data-tihoka-id` forwarded via `...rest` (Button.tsx:136).
     `shape` omitted → defaults to `pill` for icon+label buttons (Button.tsx:102), matching the design brief.
     `Icon name="crosshair" size="xs"` valid; icon registered in `ICON_CATALOG` with licensed lucide svg.
   - `z-index: var(--z-overlay-base)` (= 0) sits under `.blurOverlay` (`--z-overlay-low` = 10,
     SubtitlePanel.module.css:87–95) — blur covers the pill per spec rule.
   - i18n `cueList.syncToVideo` in en ("Sync to video") + vi ("Đồng bộ với video"), matching the brief.

4. **Contracts** — `data-tihoka-id="cue-list-scroll"` unchanged on the scroller (`scrollPositionPreserve` and
   `.cueListWrap[data-cue-filter] [data-tihoka-id='cue-list-scroll']` padding rule still resolve);
   `subtitle-panel-tab-*` hooks exist only inside the Tabs branch. **PASS**

5. **Edge cases / test consistency** — jsdom behavior is consistent: the legacy suite stubs layout metrics
   (`offsetHeight:50`, `scrollHeight:500`, `clientHeight:200`) so `align()` produces varying scrollTops; the
   new colocated suite relies on all-zero metrics (align snaps to 0) — assertions hold either way. Covered
   transitions: desync→pill→realign, 2px tolerance, seek-resync, filterEpoch reset, highlight-while-desynced,
   pill role/label, external-restore-as-desync, REQ-5 single-tab + growth-to-two-tabs. Timestamp-resync without
   realign when `onSeek` lands on the already-highlighted cue is per-spec (resume follow; next cue change
   realigns). **PASS**

6. **Conventions** — named exports, no `any`, no comments added in src, ponytail-minimal diff. **PASS**

## Findings

### RESOLVED — F1: `.listDesynced` bottom padding was defeated by the mobile media query — pill obscured the last cue on <600px viewports

**Status: FIXED in `669f7735`** (`.list.listDesynced` specificity bump + `tests/unit/features/subtitle/ui/CueList.styles.test.ts` guard). Re-verified in code and live in a real-Chrome run (`paddingBottom=56px` while desynced on the streamflix mock page). Original finding kept below for the record.

`src/features/subtitle/ui/CueList.module.css`

```css
.listDesynced {                    /* line 23 — specificity (0,1,0) */
  padding-bottom: calc(var(--touch-target) + var(--space-4));
}
…
@media (max-width: 599px) {        /* line 149 */
  .list {
    padding: var(--space-0-5);     /* shorthand — includes padding-bottom, later source wins */
  }
}
```

Both rules match the desynced scroller (`.list` + `.listDesynced`) at equal specificity; the media-query rule
is later in source order, so on viewports <600px `padding-bottom` collapses to `--space-0-5` (2px) while the
pill occupies ~52px at `bottom: var(--space-3)` + button height. The Chrome side panel
(`src/entrypoints/sidepanel/App.tsx:303` mounts `SubtitlePanel`) is a primary surface whose viewport is the
panel itself — always <600px — so the last cue is deterministically obscured whenever the pill shows there.

Violates spec REQ-6 Rules: "while the pill shows, the list gets bottom padding so the last cue is not
obscured." (Was present at `6eda69e6`/`2f2a4e8f`; fixed at `669f7735` via the suggested
specificity raise — `.list.listDesynced` (0,2,0) beats the media `.list` (0,1,0) regardless of
source order, while still losing to the intentional cue-filter padding rule (0,3,0).)

### Non-blocking notes

- **N1** — Two CueList test files now cover the same component (`src/features/subtitle/ui/CueList.test.tsx`
  and `tests/unit/entrypoints/sidepanel/CueList.test.tsx`) with overlapping desync suites — multi-agent
  artifact, harmless but duplicative.
- **N2** — `cueList.syncToVideo` was inserted between the `cueFilter.*` and `cueHeat.*` groups in
  `en.json`/`vi.json`; alphabetical group order would place `cueList` after `cueHeat`. Cosmetic.
- **N3** — Follow-up `2f2a4e8f` replaced the `[role="tablist"]` absence assertion in
  `SubtitlePanel.test.tsx` with `[data-tihoka-id^="subtitle-panel-tab-"]`; `SubtitlePanel.primer.test.tsx`
  still asserts `queryByRole('tablist')` absence, so SC-11 coverage is retained overall.
- **N4** — `handleListScroll` is recreated per render (not memoized) — consistent with codebase style,
  negligible cost.

## Gates re-run + real-Chrome verification (2026-09-19)

- `typecheck`, `lint`, `test:unit` (559 suites / 6603 tests), `build` — all PASS on the main tree at `669f7735` + the in-flight REQ-1..4 dirty set; recorded via `scripts/pipeline-state.mjs`.
- `browser` — real Chromium + `--load-extension=dist` on the streamflix mock (`tmp/primer-verify/browser-check.mjs`): 7/7 — no `subtitle-panel-tab-*` with a single renderable tab (only the unrelated `study-mode-scroll-track` tablist), 40 cues rendered, scroll→`cue-list-sync` pill, real `<button>` "Sync to video", desynced `paddingBottom=56px` (F1 fix live), pill click hides + later cue change re-aligns, second desync re-shows, timestamp seek resumes follow + seeks.

VERDICT: PASS
