# Runtime Contexts & Cross-runtime Sync — Cell Extension

> Extension-specific — DSDS does not cover. Cell has 5 runtime contexts; only 3 have UI.

## Runtime Contexts (§5)

| Runtime | Token source | Component convention | Entry point | Manifest key |
|---|---|---|---|---|
| **Popup** | `theme.css` (Vite import, direct) | React component + hooks | `src/entrypoints/popup/main.tsx` | `action.default_popup` |
| **Sidepanel** | `theme.css` (Vite import, direct) | React component + hooks | `src/entrypoints/sidepanel/index.html` | `side_panel.default_path` |
| **Content-script** | `themeTokens.ts` (mirror, ADR-015 T12 — inject `<style>`) | DOM factory (no React, no CSS modules) | `src/entrypoints/content/content-script.ts` | `content_scripts[0].js` |
| **Background (SW)** | n/a (no UI) | n/a | `src/entrypoints/background/index.ts` | `background.service_worker` |
| **Offscreen** | n/a (no UI) | n/a | `src/entrypoints/offscreen/transmuxWorker.ts` | `offscreen` API |

> **Critical**: Content-script CANNOT import `theme.css` directly (isolated world, no popup stylesheet access). Must use `themeTokens.ts` mirror via `injectThemeTokens()` (ADR-015 T12). Forgetting this = UI breaks with raw `var(--color-*)` unresolved.

## Cross-runtime Sync (§6)

| Source | Mirror | Sync mechanism | Last synced | Status |
|---|---|---|---|---|
| `theme.css` (popup) | `themeTokens.ts` (content-script) | Manual + sync test (ADR-015 T12) | 2026-07-02 | ✅ Synced |
| `theme.css` (popup) | popup components | Direct Vite import | auto | ✅ Auto |
| `theme.css` (popup) | sidepanel components | Direct Vite import | auto | ✅ Auto |

> **Drift risk**: When adding/removing/renaming a token in `theme.css`, MUST update `themeTokens.ts` mirror in same commit. Sync test catches drift. ponytail ceiling (themeTokens.ts:13): extract `tokens.css` as shared asset V3 (build-time import in both popup + content-script).

See [tokens/README.md](tokens/README.md) for token sync details + [tokens/color.md](tokens/color.md) for theme runtime customization (ADR-022).
