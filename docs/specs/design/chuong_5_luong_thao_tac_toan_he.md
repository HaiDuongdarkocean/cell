# CHƯƠNG 5: QUY TRÌNH THAO TÁC TOÀN HỆ THỐNG

---

## 5.1 Mục đích của chương

Chương này mô tả toàn bộ cách người dùng thao tác với Orca theo góc nhìn vận hành:

- màn hình nào có trong hệ thống
- màn hình đó nằm ở đâu
- người dùng vào màn hình đó bằng cách nào
- trong từng màn hình có chức năng gì
- người dùng thao tác theo chu trình chính và chu trình phụ ra sao
- chuỗi màn hình nối nhau như thế nào để tạo thành một vòng học hoàn chỉnh

Tài liệu này được viết theo hướng `extension-first`, **Phase 1 — Premium User**:

- extension là trung tâm
- **Orca Space** là unified workspace học tập (tab chung + tab riêng)
- **Toolbar Popup** chỉ có 1 màn hình Home — không có multi-tab
- mobile chỉ là giai đoạn sau, không phải luồng hiện tại
- Standard/Free tier sẽ được phát triển ở Phase 2

---

## 5.2 Quy ước vị trí màn hình

Orca có 5 vị trí hiển thị chính. Mỗi vị trí phục vụ một kiểu thao tác khác nhau.

### 5.2.1 Toolbar Popup

- Nằm ngay dưới icon extension trên thanh công cụ của trình duyệt
- Kích thước chuẩn: `380×520px`
- Dùng cho thao tác nhanh, xem tổng quan, mở các màn hình lớn
- Đây là nơi người dùng ghé vào nhiều nhất trong ngày

### 5.2.2 Onboarding / Full Tab

- Là một tab toàn màn hình của trình duyệt
- Chỉ xuất hiện khi cài extension lần đầu hoặc khi cần thiết lập lớn
- Dùng cho thao tác cấu hình ban đầu, đăng nhập, thêm ngôn ngữ, cấp quyền

### 5.2.3 Content Script Overlay

- Nằm đè trực tiếp trên trang web người dùng đang đọc/xem
- Bao gồm:
  - word popup
  - floating badge
  - floating bar
  - subtitle overlay
- Đây không phải trang riêng mà là lớp điều khiển bám vào nội dung trang

### 5.2.4 Orca Space — Extension Pages (Workspace học tập)

Orca Space là unified workspace học tập, chia làm 2 loại tab:

**Tab chung (shared sidebar)** — nội dung thay đổi trong cùng 1 tab, sidebar điều hướng bên trái:

| Sidebar Item | Mô tả |
|-------------|-------|
| Home | Heatmap activity (GitHub style) + Words learned statistics |
| Dictionary | Split view 70/30: Lookup (trái) + Card Creator panel (phải) |
| Memory | Shortcut mở tab Ocean Memory riêng |
| Podcast | Shortcut mở tab Podcast riêng |
| Media | Shortcut mở tab Local Media Player riêng |
| Reader | Shortcut mở tab EPUB/PDF Reader riêng |
| Clipboard | Shortcut mở tab Clipboard riêng |
| Vocabulary Manager | Danh sách từ vựng tracking |
| Bookmark Manager | Danh sách câu/đoạn đã bookmark |
| Settings | Quản lý: từ điển, frequency list, AI prompts, language profile |
| Profile | Link sang Options Page — Profile |

**Thứ tự sidebar:** Home → Dictionary → Memory → Podcast → Media → Reader → Clipboard → Vocabulary Manager → Bookmark Manager → Settings → Profile

**Tab riêng** — mỗi cái là 1 browser tab độc lập:

- **Ocean Memory SRS:** FSRS review + Flashcard Manager (floating tab bar phía dưới)
- **Podcast tab:** Browser screen → Library screen → Player + Transcript screen
- **Local Media Player tab**
- **EPUB/PDF Reader tab**
- **Clipboard tab**

**Quy tắc mở tab:**
- Khi nhấn shortcut button trong Toolbar Popup → kiểm tra tab đã mở → **focus tab cũ** nếu có, mở tab mới nếu chưa có
- Tab chung: click sidebar item → nội dung thay đổi, tab không đổi

### 5.2.5 Options Page

- Extension Page riêng biệt, truy cập từ Settings button trong Toolbar Popup
- **Không phải** Orca Space
- Sections: Profile | Pricing | Account | Appearance
- Appearance có Advanced toggle → color picker từ defined color system

---

## 5.3 Bản đồ màn hình tổng thể — Phase 1 Premium (25 màn hình)

### 5.3.1 Bản đồ theo nhóm

| STT | Nhóm | Màn hình | Vị trí | Ghi chú |
|-----|------|---------|--------|---------|
| 1 | Khởi tạo | Onboarding Page | Full tab | Lần đầu cài |
| 2 | Truy cập nhanh | Toolbar Popup - Home | Dưới icon extension | Màn hình DUY NHẤT trong Toolbar |
| 3 | Overlay tra từ | Word Popup | Overlay (Shadow DOM) | Quick Add + Send to Creator |
| 4 | Overlay trang | Floating Badge | Overlay góc trang | Icon Orca — khi cấp quyền phân tích trang |
| 5 | Overlay trang | Floating Bar | Overlay bám trang | Language Switcher + % từ biết |
| 6 | Overlay video | Subtitle Overlay | Overlay trên video | Dual subtitle, draggable |
| 7 | Orca Space (tab chung) | Home / Statistics | Tab chung | Heatmap + Words learned |
| 8 | Orca Space (tab chung) | Dictionary + Card Creator | Tab chung | Split view 70/30 |
| 9 | Orca Space (tab chung) | Vocabulary Manager | Tab chung | Status tracking |
| 10 | Orca Space (tab chung) | Bookmark Manager | Tab chung | Convert to card |
| 11 | Orca Space (tab chung) | Settings (nguồn học) | Tab chung | Từ điển, freq list, AI prompts |
| 12 | Orca Space (tab riêng) | Ocean Memory SRS | Tab riêng | Review + Flashcard Manager (floating tab bar) |
| 13 | Orca Space (tab riêng) | Podcast — Browser | Tab riêng (screen 1) | Search podcast |
| 14 | Orca Space (tab riêng) | Podcast — Library | Tab riêng (screen 2) | Danh sách đã lưu |
| 15 | Orca Space (tab riêng) | Podcast — Player + Transcript | Tab riêng (screen 3) | Player + transcript sync |
| 16 | Orca Space (tab riêng) | Local Media Player | Tab riêng | Video/audio local |
| 17 | Orca Space (tab riêng) | EPUB/PDF Reader | Tab riêng | Đọc sách |
| 18 | Orca Space (tab riêng) | Clipboard | Tab riêng | Paste + TTS |
| 19 | Options Page | Profile | Tab riêng | Tài khoản Google |
| 20 | Options Page | Pricing | Tab riêng | Premium vs Standard |
| 21 | Options Page | Account | Tab riêng | Drive sync, Anki |
| 22 | Options Page | Appearance | Tab riêng | Light/Dark + Advanced color |
| 23 | Shared Component | Language Switcher | Component | Toolbar, Floating Bar, Options, Orca Space |
| 24 | Shared Component | Card Creator Panel | Panel (30% Dictionary tab) | Auto-fill + Settings button |
| 25 | Shared Component | Quick Add Toast | Toast/Banner | 1-click từ Word Popup |

### 5.3.2 Bản đồ theo luồng vào

| Điểm vào | Màn hình mở ra |
|----------|----------------|
| Cài extension lần đầu | Onboarding Page |
| Click icon extension | Toolbar Popup - Home |
| Click từ được highlight | Word Popup |
| Click Floating Badge | Floating Bar |
| Mở tab mới | Ocean Memory SRS nếu bật New Tab Override |
| Click shortcut button trong Toolbar | Focus Orca Space tab tương ứng (hoặc mở mới) |
| Click Settings button trong Toolbar | Options Page |
| Click Profile trong Orca Space sidebar | Options Page - Profile |
| Click "Send to Creator" trong Word Popup | Dictionary tab (Card Creator panel auto-fill) |
| Click "Quick Add" trong Word Popup | Toast confirm → lưu vào pre-configured destination |

---

## 5.4 Chu trình chính của hệ thống

Chu trình chính của Orca là:

1. cài extension
2. onboarding: chọn ngôn ngữ → download từ điển + frequency list → (có thể đóng tab ngay, download tiếp nền)
3. mở Toolbar Popup Home → cấp 3 quyền (word popup / phân tích trang / recording)
4. đọc web / xem video / nghe podcast / đọc sách / dán clipboard
5. nội dung được phân tích tự động: highlight + underline theo status
6. click từ → Word Popup hiện ra
7. tra nghĩa, nghe audio, AI giải thích
8. **Quick Add** (1-click, pre-configured) hoặc **Send to Creator** (chỉnh sửa trong Dictionary tab)
9. flashcard vào Ocean Memory (FSRS) hoặc Anki
10. ôn tập SRS hàng ngày trong Ocean Memory tab
11. hệ thống cập nhật vocabulary status → highlight trên trang cập nhật
12. xem thống kê trong Orca Space Home (heatmap + words learned)

Đây là vòng lặp trung tâm. Mọi màn hình khác đều quay về một trong các bước trên.

---

## 5.4.1 Toolbar Popup — Màn hình Home (chi tiết)

Toolbar Popup **chỉ có 1 màn hình Home duy nhất** (không có tabs như thiết kế cũ).

### Bố cục từ trên xuống dưới:

```
┌─────────────────────────────────────┐
│ [Language Switcher ●]   [Stats row] │  ← Avatar ngôn ngữ (hình tròn) + streak/cards due
│ ─────────────────────────────────── │
│ QUYỀN EXTENSION                     │
│ [◉] Word Popup     [all browser]    │  ← Toggle 1: áp dụng toàn bộ browser
│ [◉] Phân tích trang [trang này]     │  ← Toggle 2: chỉ trang hiện tại → kích hoạt Floating Badge
│ [◉] Recording      [trang này]      │  ← Toggle 3: cho phép capture audio/image từ video
│ ─────────────────────────────────── │
│ SHORTCUT BUTTONS (9 items)          │
│ [Dict] [Memory] [Podcast]           │
│ [Media] [Reader] [Clipboard]        │
│ [Vocab] [Bookmark] [Settings→]      │
│ ─────────────────────────────────── │
│ [⚙ Settings]                       │  ← Mở Options Page
└─────────────────────────────────────┘
```

### Quy tắc Shortcut Buttons:
- Click bất kỳ shortcut → kiểm tra Orca Space tab tương ứng đã mở chưa
- **Đã mở** → focus vào tab đó + sidebar active đúng item
- **Chưa mở** → mở tab mới (tab chung hoặc tab riêng tùy loại)

### Language Switcher:
- Hình tròn, hiển thị flag/icon ngôn ngữ active
- Click → bảng chọn ngôn ngữ (giống giao diện Onboarding)
- Component **dùng chung** tại: Toolbar Popup, Floating Bar, Options Page, Orca Space sidebar

---

## 5.4.2 Orca Space — Chi tiết kiến trúc

### Tab chung (shared sidebar):

Khi mở, luôn có sidebar navigation bên trái. Click sidebar item → nội dung thay đổi, tab không đổi.

**Sidebar items theo thứ tự:**

| # | Icon | Label | Hành vi khi click |
|---|------|-------|-------------------|
| 1 | 🏠 | Home | Hiển thị Heatmap activity + Words learned |
| 2 | 📖 | Dictionary | Split 70/30: Lookup trái, Card Creator phải |
| 3 | 🧠 | Memory | **Mở tab riêng** Ocean Memory SRS |
| 4 | 🎙 | Podcast | **Mở tab riêng** Podcast tab |
| 5 | 🎬 | Media | **Mở tab riêng** Local Media Player |
| 6 | 📚 | Reader | **Mở tab riêng** EPUB/PDF Reader |
| 7 | 📋 | Clipboard | **Mở tab riêng** Clipboard |
| 8 | 📝 | Vocabulary | Vocabulary Manager (tab chung) |
| 9 | 🔖 | Bookmarks | Bookmark Manager (tab chung) |
| 10 | ⚙ | Settings | Orca Space Settings (tab chung) — quản lý nguồn học |
| 11 | 👤 | Profile | Link sang Options Page - Profile |

### Dictionary tab — Split view 70/30:

```
┌──────────────────────────────────────────────────────┐
│         ORCA SPACE — Dictionary                      │
├──────────────────────────┬───────────────────────────┤
│   DICTIONARY (70%)       │   CARD CREATOR (30%)      │
│                          │ ┌─────────────────────┐   │
│ 🔍 Search keyword...     │ │ Card Creator  [⚙]  │   │  ← Settings button
│                          │ │ CARD TYPE  DECK     │   │
│ ─────────────────────── │ │ [Sentence▼][Vocab▼] │   │
│                          │ │ TARGET WORD         │   │
│  Welcome to the          │ │ ___________________│   │
│  Orca Dictionary         │ │ SENTENCE      [CREATE]  │
│                          │ │ ___________________│   │
│  Look up words and       │ │ ...                 │   │
│  create cards by sending │ │ [CLEAR] [CREATE CARD]   │
│  info to the             │ └─────────────────────┘   │
│  Card Creator            │                           │
└──────────────────────────┴───────────────────────────┘
```

- Empty state bên phải: "Welcome to the Orca Dictionary" (như ảnh prototype)
- Khi "Send to Creator" từ Word Popup → Card Creator panel tự điền dữ liệu
- Settings button (⚙) trong Card Creator header → cấu hình deck/destination cho Quick Add

### Ocean Memory tab — Floating tab bar:

```
┌──────────────────────────────────────┐
│          OCEAN MEMORY                │
│                                      │
│   [Card content ở giữa]              │
│                                      │
│   [Again] [Hard] [Good] [Easy]       │
│                                      │
└──────────────────────────────────────┘
│ ───── Floating tab bar ─────────────│
│ [ Review ]  [ Manage ]              │  ← Tab bar dài bằng nội dung
└─────────────────────────────────────┘
```

- **Review tab:** FSRS review session
- **Manage tab:** Flashcard Manager (browse, edit, delete, deck management)
- Floating tab bar background dài bằng số items, không chiếm toàn bộ chiều rộng

---

## 5.5 Chu trình 1 - Khởi tạo lần đầu - Khởi tạo lần đầu

### 5.5.1 Mục tiêu

Biến một người mới cài extension thành người có thể học ngay trong vài phút.

### 5.5.2 Màn hình tham gia

- Onboarding Page
- Toolbar Popup - Home
- Orca Space - Settings (thay thế Options Page - Dictionary cũ)

### 5.5.3 Thứ tự thao tác của người dùng

1. Người dùng cài extension từ Chrome Web Store.
2. Người dùng click icon extension lần đầu.
3. Extension kiểm tra đã có dữ liệu local hay chưa.
4. Nếu chưa có dữ liệu, hệ thống mở `Onboarding Page` (full tab).
5. Người dùng chọn ngôn ngữ học đầu tiên (EN hoặc ZH).
6. Hệ thống bắt đầu download từ điển + frequency list — hiển thị progress bar.
7. **Ngay khi download bắt đầu**, hiển thị dòng chữ: *"Bạn có thể đóng tab này và khám phá Orca"* — download tiếp tục nền.
8. Nút "Xem chi tiết" → Orca Space Settings (để xem tiến độ và cài đặt nâng cao).
9. Hệ thống khởi tạo LanguageProfile và lưu cấu hình ban đầu.
10. Hệ thống chuyển sang `Toolbar Popup - Home`.

### 5.5.4 Việc hệ thống làm

- tạo `User` (Phase 1: Premium, bắt buộc đăng nhập Google)
- tạo `LanguageProfile`
- bắt đầu download dictionary + frequency list (background)
- set ngôn ngữ active
- set shortcut và theme mặc định (Dark mode)
- hiển thị progress download + nút "Xem chi tiết"
- mở màn Toolbar Popup Home để người dùng bắt đầu thao tác

### 5.5.5 Kết quả

Sau chu trình này, người dùng có thể:

- mở bất kỳ trang web nào để highlight từ
- tra từ bằng word popup
- bắt đầu tạo flashcard
- vào Ocean Memory để review

---

## 5.6 Chu trình 2 - Đọc web

### 5.6.1 Mục tiêu

Cho phép người dùng đọc một trang web bất kỳ và biến trang đó thành nguồn học.

### 5.6.2 Màn hình tham gia

- Content Script trên trang web
- Floating Badge (khi đã cấp quyền phân tích trang)
- Floating Bar
- Word Popup
- Orca Space - Dictionary tab (khi dùng "Send to Creator")
- Toolbar Popup - Home

### 5.6.3 Vị trí và cách màn hình xuất hiện

- `Floating Badge` là icon Orca nhỏ nằm ở góc phải trang — **chỉ hiện khi user cấp quyền "Phân tích trang"** trong Toolbar Popup.
- `Floating Bar` mở ra khi click Floating Badge — hiển thị Language Switcher + % từ đã biết.
- `Word Popup` xuất hiện ngay cạnh từ người dùng click hoặc hover (hoặc modifier+hover).
- `Toolbar Popup` chỉ xuất hiện khi người dùng bấm icon extension trên thanh công cụ.

### 5.6.4 Thứ tự thao tác của người dùng

1. Người dùng mở một trang web có nội dung ngôn ngữ đang học.
2. Extension kiểm tra site có được phép chạy hay không.
3. Content script được inject vào trang.
4. Hệ thống tokenize phần đang nhìn thấy.
5. Từ vựng được highlight theo trạng thái học.
6. Badge góc phải hiện độ khó trang và tỷ lệ từ đã biết.
7. Người dùng click hoặc hover vào một từ được highlight.
8. `Word Popup` mở ra ngay cạnh từ đó.
9. Người dùng đọc định nghĩa, ví dụ, audio, AI giải thích. Nếu đây là lần đầu mở AI tab, hệ thống tự nhận diện RAM, chọn model Qwen2.5 phù hợp, tải model ngầm và chỉ hiển thị progress nhỏ trong popup.
10. Nếu muốn, người dùng nhấn `Add to flashcard`.
11. Nếu muốn, người dùng nhấn bookmark hoặc mở từ điển ngoài.

### 5.6.5 Người dùng làm gì trong Word Popup

**Header:**
- đọc từ + phonetic (IPA hoặc Pinyin cho ZH)
- xem POS tags và frequency rank
- nghe audio (Forvo hoặc TTS fallback)
- xem và đổi vocabulary status (badge dropdown)

**Tab bar:** WordNet / FreqDict / AI
- đọc definition trong từng dictionary
- xem example sentences
- AI giải thích từ trong ngữ cảnh câu đang đọc

**Footer — Tạo card:**
- **Quick Add:** lưu ngay vào pre-configured destination (Ocean Memory hoặc Anki). Nếu chưa cấu hình destination → toast/banner dẫn đến Dictionary tab → Card Creator → Settings button
- **Send to Creator:** mở Orca Space Dictionary tab, Card Creator panel (30% bên phải) tự động điền đầy đủ thông tin
- **Mark as Known:** đánh dấu từ là "đã học" ngay

**Khác:**
- bookmark câu/đoạn hiện tại
- mở external dictionary (tab mới)

### 5.6.6 Hành vi phụ trong luồng đọc web

- `N / Shift+N` để nhảy giữa từ chưa biết
- `Ctrl+N / Alt+N` để nhảy giữa mọi từ
- bật/tắt highlight tạm thời
- mở floating bar để xem i+1 và page difficulty

### 5.6.7 Kết quả

Chu trình đọc web kết thúc khi:

- người dùng rời trang
- người dùng tạo xong card
- người dùng đổi sang content khác
- người dùng tắt highlight tạm thời

---

## 5.7 Chu trình 3 - Xem video

### 5.7.1 Mục tiêu

Biến video thành nguồn học có subtitle, audio, sentence navigation, và flashcard creation.

### 5.7.2 Màn hình tham gia

- Content Script trên website video
- Subtitle Overlay
- Word Popup
- Floating Badge
- Floating Bar
- Local Media Player
- Orca Space sidebar → Media shortcut

### 5.7.3 Vị trí và cách màn hình xuất hiện

- `Subtitle Overlay` nằm trực tiếp trên vùng video, thường ở phía dưới video frame.
- `Word Popup` mở khi người dùng click vào từ trong subtitle.
- `Local Media Player` là tab riêng nếu người dùng mở file local.
- `Orca Space - Media tab` là nơi mở Local Media Player.

### 5.7.4 Thứ tự thao tác của người dùng

1. Người dùng mở video trên YouTube, Netflix, site hỗ trợ, hoặc file local trong player.
2. Hệ thống tìm subtitle có sẵn.
3. Nếu không có subtitle, hệ thống tạo subtitle bằng STT.
4. Subtitle được overlay lên video.
5. Người dùng xem video và đọc subtitle đồng thời.
6. Người dùng click một từ trong subtitle.
7. `Word Popup` mở ra.
8. Người dùng chọn:
   - nghe lại từ/câu
   - nhảy tới câu trước/sau
   - tạo flashcard
   - bookmark
   - mở external dictionary
9. Người dùng điều hướng subtitle bằng shortcut.
10. Người dùng điều chỉnh tốc độ phát nếu cần.
11. Hệ thống lưu tiến độ phát và lịch sử media.

### 5.7.5 Phím tắt và tương tác

- `A / ←`: quay về subtitle gần nhất
- `D / →`: tới subtitle kế tiếp
- `S / ↓`: lặp subtitle hiện tại
- `W / ↑`: ẩn cả hai subtitle
- shortcut có thể remap trong Settings
- `N / Shift+N` để nhảy giữa từ chưa biết
- `Ctrl+N / Alt+N` để nhảy giữa mọi từ

### 5.7.6 Chức năng trong màn Video

- phát video
- pause / resume
- seek theo câu
- seek từ chưa biết (popup dictionary)
- seek từ đã biết (popup dictionary)
- loop câu
- đổi tốc độ phát
- tạo flashcard từ subtitle
- tạo bookmark từ timestamp
- xem transcript panel
- lọc i+1 / known / tracking / learning

### 5.7.7 Kết quả

Chu trình video hoàn tất khi:

- người dùng tạo card
- người dùng bookmark câu
- người dùng kết thúc video
- người dùng chuyển sang nguồn media khác

---

## 5.8 Chu trình 4 - Nghe podcast

### 5.8.1 Mục tiêu

Biến podcast thành một chu trình học hoàn chỉnh theo kiểu search-first:
người dùng tìm podcast bằng tên, lưu vào thư viện, mở danh sách episode, phát episode, đọc transcript, rồi nhảy đến câu khó để tra cứu hoặc tạo card.

### 5.8.2 Màn hình tham gia

- Podcast tab (tab riêng trong Orca Space — gồm 3 screens nội bộ)
  - Screen 1: Podcast Browser (tìm kiếm)
  - Screen 2: Podcast Library (danh sách đã lưu)
  - Screen 3: Podcast Player + Transcript Panel
- Word Popup
- Orca Space sidebar → Podcast shortcut

### 5.8.3 Vị trí và vai trò của từng màn

Tất cả nằm trong **1 Podcast tab riêng** với navigation nội bộ giữa 3 screens:
- **Screen 1 — Podcast Browser:** điểm vào tìm podcast theo tên. Home screen mặc định khi mở Podcast tab.
- **Screen 2 — Podcast Library:** danh sách podcast đã lưu. Click podcast → xem danh sách episodes.
- **Screen 3 — Podcast Player + Transcript Panel:** phát audio + transcript đồng bộ. Click câu → seek. Click từ → Word Popup.
- `Word Popup` mở khi người dùng click vào từ trong transcript.

### 5.8.4 Chu trình chính của người dùng

1. Người dùng mở Podcast tab từ Toolbar Popup shortcut hoặc Orca Space sidebar. Tab mặc định hiển thị Podcast Browser (Screen 1) hoặc Podcast Library (Screen 2) nếu đã có podcast đã lưu.
2. Người dùng gõ tên podcast, tên host, hoặc từ khóa liên quan.
3. Hệ thống trả về danh sách podcast phù hợp dưới dạng card.
4. Người dùng chọn một podcast.
5. Hệ thống mở `Episode List` của podcast đó và lưu podcast vào `Podcast Library` nếu chưa có.
6. Người dùng chọn một episode muốn nghe hoặc tiếp tục episode đang nghe dở.
7. Hệ thống mở `Podcast Player`.
8. Hệ thống phát audio và tạo subtitle bằng STT nếu episode chưa có transcript.
9. `Transcript Panel` hiển thị từng câu theo thời gian thực.
10. Người dùng click một câu để seek đến đúng timestamp.
11. Người dùng click một từ để mở `Word Popup`.
12. Người dùng nghe lại đoạn khó, đổi tốc độ, loop câu, hoặc tạo flashcard/bookmark.
13. Nếu người dùng có link podcast kỹ thuật, `Import RSS` chỉ nằm trong phần nâng cao của Options Page, không phải luồng chính.

### 5.8.5 Chức năng trong từng màn

#### 5.8.5.1 Podcast Browser

- tìm podcast theo tên, host, hoặc keyword
- hiển thị card kết quả với ảnh bìa, tên, tác giả, mô tả ngắn, số episode
- mở trang chi tiết episode list
- lưu podcast vào library
- hiển thị lịch sử tìm gần đây
- xử lý empty state nếu không tìm thấy kết quả

#### 5.8.5.2 Podcast Library

- liệt kê podcast đã lưu
- đánh dấu podcast đang nghe dở
- mở lại episode gần nhất
- ghim podcast yêu thích
- xóa podcast khỏi thư viện
- hiển thị trạng thái download của từng podcast

#### 5.8.5.3 Episode List

- hiển thị danh sách episode theo podcast đã chọn
- sắp xếp theo ngày phát hành mới nhất hoặc cũ nhất
- hiển thị thời lượng, mô tả ngắn, trạng thái đã tải
- mở episode để phát
- tải episode về nghe offline
- đánh dấu episode đã nghe / chưa nghe

#### 5.8.5.4 Podcast Player

- phát / tạm dừng / tiếp tục
- tua nhanh, tua chậm, skip 10 giây
- đổi tốc độ phát
- điều khiển volume
- loop segment hoặc loop câu
- lưu progress và resume state
- bật / tắt subtitle sync
- reload subtitle khi STT chưa tốt

#### 5.8.5.5 Transcript Panel

- hiển thị danh sách câu subtitle theo timestamp
- highlight câu đang phát
- click câu để seek audio
- click từ để mở `Word Popup`
- lọc câu theo i+1 / known / tracking / learning
- tự động scroll theo câu đang phát
- hỗ trợ tìm trong transcript

---

## 5.9 Chu trình 5 - Đọc EPUB/PDF

### 5.9.1 Mục tiêu

Cho phép người dùng đọc sách số và biến sách thành nguồn học từ vựng.

### 5.9.2 Màn hình tham gia

- EPUB/PDF Reader
- Word Popup
- Orca Space sidebar → Reader shortcut
- TTS overlay / playback controls

### 5.9.3 Vị trí và cách màn hình xuất hiện

- `EPUB/PDF Reader` là tab riêng
- `Word Popup` mở trên từ được chọn trong sách

### 5.9.4 Thứ tự thao tác của người dùng

1. Người dùng mở reader.
2. Người dùng chọn file EPUB hoặc PDF.
3. Hệ thống parse nội dung.
4. Hệ thống dùng media engine, tts
5. Hệ thống highlight từ theo status.
6. Người dùng click từ.
7. Word Popup xuất hiện.
8. Người dùng tra nghĩa, nghe audio, thêm card.
9. Hệ thống lưu tiến độ đọc.

### 5.9.5 Chức năng trong Reader

- mở file
- lưu tiến độ
- highlight vocabulary
- per-book vocabulary list
- tạo flashcard
- bookmark đoạn

- phát / pause
- seek theo câu
- loop segment
- đổi tốc độ
- xem transcript đồng bộ thời gian

---

## 5.10 Chu trình 6 - Clipboard

### 5.10.1 Mục tiêu

Cho phép người dùng dán một đoạn text bất kỳ vào hệ thống và học nó như một nguồn media nhẹ.

### 5.10.2 Màn hình tham gia

- Orca Space sidebar → Clipboard shortcut → Clipboard tab (tab riêng)
- Word Popup
- TTS overlay / playback controls

### 5.10.3 Vị trí và cách màn hình xuất hiện

- `Clipboard` là tab riêng trong Orca Space (tab riêng)
- mở từ Toolbar Popup (shortcut button) hoặc Orca Space sidebar
- khi mở từ Toolbar Popup → focus tab nếu đã mở, mở mới nếu chưa có

### 5.10.4 Thứ tự thao tác của người dùng

1. Người dùng mở Clipboard tab.
2. Người dùng paste text hoặc bật auto-detect clipboard.
3. Hệ thống tách câu và tokenize nội dung.
4. TTS đọc nội dung.
5. Người dùng điều hướng câu bằng shortcut.
6. Người dùng click từ trong text.
7. Word Popup mở ra.
8. Người dùng tạo flashcard hoặc lưu session.

### 5.10.5 Chức năng trong Clipboard

- tạo session mới
- đặt tên session
- paste text thủ công
- auto-detect khi copy
- phát TTS
- lặp câu / lặp đoạn
- click-to-lookup
- lưu session để xem lại

---

## 5.11 Chu trình 7 - Tạo flashcard

### 5.11.1 Mục tiêu

Từ một từ/câu/media context, tạo ra card hoàn chỉnh với ít thao tác nhất.

### 5.11.2 Màn hình tham gia

- Word Popup (điểm bắt đầu)
- Orca Space - Dictionary tab → Card Creator panel (30% bên phải)
- Ocean Memory SRS tab (đích lưu option 1)
- Anki Desktop via AnkiConnect (đích lưu option 2)

### 5.11.3 Vị trí và cách màn hình xuất hiện

- **Card Creator Panel** nằm ở 30% bên phải của Orca Space Dictionary tab (split view 70/30)
- Mở bằng cách click "Send to Creator" trong Word Popup → Dictionary tab focus, Card Creator panel auto-fill
- **Quick Add** từ Word Popup → không mở Card Creator, lưu trực tiếp vào pre-configured destination
- Settings button trong Card Creator header → cấu hình deck/destination cho Quick Add
- **Flashcard Manager** nằm trong Ocean Memory tab (floating tab bar: [Review] [Manage])

### 5.11.4 Thứ tự thao tác của người dùng

**Luồng A — Quick Add (1 click):**
1. Người dùng click `Quick Add` trong Word Popup.
2. Hệ thống kiểm tra pre-configured destination.
   - Nếu đã cấu hình → lưu ngay (toast confirm).
   - Nếu chưa cấu hình → toast/banner dẫn đến Dictionary tab → Card Creator → Settings button.
3. Card được tạo với auto-fill đầy đủ.

**Luồng B — Send to Creator (chỉnh sửa đầy đủ):**
1. Người dùng click `Send to Creator` trong Word Popup.
2. Hệ thống mở/focus Orca Space Dictionary tab.
3. Card Creator panel (30% bên phải) tự điền:
   - target word, sentence, definition, translation
   - sentence audio (cắt từ media nếu có), word audio (Forvo/TTS)
   - image (Google Images), example sentences, notes
4. Người dùng chỉnh sửa field nếu cần.
5. Người dùng chọn card type (Sentence/Audio/Audio Sentence/Word).
6. Người dùng chọn deck.
7. Người dùng click `Create Card`.
8. Hệ thống lưu card:
   - Nếu destination là Ocean Memory → card vào FSRS queue.
   - Nếu destination là Anki → sync qua AnkiConnect.

### 5.11.5 Chức năng trong Flashcard Creator

- auto-fill field
- chọn ảnh
- chọn audio
- chọn sentence audio
- chọn source media
- chọn tags
- chọn deck
- chọn card type
- chỉnh từng field
- preview card
- save / cancel

### 5.11.6 Chu trình phụ của flashcard

- `Quick Add`: lưu nhanh không cần chỉnh nhiều
- `Customize`: chỉnh tay trước khi lưu
- `Bulk Create`: tạo nhiều card từ transcript
- `Bookmark to Card`: tạo card từ bookmark đã lưu

---

## 5.12 Chu trình 8 - Ocean Memory SRS

### 5.12.1 Mục tiêu

Cho người dùng ôn tập theo FSRS ngay trong extension.

### 5.12.2 Màn hình tham gia

- Ocean Memory tab (tab riêng) — truy cập qua Toolbar Popup shortcut hoặc Orca Space sidebar
- Floating tab bar phía dưới: [Review] [Manage]
- Vocabulary Manager (Orca Space tab chung, sidebar item riêng)

### 5.12.3 Vị trí và cách màn hình xuất hiện

- `Ocean Memory` là tab riêng — mỗi lần click shortcut đều focus vào tab đã có (không mở thêm)
- `Floating tab bar` phía dưới (thanh dài bằng số items): [Review] [Manage]
  - **Review mode:** ôn tập FSRS
  - **Manage mode:** Flashcard Manager (browse, edit, delete, deck)
- có thể mở bằng:
  - New Tab Override (mở tab mới trong browser)
  - Shortcut button trong Toolbar Popup Home
  - Orca Space sidebar item Memory

### 5.12.4 Thứ tự thao tác của người dùng

1. Người dùng mở Memory tab hoặc tab mới.
2. Hệ thống load danh sách card due.
3. người dùng nhấn vào deck có card due
4. Card đầu tiên xuất hiện.
5. Người dùng lật card.
6. Người dùng chấm Again / Hard / Good / Easy.
7. Hệ thống tính FSRS và lưu review log.
8. Hệ thống cập nhật vocabulary status nếu đạt ngưỡng.
9. Hệ thống đưa card tiếp theo.
10. Khi hết queue, hệ thống hiện summary.

### 5.12.5 Chức năng trong Ocean Memory

- bắt đầu session
- filtered review
- undo rating
- edit card trong session
- daily goals
- daily limits
- post-review summary
- xem danh sách đã ôn hôm nay
- quay về dashboard hoặc tiếp tục review

---

## 5.13 Chu trình 9 - Quản lý deck, card, vocabulary, bookmark

### 5.13.1 Mục tiêu

Cho người dùng chỉnh cấu trúc dữ liệu học tập khi cần.

### 5.13.2 Màn hình tham gia

- Ocean Memory tab → Manage mode (Flashcard Manager + Deck Manager)
- Orca Space - Vocabulary Manager (tab chung, sidebar item)
- Orca Space - Bookmark Manager (tab chung, sidebar item)
- Options Page (Account, Appearance, Profile, Pricing)

### 5.13.3 Người dùng làm gì

#### Flashcard Manager

- tìm card
- lọc card
- sửa card
- xóa card
- bulk actions

#### Vocabulary Manager

- đổi status từ
- bulk action cho nhiều từ
- import word list
- xem lịch sử status

#### Deck Manager

- tạo deck
- tạo sub-deck
- sửa deck
- merge deck
- split deck
- reset progress

#### Bookmark Manager

- xem bookmark
- lọc theo tag
- sửa nội dung bookmark
- xóa bookmark
- chuyển bookmark thành card

### 5.13.4 Vị trí thao tác

- **Flashcard Manager + Deck Manager:** nằm trong Ocean Memory tab → Manage mode (floating tab bar)
- **Vocabulary Manager:** Orca Space tab chung, sidebar item riêng
- **Bookmark Manager:** Orca Space tab chung, sidebar item riêng
- các màn này là màn quản trị, không phải màn dùng hàng phút như popup

---

## 5.14 Chu trình 10 - Anki Integration

### 5.14.1 Mục tiêu

Đồng bộ Orca với Anki khi người dùng muốn mang dữ liệu sang hệ sinh thái Anki hoặc lấy dữ liệu ngược về Orca.

### 5.14.2 Màn hình tham gia

- Options Page - Anki Integration
- Sync Log
- Flashcard Creator

### 5.14.3 Thứ tự thao tác của người dùng

1. Người dùng mở Options Page.
2. Người dùng vào mục Anki Integration.
3. Hệ thống kiểm tra AnkiConnect có chạy không.
4. Nếu Anki mở, người dùng thấy trạng thái kết nối.
5. Người dùng chọn deck mapping.
6. Người dùng chọn field mapping.
7. Người dùng export card sang Anki hoặc import ngược về Orca.
8. Người dùng xem sync log nếu có lỗi hoặc trùng note.
9. Nếu bật auto sync, hệ thống tự đồng bộ khi có thay đổi.

### 5.14.4 Chức năng trong Anki Integration

- kiểm tra kết nối
- cài AnkiConnect nếu cần
- export card
- import card
- sync 2 chiều
- mapping deck
- mapping field
- sync log
- xử lý duplicate
- đồng bộ media đi kèm

---

## 5.15 Chu trình 11 - Stats & Progress

### 5.15.1 Mục tiêu

Cho người dùng nhìn thấy tiến bộ và biết nên học tiếp gì.

### 5.15.2 Màn hình tham gia

- Toolbar Popup - Home
- Orca Space - Home (Statistics / Heatmap)
- Ocean Memory tab

### 5.15.3 Thứ tự thao tác của người dùng

1. Người dùng mở Home tab.
2. Người dùng xem thống kê nhanh trong popup.
3. Người dùng muốn xem sâu hơn thì mở Web App Dashboard.
4. Người dùng xem heatmap, review forecast, vocabulary coverage, difficult words.
5. Người dùng từ dashboard quay lại Ocean Memory hoặc filtered review.

### 5.15.4 Chức năng trong Stats

- basic stats
- advanced charts
- review forecast
- activity history
- daily digest
- per-source vocab
- level progress
- difficult words
- daily achievement notification

---

## 5.16 Chu trình 12 - Settings & Permissions

### 5.16.1 Mục tiêu

Cho người dùng kiểm soát toàn bộ hành vi của extension.

### 5.16.2 Màn hình tham gia

- Toolbar Popup - Settings
- Options Page - Settings
- Options Page - Account
- Options Page - Dictionary
- Options Page - Language Profiles
- Options Page - Blacklist
- Permission dialogs của trình duyệt

### 5.16.3 Người dùng làm gì trong Settings

- đổi keyboard shortcut
- đổi theme
- đổi màu highlight
- đổi UI language
- đổi native language
- đổi engine TTS
- đổi AI mode
- chọn model AI local theo RAM hoặc để Auto
- đổi prompt AI
- bật/tắt reminder
- thêm/xóa blacklist
- bật/tắt new tab override
- bật/tắt auto-pause
- cấp quyền trang web

### 5.16.4 Quy tắc thao tác

- thay đổi setting có hiệu lực ngay nếu hệ thống hỗ trợ
- shortcut conflict phải báo rõ
- permission phải có lý do trước khi xin
- blacklist phải chặn inject content script ngay lập tức

---

## 5.17 Chu trình phụ quan trọng

### 5.17.1 Chuyển language profile

1. Người dùng mở Toolbar Popup - Home hoặc Options Page - Language Profiles.
2. Người dùng chọn profile ngôn ngữ khác.
3. Hệ thống tải dictionary, frequency list, vocabulary status tương ứng.
4. Tất cả highlight, lookup, stats và card destination đổi theo profile mới.
5. Nếu người dùng mở Word Popup và gọi AI local, hệ thống nạp model theo profile hiện tại mà không cần restart.

### 5.17.2 Thêm hoặc ẩn từ điển

1. Người dùng vào Options Page - Dictionary.
2. Người dùng thêm từ điển mới hoặc ẩn từ điển đang có.
3. Hệ thống cập nhật lookup result ngay.
4. Word Popup và highlight phản ánh source mới.

### 5.17.3 Đổi trạng thái từ vựng

1. Người dùng click badge trạng thái trong Word Popup hoặc Vocabulary Manager.
2. Hệ thống đổi trạng thái từ.
3. Màu underline trên web đổi ngay.
4. Nếu từ đó đang nằm trong card review, hệ thống giữ đồng bộ với SRS.

### 5.17.4 Bookmark rồi chuyển thành card

1. Người dùng bookmark đoạn văn hoặc subtitle.
2. Bookmark lưu trong Bookmark Manager.
3. Khi cần, người dùng chuyển bookmark thành flashcard.
4. Hệ thống mở Flashcard Creator với dữ liệu đã có sẵn.

### 5.17.5 Xem xong rồi quay lại review

1. Người dùng đang đọc web hoặc xem video.
2. Người dùng tạo card hoặc bookmark.
3. Hệ thống lưu tiến độ.
4. Người dùng mở Ocean Memory từ Memory tab hoặc New Tab.
5. Người dùng ôn lại card vừa tạo.

---

## 5.18 Chuỗi thao tác mẫu từ đầu đến cuối

### 5.18.1 Chuỗi chuẩn 1: Từ web đến SRS

1. Mở web page.
2. Hệ thống highlight từ.
3. Click từ.
4. Mở Word Popup.
5. Nghe audio, xem nghĩa.
6. Nhấn Add to flashcard.
7. Lưu card vào Ocean Memory hoặc Anki.
8. Vào Ocean Memory review.
9. Chấm card.
10. Vocab status đổi.
11. Thống kê cập nhật.

### 5.18.2 Chuỗi chuẩn 2: Từ video đến flashcard

1. Mở video.
2. Bật subtitle overlay.
3. Click câu khó.
4. Mở Word Popup.
5. Chọn tạo card.
6. Tạo card từ sentence audio + context.
7. Review sau này trong Ocean Memory.

### 5.18.3 Chuỗi chuẩn 3: Từ podcast đến review

1. Mở Podcast Browser hoặc Podcast Library.
2. Chọn podcast.
3. Mở Episode List.
4. Chọn episode.
5. Nghe trong Podcast Player với Transcript Panel đồng bộ.
6. Click từ/câu.
7. Tạo card hoặc bookmark.
8. Vào Memory review.

### 5.18.4 Chuỗi chuẩn 4: Từ clipboard đến học

1. Mở Clipboard tab.
2. Dán text.
3. Hệ thống tách câu.
4. Click câu.
5. Nghe TTS.
6. Tạo card.
7. Review sau đó.

---

## 5.19 Kết luận vận hành

Nếu nhìn theo vòng thao tác thực tế, Orca không phải là tập hợp màn hình rời rạc. Nó là một vòng lặp:

1. tiếp nhận nội dung
2. phân tích nội dung
3. tra cứu
4. tạo thẻ
5. ôn tập
6. cập nhật trạng thái từ
7. xem thống kê
8. quay lại nội dung mới

Điểm mạnh của hệ thống là người dùng có thể bắt đầu từ bất kỳ điểm nào:

- đang đọc web thì vào card
- đang xem video thì vào card
- đang nghe podcast thì vào card
- đang dán clipboard thì vào card
- đang review thì quay về nội dung gốc

Nhưng cuối cùng mọi đường đi đều gặp lại một điểm:

- `Word Popup` để tra cứu
- `Flashcard Creator` để tạo thẻ
- `Ocean Memory` để review
- `Stats` để phản hồi tiến bộ
- `Settings` để điều chỉnh hành vi hệ thống
