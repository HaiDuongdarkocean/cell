# Cell — Tokenize Controls: Business & User Journey

> Tạm lưu ý định nghiệp vụ cho redesign `aria-label="Tokenize controls"` trong `UniversalPanelHeader`.
> Dựa trên thảo luận với PM.

---

## 1. Môi trường tokenize

Người dùng có **2 môi trường** để tokenize trong cùng một trang media (ví dụ: YouTube):

| Môi trường | Nội dung tokenize | Use case |
|------------|-------------------|----------|
| **Media** | Phụ đề / subtitle của video | User chỉ muốn xem video, không quan tâm comment hay text ngoài lề. |
| **Text** | Text trên webpage: comment, mô tả, tiêu đề, v.v. | User muốn đọc comment hoặc các đoạn text khác trên trang. |

> **Không cần toggle Subtitle riêng** — media đã đại diện cho tokenize subtitle.

---

## 2. Quyết định thiết kế tối giản (mới)

**Mục tiêu:** Giảm thao tác, gọn UI, chỉ hiện khi cần.

- **Một toggle duy nhất `Tokenize`** ở header.
- Khi `Tokenize` **bật**, hiện thêm hai lựa chọn: **Media** và **Text** (có thể bật cả hai).
- `Status` và `Frequency` **bị ẩn theo mặc định**, mặc định là **bật**.
- Khi user bật/tắt một mode (Media hoặc Text), `Status` và `Frequency` của mode đó bật/tắt theo.
- Chỉ hiển thị `Status` / `Frequency` khi user mở **chế độ nâng cao / advanced**.
- **Nút advanced (3 chấm dọc `⋮`) nằm bên trong pill Tokenize**, cạnh `Media` và `Text`.
- Khi nhấn nút advanced, **popup hiện xuống theo chiều dọc** dưới pill, chứa `Status` / `Frequency` theo từng mode.
- Khi `Tokenize` tắt, `Media` / `Text` / `⋮` ẩn hoàn toàn; khi bật, chúng trượt vào pill với animation.

---

## 3. Quy tắc bật/tắt

- `Tokenize` master = on/off toàn bộ tính năng.
- Khi master **tắt**, `Media` và `Text` biến mất và tất cả tokenize dừng.
- `Media` và `Text` có thể active **cùng lúc**.
- `Status` / `Frequency` mặc định bật, đi kèm với mode tương ứng.
- Không có `Subtitle` toggle riêng.

---

## 4. User journey

### Journey 1: Xem video, tokenize phụ đề
1. User mở Universal Panel.
2. User bật **Tokenize**.
3. Hai lựa chọn **Media** / **Text** xuất hiện.
4. User bật **Media** (Text tắt hoặc bật tùy ý).
5. Hệ thống tokenize subtitle của video.

### Journey 2: Đọc comment / text trên trang
1. User muốn đọc comment hoặc mô tả.
2. User bật **Tokenize**.
3. User bật **Text**.
4. Hệ thống tokenize text trên webpage.

### Journey 3: Xem video + đọc comment song song
1. User bật **Tokenize**.
2. User bật **Media** và **Text** cùng lúc.
3. Hệ thống tokenize cả phụ đề và text trang.

### Journey 4: Tạm dừng tính năng
1. User tắt **Tokenize** master.
2. `Media` / `Text` ẩn đi, mọi tokenize dừng lại.

### Journey 5: Chỉnh Status / Frequency (advanced)
1. User click vào **nút 3 chấm dọc `⋮`** bên trong pill Tokenize.
2. UI hiện `Status` / `Frequency` cho từng mode.
3. User tùy chỉnh nếu cần.

---

## 5. Ràng buộc thiết kế

- **Layout phải nằm trên một hàng** — đây là thanh header của Universal Panel.
- **Bỏ Subtitle toggle** — media đã bao hàm subtitle.
- **Một toggle master `Tokenize`** — khi bật mới hiện Media / Text.
- **Media / Text có thể active cùng lúc** — dùng toggle/checkbox, không dùng radio.
- **Status / Frequency mặc định ẩn & bật** — chỉ hiện khi user mở advanced.
