# ADR-044: Design-token single source of truth (SSOT)

> Date: 2026-07-15
> Status: Accepted
> Amends: ADR-022 D2 (9 core tokens + derived secondary)

## Context

Theme tokens đang tồn tại ở nhiều nơi:
- `src/shared/styles/tokens.css` — runtime CSS cho popup/options/sidepanel.
- `src/shared/lib/themeTokens.ts` — static + color token strings inject vào content script.
- `src/features/theme/logic/themeManager.ts` — derived tokens tính tay khác với `tokens.css`.
- `src/features/theme/logic/themeConfig.ts` — default palette hardcoded khác `tokens.css`.

Drift gây lỗi: `themeManager` tính `--color-text-muted` bằng `generateShade` khiến giá trị sai; `themeTokens` dùng `surface` cho `secondary`/`popover` thay vì design-system; `tokens.css` thiếu component tokens (`--button-*`, `--input-*`) nên shared/ui components ở popup rơi về fallback hex.

## Decision

1. **SSOT = `src/shared/styles/tokens.json`.**
   - Chứa `core` (9 màu/light+dark), `derived` (hover/subtle/scrollbar/shadow), `static` (font/spacing/radius/motion/z-index/nav-cluster), và `component` (button/input/card/alert/dialog/badge/iconbutton).
   - Human-editable JSON, versioned, có `source` trỏ đến `design-system.md`.

2. **`tokens.css` là generated artifact.**
   - `scripts/generate-tokens.js` đọc `tokens.json` và viết `:root` + `[data-theme="dark"]` CSS.
   - `package.json` `predev`/`prebuild` chạy generator để artifact luôn đồng bộ.
   - `tokens.css` KHÔNG sửa tay; mọi thay đổi token phải qua `tokens.json`.

3. **`src/shared/lib/tokens.ts` là runtime SSOT wrapper.**
   - Export `DEFAULT_LIGHT_COLORS` / `DEFAULT_DARK_COLORS` cho `themeConfig`.
   - Export `getColorTokens(colors, mode)` — trả về full token map; nếu palette trùng default thì dùng precomputed derived từ `tokens.json`, ngược lại derive runtime qua `colorGenerator`.
   - Export `buildColorTokenCSS()`, `formatStaticTokens()`, `formatComponentTokens()` cho `themeTokens.ts` inject.

4. **`themeManager` chỉ cần gọi `getColorTokens` và set hết lên `:root`.**
   - Không còn tính derived rải rác trong `themeManager`.
   - `themeTokens.ts` inject static + component trên `:root`, color tokens trong `[data-theme]`.

## Alternatives Considered

- **CSS custom properties as SSOT:** `tokens.css` vẫn là runtime artifact, nhưng khó parse/maintain bằng JS/TS. Từ chối.
- **YAML trong `design-system.md` làm SSOT:** cần parser YAML ở build/runtime, thêm phức tạp. Giữ `design-system.md` là spec/nguồn tin thẩm mỹ, `tokens.json` là nguồn máy đọc.
- **Giữ nguyên nhiều nguồn:** tiếp tục drift. Từ chối.

## Consequences

- Positive: một chỗ sửa token ảnh hưởng toàn bộ popup/options/sidepanel/content-script/Shadow DOM popup.
- Positive: default palette khớp hoàn toàn `design-system.md` YAML.
- Positive: component tokens (`--button-bg`, `--input-fg`, v.v.) có mặt trong cả entrypoints và content script, loại bỏ fallback hex.
- Negative: thêm bước generator; dev phải chạy `predev` hoặc `node scripts/generate-tokens.js` khi sửa `tokens.json`.

## Migration

- `themeConfig.ts` import `DEFAULT_LIGHT_COLORS` / `DEFAULT_DARK_COLORS` từ `tokens.ts`.
- `themeTokens.ts` bỏ `STATIC_TOKENS`/`buildColorTokens` inline, dùng `tokens.ts` helpers.
- `themeManager.ts` dùng `getColorTokens`.
- `tokens.css` regenerated từ `tokens.json`.
- Cập nhật `docs/2-architechture-system.md`, `src/shared/styles/README.md`, `design-system.md` meta.
