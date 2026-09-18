# Plan — `pre-watch-primer` (backlog #8)

> Spec: `docs/specs/pre-watch-primer.md` (r1) · Intent: `docs/intent/pre-watch-primer.md`
> Pain: "Vào video mới dồn từ lạ → bỏ cuộc; preview top từ high-freq unknown trước khi xem"

## T1 — Pure core `primerList.ts` + tests

- [x] `src/features/subtitle/logic/primerList.ts`: `PrimerRow` + `buildPrimerList(tokenMap, rankByTerm, cues)` — filter status `unknown|tracking`, group by term (count + first occurrence), sort rank asc (null→∞) → count desc → term asc, band = first token's `frequencyBand`, `contextText`/`firstCue*`/`firstTokenOffset` via `Map<cue.index, cue>`
- [x] `primerList.test.ts`: filter set · count/first-occurrence · sort order + nulls-last + freqUnfiltered · band from token · non-contiguous cue.index · empty map

## T2 — `PrimerTab` UI component + tests

- [x] `src/features/subtitle/ui/PrimerTab.tsx` + `.module.css`: header count + unknown/tracking breakdown; row `div role="button"` with `data-cue-start`/`data-cue-end`; term span `.js-cell-token` + `data-cell-term` + `data-cell-start`; band chip (dot + `aria-hidden` + `title` + `VisuallyHidden`); status chip; `×count`; seek `Button shape="circle"` + `Icon name="playRoundedRect"`; EmptyState "All words known"; i18n `primer.*` (en+vi)
- [x] `PrimerTab.test.tsx`: render rows/chips/header · row click → `onTokenClick(term, el, contextText)` + attrs · seek → `onSeek` + stopPropagation · empty state

## T3 — `SubtitlePanel` integration + tests

- [x] `PanelTab` += `'words'`; Tabs render `hasPlaylist || Boolean(tokenize)`; `primerAvailable` gate (tokenize + !scoreSuppressed + !panelBlurred + practiceMode==='off' + lastGood fresh); Words trigger + count chip; `Tabs.Content` → `PrimerTab`
- [x] Panel-level `onWordStatusChanged`/`onWordStatusRemoved` subscription → `applyCueListTokenStatus` on `lastGood.tokenMap` (removed → `'unknown'`; langCode match)
- [x] Stale-tab guard: `activeTab==='words' && !primerAvailable` → reset `'subtitles'`
- [x] Playlist→subtitles auto-switch on `visibleCues` 0→>0 while `activeTab==='playlist'`
- [x] `SubtitlePanel.test.tsx`: mark-known-on-Words → row leaves live (headline) · trigger gating · tab reset · auto-switch · CueList not remounted across primer edges

## T4 — Local-player tokenize wiring + tests

- [x] `useSubtitleActions` += `cueListTokenize: CueListTokenize | null` (null when `subtitleOverlayTargetLanguage` unset; adapter → `webTextCtrlRef.handleLookup` with `cursorOffset` from `data-cell-start`)
- [x] `PlayerView`: `tokenize` prop → `useEffect` → `subtitlePanelsRef.current.setTokenize(...)` (imperative, reactSubtitleController precedent); PlayerView reads `subtitleActions.cueListTokenize` from the existing prop (no main.tsx change)
- [x] Tests: null-when-unset · built-when-set · `onTokenClick` → `handleLookup` correct args

## T5 — Gates + docs + Chrome smoke + ship

- [x] `npm run typecheck` + `lint` + `test:unit` + `build` + feature-cycle + deep-import guards
- [x] `docs/2-architechture-system.md` rows (primerList, PrimerTab, SubtitlePanel Words tab, local tokenize wire) + `docs/0-wiki.md` changelog
- [x] Real-Chrome smoke `tmp/pre-watch-primer/smoke.mjs`: streaming mock → panel Words tab → ranked rows → row click → dictionary popup → seek jumps · mark known via popup → row leaves live · local player → tokenize colors + Words tab + seek
- [x] Commits grouped by subsystem (no attribution) + backlog `shipped`
