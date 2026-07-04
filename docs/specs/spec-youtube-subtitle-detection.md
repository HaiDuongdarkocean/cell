# Spec: YouTube Subtitle Detection

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-07-05
> **Intent source**: `docs/intent/intent-youtube-subtitle-detection.md`
> **Research source**: `docs/reference/youtube-subtitle-format-research.md`

## Objective

YouTube subtitle được detect **proactively** ngay khi video load (không cần user bật CC thủ công) và flow qua hệ thống hiện tại (auto-load, auto-select, download-all-subtitles) giống kisskh/hoathinh3d. YouTube dùng chuẩn subtitle riêng (timedtext API, không phải .srt/.vtt URL) → hệ thống hiện tại không detect được → auto-load không trigger.

**User**: Anh yêu (language learner) — xem YouTube và muốn subtitle overlay + bilingual hoạt động ngay khi mở video.

**Why now**: YouTube là streaming platform lớn nhất thế giới. `subtitleDetector.ts` hiện tại match `.srt/.vtt/.ass` extension + `/subtitles|subs|caption|cc/` path → YouTube timedtext URL match 0 pattern → `detectSubtitle()` return null → auto-load không bao giờ trigger. UC04.1 design spec đã mô tả approach nhưng chưa implement.

**Success**:
- Mở YouTube video có caption → subtitle list tự populate tất cả caption tracks (manual + ASR) → broadcast `DETECTED_SUBTITLES` → auto-load chọn target+native language → overlay hiển thị bilingual
- Download-all-subtitles tải được file `.vtt` cho mỗi YouTube caption track
- SPA navigation (switch video không reload page) → re-detect subtitle mới, clear subtitle cũ
- ASR tracks (auto-generated) hiển thị với badge "auto" trong track list để user biết chất lượng
- Site adapter pattern extensible — thêm Netflix/iQIYI sau không refactor detection layer
- PO Token risk handled gracefully — track require pot mà không có → skip + log warning, không crash
- Browser verify trên real Edge/Chrome (MCP) trước commit

## Assumptions (surface trước khi spec nội dung)

1. **Format choice: `&fmt=vtt`** — append `&fmt=vtt` vào baseUrl → reuse `parseVtt` hiện tại (ponytail rung 2 reuse codebase). JSON3 (richer metadata) không cần vì VTT đã đủ `{start, end, text}` cho overlay. Strip `xosf` param khỏi baseUrl trước khi append `fmt=` (yt-dlp issue #13654 — gây damaged subtitles).
2. **MAIN world injection: manifest `world: 'MAIN'`** — thêm content-script entry mới trong `manifest.json` với `world: 'MAIN'` để truy cập `window.ytInitialPlayerResponse`. MV3 native support (Chrome 111+). ISOLATED world content-script hiện tại giữ nguyên — MAIN world script chỉ phụ trách YouTube detection, giao tiếp với ISOLATED world qua `window.postMessage` hoặc `CustomEvent`.
3. **SPA navigation: `yt-navigate-finish` event + ADR-010 reuse** — YouTube fire `yt-navigate-finish` custom event sau SPA nav. Reuse `reportEpisodeChangedIfReplacement` pattern (ADR-010) cho video element replacement. Double trigger safe (idempotent — re-detect same video = same result, dedup by videoId).
4. **ASR badge UI: track list hiển thị "auto" badge** — `DetectedSubtitle` entity hiện tại không có `isAsr` field. **Thêm field `isAsr?: boolean`** (optional, backward compatible) — generic detector không set (undefined), YouTube adapter set `true` cho `kind === "asr"`. UI (subtitle manager panel) hiển thị badge "auto" khi `isAsr === true`.
5. **Track name display: `languageCode` cho matching, `name.simpleText` cho display** — auto-load matching vẫn dùng `languageCode` (ISO 639-1) — consistent với generic detector. Track list display dùng `name.simpleText` ("English (auto-generated)") thay vì chỉ "en" — user thấy tên đầy đủ. **Thêm field `displayName?: string`** vào `DetectedSubtitle` (optional).
6. **Translation tracks (`tlang`): OUT of scope** — auto-translation chất lượng thấp (machine translation) + `xosf` damaged subtitles. Chỉ detect original caption tracks (manual + ASR), không detect translation tracks từ `translationLanguages[]`.
7. **PO Token handling: detect + skip + warn** — parse `exp` param trong baseUrl query. Nếu chứa `xpe` hoặc `xpv` → track require PO Token → skip track + `console.warn` với language code. baseUrl từ `ytInitialPlayerResponse` WEB client thường đã chứa pot token đầy đủ → đa số track không require. Fallback InnerTube ANDROID client nếu toàn bộ track list require pot.
8. **InnerTube fallback: chỉ khi DOM parse fail** — nếu `window.ytInitialPlayerResponse` undefined hoặc `.captions.playerCaptionsTracklistRenderer.captionTracks` empty → fallback POST `/youtubei/v1/player` (ANDROID client). ANDROID client ít require PO Token hơn WEB client. Cần extract `INNERTUBE_API_KEY` từ page HTML (`"INNERTUBE_API_KEY":"([^"]+)"` regex).
9. **Adapter dispatch by origin** — `subtitleDetector.ts` refactor thành adapter registry. Dispatch dựa trên `new URL(tabUrl).hostname`: `youtube.com` / `*.youtube.com` / `youtube-nocookie.com` → YouTube adapter; else → generic URL-pattern adapter (hiện tại). Generic adapter logic giữ nguyên 100% — chỉ extract ra function riêng.
10. **DetectedSubtitle entity extension (backward compatible)** — thêm 2 optional fields: `isAsr?: boolean`, `displayName?: string`. Generic detector không set → existing sites không break. YouTube adapter set cả 2.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (manifest v3) — content script `world: 'MAIN'` (Chrome 111+)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
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
│   │   │   ├── subtitleDetector.ts        # REFACTOR — adapter registry dispatch by origin
│   │   │   ├── genericSubtitleDetector.ts # NEW — extract generic URL-pattern logic (hiện tại trong subtitleDetector.ts)
│   │   │   ├── youtubeSubtitleDetector.ts # NEW — YouTube adapter (parse captionTracks → DetectedSubtitle[])
│   │   │   └── youtubeInnertube.ts        # NEW — InnerTube API fallback (POST /youtubei/v1/player ANDROID client)
│   │   └── index.ts
│   └── subtitle/
│       └── ui/
│           ├── contentScriptController.ts  # UPDATE — wire YouTube MAIN world message listener + SPA re-detect
│           └── subtitleManagerPanel.ts     # UPDATE — render ASR badge + displayName (optional fields)
├── entrypoints/
│   ├── content/
│   │   ├── content-script.ts              # UPDATE — register YouTube MAIN world bridge (postMessage / CustomEvent)
│   │   └── youtube-main-world.ts          # NEW — MAIN world script (read window.ytInitialPlayerResponse, postMessage to ISOLATED)
│   └── background/
│       └── index.ts                       # UPDATE — dispatch detectSubtitle with origin context
├── entities/
│   └── media/
│       └── (DetectedSubtitle type)        # UPDATE — add isAsr?: boolean, displayName?: string
├── shared/
│   └── config/
│       └── urls.ts                        # UPDATE — add YOUTUBE_HOSTNAMES const
└── manifest.json                          # UPDATE — add content_scripts entry world: 'MAIN' for youtube-main-world.ts

tests/
├── unit/
│   ├── features/detection/
│   │   ├── youtubeSubtitleDetector.test.ts  # NEW — parse captionTracks, ASR detection, language mapping, PO Token skip
│   │   ├── genericSubtitleDetector.test.ts  # NEW (extracted from subtitleDetector.test.ts) — ensure no regression
│   │   ├── youtubeInnertube.test.ts         # NEW — fallback parse, ANDROID client, INNERTUBE_API_KEY extraction
│   │   └── subtitleDetector.test.ts         # UPDATE — adapter registry dispatch by origin
│   └── features/subtitle/
│       └── subtitleManagerPanel.test.ts     # UPDATE — ASR badge render, displayName display
└── integration/
    └── youtube-detection.integration.test.ts # NEW (optional G5) — real YouTube video via MCP or fixture
```

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
 * Appends `&fmt=vtt` to baseUrl (reuse parseVtt). Strips `xosf` param (yt-dlp #13654).
 * Skips tracks requiring PO Token (exp=xpe|xpv) — graceful degradation.
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
  - `youtubeSubtitleDetector.test.ts` — parse fixture captionTracks JSON → assert DetectedSubtitle[] (language, format=vtt, isAsr, displayName, url has &fmt=vtt, xosf stripped)
  - PO Token skip — track with `exp=xpe` in baseUrl → skipped + warn
  - ASR detection — `kind: "asr"` → `isAsr: true`; absent → `isAsr: false`
  - `genericSubtitleDetector.test.ts` — extracted from current `subtitleDetector.test.ts` — ensure no regression
  - `subtitleDetector.test.ts` — adapter registry dispatch: youtube.com → YouTube adapter, kisskh.co → generic adapter
  - `youtubeInnertube.test.ts` — fallback: mock fetch response → parse captionTracks; INNERTUBE_API_KEY regex extraction
- **Integration test** (optional G5): real YouTube video via MCP — verify end-to-end detect → auto-load → overlay
- **Browser verify** (mandatory — browser-facing change): edge-devtools MCP trên real YouTube video — verify `window.ytInitialPlayerResponse` accessible từ MAIN world, captionTracks populated, auto-load trigger, overlay hiển thị
- **Coverage**: unit tests cover all branches (ASR/manual, PO Token skip, fallback, adapter dispatch)

## Boundaries

- **Always do**:
  - Run `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` before commit
  - Browser verify trên real Edge/Chrome (MCP) trước commit — browser-facing change
  - Update `docs/2-architechture-system.md` (3 chỗ: tree, dependency table, function index) khi add/remove/rename files
  - Backward compatible — generic detector logic giữ nguyên, existing sites (kisskh, hoathinh3d) không break
  - Cite YouTube API sources trong code comments (yt-dlp, ytranscript, MDN)
- **Ask first**:
  - Thêm dependency mới (nếu cần xml2js cho srv3 — nhưng chọn vtt nên tránh được)
  - Thay đổi `manifest.json` content_scripts structure (cần test real browser)
  - Thay đổi `DetectedSubtitle` entity (thêm field OK nếu optional + backward compatible)
- **Never do**:
  - Video download trên YouTube (DASH/DRM — out of scope, feature riêng)
  - Netflix/iQIYI adapters (out of scope — sau)
  - Auto-translation tracks `tlang` (chất lượng thấp, xosf damaged)
  - Whisper ASR generation (UC04.3 — riêng)
  - Commit secrets / API keys (INNERTUBE_API_KEY extract runtime, không hardcode)

## Success Criteria

### Functional (F)

- **F1**: Mở YouTube video có manual caption (vd `watch?v=dQw4w9WgXcQ`) → `DetectedSubtitle[]` populated với tất cả manual tracks → broadcast `DETECTED_SUBTITLES` → auto-load trigger → overlay hiển thị target language
- **F2**: Mở YouTube video chỉ có ASR caption → `DetectedSubtitle[]` populated với ASR track (`isAsr: true`) → auto-load trigger → overlay hiển thị + ASR badge "auto" trong manager panel
- **F3**: YouTube video có cả manual + ASR cùng language → cả 2 track trong list, auto-load chọn manual trước (first-match, manual listed trước ASR theo YouTube order)
- **F4**: SPA navigation (click video khác trong YouTube) → re-detect subtitle mới, clear subtitle cũ, overlay re-init với subtitle mới
- **F5**: Download-all-subtitles trên YouTube → tải được file `.vtt` cho mỗi caption track (baseUrl + `&fmt=vtt`)
- **F6**: PO Token required track (exp=xpe|xpv trong baseUrl) → skip track + `console.warn` với language code, không crash, other tracks vẫn detect
- **F7**: `window.ytInitialPlayerResponse` undefined (YouTube đổi structure) → fallback InnerTube ANDROID client → vẫn detect được caption tracks
- **F8**: Existing sites (kisskh.co, hoathinh3d.co) → generic detector vẫn hoạt động, không regression

### Non-Functional (NF)

- **NF1**: Detection latency < 2s sau khi video element ready (UC04.1 requirement)
- **NF2**: MAIN world script không block page render — chạy async sau `yt-navigate-finish` / DOMContentLoaded
- **NF3**: Adapter dispatch by origin — O(1) hostname check, không iterate tất cả adapters
- **NF4**: No new dependencies — reuse `parseVtt`, `parseSrt` hiện tại. InnerTube fallback dùng `fetch` (có sẵn)
- **NF5**: Backward compatible — `DetectedSubtitle` thêm optional fields, generic detector không set → existing sites không break
- **NF6**: MAIN world ↔ ISOLATED world communication via `CustomEvent` (không pollute `window` properties). MAIN world script self-contained, không import extension modules (MAIN world không có extension APIs)

### Acceptance (A) — browser verify checklist

- **A1**: edge-devtools MCP mở `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → console log `[YouTube detector]` với track list
- **A2**: Auto-load trigger → overlay hiển thị English subtitle trên video
- **A3**: Manager panel hiển thị track list với `displayName` ("English", "English (auto-generated)") + ASR badge
- **A4**: Click video khác (SPA nav) → re-detect → overlay update với subtitle mới
- **A5**: kisskh.co video → generic detector vẫn hoạt động (no regression) — overlay hiển thị bình thường
- **A6**: Video không có caption → graceful no-op (no error, no overlay)
- **A7**: Console không có error/exception từ MAIN world script

## Open Questions (defer to G2 plan / G3 ADR)

| # | Question | Lean toward | Defer to |
|---|---|---|---|
| Q1 | MAIN world ↔ ISOLATED communication: `CustomEvent` vs `window.postMessage`? | `CustomEvent` — same document, simpler, no origin check | G3 ADR (api-and-interface-design) |
| Q2 | MAIN world script bundling: Vite `world: 'MAIN'` entry vs inline script injection? | Vite entry — @crxjs/vite-plugin support | G3 ADR (source-driven verify @crxjs docs) |
| Q3 | InnerTube fallback trigger condition: undefined `ytInitialPlayerResponse` OR empty captionTracks OR fetch failure? | All 3 — defensive | G2 plan |
| Q4 | ASR badge UI: text "auto" vs icon vs color? | Text "auto" — minimal, no new icon | G0.5 mockup (if needed) |
| Q5 | `displayName` fallback when `name.simpleText` absent? | `languageCode` uppercase — "EN" | G2 plan |

## Out of Scope

- Video download trên YouTube (DASH/DRM — feature riêng)
- Netflix/iQIYI adapters (sau — architecture extensible cho thêm)
- Auto-translation tracks `tlang` (chất lượng thấp, `xosf` damaged)
- Whisper ASR generation (UC04.3)
- Manual import (đã có — Ctrl+Shift+F)
- YouTube transcript copy/export UI (chỉ detect + flow vào hệ thống hiện tại)

## Next Phase

→ **G2 Plan** (`plan-youtube-subtitle-detection.md`): implementation plan high-level (approach, scope, risk mitigation, milestones) — cite spec này.
→ **G3 ADR** (`NNN-youtube-subtitle-detection.md`): architecture decision — MAIN world injection, adapter pattern, InnerTube fallback. Invoke `api-and-interface-design` cho MAIN world ↔ ISOLATED contract.
→ **G0.5 Mockup** (optional): ASR badge UI confirm nếu Q4 cần visual.
