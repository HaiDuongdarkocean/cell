# Foundation — Shape (radius + shadow + border + z)

> Luật: L-CANVAS + L-BORDER (`why/philosophy.md`). Giá trị: `tokens.json`.

## Radius — shape nói vai trò

| Token | Vai trò |
|---|---|
| `radius-none` (0) | — |
| `radius-xs` (2) | chip, tag, micro element |
| `radius-sm` (4) | small control |
| `radius-md` (6) | input, small card, menu surface |
| `radius-lg` (8) | card |
| `radius-xl` (12) | **dialog, panel** (`radius-element`) |
| `radius-2xl` (16) | large card (`radius-container`) |
| `radius-3xl` (24) | hero (`radius-page`) |
| `radius-pill` (9999) | button, input, badge — `radius-full` là deprecated alias |

**Grammar:** pill = field/chip/button; rounded-rect = panel/menu/row. Shape nói dối vai trò = defect.
**Concentric:** inner radius = `max(0, outerRadius − padding)` — container `md` → items `sm` → field `pill` (dictionary grammar).
**1 radius family per component** — không trộn 6/8/10px trong cùng surface.

## Shadow / elevation — chỉ cho floating

| Token | Vai trò |
|---|---|
| `shadow-sm` | hairline — card hover, small lift |
| `shadow-md` | popover |
| `shadow-lg` | modal |
| `shadow-floating` | floating element nhẹ |
| `shadow-popover` / `shadow-modal` | semantic popover / modal |
| `shadow-focus` | focus ring (2px accent) |

- Hierarchy qua **lightness ladder trước, shadow chỉ cho floating** (popover/menu/dialog/drawer). Resting surface không cần shadow.
- **Elevation chỉ đi lên — không đào lỗ:** child surface sáng hơn (hoặc bằng + shadow) parent; child tối hơn = lỗ đục vào card = defect.
- **Dark theme:** shadow alpha <10% vô hình trên dark → `shadow-popover/modal/floating` ≥30–50% black, có thể kèm 1px light inset ring.
- **Menu grammar:** `surface-popover` + shadow thật, không border — border chỉ fallback khi shadow không tách được (dense light list).

## Border — ngoại lệ có thông tin (L-BORDER)

Mặc định **không viền**. Border chỉ khi: variant `outline` · state (focus/error/success/selected) · affordance vật lý (drag/kbd/thumb/drop-zone/avatar edge) · separator cấu trúc (`--color-divider`, không `border-subtle`) · `prefers-contrast: more`/`forced-colors`.
Bỏ viền không được reflow: giữ width + transparent hoặc ring qua box-shadow/outline.

## Z-map

Layer qua token `--z-*` (base/dropdown/sticky/overlay/modal/toast/tooltip — exact set trong `tokens.json`). Không hardcode `z-index:` ngoài token — audit command bắt.

## Anti-patterns

- `radius-full` (deprecated → `pill`); tự mix radius trong 1 surface.
- Shadow cho resting card để "nổi" — dùng ladder.
- Child surface tối hơn parent (đào lỗ).
- Dark theme xài shadow light-alpha (invisible).
