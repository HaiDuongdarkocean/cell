# Settings UI Patterns — Cell Extension

> **Status**: Reference patterns for SettingsDialog redesign. Token values from [../tokens/](../tokens/), patterns from YouTube/M3 research.

## 9.1 Sidebar Navigation

| Aspect | Value | Source | Our token |
|---|---|---|---|
| Position | Left | YouTube, M3, Android | — |
| Width | 120px (our popup 480px) / 240px (YouTube desktop) | YouTube | — |
| Item height | 40px | YouTube | — |
| Item padding | 8px 12px | YouTube (12px vertical scaled) | `--spacing-sm --spacing-md` |
| Active state | Pill background + text color change | YouTube | `--color-primary-subtle` bg + `--color-primary` text |
| Active border-radius | 10px (YouTube) / 8px (our `--radius-md`) | YouTube | `--radius-md` |
| Inactive text | `#606060` (YouTube) | YouTube | `--color-text-secondary` |
| Hover | Semi-transparent grey | YouTube | `--color-surface-hover` |
| Item gap | 2-4px vertical, 12px between groups | YouTube | `--spacing-xs` / `--spacing-md` |

## 9.2 Card Grouping

| Aspect | Value | Source | Our token |
|---|---|---|---|
| Card padding | 16px (compact popup) / 24px (YouTube desktop) | YouTube, M3 | `--spacing-lg` |
| Card border-radius | 10px (YouTube) / 8px (M3) | YouTube | `--radius-md` |
| Card border | 1px hairline | YouTube | `1px solid --color-border` |
| Section gap | 16px (compact) / 24-32px (YouTube) | YouTube | `--spacing-lg` |
| Content max-width | 680px (YouTube) / 720px (M3) | YouTube, M3 | Our popup 480px — within range |
| Grouping limit | Max 4-5 settings per card | SaaS patterns | — |
| Card structure | Header (title + count) + description + body | Windows SettingsCard | — |

## 9.3 Typography Hierarchy (Settings)

| Element | YouTube Size/Weight | M3 Equivalent | Our token |
|---|---|---|---|
| Page title | 22px / 500 | title-large | `--font-size-lg` (16px) — popup compact |
| Section header | 14px / 500 | title-small | `--font-size-base` (14px) + `--font-weight-semibold` |
| Field label | 14px / 400 | body-medium | `--font-size-xs` (12px) — compact |
| Description | 13px / 400 | body-small | `--font-size-xs` (12px) + `--color-text-muted` |
| Helper text | 12px / 400 | label-medium | `--font-size-xs` (12px) + `--color-text-muted` |
| Button text | 14px / 500 | label-large | `--font-size-sm` (13px) + `--font-weight-medium` |

> **Note**: Our popup uses compact sizes (smaller than YouTube desktop) due to 480px width constraint. Hierarchy proportions preserved.

## 9.4 Form Controls

| Control | YouTube Spec | Our implementation |
|---|---|---|
| Select dropdown | 40px height, 1px border, 4px radius, 8px 12px padding | `CustomSelect` — `--radius-md`, `--spacing-sm --spacing-md` padding |
| Toggle switch | 36px track, 14px height, 20px thumb, active = brand color | `IconButton` with `active` prop — visual toggle |
| Text input | 40px height, 1px border, 4px radius, focus = 2px signal blue | `.textInput` — `--radius-sm`, focus via `--color-primary` |
| Primary button | 36px height, brand color bg, white text, 4px radius | N/A — extension uses icon buttons primarily |
| Focus indicator | 2px solid signal blue, 2px offset | 2px solid `--color-primary`, 2px offset + `--color-primary-subtle` ring |

## 9.5 Dependency Patterns

| Pattern | When | Example |
|---|---|---|
| Place dependent below parent | Setting depends on another's value | Workers below Parallel Conversion |
| Brief explanation when unavailable | Dependent setting disabled | "Only available when Parallel = Manual" |
| Parent switch on subscreen | Toggle group of dependent settings | N/A — our settings flat |
| Disable + popover/tooltip if inherited | Child can't be changed | N/A — single-user extension |
| **Indent child** (2026-07-04) | Visual hierarchy child dưới parent | `.childField`: `margin-left + padding-left + border-left 2px --color-border-subtle` |

## 9.5a Layout Primitives (2026-07-04 — settings-dialog-rearrange)

| Primitive | CSS | Dùng cho | File |
|---|---|---|---|
| `.pairRow` | `display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);` | Pair 2 related fields side-by-side (colors, opacity, languages) | SettingsDialog.module.css, SubtitleStylePanel.module.css |
| `.childField` | `margin-left: var(--spacing-lg); padding-left: var(--spacing-md); border-left: 2px solid var(--color-border-subtle);` | Indent child dưới parent (dependency pattern) | SettingsDialog.module.css |
| `.divider` | `height: 1px; background: var(--color-border-subtle); margin: var(--spacing-xs) 0;` | Group separator trong section body | SettingsDialog.module.css |
| `.shortcutGrid` | `display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);` | 2-col grid cho keyboard shortcuts (compact) | SettingsDialog.module.css |

**Pairing rules:**
- Pair fields cùng loại (color+color, slider+slider, select+select)
- Pair fields cùng concern (font size + font family = "font group")
- Không pair fields khác loại nếu 1 cái cần full width (textarea, multiselect)

**Divider rules:**
- Divider giữa groups khác concern (languages → appearance → position)
- Không divider giữa fields cùng group
- Divider subtle (`--color-border-subtle`), không prominent

## 9.6 Danger Zone Patterns

| Pattern | When | Implementation |
|---|---|---|
| Distinct section at bottom | Destructive actions exist | If "Reset to defaults" added → separate card at bottom |
| Stronger visual framing | Signal "this is different" | `--color-error-subtle` background, `--color-error` border |
| Clearer consequence copy | User understands impact | "Reset all settings to defaults. This cannot be undone." |
| Friction proportional to consequence | Prevent accidental damage | Confirm dialog for reset, no confirm for toggle |
