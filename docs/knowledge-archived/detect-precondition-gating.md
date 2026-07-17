# Detect early commit blocks retry — gate state commit on precondition

> **Principle**: [Commit state only after precondition confirmed (gate retry)](principles.md#commit-state-only-after-precondition-confirmed-gate-retry)

## Problem

YouTube MAIN world script (`youtube-main-world.iife.ts`) failed to detect subtitles on some page loads with `lastError: "no API key"`. Once the error occurred, detect never retried even after the API key became available in the HTML — `detectCalls` stayed at 1, `lastTrackCount: -1`, `postTime: -1`.

## Root causes

- `detect()` fetched `videoId` from `ytInitialPlayerResponse`, then **cached `lastVideoId = videoId` BEFORE checking `apiKey`**:
  ```ts
  const videoId = getVideoIdFromPlayerResponse(playerResponse) ?? getVideoIdFromUrl();
  if (!videoId || videoId === lastVideoId) return;
  lastVideoId = videoId;  // ← commit before precondition check
  const apiKey = extractInnertubeApiKey(document.documentElement.innerHTML);
  if (!apiKey) { debug.lastError = 'no API key'; return; }
  ```
- `pollForVideoIdChange` polls until `currentVideoId !== lastVideoId` → triggers `detect()`. But once `lastVideoId` is committed, the poll condition `currentVideoId !== lastVideoId` is false for the same video → **no retry**.
- YouTube injects `INNERTUBE_API_KEY` into the HTML **after initial paint** (via `ytcfg`). At `document_start`, `ytInitialPlayerResponse` may be available (videoId resolvable) but the HTML may not yet contain the API key → detect runs, fails with "no API key", commits `lastVideoId`, and never retries.
- The `yt-navigate-finish` SPA trigger also calls `pollForVideoIdChange` — but for the same video, the poll sees no videoId change → no detect retry.

## Fix

`src/entrypoints/content/youtube-main-world.iife.ts`:
1. **Move `lastVideoId = videoId` AFTER the `apiKey` check** — only commit when the precondition (API key available) is confirmed. If apiKey is missing, return early WITHOUT committing → poll continues to retry.
2. **Gate `pollForVideoIdChange` on apiKey availability too** — poll only triggers `detect()` when BOTH `currentVideoId !== lastVideoId` AND `extractInnertubeApiKey(html)` returns non-null. This prevents wasting a detect attempt on a page that hasn't finished rendering.
3. **Extend initial poll timeout 5s → 10s** — covers slow first paint + API key injection + reinject after SPA nav.

```ts
// Before (broken):
lastVideoId = videoId;  // commit before precondition
const apiKey = extractInnertubeApiKey(...);
if (!apiKey) { return; }  // no retry possible

// After (fixed):
const apiKey = extractInnertubeApiKey(...);
if (!apiKey) { return; }  // no commit → poll retries
lastVideoId = videoId;    // commit only after precondition confirmed
```

## Key insight

When a function has a precondition (e.g., "API key must be available") and a retry mechanism that keys off state (e.g., "only re-run if videoId changed"), **commit the state only after the precondition is confirmed**. Committing state before the precondition check blocks retry — the retry condition (`videoId !== lastVideoId`) becomes permanently false, so the precondition failure is never re-evaluated even after the precondition becomes true. This is a form of "early commit" anti-pattern: the function claims to have "processed" this videoId (by caching it) when it actually failed, preventing future attempts.

## Verification

Browser verify on Chrome for Testing 150:

Before fix:
- `ytDebug: { detectCalls: 1, lastVideoId: "ZXNrz72k1ew", lastError: "no API key", lastTrackCount: -1, postTime: -1 }`
- `hasApiKey: true` (API key IS in the HTML, but detect already gave up)
- Re-triggering `yt-navigate-finish` does nothing — `detectCalls` stays 1.

After fix (commit da30371):
- `ytDebug: { detectCalls: 1, lastVideoId: "ZXNrz72k1ew", lastError: null, lastTrackCount: 1, postTime: 659 }`
- Video 1: 1 track detected, posted, auto-loaded ✓
- Video 2 (nLnp0tpZ0ok): `lastTrackCount: 14, lastError: null, postTime: 929` ✓

Tests: 42 YouTube unit tests pass. tsc PASS, build PASS.
