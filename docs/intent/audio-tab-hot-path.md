# Intent: Quản lý Đường nóng Audio tab (Audio Tab Hot Path)

Source: internal-audit (backlog #16) · Mode: `all` — autonomous, conservative inferences recorded as accepted risks

> ui_surface: no

## Business Case

Audio tab của dictionary popup là đường nóng phụ của persona <3s. Audit claim một phần stale — phân tích lại cho thấy chi phí thật nằm ở **byte transport**: mọi `AudioItem.audioBytes` đi qua `sendMessage` dưới dạng JSON object `{0:.., 1:.., …}` với ~100k numeric keys (Uint8Array không survive chrome message serialization). Serialize/parse chuỗi object đó trên cả hai phía tốn CPU + GC đáng kể so với kích thước dữ liệu ~100KB, và mọi consumer phải rehydrate thủ công qua `toUint8Array(Object.values(...))`. Item này là pure performance trên đường message — không thêm surface.

## Stakeholders

- Immersionist mở audio tab / quick-add có audio — cảm nhận độ trễ + jank khi audio list load.
- Card creator paths nhận `AudioItem` (queue lazy lookup, quick add) — cùng wire shape.

## Needs

- Audio bytes transport nhanh + nhẹ RAM: chuỗi base64 trong payload thay vì object-of-keys (encoding/decoding O(n) native, không 100k-key object allocation).
- Behavior giữ nguyên: cùng `AudioItem[]` shape ở consumer, cùng ordering, cùng error paths, `toUint8Array` vẫn nhận mọi biến thể cũ (Array/object) làm fallback.
- Không đổi provider chain semantics (fallback order là user-configured priority — đúng thiết kế).

## Audit claims — re-verified

- Claim "Local Forvo phải chờ Google sentence-TTS (~8s) rồi mới bắt đầu" — **STALE/WRONG**: `useDictionaryToolbar.fetchAudio` đã kick `sentenceTtsP` song song (line ~220) và `setAudioItems(wordItems)` chạy trước khi await sentence result (line ~252). Word audio KHÔNG chờ sentence TTS.
- Residual serial wait thật: `PronunciationAudioOrchestrator.resolve` walk `fallbackEngines` tuần tự (`first non-empty wins`) — theo thiết kế là priority order, không phải bug; sửa = đổi product semantics → out.
- Claim "audioBytes qua sendMessage dạng JSON object 100k key" — **CONFIRMED**: `FetchLocalAudioResponse.items[].audioBytes` và `PronunciationEspeakTtsResult.audioBytes` đều là `Uint8Array` trên wire → JSON object; `LocalAudioProvider`/`EspeakAudioProvider` phải `toUint8Array(Object.values)` rehydrate. Có unit test document hẳn quirk này (`pronunciationAudioOrchestrator.test.ts:127`).
- Scan boundary khác: `FETCH_COMMUNITY_AUDIO` items dùng `url` không bytes; `TTS_FETCH_AUDIO` trả data-url string — không bị pain. Chỉ 2 message types mang bytes.

## Scope

In:
- `FETCH_LOCAL_AUDIO` response: `audioBytes` → base64 string field (schema + handler encode + provider decode).
- `PRONUNCIATION_ESPEAK_TTS` response: cùng treatment (offscreen runner encode, provider decode).
- Giữ `toUint8Array` backward-compat (chấp nhận cả legacy object form) để mixed-version an toàn trong SW restart window.
- Instrumented unit test: wire payload là string, decode đúng bytes round-trip.

Out:
- Provider ordering / parallelization của fallback chain (product semantics).
- Sentence-TTS path (đã parallel).
- OPFS/blob-URL transport cho audio (overkill ~100KB; blob URL trong MV3 SW không `createObjectURL` được).

## Workflow

- SPECIFY: spec + spec-reviewer gate.
- uiSurface=no → skip DESIGN → DELIVER: build + gates + verify trên Chromium thật (audio fetch path exercised end-to-end, không đổi UX).

## Journey

### AS-IS
1. User mở audio tab → `fetchAudio` → providers resolve qua `sendMessage`.
2. Background trả `AudioItem[]` với `audioBytes: Uint8Array` → JSON serializer vật object ~100k keys → content side `Object.values` rehydrate lại thành `Uint8Array` → blob URL.
3. RAM spike + serialize/parse cost tỉ lệ số items × size; mọi byte đi hai vòng conversion.

### TO-BE
1. Handler encode bytes → base64 string trên wire (`audioBytesB64`), schema validate string.
2. Consumer decode base64 → `Uint8Array` 1 lần — O(n) native, không object allocation.
3. `AudioItem` shape ở UI không đổi — bytes chỉ khác ở transport layer.

## Stories

- S1: As an immersionist, I want audio list load nhanh so that audio tab không jank — done when FETCH_LOCAL_AUDIO wire payload là base64 string và bytes round-trip byte-identical.
- S2: As a maintainer, I want không regression byte-level so that audio phát được như cũ — done when unit test chứng minh encode/decode round-trip + existing audio tests pass không đổi expectation.
- S3: As a maintainer, I want wire schema vẫn validate strict so that malformed payload bị reject — done when schema test cover cả legacy object-form tolerance nếu giữ fallback.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Base64 decode sai → audio corrupt | internal | Audio không phát | Round-trip byte-identical test; b64 helpers đã có sẵn trong repo (kiểm `bytesToBase64`/`base64ToBytes` reuse) |
| Mixed-version trong SW restart window (cũ gửi object) | internal | Item rớt bytes | `toUint8Array` giữ object/Array fallback; hết hạn sau một release — comment ponytail ceiling |
| Scope creep sang provider-chain parallelization | process | Đổi product semantics ngoài intent | Out-of-scope rõ ràng; fallback order là user priority |

## Decision

go — pure performance trên đường message, audit-verified (claim 2 confirmed, claim 1 đã stale → loại khỏi scope), không UI surface; S-size.

## Draft Acceptance Criteria

- AC1: `FetchLocalAudioResponse` + `PronunciationEspeakTtsResult` trên wire không còn numeric-keyed object — bytes đi dưới dạng base64 string.
- AC2: Consumer nhận `Uint8Array` byte-identical với bytes handler đọc (round-trip test).
- AC3: `toUint8Array` vẫn chấp nhận legacy object/array form (compat window); mọi caller existing pass không đổi.
- AC4: AudioItem UI shape không đổi — `audioBytes?: Uint8Array` ở tầng trong vẫn là Uint8Array.
- AC5: Gates: typecheck + lint + unit + build + cycles clean; real-Chromium audio fetch exercised (local audio configured path hoặc eSpeak path).
