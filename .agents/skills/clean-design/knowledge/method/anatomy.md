# Method — B3 Anatomy + Component Mapping

> Anatomy = danh sách các phần cấu thành một surface, kèm vai trò của từng phần.
> Phân rã anatomy → map từng phần vào `src/shared/ui/*` → thiếu thì theo contribution contract (`ops/lifecycle.md`), không ad-hoc.

## Composition ladder (thứ tự vật liệu)

```
tokens → components → layouts → pages
(mỗi tầng chỉ dùng vật liệu tầng dưới — component không tự định nghĩa giá trị,
layout không tự vẽ component, page không tự dựng layout)
```

Spec/build theo chiều này; audit ngược lại (page → layout → component → token).

## Phân rã anatomy — ví dụ Dialog (thật trong `src/shared/ui/`)

| Phần | Vai trò | Component/token |
|---|---|---|
| scrim | che host, click-outside | overlay, `--z-modal` |
| panel | container | `Surface variant="dialog"`, `--dialog-padding`, `radius-xl`, `shadow-lg` |
| title icon | status cue | 40×40 box, `radius-element`, icon 18 (`ICON_SIZE_PX`) |
| title + description | nội dung bắt buộc đọc | `font-size-xl` bold + `text-secondary` |
| children | vùng nội dung tự do | slot |
| footer | action cluster | sticky, divider, `justify-end` |
| close button | exit | `IconButton ghost`, `showCloseButton` |
| behavior | focus trap, Escape, aria-modal | `useFocusTrap`, `pushEscapeLayer` |

## Component map — element → `src/shared/ui/`

| UI element | Component | Ghi chú |
|---|---|---|
| Button (mọi loại) | `Button` | variant theo `method/behavior.md` |
| Icon-only button | `IconButton` | ghost cho chrome |
| Close/dismiss | `CloseButton`/`IconButton` | **luôn ghost** |
| Card / list item | `Card` | `.interactive` có sẵn hover |
| Text input | `Input`/`InputField` | |
| Search input | `SearchField` | |
| Toggle / Checkbox row | `Toggle` / `Checkbox variant="row"` | |
| Select dropdown | `Select` / `SearchableSelect` | |
| Dialog / modal | `Dialog` | size sm/md/lg/xl |
| Bottom sheet (mobile) | `BottomSheet` | không dùng cho destructive confirm |
| Menu/kebab | `Menu` + `MenuItem` | KHÔNG tự viết `.menuItem` (AGENTS.md) |
| Tabs / Sidebar | `Tabs` / `Sidebar` | |
| Empty state | `EmptyState` | mọi list phải có |
| Text / Heading | `Text` / `Heading` | composite `--text-*` |
| Stack / Flex | `Stack` / `Flex` | gap trên parent |
| Status display | `Badge`/`Chip`/`StatusDot`/`Alert` | bảng `behavior.md` |
| Icon | `Icon` + `ICON_CATALOG` | không inline SVG |

## Q1–Q4 — thiết kế từng atom (chi tiết tại `spec-sheet.md`)

1. **Concept** — inset / squish / stretch / stack / inline / grid
2. **Quan hệ** — tier nào trong spacing ladder
3. **Kích thước** — height ladder / target size (visual ≠ hit)
4. **Token** — map `tokens.json`

Atom không trả lời Q2 → quay B1 (chưa hiểu quan hệ).

## Guard

- Mọi atom phải map được component, hoặc justification: gần giống nhất + vì sao không dùng được + đề xuất variant mới.
- Element "giống-nhưng-khác" → **variant của component có sẵn**, không phải component mới.
- Chỉ element thật sự chuyên biệt mới ở custom — kèm justification viết ra.
