# ADR-035: Scanned subtitle `initiator` → DNR Origin for `prox.anicore.tv`

## Status
Accepted (2026-07-13)

## Context
ADR-034 fixed **detection**: `<track>`-origin subtitle URLs from `prox.anicore.tv/stream/<base64-hash>` (anikage.cc) now get stored. But **download** still failed:

```
Failed to fetch subtitle: 403
Failed at 0%
```

### Root cause
`prox.anicore.tv` checks the `Origin` header and returns `403 "forbidden origin"` unless `Origin: https://anikage.cc`. Verified via curl:

| Origin | Status |
|---|---|
| (none) | 403 |
| `https://anicore.tv` | 403 |
| `https://www.anicore.tv` | 403 |
| `https://prox.anicore.tv` | 403 |
| `https://anikage.cc` | **200** (27KB WEBVTT) |

The existing DNR fix (`docs/knowledge/forbidden-header-referer-dnr.md`) rewrites `Referer`+`Origin` at the network stack for subtitle fetches — but only when `DetectedSubtitle.initiator` (or `videoContext.videoTabUrl`) is set:

```ts
// downloader.ts
const refererSource = subtitle.initiator ?? videoContext?.videoTabUrl;
if (refererSource) { ruleId = await setRefererRule(subtitle.url, refererSource); }
```

`initiator` comes from `chrome.webRequest.OnBeforeRequestDetails.initiator` — only set for URLs that went through **network interception**. A `<track>` URL detected by the **page scanner** (DOM scan) never hits `webRequest`, so:

- `buildDetails()` (helpers.ts) built a synthetic `OnBeforeRequestDetails` with **no `initiator`**.
- → `NetworkRequest.initiator` = undefined → `DetectedSubtitle.initiator` = undefined.
- → `videoContext?.videoTabUrl` is also undefined when no video was detected on the tab (anikage.cc serves video from the same extension-less `prox.anicore.tv/stream/<hash>` endpoint, so `VIDEO_URL_PATTERNS` doesn't match it either — no linked video).
- → `refererSource` = undefined → **no DNR rule** → fetch sends extension origin → 403.

## Decision
Pass the content-script's frame URL (`window.location.href`) as the request `initiator` for scanned media, so it flows into `DetectedSubtitle.initiator` and becomes the DNR `Referer`/`Origin` source.

1. **`PageScanResultPayload`** (message types.ts): add `readonly pageUrl: string`.
2. **`content-script.ts`**: send `pageUrl: window.location.href` in both PAGE_SCAN_RESULT call sites (initial scan + observer callback + episode-switch rescan). `all_frames: true` in the manifest → `window.location.href` is the owning frame's URL, which is the correct initiator for that frame's `<track>`/`<source>` elements.
3. **`buildDetails()`** (helpers.ts): add optional `initiator` param, set on the synthetic details.
4. **`mediaDetection.ts`** PAGE_SCAN_RESULT handler: `const initiator = payload.pageUrl;` → pass to both the `NetworkRequest` and `buildDetails()` for video + subtitle paths.

### Why the frame URL is the right initiator
- For anikage.cc (top-level frame owns `<track>`): `window.location.href` = `https://anikage.cc/watch/...` → `setRefererRule` derives `Origin: https://anikage.cc` → 200.
- For iframe-embedded players (megaplay.buzz inside aniwatch): the real `details.initiator` from `webRequest` already wins for network-detected URLs; the scanned path only applies to DOM-scanned `<track>` whose owning frame IS the content-script's frame — so `window.location.href` is correct there too, not a guess.

### Why not look up the tab URL in the background
The content-script already has the exact frame URL synchronously; `chrome.tabs.get(tabId)` returns only the top-level URL (wrong for iframe-embedded `<track>`). `pageUrl` is more precise and avoids an async round-trip.

## Consequences
- Scanned `<track>`/`<source>` subtitles on origin-checking CDNs download successfully.
- All 3 fetch paths (downloadSubtitle, FETCH_SUBTITLE_CONTENT, resolveUnknownSubtitleLanguages) benefit — they all read `subtitle.initiator` / `payload.initiator`.
- No behavior change for network-detected media (their real `initiator` is unchanged).
- `pageUrl` is now a required field on `PAGE_SCAN_RESULT` — only the extension's own content-script sends this message, updated in lockstep.

## Test
- `integration.test.ts`: anikage.cc regression test asserts `subtitles[0]?.initiator === 'https://anikage.cc/watch/episode-1'` (in addition to the existing ADR-034 assertions). All 5 PAGE_SCAN_RESULT payloads updated with `pageUrl`.
- `npx tsc --noEmit` → pass.
- `npm run test:unit` → 2309 passed, 4 skipped, 0 failed.
- `npm run build` → pass.
- CLI verify: `curl -H "Origin: https://anikage.cc" .../stream/<hash>` → 200, WEBVTT body.
