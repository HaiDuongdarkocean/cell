# Spec review — audio-tab-hot-path

VERDICT: APPROVE_WITH_CHANGES

## Round 1 — APPROVE_WITH_CHANGES (6 minors, no blockers/majors)

Verified against intent + analyze + source. Boundary enumeration complete: only `FETCH_LOCAL_AUDIO` and `PRONUNCIATION_ESPEAK_TTS` carry raw bytes; every other byte path already uses base64/data-URL (`OCR_RECOGNIZE`, `RESOURCE_IMPORT_CHUNK`, `CONDENSE_AUDIO_*`, `TTS_FETCH_AUDIO`, `FETCH_MEDIA_URL`); `HYDRATE_CHUNK` is worker `postMessage` (structured clone survives); no `QUICK_ADD` message type exists.

Minors:

1. Reload-window rationale over-stated (stale content scripts have invalidated `chrome.runtime` — cannot reach new SW). Tolerance still right for tests/mocks/in-context producers.
2. Provider must **strip `audioBytesB64`** from the materialized `AudioItem` — otherwise the ~1.33× string lingers in React state next to decoded bytes.
3. Naming: unify on `encodeBase64` (widened signature) across REQ-1/REQ-2.
4. Pin wire-type optionality: `audioBytesB64?: string`; `audioBytes` relaxed to optional `unknown` for fallback.
5. `mockDictionary.ts` should emit real `audioBytesB64` (SILENT_WAV) so showcase exercises the decode path.
6. `PronunciationEspeakTtsResponseSchema` is never `.parse`d (handler relays unvalidated) — note recorded.

## Applied fixes

- REQ-1: producers call `encodeBase64` (single name); mock emits real `audioBytesB64` of SILENT_WAV.
- REQ-2: `encodeBase64` widened to `ArrayBuffer | Uint8Array`, view-safe; no second helper.
- REQ-3: `audioBytesB64` stripped from materialized `AudioItem` at provider decode; precedence `audioBytes` → `audioBytesB64`; `toUint8Array` unchanged as fallback.
- REQ-4: rationale corrected to tests/mocks/in-context tolerance; exact optionality pinned (`audioBytesB64?: string`, `audioBytes?: unknown`); espeak response schema noted as unenforced-but-accurate.
- Success criteria unchanged (structural proxy + byte-identity).
