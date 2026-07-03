# Design System Documentation — Cell Extension

> **Living document** (semi-living: update khi add/remove/rename token, pattern, atom, hoặc a11y convention — không phải mỗi commit).
> **Inspired by** [DSDS — Design System Documentation Spec](https://github.com/somerandomdude/design-system-documentation-schema) (8 entity types + document-block system), adapted to markdown for 1-dev Chrome Extension project.
> **Complements W3C Design Tokens Format**: token **values** live in `theme.css` + `themeTokens.ts` (source of truth). This file documents the **semantics, usage, and contracts** around them.
> **Last updated**: 2026-07-03

---

## 1. Tokens (complement W3C DTCG — values live in theme.css / themeTokens.ts)

> Source of truth: `src/entrypoints/popup/styles/theme.css` (popup) + `src/shared/lib/themeTokens.ts` (content-script mirror, ADR-015 T12). This section documents semantic meaning + usage, NOT values (values may drift — always cross-check `theme.css`).

### 1.1 Color tokens

| Token | Light | Dark | Status | Since | Used in | Source |
|---|---|---|---|---|---|---|
| `--color-primary` | #2563eb | #60a5fa | stable | 1.0.0 | Selected item, active state, focus ring | theme.css:8, themeTokens.ts:24 |
| `--color-primary-hover` | #1d4ed8 | #3b82f6 | stable | 1.0.0 | Hover on primary-colored element | theme.css:9 |
| `--color-primary-subtle` | rgba(37,99,235,0.1) | rgba(96,165,250,0.15) | stable | 1.0.0 | Subtle bg for primary-tinted areas | theme.css:10 |
| `--color-background` | #ffffff | #0f172a | stable | 1.0.0 | Page/canvas bg | theme.css:12 |
| `--color-surface` | #f8fafc | #1e293b | stable | 1.0.0 | Panel/dropdown/card bg | theme.css:13 |
| `--color-surface-hover` | #f1f5f9 | #334155 | stable | 1.0.0 | Hover row in surface | theme.css:14 |
| `--color-text` | #0f172a | #f1f5f9 | stable | 1.0.0 | Primary text | theme.css:16 |
| `--color-text-secondary` | #475569 | #cbd5e1 | stable | 1.0.0 | Secondary text | theme.css:17 |
| `--color-text-muted` | #94a3b8 | #64748b | stable | 1.0.0 | Tertiary/helper text | theme.css:18 |
| `--color-text-inverse` | #ffffff | #0f172a | stable | 1.0.0 | Text on primary/colored bg | theme.css:19 |
| `--color-border` | #e2e8f0 | #334155 | stable | 1.0.0 | Default border | theme.css:21 |
| `--color-border-subtle` | #f1f5f9 | #1e293b | stable | 1.0.0 | Subtle divider | theme.css:22 |
| `--color-border-focus` | #2563eb | #60a5fa | stable | 1.0.0 | Focus ring border | theme.css:23 |
| `--color-success` | #10b981 | #10b981 | stable | 1.0.0 | Success state | theme.css:25 |
| `--color-warning` | #f59e0b | #f59e0b | stable | 1.0.0 | Warning state | theme.css:26 |
| `--color-error` | #ef4444 | #ef4444 | stable | 1.0.0 | Error state | theme.css:27 |
| `--color-info` | #2563eb | #60a5fa | stable | 1.0.0 | Info state | theme.css:28 |
| `--color-error-subtle` | rgba(239,68,68,0.08) | rgba(239,68,68,0.15) | stable | 1.0.0 | Subtle error bg | theme.css:31 |
| `--color-warning-subtle` | rgba(245,158,11,0.1) | rgba(245,158,11,0.15) | stable | 1.0.0 | Subtle warning bg | theme.css:32 |
| `--color-scrollbar-thumb` | #cbd5e1 | #475569 | stable | 1.0.0 | Scrollbar thumb | theme.css:34 |
| `--color-scrollbar-thumb-hover` | #94a3b8 | #64748b | stable | 1.0.0 | Scrollbar thumb hover | theme.css:35 |
| `--color-scrollbar-track` | transparent | transparent | stable | 1.0.0 | Scrollbar track | theme.css:36 |

### 1.2 Typography tokens

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--font-family` | 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif | stable | 1.0.0 | All text | theme.css:39 |
| `--font-size-xs` | 12px | stable | 1.0.0 | Helper/secondary text | theme.css:41 |
| `--font-size-sm` | 13px | stable | 1.0.0 | Secondary text | theme.css:42 |
| `--font-size-base` | 14px | stable | 1.0.0 | Body text (compact) | theme.css:43 |
| `--font-size-lg` | 16px | stable | 1.0.0 | Section title | theme.css:44 |
| `--font-weight-regular` | 400 | stable | 1.0.0 | Body | theme.css:46 |
| `--font-weight-medium` | 500 | stable | 1.0.0 | Emphasis | theme.css:47 |
| `--font-weight-semibold` | 600 | stable | 1.0.0 | Strong emphasis | theme.css:48 |
| `--leading-tight` | 1.25 | stable | 1.0.0 | Compact headings | theme.css:50 |
| `--leading-normal` | 1.5 | stable | 1.0.0 | Body | theme.css:51 |

### 1.3 Spacing tokens (4px scale)

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--spacing-xs` | 4px | stable | 1.0.0 | Button internal padding, tight gap | theme.css:54 |
| `--spacing-sm` | 8px | stable | 1.0.0 | Row padding, default gap | theme.css:55 |
| `--spacing-md` | 12px | stable | 1.0.0 | Card padding | theme.css:56 |
| `--spacing-lg` | 16px | stable | 1.0.0 | Section padding | theme.css:57 |
| `--spacing-xl` | 24px | stable | 1.0.0 | Page padding | theme.css:58 |

### 1.4 Radius / Shadow / Transition tokens

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--radius-sm` | 6px | stable | 1.0.0 | Small controls | theme.css:61 |
| `--radius-md` | 8px | stable | 1.0.0 | Default border (button, dropdown) | theme.css:62 |
| `--radius-lg` | 12px | stable | 1.0.0 | Cards, panels | theme.css:63 |
| `--radius-full` | 9999px | stable | 1.0.0 | Pills, half-circle collapse | theme.css:64 |
| `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) / 0.3 dark | stable | 1.0.0 | Subtle elevation | theme.css:67 |
| `--shadow-md` | 0 4px 12px rgba(0,0,0,0.08) / 0.4 dark | stable | 1.0.0 | Floating panels, dropdowns | theme.css:68 |
| `--transition` | 150ms ease | stable | 1.0.0 | Default transition | theme.css:71 |
| `--transition-fast` | 150ms | stable | 1.0.0 | Fast transition | theme.css:72 |
| `--transition-normal` | 200ms | stable | 1.0.0 | Normal transition | theme.css:73 |
| `--ease-standard` | ease | stable | 1.0.0 | Default easing | theme.css:74 |

### 1.5 Feature-specific tokens (Nav Cluster — ADR-018)

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--nav-cluster-size-sm` | 40px | stable | 1.2.0 | Cluster button (small/dense) | theme.css:77 |
| `--nav-cluster-size-md` | 48px | stable | 1.2.0 | Cluster button (default) | theme.css:78 |
| `--nav-cluster-size-lg` | 56px | stable | 1.2.0 | Cluster button (touch) | theme.css:79 |
| `--nav-cluster-bg-opacity-default` | 0.7 | stable | 1.2.0 | Cluster bg opacity default | theme.css:80 |
| `--nav-cluster-btn-opacity-default` | 0.9 | stable | 1.2.0 | Cluster button opacity default | theme.css:81 |
| `--nav-cluster-collapse-size` | 32px | stable | 1.2.0 | Half-circle collapsed diameter | theme.css:82 |
| `--nav-cluster-edge-threshold` | 20px | stable | 1.2.0 | Drag-to-edge collapse threshold | theme.css:83 |
| `--nav-cluster-z-index` | 1000001 | stable | 1.2.0 | Above subtitle overlay (999999) | theme.css:84 |
| `--nav-cluster-repeat-hold-ms` | 500 | stable | 1.2.0 | Repeat hold threshold | theme.css:85 |
| `--nav-cluster-no-sub-window-ms` | 3000 | stable | 1.2.0 | No-sub repeat window | theme.css:86 |

---

## 2. Components (DSDS-style: metadata + variants + states + a11y)

### 2.1 Popup React components (`src/shared/ui/` + `src/features/settings/ui/`)

| Component | File | Status | Since | Variants | States | a11y | Used in |
|---|---|---|---|---|---|---|---|
| IconButton | `src/shared/ui/IconButton.tsx` | stable | 1.0.0 | variant, size | default/hover/focus/disabled | aria-label required | Header, SelectionBar |
| MultiSelect | `src/features/settings/ui/MultiSelect.tsx` | stable | 1.1.0 | — | open/closed | role=listbox, aria-selected | SettingsDialog |
| SettingsDialog | `src/features/settings/ui/SettingsDialog.tsx` | stable | 1.0.0 | — | open/closed | role=dialog, focus trap | App |
| SubtitlePreview | `src/features/settings/ui/SubtitlePreview.tsx` | stable | 1.1.0 | role: target/native | — | aria-label | SubtitleStylePanel |
| SubtitleStylePanel | `src/features/settings/ui/SubtitleStylePanel.tsx` | stable | 1.1.0 | — | — | label htmlFor | SettingsDialog |
| NavClusterSettingsPanel | `src/features/settings/ui/NavClusterSettingsPanel.tsx` | stable | 1.2.0 | — | — | label htmlFor | SettingsDialog |

### 2.2 Popup layout/media components (`src/entrypoints/popup/components/`)

| Component | File | Status | Since | Variants | States | a11y | Used in |
|---|---|---|---|---|---|---|---|
| Header | `components/layout/Header.tsx` | stable | 1.0.0 | — | — | semantic h1 | App |
| SelectionBar | `components/SelectionBar.tsx` | stable | 1.0.0 | — | — | aria-label | App |
| VideoCard | `components/media/VideoCard.tsx` | stable | 1.0.0 | — | empty/loading/ready | role=region | App |
| SubtitleCard | `components/media/SubtitleCard.tsx` | stable | 1.0.0 | — | empty/loading/ready | role=region | App |
| DownloadCard | `components/media/DownloadCard.tsx` | stable | 1.0.0 | — | idle/downloading/done/error | aria-live=polite | App |
| MediaEmpty | `components/media/MediaEmpty.tsx` | stable | 1.0.0 | — | — | role=status | App |

### 2.3 Content-script DOM factories (`src/features/subtitle/ui/`)

> Content-script runs in isolated world, NO React. All UI = DOM factories returning `HTMLElement`. Mimic pattern when adding new content-script UI.

| Factory | File | Output | Status | Since | a11y | Used in |
|---|---|---|---|---|---|---|
| `createToggleButton` | `subtitlePanel.ts` | HTMLButtonElement | stable | 1.0.0 | aria-label, aria-pressed | Overlay toggle |
| `createOverlayLayer` | `subtitleUI.ts` | HTMLDivElement | stable | 1.0.0 | role=slider, aria-valuenow/min/max, aria-orientation, aria-label | Subtitle overlay (target + native) |
| `createDragHandle` | `subtitleDragPosition.ts` | HTMLButtonElement | stable | 1.1.0 | aria-label | Overlay drag handle |
| `createDragHint` | `subtitleUI.ts` | HTMLDivElement | stable | 1.1.0 | aria-hidden | Drag hint visual |
| `createSubtitleDropdown` | `subtitleSelector.ts` | HTMLButtonElement + listbox | stable | 1.1.0 | aria-haspopup=listbox, aria-expanded, aria-selected | Target/native subtitle selector |
| `createTrackDropdown` | `subtitleTrackDropdown.ts` | HTMLSelectElement | stable | 1.0.0 | native select | Track selection |
| `createSubtitleManagerPanel` | `subtitleManagerPanel.ts` | HTMLDivElement (panel + icon) | stable | 1.1.0 | aria-label, aria-expanded, aria-selected, aria-hidden on icons | Manager panel |
| `createNavClusterButton` | `navClusterButton.ts` | HTMLButtonElement | stable | 1.2.0 | aria-label, aria-pressed (toggle) | Nav cluster buttons |
| `createInitialKeyboardState` | `navClusterKeyboard.ts` | NavClusterKeyboardState | stable | 1.2.0 | — (pure state) | Keyboard state machine |

### 2.4 Content-script controllers (`src/features/subtitle/ui/`)

| Controller | File | Status | Since | Lifecycle | Used in |
|---|---|---|---|---|---|
| `ContentScriptController` | `contentScriptController.ts` | stable | 1.0.0 | init → update → destroy | content-script entry |
| `NavClusterController` | `navClusterController.ts` | stable | 1.2.0 | init → updateCues → updateSettings → destroy | ContentScriptController |

---

## 3. Patterns (DSDS-style: interaction + use cases + stance)

| Pattern | ADR | Status | Use when | Don't use when | Used in |
|---|---|---|---|---|---|
| Pointer Events drag + `setPointerCapture` | ADR-015 | stable | Mouse + touch drag on overlay/cluster | Keyboard-only navigation | Subtitle overlay drag, Nav cluster drag |
| `chrome.storage.local` + `onStorageChanged` realtime persist | ADR-013 | stable | Settings persist + realtime sync across contexts | One-time read, no sync needed | Settings, overlay autoload, theme toggle |
| Keyboard shortcuts (single keydown → action) | ADR-009 | stable | Fixed mapping, no hold state | Hold-to-repeat semantics | subtitleShortcuts.ts |
| Hold state machine (keydown → timer → loop) | ADR-018 | stable | Hold-to-repeat (repeat sentence) | Single-press action | Nav cluster repeat button |
| Auto-load subtitle on URL change (id-level dedup) | ADR-007 | stable | Auto-load when entering video page | Manual trigger only | Bilingual subtitle auto-load |
| Two-phase render wipe (SPA navigation) | ADR-012 | stable | SPA page change without full reload | Multi-page navigation | Content-script on SPA sites |
| FSD screaming architecture (feature/domain) | ADR-016 | stable | New feature organization | Flat src/ structure | All new features |
| Background ↔ content-script messaging (tabId filter) | ADR-003 | stable | Background broadcast to specific tab | Popup-only messaging | messageBus.ts |
| Side-panel per-tab state | ADR-011 | stable | Per-tab sidepanel state | Global shared state | Sidepanel |

---

## 4. Accessibility (DSDS-style: keyboard + ARIA + contrast)

| Convention | Level | How | Where | WCAG ref |
|---|---|---|---|---|
| Interactive element = `<button>` (not `<div onClick>`) | must | Native button element | All components | [4.1.2 Name/Role/Value](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `aria-label` on icon-only buttons | must | `aria-label` attribute | IconButton, drag handle, cluster buttons | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `aria-pressed` for toggle state | must | `aria-pressed="false\|true"` | Toggle, NavCluster repeat button | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `aria-grabbed` for drag handle | must | `aria-grabbed="false\|true"` | NavCluster drag handle | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `aria-expanded` for collapsible | must | `aria-expanded="false\|true"` | SubtitleManagerPanel, SubtitleSelector, section headers | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `aria-selected` for listbox option | must | `aria-selected="false\|true"` | SubtitleSelector items, ManagerPanel rows | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `aria-haspopup="listbox"` for dropdown trigger | must | `aria-haspopup="listbox"` | SubtitleSelector icon | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `role="slider"` + `aria-valuenow/min/max` for drag overlay | must | role + aria-value* on overlay div | Subtitle overlay (vertical position) | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `role="toolbar"` + `aria-orientation` for cluster | must | role=toolbar + aria-orientation=horizontal | NavCluster root | [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) |
| `aria-hidden="true"` on decorative SVG icons | must | aria-hidden on icon SVGs | All icon SVGs in panels | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG22/#info-and-relationships) |
| Don't steal focus on mount | should | No auto-focus on panel/overlay open | Overlay, Panel, Cluster | [2.4.3 Focus Order](https://www.w3.org/TR/WCAG22/#focus-order) |
| Move focus to safe element when hiding | should | Focus → `<body>` or root when hide/collapse | Cluster collapse, panel close | [2.4.3 Focus Order](https://www.w3.org/TR/WCAG22/#focus-order) |
| Touch target ≥ 44px desktop, ≥ 56px touch | should | min-height via `--nav-cluster-size-*` tokens | NavCluster buttons | [2.5.5 Target Size](https://www.w3.org/TR/WCAG22/#target-size-enhanced) |
| Contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text) | must | Token values ensure (text on surface) | All text on surface | [1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum) |
| Don't rely on color alone for state | must | Icon + text + color | Error/success/warning states | [1.4.1 Use of Color](https://www.w3.org/TR/WCAG22/#use-of-color) |
| Keyboard operable (no mouse required) | must | Enter/Space activate, Arrow nav, Esc close | All interactive components | [2.1.1 Keyboard](https://www.w3.org/TR/WCAG22/#keyboard) |

---

## 5. Runtime Contexts (extension-specific — DSDS does not cover)

| Runtime | Token source | Component convention | Entry point | Manifest key |
|---|---|---|---|---|
| **Popup** | `theme.css` (Vite import, direct) | React component + hooks | `src/entrypoints/popup/main.tsx` | `action.default_popup` |
| **Sidepanel** | `theme.css` (Vite import, direct) | React component + hooks | `src/entrypoints/sidepanel/index.html` | `side_panel.default_path` |
| **Content-script** | `themeTokens.ts` (mirror, ADR-015 T12 — inject `<style>`) | DOM factory (no React, no CSS modules) | `src/entrypoints/content/content-script.ts` | `content_scripts[0].js` |
| **Background (SW)** | n/a (no UI) | n/a | `src/entrypoints/background/index.ts` | `background.service_worker` |
| **Offscreen** | n/a (no UI) | n/a | `src/entrypoints/offscreen/transmuxWorker.ts` | `offscreen` API |

> **Critical**: Content-script CANNOT import `theme.css` directly (isolated world, no popup stylesheet access). Must use `themeTokens.ts` mirror via `injectThemeTokens()` (ADR-015 T12). Forgetting this = UI breaks with raw `var(--color-*)` unresolved.

---

## 6. Cross-runtime Sync (extension-specific)

| Source | Mirror | Sync mechanism | Last synced | Status |
|---|---|---|---|---|
| `theme.css` (popup) | `themeTokens.ts` (content-script) | Manual + sync test (ADR-015 T12) | 2026-07-02 | ✅ Synced |
| `theme.css` (popup) | popup components | Direct Vite import | auto | ✅ Auto |
| `theme.css` (popup) | sidepanel components | Direct Vite import | auto | ✅ Auto |

> **Drift risk**: When adding/removing/renaming a token in `theme.css`, MUST update `themeTokens.ts` mirror in same commit. Sync test catches drift. ponytail ceiling (themeTokens.ts:13): extract `tokens.css` as shared asset V3 (build-time import in both popup + content-script).

---

## 7. Guidelines (DSDS-style: level + rationale)

| Guidance | Level | Category | Rationale |
|---|---|---|---|
| Use semantic tokens (`--color-primary`), not raw hex (`#2563eb`) | must | development | Themed + dark mode without touching component code |
| Don't override token value at component level | must-not | development | Breaks contract → drift when token updates system-wide |
| Composition over configuration (combine components, don't add props) | should | development | Fewer props, simpler API, lower testing burden |
| Content-script UI = DOM factory (no React, no CSS modules) | must | development | Isolated world cannot access popup stylesheets or JSX runtime |
| Content-script tokens via `themeTokens.ts` mirror, not direct `theme.css` import | must | development | ADR-015 T12 — isolated world has no popup stylesheet |
| Every interactive element keyboard operable | must | accessibility | WCAG 2.1.1 — switch device / screen reader users |
| `aria-label` on icon-only buttons | must | accessibility | Screen reader needs name when no visible text |
| Test at 200% browser zoom | should | accessibility | WCAG 1.4.4 — low vision users |
| Don't wrap design system components in extra DOM that alters semantics | must-not | accessibility | Breaks accessibility tree (e.g. button in div with onClick) |
| Touch target ≥ 44px (desktop), ≥ 56px (touch) | should | accessibility | WCAG 2.5.5 — motor impairment users |
| New component: provide purpose + API + usage guidelines before merging | must | content | Component without docs = component without contract |
| Pin dependency versions, upgrade deliberately | should | development | Auto-upgrade introduces visual regressions / breaking changes |

---

## Update Protocol

| Trigger | Update section | Verify by |
|---|---|---|
| Add/remove/rename token in `theme.css` or `themeTokens.ts` | Section 1 + Section 6 (sync status) | `grep` token name in both files |
| Add/remove/rename component/factory/controller | Section 2 | `ls src/` |
| New ADR approves interaction pattern | Section 3 | ADR file exists in `docs/adr/` |
| New a11y convention adopted | Section 4 | WCAG reference cited |
| New runtime context (e.g. new sidepanel page) | Section 5 | `manifest.json` entry |
| Mirror file (`themeTokens.ts`) changed | Section 6 (last synced date) | sync test pass |
| Quarterly audit (optional, G7) | Re-verify all sections vs codebase | `grep` + `ls` toàn bộ |

> **Semi-living**: Update when design system changes (token/pattern/atom/convention), NOT every commit. Ponytail: living documentation tuyệt đối cần Storybook/CI — overkill cho 1 dev. Semi-living = trust + low cost.

---

## References

- **DSDS — Design System Documentation Spec**: https://github.com/somerandomdude/design-system-documentation-schema (8 entity types + document-block system — inspired this file's structure)
- **W3C Design Tokens Format**: https://www.designtokens.org/ (token values source of truth — this file complements, doesn't duplicate)
- **DSDS documentation site**: https://designsystemdocspec.org/
- **Adobe Spectrum Design Data spec**: https://spectrum.adobe.com/ (DSDS credits this for layered model: structural rules + quality rules + testable criteria)
- **ADR-015 T12**: `docs/adr/015-subtitle-drag-integrated.md` (themeTokens.ts mirror pattern)
- **ADR-018**: `docs/adr/018-subtitle-navigation-control-cluster.md` (nav-cluster tokens)
- **Legacy inventory**: `docs/reviews/design-system-inventory-2026-07-02.md` (snapshot — superseded by this living file)
