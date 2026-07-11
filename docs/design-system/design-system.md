# Cell Design System

> Source of truth for UI consistency across the Cell extension. All new components must consume these tokens and follow the component specs below. Legacy GitHub/YouTube reference files (`design-dark-github.*`, `design-light-youtube.*`) are inspirational only — this file is the runtime standard.

## 1. Principles

1. **Token-first.** No raw hex, rgba, or hardcoded font values in components. Use `var(--*)` tokens.
2. **Three-layer tokens.** Primitive → Semantic → Component. Components read component tokens; component tokens read semantic tokens.
3. **Runtime themable.** The `ThemeProvider` + `themeManager` apply the semantic layer to `:root` at runtime. New components must work when these variables change.
4. **One component, one behavior.** `Button`, `Input`, `Card`, etc. live in `src/shared/ui/`. Do not recreate button styles in feature pages.
5. **Accessibility built-in.** Focus-visible ring, disabled opacity, `aria-*` states, color contrast.
6. **Content-script isolation.** Primitive length and font tokens are implemented in `px` in the content-script isolated world. `rem` cannot be isolated from the host page's `<html>` font-size, so using it would make the UI scale unpredictably on sites like YouTube (e.g. `html { font-size: 10px; }` turns `1rem` into `10px`). Popup/options pages may continue to use `rem` because they control their own root.

## 2. Token Architecture

```
┌──────────────────────────────────────┐
│ Component Tokens                     │ --button-bg, --input-border
├──────────────────────────────────────┤
│ Semantic Tokens                      │ --color-primary, --color-surface
├──────────────────────────────────────┤
│ Primitive Tokens                     │ --color-blue-600, --space-4
└──────────────────────────────────────┘
```

### 2.1 Primitive Tokens

Raw values. Change only when the brand palette changes.

> **Content-script note:** the tables below list `rem` values and their `px` equivalents for conceptual design. In the content-script runtime (`src/shared/lib/themeTokens.ts`), length and font-size tokens are injected as `px` equivalents to prevent the host page's root font-size from breaking the UI. Popup/options pages use `ThemeProvider`/`themeManager` and may use `rem` because they own the `<html>` root.

#### Color Scale

| Token | Value | Notes |
|-------|-------|-------|
| `--color-blue-500` | `#3B82F6` | Light primary |
| `--color-blue-600` | `#2563EB` | Default primary |
| `--color-blue-700` | `#1D4ED8` | Primary hover |
| `--color-blue-800` | `#1E40AF` | Primary active |
| `--color-gray-50` | `#F9FAFB` | Lightest surface |
| `--color-gray-100` | `#F3F4F6` | Secondary surface |
| `--color-gray-200` | `#E5E7EB` | Borders light |
| `--color-gray-300` | `#D1D5DB` | Input borders light |
| `--color-gray-400` | `#9CA3AF` | Muted text light |
| `--color-gray-500` | `#6B7280` | Secondary text light |
| `--color-gray-600` | `#4B5563` | Muted text dark |
| `--color-gray-700` | `#374151` | Secondary text dark |
| `--color-gray-800` | `#1F2937` | Surface dark |
| `--color-gray-900` | `#111827` | Background dark |
| `--color-gray-950` | `#030712` | Deepest dark |
| `--color-green-600` | `#16A34A` | Success |
| `--color-yellow-500` | `#EAB308` | Warning |
| `--color-red-500` | `#EF4444` | Error light |
| `--color-red-600` | `#DC2626` | Error default |
| `--color-red-700` | `#B91C1C` | Error hover |

#### Spacing (4px base)

| Token | Value | Pixels |
|-------|-------|--------|
| `--space-0` | 0 | 0 |
| `--space-0-5` | 0.125rem | 2px |
| `--space-1` | 0.25rem | 4px |
| `--space-1-5` | 0.375rem | 6px |
| `--space-2` | 0.5rem | 8px |
| `--space-2-5` | 0.625rem | 10px |
| `--space-3` | 0.75rem | 12px |
| `--space-3-5` | 0.875rem | 14px |
| `--space-4` | 1rem | 16px |
| `--space-5` | 1.25rem | 20px |
| `--space-6` | 1.5rem | 24px |
| `--space-8` | 2rem | 32px |
| `--space-10` | 2.5rem | 40px |
| `--space-12` | 3rem | 48px |
| `--space-16` | 4rem | 64px |

#### Typography

| Token | Value | Pixels |
|-------|-------|--------|
| `--font-size-xs` | 0.75rem | 12px |
| `--font-size-sm` | 0.875rem | 14px (default 13px in popup) |
| `--font-size-base` | 1rem | 16px |
| `--font-size-lg` | 1.125rem | 18px |
| `--font-size-xl` | 1.25rem | 20px |
| `--font-size-2xl` | 1.5rem | 24px |
| `--font-size-3xl` | 1.875rem | 30px |
| `--font-size-4xl` | 2.25rem | 36px |

| Token | Value |
|-------|-------|
| `--font-weight-regular` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |
| `--leading-none` | 1 |
| `--leading-tight` | 1.25 |
| `--leading-snug` | 1.375 |
| `--leading-normal` | 1.5 |
| `--tracking-tight` | -0.025em |
| `--tracking-normal` | 0 |
| `--tracking-wide` | 0.025em |

#### Border Radius

| Token | Value |
|-------|-------|
| `--radius-none` | 0 |
| `--radius-sm` | 6px |
| `--radius-md` | 8px |
| `--radius-lg` | 12px |
| `--radius-xl` | 16px |
| `--radius-2xl` | 24px |
| `--radius-full` | 9999px |

#### Shadows

| Token | Value |
|-------|-------|
| `--shadow-none` | none |
| `--shadow-sm` | `0 1px 2px rgb(0 0 0 / 0.05)` |
| `--shadow-md` | `0 4px 12px rgb(0 0 0 / 0.08)` |
| `--shadow-lg` | `0 10px 24px rgb(0 0 0 / 0.12)` |

#### Motion

| Token | Value |
|-------|-------|
| `--duration-75` | 75ms |
| `--duration-150` | 150ms |
| `--duration-200` | 200ms |
| `--duration-300` | 300ms |
| `--duration-fast` | var(--duration-150) |
| `--duration-normal` | var(--duration-200) |
| `--duration-slow` | var(--duration-300) |
| `--ease-standard` | ease-in-out |
| `--ease-out` | ease-out |
| `--ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) |

#### Z-Index

| Token | Value |
|-------|-------|
| `--z-dropdown` | 1000 |
| `--z-sticky` | 1100 |
| `--z-modal` | 1200 |
| `--z-popover` | 1300 |
| `--z-tooltip` | 1400 |

### 2.2 Semantic Tokens

Applied to `:root` by `themeManager` at runtime. These are the variables components should read.

#### Background & Foreground

| Token | Light | Dark |
|-------|-------|------|
| `--color-background` | `#ffffff` | `#0f172a` |
| `--color-foreground` | `#0f172a` | `#f1f5f9` |
| `--color-surface` | `#f8fafc` | `#1e293b` |
| `--color-surface-hover` | `#f1f5f9` | `#334155` |
| `--color-card` | `#ffffff` | `#1e293b` |
| `--color-card-foreground` | `#0f172a` | `#f1f5f9` |
| `--color-popover` | `#ffffff` | `#1e293b` |
| `--color-popover-foreground` | `#0f172a` | `#f1f5f9` |

#### Primary

| Token | Light | Dark |
|-------|-------|------|
| `--color-primary` | `#2563EB` | `#60a5fa` |
| `--color-primary-hover` | `#1D4ED8` | `#3b82f6` |
| `--color-primary-active` | `#1E40AF` | `#2563eb` |
| `--color-primary-foreground` | `#ffffff` | `#0f172a` |
| `--color-primary-subtle` | `rgba(37,99,235,0.1)` | `rgba(96,165,250,0.15)` |

#### Secondary

| Token | Light | Dark |
|-------|-------|------|
| `--color-secondary` | `#f1f5f9` | `#334155` |
| `--color-secondary-hover` | `#e2e8f0` | `#475569` |
| `--color-secondary-foreground` | `#0f172a` | `#f1f5f9` |

#### Muted & Accent

| Token | Light | Dark |
|-------|-------|------|
| `--color-muted` | `#f1f5f9` | `#334155` |
| `--color-muted-foreground` | `#64748b` | `#94a3b8` |
| `--color-accent` | `#f1f5f9` | `#334155` |
| `--color-accent-foreground` | `#0f172a` | `#f1f5f9` |

#### Destructive & Status

| Token | Light | Dark |
|-------|-------|------|
| `--color-destructive` | `#dc2626` | `#ef4444` |
| `--color-destructive-hover` | `#b91c1c` | `#dc2626` |
| `--color-destructive-foreground` | `#ffffff` | `#ffffff` |
| `--color-success` | `#16a34a` | `#10b981` |
| `--color-warning` | `#eab308` | `#f59e0b` |
| `--color-error` | `#ef4444` | `#ef4444` |
| `--color-error-subtle` | `rgba(239,68,68,0.08)` | `rgba(239,68,68,0.15)` |
| `--color-warning-subtle` | `rgba(245,158,11,0.1)` | `rgba(245,158,11,0.15)` |
| `--color-info` | `#3b82f6` | `#60a5fa` |

#### Border & Ring

| Token | Light | Dark |
|-------|-------|------|
| `--color-border` | `#e2e8f0` | `#334155` |
| `--color-border-subtle` | `#f1f5f9` | `#1e293b` |
| `--color-border-focus` | `#2563EB` | `#60a5fa` |
| `--color-input` | `#e2e8f0` | `#334155` |
| `--color-ring` | `#2563EB` | `#60a5fa` |

#### Text

| Token | Light | Dark |
|-------|-------|------|
| `--color-text` | `#0f172a` | `#f1f5f9` |
| `--color-text-secondary` | `#475569` | `#cbd5e1` |
| `--color-text-muted` | `#94a3b8` | `#64748b` |
| `--color-text-inverse` | `#ffffff` | `#0f172a` |

#### Scrollbar

| Token | Light | Dark |
|-------|-------|------|
| `--color-scrollbar-thumb` | `#cbd5e1` | `#475569` |
| `--color-scrollbar-thumb-hover` | `#94a3b8` | `#64748b` |
| `--color-scrollbar-track` | transparent | transparent |

### 2.3 Component Tokens

Component tokens map semantic tokens to component properties. Use these in component CSS modules.

```css
/* Button */
--button-bg: var(--color-primary);
--button-fg: var(--color-primary-foreground);
--button-hover-bg: var(--color-primary-hover);
--button-active-bg: var(--color-primary-active);
--button-padding-x: var(--space-4);
--button-padding-y: var(--space-2);
--button-radius: var(--radius-md);
--button-font-size: var(--font-size-sm);
--button-font-weight: var(--font-weight-medium);
--button-height: 32px;
--button-height-sm: 28px;
--button-height-lg: 40px;

--button-secondary-bg: var(--color-secondary);
--button-secondary-fg: var(--color-secondary-foreground);
--button-secondary-hover-bg: var(--color-secondary-hover);

--button-outline-border: var(--color-border);
--button-outline-fg: var(--color-foreground);
--button-outline-hover-bg: var(--color-accent);

--button-ghost-fg: var(--color-foreground);
--button-ghost-hover-bg: var(--color-accent);

--button-destructive-bg: var(--color-destructive);
--button-destructive-fg: var(--color-destructive-foreground);
--button-destructive-hover-bg: var(--color-destructive-hover);

--button-disabled-opacity: 0.5;
--button-focus-ring: var(--color-ring);

/* Input */
--input-bg: var(--color-background);
--input-border: var(--color-input);
--input-fg: var(--color-foreground);
--input-placeholder: var(--color-muted-foreground);
--input-focus-border: var(--color-ring);
--input-focus-ring: 0 0 0 3px var(--color-primary-subtle);
--input-error-border: var(--color-error);
--input-error-fg: var(--color-error);
--input-disabled-bg: var(--color-muted);
--input-disabled-fg: var(--color-muted-foreground);
--input-padding-x: var(--space-3);
--input-padding-y: var(--space-2);
--input-radius: var(--radius-md);
--input-font-size: var(--font-size-sm);
--input-height: 32px;
--input-height-lg: 40px;

/* Card */
--card-bg: var(--color-card);
--card-fg: var(--color-card-foreground);
--card-border: var(--color-border);
--card-padding: var(--space-4);
--card-padding-sm: var(--space-3);
--card-gap: var(--space-3);
--card-radius: var(--radius-lg);
--card-shadow: var(--shadow-sm);
--card-shadow-hover: var(--shadow-md);

/* Badge */
--badge-bg: var(--color-primary);
--badge-fg: var(--color-primary-foreground);
--badge-secondary-bg: var(--color-secondary);
--badge-secondary-fg: var(--color-secondary-foreground);
--badge-outline-border: var(--color-border);
--badge-outline-fg: var(--color-foreground);
--badge-destructive-bg: var(--color-destructive);
--badge-destructive-fg: var(--color-destructive-foreground);
--badge-padding-x: var(--space-2);
--badge-padding-y: var(--space-0-5);
--badge-radius: var(--radius-full);
--badge-font-size: var(--font-size-xs);

/* Alert */
--alert-bg: var(--color-background);
--alert-fg: var(--color-foreground);
--alert-border: var(--color-border);
--alert-success-bg: var(--color-success);
--alert-success-fg: var(--color-text-inverse);
--alert-warning-bg: var(--color-warning);
--alert-warning-fg: var(--color-foreground);
--alert-error-bg: var(--color-error);
--alert-error-fg: var(--color-text-inverse);
--alert-padding: var(--space-4);
--alert-radius: var(--radius-lg);

/* Dialog */
--dialog-overlay-bg: rgb(0 0 0 / 0.5);
--dialog-bg: var(--color-background);
--dialog-fg: var(--color-foreground);
--dialog-border: var(--color-border);
--dialog-shadow: var(--shadow-lg);
--dialog-padding: var(--space-6);
--dialog-radius: var(--radius-lg);
--dialog-max-width-sm: 24rem;
--dialog-max-width: 32rem;
--dialog-max-width-lg: 40rem;

/* IconButton (existing) */
--iconbutton-bg: transparent;
--iconbutton-fg: var(--color-text-muted);
--iconbutton-hover-bg: var(--color-surface-hover);
--iconbutton-hover-fg: var(--color-text);
--iconbutton-active-bg: var(--color-primary-subtle);
--iconbutton-active-fg: var(--color-primary);
--iconbutton-danger-hover-bg: var(--color-error-subtle);
--iconbutton-danger-hover-fg: var(--color-error);
--iconbutton-size-xs: 24px;
--iconbutton-size-sm: 28px;
--iconbutton-size-md: 32px;
--iconbutton-radius: var(--radius-sm);
```

## 3. Component Specifications

### 3.1 Button

Primary click target. Must be implemented in `src/shared/ui/Button.tsx` + `Button.module.css`.

#### Variants

| Variant | Background | Text | Border | Use Case |
|---------|------------|------|--------|----------|
| `primary` | `--button-bg` | `--button-fg` | none | Main CTA |
| `secondary` | `--button-secondary-bg` | `--button-secondary-fg` | none | Secondary action |
| `outline` | transparent | `--color-text` | `--color-border` | Tertiary action |
| `ghost` | transparent | `--color-text` | none | Subtle action |
| `destructive` | `--button-destructive-bg` | `--button-destructive-fg` | none | Delete, remove, cancel danger |
| `link` | transparent | `--color-primary` | none | Inline navigation |

#### Sizes

| Size | Height | Padding X | Padding Y | Font Size | Border Radius |
|------|--------|-----------|-----------|-----------|---------------|
| `sm` | 28px | 12px | 6px | `--font-size-xs` | `--radius-md` |
| `md` | 32px | 16px | 8px | `--font-size-sm` | `--radius-md` |
| `lg` | 40px | 20px | 10px | `--font-size-sm` | `--radius-md` |

#### States

| State | Rule |
|-------|------|
| `hover` | `background: <variant-hover-bg>` |
| `active` | `background: <variant-active-bg>`; `transform: scale(0.98)` optional |
| `focus-visible` | `box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring)` |
| `disabled` | `opacity: 0.5; pointer-events: none; cursor: not-allowed` |
| `loading` | `pointer-events: none;` spinner replaces leading icon; children dimmed to 0.7 |

#### Props

```ts
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}
```

### 3.2 IconButton

Already exists. Use as-is. Reference: <ref_file file="d:/Tool/learning apply skill/cell/src/shared/ui/IconButton.tsx" />

### 3.3 Input

Text input. Implement in `src/shared/ui/Input.tsx`.

| State | Border | Background | Ring/Shadow |
|-------|--------|------------|-------------|
| default | `--input-border` | `--input-bg` | none |
| hover | `--color-border-focus` (subtle) | `--input-bg` | none |
| focus | `--color-ring` | `--input-bg` | `--input-focus-ring` |
| error | `--input-error-border` | `--input-bg` | `0 0 0 3px var(--color-error-subtle)` |
| disabled | `--input-border` | `--input-disabled-bg` | none; opacity 0.5 |

### 3.4 Card

Container for grouped content.

| Variant | Background | Border | Shadow | Use Case |
|---------|------------|--------|--------|----------|
| `default` | `--card-bg` | `--card-border` | `--card-shadow` | Static container |
| `interactive` | `--card-bg` | `--card-border` | `--card-shadow` | Clickable card; hover → `--card-shadow-hover` and `--color-surface-hover` |
| `selected` | `--color-primary-subtle` | `--color-primary` | none | Active selection |

### 3.5 Dialog

Modal overlay. Use `role="dialog"` + `aria-modal="true"`.

- Overlay: `--dialog-overlay-bg`
- Panel: `--dialog-bg`, `--dialog-border`, `--dialog-radius`, `--dialog-padding`, `--dialog-shadow`
- Max-width: `sm/md/lg` via props
- Close with `Esc`, overlay click, or close button
- Focus trap first focusable element

### 3.6 Alert

Message banner. Inline, not toast.

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| `default` | `--alert-bg` | `--alert-fg` | `--alert-border` |
| `success` | `--color-success` | `--color-text-inverse` | none |
| `warning` | `--color-warning` | `--color-foreground` | none |
| `error` | `--color-error` | `--color-text-inverse` | none |

### 3.7 Badge

Small status label.

| Variant | Background | Text |
|---------|------------|------|
| `default` | `--badge-bg` | `--badge-fg` |
| `secondary` | `--badge-secondary-bg` | `--badge-secondary-fg` |
| `outline` | transparent | `--badge-outline-fg`; border `--badge-outline-border` |
| `destructive` | `--badge-destructive-bg` | `--badge-destructive-fg` |

### 3.8 Existing Atoms to Preserve

| Component | Notes |
|-----------|-------|
| `Toggle` | Already tokenized. Continue using `aria-pressed` + disabled opacity. |
| `Slider` | Already tokenized. Continue range input styling. |
| `SearchableSelect` | Already tokenized. Single-select dropdown with search. |
| `HintIcon` | Already tokenized. Popover with boundary detection. |
| `ShortcutInput` | Already tokenized. Pill keyboard shortcut input. |

## 4. Layout & Spacing

### 4.1 Spacing Scale

Use the `--space-*` primitive tokens. Common component gaps:

| Usage | Token |
|-------|-------|
| Tight internal gap | `--space-1` / `--space-1-5` |
| Standard element gap | `--space-2` |
| Section/card internal gap | `--space-3` |
| Card padding | `--space-4` |
| Section vertical gap | `--space-6` / `--space-8` |

### 4.2 Border Radius

| Usage | Token |
|-------|-------|
| Inputs, buttons, small tags | `--radius-md` (8px) |
| Cards, panels, modals | `--radius-lg` (12px) |
| Pills, badges, toggles | `--radius-full` |

### 4.3 Shadows

| Usage | Token |
|-------|-------|
| Cards, small elevations | `--shadow-sm` |
| Dropdowns, popovers | `--shadow-md` |
| Modals, overlays | `--shadow-lg` |

## 5. Motion

### 5.1 Standard Transitions

```css
.interactive {
  transition-property: color, background-color, border-color, box-shadow;
  transition-duration: var(--duration-fast);
  transition-timing-function: var(--ease-in-out);
}
```

### 5.2 Timing Rules

| Change Type | Duration | Easing |
|-------------|----------|--------|
| Color/background/border | 150ms | `--ease-in-out` |
| Transform/scale | 200ms | `--ease-out` |
| Opacity | 150ms | `--ease-standard` |
| Shadow | 200ms | `--ease-out` |
| Loading spin | 1s | linear |

### 5.3 Enter/Exit Animation

Optional for panels:

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Use `--duration-normal` for enter; do not animate layout properties (`width`, `height`) unless using `max-height` with known limits.

## 6. Focus & Accessibility

### 6.1 Focus Ring

Use `:focus-visible` universally. Do not remove outline without replacement.

```css
.focusable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-background),
              0 0 0 4px var(--color-ring);
}
```

### 6.2 Disabled State

- Opacity: `0.5`
- `pointer-events: none`
- `cursor: not-allowed`
- For buttons, use `disabled` attribute
- For buttons that need to remain focusable, use `aria-disabled="true"` (rare)

### 6.3 Color Contrast

- Normal text: minimum 4.5:1
- Large text (18px+): minimum 3:1
- UI components and focus indicators: minimum 3:1

## 7. Component Library File Structure

```
src/shared/ui/
├── index.ts                 # Barrel exports
├── Button.tsx
├── Button.module.css
├── Button.test.tsx
├── IconButton.tsx
├── IconButton.module.css
├── Input.tsx
├── Input.module.css
├── Card.tsx
├── Card.module.css
├── Dialog.tsx
├── Dialog.module.css
├── Badge.tsx
├── Badge.module.css
├── Alert.tsx
├── Alert.module.css
├── Toggle.tsx
├── Toggle.module.css
├── Slider.tsx
├── Slider.module.css
├── SearchableSelect.tsx
├── SearchableSelect.module.css
├── HintIcon.tsx
├── HintIcon.module.css
└── ShortcutInput.tsx
└── ShortcutInput.module.css
```

## 8. Usage Rules

1. **No raw colors.** Any new CSS must use `var(--*)` tokens. Hardcoded values are only allowed in `themeConfig.ts` defaults and primitive definitions.
2. **No component-style duplication.** If a button appears in a feature, use `Button` from `src/shared/ui/`. If a custom look is needed, extend via `variant`/`className`, not new CSS.
3. **Named exports.** All components use `export function Name` (no default export).
4. **Colocated tests.** `Button.tsx` → `Button.test.tsx`.
5. **CSS Modules.** One module per component. No global CSS for component styles.
6. **Theme aware.** Test both light and dark in Storybook or ThemePanel preview.

## 9. Migration from Legacy Tokens

The GitHub/YouTube reference files (`design-dark-github.*`, `design-light-youtube.*`) are **inspirational only**. When building production components, migrate as follows:

| Legacy GitHub token | Use instead |
|---------------------|-------------|
| `--color-snow` | `--color-text` or `--color-text-inverse` |
| `--color-pearl` | `--color-text-secondary` |
| `--color-moss` | `--color-text-muted` |
| `--color-slate-edge` | `--color-border` |
| `--color-obsidian` | `--color-surface` or `--color-card` |
| `--color-deep-void` | `--color-background` |
| `--color-terminal-green` | `--color-success` |
| `--font-mona-sans` | `--font-family` (Inter/system) |
| `--text-body` / `--text-body-sm` | `--font-size-base` / `--font-size-sm` |
| `--spacing-12` / `--spacing-16` | `--space-3` / `--space-4` |

## 10. Reference Links

- Runtime theme: `src/entrypoints/popup/styles/theme.css` <ref_file file="d:/Tool/learning apply skill/cell/src/entrypoints/popup/styles/theme.css" />
- Theme manager: `src/features/theme/logic/themeManager.ts` <ref_file file="d:/Tool/learning apply skill/cell/src/features/theme/logic/themeManager.ts" />
- Theme config defaults: `src/features/theme/logic/themeConfig.ts` <ref_file file="d:/Tool/learning apply skill/cell/src/features/theme/logic/themeConfig.ts" />
- Existing IconButton atom: `src/shared/ui/IconButton.tsx` <ref_file file="d:/Tool/learning apply skill/cell/src/shared/ui/IconButton.tsx" />
