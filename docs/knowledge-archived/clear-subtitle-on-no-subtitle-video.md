# Clear previous video's subtitles when the new video has none

> **Principle**: [Signal absence is not absence of signal](principles.md#signal-absence-is-not-absence-of-signal)

## Problem

SPA-navigating from a YouTube video WITH subtitles to one WITHOUT left the previous video's overlay (cues + nav cluster) visible on the new video. The subtitle only cleared on a hard reload.

## Root causes

Three layers each silently skipped the clear, so no "video changed, no subtitles" signal ever reached the overlay:

1. **MAIN-world detector** (`youtube-main-world.iife.ts`) gated the `__YT_DETECTED_SUBTITLES` post on `tracks.length > 0`. A 0-track video sent no message — the background never learned the video had changed.
2. **Background `DETECTED_SUBTITLES` handler** (`youtubeDetection.ts`) returned early on 0 tracks (`subtitles.length === 0 → return { success: true }`) without clearing the tab, broadcasting a media update, or pushing `AUTO_LOAD_SUBTITLES`.
3. **Overlay `AUTO_LOAD_SUBTITLES` handler** (`contentScriptController.ts`) only showed a "No subtitles detected" toast when `!target && !native` — it never called `clearCues`, so the previous video's cues persisted in the overlay + nav cluster + offset controller.

Individually each guard looked reasonable ("don't store empty tracks", "don't push null subtitles"). Composed, they formed a silent dead path: 0 tracks → no post → no clear → no clearCues → stale overlay.

## Fix

One block per layer (ponytail rung 6):

1. MAIN world posts `__YT_DETECTED_SUBTITLES` on every successful detect — including 0 tracks. `lastDetectedTracks` cache stays gated on >0 (handshake re-post is only meaningful for videos with tracks).
2. Background 0-tracks path clears the tab, broadcasts an empty `DETECTED_MEDIA_UPDATE`, and sends `AUTO_LOAD_SUBTITLES` with null target+native.
3. Overlay null target+native calls `controller.clearCues()`, resets the offset controller, and updates the nav cluster with empty cues — in addition to the existing toast.

## Key insight

"0 tracks" is not "no information" — it is the positive signal "this video has no subtitles". When a pipeline has multiple guards that each treat empty as a no-op, the empty case becomes a silent dead path: every layer optimises for "don't do redundant work on empty" and collectively they ensure nothing ever happens on empty. For stateful UI (overlay showing the previous video's cues), the empty case MUST be handled as an explicit clear signal — post the empty result, clear the tab, broadcast the empty update, clear the overlay. Empty is a value, not the absence of a value.

This is the dual of `detect-precondition-gating.md` (early commit blocks retry) and `url-first-spa-nav-stale-player-response.md` (early read from stale cache): here the "early" mistake is the early return — each layer returns early on empty, assuming someone else handles it, but nobody does.

## Verification

Browser verify on Edge 140:

Before fix:
- Video 1 (`nLnp0tpZ0ok`, 14 tracks, hard nav): overlay shows cues ✓.
- SPA nav to video 2 (`G5kH8JQs7LY`, 0 tracks): `ytDebug.lastTrackCount: 0`, `targetText: "♪ ♪"` (stale video 1 cues), `postTime` stale (no new post). Overlay persisted.

After fix (commit 17cbcf4):
- Video 1 (hard nav): 14 tracks, overlay shows cues ✓.
- SPA nav to video 2 (`t7iDChFw4wE`, 1 track): `postTime: 29001` (new post — layer 1 fix), console msgid=799 `posting __YT_DETECTED_SUBTITLES`, msgid=800 content-script received, msgid=802 `AUTO_LOAD_SUBTITLES received`, msgid=807 `onPanelRender` with video 2 cues. Subtitle video 2 loaded, no stale video 1 cues.
- Layer 2+4 (0 tracks clear path) verified via code trace + YouTube unit tests (42 pass).

Tests: 42 YouTube unit tests pass. Build OK.
