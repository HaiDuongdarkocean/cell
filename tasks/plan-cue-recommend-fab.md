# Implementation Plan: Cue Recommend FAB (Quản lý Cue đề xuất)

> Spec: `docs/specs/cue-recommend-fab.md` (APPROVE WITH CHANGES r3, all items applied) · Intent: `docs/intent/cue-recommend-fab.md` · Backlog #4.

## Overview

FAB bottom-right trong `cueListWrap` của mọi `SubtitlePanel` → menu 6 filter modes (i+1 headline) kèm count → `CueList` render `filteredCues` riêng (không đụng `visibleCues`/tokenize pipeline). Strange-count gate = `bestRank` semantics qua `rankByTerm` mới; persist mode qua `STORAGE_KEYS.CUE_FILTER_MODE`; fail-open khi status fetch hỏng, degrade-unfiltered khi freq hỏng.

## Architecture Decisions

- **`filteredCues` memo riêng trong CueList** — `visibleCues` nguyên vẹn vì nó feed tokenize effect + `createCueListTokenMap` (r2 blocker).
- **`rankByTerm` trong meta, không dùng `token.frequencyBand` cho gate** — `entriesToBand` có priority-pick + disabled-resource fallback ≠ `bestRank` enabled-only lowest-rank.
- **`unknownLevel` đọc `useStudyModeStore` trong panel** — zero prop plumbing, live-update khi đổi level; default thật = `'common'` (INITIAL state).
- **Scroll reset dep = `filterEpoch` (mode string)**, đặt trước auto-scroll effect — không yank khi mark từ.
- **`cueSetKey` invalidate lastGood** khi đổi video (cue.index reuse 0..N).
- **Menu = `Popover` + `menuAlign` prop mới** (backward-compatible default 'left') thay vì hand-roll placement.
- **Chunk terms ≤1000** trong resolve pass — fix latent bug >1000-unique-terms → silent all-unknown.

## Task List

### Phase 1: Pure logic (parallel-able)

- [ ] **Task 1: `cueDifficulty.ts` pure module**
  - `src/features/subtitle/logic/cueDifficulty.ts`: `CueFilterMode`, `CueDifficulty`, `ResolveMeta`, `cueDifficultyMap`, `cueMatchesMode`, `countByMode`. Gate: non-separator ∧ status∈{unknown,tracking} ∧ (freqUnfiltered ∨ rank∈(0,thresholds[level]]).
  - Acceptance: tất cả case trong spec §5 test plan pass — per-level gate, rank 0/null/missing exclude, unfiltered, tracking subset, predicates, `countByMode`, undefined-status/separator skip, divergence test (term chỉ trong disabled resource → rank null → không đếm).
  - Verify: `npm run test:unit -- cueDifficulty`
  - Files: `cueDifficulty.ts`, `cueDifficulty.test.ts` — Scope: S — **Parallel: true** (disjoint T2)

- [ ] **Task 2: `resolveCueListTokenMetadata` → `{ map, meta }`**
  - `src/features/tokenize/logic/cueListTokens.ts`: trả `{ map, meta: ResolveMeta }`; `rankByTerm` (enabled-filter + `pickBestFrequencyEntry` lowest-rank); `freqUnfiltered` (no resources ∨ freqMaps rỗng ∧ terms>0 ∨ bandOpts reject); `failed` (status reject ∨ statusMap rỗng ∧ terms>0); chunk `termList` ≤1000 (`MAX_TERMS_PER_REQUEST` precedent — check `scoreStatusFetch.ts`), merge maps; `terms.size===0` early-return meta; dọn dead `?? 'none'`.
  - CueList call-site: `.then(({ map }) => ...)` minimal — full wiring ở T3.
  - Acceptance: meta fields đúng theo spec; >1000 terms → n chunked calls; freq-fail → freqUnfiltered; status-fail → failed.
  - Verify: `npm run test:unit -- cueListTokens` + typecheck
  - Files: `cueListTokens.ts`, `cueListTokens.test.ts`, `CueList.tsx` (call-site minimal) — Scope: M — **Parallel: true** (disjoint T1)

### Checkpoint: Foundation
- [ ] `npm run typecheck && npm run test:unit` xanh — meta contract + pure logic verified trước khi đụng UI

### Phase 2: CueList + FAB

- [ ] **Task 3: CueList filter plumbing**
  - `CueList.tsx`: `metaRef` (meta resolve gần nhất, sync refires reuse; mount/EMPTY/tokenize→null → `resolved:false`); `onTokensResolved(map, meta)`; `cueFilter` + `filterEpoch` props; `filteredCues` memo; render/currentIndex/itemRefs/hasHours trên `filteredCues`; `itemRefs.current.length` trim; `highlightedRef` key theo `cue.index`; `filterEpoch` effect → `scrollTop=0` đặt trước auto-scroll effect.
  - Acceptance: mode đổi → không refire tokenize (`createCueListTokenMap` call count stable); missing index → optimistic true; epoch change → scrollTop=0; status event → không scroll reset; current ngoài set → currentIndex=-1.
  - Verify: `npm run test:unit` (CueList-related suites) + typecheck
  - Files: `CueList.tsx`, `CueList.test.tsx` (mới hoặc extend) — Scope: M — **Depends: T2** — Parallel: false

- [ ] **Task 4: `CueRecommendFab` + Popover align + i18n**
  - `src/features/subtitle/ui/CueRecommendFab.tsx` + `.module.css`: Button circle + badge (cap "99+", hiện "0") + `aria-haspopup="menu"`/`aria-expanded`/aria-label có i+1 count + title tooltip; menu `role=menu` qua `Popover`, items `role=menuitemradio` + `aria-checked`, label+count, active check; Esc/click-outside (`pushEscapeLayer`), focus return, ↑↓/Enter theo `Select.tsx` precedent.
  - `Popover.tsx`: thêm optional `menuAlign?: MenuAlign` prop (default `'left'` — backward compat), truyền vào `useMenuPlacement`.
  - Icon: `ICON_CATALOG.slidersHorizontal` (verify tồn tại; thiếu → `design-svg`).
  - i18n keys `cueFilter.*` en+vi: `fabAriaLabel` ("i+1 cues: $1"), `fabTooltip`, `modes.{all,i1,hasUnknown,allKnown,dense,tracking}`, `indicator.active`, `indicator.showAll`, `emptyTitle`, `emptyAction`.
  - Acceptance: A2, A16, A17, A23, A24 — badge, menu a11y, counts, Esc/focus.
  - Verify: `npm run test:unit -- CueRecommendFab` + typecheck
  - Files: `CueRecommendFab.tsx`, `.module.css`, `CueRecommendFab.test.tsx`, `Popover.tsx`, `en.json`, `vi.json` — Scope: M — **Depends: T1 (types)** — Parallel: false (shares files với T5 qua i18n? không — i18n keys đặt ở T4 hết, T5 chỉ dùng)

### Checkpoint: Components
- [ ] Unit tests xanh; FAB render được trong isolation; menu keyboard nav hoạt động

### Phase 3: Panel wiring + persist

- [ ] **Task 5: SubtitlePanel integration**
  - `SubtitlePanel.tsx`: `level = useStudyModeStore(s => s.advanced.unknownLevel)`; `lastGood` state `{cueSetKey, tokenMap, rankByTerm, thresholds, freqUnfiltered}` (update chỉ khi `meta.resolved && !meta.failed`; clear khi `cueSetKey` đổi); `handleTokensResolved` merge (giữ `map.size===0 → setMediaStats(null)`); `difficulties`/`cueFilter` `useMemo`; `filterEpoch = mode`; indicator strip (mode≠'all', `aria-live=polite`, pre-resolve chỉ label); EmptyState sibling overlay + "Show all" action (CueList stays mounted); FAB trong cả 2 nhánh `cueListWrap`; gates: tokenize/zh/practice/panelBlurred/0-tokenizable/no-lastGood; `cueFilter` chỉ truyền nhánh `practiceMode==='off'`; `.list` padding-bottom khi FAB render.
  - `config.ts`: `STORAGE_KEYS.CUE_FILTER_MODE`; persist helper read-on-mount/write-on-change qua `getStorage`/`setStorage` (convention `subtitleSplitView.ts:565,738`); invalid → 'all'.
  - Acceptance: A1–A26 phần wiring (gates, persist, strip, EmptyState, live level change, cueSetKey clear).
  - Verify: `npm run test:unit -- SubtitlePanel` + typecheck + lint
  - Files: `SubtitlePanel.tsx`, `SubtitlePanel.module.css`, `config.ts`, test — Scope: M — **Depends: T1,T3,T4** — Parallel: false

### Checkpoint: Feature complete
- [ ] A1–A26 pass; không regression trên CueList/SubtitlePanel/PlayerModeOverlay suites

### Phase 4: Gates + ship

- [ ] **Task 6: Gates + docs + ship**
  - `npm run typecheck && npm run lint && npm run test:unit && npm run build` — all green.
  - `docs/2-architechture-system.md`: thêm cueDifficulty module + FAB + filteredCues/persist key.
  - Real-Chrome smoke `testing-extension-browser` trên mock-youtube: badge, menu, filter, seek, mark từ → count live, reload → persist.
  - Backlog row → `shipped` + commit hash; `docs/0-wiki.md` changelog line.
  - Files: docs — Scope: S — **Depends: T5**

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `filteredCues` tách khỏi tokenize pipeline sai → refire/re-fetch | High | T3 AC assert call-count; `visibleCues` immutable cho tokenize path |
| Popover `menuAlign` extension phá consumers hiện hữu | Med | Optional prop default 'left'; existing tests cover |
| Store chưa load ở context lạ (local player) | Low | INITIAL='common' luôn defined → graceful; documented |
| Menu trong shadow DOM portal | Med | `Popover.getPortalContainer` đã handle shadow-root + panel container |

## Open Questions

- Không còn — mọi quyết định đã qua 3 review rounds; residual risks listed ở spec §10.
