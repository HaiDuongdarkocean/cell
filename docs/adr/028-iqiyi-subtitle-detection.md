# ADR-028: iQIYI Subtitle Detection — Interface Contracts

> G3 Design. Code-to-code contracts cho iQIYI subtitle detection feature.
> Input: `docs/specs/spec-iqiyi-subtitle-detection.md`.
> Research: stress test thực tế qua edge-devtools MCP 2026-07-12 (free ep56 + VIP ep51).
> Precedent: ADR-020 (YouTube subtitle detection — cùng pattern MAIN-world manifest extraction).

## Context

iQIYI subtitle detection cần 3 module mới + 3 module modify + manifest change. Cần define interface contracts trước G4 để:
- Module boundaries rõ (MAIN world script không leak, ISOLATED listener không biết parse logic)
- Parallel implementation possible (M2 pure logic + M4 MAIN world + M5 background độc lập nếu contract chốt)
- Hyrum's Law mitigation — expose minimum, hide implementation
- MAIN↔ISOLATED message contract explicit (clone ADR-020 pattern)
- Reuse `DETECTED_SUBTITLES` message type — background handler phân biệt YT vs IQ bằng payload shape (không duplicate handler)

## Decision: 7 interface contracts

### Contract 1 — `IqiyiSubtitleTrack` (pure data, MAIN world parse target)

```typescript
// src/features/detection/logic/iqiyiSubtitleDetector.ts

/** iQIYI subtitle track from window.playerObject.stl (subset of fields used). */
export interface IqiyiSubtitleTrack {
  readonly _name: string;       // "Vietnamese", "English", ...
  readonly lid: number;          // language ID (1=zh-hans, 23=vi, ...)
  readonly ss: number;           // 0=human, 1=AI-generated
  readonly srt: string;          // relative path to SRT (e.g. "/20260115/6c/7b/c112...srt?...")
  readonly webvtt?: string;
  readonly xml?: string;
  readonly _limited?: number;
  readonly uuid?: string;
}

/**
 * Safely extract stl[] from an unknown playerObject payload (defensive parsing).
 * Deep path: package.engine.movieinfo.current.originalData.data.program.stl
 * Returns [] when structure missing/malformed — caller treats empty as
 * "no subtitle" (trigger overlay clear on SPA nav).
 */
export function extractIqiyiStl(playerObject: unknown): IqiyiSubtitleTrack[];

/**
 * Map IQ stl[] → DetectedSubtitle[] for auto-load flow.
 * - url = new URL(entry.srt, origin).href (full URL, format 'srt')
 * - language = LID_TO_ISO[entry.lid] (skip unknown lid + console.warn)
 * - isAsr = entry.ss === 1
 * - displayName = entry._name
 * - initiator = 'https://www.iq.com/' (Referer cho CORS fallback)
 */
export function mapIqiyiSubtitleTracks(
  tracks: readonly IqiyiSubtitleTrack[],
  tabId: number,
  origin: string,
): DetectedSubtitle[];
```

**Source**: stress test 2026-07-12 (free ep56 `c4ww2kwbfg` + VIP ep51 `l10pr7s8ho`), gist FabioBaroni, meokisama/iqiyi-subs.

### Contract 2 — `DetectedSubtitle` entity (NO extension — reuse ADR-020)

```typescript
// src/entities/media/types.ts (UNCHANGED — ADR-020 đã add fields)

export interface DetectedSubtitle {
  readonly id: string;
  readonly url: string;
  readonly format: SubtitleFormat;   // IQ: 'srt'
  readonly language: string;          // IQ: LID_TO_ISO[lid] ('vi', 'en', ...)
  readonly tabId: number;
  readonly detectedAt: number;
  readonly isAsr?: boolean;           // IQ: ss === 1
  readonly displayName?: string;      // IQ: _name ("Vietnamese")
  readonly initiator?: string;        // IQ: 'https://www.iq.com/'
  // ... existing fields
}
```

**No new fields** — ADR-020 đã add `isAsr`, `displayName`, `initiator`. IQ adapter set cả 3. Backward compatible (generic detector không set → undefined → existing sites không break).

### Contract 3 — MAIN↔ISOLATED `postMessage` bridge (clone ADR-020)

```typescript
// src/entrypoints/content/iqiyi-main-world.iife.ts (MAIN world → ISOLATED)

/** MAIN→ISOLATED message: iQIYI subtitle tracks detected. */
interface IQDetectedSubtitlesMessage {
  readonly type: '__IQ_DETECTED_SUBTITLES';
  readonly tracks: IqiyiSubtitleTrack[];
  readonly tvid: string;     // dedup key (clone YouTube videoId)
  readonly origin: string;   // data.dstl — base URL cho relative srt path (dynamic, không hardcode)
}

// MAIN world posts:
window.postMessage({ type: '__IQ_DETECTED_SUBTITLES', tracks, tvid, origin }, '*');
```

```typescript
// src/entrypoints/content/content-script.ts (ISOLATED listener → background)

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (data?.type === '__IQ_DETECTED_SUBTITLES') {
    const tvid = (data as { tvid?: string }).tvid ?? '';
    // Dedup by tvid: MAIN world re-posts on __IQ_CS_READY handshake (clone ADR-020 race fix)
    const lastRelayedTvid = (window as unknown as Record<string, unknown>).__IQ_LAST_RELAYED_TVID as string | undefined;
    if (tvid && lastRelayedTvid === tvid) return;
    (window as unknown as Record<string, unknown>).__IQ_LAST_RELAYED_TVID = tvid;
    void sendMessage({
      type: MESSAGE_TYPES.DETECTED_SUBTITLES,  // REUSE ADR-020 message type
      payload: { tracks: data.tracks, tvid, tabId: undefined, source: 'iqiyi', origin: data.origin },
    });
  }
});
```

**Precedent**: `fetchInterceptor.iife.ts` (ADR-011) + `youtube-main-world.iife.ts` (ADR-020) — same `window.postMessage` pattern, proven working.

**`source: 'iqiyi'` discriminator**: background handler phân biệt YT vs IQ payload. YT tracks có `baseUrl`/`languageCode`/`kind`, IQ tracks có `srt`/`lid`/`ss`. Handler dispatch bằng `source` field (explicit) hoặc shape inspection (implicit). **Choose `source` field** — explicit > implicit, dễ debug, không ambiguous khi 2 adapter có field trùng tên.

### Contract 4 — `DETECTED_SUBTITLES` background handler (unified dispatch — ADR-020 amend)

**CRITICAL**: `messageBus.on()` dùng `handlers.set(type, handler)` — **overwrite** handler trước đó (xem `messageBus.ts` dòng 32). 2 handlers register cùng `DETECTED_SUBTITLES` → handler sau overwrite handler trước → YouTube detection break. **Must use 1 unified handler + `source` field dispatch**.

```typescript
// src/entrypoints/background/handlers/detectionDispatch.ts (NEW — replaces youtubeDetection.ts DETECTED_SUBTITLES registration)

/**
 * Unified DETECTED_SUBTITLES handler — dispatch by `payload.source`.
 * - source === 'youtube' (or undefined for backward compat ADR-020) → mapYouTubeCaptionTracks
 * - source === 'iqiyi' → mapIqiyiSubtitleTracks
 * Both branches share: map → store → broadcast → pushAutoLoadSubtitles (clone ADR-020 logic).
 */
export function registerDetectionDispatchHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.DETECTED_SUBTITLES, async (request): Promise<MessageResponse> => {
    const payload = request.payload as DetectedSubtitlesPayload & { source?: string; tvid?: string };
    const tabId = payload.tabId ?? (await getActiveTabId(ctx));
    if (tabId === undefined) return { success: false, error: 'Missing tabId' };

    const source = payload.source;
    let subtitles: DetectedSubtitle[];
    if (source === 'iqiyi') {
      // IQ: origin from data.dstl (dynamic, not hardcode) — MAIN world passes dstl via payload
      subtitles = mapIqiyiSubtitleTracks(payload.tracks as IqiyiSubtitleTrack[], tabId, payload.origin ?? 'https://meta.video.iqiyi.com');
    } else {
      // YouTube (source === 'youtube' or undefined — backward compat ADR-020)
      subtitles = mapYouTubeCaptionTracks(payload.tracks as YouTubeCaptionTrack[], tabId);
    }

    if (subtitles.length === 0) {
      // SPA nav from video WITH subtitle → video WITHOUT → clear overlay (clone ADR-020 logic)
      ctx.networkInterceptor.clearTab(tabId);
      ctx.autoDownloadedTabs.delete(tabId);
      ctx.lastCuesByTab.delete(tabId);
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE, payload: { videos: ctx.networkInterceptor.getVideos(tabId), subtitles: [], tabId } });
      updateBadgeForTab(ctx, tabId);
      await sendTabMessage(tabId, { type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES, payload: { tabId, target: null, native: null, targetMatches: [], nativeMatches: [] } });
      return { success: true };
    }

    const added = ctx.networkInterceptor.addDetectedSubtitles(subtitles);
    if (added > 0) {
      const allSubtitles = ctx.networkInterceptor.getSubtitles(tabId);
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE, payload: { videos: ctx.networkInterceptor.getVideos(tabId), subtitles: allSubtitles, tabId } });
      updateBadgeForTab(ctx, tabId);
      void pushAutoLoadSubtitles(ctx, tabId, allSubtitles);
    }
    return { success: true };
  });
}
```

**ADR-020 amend**: `youtubeDetection.ts` hiện tại register `DETECTED_SUBTITLES` handler (dòng 39-109). **Move** logic này sang `detectionDispatch.ts` (unified). `youtubeDetection.ts` giữ lại chỉ `INNERTUBE_FALLBACK_REQUEST` handler (IQ không cần fallback). `index.ts` thay `registerYouTubeDetectionHandlers` → `registerDetectionDispatchHandlers` + `registerYouTubeFallbackHandlers` (tách 2 concern).

**Why unified not 2 handlers**: `messageBus.on()` overwrite (Map.set). 2 handlers = 1 thắng 1 thua. Unified + `source` dispatch = 1 handler, 2 branches, explicit. Duplicate logic chỉ 3 dòng (map + store + broadcast) — không đáng tách file. Ponytail: 1 file unified < 2 files + amend messageBus.

### Contract 5 — Polling + tvid dedup + SPA re-detect

```typescript
// src/entrypoints/content/iqiyi-main-world.iife.ts (MAIN world)

let lastTvid: string | null = null;
let lastDetectedTracks: IqiyiSubtitleTrack[] = [];
let lastDetectedTvid: string | null = null;

function getPlayerObject(): unknown {
  return (window as unknown as { playerObject?: unknown }).playerObject;
}

function getTvid(playerObject: unknown): string | null {
  // Deep path: package.engine.movieinfo.current.originalData.data.tvid
  // Fallback: current.tvid (top-level current)
  try {
    const cur = (playerObject as any)?.package?.engine?.movieinfo?.current;
    return cur?.originalData?.data?.tvid ?? cur?.tvid ?? null;
  } catch { return null; }
}

async function detect(): Promise<boolean> {
  const playerObject = getPlayerObject();
  if (!playerObject) return false;  // not ready yet, poll continues
  const tvid = getTvid(playerObject);
  if (!tvid || tvid === lastTvid) return false;
  const tracks = extractIqiyiStl(playerObject);
  // origin = data.dstl (dynamic, IQ có thể đổi CDN) — upgrade HTTP→HTTPS (stress test ep56 dstl="http://...", fetch HTTPS work)
  const dstl = (playerObject as any)?.package?.engine?.movieinfo?.current?.originalData?.data?.dstl ?? 'http://meta.video.iqiyi.com';
  const origin = dstl.replace(/^http:/, 'https:');
  // Commit lastTvid only after extract succeeds — if stl is late (playerObject
  // ready but stl not yet loaded), next poll re-tries same tvid instead of
  // deduplicating and never reporting. (spec-reviewer risk #4 fix)
  lastTvid = tvid;
  lastDetectedTracks = tracks.length > 0 ? tracks : lastDetectedTracks;
  lastDetectedTvid = tracks.length > 0 ? tvid : lastDetectedTvid;
  // Always post (0-track post = SPA nav to no-subtitle video → clear overlay, clone ADR-020)
  window.postMessage({ type: '__IQ_DETECTED_SUBTITLES', tracks, tvid, origin }, '*');
  return tracks.length > 0;  // signal polling to stop on success
}

// Primary trigger: poll on page load (playerObject available ~3-7s after load)
let pollInterval: ReturnType<typeof setInterval> | null = null;
function startPolling(timeoutMs = 15000): void {
  const start = Date.now();
  pollInterval = setInterval(async () => {
    if (Date.now() - start > timeoutMs) { if (pollInterval) clearInterval(pollInterval); pollInterval = null; return; }
    const success = await detect();
    if (success && pollInterval) { clearInterval(pollInterval); pollInterval = null; }  // stop on non-empty detect
  }, 1000);
  // ponytail: ceiling — poll timeout 15s nếu player init chậm (slow network).
  // Upgrade: MutationObserver trên <video> element.
}

// SPA trigger: IQ uses history API (no custom event like yt-navigate-finish)
// ponytail: ceiling — IQ có thể override history.pushState sau hook → mất hook.
// Upgrade: re-hook nếu phát hiện override, hoặc MutationObserver trên URL.
const origPushState = history.pushState;
history.pushState = function (...args) { const r = origPushState.apply(this, args); if (!pollInterval) startPolling(); else void detect(); return r; };
window.addEventListener('popstate', () => { if (!pollInterval) startPolling(); else void detect(); });

// Handshake: content-script posts __IQ_CS_READY when ISOLATED listener registered
// (clone ADR-020 race fix — CRXJS async loader delays ISOLATED injection)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;  // guard first, then check type (mirror youtube-main-world.iife.ts — spec-reviewer risk #3 fix)
  const data = event.data as { type?: string } | null;
  if (data?.type === '__IQ_CS_READY' && lastDetectedTracks.length > 0 && lastDetectedTvid) {
    const dstl = (window as any).playerObject?.package?.engine?.movieinfo?.current?.originalData?.data?.dstl ?? 'http://meta.video.iqiyi.com';
    const origin = dstl.replace(/^http:/, 'https:');
    window.postMessage({ type: '__IQ_DETECTED_SUBTITLES', tracks: lastDetectedTracks, tvid: lastDetectedTvid, origin }, '*');
  }
});
```

**Verify 2026-07-12**: `playerObject` available ~4-7s sau navigate (stress test ep56 wait 4s + ep51 wait 7s). Poll 1s interval catch được. `tvid` stable per episode (ep56 `1148400684481200`, ep51 `2220094256397200`).

### Contract 6 — Language map (`lid` → ISO 639-1)

```typescript
// src/features/detection/logic/iqiyiSubtitleDetector.ts

/** iQIYI numeric language ID → ISO 639-1 (lowercase, matches auto-load flow). */
const LID_TO_ISO: Readonly<Record<number, string>> = {
  1: 'zh-hans',   // Simplified Chinese
  2: 'zh-hant',   // Traditional Chinese
  3: 'en',        // English
  4: 'ko',        // Korean
  5: 'ja',        // Japanese
  6: 'fr',        // French
  18: 'th',       // Thai
  21: 'ms',       // Bahasa Malaysia
  23: 'vi',       // Vietnamese
  24: 'id',       // Bahasa Indonesia
  26: 'es',       // Spanish
  30: 'de',       // German
};

/** Unknown lid → skip track + console.warn (graceful degradation, clone YouTube PO Token skip). */
```

**Verify 2026-07-12**: 12 ngôn ngữ ep56 + 11 ngôn ngữ ep51, tất cả match map table. `zh-hans`/`zh-hant` dùng IETF tag (consistent với YouTube `languageCode` lowercase).

**Ceiling**: IQ thêm `lid` mới chưa trong map → skip + warn. Upgrade: fetch IQ language list API (nếu có) hoặc user-configurable map.

### Contract 7 — Referer / CORS fallback (reuse ADR-007 + declarativeNetRequest)

```typescript
// DetectedSubtitle.initiator = 'https://www.iq.com/'
// fetchAndParseSubtitle(url, 'srt', tabUrl, 'https://www.iq.com/')
//   → content-script fetch (page context, browser sets Referer) → work
//   → CORS fail → background SW fetch + declarativeNetRequest set Referer
//     (Cell đã có pattern: commit 700b901, ADR-007 A7, knowledge forbidden-header-referer-dnr.md)
```

**Verify 2026-07-12**:
- Content-script fetch `credentials:'omit'` → 200 OK (CORS `access-control-allow-origin:*`)
- Content-script fetch `credentials:'include'` → TypeError (CORS `*` không tương thích credentials)
- Navigate trực tiếp URL subtitle → `ERR_ABORTED` (server check Referer, không có `https://www.iq.com/`)
- Player fetch (network reqid=530) → 200 OK với `referer: https://www.iq.com/` + `origin: https://www.iq.com/`

**No new declarativeNetRequest rule** — Cell đã có pattern (commit 700b901) set Referer cho subtitle CDN. IQ reuse cùng rule shape (origin `https://www.iq.com/` thay vì per-site). **Verify BUILD phase**: check `declarativeNetRequest` config hiện tại có cover `meta.video.iqiyi.com` không, nếu không thì add rule.

## Consequences

- **+** Reuse toàn bộ auto-load flow (findSubtitlesForOverlay, pushAutoLoadSubtitles, fetchAndParseSubtitle, parseSrt) — không duplicate
- **+** Reuse ADR-020 pattern (MAIN world bridge, postMessage, handshake, dedup) — proven working
- **+** Reuse DetectedSubtitle entity (ADR-020 đã add fields) — no entity change
- **+** Reuse DETECTED_SUBTITLES message type — 1 message type, 2 handlers + source dispatch
- **−** 3 file mới (iqiyiSubtitleDetector.ts, iqiyi-main-world.iife.ts, detectionDispatch.ts) + 4 file modify (content-script.ts, manifest.json, background/index.ts, youtubeDetection.ts — tách DETECTED_SUBTITLES ra) — minimal diff
- **−** Polling 1s × 15s timeout — overhead nhỏ (playerObject read, no network), acceptable
- **−** `source: 'iqiyi'` discriminator thêm vào DETECTED_SUBTITLES payload — YT handler cần ignore (early-return khi `source !== 'youtube'` và `source` undefined cho backward compat)

## Alternatives considered

1. **Network interception (Path A)**: IQ subtitle URL có hash path `/20260115/6c/7b/c112...srt` — match `.srt` extension → generic `subtitleDetector.ts` có thể detect. **Reject** vì: (a) player chỉ load subtitle default (English `_selected:true`), không có full manifest → user phải switch language thủ công mới trigger request; (b) URL có `qd_tm` timestamp expire → cached URL stale; (c) không có `lid` → không biết language → auto-load không match. MAIN-world manifest extraction lấy hết 12 ngôn ngữ cùng lúc + có `lid` → auto-load work ngay.

2. **API backend IQ**: không có API công khai. Manifest chỉ trong `playerObject` (client-side). **Reject** — không có alternative.

3. **Adapter registry**: 3 path (A generic + B YouTube + C IQ) → có thể refactor thành registry. **Defer** (YAGNI — ADR-020 đã quyết định, 4th adapter mới refactor).

4. **Message type riêng `IQ_DETECTED_SUBTITLES`**: reject vì duplicate handler logic (map → store → auto-load identical). 1 message type + `source` dispatch gọn hơn.

5. **WebVTT thay SRT**: Anh yêu đã quyết định SRT (output cuối Cell = SRT, không cần convert). IQ có sẵn cả 3 format (srt/webvtt/xml), dùng `entry.srt` trực tiếp.

## BUILD-phase corrections

1. **Dedup key is `tvid`, not `vid`**. Stress test 2026-07-12 showed `vid` is a streaming session/CDN identifier that is **reused across different videos** (same `vid` for ep56 `c4ww2kwbfg` and VIP ep51 `l10pr7s8ho`). `tvid` is the per-video identifier and correctly changes across episodes. The MAIN-world script dedups by `tvid`; `vid` is not part of the `postMessage` contract.
2. **Chinese script variants**. `lid` 1 → `zh-hans` (Simplified) and `lid` 2 → `zh-hant` (Traditional). The overlay target/native dropdown in `SettingsDialog` exposes both `zh-hans` and `zh-hant` in addition to the macrolanguage `zh`. `findSubtitlesForOverlay` / `findPreferredMatch` use BCP 47 subtag-aware matching (`languageMatches`) so:
   - target `zh` matches `zh-hans`, `zh-hant`, and `zh`;
   - target `zh-hans` matches `zh-hans` (and falls back to generic `zh`);
   - target `zh-hant` matches `zh-hant` (and falls back to generic `zh`);
   - `zh-hans` does not match `zh-hant` and vice versa.

## Open questions (defer to BUILD)

1. **`qd_tm` TTL**: URL subtitle có timestamp. Chưa test expire. Nếu expire < 24h → thêm re-extract manifest logic khi user click download. Defer BUILD.
2. **declarativeNetRequest coverage**: check rule hiện tại cover `meta.video.iqiyi.com` không. Defer BUILD.
3. **IQ SPA `pushState` hook stability**: hook `history.pushState` có thể break nếu IQ override. Test BUILD.
