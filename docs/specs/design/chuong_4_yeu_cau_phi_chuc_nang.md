# CHƯƠNG 4: CÁC YÊU CẦU PHI CHỨC NĂNG

---

## 4.1 External Interfaces

### 4.1.1 Hardware Interfaces

| Thiết bị | Yêu cầu tối thiểu | Khuyến nghị |
|---|---|---|
| **Desktop (Extension)** | CPU 2 nhân, RAM 4GB, Chrome/Edge phiên bản mới nhất | CPU 4 nhân, RAM 8GB, GPU hỗ trợ WebGPU |
| **Mobile (iOS)** | Giai đoạn sau | Giai đoạn sau |
| **Mobile (Android)** | Giai đoạn sau | Giai đoạn sau |
| **GPU (AI local)** | Không bắt buộc — fallback CPU qua Ollama | GPU hỗ trợ WebGPU (NVIDIA/AMD/Intel Arc) |
| **Kết nối mạng** | Không bắt buộc cho tính năng core | Băng thông 10 Mbps+ cho download từ điển |
| **Dung lượng lưu trữ** | 500MB trống (từ điển + SQLite) | 2GB+ (từ điển + media cache + AI model) |

### 4.1.2 Software Interfaces

#### Giao tiếp bắt buộc (Required)

| Interface | Phiên bản | Mục đích | Ghi chú |
|---|---|---|---|
| **Chrome Extension MV3 API** | Manifest V3 | Runtime của extension | Bắt buộc, không có fallback |
| **Google OAuth 2.0** | v2 | Xác thực người dùng | Cần internet, Guest mode không cần |
| **Google Drive Files API** | v3 | Sync dữ liệu đa thiết bị | Cần internet, offline queue khi mất mạng |
| **SQLite WASM (wa-sqlite)** | ≥ 0.9.x | Lưu trữ dữ liệu local | Chạy trong browser, không cần cài đặt |
| **IndexedDB** | Browser native | Lưu media files (audio, image) | Có sẵn trong mọi browser hiện đại |
| **Web Speech API** | Browser native | TTS mặc định | Fallback khi không có Google Cloud TTS |

#### Giao tiếp tùy chọn (Optional)

| Interface | Phiên bản | Mục đích | Fallback |
|---|---|---|---|
| **AnkiConnect API** | 6 | Tích hợp 2 chiều với Anki desktop | Không có — tính năng bị tắt nếu Anki không mở |
| **Forvo (scrape)** | DOM-based | Audio phát âm từ vựng | Web Speech API TTS |
| **Google Images (scrape)** | URL-based | Ảnh minh họa flashcard | Không có ảnh |
| **Google Translate (scrape)** | URL-based | Dịch câu và định nghĩa | AI local (WebLLM Qwen2.5) |
| **Whisper WASM** | whisper.cpp WASM | STT offline trên browser | Không có subtitle (yêu cầu import thủ công) |
| **WebLLM (Qwen2.5)** | MLC-LLM | AI local trên browser qua WebGPU, load on-demand | Ollama → không có AI |
| **Ollama API** | localhost:11434 | AI local qua native runtime | WebLLM → không có AI |
| **Google Cloud TTS** | v1 | TTS chất lượng cao | Web Speech API |
| **Edge TTS (Microsoft)** | Browser native | Giọng đọc Edge | Web Speech API |
| **Podcast Search / Metadata API** | v1 | Tìm podcast theo tên, lấy metadata & feedUrl nội bộ | RSS feed là chi tiết internal |
| **Podcast Library Cache** | Local DB / IndexedDB | Lưu podcast đã lưu, episode list cache, và resume state | Không được mất dữ liệu khi offline |
| **Gemini API** | v1 (Phase 2) | Cloud AI | AI local |

#### Giao tiếp nội bộ (Internal)

| Interface | Cơ chế | Mục đích |
|---|---|---|
| **Content Script ↔ Service Worker** | `chrome.runtime.sendMessage` | Tạo flashcard, sync data |
| **Content Script ↔ Background** | `chrome.storage` | Đọc settings, vocabulary status |
| **Extension ↔ Web App** | Google Drive (shared data) | Sync stats, flashcard data |
| **Extension ↔ Mobile (future)** | Google Drive (shared SQLite dump) | Sync toàn bộ data (giai đoạn sau) |

---

## 4.2 Các thuộc tính chất lượng

### 4.2.1 Performance (Hiệu năng)

#### Thời gian phản hồi

| Tính năng | Mục tiêu | Giới hạn tối đa | Đo lường |
|---|---|---|---|
| Word popup hiển thị sau click | < 150ms | < 300ms | Từ mousedown đến popup visible |
| Tokenize viewport (trang web) | < 300ms | < 600ms | Từ page load đến highlight xuất hiện |
| SQLite lookup từ điển | < 30ms | < 80ms | Query time cho 1 từ |
| SQLite query cards due | < 50ms | < 100ms | Query toàn bộ cards due hôm nay |
| Switch language profile | < 500ms | < 1s | Từ click đến highlight reload xong |
| Whisper STT (batch, 20 phút) | < 60s | < 120s | Trên máy có integrated GPU |
| WebLLM AI response | < 8s | < 15s | Trên máy có integrated GPU, sau khi model đã warm-up |
| Ollama AI response | < 5s | < 10s | Trên máy có CPU 4 nhân |
| Google Drive sync (incremental) | < 5s | < 15s | Upload SQLite dump thay đổi |
| Onboarding (tạo profile) | < 1s | < 2s | Từ chọn ngôn ngữ đến ready |
| Download từ điển (WordNet) | < 30s | < 60s | Trên kết nối 10 Mbps |

#### Tài nguyên hệ thống

| Tài nguyên | Giới hạn bình thường | Giới hạn tối đa |
|---|---|---|
| RAM extension (idle) | < 50MB | < 100MB |
| RAM extension (active, có AI) | < 500MB | < 1GB |
| CPU extension (idle) | < 1% | < 5% |
| CPU extension (tokenize) | < 15% | < 30% |
| Dung lượng SQLite | < 100MB | < 500MB |
| Dung lượng IndexedDB (media) | < 500MB | < 2GB |
| Dung lượng Google Drive | < 1GB | < 15GB (giới hạn free) |

#### Throughput

| Tính năng | Mục tiêu |
|---|---|
| Số từ tokenize/giây | ≥ 500 từ/giây |
| Số card tạo hàng loạt | ≥ 10 card/giây |
| Số từ lookup đồng thời | ≥ 50 từ/giây |

---

### 4.2.2 Reliability (Độ tin cậy)

#### Offline-first

| Tính năng | Offline behavior |
|---|---|
| Highlight từ vựng | ✅ Hoạt động đầy đủ |
| Word popup / tra từ điển | ✅ Hoạt động đầy đủ |
| Ocean Memory SRS | ✅ Hoạt động đầy đủ |
| Tạo flashcard | ✅ Hoạt động đầy đủ |
| Vocabulary tracking | ✅ Hoạt động đầy đủ |
| EPUB/PDF reader | ✅ Hoạt động đầy đủ |
| Local Media Player | ✅ Hoạt động đầy đủ |
| Clipboard reader | ✅ Hoạt động đầy đủ |
| AI giải thích (local) | ✅ Hoạt động nếu model đã tải |
| Word audio (Forvo) | ❌ Fallback TTS |
| Ảnh flashcard | ❌ Không có ảnh mới |
| Dịch câu | ⚠️ Fallback AI local |
| Google Drive sync | ❌ Queue, sync khi có mạng |
| Anki sync | ❌ Queue, sync khi Anki mở + có mạng |

#### Data Integrity

| Yêu cầu | Mô tả |
|---|---|
| Atomic writes | Mọi write vào SQLite phải là transaction — không có partial write |
| Conflict resolution | Per-record merge theo `updated_at` timestamp — record mới hơn thắng |
| Soft delete | Xóa dùng `is_deleted = 1`, không xóa thật — cho phép recovery |
| Backup tự động | SQLite dump được upload lên Drive sau mỗi thay đổi đáng kể |
| Checksum | Verify SQLite dump sau khi download từ Drive trước khi merge |

#### Error Recovery

| Tình huống | Hành vi |
|---|---|
| Extension crash | Service Worker tự restart, data không mất (SQLite persistent) |
| Drive sync thất bại | Retry sau 15 phút, tối đa 3 lần, sau đó thông báo người dùng |
| Anki sync thất bại | Queue lại, retry khi Anki mở lần tiếp theo |
| Whisper STT timeout | Hiển thị thông báo, cho phép retry hoặc import thủ công |
| AI model chưa tải | Hiển thị loading state, load ngầm theo request đầu tiên, không block UI |
| SQLite corrupt | Restore từ Drive backup gần nhất |

---

### 4.2.3 Security (Bảo mật)

#### Lưu trữ thông tin nhạy cảm

| Dữ liệu | Nơi lưu | Cơ chế bảo vệ |
|---|---|---|
| Google OAuth access token | `chrome.storage.local` | Chrome tự mã hóa theo OS keychain |
| Google OAuth refresh token | `chrome.storage.local` | Chrome tự mã hóa theo OS keychain |
| Google Cloud TTS API key | `chrome.storage.local` | Chrome tự mã hóa theo OS keychain |
| Ollama endpoint | `chrome.storage.local` | Không nhạy cảm (localhost) |
| User data (flashcard, vocab) | SQLite WASM + IndexedDB | Lưu local, không gửi đi |
| Media files (audio, image) | IndexedDB + Google Drive | Drive của người dùng, không qua server Orca |

#### Chrome Extension Permissions

| Permission | Lý do cần | Rủi ro |
|---|---|---|
| `storage` | Lưu settings, cache | Thấp |
| `identity` | Google OAuth | Thấp |
| `tabs` | Detect URL để apply blacklist | Thấp |
| `activeTab` | Inject content script khi được cấp quyền | Thấp |
| `scripting` | Inject content script vào trang web | Trung bình |
| `tabCapture` | Capture audio từ tab để cắt sentence audio | Trung bình |
| `notifications` | Daily reminder + achievement | Thấp |
| `alarms` | Scheduled tasks (sync, reminder) | Thấp |
| `host_permissions` | Chạy content script trên trang được cấp quyền | Trung bình |

**Không yêu cầu:** `history`, `bookmarks`, `downloads`, `<all_urls>` mặc định

#### Content Script Isolation

- Content script chạy trong **isolated world** — không đọc được JS variables hoặc cookies của trang web
- Word popup dùng **Shadow DOM** — CSS hoàn toàn cách ly, không bị trang web override
- `tabCapture` chỉ kích hoạt khi người dùng chủ động tạo flashcard — không record liên tục
- Audio buffer được xóa ngay sau khi cắt xong

#### Privacy

| Dữ liệu | Orca thu thập | Gửi đi đâu |
|---|---|---|
| Email, tên, avatar | Có (từ Google OAuth) | Lưu local + Drive của người dùng |
| Nội dung trang web đang đọc | Không | — |
| Flashcard content | Có | Lưu local + Drive của người dùng |
| Lịch sử duyệt web | Không | — |
| Thông tin thanh toán | Không (Phase 2: Stripe xử lý) | — |
| Analytics / tracking | Không (Phase 2) | — |

---

### 4.2.4 Usability (Khả năng sử dụng)

#### First-run Experience

| Yêu cầu | Mô tả |
|---|---|
| Zero-friction onboarding | Chọn ngôn ngữ 1 bước → dùng được ngay (Guest mode) |
| Không bắt buộc đăng nhập | Guest mode đầy đủ tính năng core, đăng nhập để bật sync |
| Progressive disclosure | Tính năng nâng cao (AI, Anki, custom prompts) ẩn cho đến khi cần |
| Smart defaults | Tất cả settings có giá trị mặc định hợp lý, không cần cấu hình |

#### Keyboard Shortcuts

| Yêu cầu | Mô tả |
|---|---|
| Tùy chỉnh được | Người dùng có thể đổi phím tắt trong Settings |
| Đồng bộ theo chức năng | Cùng phím tắt hoạt động nhất quán trên video, podcast, clipboard |
| Không conflict | Hệ thống cảnh báo khi phím tắt bị trùng |
| Defaults hợp lý | A/S/D cho navigation video, N/Shift+N cho từ vựng |

#### Accessibility (WCAG 2.1 AA)

| Yêu cầu | Mô tả |
|---|---|
| Keyboard navigation | Tất cả tính năng có thể dùng bằng bàn phím |
| Screen reader | Các element có `aria-label` đầy đủ |
| Color contrast | Tỉ lệ contrast ≥ 4.5:1 cho text thường, ≥ 3:1 cho text lớn |
| Focus indicator | Focus ring rõ ràng trên mọi interactive element |
| Reduced motion | Tôn trọng `prefers-reduced-motion` — tắt animation khi người dùng yêu cầu |
| Font size | Không dùng font size < 11px trong extension popup |

#### Localization

| Yêu cầu | Mô tả |
|---|---|
| UI language | Tiếng Việt + Tiếng Anh (2 năm đầu), mở rộng sau |
| Native language | Người dùng tự chọn ngôn ngữ mẹ đẻ cho dịch |
| CJK support | Font fallback cho tiếng Trung (Noto Sans SC) |
| RTL | Không hỗ trợ trong 2 năm đầu |

---

### 4.2.5 Maintainability (Khả năng bảo trì)

#### Code Architecture

| Yêu cầu | Mô tả |
|---|---|
| Monorepo | pnpm workspaces + Turborepo — tất cả packages trong 1 repo |
| Shared business logic | FSRS, tokenizer, sync logic trong `packages/shared` — không duplicate |
| Provider pattern | AI, TTS, Translation dùng interface — swap provider không ảnh hưởng business logic |
| Adapter pattern | Site adapters (YouTube, Netflix) tách biệt — thêm site mới không sửa core |
| TypeScript strict | `strict: true` — bắt lỗi type tại compile time |

#### Testing

| Loại test | Tool | Coverage mục tiêu |
|---|---|---|
| Unit tests | Vitest | ≥ 80% cho shared package (FSRS, tokenizer, sync) |
| Integration tests | Vitest | Các flow chính: tạo card, ôn tập, sync |
| E2E tests | Playwright | Happy path của 5 chu trình chính |
| Mobile tests | Flutter test + integration_test | Giai đoạn sau, không thuộc 2 năm đầu |

#### Error Tracking

| Yêu cầu | Mô tả |
|---|---|
| Sentry integration | Tự động báo lỗi khi extension crash |
| Stack trace | Gửi stack trace, không gửi user data |
| Opt-out | Người dùng có thể tắt error tracking trong Settings |
| Source maps | Upload source maps lên Sentry để debug production |

#### Documentation

| Yêu cầu | Mô tả |
|---|---|
| JSDoc | Tất cả public API trong `packages/shared` có JSDoc |
| README | Mỗi package có README với setup instructions |
| Changelog | CHANGELOG.md theo format Keep a Changelog |
| ADR | Architecture Decision Records cho các quyết định quan trọng |

---

### 4.2.6 Portability (Khả năng di chuyển)

#### Cross-platform

| Platform | Hỗ trợ | Ghi chú |
|---|---|---|
| Chrome (Windows) | ✅ 2 năm đầu | Primary target |
| Chrome (macOS) | ✅ 2 năm đầu | |
| Chrome (Linux) | ✅ 2 năm đầu | |
| Edge (Windows) | ✅ 2 năm đầu | Chromium-based, tương thích hoàn toàn |
| Edge (macOS) | ✅ 2 năm đầu | |
| Firefox | ❌ Giai đoạn sau | WebExtensions API khác một số chỗ |
| Safari | ❌ Giai đoạn sau | Safari Extension API khác nhiều |
| iOS (Flutter) | 🕒 Giai đoạn sau | Flutter app, dùng shared contracts |
| Android (Flutter) | 🕒 Giai đoạn sau | Flutter app, dùng shared contracts |

#### Data Portability

| Yêu cầu | Mô tả |
|---|---|
| Export JSON/ZIP | Người dùng có thể export toàn bộ data ra file |
| Import JSON/ZIP | Người dùng có thể import lại từ file |
| Export settings | Settings export ra JSON riêng |
| Anki export | Export deck sang Anki format qua AnkiConnect |
| Standard formats | Subtitle export ra .srt/.vtt chuẩn |

#### Migration

| Yêu cầu | Mô tả |
|---|---|
| SQLite schema migration | Dùng migration scripts khi upgrade schema |
| Backward compatibility | File export từ 2 năm đầu phải import được vào giai đoạn sau |
| Settings migration | Settings cũ tự động migrate khi upgrade |

---

### 4.2.7 Scalability (Khả năng mở rộng)

#### Data Scalability

| Giới hạn | Free tier | Premium | Ghi chú |
|---|---|---|---|
| Số flashcard | 625 | Không giới hạn | Enforce local (2 năm đầu), server (giai đoạn sau) |
| Vocabulary tracking | 3,000 từ | Không giới hạn | |
| Số ngôn ngữ | 1 | Không giới hạn | |
| Số deck | Không giới hạn | Không giới hạn | |
| Dung lượng media | Giới hạn bởi Drive (15GB) | Giới hạn bởi Drive | |
| Số từ điển | Không giới hạn | Không giới hạn | |

#### Architecture Scalability

| Yêu cầu | Mô tả |
|---|---|
| Thêm ngôn ngữ | Thêm tokenizer adapter + từ điển — không sửa core |
| Thêm AI provider | Implement `IAIProvider` interface — không sửa business logic |
| Thêm site adapter | Implement `ISiteAdapter` interface — không sửa subtitle system |
| Thêm card type | Thêm vào enum + template — không sửa FSRS engine |
| Backend giai đoạn sau | Auth layer được abstract — swap Google OAuth → Supabase không ảnh hưởng UI |

#### Performance Scalability

| Tình huống | Hành vi |
|---|---|
| Trang web có 10,000+ từ | Tokenize theo viewport (lazy) — không tokenize toàn trang |
| Từ điển 500,000+ entries | SQLite index trên `lemma` — query O(log n) |
| 10,000+ flashcard | FSRS query dùng index trên `due` date — không scan toàn bộ |
| Video 2 giờ+ | Whisper chunked mode — chia nhỏ audio, xử lý song song |

---

## 4.3 Tài liệu tham khảo

| # | Tiêu chuẩn / Tài liệu | Áp dụng cho |
|---|---|---|
| [1] | ISO/IEC 25010:2011 — Systems and software quality models | Cấu trúc thuộc tính chất lượng |
| [2] | WCAG 2.1 Level AA — Web Content Accessibility Guidelines | Accessibility requirements |
| [3] | Chrome Extension MV3 Documentation | Extension architecture |
| [4] | Google Drive API v3 — Quota and limits | Storage và sync limits |
| [5] | FSRS Algorithm Paper (Ye, 2022) | SRS scheduling accuracy |
| [6] | Whisper.cpp Performance Benchmarks | STT performance targets |
| [7] | WebGPU Specification (W3C) | AI local hardware requirements |
| [8] | OWASP Top 10 | Security requirements |
