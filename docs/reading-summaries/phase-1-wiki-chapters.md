# Phase 1 — Wiki Chapter Summary (8 files)

> Tóm tắt cấu trúc 8 file wiki chương tổng của dự án Orca.
> Mục tiêu: nắm bắt kiến trúc tổng thể phục vụ tích hợp Cell.

---

## 1. `00_trang_bia_va_muc_luc.md`

- **Dự án:** Orca — Hệ sinh thái học ngoại ngữ qua immersion (Chrome Extension + Web, Mobile sau).
- **Mục lục 5 chương:** Giới thiệu → Đặc tả yêu cầu → Yêu cầu chức năng → Yêu cầu phi chức năng → Quy trình thao tác toàn hệ thống + Tài liệu tham khảo.
- **Từ viết tắt quan trọng:** SRS (Spaced Repetition), FSRS (Free Spaced Repetition Scheduler), STT/TTS, MV3 (Manifest V3), WASM, CEFR, i+1 (Krashen comprehensible input), OAuth, CDN, RSS.
- **Bảng ghi nhận thay đổi:** v1.0 tạo mới 2024-01-01.

---

## 2. `chuong_1_gioi_thieu.md`

- **Triết lý Orca:** Chắt lọc từ vựng giá trị nhất từ ngữ cảnh thực tế (cá voi sát thủ săn mồi chọn lọc).
- **Hệ sinh thái 3 sản phẩm chia sẻ data layer:** Orca Extension (Chrome/Edge MV3), Orca Web App (dashboard), Orca Mobile (Flutter, giai đoạn sau).
- **Lý thuyết nền tảng:** Language Acquisition Theory của Krashen — Input Hypothesis (i+1: câu chỉ khó hơn 1 chút) + Affective Filter (học nội dung yêu thích, không áp lực).
- **Mô hình Premium First:** Phase 1 Premium (không giới hạn), Phase 2 Standard (625 cards/1 ngôn ngữ/AI 30 lần/ngày), Phase 3 Guest (highlight + popup only).
- **Lợi thế cạnh tranh:** Offline-first hoàn toàn, đa ngôn ngữ từ đầu, tích hợp toàn diện (web+video+podcast+EPUB/PDF+clipboard), AI local (WebLLM Qwen2.5 auto-select theo RAM).
- **6 nhóm tính năng chính:** Immersion (đọc/xem/nghe), Flashcard (Quick Add, auto-fill, 4 card types, bulk, Anki export/sync), SRS Ocean Memory (FSRS, multi-deck, filtered review), Vocabulary Tracking (5 trạng thái, auto-update, import), AI (local+cloud, giải thích từ, phân tích câu, custom prompts), Thống kê (heatmap, vocabulary growth, retention, CEFR/IELTS level).
- **Quy định nghiệp vụ:** Vocabulary status (chưa học→theo dõi→đang học→đã học→ignore), i+1 rules (≥3 từ target, đúng 1 từ chưa biết), frequency milestone unlock (top 100/625/2000/5000/10000), sync conflict resolution (last-write-wins theo updated_at).
- **Phạm vi Phase 1:** EN+ZH, Chrome/Edge MV3, Google OAuth+Drive sync, Anki two-way, WebLLM+Gemini, YouTube+Netflix+iQIYI adapters, WordNet+CC-CEDICT+Yomichan format.

---

## 3. `chuong_2_dac_ta_yeu_cau.md`

- **Actor:** Premium User (Phase 1), Standard User (Phase 2), Guest (Phase 3), System (FSRS/sync/STT/badge/notification), Google OAuth, Google Drive API, AnkiConnect, Forvo, Google Images, Google Translate, Whisper STT, WebLLM/Ollama, YouTube/Netflix/iQIYI.
- **17 nhóm Use-case (UC01–UC17), tổng 130 UC:**
  - UC01: Quản lý tài khoản & Profile (7 UC — onboarding, Google login, logout, edit, add/switch language profile, cấp quyền extension).
  - UC02: Quản lý từ điển (6 UC — xem, thêm auto-download, import tùy chỉnh, ẩn/hiện, xóa, cập nhật).
  - UC03: Đọc trang web (8 UC — highlight, page difficulty, i+1 detection, word popup, điều hướng, tra từ thủ công, bookmark, toggle highlight).
  - UC04: Xem video (17 UC — detect subtitle chuyên dụng/phổ thông, Whisper STT, import, tìm subtitle, dual subtitle, auto-translate, điều hướng A/S/D, toggle, chế độ học, auto-pause, export, video local, playback speed, loop, lọc transcript, bulk create).
  - UC05: Nghe podcast (6 UC — thêm, download, phát+subtitle, click seek, làm mới, quản lý thư viện).
  - UC06: Đọc EPUB/PDF (4 UC — mở file, đọc+highlight, lưu tiến độ, per-book vocabulary).
  - UC07: Clipboard (5 UC — tạo session, paste, auto-detect, TTS+điều hướng, xem lại).
  - UC08: Vocabulary tracking (6 UC — xem manager, đổi status, bulk action, import word list, status history, auto-update).
  - UC09: Tạo flashcard (8 UC — cấu hình destination, quick add, customize, chọn ảnh Google Images, screenshot video, tags, bulk transcript, từ bookmark).
  - UC10: Quản lý flashcard (7 UC — xem manager, lọc, sửa, xóa, bulk, sentence bank, audio bank).
  - UC11: Quản lý deck (7 UC — tạo, sub-deck, sửa, xóa, merge, split, reset progress).
  - UC12: SRS review (9 UC — bắt đầu session, filtered, đánh giá, undo, sửa trong session, summary, reviewed cards, daily goals, daily limits).
  - UC13: Anki integration (6 UC — cài AnkiConnect, export, import, sync 2 chiều, chọn deck sync, sync log).
  - UC14: Bookmark (5 UC — tạo, xem manager, gửi email, tạo flashcard, xóa).
  - UC15: Sync & Storage (8 UC — Drive sync, merge, sync log, storage usage, export/import data, export/import settings).
  - UC16: Settings (12 UC — keyboard shortcuts, màu highlight, theme, UI language, native language, TTS, AI, AI prompts, daily reminder, blacklist, new tab override, auto-pause).
  - UC17: Statistics (9 UC — basic stats, advanced stats, review forecast, activity history, daily digest, per-source vocabulary, level progress, difficult words, achievement notification).

---

## 4. `chuong_3_yeu_cau_chuc_nang.md`

- **14 thực thể core (class diagram):** User → LanguageProfile → (VocabularyEntry, Deck→Card→CardField/ReviewLog, MediaSource→Subtitle, Bookmark, ClipboardSession→ClipboardEntry, ActivitySession, Dictionary).
- **VocabularyEntry:** status unknown→seen→learning→known→ignored, có frequency_rank, lemma, reading, pos.
- **Card:** lưu trạng thái FSRS (state New/Learning/Review/Relearning, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses), references VocabularyEntry, có CardField (front/back/audio/image/sentence).
- **Deck:** cấu trúc cây (parent_deck_id), mỗi deck có fsrs_params riêng, new_cards_limit, review_limit.
- **MediaSource:** source_type (YouTube/Netflix/podcast/local), lưu progress, completion_pct, cefr_estimate, known_word_pct.
- **Subtitle:** cache 3 ngày (expires_at), format SRT/VTT/JSON, thuộc MediaSource.
- **6 biểu đồ hoạt động (activity diagrams):** Onboarding, Đọc web+highlight, Tạo flashcard, Ôn tập SRS, Xem video+subtitle, Sync Google Drive.
- **3 swimlane diagrams:** Tạo flashcard từ video (ND→Content Script→Service Worker→External), Onboarding+đăng nhập (ND→UI→Service Worker→OAuth→Drive), Ôn tập SRS+sync (ND→Ocean Memory UI→FSRS Engine→SQLite→Drive).
- **Screen flow tổng thể:** Onboarding→Toolbar Popup (Home/Dict/Clip/Media/Memory/Settings)→Options Page, Word Popup overlay từ bất kỳ đâu, Ocean Memory/Local Media/Podcast/EPUB mở tab mới.
- **17 màn hình được mô tả chi tiết** với kích thước, điểm vào, chức năng.

---

## 5. `chuong_4_yeu_cau_phi_chuc_nang.md`

- **Hardware:** Desktop min CPU 2 nhân/RAM 4GB, khuyến nghị 4 nhân/8GB/WebGPU; lưu trữ 500MB min, 2GB+ khuyến nghị.
- **Software interfaces bắt buộc:** Chrome MV3 API, Google OAuth 2.0, Google Drive Files API v3, SQLite WASM (wa-sqlite), IndexedDB, Web Speech API.
- **Software interfaces tùy chọn (có fallback):** AnkiConnect 6, Forvo (→TTS), Google Images, Google Translate (→AI local), Whisper WASM, WebLLM Qwen2.5 (→Ollama), Google Cloud TTS (→Web Speech), Edge TTS, Podcast Search API, Gemini API (Phase 2).
- **Performance targets:** Word popup <150ms, tokenize viewport <300ms, SQLite lookup <30ms, SQLite cards due <50ms, switch profile <500ms, Whisper STT 20 phút <60s, WebLLM <8s, Drive sync <5s.
- **Resource limits:** RAM idle <50MB, active <500MB; CPU idle <1%, tokenize <15%; SQLite <100MB, IndexedDB <500MB, Drive <1GB.
- **Offline-first:** Highlight, popup, SRS, flashcard, vocabulary tracking, EPUB/PDF, local media, clipboard, AI local — tất cả hoạt động đầy đủ offline. Forvo→TTS, Google Images→không ảnh, Translate→AI local, Drive/Anki sync→queue.
- **Data integrity:** Atomic writes (transaction), conflict resolution (last-write-wins theo updated_at), soft delete (is_deleted=1), backup tự động lên Drive, checksum verify.
- **Security:** OAuth tokens trong chrome.storage.local (OS keychain encrypted), user data SQLite+IndexedDB local, content script isolated world, Shadow DOM cho word popup, tabCapture chỉ khi tạo flashcard.
- **Usability:** Zero-friction onboarding, progressive disclosure, WCAG 2.1 AA, keyboard navigation, localization (VI+EN).
- **Maintainability:** Monorepo (pnpm+Turborepo), shared business logic trong packages/shared, provider pattern (AI/TTS/Translation), adapter pattern (site adapters), TypeScript strict, Vitest ≥80% unit, Playwright E2E, Sentry error tracking.
- **Scalability:** Thêm ngôn ngữ (tokenizer adapter+từ điển), thêm AI provider (IAIProvider), thêm site adapter (ISiteAdapter), thêm card type (enum+template), auth layer abstract (Google OAuth→Supabase).

---

## 6. `chuong_5_luong_thao_tac_toan_he.md`

- **5 vị trí màn hình:** Toolbar Popup (380×520px, 1 màn Home duy nhất), Onboarding/Full Tab, Content Script Overlay (word popup/badge/floating bar/subtitle overlay), Orca Space (tab chung shared sidebar + tab riêng), Options Page (Profile/Pricing/Account/Appearance).
- **Orca Space workspace:** Tab chung sidebar (Home→Dictionary→Memory→Podcast→Media→Reader→Clipboard→Vocabulary→Bookmarks→Settings→Profile), tab riêng (Ocean Memory SRS, Podcast 3 screens, Local Media, EPUB/PDF, Clipboard).
- **25 màn hình Phase 1 Premium** được liệt kê chi tiết theo nhóm và theo luồng vào.
- **Chu trình chính (vòng học):** cài→onboarding→cấp quyền→đọc/xem/nghe→highlight→click từ→popup→Quick Add/Send to Creator→flashcard vào Ocean Memory/Anki→ôn tập SRS→cập nhật vocabulary→xem thống kê.
- **Toolbar Popup Home:** Language Switcher + Stats + 3 quyền toggles (Word Popup/Phân tích trang/Recording) + 9 shortcut buttons + Settings.
- **Dictionary tab:** Split view 70/30 — Lookup (70%) + Card Creator panel (30%) với auto-fill, Settings button cấu hình Quick Add destination.
- **Ocean Memory tab:** Floating tab bar [Review][Manage] — Review=FSRS session, Manage=Flashcard Manager.
- **9 chu trình chi tiết:** (1) Khởi tạo lần đầu, (2) Đọc web, (3) Xem video, (4) Nghe podcast, (5) Đọc EPUB/PDF, (6) Clipboard, (7) Tạo flashcard (Quick Add + Send to Creator), (8) Ocean Memory SRS, (9) Quản lý deck/card/vocabulary/bookmark.
- **Video:** 3 biến thể — web phổ thông (generic subtitle interceptor), chuyên dụng (YouTube/Netflix/iQIYI site adapters), local file. Dual subtitle, Whisper STT fallback, 4 chế độ học (Thường/Nghe/Đọc/Viết), auto-pause, A/S/D navigation.
- **Podcast:** Search-first flow — Browser→Library→Player+Transcript, Whisper STT tạo transcript, click câu seek, click từ mở popup.
- **Flashcard creation:** 2 luồng — Quick Add (1-click, pre-configured destination) và Send to Creator (chỉnh sửa trong Dictionary tab Card Creator panel). 4 card types: Sentence/Audio/Audio Sentence/Word.

---

## 7. `overview-orca-wiki.md`

- **Trạng thái dự án:** Phase 1 - Premium, overall 15% complete (tính đến 2026-05-29).
- **Đã hoàn thành:** Requirements docs (Ch 1-4), PRD, ER diagrams, activity diagrams, theme management design, dictionary management PRD, Orca Space UI prototype.
- **Đang làm:** UC01 Account Management (planning), Import Frequency List (architecture+implementation).
- **Sắp làm:** Dictionary management impl, theme management impl, web reading+highlight, video subtitle system, Ocean Memory SRS, Anki integration.
- **UC02 Dictionary:** Architecture complete, implementation in progress.
- **UC03-UC16:** Not started — requirements documented only.
- **Technical infrastructure:** SQLite WASM schema + IndexedDB schema designed; design system + theme architecture (Cluely Light/Midnight Dark) + Orca Space prototype done; database migration + repository pattern + component library chưa implement.
- **Success metrics:** Documentation 95%, Architecture 40%, Implementation 10%, Testing 0%.
- **Next priorities:** UC01 Account Management → Import Frequency List → Theme Management → Dictionary Management.

---

## 8. `tai_lieu_tham_khao.md`

- 10 tài liệu tham khảo: Krashen (Input Hypothesis, Language Acquisition), Wozniak (SuperMemo/SRS optimization), Ye (FSRS stochastic shortest path), Chrome MV3 docs, Google Drive API v3, Whisper (OpenAI), Expo, wa-sqlite, AnkiConnect.
- **Liên quan kiến trúc Cell:** FSRS algorithm (Ye 2022) là core SRS engine; wa-sqlite là storage layer; Chrome MV3 là runtime; AnkiConnect là integration target.

---

## Key Architecture Insights for Cell integration

- **Data model trung tâm:** `LanguageProfile` là pivot — mọi entity (VocabularyEntry, Deck/Card, MediaSource/Subtitle, Bookmark, Dictionary, ActivitySession) đều gắn với profile_id. Cell phải thiết kế database schema xoay quanh language profile, hỗ trợ multi-language từ đầu. `Card` lưu đầy đủ FSRS state (stability, difficulty, due, state) — cần implement FSRS engine chính xác theo paper Ye 2022.
- **Offline-first là nguyên tắc thiết kế cốt lõi:** SQLite WASM (wa-sqlite) cho structured data + IndexedDB cho media files. Mọi tính năng core (dictionary lookup, highlight, SRS, flashcard creation, vocabulary tracking) phải hoạt động 100% offline. External services (Forvo, Google Images, Translate, Drive sync, Anki sync) có fallback chain rõ ràng. Cell phải ưu tiên local-first architecture.
- **Dictionary + Tokenizer là foundation:** Dictionary management (WordNet/CC-CEDICT/Yomichan format, SQLite lookup <30ms) và tokenizer (viewport-based, IntersectionObserver, ≥500 từ/giây) là dependency cho mọi tính năng immersion (highlight, word popup, i+1 detection, page difficulty). Cell cần build dictionary import pipeline + tokenizer adapter pattern trước.
- **Flashcard creation flow 2 luồng:** Quick Add (1-click, pre-configured destination, toast confirm) và Send to Creator (Dictionary tab split 70/30, Card Creator panel auto-fill). 4 card types (Sentence/Audio/Audio Sentence/Word), auto-fill từ Forvo audio + Google Images + sentence context + AI. Cell cần Card Creator component + destination configuration system.
- **Subtitle/Video system phức tạp:** 3 biến thể (site adapters YouTube/Netflix/iQIYI, generic web interceptor, local file), dual subtitle, Whisper STT fallback, 4 chế độ học (Thường/Nghe/Đọc/Viết), transcript panel với filter i+1/known/tracking/learning, bulk create. Cell cần adapter pattern cho site-specific subtitle detection + Whisper WASM integration + subtitle overlay component.
