# CHƯƠNG 2: ĐẶC TẢ YÊU CẦU

---

## 2.1 Danh sách Actor

| Actor                               | Loại     | Mô tả                                                                                                                                                                        |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Premium User**             | Primary   | **Phase 1 — Triển khai ngay.** Người dùng trả phí. Không giới hạn flashcard, ngôn ngữ, AI. Có cloud AI (Gemini). Toàn bộ tính năng Orca Space. Có sync Google Drive. |
| **Standard User**             | Primary   | **Phase 2 — Phát triển sau.** Người dùng đăng nhập Google miễn phí. Giới hạn: 625 cards, 1 ngôn ngữ, AI 30 lần/ngày. Vocabulary tracking không giới hạn. Có sync Google Drive. |
| **Guest**                     | Primary   | **Phase 3.** Người dùng chưa đăng nhập. Chỉ highlight + word popup. Không lưu dữ liệu. |
| **System**                    | Secondary | Hệ thống tự động: FSRS scheduling, Drive sync, Anki sync, STT transcribe, badge update, daily notification.                                                               |
| **Google OAuth**              | External  | Dịch vụ xác thực Google. Cung cấp identity và token cho Drive API.                                                                                                       |
| **Google Drive API**          | External  | Lưu trữ và đồng bộ SQLite dump + media files giữa các thiết bị.                                                                                                      |
| **AnkiConnect API**           | External  | Giao tiếp 2 chiều với Anki desktop (export, import, sync).                                                                                                                  |
| **Forvo**                     | External  | Nguồn audio phát âm từ vựng (scrape). Fallback sang TTS nếu không có.                                                                                                  |
| **Google Images**             | External  | Nguồn ảnh minh họa cho flashcard (scrape by URL).                                                                                                                           |
| **Google Translate**          | External  | Dịch sentence và definition (scrape). Fallback sang AI local khi offline.                                                                                                    |
| **Whisper STT**               | External  | Engine nhận dạng giọng nói offline (WASM trên browser, native trên mobile).                                                                                              |
| **WebLLM / Ollama**           | External  | AI local (WebLLM Qwen2.5, auto-load theo RAM) cho giải thích từ, phân tích câu, dịch khi offline.                                                                       |
| **YouTube / Netflix / iQIYI** | External  | Nguồn video streaming. Site adapter intercept subtitle từ API nội bộ.                                                                                                      |

---

## 2.2 Danh sách Use-case

### [Nhóm UC01: Quản lý tài khoản &amp; Profile](../hệ%20thống/sub-systems/01-auth-account.md)

| UC                                                                 | Tên Use-case                       | Actor chính      | Mô tả ngắn                                                                   |
| ------------------------------------------------------------------ | ----------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| [UC01.1](UC/UC01_quan_ly_tai_khoan/UC01.1_onboarding.md)              | Onboarding lần đầu               | Guest             | Chọn ngôn ngữ học, hệ thống download từ điển, dùng ngay ở Guest mode |
| [UC01.2](UC/UC01_quan_ly_tai_khoan/UC01.2_dang_nhap_google.md)        | Đăng nhập Google                 | Guest             | Xác thực qua Google OAuth, liên kết tài khoản, bật sync Drive            |
| [UC01.3](UC/UC01_quan_ly_tai_khoan/UC01.3_dang_xuat.md)               | Đăng xuất                        | Free User         | Đăng xuất khỏi tài khoản Google                                           |
| [UC01.4](UC/UC01_quan_ly_tai_khoan/UC01.4_chinh_sua_thong_tin.md)     | Chỉnh sửa thông tin tài khoản  | Free User         | Cập nhật tên, avatar                                                         |
| [UC01.5](UC/UC01_quan_ly_tai_khoan/UC01.5_them_language_profile.md)   | Thêm language profile              | Free User         | Thêm ngôn ngữ học mới (EN/ZH), download từ điển tương ứng            |
| [UC01.6](UC/UC01_quan_ly_tai_khoan/UC01.6_switch_language_profile.md) | Switch language profile             | Free User         | Chuyển đổi ngôn ngữ active từ toolbar popup (1 click)                     |
| [UC01.7](UC/UC01_quan_ly_tai_khoan/UC01.7_cap_quyen_extension.md)     | Cấp quyền extension cho trang web | Guest / Free User | Cho phép extension hoạt động trên per-site / per-domain / all sites        |

---

### [Nhóm UC02: Quản lý từ điển](../hệ%20thống/sub-systems/02-dictionary-tokenizer-part1.md)

| UC                                                                | Tên Use-case                  | Actor chính       | Mô tả ngắn                                                                       |
| ----------------------------------------------------------------- | ------------------------------ | ------------------ | ----------------------------------------------------------------------------------- |
| [UC02.1](UC/UC02_quan_ly_tu_dien/UC02.1_xem_danh_sach_tu_dien.md)    | Xem danh sách từ điển      | Free User          | Xem từ điển đã cài, số entries, phiên bản                                  |
| [UC02.2](UC/UC02_quan_ly_tu_dien/UC02.2_them_tu_dien_auto.md)        | Thêm từ điển auto-download | Free User          | Chọn từ danh sách (WordNet/CC-CEDICT), hệ thống download và import            |
| [UC02.3](UC/UC02_quan_ly_tu_dien/UC02.3_import_tu_dien_tuy_chinh.md) | Import từ điển tùy chỉnh  | Free User          | Upload file Yomichan .zip hoặc plain text, hệ thống parse và import             |
| [UC02.4](UC/UC02_quan_ly_tu_dien/UC02.4_an_hien_tu_dien.md)          | Ẩn/hiện từ điển           | Free User          | Tắt từ điển khỏi lookup mà không xóa                                        |
| [UC02.5](UC/UC02_quan_ly_tu_dien/UC02.5_xoa_tu_dien.md)              | Xóa từ điển                | Free User          | Xóa từ điển khỏi hệ thống                                                    |
| [UC02.6](UC/UC02_quan_ly_tu_dien/UC02.6_cap_nhat_tu_dien.md)         | Cập nhật từ điển          | System / Free User | Hệ thống kiểm tra phiên bản mới, thông báo, người dùng xác nhận update |

---

### [Nhóm UC03: Immersion — Đọc trang web](../hệ%20thống/sub-systems/02-dictionary-tokenizer-part2.md)

| UC                                                       | Tên Use-case                       | Actor chính      | Mô tả ngắn                                                           |
| -------------------------------------------------------- | ----------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| [UC03.1](UC/UC03_doc_trang_web/UC03.1_highlight_tu_vung.md) | Highlight từ vựng trên trang web | System            | Tokenize viewport, highlight theo learning status và frequency tier    |
| [UC03.2](UC/UC03_doc_trang_web/UC03.2_page_difficulty.md)   | Hiển thị page difficulty analysis | System            | Floating badge: % từ đã biết, số từ chưa biết, CEFR ước tính |
| [UC03.3](UC/UC03_doc_trang_web/UC03.3_phat_hien_i1.md)      | Phát hiện câu i+1                | System            | Tìm câu chỉ có 1 từ chưa biết, highlight màu frequency          |
| [UC03.4](UC/UC03_doc_trang_web/UC03.4_word_popup.md)        | Mở word popup                      | Guest / Free User | Click/hover/modifier+hover vào từ → popup Shadow DOM                 |
| [UC03.5](UC/UC03_doc_trang_web/UC03.5_dieu_huong_tu.md)     | Điều hướng từ trong câu       | Free User         | N/Shift+N (từ chưa biết), Ctrl+N/Alt+N (mọi từ)                    |
| [UC03.6](UC/UC03_doc_trang_web/UC03.6_tra_tu_thu_cong.md)   | Tra từ điển thủ công           | Guest / Free User | Gõ từ vào ô tìm kiếm trong toolbar popup                          |
| [UC03.7](UC/UC03_doc_trang_web/UC03.7_bookmark_doan_van.md) | Bookmark đoạn văn                | Free User         | Đánh dấu đoạn văn, thêm tags, lưu vào Bookmark Manager         |
| [UC03.8](UC/UC03_doc_trang_web/UC03.8_toggle_highlight.md)  | Toggle highlight tạm thời         | Free User         | Tắt highlight 15ph/30ph/1h/mãi                                        |

---

### [Nhóm UC04: Immersion — Xem video](../hệ%20thống/sub-systems/07-media-engine.md)

| UC                                                                    | Tên Use-case                             | Actor chính       | Mô tả ngắn                                                              |
| --------------------------------------------------------------------- | ----------------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| [UC04.1](UC/UC04_xem_video/UC04.1_detect_subtitle_chuyen_dung.md)        | Detect subtitle từ YouTube/Netflix/iQIYI | System             | Site adapter intercept subtitle từ API nội bộ                           |
| [UC04.2](UC/UC04_xem_video/UC04.2_detect_subtitle_pho_thong.md)          | Detect subtitle từ trang web phổ thông | System             | Detect `<track>` DOM hoặc intercept .vtt/.srt network request           |
| [UC04.3](UC/UC04_xem_video/UC04.3_tao_subtitle_whisper.md)               | Tạo subtitle bằng Whisper STT           | Free User / System | Transcribe audio khi không có subtitle (batch/chunked)                   |
| [UC04.4](UC/UC04_xem_video/UC04.4_import_subtitle_thu_cong.md)           | Import subtitle thủ công                | Free User          | Upload file .srt/.vtt hoặc drag-drop vào video                           |
| [UC04.5](UC/UC04_xem_video/UC04.5_tim_subtitle_theo_tieu_de.md)          | Tìm subtitle theo tiêu đề video       | System             | Auto-search subtitle dựa trên tiêu đề video                           |
| [UC04.6](UC/UC04_xem_video/UC04.6_dual_subtitle.md)                      | Hiển thị dual subtitle                  | System             | Ngôn ngữ học (trên) + ngôn ngữ mẹ đẻ (dưới)                     |
| [UC04.7](UC/UC04_xem_video/UC04.7_auto_translate_subtitle.md)            | Auto-translate subtitle                   | System             | Dịch subtitle khi không có bản dịch (Google Translate/AI local)       |
| [UC04.8](UC/UC04_xem_video/UC04.8_dieu_huong_subtitle.md)                | Điều hướng subtitle                   | Free User          | A (lùi câu) / S (lặp) / D (tiến câu)                                  |
| [UC04.9](UC/UC04_xem_video/UC04.9_toggle_subtitle_dich.md)               | Toggle ẩn/hiện subtitle dịch           | Free User          | Phím tắt ẩn/hiện subtitle ngôn ngữ mẹ đẻ                          |
| [UC04.10](UC/UC04_xem_video/UC04.10_che_do_hoc_video.md)                 | Chọn chế độ học video                | Free User          | Thường / Nghe / Đọc / Viết                                            |
| [UC04.11](UC/UC04_xem_video/UC04.11_auto_pause.md)                       | Auto-pause khi có từ chưa biết        | System             | Tự dừng video khi subtitle có từ chưa học (nếu bật trong Settings) |
| [UC04.12](UC/UC04_xem_video/UC04.12_export_subtitle.md)                  | Export subtitle                           | Free User          | Xuất subtitle đã xử lý ra file .srt/.vtt                              |
| [UC04.13](UC/UC04_xem_video/UC04.13_xem_video_local.md)                  | Xem video local                           | Free User          | Mở file .mp4/.mkv trong Local Media Player, playlist, lưu tiến độ     |
| [UC04.14](UC/UC04_xem_video/UC04.14_playback_speed.md)                   | Điều chỉnh playback speed              | Free User          | 0.5x – 2x                                                                 |
| [UC04.15](UC/UC04_xem_video/UC04.15_loop_segment.md)                     | Loop segment                              | Free User          | Lặp lại câu đang xem/nghe                                              |
| [UC04.16](UC/UC04_xem_video/UC04.16_loc_cau_transcript.md)               | Lọc câu trong transcript panel          | Free User          | Lọc i+1 / known / tracking / learning sentences                           |
| [UC04.17](UC/UC04_xem_video/UC04.17_bulk_create_flashcard_transcript.md) | Bulk create flashcard từ transcript      | Free User          | Chọn nhiều câu → tạo hàng loạt cards                                |

---

### [Nhóm UC05: Immersion — Nghe podcast](../hệ%20thống/sub-systems/07-media-engine.md)

| UC                                                             | Tên Use-case                                           | Actor chính | Mô tả ngắn                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| [UC05.1](UC/UC05_nghe_podcast/UC05.1_them_podcast.md)             | Podcast Browser: tìm podcast và thêm vào thư viện | Free User    | Tìm podcast theo tên, xem kết quả và lưu podcast vào thư viện       |
| [UC05.2](UC/UC05_nghe_podcast/UC05.2_download_episode.md)         | Episode List: xem episode và tải offline              | Free User    | Mở danh sách episode của podcast, phát hoặc tải episode về máy       |
| [UC05.3](UC/UC05_nghe_podcast/UC05.3_phat_podcast_subtitle.md)    | Podcast Player: phát podcast với subtitle STT         | System       | Whisper transcribe audio → subtitle, cache 3 ngày                          |
| [UC05.4](UC/UC05_nghe_podcast/UC05.4_click_subtitle_seek.md)      | Transcript Panel: click câu → seek audio              | Free User    | Nhấn câu trong transcript → audio nhảy đến đúng điểm               |
| [UC05.5](UC/UC05_nghe_podcast/UC05.5_lam_moi_subtitle.md)         | Podcast Player: làm mới subtitle                      | Free User    | Tạo lại subtitle nếu kết quả STT không vừa ý                         |
| [UC05.6](UC/UC05_nghe_podcast/UC05.6_quan_ly_thu_vien_podcast.md) | Podcast Library: quản lý podcast đã lưu            | Free User    | Xem danh sách podcast đã lưu, mở lại, ghim hoặc xóa khỏi thư viện |

---

### [Nhóm UC06: Immersion — Đọc EPUB/PDF](../hệ%20thống/sub-systems/07-media-engine.md)

| UC                                                    | Tên Use-case                         | Actor chính | Mô tả ngắn                                                   |
| ----------------------------------------------------- | ------------------------------------- | ------------ | --------------------------------------------------------------- |
| [UC06.1](UC/UC06_doc_epub_pdf/UC06.1_mo_file.md)         | Mở file EPUB/PDF                     | Free User    | Chọn file từ máy hoặc drag-drop vào reader                 |
| [UC06.2](UC/UC06_doc_epub_pdf/UC06.2_doc_highlight.md)   | Đọc với highlight từ vựng        | System       | Tokenize text, highlight theo learning status                   |
| [UC06.3](UC/UC06_doc_epub_pdf/UC06.3_luu_tien_do.md)     | Lưu và khôi phục tiến độ đọc | System       | Tự động lưu vị trí đọc, khôi phục khi mở lại        |
| [UC06.4](UC/UC06_doc_epub_pdf/UC06.4_vocabulary_sach.md) | Xem per-book vocabulary list          | Free User    | Danh sách từ đã gặp trong sách này + difficulty analysis |

---

### [Nhóm UC07: Immersion — Clipboard](../hệ%20thống/sub-systems/07-media-engine.md)

| UC                                                 | Tên Use-case              | Actor chính | Mô tả ngắn                                               |
| -------------------------------------------------- | -------------------------- | ------------ | ----------------------------------------------------------- |
| [UC07.1](UC/UC07_clipboard/UC07.1_tao_session.md)     | Tạo clipboard session     | Free User    | Tạo named session (đặt tên) để nhóm các đoạn text |
| [UC07.2](UC/UC07_clipboard/UC07.2_paste_text.md)      | Paste text thủ công      | Free User    | Paste text vào ô input trong Clipboard tab                |
| [UC07.3](UC/UC07_clipboard/UC07.3_auto_detect.md)     | Auto-detect clipboard      | Free User    | Bật toggle trong tab → tự động nhận text khi copy     |
| [UC07.4](UC/UC07_clipboard/UC07.4_nghe_tts.md)        | Nghe TTS + điều hướng  | Free User    | TTS đọc text, tiến/lùi câu, lặp câu, lặp đoạn     |
| [UC07.5](UC/UC07_clipboard/UC07.5_xem_lai_session.md) | Xem lại clipboard session | Free User    | Xem lại các session đã tạo trước đó                |

---

### [Nhóm UC08: Vocabulary Tracking](../hệ%20thống/sub-systems/03-vocabulary-tracker.md)

| UC                                                                   | Tên Use-case                     | Actor chính | Mô tả ngắn                                                                   |
| -------------------------------------------------------------------- | --------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| [UC08.1](UC/UC08_vocabulary_tracking/UC08.1_xem_vocabulary_manager.md)  | Xem Vocabulary Manager            | Free User    | Danh sách từ đã track, tìm kiếm, lọc                                     |
| [UC08.2](UC/UC08_vocabulary_tracking/UC08.2_doi_trang_thai_thu_cong.md) | Đổi trạng thái từ thủ công | Free User    | Click status badge → chuyển trạng thái                                      |
| [UC08.3](UC/UC08_vocabulary_tracking/UC08.3_bulk_action_vocabulary.md)  | Bulk action vocabulary            | Free User    | Chọn nhiều từ → đổi trạng thái / xóa hàng loạt                       |
| [UC08.4](UC/UC08_vocabulary_tracking/UC08.4_import_word_list.md)        | Import word list                  | Free User    | Import từ đã biết: newline / CSV / JSON / free-text                         |
| [UC08.5](UC/UC08_vocabulary_tracking/UC08.5_xem_status_history.md)      | Xem vocabulary status history     | Free User    | Lịch sử thay đổi trạng thái của một từ                                 |
| [UC08.6](UC/UC08_vocabulary_tracking/UC08.6_auto_update_status.md)      | Auto-update vocabulary status     | System       | Tự động chuyển "đang học" → "đã học" khi FSRS interval đạt ngưỡng |

---

### [Nhóm UC09: Flashcard Creation](../hệ%20thống/sub-systems/06-flashcard-creation.md)

| UC                                                               | Tên Use-case                        | Actor chính | Mô tả ngắn                                                                |
| ---------------------------------------------------------------- | ------------------------------------ | ------------ | ---------------------------------------------------------------------------- |
| [UC09.1](UC/UC09_tao_flashcard/UC09.1_cau_hinh_destination.md)      | Cấu hình flashcard destination     | Free User    | Chọn Ocean Memory hoặc Anki, chọn deck, card type (1 lần trong Settings) |
| [UC09.2](UC/UC09_tao_flashcard/UC09.2_quick_add_flashcard.md)       | Quick add flashcard                  | Free User    | Nhấn "Add to flashcard" → hệ thống auto-fill tất cả fields             |
| [UC09.3](UC/UC09_tao_flashcard/UC09.3_customize_flashcard.md)       | Customize flashcard trước khi lưu | Free User    | Chỉnh sửa từng field trong card creator                                   |
| [UC09.4](UC/UC09_tao_flashcard/UC09.4_chon_anh_google_images.md)    | Chọn ảnh từ Google Images         | Free User    | Xem grid ảnh scrape từ Google Images → click chọn                        |
| [UC09.5](UC/UC09_tao_flashcard/UC09.5_screenshot_frame_video.md)    | Screenshot frame video               | Free User    | Chụp frame video hiện tại làm ảnh cho card                              |
| [UC09.6](UC/UC09_tao_flashcard/UC09.6_them_tags_card.md)            | Thêm tags cho card                  | Free User    | Gắn tags tùy chỉnh (#IELTS, #business...)                                 |
| [UC09.7](UC/UC09_tao_flashcard/UC09.7_bulk_create_transcript.md)    | Bulk create từ transcript           | Free User    | Chọn nhiều câu trong transcript panel → tạo hàng loạt                 |
| [UC09.8](UC/UC09_tao_flashcard/UC09.8_tao_flashcard_tu_bookmark.md) | Tạo flashcard từ bookmark          | Free User    | Chuyển đoạn đã bookmark thành flashcard                                |

---

### [Nhóm UC10: Flashcard Management](../hệ%20thống/sub-systems/06-flashcard-creation.md)

| UC                                                               | Tên Use-case         | Actor chính | Mô tả ngắn                                                  |
| ---------------------------------------------------------------- | --------------------- | ------------ | -------------------------------------------------------------- |
| [UC10.1](UC/UC10_quan_ly_flashcard/UC10.1_xem_flashcard_manager.md) | Xem Flashcard Manager | Free User    | Danh sách cards, tìm kiếm theo target word / sentence       |
| [UC10.2](UC/UC10_quan_ly_flashcard/UC10.2_loc_cards.md)             | Lọc cards            | Free User    | Lọc theo deck / card type / trạng thái / ngày / POS / tags |
| [UC10.3](UC/UC10_quan_ly_flashcard/UC10.3_sua_card.md)              | Sửa card             | Free User    | Chỉnh sửa nội dung từng field của card                    |
| [UC10.4](UC/UC10_quan_ly_flashcard/UC10.4_xoa_card.md)              | Xóa card             | Free User    | Xóa card + xóa đồng thời media files liên quan           |
| [UC10.5](UC/UC10_quan_ly_flashcard/UC10.5_bulk_actions_cards.md)    | Bulk actions cards    | Free User    | Chọn nhiều cards → xóa / chuyển deck / đổi trạng thái |
| [UC10.6](UC/UC10_quan_ly_flashcard/UC10.6_xem_sentence_bank.md)     | Xem Sentence bank     | Free User    | Danh sách câu đã dùng làm sentence field                 |
| [UC10.7](UC/UC10_quan_ly_flashcard/UC10.7_xem_audio_bank.md)        | Xem Audio bank        | Free User    | Danh sách audio đã cắt từ media                           |

---

### [Nhóm UC11: Deck Management](../hệ%20thống/sub-systems/06-flashcard-creation.md)

| UC                                                        | Tên Use-case       | Actor chính | Mô tả ngắn                                    |
| --------------------------------------------------------- | ------------------- | ------------ | ------------------------------------------------ |
| [UC11.1](UC/UC11_quan_ly_deck/UC11.1_tao_deck.md)            | Tạo deck           | Free User    | Tạo deck mới với FSRS settings riêng         |
| [UC11.2](UC/UC11_quan_ly_deck/UC11.2_tao_sub_deck.md)        | Tạo sub-deck       | Free User    | Tạo deck lồng nhau                             |
| [UC11.3](UC/UC11_quan_ly_deck/UC11.3_sua_deck.md)            | Sửa deck           | Free User    | Đổi tên, mô tả, FSRS settings, daily limits |
| [UC11.4](UC/UC11_quan_ly_deck/UC11.4_xoa_deck.md)            | Xóa deck           | Free User    | Xóa deck và tất cả cards trong đó          |
| [UC11.5](UC/UC11_quan_ly_deck/UC11.5_merge_decks.md)         | Merge decks         | Free User    | Gộp nhiều deck thành một                     |
| [UC11.6](UC/UC11_quan_ly_deck/UC11.6_split_deck.md)          | Split deck          | Free User    | Tách một deck thành nhiều deck nhỏ          |
| [UC11.7](UC/UC11_quan_ly_deck/UC11.7_reset_deck_progress.md) | Reset deck progress | Free User    | Đưa tất cả cards về trạng thái new        |

---

### [Nhóm UC12: SRS Review (Ocean Memory)](../hệ%20thống/sub-systems/08-ocean-memory-srs.md)

| UC                                                         | Tên Use-case               | Actor chính | Mô tả ngắn                                            |
| ---------------------------------------------------------- | --------------------------- | ------------ | -------------------------------------------------------- |
| [UC12.1](UC/UC12_srs_review/UC12.1_bat_dau_review_session.md) | Bắt đầu review session   | Free User    | Mở Ocean Memory từ New Tab hoặc Memory tab            |
| [UC12.2](UC/UC12_srs_review/UC12.2_filtered_review.md)        | Filtered review session     | Free User    | Chọn ôn theo tag / deck / POS                          |
| [UC12.3](UC/UC12_srs_review/UC12.3_danh_gia_card.md)          | Đánh giá card            | Free User    | Again / Good → FSRS tính interval tiếp theo           |
| [UC12.4](UC/UC12_srs_review/UC12.4_undo_danh_gia.md)          | Undo đánh giá            | Free User    | Hoàn tác lần đánh giá vừa rồi                    |
| [UC12.5](UC/UC12_srs_review/UC12.5_sua_card_trong_session.md) | Sửa card trong session     | Free User    | Edit inline ngay khi đang ôn                           |
| [UC12.6](UC/UC12_srs_review/UC12.6_post_review_summary.md)    | Xem post-review summary     | Free User    | Tổng kết sau session: đúng/sai/từ khó nhất        |
| [UC12.7](UC/UC12_srs_review/UC12.7_xem_reviewed_cards.md)     | Xem today's reviewed cards  | Free User    | Danh sách cards đã ôn hôm nay                       |
| [UC12.8](UC/UC12_srs_review/UC12.8_daily_learning_goals.md)   | Đặt daily learning goals  | Free User    | Mục tiêu từ mới/ngày hoặc phút/ngày              |
| [UC12.9](UC/UC12_srs_review/UC12.9_daily_limits_per_deck.md)  | Đặt daily limits per deck | Free User    | Giới hạn new cards + reviews mỗi ngày cho từng deck |

---

### [Nhóm UC13: Anki Integration](../hệ%20thống/sub-systems/09-anki-integration.md)

| UC                                                         | Tên Use-case               | Actor chính | Mô tả ngắn                                                             |
| ---------------------------------------------------------- | --------------------------- | ------------ | ------------------------------------------------------------------------- |
| [UC13.1](UC/UC13_anki_integration/UC13.1_cai_ankiconnect.md)  | Cài AnkiConnect tự động | System       | Tự động cài addon nếu chưa có                                      |
| [UC13.2](UC/UC13_anki_integration/UC13.2_export_orca_anki.md) | Export Orca → Anki         | Free User    | Chọn deck, auto-map fields, export qua AnkiConnect                       |
| [UC13.3](UC/UC13_anki_integration/UC13.3_import_anki_orca.md) | Import Anki → Orca         | Free User    | Chọn deck Anki, import nội dung + tiến độ SRS (convert SM-2 → FSRS) |
| [UC13.4](UC/UC13_anki_integration/UC13.4_sync_2_chieu.md)     | Sync 2 chiều Orca ↔ Anki  | System       | Tự động sync khi Anki mở, per-record merge                            |
| [UC13.5](UC/UC13_anki_integration/UC13.5_chon_deck_sync.md)   | Chọn deck sync             | Free User    | Chọn deck nào được sync (selective sync)                             |
| [UC13.6](UC/UC13_anki_integration/UC13.6_xem_sync_log.md)     | Xem Anki sync log           | Free User    | Lịch sử sync: thời gian, số records cập nhật                        |

---

### [Nhóm UC14: Bookmark Management](../hệ%20thống/sub-systems/11-sync-storage.md)

| UC                                                          | Tên Use-case               | Actor chính | Mô tả ngắn                                           |
| ----------------------------------------------------------- | --------------------------- | ------------ | ------------------------------------------------------- |
| [UC14.1](UC/UC14_bookmark/UC14.1_tao_bookmark.md)              | Tạo bookmark               | Free User    | Đánh dấu đoạn văn/subtitle, thêm tags            |
| [UC14.2](UC/UC14_bookmark/UC14.2_xem_bookmark_manager.md)      | Xem Bookmark Manager        | Free User    | Danh sách bookmarks, tìm kiếm, lọc theo tags        |
| [UC14.3](UC/UC14_bookmark/UC14.3_gui_bookmark_email.md)        | Gửi bookmark qua email     | Free User    | Gửi đoạn đã bookmark tới email (Gmail API/mailto) |
| [UC14.4](UC/UC14_bookmark/UC14.4_tao_flashcard_tu_bookmark.md) | Tạo flashcard từ bookmark | Free User    | Chuyển bookmark thành flashcard                       |
| [UC14.5](UC/UC14_bookmark/UC14.5_xoa_bookmark.md)              | Xóa bookmark               | Free User    | Xóa bookmark                                           |

---

### [Nhóm UC15: Sync &amp; Storage](../hệ%20thống/sub-systems/11-sync-storage.md)

| UC                                                       | Tên Use-case          | Actor chính | Mô tả ngắn                                                    |
| -------------------------------------------------------- | ---------------------- | ------------ | ---------------------------------------------------------------- |
| [UC15.1](UC/UC15_sync_storage/UC15.1_sync_google_drive.md)  | Sync Google Drive      | System       | Upload SQLite dump + media lên Drive khi có mạng              |
| [UC15.2](UC/UC15_sync_storage/UC15.2_merge_data_drive.md)   | Merge data từ Drive   | System       | Download và per-record merge khi mở app trên thiết bị khác |
| [UC15.3](UC/UC15_sync_storage/UC15.3_xem_drive_sync_log.md) | Xem Drive sync log     | Free User    | Lịch sử sync: thời gian, số records                          |
| [UC15.4](UC/UC15_sync_storage/UC15.4_xem_storage_usage.md)  | Xem storage usage      | Free User    | Dung lượng đang dùng trên Drive và local                   |
| [UC15.5](UC/UC15_sync_storage/UC15.5_export_data.md)        | Export data thủ công | Free User    | Export toàn bộ data ra JSON/ZIP                                |
| [UC15.6](UC/UC15_sync_storage/UC15.6_import_data.md)        | Import data thủ công | Free User    | Import lại từ file JSON/ZIP                                    |
| [UC15.7](UC/UC15_sync_storage/UC15.7_export_settings.md)    | Export settings        | Free User    | Export settings ra JSON                                          |
| [UC15.8](UC/UC15_sync_storage/UC15.8_import_settings.md)    | Import settings        | Free User    | Import settings từ JSON                                         |

---

### [Nhóm UC16: Settings &amp; Permissions](../hệ%20thống/sub-systems/12-settings-permissions.md)

| UC                                                           | Tên Use-case                | Actor chính | Mô tả ngắn                                            |
| ------------------------------------------------------------ | ---------------------------- | ------------ | -------------------------------------------------------- |
| [UC16.1](UC/UC16_settings/UC16.1_quan_ly_keyboard_shortcuts.md) | Quản lý keyboard shortcuts | Free User    | Tùy chỉnh phím tắt, đồng bộ theo chức năng      |
| [UC16.2](UC/UC16_settings/UC16.2_tuy_chinh_mau_highlight.md)    | Tùy chỉnh màu highlight   | Free User    | Đổi màu learning status và frequency tier            |
| [UC16.3](UC/UC16_settings/UC16.3_chon_theme.md)                 | Chọn theme                  | Free User    | Light / Dark / Auto                                      |
| [UC16.4](UC/UC16_settings/UC16.4_chon_ui_language.md)           | Chọn UI language            | Free User    | Tiếng Việt / English                                   |
| [UC16.5](UC/UC16_settings/UC16.5_chon_native_language.md)       | Chọn native language        | Free User    | Ngôn ngữ mẹ đẻ dùng cho dịch                      |
| [UC16.6](UC/UC16_settings/UC16.6_cau_hinh_tts.md)               | Cấu hình TTS               | Free User    | Web Speech API / Edge voices / Google Cloud TTS          |
| [UC16.7](UC/UC16_settings/UC16.7_cau_hinh_ai.md)                | Cấu hình AI                | Free User    | Chọn chế độ: local / cloud / auto                    |
| [UC16.8](UC/UC16_settings/UC16.8_tuy_chinh_ai_prompts.md)       | Tùy chỉnh AI prompts       | Free User    | 5 prompts riêng per language profile (free-text editor) |
| [UC16.9](UC/UC16_settings/UC16.9_cau_hinh_daily_reminder.md)    | Cấu hình daily reminder    | Free User    | Đặt giờ nhắc ôn tập cố định                     |
| [UC16.10](UC/UC16_settings/UC16.10_quan_ly_blacklist.md)        | Quản lý blacklist          | Free User    | Thêm/xóa trang web bị chặn extension                 |
| [UC16.11](UC/UC16_settings/UC16.11_new_tab_override.md)         | Bật/tắt New Tab Override   | Free User    | Bật/tắt Ocean Memory khi mở tab mới                  |
| [UC16.12](UC/UC16_settings/UC16.12_auto_pause_video.md)         | Cấu hình auto-pause video  | Free User    | Bật/tắt tự dừng video khi có từ chưa biết        |

---

### [Nhóm UC17: Statistics &amp; Progress](../hệ%20thống/sub-systems/10-stats-progress.md)

| UC                                                                 | Tên Use-case                        | Actor chính | Mô tả ngắn                                                        |
| ------------------------------------------------------------------ | ------------------------------------ | ------------ | -------------------------------------------------------------------- |
| [UC17.1](UC/UC17_statistics/UC17.1_basic_stats_popup.md)              | Xem basic stats (toolbar popup)      | Free User    | Streak, cards due, retention, daily goal                             |
| [UC17.2](UC/UC17_statistics/UC17.2_advanced_stats_webapp.md)          | Xem advanced stats (web app)         | Free User    | Heatmap, vocabulary growth, coverage, retention chart...             |
| [UC17.3](UC/UC17_statistics/UC17.3_review_forecast.md)                | Xem review forecast                  | Free User    | Dự báo card due 30 ngày tới                                      |
| [UC17.4](UC/UC17_statistics/UC17.4_activity_history.md)               | Xem activity history                 | Free User    | Lịch sử nguồn media đã học, sắp xếp theo độ khó           |
| [UC17.5](UC/UC17_statistics/UC17.5_daily_vocabulary_digest.md)        | Xem daily vocabulary digest          | Free User    | Tổng hợp từ đã gặp hôm nay từ mọi nguồn                    |
| [UC17.6](UC/UC17_statistics/UC17.6_per_source_vocabulary.md)          | Xem per-source vocabulary            | Free User    | Từ đã gặp theo từng nguồn media cụ thể                       |
| [UC17.7](UC/UC17_statistics/UC17.7_level_progress.md)                 | Xem level progress                   | Free User    | CEFR + IELTS level dựa trên cards trưởng thành + giờ immersion |
| [UC17.8](UC/UC17_statistics/UC17.8_difficult_words.md)                | Xem difficult words                  | Free User    | Danh sách từ fail nhiều nhất trong SRS                           |
| [UC17.9](UC/UC17_statistics/UC17.9_daily_achievement_notification.md) | Nhận daily achievement notification | Free User    | Chrome notification tổng kết thành quả học trong ngày          |

> Các usecase chi tiết đang ở file này docs\Tài liệu đặc tả\UC
