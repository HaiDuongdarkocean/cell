# Design System Documentation — Cell Extension

> **Living document** (semi-living: update khi add/remove/rename token, pattern, atom, hoặc a11y convention — không phải mỗi commit).
> **Inspired by** [DSDS — Design System Documentation Spec](https://github.com/somerandomdude/design-system-documentation-schema) (8 entity types + document-block system), adapted to markdown for 1-dev Chrome Extension project.
> **Complements W3C Design Tokens Format**: token **values** live in `theme.css` + `themeTokens.ts` (source of truth). This file documents the **semantics, usage, and contracts** around them.
> **Last updated**: 2026-07-03 (YouTube/Google design principles research — Sections 8/9/10 added)

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
| Sidebar navigation (left, anchor jump) | — | stable | 3+ settings categories, multi-section UI | Single-section settings | SettingsDialog (planned) |
| Card grouping (visual containment) | — | stable | Group related settings, max 4-5 per card | Single setting or unrelated items | SettingsDialog (planned) |
| Progressive disclosure (expand/collapse) | — | should | Advanced/rarely-used settings | Core/frequently-used settings | SettingsDialog (planned) |
| Immediate feedback (no save button) | — | should | Toggle/select changes persist immediately | Form requiring explicit save | SettingsDialog (current) |
| Dependency explanation (child below parent) | — | should | Setting depends on another's value | Independent settings | SettingsDialog (Workers below Parallel) |

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
| Touch target ≥ 48×48dp (M3 recommendation) | should | accessibility | Material Design 3 baseline — covers most users |
| Focus indicator: 2px solid `--color-primary`, 2px offset | must | accessibility | Keyboard nav visibility — YouTube uses 2px signal blue, we use primary token |
| Active state: pill background + text color change (not color-only) | must | accessibility | WCAG 1.4.1 — color alone doesn't convey state |
| Heading hierarchy: h1 page → h2 section → h3 subsection | must | accessibility | WCAG 1.3.1 — screen reader navigation |
| New component: provide purpose + API + usage guidelines before merging | must | content | Component without docs = component without contract |
| Pin dependency versions, upgrade deliberately | should | development | Auto-upgrade introduces visual regressions / breaking changes |
| Settings: organize by user intent, not system architecture | must | layout | "Account/System/Preferences" mean nothing to users — group by what users want to DO |
| Settings: max 10-15 items per screen, 4-5 per card | should | layout | Over 15 = overwhelming, over 5 per card = scan fatigue |
| Settings: stable category names (no frequent relabeling) | must | layout | Relabeling creates navigation debt — users relearn location each change |
| Settings: polite defaults (common, no risk, no battery drain) | must | layout | Android Settings guideline — defaults should be safe + common |
| Settings: danger zone at bottom, distinct visual framing | should | layout | Spatial separation signals "this is different" — prevents accidental destructive action |
| Visual: use `#0f0f0f`-style softened black, not pure `#000000` | should | visual | YouTube principle — softer feel while maintaining max contrast (our `--color-text` = `#0f172a` already follows this) |
| Visual: 1px hairline borders for card definition, not heavy shadows | should | visual | YouTube uses borders, shadows reserved for floating elements only |
| Visual: border-radius scales with element size (4px small → 18px large) | should | visual | YouTube rounding philosophy — consistent scaling, not random values |
| Visual: reserve branded/primary color for key actions only | should | visual | YouTube strategic color — default states monochromatic for efficiency + a11y |
| Labels: plain language, no jargon ("Enable WebSocket fallback" → "Use real-time updates") | must | content | Jargon excludes non-technical users |

---

## 8. Design Principles (YouTube + Google research — 2026-07-03)

> **Source**: 27 sources researched (Material Design 3, Google Design, YouTube Blog, YouTube Design System, Android Settings Guidelines, NN/g, SaaS patterns, conference talks). See References for full list.
> **Status**: Reference principles — apply when designing new UI, not enforced tokens. Our tokens (Section 1) remain source of truth for values.

### 8.1 YouTube Core Philosophy

| # | Principle | Meaning | Apply to |
|---|---|---|---|
| 1 | **Content-First Utility** | UI là canvas gần monochrome, không cạnh tranh với content. "Design gets out of the way" | Popup, overlay — keep UI restrained, let media/subtitles shine |
| 2 | **Natural Evolution** | Design changes = evolution, không revolution. Test với users trước khi commit | All UI changes — iterate, don't redesign from scratch |
| 3 | **Rounded Shapes Philosophy** | Rounded = friendly, inviting, comfortable to tap. Radii scale theo placement/size/relationship | All controls — use `--radius-sm/md/lg` scale, don't invent random values |
| 4 | **Softened Contrast** | Dùng `#0f0f0f` thay vì pure `#000000` — softer, less aggressive, vẫn max contrast | Our `--color-text: #0f172a` already follows this principle |
| 5 | **"Alive" Brand** | Brand moves with content, reacting, shifting. Dynamic rather than declarative | Animations, transitions — subtle motion, not static |
| 6 | **Strategic Color Usage** | Reserve branded/primary color cho key actions ONLY. Default states = monochromatic | `--color-primary` only for active state, focus, key actions — not everywhere |

### 8.2 Material Design 3 Core

| # | Principle | Meaning | Apply to |
|---|---|---|---|
| 7 | **4dp Grid System** | All spacing theo 4dp base unit — consistent visual rhythm | Our `--spacing-xs/sm/md/lg/xl` (4/8/12/16/24) already follows this |
| 8 | **Semantic Color Roles** | Colors assigned by role (primary/secondary/tertiary/neutral), không arbitrary | Our token naming (`--color-text`, `--color-surface`) already semantic |
| 9 | **Tone-Based Accessibility** | Color combinations based on luminance → ensure 4.5:1 contrast | Verify token pairs in both light + dark mode |
| 10 | **Material You: Comfortable** | Make users feel "at home" via personalization | Theme toggle (light/dark) — users choose their comfort |
| 11 | **Material You: Spirited** | Imbue digital interfaces with natural world qualities (organic forms) | Rounded radii, subtle transitions — not harsh rectangles |

### 8.3 Settings-Specific Principles

| # | Principle | Meaning | Apply to |
|---|---|---|---|
| 12 | **Progressive Disclosure** | Reveal essential only, defer less important to secondary screens | Advanced settings collapse, core settings visible |
| 13 | **User Intent Organization** | Group by what users want to DO, không phải system architecture | 5 groups: Media / Overlay / Shortcuts / Nav Cluster / Download |
| 14 | **Friction-Scaled to Risk** | Destructive actions require confirmation proportional to consequence | Reset settings → confirm dialog; toggle → no confirm |
| 15 | **Single-Column Focus** | Settings dùng narrow reading measure (~680-720px max) cho readability | Popup 480px — within reading measure |
| 16 | **Polite Defaults** | Defaults = common, no risk, don't interrupt, don't hurt battery/performance | All default settings values |
| 17 | **Immediate Feedback** | Switches change settings immediately, no save needed | All toggles/selects in SettingsDialog |
| 18 | **Stable Category Names** | Avoid frequent relabeling → prevents navigation debt | "Media Selection", "Subtitle Overlay" — don't rename unless absolutely necessary |
| 19 | **Scope Separation** | Separate Personal/Team/Organization/Device/System settings, label clearly | N/A for single-user extension, but label scope if added |
| 20 | **Dependency Explanation** | Place dependent setting below parent + brief explanation why unavailable | Workers below Parallel Conversion |
| 21 | **10-15 Items Per Screen** | Over 15 = overwhelming, move to subscreen | 5 cards × 4-5 items = 20-25 total, but grouped → OK |
| 22 | **Clear Title + Status** | Brief meaningful titles, show specific details below title | "Auto select media" + hint "Khi bật, mở popup → media tự chọn" |
| 23 | **Danger Zone Separation** | Destructive actions ở distinct section bottom, stronger visual framing | Reset to defaults button — if added, separate section |

### 8.4 Anti-Patterns to Avoid

| Category | Anti-Pattern | Why Bad | Do Instead |
|---|---|---|---|
| Organization | Organize by system architecture | "Account/System/Preferences" mean nothing to users | Group by user intent (Media/Overlay/Download) |
| Organization | Wall of toggles (30+ no grouping) | Overwhelming, scan fatigue | Group into cards, max 4-5 per card |
| Organization | Settings as storage closet | Every unresolved UX decision pushed into settings | Solve in main UI, settings = last resort |
| Navigation | 20+ sidebar items | Restructure IA before visual design | Max 7-8 items, use sub-sections in content |
| Navigation | Nesting deeper than 1 level | Users get lost | Flat categories, sub-sections in content area |
| Navigation | Inconsistent active states | Users can't tell where they are | Pill background + text color change, consistent |
| Navigation | Hidden save buttons | At bottom of long form requiring scroll | Immediate feedback (no save needed) |
| Destructive | Burying cancellation/deletion | Dark pattern, destroys trust | Distinct danger zone at bottom |
| Destructive | Same modal for everything | Deleting draft ≠ deleting account | Friction proportional to consequence |
| Visual | Pure `#000000` | Too aggressive, harsh | Use softened black (`#0f0f0f` or our `#0f172a`) |
| Visual | Shadows instead of borders | YouTube uses 1px hairline borders for cards | Borders for containment, shadows for floating only |
| Visual | Inconsistent rounding | Random radius values break visual rhythm | Use `--radius-sm/md/lg` scale, scale with size |
| Visual | Color as sole information carrier | WCAG 1.4.1 fail | Add shape/text/icon backup |
| Visual | Jargon in labels | Excludes non-technical users | Plain language ("Use real-time updates" not "Enable WebSocket") |
| A11y | Below 4.5:1 contrast | WCAG AA fail | Verify token pairs in both themes |
| A11y | Color-only states | WCAG 1.4.1 fail | Active = pill bg + text color, not just color |
| A11y | Small touch targets (<44px) | WCAG 2.5.5 fail | Min 44px desktop, 48dp M3, 56px touch |
| A11y | No focus indicators | Keyboard users lost | 2px solid `--color-primary`, 2px offset |

---

## 9. Settings UI Patterns (YouTube + M3 research — 2026-07-03)

> **Status**: Reference patterns for SettingsDialog redesign. Token values from Section 1, patterns from YouTube/M3 research.

### 9.1 Sidebar Navigation

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

### 9.2 Card Grouping

| Aspect | Value | Source | Our token |
|---|---|---|---|
| Card padding | 16px (compact popup) / 24px (YouTube desktop) | YouTube, M3 | `--spacing-lg` |
| Card border-radius | 10px (YouTube) / 8px (M3) | YouTube | `--radius-md` |
| Card border | 1px hairline | YouTube | `1px solid --color-border` |
| Section gap | 16px (compact) / 24-32px (YouTube) | YouTube | `--spacing-lg` |
| Content max-width | 680px (YouTube) / 720px (M3) | YouTube, M3 | Our popup 480px — within range |
| Grouping limit | Max 4-5 settings per card | SaaS patterns | — |
| Card structure | Header (title + count) + description + body | Windows SettingsCard | — |

### 9.3 Typography Hierarchy (Settings)

| Element | YouTube Size/Weight | M3 Equivalent | Our token |
|---|---|---|---|
| Page title | 22px / 500 | title-large | `--font-size-lg` (16px) — popup compact |
| Section header | 14px / 500 | title-small | `--font-size-base` (14px) + `--font-weight-semibold` |
| Field label | 14px / 400 | body-medium | `--font-size-xs` (12px) — compact |
| Description | 13px / 400 | body-small | `--font-size-xs` (12px) + `--color-text-muted` |
| Helper text | 12px / 400 | label-medium | `--font-size-xs` (12px) + `--color-text-muted` |
| Button text | 14px / 500 | label-large | `--font-size-sm` (13px) + `--font-weight-medium` |

> **Note**: Our popup uses compact sizes (smaller than YouTube desktop) due to 480px width constraint. Hierarchy proportions preserved.

### 9.4 Form Controls

| Control | YouTube Spec | Our implementation |
|---|---|---|
| Select dropdown | 40px height, 1px border, 4px radius, 8px 12px padding | `CustomSelect` — `--radius-md`, `--spacing-sm --spacing-md` padding |
| Toggle switch | 36px track, 14px height, 20px thumb, active = brand color | `IconButton` with `active` prop — visual toggle |
| Text input | 40px height, 1px border, 4px radius, focus = 2px signal blue | `.textInput` — `--radius-sm`, focus via `--color-primary` |
| Primary button | 36px height, brand color bg, white text, 4px radius | N/A — extension uses icon buttons primarily |
| Focus indicator | 2px solid signal blue, 2px offset | 2px solid `--color-primary`, 2px offset + `--color-primary-subtle` ring |

### 9.5 Dependency Patterns

| Pattern | When | Example |
|---|---|---|
| Place dependent below parent | Setting depends on another's value | Workers below Parallel Conversion |
| Brief explanation when unavailable | Dependent setting disabled | "Only available when Parallel = Manual" |
| Parent switch on subscreen | Toggle group of dependent settings | N/A — our settings flat |
| Disable + popover/tooltip if inherited | Child can't be changed | N/A — single-user extension |
| **Indent child** (2026-07-04) | Visual hierarchy child dưới parent | `.childField`: `margin-left + padding-left + border-left 2px --color-border-subtle` |

### 9.5a Layout Primitives (2026-07-04 — settings-dialog-rearrange)

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

### 9.6 Danger Zone Patterns

| Pattern | When | Implementation |
|---|---|---|
| Distinct section at bottom | Destructive actions exist | If "Reset to defaults" added → separate card at bottom |
| Stronger visual framing | Signal "this is different" | `--color-error-subtle` background, `--color-error` border |
| Clearer consequence copy | User understands impact | "Reset all settings to defaults. This cannot be undone." |
| Friction proportional to consequence | Prevent accidental damage | Confirm dialog for reset, no confirm for toggle |

---

## 10. Design Principles Reference (YouTube + M3 — 2026-07-03)

> **Status**: Reference values from research. Our tokens (Section 1) remain source of truth. This section documents the research basis for our token choices.

### 10.1 YouTube Color Palette (reference only — not our tokens)

| YouTube Token | Light | Dark | Usage | Our equivalent |
|---|---|---|---|---|
| `--yt-spec-text-primary` | `#0f0f0f` | `#f1f1f1` | Primary text | `--color-text: #0f172a` / `#f1f5f9` |
| `--yt-spec-text-secondary` | `#606060` | `#aaa` | Secondary text | `--color-text-secondary: #475569` / `#cbd5e1` |
| `--yt-spec-text-tertiary` | `#909090` | `#717171` | Tertiary/disabled | `--color-text-muted: #94a3b8` / `#64748b` |
| `--yt-spec-border-color` | `#c6c6c6` | `#3f3f3f` | Hairline borders | `--color-border: #e2e8f0` / `#334155` |
| `--yt-spec-general-background-a` | `#ffffff` | `#181818` | Page bg | `--color-background: #ffffff` / `#0f172a` |
| `--yt-spec-general-background-b` | `#f9f9f9` | `#0f0f0f` | Alternate bg | `--color-surface: #f8fafc` / `#1e293b` |
| `--yt-spec-brand-link-text` | `#065fd4` | `#065fd4` | Links | `--color-primary: #2563eb` / `#60a5fa` |

> **Note**: Our Slate palette is cooler-toned than YouTube's neutral grey. Both follow the same semantic role structure. We do NOT adopt YouTube's exact hex values.

### 10.2 Typography Scale Comparison

| Level | YouTube | M3 | Our token | Notes |
|---|---|---|---|---|
| Display | 57sp | display-large | — | N/A — popup has no hero moments |
| Headline | 32sp | headline-large | — | N/A — popup compact |
| Title (page) | 22sp | title-large | `--font-size-lg: 16px` | Scaled down for 480px popup |
| Title (section) | 14sp | title-small | `--font-size-base: 14px` | Match |
| Body | 14sp | body-medium | `--font-size-sm: 13px` | Slightly smaller (compact) |
| Label | 12sp | label-medium | `--font-size-xs: 12px` | Match |
| Caption | 10sp | label-small | — | N/A — not used |

### 10.3 Spacing Scale Comparison

| Token | YouTube/M3 | Our token | Match? |
|---|---|---|---|
| xs | 4px | `--spacing-xs: 4px` | ✅ |
| sm | 8px | `--spacing-sm: 8px` | ✅ |
| md | 12px | `--spacing-md: 12px` | ✅ |
| lg | 16px | `--spacing-lg: 16px` | ✅ |
| xl | 24px | `--spacing-xl: 24px` | ✅ |
| 2xl | 32px | — | Add if needed |
| 3xl | 48px | — | Add if needed |

> **Note**: Our spacing scale already follows 4dp base unit (M3 principle). No changes needed.

### 10.4 Border Radius Scale Comparison

| Token | YouTube | M3 | Our token | Notes |
|---|---|---|---|---|
| xs | 4px | 4px | — | Add `--radius-xs: 4px` if needed |
| sm | 8px | 8px | `--radius-sm: 6px` | Close — 2px difference |
| md | 10px (cards) | 8px | `--radius-md: 8px` | Match M3 |
| lg | 12px | 12px | `--radius-lg: 12px` | ✅ |
| xl | 16px | 16px | — | Add if needed |
| 2xl | 18px (buttons) | — | — | YouTube-specific, not adopted |
| full | 9999px | 9999px | `--radius-full: 9999px` | ✅ |

> **Note**: YouTube uses 10px for cards, 18px for buttons. We use 8px (M3) for cards, 6px for small controls. Both follow "scale with size" principle.

### 10.5 Accessibility Conventions (WCAG refs)

| Convention | Spec | WCAG ref | Our compliance |
|---|---|---|---|
| Contrast ≥ 4.5:1 (normal text) | Token pairs verified | [1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) | ✅ All text tokens meet |
| Contrast ≥ 3:1 (large text) | Token pairs verified | [1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) | ✅ |
| Touch target ≥ 44px (desktop) | Min height/width | [2.5.5](https://www.w3.org/TR/WCAG22/#target-size-enhanced) | ✅ Nav cluster 32px (compact exception) |
| Touch target ≥ 48×48dp (M3) | M3 baseline | M3 guidelines | Should — upgrade nav cluster to 40px+ |
| Focus indicator visible | 2px solid, 2px offset | [2.4.7](https://www.w3.org/TR/WCAG22/#focus-appearance) | ✅ `--color-primary` ring |
| Color not sole info carrier | Shape + text + icon backup | [1.4.1](https://www.w3.org/TR/WCAG22/#use-of-color) | ✅ Active = pill bg + text color |
| Keyboard operable | Enter/Space/Arrow/Esc | [2.1.1](https://www.w3.org/TR/WCAG22/#keyboard) | ✅ All interactive elements |

### 10.6 Research Sources (27 total)

**Web sources (8+):**
- Material Design 3 — https://m3.material.io/
- Google Design — https://design.google/
- YouTube Design System (Refero) — https://styles.refero.design/style/8fc58a26-47be-406e-8429-37925551c0ec
- YouTube Blog (Ambient mode) — https://blog.youtube/inside-youtube/youtube-ambient-color-mode-visual-language-redesign/
- Android Settings Guidelines — https://source.android.com/docs/core/settings/settings-guidelines
- Android Developers Settings — https://developer.android.com/design/ui/mobile/guides/patterns/settings
- Windows Settings Guidelines — https://learn.microsoft.com/en-us/windows/apps/design/
- Nielsen Norman Group — https://www.nngroup.com/
- SaaS Settings Patterns — https://setting.page/, https://saasui.design/
- GitLab Pajamas — https://design.gitlab.com/patterns/settings-management

**Video sources (6):**
- YouTube Insiders: VidCon 2023 Settings improvements — https://www.youtube.com/watch?v=MAKWhN32T6k
- YouTube Insiders: New Look Sneak Peek — https://www.youtube.com/watch?v=JSEkfOHUbLk
- Google Design: Make Material your own — https://www.youtube.com/watch?v=HbAFGivZ158
- Figma Config 2024: Design systems best practices — https://www.youtube.com/watch?v=MJTCfSFLUGE
- Figma Config 2024: Broken promises of design systems — https://www.youtube.com/watch?v=BQXTt-NZ2Bs
- Figma Config 2024: Value of opinions in design systems — https://www.youtube.com/watch?v=piRTrMcoIqA

**Written analysis (13+):**
- YouTube Blog: Decoding YouTube's new design language
- Google Design: YouTube's New Red — https://design.google/library/youtube-new-red-color
- Florencio Zavala: YouTube Brand Standards case study — https://www.florenciozavala.com/case-studies/youtube
- PRINT Magazine: YouTube at 20 — https://www.printmag.com/3d-visualization/youtube-at-20-designing-a-brand-that-lives-with-culture/
- Chris Bettig: YouTube Identity — https://chrisbettig.com/work/youtube
- Chris Bettig: YouTube 2024 Update — https://chrisbettig.com/work/youtube-2024
- PageFlows: YouTube Settings Flow — https://pageflows.com/post/desktop-web/settings/youtube
- UX Horizon: YouTube UX analysis — https://uxhorizon.com/youtube-ux-why-its-so-easy-to-keep-watching/
- Medium: Top 7 UX Laws YouTube uses — https://medium.com/design-bootcamp/top-7-ux-laws-youtube-perfectly-uses-to-keep-you-hooked-bb7e51d2dd1e
- DUMBO Design: YouTube UX model — https://dumbo.design/en/insights/the-simple-model-behind-youtubes-compelling-ux/
- Substack (Eliz Laraki): How one UX researcher ignited YouTube changes
- YouTube Accessibility Plan (Canada) — https://support.google.com/youtube/answer/16668503
- Medium: Heuristic Evaluation of YouTube — https://medium.com/@mohaneeshkumar1/heuristic-evaluation-of-youtube-a-ux-experts-s-perspective-8e48bf100000

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
| New design principle adopted (YouTube/M3 research) | Section 8 (principles) + Section 10 (reference) | Source citation in References |
| New settings UI pattern adopted | Section 9 (settings patterns) | Pattern documented with use-when/don't-use-when |
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
