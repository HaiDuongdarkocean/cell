# Tokens — Cell Extension

> **Complement W3C DTCG** — token **values** live in `theme.css` + `themeTokens.ts` (source of truth). This folder documents the **semantics, usage, and contracts** around them.
> **Source of truth**: `src/entrypoints/popup/styles/theme.css` (popup) + `src/shared/lib/themeTokens.ts` (content-script mirror, ADR-015 T12).

## Token files

| File | Content | Status |
|---|---|---|
| [color.md](color.md) | Color tokens (9 core + 13 derived) + theme runtime customization (ADR-022) | stable |
| [typography.md](typography.md) | Typography tokens (font-family, sizes, weights, line-heights) | stable |
| [spacing.md](spacing.md) | Spacing tokens (4px scale) | stable |
| [shape-elevation-motion.md](shape-elevation-motion.md) | Radius, shadow, transition tokens + nav-cluster feature tokens (ADR-018) | stable |

## Cross-runtime sync (ADR-015 T12)

| Source | Mirror | Sync mechanism | Last synced | Status |
|---|---|---|---|---|
| `theme.css` (popup) | `themeTokens.ts` (content-script) | Manual + sync test (ADR-015 T12) | 2026-07-02 | ✅ Synced |
| `theme.css` (popup) | popup components | Direct Vite import | auto | ✅ Auto |
| `theme.css` (popup) | sidepanel components | Direct Vite import | auto | ✅ Auto |

> **Drift risk**: When adding/removing/renaming a token in `theme.css`, MUST update `themeTokens.ts` mirror in same commit. Sync test catches drift. ponytail ceiling (themeTokens.ts:13): extract `tokens.css` as shared asset V3 (build-time import in both popup + content-script).

## Rules

- Use semantic tokens (`--color-primary`), not raw hex (`#2563eb`) — see [../guidelines/development.md](../guidelines/development.md)
- Don't override token value at component level — breaks contract → drift
- Components consume tokens via `var(--token-name)` — never hardcode values
