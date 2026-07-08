# Accessibility Guidelines — Cell Extension

> Combines §7 a11y guidelines + §4 a11y conventions (WCAG refs).

## Guidelines (§7)

| Guidance | Level | Rationale |
|---|---|---|
| Every interactive element keyboard operable | must | WCAG 2.1.1 — switch device / screen reader users |
| `aria-label` on icon-only buttons | must | Screen reader needs name when no visible text |
| Test at 200% browser zoom | should | WCAG 1.4.4 — low vision users |
| Don't wrap design system components in extra DOM that alters semantics | must-not | Breaks accessibility tree (e.g. button in div with onClick) |
| Touch target ≥ 44px (desktop), ≥ 56px (touch) | should | WCAG 2.5.5 — motor impairment users |
| Touch target ≥ 48×48dp (M3 recommendation) | should | Material Design 3 baseline — covers most users |
| Focus indicator: 2px solid `--color-primary`, 2px offset | must | Keyboard nav visibility — YouTube uses 2px signal blue, we use primary token |
| Active state: pill background + text color change (not color-only) | must | WCAG 1.4.1 — color alone doesn't convey state |
| Heading hierarchy: h1 page → h2 section → h3 subsection | must | WCAG 1.3.1 — screen reader navigation |

## Conventions (§4 — WCAG refs)

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

## Examples

| Guidance | ✅ Do | ❌ Don't |
|---|---|---|
| Every interactive element keyboard operable | `<button onClick={...}>` (native, Enter/Space free) | `<div onClick={...}>` (no keyboard) |
| `aria-label` on icon-only buttons | `<IconButton aria-label="Close" icon={<CloseIcon />} />` | `<IconButton icon={<CloseIcon />} />` (no name) |
| Test at 200% browser zoom | Open popup, set Edge zoom 200%, verify no overflow | Ship without zoom testing — low-vision users blocked |
| Don't wrap DS components in extra DOM altering semantics | `<IconButton ... />` | `<div onClick><IconButton ... /></div>` (extra div + double handler) |
| Touch target ≥ 44px | `min-height: 44px` via `--nav-cluster-size-md: 48px` | `min-height: 24px` (too small for touch) |
| Focus indicator 2px solid primary, 2px offset | `outline: 2px solid var(--color-primary); outline-offset: 2px` | `outline: none` or `outline: 1px solid gray` |
| Active state: pill bg + text color (not color-only) | Active nav item: `bg: --color-primary-subtle; color: --color-primary` | Active nav item: `color: --color-primary` only |
| Heading hierarchy h1→h2→h3 | Page: `<h1>Settings</h1>` → section `<h2>Overlay</h2>` → `<h3>Position</h3>` | Skip h2, use `<h4>` directly under `<h1>` |
