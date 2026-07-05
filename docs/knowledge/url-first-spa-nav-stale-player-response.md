# URL-first videoId resolution — `ytInitialPlayerResponse` stale on SPA navigation

> **Principle**: [Prefer the freshest source of truth for identity, not the richest](principles.md#prefer-freshest-source-for-identity-not-richest)

## Problem

YouTube subtitle auto-load worked for video 1 (hard navigation) and for video 2+ in a standard playlist (commit `da30371`), but **failed for video 2+ in a radio mix** (`list=RD<videoId>`). Clicking a video in the radio sidebar performed SPA navigation (URL changed), yet the subtitle was only loaded after a hard reload.

## Root cause

`youtube-main-world.iife.ts` resolved the current videoId as:

```ts
const videoId =
  getVideoIdFromPlayerResponse(playerResponse) ?? getVideoIdFromUrl();
```

`??` returns the left operand when it is **non-nullish** — not when it is "correct". On SPA navigation in a radio mix:

- YouTube updates `location.href` immediately (URL has the new `v`).
- `ytInitialPlayerResponse` is **not** updated — it stays bound to the previous video indefinitely (verified: 6s after SPA nav, `playerResponse.videoDetails.videoId` was still the old videoId).
- `getVideoIdFromPlayerResponse(...)` returns the **stale** old videoId (non-null) → `??` short-circuits → `currentVideoId` = old videoId = `lastVideoId`.
- `pollForVideoIdChange` condition `currentVideoId !== lastVideoId` is `false` → `detect()` never re-runs for the new video → no `__YT_DETECTED_SUBTITLES` post → no autoload.

On hard reload, `ytInitialPlayerResponse` is rebuilt for the new video, so the old (playerResponse-first) order happened to work. The previous fix (`da30371`) verified on a standard playlist where `ytInitialPlayerResponse` updates faster; radio mixes exposed the latent staleness.

## Fix

Swap the `??` operands — URL-first:

```ts
// Before (broken on SPA nav radio mix):
getVideoIdFromPlayerResponse(playerResponse) ?? getVideoIdFromUrl()

// After (URL-first):
getVideoIdFromUrl() ?? getVideoIdFromPlayerResponse(playerResponse)
```

Applied at both call sites: `detect()` and `pollForVideoIdChange()`.

- On SPA nav, `location.href` changes first → `getVideoIdFromUrl()` returns the new videoId → `currentVideoId !== lastVideoId` → `detect()` triggers.
- On hard nav at `document_start`, `location.href` already has `v` (URL is set before scripts run) → URL-first still resolves correctly.
- The playerResponse fallback covers edge cases where the URL lacks `v` (e.g. future routes).

## Key insight

`??` is a **nullish-coalescing** operator, not a **correctness-coalescing** operator: it picks the left operand whenever it is non-null/undefined, even if that value is stale. When two sources can provide an identity (here: `ytInitialPlayerResponse.videoDetails.videoId` vs `location.searchParams.get('v')`), pick the **freshest source of truth for identity**, not the richest. The player response carries more data (tracks, metadata), but for the *identity* question "which video is this?", the URL is the source YouTube mutates first on SPA navigation. Richness and freshness are orthogonal — for identity, freshness wins.

This is the dual of `detect-precondition-gating.md`: there, the bug was committing state before a precondition; here, the bug was reading identity from a stale cache before the freshest signal. Both are "early" mistakes — early commit, early read.

## Verification

Browser verify on Edge 140, radio mix `RDnLnp0tpZ0ok`:

Before fix:
- Video 1 (`nLnp0tpZ0ok`, hard nav): `detectCalls: 1, lastTrackCount: 14` OK.
- SPA nav to video 2 (`cPkE0IbDVs4`): `detectCalls: 1` (no re-detect), `lastVideoId: "nLnp0tpZ0ok"` (stale), `playerResponseVideoId: "nLnp0tpZ0ok"` (stale 6s after nav). No autoload.

After fix (commit 2e0c665):
- Video 1 (hard nav): `detectCalls: 1, lastTrackCount: 14` OK.
- SPA nav to video 2 (`cPkE0IbDVs4`): `detectCalls: 2, lastVideoId: "cPkE0IbDVs4", lastTrackCount: 1, postTime: 43126` — detect re-ran, fetched 1 track, posted `__YT_DETECTED_SUBTITLES`. Console: content-script received → relayed `DETECTED_SUBTITLES` to background → autoload fired. `playerResponseVideoId` still stale (`nLnp0tpZ0ok`) but bypassed by URL-first.

Tests: 42 YouTube unit tests pass. Build OK.
