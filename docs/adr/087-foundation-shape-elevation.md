# ADR-087: Shape & Elevation for "Quiet Confidence" Foundation

## Status

Proposed — awaiting build + showcase prototype before final acceptance.

## Context

Shape (border radius) và elevation (shadow) giúp phân biệt component và thể hiện depth. Cell hiện có scale: `xs: 2px`, `sm: 6px`, `md: 8px`, `card: 10px`, `dialog: 16px`, `pill: 9999px`. Nhưng `radius` hiện chưa ứng với role rõ ràng, và shadow hầu hết là `none`.

Với bản sắc **"quiet confidence"**, shape cần "đơn giản, thanh lịch" — không playful quá (radius lớn) cũng không cứng nhắc (radius nhỏ/quá vuông). Elevation cần kín đáo — dùng surface lift và border hơn là drop shadow nặng.

## Decision

### 1. Border radius scale

| Token | Value | Usage | Rationale |
|-------|-------|-------|-----------|
| `--radius-none` | 0 | Square elements, tables, full-bleed images | Cần để tạo contrast với rounded components. |
| `--radius-xs` | 2px | Tags, chips, small pills | Micro rounding, không làm mất nghiêm túc. |
| `--radius-sm` | 4px | Small controls, checkboxes, toggles | Slight roundness for friendliness. |
| `--radius-md` | 6px | Small controls, checkboxes, toggles | Default micro control. |
| `--radius-lg` | 8px | Cards, panels, list items | Standard container. |
| `--radius-xl` | 12px | Dialogs, modals, popovers | Elevated containers. |
| `--radius-2xl` | 16px | Page-level cards, sidepanel | Large sections. |
| `--radius-3xl` | 24px | Hero cards, large banners | Extra-large surface. |
| `--radius-pill` | 9999px | Buttons, inputs, chips, icon buttons | Fully rounded for CTA/inputs. |
| `--radius-full` | 9999px | Avatars, circular indicators | Deprecated alias of `radius-pill`. |

**Nguyên lý:**
- Giảm `radius-card` từ 10px xuống **8px** (`--radius-lg`) để đơn giản hóa scale.
- Dùng `radius-pill` cho **buttons, inputs, và badges** để tạo sự mềm mại.
- Dùng `radius-md` (6px) cho **checkboxes, toggles, và small controls**.
- Dùng `radius-lg` (8px) cho **cards** để card nổi bật hơn button.
- `radius-full` là alias cũ của `radius-pill`; dùng `radius-pill` cho mọi trường hợp 9999px.
- **Concentric radius rule**: inner radius = `max(0, outerRadius - padding)`. Ví dụ card `radius-lg` (8px) với padding `space-4` (16px) thì inner content `radius-none` hoặc `radius-sm`.

### 2. Elevation philosophy: surface lift over shadow

Linear dùng 4-step surface ladder thay vì drop shadow ([nguồn](https://www.shadcn.io/design/linear)):
> "Four-step surface ladder carries hierarchy without drop shadows."

Quyết định cho Cell:
- **Elevation 0 (ground)**: page background.
- **Elevation 1**: cards, panels — border `1px` + background surface.
- **Elevation 2**: popovers, dropdowns, tooltips — background surface-elevated + border.
- **Elevation 3**: modals, dialogs — background surface-elevated + shadow.

**Shadow scale rất nhẹ:**

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-0` | `none` | Default, surface-on-surface. |
| `--shadow-sm` | `0 1px 2px rgb(0 0 0 / 0.04)` | Slight lift for buttons/inputs focus. |
| `--shadow-md` | `0 4px 8px -2px rgb(0 0 0 / 0.06)` | Popover, dropdown. |
| `--shadow-lg` | `0 12px 24px -4px rgb(0 0 0 / 0.08)` | Modal, dialog. |

**Dark mode shadows** sẽ dùng `rgba(0,0,0,0.2)` vì nền tối cần shadow đậm hơn để thấy.

**Lý do dùng shadow ít:**
- "Quiet confidence" không cần "float" quá nhiều. Shadow là side effect của elevation, không phải decoration.
- Tránh muddy trên dark canvas.
- Surface lift (lighter/darker background) tạo depth rõ ràng hơn shadow trên nền trắng.

### 3. Border vs shadow priority

| Elevation | Primary cue | Shadow? |
|-----------|-------------|---------|
| 0 (page) | background color | no |
| 1 (card) | surface + border | no |
| 2 (popover) | surface-elevated + border | `shadow-md` |
| 3 (modal) | surface-elevated + overlay backdrop | `shadow-lg` |

## Consequences

**Positive:**
- Scale radius đơn giản, dễ nhớ.
- Elevation dựa trên surface lift + subtle shadow, phù hợp calm aesthetic.
- Concentric radius giữ consistency.

**Negative:**
- Component cũ dùng `radius-card` (10px) cần chuyển sang `radius-lg` (8px) hoặc `radius-xl` (12px).
- Shadow mới cần test trên cả light/dark.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Radius lớn (16px cards, 24px dialogs) | Quá playful, không phù hợp "điềm đạm". |
| Radius nhỏ (2px cho mọi thứ) | Quá cứng nhắc, thiếu friendliness. |
| Heavy drop shadows (0 20px 50px) | Gây nặng nề, phản cảm "quiet confidence". |
| Glassmorphism (blur + opacity) | Quá xu hướng, không durable. |

## References

- [Linear DESIGN.md — shadcn](https://www.shadcn.io/design/linear)
- [Material 3 — Shape](https://m3.material.io/styles/shape/shape-scheme)
- [Apple HIG — Materials & Elevation](https://developer.apple.com/design/human-interface-guidelines/foundations/materials)
