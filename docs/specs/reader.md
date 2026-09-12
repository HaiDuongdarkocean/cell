# Spec: Cell Reader

> Source of truth cho tính năng Reader trong Cell MV3. Tổng hợp từ `docs/intent/reader.md`, `docs/specs/reader-requirements.md`, `docs/research/reader-technical.md` và mockup UI.  
> **Revised after adversarial reviews** (`docs/reviews/reader-adversarial-1.md`, `docs/reviews/reader-adversarial-2.md`). Day-1 scope thu gọn để ship được.

## 0. Day-1 Shipable Scope

- Chỉ **TXT import** (HTML làm slice 1.5 vì cần sanitize).
- **Tokenizer** dùng `tokenizeTextBlock` với `en`/`zh` + fallback whitespace cho ngôn ngữ khác.
- **TTS** dùng `createTtsEngine` (`chrome.tts` → Web Speech fallback): play/stop/prev/next/repeat. Không có pause/resume thật sự (chrome.tts không hỗ trợ) và không có progress bar audio.
- **Dictionary** dùng `DictionaryPanelView` với `term` được truyền từ token click; context sentence từ `getSentenceText`.
- **Progress/resume** bằng IndexedDB `cell-reader` + `beforeunload` + visibilitychange.
- Không WAR cho reader; `chrome.tabs.create({ url: chrome.runtime.getURL('src/entrypoints/reader/index.html') })` đủ.
- Vite multi-page: thêm `reader` vào `vite.config.ts` `rollupOptions.input`.

---

## 1. Objective

Cell Reader cho phép người học ngoại ngữ (10–25 tuổi) import và đọc sách ở định dạng EPUB/PDF/TXT/HTML, tận dụng các thành phần sẵn có của Cell: tokenizer, dictionary popup, TTS engine, card creator, storage.

Thành công khi:
- Người dùng mở Reader từ Universal Panel, import sách, đọc, click từ để tra nghĩa, nghe TTS theo câu, lưu Anki, và resume vị trí đọc.
- Build pass, typecheck 0 lỗi, tests pass, browser verify pass.

---

## 2. Tech Stack

| Layer | Lựa chọn | Lý do |
|---|---|---|
| Framework | React 19 + Vite + TypeScript | Cùng stack với toàn bộ Cell. |
| EPUB parser | `@abfcode/spine@0.15.0` | 1 runtime dep `fflate` (đã có), typed, TTS/reader-oriented. |
| PDF parser | `pdfjs-dist@6.2.108` | Chuẩn Mozilla, text extraction `getTextContent`, không render. |
| TXT/HTML | `FileReader` + `DOMParser` | Native, không thêm dependency. |
| Tokenize | `tokenizeTextBlock` từ `src/features/tokenize/logic/textTokenizer.ts` | Sẵn có, hỗ trợ `en` và `zh`. |
| Dictionary | `DictionaryPanelView` + `useDictionaryLookup` | Sẵn có. |
| TTS | `createTtsEngine` từ `ttsEngineService.ts` | `chrome.tts`/Web Speech fallback, sẵn queue. |
| Anki | `CardCreatorDialogContent` + `useCardCreatorState` | Sẵn có. |
| State | Zustand (`readerStore`) | Local page state, đồng bộ với storage. |
| Storage | OPFS (binary/text), IndexedDB `cell-reader` (metadata/progress/words), `chrome.storage.local` (settings) | Đúng MV3, tránh `storage.local` 5MB. |

---

## 3. Commands

```bash
# Dev
cd "<repo-root>" && npm run dev

# Typecheck
npm run typecheck

# Unit tests
npm run test:unit

# Build (cần chạy sau mỗi lần sửa src)
npm run build

# Mock pages (nếu cần test TTS/dictionary)
npm run mock
```

---

## 4. Project Structure

```
src/
├── entrypoints/
│   ├── reader/
│   │   ├── index.html          # Reader extension page
│   │   ├── main.tsx            # React root
│   │   ├── App.tsx             # Router Library/Read
│   │   ├── store/readerStore.ts
│   │   └── styles/global.css
│   └── background/handlers/reader.ts
├── features/
│   └── reader/
│       ├── services/
│       │   ├── bookParser.ts        # Factory chọn parser theo format
│       │   ├── textHtmlParser.ts    # TXT/HTML
│       │   ├── epubParser.ts        # EPUB
│       │   ├── pdfParser.ts         # PDF
│       │   ├── readerDb.ts          # IndexedDB `cell-reader`
│       │   └── readerOpfs.ts        # OPFS helpers
│       ├── ui/
│       │   ├── ReaderApp.tsx
│       │   ├── ReaderLibraryView.tsx
│       │   ├── ReaderView.tsx
│       │   ├── TokenizedParagraph.tsx
│       │   ├── TocSidebar.tsx
│       │   ├── TtsControlBar.tsx
│       │   └── ReaderDictionarySheet.tsx
│       └── types.ts
tests/
└── unit/features/reader/
    ├── bookParser.test.ts
    ├── readerDb.test.ts
    └── readerStore.test.ts
```

---

## 5. Code Style

- Function components + named export. Không default export.
- Không dùng `any`.
- Dùng types từ `src/features/reader/types.ts` làm SSOT.
- CSS dùng design tokens (`tokens.json`/`tokens.css`), không hardcode.
- Icon dùng `ICON_CATALOG`, không inline SVG.
- Storage input validate qua Zod tại boundary.
- Tách pure logic (parser, progress, tokenize) khỏi React UI.

Example:
```ts
export interface BookRecord {
  id: string;
  title: string;
  format: 'epub' | 'pdf' | 'txt' | 'html';
}

export async function importBook(file: File): Promise<BookRecord> {
  const parser = pickParser(file.type);
  const parsed = await parser(file);
  return saveBook(parsed);
}
```

---

## 6. Testing Strategy

| Level | Vị trí | Mục tiêu |
|---|---|---|
| Unit | `tests/unit/features/reader/` | Parser cho từng format, `readerDb`, `readerStore`, progress %, tokenize text flow. |
| Integration | `tests/integration/reader/` | Import → parse → lưu → mở lại (dùng fake files). |
| E2E | Playwright + skill `testing-extension-browser` | Open Reader từ Universal Panel, import TXT, click từ, play TTS, resume. |

---

## 7. Boundaries

### 7.1 Always do
- Chạy `npm run build` sau khi sửa `src/`.
- Validate payload `OPEN_READER` / `IMPORT_BOOK` bằng Zod.
- Sanitize HTML/EPUB trước khi render, CSP ngăn inline script.
- Lưu progress throttle mỗi 5s và trên `beforeunload`.
- Update `docs/2-architechture-system.md` khi thêm/xóa file `src/`.

### 7.2 Ask first
- Thêm/sửa `manifest.json`.
- Thêm dependency mới ngoài `@abfcode/spine` và `pdfjs-dist`.
- Sửa `tokens.json`.
- Thay đổi `Settings` schema (version migration).

### 7.3 Never do
- Lưu binary sách vào `chrome.storage.local`.
- Thực thi script từ nội dung sách import.
- Commit secret/key.
- Bypass security policy để build.

---

## 8. Success Criteria

- [ ] Mở Reader từ Universal Panel → tab mới → Library hiển thị < 3s.
- [ ] Import `.txt`/`.html` thành công, xuất hiện trong Library.
- [ ] Click từ trong câu → dictionary popup mở với nghĩa.
- [ ] Chọn câu → TTS play/pause/prev/next/repeat hoạt động.
- [ ] Progress % và read time được lưu, resume khi mở lại.
- [ ] Build pass, typecheck 0, tests pass.
- [ ] Browser test pass trên mock/Chrome thật.

---

## 9. UI/UX

Theo mockup `docs/mockup/reader.html` và `docs/mockup/reader-README.md`:
- **Universal Panel**: thẻ Reader dùng icon `book-open` mở trang reader mới.
- **Reader Home**: import area (drag/drop hoặc chọn file), danh sách sách dạng card hiển thị % hoàn thành + thời gian đọc.
- **Reading View**: nội dung tokenize (`span.token` theo tần suất/trạng thái), header tên sách + thời gian + nút Lưu Anki, thanh TTS sticky ở dưới.
- **Tokens**: dùng `--color-surface`, `--color-text-primary/secondary`, `--color-token-freq-*`, `--color-token-status-*`, `--space-*`, `--radius-*`, `--font-size-*`.
- **Responsive**: mobile 1 cột, tablet 2 cột, desktop 3 cột, text tối đa 70–80ch.
- **Dark/Light**: `data-theme` + `prefers-color-scheme`.

## 10. Open Questions

- [ ] TTS mặc định: `chrome.tts` hay `speechSynthesis`? (Research đề xuất `chrome.tts` cho nhanh.)
