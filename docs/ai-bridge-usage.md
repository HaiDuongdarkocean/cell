# AI Bridge — hướng dẫn sử dụng

AI Bridge đưa câu trả lời của ChatGPT, Gemini, DeepSeek, Claude vào dictionary popup. Extension dùng tab trình duyệt đã đăng nhập của Anh — không cần API key.

## 1. Chuẩn bị

Đăng nhập ít nhất một provider trong trình duyệt:

- ChatGPT — https://chatgpt.com/
- Gemini — https://gemini.google.com/app
- DeepSeek — https://chat.deepseek.com/
- Claude — https://claude.ai/new

Extension tự kiểm tra phiên đăng nhập ngầm (không mở tab). Khi cần hỏi, tab provider mở ở nền trong cửa sổ Anh đang dùng — không chiếm focus, Anh chỉ thấy kết quả trong popup. Tab chỉ được đưa lên trước khi provider bắt đăng nhập lại: lúc đó popup báo tên provider cần login và tab đăng nhập được kích hoạt.

## 2. Tab AI trong dictionary popup

Bôi đen một từ hoặc câu → popup hiện. Toolbar có 2 tab mới:

| Tab | Icon | Chức năng |
|---|---|---|
| AI | nguyên tử | Giải thích nuance của từ trong câu đang đọc |
| Breakdown | scan text | Tách câu thành cụm nhỏ + nghĩa + ghi chú ngữ pháp |

Mở tab → extension gửi prompt tới provider → câu trả lời hiện ngay khi provider viết xong.

### Chọn provider và ngôn ngữ trả lời trong popup

Trên đầu panel là nút "Sourced from {provider}" — bấm để mở menu: chọn provider khác (hỏi lại ngay), hoặc chọn ngôn ngữ câu trả lời: **Answer in {native}** / **Answer in {target}**. Nút **Retry** nằm cạnh, ngoài khung câu trả lời.

### Failover

Provider đang hỏi mà lỗi (timeout, rate limit, chưa login, trang đổi cấu trúc) → extension tự chuyển sang provider kế tiếp theo thứ tự trong Settings. Panel hiện thông báo "đã chuyển từ X".

Tất cả provider đều lỗi → panel hiện lỗi cuối + nút **Retry**. Bấm Retry để hỏi lại.

Nếu lỗi là chưa đăng nhập → panel nói rõ provider nào cần đăng nhập và cửa sổ đăng nhập của provider đó tự mở ra. Đăng nhập xong bấm Retry.

### Trạng thái trong lúc chờ

Cả 3 tab (AI / Breakdown / Translate với engine AI) chạy cùng một cơ chế:

1. **Thinking…** — provider đang suy nghĩ, chưa có chữ nào.
2. **Streaming** — chữ chạy dần vào popup y như trên trang provider, kèm caret nhấp nháy.
3. **Kết quả** — câu trả lời cuối hiện đầy đủ khi provider xong.

### Regenerate

Không thích câu trả lời → bấm **Retry** → kết quả cũ xóa, quay lại Thinking… rồi stream lại từ đầu (có thể đổi provider trước để lấy văn phong khác).

### Tick chunk vào card (Breakdown)

Mỗi chunk trong bảng phân tích câu có checkbox bên phải (hiện khi hover hàng). Tick chunk nào → chunk đó (text + meaning) được thêm vào field **Definitions** của card khi bấm Send/Quick Add. Mặc định chưa tick — chọn phần nào muốn giữ.

### Cache theo tab

Câu trả lời được cache trong tab trình duyệt đang mở: đổi qua lại giữa các tab trong popup, hoặc đóng popup rồi tra lại cùng từ trong cùng câu → answer hiện lại ngay, không hỏi provider lần nữa. Retry luôn hỏi mới và ghi đè cache. Cache mất khi đóng tab — không lưu qua phiên.

## 3. Dictionary miss

Tra từ mà dictionary không có kết quả → tab AI tự mở và AI giải thích luôn.

- Tắt/bật: **Settings → AI → "Explain with AI when no dictionary match"**.
- Anh bấm tab khác trước khi settings load xong → lựa chọn của Anh thắng, tab AI không chen vào.

## 4. Dịch câu bằng AI

Tab **Translate** bấm vào header "Sourced from…" để mở menu nguồn giống các tab AI:

- **Google** — engine máy, nhanh.
- **ChatGPT / Gemini / DeepSeek / Claude** — dịch qua provider, đúng ngữ cảnh hơn, stream chữ như các tab khác.
- Dưới cùng: chọn ngôn ngữ câu trả lời — **ngôn ngữ mẹ đẻ** hay **ngôn ngữ đang học** (áp dụng cho cả Google lẫn AI).

Đổi nguồn hoặc ngôn ngữ → tự dịch lại ngay.

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
| AI answer language | Ngôn ngữ AI dùng để giải thích: bản địa (giao diện) hay ngôn ngữ đích |
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
| `[ANSWER_LANG]` | Ngôn ngữ câu trả lời — theo "AI answer language" (bản địa/đích) |

Prompt cũ đã lưu vẫn dùng `[INTERFACE_LANG]` bình thường — muốn theo cài đặt ngôn ngữ trả lời thì đổi sang `[ANSWER_LANG]` hoặc Reset to default.

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
