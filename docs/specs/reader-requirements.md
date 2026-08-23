# Reader Feature Requirements Spec

## 1. Objective

Cell Reader là tính năng mở rộng của tiện ích Cell MV3, cho phép người học ngoại ngữ (10–25 tuổi) import và đọc sách ở định dạng EPUB/PDF/TXT/HTML trên desktop/tablet/mobile. Reader tận dụng lại các thành phần sẵn có của hệ thống (tokenizer, dictionary popup, TTS queue, card creator, storage) để cung cấp trải nghiệm đọc song ngữ, tra từ, nghe phát âm theo câu, lưu từ vựng vào Anki, và theo dõi tiến trình đọc có thể resume.

---

## 2. User Stories

### US-1: Mở Reader từ Universal Panel
Là người dùng Cell, tôi muốn mở Reader từ Universal Panel để bắt đầu đọc sách.

### US-2: Import sách định dạng hỗ trợ
Là người dùng, tôi muốn import file TXT/HTML/EPUB/PDF vào Reader để tạo thư viện sách cá nhân.

### US-3: Quản lý thư viện sách
Là người dùng, tôi muốn xem danh sách sách đã import, chọn sách để đọc, và xóa sách khỏi thư viện.

### US-4: Đọc nội dung theo câu/đoạn
Là người dùng, tôi muốn nội dung sách được hiển thị theo câu/đoạn dễ đọc để tập trung học từng phần.

### US-5: Tokenize văn bản
Là người dùng, tôi muốn mỗi từ trong câu được tách riêng (tokenize) để có thể click tra nghĩa.

### US-6: Tra từ điển popup
Là người dùng, tôi muốn click vào từ để mở popup dictionary sẵn có xem nghĩa và phát âm.

### US-7: Nghe TTS theo câu
Là người dùng, tôi muốn chọn một câu hoặc đoạn để TTS phát âm, với điều khiển prev/pause/play/next/repeat.

### US-8: Lưu từ/câu vào Anki
Là người dùng, tôi muốn lưu từ hoặc câu đang xem vào Anki qua card creator sẵn có để ôn tập sau.

### US-9: Theo dõi tiến trình và thời gian đọc
Là người dùng, tôi muốn Reader ghi lại % đọc được và tổng thời gian đọc.

### US-10: Resume vị trí đọc
Là người dùng, tôi muốn khi mở lại sách, Reader tự động quay lại vị trí cũ để tiếp tục đọc.

---

## 3. Functional Requirements

### 3.1 Universal Panel → Open Reader
- **FR-1.1**: Universal Panel hiển thị entry point "Reader" dẫn đến reader page/tab mới.
- **FR-1.2**: Click entry point mở `chrome-extension://<id>/reader.html` (hoặc tương đương) trong tab mới.
- **FR-1.3**: Reader page load trong < 3s.

### 3.2 Import
- **FR-2.1**: Người dùng có thể chọn file từ bộ chọn file hệ thống (input type="file").
- **FR-2.2**: Hỗ trợ định dạng:
  - `.txt` — `FileReader` đọc text.
  - `.html` / `.htm` — `DOMParser` parse.
  - `.epub` — `@abfcode/spine@0.15.0` với `fflate`.
  - `.pdf` — `pdfjs-dist@6.2.108` trích xuất text, không render.
- **FR-2.3**: Phân biệt định dạng dựa trên MIME type hoặc extension.
- **FR-2.4**: Hiển thị tiến trình import (spinner/progress) cho file lớn.
- **FR-2.5**: Từ chối file không hỗ trợ hoặc DRM với thông báo rõ ràng.
- **FR-2.6**: Lưu nội dung đã parse vào local storage (`chrome.storage.local`/OPFS/IndexedDB).

### 3.3 Library
- **FR-3.1**: Trang Library liệt kê sách đã import với: tên, định dạng, % tiến trình, lần đọc cuối.
- **FR-3.2**: Người dùng click sách để mở đọc.
- **FR-3.3**: Người dùng có thể xóa sách khỏi thư viện (xác nhận trước khi xóa).
- **FR-3.4**: Library sắp xếp theo thời gian đọc gần nhất hoặc tên.
- **FR-3.5**: Hiển thị trạng thái trống khi chưa có sách nào.

### 3.4 Read
- **FR-4.1**: Hiển thị nội dung theo câu/đoạn, mỗi câu là một đơn vị có thể chọn.
- **FR-4.2**: Hỗ trợ cuộn (scroll) hoặc phân trang tùy viewport.
- **FR-4.3**: Câu đang chọn được highlight.
- **FR-4.4**: Hiển thị tên sách và % tiến trình trên header.

### 3.5 Tokenize
- **FR-5.1**: Mỗi câu được tokenize bằng `tokenizeTextBlock` sẵn có, tách thành các token từ.
- **FR-5.2**: Token hiển thị inline trong câu, không làm vỡ layout.
- **FR-5.3**: Tokenize chỉ chạy một lần khi parse/import hoặc lazy theo viewport để tối ưu.

### 3.6 Dictionary Popup
- **FR-6.1**: Click token từ mở dictionary popup sẵn có.
- **FR-6.2**: Popup hiển thị nghĩa, phát âm, và nút lưu Anki (nếu tích hợp).
- **FR-6.3**: Click ra ngoài hoặc nút đóng để tắt popup.

### 3.7 TTS (pre/post/pause/play/repeat)
- **FR-7.1**: Người dùng click câu hoặc nút play để TTS phát câu đó.
- **FR-7.2**: TTS sử dụng `ttsQueue`/`ttsEngineService` sẵn có, với fallback `chrome.tts`.
- **FR-7.3**: Cung cấp điều khiển:
  - **Prev**: phát câu trước.
  - **Play**: bắt đầu/pause.
  - **Next**: phát câu sau.
  - **Repeat**: phát lại câu hiện tại.
- **FR-7.4**: Câu đang phát được highlight đồng bộ.
- **FR-7.5**: Có thể chọn phát trước (pre) hoặc sau (post) khi chuyển câu.

### 3.8 Progress & Time Tracking
- **FR-8.1**: Reader ghi lại % tiến trình dựa trên vị trí cuộn/câu hiện tại.
- **FR-8.2**: Tổng thời gian đọc được cộng dồn khi Reader đang active (tab focus).
- **FR-8.3**: Lưu progress + time mỗi 5s hoặc khi thoát.
- **FR-8.4**: Hiển thị % và thời gian trên UI.

### 3.9 Anki Save
- **FR-9.1**: Từ dictionary popup hoặc câu đang chọn có nút "Save to Anki".
- **FR-9.2**: Gọi card creator sẵn có để tạo card.
- **FR-9.3**: Hiển thị xác nhận khi lưu thành công hoặc lỗi.

### 3.10 Exit
- **FR-10.1**: Khi đóng tab/refresh, Reader lưu progress và time cuối cùng.
- **FR-10.2**: Không mất dữ liệu khi thoát đột ngột.

### 3.11 Resume
- **FR-11.1**: Khi mở lại sách từ Library, Reader tự động cuộn đến câu/vị trí cuối cùng.
- **FR-11.2**: Hỏi người dùng "Resume from X%?" hoặc tự động resume sau 3s.

---

## 4. Acceptance Criteria

### AC-1: Mở Reader từ Universal Panel
**Given** người dùng đang ở Universal Panel
**When** click nút "Reader"
**Then** một tab mới mở ra với reader page, load hoàn tất trong < 3s, hiển thị Library.

### AC-2: Import sách TXT/HTML
**Given** người dùng ở Library
**When** chọn file `.txt` hoặc `.html` từ bộ chọn
**Then** file được parse, lưu vào thư viện, và xuất hiện trong danh sách trong < 3s.

### AC-3: Import sách EPUB
**Given** người dùng chọn file `.epub`
**When** hệ thống parse qua `@abfcode/spine`
**Then** nội dung text được trích xuất, lưu thư viện, hiển thị tiêu đề và % mặc định 0%.

### AC-4: Import sách PDF
**Given** người dùng chọn file `.pdf`
**When** hệ thống trích text qua `pdfjs-dist`
**Then** text được lưu, không hiển thị layout/hình ảnh, chỉ text có thể đọc.

### AC-5: Quản lý thư viện
**Given** thư viện có ít nhất 1 sách
**When** người dùng click sách hoặc click xóa
**Then** sách mở ra đọc, hoặc sách bị xóa khỏi danh sách sau xác nhận.

### AC-6: Tokenize và click từ
**Given** sách đang ở chế độ đọc
**When** người dùng click một từ trong câu
**Then** dictionary popup sẵn có mở lên với nghĩa của từ đó.

### AC-7: TTS phát câu
**Given** người dùng chọn một câu
**When** click play TTS
**Then** câu được phát âm, câu đó highlight, và điều khiển prev/pause/next/repeat hoạt động.

### AC-8: Lưu Anki
**Given** popup dictionary đang mở hoặc câu đang chọn
**When** người dùng click "Save to Anki"
**Then** card creator sẵn có tạo card, hiển thị thông báo thành công.

### AC-9: Theo dõi progress
**Given** người dùng đọc sách 50% rồi đóng tab
**When** mở lại sách đó
**Then** progress hiển thị 50% và tự động resume về vị trí gần 50%.

### AC-10: Thời gian đọc
**Given** người dùng đọc sách 5 phút
**When** mở lại Library hoặc sách
**Then** tổng thời gian đọc tăng thêm ~5 phút.

---

## 5. Edge Cases

| # | Edge case | Expected behavior |
|---|---|---|
| E-1 | File lớn (>100MB PDF/EPUB) | Hiển thị progress import, parse theo chunk, không crash, tối ưu RAM. Nếu vượt quá giới hạn bộ nhớ, báo lỗi rõ ràng. |
| E-2 | File lỗi (corrupted, không đọc được) | Báo lỗi "Cannot read file" và cho phép chọn lại. Không lưu vào thư viện. |
| E-3 | Mất tiến trình (crash, tắt máy) | Lưu progress + time mỗi 5s; khi mở lại, khôi phục gần nhất có thể. |
| E-4 | Offline | Không cần mạng cho đọc local; TTS fallback `chrome.tts` hoạt động offline nếu engine có sẵn. Dictionary cần offline cache nếu có. |
| E-5 | Mobile viewport | Reader layout responsive, câu rộng vừa màn hình, điều khiển TTS dễ chạm, không cần hover. |
| E-6 | TTS interrupted (tab chuyển, điện thoại khóa, TTS engine lỗi) | Tự động pause, khi quay lại có thể resume hoặc replay. Hiển thị trạng thái pause rõ ràng. |
| E-7 | File định dạng không hỗ trợ (.mobi, .azw) | Thông báo "Unsupported format" và gợi ý đổi sang TXT/HTML. |
| E-8 | File trùng tên | Hỏi overwrite hoặc lưu như bản sao (e.g. `book (1)`). |
| E-9 | Từ không có trong dictionary | Popup hiển thị thông báo "No definition found" thay vì crash. |
| E-10 | Storage đầy | Báo lỗi khi lưu, gợi ý xóa sách cũ. |

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **NFR-1.1**: Mở Reader < 3s.
- **NFR-1.2**: Import file < 50MB < 5s; file 50–100MB < 15s.
- **NFR-1.3**: Tokenize lazy hoặc one-pass, không block UI.
- **NFR-1.4**: TTS bắt đầu < 1s sau khi click play.
- **NFR-1.5**: Tối ưu RAM, không giữ toàn bộ sách trong memory nếu file lớn.

### 6.2 MV3 Compliance
- **NFR-2.1**: Sử dụng service worker/background script theo chuẩn MV3.
- **NFR-2.2**: Không dùng persistent background page.
- **NFR-2.3**: Reader page là extension page/tab mới, không inline content script.
- **NFR-2.4**: Chrome API sử dụng đúng docs: https://developer.chrome.com/docs/extensions/reference/

### 6.3 Security
- **NFR-3.1**: Không thực thi script trong file HTML/EPUB import; sanitize trước khi render.
- **NFR-3.2**: Chỉ lưu file trong extension storage (`chrome.storage.local`/OPFS/IndexedDB), không ghi ra disk tùy ý.
- **NFR-3.3**: Không xử lý sách DRM.
- **NFR-3.4**: CSP cho reader page ngăn inline script từ nội dung sách.

### 6.4 Responsive
- **NFR-4.1**: Reader hoạt động trên desktop (>=1024px), tablet (768px–1023px), mobile (<768px).
- **NFR-4.2**: Font size, line height điều chỉnh theo viewport hoặc setting.
- **NFR-4.3**: Điều khiển TTS sticky ở dưới, dễ chạm trên mobile.

### 6.5 Accessibility
- **NFR-5.1**: Hỗ trợ keyboard navigation (Tab, Enter, Space, arrow keys).
- **NFR-5.2**: Các nút điều khiển có `aria-label`.
- **NFR-5.3**: Text đủ contrast (theo design system tokens).
- **NFR-5.4**: Hỗ trợ screen reader cho cấu trúc câu/đoạn.

---

## 7. Out of Scope

- MOBI/AZW import.
- OCR cho PDF scan.
- Giọng Supertonic thực — sử dụng `chrome.tts`/fallback cho đến khi TTS feature hoàn tất.
- Sách DRM.
- Cloud sync (chỉ local storage).
- Rendering PDF phức tạp (layout, hình ảnh, table, vector).
- Phân tích ngữ pháp nâng cao.
- Sync đa thiết bị.

---

## 8. Phased Scope (lặp lại từ intent để tham chiếu)

- **Day-1 shipable MVP**: TXT + HTML reader (native parser), tokenize, dictionary, TTS theo câu, progress/resume.
- **Slice 2**: thêm EPUB parser (`@abfcode/spine`).
- **Slice 3**: thêm PDF text extraction (`pdfjs-dist`).
- **Slice 4**: polish, settings, Anki auto-save, sync.
