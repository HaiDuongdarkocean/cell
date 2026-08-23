# Spec: Orca OCR Layer

> Status: **Revised after 3-layer adversarial review + spike T0b verified 5/5 PASS**
> Review log: `docs/specs/orca-ocr-review-final.md`.
> Spike report: 2026-08-21 — frame capture, WebGPU, ImageData Port, OCR POC all verified.
> One-pager: `docs/ideas/orca-ocr-layer.md` (refined idea + prototype benchmark).
> User journey flow v3: confirmed 2026-08-21.

## Objective

OCR layer cho Cell — biến text trong visual media (hard-sub video) thành interactive text có thể click → mở dictionary. User chủ động enable qua Manager Panel. Per-origin persistence. Mixed-language (CN+EN+JA) cốt lõi.

### User stories

1. **Hard-sub video, no native subtitle:** User xem phim Trung Quốc hard-sub → mở Manager Panel → tab OCR → toggle Enable → OCR chạy background → user click word trên visual subtitle → dictionary mở.
2. **Hard-sub video, native subtitle exists:** User xem phim có native subtitle nhưng muốn OCR hard-sub → toggle Enable OCR → native subtitle disable → OCR hard-sub → click word → dictionary.
3. **Per-origin persistence:** User enable OCR trên themoviebox.xyz → sang video khác cùng themoviebox.xyz → OCR auto-bật. Sang youtube.com → OCR disable. Về themoviebox.xyz → OCR bật lại.
4. **Mixed-language:** User xem phim Chinese hard-sub + English subtitle song hành → OCR detect cả 2 → click "北京" → Chinese dictionary, click "watching" → English dictionary. Mixed intra-box (CN+EN cùng dòng) → script-run segmenter tách per-token.
5. **DRM-protected video:** User xem phim Netflix/Disney+ (Widevine) → OCR detect black frame → báo "DRM-protected video, OCR không khả thi" → không waste model.

### Out of scope (future phase)

- Image OCR + context menu (mobile Chrome không support extension)
- Mobile (Chrome Android không support extension)
- Screenshot OCR
- Auto-disable native subtitle (risk break player site — user tự toggle)
- Japanese plugin (fallback single-char, phase 2 build proper JA plugin)

## Tech Stack

- **OCR engine**: `@paddleocr/paddleocr-js` v0.4.2 (Apache 2.0) — ONNX Runtime Web + OpenCV.js
- **Model**: PP-OCRv5 mobile (det 4.84MB + rec 16.7MB = 21.5MB) — 1 model cover CN+EN+JA
- **Backend**: WebGPU preferred (3.7-4.3x faster sau warmup), WASM fallback (no shader JIT)
- **WASM bundle**: ORT `.wasm` + OpenCV.js `.wasm` bundle trong extension (MV3 cấm remotely-hosted code). Set `env.wasm.wasmPaths` trỏ nội bộ.
- **Model weights**: `.onnx` files lazy-load từ CDN first run → IndexedDB cache (data, không phải code).
- **Runtime**: Worker trong offscreen document (OCR không block main thread)
- **Frame sampling**: `requestVideoFrameCallback` + time gate 3fps + luma-diff 32x8 + text-level dedup
- **Frame transport**: ImageData via `chrome.runtime.connect` Port (structured clone + transfer)
- **Persistence**: `ocrPreference: Record<origin, OcrOriginState>` trong settings (reuse `tokenizeSettingsStore` pattern + `extractOrigin()`)
- **Existing reuse**: `subtitleTriggerController.attach()`, `lookupOrchestrator`, `cardCreator`, `webTextDictionaryController`

### Prototype benchmark (2026-08-21, real measured)

| Metric | WASM | WebGPU |
|---|---|---|
| Cold start (download 21.5MB + init) | 3493ms | 951ms (cached) / 11147ms (full download) |
| Warm inference (1 region) | avg 263ms | avg 71ms |
| Warm inference (3 regions mixed) | avg 583ms | avg 134ms / 5457ms (first run with JIT) |
| First-run shader JIT | — | 5152ms (hide bằng dummy warmup) |
| Heap | 139-148MB | 84-105MB |
| Mixed CN+EN+JA accuracy | score 0.93-1.00 | score 0.93-1.00 |

### Spike T0b verified (2026-08-21, subagent browser test)

| Check | Result | Evidence |
|---|---|---|
| Frame capture mock (StreamFlix) | PASS | 1280x720, mean luma 33.3, no SecurityError |
| Frame capture real site (themoviebox.xyz) | PASS | 960x540, mean luma 116.9, no DRM black frame |
| WebGPU in extension context | PASS | navigator.gpu exists, POC confirmed WebGPU backend |
| ImageData transfer via structured clone | PASS | sendMessage with ImageData succeeded (Port equivalent) |
| OCR POC mixed CN+EN+JA | PASS | 3 regions, scores 0.995/1.000/0.935 |

**Key finding**: themoviebox.xyz is NOT DRM-protected — frame capture works fine. DRM black-frame guard is for Netflix/Disney+ only.

## Commands

```bash
npm run dev              # Vite dev (extension)
npm run build            # Production build (extension)
npm run typecheck        # tsc --noEmit
npm run test:unit        # Jest unit tests
npm run test:fast        # Jest fast tests
npx vite build --mode development  # Dev build + auto-seed
```

POC standalone (gitignored, không ship):
```bash
cd prototype/orca-ocr-poc && npx vite --port 4323
```

## Project Structure

```
src/features/ocr/                    # NEW — OCR feature domain
├── engine/                          # OcrEngine abstraction + implementations
│   ├── ocrEngine.ts                 # interface OcrEngine
│   ├── paddleOcrEngine.ts           # PaddleOcrEngine (primary)
│   ├── paddleOcrEngine.test.ts
│   └── types.ts                     # OcrResult, OcrResultItem, OcrOptions, ImageSource
├── orchestrator/                    # OCR lifecycle management
│   ├── ocrOrchestrator.ts           # init/dispose, model loading, backend select
│   ├── ocrOrchestrator.test.ts
│   └── ocrState.ts                  # state machine (IDLE→INITIALIZING→READY→MONITORING)
├── video/                           # Video OCR pipeline
│   ├── frameSampler.ts              # rVFC + time gate 3fps + luma-diff 32x8 + text dedup
│   ├── frameSampler.test.ts
│   ├── subtitleRegionDetector.ts    # bottom 15% default, configurable
│   ├── subtitleRegionDetector.test.ts
│   ├── drmGuard.ts                  # black-frame detect → abort + user error
│   ├── drmGuard.test.ts
│   ├── ocrCache.ts                  # (videoId, timestampBucket) → OCR result
│   ├── ocrCache.test.ts
│   └── videoOcrController.ts        # wires sampler + orchestrator + cache
├── overlay/                         # Invisible hitbox overlay
│   ├── ocrTokenWrap.ts              # bbox → hitbox spans (mirror subtitleTokenWrap)
│   ├── ocrTokenWrap.test.ts
│   ├── ocrOverlay.ts                # mount/unmount transparent overlay
│   └── ocrOverlay.test.ts
├── language/                        # Script-run segmentation + routing
│   ├── scriptRunSegmenter.ts        # state machine: tách text thành script-runs (zh/en/ja/ko)
│   ├── scriptRunSegmenter.test.ts
│   └── languageRouter.ts            # route script-run → language plugin
└── ui/                              # Manager Panel OCR tab
    ├── OcrSettingsPanel.tsx         # toggle + status + language mode + region
    ├── OcrSettingsPanel.test.tsx
    └── OcrSettingsPanel.module.css

src/features/dictionaryPopup/trigger/
└── subtitleTriggerController.ts     # UPGRADE detectLangCode → script-run segmenter (SSOT)

src/features/tokenize/services/
└── tokenizeSettingsStore.ts         # EXTEND — thêm ocrPreference pattern (or reuse settings)

src/entrypoints/background/handlers/ocr.ts   # NEW — OCR message handler
src/entrypoints/content/ocrController.ts     # NEW — content-script OCR wiring
src/entrypoints/offscreen/ocr-worker.ts     # NEW — OCR Worker trong offscreen
```

## Code Style

Theo AGENTS.md + existing Cell conventions:
- Function component + hooks, named export (no default export)
- No `any` (ESLint `no-explicit-any`)
- Pure functions tách logic → dễ test
- Algorithm O(1) → O(log n) lý tưởng, O(n) nếu không còn cách khác
- Ponytail: shortest working diff, reuse existing helpers
- Icon: read `ICON_CATALOG` (`src/shared/icons/index.ts`) trước
- CSS: token từ `tokens.css` + component pattern từ `src/shared/ui/`

```typescript
// OcrEngine interface
export interface OcrEngine {
  initialize(config: OcrConfig): Promise<void>;
  recognize(image: ImageSource, options?: OcrOptions): Promise<OcrResult[]>;
  dispose(): Promise<void>;
}

// ImageSource = ImageData (transferable via Port), KHÔNG phải ImageBitmap
export interface ImageSource {
  readonly data: Uint8ClampedArray;  // RGBA pixels
  readonly width: number;
  readonly height: number;
}

export interface OcrResultItem {
  readonly poly: readonly [number, number][];  // 4-point quadrilateral
  readonly text: string;
  readonly score: number;  // 0-1 confidence
}

export interface OcrResult {
  readonly image: { readonly width: number; readonly height: number };
  readonly items: readonly OcrResultItem[];
  readonly metrics: { readonly detMs: number; readonly recMs: number; readonly totalMs: number };
}
```

## Testing Strategy

- **Unit tests** (Jest): pure logic — `scriptRunSegmenter`, `ocrCache`, `subtitleRegionDetector`, `drmGuard`, `frameSampler` (luma-diff + text dedup), `languageRouter`
- **Integration tests** (Jest): `paddleOcrEngine` với mock ONNX Runtime, `videoOcrController` với mock rVFC
- **Browser tests** (stealth-chrome-devtools MCP): load extension thật, test OCR trên mock video, verify hitboxes + click → dictionary
- **Spike test** (M0): WebGPU + WASM multithread trong offscreen document, frame capture trên 3 site thật (DRM + tainted canvas)
- Coverage: pure logic 100%, UI component smoke test, engine integration test với mock

## Boundaries

- **Always**: reuse existing `subtitleTriggerController.attach()`/`lookupOrchestrator`/`cardCreator` — không rewrite. Run `npm run build` sau mỗi thay đổi `src/`. Update `docs/2-architechture-system.md` khi thêm/sửa file `src/`. Bundle `.wasm` files trong extension (MV3 cấm remotely-hosted code). `OCR_DISPOSE` phải free ORT session + model + WebGPU device — KHÔNG gọi `closeOffscreenDocument()`.
- **Ask first**: thêm dependency, sửa `manifest.json` (`cross_origin_embedder_policy`/`cross_origin_opener_policy` cho WASM multithread), thay đổi `cuesStore` schema
- **Never**: OCR tự-trigger khi native subtitle tồn tại (user phải toggle), block main thread (OCR trong Worker), bundle model weights trong .crx (lazy-load + IndexedDB), fetch `.wasm` từ CDN (remotely-hosted code — CWS reject)

## Success Criteria

### Video OCR
- [ ] User toggle "Enable OCR video" trong Manager Panel → OCR init → status "Ready"
- [ ] OCR chạy background trên hard-sub video → invisible hitboxes render
- [ ] User click word trên visual subtitle → dictionary popup mở (reuse existing)
- [ ] Per-origin persistence: reload page → OCR auto-bật; sang origin khác → disable; về lại → bật
- [ ] WebGPU backend preferred, WASM fallback nếu WebGPU unavailable
- [ ] Model load < 10s background (không block UI), user-perceived click→dict < 200ms (OCR đã chạy ahead)
- [ ] Mixed CN+EN+JA: 1 model handle tất cả, script-run segmenter tách per-token, click CN word → Chinese dict, click EN word → English dict
- [ ] DRM-protected video: detect black frame → abort OCR → báo user "DRM-protected, OCR không khả thi"

### Non-functional
- [ ] OCR không block UI (Worker, < 16ms main thread per frame)
- [ ] Memory < 150MB heap (WebGPU), dispose khi OCR disable
- [ ] `.wasm` bundled trong extension, `wasmPaths` set trỏ nội bộ
- [ ] Model weights lazy-load + IndexedDB cache
- [ ] `npm run build` pass
- [ ] `npm run typecheck` pass
- [ ] `npm run test:unit` pass

## Architecture

### OcrEngine abstraction

```typescript
interface OcrEngine {
  initialize(config: OcrConfig): Promise<void>;
  recognize(image: ImageSource, options?: OcrOptions): Promise<OcrResult[]>;
  dispose(): Promise<void>;
}

// PaddleOcrEngine — primary (PP-OCRv5 mobile, WebGPU/WASM)
// TesseractEngine — future fallback (rare langs, lazy-load)
// ChromeLensEngine — stub NOT_IMPLEMENTED (no stable API)
```

### Video OCR pipeline

```
Manager Panel toggle ON
  → settings.ocrPreference[origin] = { ocrEnabled: true, ... }
  → ocrOrchestrator.init() (lazy: load engine + model + warmup)
  → videoOcrController.start(video)
      → frameSampler: rVFC → time gate 3fps → crop subtitle region
          → drmGuard: black-frame detect → abort + user error
          → luma-diff 32x8 on crop → compare with previous
              → luma-diff unchanged → skip (dedup)
              → luma-diff changed → ocrOrchestrator.recognize(crop)
                  → text-level dedup: OCR text == previous text → skip
                  → ocrCache.set(videoId, timestampBucket, result)
                  → scriptRunSegmenter: tách text thành script-runs (zh/en/ja)
                  → languageRouter: route script-run → language plugin
                  → ocrTokenWrap: bbox + script-run → hitbox spans
                  → ocrOverlay: mount transparent hitboxes
  → User click hitbox → subtitleTriggerController.attach() (reuse) → dictionary
```

### Frame capture + transport

```
Content script (frame chứa <video>):
  → requestVideoFrameCallback(video) → video frame
  → canvas.drawImage(video) → canvas
  → canvas.getImageData() → ImageData { data: Uint8ClampedArray, width, height }
  → drmGuard: mean pixel < 5 → black frame → abort
  → chrome.runtime.connect Port → port.postMessage(imageData, [imageData.data.buffer])
    (Port hỗ trợ structured clone + transfer, sendMessage KHÔNG hỗ trợ)

Background SW:
  → route to offscreen document

Offscreen Worker:
  → receive ImageData → PaddleOcrEngine.recognize(imageData) → OcrResult[]
  → port.postMessage(results) → content script
```

### Per-origin persistence (SSOT — reuse existing pattern)

```
// Reuse tokenizeSettingsStore pattern + extractOrigin()
settings.ocrPreference: Record<origin, {
  ocrEnabled: boolean;
  languageMode: 'auto' | 'zh' | 'en' | 'ja';
  subtitleRegionPct: number;  // default 15
}>

On content-script init (frame chứa <video>):
  → extractOrigin(window.location.href) → origin
  → read settings.ocrPreference[origin]
  → if ocrEnabled → start OCR (skip Manager Panel toggle)
  → if !ocrEnabled → IDLE

On SPA nav (yt-navigate-finish):
  → if origin changed → clear OCR state → read new origin
  → if origin same → keep OCR state
```

### Message protocol (content → background → offscreen)

| Type | Direction | Payload | Response |
|---|---|---|---|
| `OCR_INIT` | content → bg | `{ origin, languageMode }` | `{ status: 'ready'\|'error', backend }` |
| `OCR_RECOGNIZE` | content → bg (Port) | `{ imageData: ImageSource, frameId? }` | `{ results: OcrResult[] }` |
| `OCR_DISPOSE` | content → bg | `{}` | `{ ok: true }` (free ORT session + model, KHÔNG close offscreen) |
| `OCR_GET_STATE` | content → bg | `{ origin }` | `{ ocrEnabled, languageMode, ... }` |
| `OCR_SET_STATE` | content → bg | `{ origin, state }` | `{ ok: true }` |

**Note**: OCR engine lives trong Worker trong offscreen document (cùng ffmpeg.html). `OCR_DISPOSE` free ORT session + model + WebGPU device, KHÔNG gọi `closeOffscreenDocument()` (sẽ giết ffmpeg đang chạy).

### Script-run segmentation (SSOT — upgrade detectLangCode)

```
// Upgrade detectLangCode → scriptRunSegmenter (SSOT)
// Hiện: detectLangCode(text) → 'zh'|'en' (binary, 4 call site)
// Mới: scriptRunSegmenter(text) → ScriptRun[] { text, script: 'zh'|'en'|'ja'|'ko'|'unknown' }

// State machine ~50-80 LOC:
// - Scan chars, classify by Unicode block (O(1) per char)
// - Group consecutive same-script chars into runs
// - Handle mixed: "我喜欢 watching" → [{ text: "我喜欢", script: 'zh' }, { text: " watching", script: 'en' }]

// 4 existing call site cùng hưởng upgrade:
// - subtitleTriggerController.ts:48
// - webTriggerController.ts:118,135
// - subtitleTokenWrap.ts:74
// - resolveWordAtTip.ts:34
```

### State machine

```
IDLE → OCR_TOGGLING_ON → OCR_INITIALIZING → READY → MONITORING
  ↔ (luma-diff changed) ↔ SUBTITLE_CHANGED → OCR_PROCESSING
       ├─ (text dedup: same text) → MONITORING (skip)
       ├─ (success) → CACHE_RESULT → MONITORING
       └─ (DRM black frame) → DRM_ERROR → abort + user error
  → OCR_TOGGLING_OFF → OCR_DISPOSING (free session) → IDLE
  → OCR_ERROR → RETRY (max 3) / FALLBACK (WASM)
  → PAGE_RELOAD → check storage → OCR_INITIALIZING (if enabled)
  → SPA_NAV_SAME_ORIGIN → keep state
  → SPA_NAV_DIFF_ORIGIN → clear → check new origin
```

## Open Questions

1. ~~WebGPU + WASM multithread trong offscreen~~ — **RESOLVED T0b**: WebGPU works in extension context. WASM multithread (SharedArrayBuffer/COOP/COEP) chưa test nhưng WASM single-thread đã đủ (3493ms cold, 263ms warm).
2. **Japanese plugin**: Cell có `chinesePlugin` + `englishPlugin` nhưng chưa có `japanesePlugin`. OCR JA text → fallback single-char (phase 1), build `japanesePlugin` (FMM với JA dict) phase 2.
3. ~~Model weights hosting~~ — **RESOLVED T0b**: Lazy-load từ CDN works (11147ms full download). IndexedDB cache cho subsequent runs (951ms cached).
4. **Subtitle region dynamic**: bottom 15% default, nhưng top subtitles / two-line / unusual positions? Phase 1 = bottom % configurable, phase 2 = dynamic detection.
5. **luma-diff threshold**: nền video chuyển động sau chữ làm nhiễu pixel-diff → false positive. Text-level dedup là fallback. **Test**: 100 frame sample, tune threshold.
6. **videoId cho non-YouTube**: YouTube có videoId trong URL, site khác cần hash(src + duration). **Define**: `videoId = hash(video.src + video.duration)`.
7. **DRM scope**: themoviebox.xyz/kisskh.co NOT DRM-protected (frame capture works). DRM guard chỉ cần cho Netflix/Disney+/HBO Max. Phase 1 = detect + abort, không cần test trên real DRM site (Netflix requires login + subscription).
