# Orca — OCR Layer cho Cell (hard-sub video + image + screenshot)

> Codename "Orca" = hướng nghiên cứu OCR layer cho Cell.
> Output của idea-refine Phase 3. Concept sharp, evidence-grounded.
> Ngày: 2026-08-21.

## Problem Statement

**How might we make text inside visual media (hard-sub video, image, screenshot, webpage) feel like native selectable text for Cell's language-learning users — with mixed-language (Chinese+English+Japanese+...) as a core requirement, not a phase-2 afterthought — running offline inside a Chrome/Edge MV3 extension on machines with ≥1GB available RAM?**

Workflow hiện tại (không OCR): pause → đọc → type → dictionary → resume.
Workflow mục tiêu: click word trên visual text → dictionary mở ngay (OCR đã chạy ahead, cache sẵn).

## Recommended Direction

**V7 Combination**: Simplification (V2) cho video pipeline + Hybrid engine (V3) cho rare langs + OcrEngine abstraction (V6) cho future-proof.

### Engine: PaddleOCR.js (PP-OCRv5 mobile) primary

- `@paddleocr/paddleocr-js` v0.4.2 — official browser SDK, Apache 2.0.
- ONNX Runtime Web + OpenCV.js, WASM backend (WebGPU auto-fallback).
- Worker mode (`worker: true`) — OCR off main thread.
- **PP-OCRv5 mobile rec = 1 model cover CN (simp+trad) + EN + JA** (16MB). Đúng Tier 1 cốt lõi, 0 model-switching.
- PP-OCRv5 mobile det = 4.7MB. Tổng ~21MB models.
- Result schema: `items[]` với `poly` + `text` + `score` + metrics (`detMs`/`recMs`/`totalMs`). Đủ geometry cho overlay hitboxes.
- Models download `.tar` (inference.onnx + .yml), KHÔNG bundled trong npm. Bundle trong extension `public/models/` hoặc lazy-load IndexedDB.

### Video pipeline: subtitle crop + pHash skip + cache

- KHÔNG OCR mỗi frame. `requestVideoFrameCallback` sample frame → crop subtitle region (bottom 15%) → perceptual hash → OCR chỉ khi hash đổi → cache theo `(videoId, timestampBucket)`.
- Ponytail ceiling: pHash false-negative (subtitle đổi nhẹ, hash giống) → miss subtitle. Upgrade: hash trên subtitle crop thay vì full frame.

### Language modes

| Mode | Behavior | Model |
|---|---|---|
| **Auto-detect** (default) | Script-detect per box (Unicode block regex, O(1)) → 1 unified pass nếu model cover hết (v6 future), hoặc route box → model (v5 multi-model) | PP-OCRv5 rec (CN+EN+JA) + lazy korean/latin nếu user enable |
| **Single-language** | User chọn 1 lang → load chỉ model đó | 1 model, tiết kiệm memory, faster cold-start |

### OcrEngine abstraction (spec §24)

```ts
interface OcrEngine {
  initialize(config): Promise<void>;
  recognize(image: ImageSource, options?: OcrOptions): Promise<OcrResult>;
  dispose(): Promise<void>;
}
```

- `PaddleOcrEngine` — primary.
- `TesseractEngine` — fallback rare langs (Cyrillic/Arabic/Thai/Hindi) khi user enable, lazy-load traineddata.
- `ChromeLensEngine` — stub `NOT_IMPLEMENTED`. Chrome KHÔNG có stable public extension OCR API (TextDetector behind flag, Lens = UI feature, Screen AI = internal). Adapter cho future nếu Chrome expose API.

### Integration vào existing Cell

OCR layer feed text + bbox + script vào existing pipeline:
- `chinesePlugin` (FMM segmentation + pinyin) — đã có, OCR text → segment → dictionary.
- `englishPlugin` / `fallbackPlugin` — đã có.
- `lookupOrchestrator` — đã có.
- `sentenceModule.resolveWordAtPoint` — đã có, map click → word.
- `cardCreator` (Anki) — đã có.
- `subtitleDiscovery` (HTML/network subtitle) — **KHÔNG OCR khi native subtitle tồn tại**. OCR = fallback cho visual text only.

### PP-OCRv5 vs PP-OCRv6

| | v5 | v6 |
|---|---|---|
| Langs/model | 4-5 (CN+EN+JA) | 50 (CJK + 46 Latin) |
| Maturity | Stable, 3+ MV3 extensions đã bundle | Mới release (v3.7.0), chưa vetted |
| Browser SDK | `@paddleocr/paddleocr-js` v0.4.2 support | UNVERIFIED |
| Risk | Thấp | Mới release — tránh theo AGENTS.md supply-chain rule |

**Decision**: Bắt đầu PP-OCRv5. Upgrade v6 sau khi (a) benchmark thật, (b) verify SDK support, (c) release ≥7 ngày + third-party evidence.

## Key Assumptions to Validate

- [x] **PP-OCRv5 mobile rec đủ accuracy cho hard-sub subtitle** (high-contrast, short, stable font) — ✅ score 0.93-1.00 trên synthetic subtitle text (xem Prototype Benchmark). Cần verify real video frame.
- [x] **WebGPU trong extension worker faster WASM đủ justify complexity** — ✅ 3.7-4.3x faster sau warmup (134ms vs 583ms). First run 5s shader JIT — hide bằng dummy warmup.
- [ ] **pHash trên subtitle crop detect subtitle change, false-negative < 5%**. Test: 100 frame sample, hash vs OCR-text-diff.
- [ ] **~35MB model bundle không kill install rate**. Mitigate: lazy-load IndexedDB sau install, không bundle .crx.
- [x] **`@paddleocr/paddleocr-js` v0.4.2 chạy trong Cell Vite + MV3 build** — ✅ POC validated (cần `optimizeDeps.include: ['@techstark/opencv-js']`).
- [x] **MV3 CSP `script-src 'self' 'wasm-unsafe-eval'` đủ cho ORT WASM** — ✅ Cell manifest.json đã có (cho sql.js). Không cần sửa.

## MVP Scope (product thực, không MVP — nhưng phase 1 focus)

**Phase 1 (prototype phiên này)**:
- Install `@paddleocr/paddleocr-js`, load PP-OCRv5 mobile det+rec.
- Test image CN/EN/JA → return text + bbox + confidence.
- Benchmark cold-start / warm inference / memory trên máy thật.
- Verify MV3 CSP build.

**Phase 2 (sau prototype pass)**:
- Video frame sampler (rVFC + subtitle crop + pHash skip).
- OCR cache `(videoId, timestampBucket)`.
- Invisible overlay hitboxes → click → existing dictionary.
- Auto-detect vs single-language mode UX.

**Phase 3**:
- Image/screenshot OCR (cùng `recognize(image)` pipeline).
- TesseractEngine fallback rare langs.
- PP-OCRv6 upgrade (khi vetted).
- Anki/audio/translate integration qua existing cardCreator.

## Not Doing (and Why)

- **V4 replace visual text với selectable HTML** — visual fidelity phải 100%, font matching khó, anti-aliasing khác, jarring trên stylized fonts. Overlay hitboxes an toàn hơn.
- **V5 native companion app (WinRT/Vision OCR via native messaging)** — vi phạm extension-only spirit, yêu cầu cài native app, phức tạp maintain cross-platform. Có thể phase 4 cho power users, không core.
- **Chrome Lens / TextDetector / Screen AI làm primary engine** — KHÔNG có stable public extension-accessible OCR API. TextDetector behind flag (spec marked unstable), Lens = UI feature, Screen AI = internal Mojo. Chỉ là `ChromeLensEngine` stub.
- **RapidOCR làm primary** — không có official browser build (Python only). Dùng `@paddleocr/paddleocr-js` official thay.
- **OCR webpage text khi native selection tồn tại** — native text faster/accurate/cheaper/structured. OCR = fallback cho visual text only.
- **Tier 3 langs (AR/HI/TH) ở phase 1** — defer đến v6 vetted hoặc user request. Tier 1 (CN+EN+JA) + Tier 2 (Latin) đủ launch.
- **OCR mỗi video frame** — 30 FPS ≠ 30 OCR/s. Subtitle crop + pHash skip + cache.

## Open Questions

- `@paddleocr/paddleocr-js` v0.4.2 có support PP-OCRv6 không? (verify source sau)
- PP-OCRv6 mobile rec model size cụ thể? (chưa official công bố)
- WebGPU có hoạt động trong extension offscreen/worker context? (benchmark)
- ORT WASM threaded cần COOP/COEP headers — extension pages không set headers → có bị giới hạn single-thread? (test)
- OpenCV.js (~8MB) có cần thiết không, hay PaddleOCR.js core chỉ dùng cho preprocessing có thể skip? (check source)
- poly format chính xác trong JS SDK? — ✅ VALIDATED: `[[x1,y1],...]` 4-point (xem Prototype Benchmark)

## Prototype Benchmark Results (2026-08-21, real measured)

POC: `prototype/orca-ocr-poc/` (standalone Vite, gitignored). Run via `npx vite --port 4323`.

### Environment
- Machine: Windows 10 (MINGW64_NT-10.0-26200), Chrome 151 (stealth MCP)
- Model: PP-OCRv5 mobile (det 4.84MB + rec 16.7MB = 21.5MB total)
- Backends: WASM (SIMD, single-thread, no COOP/COEP) vs WebGPU
- Models hosted: `paddle-model-ecology.bj.bcebos.com` (China CDN, ~8.4 MB/s from VN)

### Cold start (PaddleOCR.create + model download + init)

| Backend | Time | Note |
|---|---|---|
| WASM | 3493 ms | First run, models downloaded (21.5MB) |
| WebGPU | 951 ms | Second run, models HTTP-cached. Real cold = ~951ms init + ~2542ms download |

### Warm inference (10 runs after 1 warmup)

| Image | Regions | Backend | avg | p50 | min | max | Heap |
|---|---|---|---|---|---|---|---|
| Chinese 我喜欢北京 | 1 | WASM | 263ms | 283ms | 174ms | 408ms | 139MB |
| Chinese 我喜欢北京 | 1 | WebGPU | 71ms | 67ms | 61ms | 113ms | 96.5MB |
| Mixed CN+EN+JA (3 lines) | 3 | WASM | 583ms | 565ms | 490ms | 701ms | 148MB |
| Mixed CN+EN+JA (3 lines) | 3 | WebGPU | 134ms | 136ms | 121ms | 146ms | 105MB |

### WebGPU first-run penalty (shader compilation)

| Run | Time | detMs | recMs |
|---|---|---|---|
| First (cold shader JIT) | 5152ms | 3607ms | 1542ms |
| After warmup (avg) | 134ms | — | — |

**WebGPU pays ~5s shader compilation on first inference, then 3.7-4.3x faster than WASM.**

### Accuracy (synthetic high-contrast subtitle-style images)

| Input | Output | Score | Correct? |
|---|---|---|---|
| 我喜欢北京 | 我喜欢北京 | 1.000 | ✅ perfect |
| 我喜欢 watching movies | 我喜欢 watching movies | 0.995 | ✅ CN+EN mixed in 1 line |
| 日本語も勉強しています | 日本語も勉強しています | 1.000 | ✅ Japanese perfect |
| Hello 世界 | Hello 世界 | 0.935 | ✅ EN+CN mixed |

**Mixed-language VALIDATED: 1 PP-OCRv5 model handles CN+EN+JA simultaneously in same frame.**

### Result schema confirmed

```ts
OcrResultItem = { poly: [number, number][], text: string, score: number }
// poly = [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] — 4-point quadrilateral
OcrResult = { image: {width,height}, items: OcrResultItem[], metrics: {detMs,recMs,totalMs,detectedBoxes,recognizedCount}, runtime: {requestedBackend,detProvider,recProvider,webgpuAvailable} }
```

### Key findings

1. **PP-OCRv5 1 model handles CN+EN+JA mixed in same frame** — VALIDATED, no model switching for Tier 1.
2. **WebGPU 3.7-4.3x faster than WASM after warmup** (134ms vs 583ms for 3 regions), but 5s shader compilation on first run.
3. **WebGPU more consistent + lower memory** (105MB vs 148MB, variance 121-146ms vs 490-701ms).
4. **WASM better for cold start** (no shader JIT), WebGPU better for continuous/semi-continuous OCR.
5. **Recommended**: WebGPU backend + dummy-frame warmup during init to hide 5s shader JIT. Fallback WASM if WebGPU unavailable.
6. **Poly format confirmed**: `[[x1,y1],...]` 4-point — đủ cho overlay hitboxes.
7. **Vite + opencv-js**: cần `optimizeDeps.include: ['@techstark/opencv-js']` (UMD/CJS, phải pre-bundle cho default export).

### Assumptions validated/debunked

- [x] **PP-OCRv5 mobile rec đủ accuracy** — ✅ score 0.93-1.00 trên synthetic subtitle text.
- [x] **WebGPU faster WASM** — ✅ nhưng chỉ sau warmup. First run 5s shader JIT.
- [x] **`@paddleocr/paddleocr-js` chạy trong Vite** — ✅ với opencv-js pre-bundle fix.
- [x] **poly format** — ✅ `[[x1,y1]...]` 4-point.
- [ ] **pHash subtitle change detection** — chưa test (phase 2).
- [x] **MV3 CSP wasm-unsafe-eval** — ✅ Cell manifest.json dòng 103 đã có `script-src 'self' 'wasm-unsafe-eval'` (cho sql.js). PaddleOCR.js cần đúng directive này — KHÔNG cần sửa manifest.
- [ ] **Real subtitle frame accuracy** — synthetic text chỉ, cần test real video frame (phase 2).

## Evidence Sources

- `@paddleocr/paddleocr-js` v0.4.2: https://www.npmjs.com/package/@paddleocr/paddleocr-js
- PP-OCRv5 1 model CN+EN+JA: https://paddlepaddle.github.io/PaddleX/latest/en/module_usage/tutorials/ocr_modules/text_recognition.html
- PP-OCRv5 multi-language models: https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html
- Browser SDK docs (WASM/WebGPU/Worker): https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html
- Result schema: https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/README.md
- MV3 third-party evidence: https://github.com/minhkhoango/local-lens, https://github.com/Fanfulla/OCR-buddy
- Chrome OCR API verdict: https://developer.chrome.com/docs/capabilities/shape-detection, https://wicg.github.io/shape-detection-api/text
- Tesseract.js v7: https://github.com/naptha/tesseract.js
- RapidOCR Python-only: https://github.com/RapidAI/RapidOCR
- License Apache 2.0: https://github.com/PaddlePaddle/PaddleOCR/blob/HEAD/LICENSE
