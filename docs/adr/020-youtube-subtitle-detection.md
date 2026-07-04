# ADR-020: YouTube Subtitle Detection — Interface Contracts

> G3 Design. Code-to-code contracts cho YouTube subtitle detection feature.
> Input: `docs/specs/spec-youtube-subtitle-detection.md` + `docs/plan/plan-youtube-subtitle-detection.md`.
> Research: `docs/reference/youtube-subtitle-format-research.md`.

## Context

YouTube subtitle detection cần 3 module mới + 4 module modify + manifest change. Cần define interface contracts trước G4 để:
- Module boundaries rõ (MAIN world script không leak, ISOLATED listener không biết parse logic)
- Parallel implementation possible (M2 pure logic + M4 MAIN world + M5 background độc lập nếu contract chốt)
- Hyrum's Law mitigation — expose minimum, hide implementation
- MAIN↔ISOLATED message contract explicit (review CRITICAL #2)

## Decision: 7 interface contracts

### Contract 1 — `YouTubeCaptionTrack` (pure data, MAIN world parse target)

```typescript
// src/features/detection/logic/youtubeSubtitleDetector.ts

/** YouTube caption track from ytInitialPlayerResponse (subset of fields used). */
export interface YouTubeCaptionTrack {
  readonly baseUrl: string;
  readonly languageCode: string;
  readonly kind?: string;        // "asr" = auto-generated; absent = manual
  readonly name?: { readonly simpleText?: string };
  readonly vssId?: string;
  readonly isTranslatable?: boolean;
}

/** Extract captionTracks từ ytInitialPlayerResponse safely (defensive parsing). */
export function extractCaptionTracks(
  playerResponse: unknown,
): YouTubeCaptionTrack[];

/**
 * Map YouTube captionTracks → DetectedSubtitle[] for auto-load flow.
 * Appends `&fmt=vtt` to baseUrl (reuse parseVtt). Strips `xosf` param.
 * Skips tracks requiring PO Token (exp=xpe|xpv) — graceful degradation.
 */
export function mapYouTubeCaptionTracks(
  tracks: readonly YouTubeCaptionTrack[],
  tabId: number,
): DetectedSubtitle[];
```

**Source**: yt-dlp `_video.py` line 4265-4290, ytranscript HOW_IT_WORKS.md

### Contract 2 — `DetectedSubtitle` entity extension (backward compatible)

```typescript
// src/entities/media/types.ts (UPDATE — add 2 optional fields)

export interface DetectedSubtitle {
  readonly id: string;
  readonly url: string;
  readonly format: SubtitleFormat;
  readonly language: string;
  readonly tabId: number;
  readonly detectedAt: number;
  readonly videoId?: string;      // existing
  readonly size?: number;         // existing
  readonly isAsr?: boolean;       // NEW — YouTube ASR tracks (kind === "asr")
  readonly displayName?: string;  // NEW — YouTube "English (auto-generated)"
}
```

**Backward compatible**: generic detector không set `isAsr`/`displayName` → undefined → existing sites không break. UI check `isAsr === true` (not truthy) để render badge.

### Contract 3 — MAIN↔ISOLATED `postMessage` bridge (review fix #2)

```typescript
// src/entrypoints/content/youtube-main-world.iife.ts (MAIN world → ISOLATED)

/** MAIN→ISOLATED message: YouTube caption tracks detected. */
interface YTDetectedSubtitlesMessage {
  readonly type: '__YT_DETECTED_SUBTITLES';
  readonly tracks: YouTubeCaptionTrack[];
  readonly videoId: string;
}

/** MAIN→ISOLATED message: InnerTube fallback request (MAIN can't fetch with User-Agent). */
interface YTInnerTubeFallbackMessage {
  readonly type: '__YT_INNERTUBE_FALLBACK';
  readonly videoId: string;
  readonly apiKey: string;  // extracted from page HTML
}

// MAIN world posts:
window.postMessage({ type: '__YT_DETECTED_SUBTITLES', tracks, videoId }, '*');
```

```typescript
// src/entrypoints/content/content-script.ts (ISOLATED listener → background)

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (data?.type === '__YT_DETECTED_SUBTITLES') {
    void sendMessage({
      type: MESSAGE_TYPES.DETECTED_SUBTITLES,
      payload: { tracks: data.tracks, videoId: data.videoId, tabId: <current> },
    });
  } else if (data?.type === '__YT_INNERTUBE_FALLBACK') {
    void sendMessage({
      type: MESSAGE_TYPES.INNERTUBE_FALLBACK_REQUEST,
      payload: { videoId: data.videoId, apiKey: data.apiKey, tabId: <current> },
    });
  }
});
```

**Precedent**: `fetchInterceptor.iife.ts` (ADR-011) — same `window.postMessage` pattern, proven working.

### Contract 4 — `DETECTED_SUBTITLES` background handler (Path B entry point)

```typescript
// src/entrypoints/background/handlers/youtubeDetection.ts (NEW)

/** Handle DETECTED_SUBTITLES: map tracks → DetectedSubtitle[] → existing auto-load flow. */
export async function handleDetectedSubtitles(
  payload: { tracks: YouTubeCaptionTrack[]; videoId: string; tabId: number },
  deps: { settings: Settings; origin: string },
): Promise<void> {
  const subtitles = mapYouTubeCaptionTracks(payload.tracks, payload.tabId);
  // Store detected subtitles → trigger existing auto-load flow
  // (findSubtitlesForOverlay → pushAutoLoadSubtitles)
}
```

**Note**: Background không change `detectSubtitle` dispatch (review fix #8). Đây là handler mới, riêng cho `DETECTED_SUBTITLES` message type.

### Contract 5 — InnerTube fallback (MAIN world fetch, ANDROID client — revised 2026-07-04)

```typescript
// src/features/detection/logic/youtubeInnertube.ts (revised)

/** InnerTube fallback: POST /youtubei/v1/player (ANDROID client — NO PO Token). */
export async function fetchCaptionTracksViaInnerTube(
  videoId: string,
  apiKey: string,
  visitorData?: string,
): Promise<YouTubeCaptionTrack[]>;

/** Extract INNERTUBE_API_KEY from page HTML (MAIN world, regex). */
export function extractInnertubeApiKey(html: string): string | null;
```

**Browser verify 2026-07-04 (revised)**:
- WEB client `ytInitialPlayerResponse` tracks ALL have `exp=xpe` (PO Token required, ephemeral). Fetching VTT without PO Token returns empty (200 OK, 0 bytes).
- ANDROID InnerTube client returns tracks with `exp=null` (NO PO Token). Verified on `YQHsXMglC9A` — VTT fetch returns 18019 bytes WebVTT, 139 cues parsed.
- ANDROID client works from PAGE context (has YouTube cookies + origin). Background SW fetch returns 403 (no cookies/origin — cross-origin block).
- ANDROID client works WITHOUT User-Agent override (verified empirically — API accepts browser's default User-Agent).
- **Architecture change**: InnerTube fetch moved from background SW → MAIN world script (page context has cookies + origin). MAIN world fetches ANDROID client → postMessage `__YT_DETECTED_SUBTITLES` → ISOLATED content-script relays to background → auto-load.

**Constraint**: Content script KHÔNG set `User-Agent` (forbidden header — MDN). ANDROID client works without User-Agent override (empirically verified). MAIN world fetch (page context) required — SW fetch 403s (no cookies/origin).

### Contract 6 — SPA re-detect (`yt-navigate-finish` + videoId dedup, review fix #5)

```typescript
// src/entrypoints/content/youtube-main-world.iife.ts (MAIN world)

let lastVideoId: string | null = null;

function detectYouTubeSubtitles(): void {
  const playerResponse = (window as any).ytInitialPlayerResponse;
  if (!playerResponse?.videoDetails?.videoId) return;
  const videoId = playerResponse.videoDetails.videoId;
  if (videoId === lastVideoId) return;  // dedup
  lastVideoId = videoId;
  const tracks = extractCaptionTracks(playerResponse);
  if (tracks.length > 0) {
    window.postMessage({ type: '__YT_DETECTED_SUBTITLES', tracks, videoId }, '*');
  } else {
    // Fallback: extract INNERTUBE_API_KEY, request InnerTube fallback
    const apiKey = extractInnertubeApiKey(document.documentElement.innerHTML);
    if (apiKey) {
      window.postMessage({ type: '__YT_INNERTUBE_FALLBACK', videoId, apiKey }, '*');
    }
  }
}

// Primary trigger: YouTube SPA custom event
window.addEventListener('yt-navigate-finish', () => {
  // Race condition: ytInitialPlayerResponse may not be updated yet → poll
  pollForVideoIdChange(2000);  // timeout 2s
});

// Fallback trigger: popstate + pushState hook
window.addEventListener('popstate', () => pollForVideoIdChange(2000));

function pollForVideoIdChange(timeoutMs: number): void {
  const start = Date.now();
  const interval = setInterval(() => {
    const playerResponse = (window as any).ytInitialPlayerResponse;
    const currentVideoId = playerResponse?.videoDetails?.videoId;
    if (currentVideoId && currentVideoId !== lastVideoId) {
      clearInterval(interval);
      detectYouTubeSubtitles();
    } else if (Date.now() - start > timeoutMs) {
      clearInterval(interval);
    }
  }, 100);
}

// Initial detection on script load
detectYouTubeSubtitles();
```

**Note**: NOT reuse ADR-010 `reportEpisodeChangedIfReplacement` — YouTube SPA reuse same `<video>` element (only src changes) → element-identity watcher không fire.

### Contract 7 — Manifest content_scripts entry (review fix #6)

```json
// public/manifest.json (UPDATE — add 3rd content_scripts entry)

{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/entrypoints/content/content-script.ts"],
      "run_at": "document_idle",
      "all_frames": true,
      "match_origin_as_fallback": true
    },
    {
      "matches": ["<all_urls>"],
      "js": ["src/entrypoints/content/fetchInterceptor.iife.ts"],
      "run_at": "document_start",
      "world": "MAIN",
      "all_frames": true,
      "match_origin_as_fallback": true
    },
    {
      "matches": ["*://*.youtube.com/*"],
      "js": ["src/entrypoints/content/youtube-main-world.iife.ts"],
      "run_at": "document_start",
      "world": "MAIN",
      "all_frames": false
    }
  ]
}
```

**Scoped `*://*.youtube.com/*`** — avoid overhead non-YouTube pages (NF3). `.iife.ts` suffix per CRXJS convention (consistent với `fetchInterceptor.iife.ts`). `all_frames: false` — YouTube player chỉ ở top frame.

## Alternatives Considered

### A1: Adapter registry refactor `subtitleDetector.ts`
- **Rejected** (review CRITICAL #1): `detectSubtitle(NetworkRequest)` không có origin → không dispatch by hostname. YouTube timedtext URL match 0 pattern → `detectSubtitle` return null anyway. YAGNI — defer đến khi có 2nd adapter thật sự.

### A2: `CustomEvent` MAIN↔ISOLATED bridge
- **Rejected** (review CRITICAL #2): Contradict `fetchInterceptor.iife.ts` (ADR-011) proven `window.postMessage` pattern. Consistency > personal preference.

### A3: ANDROID client InnerTube (revised 2026-07-04)
- **Accepted** (browser verify 2026-07-04): ANDROID InnerTube client returns tracks WITHOUT PO Token (`exp=null`). Works from PAGE context (MAIN world) — SW fetch 403s (no cookies/origin). ANDROID client works WITHOUT User-Agent override (empirically verified). This is now the PRIMARY detection path — WEB client tracks all require PO Token (ephemeral).

### A4: ADR-010 `reportEpisodeChangedIfReplacement` for SPA
- **Rejected** (review HIGH #5): YouTube SPA reuse same `<video>` element (only src changes) → element-identity watcher không fire. `yt-navigate-finish` + videoId dedup là correct signal.

### A5: `&fmt=json3` thay `&fmt=vtt`
- **Rejected** (ponytail): JSON3 cần adapter mới, VTT reuse `parseVtt` (rung 2). VTT đủ `{start, end, text}` cho overlay. G1 verify: `stripSubtitleTags` handle YouTube non-standard tags.

## Consequences

- **Positive**: YouTube detection hoạt động proactive, reuse 100% downstream flow (auto-load, overlay, bilingual). Generic detector untouched (no regression). Extensible — thêm Netflix/iQIYI sau = new MAIN world script + new message type, không refactor.
- **Negative**: 3rd content_scripts entry (manifest complexity +1). MAIN world script phải self-contained (no extension APIs, no imports). InnerTube fallback phụ thuộc background SW alive (MV3 SW restart risk — mitigate bằng re-detect trên SPA nav).
- **Neutral**: `DetectedSubtitle` entity +2 optional fields — backward compatible, no migration.

## Sources

- yt-dlp `_video.py` line 4265-4290 (captionTracks extraction)
- ytranscript HOW_IT_WORKS.md (Innertube API, json3 format)
- MDN WebVTT API (VTT standard)
- MDN Forbidden header names (User-Agent constraint)
- ADR-011 `fetchInterceptor.iife.ts` (MAIN↔ISOLATED postMessage precedent)
- Spec review `docs/reviews/review-youtube-subtitle-detection.md` (3 CRITICAL + 4 HIGH fixes)
