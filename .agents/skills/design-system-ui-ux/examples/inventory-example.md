# Interface Inventory Example — Chrome Extension (popup + sidepanel + content-script)

> Real inventory from a video downloader extension. 19 UI files, 4 runtime contexts, 14 inconsist found.
> Use as reference for filling `inventory-template.md`.

## Project context

- **Project**: Video Downloader Extension (Chrome MV3)
- **UI source root**: `src/`
- **Runtime contexts**: popup (React + CSS modules), sidepanel (React, no theme import), content-script manager (DOM + injected tokens), content-script legacy overlay (DOM, no tokens)
- **Existing token file**: `src/entrypoints/popup/styles/theme.css` (well-structured, light/dark)
- **Date audited**: 2026-07-02

## Sample inconsist entries (3 of 14 shown)

### #3 — Card radius khác nhau giữa 3 card

| Call site | File:line | Radius | Border | Hover |
|---|---|---|---|---|
| VideoCard | VideoCard.module.css:6 | var(--radius-lg) = 12px | 2px solid transparent | bg + border change |
| SubtitleCard | SubtitleCard.module.css:6 | var(--radius-lg) = 12px | 2px solid transparent | bg + border change (copy) |
| DownloadCard | DownloadCard.module.css:5 | var(--radius-md) = 8px | none | none |

**Type**: Visual. **Severity**: High. **Fix**: Step 3 — Card atom (but only 2 sites share behavior → Rule of Three says NO extract, just unify radius token).

### #9 — Token referenced but undefined (BUG)

| Token referenced | File:line | Defined in theme.css? |
|---|---|---|
| `--color-primary-alpha` | SubtitleStylePanel.module.css:113 | NO — undefined |
| `--color-danger` | SubtitleStylePanel.module.css:180, 182 | NO — theme.css has `--color-error` not `--color-danger` |

**Type**: Architecture (bug). **Severity**: Critical. **Fix**: Step 2 — add `--color-primary-alpha` token, rename `--color-danger` → `--color-error` in SubtitleStylePanel.

### #13 — Legacy content-script overlay không dùng tokens

| Call site | File:line | Hardcoded | Should be |
|---|---|---|---|
| createToggleButton | subtitlePanel.ts:19-22 | `rgba(20,20,20,0.85)`, `#ffffff` | (by-design — dark overlay on video) |
| createSubtitleDropdown | subtitleSelector.ts:64-66 | `rgba(0,0,0,0.6)`, `rgba(255,255,255,0.3)` | (by-design — dark popover on video) |
| createTrackDropdown | subtitleTrackDropdown.ts:24-27 | `rgba(0,0,0,0.7)`, `#ffffff` | (by-design — dark select on video) |

**Type**: By-design. **Severity**: N/A. **Action**: Document — dark overlay on video is affordance fitting context (Norman). Do NOT refactor to light tokens.

## Cross-runtime token coverage

| Runtime context | Receives tokens? | How? | Drift risk |
|---|---|---|---|
| popup | yes | imports theme.css via global.css | none |
| sidepanel | NO | inline styles in CueList.tsx | HIGH — hardcoded `#fff`, `rgba(0,150,255,0.3)` |
| content-script manager | yes | themeTokens.ts injects `<style>` | MEDIUM — 150-line mirror file, drift risk |
| content-script legacy | NO | inline styles | N/A — by-design dark overlay |

## Summary

- **Total inconsist**: 14
- **By type**: Visual 7, Architecture 4, Interaction 1, By-design 2
- **Critical (must fix)**: 2 (#9 token bug, #1 sidepanel no tokens)
- **Token gaps**: 4 new tokens needed (`--color-error-subtle`, `--color-warning-subtle`, `--color-primary-alpha`, `--radius-xs`)
- **Cross-runtime gaps**: 2 contexts (sidepanel critical, legacy by-design)
- **Recommendation**: proceed to Step 2 (fix #9 + add 4 tokens) + Step 3 (extract IconButton — 4 call sites pass Rule of Three). Skip Step 3.5 (legacy by-design). Skip Step 4 settings IA (no evidence).
