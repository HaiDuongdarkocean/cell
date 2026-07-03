# Spec: Settings Controls Restyle

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — auto-proceed (anh ủy quyền quyết đến hết workflow)
> **Date**: 2026-07-04
> **Intent source**: `docs/intent/intent-settings-controls-restyle.md`
> **Mockup source**: `docs/mockups/mockup-settings-grouped.html` (G0.5 confirmed 2026-07-03)

## Objective

Restyle 4 control types trong Settings panel để khớp mockup đã confirm — Toggle switch pill, styled Slider, ShortcutInput uppercase, SubtitlePreview box — mà **không phá behavior/data wiring** đã hoạt động. Mục tiêu duy nhất: UI đẹp + UX phù hợp người dùng.

**User**: Người dùng extension mở Settings popup, tương tác toggle/slider/shortcut/preview.

**Why now**: Layout "vỏ" (sidebar + 5 cards) đã done G4 partial, nhưng control types sai mockup — `IconButton` star icon thay vì toggle switch pill, native slider thay vì styled slider, text input thường thay vì shortcut input uppercase, không có subtitle preview. Gap rõ ràng giữa mockup confirmed và implementation.

**Success**:
- 3 toggle = switch pill 32×18px, slide animation, ON = primary bg + thumb translateX(14px)
- 3 slider = styled 4px track + 14px round thumb primary color + 2px white border + shadow
- 5 shortcut input = uppercase + semibold + center + `--radius-sm` border
- 1 subtitle preview = black bg + white text + center, "This is how the target/native subtitle will look."
- Tất cả preserve: data-testid, onChange handlers, settings keys, persistence, a11y
- Dark + light mode đều đúng
- Tests pass (unit + tsc + lint + build)

## Assumptions

1. **4 atom/components mới**, colocate tests:
   - `src/shared/ui/Toggle.tsx` + `.module.css` + `.test.tsx`
   - `src/shared/ui/Slider.tsx` + `.module.css` + `.test.tsx`
   - `src/shared/ui/ShortcutInput.tsx` + `.module.css` + `.test.tsx`
   - `src/features/settings/ui/SubtitlePreview.tsx` + `.module.css` + `.test.tsx`
2. **Toggle/Slider/ShortcutInput** = shared atoms (`src/shared/ui/`) — reusable cho future settings.
3. **SubtitlePreview** = feature component (`src/features/settings/ui/`) — chỉ dùng trong settings.
4. **Preserve data-testid**: `nav-cluster-enabled-toggle`, `nav-cluster-button-size`, `nav-cluster-bg-opacity`, `nav-cluster-button-opacity`, `shortcut-prev-cue`, `shortcut-next-cue`, `shortcut-replay-cue`, `shortcut-toggle-overlay`, `shortcut-toggle-panel`.
5. **Preserve a11y**: `aria-pressed` (toggle), `aria-label`, `aria-valuenow` (slider), focus-visible 2px solid primary + 2px offset.
6. **No new dependency** — ponytail rung 5: native `<input type="range">` + `<button>` + CSS. Không lib toggle/slider.
7. **No new setting key** — chỉ render lại existing controls.
8. **IconButton** giữ nguyên cho header (close button) — không thay.
9. **SubtitleStylePanel** giữ nguyên (đã đúng) — chỉ thêm preview box bên trên/bên dưới.
10. **Dark mode**: toggle ON = `--color-primary` (dark: `#60a5fa`, light: `#2563eb`), slider thumb same.

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
- **F1.1**: Switch pill 32×18px, border-radius `--radius-full`, bg `--color-border` khi OFF, `--color-primary` khi ON.
- **F1.2**: Thumb 14×14px white circle, translateX(0) khi OFF, translateX(14px) khi ON, transition `transform var(--transition)`.
- **F1.3**: Click → gọi `onChange(!checked)`, `aria-pressed` reflect state.
- **F1.4**: `aria-label` required, focus-visible 2px solid primary + 2px offset.
- **F1.5**: Props: `checked: boolean`, `onChange: (next: boolean) => void`, `ariaLabel: string`, `id?: string`, `dataTestId?: string`.

### F2: Slider atom
- **F2.1**: Native `<input type="range">` styled: track 4px height, bg `--color-border`, radius 2px.
- **F2.2**: Thumb 14×14px round, bg `--color-primary`, border 2px solid `--color-background`, shadow `0 1px 2px rgba(0,0,0,0.2)`.
- **F2.3**: Focus-visible 2px solid primary + 2px offset.
- **F2.4**: Props: `value: number`, `min: number`, `max: number`, `step: number`, `onChange: (v: number) => void`, `ariaLabel: string`, `id?: string`, `dataTestId?: string`.
- **F2.5**: Preserve snap logic cho button size (40/48/56 presets) — caller truyền onChange, snap ở parent.

### F3: ShortcutInput atom
- **F3.1**: `<input type="text">` width 40px, padding 6px 8px, font-size `--font-size-sm`, font-weight `--font-weight-semibold`, text-align center, text-transform uppercase.
- **F3.2**: Border 1px solid `--color-border`, radius `--radius-sm`, bg `--color-surface`.
- **F3.3**: Focus-visible 2px solid primary + 2px offset.
- **F3.4**: maxLength 1, normalize lowercase slice(0,1) on change.
- **F3.5**: Props: `value: string`, `onChange: (key: string) => void`, `ariaLabel: string`, `id?: string`, `dataTestId?: string`.

### F4: SubtitlePreview component
- **F4.1**: Black bg (`#000`), white text (`#fff`), padding `--spacing-md`, radius `--radius-sm`, text-align center, font-size 13px, line-height 1.4.
- **F4.2**: Text sample: "This is how the {role} subtitle will look." (role = target | native).
- **F4.3**: Apply style từ `OverlayStyleConfig` (fontSize, textColor, backgroundColor, textShadow, fontFamily, opacity) — realtime reflect SubtitleStylePanel controls.
- **F4.4**: Props: `style: OverlayStyleConfig`, `role: 'target' | 'native'`.

### F5: Integration — replace existing controls
- **F5.1**: 3 toggle (auto-select, overlay auto-load, nav cluster enable) → `Toggle` atom.
- **F5.2**: 3 slider (nav cluster button size, bg opacity, button opacity) → `Slider` atom.
- **F5.3**: 5 shortcut input → `ShortcutInput` atom.
- **F5.4**: Subtitle appearance field → add `SubtitlePreview` bên trên SubtitleStylePanel.
- **F5.5**: Preserve tất cả data-testid + onChange handlers + settings keys.

## Non-Functional Requirements (NF)

- **NF1 Performance**: Toggle click < 16ms (CSS transition only), slider drag không lag (native input).
- **NF2 Accessibility**: WCAG 2.1 AA — focus-visible 2px solid primary + 2px offset, aria-pressed/aria-label/aria-valuenow, keyboard operable (Space toggle, Arrow slider).
- **NF3 Visual consistency**: Dark + light mode đều đúng token, no hardcoded color.
- **NF4 No regression**: 1449/1450 tests vẫn pass (1 pre-existing fail unrelated), tsc + lint + build pass.
- **NF5 Bundle size**: Không thêm dependency, atoms < 2KB each (CSS + TSX).

## Acceptance Criteria (A)

- **A1**: 3 toggle render đúng switch pill, click toggle state, aria-pressed update, focus-visible đúng.
- **A2**: 3 slider render đúng styled track + thumb, drag update value, focus-visible đúng.
- **A3**: 5 shortcut input render đúng uppercase + center, type 1 char update + normalize lowercase.
- **A4**: SubtitlePreview render black bg + white text + apply OverlayStyleConfig realtime.
- **A5**: Dark mode + light mode đều đúng (verify Edge MCP).
- **A6**: `npm run test:unit` pass (new atom tests + existing tests), `npx tsc --noEmit` pass, `npm run lint` no new errors, `npm run build` pass.
- **A7**: Browser verify (Edge MCP): popover 480px, sidebar + cards, 3 toggle + 3 slider + 5 shortcut + 1 preview render đúng, dark/light toggle đúng.
- **A8**: Preserve data-testid: `nav-cluster-enabled-toggle`, `nav-cluster-button-size`, `nav-cluster-bg-opacity`, `nav-cluster-button-opacity`, `shortcut-*`.

## Out of Scope

- Không thêm/sửa setting key
- Không đổi settings storage schema
- Không đổi `SubtitleStylePanel` controls (chỉ thêm preview)
- Không đổi `MultiSelect`/`CustomSelect` (đã đúng)
- Không thêm setting mới
- Không đổi `IconButton` (header close button giữ nguyên)

## Risks

| Risk | Mitigation |
|---|---|
| Snap logic button size (40/48/56) bị break khi tách Slider atom | Caller truyền onChange, snap ở parent `NavClusterSettingsPanel` — atom chỉ render + emit |
| SubtitlePreview style apply sai (OverlayStyleConfig field mismatch) | Test unit: render với mock config, assert style props |
| Toggle a11y regression (aria-pressed) | Test unit: assert `aria-pressed` reflect checked |
| Dark mode token sai | Browser verify Edge MCP dark + light, assert computed color |
