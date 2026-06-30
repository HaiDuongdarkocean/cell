# Phase 2b — Tóm tắt Use Cases UC05–UC10

> Đã đọc đầy đủ 30 file SRS thuộc 6 nhóm UC (UC05–UC10). Dưới đây là tóm tắt tiếng Việt theo từng nhóm.

---

## UC05 — Nghe podcast (6 file: UC05.1–UC05.6)

- **Actor:** Free User, Premium User (Guest không có quyền).
- **UC05.1 Thêm podcast:** Tìm podcast theo tên/host/keyword qua PodcastSearchService; thêm qua link Spotify/Apple; fetch tối đa 100 episodes gần nhất; metadata lưu SQLite offline. Giới hạn Free ≤10 podcast.
- **UC05.2 Download episode:** Download audio chạy background qua Service Worker, có progress bar, resume được. File lưu IndexedDB/File System Access API. Giới hạn Free ≤500 MB.
- **UC05.3 Phát podcast + subtitle:** Audio player đầy đủ (play/pause/seek/speed/volume). Whisper STT transcribe real-time, subtitle xuất hiện dần theo chunk, không block audio. Cache transcript theo episode URL + audio hash (3 ngày, IndexedDB). Highlight từ theo learning status, click từ mở word popup. Transcript panel có filter (i+1, đã biết, theo dõi). Giới hạn Free 60ph Whisper/ngày.
- **UC05.4 Click subtitle → seek:** Click câu trong transcript panel → audio seek đến start_time (<200ms). Click từ trong subtitle → word popup (không seek). Auto-scroll câu đang phát.
- **UC05.5 Làm mới subtitle:** Xóa cache cũ, chạy lại Whisper với chọn model (tiny/small) + ngôn ngữ. Có chỉnh sửa thủ công text câu trong transcript, lưu vào cache.
- **UC05.6 Quản lý thư viện podcast:** Card/list view với ảnh bìa, episode đang nghe dở, trạng thái offline. Ghim, xóa, tìm kiếm, lọc (đang nghe dở/đã tải/yêu thích). Đồng bộ metadata khi có internet; offline vẫn mở được. Library mở <2 giây.
- **Pre-condition chung:** Đã đăng nhập, đã thêm podcast (UC05.1).
- **Data entities:** Podcast (metadata, cover, author), Episode (title, duration, pubDate, audioURL, downloadStatus), Transcript/Subtitle (timestamped chunks), PodcastLibrary (pinned, filters).

---

## UC06 — Đọc EPUB/PDF (4 file: UC06.1–UC06.4)

- **Actor:** Guest, Free User, Premium User (Guest có quyền đọc — khác UC05).
- **UC06.1 Mở file:** File picker hoặc drag-drop .epub/.pdf. EPUB parse qua OPF manifest (EPUB 2.0/3.0). PDF render bằng PDF.js + extract text layer (không hỗ trợ PDF scan). Lưu danh sách sách đã mở (tên, ngày, tiến độ). Hoàn toàn offline, file không upload server.
- **UC06.2 Đọc với highlight:** Tokenize + highlight theo learning status (giống UC03.1). Lazy tokenize chỉ phần hiển thị. Word popup + nút thêm flashcard. Điều hướng chapter (EPUB) / scroll (PDF) / TOC. Tùy chỉnh font, line height, background (dark mode). Tokenize <1 giây cho 5,000 từ.
- **UC06.3 Lưu tiến độ đọc:** Auto-save mỗi 10 giây + khi đóng. EPUB lưu CFI (Canonical Fragment Identifier, chính xác paragraph level). PDF lưu số trang + scroll. Sync qua Google Drive (Free/Premium). Persist qua restart.
- **UC06.4 Per-book vocabulary:** Danh sách từ unique trong sách (số lần xuất hiện, frequency rank, trạng thái). Difficulty analysis: % đã biết, CEFR ước tính, breakdown theo frequency tier, top 20 từ khó. Gợi ý "Học trước n từ khó nhất" → thêm vào vocabulary tracker. Phân tích chạy background, cache + cập nhật khi đọc thêm.
- **Pre-condition:** File đã mở (UC06.1); UC06.4 cần đăng nhập + đọc ít nhất 1 chapter.
- **Data entities:** Book (filename, format, progress CFI/page), BookVocabulary (word, count, frequency, status), ReadingProgress (CFI/page, syncState).

---

## UC07 — Clipboard (5 file: UC07.1–UC07.5)

- **Actor:** Free User, Premium User.
- **UC07.1 Tạo session:** Nhập tên session → trở thành active. Danh sách sessions theo thứ tự mới nhất, chuyển đổi bằng click. Giới hạn Free ≤20 sessions. Lưu SQLite, persist, offline.
- **UC07.2 Paste text thủ công:** Textarea + Ctrl+Enter hoặc nút Thêm. Tokenize + highlight ngay sau khi thêm (<500ms cho 500 từ). Mỗi đoạn có nút xóa riêng.
- **UC07.3 Auto-detect clipboard:** Toggle ON → lắng nghe sự kiện copy (Ctrl+C) trên mọi trang, tự động thêm vào session active. Lọc: bỏ qua text <5 ký tự, trùng (debounce 1 giây), không phải ngôn ngữ học (URL, code). Chỉ đọc khi user chủ động copy. Badge trên extension icon.
- **UC07.4 Nghe TTS + điều hướng:** TTS đọc toàn bộ session, highlight câu real-time. Engine: Web Speech API (offline) hoặc Edge TTS (online). Điều hướng: play/pause, câu trước/tiếp, lặp câu, lặp đoạn (A-B). Tốc độ 0.5x–2x. Bắt đầu đọc <500ms.
- **UC07.5 Xem lại session:** Danh sách sessions (tên, số đoạn, ngày tạo/chỉnh sửa). Tìm kiếm theo tên hoặc nội dung. Xóa session có xác nhận. Tải <200ms, search debounce 200ms.
- **Pre-condition:** Đã đăng nhập; UC07.2–07.4 cần session active.
- **Data entities:** ClipboardSession (name, createdAt, updatedAt), ClipboardSegment (text, tokenized, order, sessionId).

---

## UC08 — Vocabulary tracking (6 file: UC08.1–UC08.6)

- **Actor:** Free User, Premium User (UC08.6 là System tự động).
- **UC08.1 Xem Vocabulary Manager:** Danh sách từ với target word, sentence context, status badge, POS, frequency rank, ngày thêm/cập nhật. Tìm fuzzy theo word/sentence. Lọc: trạng thái (5 loại), POS, frequency tier, ngày. Sắp xếp đa tiêu chí. Lazy load 50 từ/lần. Giới hạn Free ≤3,000 từ.
- **UC08.2 Đổi trạng thái thủ công:** 5 trạng thái: Chưa học (🔴), Theo dõi (🟠), Đang học (🟡), Đã học (🟢), Ignore (⬜). Click badge → dropdown. Hiệu lực ngay, highlight web cập nhật real-time. Đổi sang "Đang học" → tạo SRS card. Ghi status history. Đổi <100ms.
- **UC08.3 Bulk action:** Checkbox chọn nhiều + "Chọn tất cả" (trong filter hiện tại). Đổi trạng thái hàng loạt hoặc xóa (có xác nhận). 100 từ <500ms.
- **UC08.4 Import word list:** Định dạng: newline-separated, CSV (word,status), JSON, free-text (auto-tokenize). Preview số từ phát hiện + trùng. Chọn trạng thái mặc định (mặc định "Đã học"). Xử lý trùng: bỏ qua hoặc ghi đè. Import 1,000 từ <2 giây.
- **UC08.5 Xem status history:** Timeline từ mới nhất → cũ nhất. Mỗi entry: ngày giờ, trạng thái cũ → mới, lý do (Thủ công/FSRS mature/Import/Lapse). Lưu vĩnh viễn SQLite.
- **UC08.6 Auto-update status:** System tự động sau mỗi lần ôn tập SRS. Đang học → Đã học khi FSRS interval ≥21 ngày (mature threshold, tùy chỉnh trong Settings). Đã học → Đang học khi card bị lapse nhiều lần. Thông báo tổng kết sau session.
- **Pre-condition:** Đã đăng nhập, có từ đang track (UC08.6 cần SRS card + FSRS).
- **Data entities:** VocabularyEntry (word, status, POS, frequency, sentence, dates), StatusHistory (word, oldStatus, newStatus, timestamp, reason), SRS linkage (cardId, interval).

---

## UC09 — Tạo flashcard (8 file: UC09.1–UC09.8)

- **Actor:** Guest (chỉ UC09.2/09.3/09.5/09.6), Free User, Premium User.
- **UC09.1 Cấu hình destination:** Chọn Ocean Memory (SRS nội bộ, mặc định) hoặc Anki (qua AnkiConnect). Chọn deck + card type mặc định. Anki: map fields Orca → Anki. Cấu hình lưu per-language-profile trong SQLite.
- **UC09.2 Quick add flashcard:** Auto-fill từ word popup/transcript: target word, sentence, sentence translation, definition (từ điển active), word audio (Forvo → fallback TTS), sentence audio (cắt từ video theo timestamp), image (Google Images), POS, AI notes (30 lần/ngày Free), AI example sentence. Mở Card Creator để review. Giới hạn Guest/Free ≤625 cards. Auto-fill <2 giây (không tính AI).
- **UC09.3 Customize flashcard:** Card Creator với tất cả fields editable. Preview real-time mặt trước/sau. Lưu hoặc "Lưu và tạo tiếp". Auto-save draft mỗi 30 giây.
- **UC09.4 Chọn ảnh Google Images:** Query mặc định = target word, scrape Google Images (không API chính thức), grid 12 ảnh. Click → download + lưu local (không link URL). Upload từ máy (.jpg/.png/.gif/.webp). Ảnh resize ≤500KB.
- **UC09.5 Screenshot frame video:** Canvas API capture frame từ `<video>` element tại timestamp hiện tại. Resize 400x300px, JPEG quality 85%. Không hoạt động với DRM video. Chụp <200ms.
- **UC09.6 Thêm tags:** Gõ + Enter/dấu phẩy, auto-prefix #. Autocomplete từ tags đã dùng. Gợi ý tags phổ biến (#IELTS, #business, #slang...). Tối đa 10 tags/card. Lưu lowercase. Tags dùng để lọc trong Flashcard Manager + filtered review.
- **UC09.7 Bulk create từ transcript:** Alias của UC04.17, áp dụng cả video + podcast. Chọn câu trong transcript panel → tạo hàng loạt. Podcast stream không có sentence audio (chỉ nếu đã download).
- **UC09.8 Tạo flashcard từ bookmark:** Auto-fill sentence = nội dung bookmark, source = URL. Mở Card Creator để bổ sung target word, definition, audio, ảnh.
- **Pre-condition:** UC09.1 cần destination đã cấu hình; UC09.2 cần word popup/subtitle; UC09.8 cần bookmark (UC03.7/UC14.1).
- **Data entities:** Flashcard (targetWord, sentence, translation, definition, audioWord, audioSentence, image, POS, notes, tags, deck, destination), DeckConfig, AnkiFieldMapping, Tag (lowercase, autocomplete).

---

## UC10 — Quản lý flashcard (7 file: UC10.1–UC10.7)

- **Actor:** Free User, Premium User.
- **UC10.1 Xem Flashcard Manager:** Danh sách cards: target word, sentence preview, deck, SRS status (New/Learning/Review/Mature), ngày tạo, ngày ôn tiếp theo. Tìm theo word/sentence. Sắp xếp đa tiêu chí. Lazy load 50 cards/lần. Tải <300ms.
- **UC10.2 Lọc cards:** Filter: deck, card type, SRS status, ngày tạo, POS, tags. Kết hợp AND logic. Hiển thị số cards thỏa điều kiện. Filter <200ms, state persist khi navigate.
- **UC10.3 Sửa card:** Mở Card Creator với data pre-filled (giống UC09.3). Lưu cập nhật SQLite, FSRS history không bị ảnh hưởng. Lưu timestamp chỉnh sửa cuối. <200ms.
- **UC10.4 Xóa card:** Xác nhận trước khi xóa. Xóa card + media files (word audio, sentence audio, image) local + trên Drive. Xóa toàn bộ FSRS history. Không ảnh hưởng vocabulary tracker. Không để orphan media files.
- **UC10.5 Bulk actions:** Checkbox + "Chọn tất cả" (trong filter). Xóa, chuyển deck, đổi SRS status (reset New / đặt Mature). Xác nhận trước xóa. 100 cards <1 giây, xóa media background.
- **UC10.6 Sentence Bank:** Tất cả câu đã dùng làm sentence field. Mỗi câu: text, nguồn (web/video/podcast/EPUB/clipboard), ngày thêm, số cards dùng. Tìm + lọc theo nguồn. Click → xem cards dùng câu, nút "Tạo card mới với câu này".
- **UC10.7 Audio Bank:** Tất cả audio files cắt từ video/podcast. Mỗi file: tên, nguồn, thời lượng, dung lượng, ngày tạo, card đang dùng. Phát lại, xóa (cảnh báo nếu đang dùng bởi card). Hiển thị tổng dung lượng.
- **Pre-condition:** Đã đăng nhập, có ít nhất 1 card (UC10.6 cần sentence field, UC10.7 cần audio file).
- **Data entities:** Flashcard (full), SRSState (status, nextReview, interval), SentenceBank (sentence, source, sourceType, cardCount), AudioBank (filename, source, duration, size, cardId), MediaFile (local + Drive sync state).

---

## Architecture Insights

- **Podcast pipeline (UC05):** Whisper STT transcribe chạy async không block audio, cache transcript theo (episodeURL + audioHash) trong IndexedDB (3 ngày). Download chạy background qua Service Worker với resume. Metadata podcast lưu SQLite offline — thư viện mở được không cần internet. Kiến trúc chia 3 view: Browser → Episode List → Player, tách riêng Podcast Library (UC05.6).
- **EPUB/PDF reader (UC06):** EPUB parse qua OPF manifest + render HTML chapter; PDF dùng PDF.js + text layer extraction. Tiến độ đọc dùng CFI (EPUB, paragraph-level) / page (PDF), sync qua Google Drive. Per-book vocabulary analysis chạy background, cache + cập nhật incrementally khi đọc thêm chapter. Tokenize lazy (chỉ phần hiển thị) để tránh lag. Hoàn toàn offline, file xử lý local không upload.
- **Clipboard (UC07):** Session-based architecture — mỗi session là một container text độc lập lưu SQLite. Auto-detect lắng nghe copy event toàn cục qua content script, lọc text (length, dedup debounce, language). TTS dùng Web Speech API (offline) hoặc Edge TTS (online). Tokenize dùng cùng engine với highlight (nhất quán cross-module).
- **Vocabulary tracking (UC08):** 5 trạng thái (unknown/tracking/learning/known/ignore) là trung tâm của toàn bộ hệ thống highlight + SRS. Status history lưu vĩnh viễn trong SQLite (audit trail). FSRS integration: interval ≥21 ngày → auto mature → "Đã học"; lapse → quay lại "Đang học". Bulk action + import hỗ trợ onboarding nhanh (import từ vựng đã biết). Giới hạn Free 3,000 từ, lazy load 50/lần.
- **Flashcard creation + management (UC09–UC10):** Destination abstraction (Ocean Memory nội bộ hoặc Anki qua AnkiConnect) với field mapping per-language-profile. Card Creator là trung tâm — auto-fill từ nhiều nguồn (word popup, transcript, bookmark) rồi review/edit. Media management tách biệt: Sentence Bank + Audio Bank là 2 repository riêng, track source (web/video/podcast/EPUB/clipboard) + card usage, xóa card cascade xóa media (không orphan). Tags lowercase, tối đa 10/card, dùng cho filter + filtered review. Giới hạn Guest/Free 625 cards. SRS history độc lập với content editing (sửa card không reset FSRS).
