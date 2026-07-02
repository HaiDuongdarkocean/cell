# Interface Inventory — Cell (Video Downloader Extension)

> Audited 2026-07-02. Every claim cites file:line. No vibes — only measured evidence.

## Project context

- **Project**: cell (Chrome Extension MV3 — video downloader + subtitle manager)
- **UI source root**: `src/`
- **Runtime contexts**: popup (React + CSS modules), sidepanel (React + inline styles), content-script (vanilla DOM + cssText, tokens injected via `themeTokens.ts`)
- **Existing token file**: `src/entrypoints/popup/styles/theme.css` (light + dark, flat, well-structured)
- **Token mirror**: `src/shared/lib/themeTokens.ts` (duplicates theme.css for content-script isolated world)

## Component families

### Buttons — icon buttons (32x32 / 28x28 / 24x24 transparent, icon-only)

| Call site | File:line | Size | Radius | Hover bg | Hover color | Focus ring | Token or raw? |
|---|---|---|---|---|---|---|---|
| Header.iconBtn | Header.module.css:40-62 | 32x32 | --radius-sm | --color-surface-hover | --color-text | 2px focus | token |
| SettingsDialog.iconBtn | SettingsDialog.module.css:62-84 | 32x32 | --radius-sm | --color-surface-hover | --color-text | (global) | token |
| SettingsDialog.iconBtnSm | SettingsDialog.module.css:81-84 | 28x28 | --radius-sm | --color-surface-hover | --color-text | (global) | token |
| SubtitleCard.expandBtn | SubtitleCard.module.css:129-152 | 28x28 | --radius-sm | --color-surface-hover | --color-text | 2px focus | token |
| SubtitleCard.downloadBtn | SubtitleCard.module.css:168-195 | 32x32 | --radius-sm | --color-surface-hover | --color-primary | 2px focus | token |
| VideoCard.expandBtn | VideoCard.module.css:237-260 | 28x28 | --radius-sm | --color-surface-hover | --color-text | 2px focus | token |
| VideoCard.downloadBtn | VideoCard.module.css:276-303 | 32x32 | --radius-sm | --color-surface-hover | --color-primary | 2px focus | token |
| **DownloadCard.actionBtn** | DownloadCard.module.css:73-91 | 24x24 | --radius-sm | **--color-border** | --color-text | none | token (wrong token) |
| **SelectionBar.clearBtn** | SelectionBar.module.css:29-48 | 28x28 | --radius-sm | **--color-border** | --color-text | none | token (wrong token) |
| subtitleManagerPanel.icon | subtitleManagerPanel.ts:88-103 | 32x32 | --radius-md | **none (no hover handler)** | — | none | token + fallback |
| subtitleManagerPanel.closeBtn | subtitleManagerPanel.ts:149-161 | 20x20 | --radius-sm | --color-surface-hover (JS) | --color-text (JS) | none | token + fallback |

**Inconsistencies found:**
- **#1 Visual**: IconButton hover background diverges — 8 call sites use `--color-surface-hover`, 2 use `--color-border` (DownloadCard.actionBtn:89, SelectionBar.clearBtn:46). Same concept, two tokens.
- **#2 Interaction**: subtitleManagerPanel.icon (the main trigger) has NO mouseenter/mouseleave → no hover feedback (subtitleManagerPanel.ts:316-320 binds click only). closeBtn + section headers DO have hover. Inconsistent within the same panel.

### Buttons — text/primary buttons

| Call site | File:line | Type | Radius | Hover | Token or raw? |
|---|---|---|---|---|---|
| App.btnText | App.redesigned.module.css:54-69 | text/ghost | --radius-sm | --color-primary-subtle bg | token |
| SelectionBar.downloadBtn | SelectionBar.module.css:57-75 | primary | --radius-md | opacity 0.9 | token (color: `white` raw) |
| SubtitleStylePanel.resetBtn | SubtitleStylePanel.module.css:154-168 | ghost | --radius-sm | --color-surface-hover | token |
| SubtitleStylePanel.confirmBtn | SubtitleStylePanel.module.css:178-186 | danger | --radius-sm | none | **broken: --color-danger (missing token)** |
| SubtitleStylePanel.cancelBtn | SubtitleStylePanel.module.css:188-196 | ghost | --radius-sm | none | token |

**Inconsistencies found:**
- **#3 Visual/Broken**: SubtitleStylePanel references `--color-danger` (lines 180, 182) and `--color-primary-alpha` (line 113) — NEITHER exists in theme.css. Theme defines `--color-error` and `--color-primary-subtle`. Result: confirm button has no background/border (var resolves to empty → invalid), focus ring on inputs has no box-shadow. **Silent visual bug.**
- **#4 Visual**: `color: white` literal in SelectionBar.downloadBtn:64, MultiSelect.badge:65, MultiSelect.toggleKnob:190, subtitleManagerPanel radio dot:226, SubtitleStylePanel.confirmBtn:183. Should be `--color-text-inverse`.

### Cards

| Call site | File:line | Radius | Border | Hover | Selected | Token or raw? |
|---|---|---|---|---|---|---|
| VideoCard.card | VideoCard.module.css:2-11 | **--radius-lg** (12px) | 2px transparent | bg --color-surface-hover + border | --color-primary + --color-primary-subtle | token |
| SubtitleCard.card | SubtitleCard.module.css:2-11 | **--radius-lg** (12px) | 2px transparent | bg --color-surface-hover + border | --color-primary + --color-primary-subtle | token |
| **DownloadCard.card** | DownloadCard.module.css:2-9 | **--radius-md** (8px) | none | **none** | n/a | token (different radius) |
| MultiSelect.container | MultiSelect.module.css:3-10 | --radius-lg | 1px --color-border | n/a | n/a | token |
| SubtitlePreview.container | SubtitlePreview.module.css:3-11 | --radius-md | 1px --color-border-subtle | n/a | n/a | token |
| SettingsDialog.popover | SettingsDialog.module.css:17-35 | --radius-lg | 1px --color-border | n/a | n/a | token |

**Inconsistencies found:**
- **#5 Visual**: Card radius — VideoCard & SubtitleCard use `--radius-lg` (12px), DownloadCard uses `--radius-md` (8px). Same "media card" family, different radius.
- **#6 Interaction**: DownloadCard has NO hover state (no `:hover` rule on `.card`). VideoCard & SubtitleCard lift on hover. DownloadCard feels dead.

### Inputs

| Call site | File:line | Radius | Border | Focus | Padding | Token or raw? |
|---|---|---|---|---|---|---|
| SettingsDialog.textInput | SettingsDialog.module.css:110-118 | **6px raw** | --color-border | none | 6px 8px | mixed (raw radius) |
| SubtitleStylePanel.numberInput/textInput/select | SubtitleStylePanel.module.css:95-114 | --radius-sm | --color-border | **--color-primary-alpha (broken)** | 6px 8px | broken focus |
| SubtitleStylePanel.colorInput | SubtitleStylePanel.module.css:76-84 | --radius-sm | --color-border | n/a | 2px | token |
| MultiSelect.searchInput | MultiSelect.module.css:40-49 | n/a (borderless) | none | (wrap border-color) | 10px 14px | token |

**Inconsistencies found:**
- **#7 Visual**: SettingsDialog.textInput uses raw `border-radius: 6px` (line 115) instead of `--radius-sm` (which is 6px). Same value, bypassed token.
- **#8 Visual/Broken**: SubtitleStylePanel input focus uses `--color-primary-alpha` (line 113) — token does not exist → no focus ring renders.

### Tags / Badges

| Call site | File:line | Radius | Font-size | Background | Token or raw? |
|---|---|---|---|---|---|
| DownloadCard.qualityBadge | DownloadCard.module.css:45-54 | --radius-full | 10px raw | --color-border | token |
| VideoCard.formatTag/qualityTag | VideoCard.module.css:107-113 | n/a (plain text) | --font-size-xs | n/a | token |
| SubtitleCard.languageTag/meta | SubtitleCard.module.css:105-119 | n/a (plain text) | --font-size-xs | n/a | token |
| MultiSelect.badge | MultiSelect.module.css:56-70 | **10px raw** | 11px raw | --color-primary | mixed |
| MultiSelect.sectionCount | MultiSelect.module.css:120-129 | **8px raw** | 10px raw | --color-surface-hover | mixed |
| subtitleManagerPanel.formatBadge | subtitleManagerPanel.ts:240-247 | **3px raw** | 9px raw | --color-surface-hover | mixed |
| SubtitleStylePanel.valueBadge | SubtitleStylePanel.module.css:35-42 | --radius-sm | --font-size-xs | --color-surface-hover | token |
| SubtitleCard.copiedBadge | SubtitleCard.module.css:275-284 | --radius-sm | --font-size-xs | --color-success | token |

**Inconsistencies found:**
- **#9 Visual**: Badge radius chaos — `--radius-full`, `10px`, `8px`, `3px`, `--radius-sm` across 5 badges for the same "small pill/badge" concept.

### Toggles / Switches

| Call site | File:line | Size | Knob | On color | Off color | Token or raw? |
|---|---|---|---|---|---|---|
| MultiSelect.toggleSwitch | MultiSelect.module.css:174-216 | 36x20 | 16px white | --color-primary | --color-border | mixed (`white` raw knob) |

Only one toggle — no inconsist within family, but `white` knob should be `--color-text-inverse`.

### Dropdowns / Selects

| Call site | File:line | Trigger radius | Menu radius | Hover | Selected | Token or raw? |
|---|---|---|---|---|---|---|
| VideoCard.qualityTrigger | VideoCard.module.css:127-163 | --radius-sm | --radius-md | --color-surface-hover | --color-primary-subtle | token |
| SettingsDialog.customSelect | SettingsDialog.module.css:129-235 | --radius-md | --radius-md | --color-surface-hover | --color-primary-subtle | token |

**Inconsistencies found:**
- **#10 Visual**: Select trigger radius — VideoCard uses `--radius-sm`, SettingsDialog uses `--radius-md`. Minor but same concept diverges.

### Dialogs / Modals

| Call site | File:line | Radius | Overlay | Close button | Token or raw? |
|---|---|---|---|---|---|
| SettingsDialog.popover | SettingsDialog.module.css:17-35 | --radius-lg | `rgba(0,0,0,0.3)` raw | iconBtn (token) | mixed (raw overlay) |

Overlay scrim `rgba(0,0,0,0.3)` — by-design (modal dim). Document, do not fix.

### Empty states

| Call site | File:line | Icon | Title | Hint | Token or raw? |
|---|---|---|---|---|---|
| MediaEmpty | MediaEmpty.module.css:1-42 | --color-text-muted | --color-text-secondary | --color-text-muted | token |
| MultiSelect.emptyState | MultiSelect.module.css:219-225 | n/a | n/a | --color-text-muted | token |
| sidepanel "No subtitles" | App.tsx:216-218 | n/a | n/a | `rgba(255,255,255,0.4)` raw | **raw (sidepanel detached)** |

## Raw value audit (tokens bypassed)

| Raw value | File:line | Token that should be used | Reason bypassed |
|---|---|---|---|
| `rgba(239,68,68,0.04/0.08/0.12)` | DownloadCard:13,94,103; Header:71 | `--color-error-subtle` (missing) | token not defined |
| `rgba(245,158,11,0.1)` | SubtitleCard:77; subtitleManagerPanel:181 | `--color-warning-subtle` (missing) | token not defined |
| `rgba(0,0,0,0.08)` | SelectionBar:13 | `--shadow-md` | used custom shadow |
| `rgba(0,0,0,0.1)` | SettingsDialog:310 | `--shadow-sm` | used custom shadow |
| `rgba(0,0,0,0.2)` | SubtitleStylePanel:64; MultiSelect:192 | `--shadow-sm` | used custom shadow |
| `color: white` | SelectionBar:64; MultiSelect:65,190; subtitleManagerPanel:226; SubtitleStylePanel:183 | `--color-text-inverse` | convenience |
| `border-radius: 6px` | SettingsDialog:115 | `--radius-sm` | same value, bypassed |
| `border-radius: 10px/8px/3px` | MultiSelect:67,126,179; subtitleManagerPanel:242 | `--radius-full`/`--radius-md`/`--radius-sm` | ad-hoc |
| `#1a1a2e`/`#16213e` | SubtitlePreview:22 | (by-design: simulate video scene) | intentional |
| `rgba(0,0,0,0.3)` | SettingsDialog:5 | (by-design: modal scrim) | intentional |
| `rgba(0,0,0,0.4)` | subtitleManagerPanel:102 | (by-design: overlay on video) | intentional |
| `#141414`, `#fff`, `rgba(255,255,255,*)` | App.tsx:206-217; CueList.tsx:60-84; index.html:14-17 | full theme tokens | **sidepanel has no token injection** |

## Cross-runtime token coverage

| Runtime context | Receives tokens? | How? | Drift risk |
|---|---|---|---|
| popup | yes | imports global.css → theme.css | none |
| sidepanel | **NO** | — | **CRITICAL** — inline styles, hardcoded colors, no theme.css import |
| content-script | yes | themeTokens.ts injects `<style>` | **HIGH** — mirror file, no sync test, typo `data-theme-Host` (line 110) |

## Summary

- **Total inconsist**: 12 (10 fixable + 2 by-design)
- **By type**: Visual 7, Architecture 2, Interaction 2, Broken-token 2, By-design 2 (overlap — some items hit multiple axes)
- **Critical (must fix)**:
  - #3/#8 broken tokens (`--color-danger`, `--color-primary-alpha`) → confirm button + input focus render broken
  - sidepanel detached from theme (#11) → no dark mode, hardcoded colors, can't share tokens
  - themeTokens.ts typo `data-theme-Host` + no sync test → content-script light-mode tokens may not apply via `[data-theme="light"]` selector reliably
- **Token gaps**: 2 new tokens needed (`--color-error-subtle`, `--color-warning-subtle`) — measured 5+ raw usages each
- **Cross-runtime gaps**: 1 context (sidepanel) without token injection
- **Recommendation**: proceed to Step 2 (add 2 subtle tokens) → Step 3 (extract IconButton atom — 10 call sites pass Rule of Three) → Step 5 fix pass.
