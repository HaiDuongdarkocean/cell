# Content-script listener race — message posted before listener registered

> **Principle**: [Register listeners at earliest lifecycle before producers post](principles.md#register-listeners-at-earliest-lifecycle-before-producers-post)

## Problem

YouTube subtitle detection (commit 63fb94d) detected subtitles in console (`[youtube-main-world] ANDROID InnerTube returned 2 tracks`) but auto-load never triggered — `AUTO_LOAD_SUBTITLES` message never received by content-script. Browser verify showed `__YT_DETECTED_SUBTITLES` postMessage was posted but no listener caught it.

## Root causes

- `public/manifest.json` content-script entry ran at `document_idle` (default-ish timing — after DOM parsed, ~3-4s after `document_start`).
- `src/entrypoints/content/youtube-main-world.iife.ts` (MAIN world) ran at `document_start` and fetched InnerTube API async (~3-4s after start, once `ytInitialPlayerResponse` available).
- MAIN world posted `__YT_DETECTED_SUBTITLES` via `window.postMessage` at ~3-4s.
- ISOLATED content-script (listener for `__YT_DETECTED_SUBTITLES`) registered listener at `document_idle` — but `document_idle` fires AFTER `document_start` + initial async work. In practice, MAIN world's post arrived before ISOLATED listener was registered → message lost.
- `window.postMessage` is fire-and-forget — no buffering, no retry. If no listener at post time, message is gone.

## Fix

**M5 — content-script `document_start`** (`public/manifest.json`):
- Changed content-script `run_at` from `document_idle` → `document_start`.
- Message listener (no DOM dependency) registers immediately at `document_start` — before MAIN world posts (~3-4s later).
- Page scanning (needs DOM) deferred to `DOMContentLoaded`:
  ```ts
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runPageScan());
  } else {
    runPageScan();
  }
  ```

**Key distinction**: The message listener has NO DOM dependency (only reads `event.data`), so it can register at `document_start`. The page scanner needs `document.body` / `document.querySelectorAll`, so it must wait for `DOMContentLoaded`. Splitting the two by DOM-dependency allows earliest listener registration without breaking DOM-dependent logic.

## Key insight

`window.postMessage` is fire-and-forget — a message posted with no listener is lost forever (no buffering, no replay). When a MAIN world producer posts async (3-4s after `document_start`) and an ISOLATED consumer listens, the consumer MUST register at `document_start` (earliest possible), not `document_idle`. `document_idle` fires after DOM parse (~3-4s) — by then the producer may have already posted. Split logic by DOM dependency: DOM-independent listeners register at `document_start`, DOM-dependent logic waits for `DOMContentLoaded`.

## Verification

Browser verify on `https://www.youtube.com/watch?v=YQHsXMglC9A`:

Before fix (commit 63fb94d):
- Console: `[youtube-main-world] ANDROID InnerTube returned 2 tracks` (msgid 158)
- No `AUTO_LOAD_SUBTITLES received` log → message lost

After fix (commit a9a0ad6):
- Console: `[youtube-main-world] ANDROID InnerTube returned 2 tracks` (msgid 417)
- Console: `[content-script] AUTO_LOAD_SUBTITLES received` (msgid 420) ✓
- Console: `[handleAutoLoadSubtitles] parse results {targetSuccess:true, targetCueCount:139}` (msgid 422) ✓
- Console: `[content-script] onPanelRender {targetCueCount:139}` (msgid 423) ✓

Tests: 42 YouTube tests pass. tsc PASS, build PASS.
