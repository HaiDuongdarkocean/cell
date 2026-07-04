# Spec: YouTube Subtitle Detection

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Revised — applied spec-reviewer feedback (8 updates, commit after re-review)
> **Date**: 2026-07-05 (revised 2026-07-05)
> **Intent source**: `docs/intent/intent-youtube-subtitle-detection.md`
> **Research source**: `docs/reference/youtube-subtitle-format-research.md`
> **Review**: `docs/reviews/review-youtube-subtitle-detection.md` (APPROVED_WITH_CONDITIONS, 3 CRITICAL + 4 HIGH resolved)

## Objective

YouTube subtitle được detect **proactively** ngay khi video load (không cần user bật CC thủ công) và flow qua hệ thống hiện tại (auto-load, auto-select, download-all-subtitles) giống kisskh/hoathinh3d. YouTube dùng chuẩn subtitle riêng (timedtext API, không phải .srt/.vtt URL) → hệ thống hiện tại không detect được → auto-load không trigger.

**User**: Anh yêu (language learner) — xem YouTube và muốn subtitle overlay + bilingual hoạt động ngay khi mở video.

**Why now**: YouTube là streaming platform lớn nhất thế giới. `subtitleDetector.ts` hiện tại match `.srt/.vtt/.ass` extension + `/subtitles|subs|caption|cc/` path → YouTube timedtext URL match 0 pattern → `detectSubtitle()` return null → auto-load không bao giờ trigger. UC04.1 design spec đã mô tả approach nhưng chưa implement.

**Success**:
- Mở YouTube video có caption → subtitle list tự populate tất cả caption tracks (manual + ASR) → broadcast `DETECTED_SUBTITLES` → auto-load chọn target+native language → overlay hiển thị bilingual
- Download-all-subtitles tải được file `.vtt` cho mỗi YouTube caption track
- SPA navigation (switch video không reload page) → re-detect subtitle mới, clear subtitle cũ
- ASR tracks (auto-generated) hiển thị với badge "auto" trong track list để user biết chất lượng
- PO Token risk handled gracefully — track require pot mà không có → skip + user-visible feedback (toast), không crash
- Browser verify trên real Edge/Chrome (MCP) trước commit

## Architecture — Two Detection Paths (review fix #1)

YouTube detection **bypass `detectSubtitle()` entirely** — đây là path riêng, không refactor generic detector.

```
Path A (generic — UNCHANGED): network interception
  chrome.webRequest → NetworkRequest{url, tabId} → detectSubtitle() → DetectedSubtitle[]
  + fetchInterceptor.iife.ts (MAIN world) → postMessage → DETECTED_SUBTITLE_URL
  Applies: kisskh, hoathinh3d, themoviebox, mọi site có .srt/.vtt/.ass URL

Path B (YouTube — NEW): proactive MAIN-world DOM parse
  youtube-main-world.iife.ts (MAIN world, scoped *://*.youtube.com/*)
    → read window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks
    → mapYouTubeCaptionTracks() → DetectedSubtitle[]
    → window.postMessage({ type: '__YT_DETECTED_SUBTITLES', tracks, videoId })
  content-script.ts (ISOLATED) listener → sendMessage(DETECTED_SUBTITLES) → background
  background handler → existing auto-load flow (findSubtitlesForOverlay → handleAutoLoadSubtitles)
  Applies: youtube.com, *.youtube.com, youtube-nocookie.com ONLY
```

**No adapter registry** — `subtitleDetector.ts` giữ nguyên 100% (YAGNI — ponytail rung 1). Nếu sau này thêm Netflix/iQIYI, viết spec riêng cho adapter registry khi có 2nd adapter thật sự.

## Assumptions (surface trước khi spec nội dung)

1. **Format choice: `&fmt=vtt`** — append `&fmt=vtt` vào baseUrl → reuse `parseVtt` (`src/shared/lib/parsers/vttParser.ts`). JSON3 (richer metadata) không cần vì VTT đã đủ `{start, end, text}` cho overlay. Strip `xosf` param khỏi baseUrl trước khi append `fmt=` (yt-dlp issue #13654 — gây damaged subtitles). **G1 verify (review fix #4)**: fetch real YouTube VTT sample qua MCP, run qua `parseVtt`, confirm `stripSubtitleTags` handle YouTube non-standard tags (`<c.colorE5E5E5>`, `<00:00:01.000>` inline timestamp). Nếu fail → thêm YouTube-specific tag stripping step.
2. **MAIN world injection: separate `youtube-main-world.iife.ts`** (review fix #6) — thêm content-script entry mới trong `manifest.json` với `world: 'MAIN'`, `matches: ["*://*.youtube.com/*"]` (không `<all_urls>` — avoid overhead non-YouTube). Suffix `.iife.ts` theo CRXJS convention (consistent với `fetchInterceptor.iife.ts` hiện có). MV3 native support `world: 'MAIN'` (Chrome 111+).
3. **MAIN↔ISOLATED bridge: `window.postMessage`** (review fix #2) — **adopt existing pattern** từ `fetchInterceptor.iife.ts` (ADR-011 precedent). MAIN world script `postMessage({ type: '__YT_DETECTED_SUBTITLES', tracks, videoId })` → ISOLATED `content-script.ts` listener → `sendMessage(DETECTED_SUBTITLES)` → background. **Drop `CustomEvent` lean** (NF6 revised) — consistency với working precedent, `postMessage` đã proven.
4. **SPA navigation: `yt-navigate-finish` + `videoId` dedup** (review fix #5) — **NOT reuse ADR-010 `reportEpisodeChangedIfReplacement`** (YouTube SPA reuse same `<video>` element, chỉ đổi src → ADR-010 element-identity watcher không fire). Primary trigger: `yt-navigate-finish` event (+ `popstate`/`pushState` hook fallback). **Race condition handling**: sau `yt-navigate-finish`, poll `window.ytInitialPlayerResponse.videoDetails.videoId` cho đến khi khác last-seen videoId (timeout 2s), rồi extract tracks. Dedup by videoId — re-detect same video = no-op.
5. **ASR badge UI: track list hiển thị "auto" badge** — `DetectedSubtitle` entity hiện tại không có `isAsr` field. **Thêm field `isAsr?: boolean`** (optional, backward compatible — entity đã có optional fields `videoId?`, `size?`). Generic detector không set (undefined), YouTube adapter set `true` cho `kind === "asr"`. UI (subtitle manager panel) hiển thị badge "auto" khi `isAsr === true`.
6. **Track name display: `languageCode` cho matching, `name.simpleText` cho display** — auto-load matching vẫn dùng `languageCode` (ISO 639-1) — consistent với generic detector. Track list display dùng `name.simpleText` ("English (auto-generated)") thay vì chỉ "en". **Thêm field `displayName?: string`** vào `DetectedSubtitle` (optional). Fallback khi `simpleText` absent: `languageCode` uppercase ("EN").
7. **Translation tracks (`tlang`): OUT of scope** — auto-translation chất lượng thấp (machine translation) + `xosf` damaged subtitles. Chỉ detect original caption tracks (manual + ASR), không detect translation tracks từ `translationLanguages[]`.
8. **PO Token handling: detect + skip + user-visible feedback** (review fix #7) — parse `exp` param trong baseUrl query. Nếu chứa `xpe` hoặc `xpv` → track require PO Token → skip track + `console.warn` + **toast user-visible** "YouTube subtitles cho [lang] cần PO Token — không detect được". baseUrl từ `ytInitialPlayerResponse` WEB client thường đã chứa pot token đầy đủ → đa số track không require.
9. **InnerTube fallback: route qua background SW** (review fix #3) — nếu `window.ytInitialPlayerResponse` undefined hoặc `.captions.playerCaptionsTracklistRenderer.captionTracks` empty → fallback POST `/youtubei/v1/player`. **Constraint**: content script KHÔNG set `User-Agent` (forbidden header — MDN). Route: MAIN world → postMessage → ISOLATED → `sendMessage(INNERTUBE_FALLBACK_REQUEST)` → **background SW `fetch`** (SW có thể modify headers via `declarativeNetRequest` hoặc accept WEB client response). **Drop ANDROID client claim** — dùng WEB-client InnerTube (still may hit PO Token, but honest about constraint). Cần extract `INNERTUBE_API_KEY` từ page HTML (`"INNERTUBE_API_KEY":"([^"]+)"` regex) trong MAIN world, pass qua postMessage.
10. **DetectedSubtitle entity extension (backward compatible)** — thêm 2 optional fields: `isAsr?: boolean`, `displayName?: string`. Generic detector không set → existing sites không break. YouTube adapter set cả 2.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (manifest v3) — content script `world: 'MAIN'` (Chrome 111+)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin (`.iife.ts` suffix cho MAIN world standalone bundle)
- **Testing**: Jest 30 (unit + integration), edge-devtools MCP (browser verify)
- **Platform**: Windows (PowerShell)

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test unit:        npm run test:unit
Test integration: npm run test:integration
Lint:             npm run lint
Browser verify:   edge-devtools MCP (manual — real YouTube video)
```

## Project Structure

```
src/
├── features/
│   ├── detection/
│   │   ├── logic/
│   │   │   ├── subtitleDetector.ts        # UNCHANGED — generic URL-pattern detector (Path A, no refactor)
│   │   │   ├── youtubeSubtitleDetector.ts # NEW — mapYouTubeCaptionTracks (captionTracks → DetectedSubtitle[])
│   │   │   └── youtubeInnertube.ts        # NEW — InnerTube fallback (WEB client, background SW fetch)
│   │   └── index.ts
│   └── subtitle/
│       └── ui/
│           ├── contentScriptController.ts  # UPDATE — wire YouTube SPA re-detect (yt-navigate-finish listener)
│           └── subtitleManagerPanel.ts     # UPDATE — render ASR badge + displayName (optional fields)
├── entrypoints/
│   ├── content/
│   │   ├── content-script.ts              # UPDATE — register __YT_DETECTED_SUBTITLES postMessage listener → sendMessage(DETECTED_SUBTITLES)
│   │   ├── fetchInterceptor.iife.ts       # UNCHANGED — existing MAIN world fetch interceptor (ADR-011 precedent)
│   │   └── youtube-main-world.iife.ts     # NEW — MAIN world script (scoped *://*.youtube.com/*, read ytInitialPlayerResponse, postMessage)
│   └── background/
│       ├── index.ts                       # UPDATE — register DETECTED_SUBTITLES handler
│       └── handlers/
│           └── youtubeDetection.ts        # NEW — DETECTED_SUBTITLES handler → existing auto-load flow
├── entities/
│   ├── media/
│   │   └── types.ts                       # UPDATE — DetectedSubtitle add isAsr?: boolean, displayName?: string
│   └── message/
│       └── types.ts                       # UPDATE — add 'DETECTED_SUBTITLES' | 'INNERTUBE_FALLBACK_REQUEST' message types
├── shared/
│   ├── config/
│   │   ├── urls.ts                        # UPDATE — add YOUTUBE_HOSTNAMES const (for SPA trigger gating)
│   │   └── messages.ts                    # UPDATE — add DETECTED_SUBTITLES, INNERTUBE_FALLBACK_REQUEST
│   └── lib/
│       └── parsers/
│           └── vttParser.ts               # MAY UPDATE — if YouTube <c> tags not handled by stripSubtitleTags (verify G1)
└── public/manifest.json                   # UPDATE — add content_scripts entry: world: 'MAIN', matches: *://*.youtube.com/*, js: youtube-main-world.iife.ts

tests/
├── unit/
│   ├── features/detection/
│   │   ├── youtubeSubtitleDetector.test.ts  # NEW — parse captionTracks, ASR detection, language mapping, PO Token skip, xosf strip
│   │   ├── youtubeInnertube.test.ts         # NEW — fallback parse, WEB client, INNERTUBE_API_KEY extraction
│   │   └── fixtures/
│   │       └── youtube-vtt-sample.vtt       # NEW — real YouTube VTT with <c> + <00:00:01.000> tags (review fix #4)
│   └── features/subtitle/
│       └── subtitleManagerPanel.test.ts     # UPDATE — ASR badge render, displayName display
└── integration/
    └── youtube-detection.integration.test.ts # NEW (optional G5) — real YouTube video via MCP
```

**Note (review fix #8)**: `subtitleDetector.ts` **UNCHANGED** — không adapter registry, không `genericSubtitleDetector.ts` extraction. Background `index.ts` register **new** `DETECTED_SUBTITLES` handler (không change `detectSubtitle` dispatch).

## Code Style

Functional components with hooks, named exports, TypeScript strict, JSDoc on public functions. Mimic existing `subtitleDetector.ts` style:

```typescript
// src/features/detection/logic/youtubeSubtitleDetector.ts
import type { DetectedSubtitle } from '@/entities/media';

/** YouTube caption track from ytInitialPlayerResponse (subset of fields used). */
interface YouTubeCaptionTrack {
  readonly baseUrl: string;
  readonly languageCode: string;
  readonly kind?: string;        // "asr" = auto-generated; absent = manual
  readonly name?: { readonly simpleText?: string };
  readonly vssId?: string;
}

/**
 * Map YouTube captionTracks → DetectedSubtitle[] for the extension's auto-load flow.
 * Appends `&fmt=vtt` to baseUrl (reuse parseVtt in src/shared/lib/parsers/vttParser.ts).
 * Strips `xosf` param (yt-dlp #13654). Skips tracks requiring PO Token (exp=xpe|xpv).
 *
 * @param tracks - captionTracks from ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer
 * @param tabId - Current tab ID
 * @returns DetectedSubtitle[] (empty if no tracks or all skipped)
 */
export function mapYouTubeCaptionTracks(
  tracks: readonly YouTubeCaptionTrack[],
  tabId: number,
): DetectedSubtitle[] {
  // ... implementation
}
```

## Testing Strategy

- **Unit tests** (`tests/unit/features/detection/`):
  - `youtubeSubtitleDetector.test.ts` — parse fixture captionTracks JSON → assert DetectedSubtitle[] (language, format=vtt, isAsr, displayName, url has `&fmt=vtt`, `xosf` stripped)
  - PO Token skip — track with `exp=xpe` in baseUrl → skipped + warn
  - ASR detection — `kind: "asr"` → `isAsr: true`; absent → `isAsr: false`
  - `youtubeInnertube.test.ts` — fallback: mock fetch response → parse captionTracks; INNERTUBE_API_KEY regex extraction; WEB client context (no User-Agent override)
  - **YouTube VTT tag handling** (review fix #4) — fixture `youtube-vtt-sample.vtt` with `<c.colorE5E5E5>` + `<00:00:01.000>` tags → run qua `parseVtt` → assert cue text stripped clean. If `stripSubtitleTags` doesn't handle → add YouTube-specific stripping + test.
- **Integration test** (optional G5): real YouTube video via MCP — verify end-to-end detect → auto-load → overlay
- **Browser verify** (mandatory — browser-facing change): edge-devtools MCP trên real YouTube video — verify `window.ytInitialPlayerResponse` accessible từ MAIN world, captionTracks populated, auto-load trigger, overlay hiển thị, SPA nav re-detect
- **Coverage**: unit tests cover all branches (ASR/manual, PO Token skip, fallback, VTT tag handling)

## Boundaries

- **Always do**:
  - Run `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` before commit
  - Browser verify trên real Edge/Chrome (MCP) trước commit — browser-facing change
  - Update `docs/2-architechture-system.md` (3 chỗ: tree, dependency table, function index) khi add/remove/rename files
  - Backward compatible — `subtitleDetector.ts` generic detector giữ nguyên 100%, existing sites (kisskh, hoathinh3d) không break
  - Cite YouTube API sources trong code comments (yt-dlp, ytranscript, MDN)
  - G1 verify YouTube VTT tag handling trước G2 (review fix #4)
- **Ask first**:
  - Thêm dependency mới (nếu cần xml2js cho srv3 — nhưng chọn vtt nên tránh được)
  - Thay đổi `manifest.json` content_scripts structure (cần test real browser)
  - Thay đổi `DetectedSubtitle` entity (thêm field OK nếu optional + backward compatible)
- **Never do**:
  - Refactor `subtitleDetector.ts` thành adapter registry (YAGNI — YouTube bypass `detectSubtitle()` entirely)
  - Set `User-Agent` header từ content script (forbidden header — MDN)
  - Video download trên YouTube (DASH/DRM — out of scope, feature riêng)
  - Netflix/iQIYI adapters (out of scope — sau)
  - Auto-translation tracks `tlang` (chất lượng thấp, `xosf` damaged)
  - Whisper ASR generation (UC04.3 — riêng)
  - Commit secrets / API keys (INNERTUBE_API_KEY extract runtime, không hardcode)

## Success Criteria

### Functional (F)

- **F1**: Mở YouTube video có manual caption (vd `watch?v=dQw4w9WgXcQ`) → `DetectedSubtitle[]` populated với tất cả manual tracks → broadcast `DETECTED_SUBTITLES` → auto-load trigger → overlay hiển thị target language
- **F2**: Mở YouTube video chỉ có ASR caption → `DetectedSubtitle[]` populated với ASR track (`isAsr: true`) → auto-load trigger → overlay hiển thị + ASR badge "auto" trong manager panel
- **F3**: YouTube video có cả manual + ASR cùng language → cả 2 track trong list, auto-load chọn manual trước (first-match, manual listed trước ASR theo YouTube order)
- **F4**: SPA navigation (click video khác trong YouTube) → `yt-navigate-finish` fire → poll `videoId` change → re-detect subtitle mới, clear subtitle cũ, overlay re-init. **F4a**: re-detect fires only when `videoId` actually changes (dedup — same video = no-op)
- **F5**: Download-all-subtitles trên YouTube → tải được file `.vtt` cho mỗi caption track (baseUrl + `&fmt=vtt`)
- **F6**: PO Token required track (exp=xpe|xpv trong baseUrl) → skip track + `console.warn` + **toast user-visible**, không crash, other tracks vẫn detect
- **F7**: `window.ytInitialPlayerResponse` undefined (YouTube đổi structure) → fallback InnerTube WEB client qua background SW `fetch` → vẫn detect được caption tracks (may still hit PO Token — honest constraint)
- **F8**: Existing sites (kisskh.co, hoathinh3d.co) → generic detector (`subtitleDetector.ts`) vẫn hoạt động 100%, không regression (no refactor)
- **F9** (review fix #7): Tất cả tracks require PO Token + fallback fail → user-visible toast "YouTube subtitles cần PO Token — không detect được", không silent failure

### Non-Functional (NF)

- **NF1**: Detection latency < 2s sau khi video element ready (UC04.1 requirement)
- **NF2**: MAIN world script không block page render — chạy async sau `yt-navigate-finish` / DOMContentLoaded
- **NF3**: YouTube MAIN world script scoped `*://*.youtube.com/*` — không overhead trên non-YouTube pages
- **NF4**: No new dependencies — reuse `parseVtt` (`src/shared/lib/parsers/vttParser.ts`), `parseSrt` hiện tại. InnerTube fallback dùng `fetch` (background SW)
- **NF5**: Backward compatible — `DetectedSubtitle` thêm optional fields, generic detector không set → existing sites không break
- **NF6** (revised): MAIN world ↔ ISOLATED world communication via `window.postMessage` (consistency với `fetchInterceptor.iife.ts` ADR-011 precedent). MAIN world script self-contained, không import extension modules (MAIN world không có extension APIs). Content scripts **cannot set forbidden headers** (User-Agent) — InnerTube fallback routes qua background SW.

### Acceptance (A) — browser verify checklist

- **A1**: edge-devtools MCP mở `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → console log `[YouTube detector]` với track list
- **A2**: Auto-load trigger → overlay hiển thị English subtitle trên video
- **A3**: Manager panel hiển thị track list với `displayName` ("English", "English (auto-generated)") + ASR badge
- **A4**: Click video khác (SPA nav) → `yt-navigate-finish` → re-detect → overlay update với subtitle mới (verify videoId dedup — same video click = no re-detect)
- **A5**: kisskh.co video → generic detector vẫn hoạt động (no regression) — overlay hiển thị bình thường
- **A6**: Video không có caption → graceful no-op (no error, no overlay)
- **A7**: Console không có error/exception từ MAIN world script
- **A8** (review fix #7): Video tất cả tracks require PO Token → toast user-visible "YouTube subtitles cần PO Token", không silent console.warn only
- **A9** (review fix #4): YouTube VTT sample run qua `parseVtt` → cue text clean (no `<c>` tags, no `<00:00:01.000>` inline timestamps)

## Open Questions (defer to G2 plan / G3 ADR)

| # | Question | Lean toward | Defer to |
|---|---|---|---|
| Q1 | MAIN world script bundling: Vite `world: 'MAIN'` entry (`.iife.ts`) — verify @crxjs/vite-plugin support cho multiple MAIN world scripts? | Yes — `fetchInterceptor.iife.ts` đã proven pattern | G3 ADR (source-driven verify @crxjs docs) |
| Q2 | InnerTube fallback trigger condition: undefined `ytInitialPlayerResponse` OR empty captionTracks OR fetch failure? | All 3 — defensive | G2 plan |
| Q3 | ASR badge UI: text "auto" vs icon vs color? | Text "auto" — minimal, no new icon | G0.5 mockup (if needed) |
| Q4 | `yt-navigate-finish` reliability: verify event fires reliably trên real YouTube SPA nav qua MCP? Fallback `popstate`/`pushState` hook needed? | Verify G4 — add fallback if unreliable | G4 browser verify |

## Out of Scope

- **Adapter registry refactor** của `subtitleDetector.ts` (YAGNI — YouTube bypass `detectSubtitle()` entirely, defer đến khi có 2nd adapter thật sự)
- Video download trên YouTube (DASH/DRM — feature riêng)
- Netflix/iQIYI adapters (sau)
- Auto-translation tracks `tlang` (chất lượng thấp, `xosf` damaged)
- Whisper ASR generation (UC04.3)
- Manual import (đã có — Ctrl+Shift+F)
- YouTube transcript copy/export UI (chỉ detect + flow vào hệ thống hiện tại)
- ANDROID client InnerTube (User-Agent forbidden header — unfeasible từ content script)

## Next Phase

→ **G1 verify** (review fix #4): fetch real YouTube VTT sample qua MCP, run qua `parseVtt`, confirm tag handling. Nếu fail → update spec thêm YouTube-specific stripping.
→ **G2 Plan** (`plan-youtube-subtitle-detection.md`): implementation plan high-level (approach, scope, risk mitigation, milestones) — cite spec này.
→ **G3 ADR** (`NNN-youtube-subtitle-detection.md`): architecture decision — MAIN world injection (separate `youtube-main-world.iife.ts`), `window.postMessage` bridge, InnerTube fallback routing. Invoke `api-and-interface-design` cho MAIN↔ISOLATED message contract.
→ **G0.5 Mockup** (optional): ASR badge UI confirm nếu Q3 cần visual.
