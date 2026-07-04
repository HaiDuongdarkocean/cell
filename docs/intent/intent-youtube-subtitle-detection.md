# Intent — YouTube Subtitle Detection

> **Phase**: G0 Discovery (confirmed intent, lightweight feasibility go/no-go)
> **UC reference**: UC04.1 — Detect subtitle chuyên dụng (YouTube/Netflix/iQIYI)
> **Date**: 2026-07-05

---

## Confirmed Intent (interview-me output)

- **Outcome**: YouTube subtitle được detect proactively + flow qua hệ thống hiện tại (auto-load, auto-select, download-all-subtitles) giống kisskh/hoathinh3d — không cần user bật CC thủ công.
- **User**: Anh yêu (language learner) — xem YouTube và muốn subtitle overlay + bilingual hoạt động ngay.
- **Why now**: YouTube là streaming platform lớn nhất thế giới, dùng chuẩn subtitle riêng (timedtext API, không phải .srt/.vtt URL) → hệ thống hiện tại không detect được → auto-load không trigger.
- **Success**: Mở YouTube video → subtitle list tự populate tất cả caption tracks (manual + ASR) → auto-load chọn target+native language → overlay hiển thị → download-all-subtitles tải được file .vtt/.srt.
- **Constraint**: Architecture extensible (site adapter pattern) để thêm Netflix/iQIYI sau không cần refactor. Browser-facing change → verify real Edge/Chrome MCP trước commit.
- **Out of scope**: Video download trên YouTube (DASH/DRM — feature riêng). Netflix/iQIYI adapters (sau). Whisper ASR generation (UC04.3). Manual import (đã có).

## Decisions Confirmed

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Detection method | **Proactive** (parse `ytInitialPlayerResponse` từ page DOM) | Auto-load trigger ngay khi video load, không cần user bật CC. YouTube SPA data nằm trong `window.ytInitialPlayerResponse` hoặc embedded script. |
| D2 | ASR auto-generated captions | **Include** | Nhiều video chỉ có ASR. Coverage cao hơn. Track list hiển thị cả manual + ASR. |
| D3 | Scope | **YouTube only** (extensible) | Netflix/iQIYI có API + format riêng (TTML/DFXP, DRM). Architecture site adapter pattern để thêm sau không refactor. |
| D4 | Boundary | **Subtitle only** (no video download) | DASH/DRM là feature riêng. Task này thuần subtitle detection + flow. |

## Factual Basis (source-driven research)

### YouTube caption track structure

`ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[]`:

```json
{
  "baseUrl": "https://www.youtube.com/api/timedtext?...",
  "languageCode": "en",
  "kind": "asr",              // present only for auto-generated; absent for manual
  "name": { "simpleText": "English (auto-generated)" }
}
```

- **Sources**: github.com/nadimtuhin/ytranscript/HOW_IT_WORKS.md, blog.nidhin.dev, medium.com/@aqib-2 (Innertube API 2025 guide), github.com/conormkelly/yts-cli
- **ASR detection**: `kind === "asr"` → auto-generated. Manual captions have no `kind` field.

### timedtext API format control

- baseUrl đã chứa params (`v`, `lang`, `signature`, etc.)
- Append `&fmt=json3` → JSON3 format (cues with start/dur/segs)
- Append `&fmt=vtt` → WebVTT (reuse existing `parseVtt` parser)
- Append `&fmt=srv3` → XML (legacy)
- **Source**: github.com/nadimtuhin/ytranscript, medium.com/@aqib-2

### 2 ways to get playerResponse

1. **Parse page DOM** (preferred — D1 proactive): `window.ytInitialPlayerResponse` (MAIN world) hoặc regex match `ytInitialPlayerResponse = ({...});` trong HTML script tags.
2. **InnerTube API** POST `/youtubei/v1/player` (cần INNERTUBE_API_KEY từ page) — fallback khi DOM parse fail.

### Known risk (2024+): `&pot` parameter

- Stack Overflow #79668836: baseUrl có thể return empty (200 OK, no content) nếu thiếu `&pot` parameter.
- YouTube thêm pot token validation gần đây để chống scraping.
- **Mitigation**: baseUrl từ `ytInitialPlayerResponse` thường đã chứa pot token đầy đủ. Nếu fail, fallback InnerTube API (ANDROID client) có baseUrl khác. Cần verify trên real browser (MCP) trong G4/G5.

## Lightweight Feasibility Go/No-Go

| Criterion | Status | Notes |
|---|---|---|
| YouTube API stable enough? | ✅ GO | `ytInitialPlayerResponse` structure stable多年, nhiều OSS tools dùng (ytranscript, yts-cli, asbplayer reference trong docs/reading-summaries). |
| Content-script access? | ✅ GO | Cần MAIN world script để đọc `window.ytInitialPlayerResponse`. MV3 support `world: 'MAIN'` trong manifest content_scripts. |
| Reuse existing parsers? | ✅ GO | `&fmt=vtt` → reuse `parseVtt`. Hoặc `&fmt=json3` → viết adapter nhỏ → SrtCue. |
| Auto-load flow compatible? | ✅ GO | `DetectedSubtitle` entity đã có `{id, url, format, language, tabId, detectedAt}`. YouTube adapter chỉ cần map captionTracks → DetectedSubtitle[]. |
| Site adapter pattern extensible? | ✅ GO | `subtitleDetector.ts` hiện là single function. Refactor thành adapter registry (YouTube adapter + generic URL-pattern adapter) không break existing sites. |
| Browser verify feasible? | ✅ GO | `edge-devtools` MCP available. Test trên real YouTube video. |
| `&pot` risk manageable? | ⚠️ WATCH | baseUrl từ DOM thường đủ. Fallback InnerTube. Verify G4. |

**Verdict**: **GO** — proceed to G1 spec.

## Open Questions (defer to G1 spec)

1. **Format choice**: `&fmt=vtt` (reuse parser) vs `&fmt=json3` (richer metadata, cần adapter mới)? Ponytail → VTT reuse wins unless metadata needed.
2. **MAIN world injection**: thêm content-script entry `world: 'MAIN'` trong manifest, hay inject `<script>` tag từ ISOLATED world? MV3 best practice cần verify (source-driven G3).
3. **SPA navigation**: YouTube SPA switch video không reload page. Cần re-detect trên `yt-navigate-finish` event hoặc URL change observer (đã có pattern từ ADR-010 episode-switch).
4. **ASR badge UI**: track list hiển thị ASR track có badge "auto" không? (G0.5 mockup decision nếu có UI surface)
5. **Track name display**: dùng `name.simpleText` ("English (auto-generated)") hay chỉ `languageCode` ("en")? Hiện tại generic detector chỉ dùng language code.

## Next Phase

→ **G1 Spec** (`spec-youtube-subtitle-detection.md`): PRD với F/NF/A criteria, cite intent này.
→ Có thể **G0.5 Mockup** nếu ASR badge / track name display cần UI confirmation (decide at G1 start).
