# Spec — `i1-content-queue`

> Status: r1 (APPROVE WITH CHANGES applied — spec-review round 1) · Backlog #6 · Cost M · Intent: `docs/intent/i1-content-queue.md`
> Pain: "Có score nhưng phải tự mò video vừa sức — cần 'xem gì tiếp' sort theo coverage gần band 95–98%"

## 1. Summary

Local-player library gains a **"Best fit (i+1)" sort**: every video with a scorable subtitle carries a persisted comprehension score (`coverage` + `band` + `newTerms`), renders a `ComprehensionBadge` on its `LibraryCard`, and sorts by distance to the i+1 sweet spot (media comfortable threshold = 95%). Scores are computed in a background pass — query-only permission checks, no prompts, fail-closed — and refreshed on library changes and on live word-status changes (in-page and cross-tab).

## 2. Data model

`VideoRecord` (IDB `orca-local-player` v2, `videos` store) gains an optional field — **no schema/version bump** (records are whole-object `put`; old records simply lack the field):

```ts
comprehension?: {
  coverage: number;          // 0–100, one decimal (computeStats output)
  band: ComprehensionBand;   // 'comfortable' | 'stretch' | 'hard'
  newTerms: number;          // unique unknown+tracking terms
  subtitleFilename: string;  // which subtitle produced this score
  computedAt: string;        // ISO 8601
};
```

Statuses are the source of truth; `comprehension` is a cache. A persisted badge may be stale while its subtitle file is unresolvable (accepted — the next successful run corrects it; see §8).

### Write-path integrity (review M1/M2)

- New repo helper **`updateVideoComprehension(id, comprehension)`** in `mediaLibraryRepository.ts`: `get` + merge + `put` inside a single `readwrite` tx (same pattern as `updateResumePosition`). Scoring writes ONLY through this helper — no stale record spreads, no resurrecting deleted videos (absent → skip).
- **`persistVideoRecord` becomes comprehension-preserving**: before `put`, read the existing record and carry `comprehension` forward when the new record lacks it. Fixes `loadVideo` (every play click builds a fresh record) and `savePickedMedia` re-picks silently wiping scores.
- **`LOCAL_PLAYER_VIDEO_OPENED` handler** (`entrypoints/background/handlers/localPlayer.ts:175-184`) merges `existing.comprehension` into the fresh record before `saveVideo` — `getVideo` is already imported there; 3-line merge, same preservation rule.

## 3. Scoring pipeline (background)

Orchestrator lives at **`entrypoints/local-player/logic/libraryScoreService.ts`** (`features/`→`entrypoints/` imports are CI-banned; precedent: `mediaPersistence.ts`, `fileCache.ts`). Pure helpers in `features/local-player/logic/libraryFit.ts`. Driven by hook `useLibraryScores`, mounted **at App level** (`main.tsx`) so the token cache survives LibraryView tab toggles.

```
runLibraryScoring({ videos, subtitles, fileMap, deps, generation })
  scanCache = Map<dirHandle, Map<filename, File>>   // memoized per run (m10)
  for each video (sequential):
    filenames = union(library subtitle filenames, dir-scan keys if resolvable)
    target = matchSubtitlesForVideo(video.filename, filenames, 'en', 'vi').target
         ?? (exactly one resolvable subtitle ? it : undefined)          // sole-sub rule (m11)
    if (!target) → skip (unscored)
    file = resolve target File, in order:
      1. fileMap.get(target.filename)                                   // session cache
      2. video.dirHandle → queryPermission({mode:'read'}) === 'granted'
         → scan dir (memoized; per-entry try/catch) → getFile(target)   // (m12)
      3. subtitleRecord.fileHandle → queryPermission({mode:'read'}) === 'granted' → getFile()
    if (!file) → skip
    tokenCache hit (videoId + filename + lastModified) ? reuse : parse
    cues = parseSubtitleFile(file.name, await file.text())              // throws → skip
    tokens = cues.flatMap(c => createTokenList(c.text, 'en'))
    collect terms → shared pool
  statuses = await fetchTermStatuses('en', unionOfTerms)                // try/catch (M6)
  if (threw || statuses.size === 0) → ABORT, keep persisted scores      // fail-closed
  for each scored video:
    stats = computeStats(tokens.map(t => ({...t, status: statuses.get(t.term) ?? 'unknown'})), 'media')
    if (stats.totalTokens === 0) → skip write entirely (unscored; prior value kept)   // (m16)
    if (stats unchanged vs record.comprehension {coverage,band,newTerms,subtitleFilename}) → skip
    if (generation !== current) → abort remaining writes                // (M4)
    updateVideoComprehension(video.id, {…stats, subtitleFilename, computedAt})
  if (≥1 write landed) → emit refreshed list; else → emit nothing       // (M5)
```

**Query-only permission (B1)**: use `handle.queryPermission({ mode: 'read' })` **directly** — never `verifyPermission`/`requestPermission` (which prompts on `'prompt'` state and throws `SecurityError` without a user gesture). `'granted'` → resolve; `'prompt'`/`'denied'`/throw → skip silently. **Post-restart reality**: persisted handles revert to `'prompt'` → cross-session scoring pauses until the user re-grants via a gesture flow (Open folder/files); persisted badges keep rendering. Documented, not hidden.

**Dead-path rescue (M7)**: `buildSubtitleRecord(file, handle)` already accepts a handle — thread `PickedFile.handle` through `savePickedMedia` (signature takes the picked objects, not just `Map<string, File>`). Makes path 3 real and rescues the whole "Add files" flow for cross-session scoring.

**Rules**:

- **Two-tier cache** — `tokenCache: Map<videoId, { subtitleFilename, mtimeMs, tokens, terms }>` re-reads a file only when the matched file changes; statuses re-fetch every run (one chunked call for the library).
- **Generation guard** — checked before each `updateVideoComprehension` and before the final emit.
- **No-write → no-emit** — a run that writes nothing does not call `setLibrary`; with ≥1 write it emits once. Two runs converge: run N writes, run N+1 finds nothing → stops (M5).
- **Skip-unchanged writes** — IDB write only when `{coverage,band,newTerms,subtitleFilename}` differs.
- **Video deleted mid-run** — `updateVideoComprehension` `get`s fresh; absent → skip (no resurrection).
- **Sole subtitle auto-pair** — mirrors playback's fallback (m11).

## 4. Triggers

`useLibraryScores` runs the pipeline:

1. On mount and whenever `library`/`subtitlesLibrary`/`subtitleFileMap` change.
2. On `onWordStatusChanged` **and** `onWordStatusRemoved`, filtered by `languageMatches('en', e.langCode)` (m8, m9) — debounced **400ms trailing with 1500ms max-delay** (existing `MAX_DELAY_MS` convention, m19). Status legs reuse the token cache: one status fetch + `computeStats` per video.
3. **`startWordStatusCrossTabRelay()` starts in `main.tsx`** (M3) — extension pages receive `tabs.sendMessage` to their own tab, so marks on other tabs rescore the library. Currently absent → cross-tab marks never arrived.
4. On unmount → generation bump; in-flight writes abort at the next generation check.

## 5. Sort

`SortBy` gains `'fit'` (`features/local-player/logic/librarySort.ts` + `LibrarySort` in `useLocalPlayerStore`):

- `VideoEntry` gains `comprehension?: { coverage: number }` (structural — `VideoRecord` satisfies it).
- `fitDistance(coverage) = |coverage − TARGET|`, `TARGET = COMPREHENSION_BAND_MIN.media.comfortable` — export `BAND_MIN` as `COMPREHENSION_BAND_MIN` from `comprehensionScore.ts` + tokenize barrel (SSOT).
- Comparator `compareFit`: scored first, `fitDistance` asc → tie: lower coverage first (deeper i+1) → `compareRecent` fallback. Unscored videos sort last among themselves by `compareRecent`.
- `SORT_OPTIONS` gains `{ value: 'fit', label: 'Best fit (i+1)' }` — hardcoded English matching existing sibling labels (local-player UI is English-only by convention).

## 6. UI

- `LibraryView`: pass-through — sorting flows via `sortLibrary` + footer `Select`.
- `LibraryCard`: `.meta` row gains `<ComprehensionBadge size="xs" stats={statsFromRecord(video.comprehension)} />` iff `comprehension` exists (`stats` rebuilt with real `newTerms`; token-count fields 0 — badge renders coverage + title only). Absent → no badge, no placeholder.
- A11y: badge is text + `title`, non-interactive; `Select` unchanged.

## 7. Acceptance criteria

- **A1** `fit` orders scored by `|coverage−95|` asc; unscored last; ties → lower coverage → recent.
- **A2** A video with a matched, permission-granted subtitle gets a persisted `comprehension` + badge after the background pass.
- **A3** No match / `'prompt'`-or-`'denied'` handle / unparsable file → unscored: no badge, sorts last, zero console noise.
- **A3b** Post-restart (`queryPermission → 'prompt'`) → scoring pauses for that video; persisted badge still renders; no prompt appears.
- **A4** `fetchTermStatuses` throws or returns empty → abort; persisted scores stay.
- **A5** `WORD_STATUS_SET`/`DELETE` on a term in a scored subtitle (same-page **or another tab**) re-scores/re-sorts within debounce+fetch.
- **A6** Unchanged rerun → zero IDB writes, zero `setLibrary`, zero file re-reads.
- **A7** Mid-run input changes → stale generation aborts remaining writes; final state comes only from the newest run.
- **A8** Badge shows real `newTerms` + `data-band`.
- **A9** Playing a video (`loadVideo`/`persistVideoRecord`/`updateResumePosition`) never erases `comprehension`.
- **A10** Existing sorts and watch/resume flows untouched.

## 8. Edge cases

| Case | Behavior |
|---|---|
| `totalTokens = 0` (music/numeric-only) | Treated unscored — no write; prior value kept (avoids fake 0%/"hard") |
| Subtitle deleted on disk after grant | `getFile()` throws → unscored; persisted badge stays (stale-cache, accepted) |
| `queryPermission → 'prompt'` post-restart | Silent skip until user re-grants via gesture; no `SecurityError` noise |
| Match-set divergence (sub on disk, not in library) | Scoring matches union of record filenames + dir-scan keys; playback parity kept |
| One unreadable `.srt` in a folder | Per-entry catch — other files still resolve (m12) |
| 100+ videos | Sequential + `await` yields; dir scans memoized per dirHandle per run |
| 'vi'/'zh' marks | Filtered by `languageMatches('en', …)` — no wasted runs |
| Stale persisted badge, file never resolvable | Badge keeps last computed value — accepted staleness; documented |

## 9. Out of scope

- Streaming-site libraries (no `mediaLibraryRepository`).
- Re-scoring the currently-playing video (live `mediaScoreSource` chip covers it).
- Manual per-video subtitle-track overrides influencing the score.
- Non-English target languages (LibraryView matching is hardcoded `en`/`vi` today — consistent, m17).
- Cross-device sync; recommendations outside the library.

## 10. Test plan

- **Pure** (`libraryFit.test.ts`): distance ordering, scored/unscored partition, tiebreaks, `'fit'` registration.
- **Service** (`libraryScoreService.test.ts`): stubbed match/parse/permission/status deps — persist path, skip paths, fail-closed (throw + empty), skip-unchanged, generation abort mid-writes, no-write→no-emit, token-cache reuse, sole-sub rule, dir-scan memo, deleted-video skip.
- **Repo** (`mediaLibraryRepository.test.ts`): `updateVideoComprehension` merge; `persistVideoRecord` preserves `comprehension`.
- **UI** (`LibraryView`/`LibraryCard` tests): `'fit'` option; badge iff `comprehension` exists.
- **Hook**: debounced rescore on status events; cross-tab relay started; unmount cancels.
- **Real-Chrome smoke** (`tmp/i1-content-queue/`): drop two video+srt pairs → badges → `fit` ordering → `WORD_STATUS_SET` re-sorts → reload → persisted badges survive, scoring resumes from session fileMap/dirHandle grant. Required before `shipped`.

## 11. Docs & gates

- `npm run typecheck && npm run lint && npm run test:unit && npm run build` + deep-import/feature-cycle guards.
- `docs/2-architechture-system.md` — repository (new field + helpers), `librarySort` (`'fit'`), new service/hook/logic rows, test row.
- `docs/0-wiki.md` — spec/intent index + changelog on ship.
