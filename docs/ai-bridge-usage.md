# AI Bridge — hướng dẫn sử dụng

AI Bridge đưa câu trả lời của ChatGPT, Gemini, DeepSeek, Claude vào dictionary popup. Extension dùng tab trình duyệt đã đăng nhập của Anh — không cần API key.

## 1. Chuẩn bị

Đăng nhập ít nhất một provider trong trình duyệt:

- ChatGPT — https://chatgpt.com/
- Gemini — https://gemini.google.com/app
- DeepSeek — https://chat.deepseek.com/
- Claude — https://claude.ai/new

Extension tự mở lại tab của provider khi cần hỏi. Giữ phiên đăng nhập còn hiệu lực.

## 2. Tab AI trong dictionary popup

Bôi đen một từ hoặc câu → popup hiện. Toolbar có 2 tab mới:

| Tab | Icon | Chức năng |
|---|---|---|
| AI | nguyên tử | Giải thích nuance của từ trong câu đang đọc |
| Breakdown | scan text | Tách câu thành cụm nhỏ + nghĩa + ghi chú ngữ pháp |

Mở tab → extension gửi prompt tới provider → câu trả lời hiện ngay khi provider viết xong.

### Chọn provider trong popup

Dưới câu trả lời là hàng pill tên provider. Bấm pill để đổi provider cho tab đó rồi hỏi lại.

### Failover

Provider đang hỏi mà lỗi (timeout, rate limit, chưa login, trang đổi cấu trúc) → extension tự chuyển sang provider kế tiếp theo thứ tự trong Settings. Panel hiện thông báo "đã chuyển từ X".

Tất cả provider đều lỗi → panel hiện lỗi cuối + nút **Retry**. Bấm Retry để hỏi lại.

### Regenerate

Không thích câu trả lời → bấm **Retry** để generate lại (có thể đổi provider trước để lấy văn phong khác).

## 3. Dictionary miss

Tra từ mà dictionary không có kết quả → tab AI tự mở và AI giải thích luôn.

- Tắt/bật: **Settings → AI → "Explain with AI when no dictionary match"**.
- Anh bấm tab khác trước khi settings load xong → lựa chọn của Anh thắng, tab AI không chen vào.

## 4. Dịch câu bằng AI

Tab **Translate** có chọn engine:

- **Google** — engine cũ, nhanh, giữ nguyên.
- **AI** — dịch qua provider, đúng ngữ cảnh hơn, chậm hơn vài giây.

Chọn AI → extension hỏi provider và đổ kết quả vào ô translation như thường. Engine mặc định chỉnh ở **Settings → AI → Sentence translation engine**.

## 5. AI answer vào thẻ Anki

Mỗi câu trả lời AI được gắn nhãn và append vào field **note** khi tạo thẻ:

```
AI Explain (ChatGPT):
<câu trả lời>

AI Breakdown (Gemini):
<câu trả lời>
```

- Áp dụng cho **Create** lẫn **Create all**.
- Note có sẵn text của Anh → AI block thêm xuống dưới, không xóa text.
- Hỏi lại cùng feature → block cũ được thay bằng câu trả lời mới, không nhân đôi.
- Answer về sau khi đã mở card creator → note tự cập nhật trong dialog đang mở.

## 6. Settings — mục AI

**Settings → AI** (icon nguyên tử, nằm giữa Dictionary popup và Word badge):

| Cài đặt | Tác dụng |
|---|---|
| Default provider | Provider được hỏi trước khi Anh không chọn riêng |
| Failover order | 4 hàng Select = thứ tự thử; lỗi thì nhảy xuống hàng dưới |
| Sentence translation engine | Google hoặc AI cho tab Translate |
| Auto-open on miss | Bật/tắt tự mở tab AI khi dictionary miss |
| Custom prompts | System + user prompt riêng cho từng feature |

### Chỉnh prompt

Mỗi feature (Word explain / Sentence breakdown / Sentence translate) có 2 ô: **System prompt** và **User prompt**. Sửa xong bấm **Save** — prompt lỗi không được lưu. **Reset to default** trả về prompt gốc.

### Placeholder

Prompt dùng biến cố định, điền tự động lúc hỏi:

| Placeholder | Nội dung điền |
|---|---|
| `[WORD]` | Từ đang tra |
| `[SENTENCE]` | Câu ngữ cảnh |
| `[TARGET_LANG]` | Ngôn ngữ đích |
| `[INTERFACE_LANG]` | Ngôn ngữ giao diện (English/Vietnamese) |

Gõ biến lạ (`[CONTEXT]` chẳng hạn) → báo lỗi đỏ và nút Save khóa. Viết prompt bằng English.

## 7. Đồng bộ Google Drive

Toàn bộ mục AI (provider, thứ tự, engine, prompts) nằm trong sync profile hiện có. Bật sync ở **Settings → Cloud backup** như các settings khác — không cần thao tác riêng.

## 8. Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Tất cả provider báo lỗi | Hết phiên login | Mở tab provider, đăng nhập lại, bấm Retry |
| Provider hay timeout | Rate limit | Đợi vài phút, hoặc đưa provider khác lên đầu Failover order |
| Answer trống/lạ | Provider đổi giao diện | Báo cho dev — adapter cần cập nhật selector |
| Tab provider tự mở | Extension cần tab để hỏi | Để nguyên; đóng tab thì lần hỏi sau mở lại |
| Answer chậm | Provider đang generate | Bình thường — panel có skeleton trong lúc chờ |

## 9. Giới hạn đã biết

- Cần ít nhất một provider đã login. Không login provider nào → mọi hỏi đều lỗi.
- Selector DOM của provider là nội bộ — provider đổi frontend thì adapter đó gãy cho tới khi cập nhật. Failover sang provider khác vẫn hoạt động.
- Automation gửi prompt qua giao diện web — nằm ngoài điều khoản cho phép của một số provider. Dùng với tần suất vừa phải.
