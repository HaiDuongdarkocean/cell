# Implementation Plan: Orca OCR Layer

> Spec: `docs/specs/orca-ocr-layer.md` (revised after 3-layer adversarial review)
> Review: `docs/specs/orca-ocr-review-final.md`
> Prototype benchmark: validated 2026-08-21 (WebGPU warm 134ms, mixed CN+EN+JA score 0.93-1.00)

## Overview

OCR layer cho Cell — biến text trong hard-sub video thành interactive text. User toggle trong Manager Panel. Per-origin persistence. PaddleOCR.js PP-OCRv5 mobile (1 model CN+EN+JA, 21.5MB). Reuse existing `subtitleTriggerController.attach()`/`lookupOrchestrator`/`cardCreator`.

## Architecture Decisions

### AD1 — OcrEngine abstraction

```typescript
interface OcrEngine {
  initialize(config: OcrConfig): Promise<void>;
  recognize(image: ImageSource, options?: OcrOptions): Promise<OcrResult[]>;
  dispose(): Promise<void>;
}
```

`PaddleOcrEngine` primary. `TesseractEngine`/`ChromeLensEngine` = future stubs.

### AD2 — OCR trong offscreen document + Worker (extend ffmpeg.html)

Offscreen document đã có (ffmpeg.html + transmuxWorker). Thêm `ocr-worker.ts` vào cùng html. `offscreenManager.ts` đã cover `reasons.WORKERS + reasons.BLOBS`. `OCR_DISPOSE` free ORT session + model, KHÔNG gọi `closeOffscreenDocument()`.

### AD3 — WebGPU preferred, WASM fallback, dummy warmup

WebGPU 3.7-4.3x faster sau warmup nhưng 5s shader JIT first run. Strategy: init → dummy-frame warmup (hide JIT) → READY. Fallback WASM nếu WebGPU unavailable. **Spike test**: WebGPU + WASM multithread trong offscreen (cần COOP/COEP cho SharedArrayBuffer).

### AD4 — Per-origin persistence (SSOT — reuse existing pattern)

`ocrPreference: Record<origin, OcrOriginState>` trong settings. Reuse `extractOrigin()` + `tokenizeSettingsStore` pattern. KHÔNG tạo key ad-hoc `ocrState:<origin>`.

### AD5 — Frame transport: ImageData via Port (KHÔNG ImageBitmap)

`chrome.runtime.sendMessage` dùng JSON serialization → ImageBitmap/ArrayBuffer thành `{}`. Dùng `chrome.runtime.connect` Port → `port.postMessage(imageData, [imageData.data.buffer])` (structured clone + transfer).

### AD6 — Script-run segmentation (SSOT — upgrade detectLangCode)

`detectLangCode` hiện chỉ zh/en, 4 call site. Upgrade thành `scriptRunSegmenter` (state machine ~50-80 LOC): tách text thành script-runs (zh/en/ja/ko). Mixed intra-box (CN+EN cùng dòng) → per-token routing. Cả 4 call site cùng hưởng.

### AD7 — WASM bundle + model weights CDN

`.wasm` files (ORT + OpenCV.js) bundle trong extension (MV3 cấm remotely-hosted code). Set `env.wasm.wasmPaths` trỏ nội bộ. Model weights (.onnx) lazy-load từ CDN → IndexedDB cache (data, không phải code).

### AD8 — Frame dedup: rVFC + time gate 3fps + luma-diff 32x8 + text dedup

KHÔNG pHash (overkill). rVFC + time gate 3fps (Netflix cue tối thiểu 0.83s → 3fps đủ). Luma-diff 32x8 trên crop (rẻ hơn pHash 5-10x). Text-level dedup (OCR xong so chuỗi). Ponytail: nền video chuyển động → false positive, text-dedup fallback.

### AD9 — DRM black-frame detect + abort

Chrome vẽ Widevine video lên canvas ra khung ĐEN, không throw. `drmGuard`: mean pixel < threshold → abort OCR → báo user. Không waste 21.5MB model.

## Task List

### Phase 0: Spike — verify blockers trước khi implement

- [ ] T0: Spike WebGPU + WASM trong offscreen document + frame capture trên site thật

### Checkpoint 0: Spike pass
- [ ] WebGPU chạy trong offscreen (hoặc xác nhận WASM-only)
- [ ] Frame capture thành công trên themoviebox.xyz (no DRM)
- [ ] Frame capture fail trên Netflix (DRM black frame) → drmGuard detect
- [ ] ImageData transfer qua Port hoạt động

### Phase 1: Foundation — types + script-run segmenter + persistence

- [ ] T1: OcrEngine interface + types (`src/features/ocr/engine/`)
- [ ] T2: Script-run segmenter — upgrade detectLangCode (SSOT, 4 call site)
- [ ] T3: Per-origin OCR state — reuse tokenizeSettingsStore pattern

### Checkpoint 1: Foundation
- [ ] `npm run typecheck` pass
- [ ] `npm run test:unit` pass (T1-T3 tests)
- [ ] `npm run build` pass
- [ ] 4 existing call site của detectLangCode vẫn hoạt động

### Phase 2: PaddleOcrEngine + offscreen OCR

- [ ] T4: PaddleOcrEngine implementation (WebGPU/WASM, bundle wasm, wasmPaths)
- [ ] T5: Offscreen OCR Worker (extend ffmpeg.html, KHÔNG close offscreen)
- [ ] T6: Background OCR message handler (Port-based, route to offscreen)
- [ ] T7: Content-script OCR controller (Port client, ImageData transport)

### Checkpoint 2: Engine works
- [ ] Load extension → OCR init → model load → recognize 1 ImageData → return text+bbox
- [ ] Browser test: stealth-chrome-devtools

### Phase 3: Video OCR pipeline

- [ ] T8: Subtitle region detector (bottom % configurable)
- [ ] T9: DRM guard (black-frame detect → abort + user error)
- [ ] T10: Frame sampler (rVFC + time gate 3fps + luma-diff 32x8 + text dedup)
- [ ] T11: OCR cache (videoId, timestampBucket, LRU)
- [ ] T12: Video OCR controller (wire sampler + guard + orchestrator + cache)

### Checkpoint 3: Video OCR works
- [ ] Hard-sub video → OCR runs → dedup works → subtitle change detected
- [ ] DRM video → black frame detect → abort + user error
- [ ] Browser test: mock YouTube hard-sub

### Phase 4: Overlay + dictionary integration

- [ ] T13: OCR token wrap — bbox + script-run → hitbox spans
- [ ] T14: OCR overlay mount/unmount (transparent, pointer-events)
- [ ] T15: Language router — script-run → language plugin
- [ ] T16: Wire OCR → subtitleTriggerController.attach() → dictionary

### Checkpoint 4: Click → dictionary
- [ ] OCR hitbox click → dictionary popup → correct word
- [ ] Mixed: click "北京" → Chinese dict, click "watching" → English dict (same box)
- [ ] Browser test

### Phase 5: Manager Panel UI + persistence

- [ ] T17: OcrSettingsPanel component (toggle + status + language mode + region)
- [ ] T18: Add OCR tab to SubtitleManagerPanel
- [ ] T19: Wire toggle → settings → OCR init/dispose
- [ ] T20: Per-origin persistence — reload/SPA-nav handling

### Checkpoint 5: Manager Panel works
- [ ] Toggle ON/OFF works, persistence across reload/SPA-nav
- [ ] Browser test

### Phase 6: Polish + verify

- [ ] T21: WebGPU shader JIT warmup (dummy frame during init)
- [ ] T22: Error handling — OCR_ERROR → RETRY/FALLBACK
- [ ] T23: Dictionary probe cache (createDictionaryProbeAsync)
- [ ] T24: Update docs/2-architechture-system.md
- [ ] T25: Full browser test — hard-sub video + mixed-language + DRM

### Checkpoint 6: Complete
- [ ] All success criteria in spec met
- [ ] `npm run build` + `typecheck` + `test:unit` pass
- [ ] Browser verify pass
- [ ] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation | Status |
|---|---|---|---|
| WebGPU không hoạt động trong offscreen | High | Spike T0b PASS — WebGPU works. Fallback WASM (validated). | ✅ Resolved |
| WASM multithread cần COOP/COEP (SharedArrayBuffer) | Med | WASM single-thread đã đủ (3493ms cold, 263ms warm). Multithread = future optimization. | ✅ Mitigated |
| DRM black frame im lặng | High | drmGuard T9 detect + abort. themoviebox.xyz NOT DRM (verified T0b). DRM guard cho Netflix/Disney+ only. | ✅ Scoped |
| Remotely-hosted WASM → CWS reject | High | Bundle .wasm T4, set wasmPaths. | ⏳ T4 |
| Offscreen conflict ffmpeg | Med | Extend cùng html, KHÔNG close offscreen. | ⏳ T5 |
| luma-diff false positive (nền chuyển động) | Med | Text-level dedup fallback. | ⏳ T10 |
| Model download fail (CDN slow/blocked) | Low | T0b verified CDN works (11147ms). IndexedDB cache (951ms cached). | ✅ Resolved |
| Mixed intra-box segment quality | Med | Script-run segmenter (state machine). Ponytail: hasTerm:()=>false. | ⏳ T2 |
| Memory > 150MB trên low-end | Med | Dispose khi OCR disable. WebGPU 84-105MB (verified T0b). | ✅ Within budget |

## Open Questions

1. ~~WebGPU + WASM multithread trong offscreen~~ — **RESOLVED T0b**: WebGPU works. WASM single-thread đủ.
2. ~~Model hosting~~ — **RESOLVED T0b**: CDN lazy-load works (11147ms), IndexedDB cache (951ms).
3. luma-diff threshold — tune sau T10
4. videoId cho non-YouTube — hash(src + duration)
5. DRM scope — themoviebox.xyz NOT DRM (verified). DRM guard cho Netflix/Disney+ only.
