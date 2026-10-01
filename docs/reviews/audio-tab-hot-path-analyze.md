# Analyze review — audio-tab-hot-path

Mode: `all` (autonomous — self-interrogation replaces the interactive gate).

## Audit claims re-verified against code

- "Local Forvo phải chờ Google sentence-TTS" — **STALE/WRONG**: `useDictionaryToolbar.fetchAudio` already kicks `sentenceTtsP` in parallel and calls `setAudioItems(wordItems)` before awaiting the sentence result. Removed from scope.
- "audioBytes qua sendMessage dạng JSON object 100k key" — **CONFIRMED**: `FETCH_LOCAL_AUDIO` (`items[].audioBytes`) and `PRONUNCIATION_ESPEAK_TTS` (`audioBytes`) cross the boundary as `Uint8Array` → serialized to a numeric-keyed object; both providers rehydrate via `toUint8Array(Object.values(...))`. Only these two message types carry bytes — `FETCH_COMMUNITY_AUDIO` returns URLs, `TTS_FETCH_AUDIO` returns a data-url string.
- Sequential provider chain in `PronunciationAudioOrchestrator.resolve` is user-configured priority order, not a bug — excluded from scope.
- `toUint8Array` must keep accepting legacy array/object forms for the mixed-version window (SW restart while a content page holds the old bundle).

## Decision

VERDICT: APPROVE

- Pure perf on a hot message path; no UI surface (`uiSurface=no` → skips design).
- Spec must lock: byte-identical decode round-trip, wire schema change (`audioBytes` → base64 string field), legacy-object tolerance in `toUint8Array` for the transition window, unchanged `AudioItem` shape at the UI layer.

Intent: `docs/intent/audio-tab-hot-path.md`
