---
name: subtitle-player-research
description: Investigate a supplied streaming-page URL to discover how its subtitle list is produced, verify list and replay requirements, identify the extension root cause, and output an evidence-graded solution or precise blocker. Use when researching subtitle detection support for a new player/site. Not for implementing adapters, guessing undocumented endpoints, or claiming extension support from DevTools-only evidence.
---

# Subtitle Player Research

## Purpose

Turn one supplied URL into:

```text
player topology → subtitle-list mechanism → verified entries → replay constraints
→ extension root cause → adapter solution → unresolved blockers
```

This is a research workflow, not implementation. Do not modify `src/` while running it. Never invent
URLs, API endpoints, tokens, selectors, or counts.

## Non-negotiable distinction

Report these separately:

- **Player-side discovery:** the browser/player exposes a subtitle list.
- **Extension delivery:** Cell discovers, normalizes, replays, and stores every entry in background
  inventory.

DevTools, page JavaScript, or PowerShell seeing a list is not extension support until the actual
background inventory is checked.

## Evidence levels

| Level | Evidence | Claim allowed |
|---|---|---|
| E0 | hypothesis or URL clue | possible only |
| E1 | DOM, iframe `src`, UI, or network URL | mechanism observed |
| E2 | response/HTML/player-state payload parsed | player-side count/shape verified |
| E3 | direct URL status/content validated | entry fetchable with stated context |
| E4 | extension inventory has expected entries | end-to-end support verified |

Never label a site supported without E4. Otherwise write: `player-side verified; extension replay pending`.

## Workflow

### 0. Scope and assumptions

**Purpose:** prevent silent assumptions.

**Actions:**

1. Require and preserve the user-supplied URL; do not silently choose another episode.
2. Record URL, title, time, browser profile, and whether the test is player-side or extension-side.
3. Read project rules and the current detection path. For Cell inspect `subtitleDetector.ts`,
   `urls.ts`, `networkInterceptor.ts`, `helpers.ts`, `offscreenFetch.ts`, and entity/message types.

**Guard:** if target episode or test mode is ambiguous, ask one focused question.

### 1. Start the browser

**Purpose:** obtain reproducible evidence.

**Actions:**

1. Use `browser-testing-with-devtools`; prefer `stealth-chrome-devtools` for anti-bot sites.
2. Use `cell-profile` only when explicitly requested; otherwise use a disposable profile.
3. Enable network body capture before navigation when supported.
4. Navigate, wait for settlement, and capture one screenshot/state snapshot.
5. If Cloudflare, login, popup, or play blocks progress, ask for the exact user action once and record
   the blocker if it remains.

**Guard:** a successful navigation status does not prove that the player loaded; check DOM, iframes,
title, and network activity.

### 2. Map player topology

Record for every visible frame:

- page/frame URL and origin;
- iframe `id`, `src`, parent frame, and same-origin/cross-origin boundary;
- `video`, native `track`, `textTracks`, shadow DOM, and custom player markers;
- player scripts and controls (`CC`, `Captions`, `Settings`, `Subs`, language menu);
- play/server/source buttons and the observed activation action.

A parent may read its iframe element's `src` even when it cannot read `contentDocument`. Do not confuse
those permissions.

**Guard:** after a cross-origin boundary, stop direct DOM access and use network, the parent-owned
`iframe.src`, or a MAIN-world bridge in the child frame.

### 3. Activate without guessing

1. Locate play/source controls through DOM inspection and screenshot.
2. Click only an observed role/text/selector.
3. Wait for the resulting network/DOM transition.
4. Open the observed subtitle control; record languages, variants, built-in tracks, search results,
   and auto-generated captions.
5. If automation cannot click a cross-origin frame, ask the user to click the exact visible control.

**Guard:** no visible subtitle control is not proof of no subtitles; continue with network, HTML,
player-state, and HLS inspection.

### 4. Find the list source

Try the strongest available signal:

| Signal | Evidence | Adapter family |
|---|---|---|
| Native/player tracks | `<track>`, `textTracks`, `remoteTextTracks`, JWPlayer playlist | track/state |
| File requests | `.vtt`, `.srt`, `.ass`, subtitle path | URL accumulation |
| JSON bare array | `[{src,label,lang}]` | JSON-array |
| JSON object array | `{subtitles: [...]}`, `{default_subs: [...]}` | JSON-path |
| Iframe data | `subs=[...]` in hash/query | iframe-hash |
| HTML variable | `playerjsSubtitle = ...` | HTML-variable |
| MAIN-world state | `window.the_subtitles`, React/player store | state bridge |
| HLS playlist | `#EXT-X-MEDIA:TYPE=SUBTITLES` | HLS parser |
| Ciphertext | body plus decoder/seed | encrypted-json |

**Actions:**

- Capture exact URL, initiator, frame, method, and body/state source.
- `webRequest.onBeforeRequest` exposes URL metadata, not response bodies; use a MAIN-world fetch/XHR
  hook, captured body, or a correctly contextualized fetch.
- For iframe hashes, parse only the observed `src`, URL-decode once, then validate JSON.
- For HTML variables, allow-list the exact variable and parse its grammar; never execute returned code.
- For player state, read only the observed field through a nonce-protected bridge.
- For encryption, capture decoder/seed relationship and mark fragile until replay succeeds.

**Guard:** empty response-body tooling means `body unavailable`, not `empty list`.

### 5. Validate and normalize entries

For every entry record:

- label/display name;
- language code and ISO/BCP-47/raw status;
- explicit format or trusted extension/content type;
- absolute URL, relative URL plus base, blob URL, or metadata handle;
- default/forced/SDH/ASR flags;
- source/provider and stable id;
- Referer, Origin, cookies, token, frame, and expiry requirements;
- status: `ready`, `unresolved`, `expired`, or `rejected`.

Rules:

1. Only `http:`/`https:` are download URLs. `blob:` is player-local.
2. Resolve relative URLs against player/frame origin, never by guessing from the top-level page.
3. Preserve signed query parameters in the fetch URL; never strip tokens for deduplication.
4. Prefer explicit format; never silently turn SSA/ASS/unknown into VTT.
5. Metadata arrays remain `unresolved` until a real resolver is verified.
6. Validate representative status/content; validate all entries only for a small, tolerated list.
7. Never log cookies, authorization headers, signed URLs, or decoder keys.

**Guard:** if UI and API counts differ, compare entries and built-in/auto tracks; report both and keep
the discrepancy unresolved until explained.

### 6. Audit actual Cell delivery

Check:

- Does the URL match the file detector or only a listing endpoint?
- Is a resolver wired to background?
- Can body/state reach isolated content script and background?
- Are language, label, format, initiator, and frame preserved?
- Can the extension replay the exact URL with required auth context?
- Does `networkInterceptor.getSubtitles(tabId)` contain the expected count?
- Does the subtitle panel show the same count?

Use:

```text
Discovery: E0–E4
Normalization: ready=<n>, unresolved=<n>, rejected=<n>
Replay: verified | sample-only | blocked (<exact reason>)
Delivery: background=<n>, panel=<n>, expected=<n>
Overlay: controller=<yes/no>, autoload=<yes/no>, frame=<top/iframe/frameId>
```

**Guard:** a Network panel request is never delivery evidence; E4 requires background inventory.

For cross-origin iframe players, also check:

- Does the player frame content script report a `<video>` and reach `isVideoReady`?
- Is the overlay controller initialized before the first `AUTO_LOAD_SUBTITLES` push?
- Does the page scanner see subtitle source mutations after `DOMContentLoaded`?
- Is `REQUEST_AUTO_LOAD_SUBTITLES` re-pushed from the player frame after detection?
- Is the `AUTO_LOAD_SUBTITLES` message reaching the exact player frame, not just broadcast?

### 7. Derive root cause and solution

Classify the observed failure precisely:

- listing endpoint is not matched;
- response body is unavailable to `webRequest`;
- JS-managed player tracks bypass native `<track>`;
- data is in nested frame/player state;
- relative/signed URLs need frame/auth context;
- metadata entries need a provider resolver;
- encrypted body needs decoder/seed adapter;
- HLS subtitle media is not parsed;
- extension root/UI is absent despite detection;
- content-script overlay is not initialized before the first `AUTO_LOAD_SUBTITLES` push;
- page scanner misses track/source assignment after `DOMContentLoaded`;
- `AUTO_LOAD_SUBTITLES` broadcast reaches the wrong frame or a stale iframe;
- play-on-demand player creates `<video>` after `findVideoObserver` timeout — overlay never inits;
- episode watcher is disabled in iframes — in-player episode switches go undetected.

Output an adapter contract:

```text
Adapter id:
Signal and match condition:
Acquire method:
Pure parser and schema:
Entry normalization:
URL/auth resolver:
Dedup identity:
Background delivery:
Known ceiling:
```

Prefer a registry of protocol adapters over site branches in `NetworkInterceptor`. Reuse generic
families for JSON-array, JSON-path, iframe-hash, HTML-variable, player-state, HLS, and encrypted
sources; keep only irreducible site rules in profiles.

### 8. Report template

```markdown
# Subtitle support research: <site>

## Input
- URL:
- Date/profile:
- Access status:

## Player topology
- Frames/origins:
- Player:
- Activation:

## Evidence
| Observation | Level | Consequence |
|---|---|---|

## List
- Source:
- Count:
- Direct:
- Metadata/unresolved:
- Rejected:
- Languages/formats:

## Replay contract
- URL context:
- Referer/Origin:
- Token/cookie/expiry:
- Fetch verification:

## Cell delivery
- Discovery:
- Normalization:
- Replay:
- Background:
- Panel:
- Overlay init:
- Auto-load frame/frameId:
- Re-push on switch:

## Root cause
<one evidence-linked paragraph>

## Recommended solution
<adapter contract and integration path>

## Confidence/blockers
- Verified:
- Assumed:
- Not verified:
- Next experiment:
```

## Cross-origin iframe delivery failures

When the player lives in a cross-origin iframe (e.g. `moviepire` → `vidnest`), the subtitle list may be in the child frame while the content script overlay and background broadcast logic live elsewhere. Use this micro-flow when extension inventory is correct but the overlay still does not load after an episode or provider switch.

```text
1. Confirm the child frame content script is injected.
2. Confirm a <video> element exists and the overlay init condition is met.
3. Confirm tracks/sources appear and the page scanner re-scans after they appear.
4. Confirm the player frame asks for REQUEST_AUTO_LOAD_SUBTITLES.
5. Confirm AUTO_LOAD_SUBTITLES is sent to the exact frameId of the player frame.
6. Confirm the top frame receives __CELL_AUTOLOAD_HANDLED from the player frame.
```

**Guards at each step:**

- If `<video>` exists but no overlay: the init condition may wait only for `readyState` or `blob:` URL; tracks with real `<track src>` should also count.
- If `runPageScan` runs once and finds zero tracks: it must be allowed to re-scan when tracks are assigned later.
- If `AUTO_LOAD_SUBTITLES` is broadcast to all frames: a freshly navigated iframe may not yet appear in `getAllFrames`; prefer a direct frameId send plus a broadcast fallback.
- If the player frame reloads on episode switch: old `SESSION_MEDIA` must be cleared and the new frame must request a re-push.

## Play-on-demand players (lazy video creation)

Some players (videasy, certain React/Next.js players) do not create the `<video>`
element on page load. The video only appears AFTER the user clicks a play button,
which can happen well after the `findVideoObserver` 10s timeout. The encrypted
listing fetch also fires on play, not on iframe load.

**Symptom:** extension inventory shows subtitles (E4) but the overlay never
initializes — `data-cell-autoload-handled` is stale or absent, no
`#cell-subtitle-shadow-host` in the player frame.

**Diagnostic micro-flow:**

```text
1. Navigate to the player URL directly (not via the parent page).
2. Wait 10s without clicking play. Check: does <video> exist?
   - No  → the player is play-on-demand. Continue.
   - Yes → this is a different timing issue; do not apply this flow.
3. Click the play button. Check: does <video> appear now?
4. Check: is #cell-subtitle-root present with a shadow root?
   - No  → findVideoObserver timed out before the click. Root cause confirmed.
5. Verify fix: after the fix, the overlay should init within 1s of the click.
```

**Fix pattern (commit bf5082b4):**

When `findVideoObserver` times out without finding a video, install a one-shot
capture-phase `document.click` listener that re-triggers `findAndInitOverlay()`
on the next user interaction. The listener removes itself once the overlay
initializes. This is cheaper than an indefinite MutationObserver and catches
the common case where a user gesture is required to create the player.

**Known ceiling:** detection is delayed until the first user click. If the
player auto-plays without a click (rare for play-on-demand players), this
pattern will not fire. Upgrade path: also listen for `play`/`playing` events
on a late-attached video via a lightweight periodic re-scan.

## In-player episode switches inside iframes

When a player iframe has its own episode navigation (e.g. videasy's next-episode
button), the `<video>` element is replaced inside the iframe on switch. The top
frame's `episodeChangeObserver` cannot see inside a cross-origin iframe, so the
watcher must run inside the iframe itself.

**Symptom:** clicking the in-player next-episode button changes the video and
URL, but the overlay stays attached to the old video and subtitles are not
re-loaded. Clicking the parent page's next-episode button works because the
top frame's iframe-src watcher fires.

**Diagnostic micro-flow:**

```text
1. Click the in-player next-episode button (inside the iframe).
2. Check: does location.href change inside the iframe?
3. Check: is <video> replaced (different element identity)?
4. Check: does data-cell-episode-changed appear on the iframe's documentElement?
   - No  → the iframe's episodeChangeWatcher is not running. Root cause confirmed.
5. Verify fix: after the fix, episodeChanged=replacement should fire inside the
   iframe and the overlay should re-init with the new episode's subtitles.
```

**Fix pattern (commit d8a60028):**

Replace the blanket `if (window.self !== window.top) return` guard in
`initEpisodeChangeWatcher` with a hidden-iframe-only guard (same 1x1 check as
`fetchInterceptor.iife.ts`). Visible player iframes are now instrumented. The
iframe-baseline logic (existing-iframe lookup) is guarded by `isTop` since it
is only meaningful in the top frame.

**Known ceiling:** hidden iframes other than 1x1 challenge frames are still
skipped. If a legitimate player runs in a very small iframe (<10x10), it will
not be instrumented. Upgrade path: check `display:none`/`visibility:hidden`
instead of pixel dimensions.

## Anti-patterns

| Bad action | Correct replacement |
|---|---|
| Treat DevTools list as extension list | check E4 inventory |
| Add listing APIs to file URL patterns | create typed resolver |
| Treat page CORS failure as final | test the correct frame or DNR replay |
| Guess endpoint/token/selector | capture an actual request |
| Execute arbitrary HTML script | parse one allow-listed variable |
| Turn metadata into a fabricated URL | keep an `unresolved` handle |
| Strip query tokens for dedup | keep fetch URL; use a separate identity key |
| Conclude no subtitles after a blocked frame | report blocker and next experiment |
| Treat empty scan at `DOMContentLoaded` as no subtitles | re-scan when `<track>`/`<source>` `src` is assigned later |
| Broadcast `AUTO_LOAD` to all frames only | target the player frame by `frameId` and keep broadcast as fallback |
| Assume a navigated cross-origin iframe is immediately reachable | wait for the new frame to register its message listener, then re-push |
| Assume `<video>` exists on page load | play-on-demand players create it on click; check after interaction |
| Run episode watcher only in top frame | in-player episode switches inside iframes go undetected; instrument visible player iframes |

## Verification checklist

- [ ] Supplied URL used without guessing a replacement.
- [ ] Profile, access blockers, topology, and cross-origin boundaries recorded.
- [ ] A real list source captured, or blocker explicitly stated.
- [ ] Counts reconcile, or discrepancy is documented.
- [ ] Direct, relative, blob, and metadata entries separated.
- [ ] Language/format come from validated metadata where available.
- [ ] Auth/replay requirements recorded and tested at the stated level.
- [ ] Player-side evidence is not mislabeled as extension support.
- [ ] Background inventory checked before claiming support.
- [ ] Root cause maps to one adapter family with a known ceiling.
- [ ] Content-script overlay state is checked in the player frame, not only the top frame.
- [ ] Subtitle source mutations after `DOMContentLoaded` are observed and re-scanned.
- [ ] `AUTO_LOAD_SUBTITLES` delivery is verified against the correct frame or frameId.
- [ ] Episode/provider switch clears old media and the new frame requests a re-push.
- [ ] Play-on-demand players: `<video>` existence checked after user click, not only on load.
- [ ] In-player episode switches: watcher verified inside the iframe, not only in the top frame.
- [ ] No secrets or signed tokens committed to fixtures/logs.

## Router boomerang

If the task changes to implementation, route through `learning-and-apply`,
`incremental-implementation`, `api-and-interface-design`, `test-driven-development`, and
`browser-testing-with-devtools`. If it becomes a runtime failure, use
`debugging-and-error-recovery`.
