# Spec: iQIYI (iq.com) Subtitle Detection

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ Anh yêu review + doubt-driven adversarial review
> **Date**: 2026-07-12
> **Intent source**: conversation 2026-07-12 (Anh yêu yêu cầu tải subtitle iq.com, stress test trên trang thật)
> **Research source**: stress test thực tế qua edge-devtools MCP trên 2 trang (free ep56 + VIP ep51, đã login)
> **Precedent**: `docs/specs/spec-youtube-subtitle-detection.md` + ADR-020 (cùng pattern MAIN-world manifest extraction)

## Objective

iQIYI subtitle được detect **proactively** ngay khi video load (không cần user bật CC thủ công) và flow qua hệ thống hiện tại (auto-load, auto-select, download-all-subtitles) giống YouTube/kisskh. IQ không expose API subtitle công khai — player inject toàn bộ manifest vào global `window.playerObject` trên MAIN world context → hệ thống hiện tại (generic `subtitleDetector.ts` match `.srt/.vtt/.ass` URL pattern) không detect được vì IQ subtitle URL có hash path (`/20260115/6c/7b/c112...srt?...`) không match pattern → auto-load không bao giờ trigger.

**User**: Anh yêu (language learner) — xem iq.com và muốn subtitle overlay + bilingual hoạt động ngay khi mở video, output cuối là SRT.

**Why now**: iq.com là streaming platform lớn (đặc biệt cho content Trung Quốc sub đa ngữ). Anh yêu đã thử và không tải được subtitle vì cơ chế đặc biệt (manifest trong JS object, không phải URL công khai). Stress test confirm cơ chế 2026: plaintext SRT, không encryption WASM (yt-dlp issue #7734 đã không còn tồn tại trên cả free lẫn VIP content).

**Success**:
- Mở iq.com video có subtitle → subtitle list tự populate tất cả ngôn ngữ (human + AI) → broadcast `DETECTED_SUBTITLES` → auto-load chọn target+native language → overlay hiển thị bilingual
- Download-all-subtitles tải được file `.srt` cho mỗi IQ subtitle track (format cuối = SRT, Anh yêu đã quyết định)
- SPA navigation (switch episode không reload page) → re-detect subtitle mới, clear subtitle cũ
- AI subtitle (IQ `ss === 1`) hiển thị với badge "auto" trong track list (reuse `isAsr` field ADR-020)
- Content VIP (đã login) hoạt động giống content free — `qd_uid` trong URL đã embedded trong manifest
- Browser verify trên real Edge/Chrome (MCP) trước commit — cả free + VIP content

## Architecture — Two Detection Paths (reuse ADR-020 pattern)

IQ detection **bypass `detectSubtitle()` entirely** — path riêng, không refactor generic detector. Clone pattern YouTube (ADR-020) với 3 khác biệt cốt lõi.

```
Path A (generic — UNCHANGED): network interception
  chrome.webRequest → NetworkRequest{url, tabId} → detectSubtitle() → DetectedSubtitle[]
  + fetchInterceptor.iife.ts (MAIN world) → postMessage → DETECTED_SUBTITLE_URL
  Applies: kisskh, hoathinh3d, themoviebox, mọi site có .srt/.vtt/.ass URL

Path B (YouTube — EXISTING, ADR-020): proactive MAIN-world ytInitialPlayerResponse parse
  youtube-main-world.iife.ts → InnerTube ANDROID → captionTracks → DetectedSubtitle[]
  Applies: youtube.com ONLY

Path C (iQIYI — NEW): proactive MAIN-world playerObject.stl parse
  iqiyi-main-world.iife.ts (MAIN world, scoped *://*.iq.com/* + *://*.iqiyi.com/*)
    → poll window.playerObject.package.engine.movieinfo.current.originalData.data.program.stl
    → mapIqiyiSubtitleTracks() → DetectedSubtitle[] (format: 'srt', isAsr: ss===1)
    → window.postMessage({ type: '__IQ_DETECTED_SUBTITLES', tracks, tvid })
  content-script.ts (ISOLATED) listener → sendMessage(DETECTED_SUBTITLES) → background
  background handler → existing auto-load flow (findSubtitlesForOverlay → handleAutoLoadSubtitles)
  Applies: iq.com, *.iq.com, iqiyi.com ONLY
```

**No adapter registry** — `subtitleDetector.ts` giữ nguyên 100% (YAGNI — ponytail rung 1, ADR-020 đã quyết định). 3 path song song (A generic + B YouTube + C IQ), mỗi path 1 MAIN-world script riêng + 1 background handler riêng. Nếu sau này thêm Netflix/Viu, viết spec riêng khi có 4th adapter thật sự (lúc đó mới refactor adapter registry).

### 3 khác biệt cốt lõi so với YouTube (ADR-020)

| # | YouTube (ADR-020) | iQIYI (spec này) |
|---|---|---|
| 1 | InnerTube ANDROID fallback (PO Token bypass) | **Không cần fallback** — manifest luôn trong `playerObject`, không có PO Token concept |
| 2 | `&fmt=vtt` append vào baseUrl → WebVTT | **URL đã có `.srt` path sẵn** — dùng `entry.srt` trực tiếp, format `'srt'`, không append param |
| 3 | `yt-navigate-finish` custom event + videoId dedup | **Không có custom event** — IQ SPA dùng history API. Poll `playerObject` + dedup by `tvid` + `popstate`/`pushState` hook |

## Assumptions (surface trước khi spec nội dung)

1. **Format choice: SRT** — Anh yêu đã quyết định (output cuối Cell = SRT). Mỗi entry trong `stl[]` có 3 path: `srt`, `webvtt`, `xml`. Dùng `entry.srt` (Content-Type `application/x-subrip`, plaintext, không encryption). Không cần convert. **G1 verify**: fetch real IQ SRT sample qua MCP, run qua `parseSrt` (`src/shared/lib/parsers/srtParser.ts`), confirm parse thành công. Đã verify 2026-07-12: VI/EN/FR/KO SRT đều parse-able, format chuẩn `1\r\n00:00:11,430 --> 00:00:13,820\r\n[text]`.

2. **MAIN world injection: separate `iqiyi-main-world.iife.ts`** — thêm content-script entry mới trong `manifest.json` với `world: 'MAIN'`, `matches: ["*://*.iq.com/*", "*://*.iqiyi.com/*"]` (không `<all_urls>` — avoid overhead non-IQ). Suffix `.iife.ts` theo CRXJS convention (consistent với `fetchInterceptor.iife.ts` + `youtube-main-world.iife.ts`). MV3 native support `world: 'MAIN'` (Chrome 111+).

3. **MAIN↔ISOLATED bridge: `window.postMessage`** — adopt existing pattern từ `fetchInterceptor.iife.ts` (ADR-011) + `youtube-main-world.iife.ts` (ADR-020). MAIN world script `postMessage({ type: '__IQ_DETECTED_SUBTITLES', tracks, tvid, origin })` → ISOLATED `content-script.ts` listener → `sendMessage(DETECTED_SUBTITLES)` → background. **Reuse `DETECTED_SUBTITLES` message type** (ADR-020 đã define) + thêm `source: 'iqiyi'` discriminator. **CRITICAL**: `messageBus.on()` dùng `Map.set()` — overwrite handler trước. 2 handlers register cùng `DETECTED_SUBTITLES` → 1 thắng 1 thua → YouTube break. **Must use 1 unified handler** (`detectionDispatch.ts`) + `source` field dispatch (if/else). ADR-020 amend: move DETECTED_SUBTITLES logic từ `youtubeDetection.ts` sang `detectionDispatch.ts` unified. `youtubeDetection.ts` giữ chỉ `INNERTUBE_FALLBACK_REQUEST`. **Content-script handshake**: `content-script.ts` posts `__IQ_CS_READY` (clone `__YT_CS_READY` dòng 18) để `iqiyi-main-world.iife.ts` re-post khi listener late-register. `iqiyi-main-world.iife.ts` listener guard dùng `event.source === window` (giống `youtube-main-world.iife.ts`, không dùng `event.source !== window`). `DetectedSubtitlesPayload` entity update: `videoId` optional, thêm `source?: 'youtube' | 'iqiyi'`, `tvid?: string`, `origin?: string`.

4. **Polling strategy: `playerObject` ready detection** — IQ `playerObject` available sau khi player init (~3-7s sau page load), không có custom event. Poll interval 1s, timeout 15s. Dedup by `tvid` (re-detect same video = no-op). **Trigger**: (a) page load + poll, (b) `popstate`/`pushState` hook (SPA episode switch), (c) `__IQ_CS_READY` handshake (clone ADR-020 race fix — CRXJS async loader delay). **Ceiling**: poll timeout 15s nếu player init chậm hơn (rare, slow network). Upgrade: MutationObserver trên `<video>` element.

5. **SPA navigation: `popstate` + `pushState` hook + tvid dedup** — IQ SPA switch episode đổi URL `/play/<new-episode-id>` không reload. Reuse pattern `onSpaNav` hiện có trong `contentScriptController.ts` (dòng 1471-1489, đã có `popstate` listener). MAIN world script re-detect khi `tvid` change. **Note**: `tvid` is the per-video identifier; `vid` is a streaming session ID reused across unrelated videos and must NOT be used for dedup (verified 2026-07-12). **NOT reuse ADR-010** `reportEpisodeChangedIfReplacement` (IQ reuse same `<video>` element, chỉ đổi src → ADR-010 element-identity watcher không fire — same reasoning as YouTube ADR-020).

6. **Language map: `lid` → ISO 639-1 / IETF** — IQ dùng numeric `lid` (1=zh-hans, 2=zh-hant, 3=en, 4=ko, 5=ja, 6=fr, 18=th, 21=ms, 23=vi, 24=id, 26=es, 30=de). Map table hardcode trong `iqiyiSubtitleDetector.ts`. Auto-load matching dùng ISO code (consistent với generic detector + YouTube). **Verify 2026-07-12**: 12 ngôn ngữ trên ep56 + 11 ngôn ngữ trên ep51, tất cả match map table.
   - **Chinese script variants**: overlay target/native dropdown exposes `zh-hans` (Simplified), `zh-hant` (Traditional), and the macrolanguage `zh`. `findSubtitlesForOverlay` uses BCP 47 subtag-aware matching: `zh` matches both variants; `zh-hans`/`zh-hant` match only their own variant (with graceful fallback to generic `zh`).

7. **AI subtitle: `ss === 1` → `isAsr: true`** — IQ `ss` field (0=human, 1=AI-generated). Map sang `isAsr` field (ADR-020 đã add). UI (subtitle manager panel) hiển thị badge "auto" khi `isAsr === true` (existing behavior). **Verify 2026-07-12**: FR/KO/JP/ES/DE trên ep56 = `ss:1` (AI), VI/EN/TH/MS/ID/ZH = `ss:0` (human).

8. **Referer / CORS**: IQ subtitle CDN (`meta.video.iqiyi.com`) require `referer: https://www.iq.com/` + `origin: https://www.iq.com/`. Content-script fetch (page context) tự set Referer (browser controls) → work. CORS header `access-control-allow-origin:*` → fetch `credentials:'omit'` work (fetch `credentials:'include'` fail vì CORS `*` không tương thích credentials — verified 2026-07-12). Background fallback (SW fetch) cần `declarativeNetRequest` set Referer (Cell đã có pattern commit 700b901 + ADR-007 A7 + knowledge `forbidden-header-referer-dnr.md`). `initiator` field set `'https://www.iq.com/'` trên DetectedSubtitle.

9. **URL expire (`qd_tm`)**: URL subtitle có timestamp `qd_tm=1783806770187`. **Chưa test TTL**. Nếu expire → re-extract manifest khi user click download (cheap, 1 executeScript). **Defer**: test TTL trong BUILD phase. Nếu expire < 24h → thêm re-extract logic. Nếu expire ≥ 24h → no-op (user thường download ngay sau khi mở video).

10. **WASM encryption (yt-dlp #7734, 2023)**: **OUT of scope** — stress test 2026-07-12 trên cả free (ep56) + VIP (ep51, đã login) đều plaintext, không encryption. yt-dlp issue 2023 có thể IQ đã bỏ, hoặc chỉ cho content China region. **Ponytail note**: nếu tương lai IQ revive encryption, viết spec riêng. Không preemptive handler (YAGNI).

11. **DetectedSubtitle entity: NO extension** — entity đã có `isAsr`, `displayName`, `initiator` (ADR-020). IQ adapter set cả 3, không cần thêm field. Backward compatible.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (manifest v3) — content script `world: 'MAIN'` (Chrome 111+)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin (`.iife.ts` suffix cho MAIN world standalone bundle)
- **Testing**: Jest 30 (unit + integration), edge-devtools MCP (browser verify trên real iq.com)
- **Platform**: Windows (PowerShell)

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test unit:        npm run test:unit
Test integration: npm run test:integration
Lint:             npm run lint
Browser verify:   edge-devtools MCP (manual — real iq.com video, cả free + VIP)
```

## Project Structure

```
src/
├── features/
│   ├── detection/
│   │   ├── logic/
│   │   │   ├── subtitleDetector.ts            # UNCHANGED — generic URL-pattern detector (Path A)
│   │   │   ├── youtubeSubtitleDetector.ts     # EXISTING (ADR-020) — YouTube captionTracks → DetectedSubtitle[]
│   │   │   ├── iqiyiSubtitleDetector.ts       # NEW — IQ stl[] → DetectedSubtitle[] (pure, unit-testable)
│   │   │   └── index.ts                       # UPDATE — export iqiyiSubtitleDetector
│   │   └── index.ts
├── entrypoints/
│   ├── content/
│   │   ├── content-script.ts                  # UPDATE — add __IQ_DETECTED_SUBTITLES listener + __IQ_CS_READY post (clone __YT_*)
│   │   ├── fetchInterceptor.iife.ts           # UNCHANGED (ADR-011)
│   │   ├── youtube-main-world.iife.ts         # UNCHANGED (ADR-020)
│   │   └── iqiyi-main-world.iife.ts           # NEW — MAIN world, poll playerObject.stl, postMessage
│   └── background/
│       └── handlers/
│           ├── youtubeDetection.ts            # AMEND (ADR-020) — giữ chỉ INNERTUBE_FALLBACK_REQUEST, move DETECTED_SUBTITLES ra detectionDispatch.ts
│           ├── detectionDispatch.ts           # NEW — unified DETECTED_SUBTITLES handler, source dispatch (youtube|iqiyi)
│           └── index.ts                       # UPDATE — register detectionDispatch + youtubeFallback
└── entities/
    ├── media/
    │   └── types.ts                           # UNCHANGED — DetectedSubtitle đã có isAsr/displayName/initiator
    └── message/
        └── types.ts                           # UPDATE — DetectedSubtitlesPayload: videoId optional + add source/tvid/origin (ADR-028)

tests/
└── unit/
    └── features/
        └── detection/
            └── logic/
                ├── youtubeSubtitleDetector.test.ts  # EXISTING
                └── iqiyiSubtitleDetector.test.ts     # NEW — mapIqiyiSubtitleTracks unit tests

public/
└── manifest.json                               # UPDATE — add iqiyi-main-world.iife.ts content_scripts entry
```

## Code Style

- Function component + hooks, không class component (N/A — feature không có UI)
- Named export, không default export
- Colocate test: `iqiyiSubtitleDetector.ts` → `iqiyiSubtitleDetector.test.ts`
- TypeScript strict, không `any` không lý do (ESLint `no-explicit-any`)
- Logic tách hàm thuần, dễ test, không side effect — `iqiyiSubtitleDetector.ts` pure (no DOM, no Chrome API), `iqiyi-main-world.iife.ts` self-contained IIFE (no imports, clone `youtube-main-world.iife.ts` convention)
- ponytail: mark deliberate simplifications với `// ponytail:` comment + ceiling + upgrade path

### Pattern reference (clone từ ADR-020)

```typescript
// src/features/detection/logic/iqiyiSubtitleDetector.ts (pure)

/** iQIYI subtitle track from playerObject.stl (subset of fields used). */
export interface IqiyiSubtitleTrack {
  readonly _name: string;
  readonly lid: number;        // language ID (1=zh-hans, 23=vi, ...)
  readonly ss: number;         // 0=human, 1=AI-generated
  readonly srt: string;        // relative path to SRT file
  readonly webvtt?: string;
  readonly xml?: string;
  readonly _limited?: number;
  readonly uuid?: string;
}

/** Map IQ stl[] → DetectedSubtitle[] (format: 'srt', isAsr: ss===1). */
export function mapIqiyiSubtitleTracks(
  tracks: readonly IqiyiSubtitleTrack[],
  tabId: number,
  origin: string,              // 'https://meta.video.iqiyi.com' — base URL cho relative path (data.dstl)
): DetectedSubtitle[];
// url = new URL(entry.srt, origin).href (spec-reviewer risk #7 fix — avoid double slash if dstl has trailing slash)
```

## Testing Strategy

### Unit tests (`tests/unit/features/detection/logic/iqiyiSubtitleDetector.test.ts`)

- `mapIqiyiSubtitleTracks`:
  - empty input → `[]`
  - 1 human track (ss:0) → 1 DetectedSubtitle, `isAsr: false`, `format: 'srt'`, `language: 'vi'` (lid 23)
  - 1 AI track (ss:1) → 1 DetectedSubtitle, `isAsr: true`
  - unknown lid (999) → skip (graceful) hoặc language = `'unknown'`? **Decide**: skip + `console.warn` (consistent YouTube PO Token skip)
  - `displayName` = `_name` ("Vietnamese")
  - `url` = `new URL(entry.srt, origin).href` (full URL, handles trailing slash in origin)
  - `initiator` = `'https://www.iq.com/'`
- `extractIqiyiStl` (defensive parse `playerObject` deep path):
  - undefined `playerObject` → `[]`
  - missing `package.engine.movieinfo.current.originalData.data.program.stl` → `[]`
  - valid stl array → return as-is
  - malformed entry (missing `srt` or `lid`) → filter out

### Integration test (manual, edge-devtools MCP)

- Navigate `https://www.iq.com/play/dai-chua-te-tap-56-c4ww2kwbfg?lang=vi_vn` (free)
  - Verify `__IQ_DETECTED_SUBTITLES` post fires
  - Verify subtitle list populate 12 ngôn ngữ
  - Verify auto-load chọn VI (target) + EN (native) → overlay bilingual
  - Verify download-all-subtitles tải được `.srt` file
- Navigate `https://www.iq.com/play/the-great-ruler-episode-51-l10pr7s8ho?lang=en_us` (VIP, đã login)
  - Verify 11 ngôn ngữ, AI badge trên FR/KO/JP/ES/DE
- SPA nav: switch episode (click next ep) → re-detect, clear old subtitle
- SPA nav: video có subtitle → video không subtitle → clear overlay

### Coverage

- `iqiyiSubtitleDetector.ts`: 100% (pure logic)
- `iqiyi-main-world.iife.ts`: manual (IIFE, không unit test — consistent `youtube-main-world.iife.ts`)
- `iqiyiDetection.ts` (background handler): manual (integration)

## Boundaries

### Always
- Reuse `DetectedSubtitle` entity, `DETECTED_SUBTITLES` message type, `fetchAndParseSubtitle` (CORS fallback), `findSubtitlesForOverlay`, `pushAutoLoadSubtitles` — không duplicate auto-load flow
- Clone pattern `youtube-main-world.iife.ts` (ADR-020) — IIFE, no imports, `postMessage` bridge, `__IQ_CS_READY` handshake
- Browser verify trên real iq.com (MCP) trước commit — cả free + VIP content
- `parseSrt` reuse (`src/shared/lib/parsers/srtParser.ts`) — không viết parser mới

### Ask first
- Thêm dependency mới (check bundle size trước)
- Thay đổi `manifest.json` (test trong Chrome thật sau khi đổi)
- Nếu IQ thay đổi cấu trúc `playerObject` (deep path) → update detector + re-verify

### Never
- Không refactor `subtitleDetector.ts` (generic Path A giữ nguyên — ADR-020 precedent)
- Không thêm adapter registry (YAGNI — 3 path song song OK, 4th adapter mới refactor)
- Không xử lý WASM encryption (OUT of scope — yt-dlp #7734 không còn 2026)
- Không tự build URL subtitle (URL đã embedded trong manifest, chỉ đọc + prefix base)
- Không set `Referer` từ content-script fetch (forbidden header — browser controls, background fallback dùng declarativeNetRequest)
- Không log full URL subtitle (ADR-007 D8 — log chỉ language + tvid)

## Success Criteria (LOOP EXIT CONDITION — verify dựa vào đây)

1. **`npm run test:unit` pass** — `iqiyiSubtitleDetector.test.ts` all green, không break test hiện có
2. **`npx tsc --noEmit` clean** — không có type error
3. **`npm run lint` clean** — không có lint error
4. **Browser verify pass (MCP edge-devtools)**:
   - Mở iq.com free video (ep56) → subtitle list populate 12 ngôn ngữ → auto-load bilingual (VI+EN) → overlay hiển thị
   - Mở iq.com VIP video (ep51, đã login) → 11 ngôn ngữ, AI badge trên FR/KO/JP/ES/DE
   - Download-all-subtitles → tải được `.srt` file cho mỗi track
   - SPA switch episode → re-detect subtitle mới, clear cũ
   - SPA video có sub → video không sub → overlay clear
5. **Anh yêu approve** — confirm hoạt động đúng trên trang thật, output SRT đúng format

## Spec Review Findings (resolved 2026-07-12)

> Source: `docs/reviews/review-iqiyi-subtitle-detection.md` (Opus 4.8, APPROVED_WITH_CONDITIONS)

| # | Risk | Severity | Fix applied |
|---|------|----------|-------------|
| 1 | `messageBus.on()` overwrites `DETECTED_SUBTITLES` | CRITICAL | ADR-028 Contract 4: unified `detectionDispatch.ts`, `youtubeDetection.ts` giữ chỉ `INNERTUBE_FALLBACK_REQUEST` |
| 2 | `content-script.ts` missing `__IQ_CS_READY` post | HIGH | Spec Assumption 3 + Project Structure: content-script.ts UPDATE includes `__IQ_CS_READY` post (clone `__YT_CS_READY` dòng 18) |
| 3 | `__IQ_CS_READY` listener guard inverted in ADR-028 | HIGH | ADR-028 Contract 5: fixed `if (event.source !== window) return;` then check type (mirror `youtube-main-world.iife.ts`) |
| 4 | `detect()` sets `lastTvid` before `extractIqiyiStl()` | HIGH | ADR-028 Contract 5: moved `lastTvid = tvid` after `extractIqiyiStl()` succeeds |
| 5 | `detect()` return type mismatch (`Promise<void>` returns `boolean`) | MEDIUM | ADR-028 Contract 5: changed to `Promise<boolean>` |
| 6 | `DetectedSubtitlesPayload` requires `videoId`, lacks `source`/`tvid`/`origin` | MEDIUM | `src/entities/message/types.ts`: `videoId` optional + add `source`/`tvid`/`origin` (applied, tsc clean) |
| 7 | `origin + entry.srt` string concat (double slash risk) | MEDIUM | ADR-028 Contract 1 + Spec: `new URL(entry.srt, origin).href` |
| 8 | `qd_tm` TTL untested | MEDIUM | Open question — BUILD phase test, re-extract on demand if <24h |
| 9 | `docs/intent/intent-iqiyi-subtitle-detection.md` missing | LOW | Intent derived from conversation — note in spec header, not a blocker |

**Open questions for BUILD phase**:
1. `qd_tm` TTL — test expire, add re-extract if <24h
2. `declarativeNetRequest` rule cover `meta.video.iqiyi.com`? — verify in BUILD, add rule if missing
3. `subtitleOverlayAutoLoadAsr` default — IQ AI tracks (FR/KO/JP/ES/DE) common, badge displays but auto-load may skip
