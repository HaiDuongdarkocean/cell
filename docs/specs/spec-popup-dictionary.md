# Spec: Popup Dictionary tích hợp Cell

> **Phase**: G1 (spec, trước design-driven-development).
> **Intent**: `docs/intent/intent-popup-dictionary.md` (confirmed via interview-me, 18 câu).
> **Prototype handoff (reference, không phải production)**: `docs/specs/design/dictionary-popup-prototype-handoff.md`.
> **UC gốc (reference, không phải source of truth)**: `docs/specs/design/UC/UC03_doc_trang_web/UC03.4_word_popup.md`, `UC09_tao_flashcard/UC09.2_quick_add_flashcard.md`.
> **ADRs liên quan**: ADR-021 (translate background), ADR-023 (dictionary import IndexedDB), ADR-024 (theme boundary), ADR-026 (card creator Anki).

Mục đích spec này: **inventory tính năng đang có vs cần build mới** để design-driven-development có baseline rõ ràng trước khi làm mockup.

---

## 1. Objective

Xây **Popup Dictionary tích hợp Cell** — tra từ/cụm từ mọi nơi có text (subtitle overlay + bôi đen/hover text web), hiển thị definition + IPA/pinyin + frequency + các panel nguyên liệu (audio/image/translate/external dict), tick chọn nguyên liệu + Quick Add hoặc Send to Creator → Anki/Cell Memory. Thay thế hoàn toàn extension tra từ bên thứ ba.

**User**: Người học ngôn ngữ qua video (English + Chinese đợt này) trên Chromium desktop/tablet/mobile, RAM 4GB.

**Success (testable)**:
- Tra cứu ≤1s (trigger → popup hiện nội dung local: target + reading + frequency + definitions).
- Lazy load tab-switch: panel ngoài (audio/image/translate/links) chỉ fetch khi user mở panel đó.
- Auto-detect cụm/đơn: dictionary match (cụm dài ưu tiên) + plugin ngôn ngữ bổ trợ (lemma, possessive, phrasal/idiom — EN+ZH đầy đủ).
- Popup resize + auto-position (tránh overflow màn hình, sticky size).
- 5 word status ở footer: unknown → known → tracking → learning → ignore.
- Quick Add 3 mode: manual tick / quick (definition all + nguyên liệu khác lấy top item) / hybrid.
- English + Chinese plugin đầy đủ; architecture plugin interface clean cho mở rộng.
- Default popup tab global sticky (user pin 1 lần, áp dụng mọi popup sau).
- Trigger mode setting: click | hover | hover + modifier (Ctrl/Shift/Alt).
- Không nhắc tên sản phẩm bên thứ ba trong codebase/comment/tên biến.

---

## 2. Tech Stack

- **Runtime**: Chrome Extension MV3, content-script isolated world + Shadow DOM cho popup.
- **UI**: React 19 + Zustand 5 + TypeScript 6 + Vite 8 + @crxjs + CSS Modules.
- **Storage**: IndexedDB (dict/frequency/word-status) + `chrome.storage.local` (settings, draft, sticky popup size).
- **Theme**: `src/shared/lib/themeTokens.ts` (runtime tokens, ADR-024 boundary).
- **Shared UI**: `src/shared/ui/*` (Button, IconButton, Dialog, BottomSheet, Tabs, Tooltip, Checkbox, Select, SearchableSelect, Alert, Badge, Skeleton, Spinner, EmptyState).
- **Message bus**: `src/shared/config/messages.ts` + `src/entities/message/types.ts` (MV3 fan-out, payload có tabId).
- **Anki**: `src/features/cardCreator/service/ankiConnectClient.ts` (đã có, ADR-026).
- **Translate**: `MESSAGE_TYPES.TRANSLATE` (Google Translate unofficial, ADR-021) — đã có.
- **Network fetch ngoài**: `MESSAGE_TYPES.FETCH_REQUEST`/`FETCH_RESPONSE` (đã có proxy fetch qua background).
- **Không thêm dependency mới** trừ khi ponytail ladder chứng minh cần.

---

## 3. Commands

```
Build:        npm run build
Dev:          npm run dev
Typecheck:    npx tsc --noEmit
Lint:         npm run lint
Unit test:    npm run test:unit          (~3s, không mạng)
Integration:  npm run test:integration   (m3u8 thật + transmux, chậm)
Single proj:  npx jest --selectProjects unit
```

Jest chia 2 project: `unit` (src/**, tests/unit/**) + `integration` (tests/integration/**).

---

## 4. Project Structure (proposed — chưa tạo)

```
src/features/dictionaryPopup/         ← MỚI (core feature)
  types.ts                             ← TypeScript types (logic↔UI boundary)
  schema.ts                            ← Zod schema (runtime validation)
  logic/
    lookupOrchestrator.ts              ← Dictionary match (cụm dài → đơn) + plugin dispatch
    lookupOrchestrator.test.ts
    matchStrategy.ts                   ← Forward maximum matching cho Chinese segmentation
    matchStrategy.test.ts
    priorityResolver.ts                ← "Top item" priority per-language (audio accent, image, translate, definition order)
    priorityResolver.test.ts
  plugins/
    languagePlugin.ts                  ← interface: segment, lemma, possessive, phraseMatch, readingKind, accents
    englishPlugin.ts                   ← EN: whitespace tokenize, lemma (irregular + regular rules), possessive, phrasal/idiom
    englishPlugin.test.ts
    chinesePlugin.ts                   ← ZH: dictionary-driven segmentation, pinyin reading, chengyu idiom
    chinesePlugin.test.ts
    pluginRegistry.ts                  ← registry + fallback "minimal" plugin cho ngôn ngữ chưa implement
  services/
    audioSource.ts                     ← Forvo scrape (background) + chrome.tts + Google TTS fallback
    imageSource.ts                     ← Google Images scrape (background)
    translateSource.ts                 ← reuse MESSAGE_TYPES.TRANSLATE
    externalDictLinks.ts               ← URL template fill, mở tab mới
    wordStatusStore.ts                 ← IndexedDB word status (5 status)
  ui/
    PopupDictionary.tsx                ← container, Shadow DOM mount, auto-position, resize
    PopupHeader.tsx                    ← target + reading + play word + frequency badge + status badge + Quick Add icon + Send to Creator icon
    PopupToolbar.tsx                   ← icon SVG toggle: Audio/Image/Translate/Links/More
    DefinitionsPanel.tsx               ← luôn hiện, checkbox per-definition
    AudioPanel.tsx                     ← PLAY WORD / PLAY SENTENCE groups
    ImagePanel.tsx                     ← horizontal scroll strip, checkmark badge
    TranslatePanel.tsx                 ← target translation + source sentence card
    LinksPanel.tsx                     ← external dict link list
    PopupFooter.tsx                    ← status cycle dropdown
    popupDictionary.module.css
    popupDictionaryIcons.ts            ← SVG icon set (neutral names, không nhắc sản phẩm bên thứ ba)
  index.ts

src/features/cardCreator/ui/           ← RESTYLE (không rebuild logic)
  CardCreatorDialogContent.tsx         ← thêm SRS dropdown (Anki | Cell Memory) trong setting
  CardCreatorSettingsPanel.tsx          ← thêm default popup tab setting + SRS default
  (các file khác giữ nguyên logic, chỉ restyle theo 13 design principles)

src/entities/dictionary/types.ts       ← EXTEND: thêm WordStatus, LookupResult, LookupRequest
src/entities/settings/types.ts         ← EXTEND: thêm DictionaryPopupSettings slice
src/shared/config/messages.ts          ← EXTEND: thêm LOOKUP, FETCH_FORVO, FETCH_IMAGES, TTS_SPEAK, WORD_STATUS_*
src/shared/lib/storage/settingsStore.ts ← EXTEND: persist DictionaryPopupSettings

docs/mockups/popup-dictionary/         ← MỚI (mockup, design-driven-development phase sau)
docs/adr/                              ← MỚI: ADR plugin interface + ADR dictionary-driven segmentation
```

---

## 5. Feature Inventory (mục đích chính của spec này)

### 5.1 ĐANG CÓ (reuse — không rebuild)

| Feature | Vị trí | Trạng thái |
|---|---|---|
| Import 5 format dict → IndexedDB | `features/dictionary/strategies/*` + `logic/importOrchestrator.ts` | ✅ Hoạt động (ADR-023) |
| Dictionary repository (term/prefix/suffix lookup) | `features/dictionary/repositories/dictionaryRepository.ts` | ✅ Có `findDictionaryByTerm`, `findByPrefix`, `findBySuffix` |
| Frequency repository (rank lookup) | `features/dictionary/repositories/frequencyRepository.ts` | ✅ Có `findFrequencyByTerm` |
| Resource management UI (list/delete) | `features/dictionary/ui/ResourcesPanel.tsx` | ✅ Hoạt động |
| IndexedDB base + 3 stores (langResourceInfo, langFrequencyEntry, langDictionaryEntry) | `features/dictionary/repositories/baseRepository.ts` | ✅ Có index `by_term`, `by_resource`, `by_backwardTerm` |
| Card Creator service (AnkiConnect) | `features/cardCreator/service/cardCreatorService.ts` + `ankiConnectClient.ts` | ✅ Hoàn chỉnh (ADR-026) |
| Card Draft state + autosave | `features/cardCreator/state/cardDraft.ts` | ✅ Có `CardFields`, `MediaUpdateMode`, persist config + tags |
| Field mapping (Anki field auto-map) | `features/cardCreator/service/fieldMapping.ts` | ✅ Hoàn chỉnh |
| Media file (image/audio/screenshot) | `features/cardCreator/media/mediaFile.ts` | ✅ Có `MediaFile` |
| Sentence audio capture | `features/cardCreator/media/sentenceAudio.ts` | ✅ Có |
| Screenshot capture | `features/cardCreator/media/screenshot.ts` | ✅ Có |
| Sentence translation (Google Translate unofficial) | `features/cardCreator/media/translation.ts` + `MESSAGE_TYPES.TRANSLATE` | ✅ Có `translateSentence()` (ADR-021) |
| Card Creator UI (Dialog + BottomSheet + PreviewBlock + MediaList + FieldRow) | `features/cardCreator/ui/*` | ✅ Hoạt động, redesign approved mockup `anki-card-mockup.html` |
| Subtitle overlay (target + native, plain text span, user-select) | `features/subtitle/ui/subtitleOverlay.ts` + `subtitleUI.ts` | ✅ Plain text span, `user-select: text`, `pointer-events: auto` — CHƯA token-level click/hover |
| Theme tokens (runtime, light/dark/custom) | `src/shared/lib/themeTokens.ts` + `src/stores/themeStore.ts` | ✅ Hoàn chỉnh (ADR-022, ADR-024) |
| Shared UI components (Button, IconButton, Dialog, BottomSheet, Tabs, Tooltip, Checkbox, Select, SearchableSelect, Alert, Badge, Skeleton, Spinner, EmptyState) | `src/shared/ui/*` | ✅ Đầy đủ |
| Language registry (182 ISO 639-1) | `src/shared/config/languageRegistry.ts` | ✅ Có `LANGUAGES`, `languageMatches()` |
| Settings store (persist + migrate) | `src/shared/lib/storage/settingsStore.ts` + `entities/settings/types.ts` | ✅ Schema versioning, có `CardCreatorSettings` slice |
| MV3 message bus (fan-out + tabId payload) | `src/shared/config/messages.ts` + `entities/message/types.ts` | ✅ Có `FETCH_REQUEST`/`FETCH_RESPONSE` proxy, `TRANSLATE`, `CARD_CREATOR_REQUEST` |
| Background handlers (card creator, translate, fetch proxy) | `src/entrypoints/background/` | ✅ Có |

### 5.2 CẦN BUILD MỚI

| Feature | Mô tả | Priority |
|---|---|---|
| **Popup Dictionary UI** | Container + Shadow DOM mount + auto-position + resize + sticky size | P0 |
| **Popup Header** | Target + reading (IPA/pinyin) + play word + frequency badge + status badge + Quick Add icon + Send to Creator icon | P0 |
| **Popup Toolbar** | SVG icon toggle: Audio/Image/Translate/Links/More | P0 |
| **Definitions Panel** | Luôn hiện, checkbox per-definition, render an toàn | P0 |
| **Audio Panel** | PLAY WORD (Forvo + TTS) / PLAY SENTENCE (TTS) groups, states idle/loading/playing/error | P0 |
| **Image Panel** | Horizontal scroll strip, checkmark badge, lazy load, retry | P0 |
| **Translate Panel** | Target translation + source sentence card, copy button | P0 |
| **Links Panel** | External dict link list, URL template fill, mở tab mới | P0 |
| **Popup Footer** | Status cycle dropdown (5 status) | P0 |
| **Lookup Orchestrator** | Dictionary match (cụm dài → đơn) + plugin dispatch + ≤1s | P0 |
| **Language Plugin Interface** | `segment`, `lemma`, `possessive`, `phraseMatch`, `readingKind`, `accents` | P0 |
| **English Plugin** | Whitespace tokenize + lemma (irregular + regular) + possessive + phrasal/idiom pattern | P0 |
| **Chinese Plugin** | Dictionary-driven segmentation (forward maximum matching) + pinyin reading + chengyu idiom | P0 |
| **Plugin Registry + Fallback** | Registry + "minimal" plugin cho ngôn ngữ chưa implement (chỉ tra từ/cụm) | P0 |
| **Match Strategy** | Forward maximum matching cho Chinese (dictionary-driven, không library) | P0 |
| **Priority Resolver** | "Top item" per-language: audio accent/voice, image, translate, definition order | P0 |
| **Audio Source** | Forvo scrape (background) + chrome.tts + Google TTS fallback | P0 |
| **Image Source** | Google Images scrape (background) | P0 |
| **External Dict Links** | URL template fill, mở tab mới | P0 |
| **Word Status Store** | IndexedDB 5 status (unknown/known/tracking/learning/ignore) | P0 |
| **Token-level subtitle overlay** | Wrap subtitle text span thành token spans (per-word cho EN, per-segment cho ZH) + click/hover trigger | P0 |
| **Web text lookup trigger** | Bôi đen text trên web + phím / hover text thường (auto-detect sentence từ DOM) | P1 |
| **Quick Add 3 mode** | Manual tick / quick / hybrid — gửi Anki qua cardCreatorService | P0 |
| **Send to Creator** | Mở Card Creator workspace two-pane (lookup pane + creator pane) | P1 |
| **Default popup tab global sticky** | Setting + persist + apply mọi popup mới | P0 |
| **Trigger mode setting** | click | hover | hover + modifier (Ctrl/Shift/Alt) | P0 |
| **SRS dropdown trong Card Creator setting** | Anki | Cell Memory (stub), set default | P0 |
| **Card Creator restyle** | Theo 13 design principles (header #4, SVG mọi nút, SRS dropdown, status footer) | P1 |
| **ADR plugin interface** | Architecture decision record | P0 |
| **ADR dictionary-driven segmentation** | Architecture decision record | P0 |

### 5.3 OUT OF SCOPE (đợt này)

- Click từ trong sentence để tra tiếp (recursive lookup) — confirmed out of scope ở interview.
- SRS scheduler engine Cell Memory (SM-2 hoặc tương tự) — chỉ status store, scheduler sau.
- Plugin ngôn ngữ ngoài EN/ZH — architecture sẵn sàng, chưa implement.
- Bundle dict data vào extension — user tự import.
- AI/LLM panel (UC03.4 gốc có AI 30 lần/ngày) — không có trong intent, bỏ.
- Auto popup khi video pause (UC03.4 gốc) — không có trong intent, bỏ.
- Quota 625 cards (UC09.2 gốc) — không có trong intent, bỏ.
- WebLLM/Ollama (UC03.4 gốc) — không có trong intent, bỏ.

---

## 6. Code Style

Function component + hooks, không class component. Named export, không default export. TypeScript strict, không `any` không lý do. Colocate test: `Button.tsx` → `Button.test.tsx`. Logic tách hàm thuần, dễ test, không side effect. CSS Modules + theme tokens (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--z-*`), không hex/raw value. Content-script isolated world: px-based tokens, không rem. Không nhắc "OCEAN"/"Yomitan"/sản phẩm bên thứ ba trong code/comment/tên biến — tên neutral (`phraseMatcher`, `lemmaResolver`, `possessiveNormalizer`, `languagePlugin`).

Ví dụ plugin interface (idiomatic Cell):

```typescript
// src/features/dictionaryPopup/plugins/languagePlugin.ts
export interface LanguagePlugin {
  readonly langCode: string;                    // ISO 639-1, vd 'en', 'zh'
  readonly readingKind: 'ipa' | 'pinyin' | 'none';
  /** Tokenize sentence thành tokens (word boundaries). */
  tokenize(sentence: string): readonly Token[];
  /** Segment text không space (Chinese) — dictionary-driven forward max matching. */
  segment?(text: string, dict: TermProbe): readonly Token[];
  /** Lemmatize (was → be, handed → hand). */
  lemma?(word: string): string;
  /** Normalize possessive (my/your/his/her/its/our/their/one's → placeholder). */
  normalizePossessive?(text: string): string;
  /** Match phrasal verb / idiom trong context sentence. */
  matchPhrase?(target: string, lemma: string, context: string): PhraseMatch | null;
  /** Accent/voice priority cho audio. */
  accents: readonly Accent[];
}

export interface Token { readonly text: string; readonly start: number; readonly end: number; }
export interface PhraseMatch { readonly phrase: string; readonly confidence: number; }
export interface Accent { readonly id: string; readonly label: string; }
export interface TermProbe { hasTerm(term: string): boolean; }
```

---

## 7. Testing Strategy

- **Framework**: Jest (đã có, 2 project unit/integration).
- **Location**: colocate `*.test.ts` cạnh source. Integration ở `tests/integration/`.
- **Coverage expectations**:
  - `lookupOrchestrator` — dictionary match (cụm dài → đơn), plugin dispatch, ≤1s benchmark với dict ~120k entries (CEDICT) + ~100k (Cambridge).
  - `matchStrategy` — forward maximum matching, edge case (overlap, dict miss, single char).
  - `englishPlugin` — lemma (irregular + regular), possessive normalization, phrasal/idiom pattern.
  - `chinesePlugin` — segmentation (我喜欢你 → 我/喜欢/你), pinyin reading, chengyu.
  - `priorityResolver` — top item per-language (EN: Forvo US > UK > TTS; ZH: Mandarin native > TTS).
  - `audioSource` — Forvo scrape parse, TTS fallback, error state.
  - `imageSource` — Google Images scrape regex, filter gstatic/encrypted.
  - `wordStatusStore` — 5 status CRUD, persist IndexedDB.
  - UI: render popup, auto-position, resize, lazy load panel, Quick Add 3 mode — `@testing-library/react`.
- **Test levels**:
  - Unit (logic thuần): lookup, match, lemma, possessive, priority, status store.
  - Component (UI): popup render, panel toggle, checkbox, status cycle.
  - Integration (chậm): IndexedDB thật + dict import thật + lookup ≤1s benchmark.
- **Ponytail check**: thuật toán segmentation + lookup để lại 1 runnable self-check (benchmark file) verify ≤1s trên dict ~120k entries.

---

## 8. Boundaries

**Always do**:
- Run `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` trước commit.
- Colocate test, named export, function component + hooks.
- Dùng theme tokens, không hex/raw value.
- Validate data ở boundary (IndexedDB, network, MV3 message) bằng Zod schema.
- Cite Chrome API docs https://developer.chrome.com/docs/extensions/reference/ khi dùng Chrome API.
- Update `docs/2-architechture-system.md` khi add/remove/rename `src/` file.
- Update `docs/0-wiki.md` khi add/remove/rename `docs/` file.

**Ask first**:
- Thêm dependency mới (check bundle size trước, prefer version ≥7 ngày tuổi).
- Đổi `manifest.json` (phải test Chrome thật).
- Đổi schema `chrome.storage` (migration).
- Đổi `MESSAGE_TYPES` (fan-out impact).
- Quyết định architecture (→ ADR).

**Never do**:
- Commit secrets/keys.
- Nhắc "OCEAN"/"Yomitan"/sản phẩm bên thứ ba trong code/comment/tên biến/docs.
- Hardcode `preferredAccent` US/UK (per-language config).
- Bundle dict data vào extension (user tự import).
- Thêm library segmentation ngoài (dictionary-driven, ponytail).
- Scan toàn trang tự động (trigger chủ động tránh popup nhảy + nặng RAM).
- Implement SRS scheduler đợt này (chỉ status store).
- Implement recursive click-đệ-quy trong sentence đợt này.

---

## 9. Data Contract

### 9.1 TypeScript types (`src/features/dictionaryPopup/types.ts`)

```typescript
// Logic output → UI input
export type ReadingKind = 'ipa' | 'pinyin' | 'none';
export type WordStatus = 'unknown' | 'known' | 'tracking' | 'learning' | 'ignore';
export type TriggerMode = 'click' | 'hover' | 'hover-ctrl' | 'hover-shift' | 'hover-alt';
export type PopupPanel = 'dictionary' | 'audio' | 'image' | 'translate' | 'links';
export type SrsDestination = 'anki' | 'cell-memory';
export type AudioSourceKind = 'forvo' | 'tts' | 'google-tts';
export type AudioKind = 'word' | 'sentence';
export type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable' | 'error';

export interface LookupRequest {
  readonly term: string;
  readonly langCode: string;
  readonly contextSentence: string;
  readonly cursorOffset: number;          // vị trí token trong sentence
  readonly fallback?: boolean;            // true khi user bôi đen text
}

export interface LookupResult {
  readonly term: string;
  readonly langCode: string;
  readonly reading: string;
  readonly readingKind: ReadingKind;
  readonly frequency: { rank: number; source: string } | null;
  readonly status: WordStatus;
  readonly partsOfSpeech: readonly string[];
  readonly definitions: readonly DefinitionEntry[];
  readonly detectedPhrase: { phrase: string; confidence: number } | null;
  readonly matchSource: 'dictionary' | 'plugin' | 'fallback';
}

export interface DefinitionEntry {
  readonly id: string;
  readonly pos?: string;
  readonly text: string;
  readonly examples: readonly string[];
  readonly source: string;                // 'Cambridge', 'CC-CEDICT', ...
  readonly selected: boolean;             // default true
}

export interface AudioItem {
  readonly id: string;
  readonly kind: AudioKind;
  readonly source: AudioSourceKind;
  readonly label: string;                 // 'Forvo · US native', 'System TTS · Female'
  readonly accentId?: string;
  readonly state: AudioState;
  readonly url?: string;
}

export interface ImageItem {
  readonly id: string;
  readonly alt: string;
  readonly src: string;
  readonly selected: boolean;
}

export interface ExternalDictLink {
  readonly id: string;
  readonly name: string;
  readonly url: string;                   // đã fill {term}/{lang}
}

export interface QuickAddPayload {
  readonly term: string;
  readonly langCode: string;
  readonly definitions: readonly DefinitionEntry[];   // đã filter theo mode
  readonly audios: readonly AudioItem[];
  readonly images: readonly ImageItem[];
  readonly translation: string;
  readonly sentence: string;
  readonly status: WordStatus;
  readonly destination: SrsDestination;
  readonly mode: 'manual' | 'quick' | 'hybrid';
}
```

### 9.2 Zod schema (`src/features/dictionaryPopup/schema.ts`)

```typescript
import { z } from 'zod';

export const LookupRequestSchema = z.object({
  term: z.string().min(1).max(200),
  langCode: z.string().length(2),
  contextSentence: z.string().max(2000),
  cursorOffset: z.number().int().min(0),
  fallback: z.boolean().optional(),
});

export const LookupResultSchema = z.object({
  term: z.string(),
  langCode: z.string().length(2),
  reading: z.string(),
  readingKind: z.enum(['ipa', 'pinyin', 'none']),
  frequency: z.object({ rank: z.number().int(), source: z.string() }).nullable(),
  status: z.enum(['unknown', 'known', 'tracking', 'learning', 'ignore']),
  partsOfSpeech: z.array(z.string()),
  definitions: z.array(z.object({
    id: z.string(),
    pos: z.string().optional(),
    text: z.string(),
    examples: z.array(z.string()),
    source: z.string(),
    selected: z.boolean(),
  })),
  detectedPhrase: z.object({
    phrase: z.string(),
    confidence: z.number().min(0).max(1),
  }).nullable(),
  matchSource: z.enum(['dictionary', 'plugin', 'fallback']),
});

export const QuickAddPayloadSchema = z.object({
  term: z.string(),
  langCode: z.string().length(2),
  definitions: z.array(z.object({
    id: z.string(), pos: z.string().optional(), text: z.string(),
    examples: z.array(z.string()), source: z.string(), selected: z.boolean(),
  })),
  audios: z.array(z.object({
    id: z.string(), kind: z.enum(['word', 'sentence']),
    source: z.enum(['forvo', 'tts', 'google-tts']),
    label: z.string(), accentId: z.string().optional(),
    state: z.enum(['idle', 'loading', 'playing', 'paused', 'unavailable', 'error']),
    url: z.string().optional(),
  })),
  images: z.array(z.object({
    id: z.string(), alt: z.string(), src: z.string(), selected: z.boolean(),
  })),
  translation: z.string(),
  sentence: z.string(),
  status: z.enum(['unknown', 'known', 'tracking', 'learning', 'ignore']),
  destination: z.enum(['anki', 'cell-memory']),
  mode: z.enum(['manual', 'quick', 'hybrid']),
});
```

### 9.3 Settings extension (`src/entities/settings/types.ts`)

```typescript
export interface DictionaryPopupSettings {
  readonly triggerMode: TriggerMode;                  // default 'click'
  readonly hoverDelayMs: number;                      // default 300 (chỉ dùng khi mode='hover')
  readonly defaultPanel: PopupPanel;                  // default 'dictionary' (global sticky)
  readonly defaultPanelPerLang?: Record<string, PopupPanel>;  // override per-language (OPEN QUESTION)
  readonly srsDestination: SrsDestination;            // default 'anki'
  readonly popupWidthPx: number;                      // sticky size, default 560
  readonly popupMaxHeightPx: number;                  // default 70vh-equivalent
  readonly translateTargetLang: string;               // ISO 639-1, default 'vi'
  readonly externalDictLinks: readonly ExternalDictLinkTemplate[];
}

export interface ExternalDictLinkTemplate {
  readonly id: string;
  readonly name: string;
  readonly urlTemplate: string;                       // chứa {term} và {lang}
  readonly langCodes: readonly string[];              // ngôn ngữ áp dụng
}
```

### 9.4 Message types extension (`src/shared/config/messages.ts`)

```typescript
// Thêm vào MESSAGE_TYPES:
LOOKUP: 'LOOKUP',
LOOKUP_RESULT: 'LOOKUP_RESULT',
FETCH_FORVO: 'FETCH_FORVO',
FETCH_IMAGES: 'FETCH_IMAGES',
TTS_SPEAK: 'TTS_SPEAK',
WORD_STATUS_GET: 'WORD_STATUS_GET',
WORD_STATUS_SET: 'WORD_STATUS_SET',
QUICK_ADD: 'QUICK_ADD',
```

---

## 10. Success Criteria (testable)

- [ ] `npm run test:unit` pass cho `dictionaryPopup` module (lookup, match, lemma, possessive, priority, status store, audio/image source parse).
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run lint` clean.
- [ ] Benchmark `lookupOrchestrator` ≤1s với dict ~120k entries (CEDICT) + ~100k (Cambridge) trên RAM 4GB (runnable self-check file).
- [ ] Popup render trong Shadow DOM, không bị CSS trang web phá, auto-position tránh overflow, resize kéo góc, sticky size persist.
- [ ] EN lookup: hover "was" trong "The answer was right under my nose" → detect "be under your nose" (cụm) qua plugin phraseMatch + possessive normalize.
- [ ] ZH lookup: click 喜 trong 我喜欢你 → highlight 喜欢 (dictionary-driven segmentation), tra "喜欢" không tra "喜".
- [ ] Definitions luôn hiện, mỗi definition có checkbox, default all selected.
- [ ] Audio/Image/Translate/Links panel toggle từ toolbar, lazy load (chỉ fetch khi mở), preserve state khi toggle lại.
- [ ] Quick Add 3 mode: manual (gửi item đã tick), quick (definition all + top item khác), hybrid (tick + top item cho phần thiếu).
- [ ] Word status 5 giá trị ở footer, persist IndexedDB.
- [ ] Default popup tab global sticky, persist `chrome.storage.local`.
- [ ] Trigger mode setting (click/hover/modifier), persist.
- [ ] Card Creator setting có SRS dropdown (Anki | Cell Memory), set default.
- [ ] Card Creator restyle theo 13 design principles (header #4, SVG mọi nút, status footer).
- [ ] Không có string "OCEAN"/"Yomitan"/sản phẩm bên thứ ba trong `src/` + `docs/`.
- [ ] Browser verify (Edge/Chrome thật qua MCP edge-devtools): popup render dark/light, EN+ZH lookup, panel toggle, Quick Add toast, mobile 375px không overflow.

---

## 11. Decisions (confirmed 2026-07-13)

### D1 — Word status set: 5 status

`unknown → known → tracking → learning → ignore`. `ignore` cho từ không ý nghĩa trong ngôn ngữ đang học. `unknown` đúng ngữ cảnh học hơn `New`.

### D2 — Default popup tab: hybrid

Global default (`DictionaryPopupSettings.defaultPanel`) áp dụng mọi popup mới + per-language override (`defaultPanelPerLang`) nếu user set. User pin tab 1 lần → sticky persist `chrome.storage.local`.

### D3 — Plugin MVP scope: dictionary match + segmentation trước, plugin đầy đủ sau

MVP chỉ dictionary match (cụm dài → đơn) + Chinese dictionary-driven segmentation (forward maximum matching). Plugin interface thiết kế sẵn (interface + registry + fallback minimal), implement đầy đủ EN+ZH (lemma + possessive + phrasal/idiom) ở phase sau. Intent "EN+ZH đầy đủ" = mục tiêu dài hạn, MVP cần chạy ≤1s trước.

### D4 — Thuật toán auto-detect: mockup trước, thuật toán sau ở plan/ADR

UI không phụ thuộc thuật toán match chi tiết. Mockup trước, thuật toán match strategy chi tiết viết ở plan/ADR phase sau khi đọc Cambridge/Eng-Vi/CEDICT entry structure thực.

### D5 — Card Creator restyle: sau popup dictionary

Popup dictionary build trước (core, chưa có). Card Creator restyle sau (đã có, ít rủi ro, chỉ restyle theo 13 design principles + thêm SRS dropdown).

### D6 — Web text lookup: MVP subtitle overlay trước, web text P1

MVP subtitle overlay lookup (core value khi xem video). Web text lookup (bôi đen + hover text thường) P1 ngay sau — cùng architecture, chỉ khác trigger source + auto-detect sentence từ DOM.

---

## 12. Next

1. ✅ **Decisions D1–D6 confirmed** (2026-07-13).
2. **design-driven-development** → mockup popup dictionary (MVP scope: dictionary match + segmentation, 5 status, hybrid default tab, subtitle overlay trigger). Card Creator restyle mockup sau.
3. **Plan** (`planning-and-task-breakdown`) → task breakdown theo priority P0/P1.
4. **ADR** plugin interface + dictionary-driven segmentation + thuật toán auto-detect cụm/đơn chi tiết (sau khi đọc dict data thực).
5. **Implement** theo plan, verify từng task.
