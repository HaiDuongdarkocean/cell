# ADR-084: Color System for "Quiet Confidence" Foundation

## Status

Proposed — awaiting build + showcase prototype before final acceptance.

## Context

Cell đang xây lại foundation với bản sắc **"quiet confidence"**: calm, focused, learnable, điềm đạm, có hứng thú học tập, đơn giản, thanh lịch. Color là mảng quan trọng nhất vì nó chi phối cảm xúc đầu tiên của người dùng khi mở popup, sidepanel, options, hay bất kỳ màn hình nào.

Vấn đề hiện tại:
- Palette cũ dùng primary `#2563eb` (xanh dương bão hòa rất cao, gần như mặc định Tailwind), cảm giác "công cụ generic" hơn là bản sắc riêng.
- Background light `#f1f1f1` là xám lạnh, không có sự ấm áp hoặc tinh tế.
- Dark theme `#1b1b1b` là xám đen thuần túy, không có chiều sâu.
- Thiếu surface ladder rõ ràng — card, popover, hover, dropdown gần như dùng cùng 1 màu.

## Decision

### 1. Hướng cảm xúc: neutral-first, single accent as punctuation

Sẽ dùng **neutral palette làm chủ đạo** và **một accent duy nhất** để nhấn primary actions, focus, brand. Đây là chiến lược của Linear và Apple HIG:

> "Linear trusts surface lift and hairline borders to carry every bit of hierarchy." — [Linear DESIGN.md analysis](https://www.shadcn.io/design/linear)

> "Use color consistently throughout your interface... Avoid using the same color to mean different things." — [Apple HIG Color](https://developer.apple.com/design/human-interface-guidelines/foundations/color)

Lý do cho Cell:
- Người học ngoại ngữ thường ở trong ứng dụng lâu (xem video, đọc phụ đề, tra từ). Nếu màu sắc rực rỡ khắp nơi sẽ gây mệt.
- Single accent giúp user biết đâu là hành động chính, đâu là nội dung. Không có "nhiều màu cạnh tranh sự chú ý".
- Neutral-first tạo cảm giác "điềm đạm" nhưng không buồn tẻ, vì surface lift + subtle borders tạo hierarchy.

### 2. Color space: dùng OKLCH để xây palette, xuất ra CSS dưới dạng sRGB (hex/rgba)

Quyết định: **thiết kế palette trong OKLCH, lưu token dưới dạng hex/rgba** để tương thích với MV3 extension (đảm bảo hiển thị đúng trên mọi trình duyệt Chrome/Edge/Brave, kể cả version cũ).

Lý do:
- OKLCH có trục L (lightness) perceptually uniform — 2 bước L cách nhau 0.1 sẽ nhìn đều nhau dù hue khác nhau [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch), [Color Archive](https://colorarchive.org/guides/oklch-color-space-guide/).
- Giúp tạo tonal palette đều và tính toán contrast chính xác hơn HSL/RGB [UJL Framework ADR-009](https://ujl-framework.org/reference/decisions/0009-oklch-color-space.html).
- Không dùng `oklch()` trực tiếp trong CSS output để tránh lỗi trên trình duyệt cũ hoặc khi dev build với PostCSS không hỗ trợ.

### 3. Light theme: warm off-white canvas, cool neutral text, subtle surface ladder

| Role | Giá trị OKLCH | Hex tương đương | Nguyên lý |
|------|---------------|-----------------|-----------|
| Background (page) | oklch(97% 0.005 85) | `#F9F9F7` | Ấm hơn pure white, giảm mỏi mắt, vẫn sáng. Hue 85 (warm) tạo cảm giác thân thiện. |
| Surface | oklch(100% 0 0) | `#FFFFFF` | Card/panel trắng tinh để nổi trên nền ấm. |
| Surface-elevated | oklch(98% 0.004 85) | `#FAFAF8` | Dropdown, popover, tooltip — cao hơn 1 bậc. |
| Surface-hover | oklch(95% 0.006 85) | `#F2F2EF` | Hover state, không dùng accent. |
| Text primary | oklch(22% 0.01 250) | `#2A2A2B` | Cool neutral, đủ contrast (~16:1). |
| Text secondary | oklch(52% 0.01 250) | `#6E6E73` | Cool gray, dễ phân biệt nhưng không chiếm spotlight. |
| Text tertiary | oklch(68% 0.01 250) | `#9A9AA2` | Disabled, placeholder, metadata. |
| Border | oklch(88% 0.006 85) | `#E2E2DF` | Subtle divider, không dùng màu sắc. |
| Border subtle | oklch(93% 0.004 85) | `#EFEFEC` | Hairline giữa surface cùng cấp. |

### 4. Dark theme: near-black with faint blue tint, layered surface

Linear dùng `#010102` với "faint blue cast, never the unfortunate #000000 true black" ([nguồn](https://www.shadcn.io/design/linear)). Apple HIG cũng khuyến nghị dark mode không nên pure black để tránh harsh.

| Role | Giá trị OKLCH | Hex tương đương | Nguyên lý |
|------|---------------|-----------------|-----------|
| Background (page) | oklch(15% 0.008 255) | `#0F1011` | Near-black với tint xanh dương, sâu nhưng không dead. |
| Surface | oklch(19% 0.009 255) | `#18191A` | Card/panel cao hơn background 1 bậc. |
| Surface-elevated | oklch(23% 0.01 255) | `#222325` | Popover, dropdown — cao hơn nữa. |
| Surface-hover | oklch(27% 0.012 255) | `#2B2D2F` | Hover state. |
| Text primary | oklch(96% 0.005 255) | `#F7F8F8` | Gần white, cool, đủ contrast. |
| Text secondary | oklch(72% 0.012 255) | `#AEB4BC` | Muted, readable. |
| Text tertiary | oklch(56% 0.012 255) | `#7D838B` | Disabled, metadata. |
| Border | oklch(30% 0.012 255) | `#33363A` | Subtle trên dark. |
| Border subtle | oklch(22% 0.01 255) | `#232629` | Hairline. |

### 5. Accent: desaturated indigo, single punctuation color

| Role | Giá trị OKLCH | Hex tương đương | Nguyên lý |
|------|---------------|-----------------|-----------|
| Primary | oklch(58% 0.16 265) | `#5E6AD2` | Linear's lavender-blue, đã chứng minh hiệu quả cho productivity tools. Đủ sắc để làm CTA, nhưng không chói. |
| Primary-hover | oklch(53% 0.17 265) | `#4F5AC4` | Darker 1 bậc L, tăng C nhẹ. |
| Primary-active | oklch(48% 0.18 265) | `#404CB5` | Nhấn khi press. |
| Primary-subtle | oklch(58% 0.16 265 / 0.12) | `rgba(94,106,210,0.12)` | Selected, focus-bg. |
| Text on primary | oklch(100% 0 0) | `#FFFFFF` | Text trên primary; token canonical `--color-text-on-primary`. `--color-primary-foreground` là alias cũ. |

Lý do chọn indigo/lavender thay vì blue:
- Blue thường gắn với corporate/corporate tools (Facebook, LinkedIn, Windows).
- Indigo/lavender cảm giác hiện đại, "creative tool", gần với "học tập có hứng thú".
- Linear đã chứng minh nó hoạt động tốt trong dark canvas.

### 6. Semantic colors: muted, không gây shock

| Role | Light | Dark | Nguyên lý |
|------|-------|------|-----------|
| Success | `#2F7D46` | `#5FD389` | Xanh lá đất, không neon. |
| Warning | `#9E6A1E` | `#F5B955` | Vàng đất, không cam chói. |
| Error | `#A63C3C` | `#F28B82` | Đỏ gạch, không máu me. |
| Info | `var(--color-primary)` | `var(--color-primary)` | Info = primary accent. |

### 7. Tint palette: 9 tints với độ bão hòa thấp

Giữ 9 tints (blue, cyan, gray, green, orange, pink, purple, red, teal, yellow) nhưng điều chỉnh độ bão hòa xuống để phù hợp calm aesthetic. Mỗi tint có 4 roles: background, border, icon, text — tất cả derived từ cùng 1 base hue.

### 8. Theme presets

`dawn`, `forest`, `ocean`, `warmth` là presets (lớp trên foundation) cho phép user cá nhân hóa accent và dark canvas. Chúng override core palette và một số derived token, nhưng vẫn tuân thủ cùng semantic role. Rationale chi tiết cho từng preset nằm ngoài phạm vi foundation.

## Consequences

**Positive:**
- UI có bản sắc riêng, calm, professional.
- Surface hierarchy rõ ràng hơn, card/popover/hover phân tầng.
- Single accent giảm cognitive load.

**Negative / Risks:**
- Phải cập nhật toàn bộ component dùng `color-primary`, `color-background`, `color-surface`.
- Một số screen cũ có thể dùng màu cụ thể (ví dụ subtitle status colors) cần map lại.
- User quen blue `#2563eb` có thể cảm thấy "lạ" ban đầu — cần prototype để validate.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Dùng `oklch()` trực tiếp trong CSS | MV3 extension cần support trình duyệt cũ; sRGB hex/rgba an toàn hơn. |
| Dùng 2 accent colors (primary + secondary) | Vi phạm "single accent as punctuation", tăng noise. |
| Pure white background + pure black dark | Gây mỏi mắt, thiếu chiều sâu, không refined. |
| Chọn teal/green làm primary | Gợi ý "nature/wellness", không khớp "learnable tech tool". |
| Giữ nguyên palette Tailwind blue | Không tạo bản sắc, trông generic. |

## References

- [Linear DESIGN.md — shadcn](https://www.shadcn.io/design/linear)
- [Linear Brand Guidelines](https://linear.app/brand)
- [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/foundations/color)
- [MDN — oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch)
- [UJL ADR-009 — OKLCH Color Space](https://ujl-framework.org/reference/decisions/0009-oklch-color-space.html)
- [Color Archive — OKLCH Guide](https://colorarchive.org/guides/oklch-color-space-guide/)
