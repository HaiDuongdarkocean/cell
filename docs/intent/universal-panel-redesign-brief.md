# Universal Panel — Mobile Redesign Brief

> Design read: Universal panel là side/bottom panel chứa Dictionary + Card Creator + Study modes + Settings. Trên mobile, nó phải phục vụ hai công việc chính — **tra từ** và **tạo thẻ** — mà không khiến người dùng lạc giữa hai luồng.

---

## 1. User Journey (chronological)

| # | Bước | Người dùng làm gì | Hệ thống hiển thị gì | Vị trí trong UI |
|---|------|--------------------|-----------------------|-----------------|
| 1 | **Mở panel** | Nhấn icon extension / chọn từ trên trang / nhấn phím tắt. | Panel trượt lên từ dưới (mobile) hoặc từ phải (desktop). | Toàn màn hình mobile. |
| 2 | **Xác định ngữ cảnh** | Nhìn profile ngôn ngữ và trạng thái tokenize. | Header: profile + tokenize `Text | Media` + close. | Top bar. |
| 3 | **Tìm/chọn từ** | Nhập từ vào ô search, hoặc từ đã được chọn từ trang. | Search + chip từ đang chọn + kết quả từ điển. | Ngay dưới header. |
| 4 | **Đọc nghĩa** | Đọc phát âm, định nghĩa, ví dụ, badges trạng thái. | Word header + pronunciation + audio/image/translate actions + definition list. | Khu vực Meaning. |
| 5 | **Quyết định** | Chọn: chỉ tra, thêm vào SRS, hoặc tạo thẻ. | Các nút hành động chính (`Make card`, `Quick add`, `Listen`). | Cuối phần Meaning hoặc bottom bar. |
| 6 | **Tạo thẻ (nếu chọn)** | Chọn Note type / Deck, kiểm tra fields, thêm media/queue. | Card Creator form với destination, fields, preview, save. | Màn hình/section Card. |
| 7 | **Xác nhận** | Nhấn Save / Quick add. | Toast / success + panel tự động đóng hoặc giữ nguyên. | Inline feedback. |

### Edge cases

- **Không có kết quả**: hiển thị empty state gợi ý nhập lại hoặc dịch.
- **Không có video**: nửa Media trong tokenize bị disable, có tooltip lý do.
- **Lỗi AnkiConnect**: thông báo lỗi xuất hiện trong Card Creator, có link đến Settings.
- **Queue > 1 item**: hiển thị queue sidebar hoặc chip số lượng.
- **Chuyển tab (Study/Settings)**: content thay đổi, bottom nav cập nhật active.

---

## 2. Audit hiện trạng

### [P0] Information Architecture — Dictionary bị ẩn trên mobile

**Current:** Mobile screenshot chỉ hiển thị Card Creator (search + chip + CARD CREATOR + CARD DESTINATION + preview). Không thấy kết quả từ điển.

**Question from taxonomy:** Người dùng có thể tạo thẻ mà không biết nghĩa đúng không?

**Standard:** Progressive disclosure + job sequencing — user phải xác nhận nghĩa trước khi quyết định tạo thẻ.

**Proposed:** Mobile phải có một bước/section Meaning rõ ràng trước Card Creator, hoặc tab chuyển đổi giữa Meaning ↔ Card.

**Risk:** Nếu chỉ sửa layout mà không sửa IA, user sẽ vẫn bỏ qua nghĩa.

**Verdict:** change

---

### [P1] Visual hierarchy — Quá nhiều vùng cạnh tranh

**Current:** Header (tokenize + search + chip) + Card Creator header + error banner + Card Destination + large preview + bottom nav. Không có nhóm rõ ràng.

**Question from taxonomy:** Mắt user đi đâu đầu tiên?

**Standard:** Proximity + common region: những gì liên quan phải ở gần và có cùng vùng.

**Proposed:** Gộp header công cụ; tách rõ vùng Meaning và vùng Card; preview đặt trong Card section.

**Risk:** Cần thêm không gian dọc, có thể cần scroll.

**Verdict:** change

---

### [P1] Navigation — Bottom nav icon-only không nhãn

**Current:** Bottom bar có 7 icon (flag, book, list, settings, chart, layers, play), không nhãn. Khó biết đâu là Dictionary, Study, Settings, Reader, SRS, Player.

**Question from taxonomy:** User có thể đoán đúng icon không?

**Standard:** Icon-only navigation cần extremely familiar icons; nếu không, phải có nhãn hoặc giảm số lựa chọn.

**Proposed:** Dùng bottom tab có nhãn + giảm xuống 4 mục chính (Dictionary, Study, Reader, Settings) và các công cụ còn lại vào overflow.

**Risk:** Mất một chút không gian ngang.

**Verdict:** change

---

### [P1] Card Creator — Form trông giống input nhưng thực ra là select

**Current:** `Note type` và `Deck` hiển thị như input trống, không có affordance của dropdown.

**Question from taxonomy:** User có biết cần chọn từ danh sách?

**Standard:** Select cần mũi tên hoặc caret; placeholder cần rõ ràng.

**Proposed:** Chuyển thành Select component với caret, label rõ, giá trị default.

**Risk:** Low.

**Verdict:** change

---

### [P1] Error banner — Quá nặng và không dismissible

**Current:** Banner lớn, viền đỏ trái, chiếm nhiều không gian, không có nút đóng.

**Question from taxonomy:** Lỗi có cần chặn toàn bộ màn hình không?

**Standard:** Inline error cần visible nhưng không chiếm focus vĩnh viễn; nên dismissible khi user đã đọc.

**Proposed:** Thu gọn thành alert bar có icon + text + link Settings + dismiss.

**Risk:** User có thể bỏ lỡ lỗi nếu dismiss quá dễ.

**Verdict:** change

---

### [P2] Tokenize header — Nhỏ và gần close

**Current:** Split pill `Text | Media` ở header, icon-only; close button cạnh bên. Touch target có thể < 44px trên mobile nhỏ.

**Question from taxonomy:** Có thể nhấn nhầm không?

**Standard:** Touch target tối thiểu 44px; controls quan trọng cần spacing.

**Proposed:** Tăng touch target, để tokenize gần search hơn là gần close, hoặc tích hợp vào search bar.

**Verdict:** change

---

### [P2] Color — Badges đỏ/xanh cạnh tranh

**Current:** `unknown` màu đỏ đậm, `wordfreq 1,234` màu xanh đậm, cùng luminance, cùng trọng số thị giác.

**Question from taxonomy:** Badge nào quan trọng hơn?

**Standard:** Neutral-first + one accent. Trạng thái mới nên dùng subtle tint.

**Proposed:** `unknown` → neutral/secondary tint; `wordfreq` → primary subtle; chỉ dùng red cho lỗi.

**Verdict:** change

---

## 3. Non-negotiables cho 3 bản mockup

1. Mobile-first, viewport 360–420px, touch target ≥ 44px.
2. Kết quả từ điển phải hiển thị rõ ràng trước khi tạo thẻ (hoặc chuyển đổi trong 1 tap).
3. Bottom navigation phải có nhãn hoặc thay bằng cấu trúc đơn giản hơn.
4. Chỉ một primary action tại một thời điểm.
5. Error state visible nhưng không dominate.
6. Giảm số cấp font xuống tối đa 3 tier trong panel.

---

## 4. Ba concept đề xuất

### Concept A — "Two-Step Sheet" (Conservative / Mobile-native)

- **IA mental model:** Meaning trước, Card sau. Giống bước 1 → bước 2.
- **UX flow:** Search → xem Meaning → nhấn `Make card` → form Card mở rộng ngay bên dưới.
- **UI structure:**
  - Header: tokenize pill + close.
  - Search + word chip.
  - Meaning card: word, pronunciation, badges, definition list, audio/image/translate/link/mic actions.
  - Primary `Make card` CTA.
  - Card Creator mở rộng inline: destination, fields, preview, save.
  - Bottom tab bar: Dictionary · Study · Reader · Settings (có nhãn).
- **Why it fits:** Tự nhiên nhất với hành trình tra-từ-rồi-tạo-thẻ. Dễ implement.
- **Risk:** Nếu Card Creator dài, user phải scroll nhiều.

### Concept B — "Snap Deck" (Experimental / Gesture-driven)

- **IA mental model:** Dictionary và Card là hai mặt của cùng một tấm thẻ. Lướt ngang để chuyển.
- **UX flow:** Search → panel ở dạng "half-sheet" hiển thị Meaning → kéo/lướt lên hoặc nhấn `Card` → full sheet với Card form.
- **UI structure:**
  - Floating search pill + tokenize trên nền tối.
  - Bottom sheet có drag handle, 2 snap points.
  - Horizontal pager: trang 1 Meaning, trang 2 Card.
  - Floating dock ở đáy: nút Dict lớn ở giữa, các công cụ khác xung quanh.
- **Why it fits:** Tận dụng khoảng trống, cảm giác "app-native", tối giản khi chưa tạo thẻ.
- **Risk:** Gestures khó discover; cần hint rõ ràng.

### Concept C — "One-Column Stream" (Minimal / Editorial)

- **IA mental model:** Tất cả nội dung nằm trong một luồng dọc duy nhất; segmented control chuyển nhanh giữa các khía cạnh.
- **UX flow:** Search → scroll qua Meaning → nhấn tab `Card` hoặc scroll tiếp đến form → điền và save.
- **UI structure:**
  - Top header: profile + tokenize + close.
  - Search + word chip.
  - Sticky segmented control: Meaning | Card | Queue | Settings.
  - Single scroll content. Section Meaning trước, Card kế tiếp khi chọn.
  - Fixed primary `Add to deck` ở bottom.
- **Why it fits:** Tối giản nhất, không có bottom nav lạc, phù hợp khi mobile hẹp.
- **Risk:** User có thể không nhận ra `Card` là một tab nếu segmented control không đủ nổi.

---

## 5. Output files

- Mockup: `src/entrypoints/design-system-showcase/mockups/universal-panel-redesign-concepts.html`
- Brief: `docs/intent/universal-panel-redesign-brief.md` (this file)

---

## 6. Next step

User chọn 1 trong 3 concept để em map vào component system (`src/shared/ui/*`) và tiến hành implement.
