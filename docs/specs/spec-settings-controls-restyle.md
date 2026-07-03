# Spec: Settings Controls Restyle

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — auto-proceed (anh ủy quyền quyết đến hết workflow)
> **Date**: 2026-07-04
> **Intent source**: `docs/intent/intent-settings-controls-restyle.md`
> **Mockup source**: `docs/mockups/mockup-settings-grouped.html` (G0.5 confirmed 2026-07-03)

## Objective

Restyle 6 control types trong Settings panel để khớp mockup đã confirm — Toggle switch pill, styled Slider, ShortcutInput uppercase, SubtitlePreview box, SearchableSelect (language dropdowns), HintIcon popover (collapsible hints) — mà **không phá behavior/data wiring** đã hoạt động. Mục tiêu duy nhất: UI đẹp + UX phù hợp người dùng.

**User**: Người dùng extension mở Settings popup, tương tác toggle/slider/shortcut/preview/searchable-select/hint-icon.

**Why now**: Layout "vỏ" (sidebar + 5 cards) đã done G4 partial, nhưng control types sai mockup — `IconButton` star icon thay vì toggle switch pill, native slider thay vì styled slider, text input thường thay vì shortcut input uppercase, không có subtitle preview, CustomSelect ~184 items không có search, hint text always visible clutters panel. Gap rõ ràng giữa mockup confirmed và implementation.

**Success**:
- 3 toggle = switch pill 32×18px, slide animation, ON = primary bg + thumb translateX(14px)
- 3 slider = styled 4px track + 14px round thumb primary color + 2px white border + shadow
- 5 shortcut input = uppercase + semibold + center + `--radius-sm` border
- 1 subtitle preview = black bg + white text + center, "This is how the target/native subtitle will look."
- 2 searchable selects = embedded search box, filter case-insensitive, arrow key navigation, single-select with check mark
- 6 hint icons = collapsible popover with boundary detection (flip-top/align-right/align-center), click outside dismiss, Esc key dismiss
- Tất cả preserve: data-testid, onChange handlers, settings keys, persistence, a11y
- Dark + light mode đều đúng
- Tests pass (unit + tsc + lint + build)

## Assumptions

1. **6 atom/components mới**, colocate tests:
   - `src/shared/ui/Toggle.tsx` + `.module.css` + `.test.tsx`
   - `src/shared/ui/Slider.tsx` + `.module.css` + `.test.tsx`
   - `src/shared/ui/ShortcutInput.tsx` + `.module.css` + `.test.tsx`
   - `src/shared/ui/SearchableSelect.tsx` + `.module.css` + `.test.tsx`
   - `src/shared/ui/HintIcon.tsx` + `.module.css` + `.test.tsx`
   - `src/features/settings/ui/SubtitlePreview.tsx` + `.module.css` + `.test.tsx`
2. **Toggle/Slider/ShortcutInput/SearchableSelect/HintIcon** = shared atoms (`src/shared/ui/`) — reusable cho future settings.
3. **SubtitlePreview** = feature component (`src/features/settings/ui/`) — chỉ dùng trong settings.
4. **Preserve data-testid**: `nav-cluster-enabled-toggle`, `nav-cluster-button-size`, `nav-cluster-bg-opacity`, `nav-cluster-button-opacity`, `shortcut-prev-cue`, `shortcut-next-cue`, `shortcut-replay-cue`, `shortcut-toggle-overlay`, `shortcut-toggle-panel`.
5. **Preserve a11y**: `aria-pressed` (toggle), `aria-label`, `aria-valuenow` (slider), focus-visible 2px solid primary + 2px offset. SearchableSelect = combobox pattern per WAI-ARIA. HintIcon = button + aria-expanded + aria-label.
6. **No new dependency** — ponytail rung 5: native `<input type="range">` + `<button>` + CSS. Không lib toggle/slider/searchable-select.
7. **No new setting key** — chỉ render lại existing controls.
8. **IconButton** giữ nguyên cho header (close button) — không thay.
9. **SubtitleStylePanel** giữ nguyên (đã đúng) — chỉ thêm preview box bên trên/bên dưới.
10. **Dark mode**: toggle ON = `--color-primary` (dark: `#60a5fa`, light: `#2563eb`), slider thumb same.
11. **SearchableSelect**: reuse MultiSelect filter logic (case-insensitive, matches label incl. native name), but single-select semantics.
12. **HintIcon**: boundary detection via getBoundingClientRect(), flip-top/align-right/align-center CSS classes, click outside dismiss, Esc key dismiss.

## Tech Stack

- React 19, TypeScript 6, CSS Modules
- No new dependency — native DOM + CSS
- Tokens từ `theme.css` (no invented tokens)

## Commands

```bash
Build:         npm run build
Typecheck:     npm run typecheck
Test unit:     npm run test:unit
Lint:          npm run lint
```

## Functional Requirements (F)

### F1: Toggle atom
- **F1.1**: Switch pill 32×18px, border-radius `--radius-full`, bg `--color-border` khi OFF, `--color-primary` khi ON (light: `#2563eb`, dark: `#60a5fa`).
- **F1.2**: Thumb 14×14px white circle (`#fff`), translateX(0) khi OFF, translateX(14px) khi ON, transition `transform var(--transition)`.
- **F1.3**: Click → gọi `onChange(!checked)`, `aria-pressed` reflect state.
- **F1.4**: `aria-label` required, focus-visible 2px solid `--color-primary` + 2px offset.
- **F1.5**: Props: `checked: boolean`, `onChange: (next: boolean) => void`, `ariaLabel: string`, `id?: string`, `dataTestId?: string`.
- **F1.6**: No hardcoded color — all colors from theme.css tokens.

### F2: Slider atom
- **F2.1**: Native `<input type="range">` styled: track 4px height, bg `--color-border`, radius 2px.
- **F2.2**: Thumb 14×14px round, bg `--color-primary` (light: `#2563eb`, dark: `#60a5fa`), border 2px solid `--color-background`, shadow `0 1px 2px rgba(0,0,0,0.2)`.
- **F2.3**: Focus-visible 2px solid `--color-primary` + 2px offset.
- **F2.4**: Props: `value: number`, `min: number`, `max: number`, `step: number`, `onChange: (v: number) => void`, `ariaLabel: string`, `id?: string`, `dataTestId?: string`.
- **F2.5**: Preserve snap logic cho button size (40/48/56 presets) — caller truyền onChange, snap ở parent.
- **F2.6**: No hardcoded color — all colors from theme.css tokens.

### F3: ShortcutInput atom
- **F3.1**: `<input type="text">` width 40px, padding 6px 8px, font-size `--font-size-sm`, font-weight `--font-weight-semibold`, text-align center, text-transform uppercase.
- **F3.2**: Border 1px solid `--color-border`, radius `--radius-sm`, bg `--color-surface` (light: `#f8fafc`, dark: `#1e293b`).
- **F3.3**: Focus-visible 2px solid `--color-primary` + 2px offset.
- **F3.4**: maxLength 1, normalize lowercase slice(0,1) on change.
- **F3.5**: Props: `value: string`, `onChange: (key: string) => void`, `ariaLabel: string`, `id?: string`, `dataTestId?: string`.
- **F3.6**: No hardcoded color — all colors from theme.css tokens.

### F4: SubtitlePreview component
- **F4.1**: Black bg (`#000`), white text (`#fff`), padding `--spacing-md`, radius `--radius-sm`, text-align center, font-size 13px, line-height 1.4.
- **F4.2**: Text sample: "This is how the {role} subtitle will look." (role = target | native).
- **F4.3**: Apply style từ `OverlayStyleConfig` (fontSize, textColor, backgroundColor, textShadow, fontFamily, opacity) — realtime reflect SubtitleStylePanel controls.
- **F4.4**: Props: `style: OverlayStyleConfig`, `role: 'target' | 'native'`.

### F5: SearchableSelect atom
- **F5.1**: Single-select dropdown with embedded search box (trigger → menu opens with search input auto-focused).
- **F5.2**: Type to filter (case-insensitive, matches label incl. native name in parens).
- **F5.3**: Arrow Up/Down to move highlight, Enter to select, Esc to close.
- **F5.4**: "No languages found" empty state when filter yields no results.
- **F5.5**: Selected item shows check mark (single-select, not toggle like MultiSelect).
- **F5.6**: Reuse MultiSelect filter logic (same filter function, same empty state) but single-select semantics.
- **F5.7**: Keep visual parity with CustomSelect trigger (same padding, border, radius, hover/focus states).
- **F5.8**: Props: `options: { value: string; label: string }[]`, `value: string`, `onChange: (v: string) => void`, `ariaLabel: string`, `id?: string`, `dataTestId?: string`.
- **F5.9**: Light/dark mode sync: trigger bg = `--color-surface` (light: `#f8fafc`, dark: `#1e293b`), border = `--color-border`, focus ring = `--color-primary-subtle`. Menu bg = `--color-background`, border = `--color-border`, highlight = `--color-primary-subtle`, selected check = `--color-primary`. No hardcoded color.

### F6: HintIcon atom
- **F6.1**: Info-circle icon (14px SVG) next to label, color `--color-text-muted` (light: `#94a3b8`, dark: `#64748b`), hover `--color-primary` (light: `#2563eb`, dark: `#60a5fa`).
- **F6.2**: Click → reveal hint popover floating above icon (position absolute, bottom: calc(100% + 6px)).
- **F6.3**: Popover: max-width 280px, padding `--spacing-sm` `--spacing-md`, bg `--color-surface-hover` (light: `#f1f5f9`, dark: `#334155`), border `--color-border` (light: `#e2e8f0`, dark: `#334155`), radius `--radius-md`, shadow `--shadow-md`.
- **F6.4**: Popover text = `--color-text` (light: `#0f172a`, dark: `#f1f5f9`).
- **F6.5**: Boundary detection: use getBoundingClientRect() on icon → if top < popoverHeight + 8px, add `.flip-top` (popover below icon). If spaceLeft < popoverWidth, add `.align-right`. If both sides insufficient, add `.align-center`.
- **F6.6**: Arrow pointing to icon (CSS ::after pseudo-element, 5px border, border-top-color = `--color-border`).
- **F6.7**: Click outside dismiss (document mousedown listener).
- **F6.8**: Esc key dismiss (document keydown listener).
- **F6.9**: Accessible: button + aria-expanded + aria-label="Show hint for X", popover role="tooltip".
- **F6.10**: Props: `hint: string`, `ariaLabel: string`, `id?: string`.
- **F6.11**: Default collapsed (clean panel). Open state local to component (no persistence).
- **F6.12**: No hardcoded color — all colors from theme.css tokens.

### F7: Integration — replace existing controls
- **F7.1**: 3 toggle (auto-select, overlay auto-load, nav cluster enable) → `Toggle` atom.
- **F7.2**: 3 slider (nav cluster button size, bg opacity, button opacity) → `Slider` atom.
- **F7.3**: 5 shortcut input → `ShortcutInput` atom.
- **F7.4**: Subtitle appearance field → add `SubtitlePreview` bên trên SubtitleStylePanel.
- **F7.5**: 2 language selects (overlay target/native) → `SearchableSelect` atom (replace CustomSelect).
- **F7.6**: 6 hint locations (4 in SettingsDialog, 2 in SubtitleStylePanel) → `HintIcon` atom (replace `<p class="asHint">` / `<p class="hint">`).
- **F7.7**: Preserve tất cả data-testid + onChange handlers + settings keys.

## Non-Functional Requirements (NF)

- **NF1 Performance**: Toggle click < 16ms (CSS transition only), slider drag không lag (native input), SearchableSelect filter < 50ms (debounce 150ms), HintIcon boundary detection < 16ms.
- **NF2 Accessibility**: WCAG 2.1 AA — focus-visible 2px solid primary + 2px offset, aria-pressed/aria-label/aria-valuenow, keyboard operable (Space toggle, Arrow slider, Arrow Up/Down/Enter/Esc SearchableSelect, Enter/Esc HintIcon). SearchableSelect = combobox pattern per WAI-ARIA.
- **NF3 Visual consistency**: Dark + light mode đều đúng token, no hardcoded color. Tất cả atoms phải dùng CSS variables từ `theme.css` (no hardcoded hex).
- **NF4 No regression**: 1449/1450 tests vẫn pass (1 pre-existing fail unrelated), tsc + lint + build pass.
- **NF5 Bundle size**: Không thêm dependency, atoms < 2KB each (CSS + TSX).
- **NF6 Boundary detection**: HintIcon popover không tràn viewport (flip-top/align-right/align-center).
- **NF7 Light/Dark mode sync**: Tất cả atoms (Toggle/Slider/ShortcutInput/SearchableSelect/HintIcon/SubtitlePreview) phải render đúng trong cả 2 mode. Toggle ON = `--color-primary` (dark: `#60a5fa`, light: `#2563eb`). Slider thumb = `--color-primary`. HintIcon popover bg = `--color-surface-hover`, border = `--color-border`, text = `--color-text`. SearchableSelect menu bg = `--color-background`, border = `--color-border`, highlight = `--color-primary-subtle`. SubtitlePreview black bg (independent of theme). Browser verify Edge MCP: toggle theme, assert computed color match tokens.

## Acceptance Criteria (A)

- **A1**: 3 toggle render đúng switch pill, click toggle state, aria-pressed update, focus-visible đúng.
- **A2**: 3 slider render đúng styled track + thumb, drag update value, focus-visible đúng.
- **A3**: 5 shortcut input render đúng uppercase + center, type 1 char update + normalize lowercase.
- **A4**: SubtitlePreview render black bg + white text + apply OverlayStyleConfig realtime.
- **A5**: 2 SearchableSelect render đúng trigger + menu + search, filter case-insensitive, arrow key navigation, single-select with check mark.
- **A6**: 6 HintIcon render đúng icon + popover, boundary detection (flip-top/align-right/align-center), click outside dismiss, Esc key dismiss.
- **A7**: Dark mode + light mode đều đúng (verify Edge MCP).
- **A8**: `npm run test:unit` pass (new atom tests + existing tests), `npx tsc --noEmit` pass, `npm run lint` no new errors, `npm run build` pass.
- **A9**: Browser verify (Edge MCP): popover 480px, sidebar + cards, 3 toggle + 3 slider + 5 shortcut + 1 preview + 2 searchable-select + 6 hint-icon render đúng, dark/light toggle đúng.
- **A10**: Preserve data-testid: `nav-cluster-enabled-toggle`, `nav-cluster-button-size`, `nav-cluster-bg-opacity`, `nav-cluster-button-opacity`, `shortcut-*`.

## Out of Scope

- Không thêm/sửa setting key
- Không đổi settings storage schema
- Không đổi `SubtitleStylePanel` controls (chỉ thêm preview)
- Không đổi `MultiSelect` (đã đúng, chỉ reuse filter logic)
- Không thêm setting mới
- Không đổi `IconButton` (header close button giữ nguyên)
- Không đổi CustomSelect cho các field có ≤7 options (YAGNI — chỉ thay 2 language selects ~184 items)

## Risks

| Risk | Mitigation |
|---|---|
| Snap logic button size (40/48/56) bị break khi tách Slider atom | Caller truyền onChange, snap ở parent `NavClusterSettingsPanel` — atom chỉ render + emit |
| SubtitlePreview style apply sai (OverlayStyleConfig field mismatch) | Test unit: render với mock config, assert style props |
| Toggle a11y regression (aria-pressed) | Test unit: assert `aria-pressed` reflect checked |
| Dark mode token sai | Browser verify Edge MCP dark + light, assert computed color |
