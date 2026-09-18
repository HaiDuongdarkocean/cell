# Intent: download-queue-integrity

> Slug: `download-queue-integrity` · Mode: all · Source: backlog row #14 (internal-audit, `docs/audits/20260916_src-features-entrypoints-shared.md` findings 5+6)
> ui_surface: no
> confidence: high

## Analysis

**The backlog row's stated pain is already fixed in code.** Every named defect was resolved by `308ecb9c` "fix(download): abort-aware queue, session-persisted dedup, parsed-payload bus" (2026-09-17 — one day after the audit that generated this row):

| Backlog claim | Current code |
|---|---|
| `pause()` doesn't pause — items complete as 'done' | Executor receives `AbortSignal` (`downloadQueue.ts:14-17`); `pause()` aborts (:90); settle handler refuses 'done' for `paused`/`cancelled`/`queued` (:246-250). `throwIfCancelled` threads signal through `downloader.ts` → `m3u8Download.ts` → `segmentFetch.ts` |
| Cancel keeps consuming bandwidth | `cancel()` aborts controller (:69); capacity released once, in the settle handler (:260,:286) |
| `activeCount` double-decrement | Single decrement sites only — settle handlers |
| Concurrency cap exceeded | `findNextQueued` excludes controller-held items (:295); `while activeCount < maxConcurrent` |
| `restore()` stalls queued items | `restore()` calls `processNext()` (:147); `setExecutor` also drains (:42) |
| Restart re-enqueues duplicates / loses enqueuedIds | `saveSessionAutoDownloadedTabs`/`loadSessionDownloads` persist `auto` + `items` to `chrome.storage.session` (`helpers.ts:420-456`); `tryAutoDownload` dedups via `enqueuedIds` (:739-740); interrupted downloads restore as `'error'` (:459-464) |
| Navigation vs removal lifecycle misaligned | `onTabUpdated`/`onHistoryStateUpdated` clear media only; `onTabRemoved` clears media + downloads (`wireEvents.ts:325-365`) |

Verification: queue semantics covered by `downloadQueue` unit tests + integration suite (6619 green at verify time).

## Residual follow-ups (recorded, not implemented)

- None blocking found in the named paths.

## Decision

**no-go** — every named defect in the backlog row (pause/cancel semantics, concurrency cap, restore stall, session dedup, lifecycle alignment) was already fixed by 308ecb9c; the remaining delta does not justify an M★5 pipeline slot.

## Acceptance criteria

- n/a — dropped at analyze (pain resolved by 308ecb9c).
