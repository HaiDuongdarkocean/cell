# Spec — Cue Recommend FAB (Quản lý Cue đề xuất)

> Intent: `docs/intent/cue-recommend-fab.md` (8-field frame confirmed 2026-09-17).
> Backlog `#4` · Cost S · Value ★4 · Infra: `CueListTokenMap` (đã resolve status + frequency per cue), `SubtitlePanel`, `onWordStatusChanged`, `useStudyModeStore`.
> Backlog row: `docs/ideas/product-backlog.md` #4 `cue-recommend-fab`.
> Scope: product hoàn chỉnh ship được — không MVP (AGENTS.md mandate).

## 1. Phạm vi

**User story**: As an immersion learner watching with the subtitle panel open, I want a floating button that filters the cue list by difficulty mode, so that I can jump straight to learning-worthy cues (i+1 = 1–2 từ lạ) instead of scanning the whole list or letting them slip by.

FAB tròn ở góc phải dưới `cueListWrap` của **mọi** `SubtitlePanel` (Player Mode, Split View, local player — cả nhánh Tabs lẫn không-Tabs). Click → menu liệt kê chế độ lọc kèm số cue match per mode → chọn mode → CueList chỉ render cue match. Badge trên FAB = số cue i+1 hiện tại.

**Từ lạ (strange) — semantics giống hệt pause-on-unknown** (`unknownCueMap.ts:41-63` `bestRank`/`firstPausableToken`): token non-separator, `status ∈ {unknown, tracking}`, và rank tốt nhất **trong các frequency resource đang enabled** thoả `0 < rank ≤ thresholds[level]`:

| unknownLevel | Rank counted as strange |
|---|---|
| `core` | ≤ core threshold |
| `common` | ≤ common threshold |
| `general` | ≤ general threshold |
| `advanced` | ≤ advanced threshold |

`unknownLevel` đọc từ `useStudyModeStore(s => s.advanced.unknownLevel)` — store luôn có `advanced` (INITIAL = `'common'`, `migrateStudyModeState.ts:24`) → effective default `'common'` khi user chưa đụng setting. Term không có entry trong enabled resources → rank `null` → không đếm. **`token.frequencyBand` KHÔNG dùng cho gate** — band đó qua `entriesToBand`/`pickBestFrequencyEntry` (priority-order + fallback disabled resources) ≠ `bestRank` (enabled-only, lowest-rank). Gate tính từ `rankByTerm` riêng (§3).

**Freq-side degrade (unfiltered)**: `resourcePriority.length === 0` ∨ `freqMaps` rỗng khi `terms.size > 0` (`frequencyClient.ts:28-30` fail-soft) ∨ `loadFrequencyBandOptions` reject → `freqUnfiltered = true` → mọi unknown/tracking đếm. Cùng philosophy `freq.unfiltered` của unknownCueMap: freq infra fail → degrade rộng, KHÔNG fake "toàn quen" và KHÔNG hide.

**Status-side failure**: `getWordStatuses` reject ∨ `statusMap` rỗng khi `terms.size > 0` → `meta.failed` — empty-map = failure signal (comprehension-score baseline rule) → không compute, không FAB.

**Modes** (menu single-select, label + count mỗi mode; predicates overlap được — user chọn 1 lens):

| Mode | Match | Mục đích |
|---|---|---|
| `all` | mọi cue | default — tắt filter |
| `i1` | 1 ≤ strange ≤ 2 | i+1, headline mode (≈ Migaku 1T) |
| `hasUnknown` | strange ≥ 1 | net rộng |
| `allKnown` | strange = 0 | đoạn nghe nhẹ |
| `dense` | strange ≥ 3 | cue khó — tránh hoặc pre-study |
| `tracking` | tracking ≥ 1 (cùng rank-gate) | củng cố từ đang học |

## 2. Data model

`src/features/subtitle/logic/cueDifficulty.ts` (pure, không cross-feature edge):

```ts
export type CueFilterMode = 'all' | 'i1' | 'hasUnknown' | 'allKnown' | 'dense' | 'tracking';

export interface CueDifficulty {
  strange: number;   // unknown + tracking, 0 < rank ≤ thresholds[level]
  tracking: number;  // tracking subset (cùng gate)
}

export function cueDifficultyMap(
  tokenMap: CueListTokenMap,
  rankByTerm: ReadonlyMap<string, number | null>,
  thresholds: FrequencyBandThresholds,
  level: UnknownLevel,
  freqUnfiltered: boolean,
): Map<number, CueDifficulty>;

export function cueMatchesMode(d: CueDifficulty, mode: CueFilterMode): boolean;

export function countByMode(difficulties: ReadonlyMap<number, CueDifficulty>): Record<CueFilterMode, number>;

export interface ResolveMeta {
  resolved: boolean;        // false cho mount/EMPTY/tokenize→null fires
  failed: boolean;          // status-side failure
  freqUnfiltered: boolean;  // no enabled resources ∨ freq-side failure
  rankByTerm: ReadonlyMap<string, number | null>;
  thresholds: FrequencyBandThresholds;
}
```

Gate: token non-separator, `status ∈ {unknown|tracking}`, và (`freqUnfiltered` ∨ `rank ∈ (0, thresholds[level]]`). `status === undefined` ∨ `rank null/missing` → không đếm.

**Persistence**: `STORAGE_KEYS.CUE_FILTER_MODE` (`'cueFilterMode'`) — `CueFilterMode`, survives reload/đổi surface, qua storage helper hiện hữu (`chrome.storage.local`, convention `SPLIT_VIEW_PCT`, config.ts:353-356). Invalid → fallback `'all'`. Async read → mount flash `'all'` rồi snap stored — accepted. Không cross-panel live sync (read-on-mount; accepted gap).

## 3. Kiến trúc

```
CueList (delta)                                SubtitlePanel (delta)
├─ resolveCueListTokenMetadata               ├─ level = useStudyModeStore(s=>s.advanced.unknownLevel)
│   → { map, meta }                           ├─ onTokensResolved(map, meta) → useCallback:
│   meta = { resolved, failed,                │     meta.resolved && !meta.failed → lưu lastGood
│            freqUnfiltered,                  │     {cueSetKey, tokenMap, rankByTerm, thresholds,
│            rankByTerm, thresholds }         │      freqUnfiltered} ; map.size===0 → mediaStats=null (giữ)
├─ metaRef giữ meta resolve gần nhất          ├─ cueSetKey = `${len}:${first.start}:${last.end}:${langCode}`
│   → sync refires (status change) reuse      │     (convention contentScriptController.ts:184 + lang) —
└─ onTokensResolved(map, metaRef.current) ──► │     đổi → clear lastGood
   fire khi !resolving; mount/EMPTY/          ├─ difficulties = useMemo(map, level)
   tokenize→null → meta.resolved=false        ├─ cueFilter = useMemo; filterEpoch = mode
├─ filteredCues = useMemo(visibleCues         ├─ mode ≠ 'all' → indicator strip + EmptyState overlay khi 0
│   .filter(cueFilter)) — RIÊNG,              │   (CueList vẫn mounted — giữ tokenMap + subscription)
│   visibleCues NGUYÊN VẠN (feed tokenize     └─ <CueRecommendFab> trong cueListWrap (cả 2 nhánh)
│   effect + createCueListTokenMap)
└─ render/currentIndex/itemRefs trên filteredCues
```

**Deltas:**

1. `resolveCueListTokenMetadata` → `{ map, meta }`:
   - `rankByTerm: Map<string, number|null>` — bestRank semantics: entries filter theo `resourcePriority` (enabled only) → `pickBestFrequencyEntry(enabled)` lowest-rank → `frequency`; không có enabled entry → `null`.
   - `thresholds` = `bandOpts.thresholds` (fallback DEFAULT khi bandOpts fail).
   - `freqUnfiltered` = `resourcePriority.length === 0` ∨ freq-side failure (`freqMaps` rỗng ∧ terms>0 ∨ bandOpts reject — freq fetch tách khỏi Promise.all hoặc catch riêng để degrade thay vì reject chung).
   - `failed` = status-side failure (`getWordStatuses` reject ∨ `statusMap.size === 0` ∧ `terms.size > 0`).
   - `terms` **chunked ≤1000** trước mọi message call (`entities/message/dictionarySchemas.ts` cap `terms.max(1000)`; precedent `scoreStatusFetch.ts` `MAX_TERMS_PER_REQUEST`) — fix luôn latent bug: episode >1000 unique terms hiện fail-soft thành all-unknown. Merge maps sau parallel chunks.
   - `terms.size === 0` → early return `{ map, meta: { resolved: true, failed: false, freqUnfiltered: false, rankByTerm: new Map(), thresholds: DEFAULT } }`.
2. `CueList`:
   - `onTokensResolved?: (map, meta: ResolveMeta) => void`; `metaRef` giữ meta của resolve gần nhất — sync refires (status-change tokenMap updates) reuse meta đó; mount với EMPTY map → `{ resolved: false, ... }`.
   - `cueFilter?: (cueIndex: number) => boolean` + `filterEpoch?: string` (= mode). **`filteredCues` memo riêng**: `cueFilter ? visibleCues.filter(c => cueFilter(c.index)) : visibleCues`. `visibleCues` KHÔNG đổi — nó feed tokenize effect (`deps [visibleCues, tokenizeLangCode]`) + `createCueListTokenMap`; filter ở đó = re-tokenize mỗi mode toggle + partial map overwrite last-good (r2 blocker).
   - Render + `currentIndex` + `itemRefs` + `hasHours` trên `filteredCues`; `itemRefs.current.length = filteredCues.length` mỗi render; `highlightedRef` key theo `cue.index` thay vì array position (cue removal trước current → không re-center jump sai).
   - `cue.index` missing trong difficulty map (cue mới trong staleness gap) → `cueFilter` trả `true` — optimistic include.
   - Effect `filterEpoch` change → `listRef.scrollTop = 0`, đặt TRƯỚC auto-scroll effect (order trong file = order chạy). Dep là epoch (mode string), không phải `cueFilter` (identity đổi mỗi recompute → scroll-yank khi mark từ).
   - Current cue ngoài filtered set → `currentIndex = -1` → không highlight/scroll (đúng).
3. `SubtitlePanel`:
   - `level` từ store (reactive → level đổi recompute live). Cross-feature import hiện hữu (`SubtitlePanels.tsx:132`, file này đã import `studyModes/ui`).
   - `lastGood` state `{cueSetKey, tokenMap, rankByTerm, thresholds, freqUnfiltered}`; chỉ update khi `meta.resolved && !meta.failed`. `cueSetKey` đổi (đổi video) → clear ngay — cue.index 0..N reuse giữa videos, giữ map cũ = filter sai cue.
   - `difficulties = useMemo(cueDifficultyMap(lastGood..., level))`; `cueFilter = useMemo(index => { const d = difficulties?.get(index); return d ? cueMatchesMode(d, mode) : true })`.
   - `handleTokensResolved` merge: giữ `map.size === 0 → setMediaStats(null)` hiện hữu + lưu lastGood.
   - Tokenizable gate count = `visibleCues` theo CueList semantics (`targetText.trim().length > 0`) — native-only episode → 0 → không FAB.
4. `CueRecommendFab` (`src/features/subtitle/ui/`): `Button shape="circle"` + badge (`i1` count, cap `"99+"`, hiện cả `"0"`) + `title` tooltip + `aria-label` có "i+1" + count + `aria-haspopup="menu"` + `aria-expanded`. Menu `role=menu` anchored trên FAB, align right (Popover hiện hardcode `menuAlign:'left'` — extend prop hoặc dùng `useMenuPlacement` trực tiếp; verify ở build), items `role=menuitemradio` + `aria-checked`, `label + count`, active check.
5. Indicator strip (`mode ≠ 'all'`): slim bar top `cueListWrap`, `aria-live="polite"`: `{modeLabel} · {matched}/{total}` (total = tokenizable cues) + reset "Show all". Pre-resolve: chỉ label, không "0/M" giả. Trùng reset với EmptyState action = intentional redundancy.
6. EmptyState khi filtered = 0: render **sibling overlay trong cueListWrap** (CueList vẫn mounted — unmount = mất tokenMap + status subscription + re-resolve khi "Show all") + action "Show all cues" → `mode='all'`.
7. Practice mode: `cueFilter`/`filterEpoch` chỉ truyền CueList nhánh `practiceMode==='off'`; `SubtitlePracticeSession` không filter; strip cũng ẩn khi practice (không strip nói dối trên list không filter).

**Visibility gates**: `tokenize != null` ∧ `!zhSuppressed` ∧ `practiceMode === 'off'` ∧ `!panelBlurred` ∧ tokenizable cues > 0 ∧ `lastGood` tồn tại. Không đủ → không render FAB.

**Staleness**: cueSetKey đổi → lastGood clear → FAB ẩn tới khi resolve mới land (nhanh, honest — không filter sai). Cùng cueSet + re-resolve fail → giữ lastGood.

**Stability**: `onTokensResolved` `useCallback`; `cueFilter` `useMemo` trên `{difficulties, mode}` — identity chỉ đổi khi 2 cái đó đổi.

## 4. UI

- FAB: circle bottom-right `cueListWrap` (`position: relative` sẵn), z-index dưới blurOverlay; tokens only (`--elevation-shadow-l3`, surface/accent). `mode ≠ 'all'` → accent fill.
- Badge: i+1 count, `"99+"` cap, luôn hiện kể cả `"0"`.
- Menu: trên FAB, right-aligned; Esc/click-outside đóng (`escapeLayerStack`), focus về FAB; ↑↓ + Enter — primitive shared/ui (`Popover`/`useMenuPlacement`), không hand-roll.
- `.list` padding-bottom ≈ FAB + gap khi FAB render.
- Icon: `ICON_CATALOG` — nearest `slidersHorizontal` (filter/target/sparkles không có); nếu thiếu → `design-svg`. lucide-react precedent: SubtitlePanel đã dùng `ChevronRight`.
- i18n `cueFilter.*` en+vi: `fabAriaLabel` (chứa "i+1" + count), `fabTooltip`, `modes.*`, `indicator.active`, `indicator.showAll`, `emptyTitle`, `emptyAction`.
- Animation: `--duration-normal`/`--ease-standard`; `prefers-reduced-motion` tắt.

## 5. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| A1 | 12 cue 1–2 lạ (level=common, freq enabled) | cues resolved | FAB badge "12" |
| A2 | FAB hiện | click | menu mở: 6 `menuitemradio`, count đúng, `all` `aria-checked` |
| A3 | menu mở | chọn `i1` | chỉ render cue strange∈[1,2]; strip "i+1 · N/M"; scroll: current cue trong filtered set → align về nó, ngoài → scrollTop=0 |
| A4 | mode `i1` | chọn `all`/reset | list đầy đủ, strip ẩn |
| A5 | cue: 1 unknown rank≤advanced + 1 unknown rank>advanced | level=advanced | rank lớn → null → strange=1 → match `i1` |
| A6 | level=common | token rank band `general` | không đếm |
| A7 | không freq resource / freqMaps rỗng / bandOpts reject | resolve | `freqUnfiltered` → đếm mọi unknown/tracking |
| A8 | mark unknown→known cue 1-lạ đang filter i1 | status event | cue rời list, badge -1, **không refetch, không scroll-yank** |
| A9 | `allKnown` 0 match | — | EmptyState overlay + "Show all cues" → `all`; CueList vẫn mounted |
| A10 | tokenize off / zh / practice / blurred / 0 tokenizable cues | — | không FAB, không strip |
| A11 | đổi video (cue.index reuse 0..N) | cues prop đổi | cueSetKey đổi → lastGood clear → FAB ẩn → resolve mới land → counts đúng video mới |
| A12 | reload / đổi surface | mount | mode persist + strip hiện ngay |
| A13 | stored "xyz" | mount | fallback 'all' |
| A14 | click cue filtered | — | `onSeek(cue.start)` đúng |
| A15 | current cue ngoài filter | đang play | không highlight/scroll |
| A16 | menu mở | Esc / click-outside | đóng, focus về FAB |
| A17 | keyboard | Tab→FAB (`aria-haspopup`,`aria-expanded`), Enter, ↑↓, Enter | đúng |
| A18 | mount chưa resolve | EMPTY-map fire | `meta.resolved=false` → không FAB |
| A19 | statusMap rỗng/reject (first resolve) | resolve | `failed` → không FAB; re-resolve fail sau → giữ lastGood |
| A20 | episode >1000 unique terms | resolve | chunked calls — FAB vẫn hoạt động (không silent fail) |
| A21 | ~10k tokens | recompute | O(n) memoized, <16ms, không refetch |
| A22 | đổi `unknownLevel` trong Study Modes | store update | counts + filter recompute live |
| A23 | mọi cue all-known | resolved | FAB badge "0" vẫn hiện |
| A24 | count ≥100 | — | "99+" |
| A25 | mode toggle | — | KHÔNG re-tokenize/re-fetch — `visibleCues` nguyên, chỉ `filteredCues` đổi |
| A26 | practice mode bật khi filter đang on | practiceMode≠'off' | practice list KHÔNG filter, strip ẩn; tắt practice → filter còn nguyên |

## 6. Test plan

- Unit `cueDifficulty.test.ts`: rank-gate per-level, rank 0/null/missing exclude, unfiltered, tracking subset, predicates, `countByMode`, undefined-status, separator; **divergence test**: term chỉ có entry trong disabled resource → `rankByTerm` null → không đếm (khác `frequencyBand` display path).
- `resolveCueListTokenMetadata`: meta shape (resolved/failed/freqUnfiltered/rankByTerm/thresholds), chunking ≤1000 (mock >1000 terms → n calls, merge), freq-side degrade, status-side failed.
- `CueRecommendFab.test.tsx`: badge cap/"0", menu Esc/click-outside/focus-return, `menuitemradio`/`aria-checked`/`aria-haspopup`/`aria-expanded`, counts.
- `CueList`: `filteredCues` riêng (tokenize effect không refire khi filter đổi — assert `createCueListTokenMap` call count), missing-index optimistic, `itemRefs` length trim, scrollTop=0 trên `filterEpoch` change + KHÔNG reset khi status event, mount EMPTY fire `resolved=false`.
- `SubtitlePanel`: gates, strip + reset, EmptyState overlay giữ CueList mounted, persist + invalid fallback, store level + live recompute, cueSetKey clear, practice không filter.
- i18n keys en+vi.
- Real-Chrome smoke (`testing-extension-browser`): mock-youtube — badge, menu, filter, seek, mark từ → count live, reload → persist.

## 7. Boundaries & DoD

- Always: `npm run typecheck && npm run lint && npm run test:unit && npm run build` trước commit; named export; không comment; reuse shared/ui + tokens; i18n không hardcode.
- Ask first: manifest change (KHÔNG cần), dependency mới (KHÔNG cần).
- Never: fake `shipped` khi gate đỏ; fetch ngoài resolve pass hiện hữu; filter `visibleCues` (phá tokenize pipeline).
- DoD: **A1–A26 pass** · gates xanh · `docs/2-architechture-system.md` updated · spec link vào backlog · wiki changelog.

## 8. Success criteria

- "i+1 · 12" → chọn → list còn đúng cues đáng học → seek 1 chạm. Tìm cue i+1 ≤ 2 interactions.
- Counts honest: resolve xong mới hiện; rank gate đúng `bestRank` semantics; freq-fail degrade rộng; status-fail hide.
- Filter persist luôn có indicator + 1-click escape — không "subtitles biến mất".

## 9. Alternatives considered

- **Jump-to-next thay vì filter**: rejected bởi Anh yêu — menu modes cover nhiều intent; jump = #10.
- **FAB viewport-edge**: rejected — "góc phải dưới subtitle panel"; trong `cueListWrap` rẻ + contextual.
- **`token.frequencyBand` làm gate**: rejected — `entriesToBand` ≠ `bestRank` semantics (priority-pick + disabled fallback).
- **Filter `visibleCues` trực tiếp**: rejected (r2 blocker) — memo đó feed tokenize pipeline; `filteredCues` riêng.
- **`unknownLevel` prop wiring**: rejected — `useStudyModeStore` đã là dep; store read = zero plumbing + live.
- **Reuse `unknownCueMap.probe`**: rejected — first-hit boolean, tự fetch riêng.
- **Session-only mode**: rejected — product mandate.
- **Hide FAB khi 0 match**: rejected bởi Anh yêu — "luôn hiện", badge "0" honest.
- **Giữ lastGood qua video đổi**: rejected — cue.index reuse → filter sai; clear theo cueSetKey.

## 10. Open questions / accepted risks

- `onTokensResolved` signature đổi `(map, meta)` — internal, 1 consumer, cùng diff. Accepted.
- Cue biến mất khỏi filtered list khi mark known — đúng semantics, abrupt; monitor.
- Mode không cross-panel sync — diverge tới reload; accepted.
- zh suppressed (structural) — upgrade khi segmenter có probe.
- Strip denominator = tokenizable cue set (CueList semantics), không phải panel `visibleCues` (native-only rộng hơn) — documented.
- Mount flash 'all'→stored mode — accepted; Strict-mode double resolve → duplicate traffic — accepted (hiện hữu).
- `Popover.menuAlign` hardcoded 'left' — extend prop hoặc `useMenuPlacement` trực tiếp, quyết ở build theo smallest-diff.
- Dead `?? 'none'` ở `cueListTokens.ts:93` — dọn cùng diff.

## Elicitation revision log

- r0 2026-09-17: draft từ 8-field frame + inquiry-creativity modes + product-mandate.
- r1 2026-09-17: self-review → meta.failed fail-open, staleness policy, perf AC, 2 nhánh cueListWrap.
- r2 2026-09-17: spec-review (7 Majors) → rankByTerm gate, meta.resolved, freq→unfiltered, store level, strip+escape+scroll, blurred gate, A19–A26.
- r3 2026-09-17: spec-review round 2 (1 Blocker + 5 Majors) → `filteredCues` riêng khỏi `visibleCues` (B1), scroll dep = `filterEpoch` không phải cueFilter (M1), cueSetKey invalidate lastGood (M2), chunk ≤1000 terms (M3), practice-mode filter/strip pinned (M4), level default đúng `'common'` INITIAL (M5), rank>0 guard, metaRef ownership, freq-side symmetry, EmptyState overlay giữ CueList mounted.
