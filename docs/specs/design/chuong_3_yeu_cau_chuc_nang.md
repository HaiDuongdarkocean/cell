# CHƯƠNG 3: CÁC YÊU CẦU CHỨC NĂNG

---

## 3.1 Biểu đồ lớp thực thể

### 3.1.1 Biểu đồ tổng quan (Core Entities)

```mermaid
classDiagram
    class User {
        +String id
        +String google_id
        +String email
        +String display_name
        +String avatar_url
        +String tier
        +DateTime created_at
        +DateTime updated_at
    }

    class LanguageProfile {
        +String id
        +String user_id
        +String language_code
        +String display_name
        +Boolean is_active
        +DateTime created_at
        +DateTime updated_at
    }

    class VocabularyEntry {
        +String id
        +String profile_id
        +String lemma
        +String reading
        +String status
        +Int frequency_rank
        +String pos
        +DateTime first_seen_at
        +DateTime updated_at
    }

    class Deck {
        +String id
        +String profile_id
        +String parent_deck_id
        +String name
        +String description
        +Int new_cards_limit
        +Int review_limit
        +JSON fsrs_params
        +DateTime created_at
        +DateTime updated_at
    }

    class Card {
        +String id
        +String deck_id
        +String vocab_id
        +String card_type
        +String tags
        +String source_url
        +String source_type
        +String state
        +DateTime due
        +Float stability
        +Float difficulty
        +Int elapsed_days
        +Int scheduled_days
        +Int reps
        +Int lapses
        +DateTime last_review
        +DateTime created_at
        +DateTime updated_at
    }

    class CardField {
        +String id
        +String card_id
        +String field_name
        +String field_value
        +String field_type
        +DateTime updated_at
    }

    class ReviewLog {
        +String id
        +String card_id
        +Int rating
        +String state_before
        +String state_after
        +Float stability_after
        +Float difficulty_after
        +Int scheduled_days
        +Int elapsed_days
        +DateTime reviewed_at
    }

    class MediaSource {
        +String id
        +String profile_id
        +String source_type
        +String title
        +String url
        +String file_path
        +String thumbnail_url
        +Int duration
        +Int progress
        +Float completion_pct
        +String cefr_estimate
        +Float known_word_pct
        +Int total_words
        +DateTime created_at
        +DateTime updated_at
    }

    class Subtitle {
        +String id
        +String source_id
        +String language_code
        +String format
        +Text content
        +DateTime cached_at
        +DateTime expires_at
    }

    class Bookmark {
        +String id
        +String profile_id
        +String source_id
        +String content
        +String context_before
        +String context_after
        +String source_url
        +String source_title
        +String tags
        +DateTime created_at
        +DateTime updated_at
    }

    class ClipboardSession {
        +String id
        +String profile_id
        +String name
        +DateTime created_at
        +DateTime updated_at
    }

    class ClipboardEntry {
        +String id
        +String session_id
        +String content
        +Int order_index
        +DateTime created_at
    }

    class ActivitySession {
        +String id
        +String profile_id
        +String source_id
        +String source_type
        +DateTime started_at
        +DateTime ended_at
        +Int active_seconds
        +Int words_encountered
        +Int cards_created
    }

    class Dictionary {
        +String id
        +String profile_id
        +String name
        +String language_code
        +String format
        +String version
        +Int entry_count
        +Boolean is_active
        +DateTime created_at
    }

    User "1" --> "1..*" LanguageProfile : has
    LanguageProfile "1" --> "0..*" VocabularyEntry : tracks
    LanguageProfile "1" --> "0..*" Deck : owns
    LanguageProfile "1" --> "0..*" MediaSource : uses
    LanguageProfile "1" --> "0..*" Bookmark : saves
    LanguageProfile "1" --> "0..*" ClipboardSession : creates
    LanguageProfile "1" --> "0..*" ActivitySession : records
    LanguageProfile "1" --> "0..*" Dictionary : manages
    Deck "0..1" --> "0..*" Deck : parent of
    Deck "1" --> "0..*" Card : contains
    Card "0..1" --> "1" VocabularyEntry : references
    Card "1" --> "0..*" CardField : has
    Card "1" --> "0..*" ReviewLog : logs
    MediaSource "1" --> "0..*" Subtitle : has
    ClipboardSession "1" --> "0..*" ClipboardEntry : contains
```

### 3.1.2 Mô tả từng lớp thực thể

| Tên lớp | Thuộc tính chính | Mô tả |
|---|---|---|
| **User** | id, google_id, email, tier | Tài khoản người dùng, xác thực qua Google OAuth. Tier xác định quyền truy cập (free/premium). |
| **LanguageProfile** | user_id, language_code, is_active | Hồ sơ học ngôn ngữ. Mỗi user có thể có nhiều profile cho các ngôn ngữ khác nhau. |
| **VocabularyEntry** | profile_id, lemma, status, frequency_rank | Từ vựng được theo dõi. Status: unknown → seen → learning → known → ignored. |
| **Deck** | profile_id, parent_deck_id, fsrs_params | Bộ thẻ flashcard. Hỗ trợ cấu trúc cây (deck con). Mỗi deck có cấu hình FSRS riêng. |
| **Card** | deck_id, vocab_id, state, due, stability | Thẻ flashcard. Lưu trạng thái FSRS (New/Learning/Review/Relearning) và ngày ôn tập tiếp theo. |
| **CardField** | card_id, field_name, field_value, field_type | Các trường nội dung của card (front, back, audio, image, sentence, v.v.). |
| **ReviewLog** | card_id, rating, state_before, state_after | Lịch sử mỗi lần ôn tập. Lưu rating (Again/Hard/Good/Easy) và thay đổi trạng thái FSRS. |
| **MediaSource** | profile_id, source_type, url, file_path | Nguồn media (YouTube, Netflix, podcast, file local). Lưu tiến độ xem và ước tính CEFR. |
| **Subtitle** | source_id, language_code, content, expires_at | Subtitle của media source. Cache 3 ngày, tự động expire. Hỗ trợ SRT/VTT/JSON. |
| **Bookmark** | profile_id, source_id, content, context | Đoạn văn/câu được đánh dấu từ trang web hoặc media. Lưu ngữ cảnh trước/sau. |
| **ClipboardSession** | profile_id, name | Phiên clipboard để gom nhóm các đoạn text copy từ nhiều nguồn. |
| **ClipboardEntry** | session_id, content, order_index | Một mục trong clipboard session. Có thứ tự để sắp xếp lại. |
| **ActivitySession** | profile_id, source_id, active_seconds | Phiên hoạt động học tập. Theo dõi thời gian thực tế, số từ gặp, số card tạo. |
| **Dictionary** | profile_id, name, language_code, format | Từ điển offline (StarDict/MDIC/JSON). Mỗi profile có thể có nhiều từ điển. |

---

## 3.2 Biểu đồ hoạt động

### 3.2.1 Biểu đồ hoạt động — Onboarding lần đầu (UC01.1)

```mermaid
flowchart TD
    Start([Bắt đầu]) --> A

    subgraph NĐ["👤 Người dùng"]
        A[Cài đặt Extension từ Chrome Web Store]
        B[Click icon Extension lần đầu]
        D[Chọn ngôn ngữ muốn học]
        F[Đăng nhập Google]
        H[Cấp quyền cho Extension]
        J[Xem hướng dẫn nhanh]
    end

    subgraph HT["⚙️ Hệ thống"]
        C{Đã có dữ liệu\nlocal?}
        E[Hiển thị màn hình\nchọn ngôn ngữ]
        G[Khởi tạo Google OAuth flow]
        I[Tạo User + LanguageProfile\ntrong SQLite]
        K[Tải từ điển mặc định\ncho ngôn ngữ đã chọn]
        L[Hiển thị Toolbar Popup — Home]
    end

    A --> B --> C
    C -- Chưa có --> E --> D --> F --> G --> H
    C -- Đã có --> L
    H --> I --> K --> J --> L

    L --> End([Kết thúc])
```

### 3.2.2 Biểu đồ hoạt động — Đọc trang web & Highlight từ vựng (UC03.1)

```mermaid
flowchart TD
    Start([Bắt đầu]) --> A

    subgraph NĐ["👤 Người dùng"]
        A[Mở trang web bất kỳ]
        E[Đọc nội dung trang]
        G[Click/Hover vào từ được highlight]
    end

    subgraph HT["⚙️ Hệ thống"]
        B{Extension\nđang bật?}
        C[Content Script inject\nvào trang]
        D[Tokenize text trong viewport\nqua IntersectionObserver]
        F[Highlight từ theo status:\n🔴 unknown · 🟡 seen · 🟢 known]
        H{Từ có trong\nVocabularyEntry?}
        I[Tra từ điển offline\nHiển thị Word Popup]
        J[Tạo VocabularyEntry mới\nstatus = seen]
        K[Cập nhật first_seen_at\nvà frequency_rank]
        L[Hiển thị Word Popup\nvới định nghĩa + ví dụ]
    end

    A --> B
    B -- Tắt --> End1([Không xử lý])
    B -- Bật --> C --> D --> F --> E --> G
    G --> H
    H -- Có --> I --> L
    H -- Chưa có --> J --> K --> I --> L

    L --> End([Kết thúc])
```

### 3.2.3 Biểu đồ hoạt động — Tạo Flashcard (UC09.2)

```mermaid
flowchart TD
    Start([Bắt đầu]) --> A

    subgraph NĐ["👤 Người dùng"]
        A[Click nút 'Tạo Card'\ntrong Word Popup]
        E[Chọn Deck đích]
        G[Chỉnh sửa nội dung card\nnếu cần]
        I[Xác nhận tạo card]
    end

    subgraph HT["⚙️ Hệ thống"]
        B[Lấy context câu\nxung quanh từ]
        C[Tra từ điển offline\nlấy định nghĩa + phiên âm]
        D{AI local\nkhả dụng?}
        F[Hiển thị form tạo card\nvới dữ liệu đã điền sẵn]
        H{Anki\nđang mở?}
        J[Lưu Card + CardFields\nvào SQLite]
        K[Cập nhật VocabularyEntry\nstatus = learning]
        L[Sync sang Anki\nqua AnkiConnect]
        M[Hiển thị thông báo\nTạo card thành công]
    end

    A --> B --> C --> D
    D -- Có --> F
    D -- Không --> F
    F --> E --> G --> I
    I --> J --> K --> H
    H -- Có --> L --> M
    H -- Không --> M

    M --> End([Kết thúc])
```

### 3.2.4 Biểu đồ hoạt động — Ôn tập SRS Ocean Memory (UC12.3)

```mermaid
flowchart TD
    Start([Bắt đầu]) --> A

    subgraph NĐ["👤 Người dùng"]
        A[Mở Ocean Memory\ntab mới]
        E[Xem mặt trước card]
        F[Lật card]
        G[Chọn rating:\nAgain / Hard / Good / Easy]
    end

    subgraph HT["⚙️ Hệ thống"]
        B[Tải danh sách card due\ntừ SQLite]
        C{Có card\ndue hôm nay?}
        D[Hiển thị card đầu tiên\ntheo thứ tự ưu tiên]
        H[Tính toán FSRS:\nstability, difficulty, due_date mới]
        I[Lưu ReviewLog\nvào SQLite]
        J[Cập nhật Card state\nvà due date]
        K{Còn card\ndue?}
        L[Cập nhật VocabularyEntry\nnếu interval đạt ngưỡng]
        M[Hiển thị màn hình\nHoàn thành phiên ôn tập]
        N[Cập nhật badge\ntrên Extension icon]
    end

    A --> B --> C
    C -- Không có --> M
    C -- Có --> D --> E --> F --> G
    G --> H --> I --> J --> L --> K
    K -- Còn --> D
    K -- Hết --> M --> N

    N --> End([Kết thúc])
```

### 3.2.5 Biểu đồ hoạt động — Xem video với subtitle (UC04.1 + UC04.6)

```mermaid
flowchart TD
    Start([Bắt đầu]) --> A

    subgraph NĐ["👤 Người dùng"]
        A[Mở video YouTube/Netflix\nhoặc file local]
        F[Xem video với subtitle]
        G[Click vào từ trong subtitle]
        J[Chọn hành động:\nTạo card / Bookmark / Bỏ qua]
    end

    subgraph HT["⚙️ Hệ thống"]
        B{Subtitle\nkhả dụng?}
        C[Lấy subtitle từ\nYouTube/Netflix API]
        D{Subtitle\ntìm thấy?}
        E[Chạy Whisper STT\ntrên audio track]
        H[Overlay subtitle lên video\nvới highlight từ vựng]
        I[Hiển thị Word Popup\nvới định nghĩa]
        K{Hành động\nđược chọn}
        L[Tạo Card với\ncâu subtitle làm context]
        M[Lưu Bookmark\nvới timestamp video]
        N[Cập nhật ActivitySession\nwords_encountered++]
    end

    A --> B
    B -- Có sẵn --> H
    B -- Chưa có --> C --> D
    D -- Tìm thấy --> H
    D -- Không có --> E --> H
    H --> F --> G --> I --> J
    K -- Tạo card --> L --> N
    K -- Bookmark --> M --> N
    K -- Bỏ qua --> N
    J --> K

    N --> End([Kết thúc])
```

### 3.2.6 Biểu đồ hoạt động — Sync Google Drive (UC15.1)

```mermaid
flowchart TD
    Start([Bắt đầu]) --> A

    subgraph HT["⚙️ Hệ thống — Service Worker"]
        A{Có kết nối\ninternet?}
        B[Kiểm tra sync_metadata\ntìm bản ghi thay đổi]
        C{Có thay đổi\ncần sync?}
        D[Xuất SQLite dump\nthành file .db]
        E[Upload lên Google Drive\nOrca/backup/ folder]
        F{Upload\nthành công?}
        G[Cập nhật sync_metadata\nupdated_at mới nhất]
        H[Kiểm tra Drive\ncó bản mới hơn local?]
        I{Drive mới\nhơn local?}
        J[Download file .db\ntừ Drive]
        K[Merge dữ liệu\ntheo last-write-wins]
        L[Ghi log lỗi\nthử lại sau 15 phút]
    end

    subgraph NĐ["👤 Người dùng"]
        M[Nhận thông báo\nSync hoàn tất]
    end

    A -- Không có mạng --> End1([Chờ kết nối])
    A -- Có mạng --> B --> C
    C -- Không có --> H
    C -- Có --> D --> E --> F
    F -- Thất bại --> L --> End2([Kết thúc với lỗi])
    F -- Thành công --> G --> H
    H --> I
    I -- Không --> M
    I -- Có --> J --> K --> M

    M --> End([Kết thúc])
```

---

## 3.3 Biểu đồ Swimlane

### 3.3.1 Swimlane — Quy trình tạo Flashcard từ Video

```mermaid
flowchart LR
    subgraph ND["👤 Người dùng"]
        ND1[Xem video]
        ND2[Click từ trong subtitle]
        ND3[Nhấn 'Tạo Card']
        ND4[Nhận thông báo thành công]
    end

    subgraph CS["📄 Content Script"]
        CS1[Lấy câu context\nxung quanh từ]
        CS2[Tra từ điển offline]
        CS3[Hiển thị Word Popup]
        CS4[Gửi message\nđến Service Worker]
        CS5[Hiển thị thông báo\nthành công]
    end

    subgraph SW["⚙️ Service Worker"]
        SW1[Nhận yêu cầu tạo card]
        SW2[Fetch audio từ Forvo]
        SW3[Fetch ảnh từ Google Images]
        SW4[Lưu Card + CardFields\nvào SQLite]
        SW5[Cập nhật VocabularyEntry\nstatus = learning]
    end

    subgraph EX["🌐 External Services\nForvo / Google Images"]
        EX1[Trả về file audio]
        EX2[Trả về danh sách ảnh]
    end

    ND1 --> ND2 --> CS1 --> CS2 --> CS3 --> ND3
    ND3 --> CS4 --> SW1 --> SW2 --> EX1 --> SW3 --> EX2 --> SW4 --> SW5 --> CS5 --> ND4
```

### 3.3.2 Swimlane — Quy trình Onboarding & Đăng nhập

```mermaid
flowchart LR
    subgraph ND["👤 Người dùng"]
        ND1[Cài extension\nmở lần đầu]
        ND2[Chọn ngôn ngữ]
        ND3[Nhấn 'Đăng nhập Google']
        ND4[Xem màn hình Home]
    end

    subgraph UI["🖥️ Extension UI"]
        UI1[Hiển thị màn hình\nchọn ngôn ngữ]
        UI2[Gọi chrome.identity\n.launchWebAuthFlow]
        UI3[Hiển thị Toolbar\nPopup Home]
    end

    subgraph SW["⚙️ Service Worker"]
        SW1[Download từ điển\nbackground]
        SW2[Lưu token\nTạo User record]
        SW3[Khởi tạo sync\nvới Google Drive]
    end

    subgraph GO["🔐 Google OAuth"]
        GO1[Xác thực người dùng]
        GO2[Trả về access token]
    end

    subgraph GD["☁️ Google Drive"]
        GD1[Tạo folder\nOrca/backup/]
    end

    ND1 --> UI1 --> ND2 --> SW1
    SW1 --> ND3 --> UI2 --> GO1 --> GO2 --> SW2 --> SW3 --> GD1 --> UI3 --> ND4
```

### 3.3.3 Swimlane — Quy trình Ôn tập SRS & Sync

```mermaid
flowchart LR
    subgraph ND["👤 Người dùng"]
        ND1[Mở tab mới\nOcean Memory]
        ND2[Lật card\nChọn rating]
        ND3[Xem card tiếp theo\nhoặc màn hình hoàn thành]
    end

    subgraph UI["🌊 Ocean Memory UI"]
        UI1[Query cards due\nhôm nay từ SQLite]
        UI2[Hiển thị card đầu tiên]
        UI3[Hiển thị card tiếp theo\nhoặc màn hình hoàn thành]
    end

    subgraph FSRS["🧮 FSRS Engine"]
        FSRS1[Tính toán stability\ndifficulty, due_date mới]
    end

    subgraph DB["🗄️ SQLite"]
        DB1[Trả về danh sách\ncards due]
        DB2[Lưu ReviewLog\nCập nhật Card]
        DB3[Kiểm tra ngưỡng\nCập nhật VocabularyEntry]
    end

    subgraph GD["☁️ Google Drive"]
        GD1[Nhận SQLite dump\nbackground sync]
    end

    ND1 --> UI1 --> DB1 --> UI2 --> ND2
    ND2 --> FSRS1 --> DB2 --> DB3 --> UI3 --> ND3
    DB2 -.->|background sync| GD1
```

---

## 3.4 Yêu cầu của hệ thống

### 3.4.1 Screen Flow

#### Luồng điều hướng tổng thể

```mermaid
flowchart TD
    Onboarding([🚀 Onboarding Page]) --> Popup

    subgraph Popup["🧩 Toolbar Popup"]
        Home[Home Tab]
        Dict[Dictionary Tab]
        Clip[Clipboard Tab]
        Media[Media Tab]
        Mem[Memory Tab]
        Sett[Settings Tab]
    end

    Home -->|Mở tab mới| Options
    Mem -->|Mở tab mới| OceanMemory([🌊 Ocean Memory SRS])
    Media -->|Mở tab mới| LocalMedia([🎬 Local Media Player])
    Media -->|Mở tab mới| PodcastBrowser([🎙️ Podcast Browser])
    Media -->|Mở tab mới| PodcastLibrary([📚 Podcast Library])
    PodcastBrowser --> PodcastLibrary
    PodcastBrowser --> EpisodeList([🗂️ Episode List])
    PodcastLibrary --> EpisodeList
    EpisodeList --> PodcastPlayer([▶ Podcast Player])
    PodcastPlayer --> TranscriptPanel([📝 Transcript Panel])
    Media -->|Mở tab mới| EPUB([📖 EPUB Reader])

    subgraph Options["⚙️ Options Page"]
        OA[Account]
        OL[Language Profiles]
        OD[Dictionary]
        OAnki[Anki Integration]
        OS[Settings]
        OB[Blacklist]
    end

    WordPopup([💬 Word Popup\nShadow DOM Overlay])
    WordPopup -->|Nhấn 'Tạo Card'| FlashcardCreator([✏️ Flashcard Creator])
    FlashcardCreator --> FlashcardManager([📋 Flashcard Manager])

    AnyScreen[ ] -.->|Từ bất kỳ đâu| WordPopup

    WebApp([🌐 Web App Dashboard\ntruy cập qua URL riêng])
```

#### Video Subtitle Flow

```mermaid
flowchart LR
    Web[Trang web có video] --> Badge[🔵 Floating Badge]
    Badge --> SubOverlay[📝 Subtitle Overlay]
    SubOverlay -->|Click từ| WordPopup[💬 Word Popup]
    WordPopup -->|Nhấn 'Tạo Card'| Creator[✏️ Flashcard Creator]
```

### 3.4.2 Screen Descriptions

| # | Màn hình | Mô tả | Kích thước | Điểm vào |
|---|---|---|---|---|
| 1 | **Onboarding Page** | Màn hình chào mừng khi cài extension lần đầu. Cho phép chọn ngôn ngữ học, theo dõi tiến trình download từ điển, và đăng nhập Google để bật sync. | Tab toàn màn hình | Tự động mở sau khi cài extension |
| 2 | **Toolbar Popup — Home** | Tab mặc định của popup. Hiển thị thống kê học tập hôm nay (cards due, streak, thời gian học), lịch sử tra từ gần đây, và các quick action (tra từ nhanh, mở Ocean Memory). | 380×520px | Click icon extension trên toolbar |
| 3 | **Toolbar Popup — Dictionary** | Tab tra từ thủ công. Người dùng nhập từ vào ô tìm kiếm, hệ thống trả về định nghĩa từ tất cả từ điển đang bật, kèm audio phát âm và ví dụ câu. | 380×520px | Tab Dictionary trong Toolbar Popup |
| 4 | **Toolbar Popup — Clipboard** | Tab quản lý clipboard. Cho phép paste đoạn văn bản, phát TTS, highlight từ vựng trong đoạn text, và lưu thành named session để xem lại sau. | 380×520px | Tab Clipboard trong Toolbar Popup |
| 5 | **Toolbar Popup — Media** | Tab danh sách nguồn media. Hiển thị lịch sử video/podcast/file đã xem, tiến độ xem, và ước tính CEFR. Cho phép mở lại hoặc xóa khỏi danh sách. | 380×520px | Tab Media trong Toolbar Popup |
| 6 | **Toolbar Popup — Memory** | Tab tổng quan SRS. Hiển thị số card due hôm nay, streak hiện tại, biểu đồ mini forecast 7 ngày, và nút "Bắt đầu ôn tập" mở Ocean Memory. | 380×520px | Tab Memory trong Toolbar Popup |
| 7 | **Toolbar Popup — Settings** | Tab cài đặt nhanh. Cho phép bật/tắt highlight, chọn ngôn ngữ active, điều chỉnh trigger mode (click/hover), và truy cập Options Page đầy đủ. | 380×520px | Tab Settings trong Toolbar Popup |
| 8 | **Word Popup (Shadow DOM)** | Overlay tra từ xuất hiện khi click/hover vào từ được highlight. Hiển thị định nghĩa đa từ điển, audio phát âm, pinyin (ZH), AI giải thích on-demand, phân tích câu, và nút tạo flashcard. Lần đầu mở tab AI sẽ tự tải model theo RAM và hiển thị progress nhỏ trong popup. Cô lập hoàn toàn khỏi CSS trang web qua Shadow DOM. | 360×480px (floating) | Click/hover từ highlight trên trang web hoặc subtitle |
| 9 | **Floating Badge** | Badge nhỏ cố định góc trên phải trang web. Hiển thị % từ đã biết trên trang, số từ chưa biết, và ước tính CEFR. Nhấn để mở Floating Bar chi tiết hơn. | 120×40px | Tự động xuất hiện khi content script kích hoạt |
| 10 | **Floating Bar (expandable)** | Thanh mở rộng từ Floating Badge. Hiển thị phân tích chi tiết trang: phân bố từ theo status, danh sách từ chưa biết, câu i+1 được phát hiện, và tùy chọn ẩn/hiện highlight. | Toàn chiều rộng × 200px | Nhấn vào Floating Badge |
| 11 | **Ocean Memory SRS** | Màn hình ôn tập flashcard chính. Hiển thị card theo thứ tự FSRS, cho phép lật card và chọn rating (Again/Hard/Good/Easy). Có thanh tiến độ, daily goal, và màn hình tổng kết sau khi hoàn thành. | Tab toàn màn hình | Tab Memory → nút "Ôn tập", hoặc từ Home tab |
| 12 | **Flashcard Manager** | Màn hình quản lý toàn bộ flashcard. Hỗ trợ tìm kiếm theo từ/câu, lọc theo deck/trạng thái/ngày tạo, xem trước card, chỉnh sửa nội dung, và bulk actions (xóa, chuyển deck). | Tab toàn màn hình | Options Page hoặc link từ Home tab |
| 13 | **Vocabulary Manager** | Màn hình quản lý từ vựng đang theo dõi. Hiển thị danh sách lemma với status, frequency rank, POS, ngày thêm. Hỗ trợ lọc, tìm kiếm, đổi status thủ công, bulk actions, và import word list. | Tab toàn màn hình | Options Page |
| 14 | **Bookmark Manager** | Màn hình quản lý đoạn văn đã bookmark. Hiển thị nội dung bookmark kèm ngữ cảnh, nguồn (URL/media), tags, và ngày lưu. Hỗ trợ tìm kiếm, lọc theo tag, và xóa bookmark. | Tab toàn màn hình | Options Page |
| 15 | **Options Page — Account** | Trang thông tin tài khoản. Hiển thị avatar, tên, email, tier hiện tại, và thống kê tổng quan (tổng từ đã học, tổng card, streak dài nhất). Có nút nâng cấp lên Premium và đăng xuất. | Tab toàn màn hình | Options Page → sidebar Account |
| 16 | **Options Page — Dictionary** | Trang quản lý từ điển. Hiển thị danh sách từ điển đã cài (tên, ngôn ngữ, số entries, phiên bản). Cho phép thêm từ điển auto-download, import file Yomichan, ẩn/hiện, xóa, và cập nhật phiên bản. | Tab toàn màn hình | Options Page → sidebar Dictionary |
| 17 | **Options Page — Settings** | Trang cài đặt nâng cao. Quản lý keyboard shortcuts, chọn theme (sáng/tối/hệ thống), cấu hình AI local (model, RAM tier, endpoint fallback), cài đặt trigger mode, và tùy chỉnh hiển thị Word Popup. | Tab toàn màn hình | Options Page → sidebar Settings |
| 18 | **Local Media Player** | Trình phát video/audio file local với subtitle overlay tích hợp. Hỗ trợ SRT/VTT, highlight từ vựng trong subtitle, click từ để tra cứu, điều chỉnh tốc độ phát, và lưu tiến độ xem. | Tab toàn màn hình | Toolbar Popup → Media tab → mở file local |
| 19 | **Podcast Browser** | Màn tìm kiếm podcast theo tên, host hoặc keyword. Hiển thị card kết quả, cho phép xem nhanh metadata, lưu vào thư viện, và mở sang episode list. | Tab toàn màn hình | Toolbar Popup → Media tab → mở podcast |
| 20 | **Podcast Library** | Màn danh sách podcast đã lưu. Cho phép mở lại podcast đang nghe dở, ghim podcast yêu thích, xóa khỏi thư viện, và đi tới episode list. | Tab toàn màn hình | Toolbar Popup → Media tab → Library |
| 21 | **Episode List** | Màn chi tiết của một podcast. Hiển thị danh sách episode, thời lượng, mô tả ngắn, trạng thái tải, và nút phát / tải offline. | Tab toàn màn hình | Từ Podcast Browser hoặc Podcast Library |
| 22 | **Podcast Player** | Màn phát episode. Cung cấp play/pause, seek, skip, speed, loop, volume, subtitle sync, và resume progress. | Tab toàn màn hình | Từ Episode List hoặc resume episode |
| 23 | **Transcript Panel** | Panel câu trong Podcast Player. Hiển thị từng câu theo timestamp, highlight câu đang phát, click câu để seek, click từ để mở Word Popup, và lọc câu theo trạng thái. | Trong Podcast Player | Từ Podcast Player |
| 24 | **Web App Dashboard** | Ứng dụng web riêng biệt (truy cập qua URL). Hiển thị thống kê học tập nâng cao: biểu đồ retention theo thời gian, heatmap hoạt động, phân tích vocabulary growth, forecast SRS, và lịch sử review chi tiết. | Trình duyệt web đầy đủ | Truy cập trực tiếp qua URL web app |

### 3.4.3 Screen Authorization

| Screen | Guest | Free User | Premium User |
|---|---|---|---|
| Toolbar Popup — Home | X | X | X |
| Toolbar Popup — Dictionary | X | X | X |
| Toolbar Popup — Clipboard | X | X | X |
| Toolbar Popup — Media | | X | X |
| Toolbar Popup — Memory | | X | X |
| Toolbar Popup — Settings | X | X | X |
| Onboarding Page | X | | |
| Ocean Memory SRS (New Tab) | | X | X |
| Flashcard Manager | | X | X |
| Vocabulary Manager | | X | X |
| Bookmark Manager | | X | X |
| Options Page — Account | X | X | X |
| Options Page — Dictionary | | X | X |
| Options Page — Language Profiles | | X | X |
| Options Page — Settings | X | X | X |
| Options Page — Anki Integration | | X | X |
| Options Page — Blacklist | X | X | X |
| Local Media Player | | X | X |
| EPUB/PDF Reader | | X | X |
| Podcast Browser | | X | X |
| Podcast Library | | X | X |
| Episode List | | X | X |
| Podcast Player | | X | X |
| Transcript Panel | | X | X |
| Clipboard Tab | X | X | X |
| Web App Dashboard | | X | X |
| Word Popup (Shadow DOM) | X (hover) | X (click+hover) | X |
| Floating Badge | X | X | X |
| Video Subtitle Overlay | X | X | X |

### 3.4.4 Các chức năng không có giao diện

| # | Feature | System Function | Description |
|---|---|---|---|
| 1 | Sync | Drive Sync | Tự động sync SQLite dump + media lên Google Drive khi có mạng |
| 2 | Anki Sync | AnkiConnect Sync | Tự động sync 2 chiều khi Anki đang mở |
| 3 | FSRS Scheduling | Schedule Cards | Tính toán ngày ôn tập tiếp theo sau mỗi review |
| 4 | STT | Whisper Transcribe | Transcribe audio thành subtitle (batch + chunked) |
| 5 | Tokenizer | Tokenize Page | Tách từ text trên trang web theo viewport (IntersectionObserver) |
| 6 | Badge Update | Update Badge | Cập nhật số card due trên extension icon |
| 7 | Notification | Daily Reminder | Gửi Chrome notification nhắc ôn tập theo giờ cố định |
| 8 | Achievement | Daily Achievement | Gửi notification tổng kết thành quả học trong ngày |
| 9 | i+1 Detection | Detect i+1 Sentences | Phát hiện câu chỉ có 1 từ chưa biết trong viewport |
| 10 | Vocab Auto-Update | Auto Status Update | Tự động chuyển trạng thái từ khi FSRS interval đạt ngưỡng |
| 11 | Dictionary Update Check | Check Dict Version | Kiểm tra phiên bản từ điển mới định kỳ |
| 12 | Subtitle Cache | Cache Subtitles | Cache subtitle Whisper 3 ngày, tự động expire |

---

## 3.5 Thiết kế Prototype

Chi tiết luồng thao tác và bản đồ màn hình tổng thể được mô tả đầy đủ ở `chuong_5_luong_thao_tac_toan_he.md`.
