# Auto-download subtitle catch-up (incremental media detection)

> **Principle**: [Separate dedup from catch-up](principles.md#separate-dedup-from-catch-up)

## Problem
Auto-download downloaded the video but NOT subtitles. Root cause: `NetworkInterceptor.onMediaDetected` fires incrementally — the m3u8 is captured first, subtitles arrive later. The first fire (video only) ran `tryAutoDownload`, enqueued the video, and set a per-tab URL guard (`autoDownloadedTabs: Map<tabId, url>`). When subtitles arrived in the second fire, `maybeAutoDownload` saw the guard matched the URL and returned early, so subtitles were never enqueued.

## Fix
- `tryAutoDownload` now takes an optional `alreadyEnqueuedIds: ReadonlySet<string>` and returns `Promise<string[]>` (the media ids it enqueued this call; empty = silent no-op). Selected media whose id is in the set is skipped, so a follow-up call enqueues only newly discovered subtitles without re-downloading the video.
- `BackgroundService.autoDownloadedTabs` changed from `Map<tabId, url>` to `Map<tabId, { url, enqueuedIds: Set<string> }>`.
- `maybeAutoDownload` two branches:
  1. **Same page load** (state.url === tabUrl): call `tryAutoDownload` with `state.enqueuedIds`, add returned ids to the set (subtitle catch-up).
  2. **Fresh page load** (no state or URL changed): call `tryAutoDownload` fresh, store `{ url, enqueuedIds: new Set(newIds) }`.
- Guard is still cleared on `tabs.onUpdated` loading and `tabs.onRemoved`, so navigation to a different episode under the same whitelisted category still auto-downloads fresh.

## Key insight
The URL guard was too coarse — it prevented ALL re-runs for the same page, including the legitimate subtitle catch-up. The fix separates "don't re-download the video" (id-level dedup) from "allow new subtitles to be caught up" (re-run with skip set). `selectBestMedia` is pure and cheap, so re-running it each incremental fire and diffing against enqueued ids is safe.
