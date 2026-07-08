---
name: agents-md-keeper
description: >
  Giữ gìn AGENTS.md định kỳ theo tháng. Mỗi lần cập nhật phải tốt hơn file cũ, giới hạn dưới 100 dòng.
  Phương pháp: tạo câu hỏi → tìm câu trả lời từ codebase → hỏi người dùng nếu thiếu.
  Ngôn ngữ đời thường, đơn giản, cả người và AI đều đọc được.
  Kích hoạt khi: "update agents.md", "bảo trì agents.md", "kiểm toán agents.md", "tháng rồi update agents.md", "giữ agents.md".
---

# Giữ gìn AGENTS.md định kỳ

Mỗi tháng cập nhật 1 lần. Mục tiêu: file mới tốt hơn file cũ, dưới 100 dòng, ngôn ngữ đời thường.

## Nguyên lý cốt lõi (15 nguyên lý gộp thành 5 nhóm)

1. **Nhỏ là đẹp** — dưới 500 token (~300-400 chữ). File lớn = AI bối rối + tốn tiền. Dự án chuẩn thì không cần file.
2. **Công cụ làm luật** — nếu linter/formatter/CI thực thi được, không nhắc lại trong file.
3. **Hỏi rồi mới viết** — mỗi dòng phải trả lời được "tại sao cần?" và "AI không tự suy ra được?".
4. **Tránh từ tuyệt đối** — không "luôn luôn", "kỹ lưỡng", "mọi". Chúng kích hoạt over-exploration.
5. **Ngữ cảnh tại chỗ** — nếu chỉ liên quan 1 tệp/hàm → viết bình luận tại chỗ, không放进 file.

## Quy trình cập nhật hàng tháng

### Bước 1 — Đọc file hiện tại + đo

Đọc AGENTS.md hiện tại. Đếm dòng + token. Ghi nhận: file cũ có bao nhiêu dòng, bao nhiêu section.

### Bước 2 — Tạo danh sách câu hỏi

Dựa vào 5 nhóm nguyên lý, tạo câu hỏi để kiểm tra từng section:

- "Section này AI có tự suy ra được từ code không?" → nếu có, xóa.
- "Section này linter/CI đã enforce chưa?" → nếu rồi, xóa.
- "Section này có từ 'luôn luôn'/'kỹ lưỡng'/'mọi' không?" → nếu có, viết lại nhẹ nhàng.
- "Section này có đường dẫn tệp cụ thể không?" → nếu có, kiểm tệp còn tồn tại không. Mất → xóa hoặc mô tả năng lực.
- "Section này có thông tin thừa AI vốn biết không?" → nếu có, xóa.

### Bước 3 — Tìm câu trả lời từ codebase

Chạy từng câu hỏi qua codebase:
- `grep` tìm luật linter trong `eslint.config.js`, `tsconfig.json`, `prettier`.
- `ls` kiểm tra đường dẫn tệp trong file còn tồn tại không.
- Đọc mã để xem AI có thể tự suy ra không.

### Bước 4 — Hỏi người dùng nếu thiếu

Nếu codebase không trả lời được câu hỏi nào → hỏi Anh yêu. Ví dụ:
- "Section X em không xác định được còn cần không, anh yêu dùng nữa không?"
- "Quy ước Y em thấy codebase không enforce, anh yêu muốn giữ hay xóa?"

### Bước 5 — Viết lại file

Viết lại từ đầu, không chỉnh sửa lặt vặt. Nguyên tắc:
- Mỗi dòng phải vượt 5 câu hỏi ở Bước 2.
- Ngôn ngữ đời thường: "dùng pnpm" thay vì "always utilize pnpm package manager".
- Dưới 100 dòng.
- Nếu vượt 100 dòng → đẩy section ra tệp riêng trong `docs/`, để lại liên kết.

### Bước 6 — Đo lại + so sánh

Đếm dòng + token file mới. So sánh với file cũ:
- Dòng giảm? Tốt.
- Token giảm? Tốt.
- Thông tin quan trọng mất? Không tốt → thêm lại ngắn gọn hơn.
- Thông tin thừa mất? Tốt.

### Bước 7 — Báo cáo cho người dùng

Báo cáo: file cũ X dòng → file mới Y dòng. Xóa section nào, lý do. Giữ section nào, lý do. Hỏi Anh yêu duyệt trước khi commit.

## Ngôn ngữ

Viết như nói chuyện: ngắn, rõ, không học thuật. Cả người mới và AI đều đọc được. Ví dụ:
- Tốt: "Dự án này là tiện ích Chrome tải video. Dùng pnpm."
- Tệ: "This project is a Chrome extension designed for video downloading capabilities. Always utilize pnpm as the package manager."

## Khi nào bỏ hẳn file

Nếu sau cập nhật mà file chỉ còn mô tả dự án + trình quản lý gói + lệnh build → cân nhắc bỏ file. Dự án chuẩn, AI tự xử lý tốt hơn không có file.
