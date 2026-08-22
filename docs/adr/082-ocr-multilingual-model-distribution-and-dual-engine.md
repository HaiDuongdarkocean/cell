# ADR: OCR Multilingual Model Distribution + Model-Keyed Dual Engine

**Date:** 2026-08-22
**Status:** Accepted (spec: `docs/specs/ocr-split-dual-stream.md`)
**Spec:** `docs/specs/ocr-split-dual-stream.md`

## Context

The split dual-stream spec needs 12 PP-OCRv5 recognition models (default `ch` + 11 multilingual: en, korean, latin, eslav, cyrillic, th, el, arabic, devanagari, ta, te) covering 106 languages. Today the recognition model ships bundled inside the extension (`paddleOcrEngine.ts` — `modelBase = getURL('models/')`); other paddleocr-js weights already lazy-load from CDN into IndexedDB. The extension .crx is already ~111MB. Dual-stream also needs two languages resident at once, while `ocrRunner.ts` holds a single engine singleton — and the AGENTS.md persona floor is 1GB available RAM, versus ~84-148MB engine heap each.

Three constraints drive the decision:

1. **Bundle size** — bundling 12 rec models would add ~60-120MB to the .crx. Unacceptable.
2. **Chrome Web Store remote-code policy** — weights (.onnx/.tar) are data and may be fetched remotely; WASM/JS runtimes are code and must stay bundled. The current engine already bundles opencv.js locally and must keep doing so.
3. **Min-spec RAM** — two engine instances ≈ 300MB heap violates the 1GB-available persona; a no-fallback design would hard-fail low-end machines.

## Decision

**Model distribution — hybrid:**
- Default model (`ch`) stays **bundled** — first-run OCR works offline, zero download for the default `auto`/`zh`/`ja` experience.
- The 11 multilingual models **lazy-load from CDN → IndexedDB cache** (extending the pattern paddleocr-js already uses for its other weights). Same model never downloads twice; cached models work offline afterwards.
- CDN host permissions are added for the weights host(s) only. The blocking open question (which exact endpoints `paddleocr-js` uses for rec models) must be resolved from package source before implementation — tracked in the spec's Open Questions #5.

**Engine routing — model-keyed map, not stream-keyed:**
- `ocrRunner.ts`: `Map<engineKey, OcrEngine>` keyed by MODEL name, LRU-capped. Streams sharing a model share one instance (target=`auto`, native=`zh` → both resolve to the default model → 1 engine).
- `MAX_RESIDENT_ENGINES = 2` normally; `= 1` when `navigator.deviceMemory < 4` — in single-engine mode both streams run through the target stream's model (accuracy hint shown once), rather than disabling split.
- `OCR_INIT`/`OCR_RECOGNIZE`/`OCR_DISPOSE` payloads gain `engineKey`; the background handler forwards as-is; the content-side `OcrController` holds one proxy per key.
- First use of an uncached model surfaces a download progress state in the panel — no silent multi-second stall.

## Consequences

- .crx grows by nothing (multilingual support without bundle cost); the cost moves to a one-time per-model download with progress UI.
- Offline-first is preserved for the default experience and for any previously used language.
- CWS review risk is bounded to remote *weights*; runtimes stay bundled.
- Low-RAM machines keep split functional (single engine, degraded native accuracy) instead of OOM.
- Review implication for the spec's performance numbers: dual-call timings were preliminary; re-measure on min-spec before shipping.
