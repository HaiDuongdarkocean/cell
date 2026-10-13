# Intent: Queue Lazy Dictionary Lookup

## Elicitation method

Interview (one-question-at-a-time) + codebase observation.

## Confirmed 8-field frame

### 1. Problem
Khi nhấn **"Send to Card"** hoặc **"Quick Add"** từ subtitle overlay hoặc popup dictionary, hệ thống hiện tại phải tokenize dòng subtitle, lấy word status, rồi `Promise.all` lookup toàn bộ unknown/tracking words trong câu trước khi mở panel. Với khoảng 10 từ unknown, việc này gây delay lâu trong lúc UI chỉ hiển thị "recording".

### 2. User
Người dùng Tihoka đang xem video/web có subtitle, muốn chọn nhanh các từ cần học và đẩy vào Card Creator hoặc Anki.

### 3. Current workflow
1. Nhấn "Send to Card" hoặc "Quick Add" từ subtitle overlay / popup dictionary.
2. `tokenizeSubtitleWords` → `getWordStatuses` → `Promise.all` lookup từng từ.
3. Mở universal panel / dialog với queue đã có definitions sẵn.

### 4. Pain point
- Phải chờ lookup hàng loạt từ mới thấy UI.
- Không rõ hệ thống đang làm gì trong lúc "recording".
- Performance kém khi nhiều unknown words.

### 5. Evidence
- Ảnh chụp Queue `(1/10)` với 10 từ `unknown`.
- Code `buildSubtitleQueue` trong `src/features/subtitle/actions/cardActions.ts` đang `Promise.all` lookup toàn bộ `learnWords`.

### 6. Desired outcome
1. Nhấn **"Send to Card"** hoặc **"Quick Add"** từ subtitle overlay / popup dictionary → mở panel **ngay lập tức**, Queue chỉ hiển thị danh sách từ `unknown`/`tracking` (term + status), **chưa lookup**.
2. Click một từ trong Queue → **Dictionary** mới lookup từ đó.
3. Từ Dictionary, có 2 nút:
   - **"Send to Card"** (pencil icon) → đẩy lookup result sang **Card Creator form**.
   - **"Quick Add"** (zap icon) → auto-add từ đang xem vào **Anki**.
4. Áp dụng cho cả **subtitle overlay** và **popup dictionary**.
5. Tất cả phải chảy vào Dictionary rồi qua Card Creator.

### 7. Constraint
- Chrome MV3.
- Không thêm dependency nặng.
- Giữ nguyên design system, queue UI, media capture.
- Code tự giải thích, không comment.
- Không phá batch quick-update hiện tại.

### 8. Scope
- **In scope:**
  - Sửa `buildSubtitleQueue` để không lookup.
  - `sendToCard` và `quickAdd` từ subtitle overlay + popup dictionary đều mở Queue.
  - `selectQueueItem` trigger Dictionary lookup.
  - Nút "Send to Card" + "Quick Add" trong Dictionary đều đẩy kết quả đúng về Card Creator / Anki.
- **Out of scope:**
  - Batch quick-update toàn bộ unknown words trong một câu.
  - Thay đổi layout UI lớn.

## Interview log

- User: "kết quả hiện tại: chưa tokenize khi nhấn vào send to card button ở overlay panel subitle -> recording -> rất lâu sau thì mới hiển thị universal panel dicitonary. có thể nó đang phải load nhiều dữ liệu do có 10 chữ là unknown ... anh muốn cơ chế danh sách queue chỉ hiển thị. khi người dùng nhấn vào thì can sẽ được tìm ở tab dictionary. sau đó tính năng send to cardcreator sẽ kích hoạt và trả lại kết quả về card creator."
- Agent restated understanding.
- User: "hãy interview anh đi".
- Agent: quick-add scope question.
- User: "tôi làm send to cardctrator trước đã" (prioritize send-to-card-creator first).
- Agent: confirm send-to-card first, quick-add later.
- User: "đúng ạ".
- Agent: queue layout question.
- User: "thì nó là quêu hiện tại của card creator mà" (queue is the existing Card Creator queue).
- Agent: confirm flow.
- User: "đúng ạ nhưng lưu ý là nút subtitle overlay và ở poup dicitiony nha" (apply to both subtitle overlay and popup dictionary).
- Agent: quick-add scope question.
- User: "tương tự quick add cũng như vậy".
- User: "zoom out quick add cũng cùng cơ chế như thế tất cả phải chảy vào dictioanry rồi qua cardcreator".
- Agent: implement quick add now or later?
- User: "Implement luôn Quick Add".
- Agent: quick-add flow question.
- User: "Quick Add mở Queue, click từ, rồi Quick Add từ Dictionary".
- User: "tiếp tục" (explicit yes to proceed).
