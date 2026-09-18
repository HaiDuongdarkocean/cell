# Spec — `pre-watch-primer`

> Status: r1 (spec-review round 1 applied — 2 Blockers + 8 Majors resolved) · Backlog #8 · Cost M · Intent: `docs/intent/pre-watch-primer.md`
> Pain: "Vào video mới dồn từ lạ → bỏ cuộc; preview top từ high-freq unknown trước khi xem"

## 1. Summary

The subtitle panel gains a **Words tab**: the currently loaded video's learnable vocabulary (status `unknown` + `tracking`), aggregated across all cues, ranked by frequency (high-frequency first) with per-term occurrence count, frequency band, and status. Row click opens the existing dictionary popup (status cycling inside it already works); a per-row seek button jumps playback to the term's first cue. The tab works identically on the streaming split-view panel and in the local player — the same `SubtitlePanel` shell serves both.

Data source is the **already-resolved `lastGood` token resolution** inside `SubtitlePanel` (`CueListTokenMap` + `rankByTerm` + `thresholds` + `freqUnfiltered`) — zero new fetch paths. Live updates are driven by a **panel-level `onWordStatusChanged`/`onWordStatusRemoved` subscription** applying `applyCueListTokenStatus` directly to `lastGood.tokenMap` — required because `Tabs.Content` unmounts inactive tabs (`shared/ui/Tabs.tsx`), so with Words open, CueList (and its own status listener) is unmounted; the panel-level subscription keeps `lastGood` fresh regardless of which tab is active.

## 2. Pure core — `features/subtitle/logic/primerList.ts`

```ts
export interface PrimerRow {
  readonly term: string;
  readonly status: 'unknown' | 'tracking';
  readonly count: number;            // occurrences across all cues
  readonly rank: number | null;      // best frequency rank; null = no entry / unfiltered
  readonly band: TokenFrequencyBand; // first-occurrence token's resolved band
  readonly contextText: string;      // targetText of first cue containing the term
  readonly firstCueIndex: number;    // cue.index of first occurrence
  readonly firstCueStartMs: number;  // cue.start of first occurrence
  readonly firstCueEndMs: number;    // cue.end of first occurrence
  readonly firstTokenOffset: number; // token.start within contextText
}

export function buildPrimerList(
  tokenMap: CueListTokenMap,
  rankByTerm: ReadonlyMap<string, number | null>,
  cues: readonly BilingualCue[],
): PrimerRow[];
```

Semantics:

- **Filter**: non-separator tokens with `status === 'unknown' | 'tracking'` — the learnable set. Intentionally **status-only** (unlike `firstPausableToken`, which additionally gates `rank ≤ thresholds[level]` — that gate exists to decide *pause-worthiness*, not vocabulary membership; the primer shows every learnable word and lets ranking do the prioritization).
- **Group by `term`**: `count` = total occurrences; first occurrence = earliest cue iteration then earliest `token.start` (tokenMap iterates in cue order — track the first seen, no re-sort).
- **Sort**: `rank` asc (null → `+∞`, sorts last — per lesson `frequency-band-very-low-coverage`, missing entries are never dropped) → `count` desc → `term` asc (plain `<` compare, deterministic).
- **`band`** = first-occurrence `token.frequencyBand` (already resolved via `entriesToBand`: missing entries → `'rare'`, consistent with cue-list token colors — no recompute, no `rankToBand` null-guard). `rank` still used for sort: `rankByTerm.get(term) ?? null` (`?? null` because >200-char terms are absent from the map).
- `cues` supplies `start`/`end`/`targetText` per `cue.index` — build `Map<index, cue>` once; tokenMap keys are `cue.index`, not array position (non-contiguous indexes must not break lookup).
- O(n) collect + one final sort of distinct terms.

## 3. UI — `features/subtitle/ui/PrimerTab.tsx` (+ `.module.css`)

Rendered as `Tabs.Content value="words"` inside `SubtitlePanel`:

- **Header**: `N new words` (+ `N unknown · M tracking` breakdown when both statuses present) — i18n `primer.*` keys (en + vi), same `t()` the panel already uses.
- **Row** = `div role="button" tabIndex={0}` + Enter/Space keydown (LibraryCard row pattern — real `<button>` would make the nested seek button invalid HTML):
  - `data-cue-start={firstCueStartMs}` `data-cue-end={firstCueEndMs}` on the row — makes `isLookupFromSubtitle` true → popup gets cue range (screenshot/audio/Card-Creator context intact).
  - term `<span class="js-cell-token" data-cell-term={term} data-cell-start={firstTokenOffset}>` — the `.js-cell-token` class plugs the row into existing popup pin/status-class machinery; `data-cell-start` feeds `cursorOffset` via the existing adapter (`Number(el.getAttribute('data-cell-start'))`).
  - band chip (band-color token dot, `aria-hidden` + `title` + `VisuallyHidden` label — same pattern as cue-heat) · status chip (`unknown`/`tracking`, status token colors) · `×count` · seek `<Button shape="circle" variant="ghost" size="sm">` with `Icon name="playRoundedRect"`, `aria-label` = `primer.seek` with term + timestamp args.
- **Row click** → `onTokenClick(term, termSpanEl, contextText)`; **seek click** → `e.stopPropagation()` + `onSeek(firstCueStartMs)`.
- **Empty**: `lastGood` exists but list empty → `EmptyState size="compact"` "All words known" (positive feedback, not a hidden tab).

## 4. `SubtitlePanel` integration

- `PanelTab` += `'words'`. **Tabs render whenever `hasPlaylist || Boolean(tokenize)`** (was `hasPlaylist` only) — mounting CueList under a stable Tabs tree prevents the bare↔Tabs branch swap from remounting CueList (scroll reset + re-resolve) on every `primerAvailable` edge. Streaming without tokenize keeps the bare `cueListWrap` unchanged.
- `primerAvailable` = `tokenize && !scoreSuppressed && !panelBlurred && practiceMode === 'off' && lastGood !== null && lastGood.cueSetKey === cueSetKey` — same freshness rule as `difficulties`; `panelBlurred` gate (revealing words defeats blur-practice); `practiceMode === 'off'` gate (Words would leak cloze/dictation answers — same gate as `cueFilterEnabled`/`chipLive`).
- `Tabs.Trigger value="words"` gated on `primerAvailable`, label `Words` + count chip — `data-cell-id="subtitle-panel-tab-words"`.
- **Panel-level live update**: `useEffect` subscribing `onWordStatusChanged` + `onWordStatusRemoved`; on event with matching `langCode`, `setLastGood(prev => prev && { ...prev, tokenMap: applyCueListTokenStatus(prev.tokenMap, detail.term, status) })` (`removed` → status `'unknown'`). Mount-independent — works while Words tab (or playlist) is active.
- **Stale-tab guard**: `useEffect` resetting `activeTab` to `'subtitles'` when `activeTab === 'words' && !primerAvailable` — without it, a video switch/cueSetKey flip while on Words renders all `TabsContent` null → blank panel.
- **Playlist-default mount gap** (local player): `activeTab` initial `'playlist'` when no cues → CueList never mounts → nothing resolves. Fix: `useEffect` watching `visibleCues.length` transition `0 → >0` while `activeTab === 'playlist'` → auto-switch to `'subtitles'` (once per load — picking a video should show its subtitles anyway; a user who re-opens Playlist afterwards is not yanked).
- Player Mode (`PlayerModeOverlay` reuses `SubtitlePanels`→`SubtitlePanel`) inherits the tab automatically — no extra wiring.

## 5. Local-player tokenize wiring

Local player never passed `tokenize` → no resolution → no primer (and no heat/FAB). Wire it — same adapter shape as streaming:

- `useSubtitleActions` += `cueListTokenize: CueListTokenize | null`: when `settings.subtitleOverlayTargetLanguage` is **set** → `{ langCode, onTokenClick }`, where `onTokenClick` builds `LookupRequest` (`cursorOffset` from `data-cell-start`) + `requestId` and calls `webTextCtrlRef.current.handleLookup(request, requestId, el.getBoundingClientRect(), el)` — copied adapter from `contentScriptController.ts:338-348`. **`null` when the setting is unset** — streaming treats unset target-language as tokenize-disabled (`contentScriptController.ts:311-318`); an `'en'` fallback would tokenize non-English subtitles into the wrong status/frequency stores.
- `PlayerView` accepts `tokenize` prop → drives `subtitlePanelsRef.current.setTokenize(...)` in a `useEffect` — **imperative path, not the prop**: `SubtitlePanels` stores `initialTokenize` in `useState` with no prop→state sync (write-once), so a prop arriving after settings load would be dropped. `reactSubtitleController.ts:739-744` is the precedent for the imperative call.
- **Enable semantics (product decision)**: local player tokenize is **always-on when target language is set** — the per-URL opt-in map (`subtitleUrls`) exists because tokenize modifies third-party pages; the local player is Cell's own learning surface where subtitle tokenization is the point of the feature. No new setting; an opt-out can be added later if users ask.
- **Intended side effects** (verified by smoke): cue target text gains status/frequency colors + click-to-lookup; `mediaStats` chip appears; cue-heat bars (#5) + cue-filter FAB (#4) activate on local player — feature parity with streaming.

## 6. Contracts

- No new messages, no IDB, no storage keys — resolution and status events are all in-page.
- `tokenize.onTokenClick` contract unchanged: `(term, element, contextSentence)`.
- `lastGood` shape unchanged: `{cueSetKey, tokenMap, rankByTerm, thresholds, freqUnfiltered}` — primer reads + immutable updates only (`applyCueListTokenStatus` returns a new map).

## 7. Edge cases

- **No frequency resources** (`freqUnfiltered`): every `rank = null` → stable count-desc order; bands all `'rare'` — list still works (same graceful fallback as unknownCueMap).
- **Status fetch failed** (`meta.failed`): `lastGood` never set → tab absent (existing guard).
- **0 learnable words**: tab shows EmptyState "All words known".
- **Tokenize toggled off / cues cleared / zh / practice on / blur on**: `primerAvailable` false → Words trigger + content hidden; `activeTab` reset keeps panel non-blank.
- **New video loads** (`cueSetKey` changes): old `lastGood` fails the key check → tab hidden until fresh resolution lands; stale rows never shown. Same-shape subtitle swap (identical cueSetKey) inherits lastGood until re-resolve — same staleness semantics as `difficulties`, accepted.
- **Mark known mid-watch from any surface**: popup emits `emitWordStatusChanged` → panel-level subscription updates `lastGood` → row leaves list live even with Words tab active (CueList unmounted); cross-surface changes reach local player via `startWordStatusCrossTabRelay` (#6).
- **`sidepanel/App.tsx` (chrome.sidePanel)**: passes no `tokenize` → no tab — unchanged.
- **Settings changes mid-session**: `cueListTokenize` is read once per settings load — a target-language change applies on next mount (no storage listener; documented, consistent with `loadFrequencyBandOptions` caching).

## 8. Testing

- `primerList.test.ts`: filter set (unknown+tracking, skip known/ignore/separator) · count + first-occurrence across cues · sort (rank asc → count → term; nulls last; freqUnfiltered all-null order) · band taken from token.frequencyBand · cue.index vs array position (non-contiguous) · empty map.
- `PrimerTab.test.tsx`: rows + chips + count header · row click fires `onTokenClick(term, el, contextText)` and the term span carries `data-cell-start`/`data-cell-term`/`js-cell-token` · row carries `data-cue-start`/`data-cue-end` · seek fires `onSeek(firstCueStartMs)` without triggering lookup · empty state.
- `SubtitlePanel.test.tsx`: **headline — mark-known while Words tab active → row leaves list live** (panel-level subscription, CueList unmounted) · Words trigger iff `primerAvailable` (fresh lastGood, not zh, not blurred, practice off) · `activeTab` resets to subtitles when primerAvailable flips false on Words · playlist→subtitles auto-switch on first cues · tabs stable across primer edges (CueList not remounted).
- `useSubtitleActions` (local): `cueListTokenize` null when `subtitleOverlayTargetLanguage` unset · built when set · `onTokenClick` produces `handleLookup` with correct `langCode`/`contextSentence`/`cursorOffset`.

## 9. Non-goals

- Per-card word preview in `LibraryView` (badge `newTerms` already previews the count).
- Batch mark-known / export / SRS seeding from the list.
- `chrome.sidePanel` Words tab (no tokenize/lookup context there).
- zh-language primer (same `scoreSuppressed` gate).
- Re-sort controls (fixed rank order is the product decision — "high-freq first").

## 10. Alternatives considered

- **Pre-load per-card primer (LibraryView)**: needs per-video rank resolution (tokenCache has tokens but no per-term ranks) — second fetch path + second surface for the same pain; post-load panel tab covers both surfaces with one resolution already paid for.
- **Primer strip under panel header**: less discoverable than a tab, competes with cueFilterStrip for the same slot; tab reuses existing Tabs primitive.
- **Separate resolution hook instead of `lastGood`**: duplicates status+freq fetches per video — `lastGood` is the same data already resolved for heat/filter.
- **Streaming-only**: leaving local player without `tokenize` splits the feature; the wire is one adapter and unifies #4/#5 behaviors too.
