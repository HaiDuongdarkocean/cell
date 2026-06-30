# Phase 2a — Tóm tắt Use Cases UC01–UC04

> Đã đọc 38 file UC (UC01: 7, UC02: 6, UC03: 8, UC04: 17).
> Nguồn: `docs/.project-wiki/specs/design/UC/`

---

## UC01 — Quản lý tài khoản & Profile (7 files)

- **Actors:** Guest (người dùng mới), Free User, Premium User. System (Service Worker) cho auto-download từ điển.
- **UC01.1 Onboarding:** Mở tab tự động sau cài. Chọn ngôn ngữ học (EN/ZH) → download từ điển (WordNet+Freq EN, CC-CEDICT+HSK ZH) ở background (Service Worker) → tạo Guest profile ngay lập tức. Guest: highlight, word popup, flashcard (giới hạn 625), SRS. Không sync Drive.
- **UC01.2 Đăng nhập Google:** `chrome.identity.launchWebAuthFlow` + OAuth 2.0. Nhận access/refresh token → lưu encrypted trong `chrome.storage.local`. Chuyển Guest → Free User, giữ nguyên data local, bắt đầu sync Google Drive. Refresh token tự gia hạn.
- **UC01.3 Đăng xuất:** Xóa token khỏi `chrome.storage.local`, hủy link Drive, chuyển về Guest mode. **Giữ nguyên data local** (flashcard, vocabulary, settings). Giới hạn flashcard về 625 (Guest tier).
- **UC01.4 Chỉnh sửa thông tin:** Tên hiển thị (≤50 ký tự), avatar (JPG/PNG ≤2MB), ngôn ngữ giao diện, ngôn ngữ mẹ đẻ. Email chỉ đọc (từ Google). Đổi mật khẩu = mở tab Google Account. Nâng cấp Premium = placeholder Phase 2. Lưu vào SQLite local + sync Drive.
- **UC01.5 Thêm language profile:** Free/Guest = 1 ngôn ngữ, Premium = không giới hạn. Download từ điển ngôn ngữ mới ở background. Profile tạo ngay (<1s), highlight kích hoạt sau khi download xong.
- **UC01.6 Switch language profile:** Toolbar popup dropdown (Premium only, ≥2 profiles). Reload content script, cập nhật highlight + floating badge theo profile mới. <500ms, không reload trang.
- **UC01.7 Cấp quyền extension:** 3 phạm vi: trang này, domain, all_urls. Content script inject ngay (<500ms, không reload). Quản lý blacklist (Options page). Danh sách quyền lưu `chrome.storage.local` + sync Drive. Không inject vào `chrome://` pages.
- **Data entities:** User (id, email, name, avatar, tier, native_lang), LanguageProfile (lang, dict status, vocab stats), Permission (url, scope), Blacklist.
- **Architecture:** SQLite local là source of truth, Google Drive sync optional. Token encrypted trong chrome.storage.local. Service Worker xử lý background download.

---

## UC02 — Quản lý từ điển (6 files)

- **Actors:** Guest, Free User, Premium User. System cho auto-check update (mỗi 7 ngày).
- **UC02.1 Xem danh sách:** Nhóm theo ngôn ngữ. Mỗi từ điển: tên, ngôn ngữ, số entries, phiên bản, dung lượng, trạng thái Active/Hidden, badge update. Kéo thả thứ tự ưu tiên lookup, lưu SQLite ngay. Hoạt động offline.
- **UC02.2 Thêm auto-download:** Thư viện từ điển host sẵn (WordNet, Freq EN, CC-CEDICT, HSK). Download background (Service Worker), progress bar, resume HTTP Range, retry 3 lần, verify SHA-256. Import vào SQLite <30s cho 20MB. Free: ≤2 từ điển/ngôn ngữ.
- **UC02.3 Import tùy chỉnh:** Hỗ trợ Yomichan .zip (index.json + term_bank_*.json), plain text, CSV, JSON. Auto-detect encoding (UTF-8/16, Shift-JIS). Preview 10 entries trước import. Free: ≤2 từ điển tùy chỉnh. Guest không được import.
- **UC02.4 Ẩn/Hiện:** Toggle `is_active` trong SQLite, không xóa data. Không được ẩn từ điển cuối cùng active. Hiệu lực ngay (<100ms), word popup refresh. Thứ tự lookup per-language-profile.
- **UC02.5 Xóa:** Dialog xác nhận, xóa entries khỏi SQLite, VACUUM nếu cần. Không xóa từ điển duy nhất active. Không thể hoàn tác. <5s cho 150K entries.
- **UC02.6 Cập nhật:** System check mỗi 7 ngày, badge đỏ trên icon. Dialog changelog trước update. Atomic update (giữ data cũ đến khi thành công), rollback khi thất bại. Cập nhật hàng loạt tuần tự.
- **Data entities:** Dictionary (id, name, lang, version, entries_count, size, is_active, sort_order, source_type: auto/custom), DictionaryEntry (word, definition, pos, examples).
- **Architecture:** SQLite FTS5 cho full-text search. Từ điển tùy chỉnh không có auto-update. Thứ tự lookup persist per-language-profile.

---

## UC03 — Đọc trang web (8 files)

- **Actors:** Guest, Free User, Premium User.
- **UC03.1 Highlight từ vựng:** Content script inject, tokenize bằng IntersectionObserver (lazy, batch 50 từ). 2 chế độ: Learning Status (đỏ/cam/vàng/xanh/xám theo trạng thái học) và Frequency i+1 (5 tier unlock theo milestone). CJK dùng jieba/kuromoji WASM. MutationObserver cho SPA. Dùng `<mark>` inline, không đổi layout.
- **UC03.2 Page difficulty:** Floating badge góc trên phải: % từ đã biết, số từ chưa biết, CEFR ước tính (A1–C2 theo frequency distribution). Expandable top bar: breakdown theo tier, top 10 từ chưa biết, nút "Học tất cả". Cập nhật động khi scroll/đổi status.
- **UC03.3 Phát hiện câu i+1:** Câu có đúng 1 từ chưa biết + ≥3 từ ngôn ngữ học + độ dài 5–50 từ. Highlight nền nhạt theo frequency tier của từ chưa biết. Click → word popup. Điều hướng bằng phím tắt. Stop words theo từng ngôn ngữ.
- **UC03.4 Word popup:** Render trong Shadow DOM isolated. Header: word, frequency rank, POS, pinyin (ZH), audio (Forvo→TTS fallback), status badge. Body tabs: mỗi từ điển active 1 tab + tab AI (WebLLM Qwen2.5/Ollama, 30 lần/ngày Free). Footer: link ngoài (Cambridge/Jisho/MDBG/Wiktionary), nút thêm flashcard. Trigger: click/hover 300ms/modifier+hover/auto (video pause). <100ms lookup SQLite.
- **UC03.5 Điều hướng từ:** Phím N/Shift+N (từ chưa biết tiếp/trước), Ctrl+N/Alt+N (trong câu hiện tại). Scroll vào giữa màn hình, outline focus, auto mở popup. Không active khi input focus.
- **UC03.6 Tra từ thủ công:** Toolbar popup → Dictionary tab. Fuzzy search (Levenshtein ≤2), debounce 200ms. SQLite FTS5. Lịch sử 20 từ gần nhất. Kết quả giống word popup.
- **UC03.7 Bookmark đoạn văn:** Bôi đen → context menu/mini toolbar. Lưu: text, context ±50 ký tự, URL, title, timestamp, tags, language. Icon 🔖 bên cạnh đoạn. Free: ≤500 bookmarks. Guest không được. Persist theo URL + text hash, sync Drive.
- **UC03.8 Toggle highlight:** Tắt tạm thời 15ph/30ph/1h/mãi mãi. Per-tab, countdown timer trên floating bar, badge xám trên icon. Word popup vẫn hoạt động. <100ms (CSS class).
- **Data entities:** VocabularyItem (word, lang, status: unknown/tracking/learning/known/ignore, frequency_rank), Bookmark (text, context, url, title, tags, timestamp), SearchHistory (word, timestamp).
- **Architecture:** Content script + Shadow DOM cho popup. IntersectionObserver + MutationObserver cho performance. SQLite local cho mọi lookup. WebLLM/Ollama cho AI (local-first).

---

## UC04 — Xem video (17 files)

- **Actors:** Guest, Free User, Premium User. System (Whisper STT, AI dịch, auto-detect).
- **UC04.1 Detect subtitle chuyên dụng:** Site adapters cho YouTube (intercept `tiledtext`/`get_transcript` XML/JSON), Netflix (TTML/DFXP từ nflxvideo.net), iQIYI (JSON API). Chuẩn hóa `{start, duration, text}`. Dropdown chọn track ngôn ngữ, lưu per-site. Fallback → UC04.2 generic.
- **UC04.2 Detect subtitle phổ thông:** DOM `<track kind="subtitles">` + network intercept (.vtt/.srt/.ass/.ssa). Auto-detect encoding. Nhiều video → badge chọn. Load thủ công Ctrl+Shift+F (file/URL).
- **UC04.3 Tạo subtitle Whisper:** Whisper WASM trong Web Worker. Video <20ph: transcribe toàn bộ. >20ph: chia chunk 10ph. Cache trong IndexedDB (3 ngày, key=video URL+timestamp). Free: 60ph/ngày. Cần ≥4GB RAM. Model tiny/small tùy chọn.
- **UC04.4 Import subtitle thủ công:** File picker/drag-drop .srt/.vtt. Parse `{start, end, text}`, sync video timeline, offset ±30s. Chọn vai trò: ngôn ngữ học (trên) hoặc mẹ đẻ (dưới). Auto-detect encoding.
- **UC04.5 Tìm subtitle online:** Auto-search OpenSubtitles API theo tiêu đề video. Lọc theo ngôn ngữ. Preview 5 dòng. Cache kết quả 24h. Không lưu subtitle lên Drive. Free/Premium only.
- **UC04.6 Dual subtitle:** Overlay trên video: ngôn ngữ học (trên, có highlight) + mẹ đẻ (dưới). Draggable, lưu vị trí per-site. Transcript panel bên phải (lazy-render, click câu → seek). Font/màu tùy chỉnh. Offset riêng từng subtitle.
- **UC04.7 Auto translate subtitle:** AI local (WebLLM Qwen2.5/Ollama) ưu tiên 1, Google Translate scrape fallback. Batch 50 câu. Cache SQLite (key=video_url+subtitle_hash, vĩnh viễn). Badge "🌐 Đã dịch tự động". Free: 120ph/ngày.
- **UC04.8 Điều hướng subtitle:** Phím A (lùi câu), S (lặp câu), D (tiến câu). Seek đến `start_time`. Nút UI ◄↺► trên floating bar. <100ms. Không conflict input fields.
- **UC04.9 Toggle subtitle dịch:** Phím T, ẩn/hiện subtitle mẹ đẻ. Per-session (không persist). Tích hợp chế độ học (Listening ẩn cả 2, Reading ẩn dịch). <50ms CSS class.
- **UC04.10 Chế độ học video:** 4 modes — Normal (cả 2 subtitle), Listening (ẩn cả 2, auto-pause mỗi câu), Reading (hiện subtitle học, auto-pause trước âm thanh), Writing/Dictation (ẩn subtitle, gõ lại câu, diff Levenshtein highlight đúng/sai). Free/Premium only.
- **UC04.11 Auto-pause:** Dừng video khi subtitle câu tiếp có ≥1 từ chưa biết (ngưỡng tùy chỉnh 1/2/3). Dừng tại đầu câu (<50ms). Word popup auto mở từ chưa biết đầu tiên. Toggle floating bar, per-session.
- **UC04.12 Export subtitle:** Xuất gốc/dịch/dual. Định dạng .srt/.vtt. Tên file = tiêu đề video + ngôn ngữ. UTF-8 BOM cho .srt. Dual: 2 dòng liên tiếp/timestamp. Free/Premium only.
- **UC04.13 Xem video local:** Mở .mp4/.mkv/.avi/.webm. Playlist drag-drop. Lưu tiến độ (mỗi 5s, fingerprint theo tên+size). Auto-detect subtitle cùng thư mục. Full-page player. Hỗ trợ file 10GB (stream).
- **UC04.14 Playback speed:** 0.5x→2x (7 mức). Phím [ ]. Lưu per-site + global default. Toast notification. <50ms, subtitle sync.
- **UC04.15 Loop segment:** Phím S lặp câu subtitle. A-B loop tùy chỉnh (nút A/B). Số lần: 1/2/3/5/∞. Highlight đoạn A-B trên thanh tiến trình. <100ms.
- **UC04.16 Lọc câu transcript:** Filter: Tất cả/i+1/Đã biết/Theo dõi/Đang học. Số lượng mỗi filter. Checkbox chọn nhiều câu → bulk flashcard (UC04.17). <200ms, lazy-render. Free/Premium only.
- **UC04.17 Bulk create flashcard:** Auto-fill: sentence, target word, definition, sentence audio (cắt từ video), translation. Review trước khi lưu. Lưu atomic. Free: ≤625 tổng. Auto-fill 10 cards <3s. Cắt audio background.
- **Data entities:** Subtitle (start, end, text, lang, source: detect/whisper/import/online), SubtitleCache (video_url, hash, transcript, translation), VideoProgress (file_fingerprint, timestamp), PlaybackSettings (site, speed), LoopSegment (A, B, count).
- **Architecture:** Site adapters pattern (YouTube/Netflix/iQIYI). Whisper WASM trong Web Worker. Transcript cache IndexedDB, translation cache SQLite. Subtitle overlay Shadow DOM. Web Audio API cho cắt audio. OpenSubtitles API integration.

---

## Architecture Insights

- **Dictionary storage (SQLite + FTS5):** Mọi từ điển lưu trong SQLite local với FTS5 full-text search. Từ điển auto-download (WordNet, CC-CEDICT) và tùy chỉnh (Yomichan .zip, CSV, JSON) cùng schema. Thứ tự lookup per-language-profile, atomic update với rollback. Cell hiện tại chưa có dictionary layer — cần xây dựng module SQLite dictionary storage + FTS5 index + parser cho nhiều format.

- **Vocabulary tracking (5 trạng thái + frequency tier):** Mỗi từ có status (unknown/tracking/learning/known/ignore) và frequency rank. Highlight màu theo status hoặc frequency tier (5 tier unlock theo milestone). Câu i+1 = đúng 1 từ chưa biết + ≥3 từ học. Cell cần vocabulary tracker module với status transition + frequency list import + real-time highlight update.

- **Subtitle overlay (site adapters + Whisper + dual subtitle):** Site adapters cho YouTube/Netflix/iQIYI intercept subtitle request. Generic interceptor cho `<track>` + network (.vtt/.srt/.ass). Whisper WASM cho video không có subtitle. Dual subtitle overlay (Shadow DOM) + transcript panel. Cell đã có subtitle detection + parser (srtParser, vttParser, assParser, subtitleDetector) — cần mở rộng thành site adapters + dual subtitle overlay + Whisper integration.

- **Video learning (4 modes + auto-pause + loop + bulk flashcard):** Chế độ học video (Normal/Listening/Reading/Writing) với auto-pause theo subtitle. Loop A-B và lặp câu. Filter câu transcript (i+1/đã biết/theo dõi). Bulk create flashcard với auto-fill (sentence + audio cắt từ video + definition + translation). Cell cần video learning controller + audio cutting (Web Audio API) + transcript filter + flashcard bulk creation pipeline.

- **Content script architecture (Shadow DOM + IntersectionObserver + MutationObserver):** Word popup trong Shadow DOM isolated. Highlight dùng IntersectionObserver (lazy tokenize batch 50) + MutationObserver (SPA). CJK segmentation (jieba/kuromoji WASM). Floating bar/badge fixed position. Cell hiện tại có content-script.ts + pageScanner.ts — cần mở rộng thành highlight engine + Shadow DOM popup + floating UI + keyboard navigation.
