# Spec: Popup Dictionary tích hợp Cell

> **Phase**: G1 (spec, trước design-driven-development).
> **Intent**: `docs/intent/intent-popup-dictionary.md` (confirmed via interview-me, 18 câu).
> **Prototype handoff (reference, không phải production)**: `docs/specs/design/dictionary-popup-prototype-handoff.md`.
> **UC gốc (reference, không phải source of truth)**: `docs/specs/design/UC/UC03_doc_trang_web/UC03.4_word_popup.md`, `UC09_tao_flashcard/UC09.2_quick_add_flashcard.md`.
> **ADRs liên quan**: ADR-021 (translate background), ADR-023 (dictionary import IndexedDB), ADR-024 (theme boundary), ADR-026 (card creator Anki).

Mục đích spec này: **inventory tính năng đang có vs cần build mới** để design-driven-development có baseline rõ ràng trước khi làm mockup.

---

## 1. Objective

**Problem**: Cell đã có `features/dictionary` (import 5 format → IndexedDB) + `features/cardCreator` (AnkiConnect) nhưng chưa wire dict vào lookup. User phải dùng extension tra từ bên thứ ba + copy-paste thủ công sang Card Creator → workflow rời rạc, chậm. Core value Cell = tra từ + tạo thẻ trong 1 flow.

Xây **Popup Dictionary tích hợp Cell** — tra từ/cụm từ mọi nơi có text (subtitle overlay + bôi đen/hover text web), hiển thị definition + IPA/pinyin + frequency + các panel nguyên liệu (audio/image/translate/external dict), tick chọn nguyên liệu + Quick Add hoặc Send to Creator → Anki/Cell Memory. Thay thế hoàn toàn extension tra từ bên thứ ba.

**User**: Người học ngôn ngữ qua video (English + Chinese đợt này) trên Chromium desktop/tablet/mobile, RAM 4GB.

**Success (testable)**:
- Tra cứu ≤1s (trigger → popup hiện nội dung local: target + reading + frequency + definitions).
- Lazy load tab-switch: panel ngoài (audio/image/translate/links) chỉ fetch khi user mở panel đó.
- Auto-detect cụm/đơn: dictionary match (cụm dài ưu tiên) + plugin ngôn ngữ bổ trợ (lemma, possessive, phrasal/idiom — EN+ZH đầy đủ).
- Popup resize + auto-position (tránh overflow màn hình, sticky size).
- 4 word status ở footer: unknown → tracking → known → ignore (vòng tròn, ignore quay lại unknown).
- Quick Add: 1 nút, user tick item → hệ thống tôn trọng Card Creator auto-complete settings (field mapping + per-field toggle + fallback). Nếu field auto-complete on thì fill (với fallback), nếu off thì chỉ fill item user đã tick.
- English + Chinese plugin đầy đủ; architecture plugin interface clean cho mở rộng.
- Default popup tab global sticky (user pin 1 lần, áp dụng mọi popup sau).
- Trigger mode setting: click | hover | hover + modifier (Ctrl/Shift/Alt).
- Không nhắc tên sản phẩm bên thứ ba trong codebase/comment/tên biến.

### 13 design principles (áp dụng xuyên suốt — từ intent interview)

1. Dictionary luôn luôn hiện (không phải tab, là phần core ảnh #1).
2. Tab: audio, image, translate, dictionary external.
3. Popup dictionary: bỏ inflections, bỏ MATERIALS TO INCLUDE, bỏ SENTENCE CONTEXT trong tab dictionary.
4. Tab image redesign (tham chiếu #1, #3).
5. Popup dictionary: bỏ nút X (thoát), thay bằng nút Quick Add. Dismiss popup = Esc + click outside popup (không click inside). Scroll/play video không dismiss tự động.
6. Tab translate redesign theo bố cục #7.
7. Mỗi definition có thể tick chọn để add vào SRS (gửi tới fields quy định).
8. Quick Add thay bằng SVG.
9. SRS lựa chọn Anki (MVP), set default tab trong setting Card Creator.
10. Mọi tab/nút thiết kế SVG (tiết kiệm không gian, không chói mắt), button style tham chiếu #9.
11. Popup resize function + auto-position (biên trái/phải/trên/dưới) + icon resize.
12. Status unknown → tracking → known → ignore (vòng tròn, ignore quay lại unknown) — ở footer popup dictionary. Bỏ `learning` (MVP). Phát triển scheduler sau, UI sẵn sàng.
13. Card Creator layout: header title "Card Creator" + settings/close, subheader card type + deck, large preview card (target word + sentence), field cards with action + clear, media cards with ADD/SEARCH, footer CLEAR FIELDS + CREATE CARD.

---

## 2. Tech Stack

- **Runtime**: Chrome Extension MV3, content-script isolated world + Shadow DOM cho popup.
- **Lookup worker**: Web Worker off-main-thread host `lookupOrchestrator` + `matchStrategy` + in-memory LRU cache (**max 10k entries**). **Hydrate path (cross-browser)**: background script đọc IndexedDB → **postMessage chunking** (Transferable) → worker. **Pre-hydrate top 10k** frequency (rank cao nhất) khi extension startup (install / reload / browser start) — không pre-hydrate lúc mở popup. **Lookup hit** trong LRU ≤1s; **lookup miss** (ngoài top 10k) → background IndexedDB query → worker add vào LRU (~10–50ms, loading ngắn). **Eviction**: pure LRU (least-recently-used) khi >10k. Content script `LOOKUP` envelope `{ requestId, payload }` → worker → `LOOKUP_RESULT` (tách khỏi MV3 `MESSAGE_TYPES` fan-out; scrape/Anki/status qua background messages có `tabId`).
- **UI**: React 19 + Zustand 5 + TypeScript 6 + Vite 8 + @crxjs + CSS Modules.
- **Validation**: Zod 4.4.3 (đã có trong package.json) — runtime validation cho LookupRequest/LookupResult/QuickAddPayload.
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
  worker/
    lookupWorker.ts                    ← Web Worker host: lookupOrchestrator + matchStrategy + LRU cache, postMessage round-trip
    lookupWorker.test.ts               ← worker postMessage round-trip + ≤1s benchmark
  logic/
    lookupOrchestrator.ts              ← Dictionary match (cụm dài → đơn) + plugin dispatch
    lookupOrchestrator.test.ts
    matchStrategy.ts                   ← Forward maximum matching cho Chinese segmentation
    matchStrategy.test.ts
    phraseTemplateParser.ts            ← ADR-037: Cambridge term → bounded AST + validation
    phraseTemplateParser.test.ts       ← optional/slash/slot/open-pattern parser tests
    phraseTemplateParser.fixture.test.ts ← compile all normalized Cambridge multiword terms
    phraseIndexCompiler.ts             ← ADR-037 §7: anchor inverted index + compact binary blob
    phraseIndexCompiler.test.ts        ← anchor selection + serialize/deserialize round-trip + fixture budget
    phraseMatcher.ts                   ← ADR-037 §8-9: bounded DP matcher + deterministic ranking
    phraseMatcher.test.ts              ← P01-P33 positive + N01-N12 negative + ranking tests
    phraseMatchService.ts              ← ADR-037 §8.3 steps 10-11: phrase match + word fallback + AbortSignal
    phraseMatchService.test.ts         ← service integration: phrase → definition, fallback, cancellation
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
    wordStatusStore.ts                 ← IndexedDB word status (4 status cycle)
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
  CardCreatorDialogContent.tsx         ← thêm SRS dropdown (Anki only MVP) trong setting
  CardCreatorSettingsPanel.tsx          ← thêm default popup tab setting + SRS default + 6 auto-complete toggles + audio fallback select
  (các file khác giữ nguyên logic, chỉ restyle theo 13 design principles)

src/entities/dictionary/types.ts       ← EXTEND: thêm WordStatus, LookupResult, LookupRequest
src/entities/settings/types.ts         ← EXTEND: thêm DictionaryPopupSettings slice
src/shared/config/messages.ts          ← EXTEND: thêm LOOKUP, FETCH_FORVO, FETCH_IMAGES, TTS_SPEAK, WORD_STATUS_*
src/shared/lib/storage/settingsStore.ts ← EXTEND: persist DictionaryPopupSettings

docs/mockups/popup-dictionary/         ← MỚI (mockup, design-driven-development phase sau)
docs/adr/                              ← MỚI: ADR plugin interface + ADR dictionary-driven segmentation
```

---

## 4.5 User Stories

1. **As** người học tiếng Anh qua video, **I want** hover/click từ trong phụ đề → popup hiện nghĩa + IPA + frequency ngay ≤1s, **so that** tra từ không gián đoạn xem video.
2. **As** người học tiếng Trung qua video, **I want** click 1 chữ Hán → popup tự nhận từ ghép (vd 喜欢 thay vì 喜), **so that** tra đúng nghĩa trong context.
3. **As** người học ngôn ngữ, **I want** tick chọn definition + audio + image rồi bấm Quick Add → thẻ vào Anki 1 bước, **so that** rút ngắn workflow tạo thẻ.
4. **As** người học ngôn ngữ, **I want** set default tab popup 1 lần + áp dụng mọi popup sau, **so that** không phải mở lại tab mình muốn mỗi lần tra.
5. **As** người học ngôn ngữ, **I want** cycle word status (unknown → tracking → known → ignore) ở footer popup, **so that** theo dõi tiến độ học từ.

---

## 4.6 User Journey

> **Mục đích section**: bổ sung **how** (thứ tự màn + hành động + data I/O) sau user stories (who/what/why). Text thuần, không icon, không diagram tool. QA có thể viết checklist E2E từ journey.
>
> **Scope journey**: P0 (subtitle overlay + EN/ZH plugin đầy đủ + Quick Add Anki). P1 (web text lookup, Send to Creator, Card Creator restyle) ghi riêng ở cuối section.

### 4.6.1 Bản đồ màn hình (P0)

| Màn | Người dùng thấy gì | Kích hoạt khi nào |
|---|---|---|
| **M0 Settings → Resources** | Danh sách resource dict/frequency, nút import | Lần đầu setup hoặc chưa có dict |
| **M1 Settings → Dictionary Popup** | Trigger mode (click/hover/modifier), default active tab, sticky size, translate target lang, external dict templates, SRS default (Anki only MVP). **Không** có hover-delay setting (debounce internal) | User chỉnh preference |
| **M2 Video page + Subtitle overlay** | Video + dòng phụ đề đã token-wrap (EN per-word, ZH per-segment) | User xem video, extension bật |
| **M3 Popup Dictionary** | Header (target + reading + play + frequency + status badge + Quick Add + Send to Creator) + Definitions (luôn hiện) + Toolbar tab ngoài (Audio / Image / Translate / Links) + Footer status | Sau LOOKUP_RESULT ≤1s |
| **M3a–d Panel lazy** | Audio / Image / Translate / Links (loading → content hoặc error + retry) | User mở tab (hoặc `defaultActiveTab` ≠ null) |
| **M4 Toast / Ack** | Success hoặc error sau Quick Add | Sau `QUICK_ADD` |

**Không thuộc journey P0**: full Card Creator workspace two-pane (Send to Creator = P1, chỉ mở/pre-fill nếu implement; MVP Happy Path kết thúc ở Quick Add → Anki).

### 4.6.2 Data I/O theo màn

| Bước | Màn | Data input (user / system) | Data output / persist |
|---|---|---|---|
| Setup | M0 | File dict (5 format), lang code | IndexedDB: langDictionaryEntry, langFrequencyEntry, langResourceInfo |
| Preference | M1 | triggerMode, defaultActiveTab, popupWidthPx/popupMaxHeightPx, translateTargetLang | `chrome.storage.local` → `DictionaryPopupSettings` (+ migration schema v13→v14). Debounce internal 150ms hover / 50ms click (không setting) |
| Trigger | M2 | click/hover token (+ modifier nếu hover-ctrl/shift/alt); debounce 150/50 | Worker envelope `LOOKUP` { requestId, payload: LookupRequest }; BG messages có tabId khi cần |
| Lookup | Worker (off UI) | LOOKUP + TermProbe (top-10k LRU; miss → BG IndexedDB) | `LOOKUP_RESULT` / LookupResult ≤1s hit; miss ~10–50ms; cancel `LOOKUP_CANCEL` |
| Popup core | M3 | LookupResult | UI: target, reading, frequency, definitions (selected default true), status |
| Panel ngoài | M3a–d | User open tab | FETCH community audio / images / TRANSLATE / URL fill links (lazy) |
| Status | M3 footer | Cycle unknown → tracking → known → ignore (vòng) | `WORD_STATUS_SET` → IndexedDB word status |
| Quick Add | M3 → M4 | selection (tick) + Card Creator auto-complete settings (field mapping + per-field toggle + fallback) | `QUICK_ADD` → deck/noteType/mapping từ Card Creator draft/settings → AnkiConnect; toast success/error |

### 4.6.3 Journey A — Happy path English (core value)

**Persona**: Minh, học EN qua series, RAM 4GB, Chromium desktop.  
**Goal**: Tra 1 từ/cụm khi xem video, tạo thẻ Anki trong 1 flow.  
**Tiên quyết**: Đã import Cambridge (+ frequency) ở M0; Anki + AnkiConnect đang chạy; `dictionaryPopupEnabled` = true.

| # | Màn | Hành động user | Hệ thống | Input | Output |
|---|---|---|---|---|---|
| A0 | M0 | (lần đầu) import dict EN | Parse 5 format → IndexedDB | file dict | dict sẵn sàng |
| A1 | M2 | Mở video có phụ đề EN | Subtitle overlay token-wrap per-word | subtitle text | token spans click/hover |
| A2 | M2 | Hover/click token trong "The answer **was** right under my nose" (mode click/hover theo M1) | Debounce 150ms hover / 50ms click; gửi LOOKUP | term=`was`, sentence full, offset | requestId in-flight |
| A3 | Worker | — | EN plugin: tokenize by offset, match Cambridge template `be (right) under your nose` (lemma `was→be`, optional `right`, possessive slot); otherwise normal dictionary fallback | LOOKUP | LookupResult (definitions, reading IPA, frequency, detectedPhrase?, status) |
| A4 | M3 | Thấy popup ≤1s, Shadow DOM, auto-position, sticky size | Render header + Definitions (không phải tab) | LookupResult | UI definitions checkbox all selected |
| A5 | M3a | Mở tab Audio (hoặc defaultActiveTab=`audio`) | Lazy FETCH community audio + system/cloud TTS fallback | term + accents | AudioItem[] (top selected theo priorityResolver) |
| A6 | M3b | (tuỳ chọn) mở Image | Lazy image scrape | term | ImageItem[] |
| A7 | M3c | (tuỳ chọn) mở Translate | TRANSLATE target + sentence | term, sentence, translateTargetLang | translation string |
| A8 | M3 | Bỏ tick definition không cần; tick/untick audio/image | Local selection state | click checkbox | selected flags |
| A9 | M3 footer | Cycle status unknown → tracking → known → ignore (vòng tròn) | WORD_STATUS_SET | status | IndexedDB persist |
| A10 | M3 | Bấm Quick Add (1 nút) | Build QuickAddPayload, destination=`anki` only; tôn trọng Card Creator auto-complete settings (field mapping + per-field toggle + fallback) | selection | QUICK_ADD |
| A11 | M4 | Thấy toast thành công | AnkiConnect add note + media (fetch binary khi Quick Add, fetch fail → toast error, item bỏ qua) | QuickAddPayload | card trong deck Anki |

**Tính năng chạm (A)**: token subtitle, trigger mode, lookupOrchestrator + englishPlugin, Popup Dictionary UI, lazy panels, word status, priorityResolver, Quick Add (tôn trọng Card Creator auto-complete), Anki (reuse cardCreator).

### 4.6.4 Journey B — Happy path Chinese (segmentation)

**Persona**: Lan, học ZH, click 1 chữ trong phụ đề.  
**Goal**: Tra đúng từ ghép, không tra nhầm 1 ký tự.

| # | Màn | Hành động user | Hệ thống | Input | Output |
|---|---|---|---|---|---|
| B1 | M2 | Phụ đề "我喜欢你", click **喜** | Token wrap per-segment ZH (FMM dictionary-driven) | char offset | segment span **喜欢** highlight |
| B2 | Worker | — | chinesePlugin segment + pinyin + optional chengyu | LOOKUP term=`喜欢` | LookupResult reading=pinyin, definitions CEDICT |
| B3 | M3 | Đọc nghĩa + pinyin | Definitions luôn hiện | LookupResult | UI |
| B4 | M3 | Quick Add (1 nút) | Build QuickAddPayload, tôn trọng Card Creator auto-complete settings | selection | Anki card |

**Tính năng chạm (B)**: matchStrategy FMM, chinesePlugin, token-level ZH, Popup, Quick Add.

### 4.6.5 Journey C — Pin default tab (sticky)

| # | Màn | Hành động | Hệ thống | I/O |
|---|---|---|---|---|
| C1 | M3 | Mở tab Translate, “pin làm mặc định” (setting trong Card Creator / Dictionary Popup settings — single source: `DictionaryPopupSettings.defaultActiveTab`) | Persist | `defaultActiveTab: 'translate'` |
| C2 | M2→M3 | Tra từ mới | Popup mở lại với Translate tab active sẵn (dictionary vẫn luôn hiện) | settings read | M3 + M3c open |

### 4.6.6 Journey D — Empty dict (failure path nghiệp vụ)

| # | Màn | Hành động | Hệ thống | Output |
|---|---|---|---|---|
| D1 | M2 | User trigger token, **chưa import dict** lang | LOOKUP → empty / no resource | M3 empty state: hướng dẫn mở M0 Resources import; không spinner vô tận |
| D2 | M0 | User import dict | IndexedDB fill | A-path khả dụng lại |

### 4.6.7 Journey E — Anki offline / scrape fail (failure path kỹ thuật)

| # | Màn | Hành động | Hệ thống | Output |
|---|---|---|---|---|
| E1 | M3→M4 | Quick Add khi Anki tắt | AnkiConnect fail | Toast "Anki chưa chạy"; payload giữ local để retry |
| E2 | M3a | Community audio 403/timeout | Retry backoff 1s/2s/4s max 3; fallback system-tts | Audio state error hoặc fallback playing |
| E3 | M3b | Image scrape fail | Error + retry; không block Definitions | Image empty/error |
| E4 | M2 | Hover liên tục nhiều token | Debounce + LOOKUP_CANCEL in-flight | Không flicker / không request chồng |

### 4.6.8 Journey P1 (ngoài MVP — không block G1 mockup core)

| Journey | Màn thêm | Ghi chú |
|---|---|---|
| Web text | Trang web thường + selection/hover | Cùng LOOKUP pipeline; khác trigger + auto-detect sentence DOM |
| Send to Creator | M3 → Card Creator two-pane | Pre-fill draft từ LookupResult + selection; restyle Card Creator theo 13 principles sau |
| Cell Memory destination | — | Out of MVP; thêm lại khi scheduler ready |

### 4.6.9 Flow tóm tắt (text)

```
[M0 import dict] ──optional setup──▶ [M1 preferences]
        │
        ▼
[M2 video + token subtitle] ──trigger──▶ LOOKUP ──worker──▶ LOOKUP_RESULT ≤1s
        │
        ▼
[M3 popup: Definitions always + header + footer]
        ├── open Audio/Image/Translate/Links (lazy)
        ├── set WordStatus
        └── Quick Add (1 nút; tôn trọng Card Creator auto-complete) ──anki──▶ [M4 toast]
```

### 4.6.10 Checklist design / mockup từ journey

Mockup P0 phải cover tối thiểu:
- M2 token subtitle EN + ZH
- M3 layout: dictionary luôn hiện, 4 tab ngoài, footer 4 status cycle, Quick Add (không nút X; dismiss Esc + click outside)
- M3 empty (D), M3a/b error+retry (E)
- M1 settings fields gắn `DictionaryPopupSettings`
- Không vẽ full Card Creator restyle trong cùng mockup MVP (P1)

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
| **Popup Footer** | Status cycle (4 status, vòng) | P0 |
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
| **Word Status Store** | IndexedDB 4 status (unknown/tracking/known/ignore), cycle footer | P0 |
| **Token-level subtitle overlay** | Wrap subtitle text span thành token spans (per-word cho EN, per-segment cho ZH) + click/hover trigger | P0 |
| **Web text lookup trigger** | Bôi đen text trên web + phím / hover text thường (auto-detect sentence từ DOM) | P1 |
| **Quick Add (1 nút)** | Tick + tôn trọng Card Creator auto-complete settings → Anki via cardCreatorService | P0 |
| **Send to Creator** | Mở Card Creator workspace two-pane (lookup pane + creator pane) | P1 |
| **Default popup tab global sticky** | Setting + persist + apply mọi popup mới | P0 |
| **Trigger mode setting** | click | hover | hover + modifier (Ctrl/Shift/Alt) | P0 |
| **SRS dropdown trong Card Creator setting** | Anki only (MVP), set default. Cell Memory thêm lại khi scheduler ready | P0 |
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
  /** Match phrase from the full sentence and the hovered occurrence. */
  matchPhrase?(request: PhraseMatchRequest): PhraseMatch | null;
  /** Accent/voice priority cho audio. */
  accents: readonly Accent[];
}

export interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export interface PhraseMatchRequest {
  readonly sentence: string;
  /** UTF-16 character offset of the hovered token in `sentence`. */
  readonly cursorOffset: number;
}

export type PhraseMatchQuality =
  | 'fixed'
  | 'inflected'
  | 'possessive-template'
  | 'slot-template';

export interface PhraseMatch {
  readonly dictionaryTerm: string;
  readonly surface: string;
  readonly span: { readonly start: number; readonly end: number };
  readonly quality: PhraseMatchQuality;
  readonly sourceResourceId: number;
}

export interface Accent { readonly id: string; readonly label: string; }
export interface TermProbe { hasTerm(term: string): boolean; }
```

---

## 7. Testing Strategy

- **Framework**: Jest (đã có, 2 project unit/integration).
- **Location**: colocate `*.test.ts` cạnh source. Integration ở `tests/integration/`.
- **Coverage expectations**:
  - `lookupOrchestrator` — dictionary match (cụm dài → đơn), plugin dispatch, ≤1s benchmark với dict ~120k entries (CEDICT) + ~100k (Cambridge).
  - `lookupWorker` — Web Worker postMessage round-trip (LOOKUP → LOOKUP_RESULT), top-10k pre-hydrate + LRU miss path, ≤1s hit benchmark off-main-thread trên RAM 4GB.
  - `matchStrategy` — forward maximum matching, edge case (overlap, dict miss, single char).
  - `englishPlugin` — lemma (irregular + regular), possessive normalization, phrasal/idiom pattern.
  - `chinesePlugin` — segmentation (我喜欢你 → 我/喜欢/你), pinyin reading, chengyu.
  - `priorityResolver` — top item per-language (EN: Forvo US > UK > TTS; ZH: Mandarin native > TTS).
  - `audioSource` — Forvo scrape parse, TTS fallback, error state.
  - `imageSource` — Google Images scrape regex, filter gstatic/encrypted.
  - `wordStatusStore` — 4 status CRUD + cycle, persist IndexedDB.
  - UI: render popup, auto-position, resize, lazy load panel, Quick Add 1 nút, dismiss Esc+outside, status cycle — `@testing-library/react`.
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
- Scrape retry: exponential backoff (1s, 2s, 4s, max 3 retry), timeout 10s, fallback graceful (community audio fail → system-tts, image fail → empty state + retry button).
- `manifest.json` `host_permissions`: thêm `https://forvo.com/*`, `https://google.com/*`, `https://translate.google.com/*` cho scrape + translate. Test Chrome thật sau khi đổi.
- ToS disclaimer trong Settings: "Audio/image nguồn cộng đồng + cloud, chỉ dùng cá nhân học ngôn ngữ, tuân thủ ToS dịch vụ."
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

## 8.5 Rollout / Rollback / Observability

**Rollout**:
- Feature flag `dictionaryPopupEnabled: boolean` trong `chrome.storage.local`, default `false`. Toggle on qua Settings → Experimental.
- Phased: (1) dev build test local, (2) Anh yêu manual test Chrome thật, (3) default `true` sau khi verify §10 + failure paths pass.

**Rollback**:
- Set `dictionaryPopupEnabled: false` → popup trigger tắt, subtitle overlay giữ nguyên behavior cũ (plain text, không token wrap).
- Version pin: nếu build mới break, rollback về version trước qua Chrome extension load unpacked.

**Observability**:
- Structured log (console.debug) cho lookup latency, scrape result (success/fail/latency), Quick Add result.
- Optional telemetry opt-in (default off): lookup miss rate, scrape failure rate, Quick Add success rate. Gửi qua `chrome.storage.local` aggregate, user export manual (không auto-send server).
- Error boundary React cho popup: catch render error → fallback empty state + log.

---

## 9. Data Contract

### 9.1 TypeScript types (`src/features/dictionaryPopup/types.ts`)

```typescript
// Logic output → UI input
export type ReadingKind = 'ipa' | 'pinyin' | 'none';
export type WordStatus = 'unknown' | 'known' | 'tracking' | 'ignore';
export type TriggerMode = 'click' | 'hover' | 'hover-ctrl' | 'hover-shift' | 'hover-alt';
export type PopupTab = 'audio' | 'image' | 'translate' | 'links';
export type SrsDestination = 'anki';
export type AudioSourceKind = 'community' | 'system-tts' | 'cloud-tts';  // neutral: community=Forvo, system-tts=chrome.tts, cloud-tts=Google TTS
export type AudioKind = 'word' | 'sentence';
export type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable' | 'error';

export interface LookupRequest {
  readonly term: string;
  readonly langCode: string;
  readonly contextSentence: string;
  readonly cursorOffset: number;          // UTF-16 character offset of hovered token; worker derives token index
  readonly fallback?: boolean;            // true khi user bôi đen text: bỏ qua plugin phraseMatch, dùng term verbatim + lemma only
}

export interface LookupResult {
  readonly term: string;
  readonly langCode: string;
  readonly reading: string;                          // primary reading (Chinese multi-pronunciation: chọn primary theo dict entry order, secondary trong definitions)
  readonly readingKind: ReadingKind;
  readonly frequency: { rank: number; source: string } | null;
  readonly status: WordStatus;
  readonly partsOfSpeech: readonly string[];
  readonly definitions: readonly DefinitionEntry[];
  readonly detectedPhrase: PhraseMatch | null;        // structurally valid match only; null → normal dictionary fallback
  readonly matchSource: 'dictionary' | 'plugin' | 'fallback';
}

export interface DefinitionEntry {
  readonly id: string;
  readonly pos?: string;
  readonly text: string;
  readonly examples: readonly string[];
  readonly source: string;                // 'Cambridge', 'CC-CEDICT', ...
  readonly defaultSelected: boolean;      // server hint; UI selection state ở Zustand, không persist LookupResult (O10)
}

export interface AudioItem {
  readonly id: string;
  readonly kind: AudioKind;
  readonly source: AudioSourceKind;
  readonly label: string;                 // 'Forvo · US native', 'System TTS · Female'
  readonly accentId?: string;
  readonly state: AudioState;
  readonly url?: string;
  readonly defaultSelected: boolean;     // server hint; UI selection state ở Zustand (O10)
}

export interface ImageItem {
  readonly id: string;
  readonly alt: string;
  readonly src: string;
  readonly defaultSelected: boolean;     // server hint (O10)
}

export interface ExternalDictLink {
  readonly id: string;
  readonly name: string;
  readonly url: string;                   // đã fill {term}/{lang}
}

export interface QuickAddPayload {
  readonly term: string;
  readonly langCode: string;
  readonly definitions: readonly DefinitionEntry[];   // user đã tick
  readonly audios: readonly AudioItem[];              // user đã tick
  readonly images: readonly ImageItem[];              // user đã tick
  readonly translation: string;                       // default '' nếu chưa mở Translate
  readonly sentence: string;                          // default = LookupRequest.contextSentence
  readonly status: WordStatus;
  readonly destination: SrsDestination;               // MVP: chỉ 'anki'. Cell Memory thêm lại khi scheduler ready.
  // KHÔNG có mode manual|quick|hybrid — 1 hành vi Quick Add (xem mapping dưới).
}

// Mapping QuickAddPayload → CardFields / addNote (Card Creator — confirmed interview-me):
// - deck/noteType/fieldMapping: từ Card Creator settings/draft đã lưu (popup không chọn deck).
// - definitions string: join `\n`; mỗi definition `{pos}. {text}` (nếu pos) + examples từng dòng nếu có.
// - audios/images: fetch binary **chỉ khi** bấm Quick Add → MediaFile → storeMediaFile → field ref; fail → toast, bỏ item đó.
// - translation → sentenceTranslation; sentence → sentence; term → targetWord.
// - Tôn trọng Card Creator auto-complete settings (per-field toggle + fallback audio community→tts). Field auto-complete off → chỉ fill item user tick.
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
  status: z.enum(['unknown', 'known', 'tracking', 'ignore']),
  partsOfSpeech: z.array(z.string()),
  definitions: z.array(z.object({
    id: z.string(),
    pos: z.string().optional(),
    text: z.string(),
    examples: z.array(z.string()),
    source: z.string(),
    defaultSelected: z.boolean(),         // server hint (O10); UI selection ở Zustand
  })),
  detectedPhrase: z.object({
    dictionaryTerm: z.string(),
    surface: z.string(),
    span: z.object({ start: z.number().int().min(0), end: z.number().int().min(0) }),
    quality: z.enum(['fixed', 'inflected', 'possessive-template', 'slot-template']),
    sourceResourceId: z.number().int().nonnegative(),
  }).nullable(),
  matchSource: z.enum(['dictionary', 'plugin', 'fallback']),
});

export const QuickAddPayloadSchema = z.object({
  term: z.string(),
  langCode: z.string().length(2),
  definitions: z.array(z.object({
    id: z.string(), pos: z.string().optional(), text: z.string(),
    examples: z.array(z.string()), source: z.string(), defaultSelected: z.boolean(),
  })),
  audios: z.array(z.object({
    id: z.string(), kind: z.enum(['word', 'sentence']),
    source: z.enum(['community', 'system-tts', 'cloud-tts']),
    label: z.string(), accentId: z.string().optional(),
    state: z.enum(['idle', 'loading', 'playing', 'paused', 'unavailable', 'error']),
    url: z.string().optional(),
    defaultSelected: z.boolean(),
  })),
  images: z.array(z.object({
    id: z.string(), alt: z.string(), src: z.string(), defaultSelected: z.boolean(),
  })),
  translation: z.string(),
  sentence: z.string(),
  status: z.enum(['unknown', 'known', 'tracking', 'ignore']),
  destination: z.enum(['anki']),                      // MVP: chỉ 'anki'. Cell Memory thêm lại khi scheduler ready.
  // không có mode manual|quick|hybrid
});
```

### 9.3 Settings extension (`src/entities/settings/types.ts`)

```typescript
export interface DictionaryPopupSettings {
  readonly enabled: boolean;                          // feature flag dictionaryPopupEnabled, default false
  readonly triggerMode: TriggerMode;                  // default 'click'
  // Không có hoverDelayMs — content script dùng debounce internal: hover 150ms, click 50ms (không setting, giảm friction học).
  readonly defaultActiveTab: PopupTab | null;          // default null (chỉ hiện dictionary, không mở tab ngoài). Global sticky.
  readonly defaultActiveTabPerLang?: Record<string, PopupTab | null>;  // override per-language
  readonly srsDestination: SrsDestination;            // default 'anki'. Single source: DictionaryPopupSettings (Card Creator UI proxy nếu cần).
  readonly popupWidthPx: number;                      // sticky size, default 560, clamp min(width, viewportWidth - 16)
  readonly popupMaxHeightPx: number;                  // default 480 (px), clamp Math.round(window.innerHeight * 0.7) ở mount
  readonly translateTargetLang: string;               // ISO 639-1; default: navigator.language startsWith('zh') → 'en', else 'vi' (không phụ thuộc settings.uiLang — field này không có trong Settings hiện tại)
  readonly externalDictLinks: readonly ExternalDictLinkTemplate[];
}

export interface ExternalDictLinkTemplate {
  readonly id: string;
  readonly name: string;
  readonly urlTemplate: string;                       // placeholders {term} {lang}; fill bằng encodeURIComponent(term)
  readonly langCodes: readonly string[];              // ngôn ngữ áp dụng
}
```

**Migration**: `settingsStore` `CURRENT_SCHEMA_VERSION` hiện = **13** → bump **14** khi thêm slice:
```typescript
// migrate v13 → v14: DictionaryPopupSettings default
if (oldVersion < 14) {
  settings.dictionaryPopup = {
    enabled: false,
    triggerMode: 'click',
    defaultActiveTab: null,
    srsDestination: 'anki',
    popupWidthPx: 560,
    popupMaxHeightPx: 480,
    translateTargetLang:
      (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh'))
        ? 'en'
        : 'vi',
    externalDictLinks: [
      { id: 'cambridge', name: 'Cambridge Dictionary', urlTemplate: 'https://dictionary.cambridge.org/dictionary/english/{term}', langCodes: ['en'] },
      { id: 'wiktionary', name: 'Wiktionary', urlTemplate: 'https://en.wiktionary.org/wiki/{term}', langCodes: ['en'] },
      { id: 'gtranslate', name: 'Google Translate', urlTemplate: 'https://translate.google.com/?sl=auto&tl={lang}&text={term}', langCodes: [] },
    ],
  };
  // schemaVersion = 14
}
```

### 9.3.1 Card Creator settings extension (scope P0 — auto-complete toggles)

Extend `CardCreatorSettings` hiện có (`src/entities/settings/types.ts`) với auto-complete toggles + audio fallback:

```typescript
/** Field có thể auto-complete trong Quick Add (trục content, khác field-map routing). */
export type AutoCompletableField =
  | 'definitions'      // auto-fill all dict definitions
  | 'wordAudios'       // auto-fill top community audio + fallback tts
  | 'sentenceAudios'   // auto-fill sentence audio if available
  | 'images'           // auto-fill top relevance image
  | 'sentenceTranslation'  // auto-fill Translate panel result if opened
  | 'sentence';        // auto-fill LookupRequest.contextSentence

/** Audio fallback strategy khi community audio = 0 hoặc fetch fail. */
export type AudioFallbackStrategy = 'community-then-tts' | 'community-only' | 'tts-only';

/** Extension của CardCreatorSettings (additive — không break field hiện có). */
export interface CardCreatorSettingsV14 extends CardCreatorSettings {
  /** Per-field auto-complete toggle. Default all true (kim chỉ nam "user vào và học thôi").
   *  Toggle ON → Quick Add auto-fill field với item best-match (+ fallback).
   *  Toggle OFF → chỉ fill item user đã tick (explicit selection).
   *  Khác field-map "None" (routing opt-out) — toggle = content decision. */
  readonly autoCompleteToggles: Record<AutoCompletableField, boolean>;
  /** Audio fallback khi community = 0/fail. Default 'community-then-tts'. */
  readonly audioFallback: AudioFallbackStrategy;
}
```

**Migration v13 → v14** (cùng bump với DictionaryPopupSettings):
```typescript
// migrate v13 → v14: CardCreatorSettings autoCompleteToggles + audioFallback
if (oldVersion < 14) {
  settings.cardCreator = {
    ...settings.cardCreator,
    autoCompleteToggles: {
      definitions: true,
      wordAudios: true,
      sentenceAudios: true,
      images: true,
      sentenceTranslation: true,
      sentence: true,
    },
    audioFallback: 'community-then-tts',
  };
}
```

**Card Creator UI** (`CardCreatorSettingsPanel.tsx`): thêm 6 toggle switches + 1 audio fallback select. Persist qua `saveSettings`. Popup Quick Add đọc settings này khi build payload.

**Quick Add mapping logic** (pseudo):
```
for each AutoCompletableField F:
  if autoCompleteToggles[F] === true:
    // auto-fill: lấy item best-match từ LookupResult/panels
    if F === 'definitions': fill all definitions (user tick override)
    if F === 'wordAudios': fill top community audio; if 0/fail + fallback='community-then-tts' → fill tts
    if F === 'images': fill top relevance image
    if F === 'sentenceTranslation': fill Translate panel result if opened, else ''
    if F === 'sentence': fill LookupRequest.contextSentence
    if F === 'sentenceAudios': fill sentence audio if available
  else: // OFF
    chỉ fill item user đã tick (explicit selection)
// field mapping "None" (routing) → skip sending to Anki field đó (khác trục)
```

### 9.4 Messages + worker transport

**A) Worker envelope** (content script ↔ lookup worker — **không** nhét `LOOKUP` vào MV3 fan-out):
```typescript
// WorkerMessage
{ type: 'LOOKUP' | 'LOOKUP_CANCEL' | 'WORKER_READY' | 'HYDRATE_CHUNK' | 'HYDRATE_DONE'; requestId: string; payload?: unknown }
// LOOKUP payload = LookupRequest; response LOOKUP_RESULT { requestId, ok, result? | error? }
```

**B) MV3 MESSAGE_TYPES** (content/background — payload luôn có `tabId` khi response fan-out):
```typescript
// Thêm vào MESSAGE_TYPES (scrape / status / Anki — không dùng cho worker dict match):
FETCH_COMMUNITY_AUDIO: 'FETCH_COMMUNITY_AUDIO',  // neutral name (không product name)
FETCH_IMAGES: 'FETCH_IMAGES',
TTS_SPEAK: 'TTS_SPEAK',
WORD_STATUS_GET: 'WORD_STATUS_GET',
WORD_STATUS_SET: 'WORD_STATUS_SET',
QUICK_ADD: 'QUICK_ADD',
// Optional: HYDRATE_DICT_TOP_K orchestration background-only
```

**Routing**: worker dùng `requestId`; BG response fan-out có `tabId`. Debounce content script: hover **150ms**, click **50ms** (internal, không setting). LOOKUP_CANCEL: worker drop result nếu requestId đã cancel (không abort mid-IDB transaction; check cancel flag giữa steps).

### 9.5 Worker dict hydrate (confirmed interview-me — RAM 4GB)

1. Extension startup (install / reload / browser start): background tạo worker → `WORKER_READY`.
2. Background query frequency store → **top 10k** rank → chunk postMessage Transferable → worker build Map/LRU.
3. Worker cap: **exactly max 10k** live entries (hit always within cap after eviction).
4. Lookup **miss**: background `findDictionaryByTerm` (+ related) → push entry to worker → LRU insert; if size>10k → **evict least-recently-used**.
5. Không full dump ~220k entries vào worker. Definitions full-text có thể lazy theo term khi hit/miss.

### 9.6 English phrase matcher (ADR-037)

- Cambridge multiword terms compile thành AST: literal, optional group, alternatives, bounded `sth/sb` slots, possessive slot.
- `...` và `etc.` templates là `unsupportedOpen`, không auto-match.
- Phrase index dùng compact anchor postings; worker không scan toàn bộ multiword terms và không giữ definitions trong phrase index.
- Runtime match dùng `contextSentence + cursorOffset`, bounded token-DP, explicit phrasal-verb order, deterministic ranking; không dùng `confidence >= 0.7`.
- Match không chứng minh semantic sense. Không có phrase match → normal dictionary fallback.
- DB schema v10 bổ sung `langPhraseIndex` per resource; compiler version bắt buộc để rebuild an toàn.

---

## 10. Success Criteria (testable)

- [x] `npm run test:unit` pass cho `dictionaryPopup` module (lookup, match, lemma, possessive, priority, status store, audio/image source parse).
- [x] `npx tsc --noEmit` clean.
- [x] `npm run lint` clean.
- [ ] Benchmark `lookupOrchestrator` ≤1s với dict ~120k entries (CEDICT) + ~100k (Cambridge) trên RAM 4GB (runnable self-check file).
- [x] EN phrase benchmark theo ADR-037: phrase candidate p95 <10ms, AST validation p95 <25ms, warm worker lookup p95 <100ms, phrase index blob + resident worker representation ≤8MB/resource, transient matcher state ≤512KB; no regex scan of all terms.
- [x] Popup render trong Shadow DOM, không bị CSS trang web phá, auto-position tránh overflow, resize kéo góc, sticky size persist.
- [x] EN lookup: hover token trong "The answer was right under my nose" → detect Cambridge template `be (right) under your nose` (optional group + possessive + verb lemma), return exact surface span; no opaque confidence threshold.
- [x] ZH lookup: click 喜 trong 我喜欢你 → highlight 喜欢 (dictionary-driven segmentation), tra "喜欢" không tra "喜".
- [x] Definitions luôn hiện, mỗi definition có checkbox, default all selected.
- [x] Audio/Image/Translate/Links panel toggle từ toolbar, lazy load (chỉ fetch khi mở), preserve state khi toggle lại.
- [x] Quick Add: 1 nút, user tick item → hệ thống tôn trọng Card Creator auto-complete settings (field mapping + per-field toggle + fallback). Nếu field auto-complete on thì fill (với fallback), nếu off thì chỉ fill item user đã tick. Audio/image fetch binary khi Quick Add, fetch fail → toast error, item bỏ qua.
- [x] Word status 4 giá trị ở footer (unknown → tracking → known → ignore, vòng tròn), persist IndexedDB.
- [x] Default popup tab global sticky, persist `chrome.storage.local`.
- [x] Trigger mode setting (click/hover/modifier), persist.
- [x] Card Creator setting có SRS dropdown (Anki only MVP), set default.
- [x] Không có string "OCEAN"/"Yomitan"/sản phẩm bên thứ ba trong `src/` + `docs/`.
- [ ] Browser verify (Edge/Chrome thật qua MCP edge-devtools): popup render dark/light, EN+ZH lookup, panel toggle, Quick Add toast, mobile 375px không overflow.

### Failure paths (testable)

- [ ] **Dict chưa import**: popup hiện empty state "Chưa có từ điển cho ngôn ngữ này — mở Settings → Resources để import", không crash, không spinner vô tận.
- [ ] **Lookup miss** (term không có trong dict): popup hiện "Không tìm thấy '{term}'", gợi ý external dict links, không crash.
- [ ] **Forvo scrape fail** (403/timeout/HTML thay đổi): Audio Panel hiện error state "Không lấy được audio cộng đồng", fallback chrome.tts tự động, retry button.
- [ ] **Google Images scrape fail**: Image Panel hiện error state "Không tải được ảnh", retry button, không block panel khác.
- [ ] **Anki offline khi Quick Add**: toast error "Anki chưa chạy — mở Anki desktop", payload persist local, retry khi Anki online.
- [ ] **Field mapping fail** (deck/note type không khớp): toast error chi tiết "Field '{x}' không tìm thấy trong note type '{y}'", không gửi thẻ lỗi.
- [ ] **Network error** (translate/fetch proxy): Translate Panel hiện error state, retry button, không crash popup.
- [ ] **IndexedDB quota exceeded**: word status + dict import hiện error "Bộ nhớ đầy — xóa resource cũ", graceful degradation (lookup vẫn hoạt động với dict đã có).
- [ ] **Rapid hover/click nhiều từ liên tiếp**: debounce 150ms (hover) / 50ms (click), in-flight LOOKUP cancellation (tabId + requestId), không popup flicker, không duplicate request.

---

## 11. Decisions (confirmed 2026-07-13)

### D1 — Word status set: 4 status (MVP)

`unknown → tracking → known → ignore` (vòng tròn, ignore quay lại unknown). Bỏ `learning` (MVP). `ignore` cho từ không ý nghĩa trong ngôn ngữ đang học. `unknown` đúng ngữ cảnh học hơn `New`. Footer dùng cycle (bấm → chuyển tiếp).

### D2 — Default popup tab: global + per-lang override

Global default (`DictionaryPopupSettings.defaultActiveTab`) áp dụng mọi popup mới + per-language override (`defaultActiveTabPerLang`) nếu user set. `null` = chỉ hiện dictionary, không mở tab ngoài. User pin tab 1 lần → sticky persist `chrome.storage.local`.

### D3 — Plugin MVP scope: EN+ZH đầy đủ là P0

MVP bao gồm đầy đủ English plugin (lemma + possessive + phrasal/idiom pattern) + Chinese plugin (dictionary-driven segmentation + pinyin + chengyu idiom) + plugin interface + registry + fallback minimal. Dictionary match (cụm dài → đơn) + segmentation chạy trong Web Worker off-main-thread để đảm bảo ≤1s trên RAM 4GB. Plugin ngôn ngữ ngoài EN/ZH — architecture sẵn sàng, chưa implement (out of scope).

### D4 — Thuật toán auto-detect: mockup trước, ADR phrase/FMM sau

UI không phụ thuộc thuật toán match chi tiết. **EN phrase/idiom/phrasal**: inventory Cambridge multiword (34,094 normalized terms) + edge cases; thuật toán deterministic AST + anchor index + bounded token-DP được thiết kế trong **ADR-037** (implementation + low-memory benchmark pending). **ZH segmentation**: FMM baseline (dưới).

**Alternatives cho segmentation (Chinese)**:
- **FMM (Forward Maximum Matching)** — quét trái→phải, match cụm dài nhất trong dict. ✅ Chọn: ponytail (không library), dict-driven, O(n·maxWordLen) đơn giản, đủ nhanh trên RAM 4GB với dict ~120k entries + Web Worker. Trade-off: không xử lý ambiguity tốt bằng DAG (vd "南京市长" → FMM "南京/市长" đúng, nhưng "研究生命" → FMM "研究生/命" sai vs "研究/生命" đúng).
- **BMM (Backward Maximum Matching)** — quét phải→trái. Loại: cùng complexity FMM, không rõ ràng tốt hơn, thêm complexity không justify.
- **DAG (Directed Acyclic Graph) + dynamic programming** — xây graph tất cả segmentation possible, chọn path tối ưu theo probability/score. Loại: phức tạp hơn, cần probability model hoặc corpus stats, ponytail ladder rung 1 (YAGNI cho MVP). Upgrade path nếu FMM miss rate cao trong production (ponytail: ceiling = ambiguity cases, upgrade sang DAG + word frequency score).

### D5 — Card Creator restyle: sau popup dictionary

Popup dictionary build trước (core, chưa có). Card Creator restyle sau (đã có, ít rủi ro, chỉ restyle theo 13 design principles + thêm SRS dropdown).

### D6 — Web text lookup: MVP subtitle overlay trước, web text P1

MVP subtitle overlay lookup (core value khi xem video). Web text lookup (bôi đen + hover text thường) P1 ngay sau — cùng architecture, chỉ khác trigger source + auto-detect sentence từ DOM.

### D7 — Quick Add 1 nút + auto-complete toggles (interview-me 2026-07-15)

Bỏ manual/quick/hybrid modes. Deck/noteType/mapping từ Card Creator settings/draft. Definitions join `\n` + `{pos}. {text}` + examples. Media binary fetch only on Quick Add. **Auto-complete toggles** (per-field on/off) + **audio fallback** (community→tts) — settings mới trong `CardCreatorSettings` (scope P0):
- Toggle ON → Quick Add auto-fill field với item best-match (definitions: all dict definitions; audio: top community + fallback tts if 0 community; image: top relevance; translation: Translate panel result if opened; sentence: LookupRequest.contextSentence).
- Toggle OFF → chỉ fill item user đã tick (explicit selection).
- Field mapping "None" (đã có) = routing opt-out (khác trục: toggle = content decision, map = destination routing).

### D8 — Worker hydrate top-10k + pure LRU (interview-me 2026-07-15)

Background → chunk → worker. Pre-hydrate top 10k frequency at extension startup. Max 10k live. Miss → IDB + LRU insert/evict least-recently-used. Cross-browser (no offscreen-only path).

### D9 — Trigger debounce only (interview-me 2026-07-15)

Internal debounce hover 150ms / click 50ms. **No** `hoverDelayMs` user setting.

### D10 — Dismiss (interview-me 2026-07-15)

Esc + click outside. Scroll/play alone does not dismiss (click video counts as outside click).

---

## 12. Next

1. ✅ **Decisions D1–D10** (D7–D10 interview-me 2026-07-15).
2. **Review ADR-037** + approve/adjust phrase algorithm design and benchmark gate.
3. **design-driven-development** → mockup popup dictionary (MVP: shell + 4 status + Quick Add 1 nút + dismiss; phrase UI placeholder OK).
4. **Plan** → implement ADR-037 + ZH FMM theo P0/P1.
5. **Implement** theo benchmark gate, không claim semantic sense disambiguation.

---

## 13. Residual blockers / open items (G1 — before phrase ADR)

### Resolved via interview-me (được cập nhật trong body spec)

| ID | Topic | Status |
|----|--------|--------|
| R1 | Quick Add → Anki I/O / modes | ✅ D7 |
| R2 | Word status 4 + cycle | ✅ D1/D7 |
| R3 | Dismiss UX | ✅ D10 |
| R4 | Dict hydrate + LRU | ✅ D8 |
| R5 | hoverDelay vs debounce | ✅ D9 |
| R6 | Settings migration v13→v14 + `enabled` flag | ✅ §9.3 |
| R7 | LOOKUP worker vs MESSAGE_TYPES split | ✅ §9.4 |

### O2–O14 → đã tự chốt (codebase + UX, 2026-07-15)

| ID | Severity | Topic | Decision |
|----|----------|--------|----------|
| O2 | Major | Send to Creator icon P0 vs P1 | **P0 header chỉ Quick Add icon.** Send to Creator icon thêm khi P1 (click mà không làm gì = dead button, poor UX). |
| O3 | Major | Links Panel + `externalDictLinks: []` empty | **Ship 3 neutral default templates**: Cambridge Dictionary online (`https://dictionary.cambridge.org/dictionary/english/{term}`), Wiktionary (`https://en.wiktionary.org/wiki/{term}`), Google Translate (`https://translate.google.com/?sl=auto&tl={lang}&text={term}`). User edit/add trong Settings. Không scrape — chỉ external link mở tab mới. |
| O4 | Major | Touch/tablet no hover | **MVP explicit non-goal: touch hover.** `triggerMode='click'` work trên touch (tap = click). P1: touch-specific UX (long-press, etc.). AGENTS.md "responsive" áp dụng CSS layout, không áp dụng hover trigger. |
| O5 | Major | `TermProbe.hasTerm` vs FMM longest | **TermProbe thêm `findLongestTerm(langCode, prefix): string|null`** — query IndexedDB prefix range (key cursor `IDBKeyRange.bound(prefix, prefix+'\uffff')`). FMM worker gọi thay vì `hasTerm` loop. ADR ZH ghi chi tiết. |
| O6 | Major | Scrape host/binary/ToS ADR | **ADR scrape**: prefer official API khi user-provided key (Forvo API, Google Custom Search API) → fallback scrape với **rate limit + cache 24h + 1 retry**. MVP: scrape only (no API key UI), rate limit + cache. Binary fetch via background `FETCH_REQUEST` (đã có), base64 → `storeMediaFile`. ToS: ADR ghi rõ risk + user opt-in `dictionaryPopupEnabled`. |
| O7 | Major | Card Creator auto-complete toggles chưa có | **Thêm settings mới** (scope P0, interview-me confirmed): `CardCreatorSettings.autoCompleteToggles: Record<AutoCompletableField, boolean>` + `audioFallback: 'community-then-tts' \| 'community-only' \| 'tts-only'`. Quick Add đọc toggles → field ON: auto-fill (đúng item best-match + fallback); field OFF: chỉ fill item user đã tick. Field mapping "None" (đã có) = routing opt-out (khác trục: toggle=content, map=routing). |
| O8 | Major | Layout refs principles #1/#3/#7/#9 | **Mockup phase provides anchors** (defer). |
| O9 | Minor | `DefinitionEntry.reading?` ZH multi-pron | **`reading?: string`** optional (IPA/pinyin). ZH nhiều pron → pick first/most-common; array nếu cần sau (YAGNI). |
| O10 | Minor | `selected` on LookupResult is UI state | **Rename `defaultSelected: boolean`** (server hint). UI selection state trong Zustand store, không persist trong LookupResult. |
| O11 | Minor | priorityResolver rules | **1 table**: Audio: community (Forvo) > TTS fallback. Image: relevance score desc (nếu có), else import order. Translate: 1 result. Definition: dict import order, user tick override. |
| O12 | Minor | DoD: update `docs/2-architechture-system.md` + `docs/0-wiki.md` | **Add §10 checklist**: sau implement, update tree + mục lục. |
| O13 | Minor | Multi-dict same lang / wrong-lang import | **Journey failure path**: import duplicate dedupe qua `signature` (đã có); wrong-lang warning nếu dict langCode != frequency langCode đã import. |
| O14 | Minor | Cross-browser verify | **MVP smoke: Edge + Chrome** (MCP edge-devtools). Firefox/Brave/Opera: documented Chromium-MVP, P1 smoke. |

**Gate O1 (phrase ADR)**: O2–O7 đã chốt → **ADR-037 đã thiết kế**; implementation chỉ bắt đầu sau review + benchmark gate.

**Follow-up implement O7** (scope P0): extend `CardCreatorSettings` type + migration v14 + `CardCreatorSettingsPanel` UI (6 toggles + 1 audio fallback select). Spec đầy đủ §9.3.1 + D7.
