# Spec — audio-tab-hot-path (backlog #16)

Intent: `docs/intent/audio-tab-hot-path.md` (analyze: `docs/reviews/audio-tab-hot-path-analyze.md`, `all` mode) · uiSurface: **no** — corrected during analyze (pure transport, no UI change) → no design stage

## Goal

Kill the integer-keyed-object serialization of `audioBytes` across Chrome runtime messaging. On the two hot paths a `Uint8Array` (~100–400 KB of audio) arrives at the content script as a plain object with ~100k numeric keys and is rehydrated via `Object.values` — expensive in CPU and peak memory. Carry the same bytes as a base64 string on the wire instead, decode once at the provider boundary, and leave every consumer (`AudioItem.audioBytes: Uint8Array`, blob URLs, card creator, SRS cache) byte-for-byte untouched.

## Verified problem (analyze correction)

- **Backlog claim "local Forvo waits ~8s for Google sentence-TTS" is stale.** `useDictionaryToolbar.fetchAudio` starts `sentenceTtsP` immediately and applies word audio to state before awaiting it (`src/features/dictionaryPopup/logic/useDictionaryToolbar.ts`). Not in scope.
- **Confirmed cost:** `audioBytes` crosses `chrome.runtime.sendMessage`/`sendResponse` boundaries where the runtime serializes `Uint8Array` as `{0:..,1:..,…}` (string keys). `PronunciationAudioOrchestrator.toUint8Array` then rebuilds via `Object.values` — O(n) object with ~100k property lookups plus a second full-size array allocation.
- **Only two wire boundaries carry `audioBytes` today:**
  1. `FETCH_LOCAL_AUDIO` response: `data.items[].audioBytes` — `src/entrypoints/background/handlers/localAudio.ts` (bg → cs).
  2. `PRONUNCIATION_ESPEAK_TTS` response: `data.audioBytes` — `src/entrypoints/offscreen/pronunciationRunner.ts` → relayed verbatim through `handlers/pronunciation.ts` (offscreen → bg → cs, serialized twice).
- `QuickAddPayloadMessageSchema`/`AudioItemSchema`'s `audios` field has **no live message consumer** (no `QUICK_ADD` message type; popup quick-add stays in-context) — schema shared, no runtime boundary to fix.
- Card creator media (`mediaFile.ts`) and SRS `audioAssetCache` consume `Uint8Array` post-decode and are unchanged.

## Non-goals

- No change to `AudioItem`/`LookupResult` shapes visible to UI (entity keeps `audioBytes?: Uint8Array`).
- No change to provider fallback order, first-non-empty semantics, 8s timeouts, or `toUint8Array` rehydration of already-materialized values.
- No parallelization of the pronunciation fallback chain — priority order is intentional.
- No new message types; same `MESSAGE_TYPES`, same payload keys.
- No sentence-TTS timing changes (out of scope — analyzed stale).
- No `manifest.json`, no new dependencies.

## Requirements

### REQ-1 — Wire shape: `audioBytesB64: string`

Both boundary responses carry base64 instead of the byte container:

- `FetchLocalAudioResponse.items[]`: `audioBytesB64?: string` replaces `audioBytes` on the wire.
- `PronunciationEspeakTtsResult`: producer always emits `audioBytesB64: string` instead of `audioBytes` on the wire (type stays optional for fallback tolerance — REQ-4).

Encoding happens **at the producer, after schema-validate-able internal construction**, before the object leaves the context:

- `localAudio.ts`: after `providerFor(localFile).resolve(...)`, map `items` → `{ ...item, audioBytes: undefined→omitted, audioBytesB64: item.audioBytes ? encodeBase64(item.audioBytes) : undefined }`, then `FetchLocalAudioResponseSchema.parse` the **wire** shape.
- `pronunciationRunner.ts`: `sendResponse({ success: true, data: { audioBytesB64: encodeBase64(audioBytes) } })`.
- `handlers/pronunciation.ts` relays the response object untouched — no change beyond the renamed field type.
- `mockDictionary.ts` (`design-system-showcase` mock): `PRONUNCIATION_ESPEAK_TTS` returns `{ audioBytesB64: encodeBase64(SILENT_WAV bytes) }` and any `FETCH_LOCAL_AUDIO` items carry `audioBytesB64` — the showcase exercises the real decode path, not just `[]`.

### REQ-2 — Base64 helpers (reuse, view-safe)

- Reuse `src/shared/lib/base64.ts`.
- Extend `encodeBase64` to accept `ArrayBuffer | Uint8Array` (it already wraps `new Uint8Array(buffer)`; a `Uint8Array` input must be used as-is to respect `byteOffset`/`byteLength` of views). One name everywhere — producers call `encodeBase64` with either input type; no second helper.
- `decodeBase64ToArrayBuffer` unchanged; call sites wrap `new Uint8Array(...)`.
- Encoding uses the chunked `btoa` approach already in the file — no unbounded `String.fromCharCode` spread.

### REQ-3 — Decode once at the provider boundary

In `src/features/pronunciation/services/pronunciationAudioOrchestrator.ts`:

- `LocalAudioProvider`: map `item.audioBytesB64` → `new Uint8Array(decodeBase64ToArrayBuffer(b64))`; keep `toUint8Array(item.audioBytes)` fallback so already-materialized values (tests, in-context callers, mocks) still work. Precedence: `audioBytes` if present, else `audioBytesB64`.
- **Strip `audioBytesB64` off the materialized `AudioItem`** — `{ audioBytesB64: _b64, ...rest }` spread so the ~1.33× string doesn't linger inside long-lived React state (`audioItems`, card-creator prefill, SRS cache) next to the decoded bytes.
- `EspeakAudioProvider`: same decode on `data.audioBytesB64` with `toUint8Array(data.audioBytes)` fallback.
- `toUint8Array` itself is unchanged — it still handles `Uint8Array`, arrays, and legacy integer-keyed objects (fallback path, not the fast path).
- No other consumers touch wire bytes — they receive `AudioItem.audioBytes: Uint8Array` exactly as today.

### REQ-4 — Schemas + wire types tolerate both shapes

Tolerance is for tests, mocks, and in-context `AudioItem` producers — not a live mixed-version parse (after extension reload a stale content script's `chrome.runtime` is invalidated and can't reach the new SW anyway). Still cheap and correct to keep.

- `AudioItemSchema`: keep `audioBytes` but relax to `z.unknown().optional()` (accepts `Uint8Array` in-context, legacy object on the wire) and add `audioBytesB64: z.string().optional()`. All fields stay optional — no new required fields.
- `FetchLocalAudioResponseSchema`: unchanged shape otherwise.
- `PronunciationEspeakTtsResponseSchema`: `audioBytes` → `z.unknown().optional()`, plus `audioBytesB64: z.string().optional()`; provider requires bytes-or-b64 non-empty for `success:true` (runner always emits b64 on success). Note: this response schema is **not `.parse`d anywhere today** — `handlers/pronunciation.ts` relays unvalidated; the real guard is the provider decode. Keep it accurate anyway.
- `QuickAddPayloadSchema.audios` reuses `AudioItemSchema` — inherits tolerance for free; no dedicated change.

Type updates in `entities/message/types.ts` + `entities/dictionary/popupTypes.ts` (pinned optionality):

- `AudioItem`: add `audioBytesB64?: string` (wire-carried; stripped before UI state).
- `FetchLocalAudioResponse.items[]`: wire item = `AudioItem` shape where `audioBytesB64?: string` carries the payload; `audioBytes` stays `unknown`-compatible on wire-facing types (fallback).
- `PronunciationEspeakTtsResult`: `audioBytesB64?: string` added; `audioBytes` relaxed to `unknown` (optional) so `toUint8Array` fallback remains type-safe.

### REQ-5 — Behavior preserved byte-for-byte

- Identical audio content: decode(b64encode(bytes)) === original `Uint8Array` contents.
- Provider chain order, timeout, `eSpeakDataEnabled` filter, `toUint8Array` fallback — untouched.
- URL/blob lifecycle (`useAudioItemUrl`, `URL.createObjectURL`, revoke) — untouched.
- No observable UI/audio change; popup audio tab latency improves as a side effect.

### REQ-6 — Tests

- `base64` round-trip unit test incl. a `Uint8Array` **view** (non-zero `byteOffset`, partial `byteLength`) — encoded output must contain only the view's bytes.
- `AudioItemSchema`/`PronunciationEspeakTtsResponseSchema` accept both `{audioBytesB64}` and legacy `{audioBytes: object}` shapes.
- Orchestrator/provider tests: `LocalAudioProvider` + `EspeakAudioProvider` decode `audioBytesB64` to a `Uint8Array` with identical contents; legacy object still rehydrates via `toUint8Array`.
- `localAudio` handler test: response items carry `audioBytesB64`, no `audioBytes` key on the wire object.
- Existing pronunciation/popup tests pass unchanged (fallback keeps old shapes working).

## Interfaces touched

- `src/shared/lib/base64.ts` — `encodeBase64` signature widen.
- `src/entities/dictionary/popupTypes.ts` — `AudioItem.audioBytesB64?: string`.
- `src/entities/message/types.ts` — `FetchLocalAudioResponse` item + `PronunciationEspeakTtsResult` wire types.
- `src/entities/message/dictionarySchemas.ts` — schema relax + `audioBytesB64`.
- `src/entrypoints/background/handlers/localAudio.ts` — encode items before send.
- `src/entrypoints/offscreen/pronunciationRunner.ts` — encode response.
- `src/entrypoints/background/handlers/pronunciation.ts` — type only (relay untouched).
- `src/entrypoints/design-system-showcase/mockDictionary.ts` — mock emits wire shape.
- `src/features/pronunciation/services/pronunciationAudioOrchestrator.ts` — decode at `LocalAudioProvider`/`EspeakAudioProvider`.

## Alternatives considered

- **Transferable `ArrayBuffer` / structured clone:** `chrome.runtime.sendMessage` uses JSON serialization for message bodies — buffers do not survive as typed objects across contexts (that's the root bug); no `postMessage` transfer list exists on this API. Rejected as not available.
- **Number-array wire (`audioBytes: number[]`):** avoids object-key overhead but still ~3.7× payload and a per-element conversion; base64 is ~1.33× payload with native `atob` decode. Rejected.
- **Decode at the UI consumer (`useAudioItemUrl`):** pushes wire concern into every consumer; decoding at the provider boundary keeps `AudioItem.audioBytes` semantics single-sourced. Rejected.
- **Parallelize fallback chain:** changes priority semantics — out of scope (analyze already corrected the stale claim).
- **`z.unknown()` vs `z.record` for legacy `audioBytes`:** `record` still enumerates keys during validation (~100k ops — the very cost we're removing); `unknown` accepts without enumerating. Chosen.

## Success criteria (measurable)

- Unit test: `FETCH_LOCAL_AUDIO` wire response contains zero numeric-keyed object fields; `JSON.stringify(response)` shows `audioBytesB64` string; decoded bytes equal source.
- Real-Chromium verify: popup audio tab plays local/eSpeak audio; decoded `Uint8Array.length` matches the provider's byte count; no `Object.values`-rehydrated objects needed on the happy path.
- All gates: typecheck, lint, `test:unit`, build, feature-cycles/deep-imports clean.
