# Method — B0 Goal + B1 Content

> Content-driven design: **form follows content.** Cấu trúc và ý nghĩa nội dung đến trước; anatomy, layout, token đến sau.
> Cần biết *cấu trúc* và *ràng buộc* của content — không cần chờ copy cuối cùng.

## B0 — Goal (journey scope)

Viết goal của user bằng **1 câu**: user *đạt được gì*, không chứa tên component/màn hình.

| Sai | Đúng |
|---|---|
| "Thiết kế một dialog" | "Cho user quyết định có chủ đích: xóa hay giữ tài khoản" |
| "Làm trang settings" | "Cho user kiểm soát hành vi tải phụ đề mà không cần đọc hướng dẫn" |

- Goal ở **journey scope** (cả hành trình), các bước B2 trở đi ở **surface scope** (từng màn/dialog trong journey).
- Không nói được goal trong 1 câu = chưa hiểu yêu cầu → hỏi user, đừng đoán.

## B1 — Content inventory

Liệt kê mọi thứ sẽ xuất hiện **trước khi** chọn cấu trúc:

| Trường | Hỏi |
|---|---|
| Slot/atom | Phần nào của surface? (title, body, action, meta, media) |
| Loại content | Text / số / icon / media / input |
| Content thật hoặc đại diện | Câu thật, tên thật, ảnh thật — không lorem |
| Worst case | Dài nhất/ngắn nhất có thể; localization (de/vi dài hơn en ~30%) |
| Vai trò semantic | Tiêu đề / mô tả / hành động / trạng thái / metadata |
| Quan hệ | Gần ai, xa ai, thuộc nhóm nào |
| States | empty / error / loading / partial data |

### Template

```
| slot | loại | content đại diện | worst case | vai trò | nhóm | states |
|---|---|---|---|---|---|---|
| title | text | "Delete Account" | 2 dòng wrapped | heading | header | — |
| body | text | "Permanently deletes {email}..." | email 60 chars + i18n ×1.3 | description | header | — |
| safe action | button label | "No, keep it." | i18n ×1.3 | action L0 | footer | — |
| destructive action | button label | "Yes, Delete!" | i18n ×1.3 | action L3 | footer | loading |
| status icon | icon | warning | — | status | header | — |
```

## Vì sao bước này trước B2–B4

- Copy là phần tử, không phải đồ trang trí: nút "Yes/No" mơ hồ chỉ lộ ra khi đọc *ngữ nghĩa* của action — inventory bắt được sớm.
- Worst-case length quyết định width, wrap, stack-dọc-hay-ngang — quyết định anatomy, không phải chi tiết.
- Empty/error/loading states ảnh hưởng component class (Skeleton vs EmptyState vs Alert — `method/behavior.md`).

## Anti-patterns

- Design button trước, phát hiện label dài vỡ layout sau.
- Dùng lorem ipsum → anatomy sai tỷ lệ.
- Bỏ qua empty state → ship màn hình trắng.
- Chọn "dialog" vì quen, trong khi content chỉ là thông báo nhỏ (Toast) — B2 phân xử.
