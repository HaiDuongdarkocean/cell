# Proactive native-event clear vs cross-context round-trip (YouTube SPA nav subtitle persistence)

> **Principle**: [Proactive clear on native event > cross-context round-trip](principles.md#proactive-clear-on-native-event--cross-context-round-trip)

## Problem

Even after `clear-subtitle-on-no-subtitle-video.md` fixed the 0-track dead path, the overlay still persisted with video #1's cues when SPA-navigating to a video #2 that had no subtitles. Reproduced on Edge 140:

- Video 1 (`h3M00JI8Iwo`, TED talk, has subtitles): overlay shows target "And even when we practice health care," + native "Và ngay cả khi chúng ta thực hành chăm sóc sức khỏe,".
- SPA nav to video 2 (`tIgO_Sjh3tQ`): overlay still shows video 1's cues. `yt-navigate-finish` fires (verified via `window.__navLog`), URL changes, but the overlay never clears.

## Root causes

The previous fix (`clear-subtitle-on-no-subtitle-video.md`) made the clear path *possible* by routing a 0-track signal through the full background round-trip:

```
MAIN-world detect() → postMessage __YT_DETECTED_SUBTITLES (0 tracks)
  → content-script relays DETECTED_SUBTITLES
    → background youtubeDetection.ts: clearTab + send AUTO_LOAD_SUBTITLES null
      → content-script AUTO_LOAD_SUBTITLES handler: clearCues
```

This round-trip is **fragile** — any break silently leaves the overlay stale:

1. **MAIN-world `detect()` may not fire on SPA nav.** `pollForVideoIdChange(2000)` polls every 100ms for 2s after `yt-navigate-finish`. If `ytInitialPlayerResponse` is not updated within 2s (slow SPA, late script injection), the poll times out and `detect()` never runs → no post → no clear.
2. **InnerTube ANDROID fetch may fail.** `fetchCaptionTracksViaInnerTube` swallows errors and returns `[]`. A network blip, YouTube rate-limit, or ANDROID client block → `tracks = []` posted, but if the post itself is delayed past the overlay's render frame, the user sees stale cues in the interim.
3. **Service worker may restart.** MV3 SW is evicted after 30s idle. If the SW is mid-restart when `DETECTED_SUBTITLES` arrives, the message is dropped → background never clears → no `AUTO_LOAD_SUBTITLES null` → overlay stale.
4. **Content-script had no proactive clear.** The `AUTO_LOAD_SUBTITLES` handler at `contentScriptController.ts:766` only cleared inside the message handler. If the message never arrives (cases 1-3), the overlay holds the previous video's cues indefinitely — YouTube keeps the same `<video>` element across SPA nav, so the overlay is not re-initialised.

The content-script trusted the background to tell it "the video changed, clear yourself". But the background's signal depends on a MAIN-world → ISOLATED-world → SW → ISOLATED-world chain with multiple failure modes. None of those failures is an error — they are all silent skips.

## Fix

Ponytail rung 4 (native platform feature): register a proactive listener in `initContentScriptController` for the same native SPA-nav events the MAIN-world already listens to. When the URL changes, clear the overlay locally — do not wait for the background round-trip.

`src/features/subtitle/ui/contentScriptController.ts` (after `visibilitychange` listener, before the cleanup return):

```ts
const onSpaNav = (): void => {
  if (lastAutoLoadUrl === undefined || lastAutoLoadUrl === location.href) return;
  blockController?.clearCues();
  offsetController?.loadCues(false);
  latestTargetCues = [];
  translatePrefill?.clear();
  translatePrefill = null;
  lastAutoLoadKey = undefined;
  lastAutoLoadUrl = undefined;
};
window.addEventListener('yt-navigate-finish', onSpaNav);
window.addEventListener('popstate', onSpaNav);
```

Plus matching `removeEventListener` in the returned cleanup function.

~30 lines, 0 new dependencies, 0 new abstractions. Reuses existing `clearCues()`, `loadCues(false)`, `translatePrefill.clear()`. The listener is registered once per `initContentScriptController` call and survives YouTube SPA nav (YouTube swaps DOM, not the `window` object).

## Key insight

A cross-context round-trip (content → MAIN → content → SW → content) is a *request*, not a *guarantee*. Each hop has its own failure mode (poll timeout, fetch error, SW eviction, message drop) and every failure is a silent skip — no error, no retry, no log on the consumer side. When the consequence of a missed signal is stale state visible to the user, the consumer MUST also listen for the native event that triggered the round-trip in the first place (`yt-navigate-finish`, `popstate`) and clear its own state locally. The round-trip becomes the *refill* path (load new subtitles), not the *clear* path. Clear is cheap, local, and synchronous on the native event; refill is expensive, async, and cross-context — they should not share a dependency chain.

This is the dual of `signal-absence-is-not-absence-of-signal` (which fixed the *content* of the round-trip — send 0, not nothing). This fix addresses the *transport* — even when the content is correct, the transport can drop it, so the consumer needs a local fallback keyed off the same native signal the producer used.

## Verification

Browser verify on Edge 140 (2026-07-05):

- `yt-navigate-finish` fires on YouTube SPA nav: hooked `window.addEventListener('yt-navigate-finish', ...)` recording to `window.__navLog`. SPA nav `h3M00JI8Iwo` → `tIgO_Sjh3tQ` produced `{event:'yt-navigate-finish', url:'https://www.youtube.com/watch?v=tIgO_Sjh3tQ', t:1783759236339}`. Page did not reload (hook + log persisted across nav).
- Bug reproduced pre-fix: overlay on `tIgO_Sjh3tQ` showed video 1's target "And even when we practice health care," + native "Và ngay cả khi chúng ta thực hành chăm sóc sức khỏe,".
- `tsc --noEmit` exit 0.
- `jest --selectProjects unit --testPathPatterns subtitleAutoLoad` — 27/27 pass.
- `npm run build` — exit 0, 514ms.

Residual risk (ponytail ceiling): SPA nav that does not change the URL (rare on YouTube — playlist auto-advance changes `v=`, radio mix changes `v=`) will not trigger `yt-navigate-finish` with a URL diff. Upgrade path: `MutationObserver` on `<video>` `src` attribute as a tertiary signal.
