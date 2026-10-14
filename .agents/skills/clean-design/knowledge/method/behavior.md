# Method — B2 Consequence + B6 Behavior

> Câu hỏi của B2: "UI nào xứng đáng với hậu quả của hành động?" — *visual intensity ∝ consequence*.
> Không bao giờ cho action consequence-thấp mượn cường độ consequence-cao (lạm dụng tín hiệu, T7; phá scarcity, T2).

## B2 — Consequence Triad

Chấm mỗi action 3 trục, lấy **max**:

| Trục | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Irreversibility** | Tự do | Undo 1 click | Chỉ qua confirm/phục hồi | Vĩnh viễn |
| **Risk** | Không mất gì | Cài đặt | Dữ liệu cá nhân, tiến độ | Không phục hồi được |
| **Attention** | Không cần | Nên biết | Phải biết/chặn lại | — |

| Consequence (max) | UI tối thiểu bắt buộc |
|---|---|
| 0 | ghost/secondary, feedback tĩnh hoặc không |
| 1 | secondary/outline + toast xác nhận |
| 2 | dialog xác nhận + nút màu tương ứng hậu quả |
| 3 | dialog destructive + xác nhận có chủ đích (checkbox/typed) kèm lý do |

**Ví dụ chuẩn:** xóa vĩnh viễn = I3+R2-3 → `destructive` + Dialog. Xóa có thùng rác/restore = I1 → `secondary`/`outline` + toast Undo — **không phải** dialog đỏ. Sai ghép đôi không phải lỗi mỹ thuật, là lỗi kỳ vọng nguy hiểm.

## Button variant decision table (từ `Button.tsx`)

| Variant | Vì | Dùng khi | Không dùng khi |
|---|---|---|---|
| `primary` | Điểm dấu điều hướng | **Duy nhất 1/view**, action lợi ích cao nhất | Nút thứ 2+ (phá scarcity) |
| `primarySubtle` | Selected tone giữ scarcity | Selected trong setting row, filter | Action lớn bình thường |
| `secondary` | Action phụ thường gặp | "Hủy" cạnh primary; action trong list | — |
| `outline` | Action nặng nhưng không destructive | Re-fetch, đổi tên | Destructive (=đỏ) |
| `ghost` | Action trong không gian dày/chrome | Icon action, toolbar, close/dismiss | Action chính (bị nuốt) |
| `link` | Điều hướng, không action | "Xem tất cả" | Action đổi state |
| `destructive` | Đỏ = nguy hiểm thật (T3) | Xóa vĩnh viễn, reset | Đăng xuất, ẩn |
| `success` | Xác nhận kết thúc tích cực | "Đánh dấu đã biết" | OK mặc định |
| ~~`glass`~~ | **CẤM** — material layer đã loại | — | — |

## Feedback: Toast vs Alert vs Dialog vs khác

| Tình huống | Dùng | Vì |
|---|---|---|
| Xác nhận ngắn không cần nhớ ("Đã lưu") | **Toast** | Attention=0; biến mất đúng nghĩa |
| Trạng thái dài user đọc lại | **Alert** (default/success/warning/error) | Persistence; tone theo L-STATUS |
| Consequence ≥2 hoặc cần input | **Dialog** | Chặn luồng = chi phí — chỉ khi consequence đòi |
| Quy trình đang chạy | **Progress** | Không dựng Alert cho việc đang chạy |
| Nội dung sắp tới | **Skeleton** | Giữ schema layout (T1) thay spinner giữa trang |
| List rỗng | **EmptyState** | Trạng thái rỗng tự giải thích, không màn trắng |
| Diễn giải icon-only | **Tooltip** | Không nhét hướng dẫn dài |
| Nhập liệu nhanh viewport hẹp | **Sheet/BottomSheet** | Không dùng cho destructive confirm (luồng lỏng) |

## Status display

| Component | Nghĩa vụ | Dùng khi |
|---|---|---|
| `Badge` | Nhãn trạng thái tĩnh | Trạng thái item trong list |
| `Chip` | Chọn/lọc | Toggle filter, selection nhóm |
| `StatusDot` | Hiện diện cực gọn | Online/sync trên avatar/row |
| `token-freq-*` | Encoding tần suất từ (domain) | Từ vựng/phụ đề, KHÔNG chrome UI |

## B6 — Behavior & a11y contract (WCAG 2.2 AA)

Mọi interactive element định nghĩa đủ — không state "tàng hình":

```
rest · hover · focus-visible · pressed · selected · disabled · loading · error · empty
```

- **Một state = một tín hiệu:** focus = `shadow-focus` ring; hover = `surface-hover` + `opacity-hover`; pressed = `surface-pressed`; open ≠ recolor chrome trang trí.
- **Feedback trong frame:** mọi user action sinh phản hồi (press, đổi state, pending) — Nielsen #1.
- **Keyboard đầy đủ:** open, arrow-nav, Enter, Escape đóng topmost layer (`pushEscapeLayer`), focus restore khi đóng, highlighted item scroll-into-view.
- **Semantics thật:** `<button>`/`<input>`/`<a>` trước; roles đúng (`listbox`/`option`, `aria-expanded/selected/pressed`); chip toggle = button + `aria-pressed`.
- **Focus không bị che** bởi sticky chrome/overlay (WCAG 2.4.11); nested focusable → element sâu nhất giữ ring, parent release.
- **Target ≥40px** cả coarse/fine (repo `--touch-target`=40 / HIG 44pt); touch equivalent cho hover-only; guard `hover:hover`.
- **Contrast:** 4.5:1 text, 3:1 large + non-text — cả 2 theme.
- **Status change announced** (live region) khi không focus-driven.
- **Shadow-DOM:** focus/selection qua `getRootNode()`; outside-click `composedPath()`; Escape `pushEscapeLayer` (AGENTS.md).

## Exits — mọi luồng phải có lối thoát

| Loại | Exit |
|---|---|
| Modal/dialog | Escape + click-outside + close button (ghost) + cancel action |
| Hành động có hậu quả | Undo (toast) khi consequence ≤1; confirm khi ≥2 |
| Flow dài | Back/cancel rõ, mất-tiến-độ cảnh báo trước khi thoát |
