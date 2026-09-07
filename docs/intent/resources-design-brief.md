# Resources Panel — Design Brief (v3)

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

> Tái thiết kế panel **Resources** (Từ điển + Độ phổ biến) trong Settings.
> Nguồn: screenshot `chrome_zdjlw99v9f.png` + `ResourcesPanel.tsx` + `ResourceCard.tsx`.
> Quy tắc: audit function → map user journey → IA → UX/UI, không phụ thuộc component sẵn có, 3 visual archetypes hoàn toàn khác nhau.
> Không dùng Liquid Glass.

---

## 0. Design Read

> *Quản lý kho từ điển và danh sách tần suất như một kệ sách cá nhân — dễ thêm, dễ sắp, dễ tắt, không sợ xóa nhầm.*

---

## 1. Function Audit

| # | Function | Class | Why |
|---|---|---|---|
| 1 | Liệt kê tài nguyên hiện có (từ điển, frequency) | `must-have` | User cần biết gì đang bật, thứ tự ưu tiên. |
| 2 | Import từ file (drag/drop hoặc click) | `must-have` | Chức năng chính của panel. |
| 3 | Hiển thị tiến trình import | `must-have` | Feedback cho file lớn. |
| 4 | Thông báo import thành công | `must-have` | Xác nhận hành động. |
| 5 | Thông báo lỗi import / tải danh sách | `must-have` | User cần biết khi nào cần xử lý. |
| 6 | Xử lý duplicate (thay thế / bỏ qua) | `must-have` | Tránh ghi đè tài nguyên hiện có. |
| 7 | Bật / tắt tài nguyên | `must-have` | Điều khiển tài nguyên đang dùng. |
| 8 | Sắp xếp ưu tiên (lên / xuống) | `must-have` | Thứ tự tra từ theo tầm quan trọng. |
| 9 | Xóa từng tài nguyên | `must-have` | Dọn dẹp. |
| 10 | Xóa toàn bộ tài nguyên trong section | `must-have` (rare) | Dọn section, cần confirm. |
| 11 | Mở rộng xem chi tiết tài nguyên (sample, test lookup, profile) | `must-have` | Kiểm tra và gán hồ sơ ngôn ngữ. |
| 12 | Điều chỉnh ngưỡng Độ phổ biến (4 bands) | `must-have` | Cấu hình phân loại từ. |
| 13 | Empty text tĩnh bên cạnh dropzone | `remove` | Trùng lặp CTA, làm màn hình dài thêm. |
| 14 | `Ưu tiên N` label | `nice-to-have` | Chỉ cần khi section > 1. |

**Primary job:** *Thêm, bật/tắt, sắp xếp và xóa từ điển / danh sách tần suất một cách an toàn, không sợ xóa nhầm.*

---

## 2. User Journey

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | **Mở Settings → Resources** | Nhấn tab Resources. | Panel hiển thị danh sách tài nguyên hoặc dropzone nếu rỗng. | Toàn panel. |
| 2 | **Thêm tài nguyên** | Kéo thả / chọn file. | Hiện progress, sau đó resource xuất hiện trong list. | Dropzone → list. |
| 3 | **Giải quyết trùng lặp (nếu có)** | Chọn "Thay thế" hoặc "Bỏ qua". | Import tiếp tục hoặc dừng lại. | Alert warning inline. |
| 4 | **Kiểm tra / điều chỉnh tài nguyên** | Toggle bật/tắt, nhấn mũi tên lên/xuống, mở rộng xem sample / test lookup / gán profile. | Trạng thái và thứ tự cập nhật. | Trong từng resource row/card. |
| 5 | **Điều chỉnh frequency bands** | Nhập 4 ngưỡng. | Giá trị lưu và ảnh hưởng phân loại. | Footer hoặc section Frequency. |
| 6 | **Xóa một hoặc toàn bộ** | Nhấn nút xóa / xóa tất cả. | Hiện confirm modal. Sau khi confirm, resource biến mất. | Nút xóa → modal. |
| 7 | **Rời panel** | Tắt Settings. | Mọi thay đổi đã tự động lưu. | — |

### Edge cases

- **List rỗng:** dropzone tích hợp CTA thay vì dòng empty tĩnh.
- **Lỗi tải danh sách:** alert inline, không in raw stack.
- **Lỗi import:** alert inline với file name, có thể dismiss.
- **Duplicate:** alert warning với 2 nút hành động.
- **Đang import nhiều file:** progress thay thế dropzone tạm thời.
- **Mobile hẹp:** 1 cột, touch target ≥ 44 px, frequency bands 2x2 hoặc cuộn ngang.

---

## 3. Anchor the idea

- **Mood keyword:** *tủ sách cá nhân* — mỗi resource là một quyển sách nhỏ, dễ xếp, dễ lấy, dễ tắt đèn.
- **Non-digital reference:** kệ sách gỗ bên hồ, hộp bento, bảng điều khiển máy cơ.
- **Cảm giác:** yên tĩnh, có trật tự, vui khi kéo thả thành công, kiểm soát khi xóa.
- **Primary job:** xem Function Audit.
- **Cheapest version:** một danh sách rõ ràng, nút Add nổi bật, trạng thái rõ ràng, không cần blur/glass.

---

## 4. Job & Dials

| Dial | Default | Lý do |
|---|---|---|
| `DESIGN_VARIANCE` | 6 | Bỏ glass, tái cấu trúc layout, giữ 2 section nhưng thay cách hiển thị. |
| `MOTION_INTENSITY` | 4 | Hover, press, import progress, collapse/expand — không quá náo. |
| `VISUAL_DENSITY` | 6 | List cần compact, nhưng dropzone và frequency bands cần không khí. |

### 3 style families

1. **A — Stillwater Shelf:** solid editorial, kệ sách, card mềm, tiêu đề lớn.
2. **B — Bento Garden:** dashboard bento, tile màu, grid 2 cột, compact.
3. **C — Stone Console:** command deck / sổ cái, dải lệnh, row kỹ thuật, strip bands ở dưới.

**Responsive behavior:**
- **320 px:** 1 cột, dropzone full-width, frequency bands 2x2 grid, touch target 44 px.
- **1280 px:** section có thể hiện side-by-side hoặc thả lỏng hơn, frequency bands 1 hàng 4 cột, thêm icon + nút Add rõ ràng.

---

## 5. Three Concepts

### Concept A — Stillwater Shelf (Editorial List)

- **IA mental model:** Một kệ sách — resource là các quyển sách xếp theo thứ tự, dễ thêm, dễ bật/tắt.
- **Visual archetype:** Solid editorial / nature journal.
- **Non-digital reference:** Tủ sách gỗ bên hồ lúc bình minh.
- **Material / surface:** solid surface nhẹ, `border-radius-2xl`, `shadow-sm`, màu accent xanh dương/nâu.
- **Typography treatment:** tiêu đề section lớn (`font-size-2xl`), meta nhỏ và nhạt, label pill.
- **Motion signature:** fade-in nhẹ, card nâng lên khi hover, dropzone sáng viền khi drag.
- **UX flow:** Header → 2 section dạng shelf → dropzone như khay → list resource dạng card → bands ở cuối như thước.
- **UI structure:**
  - Header: tiêu đề Resources + mô tả.
  - Section 1: Từ điển — heading lớn, dropzone dạng card, resource cards xếp chồng.
  - Section 2: Độ phổ biến — heading lớn, dropzone, resource cards, frequency bands strip ở dưới.
  - Mỗi resource card: expand chevron, tên, meta, ưu tiên, reorder, toggle, delete.
- **3 dials:** DESIGN_VARIANCE 5, MOTION_INTENSITY 3, VISUAL_DENSITY 4.
- **States:** default, hover, focus, active (toggle on, expanded), disabled (đang import), loading (progress), empty (CTA trong dropzone), error (inline alert), success (auto-dismiss), duplicate (alert với 2 nút), delete confirm.
- **Why it fits:** giảm thay đổi tối thiểu, dễ đọc, dễ ship, cảm giác yên bình.
- **Risk:** trên desktop có thể hơi trống nếu không có max-width.

### Concept B — Bento Garden (Dashboard Grid)

- **IA mental model:** Mỗi loại tài nguyên là một ô tile trong vườn bento; user tương tác trực tiếp với từng ô.
- **Visual archetype:** Dashboard bento tiles.
- **Non-digital reference:** Hộp bento với các ngăn màu sắc khác nhau.
- **Material / surface:** solid tile với `border-top` màu tint (xanh dương, cam/xanh lá), `border-radius-2xl`, `shadow-sm`.
- **Typography treatment:** heading tile `font-size-lg`, count nổi bật, label compact.
- **Motion signature:** tile nâng nhẹ khi hover, snap khi chọn, progress bar mở rộng từ trong tile.
- **UX flow:** Grid tile → tap Add trong tile → list xuất hiện trong tile → toggle/reorder/xóa trong tile → frequency bands ở tile Tuning.
- **UI structure:**
  - Top bar: tiêu đề + 2 quick-add pill buttons.
  - Grid 2 cột desktop, 1 cột mobile.
  - Tile Từ điển (xanh dương): icon, title, count, nút Add, list/empty CTA.
  - Tile Độ phổ biến (cam/xanh lá): icon, title, count, nút Add, list, frequency bands.
- **3 dials:** DESIGN_VARIANCE 7, MOTION_INTENSITY 5, VISUAL_DENSITY 7.
- **States:** default, hover (tile nâng), focus, active (tile đang chọn, toggle on), loading, empty (CTA trong tile), error (toast/banner), success.
- **Why it fits:** tạo cảm giác dashboard gọn gàng, phân biệt Dictionary/Frequency bằng màu, frequency bands là một tile riêng.
- **Risk:** trên mobile grid collapse thành 1 cột dài; cần đảm bảo touch target.

### Concept C — Stone Console (Command Deck)

- **IA mental model:** Một sổ cái / bảng điều khiển — có dải lệnh ở trên, danh sách tài nguyên dạng row, và dải chỉ số ở dưới.
- **Visual archetype:** Mechanical ledger / command deck.
- **Non-digital reference:** Bảng điều khiển máy cơ, sổ tay kỹ thuật.
- **Material / surface:** solid panel mạnh, viền rõ hơn, góc nhỏ hoặc không bo, nút lệnh dạng pill, trạng thái dạng chip.
- **Typography treatment:** heading nhỏ gọn, label uppercase tracking-wide, số liệu đậm.
- **Motion signature:** direct snap, row highlight khi hover, command bar slide nhẹ.
- **UX flow:** Command bar (Add + status) → table/row list tài nguyên → toggle/reorder/delete inline → tuning strip ở dưới.
- **UI structure:**
  - Header: tiêu đề Resources nhỏ gọn.
  - Command bar: 2 nút Add + chip status (n từ điển, n frequency).
  - Row list: mỗi resource là một dòng với icon, tên, count, toggle, delete; expand để xem detail.
  - Tuning strip: 4 input xếp ngang, rõ ràng.
- **3 dials:** DESIGN_VARIANCE 8, MOTION_INTENSITY 4, VISUAL_DENSITY 6.
- **States:** default, hover (row highlight), focus, active (selected, toggle on), loading, empty (illustrated CTA), error (inline banner), success.
- **Why it fits:** cảm giác kiểm soát, phù hợp user thích dụng cụ kỹ thuật, phân biệt rõ lệnh và nội dung.
- **Risk:** trên mobile row có thể chật; cần đảm bảo touch target và không để text bị cắt.

---

## 6. Responsive Behavior

| Viewport | Concept A | Concept B | Concept C |
|---|---|---|---|
| **320** | 1 cột, card full, bands 2x2 | 1 cột, tile stacked, bands 2x2 | 1 cột, command bar dọc, row stack, bands 2x2 |
| **768** | 1 cột rộng hơn, bands 1 hàng | 2 cột, tile lớn hơn | 1 cột, command bar ngang, bands 1 hàng |
| **1280** | max-width 720, card centered | 2 cột, header ngang | max-width 800, row rộng, command bar cố định |
| **1920** | max-width 800 | centered 960 | max-width 800 |

---

## 7. States (chung)

- **Default:** section có title, dropzone, list (hoặc empty CTA).
- **Hover:** card/tile/row nâng hoặc highlight, button đổi màu.
- **Focus:** focus-visible ring primary.
- **Pressed:** button scale 0.985.
- **Active / Selected:** resource bật (toggle on), tile đang chọn.
- **Disabled:** đang import, dropzone disabled.
- **Loading:** `ImportProgress` xuất hiện thay thế dropzone hoặc trong tile.
- **Empty:** CTA trong dropzone.
- **Error:** `Alert` error inline với icon và copy thân thiện.
- **Success:** `Alert` success tự động dismiss.
- **Duplicate:** `Alert` warning với 2 nút Thay thế / Bỏ qua.
- **Delete confirm:** modal.

---

## 8. Anti-patterns đã tránh

- Không dùng Liquid Glass, blur, backdrop-filter.
- Không để dropzone và empty text cùng lúc.
- Không dùng raw error stack.
- Không tạo `common.tsx` layout helper dùng chung cho 3 concept.
- Không để 3 concept trông giống nhau chỉ khác màu viền.
- Mobile-first: 320 px phải dùng được.

---

## 9. Mockup

`src/entrypoints/mockup-resources/` — Real panel + Concept A/B/C, có concept switcher, viewport switcher (mobile / desktop), theme switcher (light / dark).

---

## 10. Component Mapping (tạm, hoàn thiện sau khi chọn)

| UI element | Có thể reuse | Ghi chú |
|---|---|---|
| Section header | `Heading` + `Text` | Có sẵn. |
| Dropzone | `Dropzone` hoặc custom file input | Có thể cần extend style cho từng concept. |
| Resource card / row | `Card` + `Button` + `Toggle` + `Icon` | Cần custom composition theo concept. |
| Empty state | `EmptyState` hoặc inline CTA | Kiểm tra component có sẵn. |
| Alert banners | `Alert` | Dùng `variant`. |
| Import progress | `ImportProgress` | Có sẵn. |
| Frequency bands | `FrequencyBandsEditor` | Có sẵn, cần responsive layout mới. |
| Modal xóa | `DeleteConfirmModal` | Có sẵn. |
| Toggle bật/tắt | `Toggle` | Có sẵn. |
| Icons | `Icon` (hoặc `ICON_CATALOG`) | `bookOpen`, `library`, `slidersHorizontal`, `plus`, `trash`, `chevronDown`. |
