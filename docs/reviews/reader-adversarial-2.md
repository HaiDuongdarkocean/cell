# Reader — Adversarial Review (docs/specs/reader.md + related artifacts)

> Vai trò: reviewer phản biện. Chỉ liệt kê lỗi, giả định nguy hiểm, và thiếu sót. Không validate, không tóm tắt điểm mạnh.

---

## Tóm tắt nhanh

Phát hiện nhiều điểm trọng yếu: scope/timeline **không realistic** để ship MVP "ngày mai", thiếu chiến lược sanitize nội dung HTML/EPUB thực sự, mockup TTS timer/progress bar dựa trên giả định có thời lượng câu mà API không cung cấp, keyboard/accessibility bị bỏ qua hoàn toàn, và nhiều edge case (mã hóa, ngắt TTS, offline, storage đầy, ngôn ngữ không hỗ trợ) chỉ được liệt kê mà không có cơ chế xử lý.

---

## 1. UX

### UX-1 — Scope/timeline mâu thuẫn giữa AC và phase plan
**Severity: major**
- `docs/specs/reader-requirements.md` dòng 123-143 (AC-3, AC-4) yêu cầu import EPUB/PDF pass.
- `docs/specs/reader.md` dòng 156-163 chỉ acceptance cho `.txt`/`.html`.
- `docs/intent/reader.md` dòng 30-34 ghi Day-1 shipable chỉ TXT + HTML, EPUB/PDF thuộc Slice 2/3.
- **Lý do:** Người đọc spec không biết MVP thực sự gồm những gì. Dễ dẫn đến scope creep hoặc bỏ sót EPUB/PDF khi test.

### UX-2 — TTS progress bar / timer trong mockup dựa trên dữ liệu không tồn tại
**Severity: major**
- `docs/mockup/reader.html` dòng 170-193 vẽ thanh progress TTS và `0:18 / 1:45`.
- `docs/research/reader-technical.md` dòng 170-173 đề xuất dùng `createTtsEngine().speak(sentence, { langCode })` hoặc `createTtsAudioQueue` với `AudioBuffer` đã tổng hợp.
- **Lý do:** `chrome.tts` và `speechSynthesis` không trả về thời lượng câu theo thời gian thực. Chỉ khi pre-synthesize toàn bộ sách mới có duration, điều này không nằm trong Day-1 scope. UI sẽ bị "fake" hoặc không hoạt động.

### UX-3 — Không có flow xử lý lỗi / hủy import
**Severity: minor**
- `docs/specs/reader-requirements.md` dòng 51-60 (FR-2.1 → FR-2.6): hiển thị tiến trình import, từ chối file lỗi/DRM.
- **Lý do:** Không có UI cancel/abort, không có thông báo chi tiết loại lỗi (corrupt, unsupported, DRM, network, parser crash), không có nút thử lại.

### UX-4 — Resume dựa trên `scrollTop` / `sentenceIndex` rất dễ sai
**Severity: minor**
- `docs/research/reader-technical.md` dòng 177-182 đề xuất lưu `chapterIndex`, `sentenceIndex`, `scrollTop`.
- `docs/specs/reader-requirements.md` dòng 111-114 (FR-11.1, FR-11.2): resume vị trí cũ hoặc hỏi "Resume from X%".
- **Lý do:** Nếu thay đổi cỡ chữ, kích thước viewport, hoặc theme, `scrollTop` không còn khớp `sentenceIndex`. Không có thiết kế re-normalize vị trí.

### UX-5 — Dictionary popup/sheet trên mobile chưa được định nghĩa
**Severity: minor**
- `docs/research/reader-technical.md` dòng 149 (`ReaderDictionarySheet`) và dòng 175-176 đề cập `DictionaryPanelView`.
- `docs/mockup/reader.html` không có bất kỳ UI dictionary nào.
- **Lý do:** Trên mobile, popup có thể che phủ toàn bộ câu. Thiếu quyết định dùng bottom sheet, side panel, hay inline; thiếu cách đóng bằng swipe/back.

### UX-6 — Không có trạng thái "TTS không có voice / TTS lỗi"
**Severity: minor**
- `docs/specs/reader-requirements.md` dòng 86-93 (FR-7.1 → FR-7.4) mô tả controls.
- **Lý do:** Nếu `chrome.tts` không có voice cho ngôn ngữ sách, hoặc `speechSynthesis` bị disable, UI không hiển thị lỗi rõ ràng.

### UX-7 — Chọn từ để tra từ điển xung đột với việc select/copy văn bản
**Severity: minor**
- `docs/mockup/reader.html` dòng 152-160: `.token` là `display: inline-block` với `cursor: pointer`.
- **Lý do:** Toàn bộ văn bản bị bọc trong `span.token`. Người dùng không thể select/copy đoạn văn để dịch bên ngoài hoặc tra Google. Không có chế độ "chế độ đọc / chế độ tương tác".

### UX-8 — Không có empty/error state cho Library
**Severity: minor**
- `docs/specs/reader-requirements.md` dòng 67-68 (FR-3.5): hiển thị trạng thái trống khi chưa có sách.
- **Lý do:** Chỉ được đề cập 1 dòng, không có mockup hoặc spec cụ thể cho empty state, lỗi tải danh sách, hoặc lỗi storage.

---

## 2. Security

### SEC-1 — Sanitize HTML/EPUB chỉ là khẩu hiệu, không có công cụ thực
**Severity: blocker**
- `docs/specs/reader.md` dòng 136: "Sanitize HTML/EPUB trước khi render, CSP ngăn inline script."
- `docs/specs/reader-requirements.md` dòng 204-208 (NFR-3.1, NFR-3.4): yêu cầu sanitize + CSP.
- `docs/research/reader-technical.md` dòng 34-37: TXT/HTML dùng `DOMParser` và `body.innerText`.
- **Lý do:** Không có thư viện sanitizer (DOMPurify, html-to-text) trong tech stack. Nếu render HTML/EPUB qua `innerHTML` hoặc `dangerouslySetInnerHTML` với nội dung file người dùng, `<script>`, `onerror=`, `javascript:` URL có thể thực thi. CSP `'self'` không đủ nếu attacker tạo file HTML hợp lệ.

### SEC-2 — Phát hiện định dạng dựa trên MIME/extension không đáng tin
**Severity: major**
- `docs/specs/reader-requirements.md` dòng 53 (FR-2.3): "Phân biệt định dạng dựa trên MIME type hoặc extension."
- **Lý do:** Người dùng có thể đổi tên `.html` thành `.txt` hoặc gửi file với MIME spoof. Nếu parser `.txt` vô tình đưa nội dung vào `DOMParser` hoặc render với `innerHTML`, XSS vẫn xảy ra. Cần content sniffing + sandbox.

### SEC-3 — Nội dung EPUB từ `@abfcode/spine` có thể là HTML/XHTML thay vì plain text
**Severity: major**
- `docs/research/reader-technical.md` dòng 41-49: `book.iterChapters()` trả về `ch.text`.
- **Lý do:** Không rõ `ch.text` đã strip HTML tags hay vẫn chứa XHTML. Nếu là XHTML và bị render trực tiếp, attacker có thể nhúng `epub:script` hoặc SVG với JS. Cần validate hoặc chuyển về plain text + escape.

### SEC-4 — CSP cho reader page chưa được định nghĩa cụ thể
**Severity: major**
- `docs/specs/reader.md` dòng 136: chỉ nói "CSP ngăn inline script".
- `docs/research/reader-technical.md` dòng 76: manifest hiện tại có `script-src 'self' 'wasm-unsafe-eval'`.
- **Lý do:** `script-src 'self'` vẫn cho phép script từ origin extension. Nếu nội dung sách được ghi vào OPFS và phục vụ qua `blob:`/`data:` URL, CSP phải tách biệt. Không có CSP dành riêng cho `reader/index.html`.

### SEC-5 — Payload `OPEN_READER` / `IMPORT_BOOK` thiếu schema cụ thể
**Severity: minor**
- `docs/specs/reader.md` dòng 99: "Validate payload `OPEN_READER` / `IMPORT_BOOK` bằng Zod."
- **Lý do:** Không có định nghĩa shape/field bắt buộc. Nếu message bị malformed, extension có thể crash hoặc ghi dữ liệu rác.

### SEC-6 — Không kiểm tra tính toàn vẹn file OPFS sau ghi
**Severity: minor**
- `docs/research/reader-technical.md` dòng 220-231: lưu `source.bin` và `text.json` trong OPFS.
- **Lý do:** Không có hash/integrity check. Nếu OPFS bị hỏng hoặc bị browser dọn, ứng dụng có thể đọc file rác mà không phát hiện.

---

## 3. Accessibility

### A11Y-1 — Token từ không thể truy cập bằng bàn phím
**Severity: blocker**
- `docs/mockup/reader.html` dòng 152-160: `.token` là `<span>` với `cursor: pointer`.
- `docs/specs/reader-requirements.md` dòng 81-82 (FR-6.1, FR-6.3): click token để mở dictionary.
- **Lý do:** `span` không có `tabindex`, `role="button"`, không xử lý `Enter`/`Space`. Người dùng chỉ dùng bàn phím hoàn toàn không thể tra từ. Vi phạm WCAG 2.1.1 / 2.1.2.

### A11Y-2 — Không có focus-visible cho token và các nút điều khiển
**Severity: major**
- `docs/mockup/reader.html` dòng 160: `.token:hover { outline: ... }` nhưng không có `:focus-visible`.
- **Lý do:** Người dùng bàn phím không biết đang focus vào đâu. Cần `outline`/`box-shadow` rõ ràng khi focus.

### A11Y-3 — `lang="vi"` cứng trên toàn bộ trang dù nội dung sách có thể là tiếng Anh / khác
**Severity: major**
- `docs/mockup/reader.html` dòng 2: `<html lang="vi" data-theme="light">`.
- **Lý do:** Screen reader sẽ phát âm tiếng Anh theo giọng tiếng Việt. Cần đặt `lang` động theo `languageCode` của sách (`BookRecord.languageCode`).

### A11Y-4 — Thiếu ARIA live region cho TTS, progress, dictionary
**Severity: major**
- `docs/specs/reader-requirements.md` dòng 214-219 (NFR-5.4): hỗ trợ screen reader.
- **Lý do:** Khi TTS play/pause, câu hiện tại thay đổi, dictionary mở/đóng, screen reader không được thông báo. Không có `aria-live`, `role="status"`, `aria-atomic`.

### A11Y-5 — Token từng từ bị tách thành nhiều `<span>` gây đọc rời rạc
**Severity: minor**
- `docs/mockup/reader.html` dòng 329-380: mỗi từ là một `span.token`.
- **Lý do:** Screen reader có thể ngắt câu thành từng từ riêng lẻ, làm mất ngữ điệu. Cần `aria-label` hoặc `role` trên đoạn văn để đọc trôi chảy.

### A11Y-6 — `aria-label` tiếng Việt cứng trên các nút điều khiển
**Severity: minor**
- `docs/mockup/reader.html` dòng 215, 251, 320, 326, 384-386: `aria-label` bằng tiếng Việt.
- **Lý do:** Ứng dụng cross-language; nếu UI language khác, label không đúng. Cần i18n.

### A11Y-7 — Thiếu heading hierarchy và skip link
**Severity: minor**
- `docs/mockup/reader.html` dòng 319-327: `read-header` dùng `h1`, không có `h2`-`h6`.
- **Lý do:** Không có skip-to-content, không có landmarks rõ ràng (aside cho TOC, main cho nội dung). Khó điều hướng bằng screen reader.

---

## 4. Scope / Timeline

### TIM-1 — Day-1 shipable MVP không thực tế
**Severity: blocker**
- `docs/intent/reader.md` dòng 30-31: "Day-1 shipable MVP: TXT + HTML reader, tokenize, dictionary, TTS theo câu, progress/resume."
- `docs/specs/reader.md` dòng 156-163: success criteria gồm build pass, typecheck, tests pass, browser verify.
- `docs/research/reader-technical.md` dòng 351-376: danh sách ~20 file mới + settings migration + manifest update.
- **Lý do:** Scope này đòi hỏi tạo entrypoint, parser, OPFS/IndexedDB, Zustand store, UI components, dictionary wiring, TTS wiring, tests, E2E Playwright, build, verify trên Chrome thật. Không thể hoàn thành trong một ngày với chất lượng chấp nhận được.

### TIM-2 — Mâu thuẫn giữa `reader-requirements.md` AC và phase plan
**Severity: major**
- `docs/specs/reader-requirements.md` dòng 123-143 (AC-3, AC-4) đòi EPUB/PDF.
- `docs/intent/reader.md` dòng 32-33: EPUB/PDF thuộc Slice 2/3.
- **Lý do:** Tester sẽ căn cứ `reader-requirements.md` để reject build vì thiếu EPUB/PDF. Cần cập nhật AC hoặc ghi rõ "future".

### TIM-3 — Settings migration `v23 → v24` chỉ được nhắc mà không có kế hoạch
**Severity: major**
- `docs/research/reader-technical.md` dòng 322-324: thêm `ReaderSettings` và bump `CURRENT_SCHEMA_VERSION`.
- **Lý do:** Nếu không viết migration, người dùng cũ mở extension sẽ mất settings hoặc gặp lỗi Zod. Không có tài liệu hoặc file migration.

### TIM-4 — Chưa cập nhật `docs/2-architechture-system.md` và `docs/0-wiki.md`
**Severity: minor**
- `AGENTS.md` quy định: thay đổi `src/` cập nhật `docs/2-architechture-system.md`; thay đổi `docs/` cập nhật `docs/0-wiki.md`.
- `docs/specs/reader.md` dòng 138 cũng yêu cầu update architecture doc.
- **Lý do:** Nếu bỏ qua, tài liệu hệ thống sẽ sớm lỗi thời. Không có task trong timeline.

### TIM-5 — Manifest `web_accessible_resources` cho reader page và pdf.worker chưa lên kế hoạch
**Severity: major**
- `docs/research/reader-technical.md` dòng 119: thêm `src/entrypoints/reader/index.html` vào `web_accessible_resources`.
- Dòng 74-78: `pdfjs-dist` worker cần được copy vào `dist/` và thêm vào `web_accessible_resources`.
- **Lý do:** Nếu quên bước này, `chrome.tabs.create` với `reader/index.html` sẽ 404, hoặc PDF worker bị CSP / MIME block. "Ask first" trong `reader.md` dòng 141-143 làm tăng rủi ro bị bỏ sót.

### TIM-6 — E2E Playwright trên MV3 extension không nằm trong khả năng Day-1
**Severity: minor**
- `docs/specs/reader.md` dòng 127: E2E Playwright + skill `testing-extension-browser`.
- **Lý do:** Việc load extension thực, mở tab mới, import file giả, test TTS, resume, cần script và environment phức tạp. Không thể hoàn thành cùng ngày với implementation.

---

## 5. Edge Cases

### EDGE-1 — `tokenizeTextBlock` chỉ hỗ trợ `en` và `zh`
**Severity: major**
- `docs/research/reader-technical.md` dòng 15: `tokenizeTextBlock(text, langCode)` hỗ trợ `en` và `zh`.
- `docs/specs/reader.md` dòng 9: đối tượng học ngoại ngữ (10–25 tuổi), không giới hạn ngôn ngữ.
- **Lý do:** Sách tiếng Nhật, Hàn, Tây Ban Nha, Pháp… sẽ không tokenize đúng, dictionary lookup và TTS theo câu bị sai. Không có fallback.

### EDGE-2 — Mã hóa file TXT không được phát hiện
**Severity: major**
- `docs/research/reader-technical.md` dòng 34: TXT dùng `FileReader.readAsText(file)`.
- **Lý do:** `readAsText` mặc định UTF-8. File Windows-1252, Shift-JIS, GBK sẽ bị mojibake. Không có encoding detection hoặc cho phép người dùng chọn encoding.

### EDGE-3 — Trích xuất HTML bằng `body.innerText` mất cấu trúc
**Severity: major**
- `docs/research/reader-technical.md` dòng 35-37: HTML dùng `DOMParser` rồi `body.innerText` hoặc `textContent`.
- **Lý do:** Mất heading/paragraph/chapter. `textContent` vẫn lấy nội dung `<script>` và `<style>` nếu không loại bỏ. Không có paragraph boundary → TTS "câu" và progress % không có ý nghĩa.

### EDGE-4 — TTS bị gián đoạn không thể resume chính xác
**Severity: major**
- `docs/specs/reader-requirements.md` dòng 181 (E-6): TTS interrupted tự động pause, resume/replay.
- `docs/research/reader-technical.md` dòng 170-173: dùng `createTtsEngine` với `chrome.tts` hoặc `speechSynthesis`.
- **Lý do:** `chrome.tts` không có pause/resume chuẩn; `speechSynthesis.pause()` không giữ vị trí từng từ. Resume mid-sentence là không khả thi. Chỉ có thể replay câu.

### EDGE-5 — Storage đầy không được kiểm soát
**Severity: minor**
- `docs/specs/reader-requirements.md` dòng 185 (E-10): báo lỗi khi lưu, gợi ý xóa sách cũ.
- `docs/research/reader-technical.md` dòng 92-93: nên gọi `navigator.storage.estimate()` để cảnh báo.
- **Lý do:** Không có logic kiểm tra quota trước khi import, không có UI cleanup sách cũ. `unlimitedStorage` cũng không tránh được eviction.

### EDGE-6 — File trùng tên chưa được thiết kế cụ thể
**Severity: minor**
- `docs/specs/reader-requirements.md` dòng 183 (E-8): hỏi overwrite hoặc lưu bản sao.
- `docs/research/reader-technical.md` dòng 246-260: `BookRecord.id` là `crypto.randomUUID()` hoặc hash.
- **Lý do:** Nếu `id` là UUID, trùng tên không xảy ra, nhưng người dùng thấy nhiều sách cùng tên trong Library. Nếu `id` là hash nội dung, cùng file sẽ bị duplicate. Không có flow xác nhận.

### EDGE-7 — PDF scan không có text sẽ import trống
**Severity: minor**
- `docs/intent/reader.md` dòng 37-38: OCR cho PDF scan out of scope.
- `docs/specs/reader-requirements.md` dòng 137-138 (AC-4): chỉ trích text.
- **Lý do:** Người dùng import PDF scan sẽ thấy sách trống mà không biết tại sao. Cần thông báo "No text found, possibly scanned PDF".

### EDGE-8 — HTML/TXT lớn không có chunk/lazy tokenize
**Severity: major**
- `docs/specs/reader-requirements.md` dòng 79 (FR-5.3): tokenize one-pass hoặc lazy theo viewport.
- `docs/research/reader-technical.md` dòng 15-16: `tokenizeTextBlock` xử lý toàn bộ `text`.
- **Lý do:** Với file >10MB, tokenize toàn bộ trên main thread sẽ block UI. TXT/HTML không có chapter structure như EPUB, lazy theo viewport khó hơn.

### EDGE-9 — `beforeunload` không đảm bảo trên mobile khi process bị kill
**Severity: minor**
- `docs/specs/reader.md` dòng 137: lưu progress throttle mỗi 5s và trên `beforeunload`.
- **Lý do:** Trên Android hoặc khi tab bị kill bởi hệ điều hành, `beforeunload` không kịp chạy. Có thể mất đến 5s progress. Không có `visibilitychange` + background sync.

### EDGE-10 — DRM không có cơ chế phát hiện
**Severity: minor**
- `docs/specs/reader-requirements.md` dòng 60 (FR-2.5): từ chối file DRM.
- **Lý do:** Không có thư viện hoặc heuristic để phát hiện DRM. Chỉ có thể dựa vào parser fail, thông báo chung.

### EDGE-11 — Không có migration cho progress record khi schema thay đổi
**Severity: minor**
- `docs/research/reader-technical.md` dòng 264-275: `ReaderProgressRecord` với `id`, `bookId`, `profileId`, `chapterIndex`, `sentenceIndex`, etc.
- **Lý do:** Nếu sau này thêm field, version DB tăng, dữ liệu cũ có thể mất hoặc lỗi. Không có migration plan.

---

## 6. Mockup-specific (không phải source nhưng là artifact review)

### MOCK-1 — Mockup dùng `innerHTML` để chèn SVG theme icon
**Severity: minor**
- `docs/mockup/reader.html` dòng 410-415: `themeBtn.innerHTML = sunIcon`.
- **Lý do:** Nếu mô hình này được copy vào React, cần dùng `ICON_CATALOG` và render an toàn. `innerHTML` với nội dung tĩnh vẫn là pattern không khuyến khích.

### MOCK-2 — `aria-label` của theme button ban đầu rỗng
**Severity: minor**
- `docs/mockup/reader.html` dòng 215: `<button id="themeToggle" ... aria-label="Đổi theme"></button>`.
- **Lý do:** Giá trị ban đầu ổn, nhưng sau `setTheme` nó đổi. Vấn đề là label không theo ngôn ngữ UI thực. Không nghiêm trọng vì là mockup.

---

## 7. Kết luận

Spec hiện tại có **3 blocker**, **11 major**, và **~15 minor** vấn đề. Các vấn đề nghiêm trọng nhất cần xử lý trước khi ship là: scope/timeline không realistic, thiếu sanitize nội dung HTML/EPUB thực sự, token không keyboard-accessible, TTS progress bar dựa trên giả định sai, và `tokenizeTextBlock` giới hạn `en`/`zh`.
