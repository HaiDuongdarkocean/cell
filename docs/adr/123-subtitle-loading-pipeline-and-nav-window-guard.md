# ADR-123: Subtitle Loading Pipeline and Navigation-Window Guard

**Date:** 2026-10-16
**Status:** Accepted

## Context

Subtitles can reach the extension through several independent channels.
Historically each was added ad-hoc, so fixing one channel has silently broken
another (YouTube SPA nav wiped loaded cues; kisskh's caption list was never
imported). This ADR records every channel, the trust boundaries between them,
and the invariant that prevents a later channel from destroying an earlier
one's work.

## Load channels (all must stay)

1. **Network response interception** — `chrome.webRequest` in the background
   watches every request; subtitle-file URLs (`SUBTITLE_PATTERN`) and listing
   URLs (`setListingMatcher` → `resolveListing`) feed
   `networkInterceptor.addDetectedSubtitles` / the discovery pipeline.
   Covers every site without page scripting. Cannot read response bodies.

2. **`window.fetch` patch (MAIN world)** — `fetchInterceptor.iife.ts` patches
   `window.fetch` at `document_start`. Emits `__DETECTED_SUBTITLE_FETCH` for
   subtitle files and `__Tihoka_SUBTITLE_DISCOVERY` `network-response` signals
   carrying a bounded body clone for listing/HLS fetches. Required for signed
   one-time-token listings that cannot be replayed (lookmovie hash, kisskh
   `kkey`, videasy seed) and for bodies served by the page's own SW cache.

3. **`XMLHttpRequest` patch (MAIN world)** — same file patches
   `XMLHttpRequest.prototype.open/send`. Sites that fetch listings over XHR
   (kisskh `/api/Sub/<epId>`) otherwise produce no `network-response` signal —
   webRequest sees the request but not the body, and replaying a signed URL
   returns 403. Both patches must stay in place; removing either regresses a
   whole class of sites.

4. **Page scan** — `mediaScan` reports `<track>`/`<video>` sources via
   `PAGE_SCAN_RESULT`. Catches DOM-visible tracks but cannot read `blob:`
   sources.

5. **Site-specific MAIN-world parsers** — `youtube-main-world.iife.ts`
   (InnerTube `captionTracks`), `iqiyi`, `netflix` IIFEs post
   `__YT_DETECTED_SUBTITLES`-style signals. Required where the player keeps
   the list in JS state, not the DOM.

6. **Player-state / frame-source / document-html signals** — cross-origin
   embed frames announce their location; adapters (`stremio`, `onzload`,
   `peachify`, `opensubtitles`, `lookmovie`, `broodingmovies`, `cinesrc`,
   `kisskh`, HLS) convert listings into `DetectedSubtitle` candidates in the
   background pipeline.

All observation signals cross the same trust boundary:
`subtitleDiscoveryPayloadSchema` (zod) validates shape and size in the
isolated content script, `subtitleBridges` verifies `event.origin` is a
resolvable http(s) origin, and `messageBus.handleMessage` re-injects
`tabId`/`frameId` from `sender` — page-supplied values are never trusted.

## Inventory and selection

`networkInterceptor` owns the per-tab inventory (`byUrl`/`byId` indexes).
`pushAutoLoadSubtitles` runs on every media notification and pushes
`AUTO_LOAD_SUBTITLES` with `targetMatches`/`nativeMatches` to every frame,
filtered by the active language profile. A null push clears the overlay.

## Navigation clears and the freshness invariant

Tab state is cleared on: full reload (`tabs.onUpdated` loading), SPA
`history.pushState` (`webNavigation.onHistoryStateUpdated` when
`isMediaRelevantUrlChange`), `VIDEO_EPISODE_CHANGED`, `PAGE_SCAN_RESULT` with
a changed document URL, and `DETECTED_SUBTITLES` with zero tracks.

Invariant: **a clear must not wipe subtitles detected inside the nav window
(±5 s, same wall clock).** New-episode detection routinely lands before the
URL-flip event (kisskh fires its listing ~300 ms before `pushState`; YouTube
InnerTube responds ~2 s before `video.src` flips). Violations observed:

- `VIDEO_EPISODE_CHANGED` stored the media `blob:` URL into `lastPageUrl`,
  which `PAGE_SCAN_RESULT` then read as a document-URL change and wiped the
  fresh listing. Media URLs must never be written to the document-URL field.
- The YouTube `episodeWatcher` source-poll treated MSE `blob:` rotation as an
  episode change. `blob:` src changes are ignored; element replacement still
  reports but the freshness window protects real detections.
- `onHistoryStateUpdated` cleared unconditionally.

All nav-clear call sites use `clearTabStateKeepingFreshSubtitles`, which
preserves subtitles with `detectedAt >= eventTime - 5 s` and re-saves session
media.

## Guardrails for future changes

- A new detection channel must emit through the validated signal/pipeline,
  not write directly to `networkInterceptor` from the page.
- A new clear point must use `clearTabStateKeepingFreshSubtitles` (or prove
  detection cannot precede it).
- A new listing site belongs in a `JsonListingProfile`/`SubtitleDiscoveryAdapter`
  entry, not a branch in `networkInterceptor`.
- Never replay a signed listing URL as a substitute for the captured body.
- Never treat `blob:` URLs as episode identity.
