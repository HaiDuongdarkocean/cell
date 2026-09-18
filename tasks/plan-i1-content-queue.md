# Plan — `i1-content-queue`

> Spec: `docs/specs/i1-content-queue.md` (r1, APPROVE WITH CHANGES applied) · Backlog: #6 · Cost: M
> Strategy: thin verified slices — pure sort → repo write-path → service → hook/UI → gates+smoke+ship

## T1 — Fit comparator (pure, TDD)

- [x] `features/tokenize/logic/comprehensionScore.ts`: export `BAND_MIN` as `COMPREHENSION_BAND_MIN`; re-export via `features/tokenize/index.ts`.
- [x] `features/local-player/logic/librarySort.ts`: `SortBy` += `'fit'`; `VideoEntry` += `comprehension?: { coverage: number }`; `fitDistance` + `compareFit` (scored first, distance asc → lower coverage → `compareRecent`; unscored last by `compareRecent`).
- [x] `librarySort.test.ts`: distance ordering, partition, tiebreaks, registration, unscored-last.
- Verify: `npx jest src/features/local-player/logic/librarySort.test.ts`

## T2 — Write-path integrity (repo, TDD)

- [x] `mediaLibraryRepository.ts`: `VideoRecord.comprehension?` type + `updateVideoComprehension(id, comp)` single-tx get+merge+put (absent → no-op).
- [x] `entrypoints/local-player/logic/mediaPersistence.ts`: `persistVideoRecord` carries `existing.comprehension` forward; `savePickedMedia` threads `PickedFile.handle` → `buildSubtitleRecord(file, handle)`.
- [x] `entrypoints/background/handlers/localPlayer.ts`: `LOCAL_PLAYER_VIDEO_OPENED` merges `existing.comprehension` before `saveVideo`.
- [x] Tests: repo merge helper; persistence preservation; handler merge.
- Verify: `npx jest src/features/local-player/services/mediaLibraryRepository.test.ts` + related suites.

## T3 — Scoring service (TDD)

- [x] `entrypoints/local-player/logic/libraryScoreService.ts`: `runLibraryScoring({videos, subtitles, fileMap, deps, isCurrent})` — per-video match (union of record filenames + dir-scan keys; sole-sub rule), file resolve (fileMap → dirHandle queryPermission+memoized scan → record.fileHandle queryPermission), token cache (`videoId+filename+lastModified`), pooled `fetchTermStatuses` (catch+empty → abort), `computeStats`, skip-unchanged, generation check before each write, `updateVideoComprehension`, no-write→no-emit, `totalTokens===0` skip.
- [x] Deps injected: `{ matchSubtitlesForVideo, parseSubtitleFile, queryPermission, getFile→scan, fetchTermStatuses, updateVideoComprehension, now() }` — testable + legal imports.
- [x] `libraryScoreService.test.ts`: all paths per spec §10.
- Verify: `npx jest src/entrypoints/local-player/logic/libraryScoreService.test.ts`

## T4 — Hook + UI wiring

- [x] `useLibraryScores` (`entrypoints/local-player/hooks`): generation ref, debounce 400ms/1500ms max-delay, `onWordStatusChanged`+`onWordStatusRemoved` filtered `languageMatches('en', …)`, triggers on library/subs/fileMap change, no-write→no-`setLibrary`.
- [x] `main.tsx`: `startWordStatusCrossTabRelay()` on mount; mount `useLibraryScores` at App level.
- [x] `LibraryView`: `SORT_OPTIONS` += `{value:'fit', label:'Best fit (i+1)'}`.
- [x] `LibraryCard`: `.meta` += `<ComprehensionBadge size="xs"/>` iff `video.comprehension` (`statsFromRecord` helper — real `newTerms`, counts 0).
- [x] Tests: option present, badge iff comprehension, debounced rescore, relay started.
- Verify: `npx jest src/entrypoints/local-player`

## T5 — Gates + docs + smoke + ship

- [x] `npm run typecheck && npm run lint && npm run test:unit && npm run build` + deep-import/feature-cycle guards.
- [x] `docs/2-architechture-system.md` (repo field+helper, librarySort `'fit'`, service/hook rows, test row), `docs/0-wiki.md` (index + changelog).
- [x] Real-Chrome smoke `tmp/i1-content-queue/smoke.mjs`: drop two video+srt pairs → badges → `fit` ordering → `WORD_STATUS_SET` re-sort → reload persistence.
- [x] Backlog → `shipped` + commit hash; commits grouped by subsystem.

Dependencies: T2→T1 (types), T3→T2 (`updateVideoComprehension`), T4→T3, T5→all.
Parallel: T1 pure logic is standalone; T3 service can scaffold while T2 lands.
