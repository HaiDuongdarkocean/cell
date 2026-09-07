# Resources Panel — Component Mapping

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

> Ánh xạ từ mockup `src/entrypoints/mockup-resources/` sang thành phần sẵn có trong codebase.  
> Mapping này áp dụng cho cả 3 concept; concept được chọn sẽ quyết định **extend** hay **redesign** cụ thể.

---

## 1. Shared UI primitives dùng chung

| UI element | Thành phần hiện có | Ghi chú |
|---|---|---|
| Layout page / stage | `Card`, `Heading`, `Text`, `Button` | Mockup shell dùng `Card` làm khung concept. |
| Segmented control | Custom `.mrSeg` trong mockup | Clone pattern từ `mockup-keyboard-shortcuts`; có thể thay bằng `Tabs` nếu cần A11y sẵn. |
| Theme / viewport switch | Local state + `data-theme` + `data-viewport` | Dùng lại cơ chế theme hiện tại (`document.documentElement.setAttribute`). |
| Error / success / warning banner | `Alert` (shared) | Dùng `variant` và `onDismiss`; duplicate alert custom thêm 2 nút inline. |
| Empty state | `EmptyState` (shared) | `size="compact"`, icon `folderOpen`. |
| Toggle enable resource | `Toggle` (shared) | Kích thước `sm` hoặc `xs`. |
| Button | `Button` (shared) | `variant="primary" | "outline" | "ghost" | "destructive"`, `size="sm"`. |
| Icon | `Icon` / `ICON_CATALOG` | `bookOpen`, `library`, `folderOpen`, `slidersHorizontal`, `plus`, `trash`, `chevronDown`, `x`. |
| Input number / text | `Input` (shared) | Dùng cho lookup và frequency band inputs. |
| Modal confirm | `DeleteConfirmModal` (existing) hoặc `Card` + `Button` | Trong mockup dùng `DeleteConfirm` tự viết; production nên dùng `DeleteConfirmModal` hoặc `ConfirmDialog` nếu có. |

---

## 2. Feature components cần extend hoặc wrap

| UI element | Thành phần hiện có | Hành động | Ghi chú |
|---|---|---|---|
| Dropzone | `Dropzone` (`features/dictionary/ui`) | **Extend style** | Cần variant nhỏ gọn cho concept A/B; concept C cần dropzone inline trong command bar. Hiện tại `Dropzone` chỉ có một kích thước lớn. |
| Import progress | `ImportProgress` (`features/dictionary/ui`) | **Reuse** | Thay thế dropzone tạm thời khi đang import. |
| Frequency band editor | `FrequencyBandsEditor` (`features/dictionary/ui`) | **Redesign layout** | Layout hiện tại 4 field trên 1 hàng dễ bị vỡ trên mobile. Cần grid 2x2 / 4 cột responsive. Logic giữ nguyên. |
| Resource card | `ResourceCard` (`features/dictionary/ui`) | **Redesign** | Cần thêm meta rõ hơn, icon expand, reorder buttons, toggle, delete, type badge (concept C). Nên tách thành `ResourceCard` + `ResourceDetail`. |
| Real Resources panel | `ResourcesPanel` (`features/dictionary/ui`) | **Không dùng trực tiếp trong mockup** | Mockup dùng `real.tsx` tái hiện lại giao diện bằng `Dropzone` + `FrequencyBandsEditor` để tránh gọi `resourceClient` khi chạy ngoài extension. |

---

## 3. Mapping theo từng concept

### Concept A — Clean Two-Section

| Mockup part | Production mapping |
|---|---|
| Section header (`SectionHeader`) | `Heading` + `Text` |
| Section card (`SectionFrame`) | `Card` (shared) hoặc bỏ nếu panel đã có nền |
| Dropzone per section | `Dropzone` với CSS nén hơn; hiển thị khi có resource |
| Empty state | `EmptyState` khi section rỗng (thay thế dropzone) |
| Resource list | Mở rộng `ResourceCard` |
| Footer delete + bands | `Button` destructive + `MockFrequencyBands` → redesign `FrequencyBandsEditor` |

### Concept B — Card Shelves

| Mockup part | Production mapping |
|---|---|
| Outer page header | `Heading` + `Text` |
| Per-type shelf card | `Card` (shared) variant default |
| Shelf header icon + title + Add | `Icon` + `Heading` + `Button` (leadingIcon) |
| Inner dropzone | `Dropzone` với margin nhỏ |
| Empty state inside shelf | `EmptyState` |
| Resource list inside shelf | `ResourceCard` |
| Tuning card | `Card` + `Icon` + `Heading` + `FrequencyBandsEditor` redesigned |

### Concept C — Command Deck

| Mockup part | Production mapping |
|---|---|
| Command bar | Custom div + `Button` + `Icon` |
| Type switch | Có thể dùng `Tabs` hoặc custom pill switcher |
| Unified dropzone | `Dropzone` với label/hint động theo type |
| Mixed resource list | `ResourceCard` + type badge (mới) |
| Type badge | Chip/badge từ `Badge` hoặc custom span sử dụng token tint |
| Tuning rail | `Card` + `FrequencyBandsEditor` redesigned |

---

## 4. CSS / token mapping

| Token / pattern | Nguồn |
|---|---|
| Colors, spacing, radii | `src/shared/styles/tokens.json` → `tokens.css` |
| `data-theme="light/dark"` | `document.css` và `ThemeProvider` hiện có |
| Container queries | Dùng `container-type: inline-size` như `mockup-keyboard-shortcuts` |
| Touch target | `--touch-target-mobile` / `--touch-target` |
| Glass surface | `--color-glass-surface`, `--color-glass-border` — chỉ dùng cho overlay/floating, không dùng cho nested card |

---

## 5. Không tạo component mới ngoài khi cần

Những component **nên thêm vào `src/shared/ui/`** nếu concept được chọn:

- `SegmentedControl` / `PillSwitch`: nếu Concept C được chọn, type switcher nên trở thành thành phần dùng chung.
- `TypeBadge` hoặc `ResourceTypeBadge`: nếu Concept C được chọn, badge Dictionary/Frequency nên dùng chung trong resource list.

Những component **không nên tạo mới**:

- Không tạo `ResourceCard2`, `Dropzone2`. Nên extend CSS của `ResourceCard`/`Dropzone`.
- Không tạo `EmptyState2`; `EmptyState` đã hỗ trợ icon, title, description, action.

---

## 6. Anti-patterns avoided

- Không hardcode màu/spacing; dùng token.
- Không dùng glass trên glass.
- Không import `resourceClient` trong mockup (tránh `Unknown message type` như screenshot).
- Không tạo thêm entrypoint build input cho mockup (tương tự `mockup-keyboard-shortcuts`).
