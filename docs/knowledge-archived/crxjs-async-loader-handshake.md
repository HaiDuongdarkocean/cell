# CRXJS async loader handshake — document_start not enough on SPA navigation

> **Principle**: [Receiver-announces-readiness handshake for fire-and-forget messages](principles.md#receiver-announces-readiness-handshake-for-fire-and-forget-messages)

## Problem

YouTube subtitle auto-load worked for video 1 (hard navigation) but failed for video 2+ in a playlist (SPA navigation). MAIN world script detected 14 tracks and posted `__YT_DETECTED_SUBTITLES`, but the background service worker never stored them (`bgSubtitleCount` stayed at 1, `bgLastVideoId` did not update).

## Root causes

- `public/manifest.json` content-script entry runs at `document_start` (fix from `content-script-listener-race.md` already applied).
- However, `@crxjs/vite-plugin` wraps the content-script entry in a **dynamic `import()` loader** (`content-script.ts-loader-*.js`). The actual content-script module (with the `window.addEventListener('message')` listener) is loaded asynchronously — listener registration is delayed past `document_start` by the loader's microtask.
- On **hard navigation** (video 1): MAIN world polls for `ytInitialPlayerResponse` (~3-4s) before posting → content-script listener has time to register → pipeline works.
- On **SPA navigation** (video 2+): MAIN world script is **persistent** (not re-injected) and detects the new videoId via `yt-navigate-finish` poll → posts `__YT_DETECTED_SUBTITLES` at ~450-930ms. Content-script is **re-injected** by Chrome on navigation → CRXJS async loader delays listener to ~6000ms+ → **MAIN world posts BEFORE content-script listener registers** → message lost.
- `window.postMessage` is fire-and-forget — no buffering, no replay. Message posted with no listener = lost forever.

## Fix

**Handshake pattern** — receiver announces readiness, sender re-posts last message on receipt.

`src/entrypoints/content/content-script.ts` (ISOLATED, receiver):
- Posts `__YT_CS_READY` via `window.postMessage` immediately when the listener registers (top-level, after `addEventListener('message')`).
- Dedups `__YT_DETECTED_SUBTITLES` by `videoId` (`__YT_LAST_RELAYED_VIDEO_ID`) to avoid double-relay when both the original post AND the handshake re-post arrive.

`src/entrypoints/content/youtube-main-world.iife.ts` (MAIN, sender):
- Caches `lastDetectedTracks` + `lastDetectedVideoId` on every successful detect.
- Listens for `__YT_CS_READY` — on receipt, re-posts `__YT_DETECTED_SUBTITLES` with cached tracks so the late listener receives them.

## Key insight

`document_start` registration is necessary but **not sufficient** when the bundler wraps the content-script in an async dynamic-import loader — the listener registration is delayed past `document_start` by the loader's microtask. When the producer is persistent across navigations (MAIN world script survives SPA nav) and the consumer is re-injected per-navigation (ISOLATED content-script), the producer can post before the consumer's listener registers. A **receiver-announces-readiness handshake** solves this deterministically: the receiver posts a ready signal when its listener registers, and the sender re-posts its last message on receipt. This is timing-independent — no guess about how long the loader takes.

## Verification

Browser verify on Chrome for Testing 150, playlist `RDYQHsXMglC9A`:

Before fix:
- Video 1 (ZXNrz72k1ew): `bgSubtitleCount: 1`, `bgLastVideoId: ZXNrz72k1ew` ✓
- Video 2 (nLnp0tpZ0ok, 14 tracks): `bgSubtitleCount: 1` (no increment), `bgLastVideoId: ZXNrz72k1ew` (no update) ✗
- Timing evidence: MAIN world `postTime: 2443ms` < content-script `csInjectTime: 6172ms` → listener not registered when post arrived.

After fix (commit da30371):
- Video 1: `bgSubtitleCount: 2`, `bgLastVideoId: ZXNrz72k1ew` ✓
- Video 2: `bgSubtitleCount: 3`, `bgLastVideoId: nLnp0tpZ0ok` ✓ (incremented, videoId updated)
- Content-script PING (frameId: 0): `lastRelayedVideoId: nLnp0tpZ0ok` → relay confirmed.

Tests: 42 YouTube unit tests pass. tsc PASS, build PASS.
