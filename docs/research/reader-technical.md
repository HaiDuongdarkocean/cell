# Reader Feature — Technical Research

## 1. Findings

### 1.1 Intent summary (from `docs/intent/reader.md`)
- Build a Reader feature inside the Cell MV3 extension for foreign-language learners.
- Import and read EPUB / PDF / TXT / HTML, tokenize text, show the existing dictionary popup, play TTS by sentence, save words/sentences to Anki via the existing Card Creator, and track progress.
- MVP = TXT + HTML + tokenize + dictionary + TTS + progress/resume.
- Slices 2/3/4 add EPUB (`@abfcode/spine`), PDF (`pdfjs-dist`), polish, settings, and Anki auto-save.

### 1.2 Reusable building blocks found in the codebase

| Capability | Source | How it can be reused |
|---|---|---|
| Text → word tokens (sentences + offsets) | `src/features/tokenize/logic/textTokenizer.ts` | `tokenizeTextBlock(text, langCode)` returns `Token[]` with `start/end/sentenceIndex/isSeparator`. Already supports `en` and `zh` (FMM). Can be reused on every paragraph/chunk of imported book text. |
| Token block model | `src/features/tokenize/types.ts` | `TokenBlock` currently has `id`, `originalText`, `tokens`, `isBound`, `lastAccessedAt`. Reader can create synthetic `TokenBlock` objects without a DOM `element` (the `element` field is used for live web text; for Reader it can be `document.body` or a virtual container). |
| Status/frequency resolution | `textTokenizer.ts:resolveTokenMetadata` | Bulk-resolves `status` + `frequencyBand` for all tokens in a block using async callbacks. Fits a Reader paragraph view. |
| Dictionary lookup | `src/features/dictionaryPopup/logic/useDictionaryLookup.ts` | `search(term, contextSentence, cursorOffset)` sends `LOOKUP_REQUEST` and returns `currentResult`/`candidates`. Pure hook — can be dropped into a React Reader panel. |
| Dictionary panel UI | `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx` | Full React component with `variant: 'integrated'`, search, history, candidate chips, definition selection. Reuse in the Reader side panel / dialog. |
| Popup controller logic | `src/features/dictionaryPopup/controller/webTextDictionaryController.ts` | Card Creator / Quick Add wiring (`openCardCreator`, `sendToCard`, `formatDefinitions`). The Controller can be copied/reused to mount a popup inside the Reader page. |
| TTS audio queue | `src/features/tts/services/ttsQueue.ts` | `createTtsAudioQueue()` plays `AudioBuffer`s in order with play/pause/resume/stop. Perfect for queueing pre-synthesized sentence audio. |
| TTS engine abstraction | `src/features/dictionaryPopup/services/ttsEngineService.ts` | `createTtsEngine()` picks `chrome.tts` then Web Speech; `TtsEngine` interface with `speak/getVoices/stop`. Can wrap `chrome.tts` or `speechSynthesis` for per-sentence playback. |
| Supertonic engine | `src/features/tts/services/supertonicTtsEngine.ts` | Already chunked by sentence (`MAX_CHARS_PER_CHUNK = 500`) and uses `createTtsAudioQueue`. Currently stubbed when OPFS voice pack missing — not the default for Reader until Slice 4. |
| Card Creator content | `src/features/cardCreator/ui/CardCreatorDialogContent.tsx` | Fields (`targetWord`, `sentence`, `definitions`, `images`, `sentenceAudios`, `wordAudios`, etc.) accept prefill from `PopupCardCreatorPrefill`. Can reuse `useCardCreatorState` in a panel variant. |
| Universal Panel shell | `src/features/universalPanel/UniversalPanel.tsx` + `UniversalPanelHeader.tsx` | Tabs, header toggles, profile switcher, focus trap, responsive. The Reader can be a new tab (`'reader'`) inside this shell or a separate page. |
| Storage (settings) | `src/shared/lib/storage/settingsStore.ts` | Schema-versioned `loadSettings`/`saveSettings` with migrations. Reader settings can be a new slice added with `CURRENT_SCHEMA_VERSION` bump. |
| Large file storage | `src/shared/lib/storage/opfsStorage.ts` | OPFS helpers (`ensureDownloadSubdir`, `createOpfsWriter`, `readFile`, `readJsonFile`, `writeJsonFile`, `isQuotaExceededError`). Already used for downloads; can be adapted to store imported books and extracted text. |
| Local-player page pattern | `src/entrypoints/local-player/main.tsx` + `index.html` + `src/entrypoints/background/handlers/localPlayer.ts` | A dedicated extension page is opened with `chrome.tabs.create({ url: chrome.runtime.getURL('src/entrypoints/<page>/index.html') })` and `web_accessible_resources`. The Reader should follow this exact pattern. |
| IndexedDB pattern | `src/features/local-player/services/mediaLibraryRepository.ts` | `DB_NAME`, `DB_VERSION`, object stores for videos/history. Reader can add a new DB (`cell-reader`) for book metadata, progress, and saved words. |

### 1.3 File format parsing — technical reality

#### TXT / HTML
- **TXT**: `FileReader.readAsText(file)` → split by blank lines / heading heuristics / fixed-size chunks.
- **HTML**: `FileReader.readAsText(file)` → `DOMParser.parseFromString(html, 'text/html')` → `body.innerText` or per-paragraph extraction.
- Native APIs only; no extra dependencies for MVP.

#### EPUB — `@abfcode/spine@0.15.0` (per intent)
- Research confirms `@abfcode/spine` is a TypeScript/JS EPUB parser (npm, GitHub ABFCode/Spine).
- Primary API:
  ```ts
  import { parse } from '@abfcode/spine';
  const book = parse(epubBytes); // Uint8Array
  book.metadata.title;
  book.toc;
  for (const ch of book.iterChapters()) {
    ch.title;
    ch.text;
    ch.start; // { spineIndex, blockIndex }
  }
  ```
- Also supports `book.chunks({ mode: 'size', maxChars: 2000 })` for fixed-size windows and `book.blocks(0)` for structured blocks per spine item.
- EPUBs are ZIP archives; the package uses `fflate` internally (already in `package.json` dependencies at `^0.8.3`), matching the intent constraint.
- **Limitations observed** (from skill `epub` and Go docs): parser is tolerant but best-effort; broken OPF/NCX can yield warnings. TOC-to-spine mapping can be off if manifests are malformed. For Reader, always keep a fallback spine-based chapter list.

#### PDF — `pdfjs-dist@6.2.108` (per intent)
- Mozilla PDF.js stable build at v6.2.108.
- Text extraction pattern (confirmed by cdn type definitions and StackOverflow):
  ```ts
  import * as pdfjs from 'pdfjs-dist';
  pdfjs.GlobalWorkerOptions.workerSrc = '<bundle-output>/pdf.worker.mjs'; // required in extension

  const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
  const pdf = await loadingTask.promise;
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if ('str' in item) out.push(item.str);
    }
  }
  ```
- MV3 / bundling issues:
  - `pdfjs-dist` tries to load its worker from a separate file. In a Vite extension build the worker must be copied to `dist/` and `GlobalWorkerOptions.workerSrc` set to the runtime URL.
  - `getTextContent` in a Worker may fail CSP for `wasm-unsafe-eval`/`unsafe-eval`. The manifest already declares `"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"`, which is compatible.
  - The worker file must be listed in `web_accessible_resources` or Vite must bundle it to an accessible path.
- For non-render extraction we only need `getTextContent`; no canvas, no UI.

### 1.4 Storage landscape in MV3

| Store | Size | Use case for Reader |
|---|---|---|
| `chrome.storage.local` | 5 MB Chrome ≤113, 10 MB Chrome ≥114, unlimited with `unlimitedStorage` permission | Small structured data only: settings, last-read positions, saved word IDs. **Not** for full book binaries. |
| `chrome.storage.sync` | ~100 KB | Not suitable for Reader data. Avoid. |
| IndexedDB | Async, large (disk quota) | Book **metadata**, **per-book progress**, **token/sentence indexes**, **saved words**. Best for structured data. |
| OPFS (`navigator.storage.getDirectory`) | Large (browser quota) | Imported **book binaries** (EPUB/PDF/TXT/HTML files) and extracted plain-text cache. Shared across extension origin. Already wrapped in `opfsStorage.ts`. |
| `CacheStorage` | Large | Not ideal for user-imported books; more for network assets. |

Key facts from Chrome docs / web.dev:
- `unlimitedStorage` only removes the `chrome.storage.local` limit; it does **not** make OPFS/IndexedDB durable or unlimited. Global disk quota still applies.
- OPFS and IndexedDB can be evicted under disk pressure on some platforms (Chromium issue 1209236). Treat them as best-effort persistent; export is the real backup.
- Chrome can use up to 80% of disk; origin up to 60%. Call `navigator.storage.estimate()` to warn users when space is low.

---

## 2. Recommended architecture

### 2.1 Entrypoint and page (mirror `local-player`)

Create a new dedicated extension page:

```
src/entrypoints/reader/index.html
src/entrypoints/reader/main.tsx
src/entrypoints/reader/App.tsx
src/entrypoints/reader/store/readerStore.ts
src/entrypoints/reader/styles/global.css
```

Open flow:
1. Universal Panel gains a new tab `'reader'` (or an icon in the existing tab bar), or a `OPEN_READER` message from background.
2. Background handler `src/entrypoints/background/handlers/reader.ts`:
   ```ts
   const tab = await chrome.tabs.create({
     url: chrome.runtime.getURL('src/entrypoints/reader/index.html'),
   });
   ```
3. Add `src/entrypoints/reader/index.html` to `web_accessible_resources` in `public/manifest.json`.

**Why a new page, not sidepanel?**
- The side panel is currently narrow/used for subtitles; a book needs a full reading viewport and room for the dictionary / TTS bar.
- The `local-player` page already proves the extension-page pattern works and is responsive.

### 2.2 Component layout (within `App.tsx`)

```
+-------------------------------------------------+
| Header: import / library / settings / back     |
+-------------------------------------------------+
| Left:            | Right:                       |
| TOC / chapters   | ReaderView (scrollable text) |
| (collapsible)    | tokenized spans              |
+------------------+------------------------------+
| Bottom:          |                              |
| TTS player bar   |  (prev / play / pause / next / repeat / voice) |
+-------------------+------------------------------+
```

Components to write:

| Component | Responsibility |
|---|---|
| `ReaderApp` | Top-level store wiring, file drag-drop, open existing book. |
| `ReaderHeader` | Import button, library drawer, current title, TTS controls. |
| `TocSidebar` | Chapters from parsed TOC / fallback spine index. Click to jump. |
| `ReaderView` | Render text as tokenized paragraphs. Scroll progress. Click token → dictionary. Select sentence → TTS. |
| `TokenizedParagraph` | One `TokenBlock`; call `tokenizeTextBlock` and render clickable `<span data-term="...">`. |
| `ReaderDictionarySheet` | `DictionaryPanelView variant="integrated"` mounted as a bottom/right sheet. |
| `TtsControlBar` | Prev / play / pause / next / repeat using `createTtsAudioQueue` + `createTtsEngine`. |
| `ReaderLibraryView` | List imported books, progress %, last read, delete. |
| `CardCreatorPanel` | Reuse `CardCreatorDialogContent layout="panel"` + `useCardCreatorState` for quick Anki export. |

### 2.3 Reader flow

1. **Import**
   - User drops or picks EPUB/PDF/TXT/HTML.
   - Binary is copied to OPFS under `reader/books/{bookId}.{ext}`.
   - Parser produces `{ bookId, title, author, language, chapters[], plainText, toc[] }`.
   - Metadata saved to IndexedDB `books` store.
2. **Open**
   - Load metadata + last progress from IndexedDB.
   - For current chapter, load extracted text (from OPFS or regenerate on the fly).
3. **Render**
   - Split chapter text into paragraphs.
   - Each paragraph becomes a `TokenBlock` with `originalText`.
   - `prepareTokenBlock(block, langCode)` then `resolveTokenMetadata`.
   - Render spans; click span → `useDictionaryLookup` / `WebTextDictionaryController` equivalent.
4. **TTS**
   - User clicks a sentence or presses play.
   - `getSentenceText(block, token)` from `textTokenizer.ts` gives the sentence.
   - `createTtsEngine().speak(sentence, { langCode })` or `createTtsAudioQueue` with pre-synthesized buffers.
   - `prev/next` jump to previous/next sentence index in the current chapter.
5. **Dictionary / Card Creator**
   - Token click opens `DictionaryPanelView`.
   - `onSendToCard` / `onQuickAdd` prefill `CardCreatorDialogContent`.
6. **Progress**
   - Track `chapterIndex`, `sentenceIndex`, `scrollTop`, and total `readTimeMs`.
   - Throttled save to IndexedDB `progress` store every 5–10 seconds.
7. **Resume**
   - On open, restore to saved `chapterIndex` and `sentenceIndex`, scroll into view.

---

## 3. Dependencies to add

| Package | Version | Purpose |
|---|---|---|
| `@abfcode/spine` | `0.15.0` (per intent) | EPUB parse: metadata, TOC, `iterChapters()`, `blocks()`, `chunks()`. |
| `pdfjs-dist` | `6.2.108` (per intent) | PDF text extraction via `getTextContent`. |
| `pdfjs-dist` types | included in package | `PDFDocumentProxy`, `TextContent`, `TextItem`, `GlobalWorkerOptions`. |

No new dependencies are needed for TXT/HTML (native `FileReader` + `DOMParser`).

**Bundle / Vite notes:**
- `pdfjs-dist` worker file must be copied/bundled. Configure `vite.config.ts` to copy `node_modules/pdfjs-dist/build/pdf.worker.mjs` to `dist/assets/pdf.worker.mjs` (or similar).
- Set `pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/pdf.worker.mjs')` at runtime.
- `@abfcode/spine` may bundle `fflate`; verify no duplicate `fflate` resolution.

---

## 4. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **MVP scope creep** — adding EPUB/PDF too early | Medium | Ship Slice 1 (TXT/HTML) first; add parser services behind feature flags. |
| **`chrome.storage.local` overflow** from storing full book text | High | Never put full text in `storage.local`. Use OPFS for binaries and IndexedDB for extracted text. |
| **PDF worker CSP / bundling** in MV3 | High | Pre-bundle `pdf.worker.mjs` to `dist/`, add to `web_accessible_resources`, test `getTextContent` in a real extension build. |
| **EPUB parser malformed files** | Medium | Use `@abfcode/spine` tolerant mode, fall back to spine-indexed chapter list, surface warnings. |
| **RAM usage on large books** | Medium | Stream chapters (do not hold entire book text in memory); use `iterChapters()`/`chunks()`; lazy tokenize visible paragraphs only. |
| **TTS latency > 3 s** | Medium | Use `chrome.tts` (fast on desktop) for MVP; cache recent sentence audio in OPFS/IndexedDB. |
| **Supertonic not ready** | Low | Continue stub path until TTS feature complete; use `chrome.tts`/`speechSynthesis`. |
| **Cross-browser mobile differences** | Medium | Test on Chrome/Edge/Brave desktop + Android; OPFS is supported on Chromium. Firefox not a primary target. |
| **IndexedDB quota eviction** | Low | Treat OPFS/IndexedDB as cache; keep user import as a File object; always allow re-import. |

---

## 5. Storage schema proposal

### 5.1 OPFS layout (binary + derived text)

```
<OPFS root>
├── downloads/            (existing)
└── reader/
    ├── books/
    │   └── {bookId}/
    │       ├── source.bin          (original EPUB/PDF/TXT/HTML bytes)
    │       ├── text.json           (extracted plain text by chapter)
    │       └── cover.{jpg|png}     (optional)
```

Use existing `opfsStorage.ts` helpers: `ensureDownloadSubdir` pattern reimplemented as `ensureReaderBookDir(bookId)`.

### 5.2 IndexedDB: `cell-reader` database

```ts
const DB_NAME = 'cell-reader';
const DB_VERSION = 1;
```

Object stores:

#### `books` (keyPath `id`)
```ts
interface BookRecord {
  id: string;                   // stable hash or crypto.randomUUID()
  filename: string;
  title: string;
  author?: string | null;
  languageCode: string;
  format: 'epub' | 'pdf' | 'txt' | 'html';
  addedAt: string;              // ISO 8601
  lastReadAt: string | null;
  totalChapters: number;
  totalSentences?: number;
  opfsDir: string;              // e.g. 'reader/books/{id}'
  coverUrl?: string | null;
}
```

#### `progress` (keyPath `id` or compound `[bookId + profileId]`)
```ts
interface ReaderProgressRecord {
  id: string;                   // `${bookId}:${profileId}`
  bookId: string;
  profileId: string;
  chapterIndex: number;
  sentenceIndex: number;
  scrollTop: number;
  readTimeMs: number;
  updatedAt: string;
  completedAt?: string | null;
}
```

#### `savedWords` (keyPath `id`, index by `bookId`, `term`)
```ts
interface SavedWordRecord {
  id: string;                   // `${bookId}:${term.toLowerCase()}:${profileId}`
  bookId: string;
  profileId: string;
  term: string;
  status: WordStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
}
```

#### `savedSentences` (keyPath `id`, index by `bookId`)
```ts
interface SavedSentenceRecord {
  id: string;                   // `${bookId}:${chapterIndex}:${sentenceIndex}:${profileId}`
  bookId: string;
  profileId: string;
  chapterIndex: number;
  sentenceIndex: number;
  text: string;
  translatedText?: string;
  savedAt: string;
  ankiNoteId?: number | null;
}
```

### 5.3 `chrome.storage.local` — Reader settings slice

Add to `Settings` / `LanguageProfile` (settings migration bump to `v24`):

```ts
interface ReaderSettings {
  enabled: boolean;
  defaultTtsRate: number;
  defaultTtsPitch: number;
  preferredVoiceName?: string | null;
  autoAdvanceSentence: boolean;
  showStatus: boolean;
  showFrequency: boolean;
}
```

- Store in `chrome.storage.local` as part of existing `Settings` object (`settingsStore.ts` `CURRENT_SCHEMA_VERSION` ++).
- Per-profile so language-specific voices can be saved.

### 5.4 Progress calculation

- `% complete` = `currentSentenceIndex` / `totalSentences` (or fallback `chapterIndex / totalChapters` when sentence count unavailable).
- `readTimeMs` accumulated while the page is visible and not idle.
- Save throttled every 5 seconds and on `beforeunload`.

---

## 6. Implementation order (aligned with intent phases)

1. **Slice 1 — TXT/HTML MVP**
   - New `src/entrypoints/reader/` page.
   - `readerStore` (Zustand) for current book, chapter, TTS queue.
   - `ReaderView` + `TokenizedParagraph` reusing `tokenizeTextBlock`.
   - `ReaderDictionarySheet` reusing `DictionaryPanelView`.
   - `TtsControlBar` reusing `createTtsEngine`.
   - OPFS + IndexedDB schema for books/progress.
2. **Slice 2 — EPUB**
   - Add `@abfcode/spine`; `EpubBookParser` producing chapters.
3. **Slice 3 — PDF**
   - Add `pdfjs-dist`; worker bundling; `PdfBookParser`.
4. **Slice 4 — Polish / settings / Anki auto-save / sync**
   - Settings slice; auto-save sentence to Anki; Supertonic integration when ready.

---

## 7. Files to create (not modify)

Per the task instructions, **do not modify source code**. The research output is above; the following are the implementation files the parent agent will likely need:

- `docs/research/reader-technical.md` (this file)
- `src/entrypoints/reader/index.html`
- `src/entrypoints/reader/main.tsx`
- `src/entrypoints/reader/App.tsx`
- `src/entrypoints/reader/store/readerStore.ts`
- `src/entrypoints/reader/styles/global.css`
- `src/features/reader/services/bookParser.ts`
- `src/features/reader/services/epubParser.ts`
- `src/features/reader/services/pdfParser.ts`
- `src/features/reader/services/textHtmlParser.ts`
- `src/features/reader/services/readerDb.ts`
- `src/features/reader/services/readerOpfs.ts`
- `src/features/reader/ui/ReaderView.tsx`
- `src/features/reader/ui/TokenizedParagraph.tsx`
- `src/features/reader/ui/TocSidebar.tsx`
- `src/features/reader/ui/TtsControlBar.tsx`
- `src/features/reader/ui/ReaderDictionarySheet.tsx`
- `src/entrypoints/background/handlers/reader.ts`
- `src/entities/message/types.ts` updates for `OPEN_READER`
- `src/shared/config/messages.ts` updates for `OPEN_READER`
- `src/shared/config/config.ts` updates for `DEFAULT_READER_SETTINGS` and `DEFAULT_SETTINGS`
- `src/shared/lib/storage/settingsStore.ts` migration `v23 → v24`
- `public/manifest.json` update for `web_accessible_resources` + title
- `package.json` add `@abfcode/spine` and `pdfjs-dist`
- `vite.config.ts` (copy pdf.worker.mjs)
