# Example — Redesigning OptionsApp

> Worked example. Phase 1 (design with anh) + Phase 2 (implement) for a Chrome extension settings panel.

## Context
Cell, Chrome Extension MV3 video downloader. Options page (`src/entrypoints/options/`) has 3 tabs: Resources, Theme, Settings. CSS Modules + CSS variables, no Tailwind. User wants redesign.

## Phase 1 — Design

**Step 1 — Intent**: "Reading this as: settings panel for extension users (technical enough to install, not developers), editorial-clean language, leaning minimalist-ui."

**Step 2 — Dials**: `variance: 4` (settings need predictability), `motion: 3` (functional hover/active only), `density: 5` (3 tabs + content, balanced).

**Step 3 — Audit** (existing `OptionsApp.tsx` + `.module.css`):
- Typography: Inter (AI-slop), title 16px lacks presence, only 400/600.
- Color: `#2563eb` accent sat 92% (>80%), flat zero texture.
- Layout: `min-height: 100vh` (iOS bug), padding 24px tight, tab padding 8px (<44px touch).
- Interactivity: no `:active`, no `:focus-visible`, `ease` transition (no character).
- Content: "Cell — Tùy chọn" uses em-dash (BANNED). SettingsPlaceholder exposes dev note.
- Component: tab underline OK, SettingsPlaceholder too sparse.
- Iconography: zero icons (tabs lack scannability).
- Code: missing `aria-controls` + `id` linking tabs→tabpanels.

**Step 4 — Placement matrix**:
```yaml
functions:
  - { id: F1, name: "Manage dictionaries (import/delete/list)", element: panel, tab: "Tài nguyên", zone: primary, priority: above-fold, affordance: "drag-drop zone + hint + list + import button", steps_to_complete: 2, flow_ok: true }
  - { id: F2, name: "Customize theme (color/font/overlay)", element: panel, tab: "Giao diện", zone: primary, priority: above-fold, affordance: "live preview + sliders", steps_to_complete: 1, flow_ok: true }
  - { id: F3, name: "App settings (general config)", element: panel, tab: "Cài đặt", zone: primary, priority: above-fold, affordance: "grouped form sections", steps_to_complete: 1, flow_ok: true }
```

**Step 5 — Flows**: Import dict = [drag file, confirm] (2). Delete dict = [click delete, confirm] (2). Change theme = [click Giao diện, drag slider] (2). All ≤ 3, `ok: true`.

**Step 6 — IA**: `nav_type: tabs`, items [Tài nguyên, Giao diện, Cài đặt], grouping "3 horizontal tabs, underline active, 1 panel visible", default Tài nguyên, back_nav false, search false.

**Step 7 — Hierarchy**: F-pattern left-aligned tabs + content below. Gestalt proximity: tab group tight 4px, panel generous 24px. Similarity: one accent for active underline + focus ring.

**Step 8 — Aesthetic**: `selected: minimalist-ui`. Rejected: high-end-visual-design ("settings is a tool, not premium consumer"), industrial-brutalist-ui ("not a data-heavy dashboard").

**Step 9 — Tokens**:
```yaml
fonts: { display: Geist, body: Geist, mono: Geist Mono }
palette: { canvas: "#FBFBFA", surface: "#FFFFFF", text_primary: "#18181B", text_secondary: "#71717A", border: "rgba(0,0,0,0.06)", accent: "#1F6C9F" }
shape: { card_radius: "12px", button_radius: "6px", input_radius: "6px", rule: "buttons 6px, cards 12px, inputs 6px" }
motion: { duration: "200ms", easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
```

**Step 10 — States**: TabButton (hover color shift, active scale(0.98)+translate-y(1px), focus 2px ring). ResourcesPanel (loading skeleton list, empty composed getting-started+drag-drop hint, error inline+retry). ThemePanel (skeleton sliders, error inline). SettingsPanel (error inline per field).

**Step 11 — Anti-slop**: bans [em_dash, inter_font, ai_purple_gradient, three_equal_cards, fake_screenshot_div, scroll_cue, locale_strip, version_footer, eyebrow_overuse].

**Step 12 — ATs**: AT1-AT7 per `design-checklist.md`.

**Step 13 — Mockup**: `mockups/options-app.html` — 3 tabs (Tài nguyên active underline), title "Tùy chọn" (no em-dash), ResourcesPanel drag-drop + list, token colors + Geist, desktop + mobile side by side.

**Step 14 — Approval**: Present contract + mockup. Anh approves. Proceed to Phase 2.

## Phase 2 — Implement

**Step 15-16 — Read contract, detect stack**: CSS Modules + CSS variables, React 19, TypeScript. No Tailwind. Use existing stack.

**Step 17 — Build**: `OptionsApp.tsx` (tabs with `aria-controls`+`id`, padding 12px 20px). `OptionsApp.module.css` (padding-block 48px, min-height 100dvh, Geist, accent `#1F6C9F`). `ResourcesPanel.tsx` (skeleton/empty/error). `ThemePanel.tsx` (skeleton). `SettingsPanel.tsx` (new, replaces SettingsPlaceholder).

**Step 18 — States**: All per contract state coverage table.

**Step 19 — A11y**: Contrast `#18181B` on `#FBFBFA` = 15.3:1 (AAA). Focus 2px `#1F6C9F` 3:1. ARIA tablist/tab/tabpanel with `aria-controls`+`id`+`aria-labelledby`. Keyboard arrows in tablist, Tab to panel, Home/End. Skip link added.

**Step 20 — Evidence** (MCP `edge-devtools`): `desktop_full.png` 1440x900, `mobile_375.png` 375x812, `tab_active_state.png`, `empty_state.png`, `error_state.png`, `console_log.txt` (0 errors), `a11y_report.txt` (0 violations), `flow_simulation.md` (3 tasks ≤2 steps), `code_diff.patch`.

**Step 21 — Gates**: `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` all pass.

**Step 22 — Hand off**: Pass `UI-Contract.md` + evidence to ui-ux-reviewer. Await PASS or FAIL list.
