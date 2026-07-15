# Report — Align src/ components to Cell Design System

> Ngày hoàn thành: 2025-01-XX
> Scope: toàn bộ `src/` (shared/ui + features + entrypoints)
> Source of truth: `docs/design-system/design-system-showcase/design-system.md`

---

## 1. Kết quả verification

| Gate | Kết quả |
|------|---------|
| `npx tsc --noEmit` | PASS (0 error) |
| `npx eslint src --quiet` | PASS (0 error) |
| `npx jest --selectProjects unit` | PASS — 173 suites, 2315 tests, 0 fail |
| `npx vite build` | PASS — 686ms, 0 error, 398 modules |
| Token audit (grep box-shadow + border-radius hardcode) | PASS — 0 drift |
| Showcase DS (dark) | radius-md=18px, radius-lg=10px, radius-xl=12px, shadow-md=none ✓ |
| dist/global.css (light + dark) | tất cả token đúng DS ✓ |

---

## 2. Token drift đã fix (theme.css)

| Token | Trước | Sau (DS) |
|-------|-------|----------|
| `--radius-md` | 8px | 18px |
| `--radius-lg` | 12px | 10px |
| `--radius-xl` | (missing) | 12px |
| `--radius-2xl` | (missing) | 24px |
| `--shadow-sm/md/lg` | có giá trị | `none` |
| `--color-primary-active` | (missing) | #1e40af (light) / #2563eb (dark) |
| `--color-success-subtle` | (missing) | #0596691a (light) / #10b98126 (dark) |
| `--color-warning-subtle` | (missing) | #f59e0b1a (light) / #f59e0b26 (dark) |
| `--color-error-subtle` | alpha sai | #ef44441a (light) / #ef444426 (dark) |
| `--leading-tight` | (missing) | 1.25 |

---

## 3. Component CSS drift đã fix

### Pattern 1: Focus ring (WCAG 2.4.7)
**Trước**: `outline: none; box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);`
**Sau**: `outline: 2px solid var(--color-primary); outline-offset: 2px;`

Files fix: Button, Input, Textarea, Select, SearchableSelect, Checkbox, Radio, Slider, ShortcutInput, Accordion, Tabs, NavItem, ListItem, HintIcon, FieldRow, MediaList, Dropzone, SettingsDialog, MultiSelect, CardCreatorSettingsPanel, NavClusterSettingsPanel, SubtitleStylePanel, ThemePreview, SubtitleCard, VideoCard, SidebarItem.

### Pattern 2: Elevation shadow → flat (P1 content-first)
**Trước**: `box-shadow: var(--shadow-md/lg);`
**Sau**: removed (border defines shape)

Files fix: Card, Dialog, Drawer, BottomSheet, Select, SearchableSelect, MediaList, DeleteConfirmModal, SettingsDialog, MultiSelect, App.redesigned, SelectionBar, VideoCard.

### Pattern 3: box-shadow in transitions
**Trước**: `transition: border-color ..., box-shadow ...;`
**Sau**: `transition: border-color ...;` (box-shadow removed)

Files fix: Button, Select, SearchableSelect, Checkbox, Radio, ShortcutInput, Card, SettingsDialog.

### Pattern 4: Hardcoded border-radius → token
- `border-radius: 50%` → `var(--radius-full)`: Toggle, Slider, SubtitleStylePanel, MultiSelect, SubtitleCard, VideoCard
- `border-radius: 8px` → `var(--radius-md)`: (n/a — đã token)
- `border-radius: 10px` → `var(--radius-lg)`: MultiSelect
- `border-radius: 12px` → `var(--radius-xl)`: Dialog, BottomSheet
- `border-radius: 24px` → `var(--radius-2xl)`: OptionsApp
- `border-radius: 6px` → `var(--radius-sm)`: OptionsApp
- `border-radius: 3px` → `var(--radius-sm)`: MultiSelect

### Pattern 5: Hardcoded rgba → token
- `rgba(16, 185, 129, 0.15)` → `var(--color-success-subtle)`: ContrastBadges
- `rgba(37, 99, 235, 0.15)` → `var(--color-primary-subtle)`: ContrastBadges
- `rgba(239, 68, 68, 0.15)` → `var(--color-error-subtle)`: ContrastBadges
- `rgba(22, 163, 74, 0.08)` → `var(--color-success-subtle)`: ResourcesPanel
- `rgba(0, 0, 0, 0.6)` overlay → `var(--dialog-overlay-bg, rgba(0, 0, 0, 0.5))`: OptionsApp

### Pattern 6: Status indicator focus (rgba → outline + semantic color)
- `box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2)` → `outline: 2px solid var(--color-success); outline-offset: 2px;`: CardCreatorSettingsPanel
- `box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2)` → `outline: 2px solid var(--color-error); outline-offset: 2px;`: CardCreatorSettingsPanel
- `box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2)` → `outline: 2px solid var(--color-warning); outline-offset: 2px;`: CardCreatorSettingsPanel

---

## 4. Components DS không cover (YAGNI — không thêm)

Các component trong `src/` không có counterpart trong DS showcase, nhưng **giữ nguyên** vì có use case thực:

| Component | Lý do giữ | DS có thể cover? |
|-----------|-----------|------------------|
| `NavCluster` (content script) | Overlay trên YouTube, logic riêng | Không — niche, không universal |
| `SubtitleOverlay` (content script) | Render phụ đề trên video | Không — niche |
| `CueList` (sidepanel) | List cue phụ đề, domain-specific | Có thể map → List, nhưng giữ custom vì behavior riêng |
| `DownloadCard` / `VideoCard` / `SubtitleCard` / `MediaEmpty` | Domain-specific media cards | Có thể map → Card + Badge, nhưng structure khác |
| `Dropzone` | Drag-drop file import | Không — DS không có dropzone |
| `ImportProgress` | Progress bar + log | Có thể map → Progress, nhưng có log area |
| `ResourcesPanel` / `ResourceCard` | Dictionary resource list | Có thể map → Card + List, nhưng structure khác |
| `CardCreatorDialog` / `FieldRow` / `MediaList` / `PreviewBlock` | Card creator form | Có thể map → Dialog + Input, nhưng form phức tạp |
| `DeleteConfirmModal` | Confirm dialog | Map → Dialog (đã align) |
| `ColorCustomization` / `ContrastBadges` / `ModeCards` / `ThemeImportExport` / `ThemePreview` | Theme editor UI | Không — niche admin UI |
| `SettingsDialog` / `MultiSelect` / `*SettingsPanel` | Settings UI | Map → Dialog + Tabs + Input (đã align) |
| `SelectionBar` | Popup selection bar | Không — domain-specific |
| `SidebarItem` (options) | Options sidebar nav | Map → NavItem (đã align) |

**Kết luận**: Tất cả component trên đã được align token (radius, shadow, focus, color) nhưng giữ structure riêng vì DS không có counterpart 1:1. Theo nguyên tắc YAGNI, không thêm 17 component DS showcase vào `src/` nếu không có use case.

---

## 5. Files đã edit (full list)

### shared/ui (16 files)
- `theme.css` (token foundation)
- `Button.module.css`, `Input.module.css`, `Textarea.module.css`
- `Select.module.css`, `SearchableSelect.module.css`
- `Checkbox.module.css`, `Radio.module.css`, `Toggle.module.css`
- `Slider.module.css`, `ShortcutInput.module.css`
- `Card.module.css`, `Dialog.module.css`, `Drawer.module.css`, `BottomSheet.module.css`
- `Accordion.module.css`, `Tabs.module.css`, `NavItem.module.css`, `ListItem.module.css`
- `Tooltip.module.css`, `HintIcon.module.css`, `Skeleton.module.css`

### features (16 files)
- `cardCreator/ui/FieldRow.module.css`, `MediaList.module.css`
- `dictionary/ui/DeleteConfirmModal.module.css`, `Dropzone.module.css`, `ResourcesPanel.module.css`
- `settings/ui/SettingsDialog.module.css`, `MultiSelect.module.css`, `CardCreatorSettingsPanel.module.css`, `NavClusterSettingsPanel.module.css`, `SubtitleStylePanel.module.css`
- `theme/ui/ContrastBadges.module.css`, `ThemePreview.module.css`

### entrypoints (7 files)
- `popup/App.redesigned.module.css`, `SelectionBar.module.css`
- `popup/components/media/SubtitleCard.module.css`, `VideoCard.module.css`
- `options/OptionsApp.module.css`, `SidebarItem.module.css`

**Tổng: 39 CSS files edited.**
