# Development Guidelines — Cell Extension

| Guidance | Level | Rationale |
|---|---|---|
| Use semantic tokens (`--color-primary`), not raw hex (`#2563eb`) | must | Themed + dark mode without touching component code |
| Don't override token value at component level | must-not | Breaks contract → drift when token updates system-wide |
| Composition over configuration (combine components, don't add props) | should | Fewer props, simpler API, lower testing burden |
| Content-script UI = DOM factory (no React, no CSS modules) | must | Isolated world cannot access popup stylesheets or JSX runtime |
| Content-script tokens via `themeTokens.ts` mirror, not direct `theme.css` import | must | ADR-015 T12 — isolated world has no popup stylesheet |
| Pin dependency versions, upgrade deliberately | should | Auto-upgrade introduces visual regressions / breaking changes |

## Examples

| Guidance | ✅ Do | ❌ Don't |
|---|---|---|
| Use semantic tokens, not raw hex | `background: var(--color-primary)` | `background: #2563eb` |
| Don't override token value at component level | `color: var(--color-text)` in component | `color: var(--color-text); /* but override to #333 in dark */` |
| Composition over configuration | `<SettingsDialog><SubtitleStylePanel /></SettingsDialog>` | `<SettingsDialog showSubtitlePanel={true} subtitleConfig={...} />` |
| Content-script UI = DOM factory | `const btn = createToggleButton({...}); container.appendChild(btn)` | `const btn = document.createElement('button'); btn.innerHTML = '<ReactComponent />'` |
| Content-script tokens via mirror | `import { tokens } from '@/shared/lib/themeTokens'` | `import './theme.css'` in content-script |
| Pin dependency versions | `"mux.js": "6.0.1"` | `"mux.js": "^6.0.1"` or `"latest"` |
