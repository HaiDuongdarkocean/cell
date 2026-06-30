# Phase 2d — UC14 Bookmark, UC15 Sync & Storage, UC16 Settings, UC17 Statistics

> Đã đọc 40 file use-case (UC14.1–UC14.5, UC15.1–UC15.8, UC16.1–UC16.12, UC17.1–UC17.9).
> Nguồn: `docs/.project-wiki/specs/design/UC/`

---

## UC14 — Bookmark Management (5 file)

- **Actor:** Free User, Premium User (Guest không có quyền). UC14.1 giới hạn Free ≤500 bookmark.
- **UC14.1 Tạo bookmark:** Tổng quát hóa UC03.7 cho mọi nguồn (web/video/EPUB/podcast). Bôi đen → context menu "🔖 Bookmark". Lưu kèm metadata theo nguồn: video→timestamp, EPUB→chapter+CFI position, podcast→audio timestamp. Tạo < 200ms, hoạt động offline.
- **UC14.2 Xem Bookmark Manager:** Toolbar popup tab Bookmarks hoặc Web App Dashboard. Hiển thị preview 100 ký tự, URL, title, tags, ngày tạo. Tìm kiếm theo text/URL, lọc theo tags/nguồn/ngày. Actions: mở URL gốc, tạo flashcard (UC14.4), gửi email (UC14.3), xóa (UC14.5). Tải < 300ms, offline.
- **UC14.3 Gửi bookmark email:** Chọn 1 hoặc nhiều bookmark → gửi email. Gmail API (nếu đã đăng nhập Google) hoặc fallback mailto. Subject "Orca Bookmarks — [ngày]", body chứa text + URL. Gmail API < 3s, mailto offline.
- **UC14.4 Tạo flashcard từ bookmark:** Alias của UC09.8 — cùng logic tạo flashcard.
- **UC14.5 Xóa bookmark:** Đơn lẻ (xác nhận → xóa, icon biến mất real-time) hoặc hàng loạt (chọn nhiều → "Xóa [n] bookmarks?"). Không thể hoàn tác. Xóa < 200ms.
- **Data entity:** Bookmark record chứa {content, URL, title, tags, source type, timestamp/CFI, created_at}. Lưu trong SQLite, offline-first.

---

## UC15 — Sync & Storage (8 file)

- **Actor:** Free User, Premium User; System (auto-sync/auto-merge). Guest không có quyền sync.
- **UC15.1 Sync Google Drive:** Service Worker auto-sync mỗi 15 phút khi có mạng, hoặc thủ công. Upload SQLite dump (incremental — chỉ records có `modified_at` > lần sync cuối) + media files mới. Cấu trúc Drive: `Orca/db/orca_[device_id].sqlite`, `Orca/media/{audio,images}`. Retry 3 lần exponential backoff, queue offline. Mã hóa data trước upload [Phase 2]. Không block UI.
- **UC15.2 Merge data Drive:** Tự động khi mở extension trên thiết bị mới, hoặc thủ công. Per-record merge theo `modified_at` — record mới hơn thắng, không xóa record. Conflict (cùng timestamp): local thắng (offline-first), log conflict cho UC15.3. Merge data: flashcards+FSRS history, vocabulary, bookmarks, settings, media. Atomic merge (rollback nếu fail). Merge 1,000 records < 10s.
- **UC15.3 Xem sync log:** Settings → Sync → Xem log. Mỗi entry: thời gian, thiết bị, số records upload/download, dung lượng, lỗi. Giữ 50 entries gần nhất. Log lưu trong SQLite. Tải < 200ms.
- **UC15.4 Xem storage usage:** Settings → Storage. Local breakdown: SQLite DB, media, từ điển, podcast. Drive: Orca folder / tổng Drive. Drive usage fetch async (không block local). Tải < 500ms.
- **UC15.5 Export data:** Settings → Data → Export. Export flashcards+FSRS history, vocabulary, bookmarks, settings, deck structure. Định dạng JSON (chỉ text) hoặc ZIP (text+media). Chọn loại data. JSON < 5s, ZIP background. File có thể import lại (UC15.6).
- **UC15.6 Import data:** File picker .json/.zip, validate format. Chế độ Merge (per-record, mới hơn thắng) hoặc Replace (xóa toàn bộ, backup trước). Preview số records. Atomic import (rollback nếu fail). Chạy background.
- **UC15.7 Export settings:** Export keyboard shortcuts, màu highlight, theme, UI language, TTS, AI settings+prompts, daily reminder, blacklist. JSON file `orca_settings_[ngày].json`. < 1s.
- **UC15.8 Import settings:** Chọn JSON, validate, preview, xác nhận. Mặc định Replace (settings toàn bộ), tùy chọn import từng loại. Hiệu lực ngay lập tức (không reload). < 1s.
- **Architecture-relevant:** Google Drive làm cloud sync backend, offline-first với per-record merge, Service Worker chạy sync background, incremental sync giảm bandwidth, atomic operations đảm bảo không mất data.

---

## UC16 — Settings & Permissions (12 file)

- **Actor:** Guest (xem phím tắt, theme, UI language, native language, TTS, blacklist, new tab), Free/Premium (tất cả). UC16.7 AI quota Free 30 lần/ngày.
- **UC16.1 Keyboard shortcuts:** Nhóm Navigation (N, Shift+N), Video (A/S/D/T/[/]), Highlight. Tùy chỉnh tổ hợp phím, validate conflict Chrome. Reset từng phím hoặc tất cả. Hiệu lực ngay, lưu SQLite + sync Drive.
- **UC16.2 Màu highlight:** 5 màu Learning Status (Chưa học/Theo dõi/Đang học/Đã học/Ignore) + 5 màu Frequency Tier. Color picker, preview real-time (< 50ms). Reset default. Lưu SQLite + sync Drive, áp dụng ngay trên trang đang mở.
- **UC16.3 Theme:** Light/Dark/Auto (prefers-color-scheme). Áp dụng cho toàn UI Orca (popup, Ocean Memory, Reader), không ảnh hưởng trang web. < 100ms.
- **UC16.4 UI language:** Tiếng Việt (mặc định), English. i18n dùng React i18next. Hiệu lực ngay, không ảnh hưởng language profile.
- **UC16.5 Native language:** Dùng cho dịch câu, subtitle dịch, AI giải thích. Lưu per-language-profile. Danh sách: Việt, English, 中文, 日本語, 한국어, Español, Français, Deutsch...
- **UC16.6 TTS:** 3 engine: Web Speech API (offline, chất lượng thấp), Edge TTS (online, cao), Google Cloud TTS (API key, cao nhất). Chọn giọng theo ngôn ngữ học, tốc độ 0.5x–2x, pitch. Preview < 1s. Fallback Web Speech API.
- **UC16.7 Cấu hình AI:** Chế độ Local (WebLLM — Qwen2.5 auto theo RAM: Lite 1.5B/Standard 3B/Pro 7B), Local (Ollama — endpoint localhost:11434), Cloud [Phase 2], Auto (local→cloud fallback). Download model background. Quota Free 30/ngày, reset 00:00 local. Test connection < 2s.
- **UC16.8 AI Prompts:** 5 prompts per language profile: Giải thích từ, Phân tích câu, Câu ví dụ, Ngữ pháp, Dịch. Biến `{word}`, `{sentence}`, `{native_language}`, `{target_language}`. Free-text editor, preview test. Reset default. Lưu per-language-profile, sync Drive, dùng chung cho WebLLM/Ollama/cloud.
- **UC16.9 Daily reminder:** Bật/tắt, chọn giờ (vd 20:00). Chrome Notifications API, click → mở Ocean Memory. Không nhắc nếu đã đạt daily goal. Sai số < 1 phút.
- **UC16.10 Blacklist:** Thêm URL/domain (hỗ trợ wildcard `*`, `?`). Hoặc "Tắt trên trang này" từ floating bar. Trang blacklist: không inject, không highlight, không floating bar. Check < 10ms. Import/Export JSON. Sync Drive.
- **UC16.11 New Tab override:** Bật → tab mới hiển thị Ocean Memory (SRS review + stats). Tắt → trang mặc định Chrome. Vẫn gõ URL bình thường. Load < 500ms.
- **UC16.12 Auto-pause video:** Bật → video tự dừng khi subtitle có ≥ N từ chưa biết (N=1/2/3, mặc định 1). Liên kết UC04.11. Lưu SQLite, áp dụng ngay.
- **Architecture-relevant:** Settings lưu trong SQLite, sync qua Drive. Per-language-profile cho native language + AI prompts. Chrome Notifications API cho reminder. WebLLM/Ollama cho AI local. React i18next cho UI i18n.

---

## UC17 — Statistics & Progress (9 file)

- **Actor:** Guest (basic stats UC17.1), Free/Premium (tất cả). System gửi notification (UC17.9).
- **UC17.1 Basic stats popup:** Toolbar popup tab Home. Streak (số ngày liên tiếp), cards due hôm nay, % retention (30 ngày), daily goal progress, lookup history 5 từ. Quick actions: Ôn tập ngay → Ocean Memory, Xem chi tiết → Web App. Tải < 200ms, offline.
- **UC17.2 Advanced stats webapp:** Web App Dashboard. 8 biểu đồ: Heatmap Calendar (365 ngày, giống GitHub), Vocabulary Growth (line, new/learning/known), Coverage (% biết theo frequency tier), Retention Rate (30 ngày), Card State Distribution (pie: New/Learning/Review/Mature), Immersion Source Breakdown (pie: web/video/podcast/EPUB/clipboard), Goal vs Actual, Time of Day Heatmap. Cần ≥ 7 ngày data. Charts dùng Chart.js/Recharts. Load < 1s, offline (SQLite local).
- **UC17.3 Review forecast:** Bar chart số cards due mỗi ngày trong 30 ngày tới. Màu New/Review. Tính từ `due_date` SQLite, offline. < 500ms.
- **UC17.4 Activity history:** Danh sách nguồn media đã học: tên, loại (web/video/podcast/EPUB/clipboard), ngày, thời gian học, số từ gặp/chưa biết, CEFR ước tính, % hoàn thành. Sắp xếp theo ngày/độ khó/% hoàn thành. Lazy load 20 items. < 300ms, offline.
- **UC17.5 Daily vocabulary digest:** Tổng hợp từ gặp hôm nay từ mọi nguồn: tổng unique, từ mới, từ quen, breakdown theo nguồn. Danh sách từ mới + gợi ý thêm vào flashcard. < 300ms, offline.
- **UC17.6 Per-source vocabulary:** Click nguồn trong Activity History → danh sách từ trong nguồn, % đã biết/chưa biết, CEFR ước tính, breakdown frequency tier. Tương tự UC06.4 nhưng cho mọi nguồn. < 1s, offline.
- **UC17.7 Level progress:** CEFR ước tính dựa trên số từ mature (FSRS interval ≥ 21 ngày) + frequency distribution: A1=500, A2=1,000, B1=2,000, B2=4,000, C1=8,000, C2=15,000+. IELTS ước tính từ CEFR. Giờ immersion "có hoạt động thực sự" (click từ, tạo card, đổi trạng thái — không tính chỉ mở trang). Progress bar đến level tiếp theo. Cần ≥ 100 từ. < 500ms, offline. Ghi chú: ước tính, không chính thức.
- **UC17.8 Difficult words:** Từ có số lần "Again" nhiều nhất trong 30 ngày. Hiển thị: từ, Again, Good, tỷ lệ đúng, interval hiện tại. Gợi ý ôn lại filtered session. Cần ≥ 7 ngày ôn tập. < 300ms, offline.
- **UC17.9 Daily achievement notification:** Chrome notification lúc 22:00 (hoặc giờ tùy chỉnh UC16.9). Nội dung: số cards đã ôn, từ mới gặp, streak, daily goal đạt/chưa. Chỉ gửi nếu đã học hôm nay + chưa tắt trong Settings. Click → popup tab Home. Sai số < 1 phút.
- **Architecture-relevant:** Toàn bộ thống kê tính offline từ SQLite local. FSRS interval dùng cho level estimation (mature = ≥21 ngày). Chrome Notifications API + alarms cho daily achievement. Charts lightweight (Chart.js/Recharts). Heatmap calendar giống GitHub contribution graph.

---

## Architecture Insights (cho Cell)

- **Bookmark là entity thống nhất đa nguồn:** Một bookmark record duy nhất chứa metadata theo nguồn (timestamp cho video/podcast, CFI position cho EPUB, URL cho web), lưu trong SQLite, offline-first. Bookmark Manager là entry point chung cho mọi action (mở, flashcard, email, xóa). Điều này ảnh hưởng Cell vì content script cần gửi metadata nguồn-specific về background để lưu đúng kiểu.
- **Google Drive sync là offline-first per-record merge:** Sync chạy trong Service Worker mỗi 15 phút, incremental (chỉ records `modified_at` > lần sync cuối), retry exponential backoff, queue offline. Merge per-record với rule "mới hơn thắng", conflict cùng timestamp → local thắng. Atomic merge/rollback. Cell cần thiết kế SQLite schema có `modified_at` trên mọi record để hỗ trợ incremental sync + merge.
- **Settings lưu SQLite + sync Drive, per-language-profile:** Keyboard shortcuts, màu highlight, AI prompts, native language đều lưu per-language-profile trong SQLite và sync qua Drive. AI prompts (5 loại) dùng chung cho WebLLM/Ollama/cloud. Cell cần settings store có cấu trúc per-profile và sync-able.
- **Thống kê 100% offline từ SQLite, FSRS-driven:** Mọi biểu đồ/forecast/level estimation tính từ SQLite local (due_date, FSRS interval, review history). CEFR level dựa trên từ mature (interval ≥ 21 ngày) + frequency distribution. Không cần backend cho statistics. Cell cần đảm bảo FSRS review log đầy đủ để tính retention/forecast/difficult words.
- **Notification dùng Chrome Notifications API + alarms:** Daily reminder (UC16.9) và daily achievement (UC17.9) đều dùng Chrome Notifications API, gửi qua Service Worker alarms. Không gửi nếu đã đạt daily goal hoặc chưa học. Cell cần alarm scheduler trong background + daily goal tracking.
