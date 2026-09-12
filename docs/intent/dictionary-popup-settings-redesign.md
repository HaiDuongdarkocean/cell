# Dictionary Popup Settings — Redesign Brief

> Tối giản panel **Dictionary Popup** xuống 3 quyết định cốt lõi, chuyển các điều khiển kích thước/orbital sang **General**, và tối ưu IA dựa trên user journey + edge cases.

---

## 0. Context

- **Real panel hiện tại:** `src/features/settings/ui/DictionaryPopupSettingsPanel.tsx`
- **Settings shape:** `src/entities/settings/types.ts:200-224` (`DictionaryPopupSettings`)
- **Vị trí trong Settings dialog:** `SettingsDialogContent.tsx:538-554` (Card 7)
- **Visual reference:** `<user-home>\Documents\ShareX\Screenshots\2026-09\lEnnDiWPBY.png` — ghi chú: ảnh này là **Theme panel** (Light/Dark/System + Preset Dawn/Forest/Ocean/Warmth). Được dùng như tham chiếu cho ngôn ngữ hình học: card tròn, segmented button lớn, select mở rộng rõ ràng, bố cục đơn nhã.

---

## 1. Function audit

| Function | Current location | Proposed location | Why |
|---|---|---|---|
| Enable Dictionary Popup | Dictionary Popup card | **General → Features** | Master switch cấp ứng dụng; nếu tắt, 3 setting trong Dictionary Popup trở nên vô nghĩa. |
| Trigger mode | Dictionary Popup card | **Giữ lại** | Quyết định cốt lõi: user kích hoạt popup như thế nào. |
| Default active tab | Dictionary Popup card | **Giữ lại** | Quyết định cốt lõi: popup mở ra nội dung gì đầu tiên. |
| SRS destination | Dictionary Popup card | **Giữ lại** | Quyết định cốt lõi: Quick Add gửi từ vựng đi đâu. |
| Orbital pointer position | Dictionary Popup card | **Orbital card riêng** | Điều chỉnh hướng pointer (mũi tên) trên orbital badge, không phải vị trí badge trên từ. |
| Orbital badge size | Dictionary Popup card | **Orbital card riêng** | Điều chỉnh đường kính nút orbital. |
| Orbital pointer scale | Dictionary Popup card | **Orbital card riêng** | Điều chỉnh tỷ lệ pointer so với badge. |
| Popup width (px) | Dictionary Popup card | **General → Popup appearance** | Kích thước popup trên desktop. Cùng nhóm appearance. |
| Popup max height (px) | Dictionary Popup card | **General → Popup appearance** | Chiều cao tối đa popup. Cùng nhóm appearance. |

> **Net result:**
> - **Dictionary Popup** chỉ còn **Trigger mode · Default active tab · SRS destination**.
> - **General** giữ **Enable Dictionary Popup** + **Popup dimensions**.
> - **Orbital** tách thành card riêng với preview badge.

---

## 2. Primary job

> *"Choose how the dictionary popup is summoned, what it shows first, and where saved words go."*

---

## 3. User journeys

### Journey A — First-time learner (10–16 tuổi, dùng Netflix)

| # | Step | User action | System response | UI moment |
|---|---|---|---|---|
| 1 | Discover | Xem phụ đề, thấy từ lạ | Hiển thị orbital badge (nếu hover) hoặc chờ click | Không cần mở settings |
| 2 | Open popup | Click / hover vào từ | Popup hiện lên với tab mặc định | Tab mặc định phải rõ ràng |
| 3 | Consume | Xem định nghĩa, nghe audio, xem hình | Nội dung tab render | Tab switching mượt |
| 4 | Save | Bấm Quick Add | Gửi thẻ đến SRS destination đã chọn | Feedback rõ ràng |
| 5 | Return | Tiếp tục xem video | Popup đóng, focus trở lại video | Không cản trở |

**Edge case:** Trigger mode là `hover-ctrl` nhưng user quên giữ Ctrl → popup không mở, user nghĩ tính năng bị hỏng. Cần hint ngắn bên cạnh trigger mode.

### Journey B — Power user (20–30 tuổi, Anki)

| # | Step | User action | System response | UI moment |
|---|---|---|---|---|
| 1 | Setup | Mở Settings → Dictionary Popup | Thấy 3 option rõ ràng | Layout không quá tải |
| 2 | Tune trigger | Chọn `hover` hoặc `click` | Cập nhật ngay | Feedback trực tiếp |
| 3 | Tune default tab | Chọn `audio` (vì hay nghe phát âm) | Tab mặc định chuyển | Preview icon/tab name |
| 4 | Tune SRS | Chọn `anki` | Quick Add gửi đến AnkiConnect | Kiểm tra kết nối trong Card Creator |
| 5 | Resize | Sang General chỉnh orbital size / popup width | Orbital/phần mềm thay đổi kích thước | Live preview nếu có thể |

**Edge case:** User chọn SRS là `anki` nhưng AnkiConnect chưa cấu hình. Cần link sang Card Creator hoặc warning.

### Journey C — Tablet/Android user

| # | Step | User action | System response | UI moment |
|---|---|---|---|---|
| 1 | Tap word | Chạm vào từ trên subtitle | Popup mở dưới dạng bottom sheet | Sheet height phù hợp |
| 2 | Scroll | Cuộn xem các tab | Tab switch dễ dàng với touch | Touch target ≥ 44 px |
| 3 | Save | Chạm Quick Add | Thẻ gửi đến SRS | Button rõ, không nhầm |

**Edge case:** `hover` trigger không hoạt động trên mobile. Cần auto-fallback sang `click` hoặc disabled `hover` options khi user dùng Android.

### Journey D — Language switcher

| # | Step | User action | System response | UI moment |
|---|---|---|---|---|
| 1 | Học tiếng A | Mở popup, default tab là `image` | Popup mở tab image | Per-language override có thể cần UI sau này |
| 2 | Chuyển sang tiếng B | Đổi language profile | Default tab global vẫn giữ nguyên | User không bối rối vì global vs per-lang |

**Edge case:** `defaultActiveTabPerLang` tồn tại trong schema nhưng chưa có UI. Nếu user đổi global default, per-lang override cũ có thể ghi đè. Cần thông báo hoặc xóa override.

---

## 4. Edge cases

| Edge case | Gốc rễ | Ảnh hưởng layout/IA |
|---|---|---|
| **Hover trigger trên mobile** | `hover` / `hover-ctrl` không có ý nghĩa trên touch | Cần detect platform hoặc ẩn/disable hover modes trên Android; hoặc hiển thị hint. |
| **Default tab `null` = chỉ dictionary** | User không muốn auto-open tab | Option đầu tiên trong select phải là "Dictionary only" / "Không mở tab". |
| **SRS chưa cấu hình** | Chọn `anki` nhưng AnkiConnect lỗi | Hiển thị inline warning hoặc link sang Card Creator. |
| **Master switch tắt** | `enabled = false` | 3 setting bên dưới bị disabled hoặc ẩn; layout phải rõ ràng trạng thái off. |
| **Orbital badge quá to che chữ** | `badgePointerTrigger.size > ~60` | Cần preview/visual feedback trong General; không để user phải đoán. |
| **Popup width < subtitle font size** | `popupWidthPx = 320` trên màn hình lớn | Cần min/max validation và gợi ý default theo viewport. |
| **Per-language default tab cũ ghi đè global** | `defaultActiveTabPerLang` tồn tại trong schema | Khi user đổi global default, nên xóa override cũ (logic hiện tại đã làm) và thông báo nhẹ. |
| **Trigger + Default tab conflict** | `click` + `audio` là hợp lệ, nhưng `hover-ctrl` + `audio` có thể khó tiếp cận | Không cấm, nhưng có thể gợi ý "Nếu dùng hover, tab mặc định nên là dictionary để load nhanh." |

---

## 5. Three IA concepts

### Concept A — Three Clean Rows

- **IA mental model:** *Cài đặt là 3 câu hỏi liên tiếp: gọi ra sao? → mở gì? → lưu đâu?*
- **Visual archetype:** Editorial list — card trắng, 3 hàng `SettingsRow`, mỗi hàng có label + select bên phải.
- **Layout:**
  ```
  ┌─ Dictionary Popup ─────────────────────┐
  │  Open with             [Click ▼]       │
  │  Show first            [Audio ▼]       │
  │  Save words to         [Anki ▼]        │
  └────────────────────────────────────────┘
  ```
- **3 dials:** `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 5`
- **Why it fits:** Rõ ràng, dễ scan, khớp yêu cầu "chỉ 3 thứ".
- **Risk:** Quá đơn giản, không thể hiện mối quan hệ giữa 3 lựa chọn.

### Concept B — Mode Dial + Conditional Panel

- **IA mental model:** *Trigger mode là "chế độ" chi phối cả panel; sau khi chọn mode, các tùy chọn phù hợp mới hiện ra.*
- **Visual archetype:** Mechanical dial + adaptive panel — segmented button lớn cho trigger, sau đó default tab và SRS xuất hiện như 2 dòng.
- **Layout:**
  ```
  ┌─ Dictionary Popup ─────────────────────┐
  │  How do you open a word?              │
  │  [Click] [Hover] [Hover+Ctrl] ...     │
  │                                       │
  │  What do you see first?               │
  │  [Audio ▼]                            │
  │                                       │
  │  Where do saved words go?             │
  │  [Anki ▼]                             │
  └────────────────────────────────────────┘
  ```
- **3 dials:** `DESIGN_VARIANCE: 6`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 6`
- **Why it fits:** Nhấn mạnh trigger mode là quyết định đầu tiên; phù hợp cho learner chưa quen.
- **Risk:** Chiếm nhiều chiều dọc; segmented button 5 options có thể không vừa trên mobile.

### Concept C — Journey Timeline (family)

- **IA mental model:** *3 bước theo dòng thời gian khi gặp từ: kích hoạt → xem → lưu.*

#### C1 — Minimal timeline

- **Visual archetype:** Editorial list — 3 hàng, mỗi hàng có số tròn bên trái và select bên phải, không đường nối.
- **Layout:**
  ```
  ┌─ Dictionary Popup ─────────────────────┐
  │  ① Open a word        [Click ▼]       │
  │  ② Show first         [Audio ▼]       │
  │  ③ Save words to      [Anki  ▼]       │
  └────────────────────────────────────────┘
  ```
- **3 dials:** `DESIGN_VARIANCE: 5`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 5`
- **Why it fits:** Gọn nhất trong họ timeline; dễ scan, không tốn chiều cao.

#### C2 — Connected timeline (chosen)

- **Visual archetype:** Vertical timeline với đường nối các số, tạo cảm giác liên tục.
- **Control archetype:** Thay `Select` bằng **pill group** — mọi option hiển thị sẵn, user chọn 1 tap.
- **Layout:**
  ```
  ┌─ Dictionary Popup ─────────────────────┐
  │  ●  Open a word                        │
  │  │  [Click] [Hover] [Hover+Ctrl] …     │
  │  │                                     │
  │  ●  Show first                         │
  │  │  [Dictionary] [Audio] [Image] …     │
  │  │                                     │
  │  ●  Save words to                      │
  │     [Anki] [Ocean SRS]                 │
  └────────────────────────────────────────┘
  ```
- **3 dials:** `DESIGN_VARIANCE: 7`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 5`
- **Why it fits:** Làm rõ mối quan hệ thứ tự giữa 3 bước; pill group giảm thao tác so với dropdown select.

#### C3 — Step cards

- **Visual archetype:** Mỗi bước là một card nhỏ riêng, có số và label, select nằm trong card.
- **Layout:**
  ```
  ┌─ Dictionary Popup ─────────────────────┐
  │  ┌─ 1. Open a word ──┐ [Click ▼]     │
  │  └────────────────────┘               │
  │  ┌─ 2. Show first ───┐ [Audio ▼]      │
  │  └────────────────────┘               │
  │  ┌─ 3. Save words to ┐ [Anki  ▼]      │
  │  └────────────────────┘               │
  └────────────────────────────────────────┘
  ```
- **3 dials:** `DESIGN_VARIANCE: 8`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 6`
- **Why it fits:** Mỗi step có không gian riêng, cảm giác "đang hoàn thành từng bước".
- **Risk:** Chiếm nhiều chiều cao hơn C1/C2; có thể cảm thấy "quá nhiều" cho power user.

### Concept D — Smart Presets (1 thao tác)

- **IA mental model:** *User chọn 1 kịch bản học tập → hệ thống cấu hình cả 3 setting cùng lúc.*
- **Visual archetype:** Quick-setup card — 4 chip/tile ở đầu, 3 hàng setting ở dưới. Chip được chọn làm highlight; setting vẫn có thể fine-tune.
- **Layout:**
  ```
  ┌─ Dictionary Popup ─────────────────────┐
  │  Quick setup                          │
  │  [Watch & learn] [Translate first]    │
  │  [Speed look-up] [Power Anki]         │
  │                                       │
  │  Open with             [Click ▼]      │
  │  Show first            [Audio ▼]      │
  │  Save words to         [Anki ▼]       │
  └────────────────────────────────────────┘
  ```
- **Presets:**
  - **Watch & learn:** click → audio → Anki (xem phim, nghe phát âm, lưu Anki)
  - **Translate first:** click → translate → Ocean SRS (muốn hiểu nghĩa trước)
  - **Speed look-up:** hover → dictionary → Anki (lướt nhanh, chỉ tra)
  - **Power Anki:** hover-ctrl → pronunciation → Anki (kiểm soát, thêm chi tiết)
- **3 dials:** `DESIGN_VARIANCE: 7`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 6`
- **Why it fits:** Trả lời trực tiếp yêu cầu "chỉ cần 1 thao tác"; giảm quyết định xuống 1 lựa chọn ý nghĩa.
- **Risk:** Có thể bị hiểu lầc là preset không thể chỉnh; cần làm rõ fine-tune vẫn có thể.

---

## 6. Proposed settings structure

Tách thành **3 card** trong settings:

### 6.1 Card 0 — General

Vị trí: giữ nguyên `data-section="general"`.

| Setting | Control | Notes |
|---|---|---|
| UI language | `Select` | Giữ nguyên. |
| Enable Dictionary Popup | `Toggle` | Master switch. Khi tắt, Dictionary Popup + Orbital cards bị disabled/ẩn. |
| Auto select media | `Toggle` + `MultiSelect` conditional | Giữ nguyên. |

### 6.2 Card 0.5 — Popup appearance

Vị trí: card mới ngay sau General, có thể dùng `data-section="general"` (cùng section scroll) hoặc `data-section="appearance"`.

| Setting | Control | Notes |
|---|---|---|
| Popup width (px) | `Input type="number"` | Min 320, max 1200, default 560. Hint: "Width of the popup card on desktop." |
| Popup max height (px) | `Input type="number"` | Min 200, max 800, default 480. |
| Sheet height (vh) | `Slider` hoặc `Input` | Hiện đang là `popupSheetHeightVh: 72`. Dùng cho bottom sheet trên mobile. |

### 6.3 Card 0.6 — Word badge

Vị trí: card mới trong sidebar với `data-section="orbital"` hoặc `data-section="dictionaryOrbital"`.

> Tên card: **Word badge**. User không cần biết "orbital" là gì — đây là nút nổi có mũi tên chỉ hướng.
> **Quan trọng:** `badgePointerTrigger.position` là hướng của pointer (mũi tên) trên badge, **không phải** vị trí badge trên từ. Vị trí badge trên màn hình do user kéo thả hoặc default ở mép phải giữa.

**Layout đề xuất:**

```
┌─ Word badge ────────────────────────────────┐
│                                             │
│  Preview:                                   │
│  ┌──────────────────────────────────────┐   │
│  │            [pointer]                 │   │
│  │          ┌──────────┐                │   │
│  │          │    ★     │                │   │
│  │          └──────────┘                │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Pointer position      [Center    ▼]        │
│  Button size           [Slider]  36px       │
│  Pointer scale         [Slider]  25%        │
│                                             │
└─────────────────────────────────────────────┘
```

| Setting | Control | Notes |
|---|---|---|---|
| Pointer position | `Select` | Hướng mũi tên chỉ ra từ badge: up / down / left / right / centered. **Không phải** vị trí badge trên từ. |
| Button size (px) | `SliderRow` | Min 24, max 96, default 36. Đường kính badge. |
| Pointer scale | `SliderRow` | Min 0.1, max 0.6, step 0.05, default 0.25. Tỷ lệ đường kính pointer so với badge. |
| Preview badge | Custom preview component | Badge tròn + pointer nhỏ nằm ở rìa theo hướng đã chọn. Cập nhật real-time khi kéo size/scale/position. |

> **Tại sao tách Orbital thành card riêng?** Vì user cần thấy **preview trực quan** của cả badge + pointer. Nếu gom vào General, preview bị chìm trong danh sách dài. Card riêng cho phép đặt preview lớn, dễ hiểu, và người dùng không cần biết "orbital" là gì.

---

## 7. Component mapping

| UI element | Component | Decision |
|---|---|---|
| Card container | `Card` | Reuse |
| Section header | `Heading` + `Text` | Reuse |
| 3 setting rows in Dictionary Popup | `SettingsRow` | Reuse |
| Labels | `<label>` hoặc `Text` | Reuse |
| Trigger / Tab / SRS selects | `Select` | Reuse |
| Master toggle | `Toggle` | Reuse |
| Orbital size slider | `Slider` hoặc `SliderRow` | Reuse |
| Numeric inputs (popup size) | `Input` | Reuse |
| Orbital badge preview | Custom `OrbitalButtonPreview` | **Create** — render badge + pointer theo position/size/scale |

---

## 8. Design Read

> *Từ điển như một chiếc kính lúp nhỏ trên mặt nước — gọi lên, hiện ra đúng điều cần thấy, rồi biến mất không để lại gợn sóng.*

---

## 9. Next steps

1. ✅ **Concept C2 implemented in production** — connected timeline + pill group.
2. ✅ Tên card Orbital: **"Word badge"** — live preview + pointer position/size/scale.
3. ✅ Production layout:
   - General: master toggle + popup dimensions.
   - Dictionary Popup: 3-step timeline (open with → show first → save to).
   - Word badge: live preview, pointer position, button size, pointer scale.
4. ✅ i18n + tests updated.
