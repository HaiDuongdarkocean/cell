# CHƯƠNG 1: GIỚI THIỆU VỀ ĐỀ TÀI

---

## 1.1 Tổng quan về sản phẩm

**Orca** là một hệ sinh thái học ngoại ngữ. Sản phẩm được thiết kế để giúp người học ngoại ngữ tiếp thu từ vựng và ngữ pháp một cách tự nhiên thông qua các nguồn media họ yêu thích — phim, podcast, sách, trang web — thay vì học thuộc lòng theo phương pháp truyền thống.

Tên **Orca** lấy cảm hứng từ cá voi sát thủ (Orca) — loài động vật nổi tiếng với tập tục săn mồi chọn lọc, chỉ lấy những gì tinh túy nhất. Triết lý này phản ánh cách tiếp cận của sản phẩm: chắt lọc từ vựng có giá trị nhất từ ngữ cảnh thực tế.

Hệ sinh thái Orca gồm ba sản phẩm chia sẻ cùng một data layer:

| Sản phẩm     | Nền tảng                               | Mục đích chính                                           |
| -------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Orca Extension | Chrome / Edge (MV3)                      | Học từ vựng trên web, video, podcast, sách              |
| Orca Web App   | website tình duyệt                     | Dashboard thống kê nâng cao, quản lý deck               |
| Orca Mobile    | iOS / Android (Flutter, giai đoạn sau) | Tái sử dụng shared core sau khi extension core ổn định |

---

## 1.2 Bối cảnh của sản phẩm

### 1.2.1 Vấn đề hiện tại

Người học ngoại ngữ hiện nay đối mặt với hai thách thức lớn:

**Thứ nhất**, khoảng cách giữa học và thực hành. Người học dành nhiều thời gian với sách giáo khoa, ứng dụng học từ vựng (Duolingo, Memrise) nhưng khi tiếp xúc với nội dung thực tế (phim, podcast, sách) lại không hiểu được vì thiếu từ vựng trong ngữ cảnh.

**Thứ hai,** tốn công sức vào việc tìm tài nguyên, tải về khiến cho việc học trở nên mệt mỏi.

**Thứ ba**, tốn công sức trong việc tạo flashcard. Khi gặp từ mới trong phim hay sách, người học phải: dừng video → tra từ điển → copy câu → tìm ảnh → tìm audio → tạo card trong Anki. Quy trình này mất 3–5 phút mỗi từ, khiến nhiều người bỏ cuộc.

### 1.2.2 Giải pháp hiện có và hạn chế

| Sản phẩm       | Điểm mạnh                                                                                        | Hạn chế                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Yomitan          | Popup từ điển tốt                                                                               | không có SRS tích hợp -> phải kết nối với anki -> mỗi lần học phải bật anki thủ công để lưu từ                       |
| Migaku           | Tích hợp từ điển + media + SRS                                                                | Trả phí cao, không offline, hệ thống sử lý phân tích không tối ưu về quản lý ram, cpu -> máy yếu giật lag            |
| Anki             | SRS mạnh, tùy biến cao                                                                           | Không tích hợp với media, tạo card thủ công -> tốn thời gian                                                                   |
| Language Reactor | Điểm mạnh nhẹ, có thể dùng cho máy chỉ còn 500MB ram, Dual subtitle cho Netflix/YouTube | Không có SRS, không offline, không tích hợp từ điển đầy đủ                                                                 |
| Asbplayer        | điểm mạnh là có hỗ trợ lớp phủ subtitle hỗ trợ cho nhiều website                        | không hỗ trợ tải subtitle tự động của nhiều trang web, không tích hợp popup dictionary khiến việc immersion bị hạn chế |

Không có sản phẩm nào kết hợp được: đa ngôn ngữ + offline-first + tạo flashcard tự động từ mọi nguồn media + SRS tích hợp.

### 1.2.3 Lý thuyết nền tảng

Orca được xây dựng dựa trên **Lý thuyết Thụ đắc Ngôn ngữ** (Language Acquisition Theory) của Giáo sư Stephen Krashen, đặc biệt là hai giả thuyết:

- **Input Hypothesis (i+1):** Người học tiếp thu ngôn ngữ hiệu quả nhất khi tiếp xúc với nội dung chỉ khó hơn trình độ hiện tại một chút — tức là trong một câu, chỉ có đúng một từ chưa biết.
- **Affective Filter Hypothesis:** Học tập hiệu quả hơn khi người học được tiếp xúc với nội dung họ thực sự yêu thích và không bị áp lực.

---

## 1.3 Cơ hội kinh doanh của sản phẩm

### 1.3.1 Thị trường mục tiêu

Thị trường học ngoại ngữ toàn cầu đạt **62 tỷ USD năm 2022** và dự kiến tăng trưởng 18.7% CAGR đến 2030 (Grand View Research, 2023). Trong đó:

- **Immersion learning community** đang tăng trưởng mạnh, đặc biệt cộng đồng học tiếng Nhật (r/LearnJapanese: 1.2M members), tiếng Trung, tiếng Hàn.
- **Người Việt học tiếng Anh và tiếng Trung** là thị trường trọng điểm ban đầu — Việt Nam có hơn 50 triệu người học tiếng Anh và nhu cầu học tiếng Trung tăng mạnh theo quan hệ thương mại.

### 1.3.2 Mô hình kinh doanh

**Chiến lược — Premium First:**

Hệ thống **ưu tiên triển khai cho người dùng Premium trước**. Standard (Free) tier sẽ được phát triển sau khi sản phẩm đã ổn định ở Premium.

| Tier | Giới hạn | Giá | Giai đoạn |
|------|---------|-----|-----------|
| **Premium** | Không giới hạn flashcard, không giới hạn ngôn ngữ, cloud AI (Gemini), toàn bộ tính năng | Trả phí | **Phase 1 — Triển khai ngay** |
| **Standard** | 625 cards, 1 ngôn ngữ, AI 30 lần/ngày, vocabulary tracking không giới hạn | Miễn phí | Phase 2 — Phát triển sau |
| **Guest** | Chỉ highlight + word popup, không lưu dữ liệu | Miễn phí | Phase 3 |

**Lý do chọn Premium First:**
- Premium users cung cấp feedback chất lượng cao, chấp nhận sản phẩm ở giai đoạn early
- Doanh thu Phase 1 tài trợ cho phát triển Phase 2
- Tránh technical debt từ việc maintain free-tier constraints ngay từ đầu

### 1.3.3 Lợi thế cạnh tranh

- **Offline-first hoàn toàn:** Mọi tính năng core hoạt động không cần internet — điểm khác biệt lớn so với Migaku và Language Reactor.
  - Tưởng tượng
- **Đa ngôn ngữ từ đầu:** Kiến trúc được thiết kế để hỗ trợ nhiều ngôn ngữ.
- **Tích hợp toàn diện:** Duy nhất kết hợp web + video + podcast + EPUB/PDF + clipboard trong một sản phẩm.
- **AI local:** WebLLM phi3.5 chạy offline trên máy người dùng — không cần API key, tự chọn model theo RAM, chỉ tải khi người dùng yêu cầu.

---

## 1.4 Tầm nhìn của sản phẩm

> *"Orca trở thành công cụ học ngoại ngữ không thể thiếu cho bất kỳ ai áp dụng phương pháp immersion learning — từ người mới bắt đầu đến người học nâng cao — trên mọi nền tảng, mọi ngôn ngữ, mọi lúc mọi nơi."*

**Mục tiêu 3 năm:**

- **Phase 1 (Năm 1) — Premium:** Tiếng Anh + Tiếng Trung, Chrome/Edge Extension, Orca Space architecture, AI local + cloud Gemini, Google OAuth + Drive sync, Anki two-way sync
- **Phase 2 (Năm 2) — Standard/Free:** Standard tier với giới hạn 625 cards/1 ngôn ngữ/AI 30 lần/ngày; mở rộng user base
- **Phase 3 (Năm 3+):** Mobile app Flutter dùng lại shared core, Supabase backend, 10+ ngôn ngữ, community features

---

## 1.5 Các tính năng chính

### 1.5.1 Nhóm tính năng Immersion (đọc/xem/nghe)

| Tính năng  | Mô  tả |
| ---- | ---  |
| Website online Media Player | Học, điều hướng video/audio với subtitle và highlight |
| Word Highlight  | Highlight từ vựng theo learning status và frequency tier trên mọi trang web |
| i+1 Detection | Phát hiện và đánh dấu câu chỉ có 1 từ chưa biết — câu lý tưởng để học |
| Word Popup  | Popup từ điển inline (Shadow DOM) khi click/hover vào từ |
| Video Subtitle | Detect subtitle từ YouTube/Netflix, dual subtitle, loop câu, A/D navigation |
| Podcast Browser / Library / Episode List / Player / Transcript | Search podcast theo tên, lưu thư viện, duyệt episode, Whisper STT, offline download  |
| EPUB/PDF Reader  | Đọc sách với highlight từ vựng, lưu tiến độ |
| Local Media Player | Phát video/audio local với subtitle và highlight |
| Clipboard Reader | Paste text từ bất kỳ nguồn nào, TTS + navigation |
| Page Analysis | Floating badge hiển thị độ khó trang, % từ đã biết, CEFR ước tính |

### 1.5.2 Nhóm tính năng Flashcard

| Tính năng      | Mô tả                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| Quick Add        | Tạo flashcard 1 click từ word popup                                                  |
| Auto-fill Fields | Tự động điền: sentence, audio (cắt từ video), image (Google Images), definition |
| 4 Card Types     | Sentence / Audio / Audio Sentence / Word                                               |
| Bulk Creation    | Tạo hàng loạt từ transcript panel (lọc i+1/known/tracking/learning)               |
| Anki Export      | Xuất sang Anki qua AnkiConnect, auto field mapping                                    |
| Anki Sync        | Tự động sync trạng thái từ vựng khi Anki mở                                    |

### 1.5.3 Nhóm tính năng SRS (Ocean Memory)

| Tính năng         | Mô tả                                                       |
| ------------------- | ------------------------------------------------------------- |
| FSRS Algorithm      | Thuật toán SRS thế hệ mới, chính xác hơn SM-2         |
| Multi-deck          | Nhiều deck với FSRS settings riêng, sub-decks, merge/split |
| New Tab Override    | Mở tab mới → Ocean Memory SRS                              |
| Filtered Review     | Ôn tập theo tag/deck/loại từ                              |
| In-review Edit      | Sửa card ngay trong session ôn tập                         |
| Post-review Summary | Tổng kết sau mỗi session                                   |

### 1.5.4 Nhóm tính năng Vocabulary Tracking

| Tính năng        | Mô tả                                                         |
| ------------------ | --------------------------------------------------------------- |
| 5 Trạng thái     | Chưa học / Theo dõi / Đang học / Đã học / bỏ qua        |
| Auto Status Update | Tự động chuyển trạng thái khi SRS interval đạt ngưỡng |
| Word List Import   | Import từ đã biết: newline / CSV / JSON / free-text         |
| Vocabulary Manager | Tìm kiếm, lọc, bulk actions              |

### 1.5.5 Nhóm tính năng AI

| Tính năng      | Mô tả                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| AI Local         | WebLLM có tab quản lý lệnh tải về ai local— offline tự chọn model theo recommed theo cấu hình máy  |
| AI Cloud         | Gemini (Phase 2) — hệ thống trả tiền                                                         |
| Giải thích từ | AI giải thích nghĩa trong ngữ cảnh câu, load model khi cần                                 |
| Phân tích câu | AI phân tích cấu trúc ngữ pháp                                                              |
| Example Sentence | AI tạo câu ví dụ dễ hiểu hơn dựa theo những từ người dùng đã biết                                                               |
| Custom Prompts   | Người dùng tùy chỉnh prompt theo language profile                                            |
| Grammar Analysis | Phase 1: AI; Phase 2: grammar pack system                                                         |

### 1.5.6 Nhóm tính năng Thống kê

| Tính năng         | Mô tả                                                             |
| ------------------- | ------------------------------------------------------------------- |
| Heatmap Calendar    | Biểu đồ học tập theo ngày (GitHub-style)                      |
| Vocabulary Growth   | Biểu đồ tăng trưởng từ vựng theo thời gian                 |
| Vocabulary Coverage | Phân bố theo frequency tier (top 100/625/2000/5000/10000)         |
| Retention Rate      | Tỉ lệ nhớ đúng theo thời gian                                 |
| Review Forecast     | Dự báo card due 30 ngày tới                                     |
| Level System        | CEFR + IELTS, dựa trên flashcard trưởng thành + giờ immersion |
| Immersion Breakdown | Phân tích nguồn học (web/video/podcast/EPUB/clipboard)          |

---

## 1.6 Giả định và phụ thuộc

### 1.6.1 Giả định

- Người dùng sử dụng Chrome hoặc Edge phiên bản mới nhất (hỗ trợ MV3, WebGPU)
- Người dùng có tài khoản Google để sử dụng tính năng sync
- Người dùng cài Anki desktop nếu muốn dùng tính năng Anki integration
- AI local (WebLLMGPU) yêu cầu thiết bị có GPU hỗ trợ WebGPU; hệ thống sẽ tự chọn model theo RAM và chỉ tải khi cần. Thiết bị không có GPU vẫn dùng được qua wasm (CPU mode, chậm hơn)
- Forvo và Google Images có thể thay đổi cấu trúc DOM bất kỳ lúc nào — cần thiết kế adapter layer để dễ cập nhật

### 1.6.2 Phụ thuộc bên ngoài

| Phụ thuộc               | Loại                 | Rủi ro                                     |
| ------------------------- | --------------------- | ------------------------------------------- |
| Google Drive API          | Bắt buộc (sync)     | Thay đổi quota/pricing                    |
| Google OAuth 2.0          | Bắt buộc (auth)     | Thay đổi policy                           |
| AnkiConnect               | Tùy chọn            | Anki cập nhật API                         |
| Forvo (scrape)            | Tùy chọn            | Thay đổi DOM, block scraping              |
| Google Images (scrape)    | Tùy chọn            | Thay đổi DOM, block scraping              |
| Google Translate (scrape) | Tùy chọn            | Thay đổi DOM, block scraping              |
| YouTube/Netflix subtitle  | Tùy chọn            | Thay đổi API nội bộ                     |
| Whisper WASM              | Bắt buộc (STT)      | Cập nhật model                            |
| WebLLM / tùy chọn tải model           | Tùy chọn (AI local) | Cập nhật model + tier auto chọn theo RAM |

---

## 1.7 Phạm vi và Giới hạn

### 1.7.1 Trong phạm vi Phase 1 — Premium

- Chrome/Edge Extension (MV3)
- **Toolbar Popup:** 1 màn hình Home với Language Switcher, 3 Toggles quyền, Shortcut Buttons, Settings button
- **Orca Space — Tab chung (shared sidebar):** Home/Stats, Dictionary (split 70/30 + Card Creator), Vocabulary Manager, Bookmark Manager, Settings (quản lý nguồn học)
- **Orca Space — Tab riêng:** Ocean Memory SRS (+ Flashcard Manager floating tab bar), Podcast (Browser/Library/Player/Transcript), Local Media Player, EPUB/PDF Reader, Clipboard
- **Options Page:** Profile, Pricing, Account, Appearance (+ Advanced color picker)
- **Content Overlay:** Word Popup (Shadow DOM), Floating Badge, Floating Bar, Subtitle Overlay
- **Language Switcher:** Component dùng chung tại Toolbar Popup, Floating Bar, Options Page, Orca Space sidebar
- **Quick Add flow:** Pre-configured destination, toast notification nếu chưa setup
- Ngôn ngữ học: Tiếng Anh + Tiếng Trung
- UI language: Tiếng Việt + Tiếng Anh
- Auth: Google OAuth (Premium bắt buộc đăng nhập)
- Sync: Google Drive Files API + manual export/import
- AI: Local WebLLM (Qwen2.5, auto-select theo RAM) + Cloud Gemini (Premium)
- Video sites: YouTube + Netflix + iQIYI (site adapters) + generic .vtt/.srt
- Dictionary: WordNet (EN) + CC-CEDICT (ZH) + Yomichan format

### 1.7.2 Ngoài phạm vi 2 năm đầu

- Mobile app
- Supabase backend và cloud AI
- Leaderboard và social features
- Grammar pack system
- Textractor integration (game PC)
- OCR (ảnh và camera)
- Mobile built-in browser và EPUB/PDF reader
- Thêm ngôn ngữ (Nhật, Hàn, v.v.)
- Community deck sharing
- Analytics và error reporting nâng cao

---

## 1.8 Các quy định nghiệp vụ

### 1.8.1 Tier Limits

**Phase 1 — Premium (triển khai ngay, không giới hạn):**

| Tính năng | Giới hạn |
|-----------|---------|
| Flashcard | Không giới hạn |
| Ngôn ngữ | Không giới hạn |
| AI (cloud Gemini) | Không giới hạn |
| AI (local WebLLM) | Không giới hạn |
| Vocabulary tracking | Không giới hạn |
| Tất cả tính năng | Đầy đủ |

**Phase 2 — Standard/Free (phát triển sau):**

| Giới hạn | Giá trị |
|---------|---------|
| Số flashcard tối đa | 625 cards |
| Số ngôn ngữ | 1 ngôn ngữ |
| Vocabulary tracking | Không giới hạn |
| AI giải thích | 30 lần/ngày |
| Core lookup (tra từ điển, highlight) | Không giới hạn |

### 1.8.2 Vocabulary Status Rules

| Trạng thái            | Điều kiện chuyển                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| Chưa học → Theo dõi | Người dùng thủ công                                                         |
| Theo dõi → Đang học | Người dùng tạo flashcard                                                     |
| Đang học → Đã học | FSRS interval > ngưỡng (bàn kỹ ở sub-system) HOẶC người dùng thủ công |
| Bất kỳ → Ignore      | Người dùng thủ công                                                         |

### 1.8.3 i+1 Sentence Rules

Một câu được coi là **i+1** khi:

- Câu có ít nhất 3 từ thuộc ngôn ngữ đang học
- Đúng 1 từ trong câu có trạng thái "chưa học" hoặc "theo dõi"
- Tất cả từ còn lại có trạng thái "đang học" hoặc "đã học"

### 1.8.4 Frequency Milestone Unlock Rules

Màu highlight frequency chỉ hiển thị khi người dùng đạt milestone tương ứng:

| Milestone đạt được    | Màu mở khóa | Frequency tier |
| -------------------------- | -------------- | -------------- |
| Mặc định (0 từ)        | Xanh dương   | Top 100        |
| Mặc định (0 từ)        | Xanh lá       | Top 625        |
| Đạt 625 từ "đã học"  | Vàng          | Top 2000       |
| Đạt 2000 từ "đã học" | Cam            | Top 5000       |
| Đạt 5000 từ "đã học" | Đỏ           | Top 10000      |

### 1.8.5 Sync Conflict Resolution

- **Google Drive sync:** Per-record merge theo `updated_at` timestamp — record nào được cập nhật sau cùng thì thắng
- **Anki sync:** Per-record merge theo timestamp — áp dụng cho cả nội dung card lẫn tiến độ SRS
- **Xóa card:** Xóa đồng thời media files liên quan (audio, image) trên cả local và Drive

### 1.8.6 Offline Behavior

Khi không có mạng, hệ thống hoạt động bình thường với dữ liệu local. Các tính năng bị disable khi offline:

- Scrape Forvo (word audio) → fallback TTS
- Scrape Google Images → không có ảnh mới
- Scrape Google Translate → fallback AI local
- Google Drive sync → queue, sync khi có mạng
- Anki sync → queue, sync khi có mạng và Anki mở
- AI cloud (Phase 2) → fallback AI local

## 1.9 Quy trình tổng thể của Orca

> **Ký hiệu:**
>
> - `[ND]` = Người dùng thao tác
> - `[HT]` = Hệ thống xử lý tự động
> - `[TC]` = Tùy chọn (không bắt buộc)
> - `[NĐK]` = Nhánh khi có điều kiện

---

### Chu trình 0: Quản lý tài khoản & Profile

```
[ND] B1: Cài extension lần đầu
[HT] B2: Hiển thị màn hình chọn ngôn ngữ học (1 bước)
[ND] B3: Chọn ngôn ngữ học (EN hoặc ZH)
[HT] B4: Tự động download từ điển + frequency list tương ứng
[HT] B5: Khởi tạo language profile, cho phép dùng ở Guest mode ngay
[TC][ND] B6: Đăng nhập Google OAuth để mở tính năng sync Drive
[HT] B7: Liên kết tài khoản Google, tạo user record, bắt đầu sync
[TC][ND] B8: Cấp quyền extension cho trang web (per-site / per-domain / all sites)

--- Quản lý profile sau khi onboarding ---
[TC][ND] Thêm language profile mới (ví dụ: thêm tiếng Trung sau khi đã có tiếng Anh)
[HT]     Hệ thống download từ điển + frequency list cho ngôn ngữ mới
[TC][ND] Switch language profile từ toolbar popup (1 click)
[HT]     Hệ thống reload highlight + từ điển theo profile mới
[TC][ND] Chỉnh sửa thông tin tài khoản
[TC][ND] Đăng xuất tài khoản
```

---

### Chu trình 0.1: Quản lý từ điển

```
[ND] B1: Vào Options page → Dictionary Manager
[HT] B2: Hiển thị danh sách từ điển đã cài (tên, ngôn ngữ, số entries, phiên bản)
[TC][ND] B3a: Thêm từ điển — chọn từ danh sách auto-download (tích hợp trong folder hệ thống)
[HT]      B3b: Hệ thống download và import vào SQLite
[TC][ND] B4a: Import từ điển tùy chỉnh — upload file Yomichan .zip hoặc plain text
[HT]      B4b: Hệ thống parse và import vào SQLite
[TC][ND] B5: Ẩn/hiện từ điển (không xóa, chỉ tắt khỏi lookup)
[TC][ND] B6: Xóa từ điển
```

---

### Chu trình 0.2: Quản lý Vocabulary (Vocabulary Manager)

```
[ND] B1: Vào Options page → Vocabulary Manager
[HT] B2: Hiển thị danh sách từ đã track (lemma, status, frequency rank, ngày thêm)
[ND] B3: Tìm kiếm theo target word hoặc sentence
[ND] B4: Lọc theo trạng thái / POS / frequency tier / ngày
[TC][ND] B5: Đổi trạng thái từng từ thủ công (click vào status badge)
[TC][ND] B6: Chọn nhiều từ → bulk action (đổi trạng thái / xóa)
[TC][ND] B7: Import word list để đánh dấu hàng loạt là "đã biết"
           - Format: newline-separated / CSV / JSON / free-text đoạn văn
[HT]      B8: Tokenize đoạn văn → đánh dấu tất cả từ tìm thấy là "đã học"
[TC][ND] B9: Xem vocabulary status history của một từ cụ thể
```

---

### Chu trình 1: Onboarding (lần đầu cài)

```
[ND] B1: Cài extension từ Chrome Web Store
[HT] B2: Mở trang onboarding tự động (tab mới)
[ND] B3: Chọn ngôn ngữ học (EN hoặc ZH)
[HT] B4: Download từ điển + frequency list tương ứng (background)
[HT] B5: Khởi tạo Guest profile, cho phép dùng ngay
[TC][ND] B6: Đăng nhập Google để bật sync
[TC][ND] B7: Cấp quyền extension cho trang web (per-site/domain/all)
[HT] B8: Extension sẵn sàng hoạt động
```

### Chu trình 2: Đọc trang web

```
[ND] B1: Mở trang web đã cấp quyền toàn quyền enable full orca power on this website cho extension
[HT] B2: Content script tokenize text theo viewport (IntersectionObserver)
[HT] B3: underline từ theo learning status:
         - Đỏ (chưa học) / Cam (theo dõi) / Vàng (đang học)
         - Xanh lá (đã học — ẩn, hiện khi hover)
         - Xám (ignore — ẩn, hiện khi hover)
[TC][ND] B4: Nhấn badge → expandable top bar hiển thị  % từ đã biết / số từ chưa biết
[HT] B5: Phát hiện câu i+1 → highlight màu frequency tier:
         Xanh dương (top 100) / Xanh lá (top 625)
         Vàng/Cam/Đỏ (unlock theo milestone từ đã học)
[TC][ND] B9: Dùng N / Shift+N để điều hướng từ chưa biết/theo dõi
[TC][ND] B10: Dùng Ctrl+N / Alt+N để điều hướng mọi từ trong câu
[TC][ND] B11: Bookmark đoạn văn (thêm tags tùy chọn)

[NĐK] nếu chỉ cấp quyền enable popup dictionary on all websites cho trang:
     [ND] [tc] Chỉ có thể hover + phím tắt để tra cứu dicitonary (không click)
     [ND] B7: Click / hover / modifier+hover vào từ muốn tra
     [ND] B12: Đóng popup: Escape / click ngoài / mouseleave (tùy Settings)

Popup có thể hiện ở bất kỳ quyền nào
     [HT] B8: Word popup (Shadow DOM isolated) hiển thị:
          target word / frequency rank / POS / pinyin (ZH) /
          word audio (Forvo/TTS) / definition (multi-dict) /
          example sentence / AI giải thích / AI phân tích câu /
          link từ điển ngoài / nút Add flashcard
```

### Chu trình 3: Xem video

> Các tính năng subtitle, highlight, word popup, flashcard creation có sự kế thừa giữa các biến thể xem video.

#### Chu trình 3.1: Xem video trang web phổ thông (có thẻ `<video>`)

```
[ND] B1: Mở trang web xem phim (không phải YouTube/Netflix)
[HT] B2: Generic subtitle interceptor kích hoạt:
         Detect thẻ <track> trong DOM (HTML5 chuẩn)
         HOẶC intercept network request bắt file .vtt/.srt

[NĐK] Nếu detect được subtitle và chỉ có 1 thẻ <video>:
     [ND] B3a: Nhấn Ctrl+Shift+F để load và xử lý subtitle
     [TC][ND] B3b: Bật "Autoload" trong panel → lần sau tự động không cần thủ công

[NĐK] Nếu có subtitle và có nhiều thẻ <video>:
     [HT] B4: Hiển thị badge nhỏ ở góc trên phải mỗi thẻ <video>
     [ND] B5: Nhấn badge của video muốn học → kích hoạt load và xử lý

[NĐK] Nếu không có subtitle:
     [ND] B6a: Nhấn badge extension trên browser → expandable top bar
     [ND] B6b: Nhấn "Tạo subtitle" → Whisper STT transcribe qua chrome.tabCapture
     [TC][HT] B6c: Hệ thống tìm subtitle theo tiêu đề video (auto-search)

[TC][ND] B7: Kéo thả file .srt/.vtt vào thẻ <video> (như asbplayer)
[TC][ND] B8: Import file .srt/.vtt thủ công qua panel

[HT] B9: Orca thay thế subtitle gốc (draggable)
[HT] B10: Dual subtitle + auto-translate nếu thiếu bản dịch
[HT] B11: Transcript panel với filter i+1/known/tracking/learning
[HT] B12: Từ trong subtitle được highlight
[ND] B13: Click từ → word popup
[ND] B14: Điều hướng: A / S / D
[ND] B15: Tạo flashcard với sentence audio từ tabCapture
[TC][ND] B16: Export subtitle ra .srt/.vtt
```

---

#### Chu trình 3.2: Xem video trang web chuyên dụng (YouTube / Netflix / iQIYI)

```
[ND] B1: Mở video trên YouTube / Netflix / iQIYI
[HT] B2: Site adapter tương ứng kích hoạt (detect theo domain)
[HT] B3: Adapter lấy subtitle theo cơ chế riêng:
         YouTube → intercept XML/JSON subtitle từ API nội bộ
         Netflix → intercept TTML/DFXP từ API nội bộ
         iQIYI   → intercept subtitle từ API nội bộ

[NĐK] Nếu không có subtitle ngôn ngữ học:
     [ND] B4a: Nhấn nút "Tạo subtitle" trên floating bar
     [HT] B4b: Whisper STT transcribe audio (batch <20 phút / chunked nếu dài hơn)
     [NĐK] Nếu cũng không có subtitle ngôn ngữ mẹ đẻ:
          [HT] Tạo cả hai subtitle (học + mẹ đẻ) cùng lúc

[NĐK] Nếu không có subtitle ngôn ngữ mẹ đẻ:
     [TC][ND] B5: Nhấn "Translate" → hệ thống auto-translate qua Google Translate/AI local

[HT] B6: Orca thay thế subtitle gốc bằng subtitle của mình (draggable)
[HT] B7: Dual subtitle hiển thị:
         Ngôn ngữ học (trên) + Ngôn ngữ mẹ đẻ (dưới)
[HT] B8: Transcript panel hiển thị toàn bộ subtitle, có thể lọc:
         i+1 / known / tracking / learning sentences
[HT] B9: Từ trong subtitle được highlight theo learning status

[ND] B10: Click vào từ trong subtitle → word popup
[ND] B11: Điều hướng: A (lùi câu) / S (lặp câu) / D (tiến câu)
[TC][ND] B12: Toggle phím tắt → ẩn/hiện subtitle dịch
[TC][ND] B13: Bật Auto-pause (Settings) → video tự dừng khi có từ chưa biết
[TC][ND] B14: Dừng video thủ công → hệ thống auto-popup từ ưu tiên
              (đang học → theo dõi → chưa học)

[TC][ND] B15: Chọn chế độ học:
         - Thường: hiện cả subtitle chính và phụ
         - Nghe: ẩn cả hai subtitle, dừng video, hiển thị sau khi nghe xong
         - Đọc: dừng video, hiển thị subtitle trước khi phát âm thanh
         - Viết: ẩn subtitle chính, dừng video, hiện ô input để ghi lại
                 [HT] So sánh input với subtitle → hiển thị thống kê độ chính xác

[ND] B16: Tạo flashcard → sentence audio tự động cắt theo timestamp subtitle
[TC][ND] B17: Bulk create từ transcript panel (chọn nhiều câu)
[TC][ND] B18: Export subtitle ra .srt/.vtt
```

---

#### Chu trình 3.3: Xem video local (Local Media Player)

```
[ND] B1: Mở Local Media Player (tab mới trong extension)
[ND] B2: Chọn file video (.mp4 / .mkv) từ máy hoặc drag-drop vào player
[HT] B3: Thêm vào playlist, lưu tiến độ
[HT] B4: Tìm subtitle theo thứ tự ưu tiên:
         1. File .srt/.vtt cùng tên với video (auto-detect)
         2. Người dùng import file .srt/.vtt thủ công
         3. Whisper STT transcribe audio (batch/chunked)
[HT] B5: Render subtitle (draggable)
[HT] B6: Dual subtitle + auto-translate nếu cần
[HT] B7: Transcript panel với filter
[HT] B8: Từ trong subtitle được highlight
[ND] B9: Click từ → word popup
[ND] B10: Điều hướng: A / S / D
[ND] B11: Điều chỉnh playback speed: 0.5x – 2x
[ND] B12: Loop segment (lặp lại câu đang xem)
[ND] B13: Tạo flashcard với sentence audio cắt theo timestamp
[HT] B14: Lưu tiến độ xem (tập nào, thời điểm nào)
[TC][ND] B15: Export subtitle ra .srt/.vtt
```

### Chu trình 4: Nghe podcast

```
[ND] B1: Mở Podcast Browser hoặc Podcast Library (tab mới trong extension; mobile là giai đoạn sau)
[ND] B2: Tìm podcast theo tên, host, hoặc keyword liên quan
[HT] B3: Fetch danh sách podcast từ nguồn metadata nội bộ
[ND] B4: Chọn podcast card và mở Episode List
[HT] B5: Lưu podcast vào Library nếu chưa có
[TC][ND] B6: Download episode để nghe offline
[ND] B7: Chọn episode và phát
[HT] B8: Whisper STT transcribe audio → tạo subtitle
         (batch nếu < 20 phút, chunked nếu dài hơn)
[HT] B9: Cache subtitle 3 ngày
[HT] B10: Subtitle hiển thị dưới player, từ được highlight theo learning status
[ND] B11: Click từ trong transcript/subtitle → word popup
[ND] B12: Click câu trong transcript → seek audio đến đúng điểm đó
[ND] B13: Loop segment (lặp lại câu đang nghe)
[ND] B14: Điều chỉnh playback speed: 0.5x – 2x
[TC][ND] B15: Nhấn "Làm mới subtitle" nếu kết quả STT không vừa ý
[HT] B14: Background audio + lock screen controls (future mobile)
[ND] B15: Tạo flashcard từ câu trong subtitle
```

---

### Chu trình 5: Đọc EPUB/PDF

```
[ND] B1: Mở EPUB/PDF Reader (tab mới trong extension)
[ND] B2: Chọn file từ máy hoặc drag-drop vào reader
[HT] B3: Parse và render nội dung sách
[HT] B4: Tokenize text, highlight từ theo learning status
[HT] B5: Khôi phục tiến độ đọc (nếu đã đọc trước đó)
[ND] B6: Đọc nội dung
[ND] B7: Click từ → word popup
[TC][ND] B8: Bookmark đoạn văn hay (thêm tags)
[TC][ND] B9: Tạo flashcard từ câu đang đọc
[HT] B10: Tự động lưu tiến độ đọc (vị trí hiện tại)
[HT] B11: Cập nhật per-book vocabulary list (từ đã gặp trong sách này)
[HT] B12: Cập nhật page difficulty analysis (% từ đã biết, CEFR ước tính)
```

---

### Chu trình 6: Dùng Clipboard

```
[ND] B1: Mở Clipboard tab trong toolbar popup
[HT] B2: Hiển thị danh sách named sessions đã tạo
[TC][ND] B3: Tạo session mới (đặt tên: ví dụ "Game XYZ Chapter 1")
[ND] B4: Paste text thủ công vào ô input
[TC][ND] B5: Bật toggle "Auto-detect clipboard" ngay trong tab
[HT] B6: (Nếu auto-detect bật) Tự động nhận text khi người dùng copy từ bất kỳ đâu
[HT] B7: Tokenize text, highlight từ theo learning status
[HT] B8: TTS đọc to đoạn text
[ND] B9: Điều hướng: tiến/lùi câu, lặp câu, lặp đoạn
[ND] B10: Click từ → word popup
[ND] B11: Tạo flashcard từ câu
[HT] B12: Lưu vào session history (có thể xem lại sau)
```

### Chu trình 7: Tạo Flashcard

```
Từ bất kỳ nguồn nào (web / video / podcast / EPUB / clipboard):

--- Bước chuẩn bị (1 lần, lưu trong Settings) ---
[ND] S1: Chọn đích: Ocean Memory hoặc Anki
[NĐK] Nếu chọn Anki:
     [ND] S2a: Chọn Anki deck + card type
     [HT] S2b: Auto-map fields (tên trùng → tự động)
     [TC][ND] S2c: Chỉnh sửa field mapping thủ công
[NĐK] Nếu chọn Ocean Memory:
     [ND] S2d: Chọn deck Ocean Memory
[ND] S3: Chọn card type mặc định: Sentence / Audio / Audio Sentence / Word

--- Tạo thẻ ---
[ND] B1: Nhấn nút "Add to flashcard" trong word popup
[HT] B2: Quick add — tự động điền các fields:
         - Target word (từ đang xem)
         - Sentence (câu chứa từ trong ngữ cảnh)
         - Sentence translate (scrape Google Translate / AI local)
         - Definition (từ điển đã import)
         - Word audio (scrape Forvo → fallback TTS)
         - Sentence audio (cắt từ video/podcast theo timestamp → fallback TTS)
         - Image (scrape Google Images by URL → grid chọn ảnh)
         - Example sentence (AI tạo theo custom prompt)
         - POS (từ từ điển + AI fallback)
         - Notes (AI tạo theo custom prompt trong Settings)
[ND] B3: [Send to creator] Xem và chỉnh sửa từng field nếu muốn
[NĐK] Chỉnh sửa Image:
     [ND] B4a: Xem grid ảnh từ Google Images → click chọn ảnh
     [TC][ND] B4b: Screenshot frame video hiện tại
[ND] B5: Thêm tags tùy chỉnh
[ND] B6: Nhấn Lưu
[HT] B7: Lưu card vào deck đã chọn
[HT] B8: Cập nhật vocabulary status: "chưa học/theo dõi" → "đang học"
[HT] B9: Lưu sentence vào Sentence bank
[HT] B10: Lưu audio vào Audio bank

[TC][ND] Bulk create từ transcript panel:
[ND] B11: Lọc câu trong transcript panel (i+1 / known / tracking / learning)
[ND] B12: Chọn nhiều câu
[ND] B13: Nhấn "Bulk add"
[HT] B14: Tạo hàng loạt cards với auto-fill cho từng câu
```

### Chu trình 8: Ôn tập SRS (Ocean Memory)

```
[ND] B1: Mở tab mới → Ocean Memory SRS (New Tab Override)
         HOẶC nhấn Memory tab trong toolbar popup → mở tab Ocean Memory
[HT] B2: Hiển thị: số card due / streak / % retention / daily goal progress
[ND] B3: Nhấn "Bắt đầu ôn tập"
[TC][ND] B3a: Chọn Filtered review (theo tag / deck / POS)

--- Vòng lặp mỗi card ---
[HT] B4: Hiển thị mặt trước card (theo card type)
[ND] B5: Nhớ lại câu trả lời
[ND] B6: Lật mặt sau (nhấn phím cách hoặc click)
[HT] B7: Hiển thị mặt sau với đầy đủ thông tin
[ND] B8: Đánh giá: Again / Good
         (FSRS tính interval tiếp theo dựa trên đánh giá)
[TC][ND] B9: Undo lần đánh giá vừa rồi (nếu nhấn nhầm)
[TC][ND] B10: Sửa card ngay trong session (edit inline)
[NĐK] Nếu đánh giá "Again":
     [HT] B11: Card về trạng thái new, học lại trong session hiện tại
--- Kết thúc vòng lặp ---

[HT] B12: Kết thúc session → Post-review summary:
          Số đúng / sai / từ khó nhất trong session
[HT] B13: Cập nhật vocabulary status khi interval đạt ngưỡng "đã học"
[HT] B14: Cập nhật badge trên extension icon (số card due còn lại)
[HT] B15: Ghi vào activity_sessions (thời gian, số card ôn)
```

### Chu trình 9: Anki Integration

```
--- Export Orca → Anki ---
[ND] B1: Vào Settings → Anki Integration
[NĐK] Nếu chưa có AnkiConnect:
     [HT] B2: Tự động cài AnkiConnect addon vào Anki
[ND] B3: Chọn deck Ocean Memory muốn export
[ND] B4: Chọn Anki deck + card type đích
[HT] B5: Auto-map fields (tên trùng → tự động)
[TC][ND] B6: Chỉnh sửa field mapping thủ công
[ND] B7: Xác nhận export
[HT] B8: Gửi cards qua AnkiConnect API

--- Import Anki → Orca ---
[ND] B1: Vào Settings → Anki Integration → Import
[ND] B2: Chọn Anki deck muốn import
[HT] B3: Fetch danh sách cards từ AnkiConnect
[HT] B4: Auto-map fields
[TC][ND] B5: Chỉnh sửa field mapping
[ND] B6: Xác nhận import
[HT] B7: Import nội dung + tiến độ SRS (convert SM-2 → FSRS)

--- Sync 2 chiều (tự động) ---
[HT] B1: Phát hiện Anki đang mở (AnkiConnect đang chạy)
[HT] B2: So sánh updated_at của từng record
[HT] B3: Per-record merge — record mới hơn thắng
[HT] B4: Ghi sync log (thời gian, số records cập nhật)
[TC][ND] B5: Xem sync log trong Settings → Anki Integration
[NĐK] Nếu mất kết nối AnkiConnect (và đã bật sync 2 chiều):
     [HT] B6: Hiển thị thông báo + hướng dẫn kết nối lại
```

### Chu trình 10: Sync đa thiết bị

```
--- Thiết bị A thay đổi data ---
[ND/HT] B1: Thay đổi data (tạo card, ôn tập, đổi vocab status...)
[HT] B2: Ghi vào SQLite local + cập nhật sync_metadata (updated_at, device_id)
[HT] B3: Service Worker upload SQLite dump + media files mới lên Google Drive
[HT] B4: Ghi Drive sync log

--- Thiết bị B mở app ---
[HT] B5: Download SQLite dump từ Google Drive
[HT] B6: Per-record merge theo updated_at — record mới hơn thắng
[HT] B7: Soft delete: is_deleted = 1 (không xóa thật)
[HT] B8: Download media files lazy (khi cần hiển thị)

--- Manual backup ---
[TC][ND] B9: Export toàn bộ data ra JSON/ZIP
[TC][ND] B10: Import lại từ file JSON/ZIP
[TC][ND] B11: Export settings ra JSON
[TC][ND] B12: Import settings từ JSON
```

---

### Chu trình 11: Thống kê & Progress

```
--- Toolbar popup (basic) ---
[HT] Hiển thị: streak / cards due / % retention / daily goal progress
[HT] Lookup history: 5 từ tra gần nhất

--- New Tab page (Ocean Memory) ---
[HT] Hiển thị: SRS manager + full stats + quote/tip học ngôn ngữ
[HT] Daily achievement notification: Chrome notification → click → Home tab

--- Web App Dashboard (advanced) ---
[ND] B1: Mở web app (GitHub Pages)
[HT] B2: Load data từ Google Drive
[HT] B3: Hiển thị:
         Heatmap calendar (GitHub-style)
         Vocabulary growth chart (tăng trưởng theo thời gian)
         Vocabulary coverage chart (theo frequency tier)
         Retention rate chart
         Card state distribution (new/learning/review/mature)
         Immersion source breakdown (web/video/podcast/EPUB/clipboard)
         Goal vs actual chart
         Time of day heatmap
         Review forecast (30 ngày tới)
         Difficult words list
         Word type distribution (POS)
         SRS review history
         Activity history (sắp xếp theo độ khó)
         Daily vocabulary digest
         Per-source vocabulary list + difficulty analysis
[HT] B4: Level system: CEFR + IELTS
         Dựa trên: flashcard trưởng thành + giờ immersion có hoạt động thực sự
```
