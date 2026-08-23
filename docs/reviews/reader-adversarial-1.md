# Cell Reader — Adversarial Review (#1)

> Phạm vi: `docs/specs/reader.md`, `docs/intent/reader.md`, `docs/specs/reader-requirements.md`, `docs/research/reader-technical.md`, `docs/mockup/reader-README.md`.
> Nhiệm vụ: tìm lỗi/giả định nguy hiểm. Không validate, không tóm tắt điểm mạnh, không sửa mã nguồn.

---

## BLOCKER

1. **Mở Reader bằng `chrome.runtime.getURL('src/entrypoints/reader/index.html')` là đường dẫn build sai.**
   - `src/entrypoints/reader/index.html` là đường dẫn mã nguồn. Sau Vite build nó sẽ nằm ở `dist/reader.html` hoặc tương đương, không phải trong `src/entrypoints/`. Gọi URL này sẽ 404, feature không mở được.

2. **Đưa `index.html` của Reader vào `web_accessible_resources` là hiểu sai MV3 và tạo rủi ro bảo mật.**
   - `web_accessible_resources` dùng để phục vụ asset cho web page bên ngoài. Trang extension mở bằng `chrome.tabs.create` không cần nằm trong WAR. Nếu đưa vào, web page bên ngoài có thể truy cập `chrome-extension://<id>/reader.html`, dễ bị khai thác/xác định extension ID.

3. **Tokenizer chỉ hỗ trợ `en` và `zh` nhưng sản phẩm nhắm đến “người học ngoại ngữ” nói chung.**
   - NFR/FR yêu cầu đọc EPUB/PDF/TXT/HTML với ngôn ngữ bất kỳ. `tokenizeTextBlock` chỉ `en`/`zh` là giả định ngầm. Sách Nhật, Pháp, Tây Ban Nha, Hàn sẽ không tokenize đúng, click từ/dictionary/TTS theo câu bị ảnh hưởng.

4. **TTS mặc định chưa quyết định — Open Question cuối `docs/specs/reader.md` vẫn mở.**
   - Không chọn `chrome.tts` hay `speechSynthesis` làm default thì không thể viết code. Mọi yêu cầu TTS <1s, highlight, prev/next/repeat đều dựa trên engine chưa xác định.

5. **Tái sử dụng `ttsQueue` (AudioBuffer queue) với `createTtsEngine` bằng `chrome.tts`/`speechSynthesis` là mô hình không khớp.**
   - `ttsQueue` phục vụ `AudioBuffer` (Supertonic). `chrome.tts` và Web Speech TTS trả về streaming/utterance, không phải `AudioBuffer`. Ghép hai engine khác cơ chế mà không giải thích cách chuyển đổi sẽ sinh lỗi runtime hoặc code tự phát minh lại.

6. **Không thiết kế offscreen document cho TTS trong MV3.**
   - `speechSynthesis` không chạy trong service worker. `chrome.tts` có thể gọi từ extension page nhưng với Web Speech fallback cần offscreen doc nếu logic TTS chạy ở background. Spec không đề cập, dễ rơi vào trường hợp TTS im lặng khi tab background.

7. **`pdfjs-dist@6.2.108` là version chưa được xác minh / có khả năng không tồn tại.**
   - Version này xuất hiện như sự thật nhưng không được kiểm chứng bằng `npm view`. Nếu version sai, `npm install` thất bại hoặc lockfile không ổn định.

8. **CSP / manifest thiếu `worker-src` để load `pdf.worker.mjs`.**
   - Research ghi `script-src 'self' 'wasm-unsafe-eval'`. Worker file `pdf.worker.mjs` tuân theo directive `worker-src` hoặc `script-src` tùy trình duyệt. MV3 yêu cầu rõ `worker-src 'self'` hoặc đưa worker vào WAR với `matches`. Thiếu này có thể khiến PDF parser bị CSP block.

9. **Ví dụ mã `importBook(file: File)` trong spec truyền `File` trực tiếp cho parser nhưng EPUB/PDF cần `ArrayBuffer`/`Uint8Array`.**
   - `File` không thể đọc bằng parser. Cần `await file.arrayBuffer()`. Ví dụ SSOT này sẽ dẫn đến implement copy-paste bị lỗi typecheck hoặc runtime.

## MAJOR

10. **Bundle `pdfjs-dist` rất lớn nhưng không có kế hoạch lazy load / dynamic import.**
    - Thêm `pdfjs-dist` có thể tăng bundle MB. Vite không tự động tách nếu không cấu hình `manualChunks`. Điều này vi phạm yêu cầu tối ưu bundle và RAM thấp trên mobile.

11. **Tokenize file lớn trên main thread sẽ block UI, vi phạm NFR <5s/<15s.**
    - `tokenizeTextBlock` là logic tuần tự. Với file 50–100 MB, tokenize một lần trên main thread sẽ treo giao diện, vượt quá thời gian cam kết. Không có worker/thread pool trong kiến trúc.

12. **Lưu `text.json` toàn bộ chapter dưới OPFS và đọc một lần mâu thuẫn với “không giữ toàn bộ sách trong memory”.**
    - `text.json` chứa extracted plain text by chapter. Mở sách là parse toàn bộ JSON đó vào memory. Chapter dài vẫn chiếm RAM, đặc biệt với sách 100MB.

13. **Tính `% complete` bằng `currentSentenceIndex / totalSentences` mà `totalSentences` là optional, fallback `chapterIndex / totalChapters` quá thô.**
    - Nếu `totalSentences` không có, fallback chapter sẽ hiển thị 50% khi mới đọc xong chapter 5/10 dù chapter ngắn/dài khác nhau. Không có chiến lược khi dữ liệu partial.

14. **`SavedSentenceRecord.id = ${bookId}:${chapterIndex}:${sentenceIndex}:${profileId}` dễ invalid sau re-import.**
    - Nếu parser cập nhật hoặc file được import lại, `sentenceIndex` có thể dịch chuyển. Các câu đã lưu Anki/saved sẽ trỏ sai câu, dẫn đến dữ liệu rác hoặc crash khi resume.

15. **`SavedWordRecord.id = ${bookId}:${term.toLowerCase()}:${profileId}` sai với ngôn ngữ không phân biệt hoa thường và làm mất thông tin gốc.**
    - `toLowerCase()` không có ý nghĩa với tiếng Trung/Nhật/Hàn. Với tiếng Đức `ß` → `ss`, với tiếng Thổ `İ/i` mapping sai. Hơn nữa từ riêng/proper noun bị mất chữ hoa.

16. **`ReaderProgressRecord.id` phụ thuộc `profileId` nhưng không có fallback khi chưa đăng nhập/profileId null.**
    - Nếu profileId undefined, id trở thành `${bookId}:undefined`, gây duplicate/lỗi truy vấn khi user đổi profile.

17. **Sanitize HTML/EPUB không được định nghĩa cụ thể; chỉ dựa CSP là không đủ.**
    - React `dangerouslySetInnerHTML` không thực thi `<script>` mới nhưng vẫn giữ `onclick`, `onerror`, `javascript:`, `<style>` dính mã độc. Không có bộ lọc cụ thể (DOMPurify, allowlist tag/attr) trong kiến trúc.

18. **`pdfjs-dist getTextContent` không đảm bảo thứ tự đọc đúng với PDF layout phức tạp.**
    - PDF multi-column, table, hình, vector sẽ trích xuất text lộn xộn. Spec nói “chỉ text, không render” nhưng bỏ qua trải nghiệm đọc khó hiểu. Đây là unstated assumption rằng mọi PDF đều ra plain text có thể đọc.

19. **TXT parser không xử lý encoding khác UTF-8.**
    - `FileReader.readAsText` mặc định UTF-8. File TXT Windows-1252/GBK/Shift_JIS sẽ bị mojibake. Không có logic detect encoding hoặc `<meta charset>`.

20. **Phân biệt định dạng bằng MIME hoặc extension nhưng không có thuật toán fallback.**
    - EPUB thường có MIME `application/octet-stream` hoặc không đúng. PDF cũng có thể bị rename. Chỉ dựa `file.type` sẽ reject hợp lệ. Cần signature magic bytes (ZIP/PDF).

21. **Tái sử dụng `DictionaryPanelView`/`useDictionaryLookup`/`CardCreatorDialogContent` trong ngữ cảnh sách import giả định chúng hoạt động mà không cần DOM web thật.**
    - Các component này thiết kế cho web text với `element`, cursor offset, context sentence. Đưa “synthetic `TokenBlock` với `document.body`” là hack chưa được kiểm chứng, có thể gây lỗi lookup/context.

22. **Không có kế hoạch migration IndexedDB `cell-reader` vượt quá `DB_VERSION = 1`.**
    - Schema hiện gồm 4 object stores. Khi Slice 4 thêm saved word/sentence/collaboration, sẽ cần nâng version. Spec không đề cập `onupgradeneeded`, dễ dẫn đến data loss khi deploy update.

23. **Không có kế hoạch cụ thể tích hợp `navigator.storage.estimate()` và xử lý quota đầy.**
    - Research đề cập hàm này nhưng không nói khi gọi, UI cảnh báo ra sao. Edge case E-10 “Storage đầy” yêu cầu báo lỗi nhưng không có flow cụ thể.

24. **Zustand `readerStore` là local theo tab; mở 2 tab Reader sẽ diverge state.**
    - Không có cross-tab sync hoặc single source (storage). Cùng một sách mở ở 2 tab có thể ghi đè progress lẫn nhau.

25. **`beforeunload` lưu progress không đảm bảo trong MV3 khi process bị kill.**
    - NFR-10.2 “không mất dữ liệu khi thoát đột ngột” không thể đạt được chỉ bằng `beforeunload` vì MV3 extension page vẫn bị kill. Cần background save liên tục hoặc `visibilitychange`.

26. **`@abfcode/spine@0.15.0` là package niche, chưa có bằng chứng API ổn định.**
    - Một package nhỏ có thể thay đổi API hoặc bị abandon. Pin version mà không có API snapshot/test khiến dự án dễ bị phụ thuộc rủi ro.

## MINOR

27. **Hash routing `#panel`, `#home`, `#read` trong mockup được ghi là “không phải implement cuối cùng” nhưng không có quyết định routing thay thế.**
    - Reader cần router thực sự (memory router, wouter, react-router) hoặc quản lý view. Thiếu quyết định này trong spec.

28. **Nút theme toggle trong mockup nhưng không đồng bộ với extension global theme.**
    - `data-theme` trên `<html>` của reader page có thể khác Universal Panel. Không có flow đọc/ghi global theme.

29. **`span.token` clickable nhưng không phải focusable element; thiếu keyboard/a11y.**
    - NFR-5.1 yêu cầu keyboard navigation nhưng `<span>` không `tabindex`, không `role="button"`, không xử lý `Enter`/`Space`. Click từ bằng bàn phím không thể.

30. **Mockup/CSS link trực tiếp đến `src/shared/styles/tokens.css` là file generated; có thể bị ghi đè khi build.**
    - `tokens.css` là generated, SSOT là `tokens.json`. Mockup dùng đường dẫn `tokens.css` tĩnh có thể lỗi nếu file chưa được build.

31. **`E-4` offline: “Dictionary cần offline cache nếu có” quá mơ hồ.**
    - Không rõ dictionary có offline cache không, nếu có thì cơ chế gì. Nếu không, user offline sẽ click từ và không có nghĩa.

32. **`BookRecord.id` là “stable hash hoặc crypto.randomUUID()” nhưng không xử lý collision.**
    - Nếu dùng hash tên file/nội dung, hai file khác nhau trùng nội dung sẽ bị ghi đè. Nếu dùng randomUUID, import lại cùng file tạo ra 2 bản.

33. **`opfsDir: 'reader/books/{id}'` hardcoded trong schema, không phải SSOT.**
    - Đường dẫn OPFS nên được định nghĩa tại một nơi. Hardcode trong interface dễ sai đồng bộ với `readerOpfs.ts`.

34. **NFR TTS bắt đầu <1s nhưng `chrome.tts` lần đầu có thể >1s do load voice.**
    - Không có pre-warm voice hoặc caching. Trên mobile hoặc lần đầu, latency dễ vượt 1s.

35. **Không đề cập backup/export dữ liệu Reader; local-only có rủi ro mất dữ liệu khi gỡ extension.**
    - Dù ghi là out-of-scope, vẫn là rủi ro thực tế cần ghi nhận.

36. **Chưa quyết định cách Reader page được build (multi-page Vite hay single entry).**
    - Cấu trúc `src/entrypoints/reader/index.html` yêu cầu Vite multi-page. Nếu project chỉ build `index.html` hiện tại, phải sửa `vite.config.ts`, chưa được đề cập.

37. **`ReaderSettings` được thêm vào `chrome.storage.local` với migration `v23 → v24` nhưng baseline `v23` chưa xác nhận.**
    - Nếu current schema version khác, migration number sai, gây lỗi settings load.

38. **TTS “pre/post” trong FR-7.5 chưa được định nghĩa rõ nghĩa.**
    - “phát trước hoặc sau khi chuyển câu” là gì? Pre-roll/post-roll? Có thể gây hiểu lầch implement.

39. **Import progress “spinner/progress” cho file lớn nhưng không có metric cụ thể (byte đã xử lý / tổng byte).**
    - User không biết tiến độ thực sự, chỉ thấy spinner.

---

*Kết luận: Tìm thấy 9 blocker, 17 major, 13 minor. Đặc biệt nguy hiểm: đường dẫn build trang Reader, WAR sai, tokenizer ngôn ngữ hạn chế, TTS engine chưa quyết định, CSP worker, và storage schema dễ mất tính ổn định.*
