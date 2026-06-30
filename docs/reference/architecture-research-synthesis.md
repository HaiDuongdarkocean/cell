# Cell Architecture Research — 30+ Sources Synthesis

> Nghiên cứu kiến trúc cho Chrome extension + software architecture chung,
> tổng hợp từ 30+ nguồn (Chrome docs, DEV, Medium, GitHub, npm, academic papers, framework docs).
> Áp dụng cho Cell — open-core multi-language learning platform extension.

---

## A. Nguồn đã đọc (30+ nguồn, phân loại)

### Chrome Extension Official (5)
1. **Service Worker Lifecycle** — developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
2. **Handle Events with Service Workers** — developer.chrome.com/docs/extensions/get-started/tutorial/service-worker-events
3. **Migrate to Service Worker (MV3)** — developer.chrome.com/docs/extensions/develop/migrate/to-service-workers
4. **Message Passing** — developer.chrome.com/docs/extensions/develop/concepts/messaging
5. **Content Scripts** — developer.chrome.com/docs/extensions/develop/concepts/content-scripts

### Extension Architecture Patterns (5)
6. **Extension Architecture Patterns (MV3)** — codemyextension.com/resources/extension-architecture
7. **How to Structure a Production-Ready Chrome Extension (MV3)** — dev.to/hewitt
8. **Chrome Extension Development with Clean Architecture (PoC)** — Medium @lucas.abgodoy
9. **We Built a Chrome Extension With Clean Architecture** — dev.to/ievgen_ch
10. **Extension Messaging Across Contexts** — extension.js.org/docs/implementation-guide/messaging

### State Management (5)
11. **webext-redux** — github.com/tshaddix/webext-redux (proxy store pattern)
12. **webext-zustand** — github.com/sinanbekar/webext-zustand (Zustand + extension sync)
13. **@webext-pegasus/store-zustand** — npmjs.com (MV3-aware Zustand adapter)
14. **Zustand State Management in Chrome Extensions** — bestchromeextensions.com
15. **synco-redux** — github.com/justinasci/synco-redux (port-based sync)

### Clean Architecture / DDD / SOLID (6)
16. **Clean Architecture on Frontend** — bespoyasov.me/blog/clean-architecture-on-frontend
17. **Clean Architecture with TypeScript: DDD, Onion** — bazaglia.com
18. **The Clean Architecture using React and TypeScript** — Medium @rostislavdugin
19. **Does DDD Belong on the Frontend?** — khalilstemmler.com
20. **Hexagonal Architecture: Ports and Adapters in TypeScript** — softwarepatternslexicon.com
21. **SOLID Principles in TypeScript** — khalilstemmler.com + LogRocket + Strapi

### Monorepo / Folder Structure (4)
22. **Chrome Extension Monorepo Setup** — bestchromeextensions.com/docs/guides/chrome-extension-monorepo
23. **EveVault Monorepo (WXT + feature-based)** — github.com/evefrontier/evevault
24. **WXT Layers Module** — github.com/davestewart/wxt-module-layers
25. **From Spaghetti to Scalable Frontend** — dev.to/_arpy

### Offscreen / OPFS / Workers (4)
26. **chrome.offscreen API** — developer.chrome.com/docs/extensions/reference/api/offscreen
27. **sqlite-opfs-mv3** — github.com/clmnin/sqlite-opfs-mv3 (SQLite in offscreen + OPFS)
28. **Beyond MediaRecorder: WebCodecs + OPFS** — lit.build/blog
29. **Screen Recorder Studio (OPFS pipeline)** — github.com/screen-recorder-studio/screen-recorder

### Testing (3)
30. **E2E Tests for Chrome Extensions with Playwright + CDP** — dev.to/corrupt952
31. **Playwright E2E testing for extensions** — extension.js.org/docs/workflows/playwright-e2e
32. **Unit testing Chrome Extensions** — developer.chrome.com/docs/extensions/how-to/test/unit-testing

### Security / Performance / Build (5)
33. **Lazy loading heavy libraries in extensions** — extension.js.org/docs/implementation-guide/lazy-loading
34. **Performance Playbook** — extension.js.org/docs/workflows/performance-playbook
35. **Code Splitting + Tree Shaking** — extensionbooster.net/blog
36. **Shadow DOM in Chrome Extensions** — dev.to/learcise_health + sweets.chat
37. **Least Privilege in Chrome Extensions** — link.springer.com/article/10.1007/s10207-022-00610-w

### Framework Comparison (3)
38. **2025 State of Browser Extension Frameworks** — redreamality.com
39. **Plasmo vs CRXJS vs WXT 2026** — dev.to/quangpl
40. **I Built the Same Extension With 5 Frameworks** — extensionbooster.net

### IndexedDB / Dexie (2)
41. **Chrome Extension IndexedDB Guide** — bestchromeextensions.com/docs/guides/chrome-extension-indexeddb-storage
42. **Dexie.js Design** — dexie.org/docs/Tutorial/Design

---

## B. 12 Nguyên tắc kiến trúc rút ra cho Cell

### P1: Service Worker là orchestrator, không phải compute
> Nguồn: #1, #2, #3, #7, #33

MV3 service worker **ephemeral** — Chrome kill sau ~30s inactivity, restart trên event tiếp theo. Mọi state trong global variable **MẤT** khi worker terminate.

**Quy tắc**:
- SW chỉ làm: route message, register listener, orchestrate
- Heavy compute (parse, encode, AI) → **offscreen document** (tạo on-demand, close khi xong)
- State persist → `chrome.storage.local` (settings) hoặc IndexedDB (word DB, cards)
- Event listener **phải** register ở top-level scope (không trong async/promise)
- Dùng `chrome.alarms` thay cho `setTimeout/setInterval` (worker có thể terminate giữa chừng)

**Cell áp dụng**: Cell hiện tại đã đúng — SW là orchestrator, offscreen làm transmux. Khi thêm dict lookup + AI explain, **không** chạy trong SW → delegate offscreen hoặc content script.

---

### P2: Content Script mỏng, delegate cho background
> Nguồn: #4, #5, #7, #9, #10

Content script chạy trong **isolated world** của page — không access `window` của page, không access Chrome API privileged (chỉ qua message).

**Quy tắc**:
- CS chỉ làm: đọc DOM, inject UI overlay, gửi data về SW
- **Không** business logic trong CS
- CS gửi message tối thiểu (chỉ data cần thiết, không spam)
- Privileged work (storage, API call, download) → SW
- Validate sender trước khi SW thực hiện privileged action (security)

**Cell áp dụng**: Overlay renderer (C1) trong CS — chỉ render + capture click → gửi word về SW → SW lookup dict → trả result. CS **không** query IndexedDB trực tiếp (IndexedDB trong CS có thể nhưng tốt hơn delegate SW cho consistency).

---

### P3: Message protocol typed + validated
> Nguồn: #4, #10, #6

**Quy tắc**:
- Mọi message có `type` explicit (string literal union)
- Payload typed (TypeScript interface)
- Validate payload shape trước khi act
- Validate `sender` cho privileged action
- Return structured `{ success, data?, error? }` thay vì throw
- 1 handler module per feature area (không 1 file khổng lồ)

**Cell áp dụng**: Cell hiện tại đã có `MESSAGE_TYPES` + `MessageRequest/MessageResponse`. Mở rộng: thêm `dict/`, `mining/`, `anki/` feature area, mỗi area 1 handler module.

---

### P4: Single source of truth — state ở background, proxy ở UI
> Nguồn: #11, #12, #13, #14, #15

Extension có nhiều context (SW, popup, content script, options) — mỗi context có memory riêng. State sync là **vấn đề khó nhất**.

**Pattern** (webext-redux / webext-zustand / pegasus):
- **Main store ở background** (SW) = single source of truth
- **Proxy store ở popup/CS** = forward action → SW, nhận state update broadcast
- SW persist state vào `chrome.storage` (chống terminate)

**Cell áp dụng**: Cell hiện tại dùng Zustand ở popup + `chrome.storage.local` cho settings. Khi thêm wordbook/mining, **giữ pattern này**:
- Word DB trong IndexedDB (offscreen document, vì SW không có IndexedDB trực tiếp — thực ra SW có IndexedDB nhưng ephemeral context, tốt hơn delegate offscreen)
- Settings trong `chrome.storage.local`
- Popup store = Zustand proxy, sync với SW

---

### P5: Layered architecture — domain / application / infrastructure / presentation
> Nguồn: #8, #9, #16, #17, #18, #20

Clean Architecture cho extension (theo dev.to/ievgen_ch — đã áp dụng thực tế):

```
src/
  domain/          # Pure types, entities, ZERO dependency (no chrome.*, no React)
  application/     # Use cases + port interfaces (abstract)
  infrastructure/  # Chrome APIs, IndexedDB, HTTP, dict loader (implements ports)
  presentation/    # React components + hooks (popup, overlay UI)
  entrypoints/     # WXT/CRXJS entry (background.ts, content.ts, popup/main.tsx)
```

**Quy tắc**:
- `domain/` KHÔNG import gì ngoài TypeScript stdlib
- `application/` import `domain/` + define port interfaces (KHÔNG import infrastructure)
- `infrastructure/` implements ports, import `application/` (dependency inversion)
- `presentation/` import `application/` (use cases) + `domain/` (types)
- `entrypoints/` wire everything (composition root — instantiate adapters, inject vào use cases)

**Cell áp dụng**: Cell hiện tại chưa phân layer rõ — `lib/` trộn domain + infrastructure. **Refactor dần**:
- `domain/`: WordEntry, Wordbook, CardData, DictEntry types (pure)
- `application/`: LookupWordUseCase, SaveWordUseCase, MineCardUseCase, ExportAnkiUseCase + port interfaces (IWordRepository, IDictRepository, IAnkiExporter)
- `infrastructure/`: IndexedDBWordRepository, YomitanDictRepository, ApkgAnkiExporter, ChromeStorageAdapter
- `presentation/`: popup components, overlay components
- `entrypoints/`: background/index.ts, content/content-script.ts, popup/main.tsx

---

### P6: Hexagonal — ports & adapters (dependency inversion)
> Nguồn: #20, #21, #16, #17

**Port** = interface declare "domain cần gì". **Adapter** = implementation cụ thể.

```
domain ← (depends on) ← application/ports (interfaces)
                              ↑ implements
                    infrastructure/adapters
```

**Ví dụ Cell**:
- Port: `IWordRepository { save(word), findById(id), list(wordbookId) }`
- Adapter: `IndexedDBWordRepository` (implements IWordRepository, dùng Dexie)
- Use case: `SaveWordUseCase` depends on `IWordRepository` (KHÔNG depends on IndexedDB trực tiếp)
- Test: mock `IWordRepository` = `InMemoryWordRepository`, không cần IndexedDB

**Lợi ích**:
- Swap IndexedDB → SQLite WASM (offscreen) mà không sửa use case
- Test use case không cần browser
- Thêm cloud sync (P4) = thêm `CloudWordRepository` adapter, không sửa domain

---

### P7: Feature-based folder trong mỗi layer
> Nguồn: #22, #23, #24, #25

Thay vì group theo technical (all controllers, all services), group theo **feature**:

```
src/
  domain/
    word/           # Word entity, WordStatus type
    card/           # CardData entity
    dict/           # DictEntry type
  application/
    word/
      ports/IWordRepository.ts
      use-cases/SaveWordUseCase.ts
      use-cases/LookupWordUseCase.ts
    mining/
      ports/ICardBuilder.ts
      use-cases/MineCardUseCase.ts
    anki/
      ports/IAnkiExporter.ts
      use-cases/ExportAnkiUseCase.ts
  infrastructure/
    word/IndexedDBWordRepository.ts
    dict/YomitanDictRepository.ts
    anki/ApkgAnkiExporter.ts
    anki/AnkiConnectExporter.ts
  presentation/
    wordbook/        # Wordbook UI feature
    mining/          # Mining queue UI feature
    overlay/         # In-page overlay UI feature
    settings/        # Settings UI feature
```

**Lợi ích**: thêm feature mới = thêm folder, không sửa feature cũ. Xóa feature = xóa folder.

---

### P8: Offscreen document cho heavy compute + OPFS + Web Worker
> Nguồn: #26, #27, #28, #29, #3

SW **không có** DOM, **không start** Web Worker trực tiếp, **không có** OPFS sync access. Offscreen document = bridge.

**Quy tắc**:
- Offscreen document = HTML tĩnh, tạo on-demand via `chrome.offscreen.createDocument`
- Trong offscreen: tạo Web Worker, access OPFS, chạy WASM
- SW → offscreen: message qua `chrome.runtime.sendMessage`
- Offscreen → Worker: `postMessage` + Transferable Objects (zero-copy)
- **1 offscreen document tại 1 thời điểm** (Chrome limit)

**Cell áp dụng**: Cell hiện tại đã dùng offscreen cho transmux. **Mở rộng**:
- Offscreen cũng host SQLite WASM (cho word DB nếu cần SQL query phức tạp) — hoặc dùng Dexie/IndexedDB trực tiếp (đơn giản hơn, đủ cho MVP)
- AI Explain (ChatGPT call) → chạy trong offscreen (fetch + parse, không block SW)
- Dict load (Yomitan .zip parse) → offscreen (heavy parse, 1 lần)

---

### P9: Shadow DOM cho overlay UI (style isolation)
> Nguồn: #34, #35, #36

Content script inject UI vào page → **page CSS leak** vào extension UI (và ngược lại).

**Quy tắc**:
- Mọi UI inject vào page (overlay, popup lookup) → **Shadow DOM**
- CSS trong Shadow DOM scoped, không leak ra page
- Page CSS không leak vào Shadow DOM
- Dùng `adoptedStyleSheets` hoặc `<style>` trong shadow root

**Cell áp dụng**: Overlay subtitle (C1) + lookup popup (C4) → Shadow DOM. Cell hiện tại (downloader) không inject UI vào page, nhưng khi thêm overlay → **bắt buộc Shadow DOM**.

---

### P10: Least privilege — permission tối thiểu
> Nguồn: #37, #38, #39, #40

**Quy tắc**:
- Chỉ request permission thực sự cần
- Dùng `activeTab` thay `all_urls` khi có thể
- `optional_permissions` cho feature phụ (user grant khi cần)
- `host_permissions` tối thiểu (chỉ site cần inject)
- Permission warning = user trust — càng ít warning càng nhiều install

**Cell áp dụng**:
- `activeTab` + `scripting` cho overlay inject (không `all_urls`)
- `storage` cho settings + word DB
- `offscreen` cho transmux + AI + dict
- `downloads` cho .apkg export
- `tabCapture` cho audio recording (optional, grant khi mine)
- Host: YouTube, Netflix, Coursera, Udemy, TED (không `*://*/*`)

---

### P11: Lazy load + code split per surface
> Nguồn: #33, #34, #35

**Quy tắc**:
- SW: static import chỉ glue code (routing, listener). Heavy → offscreen (lazy tạo)
- Popup: dynamic `import()` cho feature phụ (dict manager, mining queue) — popup mở nhanh
- Content script: chunk overlay UI riêng, load khi cần
- `target: 'chrome110'` (skip polyfill modern syntax)
- Tree shake: lodash-es thay lodash, dayjs thay moment

**Cell áp dụng**:
- Popup: tab Download (existing) load ngay, tab Wordbook/Mining/Dict lazy import
- Overlay: inject content script nhẹ, dynamic import overlay module khi video detected
- Dict: load Yomitan dict lazy (lần đầu lookup), cache trong IndexedDB

---

### P12: Test pyramid — 80% unit, 15% integration, 5% e2e
> Nguồn: #30, #31, #32, #6

**Quy tắc**:
- **Unit** (80%): domain logic, use cases, parsers, converters — mock ports, không cần browser
- **Integration** (15%): adapter + Chrome API mock (jest + chrome mock), IndexedDB fake
- **E2E** (5%): Playwright + CDP, load extension thật, test flow end-to-end
- Mock Chrome API deterministic (không wait real browser)
- Lighthouse budget trong CI (bundle size, performance)

**Cell áp dụng**: Cell hiện tại đã có Jest (unit + integration) + Playwright (e2e). **Mở rộng**:
- Unit test use cases (SaveWordUseCase, LookupWordUseCase, ExportAnkiUseCase) với mock IWordRepository
- Integration test IndexedDBWordRepository với fake IndexedDB (fake-indexeddb)
- E2E test flow: open YouTube → overlay → click word → lookup → save → export .apkg

---

## C. Kiến trúc Cell đề xuất (áp dụng 12 nguyên tắc)

```
cell/
├── src/
│   ├── domain/                    # P5: Pure types, ZERO dependency
│   │   ├── word/
│   │   │   ├── WordEntry.ts       # Entity: id, word, reading, language, status, context
│   │   │   ├── WordStatus.ts      # Type: 'unknown'|'learning'|'known'|'ignored'
│   │   │   └── Wordbook.ts        # Entity: id, name, language, wordIds
│   │   ├── card/
│   │   │   ├── CardData.ts        # Entity: sentence, cloze, audio, screenshot, definition
│   │   │   └── MiningItem.ts      # Entity: cardData + exportStatus
│   │   ├── dict/
│   │   │   ├── DictEntry.ts       # Entity: word, reading, definition, pos, frequency
│   │   │   └── DictSource.ts      # Type: 'yomitan'|'ai'|'user'
│   │   ├── subtitle/
│   │   │   ├── Cue.ts             # Entity: startTime, endTime, text, words
│   │   │   └── SubtitleTrack.ts   # Entity: cues[], language, source
│   │   └── shared/
│   │       ├── Result.ts          # Result<T,E> type (success/error)
│   │       └── EntityId.ts        # branded type UUID
│   │
│   ├── application/               # P5: Use cases + ports (abstract)
│   │   ├── word/
│   │   │   ├── ports/
│   │   │   │   └── IWordRepository.ts
│   │   │   ├── use-cases/
│   │   │   │   ├── SaveWordUseCase.ts
│   │   │   │   ├── LookupWordUseCase.ts
│   │   │   │   ├── UpdateWordStatusUseCase.ts
│   │   │   │   └── ListWordsUseCase.ts
│   │   │   └── wordService.ts     # Facade aggregating use cases
│   │   ├── dict/
│   │   │   ├── ports/
│   │   │   │   └── IDictRepository.ts
│   │   │   ├── use-cases/
│   │   │   │   ├── LookupInDictUseCase.ts
│   │   │   │   └── LoadDictUseCase.ts
│   │   ├── mining/
│   │   │   ├── ports/
│   │   │   │   ├── ICardBuilder.ts
│   │   │   │   └── IAudioCapture.ts
│   │   │   ├── use-cases/
│   │   │   │   ├── MineCardUseCase.ts
│   │   │   │   └── ListMiningQueueUseCase.ts
│   │   ├── anki/
│   │   │   ├── ports/
│   │   │   │   └── IAnkiExporter.ts
│   │   │   ├── use-cases/
│   │   │   │   ├── ExportApkgUseCase.ts
│   │   │   │   └── ExportAnkiConnectUseCase.ts
│   │   └── overlay/
│   │       ├── ports/
│   │       │   ├── IVideoElement.ts
│   │       │   └── ISubtitleSource.ts
│   │       ├── use-cases/
│   │       │   ├── RenderOverlayUseCase.ts
│   │       │   └── HandleWordClickUseCase.ts
│   │
│   ├── infrastructure/            # P5+P6: Adapters (implements ports)
│   │   ├── storage/
│   │   │   ├── IndexedDBWordRepository.ts   # implements IWordRepository (Dexie)
│   │   │   ├── ChromeSettingsAdapter.ts     # chrome.storage.local
│   │   │   └── db.ts                        # Dexie schema + migrations
│   │   ├── dict/
│   │   │   ├── YomitanDictRepository.ts     # implements IDictRepository
│   │   │   ├── YomitanFormatParser.ts       # parse Yomitan .zip
│   │   │   └── AIExplainAdapter.ts          # ChatGPT fallback
│   │   ├── mining/
│   │   │   ├── TabCaptureAudioAdapter.ts    # implements IAudioCapture
│   │   │   ├── ScreenshotAdapter.ts         # chrome.tabs.captureVisibleTab
│   │   │   └── CardBuilderAdapter.ts        # implements ICardBuilder
│   │   ├── anki/
│   │   │   ├── ApkgAnkiExporter.ts          # implements IAnkiExporter (.apkg)
│   │   │   ├── AnkiConnectExporter.ts       # implements IAnkiExporter (HTTP)
│   │   │   └── genankiPort.ts               # Anki package format
│   │   ├── overlay/
│   │   │   ├── siteAdapters/
│   │   │   │   ├── YouTubeAdapter.ts        # implements ISubtitleSource
│   │   │   │   ├── NetflixAdapter.ts
│   │   │   │   ├── EducationalAdapter.ts
│   │   │   │   └── GenericAdapter.ts
│   │   │   └── ShadowDomOverlayRenderer.ts  # implements overlay rendering
│   │   ├── download/                         # EXISTING Cell (keep)
│   │   │   ├── NetworkInterceptor.ts
│   │   │   ├── Downloader.ts
│   │   │   ├── DownloadQueue.ts
│   │   │   ├── AutoDownload.ts
│   │   │   └── OffscreenManager.ts
│   │   ├── transmux/                         # EXISTING Cell (keep)
│   │   │   ├── TsTransmuxer.ts
│   │   │   ├── ParallelTransmuxer.ts
│   │   │   └── ... (existing converters)
│   │   └── parsers/                          # EXISTING Cell (keep, REUSE for overlay)
│   │       ├── M3u8Parser.ts
│   │       ├── AssParser.ts
│   │       ├── VttParser.ts
│   │       └── SrtParser.ts
│   │
│   ├── presentation/              # P5: React components + hooks
│   │   ├── popup/                 # EXISTING + extend
│   │   │   ├── (existing download UI)
│   │   │   ├── wordbook/          # NEW feature
│   │   │   ├── mining/            # NEW feature
│   │   │   ├── dict/              # NEW feature
│   │   │   └── settings/          # extend existing
│   │   ├── overlay/               # NEW — in-page UI
│   │   │   ├── SubtitleOverlay.tsx
│   │   │   ├── DualSubtitleLayer.tsx
│   │   │   ├── LookupPopup.tsx
│   │   │   ├── CardPreview.tsx
│   │   │   └── PlaybackControls.tsx
│   │   └── shared/                # shared UI components
│   │       ├── Button.tsx
│   │       ├── Toast.tsx
│   │       └── Badge.tsx
│   │
│   ├── entrypoints/               # P5: Composition root (wire adapters → use cases)
│   │   ├── background/
│   │   │   ├── index.ts           # SW entry: register listeners, wire adapters
│   │   │   ├── handlers/          # P3: 1 handler per feature
│   │   │   │   ├── wordHandler.ts
│   │   │   │   ├── dictHandler.ts
│   │   │   │   ├── miningHandler.ts
│   │   │   │   ├── ankiHandler.ts
│   │   │   │   └── downloadHandler.ts  # existing
│   │   │   └── messageBus.ts      # existing (keep)
│   │   ├── content/
│   │   │   ├── content-script.ts  # CS entry: inject overlay, capture click → message
│   │   │   └── overlayBridge.ts   # bridge: CS ↔ SW message for overlay
│   │   ├── offscreen/
│   │   │   ├── ffmpegRunner.ts    # existing (keep)
│   │   │   ├── transmuxWorker.ts  # existing (keep)
│   │   │   ├── dictLoader.ts      # NEW — load Yomitan dict in offscreen
│   │   │   └── aiExplainRunner.ts # NEW — ChatGPT call in offscreen
│   │   └── popup/
│   │       └── main.tsx           # existing (extend — wire use cases)
│   │
│   ├── constants/                 # EXISTING (keep)
│   │   ├── config.ts
│   │   ├── messages.ts            # P3: typed message constants
│   │   └── urls.ts
│   │
│   └── types/                     # EXISTING (keep + extend)
│       ├── media.ts               # existing
│       ├── message.ts             # existing
│       └── muxjs.d.ts             # existing
│
├── tests/                         # P12: test pyramid
│   ├── unit/                      # 80% — domain + use cases (mock ports)
│   ├── integration/               # 15% — adapters + Chrome mock
│   └── e2e/                       # 5% — Playwright full flow
│
├── manifest.json                  # P10: least privilege
├── package.json
├── vite.config.ts                 # P11: code split per surface
└── tsconfig.json
```

---

## D. Dependency rule (1 chiều, hướng vào trong)

```
presentation → application → domain
     ↓              ↓
infrastructure → application (implements ports)
     ↓
  entrypoints (composition root — wire infrastructure → application)

KHÔNG BAO GIỜ:
- domain → application/infrastructure/presentation  ❌
- application → infrastructure/presentation          ❌
- presentation → infrastructure (chỉ qua use case)   ❌
```

---

## E. Message flow (P2 + P3 + P4)

```
[Content Script]                [Service Worker]              [Offscreen]
  overlay click                    handlers/                       dictLoader
      │                                │                              │
      ├── sendMessage ──────────▶  wordHandler                       │
      │   {type: LOOKUP_WORD,        │                              │
      │    word, context}            ├── LookupWordUseCase           │
      │                              │   (depends on IDictRepo)      │
      │                              ├── YomitanDictRepo ──────────▶ load dict
      │                              │                              │   (IndexedDB)
      │                              │                              ◀── result
      │                              ├── (miss?) AIExplainAdapter ──▶ aiExplainRunner
      │                              │                              │   (ChatGPT)
      │                              │                              ◀── result
      │                              │                              │
      │                              ├── SaveWordUseCase             │
      │                              │   (depends on IWordRepo)      │
      │                              ├── IndexedDBWordRepo ────────▶ write
      │                              │                              │
      ◀── response ────────────────  {success, data: DictEntry}     │
      │                                                              │
      ├── render popup (Shadow DOM)                                  │
```

---

## F. Build tool recommendation

> Nguồn: #38, #39, #40

Cell hiện tại dùng **CRXJS** (`@crxjs/vite-plugin`). Đánh giá:

| Tool | Pros | Cons | Verdict cho Cell |
|---|---|---|---|
| **CRXJS** (current) | Vite plugin, minimal, HMR tốt cho CS, Anh yêu đã quen | Maintenance uncertain (v2.0 Jun 2025 revived), không auto-import, không file-based entrypoint | **Giữ cho MVP** — đã work, không migrate phi lý |
| **WXT** | Production default 2026, file-based, auto-import, cross-browser, module system, 9.5k stars | Cần migrate (effort), learning curve | **Cân nhắc phase sau** — khi cần Firefox/Safari support hoặc code lớn |
| **Plasmo** | React-first, nhiều tutorial | Maintenance mode, Parcel chậm, bundle lớn | Skip |

**Khuyến nghị**: Giữ CRXJS cho MVP. Khi Cell mở rộng (multi-browser, module system) → cân nhắc migrate WXT. Migration không khẩn cấp.

---

## G. Tóm tắt — checklist kiến trúc cho Cell

| # | Nguyên tắc | Cell hiện tại | Cell MVP cần |
|---|---|---|---|
| P1 | SW = orchestrator | ✅ đã đúng | Giữ — thêm dict/AI → offscreen |
| P2 | CS mỏng | ✅ đã đúng | Giữ — overlay CS chỉ render + capture |
| P3 | Message typed + validated | ✅ có MESSAGE_TYPES | Mở rộng — thêm dict/mining/anki handler |
| P4 | State ở background, proxy UI | ⚠️ Zustand popup + chrome.storage | Mở rộng — word DB IndexedDB, proxy popup |
| P5 | Layered (domain/app/infra/presentation) | ❌ lib/ trộn | Refactor dần — tách domain types ra |
| P6 | Ports & adapters | ❌ chưa có | Thêm — IWordRepository, IDictRepository, IAnkiExporter |
| P7 | Feature-based folder | ⚠️ partial | Áp dụng cho feature mới (word/dict/mining/anki) |
| P8 | Offscreen cho heavy | ✅ đã có transmux | Mở rộng — dict load, AI explain trong offscreen |
| P9 | Shadow DOM overlay | ❌ chưa có (chưa inject UI) | Bắt buộc — overlay + popup lookup |
| P10 | Least privilege | ⚠️ broad | Thu hẹp host_permissions, thêm optional |
| P11 | Lazy load + code split | ⚠️ partial | Popup tab lazy, overlay lazy inject, dict lazy load |
| P12 | Test pyramid | ✅ Jest + Playwright | Mở rộng — unit use cases, integration adapters |

---

## H. Tham khảo sâu (đọc thêm khi implement)

| Chủ đề | Nguồn tốt nhất |
|---|---|
| MV3 service worker lifecycle | #1 (Chrome docs) |
| Clean architecture extension thực tế | #9 (dev.to/ievgen_ch — 60 files, 4 layers) |
| Zustand + extension sync | #12 (webext-zustand) + #14 (guide) |
| Hexagonal TypeScript | #20 (softwarepatternslexicon) + #21 (serard.dev) |
| Offscreen + OPFS + Worker | #28 (lit.build — WebCodecs pipeline) + #29 (screen-recorder) |
| Shadow DOM overlay | #36 (sweets.chat — WXT + React + Shadow DOM) |
| WXT vs CRXJS | #39 (dev.to/quangpl — 2026 comparison) |
| Dexie schema + migration | #42 (dexie.org) + #41 (bestchromeextensions guide) |
| Playwright extension e2e | #30 (dev.to/corrupt952 — CDP approach) |
