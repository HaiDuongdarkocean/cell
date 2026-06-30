# Cell Extension — Architecture Proposal

> Đề xuất kiến trúc tích hợp Cell (video downloader) → Orca (immersion learning platform).
> Đứng từ vị trí CTO, nhìn tổng quan hệ thống, quyết định dựa trên:
> - 130 UC wiki (UC01-UC17), 12 nguyên tắc synthesis (P1-P12)
> - 3 dự án reference: asbplayer, import-dict Orca v3, theocean-dict
> - 34 nguồn kiến trúc (sách, video, GitHub repos, Chrome docs)
> - Source code Cell hiện tại (75 files)
>
> Ngày: 2026-06-25 · Tác giả: CTO persona

---

## 1. Bối cảnh chiến lược (CTO Strategic Context)

### 1.1 Mô hình kinh doanh
- **Premium-first**: Phase 1 Premium (không giới hạn), Phase 2 Standard (freemium 625 cards), Phase 3 Guest
- **Offline-first hoàn toàn**: Lợi thế cạnh tranh cốt lõi — mọi feature chính hoạt động không cần internet
- **Đa ngôn ngữ từ đầu**: EN + ZH Phase 1, mở rộng sau

### 1.2 Quy mô & Lộ trình
| Phase | Timeline | Scope | Users |
|---|---|---|---|
| 1 | Hiện tại → 6 tháng | Chrome/Edge MV3 Extension, EN+ZH, Premium | < 10K |
| 2 | 6-18 tháng | + Web App dashboard, Standard freemium | < 100K |
| 3 | 18-36 tháng | + Mobile (Flutter), Guest tier | < 1M |

### 1.3 Ràng buộc kỹ thuật
- **MV3 ephemeral service worker**: SW kill sau ~30s, state mất → persist chrome.storage/IndexedDB
- **1 offscreen document tại 1 thời điểm**: Chrome limit
- **No DOM in SW**: Transmux, WASM, dict parse → offscreen
- **Content script isolated world**: Không access page window, privileged API qua message
- **Offline-first**: SQLite WASM + IndexedDB local, Google Drive sync optional
- **RAM < 500MB active**: Tương thích máy yếu (CPU 2 nhân, RAM 4GB)

---

## 2. Kiến trúc hiện tại của Cell (AS-IS)

### 2.1 Đã xây dựng (20 features)
| Feature | Status | Files chính |
|---|---|---|
| Media detection (network + DOM) | ✅ | networkInterceptor, videoDetector, subtitleDetector |
| M3U8/MP4 download | ✅ | downloader, downloadQueue |
| Parallel/sequential TS→MP4 | ✅ | parallelTransmuxer, tsTransmuxer, offscreen |
| Subtitle parsing (ASS/VTT/SRT) | ✅ | assParser, vttParser, srtParser |
| Download queue (pause/resume/retry) | ✅ | downloadQueue |
| Auto-download whitelist | ✅ | autoDownload, whitelist |
| Settings persistence | ✅ | chrome.storage.local |
| Popup UI (React + Zustand) | ✅ | App.redesigned, popupStore |
| Tab-scoping | ✅ | getActiveContentTab, tabId filter |
| Subtitle language detection | ✅ | languageDetector, scriptDetector |

### 2.2 Cần thêm (18 features Orca)
| Feature | Priority | Source reference |
|---|---|---|
| Dictionary lookup (SQLite FTS5) | P0 | Orca v3, theocean-dict |
| Vocabulary tracking (5-status) | P0 | Orca v3 WordStatusRepository |
| Word popup overlay (Shadow DOM) | P0 | theocean-dict popupDictionary |
| Highlight từ vựng trên web | P0 | Orca v3 IPlusOneSelector |
| Flashcard creation (Quick Add) | P1 | asbplayer anki-ui-controller |
| Anki integration (AnkiConnect) | P1 | asbplayer common/anki, theocean-dict |
| FSRS SRS engine | P1 | Wiki UC12 |
| Deck management | P1 | Wiki UC11 |
| Subtitle overlay trên video | P1 | asbplayer subtitle-controller |
| Video learning mode | P2 | Wiki UC04.10 |
| Whisper STT (WASM) | P2 | Wiki UC04.3 |
| Dual subtitle | P2 | Wiki UC04.6 |
| AI explain (WebLLM/Ollama) | P2 | Wiki UC16.7 |
| Google Drive sync | P2 | Wiki UC15 |
| Podcast support | P3 | Wiki UC05 |
| EPUB/PDF reader | P3 | Wiki UC06 |
| Clipboard sessions | P3 | Wiki UC07 |
| Statistics | P3 | Wiki UC17 |

### 2.3 Đánh giá kiến trúc hiện tại
| Nguyên tắc | Status | Đánh giá |
|---|---|---|
| P1 SW orchestrator | ✅ Đúng | BackgroundService = orchestrator, offscreen = compute |
| P2 CS mỏng | ✅ Đúng | content-script chỉ scan DOM + MutationObserver |
| P3 Message typed | ✅ Có | 27 message types, MessageBus typed |
| P4 State background, proxy UI | ⚠️ Partial | Zustand popup + chrome.storage, chưa có IndexedDB |
| P5 Layered | ❌ Chưa | lib/ trộn domain + infrastructure |
| P6 Ports & adapters | ❌ Chưa | Không có interface abstraction |
| P7 Feature-based | ⚠️ Partial | Theo technical (detectors/parsers/converters) |
| P8 Offscreen heavy | ✅ Có | Transmux trong offscreen + Web Worker |
| P9 Shadow DOM | ❌ Chưa | Chưa inject UI vào page |
| P10 Least privilege | ⚠️ Broad | `<all_urls>` host permission |
| P11 Lazy load | ⚠️ Partial | Popup load tất cả |
| P12 Test pyramid | ✅ Có | Jest unit + integration + Playwright e2e |

---

## 3. Quyết định kiến trúc (ADR-style)

### ADR-001: Layered Clean Architecture (domain/application/infrastructure/presentation)

**Status**: Accepted

**Context**: Cell hiện tại `lib/` trộn domain types, infrastructure (OPFS, chrome.storage), và utils. Khi thêm 18 features mới (dict, vocab, flashcard, SRS, Anki), code sẽ trở thành "big ball of mud" nếu không phân layer.

**Decision**: Refactor dần sang 4-layer Clean Architecture:
```
src/
  domain/           # Pure types, entities, ZERO dependency
    word/           # WordEntry, WordStatus, Wordbook
    card/           # CardData, MiningItem, Deck
    dict/           # DictEntry, DictSource
    subtitle/       # Cue, SubtitleTrack
    srs/            # FSRSState, ReviewLog
  application/      # Use cases + port interfaces (abstract)
    word/
      ports/IWordRepository.ts
      use-cases/LookupWordUseCase.ts
      use-cases/SaveWordUseCase.ts
    dict/
      ports/IDictRepository.ts
      use-cases/ImportDictUseCase.ts
    mining/
      ports/ICardBuilder.ts
      use-cases/MineCardUseCase.ts
    anki/
      ports/IAnkiExporter.ts
      use-cases/ExportAnkiUseCase.ts
    srs/
      ports/ISrsEngine.ts
      use-cases/ReviewCardUseCase.ts
  infrastructure/   # Chrome APIs, IndexedDB, HTTP, dict loader
    word/IndexedDBWordRepository.ts
    dict/SQLiteDictRepository.ts
    dict/YomitanDictImporter.ts
    anki/AnkiConnectExporter.ts
    anki/ApkgExporter.ts
    srs/FsrsEngine.ts
    storage/DexieDB.ts
    storage/ChromeStorageAdapter.ts
  presentation/     # React components + hooks
    popup/          # existing popup
    overlay/        # new: word popup, highlight overlay
    wordbook/       # new: vocabulary manager UI
    mining/         # new: flashcard creator UI
    srs/            # new: SRS review UI
    settings/       # new: settings dialog (extend)
  entrypoints/      # Composition root
    background/index.ts
    content/content-script.ts
    popup/main.tsx
    offscreen/ffmpeg.html
```

**Consequences**:
- (+) Test use cases không cần browser (mock ports)
- (+) Swap IndexedDB → SQLite WASM mà không sửa use case
- (+) Thêm cloud sync = thêm adapter, không sửa domain
- (-) Verbosity ban đầu (nhiều file interface)
- (-) Learning curve cho team

**Alternatives**:
- Giữ `lib/` flat → rejected: không scale cho 18 features
- Microservices → rejected: extension là 1 process, không phù hợp

**Source**: dev.to/ievgen_ch (#15), bespoyasov.me (#16), bazaglia.com (#17), softwarepatternslexicon.com (#20)

---

### ADR-002: IndexedDB (Dexie) cho word DB + dict DB, SQLite WASM cho dict search

**Status**: Accepted

**Context**: Cell hiện tại chỉ có OPFS (download files) + chrome.storage.local (settings). Orca cần:
- Word DB: ~3,000 từ/user, CRUD + status tracking + frequency lookup
- Dict DB: ~150K entries/dictionary, full-text search (FTS5), suffix search
- Card DB: ~625 cards/user, FSRS state, review logs

**Decision**:
- **Dexie (IndexedDB)** cho word DB + card DB + review logs + bookmarks (user data, CRUD-heavy, < 10K records)
- **SQLite WASM (wa-sqlite)** cho dict DB (read-heavy, FTS5 full-text search, 150K+ entries)
- **chrome.storage.local** cho settings + auth tokens (giữ nguyên)
- **OPFS** cho download files (giữ nguyên) + SQLite .db file (offscreen)

**Why split**: IndexedDB không có FTS5, query phức tạp chậm. SQLite WASM có FTS5, query < 30ms. Nhưng SQLite WASM cần offscreen document (không chạy trong SW), trong khi Dexie chạy ở mọi context.

**Consequences**:
- (+) Dict lookup < 30ms (FTS5)
- (+) Word/card CRUD đơn giản với Dexie
- (+) SQLite .db file lưu OPFS, load trong offscreen
- (-) 2 storage systems (Dexie + SQLite) → sync phức tạp hơn
- (-) SQLite WASM ~ 2MB bundle

**Alternatives**:
- Dexie cho tất cả → rejected: không có FTS5, suffix search chậm
- SQLite cho tất cả → rejected: không chạy trong SW/popup trực tiếp, cần offscreen cho mọi query

**Source**: Orca v3 (#import-dict, IndexedDB schema), sqlite-opfs-mv3 (#27), dexie.org (#42)

---

### ADR-003: Ports & Adapters (Hexagonal) cho dict/vocab/anki/srs

**Status**: Accepted

**Context**: 18 features mới cần nhiều integration: AnkiConnect (HTTP), Google Drive (OAuth), Forvo (audio), WebLLM (WASM), Whisper (WASM), Yomitan (dict format). Không abstract → coupling cao, khó test, khó swap.

**Decision**: Mỗi feature area có port interface + adapter implementations:
```
application/dict/ports/IDictRepository.ts     ← interface
  infrastructure/dict/SQLiteDictRepository.ts  ← SQLite WASM adapter
  infrastructure/dict/InMemoryDictRepository.ts ← test adapter

application/anki/ports/IAnkiExporter.ts       ← interface
  infrastructure/anki/AnkiConnectExporter.ts   ← AnkiConnect HTTP
  infrastructure/anki/ApkgExporter.ts          ← .apkg file export

application/srs/ports/ISrsEngine.ts           ← interface
  infrastructure/srs/FsrsEngine.ts             ← FSRS algorithm
  infrastructure/srs/Sm2Engine.ts              ← Anki SM-2 compat (import)

application/ai/ports/IAIProvider.ts           ← interface
  infrastructure/ai/WebLLMProvider.ts          ← local WASM
  infrastructure/ai/OllamaProvider.ts          ← local HTTP
  infrastructure/ai/GeminiProvider.ts          ← cloud (Phase 2)
```

**Consequences**:
- (+) Test use cases với InMemory/InMemoryAdapter, không cần browser
- (+) Swap WebLLM → Gemini mà không sửa use case
- (+) Thêm AI provider = thêm adapter
- (-) Nhiều interface file (overhead ban đầu)

**Source**: softwarepatternslexicon.com (#20), dev.to/ievgen_ch (#15), generalistprogrammer.com (#18)

---

### ADR-004: Shadow DOM cho overlay UI (word popup, highlight, subtitle overlay)

**Status**: Accepted

**Context**: Cell hiện tại không inject UI vào page. Orca cần: word popup, highlight `<mark>`, subtitle overlay, floating badge. Nếu không Shadow DOM → page CSS leak vào extension UI và ngược lại.

**Decision**:
- Mọi UI inject vào page → **Shadow DOM** (closed mode)
- Content script tạo Shadow root, mount React app bên trong
- CSS dùng `adoptedStyleSheets` hoặc `<style>` trong shadow root
- asbplayer pattern: iframe-isolated UI cho anki dialog, Shadow DOM cho subtitle overlay

**Consequences**:
- (+) Style isolation hoàn toàn
- (+) Page CSS không leak, extension CSS không leak ra
- (-) Event delegation phức tạp hơn (retargeting)
- (-) `adoptedStyleSheets` không hỗ trợ tất cả browser (Edge OK)

**Source**: dev.to/learcise_health (#36), sweets.chat (#36), asbplayer subtitle-controller

---

### ADR-005: Giữ CRXJS, không migrate WXT (chưa cần)

**Status**: Accepted

**Context**: Cell dùng @crxjs/vite-plugin 2.7.0. asbplayer dùng WXT 0.20. Synthesis đánh giá WXT tốt hơn cho production nhưng migration effort không nhỏ.

**Decision**: Giữ CRXJS cho Phase 1. Cân nhắc migrate WXT khi:
- Cần Firefox/Safari support (cross-browser)
- Code > 200 files (module system benefit)
- CRXJS maintenance dừng

**Consequences**:
- (+) Không mất thời gian migration
- (+) Anh yêu đã quen CRXJS
- (-) Không có auto-import, file-based entrypoint
- (-) WXT module system tốt hơn cho monorepo

**Source**: dev.to/quangpl (#39), redreamality.com (#38), extensionbooster.net (#40)

---

### ADR-006: Feature-based folders trong mỗi layer

**Status**: Accepted

**Context**: Cell hiện tại group theo technical (detectors/, parsers/, converters/). Khi thêm 18 features, technical grouping → 1 folder có 30+ files không liên quan.

**Decision**: Feature-based trong `application/` và `presentation/`:
```
application/
  word/           # LookupWord, SaveWord, UpdateStatus
  dict/           # ImportDict, LookupDict
  mining/         # MineCard, QuickAdd, CustomizeCard
  anki/           # ExportAnki, ImportAnki, SyncAnki
  srs/            # ReviewCard, StartSession, FilteredReview
  subtitle/       # DetectSubtitle, OverlaySubtitle, DualSubtitle
  bookmark/       # CreateBookmark, ListBookmarks
  sync/           # SyncDrive, MergeData
presentation/
  popup/          # existing
  overlay/        # word popup, highlight, subtitle overlay
  wordbook/       # vocabulary manager
  mining/         # flashcard creator
  srs/            # review session
  settings/       # settings (extend existing)
```

`infrastructure/` giữ technical grouping (theo adapter type) vì mỗi adapter là 1 implementation.

**Source**: EveVault (#30), Meelio (#29), dev.to/_arpy (#25)

---

### ADR-007: OCEAN Engine port — phrasal verb matching từ theocean-dict

**Status**: Accepted

**Context**: theocean-dict có OCEAN Engine: compile dict terms thành regex, match phrasal verbs/idioms trong context, scoring `(FixedWords × 10) + MatchLength`. Orca cần highlight phrasal verbs ("be under your nose", "give up on").

**Decision**: Port OCEAN Engine sang TypeScript, đặt trong `domain/dict/`:
- `oceanCompiler.ts` — compile term → regex (placeholders sth/sb/poss)
- `oceanMatcher.ts` — match trong sentence, scoring, top results
- `oceanStorage.ts` — CRUD phrasal_patterns trong Dexie
- `oceanMigration.ts` — scan dict entries → extract phrasal patterns lúc import

**Consequences**:
- (+) Highlight phrasal verbs (không chỉ single words)
- (+) Scoring algorithm đã validate
- (-) Regex compilation nặng → chạy trong offscreen hoặc Web Worker

**Source**: theocean-dict OCEAN_SCORING_ALGORITHM.md, OCEAN_ENGINE_MODULE_ARCHITECTURE.md

---

### ADR-008: Strategy pattern cho dict import (5 formats)

**Status**: Accepted

**Context**: Orca v3 import-dict đã có 5 strategies: TxtLine, JsonArray, Yomitan, SQLite (Migaku), CambridgeJson. Cell cần import cùng các format này.

**Decision**: Port Strategy pattern sang TypeScript:
```
infrastructure/dict/importers/
  BaseImportStrategy.ts       # template method
  TxtLineImporter.ts
  JsonArrayImporter.ts
  YomitanImporter.ts
  SQLiteImporter.ts           # sql.js WASM
  CambridgeJsonImporter.ts
  ImportStrategyFactory.ts    # format → strategy
```

**Consequences**:
- (+) Thêm format = thêm strategy, không sửa existing
- (+) Test mỗi strategy độc lập
- (-) BaseImportStrategy cần streaming parser (không load full file)

**Source**: Orca v3 strategies/ (#import-dict), Head First Design Patterns (Strategy)

---

### ADR-009: AnkiConnect integration — port từ asbplayer + theocean-dict

**Status**: Accepted

**Context**: asbplayer có `common/anki/anki.ts` (AnkiConnect API wrapper, field mapping, 3 export modes). theocean-dict có `ankiManager.js` (field mapping, duplicate detection, media upload). Cả 2 đều dùng `localhost:8765`.

**Decision**: Port + merge thành `infrastructure/anki/AnkiConnectExporter.ts`:
- AnkiConnect API: deckNames, modelNames, findNotes, addNote, updateNoteFields, storeMediaFile
- Field mapping: Orca field → Anki field (auto-map by name + manual)
- 3 export modes: default (addNote), updateLast (update last note), duplicate (allow dup)
- Duplicate detection: findNotes query before addNote
- Media: audio (Forvo → base64 → storeMediaFile), image (Google Images → base64)

**Consequences**:
- (+) 2-way sync (Orca ↔ Anki) qua timestamp merge
- (+) SM-2 → FSRS conversion khi import từ Anki
- (-) AnkiConnect chỉ chạy khi Anki desktop mở

**Source**: asbplayer common/anki/anki.ts, theocean-dict ankiManager.js, Wiki UC13

---

### ADR-010: Offscreen mở rộng — SQLite WASM + dict parse + AI + Whisper

**Status**: Accepted

**Context**: Cell hiện tại offscreen chỉ làm transmux. Orca cần offscreen cho: SQLite WASM (dict search), dict import parse (heavy), WebLLM (AI explain), Whisper STT (WASM). Chrome limit: 1 offscreen document tại 1 thời điểm.

**Decision**: Offscreen thành "compute hub" — 1 document, nhiều "services":
```
offscreen/
  ffmpeg.html              # entry HTML (giữ nguyên)
  ffmpegRunner.ts          # transmux (giữ nguyên)
  sqliteRunner.ts          # SQLite WASM — load .db, query FTS5
  dictImportRunner.ts      # parse Yomitan/SQLite/Cambridge → IndexedDB
  aiRunner.ts              # WebLLM Qwen2.5 — load model, inference
  whisperRunner.ts         # Whisper WASM — transcribe audio
  offscreenRouter.ts       # route message → đúng runner
```

OffscreenManager mở rộng: `ensureOffscreenReady` → route message theo type. Chỉ tạo offscreen khi cần, close khi idle (giảm RAM).

**Consequences**:
- (+) 1 offscreen document, nhiều services
- (+) SW không bị block bởi heavy compute
- (-) 1 service chạy → service khác phải chờ (queue)
- (-) RAM tăng khi nhiều service active

**Source**: Chrome offscreen docs (#26), sqlite-opfs-mv3 (#27), lit.build (#28)

---

## 4. Kiến trúc tổng thể (TO-BE)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CELL EXTENSION (MV3)                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Popup (React)│  │ Options Page │  │  Content Script       │  │
│  │  Zustand proxy│  │  (React)     │  │  + Shadow DOM overlay │  │
│  │              │  │              │  │  (word popup, highlight│  │
│  │ - Downloads  │  │ - Profile    │  │   subtitle overlay)    │  │
│  │ - Wordbook   │  │ - Dict mgr   │  │                       │  │
│  │ - Mining     │  │ - Settings   │  │  Thin: render + click  │  │
│  │ - SRS review │  │ - Anki sync  │  │  → message to SW       │  │
│  │ - Stats      │  │ - Sync       │  │                       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
│         │ chrome.runtime.sendMessage              │              │
│         ▼                                         ▼              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              SERVICE WORKER (Orchestrator)                  │ │
│  │                                                              │ │
│  │  MessageBus ──→ Handlers (per feature area)                  │ │
│  │    ├── download handlers (existing)                          │ │
│  │    ├── dict handlers (NEW: lookup, import, list)             │ │
│  │    ├── word handlers (NEW: save, update status, list)        │ │
│  │    ├── mining handlers (NEW: create card, quick add)         │ │
│  │    ├── anki handlers (NEW: export, import, sync)             │ │
│  │    ├── srs handlers (NEW: review, session, stats)            │ │
│  │    ├── subtitle handlers (NEW: overlay, dual, translate)     │ │
│  │    ├── ai handlers (NEW: explain, analyze)                   │ │
│  │    └── sync handlers (NEW: drive, merge)                     │ │
│  │                                                              │ │
│  │  Use Cases (application layer)                               │ │
│  │    LookupWordUseCase ──→ IDictRepository (port)              │ │
│  │    SaveWordUseCase ────→ IWordRepository (port)              │ │
│  │    MineCardUseCase ────→ ICardBuilder (port)                 │ │
│  │    ExportAnkiUseCase ──→ IAnkiExporter (port)                │ │
│  │    ReviewCardUseCase ──→ ISrsEngine (port)                   │ │
│  │                                                              │ │
│  │  State: chrome.storage.session (media/downloads)             │ │
│  │         chrome.storage.local (settings, auth)                │ │
│  └────────────────────────┬─────────────────────────────────────┘ │
│                           │ chrome.runtime.sendMessage             │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           OFFSCREEN DOCUMENT (Compute Hub)                  │ │
│  │                                                              │ │
│  │  offscreenRouter ──→ route by message type                   │ │
│  │    ├── ffmpegRunner (transmux TS→MP4)         [existing]     │ │
│  │    ├── sqliteRunner (SQLite WASM, FTS5 query) [NEW]          │ │
│  │    ├── dictImportRunner (parse Yomitan/SQLite) [NEW]         │ │
│  │    ├── aiRunner (WebLLM Qwen2.5 inference)    [NEW]          │ │
│  │    └── whisperRunner (Whisper WASM STT)       [NEW]          │ │
│  │                                                              │ │
│  │  Storage: OPFS (download files + SQLite .db)                 │ │
│  │  Workers: transmuxWorker, mp3EncoderWorker [NEW]             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              STORAGE LAYER                                   │ │
│  │                                                              │ │
│  │  Dexie (IndexedDB) — chạy ở mọi context:                    │ │
│  │    words (vocabulary entries, status, frequency)             │ │
│  │    cards (flashcard data, FSRS state)                        │ │
│  │    decks (deck tree, FSRS params)                            │ │
│  │    reviewLogs (rating, timestamp, interval)                  │ │
│  │    bookmarks (text, URL, tags)                               │ │
│  │    phrasalPatterns (OCEAN compiled regex)                    │ │
│  │    dictEntries (dictionary, per-resource)                    │ │
│  │    freqEntries (frequency lists)                             │ │
│  │                                                              │ │
│  │  SQLite WASM (offscreen only) — FTS5:                       │ │
│  │    dictionary_fts (full-text search, 150K+ entries)          │ │
│  │                                                              │ │
│  │  chrome.storage.local — settings, auth tokens                │ │
│  │  chrome.storage.session — media/downloads (SW restart)      │ │
│  │  OPFS — download files, SQLite .db file                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Message protocol mở rộng

### 5.1 Existing messages (giữ nguyên)
27 message types hiện tại (GET_DETECTED_MEDIA, DOWNLOAD_VIDEO, etc.)

### 5.2 NEW message types (theo feature area)

```typescript
// Dict
LOOKUP_WORD          { word, context, tabId } → { success, data: DictEntry[] }
IMPORT_DICTIONARY    { file, format, langProfileId } → { success, stats }
LIST_DICTIONARIES    { langProfileId } → { success, data: DictMeta[] }
TOGGLE_DICTIONARY    { dictId, isActive } → { success }
DELETE_DICTIONARY    { dictId } → { success }
UPDATE_DICT_ORDER    { dictIds[] } → { success }

// Vocabulary
SAVE_WORD            { word, status, context, langProfileId } → { success }
UPDATE_WORD_STATUS   { wordId, newStatus } → { success }
LIST_WORDS           { filter, pagination } → { success, data: WordEntry[] }
BULK_UPDATE_STATUS   { wordIds[], newStatus } → { success }
IMPORT_WORD_LIST     { text, format, defaultStatus } → { success, stats }
GET_WORD_HISTORY     { wordId } → { success, data: StatusHistory[] }

// Mining (Flashcard creation)
QUICK_ADD_CARD       { word, sentence, dictEntry, tabId } → { success, cardId }
CUSTOMIZE_CARD       { cardData } → { success, cardId }
SCREENSHOT_VIDEO     { tabId, timestamp } → { success, dataUrl }
FETCH_GOOGLE_IMAGES  { query } → { success, images[] }
BULK_CREATE_CARDS    { items[] } → { success, stats }

// Anki
ANKI_CONNECT_TEST    {} → { success, version }
ANKI_EXPORT          { cardIds[], deckMapping } → { success, stats }
ANKI_IMPORT          { ankiDeckName, fieldMapping } → { success, stats }
ANKI_SYNC            { direction, deckPairs[] } → { success, stats, conflicts }
ANKI_GET_DECKS       {} → { success, decks[] }

// SRS
START_REVIEW         { deckId?, filter? } → { success, cards[] }
REVIEW_CARD          { cardId, rating } → { success, nextDue }
UNDO_REVIEW          {} → { success, restoredCard }
GET_REVIEW_STATS     {} → { success, stats }
GET_DUE_COUNT        {} → { success, count }

// Subtitle overlay
DETECT_VIDEO_SUBTITLE  { tabId } → { success, tracks[] }
OVERLAY_SUBTITLE       { tabId, trackId, mode } → { success }
SEEK_SUBTITLE          { tabId, direction } → { success }
TOGGLE_DUAL_SUBTITLE   { tabId, show } → { success }
AUTO_TRANSLATE         { tabId, sentences[] } → { success, translations[] }

// AI
AI_EXPLAIN_WORD      { word, context, langProfileId } → { success, explanation }
AI_ANALYZE_SENTENCE  { sentence, langProfileId } → { success, analysis }
AI_GENERATE_EXAMPLE  { word, langProfileId } → { success, example }

// Sync
DRIVE_SYNC           {} → { success, stats }
DRIVE_MERGE          {} → { success, stats, conflicts }
GET_SYNC_LOG         {} → { success, logs[] }
GET_STORAGE_USAGE    {} → { success, breakdown }

// Bookmark
CREATE_BOOKMARK      { text, url, title, tags, sourceType } → { success }
LIST_BOOKMARKS       { filter } → { success, data[] }
DELETE_BOOKMARK      { bookmarkId } → { success }
```

### 5.3 Handler module per feature area
Mỗi feature area 1 handler module (không 1 file khổng lồ):
```
background/handlers/
  downloadHandlers.ts      (existing, refactor từ index.ts)
  dictHandlers.ts          (NEW)
  wordHandlers.ts          (NEW)
  miningHandlers.ts        (NEW)
  ankiHandlers.ts          (NEW)
  srsHandlers.ts           (NEW)
  subtitleHandlers.ts      (NEW)
  aiHandlers.ts            (NEW)
  syncHandlers.ts          (NEW)
  bookmarkHandlers.ts      (NEW)
```

---

## 6. Dexie schema (IndexedDB)

```typescript
// infrastructure/storage/DexieDB.ts
import Dexie, { Table } from 'dexie';

export class CellDB extends Dexie {
  // Vocabulary
  words!: Table<WordEntry, string>;
  wordHistory!: Table<StatusHistory, string>;

  // Flashcards
  cards!: Table<CardData, string>;
  decks!: Table<Deck, string>;
  reviewLogs!: Table<ReviewLog, string>;

  // Dictionary (per-language, per-resource)
  dictResources!: Table<DictResource, string>;
  dictEntries!: Table<DictEntry, number>;
  freqEntries!: Table<FreqEntry, number>;
  phrasalPatterns!: Table<PhrasalPattern, number>;

  // Bookmarks
  bookmarks!: Table<Bookmark, string>;

  // Settings (per-language-profile)
  languageProfiles!: Table<LanguageProfile, string>;

  constructor() {
    super('CellDB');
    this.version(1).stores({
      words: 'id, word, langProfileId, status, frequencyRank, [langProfileId+status], [langProfileId+word]',
      wordHistory: 'id, wordId, timestamp, [wordId+timestamp]',

      cards: 'id, wordId, deckId, state, due, [deckId+due], [deckId+state]',
      decks: 'id, name, parentId, langProfileId',
      reviewLogs: 'id, cardId, timestamp, [cardId+timestamp]',

      dictResources: 'id, name, lang, type, isActive, sortOrder, [lang+isActive]',
      dictEntries: '++id, termKey, backwardTerm, resourceId, [resourceId+termKey], *lemmas',
      freqEntries: '++id, termKey, resourceId, [resourceId+termKey]',
      phrasalPatterns: '++id, anchorWord, resourceId, [anchorWord+priority]',

      bookmarks: 'id, url, title, createdAt, *tags',
      languageProfiles: 'id, lang, isActive',
    });
  }
}
```

**Key design decisions**:
- `backwardTerm` (reversed string) cho suffix search — port từ Orca v3
- Compound indexes `[langProfileId+status]` cho filter queries
- `*lemmas` multi-entry index cho lemma-based lookup
- `[anchorWord+priority]` cho OCEAN phrasal matching
- `dictEntries` dùng autoIncrement id (Orca v3 pattern) vì termKey không unique (nhiều dict)

---

## 7. Lộ trình tích hợp (Migration Roadmap)

### Phase 0: Foundation (2-3 tuần)
1. Tạo `domain/` layer — move pure types từ `types/` sang `domain/`
2. Tạo `application/` skeleton — port interfaces (IWordRepository, IDictRepository, etc.)
3. Setup Dexie (`infrastructure/storage/DexieDB.ts`) + migration từ chrome.storage
4. Refactor `background/index.ts` → tách handlers vào `background/handlers/`
5. **Không break existing features** — refactor dần, giữ backward compat

### Phase 1: Dictionary + Vocabulary (4-6 tuần)
1. `infrastructure/dict/` — SQLite WASM runner trong offscreen
2. Port 5 import strategies từ Orca v3
3. `application/dict/` — ImportDictUseCase, LookupDictUseCase
4. `application/word/` — SaveWordUseCase, LookupWordUseCase, UpdateStatusUseCase
5. Content script overlay — Shadow DOM word popup + highlight
6. Port OCEAN Engine (phrasal matching)
7. Popup tab: Dictionary manager + Vocabulary manager

### Phase 2: Flashcard + Anki + SRS (4-6 tuần)
1. `infrastructure/anki/AnkiConnectExporter.ts` — port từ asbplayer + theocean-dict
2. `application/mining/` — MineCardUseCase, QuickAddUseCase
3. `application/srs/` — ReviewCardUseCase + FsrsEngine
4. Popup tab: Flashcard creator + SRS review (Ocean Memory)
5. Anki 2-way sync (SM-2 ↔ FSRS conversion)
6. Screenshot video frame + Google Images integration

### Phase 3: Subtitle overlay + Video learning (3-4 tuần)
1. Content script subtitle overlay (Shadow DOM, asbplayer pattern)
2. `application/subtitle/` — OverlaySubtitleUseCase, DualSubtitleUseCase
3. Video learning mode (auto-pause, A/S/D navigation)
4. Auto-translate (AI local → Google Translate fallback)
5. Bulk create flashcards từ transcript

### Phase 4: AI + Sync + Polish (3-4 tuần)
1. `infrastructure/ai/` — WebLLM provider + Ollama provider
2. `application/ai/` — ExplainWordUseCase, AnalyzeSentenceUseCase
3. Google Drive sync (incremental, per-record merge)
4. Statistics (heatmap, retention, CEFR estimate)
5. Settings expansion (AI prompts, TTS, keyboard shortcuts, blacklist)
6. Least privilege — thu hẹp host_permissions, thêm optional_permissions

### Phase 5: Advanced (ongoing)
- Whisper STT (WASM, offscreen)
- Podcast support
- EPUB/PDF reader
- Clipboard sessions
- Mobile (Flutter) — share data layer qua Drive sync

---

## 8. Fitness functions (Architecture validation)

```typescript
// tests/architecture/fitness.test.ts

// F1: Dependency rule — domain không import infrastructure
test('domain/ has no infrastructure imports', () => {
  const domainFiles = glob('src/domain/**/*.ts');
  domainFiles.forEach(file => {
    const content = read(file);
    expect(content).not.toMatch(/from ['"].*infrastructure/);
    expect(content).not.toMatch(/from ['"].*chrome/);
  });
});

// F2: Application không import infrastructure trực tiếp (chỉ qua ports)
test('application/ imports only domain/ and ports', () => {
  const appFiles = glob('src/application/**/*.ts');
  appFiles.forEach(file => {
    const content = read(file);
    expect(content).not.toMatch(/from ['"].*infrastructure/);
    expect(content).not.toMatch(/from ['"].*chrome/);
  });
});

// F3: Bundle size budget
test('popup bundle < 200KB gzipped', async () => {
  const stats = await buildPopup();
  expect(stats.gzipSize).toBeLessThan(200_000);
});

// F4: SW cold start < 100ms
test('SW registers handlers < 100ms', async () => {
  const start = performance.now();
  await import('../src/background/index');
  expect(performance.now() - start).toBeLessThan(100);
});

// F5: Dict lookup < 30ms
test('dict FTS5 lookup < 30ms for 150K entries', async () => {
  const db = await loadTestDictDB();
  const start = performance.now();
  await db.search('hello');
  expect(performance.now() - start).toBeLessThan(30);
});

// F6: No global state in SW
test('background/ has no module-level mutable state', () => {
  const bgFiles = glob('src/background/**/*.ts');
  bgFiles.forEach(file => {
    const content = read(file);
    // Allow const, allow Map/Array inside class, ban bare let/var at top level
    expect(content).not.toMatch(/^let \w+/m);
    expect(content).not.toMatch(/^var \w+/m);
  });
});
```

**Source**: Neal Ford & Mark Richards, Fundamentals of Software Architecture (#6, #8)

---

## 9. Risk assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| SQLite WASM bundle quá lớn | Medium | Medium | Lazy load trong offscreen, chỉ load khi cần dict |
| Offscreen 1-at-a-time bottleneck | High | High | Queue messages, priority (transmux > dict > AI) |
| Dexie + SQLite sync phức tạp | Medium | Medium | Dict = read-only (SQLite), user data = Dexie (no sync needed between them) |
| Shadow DOM event retargeting | Low | Low | Test trên Chrome + Edge, dùng composedPath() |
| AnkiConnect chỉ localhost | High | Medium | Fallback .apkg export (file download), clear error message |
| WebLLM RAM > 500MB | High | High | Auto-select model theo RAM (Lite 1.5B / Standard 3B / Pro 7B) |
| CRXJS maintenance dừng | Medium | Medium | ADR-005: sẵn sàng migrate WXT khi cần |
| Refactor break existing | Medium | High | Phase 0 không break, gradual migration, E2E tests guard |

---

## 10. Tóm tắt CTO decision

| # | Decision | Rationale | Reversible? |
|---|---|---|---|
| ADR-001 | Layered Clean Architecture | Scale 18 features, testable, swappable | Yes (gradual) |
| ADR-002 | Dexie + SQLite WASM split | FTS5 cho dict, Dexie cho user data | Yes (adapter pattern) |
| ADR-003 | Ports & Adapters | Swap AI/storage/Anki providers | Yes (by design) |
| ADR-004 | Shadow DOM overlay | Style isolation, page CSS không leak | No (architectural) |
| ADR-005 | Giữ CRXJS | Không migration cost now | Yes (migrate WXT sau) |
| ADR-006 | Feature-based folders | Scale team, add/remove features | Yes (refactor folders) |
| ADR-007 | Port OCEAN Engine | Phrasal verb matching, validated algo | Yes (module) |
| ADR-008 | Strategy pattern import | 5 formats, extensible | Yes (add strategy) |
| ADR-009 | Port AnkiConnect | 2-way sync, validated by asbplayer + theocean | Yes (adapter) |
| ADR-010 | Offscreen compute hub | 1 document, nhiều services, SW không block | Partial (queue logic) |

**CTO principle applied**: Think deeply (ADR-001, 002, 004 — irreversible), implement slowly (Phase 0-5 roadmap, gradual migration), validate with fitness functions (Section 8).

---

## References

### Wiki & Synthesis
- Orca Wiki: 130 UC (UC01-UC17), 5 chương, `docs/.project-wiki/`
- Architecture Synthesis: 12 nguyên tắc P1-P12, `docs/reference/architecture-research-synthesis.md`

### Reference projects
- asbplayer-1.18.0: `project-reference/asbplayer-1.18.0/` (WXT, Dexie, AnkiConnect, subtitle overlay)
- import-dict Orca v3: `project-reference/import dictioanry and requency list for theocean-extension-dictionary/` (Repository pattern, Strategy pattern, IndexedDB)
- theocean-dict: `project-reference/theocean-extension-dictionary/` (OCEAN Engine, AnkiConnect, content script popup)

### Architecture sources (34)
- Books: System Design Guide (2024), Designing Software Architectures (2024), Fundamentals of Software Architecture (Ford & Richards), Software Architecture and Decision-Making (O'Reilly)
- Chrome Extension: dev.to/hewitt, GoogleChrome/modern-web-guidance, codemyextension.com, dev.to/ievgen_ch, dev.to/extinde
- Clean/Hexagonal: generalistprogrammer.com, saadh393, Better Programming, dev.to/dyarleniber
- CTO/ADR: InfoQ, github.com/architecture-decision-record, GOV.UK, fastercapital.com, aalpha.net, ctoframework.com
- Monorepo/Extension: Meelio (GitHub), EveVault (GitHub), SessionKeeper (GitHub), bestchromeextensions.com
- Video: Neal Ford & Mark Richards O'Reilly courses (Fundamentals, Architecture Patterns)

### Reading summaries
- `docs/reading-summaries/phase-1-wiki-chapters.md`
- `docs/reading-summaries/phase-2a-uc01-uc04.md` → `phase-2d-uc14-uc17.md`
- `docs/reading-summaries/phase-4-cell-src.md`
- `docs/reading-summaries/phase-5-asbplayer.md`
- `docs/reading-summaries/phase-6-import-dict.md`
- `docs/reading-summaries/phase-7-theocean-dict.md`
