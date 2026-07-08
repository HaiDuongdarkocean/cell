# UI-Contract — <screen name>

> Source of truth. Implementer does NOT change placement/vibe/IA without returning to Phase 1.

```yaml
# 1. meta
screen: <name>; route: <url>; workflow: new|redesign; created_at: <ISO>

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

# 4. aesthetic (pick ONE, commit whole screen)
selected: <minimalist-ui|high-end-visual-design|industrial-brutalist-ui>
rejected: { <option>: "<reason>", <option>: "<reason>" }
fonts: { display, body, mono }   # ban Inter default; use Geist/Outfit/Satoshi/Cabinet Grotesk
palette: { canvas: "<no #fff>", surface, text_primary: "<no #000>", text_secondary, border, accent: "<max 1, sat <80%>" }
shape: { card_radius, button_radius, input_radius, rule: "<one line>" }
motion: { duration: "<ms>", easing: "<cubic-bezier, no linear/ease-in-out>" }

# 5. functions (placement matrix) — one row per function
functions:
  - { id: F1, name, element: <button|list|form|card|panel|table|chart>, tab, zone: <primary|secondary|tertiary>, priority: <above-fold|below-fold|on-demand>, affordance: "<one sentence>", steps_to_complete: <int flag if >3>, flow_ok: <bool> }

# 6. information architecture
ia:
  nav_type: <tabs|sidebar|top-nav|floating|command-menu>   # 2-4 tabs, 5-12 sidebar, >12 cmd
  nav_items: [<i1>, <i2>, <i3>]
  grouping: "<by user mental model, not internal modules>"
  default_tab: "<item>"; back_nav: <bool>; search: <bool>

# 7. task flows (max 3 steps each)
flows:
  - { task, steps: [<s1>,<s2>,<s3>], count: <int>, ok: <bool> }

# 8. first-glance test (3s)
first_glance: { sees_in_3s: "<3s view>", knows_what_to_do: "<next action>", needs_guide: <false=pass> }

# 9. layout
layout:
  container: { max_width, margin, padding_block, min_height: "100dvh" }   # never 100vh
  header: { title: "<no em-dash>", title_size, title_weight, title_tracking, title_wrap: balance }
  nav: { type: <underline|pill|sidebar>, gap, border, button_padding: "<min 44px>", active_indicator }
  panel: { padding_block }

# 10. state coverage (per component)
states:
  - { component, loading: <skeleton|n/a>, empty: <composed|n/a>, error: <inline|n/a>, hover, active, focus: "<2px ring accent>", disabled: <true|n/a> }

# 11. anti-slop bans (from anti-slop-checklist.md)
anti_slop:
  bans: [em_dash, inter_font, ai_purple_gradient, three_equal_cards, fake_screenshot_div, scroll_cue, locale_strip, version_footer, eyebrow_overuse]
  hero_fit: { headline_max_lines: 2, subtext_max_words: 20 }   # landing only

# 12. accessibility
a11y:
  contrast: WCAG_AA   # 4.5:1 body, 3:1 large
  focus_ring: visible   # 2px accent, 3:1
  keyboard: "<logical order, no traps>"
  aria: { tablist: <bool>, tab: {role: tab, aria_controls: <id>, aria_selected: <bool>}, tabpanel: {role: tabpanel, id: <id>, aria_labelledby: <id>} }
  skip_link: <bool>; alt_text: <bool>

# 13. mockup
mockup: { file: mockups/<screen>.html, status: pending|approved }

# 14. definition of done
dod:
  contract_compliance: [every function has a component, every token via CSS var, every state implemented, zero anti-slop violations, ARIA matches a11y]
  ux_acceptance: [first-glance passes, every flow <=3 steps, zero AI tells, a11y 0 violations, console 0 errors, mobile single-column no h-scroll]

# 15. acceptance tests (reviewer runs in Phase 2)
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

# addendum (reviewer fails appended during loop)
addendum:
  round_1: { fails: [{ at_id, detail, fix }] }
```
