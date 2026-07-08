# Color Tokens — Cell Extension

> **ADR-022 (2026-07-05)**: 9 core color tokens are now **runtime customizable** via `chrome.storage.local.themeConfig.customColors[mode]`. Secondary tokens (hover, subtle, focus, muted, inverse) are **derived** at runtime via `colorGenerator` (shade/tint/rgba) — not stored. See [Theme runtime customization](#theme-runtime-customization-adr-022) below.

## Core tokens (user-editable, runtime customizable)

| Token | Light default | Dark default | Status | Since | Used in | Source |
|---|---|---|---|---|---|---|
| `--color-primary` | #2563eb | #60a5fa | **runtime customizable** | 1.0.0 | Selected item, active state, focus ring | themeConfig.ts, themeManager.ts |
| `--color-background` | #ffffff | #0f172a | **runtime customizable** | 1.0.0 | Page/canvas bg | themeConfig.ts, themeManager.ts |
| `--color-surface` | #f8fafc | #1e293b | **runtime customizable** | 1.0.0 | Panel/dropdown/card bg | themeConfig.ts, themeManager.ts |
| `--color-text` | #0f172a | #f1f5f9 | **runtime customizable** | 1.0.0 | Primary text | themeConfig.ts, themeManager.ts |
| `--color-text-secondary` | #475569 | #cbd5e1 | **runtime customizable** | 1.0.0 | Secondary text | themeConfig.ts, themeManager.ts |
| `--color-border` | #e2e8f0 | #334155 | **runtime customizable** | 1.0.0 | Default border | themeConfig.ts, themeManager.ts |
| `--color-success` | #10b981 | #10b981 | **runtime customizable** | 1.0.0 | Success state | themeConfig.ts, themeManager.ts |
| `--color-warning` | #f59e0b | #f59e0b | **runtime customizable** | 1.0.0 | Warning state | themeConfig.ts, themeManager.ts |
| `--color-error` | #ef4444 | #ef4444 | **runtime customizable** | 1.0.0 | Error state | themeConfig.ts, themeManager.ts |

## Derived tokens (stable, generated from core via colorGenerator)

| Token | Derivation | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--color-primary-hover` | `generateHoverColor(primary)` = shade 10% | stable/derived | 1.0.0 | Hover on primary-colored element | themeManager.ts |
| `--color-primary-subtle` | `rgba(primary, 0.1)` | stable/derived | 1.0.0 | Subtle bg for primary-tinted areas | themeManager.ts |
| `--color-surface-hover` | `generateHoverColor(surface)` = shade 10% | stable/derived | 1.0.0 | Hover row in surface | themeManager.ts |
| `--color-text-muted` | `generateShade(textSecondary, 20)` | stable/derived | 1.0.0 | Tertiary/helper text | themeManager.ts |
| `--color-text-inverse` | `= background` | stable/derived | 1.0.0 | Text on primary/colored bg | themeManager.ts |
| `--color-border-subtle` | `generateShade(surface, 5)` | stable/derived | 1.0.0 | Subtle divider | themeManager.ts |
| `--color-border-focus` | `= primary` | stable/derived | 1.0.0 | Focus ring border | themeManager.ts |
| `--color-info` | `= primary` | stable/derived | 1.0.0 | Info state | themeManager.ts |
| `--color-error-subtle` | `rgba(error, 0.08-0.15)` | stable/derived | 1.0.0 | Subtle error bg | themeManager.ts |
| `--color-warning-subtle` | `rgba(warning, 0.1-0.15)` | stable/derived | 1.0.0 | Subtle warning bg | themeManager.ts |
| `--color-scrollbar-thumb` | #cbd5e1 / #475569 | stable | 1.0.0 | Scrollbar thumb | themeTokens.ts |
| `--color-scrollbar-thumb-hover` | #94a3b8 / #64748b | stable | 1.0.0 | Scrollbar thumb hover | themeTokens.ts |
| `--color-scrollbar-track` | transparent | stable | 1.0.0 | Scrollbar track | themeTokens.ts |

---

## Theme runtime customization (ADR-022)

> **Added 2026-07-05** (ADR-022 port from theocean extension). Theme system decoupled from `settings.theme` — now uses dedicated `themeMode` + `themeConfig` storage keys with Zustand store.

### Architecture

| Component | Location | Role |
|---|---|---|
| `ThemeMode` | `src/entities/theme/types.ts` | `'light' \| 'dark' \| 'system'` — source of truth at `chrome.storage.local.themeMode` |
| `ThemeConfig` | `src/entities/theme/types.ts` | `{ customColors: { light: CoreColorTokens; dark: CoreColorTokens } }` — palette data (no mode field) |
| `DEFAULT_THEME_CONFIG` | `src/features/theme/logic/themeConfig.ts` | Default 9-token palette per mode (mirrors pre-port LIGHT/DARK_TOKENS) |
| `themeStore` | `src/stores/themeStore.ts` | Zustand store — `init`, `switchMode`, `updateColor`, `setConfig`, `resetTheme` |
| `themeManager` | `src/features/theme/logic/themeManager.ts` | `applyTheme(mode, config)` — set `:root` CSS vars + `data-theme` attr; `resolveMode` (system → light/dark) |
| `colorGenerator` | `src/features/theme/logic/colorGenerator.ts` | Pure color utils — `hexToRgb`, `getLuminance` (WCAG), `generateShade/Tint/HoverColor/Palette` |
| `contrastValidator` | `src/features/theme/logic/contrastValidator.ts` | WCAG AA/AAA validation — 3 critical pairs (text/canvas, textSecondary/canvas, white/primary) |
| `ThemeProvider` | `src/features/theme/ui/ThemeProvider.tsx` | React wrapper — boot `themeStore.init()` + `applyTheme` + system listener + storage.onChanged sync |
| `themeTokens.ts` | `src/shared/lib/themeTokens.ts` | Content-script `<style>` injection — reads `themeConfig` from storage, generates light+dark CSS blocks |

### Mode switching

- **3 modes**: `light`, `dark`, `system` (resolves via `prefers-color-scheme`)
- **Popup toggle**: cycles `light → dark → system → light` via `themeStore.switchMode`
- **Options ThemePanel**: `ModeCards` 3-card radio selector with a11y (role=radiogroup, arrow nav)
- **Persistence**: `chrome.storage.local.themeMode` (separate from settings)
- **Legacy fallback**: `themeStore.init()` seeds `themeMode` from old `settings.theme` if `themeMode` absent (backward compat for pre-port users)
- **Cross-context sync**: `storage.onChanged` listener in `ThemeProvider` — popup/sidepanel/options stay in sync

### Custom palette

- **9 core tokens** per mode (light + dark): primary, background, surface, text, textSecondary, border, success, warning, error
- **Secondary tokens derived** at runtime via `colorGenerator` (not stored): primary-hover, surface-hover, border-focus, primary-subtle, border-subtle, text-muted, text-inverse, error-subtle, warning-subtle
- **Real-time preview**: `ColorCustomization` component with 9 color pickers per mode, debounced 300ms
- **WCAG validation**: `ContrastBadges` shows AA/AAA/Fail per pair, tooltip with ratio

### Import / Export

- **Export**: download `cell-theme.json` + copy to clipboard
- **Import**: file picker + paste textarea → `isValidThemeConfig` shape validation → `themeStore.setConfig`
- **Reset**: confirm dialog → `themeStore.resetTheme` → `DEFAULT_THEME_CONFIG`

### Content-script injection

Content-script (isolated world) cannot access popup CSS. `themeTokens.ts` injects a `<style>` block into `document.head` with both light + dark token blocks (generated from `themeConfig`). Sets `data-theme` on the video container. Listens to `storage.onChanged` for realtime re-inject.
