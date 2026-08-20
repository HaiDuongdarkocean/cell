# Orca OCR Spec — Adversarial Review Final Report

> 3-layer review: Review gốc (spec-reviewer) → Phản biện 1 (challenge) → Phản biện 2 (challenge phản biện 1).
> Verified bằng code thật: offscreenManager.ts, subtitleTriggerController.ts, manifest.json, tokenizeSettingsStore.ts, lookupOrchestrator.ts.

## Verdict: NEEDS REVISION — 6 blocker + 5 major + 4 minor phải sửa trước khi implement

---

## BLOCKER (phải giải trước khi lập plan)

### B1 — Frame transport: ImageBitmap không qua chrome.runtime.sendMessage
- **Verified**: `chrome.runtime.*` dùng JSON serialization, không phải structured clone. ImageBitmap/ArrayBuffer/Blob → `{}`.
- **Fix**: Dùng `{ data: Uint8ClampedArray, width, height }` (ImageData) qua `chrome.runtime.connect` Port với `postMessage` (Port hỗ trợ structured clone + transfer). HOẶC base64 dataURL (crop subtitle nhỏ, chi phí chấp nhận).
- **Spec sửa**: AD5, message protocol dòng 239.

### B2 — DRM → black frame im lặng
- **Verified**: Chrome vẽ video Widevine lên canvas ra khung ĐEN, không throw → OCR chạy tốn 21.5MB model đọc màn hình đen, không có error signal.
- **Fix**: Detect black frame (mean pixel < threshold) → abort OCR → báo user "DRM-protected video, OCR không khả thi".
- **Spec thêm**: Frame capture flow + DRM guard + user-facing error UX.

### B3 — Remotely-hosted WASM → Chrome Web Store reject
- **Verified**: File `.wasm` của onnxruntime-web/OpenCV.js = executable code. MV3 policy cấm remotely-hosted code. ORT-web mặc định fetch .wasm từ jsdelivr nếu không set `wasmPaths`.
- **Fix**: Bundle .wasm trong extension + set `env.wasm.wasmPaths` trỏ nội bộ. Model weights (.onnx) = data → CDN OK.
- **Spec thêm**: AD7 chi tiết — bundle wasm, set wasmPaths, model weights CDN OK.

### B4 — AC "Cold start <5s" mâu thuẫn AGENTS.md "<3s"
- **Verified**: AGENTS.md dòng "Always response <3s". Spec benchmark: WASM cold 3493ms, WebGPU shader JIT 5152ms. AC dòng 157 "Cold start <5s" vi phạm cả 2.
- **Fix**: Cold start = model load (background, không block UI). User-perceived latency = click → dictionary (OCR đã chạy ahead, ~0ms). AC sửa: "Model load <10s background, user-perceived click→dict <200ms".
- **Spec sửa**: Success Criteria.

### B5 — Mixed intra-box là common case, không phải edge case
- **Verified**: DBNet (PP-OCR detector) gộp dòng sát nhau thành 1 box. Sub song ngữ CN/EN sát → 1 box. Tiếng Trung nhúng Latin (CEO/WTO/5G) ~30-50% dòng. Tiếng Nhật 90%+ mixed kanji+kana.
- **Fix**: `languageRouter` per-token (script-run segmentation state machine ~50-80 LOC), KHÔNG phải per-box 1 langCode.
- **Spec sửa**: AD6, languageRouter design.

### B6 — Spec tự mâu thuẫn: native subtitle vs OCR
- **Verified**: Boundaries dòng 146 "Never: OCR khi native subtitle tồn tại" vs User story 2 "toggle → native disable".
- **Fix**: User story 2 đúng (user chủ động). Boundaries sửa: "Never: OCR tự-trigger khi native subtitle tồn tại — user phải toggle".
- **Spec sửa**: Boundaries.

---

## MAJOR (sửa trong spec/plan)

### M1 — OCR_DISPOSE phải free thật, không close offscreen
- **Verified**: `closeOffscreenDocument()` có 0 caller trong src/ (chỉ tests). Offscreen doc sống hết đời SW, 4 consumer dùng chung (ffmpeg, OPFS, fetch, subtitleSearch).
- **Fix**: `OCR_DISPOSE` free ORT session + model + WebGPU device, KHÔNG gọi `closeOffscreenDocument()`. Spec định nghĩa rõ.

### M2 — Per-origin: reuse tokenizeSettingsStore pattern (SSOT)
- **Verified**: `tokenizeSettingsStore.ts` đã có `{ origins: {}, urls: {}, subtitleUrls: {} }` + `setTokenizeEnabledForOrigin`/`isTokenizeEnabledForUrl`. `settings/types.ts:285` có `Record<origin, ...>`.
- **Fix**: Thêm `ocrPreference: Record<origin, OcrOriginState>` vào settings, reuse `extractOrigin()`. Bỏ key ad-hoc `ocrState:<origin>`.

### M3 — WASM multithread cần COOP/COEP (SharedArrayBuffer)
- **Verified**: WebGPU không cần COOP/COEP (POC chứng minh). NHƯNG WASM multithread của ORT cần SharedArrayBuffer → cần `crossOriginIsolated`. MV3 có manifest key `cross_origin_embedder_policy`/`cross_origin_opener_policy`. Offscreen document mặc định KHÔNG cross-origin isolated.
- **Fix**: Spike test — WebGPU + WASM multithread trong offscreen document. Nếu WASM single-thread (no SAB) → 3493ms cold start, chấp nhận cho máy yếu.

### M4 — createDictionaryProbeAsync cache
- **Verified**: `lookupOrchestrator.ts:116-137` load ~120k CEDICT terms mỗi lookup, có ponytail thừa nhận. OCR mở khóa click-to-lookup trên mọi hard-sub video + ảnh → tăng bậc số lần click.
- **Fix**: Cache dictionary probe (Set) sau first load. Reuse across lookups.

### M5 — pHash → đơn giản hóa (rVFC time gate + luma-diff + text dedup)
- **Verified**: pHash overkill. Netflix TTS guideline: cue tối thiểu 0.83s → sample 2-4 fps đủ. Downscale 32x8 luma + mean-abs-diff rẻ hơn pHash 5-10x. Dedup mạnh nhất ở text-level (OCR xong so chuỗi).
- **Fix**: rVFC + time gate 3fps + luma-diff 32x8 trên crop + text-level dedup. Xoá pHash khỏi spec (bớt 1 file + 1 test + 1 open question). Ponytail: nền video chuyển động sau chữ làm nhiễu cả pixel-diff → text-dedup là fallback.

---

## MINOR

### m1 — scriptDetect = detectLangCode thứ 2 (SSOT)
- **Verified**: `detectLangCode` đã tồn tại (subtitleTriggerController.ts:48-54, zh/en) với 4 call site.
- **Fix**: Nâng cấp `detectLangCode` thành script-run segmenter (thêm 'ja', 'ko'), cả 4 call site hưởng. Bỏ `scriptDetect.ts` mới.

### m2 — Mobile context menu khả nghi
- **Verified**: `chrome.contextMenus` không có trên Chrome Android. Chrome Android stable không hỗ trợ extension.
- **Fix**: User story 5 (mobile) = future phase. MVP desktop only.

### m3 — OCR overlay frame nào
- **Verified**: `tabs.ts:40-64` có `sendMessageToAllFramesInTab` vì player trong iframe cross-origin.
- **Fix**: Spec ghi rõ OCR overlay sống ở frame chứa `<video>` (top hoặc iframe).

### m4 — content script segment với hasTerm:()=>false
- **Verified**: `subtitleTriggerController.ts:62` segment FMM với probe rỗng → chất lượng cắt từ kém ở lớp hiển thị.
- **Fix**: Ponytail — biết mà chấp nhận cho MVP. Phase 2: cải thiện segment quality.

---

## Reuse Analysis (verified)

| Component | Verdict |
|---|---|
| `lookupOrchestrator`, `webTextDictionaryController`, `cardCreator`, `englishPlugin` | **Reuse as-is** ✅ |
| `cuesStore` | **Không đụng** ✅ |
| `subtitleTriggerController.attach()` | **Reuse** — nhận `HTMLSpanElement[]`, agnostic ✅ |
| `subtitleTokenWrap` | **Mirror pattern** — OCR hitbox spans cùng data attributes |
| `detectLangCode` | **Upgrade** — thành script-run segmenter (thêm ja/ko) |
| `tokenizeSettingsStore` pattern | **Reuse** — `Record<origin, OcrOriginState>` |
| `offscreenManager` | **Extend** — thêm ocrRunner vào cùng ffmpeg.html |
| `SubtitleManagerPanel` | **Extend** — thêm tab OCR |
| `contentScriptController` | **Extend** — thêm OCR init hook |
| `chinesePlugin` | **Reuse** — segment trong background (lookup pipeline) |
| `japanesePlugin` | **New** — defer phase 2, fallback single-char |
| `contextMenus` | **New** — manifest permission + handler |

## MVP Scope (re-scoped)

**IN**:
- Video hard-sub desktop, mixed CN+EN+JA (script-run segmenter)
- Manual toggle trong Manager Panel
- Per-origin persistence (reuse tokenizeSettingsStore pattern)
- WASM-first (WebGPU nếu spike OK), bundle .wasm
- rVFC + time gate 3fps + luma-diff + text dedup
- DRM black-frame detect + abort + user error
- Invisible hitbox overlay → reuse subtitleTriggerController → dictionary

**OUT (future phase)**:
- Image OCR + context menu (mobile không support extension)
- Mobile
- Auto-disable native subtitle (risk break player site)
- pHash (đơn giản hóa)
- Japanese plugin (fallback single-char)
- Screenshot OCR
