# ADR-036: Parse Stremio addon subtitle listing JSON → extract real subtitle URLs

## Status
Accepted (2026-07-13)

## Context
User reported download failure on `https://stream.torrentio.to/api/v1/tmdb/subtitles/tt37287335`:
```
parseVtt: missing WEBVTT header
Failed at 50%
```

### Root cause
The URL is a **Stremio addon subtitle listing API** (JSON), not a subtitle file. Stremio addons serve a JSON listing at `/<api-prefix>/<type>/subtitles/<id>`:
```json
{"subtitles": [{"url": "https://.../sub.en.srt", "lang": "en"}, ...]}
```

The real subtitle files are in `subtitles[].url`. But `SUBTITLE_URL_PATTERNS`'s `/subtitles/` path segment matches the listing URL → the extension:
1. Detects it as a subtitle (false positive).
2. Fetches it → gets JSON (32 bytes).
3. `detectFormat` finds no extension → fallback `'vtt'`.
4. `convertVttToSrt` → `parseVtt` → body doesn't start with `WEBVTT` → throws → fails at 50%.

For `tt37287335`, the response is `{"files":null,"subtitles":null}` — torrentio has no subtitles for this item. But the misclassification is the bug regardless.

## Decision
Two-part fix: (1) reject listing URLs at detection time, (2) async-resolve the listing to extract real subtitle URLs.

### 1. Reject Stremio listing URLs in `detectSubtitle`
`subtitleDetector.ts`: add `STREMIO_LISTING_PATTERN = /\/api\/v\d+\/[a-z]+\/subtitles\//i` and `isStremioSubtitleListing(url)`. In `detectSubtitle`, return `null` for matching URLs — they're JSON, not subtitle files. This check runs BEFORE `trustAsSubtitle` and `SUBTITLE_URL_PATTERNS` — a listing URL is never a subtitle file regardless of how it was discovered.

### 2. Fire `onListingDetected` callback in `networkInterceptor`
`networkInterceptor.ts`: add `onListingDetected(callback)` — a single callback (not a Set, since only `wireEvents.ts` registers it). In `handleRequest`, after the extension-request filter, if `isStremioSubtitleListing(url)` and the callback is registered, fire it with `(url, tabId, initiator)`. The callback is async and not awaited — `handleRequest` stays synchronous.

### 3. `resolveStremioSubtitleListing` in `helpers.ts`
- Fetch the listing URL via `offscreenFetch` (survives SW eviction, same as `resolveUnknownSubtitleLanguages`).
- Parse JSON → extract `subtitles[].url`.
- For each URL, call `ctx.networkInterceptor.handleRequest(buildDetails(url, tabId, now, initiator), { trustAsSubtitle: true })`.
- Dedup via `resolvedStremioListings` Set — Stremio SPAs may fetch the same listing multiple times.
- The real subtitle URLs flow through the normal detection pipeline: `detectSubtitle` with `trustAsSubtitle: true` → `DetectedSubtitle` stored → `onMediaDetected` fires → broadcast + `resolveUnknownSubtitleLanguages` + `pushAutoLoadSubtitles`.

### 4. Wire in `wireEvents.ts`
`onListingDetected((url, tabId, initiator) => void resolveStremioSubtitleListing(ctx, url, tabId, initiator))`.

### Why not check Content-Type at fetch time
The detection is synchronous (webRequest handler) — we can't fetch + check Content-Type before deciding to store. URL-shape rejection at detection time + async JSON resolution is the clean split: sync detection rejects the false positive, async resolution extracts the real URLs.

### Why `/api/v<N>/<type>/subtitles/` pattern
- torrentio: `stream.torrentio.to/api/v1/tmdb/subtitles/<id>` ✓
- Generic Stremio protocol: `/<type>/subtitles/<id>.json` — does NOT match (no `/api/v<N>/`). These are less common in practice (most Stremio addons use an API prefix). ponytail ceiling noted in code comment — upgrade to Content-Type check if needed.

## Consequences
- Stremio addon listing URLs are no longer misclassified as subtitle files.
- Real subtitle URLs from the listing JSON are extracted and appear in the popup for download.
- When the listing returns `{"subtitles":null}` (no subtitles available), nothing is stored — no error, no false positive.
- Language resolution reuses existing `resolveUnknownSubtitleLanguages` flow.
- The `initiator` from the listing request is passed to the real subtitle URLs → DNR Referer/Origin works if the subtitle CDN requires it.

## Test
- `subtitleDetector.test.ts`: 4 tests — torrentio listing URL rejected (with and without `trustAsSubtitle`), listing URL with query params rejected, regular `/subtitles/movie.en.srt` URL still detected.
- `integration.test.ts`: 2 tests — listing URL with subtitles → real URLs re-injected + listing URL NOT stored; listing URL with `subtitles:null` → no subtitles stored.
- `npx tsc --noEmit` → pass.
- `npm run test:unit` → 2315 passed, 4 skipped, 0 failed.
- `npm run build` → pass.
- CLI verify: `curl https://stream.torrentio.to/api/v1/tmdb/subtitles/tt37287335` → `{"files":null,"subtitles":null}` (JSON, not WEBVTT).
