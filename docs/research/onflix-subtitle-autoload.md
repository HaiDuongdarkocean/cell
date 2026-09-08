# Subtitle support research: ONFLIX / playembed.vip

## Input

- **URL (supplied by user):** `https://onflix.lat/xem-phim/dac-vu-kim-tai-khoi-dong/vietsub-sn/vietsub/1`
- **Date/profile:** 2026-09-08 / disposable stealth Chrome clones (`cell-3fbe8475d7cc`, `cell-8c548a989e04`, etc.)
- **Access status:** Page loads, player iframe renders, `.vtt` subtitle files are fetched.
- **User goal:** Detect real subtitle files used by the player, add them to background inventory, preserve language metadata, deliver the selected subtitle to the correct frame, and auto-load it into Cell's subtitle overlay panel.

## Player topology

- **Top frame:** `https://onflix.lat/xem-phim/dac-vu-kim-tai-khoi-dong/vietsub-sn/vietsub/1`
  - Contains a single `<iframe class="w-full h-full absolute inset-0 ...">` pointing at `playembed.vip`.
  - No `<video>` or `<track>` in the top document.
- **Player iframe:** `https://playembed.vip/player?ep_id=<token>&poster=...&title=...&src=sn&next=...`
  - Cross-origin. No direct DOM inspection from the top frame.
  - The player is a Next.js / client-rendered SPA. Server HTML had `initialM3u8` (encrypted) and no `<video>` / `<track>`.
  - The `<video>` element is rendered **inside an open Shadow DOM** (`<media-player>` style custom element). `document.querySelector('video')` from the content script returned `null` because the video was not in the light DOM.
- **Activation:** No play button click was required for the episode to start. The player auto-loads after iframe load.

## Evidence

| Observation | Level | Consequence |
| --- | --- | --- |
| User-supplied ONFLIX URL loads and embeds `playembed.vip` | E0 | Target page/episode preserved. |
| `playembed.vip` iframe `src` present and loaded | E1 | Player topology verified. |
| `<video>` not in light DOM, but open shadow root present with `<video>` | E1 | Plain `querySelector` cannot find it; shadow traversal required. |
| Network `.vtt` requests for `m-center.onflixcdn.com/content/<uuid>.vtt` observed | E2 | Real dialogue subtitle sources exist. |
| `thumb.vtt` storyboard VTT also fetched | E2 | Must be filtered out of subtitle selection. |
| `performance.getEntriesByType('resource')` lists exact VTT URLs | E3 | Direct network evidence, not just player UI. |
| Background inventory (`GET_DETECTED_MEDIA`) contains 3 subtitle entries (`vi`, `en`, `unknown`) | E4 | Cell successfully discovers and normalizes ONFLIX subtitles. |
| `data-cell-autoload-handled` from player iframe shows overlay loaded `62a1234f...vtt` (English) | E4 | `AUTO_LOAD_SUBTITLES` reaches the correct frame and the overlay initializes. |

## List

- **Source:**
  - Direct `.vtt` network requests from the `playembed.vip` iframe.
  - `webRequest.onBeforeRequest` + page `MutationObserver`.
  - MAIN-world fetch interceptor captures the `blob:` subtitle object.
- **Count (expected):** 2 dialogue tracks per episode + 1 seek-preview storyboard.
- **Direct (downloadable) URLs:**
  - `https://m-center.onflixcdn.com/content/26062026/c8c22898-f969-4a6b-8ee5-a27d631bf4c4.vtt` → `vi`
  - `https://m-center.onflixcdn.com/content/26062026/62a1234f-c825-4ab7-a61d-6b941b2a232c.vtt` → `en`
- **Metadata/unresolved:**
  - `blob:https://playembed.vip/<uuid>` → `unknown` (player-local blob, body present but language not resolved at snapshot time).
- **Rejected:**
  - `.../thumb.vtt` (seek-preview/storyboard, not dialogue). Rejected by updated `NON_SUBTITLE_KEYWORDS` guard.
- **Languages/formats:** `vi` / `en` / `unknown`, all `vtt`.

## Replay contract

- **URL context:** Direct `https://m-center.onflixcdn.com/...` URLs with no signed tokens or expiry visible.
- **Referer/Origin:** `playembed.vip` (the iframe). Cell's DNR path already rewrites the Referer/Origin from the request initiator.
- **Auth/cookie:** None required for the observed `.vtt` files.
- **Fetch verification:** Background resolves the UUID-based `vtt` by fetching and parsing the body; language is detected from content.

## Cell delivery

- **Discovery:** `webRequest.onBeforeRequest` catches the `.vtt` URLs; `PageScanner` and MAIN-world fetch interceptor also contribute the `blob:` track.
- **Normalization:** `resolveUnknownSubtitleLanguages` fetches each UUID-named VTT, parses cues, and runs frequency-based language detection.
  - `c8c22898...vtt` → `vi`
  - `62a1234f...vtt` → `en`
  - `thumb.vtt` was incorrectly resolved to `en` before the fix; now rejected at detection.
- **Replay:** `AUTO_LOAD_SUBTITLES` broadcast + direct `frameId` send. The player-iframe content script receives the message after its overlay controller is registered.
- **Background (verified):** 3 subtitles in `NetworkInterceptor.getSubtitles(tabId)`.
- **Panel:** Background inventory confirms the two real dialogue tracks plus the blob.
- **Overlay init:** Yes, after the shadow-DOM and delayed-video fixes.
- **Auto-load frame/frameId:** Player iframe (`playembed.vip`) with the `<video>` inside its shadow root.
- **Re-push on switch:** Not tested for this specific player. `REQUEST_AUTO_LOAD_SUBTITLES` is wired after controller init; repeated reload of the same page produced the same auto-load target.

## Root cause

Three independent failures were preventing ONFLIX from reaching E4:

1. **The `<video>` element was created after the 10-second `findVideoObserver` window and lived inside an open shadow root.**
   - `document.querySelector('video')` returned `null`, so `findAndInitOverlay()` never started the overlay.
   - `PageScanner` and `findPlayerContainer` also used `document.querySelectorAll('video')` and missed the shadow-DOM video.
2. **The player creates the `<video>` lazily (after the 10-second observer timeout).**
   - The original observer only retried on the next user click, but this player auto-starts without a click, leaving the overlay uninitialized.
3. **The player fetches a `thumb.vtt` storyboard file that was misclassified as `en` and selected over the real dialogue VTT.**
   - `findSubtitlesForOverlay` picked `.../thumb.vtt` as the English target, so the overlay would load thumbnail-image cues instead of dialogue.

## Recommended solution

Implemented (all in `src/`):

1. **Shadow-DOM-aware video discovery (`src/shared/lib/dom/videoFinder.ts`).**
   - `queryAllShadow()` pierces open shadow roots via `TreeWalker`.
   - `findLargestPlayableVideo()` picks the visible `<video>` (non-zero bounding rect), even if it lives in a shadow root.
2. **Overlay and player-mode fixes.**
   - `content-script.ts` now uses `findLargestPlayableVideo()` in `findAndInitOverlay`, the 500ms fallback poll, the click retry, and the `videoFindPoll` loop.
   - `PageScanner` uses `queryAllShadow()` for `<video>`, `<source>`, `<track>`, and `<a>`.
   - `findPlayerContainer.ts` uses `findLargestPlayableVideo()` and falls back to the shadow host when a video has no light-DOM parent.
3. **Lazy-video retry.**
   - When the 10-second `MutationObserver` times out, a lightweight 500ms poll runs for up to 50s, catching players that create the `<video>` after the initial window (Next.js / playembed case).
4. **Storyboard filter.**
   - `NON_SUBTITLE_KEYWORDS` in `subtitleDetector.ts` now includes `thumb\.vtt`, preventing seek-preview storyboards from being treated as dialogue subtitles.
5. **E4 observability aid.**
   - `content-script.ts` polls `GET_DETECTED_MEDIA` and mirrors the tab's subtitle/video count to `data-cell-debug-media` on the top `documentElement`, so cross-origin iframe tests can verify background inventory without needing the extension sidepanel.

### Known ceiling

- **Closed shadow roots:** If playembed switches to a `closed` shadow root, the content script cannot pierce it and the overlay cannot initialize. Current evidence shows an `open` shadow root.
- **In-player episode switches inside the iframe:** The top-frame episode watcher does not see cross-origin iframe internal navigation. The iframe's own `episodeChangeObserver` is active, but a provider/episode switch that keeps the same `<video>` element and only mutates `src` is covered by the `initVideoSrcWatcher` poll.

## Confidence/blockers

- **Verified:**
  - Exact ONFLIX URL used, no guessing.
  - Both dialogue `.vtt` URLs are discovered by the extension's background.
  - Vietnamese and English labels are correctly resolved from content.
  - The player-iframe overlay receives `AUTO_LOAD_SUBTITLES` and loads the English track.
  - The `thumb.vtt` storyboard no longer interferes with auto-load.
  - Repeating the navigation twice produces the same end-to-end result.
- **Assumed:**
  - The overlay actually renders cues because `data-cell-autoload-handled` proves the controller received and accepted the payload. Direct DOM inspection of the cross-origin player iframe was blocked by same-origin policy.
- **Not verified:**
  - Native (Vietnamese) side of bilingual overlay on this page, because the active target language in the test profile was English. Both `vi` and `en` are in inventory and the user can switch target language.
  - Download-to-disk path for these specific VTTs (the download pipeline was not exercised in this browser test).
- **Next experiment (if needed):**
  - Switch the user's overlay target language to `vi` and reload the page to confirm the overlay auto-loads the Vietnamese VTT instead.
