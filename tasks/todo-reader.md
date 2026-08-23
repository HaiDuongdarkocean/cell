# Todo: Cell Reader

> Spec: `docs/specs/reader.md`  
> Plan: `tasks/plan-reader.md`

## Phase 1: Foundation — entrypoint, storage, parser

- [ ] T1: Scaffold `src/entrypoints/reader/` entrypoint
  - AC: `src/entrypoints/reader/index.html`, `main.tsx`, `App.tsx`, `store/readerStore.ts`, `styles/global.css` tồn tại. Manifest cập nhật `web_accessible_resources`. Background `OPEN_READER` handler mở tab mới.
  - Verify: `npm run build` pass; mở `chrome-extension://.../src/entrypoints/reader/index.html` thấy trang reader trống.
  - Files: `src/entrypoints/reader/*`, `public/manifest.json`, `src/entrypoints/background/handlers/reader.ts`, `src/entities/message/types.ts`, `src/shared/config/messages.ts`.
  - Dependencies: None
  - Scope: M

- [ ] T2: `readerDb.ts` (IndexedDB `cell-reader`) + `readerOpfs.ts` (OPFS)
  - AC: IndexedDB stores `books`, `progress`, `savedWords`, `savedSentences` sẵn sàng. OPFS helpers `importBookBinary(bookId, buffer)`, `readBookText(bookId)`, `deleteBook(bookId)`.
  - Verify: `npm run test:unit` với fake IndexedDB/OPFS; CRUD book và progress pass.
  - Files: `src/features/reader/services/readerDb.ts`, `readerDb.test.ts`, `readerOpfs.ts`, `readerOpfs.test.ts`.
  - Dependencies: T1
  - Scope: M

- [ ] T3: `textHtmlParser.ts` + import flow
  - AC: `importBook(file: File)`: TXT → text paragraphs; HTML → `DOMParser` → `body.innerText` → paragraphs. Lưu source binary + text OPFS + metadata IndexedDB.
  - Verify: unit test với `tests/data-test/reader/sample.txt` và `sample.html`.
  - Files: `src/features/reader/services/bookParser.ts`, `textHtmlParser.ts`, `textHtmlParser.test.ts`, `types.ts`.
  - Dependencies: T2
  - Scope: M

## Phase 2: UI — Library, Reader, Tokenize, Dictionary, TTS

- [ ] T4: `ReaderLibraryView` + `readerStore`
  - AC: Hiển thị danh sách sách từ IndexedDB. Nút import. Click sách → mở `ReaderView`. Xóa sách có xác nhận.
  - Verify: browser test — import file, thấy sách trong list, click mở đọc.
  - Files: `src/features/reader/ui/ReaderLibraryView.tsx`, `ReaderLibraryView.module.css`, `src/entrypoints/reader/App.tsx`.
  - Dependencies: T3
  - Scope: M

- [ ] T5: `ReaderView` + `TokenizedParagraph`
  - AC: Render text theo đoạn. Mỗi từ là `span.token` (dùng `tokenizeTextBlock`). Click từ → lưu term selected.
  - Verify: `npm run test:unit` với `TokenizedParagraph`; browser test thấy token và click.
  - Files: `src/features/reader/ui/ReaderView.tsx`, `TokenizedParagraph.tsx`, `TokenizedParagraph.test.tsx`, `useTokenizeReader.ts`.
  - Dependencies: T4
  - Scope: M

- [ ] T6: `ReaderDictionarySheet` tích hợp `DictionaryPanelView`
  - AC: Click token mở `DictionaryPanelView variant="integrated"` hoặc popup. Tra cứu term với context sentence. Nút save Anki nếu cần.
  - Verify: browser test — click từ, popup mở, hiển thị nghĩa.
  - Files: `src/features/reader/ui/ReaderDictionarySheet.tsx`, `useReaderDictionary.ts`.
  - Dependencies: T5
  - Scope: M

- [ ] T7: `TtsControlBar` (prev/play/pause/next/repeat)
  - AC: Chọn câu → play TTS. Prev/next chuyển câu. Repeat phát lại câu. Pause dừng. UI sync trạng thái.
  - Verify: unit test `TtsControlBar` state machine; browser test — phát/pause/next/repeat.
  - Files: `src/features/reader/ui/TtsControlBar.tsx`, `useReaderTts.ts`, `TtsControlBar.test.tsx`.
  - Dependencies: T5
  - Scope: M

## Phase 3: Progress, resume, integration

- [ ] T8: Progress + time tracking + resume
  - AC: Theo dõi `chapterIndex`, `sentenceIndex`, `scrollTop`, `readTimeMs`. Lưu mỗi 5s + `beforeunload`. Mở lại sách → cuộn về vị trí cũ.
  - Verify: unit test progress %; browser test — đọc, đóng tab, mở lại, vị trí giữ.
  - Files: `src/features/reader/services/progressTracker.ts`, `useProgress.ts`.
  - Dependencies: T4
  - Scope: M

- [ ] T9: Universal Panel "Reader" button
  - AC: Thêm icon `book-open` vào Universal Panel (hoặc tab). Click gửi `OPEN_READER` → mở reader page.
  - Verify: browser test — mở Universal Panel, click Reader, tab mới mở.
  - Files: `src/features/universalPanel/UniversalPanel.tsx`, `UniversalPanelHeader.tsx`.
  - Dependencies: T1
  - Scope: S

- [ ] T10: Build, typecheck, unit tests, browser verify
  - AC: `npm run typecheck` 0 error, `npm run test:unit` pass, `npm run build` pass. Browser test trên mock/Chrome thật với TXT file.
  - Verify: Chạy cả 3 commands + `npm run mock` + skill `testing-extension-browser`.
  - Files: all
  - Dependencies: T6, T7, T8, T9
  - Scope: L

## Phase 4: EPUB (Slice 2)

- [ ] T11: Thêm `@abfcode/spine@0.15.0`
  - AC: `npm add @abfcode/spine@0.15.0`, `npm run build` pass, bundle size kiểm tra.
  - Verify: `npm run build` không lỗi; `npm view` xác nhận version.
  - Files: `package.json`, `package-lock.json`.
  - Dependencies: T10
  - Scope: S

- [ ] T12: `epubParser.ts` + fixtures
  - AC: `EpubBookParser` implement `BookParser`, trích metadata/chapters/text.
  - Verify: unit test với `tests/data-test/reader/sample.epub` (nếu có) hoặc mock buffer.
  - Files: `src/features/reader/services/epubParser.ts`, `epubParser.test.ts`.
  - Dependencies: T11
  - Scope: M

## Phase 5: PDF (Slice 3)

- [ ] T13: Thêm `pdfjs-dist@6.2.108`
  - AC: `npm add pdfjs-dist@6.2.108`, Vite copy `pdf.worker.mjs` đến `dist/assets/`.
  - Verify: `npm run build` pass; worker file xuất hiện trong `dist/`.
  - Files: `package.json`, `vite.config.ts`.
  - Dependencies: T10
  - Scope: S

- [ ] T14: `pdfParser.ts` + worker bundling
  - AC: `PdfBookParser` dùng `pdfjs-dist.getDocument` + `getTextContent` trích text từng trang.
  - Verify: unit test với `tests/data-test/reader/sample.pdf`.
  - Files: `src/features/reader/services/pdfParser.ts`, `pdfParser.test.ts`.
  - Dependencies: T13
  - Scope: M

## Phase 6: Polish (Slice 4)

- [ ] T15: Reader settings slice (rate/pitch/voice)
  - AC: Settings trong `chrome.storage.local`, UI voice selector.
  - Verify: browser test — đổi voice, apply cho TTS.
  - Files: `src/entities/settings/types.ts`, `src/shared/lib/storage/settingsStore.ts`, `src/features/reader/ui/ReaderSettings.tsx`.
  - Dependencies: T10
  - Scope: S

- [ ] T16: Anki auto-save sentence
  - AC: Nút "Save to Anki" cho câu đang chọn, prefill card creator.
  - Verify: browser test — save câu, tạo note.
  - Files: `src/features/reader/ui/ReaderAnkiButton.tsx`.
  - Dependencies: T10
  - Scope: S

- [ ] T17: Full E2E tests
  - AC: Playwright/E2E cho import → read → TTS → Anki → resume.
  - Verify: `npm run test:e2e`.
  - Files: `tests/e2e/reader.spec.ts`.
  - Dependencies: T16
  - Scope: M
