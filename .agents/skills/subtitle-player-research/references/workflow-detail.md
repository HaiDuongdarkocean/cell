# Subtitle Player Research — step detail

## 0. Scope and assumptions

1. Require and preserve the user-supplied URL; do not silently choose another episode.
2. Record URL, title, time, browser profile, and whether the test is player-side or extension-side.
3. Read the detection path: `subtitleDetector.ts`, `urls.ts`, `networkInterceptor.ts`, `helpers.ts`, `offscreenFetch.ts`, entity/message types.

Guard: ambiguous episode or test mode → ask one focused question.

## 1. Start the browser

1. Use `testing-extension-browser` (stealth-chrome-devtools) for anti-bot sites.
2. Use `cell-profile` only when explicitly requested; otherwise a disposable profile.
3. Enable network body capture before navigation when supported.
4. Navigate, wait for settlement, capture one screenshot/state snapshot.
5. Cloudflare/login/popup/play blocks → ask for the exact user action once; record the blocker if it remains.

Guard: successful navigation status does not prove the player loaded — check DOM, iframes, title, network activity.

## 2. Map player topology

Per visible frame: page/frame URL + origin; iframe `id`/`src`/parent/same-or-cross-origin; `video`, native `track`, `textTracks`, shadow DOM, custom player markers; player scripts/controls (`CC`, `Captions`, `Settings`, `Subs`, language menu); play/server/source buttons and the observed activation action.

Guard: after a cross-origin boundary, stop direct DOM access — use network, the parent-owned `iframe.src`, or a MAIN-world bridge in the child frame.

## 3. Activate without guessing

1. Locate play/source controls via DOM inspection + screenshot.
2. Click only an observed role/text/selector.
3. Wait for the resulting network/DOM transition.
4. Open the observed subtitle control; record languages, variants, built-in tracks, search results, auto-generated captions.
5. Automation can't click a cross-origin frame → ask the user to click the exact visible control.

Guard: no visible subtitle control is not proof of no subtitles — continue with network, HTML, player-state, HLS inspection.

## 4. Find the list source

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

Actions: capture exact URL, initiator, frame, method, body/state source. `webRequest.onBeforeRequest` exposes URL metadata, not bodies — use a MAIN-world fetch/XHR hook, captured body, or contextualized fetch. Iframe hashes: parse the observed `src` only, URL-decode once, validate JSON. HTML variables: allow-list the exact variable, parse its grammar, never execute returned code. Player state: read only the observed field through a nonce-protected bridge. Encryption: capture decoder/seed relationship, mark fragile until replay succeeds.

Guard: empty response-body tooling means `body unavailable`, not `empty list`.

## 5. Validate and normalize entries

Per entry: label/display name; language code + ISO/BCP-47/raw status; explicit format or trusted extension/content-type; absolute URL / relative+base / blob / metadata handle; default/forced/SDH/ASR flags; source/provider + stable id; Referer/Origin/cookies/token/frame/expiry requirements; status `ready`/`unresolved`/`expired`/`rejected`.

Rules:

1. Only `http:`/`https:` are download URLs; `blob:` is player-local.
2. Resolve relative URLs against the player/frame origin — never guess from the top page.
3. Preserve signed query params in the fetch URL; never strip tokens for dedup.
4. Prefer explicit format; never silently convert SSA/ASS/unknown to VTT.
5. Metadata arrays stay `unresolved` until a real resolver is verified.
6. Validate representative status/content; validate all entries only for small lists.
7. Never log cookies, authorization headers, signed URLs, or decoder keys.

Guard: UI and API counts differ → compare entries + built-in/auto tracks; report both; discrepancy stays unresolved until explained.

## 6. Audit actual Cell delivery

- Does the URL match the file detector or only a listing endpoint?
- Is a resolver wired to background? Can body/state reach the isolated content script + background?
- Are language/label/format/initiator/frame preserved? Can the extension replay the exact URL with required auth context?
- Does `networkInterceptor.getSubtitles(tabId)` contain the expected count? Does the panel show the same count?

```text
Discovery: E0–E4
Normalization: ready=<n>, unresolved=<n>, rejected=<n>
Replay: verified | sample-only | blocked (<exact reason>)
Delivery: background=<n>, panel=<n>, expected=<n>
Overlay: controller=<yes/no>, autoload=<yes/no>, frame=<top/iframe/frameId>
```

Cross-origin iframe players also check: player-frame content script sees `<video>` and reaches `isVideoReady`; overlay initialized before first `AUTO_LOAD_SUBTITLES` push; page scanner sees post-`DOMContentLoaded` source mutations; `REQUEST_AUTO_LOAD_SUBTITLES` re-pushed from the player frame; `AUTO_LOAD_SUBTITLES` reaches the exact frame, not just broadcast.

## 7. Root cause → adapter contract

Failure classes: listing endpoint unmatched; response body unavailable to `webRequest`; JS-managed tracks bypass native `<track>`; data in nested frame/player state; relative/signed URLs need frame/auth context; metadata entries need a provider resolver; encrypted body needs decoder/seed adapter; HLS subtitle media unparsed; extension root/UI absent despite detection; overlay uninitialized before first auto-load push; scanner misses post-`DOMContentLoaded` track/source assignment; `AUTO_LOAD_SUBTITLES` broadcast to wrong/stale frame; play-on-demand `<video>` created after `findVideoObserver` timeout; episode watcher disabled in iframes.

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

Prefer a registry of protocol adapters over site branches in `NetworkInterceptor`. Reuse generic families (JSON-array, JSON-path, iframe-hash, HTML-variable, player-state, HLS, encrypted); keep only irreducible site rules in profiles.

## 8. Report template

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
