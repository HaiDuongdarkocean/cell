# Spec: Ocean Pronunciation Engine

## Assumptions (correct me now)

1. **MVP chỉ tiếng Anh** (`en`). `@jocelyn-stericker/espeak-phonemes` sẽ làm **IPA/phoneme engine** — nhẹ (~300 KB `.wasm` + ~200 KB English data) và đủ cho English.
2. **Audio cả từ / sentence** là user-selectable source với fallback chain: `native/community audio → Supertonic v3 → browser TTS (Web Speech / chrome.tts) → eSpeak (espeakng.js-cdn ~3.25 MB)`. User có thể reorder trong settings.
3. **Phoneme timeline là estimated** trong MVP, không sample-accurate. eSpeak prebuilt WASM không expose per-phoneme events; timeline được suy ra từ audio duration chia theo số phoneme (có weighting cơ bản cho vowel/stress).
4. **Phoneme click** chơi **contextual segment** từ audio cả từ theo estimated timeline. Nếu eSpeak là audio source đang chọn, nó synthesize lại từng phoneme bằng source text tương ứng (ví dụ `h`, `ə`, `l`, `oʊ`) — chấp nhận chất lượng robot.
5. **Edge case:** khi không có audio source khả dụng, phoneme click chỉ **highlight**, không play.
6. English eSpeak data **bundle sẵn** trong extension (đủ nhẹ). eSpeak TTS voice data (`espeakng.js-cdn`) là **optional download** nếu user chọn eSpeak làm audio source; không bundle 3.25 MB mặc định.
7. Ocean abstraction layer: app không gọi eSpeak internal trực tiếp. Tất cả thông qua `PronunciationEngine` interface.

---

## Objective

Xây dựng **Ocean Pronunciation Engine** cho Cell — một lớp pronunciation abstraction độc lập với UI, cho phép:

- Chuyển text tiếng Anh thành **IPA string + phoneme sequence**.
- Cung cấp **PronunciationResult** có cấu trúc (`text`, `language`, `ipa`, `phonemes[{ipa, startMs, endMs, type}]`, `audio`, `metadata`).
- Hiển thị phoneme list trong dictionary popup, cho phép user **nhấn từng phoneme để play/highlight**.
- Play audio cả từ/sentence qua audio source user chọn trong settings.

Success: User tra từ `hello`, popup hiển thị `/həlˈəʊ/` dạng phoneme list, user nhấn từng phoneme để nghe âm đó, build pass, typecheck 0, tests pass.

### User stories

- **As a learner**, I want to see the IPA of a word split into clickable phonemes so that I can understand how each sound is pronounced.
- **As a learner**, I want to click an individual phoneme to hear it clearly so that I can imitate the sound.
- **As a user**, I want to choose and reorder the audio source fallback chain so that I can balance quality vs. offline availability.

---

## Tech Stack

- **IPA/phoneme engine**: `@jocelyn-stericker/espeak-phonemes` (WASM, English-only, ~500 KB total).
- **eSpeak TTS audio**: `espeakng.js-cdn` (WASM + worker + data, ~3.25 MB, optional download khi user chọn eSpeak audio source).
- **Audio fallback**: `TtsEngine` interface hiện có (`ttsEngineService.ts`), `supertonicTtsEngine.ts`, `PronunciationButton`.
- **Architecture**: MV3 offscreen document cho eSpeak TTS audio inference; phoneme engine chạy trong content/popup vì nhẹ. eSpeak TTS runner được nạp vào `entrypoints/offscreen/ffmpeg.html` đã có (hoặc `offscreen.html` nếu refactor) cùng với ffmpeg/ocr/tts runners, không chạy trong service worker.
- **UI**: React + `src/shared/ui/` + CSS modules + design tokens.
- **Message boundary**: Zod validation qua `src/entities/message/types.ts` / `src/shared/config/messages.ts`.
- **State**: Zustand hoặc local component state; không `any`.

---

## Commands

```bash
# Cài dependency sau khi version được duyệt
npm add --save-exact @jocelyn-stericker/espeak-phonemes
# espeakng.js-cdn không có npm package — sẽ vendor hoặc tải assets từ CDN theo version pin

# Dev
npm run dev

# Build
npm run build

# Typecheck
npm run typecheck

# Unit tests
npm run test:unit

# Browser verify
npm run mock
# + skill testing-extension-browser
```

---

## Project Structure

```
src/
├── features/pronunciation/
│   ├── types.ts                          # PronunciationResult, Phoneme, PronunciationAudio
│   ├── services/
│   │   ├── espeakPhonemeEngine.ts        # Wrapper @jocelyn-stericker/espeak-phonemes
│   │   ├── espeakAudioEngine.ts          # Wrapper espeakng.js-cdn TTS (optional source)
│   │   ├── pronunciationEngine.ts        # Orchestrate: text → PronunciationResult
│   │   ├── phonemeTimelineEstimator.ts   # Estimate startMs/endMs per phoneme
│   │   └── ipaSegmenter.ts               # Parse IPA string into phoneme units
│   └── logic/
│       └── phonemeNormalizer.ts          # Normalize eSpeak IPA → Ocean internal phoneme model
├── features/dictionaryPopup/
│   ├── ui/
│   │   ├── PronunciationPanel.tsx        # Phoneme list, highlight, click-to-play
│   │   ├── PronunciationPanel.module.css
│   │   ├── AudioPanel.tsx                # Extend: audio source selector, play word/sentence
│   │   └── DictionaryPanelView.tsx       # Integrate PronunciationPanel
│   ├── logic/
│   │   └── usePronunciation.ts           # Hook: term → PronunciationResult
│   └── schema.ts                         # Zod: PronunciationRequest/Response
├── features/settings/ui/
│   └── PronunciationSettingsPanel.tsx    # Audio fallback engine reorder + download eSpeak data
├── entities/settings/types.ts            # PronunciationSettings, AudioEngineFallback
├── entities/message/types.ts             # PRONOUNCE, PRONUNCIATION_RESULT, PRONUNCIATION_AUDIO
├── shared/config/messages.ts             # Message constants
└── shared/domain/dictionary/atoms/PronunciationButton.tsx  # Extend to accept PronunciationAudio
```

### Settings schema migration

`src/shared/lib/storage/settingsStore.ts` hiện có `CURRENT_SCHEMA_VERSION = 24`. Thêm `pronunciation` slice mới vào `Settings` shape, tăng `CURRENT_SCHEMA_VERSION` lên `25`. Migration v24 → v25 trong `settingsStore.ts` sẽ default `pronunciation.fallbackEngines` về `['native', 'supertonic', 'browserTts', 'espeak']` và `pronunciation.downloadEspeakTtsData` về `false` khi load old version.

```ts
export interface PronunciationSettings {
  fallbackEngines: AudioEngineKind[];
  downloadEspeakTtsData: boolean;
}

export type AudioEngineKind =
  | 'native'
  | 'supertonic'
  | 'browserTts'
  | 'espeak';
```

---

## Code Style

- Function components + named export. Không default export.
- Không `any`. Types tường minh qua Zod tại message boundary.
- `PronunciationEngine` là interface; `createEspeakPronunciationEngine()` implement.
- Phoneme là single unit — `IPA` string có thể multi-character (`tʃ`, `dʒ`, `əʊ`, `aɪ`). Segmenter phải dùng lookup table, không `split('')`.
- UI sử dụng `Button`, `Card`, `Select`, `SettingsRow` từ `src/shared/ui/`.
- CSS dùng token từ `tokens.json`, không hardcode.

### Example: Phoneme model

```ts
export interface Phoneme {
  readonly ipa: string;          // e.g. "tʃ"
  readonly startMs: number;      // estimated
  readonly endMs: number;        // estimated
  readonly type: 'consonant' | 'vowel' | 'diphthong' | 'stress';
}

export interface PronunciationResult {
  readonly text: string;
  readonly language: string;
  readonly ipa: string;
  readonly phonemes: readonly Phoneme[];
  readonly audio: PronunciationAudio | null;
  readonly metadata: {
    readonly engine: string;
    readonly engineVersion: string;
    readonly source: 'espeak' | 'dictionary';
  };
}
```

---

## Testing Strategy

- **Unit**: Jest + jsdom.
  - `ipaSegmenter.test.ts`: parse `həlˈəʊ` → `['h', 'ə', 'l', 'əʊ']`; `tʃ`, `dʒ`, `aɪ`, `oʊ` là single units; stress marks tách riêng.
  - `phonemeTimelineEstimator.test.ts`: uniform và weighted estimates cộng lại bằng audio duration.
  - `pronunciationEngine.test.ts`: mock espeak-phonemes, mock audio engine, assert PronunciationResult shape.
- **Integration**: TTS message flow nếu eSpeak audio source active.
- **E2E/Browser**: skill `testing-extension-browser` — verify popup hiển thị phoneme list, click phoneme play/highlight.
- **Spike T0**: ĐÃ HOÀN THÀNH. eSpeak-phonemes output IPA đúng; espeakng.js-cdn synthesize audio trong browser.

### Definition of Done

- [ ] Code reviewed by `code-review-and-quality` skill.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run build` pass.
- [ ] UI changes pass `design-system-guardian` if touching CSS/TSX.
- [ ] E2E/spike verifies phoneme list render + click in real browser.
- [ ] `docs/2-architechture-system.md` updated if structure changes.
- [ ] ADR written if a non-trivial architectural decision is made.

---

## Boundaries

### Always do
- Validate mọi message payload bằng Zod tại trust boundary.
- Fallback audio engine theo user settings.
- Chạy `npm run build` sau mỗi lần sửa `src/`.
- Cập nhật `docs/2-architechture-system.md` khi thay đổi cấu trúc.
- Giữ `PronunciationResult` là SSOT, không expose eSpeak internal ra app.

### Ask first
- Thay đổi `manifest.json` (WASM CSP / web_accessible_resources).
- Thêm dependency mới (kiểm tra bundle size, license).
- Sửa `tokens.json`.
- Bundle eSpeak TTS data (>1 MB) vào extension.
- Refactor offscreen document để thêm eSpeak TTS runner.
- Thay đổi `manifest.json` để thêm `wasm-unsafe-eval` trong `content_security_policy` (cần test thật trên Chrome MV3) hoặc `web_accessible_resources` cho `.wasm`/`.data` files.

### Never do
- Bundle secret/API key.
- Commit eSpeak voice data lớn vào repo mà không optimize.
- Sửa security policy / `.npmrc` để bypass giới hạn.
- Expose raw eSpeak events/internal representation ra UI.

---

## Success Criteria

- [ ] `npm run build` pass, `npx tsc --noEmit` 0 error.
- [ ] **Performance**: Phoneme generation (text → IPA → phoneme list) hoàn thành trong ≤ 100ms trên từ đơn. Phoneme click → audio bắt đầu phát trong ≤ 300ms khi audio engine đã warm.
- [ ] Unit tests cho `ipaSegmenter`, `phonemeTimelineEstimator`, `pronunciationEngine` pass.
- [ ] `@jocelyn-stericker/espeak-phonemes` hoạt động trong browser: `hello` → `həlˈəʊ`.
- [ ] Popup dictionary hiển thị IPA dạng phoneme list; `tʃ`, `dʒ`, `əʊ` là single units.
- [ ] Nhấn phoneme play contextual segment theo estimated timeline hoặc eSpeak robot phoneme.
- [ ] Settings cho phép chọn/reorder audio fallback engines.
- [ ] Edge case: khi audio source unavailable, phoneme click chỉ highlight.
- [ ] Không phá vỡ TTS/Supertonic hiện có.

---

## Open Questions

1. **Vị trí PronunciationPanel:** Hiển thị trong tab **Audio** hiện có (dưới audio list) hay tạo tab **Pronunciation** riêng? — *Accepted risk: quyết định trong phase design-system-guardian khi có prototype.*
2. **Duration weighting:** Uniform per phoneme hay vowel/diphthong dài hơn consonant? — *Accepted risk: bắt đầu uniform, tuning sau khi có user feedback.*
3. **eSpeak TTS data delivery:** Bundle toàn bộ 3.25 MB hay download on-demand khi user chọn eSpeak audio source? — *Accepted risk: download on-demand, bundle chỉ English phoneme data.*
