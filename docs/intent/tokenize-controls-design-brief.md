# Tokenize Controls — Idea-to-Interface Design Brief

> Generated with `inquiry-creativity` + `idea-to-interface`.

## Core decision

Tìm UI header tối giản nhất cho `Tokenize controls`, cho phép user bật 2 mode **Media** (subtitle) và **Text** (page text/comment) độc lập, với **Status / Frequency** ẩn mặc định.

## Must-haves

1. Một hàng header.
2. `Media` và `Text` có thể active cùng lúc.
3. Master `Tokenize` bật/tắt toàn bộ.
4. `Status` / `Frequency` auto bật và ẩn theo mode.
5. Advanced hiện khi cần.
6. Không `Subtitle` toggle.

## Concept options

| # | Name | IA / UX | UI | Best for | Main risk |
|---|---|---|---|---|---|
| **A** | **Master Pill + Inline Chips** | Master on → 2 chip `Media`/`Text` xuất hiện cùng hàng. Advanced mở popup dọc. | Pill nhỏ, animation trượt. | User muốn thấy và điều khiển nhanh. | Header bị rộng nếu có thêm chip. |
| **B** | **Header Trigger + Body Drawer** | Master chỉ là button. Click mở drawer 2 card `Media`/`Text` ở body. | Header gọn, body rộng hơn. | User cần cấu hình kỹ, nhiều toggle. | Thêm click, che nội dung body. |
| **C** | **Badge Popover** | Master button có badge đếm. Click mở popover dọc với checklist `Media`/`Text` + advanced. | Gọn nhất, ít element nhất. | Không gian header siêu hẹp. | User không thấy trạng thái ngay. |

## Trade-off matrix

| Criteria | Weight | A | B | C |
|---|---:|---:|---:|---:|
| Header real estate | 25% | 8 | 9 | 10 |
| Speed of interaction | 25% | 10 | 6 | 7 |
| Discoverability | 20% | 9 | 8 | 6 |
| Scalable (more modes later) | 15% | 6 | 9 | 9 |
| Aesthetic / on-brand | 15% | 9 | 8 | 7 |
| **Weighted score** | 100% | **8.85** | **7.85** | **8.1** |

## Verdict

- **A** thắng nhẹ nhờ tốc độ và discoverability.
- **C** là fallback nếu header thực sự quá chật.
- **B** tốt nếu có nhiều mode hoặc tùy chọn nâng cao trong tương lai.

**Recommendation:** chọn A, nhưng giữ drawer pattern (B) cho advanced / nhiều mode.
