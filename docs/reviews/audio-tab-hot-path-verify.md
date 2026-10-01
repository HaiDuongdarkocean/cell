# Verify — audio-tab-hot-path

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/audio-tab-hot-path.md` (APPROVE_WITH_CHANGES, all 6 minors applied) · Intent: `docs/intent/audio-tab-hot-path.md` · uiSurface=no (design skipped)

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean |
| `npm run lint` | pass | eslint clean |
| `npm run test:unit` | pass | 660 suites / 7772 tests (+9 new: 4 base64, 2 schema tolerance, 2 provider decode/strip, 1 handler wire shape + passthrough, 1 espeak b64) |
| `npm run build` | pass | vite build + postbuild CSP patch |
| `check-feature-cycles` / `check-deep-imports` | pass | 27 features, 62 edges clean; 0 new deep imports |

## Real-browser verification (Playwright + packed `dist`, Chromium)

`e2e/extension-audio-wire.spec.ts` — 2/2 pass over **real `chrome.runtime.sendMessage`**:

1. `PRONUNCIATION_ESPEAK_TTS` from an extension page → SW relay → offscreen eSpeak synthesis → response arrives with `audioBytesB64: string`, no `audioBytes`, base64 decodes to a real `RIFF` WAV header (>44 bytes). Proves the 2-hop serialized path carries bytes as base64, not integer-keyed objects.
2. `FETCH_LOCAL_AUDIO` round-trips and validates (`items: []` unconfigured — message path + schema fine).

`e2e/extension-local-pronunciation-audio.spec.ts` fails on the popup `heading "Cell"` mount — **pre-existing**: the same spec fails identically on baseline HEAD with all item changes stashed (popup entry point regression, unrelated to this diff — no popup code touched).

## Requirement traceability

- REQ-1 wire shape: `audioBytesB64` produced at `localAudio.ts` (items mapped post-`resolve`, pre-schema) and `pronunciationRunner.ts`; relay untouched; `mockDictionary.ts` emits real `audioBytesB64` for eSpeak + a local-audio item.
- REQ-2 helpers: `encodeBase64(input: ArrayBuffer | Uint8Array)` — `Uint8Array` used as-is so views encode only their window (tested with non-zero `byteOffset` + 70KB multi-chunk).
- REQ-3 decode-once: `LocalAudioProvider`/`EspeakAudioProvider` prefer `audioBytes` (in-context/tests), fall back to `audioBytesB64`, then strip `audioBytesB64` off the materialized `AudioItem` so the ~1.33× string doesn't persist in React state. `toUint8Array` unchanged (legacy integer-keyed object still rehydrates for mocks/in-context producers).
- REQ-4 schemas/types: `AudioItemSchema` + `PronunciationEspeakTtsResponseSchema` accept `audioBytesB64: z.string().optional()` and relaxed `audioBytes: z.unknown().optional()` — `z.unknown` chosen over `z.record` because record validation enumerates the ~100k keys (the exact cost being removed). `PronunciationEspeakTtsResult.audioBytes` relaxed to `unknown`.
- REQ-5 behavior: provider chain order, 8s timeouts, `downloadEspeakTtsData` filter, blob-URL lifecycle, all `audioBytes` consumers — unchanged.
- REQ-6 tests: all listed cases implemented and passing.
