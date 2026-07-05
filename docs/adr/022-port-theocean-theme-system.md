# ADR-022: Port Theocean Theme System (Runtime Customizable)

> Date: 2026-07-05
> Status: Accepted
> Phase: G3 — Architecture Decision Record
> Spec: `docs/specs/spec-port-theocean-dict-and-theme.md` (F1-F6)
> Intent: `docs/intent/intent-port-theocean-dict-and-theme.md`
> Plan: `docs/plan/plan-port-theocean-dict-and-theme.md` (Phase A, M1-M6)

## Context

Cell hiện có theme tĩnh:
- `src/entrypoints/popup/styles/theme.css` — tokens CSS bundled vào popup qua Vite.
- `src/shared/lib/themeTokens.ts` — inject `<style>` với `LIGHT_TOKENS`/`DARK_TOKENS` **hardcoded strings** (171 dòng) vào content-script container, đọc `chrome.storage.local.settings.theme` ('light'|'dark'), set `data-theme` attr, listen `chrome.storage.onChanged`.
- `src/shared/config/config.ts` — `DEFAULT_SETTINGS.theme: 'dark'`, `STORAGE_KEYS.SETTINGS = 'settings'`.

**Gap (spec F1-F6)**:
1. Chỉ light/dark, không có **system mode** (`prefers-color-scheme`).
2. Tokens **static**, user không đổi được qua UI — không có custom palette, không WCAG validator, không import/export.
3. `settings.theme` trộn vào settings schema — mở rộng theme phình settings, khó rollback theme riêng.
4. Content-script hardcoded 2 token string blocks — đổi token phải sửa 2 chỗ (popup `theme.css` + CS `themeTokens.ts`), drift risk.

**Problem**: Port theme system từ reference `theocean-extension-dictionary` (vanilla JS) sang cell (React 19 / TS / FSD), rewrite idiomatic, runtime configurable, publish Chrome Web Store quality (WCAG AA/AAA).

## Decision

### D1: Storage tách riêng (themeMode + themeConfig, schema settings v7→v8)

```ts
// chrome.storage.local — 2 key mới tách khỏi settings
themeMode: 'light' | 'dark' | 'system'        // source of truth cho mode
themeConfig: {                                 // KHÔNG chứa mode (Risk #8 fix)
  customColors: {
    light: { primary, background, surface, text, textSecondary, border, success, warning, error },
    dark:  { ...9 tokens... }
  }
}
// settings: bỏ field `theme` (migration v7→v8: read settings.theme → write themeMode → delete field)
```

**Why tách**: Theme có lifecycle riêng (change thường xuyên, có import/export, có reset), settings là infra (change hiếm). Trộn → migration settings phình, rollback theme ảnh hưởng settings. Tách → atomic, độc lập.

**Why `themeMode` riêng không nằm trong `themeConfig.mode`**: 1 source of truth, tránh sync 2 chỗ khi switch mode. `themeConfig` chỉ là palette data (import/export JSON thuần), `themeMode` là runtime state.

**Rejected: Giữ `settings.theme` + thêm `settings.themeConfig`** — settings schema phình, migration settings mỗi lần đổi theme.

**Rejected: `themeConfig.mode`** — 2 source of truth (mode trong config + mode riêng), sync drift.

### D2: 9 core tokens runtime configurable, secondary DERIVED (không store)

```ts
// 9 core tokens (user-editable, store trong themeConfig.customColors[mode])
--color-primary, --color-background, --color-surface, --color-text,
--color-text-secondary, --color-border, --color-success, --color-warning, --color-error

// Secondary tokens (DERIVED qua colorGenerator, KHÔNG store)
--color-primary-hover    = shade(primary, 10%)
--color-primary-subtle   = rgba(primary, 0.1)
--color-surface-hover    = shade(surface, 10%)
--color-border-focus     = primary
--color-border-subtle    = shade(surface, 5%)
--color-text-muted       = (giữ hoặc derive từ text-secondary)
--color-text-inverse     = (derive từ background luminance)
--color-error-subtle, --color-warning-subtle = rgba(...)
```

**Why derive**: DRY — user đổi 1 core token → 5 secondary auto-update. Store secondary = 14 tokens × 2 mode = 28 fields, drift khi core đổi. Derive = 9 core × 2 mode = 18 fields, secondary luôn consistent.

**`colorGenerator`** (pure logic, content-script-safe — no DOM deps): `hexToRgb`, `rgbToHex`, `getLuminance`, `generateShade`, `generateHoverColor`, `generatePalette`. Reuse cho cả popup `themeManager` + CS `themeTokens.ts`.

**Rejected: Store tất cả 14+ tokens** — DRY violation, drift risk, import/export JSON phình.

### D3: System mode (`prefers-color-scheme` + listener re-apply)

```ts
// themeManager.resolveMode(mode): 'light' | 'dark'
//   mode === 'system' → matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
//   else → mode
//
// Listener: matchMedia.addEventListener('change', () => mode === 'system' && re-apply)
```

**Why**: User muốn theme theo OS (spec US-TH-1). System mode = meta, resolved mode = light|dark (CSS chỉ 2 branch `[data-theme="light"]` / `[data-theme="dark"]`).

**Rejected: 3 branch CSS `[data-theme="system"]`** — CSS phình, system change không re-apply tự động.

### D4: Content-script inject customColors (rewrite `themeTokens.ts`)

```ts
// src/shared/lib/themeTokens.ts — REWRITE
// Trước: hardcoded LIGHT_TOKENS/DARK_TOKENS strings (171 dòng)
// Sau: đọc themeMode + themeConfig.customColors[resolvedMode] từ chrome.storage
//      → inject 9 core CSS vars + derive secondary via colorGenerator
//      → set data-theme="light"|"dark" trên container
//      → listen chrome.storage.onChanged (themeMode + themeConfig) re-apply
```

**Why rewrite**: Hardcoded strings = drift với popup `theme.css`, user custom color không reach CS. Rewrite = 1 source (themeConfig) → cả popup + CS cùng apply.

**Content-script-safe**: `colorGenerator` pure functions (no `document`, no `window` ngoài `matchMedia` cho system mode — CS có `matchMedia`). Inject `<style>` vào `document.head` (CS isolated world có `document`).

**Backward compat**: Nếu `themeConfig` absent (user cũ chưa migrate) → fallback default palette (same as current LIGHT/DARK_TOKENS) → 0 visual regression.

**Rejected: Giữ hardcoded + thêm custom override block** — 2 source, drift, override phức tạp.

### D5: SettingsDialog GIỮ theme toggle làm shortcut

```ts
// src/features/settings/SettingsDialog.tsx — theme toggle hiện tại giữ
// Trước: toggle → settingsStore.set({ theme: 'light'|'dark' })
// Sau:  toggle → themeStore.switchMode('light'|'dark')  // shortcut, không có 'system'
// ThemePanel (options page) = full config (3 mode + custom + import/export) — source of truth
```

**Why giữ**: User quen toggle nhanh trong popup, không muốn mở options chỉ để switch light/dark. Cùng `themeStore` = no conflict (1 store, 2 entry point). Shortcut không có 'system' (system cần options page full UI).

**Rejected: Xóa toggle SettingsDialog** — UX regression, user phải mở options cho task đơn giản nhất.

### D6: `--color-info` GIỮ + i18n giữ tiếng Việt

- `--color-info`: cell đang dùng (nav cluster, toast info), `design-system.md` documents. Giữ = 0 regression. (OQ#4 resolved)
- i18n: cell chưa có i18n layer, ponytail — giữ tiếng Việt. Thêm i18n = feature riêng, out of scope. (OQ#8 resolved)

### D7: ThemeProvider init ở popup/options/sidepanel

```tsx
// src/app/ThemeProvider.tsx — boot themeStore.init() trước render React
//   1. read themeMode + themeConfig from chrome.storage
//   2. themeManager.applyTheme(resolvedMode, config) — set CSS vars trên :root
//   3. register system mode listener + storage.onChanged listener
//   4. render children
// Wrap <App/> trong <ThemeProvider> ở popup/main.tsx, options/main.tsx, sidepanel/main.tsx
```

**Why `:root` cho popup/options/sidepanel**: React UI (full document), set CSS vars trên `document.documentElement`. Khác CS (inject vào container — CS không sở hữu `:root` của page).

**Why init trước render**: Tránh FOUC (flash unthemed) — `themeTokens.ts` hiện đã làm pattern này (apply 'dark' sync trước, loadSettings async override). ThemeProvider generalize cho 3 entrypoint.

### D8: Smooth CSS transition 200ms khi switch

```css
/* theme.css — add transition cho properties nhạy cảm theme */
* { transition: color 200ms ease, background-color 200ms ease, border-color 200ms ease; }
/* ponytail: scoped transition tránh lag animation khác — refine V2 nếu perf issue */
```

**Why 200ms**: Spec F2. Nhận thấy theme switch mượt, không flash. 150ms quá nhanh, 300ms cảm giác lag.

## Consequences

### Positive
- 1 source of truth (`themeConfig` + `themeMode`) cho popup + options + sidepanel + content-script
- User custom 9 tokens → secondary auto-derive (DRY, no drift)
- System mode follow OS preference
- Content-script nhận custom color realtime (storage.onChanged) — không reload
- Settings schema gọn (bỏ `theme` field), theme lifecycle độc lập
- WCAG contrast validation (publish quality bar)
- Import/export theme JSON (chia sẻ/sao lưu)
- SettingsDialog toggle giữ (UX backward compat)

### Negative
- Migration settings v7→v8 (data loss risk nếu bug) → mitigate: migration test (Risk #5)
- `themeTokens.ts` rewrite (171 dòng → logic + derive) — touch content-script, browser verify bắt buộc
- `colorGenerator` phải content-script-safe (no DOM deps ngoài matchMedia) — test pure logic
- Storage 2 key mới (`themeMode`, `themeConfig`) — thêm vào `STORAGE_KEYS`

### Neutral
- `--color-info` giữ (no change, đã dùng)
- `theme.css` giữ naming (spec assumption #1 — không đổi sang reference naming)
- `design-system.md` update (F6 — mark 9 tokens "runtime customizable" + new section)

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Giữ `settings.theme` + thêm `settings.themeConfig` | Settings schema phình, migration settings mỗi lần đổi theme |
| `themeConfig.mode` (mode trong config) | 2 source of truth, sync drift |
| Store tất cả 14+ tokens (core + secondary) | DRY violation, drift khi core đổi, JSON phình |
| 3 branch CSS `[data-theme="system"]` | CSS phình, system change không re-apply tự động |
| Giữ hardcoded `themeTokens.ts` + custom override block | 2 source, drift, override phức tạp |
| Xóa SettingsDialog theme toggle | UX regression, user phải mở options cho switch đơn giản |
| Đổi token naming sang reference | Break cell existing CSS, `design-system.md` stale, 0 lợi ích |
| Thêm i18n layer | Out of scope, ponytail — feature riêng |

## Module Boundaries (api-and-interface-design)

### `src/entities/theme/` (types — pure, zero dep)

```ts
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';
export interface CoreColorTokens {
  primary: string; background: string; surface: string;
  text: string; textSecondary: string; border: string;
  success: string; warning: string; error: string;
}
export interface ThemeConfig {
  customColors: { light: CoreColorTokens; dark: CoreColorTokens };
}
export const DEFAULT_THEME_CONFIG: ThemeConfig;  // current LIGHT/DARK palette
```

### `src/features/theme/logic/` (pure logic — testable)

```ts
// colorGenerator.ts — pure, content-script-safe
export function hexToRgb(hex: string): { r: number; g: number; b: number };
export function getLuminance(hex: string): number;
export function generateShade(hex: string, percent: number): string;
export function generateHoverColor(hex: string): string;  // shade 10%

// contrastValidator.ts — pure
export function getContrastRatio(fg: string, bg: string): number;
export function getRating(ratio: number): { level: 'AA'|'AAA'|'Fail'; ratio: number; pass: boolean };
export function validateTheme(c: CoreColorTokens): ValidationResult;

// themeManager.ts — side effect (set CSS vars)
export function applyTheme(mode: ResolvedMode, config: ThemeConfig): void;  // set :root vars
export function resolveMode(mode: ThemeMode): ResolvedMode;

// themeStorage.ts — chrome.storage CRUD
export async function loadThemeMode(): Promise<ThemeMode>;
export async function loadThemeConfig(): Promise<ThemeConfig>;
export async function saveThemeMode(mode: ThemeMode): Promise<void>;
export async function saveThemeConfig(config: ThemeConfig): Promise<void>;
```

### `src/stores/themeStore.ts` (Zustand — single source of truth)

```ts
interface ThemeStore {
  mode: ThemeMode;
  config: ThemeConfig;
  init(): Promise<void>;
  switchMode(mode: ThemeMode): void;          // SettingsDialog shortcut + ThemePanel
  updateColor(mode: ResolvedMode, token: keyof CoreColorTokens, hex: string): void;
  setConfig(config: ThemeConfig): void;       // import JSON
  resetTheme(): void;
}
```

### `src/shared/lib/themeTokens.ts` (content-script — rewrite)

```ts
export function injectThemeTokens(container: HTMLElement): () => void;
// Rewrite: đọc themeMode + themeConfig → inject 9 core + derive secondary → data-theme
// Backward compat: themeConfig absent → DEFAULT_THEME_CONFIG fallback
```

## References

- Spec: `docs/specs/spec-port-theocean-dict-and-theme.md` (F1-F6)
- Intent: `docs/intent/intent-port-theocean-dict-and-theme.md`
- Plan: `docs/plan/plan-port-theocean-dict-and-theme.md` (Phase A, M1-M6)
- Existing: `src/shared/lib/themeTokens.ts` (rewrite), `src/entrypoints/popup/styles/theme.css`, `src/shared/config/config.ts`
- ADR-016: FSD screaming architecture (`src/features/theme/`, `src/entities/theme/`, `src/app/ThemeProvider`)
- ADR-001: Zustand not Redux (`themeStore`)
- Reference: `project-reference/import dictioanry and requency list for theocean-extension-dictionary/` (theme vanilla JS)
