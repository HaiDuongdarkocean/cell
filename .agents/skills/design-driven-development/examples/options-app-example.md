# Example — Redesigning OptionsApp

> Worked example. Mode A (full screen redesign). Gate 1 (wireframe) + Gate 2 (UI-UX-Contract) for a Chrome extension settings panel. Implement is downstream (not shown here).

## Context
Cell, Chrome Extension MV3 video downloader. Options page (`src/entrypoints/options/`) has 3 tabs: Resources, Theme, Settings. CSS Modules + CSS variables, no Tailwind. User wants redesign — structure feels sparse, settings tab is a placeholder, UX lacks grouping depth.

## Input fetch (before any design)
- **Upstream**: none ran. Ask ONE question on cache miss only.
- **Codebase audit**: read `OptionsApp.tsx`, `OptionsApp.module.css`, `ResourcesPanel.tsx`, `ThemePanel.tsx`, `SettingsDialog.tsx` (legacy). Found 3 tabs, SettingsPlaceholder stub, no aria-controls linking.
- **Docs**: `manifest.json` (MV3, options page full tab), `AGENTS.md` (CSS Modules + CSS vars, no Tailwind, named export, function component + hooks).
- **Design system**: existing CSS variables `--spacing-*`, `--color-*`, `--font-*`. Reuse tokens.
- **User context**: cache miss → ask "Which tab do you open most often?" → answer: "Tài nguyên (import dict)".

## Gate 1 — Wireframe (UX structure)

**Step 1 — Inventory**:
```yaml
functions:
  - { id: F1, name: "Manage dictionaries (import/delete/list)", frequency: frequent, destructive: false }
  - { id: F2, name: "Customize theme (color/font/overlay)", frequency: occasional, destructive: false }
  - { id: F3, name: "App settings (general config)", frequency: rare, destructive: false }
  - { id: F4, name: "Reset all data", frequency: rare, destructive: true }
```

**Step 2 — IA model**: `scope-first` (settings page → me/team/system). Reason: 3 distinct concern areas, user thinks "my stuff / my look / my config".

**Step 3 — Grouping**: 3 groups → tabs (2-4 = tabs rule). Labels use user vocabulary: "Tài nguyên" (not "dictionary-feature"), "Giao diện" (not "theme-panel"), "Cài đặt" (not "settings-config"). No dump group. ≤5 per group (Miller).

**Step 4 — Order**: Within each tab, frequent first. F4 (reset, destructive) → bottom of Cài đặt, separated, confirm-guarded.

**Step 5 — Zones**: F1 primary (above-fold, frequent), F2 primary (above-fold, occasional but visual), F3 secondary (below-fold, rare), F4 tertiary (bottom, destructive).

**Step 6 — Whitespace**: Large gap between tab nav and panel (24px, separates). Small gap within panel sections (12px, unites). No border on cards — proximity groups. Border only under tab nav (active indicator).

**Step 7 — ASCII wireframe** (variant A, recommended):
```
┌─────────────────────────────────────────┐
│  Tùy chọn                               │  ← no em-dash
├─────────────────────────────────────────┤
│ [Tài nguyên] [Giao diện] [Cài đặt]      │  ← tabs, underline active
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Tài nguyên ──────────────────────┐  │
│  │  [Drag file hoặc click import]    │  │  ← F1 primary
│  │  ─────────────────────────────    │  │
│  │  • dict-en.yomitan  [xóa]         │  │
│  │  • dict-ja.yomitan  [xóa]         │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

Variant B (sidebar instead of tabs) — rejected: 3 groups = tabs convention (Jakob), sidebar overkill for 3.

**Responsive**: mobile → tabs become bottom-tab bar (≤5 groups rule), content parity (same 3 groups), F4 stays bottom of Cài đặt with confirm.

**[GATE 1 APPROVAL]**: Anh picks variant A. Proceed to Gate 2.

## Gate 2 — UI-UX-Contract (full surface)

**Step 8 — Intent**: "Reading this as: settings panel for extension users (technical enough to install, not developers), editorial-clean language, leaning minimalist-ui."

**Step 9 — Dials**: `variance: 4` (settings need predictability), `motion: 3` (functional hover/active only), `density: 5` (3 tabs + content, balanced).

**Step 10 — Audit** (existing `OptionsApp.tsx` + `.module.css`):
- Typography: Inter (AI-slop), title 16px lacks presence, only 400/600.
- Color: `#2563eb` accent sat 92% (>80%), flat zero texture.
- Layout: `min-height: 100vh` (iOS bug), padding 24px tight, tab padding 8px (<44px touch).
- Interactivity: no `:active`, no `:focus-visible`, `ease` transition (no character).
- Content: "Cell — Tùy chọn" uses em-dash (BANNED). SettingsPlaceholder exposes dev note.
- Component: tab underline OK, SettingsPlaceholder too sparse.
- Iconography: zero icons (tabs lack scannability).
- Code: missing `aria-controls` + `id` linking tabs→tabpanels.

**Step 11 — Placement matrix** (reuses Gate 1 grouping):
```yaml
functions:
  - { id: F1, name: "Manage dictionaries", element: panel, tab: "Tài nguyên", zone: primary, priority: above-fold, affordance: "drag-drop zone + hint + list + import button", steps_to_complete: 2, flow_ok: true }
  - { id: F2, name: "Customize theme", element: panel, tab: "Giao diện", zone: primary, priority: above-fold, affordance: "live preview + sliders", steps_to_complete: 1, flow_ok: true }
  - { id: F3, name: "App settings", element: panel, tab: "Cài đặt", zone: secondary, priority: below-fold, affordance: "grouped form sections", steps_to_complete: 1, flow_ok: true }
  - { id: F4, name: "Reset all data", element: button, tab: "Cài đặt", zone: tertiary, priority: on-demand, affordance: "bottom, separated, confirm dialog", steps_to_complete: 2, flow_ok: true }
```

**Step 12 — Flows**: Import dict = [drag file, confirm] (2). Delete dict = [click delete, confirm] (2). Change theme = [click Giao diện, drag slider] (2). Reset = [click reset, confirm dialog] (2). All ≤ 3, `ok: true`.

**Step 13 — IA**: `nav_type: tabs`, items [Tài nguyên, Giao diện, Cài đặt], grouping "scope-first: my stuff / my look / my config", default Tài nguyên, back_nav false, search false.

**Step 14 — Hierarchy**: F-pattern left-aligned tabs + content below. Gestalt proximity: tab group tight 4px, panel generous 24px. Similarity: one accent for active underline + focus ring.

**Step 15 — Aesthetic**: `selected: minimalist-ui`. Rejected: high-end-visual-design ("settings is a tool, not premium consumer"), industrial-brutalist-ui ("not a data-heavy dashboard").

**Step 16 — Reference design system** (DO NOT re-define tokens):
```yaml
design_system:
  tokens: "docs/design-system/tokens/*"          # color, typography, spacing, shape-elevation-motion
  components: "docs/design-system/components/*"   # popup-react, controllers, etc.
  guidelines: "docs/design-system/guidelines/*"   # visual, layout, accessibility, content, development
  patterns: "docs/design-system/patterns/*"       # interaction, settings
  aesthetic: minimalist-ui
  deviations: []   # full compliance, no new tokens
```
Implementer reads design system files directly — contract does not copy token values.

**Step 17 — States**: TabButton (hover color shift, active scale(0.98)+translate-y(1px), focus 2px ring). ResourcesPanel (loading skeleton list, empty composed getting-started+drag-drop hint, error inline+retry). ThemePanel (skeleton sliders, error inline). SettingsPanel (error inline per field). Reset button (disabled until confirm checkbox).

**Step 18 — Anti-slop**: bans [em_dash, inter_font, ai_purple_gradient, three_equal_cards, fake_screenshot_div, scroll_cue, locale_strip, version_footer, eyebrow_overuse].

**Step 19 — ATs**: AT1-AT7 per `design-checklist.md`.

**Step 20 — Mockup**: `mockups/options-app.html` — 3 tabs (Tài nguyên active underline), title "Tùy chọn" (no em-dash), ResourcesPanel drag-drop + list, token colors + Geist, desktop + mobile side by side.

**Step 21 — [GATE 2 APPROVAL]**: Anh approves contract. Hand off `UI-UX-Contract.md` to implement loop.

## Handoff

Output: `UI-UX-Contract.md` (single file, all 16 YAML sections filled). Implement loop (downstream) reads this file, implements code per contract, rebuilds `dist/`, then `ui-checker` runs AT1-AT7 via MCP edge-devtools (Layer 1 machine-verifiable) + adversarial subagent (Layer 2 cognitive) against the contract.
