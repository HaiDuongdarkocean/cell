# Intent: Ocean Pronunciation Engine

> Elicitation result — confirmed by user on 2026-08-30.
> Next step: T0 spike to verify eSpeak NG WASM feasibility before `docs/specs/ocean-pronunciation-engine.md`.

---

## Elicitation Result

| Field | Confirmed value |
|---|---|
| **Problem** | Dictionary popup hiện tại chỉ hiển thị IPA tĩnh và play audio cả từ. Người học không thể nhấn vào từng phoneme để nghe rõ âm, không có timeline đồng bộ, và IPA không được cấu trúc hóa để tái sử dụng cho AI/Agent/Anki. |
| **User** | Người học tiếng Anh trong Ocean (persona chính 10–25 tuổi); Ocean AI/Agent dùng pronunciation data; Developer dùng như service. |
| **Current workflow** | User click từ trên trang → popup dictionary → tab Audio play cả từ từ community audio / Supertonic / Web Speech / chrome.tts. `AudioPanel` chỉ play từ/câu; `PronunciationButton` play `audioUrl` hoặc `speechSynthesis`. IPA tĩnh từ Cambridge data (`data/resource/en/ipa/extracted/term_meta_bank_1.json`). Không click từng phoneme. |
| **Pain point** | Không nghe riêng `/tʃ/`, `/oʊ/` trong từ; không highlight phoneme đang phát; IPA là plain string nên không phân biệt `oʊ` là single unit; không có machine-readable pronunciation model. |
| **Evidence** | Intent draft 23 phần; `AudioPanel.tsx` chỉ playback; `PronunciationButton.tsx` chưa wired vào popup; `fnc_tts.md` đã implement Supertonic v3 TTS nhưng không có phoneme/IPA/timeline; doubt-driven review tìm thấy 4 blockers về eSpeak audio synthesis, message transport, duplicate TTS, UI support. |
| **Desired outcome** | Input `text` + `language` → `PronunciationResult` có `text`, `language`, `ipa`, `syllables`, `words`, `phonemes[{ipa, startMs, endMs, type}]`, `audio`, `metadata`. Popup dictionary hiển thị IPA dạng segment, nhấn segment để play/highlight, play cả từ/sentence qua engine user chọn. |
| **Constraint** | Offline-first; nhẹ/nhanh/deterministic; English MVP; Unicode IPA; complex phonemes (`oʊ`, `aɪ`, `tʃ`, `dʒ`) là single unit; Ocean abstraction layer — không expose eSpeak internal; source priority: trusted dictionary > native/community audio > eSpeak > other fallback; platform Chrome/Edge/Brave MV3; user không muốn cài đặt phức tạp. |
| **Scope** | **MVP v0.1:** English, UI demo trong dictionary popup. IPA + phoneme sequence từ `@jocelyn-stericker/espeak-phonemes` (~500 KB English data). Audio cả từ/sentence: user chọn engine trong settings, default fallback `native → Supertonic → browser TTS → eSpeak (espeakng.js-cdn ~3.25 MB)`, user có thể cài đặt lại thứ tự. Phoneme segment click: play contextual segment từ audio engine đang chọn theo estimated timeline; nếu audio source unavailable (edge case) → chỉ highlight. Timeline là estimated, không sample-accurate. **Prerequisite:** T0 spike đã chứng minh eSpeak WASM output IPA và audio synthesis. **Out-of-scope:** CN/VN, pronunciation scoring, full dictionary authority, replacing native audio, language detection, neural TTS, phoneme audio library lớn, sample-accurate phoneme alignment. |

**Methods used:** interview (8-field frame), doubt-driven-development (adversarial review), domain scoping (codebase grep).

---

## Elicitation rounds

### Round 1 — Initial 8-field frame
User submitted detailed intent draft covering: offline-first, eSpeak NG as backend, phoneme/IPA/audio/timeline model, multilingual target, source priority, non-goals.

### Round 2 — Scope clarification
User confirmed:
- UI demo trong dictionary popup.
- Chỉ tiếng Anh trước.
- Yêu cầu doubt-driven-development stress-test.

### Round 3 — Audio synthesis scope
User clarified:
- Phoneme demonstration là chính: user nhấn từng IPA segment để nghe rõ.
- Audio cả từ có thể đưa ra lựa chọn sử dụng.
- Không muốn cài đặt phức tạp; ưu tiên eSpeak vì nhẹ.

### Round 4 — Audio source & fallback
User confirmed:
- Native/community audio (người thật) là số 1.
- Nếu không có → fallback theo chain user chọn.
- Default chain: `native → Supertonic → browser TTS → eSpeak`.
- "edge" = edge case (không phải trình duyệt Edge): khi audio source unavailable, phoneme click chỉ highlight.

---

## Open questions (to be resolved by T0 spike)

1. Can a browser-suitable eSpeak NG WASM build output IPA for English text?
2. Can it output phoneme events/sequence with timing?
3. Can it synthesize isolated phoneme audio and full-word audio in the browser?
4. What is the actual footprint of the WASM binary + data files?
5. Does eSpeak audio timing diverge from its phoneme sequence when stress/intonation are applied?
6. Can the timeline be aligned with Supertonic audio for segment playback, or will it need to be eSpeak-only?

## T0 spike result (2026-08-30)

### Packages evaluated

| Package / build | Footprint | IPA output | Audio synthesis | Phoneme events | Notes |
|---|---|---|---|---|---|
| `@jocelyn-stericker/espeak-phonemes` | ~300 KB `.wasm` + ~200 KB English data (~500 KB total) | ✅ `həlˈəʊ` for `hello`, handles `tʃ`, `dʒ`, `əʊ` | ❌ No audio code | ❌ No events | Purpose-built, lightweight, English-only phonemizer. |
| `espeak-ng` (ianmarmour, npm) | 17.6 MB `.wasm` | ✅ IPA via CLI (`--ipa=3`) | ❌ CLI only, no browser audio API | ❌ CLI, no events | Too large for extension bundle. |
| `espeakng.js-cdn` (steveseguin/pettarin) | ~758 KB worker JS + ~2.49 MB voice data (~3.25 MB total) | ❌ Not exposed | ✅ 22050 Hz, 18630 samples, 0.845s for `hello` | ⚠️ Only `samplerate/sentence/word/end` events; no phoneme-level events in prebuilt | Full in-browser TTS; 97 voices. |

### Key findings

1. **IPA/phoneme output is viable and small.** `@jocelyn-stericker/espeak-phonemes` returns proper IPA strings with stress marks and complex phonemes (`tʃ`, `dʒ`, `əʊ`, `aɪ`) as multi-character units. Footprint is acceptable for an extension.
2. **Audio synthesis is viable in browser.** `espeakng.js-cdn` produces a `Float32Array` of raw PCM samples at 22050 Hz. It is ~3.25 MB with all voice data.
3. **Phoneme-level timeline is NOT available out of the box.** Prebuilt eSpeak WASM only emits `samplerate`, `sentence`, `word`, and `end` events. No per-phoneme `startMs/endMs` without a custom WASM build or post-processing.
4. **Isolated phoneme audio is not practical.** eSpeak cannot be fed raw IPA to synthesize a single phoneme naturally. Phoneme click should play a **contextual segment** of the word audio or fall back to eSpeak robot voice for the single letter/phoneme.
5. **Timeline will be estimated in MVP.** For a phoneme highlight, we can divide the word audio duration by the number of phonemes (with stress/duration weighting) to get approximate `startMs/endMs`. This is not sample-accurate but sufficient for UI demo.

### Spike-driven scope update

- **eSpeak NG is the IPA/phoneme engine**, via `@jocelyn-stericker/espeak-phonemes` (~500 KB English).
- **Audio cả từ / sentence** uses the existing user-selectable chain: `native → Supertonic → browser TTS → eSpeakng.js-cdn` (~3.25 MB if eSpeak is chosen).
- **Phoneme segment click** plays a contextual segment from the active audio source with an estimated timeline. If eSpeak is the active source, it synthesizes only that source text.
- **Timeline for highlight** is estimated; sample-accurate phoneme alignment is a post-MVP research item.

---

## Assumptions

1. eSpeak NG can be compiled/used in the browser via WASM or an existing npm package.
2. The IPA/phoneme output is sufficient for English MVP, even if it is not academically perfect.
3. Users will accept a settings panel to reorder audio fallback engines.
4. Phoneme demonstration can start as segment playback from the chosen word audio source, with eSpeak as a fallback.

---

## Decisions made

- eSpeak NG is the **phoneme/IPA/timeline engine**, not the primary natural-voice TTS.
- **Audio cả từ / sentence** is a user-selectable chain: native → Supertonic → browser TTS → eSpeak.
- **Phoneme click** plays the phoneme segment from the active audio engine + highlights it.
- **Edge case:** when no audio source is available, phoneme click only highlights.
- **MVP language:** English only.
- **T0 spike is a hard prerequisite** before writing the production spec.

---

## Post-implementation notes

Implementation completed. See `docs/specs/ocean-pronunciation-engine.md` for the final architecture and verification status. Key adjustments from the original intent:

- The fallback audio chain was extended to include **local/community audio** at the top (`localFile → native → supertonic → browserTts → espeak`).
- A dedicated `PronunciationAudioOrchestrator` resolves both word and sentence audio through the user-configurable fallback chain, rather than a single `PronunciationEngine`.
- Settings UI adds a `Pronunciation` card in the existing settings dialog with engine reordering and an eSpeak TTS data download toggle.
- E2E Playwright test `e2e/extension-local-pronunciation-audio.spec.ts` verifies the settings card renders and engine reordering persists.
