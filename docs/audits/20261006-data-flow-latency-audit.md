# Audit — Data-flow latency (<3s response budget)

Date: 2026-10-06 · Owner: devin-1-1791342575 · Scope: every path where user-visible data flows (subtitle ingest, lookup, audio, media prefill, dictionary sync, Anki status sync, word-status writes, local-player persistence, message handlers).

## Method

Measure → identify → fix → verify → guard. Static scan for sequential-I/O hazards (`await` in loop over independent work, per-item storage/IDB calls, per-item network calls) produced ~300 candidates; triaged by whether a user waits on the result and by payload size. CPU paths measured with a movie-scale harness (1500 cues ≈ 12k tokens) before touching anything.

## Measured baseline (CPU paths — confirmed NOT the bottleneck)

| Path | Cost at 1500 cues |
|---|---|
| `parseSrt` + `tokenizeTextBlock` per cue | ~50ms total |
| `createCueListTokenMap` | ~14ms |
| `applyCueListTokenStatuses` (bulk) | ~2ms |
| `applyCueListTokenStatus` ×30 marks | ~19ms |

Guard: `tests/unit/perfAuditBench.test.ts` — budgets at ~10× headroom so only real algorithmic regressions fail.

## Bottlenecks found & fixed (all sequential-I/O, verified by code path, not guessed)

| # | Path | Before | After |
|---|---|---|---|
| 1 | `statusSyncService.flushWriteBackQueue` — Anki write-back | 1 `cardsInfo` roundtrip per queued card (N cards → N serial RTTs) | 1 batched `cardsInfo` for all cardIds, per-card fallback preserved |
| 2 | `statusSyncService` status apply + SRS review seed | `setWordStatusFromSync` per term = 1 IDB tx per term (5k terms → 5k serial txs) | new `setWordStatusesFromSync` — one transaction for the whole batch |
| 3 | `communityAudioService.searchCommonsAudio` | up to 10 Commons `imageinfo` fetches awaited serially (≈RTT×10) | `Promise.all` over the ≤10 fetches; ordering + per-item failure preserved |
| 4 | `lookupOrchestrator` resource probe | per-resource `findDictionaryByResource` awaited serially on first hover | `Promise.all` across resources, merged into same term set; cache unchanged |
| 5 | `prefillMerge.fetchMissingMedia` / `fetchMediaList` + `cardCreatorBridge` sentence audio | per-URL serial fetch (M media → M serial RTTs before card dialog prefills) | `Promise.all`; warn-and-filter failure semantics unchanged |
| 6 | `dictLocalSource` sync pull | fetch blob → import → fetch next blob (network idle during parse) | depth-1 prefetch: next blob downloads while current imports; commits stay sequential |
| 7 | `ResourcesPanel.handleFiles` import | per-file detect + signature serial | detection/signature phase `Promise.all`, imports still sequential per existing contract |
| 8 | `useVideoLibrary` persist | per-file `persistSubtitleRecord`/`persistVideoRecord` serial IDB | `Promise.all`; `refreshLibrary` still runs after all settle |

## Confirmed already-clean (no change)

- Web tokenize path batches metadata: `getWordStatuses`/`getFrequencyEntries` chunked 1000/request, `Promise.allSettled` across categories (`webTokenizeController`, `cueListTokens`).
- `tokenizeScheduler` priority + idle/frame scheduling — no paint blocking.
- Subtitle discovery probes adapters in parallel; auto-load fetches target+native `Promise.all`.
- `mediaFilePicker` parallel file reads; `fetchWithTimeout` bounds every offscreen fetch (10s default).
- `wordStatus` message handler resolves status/frequency in bulk — per-user write is already 1 tx.

## Verification

- `npm run typecheck` ✓ · `npm run lint` ✓ (0 errors) · `npm run test:unit` ✓ 683 suites / 8088 tests · `npm run build` ✓
- Regression caught & fixed during verify: initial `dictLocalSource` pending-filter inverted the import condition (7 test failures) — corrected to `signature === contentHash`, `dictLocalSource.test.ts` 21/21 green.
- New tests: 4 cases for `setWordStatusesFromSync` (batch write, empty, no-downgrade, newest-sourceAt wins) in `wordStatusStore.test.ts`.
- Browser E2E skipped: no UI/rendering path changed — all edits are async orchestration inside services; logic covered by unit tests, bundling by build.

## Notes

- The <3s budget is now dominated by external latency (AnkiConnect, Commons, Drive) — bounded and parallelized rather than multiplied.
- `getTermFromCard` de-asynced (pure local field work — no reason to pay a microtask per card).
