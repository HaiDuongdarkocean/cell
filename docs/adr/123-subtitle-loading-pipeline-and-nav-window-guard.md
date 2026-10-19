# ADR-123: Subtitle Loading Pipeline — Channel Map and Invariants

**Date:** 2026-10-16
**Status:** Accepted

## Context

Subtitles reach the extension through many independent channels. Each was
added for a class of sites that another channel cannot reach. Removing or
"cleaning up" one silently regresses sites (YouTube SPA nav wiped loaded
cues; kisskh's caption list was never imported because it is fetched via
XHR). This ADR is the complete map of every load path, what it covers, and
what breaks if it is removed.

## Inventory model

`networkInterceptor` owns the per-tab inventory (`subtitlesByTab` with
`byUrl`/`byId` indexes). Every channel writes into it —
`handleRequest` (webRequest-style `NetworkRequest`) or
`addDetectedSubtitles` (pre-built `DetectedSubtitle`). Dedup is by URL per
tab. `notifyListeners` → `wireEvents.onMediaDetected` →
`pushAutoLoadSubtitles` → `AUTO_LOAD_SUBTITLES` (with
`targetMatches`/`nativeMatches`) to every frame of the tab. A null push
clears the overlay. Content answers `SUBTITLE_CUES_LOADED`.

Persistence: `saveSessionMedia` → `chrome.storage.session` →
`loadSessionMedia`/`restoreMedia` on SW restart. Session is a mirror of the
in-memory store — it is saved at specific call sites, not on every change.

## Discovery channels (all must stay)

| # | Channel | Entry point | Covers | Breaks if removed |
|---|---------|-------------|--------|-------------------|
| 1 | `chrome.webRequest` URL patterns | `networkInterceptor.handleRequest` + `detectSubtitle` | Every site; subtitle-file URLs (.srt/.vtt/.ass, `/subtitles/` paths) | Baseline detection everywhere |
| 2 | webRequest listing matcher | `setListingMatcher` → `onListingDetected` → `subtitleDiscovery.resolveListing` | Listing APIs that are replayable | Non-signed JSON listings never resolve |
| 3 | `window.fetch` patch (MAIN world) | `fetchInterceptor.iife.ts` → `__DETECTED_SUBTITLE_FETCH` + `__Tihoka_SUBTITLE_DISCOVERY` | Signed one-time listings (lookmovie hash, kisskh `kkey`, videasy seed); bodies behind page-SW cache | Signed listings → 403 on replay → 0 candidates |
| 4 | `XMLHttpRequest` patch (MAIN world) | same file | Sites that fetch listings over XHR (kisskh `/api/Sub/<epId>`) | kisskh: only the one active subtitle |
| 5 | Page DOM scan | `mediaScan` → `PAGE_SCAN_RESULT` → `mediaDetection.ts` handler | `<track>`/`<video>`/`source` elements, `<a>` subtitle links | Track-visible subs; also drives `lastPageUrl` nav detection |
| 6 | Generic MAIN-world player-state poller | `subtitleDiscovery-main-world.iife.ts` | Player globals (`the_subtitles`, `playerjsSubtitle`, `subtitleTracks` — noxx, MyAsianTV, vidrift); also fetches `blob:` `<track>` bodies the isolated world cannot read | Encrypted/blob player subs (OnzLoad) |
| 7 | YouTube MAIN-world | `youtube-main-world.iife.ts` → `__YT_DETECTED_SUBTITLES` → `DETECTED_SUBTITLES` → `detectionDispatch.ts` | InnerTube `captionTracks`, incl. ASR | All YouTube subtitles |
| 8 | Site IIFEs | `iqiyi-main-world.iife.ts`, `netflix-main-world.iife.ts` | Provider-specific player APIs | Those providers |
| 9 | External search | `SEARCH_SUBTITLES` handler (SubDL → OpenSubtitles fallback) | User-initiated search when no tracks found | Manual search UI |
| 10 | Manual/ASR | Import file; Generate native | User file import; ASR generation | Import/Generate features |

Signal kinds flowing through the shared pipeline (`SUBTITLE_DISCOVERY_SIGNAL`
→ `subtitleDiscovery.ts` → `SubtitleDiscoveryService.processSignal`):
`network-response`, `frame-source`, `player-state`, `document-html`,
`hls-playlist`. Adapters live in
`features/detection/subtitleDiscovery/adapters/` as profile entries
(`kisskh`, `lookmovie`, `broodingmovies`, `peachify`, `opensubtitles`,
`onzload`, `cinesrc`, `stremio`, HLS, encrypted). New sites belong in a
profile/adapter — never a branch inside `networkInterceptor`.

## Trust boundaries

- `subtitleSignalSchema` / `subtitleDiscoveryPayloadSchema` (zod) validate
  shape and cap body sizes in the isolated content script.
- `subtitleBridges` verifies `event.origin` is a resolvable http(s) origin
  before relaying page posts.
- `messageBus.handleMessage` re-injects `tabId`/`frameId` from `sender` —
  page-supplied values are never trusted.
- `normalizeCandidate` rejects non-http(s) candidate URLs (`blob:`,
  `data:`); unresolved candidates (encrypted payloads, metadata-only) keep
  `status: 'unresolved'` and never become playable `DetectedSubtitle`s.
- `detectSubtitle` `NON_SUBTITLE_KEYWORDS` rejects chapter/thumbnail VTT.

## Nav clears and the freshness invariant

Tab state is cleared at:

- `tabs.onUpdated` status `loading` — full reload (`clearTabState`)
- `webNavigation.onHistoryStateUpdated` with `isMediaRelevantUrlChange` —
  SPA `pushState` (`clearTabStateKeepingFreshSubtitles`)
- `VIDEO_EPISODE_CHANGED` — in-page episode switch (fresh-window guard)
- `PAGE_SCAN_RESULT` with changed document `pageUrl`
  (`clearTabStateKeepingFreshSubtitles`)
- `DETECTED_SUBTITLES` with zero tracks — real "no subs" page
- `clearTab` also deletes `lastPageUrlByTab` and fires `onTabCleared` →
  pipeline `clearTab` (dedup reset)

**Invariant: a clear must not wipe subtitles detected inside the nav window
(±5 s, same wall clock).** New-episode detection routinely lands before the
URL-flip event: kisskh fires its listing ~300 ms before `pushState`; YouTube
InnerTube responds ~2 s before `video.src` flips.

Violations observed and fixed:

- `VIDEO_EPISODE_CHANGED` stored the media `blob:` URL into `lastPageUrl`
  (a document-URL field); every later `PAGE_SCAN_RESULT` read it as a nav
  and wiped the fresh listing. Media URLs must never enter `lastPageUrl`.
- `episodeWatcher`'s source poll treated MSE `blob:` rotation as an episode
  change on YouTube; `blob:` src changes are ignored.
- Element-replacement `VIDEO_EPISODE_CHANGED` is still legit (Angular
  two-phase video mounts) — the freshness window absorbs it.

## Editing checklist

Before touching this pipeline, check:

- Changing a signal shape → update the zod schema AND every
  producer/consumer in the same commit (`messageBus` schema map,
  `subtitleBridges`, adapters).
- Changing clear semantics → use `clearTabStateKeepingFreshSubtitles`, and
  never write media/blob URLs into `lastPageUrl`.
- Adding a site → new adapter/profile + a replay test with a captured real
  body (see `adapters/kisskhListing.test.ts`), not a regex in
  `networkInterceptor`.
- Never substitute a replayed signed URL for the captured body — signed
  tokens are single-use.
- `window.fetch` AND `XMLHttpRequest` must both stay patched; players mix
  them arbitrarily.
- Verify by evidence level: DOM/UI list visible ≠ extension inventory —
  confirm via badge count / `session_media` / `targetMatches` count
  (`chrome.runtime.sendMessage` from the SW does NOT reach its own
  handlers, so self-sends always return empty).
