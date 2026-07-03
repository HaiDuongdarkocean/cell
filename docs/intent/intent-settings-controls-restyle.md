# Intent: Settings Controls Restyle (Vỏ → Ruột)

> **Giai đoạn**: G0 Discovery (output idea-refine + interview-me)
> **Status**: Confirmed — sẵn sàng vào G1 Spec
> **Date**: 2026-07-04
> **Mockup**: `docs/mockups/mockup-settings-grouped.html` (G0.5 done, confirmed 2026-07-03)

## Problem Statement

> **How Might We**: Làm thế nào để các control trong Settings panel (toggle, slider, shortcut input, subtitle preview) khớp với mockup đã confirm — tức là UI đẹp + UX phù hợp người dùng — mà không phá behavior/data wiring đã hoạt động?

## Background (ground truth từ codebase)

### Đã làm (G4 partial — "vỏ")
- `SettingsDialog.tsx` + `.module.css`: layout 480px popover + sidebar trái 120px + 5 section cards (Media / Overlay / Shortcuts / Nav Cluster / Download) + pill active state + IntersectionObserver scroll-sync. **Layout đúng mockup.**
- `CustomSelect`: trigger button + dropdown menu + chevron rotate. **Đã đúng mockup.**
- Popup width 400→480px (`global.css` + `App.redesigned.module.css`).

### Chưa làm ("ruột" — control types sai mockup)
| Control | Hiện tại | Mockup yêu cầu |
|---|---|---|
| **Toggle** (auto-select, overlay auto-load, nav cluster enable) | `IconButton` star icon (active = primary bg) | **Toggle switch pill** 32×18px, slide animation, ON = primary bg + thumb translateX(14px) |
| **Slider** (nav cluster: button size, bg opacity, button opacity) | Native `<input type="range">` + `accent-color: var(--primary)` | **Styled slider**: 4px track, 14px round thumb primary color + 2px white border + shadow |
| **Shortcut input** (5 keyboard shortcuts) | `<input type="text">` thường, width 40px | **Shortcut input**: uppercase + semibold + center + `--radius-sm` border |
| **Subtitle preview** (trong appearance field) | Không có (chỉ `SubtitleStylePanel` controls) | **Preview box**: black bg + white text + center, "This is how the target subtitle will look." |
| **Nav cluster enable toggle** | `IconButton` star icon trong `NavClusterSettingsPanel` | **Toggle switch pill** cùng style với 2 toggle trên |

### Đã đúng (giữ nguyên)
- `CustomSelect` (5 selects: format, quality, subtitle lang, overlay target/native lang, concurrent, convert, parallel, workers, filename)
- `MultiSelect` (subtitle languages)
- `SubtitleStylePanel` (font size, colors, shadow, position — đã có riêng)
- `NavClusterSettingsPanel` sliders (logic + data wiring đúng, chỉ style sai)
- Sidebar nav + section cards + pill active

## Recommended Direction

**Restyle-only, preserve behavior.** Tạo 3 atom components mới + restyle 1:

1. **`Toggle` atom** (`src/shared/ui/Toggle.tsx`) — switch pill 32×18px, replace 3 `IconButton` toggles
2. **`Slider` atom** (`src/shared/ui/Slider.tsx`) — styled range, replace 3 nav cluster sliders
3. **`ShortcutInput` atom** (`src/shared/ui/ShortcutInput.tsx`) — uppercase + semibold input, replace 5 shortcut inputs
4. **`SubtitlePreview` component** (`src/features/settings/ui/SubtitlePreview.tsx`) — black bg preview box, add vào appearance field

### Scope v1 (confirmed)
**In:**
- 4 atom/components mới (Toggle, Slider, ShortcutInput, SubtitlePreview)
- Restyle 3 toggles + 3 sliders + 5 shortcut inputs + 1 preview box
- Preserve toàn bộ: data-testid, onChange handlers, settings keys, persistence, a11y (aria-pressed, aria-label, focus-visible)
- Tests cho 4 atoms (unit)
- Browser verify (Edge MCP) — visual + a11y + dark/light mode

**Out:**
- Không thêm/sửa setting key nào
- Không đổi settings storage schema
- Không đổi `SubtitleStylePanel` (đã đúng)
- Không đổi `MultiSelect`/`CustomSelect` (đã đúng)
- Không thêm setting mới (chỉ render lại existing controls đúng mockup)

## Lightweight Feasibility Go/No-Go

| Criterion | Status |
|---|---|
| Mockup confirmed | ✅ G0.5 done 2026-07-03 |
| Layout (vỏ) done | ✅ G4 partial — sidebar + cards |
| Behavior stable | ✅ Tests pass (1449/1450), data wiring hoạt động |
| Atoms reusable | ✅ Toggle/Slider/ShortcutInput dùng chung được cho future settings |
| Risk | LOW — restyle-only, preserve data-testid + handlers |
| Effort | ~4 atoms + 4 restyle spots + tests + browser verify |

**Decision: GO** → G1 Spec
