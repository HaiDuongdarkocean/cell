# Implementation Plan: Cell Reader

> Spec: `docs/specs/reader.md`  
> Intent: `docs/intent/reader.md`  
> Research: `docs/research/reader-technical.md`  
> Mockup: `docs/mockup/reader.html` + `docs/mockup/reader-README.md`

## Overview

Xây dựng tính năng Reader trong Cell MV3 để người học ngoại ngữ import và đọc sách EPUB/PDF/TXT/HTML. Tái sử dụng tokenizer, dictionary popup, TTS engine, card creator, storage đã có. Plan chia làm 4 slice, tập trung ship **Slice 1 (TXT/HTML MVP)** trước.

## Architecture Decisions

### AD1 — Dedicated extension page (mirror `local-player`)
- Tạo `src/entrypoints/reader/` gồm `index.html`, `main.tsx`, `App.tsx`.
- Mở từ Universal Panel qua background message `OPEN_READER` → `chrome.tabs.create({ url: chrome.runtime.getURL('src/entrypoints/reader/index.html') })`.
- Thêm `src/entrypoints/reader/index.html` vào `web_accessible_resources`.

### AD2 — Reader storage: OPFS + IndexedDB + settings slice
- OPFS lưu binary sách và text trích xuất.
- IndexedDB `cell-reader` lưu metadata sách, progress, saved words/sentences.
- `chrome.storage.local` chỉ lưu reader settings (rate, pitch, voice, auto-advance).

### AD3 — Format parser abstraction
- `BookParser` interface: `parse(file: File) -> ParsedBook`.
- Implementations: `textHtmlParser`, `epubParser` (slice 2), `pdfParser` (slice 3).

### AD4 — TTS theo câu
- `sentenceIndex` được tính từ `tokenizeTextBlock`.
- `TtsControlBar` quản lý current sentence, gọi `createTtsEngine().speak(sentence, { langCode })`.
- `prev`/`next` tính bằng công thức `currentSentenceIndex ± 1` trong chapter.

### AD5 — Tokenize lazy theo viewport
- Mỗi đoạn văn là một `TokenBlock`.
- Gọi `tokenizeTextBlock` khi render.
- Resolve status/frequency async sau khi tokenize.

## Task List

### Slice 1 — TXT/HTML MVP (ship first)

- [ ] T1: Scaffold `src/entrypoints/reader/` entrypoint + manifest update
- [ ] T2: `readerDb.ts` (IndexedDB `cell-reader`) + `readerOpfs.ts` (OPFS helpers)
- [ ] T3: `textHtmlParser.ts` + import flow
- [ ] T4: `ReaderLibraryView` + `readerStore` Zustand
- [ ] T5: `ReaderView` + `TokenizedParagraph`
- [ ] T6: `ReaderDictionarySheet` tích hợp `DictionaryPanelView`
- [ ] T7: `TtsControlBar` (prev/play/pause/next/repeat)
- [ ] T8: Progress + time tracking + resume
- [ ] T9: Universal Panel "Reader" button + `OPEN_READER` background handler
- [ ] T10: Build, typecheck, unit tests, browser verify

### Slice 2 — EPUB

- [ ] T11: Thêm `@abfcode/spine@0.15.0`
- [ ] T12: `epubParser.ts` + test fixtures

### Slice 3 — PDF

- [ ] T13: Thêm `pdfjs-dist@6.2.108`
- [ ] T14: `pdfParser.ts` + worker bundling

### Slice 4 — Polish

- [ ] T15: Settings slice (rate/pitch/voice)
- [ ] T16: Anki auto-save sentence
- [ ] T17: Full E2E tests

## Checkpoints

### CP1: After T1-T3
- `npm run typecheck` pass.
- `npm run build` pass.
- Có thể mở Reader page trống từ Universal Panel.

### CP2: After T4-T7
- Import TXT/HTML thành công.
- Click từ mở dictionary.
- TTS phát câu có điều khiển.

### CP3: After T8-T10
- Progress/resume hoạt động.
- Build + unit tests + browser verify pass.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `pdfjs-dist` worker CSP/bundling | High | Slice 3, test build thật trước. |
| `@abfcode/spine` parse lỗi | Medium | Try/catch + fallback spine index. |
| Storage OPFS quota | Medium | `navigator.storage.estimate()` + warn user. |
| TTS latency > 1s | Medium | `chrome.tts` cho MVP, cache sau. |
| Scope creep ép EPUB/PDF vào ngày mai | High | Ship Slice 1 trước, slice còn lại song song sau. |

## Open Questions

- TTS mặc định: `chrome.tts` (nhanh, cross-platform) hay `speechSynthesis` (đơn giản, không cần permission)? → `createTtsEngine` đã chọn `chrome.tts` trước.
