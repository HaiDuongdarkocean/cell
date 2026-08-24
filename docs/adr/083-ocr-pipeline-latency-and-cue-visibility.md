# ADR: OCR Pipeline Latency Optimization + Cue Visibility

**Date:** 2026-08-23
**Status:** Accepted
**Spec:** `docs/specs/ocr-split-dual-stream.md`

## Context

Browser-testing the OCR pipeline on the mock hardsub page (`mock-youtube-hardsub`, port 4326) exposed two production-blocking defects:

1. **Message serialization bottleneck.** `chrome.runtime.sendMessage` uses JSON serialization (not structured clone), so `Uint8ClampedArray` from `ImageData.data` was converted via `Array.from()` to a plain `number[]` before sending from content script → background → offscreen. For a 960×540 crop that is ~2M array elements, each serialized as a decimal string. Measured overhead: **~537ms** per frame, occurring twice (content→background, background→offscreen). Total OCR latency was **~1014ms**, of which serialization alone was **>50%**.

2. **Subtitle block showed empty text despite OCR recognizing the line.** The cue engine (`subtitleCueEngine.ts`) calls `findCurrentLine()` (binary search) on every `timeupdate` (~250ms). `ocrTextToCues` set `CUE_TAIL_MS = 500` — so a cue's `end = detectionTime + 500ms`. But OCR round-trip latency is **1.5–5s**: by the time `postOcrTracks` runs, `video.currentTime` has advanced past `cue.end`. `findCurrentLine` returns `-1` → `targetActiveIndex = -1` → `SubtitleBlock` renders an empty `<span>`. The cue text was recognized and posted, just never visible.

3. **Out-of-order cues on seek.** When the user seeks backward, new detections arrive with `timeMs` lower than already-collected ones. `ocrTextToCues` processed detections in insertion order, producing cues where `start > end` (e.g. `{ s: 110334, e: 79986 }`), breaking the binary search invariant.

## Decision

### AD1 — Base64 encoding for image data transfer

Replace `Array.from(image.data)` with base64 encoding at the content-script boundary:

- **`ocrController.ts`** (`recognize`): `Uint8ClampedArray` → `Uint8Array` → chunked `String.fromCharCode` (0x8000 chunks to avoid call-stack limit) → `btoa()` → base64 string. The string is sent as `payload.image.data` (type `string`).
- **`ocrRunner.ts`** (`handleOcrRecognize`): detect `typeof img.data === 'string'` → `decodeBase64ToUint8Clamped()` (`atob` + byte copy into `Uint8ClampedArray`). Pass the decoded `ImageSource` to the engine unchanged.
- **`types.ts`** (`ImageSource`): `data` stays `Uint8ClampedArray | number[]` at the type level (the base64 string is a transport-only concern; the offscreen boundary decodes before the engine sees it). The `OcrRecognizePayload.image.data` type is widened to `string | Uint8ClampedArray | number[]` to accept both.

**Why base64, not `Array.from`:** base64 encodes 3 bytes → 4 chars (33% overhead), versus `Array.from` which produces one decimal string per byte (avg ~3.5 chars/byte = 250%+ overhead). JSON serialization of a string is also faster than serializing a 2M-element number array. Measured: serialization dropped from **~537ms → 41–176ms** (3–13× faster), total latency from **~1014ms → 533–855ms** (1.2–2× faster).

**Why not `structuredClone` / `Transferable`:** `chrome.runtime.sendMessage` does not support structured clone or transferable objects — it is JSON-only by spec. This is the documented MV3 constraint.

### AD2 — Extend last OCR cue to `nowMs + 30s`

In `ocrContentScript.ts` `postOcrTracks()`, after `ocrTextToCues` builds the cue list, extend the last cue's `end` to `Math.max(last.end, nowMs + 30000)` where `nowMs = video.currentTime * 1000`:

- The last recognized subtitle stays visible for up to 30s after its detection, covering the OCR round-trip gap.
- When a **new** subtitle is detected, `ocrTextToCues`'s existing dedup pass sets `deduped[i].end = deduped[i+1].start` — so the old cue is automatically truncated at the new cue's start. No stale text lingers.
- If no new subtitle arrives within 30s, the cue expires and the block goes empty — matching the user requirement: "subtitle chỉ ẩn đi khi có quá 30s mà không có subtitle nào khác thay thế hoặc sẽ được subtitle khác thay thế."
- `Math.max` (not unconditional override) preserves the case where `ocrTextToCues` already set a longer `end` via `LAST_CUE_TAIL_MS` or dedup backfill.

**Why 30s, not `CUE_TAIL_MS = 500`:** `CUE_TAIL_MS` is a merge-gap heuristic inside `ocrTextToCues` (controls whether consecutive same-text detections merge into one cue). It must stay small (500ms) so adjacent *different* subtitles don't get backfilled into each other. The 30s visibility window is a *display* concern, applied *after* cue building, at the post step — the two constants serve different purposes and must not be conflated.

### AD3 — Sort detections by `timeMs` before cue building

In `ocrToCues.ts`, `ocrTextToCues()` now sorts a shallow copy of detections by `timeMs` ascending before processing:

```ts
const sorted = [...detections].sort((a, b) => a.timeMs - b.timeMs);
```

This guarantees the binary-search invariant (`cues[i].start <= cues[i].end` and `cues[i].end <= cues[i+1].start`) holds even when the user seeks backward and new detections have lower `timeMs` than already-collected ones. The sort is O(n log n) but n is bounded by detection count per session (~5/s × session length); for a 5-min session that's ~1500 detections — negligible. The original array is not mutated (shallow copy).

## Consequences

- **Latency:** total OCR round-trip dropped from ~1014ms to 533–985ms. The remaining bottleneck is OCR inference itself (detection + recognition, 460–821ms), not data transfer.
- **Cue visibility:** the subtitle block now shows recognized text reliably across the OCR latency gap. Verified on mock hardsub page: text transitions correctly ("If I could only hear you say you love me" → "Too bad we can't go back to that moment" → "How have you been?").
- **Seek safety:** backward seeks no longer produce `start > end` cues; `findCurrentLine` binary search stays correct.
- **Type contract:** `ImageSource.data` at the engine boundary is still `Uint8ClampedArray` — the base64 string is a transport-only shape that the offscreen boundary decodes. Callers that import `ImageSource` for engine use are unaffected.
- **30s window is a display heuristic, not a cue-merge parameter:** future changes to `CUE_TAIL_MS` (merge gap) must not affect the 30s visibility window, and vice versa. The two are in separate files (`ocrToCues.ts` vs `ocrContentScript.ts`) to keep the concerns separate.
- **Sort cost ceiling:** for very long sessions (>1h) the per-update sort is O(n log n) with n growing unboundedly. Ponytail ceiling: switch to an incremental insert-sort (detections arrive roughly in time order, so insert-sort is ~O(n) amortized) if profiling shows the sort exceeding 5ms.
