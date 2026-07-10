# UI-UX-Contract — <screen name>

> Single source of truth. Implementer does NOT change placement/vibe/IA without returning to Gate 1.
> UX (structure, sections 5-7) locked at Gate 1. UI (surface, sections 8-14) locked at Gate 2.

```yaml
# 1. meta
screen: <name>; route: <url>; workflow: new|redesign; mode: A|B; created_at: <ISO>

# 2. intent
page_kind: <settings|landing|dashboard|portfolio|editorial|tool>
audience: <who, how technical>
primary_job: "<one sentence>"
vibe_read: "Reading this as: <kind> for <audience>, <vibe> language, leaning <aesthetic>."
redesign_mode: preserve|overhaul   # omit if new

# 3. dials (1-10)
variance: <n>   # 1=symmetric 10=asymmetric
motion: <n>     # 1=static 10=cinematic
density: <n>    # 1=airy 10=packed

# 4. design system reference (DO NOT re-define tokens)
design_system:
  tokens: "docs/design-system/tokens/*"   # color, typography, spacing, shape-elevation-motion
  components: "docs/design-system/components/*"
  guidelines: "docs/design-system/guidelines/*"
  patterns: "docs/design-system/patterns/*"
  aesthetic: <minimalist-ui|high-end-visual-design|industrial-brutalist-ui>   # pick ONE, commit whole screen
  deviations: []   # list any token not in the system; ask user first. Empty = full compliance.

# === GATE 1 — UX STRUCTURE (locked at wireframe approval) ===

# 5. function inventory (Mode A) — one row per function
functions:
  - { id: F1, name, element: <button|list|form|card|panel|table|chart>, frequency: <frequent|occasional|rare|destructive>, tab, zone: <primary|secondary|tertiary>, priority: <above-fold|below-fold|on-demand>, affordance: "<one sentence>", steps_to_complete: <int flag if >3>, flow_ok: <bool> }

# 6. information architecture (grouping + zones + order)
ia:
  model: <scope-first|domain|task-flow>   # settings=scope-first, dashboard=domain, tool=task-flow
  nav_type: <tabs|sidebar|top-nav|floating|command-menu>   # 2-4 tabs, 5-12 sidebar, >12 cmd
  nav_items: [<i1>, <i2>, <i3>]
  grouping: "<by user mental model, not internal modules — cite why each group exists>"
  grouping_reason: { <group1>: "<principle>", <group2>: "<principle>" }
  order: "<frequency first, task-flow second, destructive last>"
  default_tab: "<item>"; back_nav: <bool>; search: <bool>
  zones: { primary: "<what + why above-fold>", secondary: "<what + why below-fold>", tertiary: "<what + why collapsed>" }
  whitespace_map: "<large gap between groups (separates), small gap within (unites), border only where proximity ambiguous>"

# 7. layout (structure — no color/font/radius here)
layout:
  container: { max_width, margin, padding_block, min_height: "100dvh" }   # never 100vh
  header: { title: "<no em-dash>", title_size, title_weight, title_tracking, title_wrap: balance }
  nav: { type: <underline|pill|sidebar>, gap, border, button_padding: "<min 44px>", active_indicator }
  panel: { padding_block }
  ascii_wireframe: |
    <paste Gate 1 wireframe here — boxes/brackets/pipes only>
  responsive:
    desktop: "<nav type + zone visibility>"
    tablet: "<nav type transform, if structure differs>"
    mobile: "<nav type transform + accordion/billboard, if structure differs>"
    content_parity: "<same groups on every breakpoint, only nav type changes>"

# === Mode B only — placement decision ===
placement:   # omit in Mode A
  existing_wireframe: |
    <current page structure>
  new_function: { name, frequency, destructive: <bool>, spec: "<one sentence>" }
  proposed_wireframe: |
    <same page with ← NEW marker>
  decision: { group, zone, order_position, destructive_handling, why: "<cite principle>" }
  side_effect_check: { re_grouping: <bool>, hick_le7: <bool>, miller_le7: <bool>, whitespace_ok: <bool>, one_primary: <bool> }

# === GATE 2 — UI SURFACE (locked at contract approval) ===

# 8. task flows (max 3 steps each)
flows:
  - { task, steps: [<s1>,<s2>,<s3>], count: <int>, ok: <bool> }

# 9. first-glance test (3s)
first_glance: { sees_in_3s: "<3s view>", knows_what_to_do: "<next action>", needs_guide: <false=pass> }

# 10. visual hierarchy
hierarchy: { pattern: <F|Z|layer-cake>, eye_path: ["1st: <where>", "2nd: <where>", "3rd: <where>"], gestalt: "<proximity + similarity applied>" }

# 11. state coverage (per component)
states:
  - { component, loading: <skeleton|n/a>, empty: <composed|n/a>, error: <inline|n/a>, hover, active, focus: "<2px ring accent>", disabled: <true|n/a> }

# 12. anti-slop bans (from anti-slop-checklist.md)
anti_slop:
  bans: [em_dash, inter_font, ai_purple_gradient, three_equal_cards, fake_screenshot_div, scroll_cue, locale_strip, version_footer, eyebrow_overuse]
  hero_fit: { headline_max_lines: 2, subtext_max_words: 20 }   # landing only

# 13. accessibility
a11y:
  contrast: WCAG_AA   # 4.5:1 body, 3:1 large
  focus_ring: visible   # 2px accent, 3:1
  keyboard: "<logical order, no traps>"
  aria: { tablist: <bool>, tab: {role: tab, aria_controls: <id>, aria_selected: <bool>}, tabpanel: {role: tabpanel, id: <id>, aria_labelledby: <id>} }
  skip_link: <bool>; alt_text: <bool>

# 14. mockup
mockup: { file: mockups/<screen>.html, status: pending|approved }

# 15. definition of done
dod:
  contract_compliance: [every function has a component, every token via CSS var, every state implemented, zero anti-slop violations, ARIA matches a11y]
  ux_acceptance: [first-glance passes, every flow <=3 steps, zero AI tells, a11y 0 violations, console 0 errors, mobile single-column no h-scroll]

# 16. acceptance tests (reviewer runs post-implement)
acceptance_tests:
  - { id: AT1, name: "First-glance", method: "desktop screenshot, 3 questions in 3s", pass: "3/3 match" }
  - { id: AT2, name: "Flow step count", method: "read flow sim", pass: "all tasks <=3" }
  - { id: AT3, name: "Visual tell sweep", method: "scan screenshots for AI tells", pass: "zero" }
  - { id: AT4, name: "A11y runtime", method: "read a11y report", pass: "0 violations" }
  - { id: AT5, name: "Console clean", method: "read console log", pass: "0 errors" }
  - { id: AT6, name: "Responsive collapse", method: "desktop vs mobile 375px", pass: "single-column, no h-scroll, targets >=44px" }
  - { id: AT7, name: "Contract compliance", method: "code diff vs contract", pass: "100% match" }

# audit (redesign only) — 8 axes
audit: { typography: [], color: [], layout: [], interactivity: [], content: [], component: [], iconography: [], code_quality: [] }

# layout audit (Gate 1 checklist result)
layout_audit: { status: APPROVED|NEEDS_FIXES, sections: { input_fetch: "", ia: "", grouping: "", cognitive_load: "", order: "", hierarchy: "", minimalism: "", convention: "", bans: "", wireframe: "", responsive: "" } }

# addendum (reviewer fails appended during implement loop)
addendum:
  round_1: { fails: [{ at_id, detail, fix }] }
```
