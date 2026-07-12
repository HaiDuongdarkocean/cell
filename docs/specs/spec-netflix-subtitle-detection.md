# Spec: Netflix (netflix.com) Subtitle Detection

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Approved (spec-reviewer APPROVED_WITH_CONDITIONS — 3 CRITICAL + 12 HIGH/MEDIUM fixes applied 2026-07-13, see `docs/reviews/review-netflix-subtitle-detection.md`)
> **Date**: 2026-07-13
> **Intent source**: conversation 2026-07-13 (Anh yêu yêu cầu tải subtitle netflix.com, ổn định + hiệu năng + thời gian + UX tốt nhất)
> **Research source**: stress test thực tế qua edge-devtools MCP trên movie 81947712 (logged in) + plateaukao/NetflixSubtitleDownloader source (proven 1000+ users)
> **Precedent**: `docs/specs/spec-iqiyi-subtitle-detection.md` + ADR-028 (cùng pattern MAIN-world manifest extraction)

## Objective

Netflix subtitle được detect **proactively** ngay khi video play (không cần user bật CC thủ công) và flow qua hệ thống hiện tại (auto-load, auto-select, download-all-subtitles) giống YouTube/iQIYI. Netflix không expose subtitle download URLs qua public API — `getTextTrackList()` chỉ trả metadata (bcp47, displayName), download URLs nằm trong MSL-encrypted manifest response (`ttDownloadables.downloadUrls`), decrypt bên trong player closure → hệ thống hiện tại (generic `subtitleDetector.ts` match `.srt/.vtt/.ass` URL pattern) không detect được vì Netflix subtitle URL có hash path (`?o=1&v=182&e=...&t=...`) không match pattern → auto-load không bao giờ trigger.

**User**: Anh yêu (language learner) — xem netflix.com và muốn subtitle overlay + bilingual hoạt động ngay khi mở video, output cuối là SRT.

**Why now**: Netflix là streaming platform lớn nhất toàn cầu, content đa ngữ phong phú (33 languages trên 1 movie verify 2026-07-13). Anh yêu đã thử và không tải được subtitle vì cơ chế đặc biệt (MSL encryption + closure-hidden download URLs). Stress test confirm cơ chế 2026: hook `JSON.parse` capture manifest sau MSL decrypt, `JSON.stringify` modify request để force all languages.

**Success**:
- Mở netflix.com/watch/XXX → subtitle list tự populate tất cả 33 ngôn ngữ → broadcast `DETECTED_SUBTITLES` → auto-load chọn target+native language → overlay hiển thị bilingual
- Download-all-subtitles tải được SRT file cho mỗi Netflix subtitle track (converted từ WebVTT downstream — `downloader.ts:368,383` always normalizes to `.srt`). **TTML-only tracks skipped** (dfxp/imsc1.1/simplesdh — ponytail ceiling: no TTML parser in codebase, G5 verify if ttml-only content exists → add `convertTtmlToSrt` lúc đó)
- SPA navigation (switch episode không reload page) → re-detect subtitle mới, clear subtitle cũ
- Forced narrative subtitle (foreign-language dialog) hiển thị với badge `[forced]` trong track list
- Image-based subtitle (dvdsub) skip tự động (không parse-able)
- Browser verify trên real Edge/Chrome (MCP) trước commit

## Architecture — Two Detection Paths (reuse ADR-020/ADR-028 pattern)

Netflix detection **bypass `detectSubtitle()` entirely** — path riêng, không refactor generic detector. Clone pattern iQIYI (ADR-028) với 4 khác biệt cốt lõi.

```
Path A (generic — UNCHANGED): network interception
  chrome.webRequest → NetworkRequest{url, tabId} → detectSubtitle() → DetectedSubtitle[]
  + fetchInterceptor.iife.ts (MAIN world) → postMessage → DETECTED_SUBTITLE_URL
  Applies: kisskh, hoathinh3d, themoviebox, mọi site có .srt/.vtt/.ass URL

Path B (YouTube — EXISTING, ADR-020): proactive MAIN-world InnerTube ANDROID parse
  youtube-main-world.iife.ts → InnerTube ANDROID → captionTracks → DetectedSubtitle[]
  Applies: youtube.com ONLY

Path C (iQIYI — EXISTING, ADR-028): proactive MAIN-world playerObject.stl parse
  iqiyi-main-world.iife.ts → poll window.playerObject.stl → DetectedSubtitle[]
  Applies: iq.com, *.iq.com, iqiyi.com ONLY

Path D (Netflix — NEW): proactive MAIN-world JSON.parse/stringify hook
  netflix-main-world.iife.ts (MAIN world, scoped *://*.netflix.com/*)
    → hook JSON.stringify (modify manifest request: add all formats + showAllSubDubTracks)
    → hook JSON.parse (capture manifest response: result.timedtexttracks[].ttDownloadables.downloadUrls)
    → mapNetflixSubtitleTracks() → DetectedSubtitle[] (format: 'vtt' only — WebVTT-first, TTML tracks skipped, isAsr: false)
    → window.postMessage({ type: '__NF_DETECTED_SUBTITLES', tracks, movieId })
  content-script.ts (ISOLATED) listener → sendMessage(DETECTED_SUBTITLES) → background
  background handler → existing auto-load flow (findSubtitlesForOverlay → handleAutoLoadSubtitles)
  Applies: netflix.com ONLY
```

**No adapter registry** — `subtitleDetector.ts` giữ nguyên 100% (YAGNI — ponytail rung 1, ADR-020/ADR-028 đã quyết định). 4 path song song (A generic + B YouTube + C IQ + D Netflix), mỗi path 1 MAIN-world script riêng + unified background handler. Nếu sau này thêm Viu/Viki, viết spec riêng khi có 5th adapter thật sự (lúc đó mới refactor adapter registry).

### 4 khác biệt cốt lõi so với iQIYI (ADR-028)

| # | iQIYI (ADR-028) | Netflix (spec này) |
|---|---|---|
| 1 | Poll `window.playerObject` (manifest trong global object) | **Hook `JSON.parse`** (manifest trong MSL-encrypted response, decrypt trong closure) |
| 2 | `entry.srt` relative path → absolute URL | **`ttDownloadables[format].downloadUrls`** — absolute URL sẵn, chọn preferred format |
| 3 | Numeric `lid` → ISO map table (`LID_TO_ISO`) | **BCP 47 `track.language`** — match `languageRegistry.ts` directly, không cần map table |
| 4 | Polling 1s + timeout 15s (player init 3-7s) | **No polling** — manifest fetch trigger `JSON.parse` hook tự động trên mỗi video load |

### 2 khác biệt cốt lõi so với YouTube (ADR-020)

| # | YouTube (ADR-020) | Netflix (spec này) |
|---|---|---|
| 1 | InnerTube ANDROID fallback (PO Token bypass) | **Hook `JSON.stringify`** modify manifest request (add all formats + `showAllSubDubTracks = true`) |
| 2 | `&fmt=vtt` append vào baseUrl → WebVTT | **Choose preferred format** từ `ttDownloadables` keys (webvtt-lssdh-ios8 preferred) |

## Assumptions (surface trước khi spec nội dung)

1. **Format choice: WebVTT-only (ponytail ceiling)** — Netflix `ttDownloadables` keyed by format: `webvtt-lssdh-ios8`, `dfxp-ls-sdh`, `imsc1.1`, `simplesdh`. **G4 chỉ emit `webvtt-lssdh-ios8`** (plaintext, parse-able by `parseVtt`). TTML family (dfxp/imsc1.1/simplesdh) **skipped** — codebase không có TTML parser (`SubtitleFormat` type `src/entities/subtitle/types.ts:8` không có `'ttml'`, `downloader.ts:360` throw trên unknown format). **Ponytail ceiling**: nếu movie chỉ có TTML tracks → 0 subtitle trên G4. Upgrade path: add `'ttml'` to `SubtitleFormat` + implement `convertTtmlToSrt` + wire vào `downloader.ts:353-361` + `subtitleAutoLoad.ts:151` (G5+ nếu verify có ttml-only content). **Why WebVTT-first**: `webvtt-lssdh-ios8` là Netflix default cho modern content (plateaukao extension cũng ưu tiên), đa số movie có WebVTT track. **G1 verify**: fetch real Netflix WebVTT downloadUrl qua MCP, run qua `parseVtt` (`src/shared/lib/parsers/vttParser.ts`), confirm parse thành công. **To verify in G4**: downloadUrl fetch từ MAIN world (có Netflix cookies) vs background SW (cross-origin block — cần `initiator: 'https://www.netflix.com/'` + DNR Referer).

2. **MAIN world injection: separate `netflix-main-world.iife.ts`** — thêm content-script entry mới trong `manifest.json` với `world: 'MAIN'`, `matches: ["*://*.netflix.com/*"]` (không `<all_urls>` — avoid overhead non-Netflix). Suffix `.iife.ts` theo CRXJS convention (consistent với `fetchInterceptor.iife.ts` + `youtube-main-world.iife.ts` + `iqiyi-main-world.iife.ts`). MV3 native support `world: 'MAIN'` (Chrome 111+). `run_at: 'document_start'` — **CRITICAL**: hook `JSON.parse`/`JSON.stringify` TRƯỚC Netflix player scripts load (manifest fetch xảy ra sau player init → hook luôn kịp).

3. **MAIN↔ISOLATED bridge: `window.postMessage`** — adopt existing pattern từ `fetchInterceptor.iife.ts` (ADR-011) + `youtube-main-world.iife.ts` (ADR-020) + `iqiyi-main-world.iife.ts` (ADR-028). MAIN world script `postMessage({ type: '__NF_DETECTED_SUBTITLES', tracks, movieId })` → ISOLATED `content-script.ts` listener → `sendMessage(DETECTED_SUBTITLES)` → background. **Reuse `DETECTED_SUBTITLES` message type** (ADR-020 đã define) + thêm `source: 'netflix'` discriminator. `detectionDispatch.ts` đã là unified handler (ADR-028), chỉ thêm `else if (source === 'netflix')` branch. **Content-script handshake**: `content-script.ts` posts `__NF_CS_READY` (clone `__YT_CS_READY`/`__IQ_CS_READY`) để `netflix-main-world.iife.ts` re-post khi listener late-register. `DetectedSubtitlesPayload` entity update: `source` union thêm `'netflix'`, thêm `movieId?: number`.

4. **Hook strategy: `JSON.parse` + `JSON.stringify`** — Netflix player decrypt MSL response → `JSON.parse(text)` → hook capture `result.timedtexttracks[].ttDownloadables.downloadUrls`. Netflix player send manifest request → `JSON.stringify(payload)` → hook modify `profiles[]` (add all formats) + `showAllSubDubTracks = true` → force Netflix expose ALL 33 languages (not just user locale). **Ceiling**: nếu Netflix đổi MSL decrypt flow (parse trong Worker, hoặc custom parser), hook miss. Upgrade: intercept CMAF segment range requests + parse fragmented MP4 (phức tạp hơn, không G4). **Why both hooks**: `JSON.stringify` alone → request modified nhưng không capture response. `JSON.parse` alone → capture response nhưng chỉ user-locale tracks (5-10 languages). Cả 2 → tất cả 33 languages.

5. **SPA navigation: `popstate` + `pushState` hook + movieId dedup** — Netflix SPA switch episode đổi URL `/watch/<new-id>` không reload. Player fetch manifest mới → `JSON.parse` hook fire tự động. Dedup by `movieId` (re-detect same video = no-op). **No polling** (khác iQIYI): manifest fetch là trigger, không cần poll `window.netflix`. **NOT reuse ADR-010** `reportEpisodeChangedIfReplacement` (Netflix reuse same `<video>` element, chỉ đổi src → ADR-010 element-identity watcher không fire — same reasoning as YouTube ADR-020 + iQIYI ADR-028).

6. **Language: BCP 47 directly (via `languageMatches()`)** — Netflix `track.language` đã là BCP 47 (`en`, `vi`, `zh-Hans`, `zh-Hant`, `pt-BR`, `es-ES`, ...). Match qua `languageRegistry.ts` `languageMatches()` (subtag-aware), không cần map table (khác iQIYI `LID_TO_ISO`). **Verify 2026-07-13**: 33 languages trên movie 81947712, tất cả match qua `languageMatches()` subtag fallback (`es` matches `es-ES` via `c.startsWith(t + '-')`). **G4 audit (Risk #4)**: `grep -rn 's\.language ===\|language ===' src/` — mọi comparison phải đi qua `languageMatches()` hoặc normalize qua `toIso6391()` trước. `pt-BR`/`es-ES`/`es-419` phải match user's `pt`/`es` setting. Auto-load path đã OK (`findSubtitlesForOverlay` `subtitleService.ts:61`, `selectBestMedia.ts:80` dùng `languageMatches`). **Lowercase `track.language` trước khi store** (`zh-Hans`→`zh-hans`) cho consistent matching.

7. **Forced narrative + image-based handling**:
   - **Forced narrative** (`isForcedNarrative: true`): subtitle cho foreign-language dialog (vd: English movie có Spanish dialog → forced Spanish subtitle). Include trong detection, append `-forced` vào displayName để user distinguish. **Not skip** — user có thể cần.
   - **Image-based** (`isImageBased: true`): DVD-style image subtitle (dvdsub), không parse-able. **Skip** trong `extractNetflixTracks` (graceful degradation, clone YouTube PO Token skip).
   - **None track** (`isNoneTrack: true`): "Off" track. **Skip** trong `extractNetflixTracks`.

8. **Download URL fetch: MAIN world vs background SW**:
   - **MAIN world fetch**: có Netflix cookies + origin → works (verified plateaukao pattern). Nhưng MAIN world script không thể trigger download (cần `chrome.downloads` API).
   - **Background SW fetch**: cross-origin block (no cookies/origin). Cần `initiator: 'https://www.netflix.com/'` + DNR Referer header (clone iQIYI pattern từ commit 700b901).
   - **Decision**: DetectedSubtitle.url = downloadUrl (absolute), initiator = `'https://www.netflix.com/'`. Background fetch subtitle content với DNR Referer → parse → overlay. **To verify in G4**: DNR rule cho Netflix Referer (clone iQIYI rule).

## Functional requirements

### FR-1: MAIN world injection (manifest change)
- Add content_script entry: `matches: ["*://*.netflix.com/*"]`, `js: ["src/entrypoints/content/netflix-main-world.iife.ts"]`, `run_at: "document_start"`, `world: "MAIN"`, `all_frames: false`.
- **Verify**: load unpacked extension → DevTools console → `window.__NF_MAIN_WORLD_INJECTED === true`.

### FR-2: JSON.stringify hook (modify manifest request)
- Hook `JSON.stringify` global.
- Filter: payload có `url` string match `/manifest|licensedManifest/` AND có object value với `profiles[]` array.
- Modify: add all 4 formats (`webvtt-lssdh-ios8`, `dfxp-ls-sdh`, `imsc1.1`, `simplesdh`) to `profiles[]` if missing. Set `showAllSubDubTracks = true` if field exists.
- **No-op** cho non-manifest payloads (filter bằng url pattern).
- **Verify**: DevTools Network → manifest request payload có `profiles[]` chứa all 4 formats + `showAllSubDubTracks: true`.

### FR-3: JSON.parse hook (capture manifest response)
- Hook `JSON.parse` global.
- Filter: parsed data có `result.timedtexttracks` (defensive: `Array.isArray` check) AND `result.movieId` (looser check — `'movieId' in result`, không truthy check vì `movieId === 0` falsy). **Fallback**: nếu `result.movieId` missing/falsy, derive từ `location.pathname` `/watch/(\\d+)/`.
- Extract: `extractNetflixTracks(result)` → skip `isNoneTrack` + `isImageBased` → return `NetflixSubtitleTrack[]`.
- Post: `window.postMessage({ type: '__NF_DETECTED_SUBTITLES', tracks, movieId })` khi tracks.length > 0.
- Cache: `lastDetectedTracks` + `lastDetectedMovieId` cho handshake re-post.
- **No-op** cho non-manifest payloads (filter bằng result shape).
- **Verify**: DevTools console → `window.__NF_DEBUG.captureCount > 0` sau khi play video.

### FR-4: extractNetflixTracks (pure logic)
- Input: `manifestResult` (unknown — defensive parse).
- Walk: `result.timedtexttracks[]`.
- Filter: skip `isNoneTrack === true`, skip `isImageBased === true`.
- Return: `NetflixSubtitleTrack[]` (subset fields: language, languageDescription, rawTrackType, trackType, isNoneTrack, isForcedNarrative, isImageBased, ttDownloadables).
- **Empty** khi structure missing/malformed → caller treats empty as "no subtitle" (trigger overlay clear on SPA nav).
- **Unit test**: mock 42-track manifest → confirm 33 real tracks (skip noneTrack + imageBased).

### FR-5: mapNetflixSubtitleTracks (pure logic)
- Input: `NetflixSubtitleTrack[]`, `tabId`.
- For each track:
  - `url` = `ttDownloadables['webvtt-lssdh-ios8']?.downloadUrls?.[firstKey]` — **WebVTT-only** (ponytail ceiling, see Assumption 1). **Fallback shape**: nếu `downloadUrls` missing, try `urls[0].url` (alternative `NetflixDownloadable` shape, ADR-029 Contract 1). Skip track nếu không có webvtt downloadable (console.warn).
  - `format` = `'vtt'` (WebVTT only — TTML tracks skipped, không emit `'ttml'`).
  - `language` = `track.language` (BCP 47, lowercase — `zh-Hans` → `zh-hans` cho consistent matching).
  - `isAsr` = `false` (Netflix không có AI distinction).
  - `displayName` = `track.languageDescription` + (`isForcedNarrative` && `!languageDescription.toLowerCase().includes('forced')` ? ` [forced]` : ``). **Guard**: tránh duplicate ` [forced]` nếu Netflix đã include "forced" trong `languageDescription`.
  - `initiator` = `'https://www.netflix.com/'`.
- Return: `DetectedSubtitle[]`.
- **Unit test**: mock 33 tracks → confirm WebVTT tracks mapped (each có url, format='vtt', language). Mock ttml-only track → confirm skipped.

### FR-6: ISOLATED listener (content-script.ts amend)
- Add `__NF_CS_READY` handshake post (clone `__YT_CS_READY`/`__IQ_CS_READY` — exact lines 18-20).
- Add `__NF_DETECTED_SUBTITLES` listener (clone `__IQ_DETECTED_SUBTITLES` block lines 108-135): dedup by `movieId` (string-based — `String(movieId ?? '')`, clone YouTube/iQIYI `?? ''` pattern, NOT `?? 0` which is falsy) → relay `sendMessage(DETECTED_SUBTITLES, { tracks, movieId, source: 'netflix' })`.
- **Verify**: DevTools console → `[content-script] __NF_DETECTED_SUBTITLES received` log.

### FR-7: Background handler (detectionDispatch.ts amend) + entity amend prerequisite
- **PREREQUISITE (must land first)**: Amend `DetectedSubtitlesPayload` in `src/entities/message/types.ts:459-468` — add `'netflix'` to `source` union (line 462) + add `readonly movieId?: number;` field. Without this, TypeScript reject `source: 'netflix'` + Netflix posts fall into YouTube `else` branch → wrong mapper → 0/garbage subtitles.
- Add `else if (source === 'netflix')` branch in `detectionDispatch.ts:55-69` → `mapNetflixSubtitleTracks(payload.tracks as NetflixSubtitleTrack[], tabId)`.
- Post-map flow UNCHANGED (empty → clear overlay, added → broadcast + auto-load).
- **Verify**: DevTools console → `[bg DETECTED_SUBTITLES] stored subtitles` log với `source: 'netflix'`.

### FR-8: SPA navigation
- Hook `popstate` + wrap `history.pushState` + **wrap `history.replaceState`** → reset `lastMovieId` (force re-detect). Netflix có thể dùng `replaceState` cho episode changes (SPA pattern tránh back-button pollution) — verify trong G4 MCP.
- Player fetch manifest mới trên SPA nav → `JSON.parse` hook fire → new movieId → post.
- Dedup by `movieId` (string-based — clone YouTube `videoId` / iQIYI `tvid` `?? ''` pattern).
- **Verify**: switch episode → confirm re-detect (new movieId in `__NF_DEBUG`). Nếu `popstate`/`pushState` không fire, confirm `replaceState` hook catch.

### FR-9: DNR Referer rule (download URL fetch)
- **Reuse existing per-URL `setRefererRule(subtitle.url, 'https://www.netflix.com/')`** (clone iQIYI pattern từ `downloader.ts:331` — `declarativeNetRequest.ts:59-97` tạo per-URL dynamic rule + `removeRefererRule` cleanup sau fetch). **NOT domain-wide static rule** (would affect page-originated requests, violating `declarativeNetRequest.ts` comment line 17-18).
- **To verify in G4**: background fetch Netflix subtitle downloadUrl → 200 OK (not 403).

## Non-functional requirements

### NFR-1: Performance
- Hook `JSON.parse`/`JSON.stringify` filter bằng url pattern + result shape — O(1) check, no-op cho 99.9% payloads.
- 1 HTTP GET = complete WebVTT/DFXP file (không parse MP4 binary, không reassemble segments).
- **Target**: subtitle detect < 100ms sau manifest response (hook synchronous).

### NFR-2: Robustness
- Hook miss (Netflix đổi MSL flow, MSL decrypt move to Worker) → silent fail, no crash. **Diagnostic**: nếu `__NF_DEBUG.captureCount === 0` sau 10s playback → `console.warn('[NF] hook miss — Netflix may have moved MSL decrypt to Worker, reload page')` + set `__NF_DEBUG.hookMiss = true` cho QA/support. User reload page → re-trigger.
- Image-based track skip — graceful degradation.
- TTML-only tracks (dfxp/imsc1.1/simplesdh) skip — graceful degradation + `console.warn` (ponytail ceiling, see Assumption 1).
- Malformed `downloadUrls` (empty/missing) → skip track + console.warn.

### NFR-3: Backward compatibility
- `DetectedSubtitlesPayload.source` union thêm `'netflix'` — optional, existing YouTube/iQIYI posts không set → undefined → existing flow.
- `detectionDispatch.ts` add `else if` branch — existing YouTube/iQIYI branches UNCHANGED.
- `manifest.json` add content_script entry — existing entries UNCHANGED.

## Edge cases

1. **Hook late-inject** (CRXJS async loader delay): MAIN world script inject sau ISOLATED listener register → MAIN world post miss → ISOLATED never relay. **Fix**: `__NF_CS_READY` handshake — ISOLATED posts ready signal, MAIN world re-post last tracks on receive (clone ADR-020/ADR-028).

2. **Manifest cached** (player reuse manifest cho same video): `JSON.parse` hook không fire lại. **Fix**: dedup by `movieId` — same movieId = no-op (don't re-post). SPA nav → new movieId → new manifest fetch → hook fire.

3. **MSL response parse trong Worker**: nếu Netflix move MSL decrypt sang Worker, `JSON.parse` hook trong main thread miss. **Diagnostic**: `__NF_DEBUG.captureCount === 0` sau 10s → `console.warn` + `__NF_DEBUG.hookMiss = true` (NFR-2). **Ceiling**: user reload page (main thread hook re-install). Upgrade: CMAF segment intercept (future work, không G4).

4. **Netflix change `ttDownloadables` shape**: rename field, restructure downloadUrls. **Fix**: `extractNetflixTracks` defensive parse — skip malformed tracks, console.warn. Drift detector test (clone iQIYI pattern) catch shape change.

5. **Subtitle CDN hotlink protection**: downloadUrl fetch từ background SW 403 (no Referer). **Fix**: DNR rule set `Referer: https://www.netflix.com/` (clone iQIYI pattern).

6. **Track with no downloadUrls** (rare — metadata-only track): skip track + console.warn. Don't include trong DetectedSubtitle[].

7. **Forced narrative + regular subtitle same language**: vd `en` (regular) + `en` (forced). Both include, displayName distinguish (`English` vs `English [forced]`). **Guard**: chỉ append ` [forced]` nếu `languageDescription` chưa chứa "forced" (tránh duplicate `English (forced) [forced]`). Auto-load prefer regular (first match).

8. **Image-based subtitle** (dvdsub): skip trong `extractNetflixTracks`. User không thấy trong track list.

## Out of scope

- **CMAF segment intercept + MP4 parse** (fallback layer) — ceiling nếu hook miss, không G4. Future work khi hook proven insufficient.
- **Netflix video download** (DRM-protected) — không scope, chỉ subtitle.
- **Netflix-specific UI** (subtitle format selector, batch season download) — reuse existing UI, không custom.
- **EPUB export** (plateaukao feature) — không scope.

## Verification plan (G5)

1. **Unit test** (`tests/unit/features/detection/logic/netflixSubtitleDetector.test.ts`):
   - `extractNetflixTracks`: mock 42-track manifest → 33 real tracks (skip noneTrack + imageBased).
   - `mapNetflixSubtitleTracks`: 33 tracks → WebVTT tracks mapped (url, format='vtt', language, displayName). **TTML-only track → skipped** (ponytail ceiling verify). **`urls[]` shape fallback**: mock track với `urls[]` (no `downloadUrls`) → confirm `urls[0].url` used.
   - **Drift detector**: Netflix track shape (bcp47, ttDownloadables keys) — clone iQIYI drift pattern. **Request shape drift**: assert `__NF_DEBUG.stringifyModifiedCount > 0` (JSON.stringify hook modified profiles[]).
   - Edge: empty manifest, malformed tracks, no downloadUrls, image-based skip, forced narrative include, **forced displayName guard** (languageDescription đã chứa "forced" → không duplicate suffix), **movieId=0 falsy** (derive từ URL fallback), **movieId string** (defensive parse).

2. **Browser verify (MCP)**:
   - Load unpacked extension → navigate `netflix.com/watch/81947712` → confirm `window.__NF_MAIN_WORLD_INJECTED === true`.
   - Confirm `window.__NF_DEBUG.captureCount > 0` sau manifest response.
   - Confirm `[content-script] __NF_DETECTED_SUBTITLES received` log.
   - Confirm `[bg DETECTED_SUBTITLES] stored subtitles` log với `source: 'netflix'`, 33 tracks.
   - Confirm overlay auto-load (target + native language).
   - SPA nav: switch episode → confirm re-detect (new movieId).
   - Fetch downloadUrl → confirm WebVTT content → confirm `parseVtt` success.

3. **DNR verify**: background fetch Netflix subtitle downloadUrl → 200 OK (not 403).

4. **tsc + lint + build**: no type errors, no lint errors, build success.
