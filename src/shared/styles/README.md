# Design System — Codebase Reference

> Single source of truth for AI agents writing UI code.
> **Standard (ngôn ngữ chung + naming convention):** `src/shared/styles/STANDARD.md` — đọc đầu tiên.
> `tokens.json` = token source (sửa ở đây). `tokens.css` = generated artifact. `src/shared/ui/*.module.css` = component patterns.
> Reference: `docs/design-system/daft.md` (Meta/Astryx best practices).

## Token file

`src/shared/styles/tokens.json` — canonical design-token source (core colors, derived colors, static tokens, component tokens).
`src/shared/styles/tokens.css` — generated from `tokens.json`, imported by all 3 entrypoints (popup, sidepanel, options).
Defines `:root` (light) + `[data-theme="dark"]` (dark) CSS custom properties.

**Regenerate after editing `tokens.json`:**
```bash
node scripts/generate-tokens.js
```

`predev`/`prebuild` in `package.json` also regenerate `tokens.css` so the artifact stays in sync.

**Import in new entrypoint:**
```ts
import '@/shared/styles/tokens.css';
```

## Cách sửa token và gọi nó (SSOT)

| # | Việc cần làm | BAD — không làm | GOOD — làm thế này |
|---|-------------|-----------------|-------------------|
| 1 | Đổi giá trị token | Hardcoded `padding: 16px` trong từng file CSS | Sửa 1 chỗ: `tokens.json` → `"4": "20px"` |
| 2 | Sinh lại file artifact | Sửa tokens.json rồi quên regenerate | Chạy `node scripts/generate-tokens.js` (hoặc `npm run dev` — tự chạy) |
| 3 | Dùng trong React (popup/sidepanel/options) | `padding: 16px` — hardcoded, drift | `padding: var(--space-4, 16px)` — tokens.css tự `@import` |
| 4 | Dùng trong Shadow DOM (dictionary popup) | Copy-paste CSS vào Shadow Root | `import tokensCss from '...?raw'` → đổi `:root`→`:host` → inject `<style>` (ADR-076: font-size tokens dùng `px` tuyệt đối + `:host { font-size: var(--font-size-base) }` reset trong `components.css` để cô lập khỏi host `<html>` font-size) |
| 5 | Dùng trong content-script (subtitle/nav cluster) | Hardcoded `150ms` trong TS string | `var(--duration-fast, 150ms)` — tokens.ts đọc tokens.json, sinh CSS string |
| 6 | Dùng component | Tự tạo `<button className={styles.myBtn}>` + custom hover | `import { Button } from '@/shared/ui'` — hover/active đã có sẵn |

## 3 nguyên lý root (check mọi UI change)

| Nguyên lý | Rule | Token |
|-----------|------|-------|
| P1 Content-first | Flat, no shadow, hairline 1px border | `--shadow-*: none` |
| P2 Alpha states | Hover=surface-hover, Selected=primary-subtle, Focus=2px ring | `--color-surface-hover`, `--color-primary-subtle` |
| P3 Shape≠Color | Pill 18px (btn/input), Card 10px, Dialog 12px, Icon-btn full | `--radius-pill`, `--radius-card`, `--radius-dialog`, `--radius-full` |

## Hover pattern — UNIVERSAL

```css
/* CORRECT — every hoverable element */
:hover { background: var(--color-surface-hover); }

/* CORRECT — selected/active */
.selected { background: var(--color-primary-subtle); color: var(--color-primary); }

/* WRONG — don't use these for hover */
:hover { background: var(--color-accent); }      /* ← drift, use surface-hover */
:hover { background: var(--color-surface-hover); } /* ← hardcoded, use token */
```

## Component inventory — `src/shared/ui/`

| Component | File | CSS module | Tokens used |
|-----------|------|------------|-------------|
| Button | Button.tsx | Button.module.css | 40 var() |
| Card | Card.tsx | Card.module.css | 18 var() |
| Input | Input.tsx | Input.module.css | 29 var() |
| Select | Select.tsx | Select.module.css | 33 var() |
| Dialog | Dialog.tsx | Dialog.module.css | 31 var() |
| Checkbox | Checkbox.tsx | Checkbox.module.css | 31 var() |
| Radio | Radio.tsx | Radio.module.css | 32 var() |
| Toggle | Toggle.tsx | Toggle.module.css | 11 var() |
| Badge | Badge.tsx | Badge.module.css | 19 var() |
| Alert | Alert.tsx | Alert.module.css | 17 var() |
| Tabs | Tabs.tsx | Tabs.module.css | 18 var() |
| Accordion | Accordion.tsx | Accordion.module.css | 15 var() |
| Tooltip | Tooltip.tsx | Tooltip.module.css | 15 var() |
| IconButton | IconButton.tsx | IconButton.module.css | 13 var() |
| SearchableSelect | SearchableSelect.tsx | SearchableSelect.module.css | 46 var() |
| BottomSheet | BottomSheet.tsx | BottomSheet.module.css | 18 var() |
| Drawer | Drawer.tsx | Drawer.module.css | 21 var() |
| Sidebar | Sidebar.tsx | Sidebar.module.css | 11 var() |
| ListItem | ListItem.tsx | ListItem.module.css | 13 var() |
| NavItem | NavItem.tsx | NavItem.module.css | 19 var() |
| HintIcon | HintIcon.tsx | HintIcon.module.css | 19 var() |
| Progress | Progress.tsx | Progress.module.css | 6 var() |
| Skeleton | Skeleton.tsx | Skeleton.module.css | 4 var() |
| Slider | Slider.tsx | Slider.module.css | 8 var() |
| Spinner | Spinner.tsx | Spinner.module.css | 0 (primitive) |
| Textarea | Textarea.tsx | Textarea.module.css | 18 var() |
| Label | Label.tsx | Label.module.css | 10 var() |
| ShortcutInput | ShortcutInput.tsx | ShortcutInput.module.css | 22 var() |
| SearchField | SearchField.tsx | SearchField.module.css | 3 var() |
| EmptyState | EmptyState.tsx | EmptyState.module.css | 12 var() |

## Icon registry

`src/shared/icons/index.ts` — `ICON_CATALOG` with SVG icons.
`src/shared/icons/Icon.tsx` — `<Icon name="play" size={20} />` React component.

**Before adding new icon:** query `ICON_CATALOG` by tag → reuse, don't create duplicate.

## Audit checklist (run before merge)

```bash
# 1. Hardcoded colors (should be 0 outside tokens.css + SubtitlePreview)
grep -rn '#[0-9a-fA-F]\{3,8\}' src/ --include="*.css" | grep -v tokens.css | grep -v SubtitlePreview

# 2. Wrong hover token (should be 0)
grep -rn 'color-accent' src/ --include="*.css" | grep hover

# 3. Missing token import (options/popup/sidepanel must import tokens.css)
grep -rn 'tokens.css' src/entrypoints/
```

## When to read what

- **Bắt đầu session / viết UI mới** → đọc `src/shared/styles/STANDARD.md` (ngôn ngữ chung + naming convention)
- Adding NEW component (not in inventory above) → đọc `src/shared/ui/` component gần nhất → bắt chước pattern
- Changing token value → sửa `tokens.json` → chạy `node scripts/generate-tokens.js` → xong
- Unsure which variant to use → đọc component `.tsx` + `.module.css` trong `src/shared/ui/`
- Tham khảo best practice → `docs/design-system/daft.md`
