# Todo: Orca OCR Layer

> Spec: `docs/specs/orca-ocr-layer.md` (revised)
> Plan: `tasks/plan.md`
> Review: `docs/specs/orca-ocr-review-final.md`

## Phase 0: Spike — verify blockers + collect test data

- [ ] T0a: Collect real hard-sub frame screenshots (Tier 3 test data)
  - AC: 4 screenshots trong `tests/data-test/ocr/real-frames/`: themoviebox-zh-01.png, kisskh-zh-01.png, moviepire-en-01.png, netflix-drm-01.png. Mỗi frame có subtitle text visible (trừ DRM black frame).
  - Verify: `ls tests/data-test/ocr/real-frames/*.png` → 4 files. Visual inspect: subtitle text visible.
  - Files: `tests/data-test/ocr/real-frames/*.png`
  - Dependencies: None
  - Scope: S (browser test only)

- [ ] T0b: Spike WebGPU + WASM trong offscreen + frame capture trên site thật
  - AC: (1) WebGPU chạy trong offscreen document hoặc xác nhận WASM-only. (2) Frame capture thành công trên themoviebox.xyz (no DRM) → ImageData non-black. (3) Frame capture fail trên Netflix (DRM black frame) → ImageData all-black. (4) ImageData transfer qua Port hoạt động. (5) OCR real frame screenshots (T0a) → text+bbox trả về đúng.
  - Verify: browser test stealth-chrome-devtools — load extension, navigate themoviebox + Netflix, capture frame, check ImageData. Run OCR trên real-frames/*.png.
  - Files: `prototype/orca-ocr-poc/` (extend POC), no src/ changes
  - Dependencies: T0a
  - Scope: M (POC only)

## Checkpoint 0: Spike pass
- [ ] WebGPU chạy trong offscreen (hoặc xác nhận WASM-only)
- [ ] Frame capture thành công trên themoviebox.xyz (no DRM)
- [ ] Frame capture fail trên Netflix (DRM black frame) → drmGuard detect
- [ ] ImageData transfer qua Port hoạt động

## Phase 1: Foundation — types + script-run segmenter + persistence

- [ ] T1: OcrEngine interface + types (`src/features/ocr/engine/`)
  - AC: `OcrEngine` interface, `OcrResult`/`OcrResultItem`/`OcrOptions`/`OcrConfig`/`ImageSource` types. `ImageSource = { data: Uint8ClampedArray, width, height }` (KHÔNG ImageBitmap). `PaddleOcrEngine` skeleton (throw NOT_IMPLEMENTED).
  - Verify: `npm run typecheck` pass, unit test types compile
  - Files: `src/features/ocr/engine/ocrEngine.ts`, `types.ts`, `paddleOcrEngine.ts`, `paddleOcrEngine.test.ts`
  - Dependencies: None
  - Scope: S (3-4 files)

- [ ] T2: Script-run segmenter — upgrade detectLangCode (SSOT)
  - AC: `scriptRunSegmenter(text) → ScriptRun[] { text, script: 'zh'|'en'|'ja'|'ko'|'unknown' }`. State machine ~50-80 LOC, O(n) single pass. Handle mixed: "我喜欢 watching" → [{ text: "我喜欢", script: 'zh' }, { text: " watching", script: 'en' }]. Upgrade `detectLangCode` → delegate to `scriptRunSegmenter`, 4 call site vẫn hoạt động (subtitleTriggerController, webTriggerController x2, subtitleTokenWrap, resolveWordAtTip).
  - Verify: unit test với 15 cases từ `tests/data-test/ocr/fixtures/scriptRunCases.json` — "我喜欢" → zh, "Hello" → en, "日本語" → ja, "안녕" → ko, "123!" → unknown, "我喜欢 watching" → [zh, en], "日本語をstudy" → [ja, en], "用WiFi看4K电影" → [zh, en, zh, unknown, zh], "東京駅からTokyo Stationへ" → [ja, en, ja], empty → [], "2026年8月21日" → [unknown, zh, unknown, zh, unknown, zh], "你好👋World🌍" → [zh, unknown, en, unknown]. `npm run test:unit` pass (existing + new tests).
  - Test data: `tests/data-test/ocr/fixtures/scriptRunCases.json` (15 cases: zh/en/ja/ko/unknown, mixed intra-box, brands, romaji, numbers, emoji, empty, whitespace)
  - Files: `src/features/ocr/language/scriptRunSegmenter.ts`, `.test.ts`, `src/features/dictionaryPopup/trigger/subtitleTriggerController.ts` (upgrade detectLangCode)
  - Dependencies: None
  - Scope: M (3-4 files)

- [ ] T3: Per-origin OCR state — reuse tokenizeSettingsStore pattern
  - AC: `ocrPreference: Record<origin, OcrOriginState>` trong settings. `getOcrPreference(origin)`, `setOcrPreference(origin, state)`, `clearOcrPreference(origin)`. Reuse `extractOrigin()`. KHÔNG tạo key ad-hoc.
  - Verify: unit test with fake settings — set/get/clear, origin extraction, SSOT pattern
  - Files: `src/entities/settings/types.ts` (extend), `src/features/ocr/persistence/ocrStateStore.ts`, `.test.ts`
  - Dependencies: None
  - Scope: M (3 files)

## Checkpoint 1: Foundation
- [ ] `npm run typecheck` pass
- [ ] `npm run test:unit` pass (T1-T3 tests + existing tests)
- [ ] `npm run build` pass
- [ ] 4 existing call site của detectLangCode vẫn hoạt động

## Phase 2: PaddleOcrEngine + offscreen OCR

- [ ] T4: PaddleOcrEngine implementation
  - AC: `PaddleOcrEngine` implements `OcrEngine`. `initialize()` loads `@paddleocr/paddleocr-js` PP-OCRv5 mobile (WebGPU preferred, WASM fallback). Bundle `.wasm` files, set `env.wasm.wasmPaths` trỏ nội bộ. `recognize(image: ImageSource)` returns `OcrResult[]`. `dispose()` free ORT session + model + WebGPU device.
  - Verify: unit test with mock PaddleOCR — init/recognize/dispose called correctly, wasmPaths set. Integration test với `tests/data-test/ocr/frames/hardsub-zh-01.png` → mock recognize returns text "我喜欢北京".
  - Test data: `tests/data-test/ocr/frames/hardsub-zh-01.png` + `hardsub-mixed-3-lines-01.png` + `drm-black-frame.png`
  - Files: `src/features/ocr/engine/paddleOcrEngine.ts`, `.test.ts`
  - Dependencies: T1, T0b (spike results)
  - Scope: M (3-4 files)

- [ ] T5: Offscreen OCR Worker (extend ffmpeg.html)
  - AC: `ocr-worker.ts` imports PaddleOcrEngine, handles `OCR_INIT`/`OCR_RECOGNIZE`/`OCR_DISPOSE` messages. `OCR_DISPOSE` free session, KHÔNG gọi `closeOffscreenDocument()`. Worker chạy trong offscreen document (cùng ffmpeg.html).
  - Verify: manual — load extension, inspect offscreen document exists, worker loads
  - Files: `src/entrypoints/offscreen/ocr-worker.ts`, `src/entrypoints/offscreen/ffmpeg.html` (extend), `src/entrypoints/offscreen/index.ts` (extend)
  - Dependencies: T4
  - Scope: M (3 files)

- [ ] T6: Background OCR message handler (Port-based)
  - AC: Handle `OCR_INIT`/`OCR_RECOGNIZE`/`OCR_DISPOSE`/`OCR_GET_STATE`/`OCR_SET_STATE`. Route to offscreen via Port. Manage offscreen lifecycle (create if not exists, KHÔNG close). `OCR_RECOGNIZE` dùng Port (structured clone + transfer ImageData).
  - Verify: unit test message routing with mock offscreen + mock Port
  - Files: `src/entrypoints/background/handlers/ocr.ts`, `.test.ts`, `src/entrypoints/background/index.ts` (extend)
  - Dependencies: T5, T3
  - Scope: M (3 files)

- [ ] T7: Content-script OCR controller (Port client)
  - AC: `OcrController` class — `init()`, `recognize(imageData: ImageSource)`, `dispose()`, `getState()`, `setState()`. Dùng `chrome.runtime.connect` Port cho `recognize` (transfer ImageData). Thin client, no OCR logic.
  - Verify: unit test with mock Port — message format correct, ImageData transfer
  - Files: `src/entrypoints/content/ocrController.ts`, `.test.ts`
  - Dependencies: T6
  - Scope: S (2 files)

- [ ] T7b: Mock hard-sub video page (Tier 4 test data)
  - AC: Mock page `mock-hardsub-page` tại port 4325. Page có `<video>` (short MP4 hoặc canvas-animated) + canvas overlay burned-in subtitle (zh/en/ja/mixed). Extend `scripts/serve-mock-pages.mjs`.
  - Verify: `npm run mock` → navigate `http://127.0.0.1:4325/index.html` → video plays with visible hard-sub. Subtitle text changes every 3s (test dedup).
  - Test data: `tests/data-test/ocr/frames/*.png` (overlay trên video)
  - Files: `src/entrypoints/mock-hardsub-page/index.html`, `index.ts`, `scripts/serve-mock-pages.mjs` (extend)
  - Dependencies: None
  - Scope: M (3 files)

## Checkpoint 2: Engine works
- [ ] Load extension → OCR init → model load → recognize 1 ImageData → return text+bbox
- [ ] Browser test: stealth-chrome-devtools

## Phase 3: Video OCR pipeline

- [ ] T8: Subtitle region detector
  - AC: `cropSubtitleRegion(canvas, regionPct, position) → { data, width, height }`. Default bottom 15%, configurable. Support 'bottom'|'top'. Pure logic: `computeCropRect(videoWidth, videoHeight, regionPct, position)`.
  - Verify: unit test với 8 cases từ `tests/data-test/ocr/fixtures/cropRectCases.json` — 1920x1080@15%bottom={0,918,1920,162}, 1920x1080@15%top={0,0,1920,162}, 1920x1080@20%bottom={0,864,1920,216}, 1280x720@15%bottom={0,612,1280,108}, 640x360@10%bottom={0,324,640,36}, 3840x2160@15%bottom={0,1836,3840,324}, 100%bottom=full, 0%bottom=empty.
  - Test data: `tests/data-test/ocr/fixtures/cropRectCases.json` (8 crop rect cases: 1080p/720p/360p/4K, bottom/top, 0-100%)
  - Files: `src/features/ocr/video/subtitleRegionDetector.ts`, `.test.ts`
  - Dependencies: None
  - Scope: S (2 files)

- [ ] T9: DRM guard (black-frame detect)
  - AC: `isBlackFrame(imageData, threshold=5) → boolean`. Mean pixel < threshold → black frame. Pure logic: `computeMeanLuma(imageData) → number`.
  - Verify: unit test với 5 cases từ `tests/data-test/ocr/fixtures/imageDataMocks.json` — all-black → true (mean=0), all-white → false (mean=255), near-black-DRM → true (mean=2.4), subtitle-frame → false (mean=130), gradient → false (mean=96). Threshold tuning: threshold=5 → DRM detect, threshold=200 → false positive.
  - Test data: `tests/data-test/ocr/fixtures/imageDataMocks.json` (5 ImageData cases: black, white, DRM noise, subtitle, gradient)
  - Files: `src/features/ocr/video/drmGuard.ts`, `.test.ts`
  - Dependencies: None
  - Scope: S (2 files)

- [ ] T10: Frame sampler (rVFC + time gate + luma-diff + text dedup)
  - AC: `computeLumaDiff(curr: ImageData, prev: ImageData, w=32, h=8) → number` (downscale + mean-abs-diff). `framesDiffer(diff, threshold) → boolean`. `sampleFrame(video, rVFCCallback)` — uses `requestVideoFrameCallback` + time gate 3fps. `textDedup(currText, prevText) → boolean`.
  - Verify: unit test với lumaDiffCases từ `tests/data-test/ocr/fixtures/imageDataMocks.json` — identical frames → diff=0, subtitle-appeared → diff>100, subtitle-changed → 10<diff<100, background-motion → diff>5 (text-dedup fallback). Text dedup: same text → true, different text → false.
  - Test data: `tests/data-test/ocr/fixtures/imageDataMocks.json` (4 luma-diff cases + text dedup cases)
  - Files: `src/features/ocr/video/frameSampler.ts`, `.test.ts`
  - Dependencies: T8
  - Scope: M (2-3 files)

- [ ] T11: OCR cache (videoId, timestampBucket, LRU)
  - AC: `OcrCache` class — `get(videoId, timestampBucket)`, `set(videoId, timestampBucket, result)`, `clear(videoId)`. LRU eviction (max 100 entries). Pure logic: `buildCacheKey(videoId, timestampBucket)`, `bucketTimestamp(timeMs, bucketMs=1000)`, `computeVideoId(video) → string` (hash src+duration).
  - Verify: unit test với cacheKeyCases + videoIdCases từ `tests/data-test/ocr/fixtures/cropRectCases.json` — basic-bucket "abc123:5000", round-down 5999→5000, different-bucket-size 5500→4000, zero-time "abc123:0", different-video "xyz789:5000". videoId: YouTube extract "dQw4w9WgXcQ", blob-url hash 16 chars, direct-url hash 16 chars. LRU eviction: set 101 entries → oldest evicted.
  - Test data: `tests/data-test/ocr/fixtures/cropRectCases.json` (5 cacheKeyCases + 3 videoIdCases)
  - Files: `src/features/ocr/video/ocrCache.ts`, `.test.ts`
  - Dependencies: None
  - Scope: S (2 files)

- [ ] T12: Video OCR controller (wire sampler + guard + orchestrator + cache)
  - AC: `VideoOcrController` — `start(video)`, `stop()`. Wires frameSampler → drmGuard → luma-diff → ocrController.recognize → text-dedup → ocrCache → callback(onOcrResult). State machine: MONITORING → SUBTITLE_CHANGED → OCR_PROCESSING → CACHE_RESULT. DRM_ERROR → abort + user error.
  - Verify: unit test with mock video + mock ocrController — state transitions, cache hit/miss, DRM abort. Integration test với `tests/data-test/ocr/frames/hardsub-zh-01.png` → mock recognize returns ocrResultMocks zh-single-box.
  - Test data: `tests/data-test/ocr/fixtures/ocrResultMocks.json` + `tests/data-test/ocr/frames/drm-black-frame.png`
  - Files: `src/features/ocr/video/videoOcrController.ts`, `.test.ts`
  - Dependencies: T7, T8, T9, T10, T11
  - Scope: M (2-3 files)

## Checkpoint 3: Video OCR works
- [ ] Hard-sub video → OCR runs → dedup works → subtitle change detected
- [ ] DRM video → black frame detect → abort + user error
- [ ] Browser test: mock YouTube hard-sub

## Phase 4: Overlay + dictionary integration

- [ ] T13: OCR token wrap — bbox + script-run → hitbox spans
  - AC: `wrapOcrTokens(container, ocrItems, scriptRuns) → HTMLSpanElement[]` hitboxes. Each span: `data-cell-term`, `data-cell-start`, `data-cell-end`, position:absolute at bbox coords, transparent. Mirror `subtitleTokenWrap` pattern. Per-script-run hitbox (not per-box).
  - Verify: unit test với 8 cases từ `tests/data-test/ocr/fixtures/ocrResultMocks.json` — zh-single-box: bbox [[277,64]...] + "我喜欢北京" → span data-cell-term="我喜欢北京" at position. mixed-zh-en-intra-box: bbox + "我喜欢 watching movies" → 2 spans (zh "我喜欢" + en " watching movies"). mixed-3-boxes: 3 boxes → spans per script-run. empty-result: 0 spans. low-score: span with score 0.45.
  - Test data: `tests/data-test/ocr/fixtures/ocrResultMocks.json` (8 mock OcrResult[]: zh/en/ja single, mixed intra-box, 3-box mixed, low-score, empty, multi-box)
  - Files: `src/features/ocr/overlay/ocrTokenWrap.ts`, `.test.ts`
  - Dependencies: T2
  - Scope: M (2 files)

- [ ] T14: OCR overlay mount/unmount
  - AC: `mountOcrOverlay(container, ocrItems, scriptRuns) → { unmount() }`. Transparent overlay div, pointer-events:auto on hitboxes, pointer-events:none on container. Overlay sống ở frame chứa `<video>`.
  - Verify: unit test — mount creates overlay + hitboxes, unmount removes
  - Files: `src/features/ocr/overlay/ocrOverlay.ts`, `.test.ts`
  - Dependencies: T13
  - Scope: S (2 files)

- [ ] T15: Language router — script-run → language plugin
  - AC: `routeScriptRuns(scriptRuns) → items with langCode`. Route zh → chinesePlugin, en → englishPlugin, ja → fallbackPlugin (single-char), ko → fallbackPlugin, unknown → englishPlugin.
  - Verify: unit test với scriptRunCases từ `tests/data-test/ocr/fixtures/scriptRunCases.json` + ocrResultMocks — "我喜欢" → langCode='zh', "Hello" → 'en', "日本語" → 'ja' (fallback), "안녕" → 'ko' (fallback), "123!" → 'en' (unknown→en fallback). Mixed: "我喜欢 watching" → 2 items (zh + en).
  - Test data: `tests/data-test/ocr/fixtures/scriptRunCases.json` + `ocrResultMocks.json`
  - Files: `src/features/ocr/language/languageRouter.ts`, `.test.ts`
  - Dependencies: T2
  - Scope: S (2 files)

- [ ] T16: Wire OCR → subtitleTriggerController.attach() → dictionary
  - AC: OCR hitbox click → `subtitleTriggerController.attach(hitboxSpans, sentence, langCode)` handles → `lookupOrchestrator` → dictionary popup. Reuse existing trigger pipeline — hitbox spans same data attributes.
  - Verify: browser test trên mock hard-sub page (T7b) — click "北京" hitbox → Chinese dictionary popup, click "watching" hitbox → English dictionary (same box, different script-run). Test với `tests/data-test/ocr/frames/hardsub-mixed-zh-en-01.png`.
  - Test data: `tests/data-test/ocr/frames/hardsub-mixed-zh-en-01.png` + mock page `http://127.0.0.1:4325`
  - Files: `src/entrypoints/content/ocrController.ts` (extend), `src/features/dictionaryPopup/trigger/subtitleTriggerController.ts` (verify reuse)
  - Dependencies: T12, T14, T15, T7b
  - Scope: M (2-3 files)

## Checkpoint 4: Click → dictionary
- [ ] OCR hitbox click → dictionary popup → correct word
- [ ] Mixed: click "北京" → Chinese dict, click "watching" → English dict (same box)
- [ ] Browser test

## Phase 5: Manager Panel UI + persistence

- [ ] T17: OcrSettingsPanel component
  - AC: React component — toggle "Enable OCR video", status display (Ready/Initializing/Error/DRM), backend display, language mode radio (auto/zh/en/ja), subtitle region slider. Uses design system tokens.
  - Verify: component test — toggle click → onChange called, status renders
  - Files: `src/features/ocr/ui/OcrSettingsPanel.tsx`, `.module.css`, `.test.tsx`
  - Dependencies: T3
  - Scope: M (3 files)

- [ ] T18: Add OCR tab to SubtitleManagerPanel
  - AC: SubtitleManagerPanel has new "OCR" tab. Tab renders OcrSettingsPanel. Tab bar: [Tracks] [Appearance] [OCR].
  - Verify: component test — tab click → OcrSettingsPanel renders
  - Files: `src/features/subtitle/ui/SubtitleManagerPanel.tsx` (extend), `.test.tsx`
  - Dependencies: T17
  - Scope: S (2 files)

- [ ] T19: Wire toggle → settings → OCR init/dispose
  - AC: Toggle ON → `setOcrPreference(origin, {ocrEnabled:true})` + `ocrController.init()`. Toggle OFF → `clearOcrPreference(origin)` + `ocrController.dispose()`. Status updates during init.
  - Verify: browser test — toggle ON → OCR starts; OFF → stops + dispose
  - Files: `src/features/ocr/ui/OcrSettingsPanel.tsx` (extend), `src/entrypoints/content/ocrController.ts` (extend)
  - Dependencies: T7, T17, T18
  - Scope: M (2-3 files)

- [ ] T20: Per-origin persistence — reload/SPA-nav handling
  - AC: Content-script init → `getOcrPreference(origin)` → auto-start if enabled. SPA nav same-origin → keep; diff-origin → clear + read new. Reuse existing `yt-navigate-finish`/`popstate` hooks.
  - Verify: browser test — reload → OCR auto-starts; SPA nav same-origin → keep; diff-origin → clear
  - Files: `src/entrypoints/content/ocrController.ts` (extend), `src/features/subtitle/ui/contentScriptController.ts` (add OCR init hook)
  - Dependencies: T19
  - Scope: M (2-3 files)

## Checkpoint 5: Manager Panel works
- [ ] Toggle ON/OFF works, persistence across reload/SPA-nav
- [ ] Browser test

## Phase 6: Polish + verify

- [ ] T21: WebGPU shader JIT warmup (dummy frame during init)
  - AC: `PaddleOcrEngine.initialize()` runs dummy recognize() to trigger shader JIT before READY status. User doesn't see 5s stall.
  - Verify: browser test — init time < 6s (including warmup), first real OCR < 200ms
  - Files: `src/features/ocr/engine/paddleOcrEngine.ts` (extend)
  - Dependencies: T4
  - Scope: S (1 file)

- [ ] T22: Error handling — OCR_ERROR → RETRY/FALLBACK
  - AC: OCR fail → retry max 3 → fallback WASM if WebGPU fail → error status in Manager Panel.
  - Verify: unit test — mock OCR fail → retry count, fallback triggers
  - Files: `src/features/ocr/video/videoOcrController.ts` (extend), `src/features/ocr/engine/paddleOcrEngine.ts` (extend)
  - Dependencies: T12
  - Scope: S (2 files)

- [ ] T23: Dictionary probe cache (createDictionaryProbeAsync)
  - AC: Cache dictionary probe (Set) sau first load. Reuse across lookups. OCR tăng bậc số lookup → cache cần thiết.
  - Verify: unit test — first lookup loads, second lookup uses cache
  - Files: `src/features/dictionaryPopup/orchestrator/lookupOrchestrator.ts` (extend), `.test.ts`
  - Dependencies: None
  - Scope: S (2 files)

- [ ] T24: Update docs/2-architechture-system.md
  - AC: Add `src/features/ocr/` to tree + dependency map + function index. Per AGENTS.md update protocol.
  - Verify: `ls src/features/ocr/` matches docs
  - Files: `docs/2-architechture-system.md`
  - Dependencies: all
  - Scope: S (1 file)

- [ ] T25: Full browser test — hard-sub video + mixed-language + DRM
  - AC: All success criteria in spec met. Browser test with stealth-chrome-devtools on mock sites + real sites (themoviebox, kisskh). Test matrix: (1) mock hard-sub page zh → click → Chinese dict. (2) mock hard-sub page mixed zh+en → click both → correct dict. (3) mock hard-sub page ja → click → fallback dict. (4) mock DRM black frame → abort + user error. (5) themoviebox.xyz real hard-sub → OCR → click → dict. (6) Netflix DRM → black frame → abort. (7) per-origin persistence: reload → auto-start, SPA nav → keep/clear. (8) toggle ON/OFF → dispose + memory free.
  - Test data: `tests/data-test/ocr/frames/*.png` (Tier 2) + `tests/data-test/ocr/real-frames/*.png` (Tier 3) + mock page `http://127.0.0.1:4325` (Tier 4)
  - Verify: browser test pass — all 8 test matrix cases
  - Files: test report
  - Dependencies: all
  - Scope: M (test only)

## Checkpoint 6: Complete
- [ ] All success criteria in spec met
- [ ] `npm run build` + `typecheck` + `test:unit` pass
- [ ] Browser verify pass
- [ ] Ready for review
