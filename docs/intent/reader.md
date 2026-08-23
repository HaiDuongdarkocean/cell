# Intent: Cell Reader

## Outcome
Tính năng Reader trong Cell MV3 để người học ngoại ngữ import và đọc sách EPUB/PDF/TXT/HTML, tokenize, tra từ điển popup có sẵn, nghe TTS theo câu với điều khiển prev/pause/play/next/repeat, lưu từ vựng vào Anki qua card creator có sẵn, theo dõi % và thời gian đọc, resume vị trí cũ.

## User
Người dùng Cell từ 10–25 tuổi học ngoại ngữ trên desktop/tablet/mobile.

## Why now
Mở rộng Cell từ video+subtitle sang đọc sách, tái sử dụng tokenizer, dictionary popup, TTS queue, card creator, storage đã có trong hệ thống.

## Success
- Mở Reader từ Universal Panel.
- Import sách định dạng hỗ trợ, xem nội dung theo câu/đoạn.
- Click từ → popup dictionary hiện có mở lên.
- Chọn/bắt đầu câu → TTS phát với prev/pause/play/next/repeat.
- Lưu thời gian đọc và % tiến trình, resume sau khi thoát.
- Lưu từ/câu vào Anki qua card creator.
- Build pass, typecheck 0 lỗi, tests pass, verify trên browser.

## Constraints
- MV3 extension chạy trên Chrome/Edge/Brave, cross-browser desktop/tablet/mobile.
- Tái sử dụng `tokenizeTextBlock`, dictionary popup, `ttsQueue`/`ttsEngineService`, card creator, `chrome.storage.local`/OPFS/IndexedDB.
- EPUB: `@abfcode/spine@0.15.0` (dùng `fflate` có sẵn).
- PDF: `pdfjs-dist@6.2.108` (chỉ trích text, không render).
- TXT/HTML: `FileReader` + `DOMParser` native.
- Reader mở dưới dạng extension page/tab mới để có đủ không gian đọc.
- Responsive, thời gian phản hồi < 3s, tối ưu RAM thấp.

## Phased scope
- **Day-1 shipable MVP**: TXT + HTML reader (native parser), tokenize, dictionary, TTS theo câu, progress/resume.
- **Slice 2**: thêm EPUB parser (`@abfcode/spine`).
- **Slice 3**: thêm PDF text extraction (`pdfjs-dist`).
- **Slice 4**: polish, settings, Anki auto-save, sync.

## Out of scope
- MOBI/AZW.
- OCR cho PDF scan.
- Giọng Supertonic thực cho đến khi TTS feature hoàn tất; dùng `chrome.tts`/fallback.
- Sách DRM.
- Cloud sync (chỉ local).
- Rendering PDF phức tạp (layout, hình ảnh).
