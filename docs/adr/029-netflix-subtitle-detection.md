# ADR-029: Netflix Subtitle Detection — Interface Contracts

> G3 Design. Code-to-code contracts cho Netflix subtitle detection feature.
> Input: `docs/specs/spec-netflix-subtitle-detection.md`.
> Research: stress test thực tế qua edge-devtools MCP 2026-07-13 (movie 81947712, logged in).
> Precedent: ADR-020 (YouTube) + ADR-028 (iQIYI — cùng pattern MAIN-world manifest extraction).

> **PIVOT 2026-07-13**: Contracts 1 + 5 below were superseded after live testing
> revealed cadmium 6.0059+ no longer parses the MSL manifest via `JSON.parse`
> (uses a schema-based custom parser with 2-char field codes: `S7`→`ttDownloadables`,
> `CL`→`timedtexttracks`). The JSON.stringify/JSON.parse hooks (Contract 5) do not
> capture the manifest response. Pivoted to **object graph traversal** (asbplayer
> 1.19.0 approach): DFS/BFS on `cadmiumPlayerRepository.playersById[sessionId]`
> to find `type === 'timedtext'` nodes with `urls[0].url`, paired with metadata
> from `getTimedTextTrackList()`. Netflix serves IMSC1.1 (TTML XML), not WebVTT —
> `format: 'ttml'`. See updated `netflixSubtitleDetector.ts` + `netflix-main-world.iife.ts`.
> Contracts 2, 3, 4 remain valid (message type, dispatch, entity reuse unchanged).

## Context

Netflix subtitle detection cần 3 module mới + 3 module modify + manifest change. Cần define interface contracts trước G4 để:
- Module boundaries rõ (MAIN world script không leak, ISOLATED listener không biết parse logic)
- Parallel implementation possible (M2 pure logic + M4 MAIN world + M5 background độc lập nếu contract chốt)
- Hyrum's Law mitigation — expose minimum, hide implementation
- MAIN↔ISOLATED message contract explicit (clone ADR-020/ADR-028 pattern)
- Reuse `DETECTED_SUBTITLES` message type — `detectionDispatch.ts` đã là unified handler, chỉ thêm `source: 'netflix'` branch (không duplicate handler)

## Decision: 8 interface contracts

### Contract 1 — `NetflixSubtitleTrack` (pure data, MAIN world parse target)

```typescript
// src/features/detection/logic/netflixSubtitleDetector.ts

/** Netflix subtitle track from manifest `result.timedtexttracks[]` (subset). */
export interface NetflixSubtitleTrack {
  readonly language: string;           // BCP 47: "en", "vi", "zh-Hans", "zh-Hant", ...
  readonly languageDescription: string; // "Vietnamese", "English", "Chinese (Simplified)", ...
  readonly rawTrackType: string;        // "subtitles" | "closedcaptions" | ...
  readonly trackType: string;           // "PRIMARY" | "ASSISTIVE" | ...
  readonly isNoneTrack: boolean;        // true = "Off" track (skip)
  readonly isForcedNarrative: boolean;  // true = forced subtitle (foreign-language dialog)
  readonly isImageBased: boolean;       // true = image subtitle (skip — not text)
  readonly ttDownloadables: Readonly<Record<string, NetflixDownloadable>>; // keyed by format
}

/** Downloadable URL set cho 1 format (webvtt-lssdh-ios8, dfxp-ls-sdh, imsc1.1, simplesdh). */
export interface NetflixDownloadable {
  readonly downloadUrls?: Readonly<Record<string, string>>; // { "1": "https://...nflxvideo.net/..." }
  readonly urls?: ReadonlyArray<{ url: string }>;            // alternative shape
}

/**
 * Safely extract `timedtexttracks[]` từ manifest payload (defensive parsing).
 * Skip `isNoneTrack` + `isImageBased` tracks (Off + image-based, không parse-able).
 * Returns [] khi structure missing/malformed — caller treats empty as
 * "no subtitle" (trigger overlay clear on SPA nav).
 */
export function extractNetflixTracks(manifestResult: unknown): NetflixSubtitleTrack[];

/**
 * Map Netflix `timedtexttracks[]` → `DetectedSubtitle[]` cho auto-load flow.
 * - url = first downloadUrl từ preferred format (webvtt-lssdh-ios8 → dfxp-ls-sdh → imsc1.1 → simplesdh)
 * - language = track.language (BCP 47, lowercase — match languageRegistry directly, không cần map table)
 * - isAsr = false (Netflix không có AI-generated distinction)
 * - displayName = track.languageDescription
 * - initiator = 'https://www.netflix.com/' (Referer cho CORS fallback)
 * - format = 'vtt' (WebVTT only — TTML tracks skipped, ponytail ceiling: no TTML parser in codebase)
 */
export function mapNetflixSubtitleTracks(
  tracks: readonly NetflixSubtitleTrack[],
  tabId: number,
): DetectedSubtitle[];
```

**Source**: stress test 2026-07-13 (movie 81947712), 42 tracks, 33 languages: `en` (3 variants), `vi`, `zh-Hans`, `zh-Hant`, `ko`, `ja`, `fr`, `de`, `es`, `pt-BR`, `ar`, `ru`, etc. plateaukao extension source (proven 1000+ users).

### Contract 2 — `DetectedSubtitle` entity (NO extension — reuse ADR-020)

```typescript
// src/entities/media/types.ts (UNCHANGED — ADR-020 đã add fields)

export interface DetectedSubtitle {
  readonly id: string;
  readonly url: string;
  readonly format: SubtitleFormat;   // Netflix: 'vtt' (webvtt) | 'ttml' (dfxp/imsc1.1)
  readonly language: string;          // Netflix: track.language ('vi', 'zh-Hans', ...)
  readonly tabId: number;
  readonly detectedAt: number;
  readonly isAsr?: boolean;           // Netflix: false (no AI distinction)
  readonly displayName?: string;      // Netflix: languageDescription ("Vietnamese")
  readonly initiator?: string;        // Netflix: 'https://www.netflix.com/'
  // ... existing fields
}
```

**No new fields** — ADR-020 đã add `isAsr`, `displayName`, `initiator`. Netflix adapter set cả 3. Backward compatible.

### Contract 3 — MAIN↔ISOLATED `postMessage` bridge (clone ADR-020/ADR-028)

```typescript
// src/entrypoints/content/netflix-main-world.iife.ts (MAIN world → ISOLATED)

/** MAIN→ISOLATED message: Netflix subtitle tracks detected. */
interface NetflixDetectedSubtitlesMessage {
  readonly type: '__NF_DETECTED_SUBTITLES';
  readonly tracks: NetflixSubtitleTrack[];
  readonly movieId: number;  // dedup key (string-based in content-script — clone YouTube videoId / iQIYI tvid `?? ''` pattern, NOT `?? 0` which is falsy)
}

// MAIN world posts:
window.postMessage({ type: '__NF_DETECTED_SUBTITLES', tracks, movieId }, '*');
```

```typescript
// src/entrypoints/content/content-script.ts (ISOLATED listener → background)

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (data?.type === '__NF_DETECTED_SUBTITLES') {
    const movieId = String((data as { movieId?: unknown }).movieId ?? '');  // string dedup (clone YouTube/iQIYI `?? ''` — NOT `?? 0` which is falsy)
    // Dedup by movieId: MAIN world re-posts on __NF_CS_READY handshake (clone ADR-020 race fix)
    const lastRelayedMovieId = (window as unknown as Record<string, unknown>).__NF_LAST_RELAYED_MOVIE_ID as string | undefined;
    if (movieId !== '' && lastRelayedMovieId === movieId) return;
    (window as unknown as Record<string, unknown>).__NF_LAST_RELAYED_MOVIE_ID = movieId;
    void sendMessage({
      type: MESSAGE_TYPES.DETECTED_SUBTITLES,  // REUSE ADR-020 message type
      payload: { tracks: data.tracks, movieId, tabId: undefined, source: 'netflix' },
    });
  }
});
```

**Precedent**: `fetchInterceptor.iife.ts` (ADR-011) + `youtube-main-world.iife.ts` (ADR-020) + `iqiyi-main-world.iife.ts` (ADR-028) — same `window.postMessage` pattern, proven working.

**`source: 'netflix'` discriminator**: `detectionDispatch.ts` đã là unified handler (ADR-028), chỉ thêm `else if (source === 'netflix')` branch. Explicit > implicit.

### Contract 4 — `DETECTED_SUBTITLES` background handler (amend ADR-028 unified dispatch)

**CRITICAL**: `messageBus.on()` dùng `handlers.set(type, handler)` — overwrite. `detectionDispatch.ts` đã là SINGLE registrant (ADR-028). Chỉ thêm `source === 'netflix'` branch, không register handler mới.

```typescript
// src/entrypoints/background/handlers/detectionDispatch.ts (AMEND — add netflix branch)

export function registerDetectionDispatchHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.DETECTED_SUBTITLES, async (request): Promise<MessageResponse> => {
    const payload = request.payload as DetectedSubtitlesPayload;
    const tabId = payload.tabId ?? (await getActiveTabId(ctx));
    if (tabId === undefined) return { success: false, error: 'Missing tabId' };

    const source = payload.source;
    let subtitles: DetectedSubtitle[];
    if (source === 'iqiyi') {
      subtitles = mapIqiyiSubtitleTracks(payload.tracks as IqiyiSubtitleTrack[], tabId, payload.origin ?? 'https://meta.video.iqiyi.com');
    } else if (source === 'netflix') {
      // Netflix: BCP 47 language directly (no map table), initiator hardcoded
      subtitles = mapNetflixSubtitleTracks(payload.tracks as NetflixSubtitleTrack[], tabId);
    } else {
      // YouTube (source === 'youtube' or undefined — backward compat ADR-020)
      subtitles = mapYouTubeCaptionTracks(payload.tracks as YouTubeCaptionTrack[], tabId);
    }

    // ... existing post-map flow (store → broadcast → pushAutoLoadSubtitles) UNCHANGED
  });
}
```

**ADR-028 amend**: thêm `else if (source === 'netflix')` branch. Post-map flow (empty → clear overlay, added → broadcast + auto-load) UNCHANGED — Netflix reuse 100%.

### Contract 5 — MAIN world `JSON.parse` + `JSON.stringify` hook (Netflix-specific)

```typescript
// src/entrypoints/content/netflix-main-world.iife.ts (MAIN world, document_start)

/**
 * Hook JSON.stringify — modify manifest REQUEST payload BEFORE send.
 * Add all subtitle formats to `profiles[]` + `showAllSubDubTracks = true`
 * → force Netflix expose ALL subtitle tracks (not just user locale).
 *
 * Trigger: payload có `url` match /manifest|licensedManifest/ AND có `profiles[]`.
 */
function hookJsonStringify(): void {
  const origStringify = JSON.stringify;
  JSON.stringify = function (data: unknown, ...rest: unknown[]): string {
    if (data && typeof data === 'object' && typeof (data as { url?: string }).url === 'string'
        && /manifest|licensedManifest/.test((data as { url: string }).url)) {
      for (const v of Object.values(data as Record<string, unknown>)) {
        try {
          if (typeof v === 'object' && v !== null && 'profiles' in v) {
            const profiles = (v as { profiles: string[] }).profiles;
            for (const fmt of ALL_FORMATS) {
              if (!profiles.includes(fmt)) profiles.unshift(fmt);
            }
            __NF_DEBUG.stringifyModifiedCount++;  // drift detector (Risk #5)
          }
          if ('showAllSubDubTracks' in (v as object)) {
            (v as { showAllSubDubTracks: boolean }).showAllSubDubTracks = true;
          }
        } catch { /* TypeError — skip non-object value */ }
      }
    }
    return origStringify.apply(this, [data, ...rest] as [unknown, ...unknown[]]);
  };
}

/**
 * Hook JSON.parse — capture manifest RESPONSE after MSL decrypt.
 * Netflix player decrypts MSL response → JSON.parse(text) → hook captures
 * `result.timedtexttracks[]` with `ttDownloadables.downloadUrls`.
 *
 * Trigger: parsed data có `result.timedtexttracks` + `result.movieId`.
 */
function hookJsonParse(): void {
  const origParse = JSON.parse;
  JSON.parse = function (text: string, ...rest: unknown[]): unknown {
    const data = origParse.apply(this, [text, ...rest] as [string, ...unknown[]]);
    if (data && typeof data === 'object' && (data as { result?: unknown }).result) {
      const result = (data as { result: Record<string, unknown> }).result;
      // Defensive: Array.isArray check (not just truthy) + 'movieId' in result (not truthy — movieId===0 falsy)
      if (Array.isArray(result.timedtexttracks) && 'movieId' in result) {
        // movieId fallback: if missing/falsy, derive from URL /watch/(\\d+)/
        let movieId = result.movieId as number | string | undefined;
        if (movieId === undefined || movieId === null || movieId === 0) {
          const m = location.pathname.match(/\/watch\/(\d+)/);
          movieId = m ? m[1] : 0;
        }
        const tracks = extractNetflixTracks(result);
        __NF_DEBUG.captureCount++;  // drift detector
        if (tracks.length > 0) {
          postDetectedSubtitles(tracks, movieId as number);
        }
      }
    }
    return data;
  };
}
```

**Why hook JSON.stringify**: Netflix manifest request chỉ trả về subtitle tracks cho user locale + profiles client declare. Add all formats + `showAllSubDubTracks = true` → tất cả 33 languages có sẵn. **Without this**: chỉ ~5-10 languages (user locale + common) detect được.

**Why hook JSON.parse**: MSL response encrypted, decrypt bên trong player closure. Sau decrypt, player `JSON.parse(text)` → hook capture `ttDownloadables.downloadUrls` (download URLs). **Without this**: `ttDownloadables` không accessible qua `window.netflix` API (verified — nằm trong player closure).

**Ceiling**: nếu Netflix đổi MSL decrypt flow (parse trong Worker, hoặc dùng custom parser thay `JSON.parse`), hook miss. Upgrade: intercept CMAF segment range requests + parse fragmented MP4 (phức tạp hơn, fallback layer).

### Contract 6 — `DetectedSubtitlesPayload` entity (amend — add netflix fields)

```typescript
// src/entities/message/types.ts (AMEND — add netflix discriminator + movieId)

export interface DetectedSubtitlesPayload {
  readonly tabId?: number;
  readonly tracks: readonly unknown[];
  readonly source?: 'youtube' | 'iqiyi' | 'netflix';  // add 'netflix'
  // YouTube (ADR-020)
  readonly videoId?: string;
  // iQIYI (ADR-028)
  readonly tvid?: string;
  readonly origin?: string;
  // Netflix (ADR-029)
  readonly movieId?: number;  // dedup key (clone YouTube videoId / iQIYI tvid)
}
```

**Backward compatible**: `source` + `movieId` optional. Existing YouTube/iQIYI posts không set → undefined → existing flow.

### Contract 7 — SPA navigation + handshake (clone ADR-020/ADR-028)

```typescript
// src/entrypoints/content/netflix-main-world.iife.ts

// Handshake: ISOLATED content-script posts __NF_CS_READY khi listener registered.
// MAIN world re-posts last tracks nếu listener late-register (CRXJS async loader delay).
// CRITICAL: early-return `if (event.source !== window) return;` — clone iqiyi-main-world.iife.ts:258-275.
// (Bug fix 2026-07-13: previous `event.source !== window && ...` was unsatisfiable — never re-posted.)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as { type?: string } | null;
  if (data?.type === '__NF_CS_READY' && lastDetectedTracks.length > 0) {
    __NF_DEBUG.repostCount++;  // drift detector
    postDetectedSubtitles(lastDetectedTracks, lastDetectedMovieId);
  }
});

// SPA nav: Netflix /watch/<id> → /watch/<id2> không reload. Hook popstate + pushState + replaceState.
// Re-detect khi movieId change (manifest fetch mới trigger JSON.parse hook tự động).
// No polling needed — manifest fetch xảy ra trên mỗi video load.
// replaceState: Netflix có thể dùng cho episode changes (SPA pattern tránh back-button pollution) — verify G4 MCP.
window.addEventListener('popstate', () => { lastMovieId = null; });
hookHistoryApi('pushState');   // wrap history.pushState to reset lastMovieId
hookHistoryApi('replaceState'); // wrap history.replaceState to reset lastMovieId (Risk #11)
```

```typescript
// src/entrypoints/content/content-script.ts (add handshake post)

window.postMessage({ type: '__NF_CS_READY', time: csInjectTime }, '*');
```

**No polling** (khác iQIYI): Netflix manifest fetch trigger bởi player load, không cần poll `window.netflix`. `JSON.parse` hook capture tự động. SPA nav → player fetch manifest mới → hook fire.

**Dedup by `movieId`**: Netflix `result.movieId` = video ID (different across episodes). Clone YouTube `videoId` / iQIYI `tvid` pattern (string-based `?? ''`, NOT `?? 0`).

### Contract 8 — Debug surface (clone iQIYI `__IQ_DEBUG` pattern)

```typescript
// src/entrypoints/content/netflix-main-world.iife.ts

declare const __NF_MAIN_WORLD_INJECTED: true;  // FR-1 verify marker
const __NF_DEBUG = {
  captureCount: 0,          // JSON.parse hook fire count (FR-3 verify, MSL Worker drift detector)
  stringifyModifiedCount: 0, // JSON.stringify hook modify count (FR-2 request-shape drift detector)
  repostCount: 0,           // handshake re-post count (CRXJS late-inject race verify)
  lastMovieId: null as string | number | null,  // last captured movieId
  lastError: null as string | null,             // last hook error (defensive catch)
  hookMiss: false,          // true if captureCount===0 after 10s playback (NFR-2 diagnostic)
};
window.__NF_MAIN_WORLD_INJECTED = true;
window.__NF_DEBUG = __NF_DEBUG;
```

**Clone `iqiyi-main-world.iife.ts:32-49` field set** — iQIYI uses `__IQ_DEBUG.{detectCalls, lastTvid, ...}`. Netflix adds `stringifyModifiedCount` + `repostCount` + `hookMiss` cho request-shape drift + handshake race + MSL Worker ceiling diagnostics.

**Drift detectors**:
- `captureCount === 0` after 10s → MSL Worker ceiling hit (NFR-2 console.warn + `hookMiss = true`)
- `stringifyModifiedCount === 0` after manifest request → JSON.stringify hook payload shape changed (Netflix wrapped `url`/`profiles[]`) → only 5-10 languages detected
- `repostCount > 0` → handshake late-inject race fired (CRXJS async loader delay confirmed)

## Alternatives considered

### A. Intercept CMAF segment range requests + parse fragmented MP4
- **Pro**: không phụ thuộc `JSON.parse` hook (robust nếu Netflix đổi MSL flow)
- **Con**: phức tạp (parse MP4 binary, extract TTML cues), chậm (reassemble segments), chỉ tracks user select (không `showAllSubDubTracks`)
- **Reject**: hiệu năng + thời gian + UX kém hơn hook approach. Giữ làm fallback ceiling nếu hook miss (future work, không G4).

### B. `getTextTrackList()` API cho download URLs
- **Pro**: API stable, không cần hook
- **Con**: `getTextTrackList()` chỉ trả metadata (bcp47, displayName), **không có download URLs** (verified — `ttDownloadables` nằm trong player closure, không expose)
- **Reject**: không lấy được download URLs. Chỉ dùng cho UI listing fallback (không G4).

### C. Poll `window.netflix` cho manifest cache
- **Pro**: không hook global
- **Con**: `ttDownloadables` không nằm trong `window.netflix` tree (verified — search toàn bộ tree, 0 matches). Nằm trong player closure.
- **Reject**: không accessible.

## Consequences

- **+** Netflix subtitle auto-load hoạt động ngay khi video play (1 HTTP GET = complete WebVTT/DFXP file)
- **+** Tất cả 33 languages có sẵn (`showAllSubDubTracks = true`), không chỉ user locale
- **+** Reuse 100% post-map flow (detectionDispatch.ts + auto-load + overlay + download-all)
- **+** BCP 47 language match `languageRegistry.ts` directly — không cần map table (khác iQIYI `LID_TO_ISO`)
- **−** Hook `JSON.parse` + `JSON.stringify` global — nhẹ (filter bằng url pattern + result shape), nhưng có thể break nếu Netflix đổi manifest flow
- **−** CMAF fallback (parse MP4 binary) không implement G4 — ceiling nếu hook miss, user reload page để re-trigger
- **−** TTML-only tracks skipped G4 (ponytail ceiling: no TTML parser in codebase) — WebVTT-first, G5 verify if ttml-only content exists → add `convertTtmlToSrt` lúc đó

## Verification plan (G5)

1. **Unit test**: `extractNetflixTracks` + `mapNetflixSubtitleTracks` với mock manifest payload (42 tracks sample)
2. **Drift detector**: Netflix track shape (bcp47, ttDownloadables keys) — clone iQIYI drift pattern
3. **Browser verify (MCP)**: load unpacked extension → navigate netflix.com/watch/XXX → confirm `__NF_DETECTED_SUBTITLES` post → confirm DETECTED_SUBTITLES bg handler → confirm overlay auto-load
4. **SPA nav verify**: switch episode → confirm re-detect (movieId change → manifest fetch → hook fire)
5. **Format verify**: fetch downloadUrl → confirm WebVTT content → confirm `parseVtt` success
