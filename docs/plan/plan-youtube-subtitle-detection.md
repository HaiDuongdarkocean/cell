# Implementation Plan: YouTube Subtitle Detection

> **Giai đoạn**: G2 Implementation Plan (output planning-and-task-breakdown high-level)
> **Status**: Draft
> **Date**: 2026-07-05
> **Spec source**: `docs/specs/spec-youtube-subtitle-detection.md` (mọi mục cite spec §F/NF/A)
> **Lưu ý**: File này là plan HIGH-LEVEL (approach, risk, milestones). Task list chi tiết chạy ở G4 đầu (sau Spec G1 + Plan G2 + ADR G3).

## Overview

Thêm YouTube subtitle detection qua **proactive MAIN-world DOM parse** (`ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks`). Đây là **Path B** riêng — bypass `detectSubtitle()` entirely (YouTube timedtext URL match 0 pattern generic). MAIN world script `youtube-main-world.iife.ts` (scoped `*://*.youtube.com/*`) đọc `window.ytInitialPlayerResponse` → `mapYouTubeCaptionTracks` → `postMessage({ type: '__YT_DETECTED_SUBTITLES', tracks, videoId })` → ISOLATED listener → `sendMessage(DETECTED_SUBTITLES)` → background handler → existing auto-load flow. InnerTube fallback qua background SW (content script không set User-Agent). SPA re-detect qua `yt-navigate-finish` + videoId dedup. Approach: vertical slicing theo layer — entity extension trước (foundation), rồi pure logic (mapYouTubeCaptionTracks), rồi MAIN world script, rồi ISOLATED bridge, rồi background handler, rồi SPA re-detect, rồi UI badge, rồi browser verify.

## Architecture Decisions (cite spec)

### AD1: Two Detection Paths — no adapter registry (spec §Architecture)
- **Decision**: YouTube detection = Path B riêng (MAIN-world → `DETECTED_SUBTITLES` message). `subtitleDetector.ts` generic detector (Path A) UNCHANGED 100%.
- **Rationale** (spec §F8, review fix #1): `detectSubtitle(NetworkRequest)` không có origin → không dispatch by hostname. YouTube timedtext URL match 0 `SUBTITLE_URL_PATTERNS` → `detectSubtitle` return null anyway. Adapter registry = YAGNI (ponytail rung 1).
- **Build-vs-buy**: 0 refactor generic detector, 0 regression risk. Ponytail rung 1 (YAGNI).
- **Alternatives rejected**: Adapter registry refactor — wrong premise (review CRITICAL #1), defer đến khi có 2nd adapter thật sự.

### AD2: `window.postMessage` bridge (spec §Assumptions #3, NF6)
- **Decision**: MAIN→ISOLATED communication qua `window.postMessage({ type: '__YT_DETECTED_SUBTITLES', tracks, videoId })`. ISOLATED `content-script.ts` listener → `sendMessage(DETECTED_SUBTITLES)`.
- **Rationale** (spec §NF6, review fix #2): Consistency với `fetchInterceptor.iife.ts` (ADR-011 precedent — proven working pattern). `CustomEvent` rejected — contradict existing pattern.
- **Build-vs-buy**: 0 dependency, reuse existing `content-script.ts` message listener pattern. Ponytail rung 2 (reuse codebase).
- **Alternatives rejected**: `CustomEvent` — contradict ADR-011 precedent.

### AD3: InnerTube fallback via background SW (spec §Assumptions #9, F7)
- **Decision**: MAIN world → postMessage → ISOLATED → `sendMessage(INNERTUBE_FALLBACK_REQUEST)` → **background SW `fetch`** (WEB-client InnerTube, no User-Agent override).
- **Rationale** (spec §F7, review fix #3): Content script KHÔNG set `User-Agent` (forbidden header — MDN). Background SW `fetch` không có restriction. WEB-client InnerTube (ANDROID client unfeasible — User-Agent forbidden).
- **Build-vs-buy**: 0 dependency, reuse `sendMessage` + background `fetch`. Ponytail rung 4 (native platform).
- **Alternatives rejected**: ANDROID client InnerTube — User-Agent forbidden header (review CRITICAL #3).

### AD4: SPA re-detect via `yt-navigate-finish` + videoId dedup (spec §Assumptions #4, F4)
- **Decision**: MAIN world script listen `yt-navigate-finish` event (+ `popstate`/`pushState` hook fallback). Sau event, poll `ytInitialPlayerResponse.videoDetails.videoId` cho đến khi khác last-seen (timeout 2s), rồi extract tracks. Dedup by videoId.
- **Rationale** (spec §F4, F4a, review fix #5): YouTube SPA reuse same `<video>` element (chỉ đổi src) → ADR-010 `reportEpisodeChangedIfReplacement` (element-identity watcher) không fire. `yt-navigate-finish` fire sau SPA nav. Race condition: `ytInitialPlayerResponse` có thể chưa update khi event fire → poll videoId.
- **Build-vs-buy**: 0 dependency, native events. Ponytail rung 4 (native platform).
- **Alternatives rejected**: ADR-010 `reportEpisodeChangedIfReplacement` — wrong signal (YouTube reuse `<video>`).

### AD5: `&fmt=vtt` reuse `parseVtt` (spec §Assumptions #1)
- **Decision**: Append `&fmt=vtt` vào baseUrl → reuse `parseVtt` (`src/shared/lib/parsers/vttParser.ts`). Strip `xosf` param (yt-dlp #13654).
- **Rationale** (spec §NF4, G1 verify PASS): `stripSubtitleTags` regex `/<[^>]*>/g` handle YouTube `<c.colorE5E5E5>`, `</c>`, `<00:00:01.000>` inline timestamps. G1 verify PASS — no `vttParser.ts` update needed.
- **Build-vs-buy**: 0 dependency, reuse existing parser. Ponytail rung 2 (reuse codebase).
- **Alternatives rejected**: `&fmt=json3` — cần adapter mới, không cần thiết (VTT đủ `{start, end, text}`).

### AD6: `DetectedSubtitle` entity extension — `isAsr?`, `displayName?` (spec §Assumptions #5, #6, #10)
- **Decision**: Thêm 2 optional fields vào `DetectedSubtitle` (`src/entities/media/types.ts`). Generic detector không set → backward compatible.
- **Rationale** (spec §NF5): Entity đã có optional fields (`videoId?`, `size?`). Optional = no migration, no regression.
- **Build-vs-buy**: 0 dependency, 0 migration. Ponytail rung 6 (one line per field).
- **Alternatives rejected**: Separate `YouTubeDetectedSubtitle` type — fragment entity, không cần.

## Milestones (vertical slicing — mỗi milestone working state)

| M | Scope | Deliverable | Verify |
|---|-------|-------------|--------|
| M1 | Entity extension | `DetectedSubtitle` + `isAsr?`, `displayName?` | `tsc --noEmit` pass |
| M2 | Pure logic | `mapYouTubeCaptionTracks` + tests (ASR, language, xosf strip, PO Token skip) | `npm run test:unit` pass |
| M3 | InnerTube fallback | `youtubeInnertube.ts` + tests (WEB client, API_KEY extraction) | `npm run test:unit` pass |
| M4 | MAIN world script | `youtube-main-world.iife.ts` (read ytInitialPlayerResponse, postMessage, SPA listener) | `tsc` + `npm run build` (CRXJS bundle) |
| M5 | ISOLATED bridge + background | `content-script.ts` listener + `DETECTED_SUBTITLES` handler + message types | `tsc` + unit test handler |
| M6 | Manifest + UI badge | `manifest.json` content_scripts entry + `subtitleManagerPanel.ts` ASR badge + displayName | `npm run build` + unit test badge |
| M7 | Browser verify | edge-devtools MCP real YouTube — A1-A9 acceptance | MCP verify pass |

## Risk Mitigation

| Risk | Severity | Mitigation | Verify |
|------|----------|------------|--------|
| YouTube đổi `ytInitialPlayerResponse` structure | MEDIUM | InnerTube fallback (M3) + defensive parsing (optional chaining) | F7 + A1 |
| PO Token required cho tất cả tracks | MEDIUM | Fallback InnerTube WEB-client + user-visible toast (F9/A8) | F9 + A8 |
| `yt-navigate-finish` không fire reliable | MEDIUM | `popstate`/`pushState` hook fallback + videoId dedup | A4 |
| MAIN world script break page | LOW | IIFE self-contained, try/catch swallow errors (mimic `fetchInterceptor.iife.ts`) | A7 |
| CRXJS bundle `.iife.ts` không work cho 2nd MAIN world script | LOW | `fetchInterceptor.iife.ts` đã proven — verify M4 build | M4 build pass |
| YouTube VTT non-standard tags | LOW (G1 PASS) | `stripSubtitleTags` regex handle — G1 verify PASS | A9 |

## Parallelism

- **M1 → M2 → M3**: sequential (M2/M3 depend on M1 entity)
- **M4 || M5**: M4 (MAIN world) + M5 (ISOLATED/background) có thể parallel sau M2/M3 (message contract defined trong spec)
- **M6**: sau M5 (UI badge cần entity + handler)
- **M7**: sau tất cả (browser verify end-to-end)

## Next Phase

→ **G3 ADR** (`020-youtube-subtitle-detection.md`): architecture decision record — MAIN world injection, postMessage bridge, InnerTube routing, SPA re-detect. Invoke `api-and-interface-design` cho message contract.
→ **G4 Implementation**: task breakdown chi tiết đầu G4 (sau ADR), TDD per milestone.
