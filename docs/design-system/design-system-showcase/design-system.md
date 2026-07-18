---
# ============================================================
# Cell Design System — AI Source of Truth
# Format: DESIGN.md (YAML frontmatter + Markdown body)
# Why: AI agent needs structured (machine-parseable) + semantic (usage intent).
#      HTML only has visual; this file has both. AI reads this, humans view showcase.html.
# ============================================================

meta:
  name: Cell Design System
  version: 1.0.0
  shape_source: YouTube DS (pill 18px / card 10px / dialog 12px, flat, hairline)
  color_source: Cell semantic tokens (slate + blue, NOT YouTube red)
  token_source: src/shared/styles/tokens.json (canonical; tokens.css is generated from it)
  visual_reference: ./showcase.html
  principles:
    - id: P1
      name: Content-first
      rule: "Flat, zero elevation, hairline 1px border, whitespace separation. UI chrome never competes with content."
    - id: P2
      name: Alpha-based states
      rule: "Hover/active use surface-hover fill (theme-agnostic). Focus = 2px solid ring offset 2px (WCAG 2.4.7). No solid color flashes."
    - id: P3
      name: Shape ≠ Color
      rule: "Shape/effect tokens follow YouTube. Color tokens stay Cell. Two layers, independently swappable."

# === TOKENS (machine-parseable) ===
tokens:
  color:
    primary:        { dark: "#60a5fa", light: "#2563eb", usage: "CTA, links, active state, focus ring" }
    primary-hover:  { dark: "#3b82f6", light: "#1d4ed8", usage: "primary button hover" }
    primary-active: { dark: "#2563eb", light: "#1e40af", usage: "primary button active (pressed)" }
    primary-subtle: { dark: "rgba(96,165,250,0.15)", light: "rgba(37,99,235,0.1)", usage: "selected/active fill (chip, list-item, nav, badge--primary)" }
    secondary:      { dark: "#334155", light: "#e2e8f0", usage: "secondary button bg" }
    secondary-hover:{ dark: "#475569", light: "#cbd5e1", usage: "secondary button hover" }
    secondary-foreground: { dark: "#f1f5f9", light: "#0f172a", usage: "text on secondary" }
    destructive:    { dark: "#dc2626", light: "#dc2626", usage: "destructive button, error border" }
    destructive-hover: { dark: "#b91c1c", light: "#b91c1c", usage: "destructive button hover" }
    destructive-foreground: { dark: "#ffffff", light: "#ffffff", usage: "text on destructive" }
    background:     { dark: "#0f172a", light: "#ffffff", usage: "page bg, dialog bg, popover bg" }
    surface:        { dark: "#1e293b", light: "#f8fafc", usage: "card bg, input bg, button default bg" }
    surface-hover:  { dark: "#334155", light: "#f1f5f9", usage: "hover fill (universal — icon-btn, list-item, tab, nav, chip)" }
    muted:          { dark: "#334155", light: "#f1f5f9", usage: "disabled input bg (alias of surface-hover)" }
    text:           { dark: "#f1f5f9", light: "#0f172a", usage: "primary text" }
    text-secondary: { dark: "#cbd5e1", light: "#475569", usage: "secondary text, label" }
    text-muted:     { dark: "#64748b", light: "#94a3b8", usage: "muted text, meta, placeholder, chevron" }
    text-inverse:   { dark: "#0f172a", light: "#ffffff", usage: "text on primary/destructive fill" }
    border:         { dark: "#334155", light: "#e2e8f0", usage: "hairline border (card, input, button outline)" }
    border-subtle:  { dark: "#1e293b", light: "#f1f5f9", usage: "divider, dialog header/footer border" }
    border-focus:   { dark: "#60a5fa", light: "#2563eb", usage: "border on hover/focus (input, outline button)" }
    success:        { dark: "#10b981", light: "#059669", usage: "success badge/alert/state-label--open" }
    success-subtle: { dark: "rgba(16,185,129,0.15)", light: "rgba(5,150,105,0.1)", usage: "success fill (alert, banner, badge)" }
    warning:        { dark: "#f59e0b", light: "#d97706", usage: "warning badge/alert" }
    warning-subtle: { dark: "rgba(245,158,11,0.15)", light: "rgba(217,119,6,0.1)", usage: "warning fill" }
    error:          { dark: "#ef4444", light: "#dc2626", usage: "error badge/alert/input error border" }
    error-subtle:   { dark: "rgba(239,68,68,0.15)", light: "rgba(220,38,38,0.1)", usage: "error fill" }
  radius:
    sm:    { value: "6px",  usage: "tooltip, kbd" }
    md:    { value: "18px", usage: "BUTTON, INPUT, SELECT, DROPDOWN TRIGGER, TABS, PAGINATION, TOKEN-INPUT (pill — YouTube)" }
    lg:    { value: "10px", usage: "CARD, LIST-ITEM, NAV-ITEM, DROPDOWN-ITEM, ACCORDION, BANNER, ALERT, SKELETON-RECT (card — YouTube)" }
    xl:    { value: "12px", usage: "DIALOG, POPOVER, ACTION-MENU, DROPDOWN-MENU, ACCORDION container, SECTION-CARD (dialog — YouTube)" }
    full:  { value: "9999px", usage: "ICON-BUTTON, BADGE, CHIP, TOGGLE, AVATAR, COUNTER, PROGRESS, SPINNER, PAGINATION active (circular)" }
  shadow:
    md: { value: "none", usage: "flat — zero elevation (YouTube)" }
    lg: { value: "none", usage: "flat — zero elevation (YouTube)" }
  alpha_scale:
    subtle_fill: { dark: "0.15", light: "0.1", rule: "all semantic subtle fills same alpha within a theme" }
    scrim:       { value: "0.5", rule: "dialog overlay rgba(0,0,0,0.5) — fixed, theme-agnostic" }
    knob_shadow: { value: "0.2", rule: "toggle knob rgba(0,0,0,0.2) — fixed" }
  spacing:  { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "20px", "2xl": "24px", "3xl": "32px" }
  font:
    family: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    sizes:  { xs: "12px", sm: "13px", base: "14px", lg: "16px", xl: "18px", "2xl": "20px", "3xl": "24px" }
    weights: { regular: 400, medium: 500, semibold: 600, bold: 700 }

# === COMPONENT REGISTRY (machine-parseable index) ===
# AI agent: query this to find component by name/category. Then read the matching ## section below.
components:
  - id: button
    name: Button
    category: action
    variants: [primary, secondary, outline, ghost, destructive, link, sm, lg]
    states: [default, hover, active, focus, disabled, loading]
    tokens: { bg: primary, color: text-inverse, radius: md, border: primary }
    section: "## 1. Button"
  - id: icon-button
    name: Icon Button
    category: action
    variants: [standard, outlined, filled]
    states: [default, hover, active, focus, disabled, selected]
    tokens: { size: "40x40", radius: full, hover_bg: surface-hover, no_border: true, no_bg: true }
    section: "## 2. Icon Button"
  - id: input
    name: Input / Textarea / Search
    category: form
    variants: [text, textarea, search, error, disabled]
    states: [default, hover, focus, error, disabled]
    tokens: { radius: md, border: border, focus_ring: "2px primary", placeholder: text-muted }
    section: "## 3. Input / Textarea / Search"
  - id: dropdown
    name: Dropdown / Select
    category: form
    variants: [default, open, selected, disabled]
    tokens: { trigger_radius: md, menu_radius: xl, item_height: "40px", selected_bg: primary-subtle }
    section: "## 4. Dropdown / Select"
  - id: checkbox
    name: Checkbox / Radio
    category: form
    states: [default, hover, focus, checked, disabled]
    tokens: { accent_color: primary, size: "18px" }
    section: "## 5–6. Checkbox / Radio"
  - id: toggle
    name: Toggle / Switch
    category: form
    states: [default, hover, focus, checked, disabled]
    tokens: { track_radius: full, knob_radius: full, checked_bg: primary }
    section: "## 7. Toggle / Switch"
  - id: card
    name: Card
    category: container
    variants: [default, interactive, selected]
    tokens: { radius: lg, border: border, flat: true }
    section: "## 8. Card"
  - id: badge
    name: Badge / Chip / Tag
    category: display
    variants: [neutral, primary, success, warning, error, outline, removable]
    tokens: { radius: full, border: border }
    section: "## 9. Badge / Chip / Tag"
  - id: dialog
    name: Dialog / Modal
    category: overlay
    tokens: { radius: xl, overlay: "rgba(0,0,0,0.5)", flat: true, close: "Esc / overlay click / button" }
    section: "## 10. Dialog / Modal"
  - id: tooltip
    name: Tooltip
    category: overlay
    tokens: { radius: sm, bg: text, color: background, trigger: hover }
    section: "## 11. Tooltip"
  - id: toast
    name: Toast / Alert
    category: feedback
    variants: [success, error, warning, info]
    tokens: { toast_radius: md, alert_radius: lg, flat: true }
    section: "## 12. Toast / Alert"
  - id: progress
    name: Progress / Spinner
    category: feedback
    variants: [linear, indeterminate, circular]
    tokens: { track_bg: surface-hover, bar_bg: primary, radius: full }
    section: "## 13. Progress / Spinner"
  - id: avatar
    name: Avatar
    category: display
    variants: [sm, md, lg, group, image, fallback]
    tokens: { radius: full, fallback_bg: primary-subtle, fallback_color: primary }
    section: "## 14. Avatar"
  - id: tabs
    name: Tabs / Segmented
    category: navigation
    variants: [tabs, segmented]
    states: [default, hover, active]
    tokens: { container_radius: md, active_bg: primary, hover_bg: surface-hover }
    section: "## 15. Tabs / Segmented"
  - id: list-item
    name: List Item
    category: display
    states: [default, hover, selected, disabled]
    tokens: { min_height: "40px", radius: lg, hover_bg: surface-hover, selected_bg: primary-subtle }
    section: "## 16. List Item"
  - id: breadcrumbs
    name: Breadcrumbs
    category: navigation
    states: [default, hover, current]
    tokens: { item_radius: md, hover_bg: surface-hover, current_weight: semibold }
    section: "## 17. Breadcrumbs"
  - id: pagination
    name: Pagination
    category: navigation
    states: [default, hover, active, disabled]
    tokens: { btn_radius: md, btn_size: "32px", active_bg: primary }
    section: "## 18. Pagination"
  - id: skeleton
    name: Skeleton
    category: feedback
    variants: [text, title, avatar, rect]
    tokens: { bg: surface-hover, radius: sm, animation: shimmer }
    section: "## 19. Skeleton"
  - id: empty-state
    name: Empty State
    category: feedback
    tokens: { icon_muted: true, centered: true }
    section: "## 20. Empty State"
  - id: banner
    name: Banner
    category: feedback
    variants: [info, success, warning, error]
    tokens: { radius: lg, border: variant-color, bg: variant-subtle, dismissible: true }
    section: "## 21. Banner"
  - id: popover
    name: Popover
    category: overlay
    tokens: { radius: xl, arrow: true, flat: true, trigger: click, close: "outside/Esc" }
    section: "## 22. Popover"
  - id: action-menu
    name: Action Menu
    category: overlay
    variants: [default, danger, divider]
    tokens: { panel_radius: xl, item_height: "40px", item_radius: lg, trigger: "⋮ icon-btn" }
    section: "## 23. Action Menu"
  - id: accordion
    name: Accordion / Disclosure
    category: container
    states: [open, closed]
    tokens: { container_radius: lg, item_divider: border-subtle, chevron_rotate: "180deg" }
    section: "## 24. Accordion / Disclosure"
  - id: nav-list
    name: Nav List / Sidebar
    category: navigation
    states: [default, hover, active]
    tokens: { item_height: "40px", item_radius: lg, active_bg: primary-subtle, group_label: text-muted }
    section: "## 25. Nav List / Sidebar"
  - id: link
    name: Link
    category: typography
    variants: [primary, muted]
    tokens: { color: primary, hover: underline }
    section: "## 26. Link"
  - id: counter
    name: Counter Label
    category: display
    variants: [neutral, primary, inverse]
    tokens: { radius: full, min_width: "20px", height: "20px" }
    section: "## 27. Counter Label"
  - id: relative-time
    name: Relative Time
    category: typography
    tokens: { color: text-muted, nowrap: true }
    section: "## 28. Relative Time"
  - id: truncate
    name: Truncate
    category: typography
    variants: [single, 2-line]
    tokens: { ellipsis: true, line_clamp: 2 }
    section: "## 29. Truncate"
  - id: button-group
    name: Button Group
    category: action
    tokens: { container_radius: md, separator: border, joined: true }
    section: "## 30. Button Group"
  - id: timeline
    name: Timeline
    category: display
    variants: [default, muted]
    tokens: { dot_radius: full, dot_border: "2px primary", line_bg: border-subtle }
    section: "## 31. Timeline"
  - id: tree-view
    name: Tree View
    category: navigation
    states: [open, closed, selected]
    tokens: { row_radius: md, indent: "16px", chevron_rotate: "90deg", selected_bg: primary-subtle }
    section: "## 32. Tree View"
  - id: data-table
    name: Data Table
    category: display
    states: [default, hover, selected]
    tokens: { header_color: text-muted, row_divider: border-subtle, hover_bg: surface-hover, selected_bg: primary-subtle }
    section: "## 33. Data Table"
  - id: state-label
    name: State Label
    category: display
    variants: [open, closed, merged, draft]
    tokens: { radius: full, dot: "8px currentColor", border: variant-color, bg: variant-subtle }
    section: "## 34. State Label"
  - id: token-input
    name: Token / Tag Input
    category: form
    tokens: { container_radius: md, token_radius: full, token_bg: primary-subtle, focus_ring: true }
    section: "## 35. Token / Tag Input"
  - id: kbd
    name: Keybinding Hint
    category: typography
    tokens: { radius: sm, border: "1px border (2px bottom)", bg: surface, font: monospace }
    section: "## 36. Keybinding Hint"
---

# Cell Design System

> **AI agent**: Read the YAML frontmatter above for machine-parseable tokens + component registry.
> Read the sections below for usage intent (when to use, variants, states, do/don't).
> Visual reference: `./showcase.html` (open in browser).

## Principles

### P1 — Content-first
Flat, zero elevation, hairline 1px border, whitespace separation. UI chrome never competes with content. **No shadows anywhere** (`--shadow-md: none`, `--shadow-lg: none`).

### P2 — Alpha-based states
- Hover/active: `--color-surface-hover` fill (theme-agnostic, works dark + light)
- Focus: `outline: 2px solid var(--color-primary); outline-offset: 2px` (WCAG 2.4.7)
- Selected: `--color-primary-subtle` fill + `--color-primary` text
- **Never** use solid color flashes for hover — always alpha/subtle.

### P3 — Shape ≠ Color
- Shape/effect tokens (radius, shadow) follow **YouTube DS**
- Color tokens stay **Cell** (slate + blue, NOT YouTube red)
- Two layers independently swappable: change color theme without touching shape, vice versa.

---

## 1. Button

**When**: Initiate actions. Primary = main CTA, secondary = alternative, outline = low-emphasis, ghost = inline, destructive = irreversible, link = navigation.

**Variants**: `btn--primary` · `btn--secondary` · `btn--outline` · `btn--ghost` · `btn--destructive` · `btn--link` · `btn--sm` · `btn--lg`

**States**: default → hover (bg darken) → active (scale 0.98) → focus (2px ring) → disabled (opacity 0.5) → loading (opacity 0.7, pointer-events none)

**Tokens**: `radius: --radius-md (18px)` · `bg: --color-primary` (primary) · `color: --color-text-inverse` · `border: --color-primary` · `shadow: none`

**Do**: Use primary for ONE main action per section. Use outline for cancel/dismiss.
**Don't**: Use destructive for non-irreversible actions. Use primary for body text links (use `.link` instead).

```html
<button class="btn btn--primary">Save</button>
<button class="btn btn--outline">Cancel</button>
```

---

## 2. Icon Button

**When**: Compact action with clear icon meaning. Toolbar, header actions, card actions.

**Variants**: standard (no border, no bg) · `icon-btn--outlined` (hairline) · `icon-btn--filled` (primary bg)

**States**: default (transparent) → hover (surface-hover fill, circular) → active (scale 0.96) → focus (2px ring) → selected (primary-subtle) → disabled (opacity 0.5)

**Tokens**: `size: 40×40` · `radius: --radius-full` · `hover_bg: --color-surface-hover` · `no border, no bg at rest`

**Do**: Always set `aria-label` (icon-only = no visible text).
**Don't**: Add border to standard variant — YouTube pattern is borderless at rest.

```html
<button class="icon-btn" aria-label="Settings"><svg>...</svg></button>
```

---

## 3. Input / Textarea / Search

**When**: Text entry. Input = single line, textarea = multi-line, search = input + leading icon.

**States**: default → hover (border-focus) → focus (2px ring + primary border) → error (error border + error ring) → disabled (opacity 0.5, muted bg)

**Tokens**: `radius: --radius-md (18px)` · `border: --color-border` · `placeholder: --color-text-muted` · `focus: 2px --color-primary`

**Do**: Use `is-error` class for validation errors (red border + ring).
**Don't**: Use border thicker than 1px. Add shadow.

```html
<input class="input" placeholder="Email" />
<div class="search"><span class="search__icon"><svg/></span><input class="input search__input" /></div>
```

---

## 4. Dropdown / Select

**When**: Choose one value from a list. Replaces native `<select>` (which can't be styled cross-browser).

**Variants**: default · open · selected · disabled

**Tokens**: `trigger_radius: --radius-md (18px)` · `menu_radius: --radius-xl (12px)` · `item_height: 40px` · `item_radius: --radius-lg` · `selected_bg: --color-primary-subtle`

**Do**: Use custom dropdown (not native select) for YouTube-consistent styling.
**Don't**: Use native `<select>` — option list is OS-styled, breaks design system.

```js
createDropdown({ ariaLabel: 'Status', options: [...], value: 'active', onChange: fn })
```

---

## 5–6. Checkbox / Radio

**When**: Checkbox = multi-select or toggle single option. Radio = single-select from list.

**States**: default → hover → focus (2px ring) → checked → disabled (opacity 0.5)

**Tokens**: `size: 18px` · `accent-color: --color-primary`

**Do**: Group radios in `<fieldset>` with `<legend>`.
**Don't**: Use checkbox for single binary toggle — use `.toggle` instead.

```html
<input type="checkbox" class="checkbox" />
<input type="radio" name="group" class="radio" />
```

---

## 7. Toggle / Switch

**When**: Binary on/off setting (instant effect, no save needed).

**States**: default → hover → focus (2px ring on track) → checked (primary fill) → disabled (opacity 0.5)

**Tokens**: `track_radius: --radius-full` · `knob_radius: --radius-full` · `checked_bg: --color-primary` · `knob_bg: --color-text-inverse`

**Do**: Use for settings that apply immediately.
**Don't**: Use for settings requiring a save button — use checkbox instead.

```html
<label class="toggle"><input type="checkbox" class="toggle__input" /><span class="toggle__track"><span class="toggle__knob"></span></span></label>
```

---

## 8. Card

**When**: Group related content. Container for any content block.

**Variants**: default · `card--interactive` (hover) · `card--selected`

**Tokens**: `radius: --radius-lg (10px)` · `border: --color-border` · `flat: true` · `hover_border: --color-border-focus`

**Do**: Use for content grouping (video card, settings group, profile).
**Don't**: Nest cards > 2 levels deep. Add shadow.

```html
<div class="card">...</div>
<div class="card card--interactive">...</div>
```

---

## 9. Badge / Chip / Tag

**When**: Badge = status/category label (non-interactive). Chip = filter/tag (interactive, removable).

**Variants**: neutral · primary · success · warning · error · outline · removable

**Tokens**: `radius: --radius-full` · `border: --color-border` · `selected_bg: --color-primary-subtle`

**Do**: Use badge for metadata (count, status). Use chip for filters.
**Don't**: Use badge for actions — use button.

```html
<span class="badge badge--primary">New</span>
<span class="chip is-selected">Active <button class="chip__remove">×</button></span>
```

---

## 10. Dialog / Modal

**When**: Focused task requiring attention (confirm, form, detail). Blocks background.

**Tokens**: `radius: --radius-xl (12px)` · `overlay: rgba(0,0,0,0.5)` · `flat: true` · `close: Esc / overlay click / button`

**Do**: Provide Cancel + Confirm in footer. Close on Esc + overlay click.
**Don't**: Use for non-blocking info — use toast or banner.

```html
<div class="dialog-overlay is-open"><div class="dialog">...</div></div>
```

---

## 11. Tooltip

**When**: Brief hint for an icon-only button or ambiguous control.

**Tokens**: `radius: --radius-sm` · `bg: --color-text` · `color: --color-background` (inverted) · `trigger: hover`

**Do**: Keep under 5 words. Show on hover, hide on hover-out.
**Don't**: Put interactive content in tooltip — use popover.

```html
<span class="tooltip"><button>...</button><span class="tooltip__bubble">Save (⌘S)</span></span>
```

---

## 12. Toast / Alert

**When**: Toast = transient confirmation (auto-dismiss). Alert = inline persistent message.

**Variants**: success · error · warning · info

**Tokens**: `toast_radius: --radius-md` · `alert_radius: --radius-lg` · `flat: true` · `border: variant-color`

**Do**: Auto-dismiss toast after 2.5s. Use alert for page-level important info.
**Don't**: Stack > 1 toast. Use toast for errors requiring action — use alert.

```html
<div class="toast toast--success is-visible">Saved</div>
<div class="alert alert--warning">...</div>
```

---

## 13. Progress / Spinner

**When**: Progress = known % completion. Spinner = unknown duration. Skeleton = content loading placeholder.

**Variants**: linear · indeterminate · circular (spinner)

**Tokens**: `track_bg: --color-surface-hover` · `bar_bg: --color-primary` · `radius: --radius-full`

**Do**: Use spinner for quick actions (<3s). Use skeleton for content load.
**Don't**: Use progress for indeterminate — use spinner or indeterminate bar.

```html
<div class="progress"><div class="progress__bar" style="width:60%"></div></div>
<span class="spinner"></span>
```

---

## 14. Avatar

**When**: User/organization image. Fallback = initials.

**Variants**: sm (28px) · md (40px) · lg (56px) · group (overlap) · image · fallback

**Tokens**: `radius: --radius-full` · `fallback_bg: --color-primary-subtle` · `fallback_color: --color-primary`

**Do**: Use initials fallback when no image.
**Don't**: Use square avatars — always circular.

```html
<span class="avatar">AB</span>
<span class="avatar-group"><span class="avatar avatar--sm">A</span><span class="avatar avatar--sm">B</span></span>
```

---

## 15. Tabs / Segmented

**When**: Tabs = switch between views of same content. Segmented = single-select pill group (immediate effect).

**States**: default → hover (surface-hover) → active (primary fill)

**Tokens**: `container_radius: --radius-md` · `active_bg: --color-primary` · `hover_bg: --color-surface-hover`

**Do**: Use tabs for related views. Use segmented for quick mode switches.
**Don't**: Use tabs for navigation between pages — use nav-list.

```html
<div class="tabs"><button class="tab is-active">All</button><button class="tab">Active</button></div>
<div class="segmented"><button class="segmented__opt is-active">List</button><button class="segmented__opt">Grid</button></div>
```

---

## 16. List Item

**When**: Row in a list (settings, results, history). 40px tall.

**States**: default → hover (surface-hover) → selected (primary-subtle) → disabled (opacity 0.5)

**Tokens**: `min_height: 40px` · `radius: --radius-lg` · `hover_bg: --color-surface-hover` · `selected_bg: --color-primary-subtle`

**Do**: Include icon + label + meta (timestamp/count).
**Don't**: Make list items > 3 lines — use card.

```html
<div class="list-item"><span class="list-item__icon"><svg/></span><span class="list-item__label">Item</span><span class="list-item__meta">2h ago</span></div>
```

---

## 17. Breadcrumbs

**When**: Show hierarchy path deeper than 2 levels.

**States**: default → hover (surface-hover) → current (semibold, no pointer)

**Tokens**: `item_radius: --radius-md` · `hover_bg: --color-surface-hover` · `sep_color: --color-text-muted`

**Do**: Mark current page with `is-current`.
**Don't**: Use for < 2 levels — redundant.

```html
<nav class="breadcrumbs"><a class="breadcrumbs__item">Home</a><span class="breadcrumbs__sep">/</span><span class="breadcrumbs__item is-current">Page</span></nav>
```

---

## 18. Pagination

**When**: Navigate paginated content > 1 page.

**States**: default → hover (surface-hover) → active (primary fill) → disabled (opacity 0.5)

**Tokens**: `btn_radius: --radius-md` · `btn_size: 32px` · `active_bg: --color-primary`

**Do**: Show ellipsis for > 7 pages. Disable prev/next at bounds.
**Don't**: Use for infinite scroll — use load-more button.

```html
<nav class="pagination"><button class="pagination__btn is-active">1</button><button class="pagination__btn">2</button><span class="pagination__ellipsis">…</span></nav>
```

---

## 19. Skeleton

**When**: Content loading placeholder (matches final content shape).

**Variants**: text (14px) · title (20px) · avatar (40px circle) · rect (100px)

**Tokens**: `bg: --color-surface-hover` · `radius: --radius-sm` · `animation: shimmer 1.6s`

**Do**: Match skeleton shape to real content. Use for > 200ms loads.
**Don't**: Use spinner for content load — skeleton reduces perceived wait.

```html
<span class="skeleton skeleton--text"></span>
<span class="skeleton skeleton--avatar"></span>
```

---

## 20. Empty State

**When**: No content to show (no data, no results, first-run).

**Tokens**: `icon_muted: true` · `centered: true` · `title_weight: semibold`

**Do**: Include icon + title + description + primary action.
**Don't**: Leave blank space — empty state guides user to next action.

```html
<div class="empty-state"><svg class="empty-state__icon"/>...<h3>No cards yet</h3><p>Create your first card.</p><button class="btn btn--primary">Create</button></div>
```

---

## 21. Banner

**When**: Page-level announcement (persistent, dismissible).

**Variants**: info · success · warning · error

**Tokens**: `radius: --radius-lg` · `border: variant-color` · `bg: variant-subtle` · `dismissible: true`

**Do**: Show at page top. Allow dismiss.
**Don't**: Use for transient feedback — use toast. Stack > 1 banner.

```html
<div class="banner banner--info"><div class="banner__body">...</div><button class="banner__close">×</button></div>
```

---

## 22. Popover

**When**: Floating panel with rich content (form, info, menu). Non-blocking.

**Tokens**: `radius: --radius-xl (12px)` · `arrow: true` · `flat: true` · `trigger: click` · `close: outside/Esc`

**Do**: Use for contextual info/actions anchored to trigger.
**Don't**: Use for modal tasks — use dialog. Put critical actions only in popover.

```html
<div class="popover" data-popover><button data-popover-trigger>Open</button><div class="popover__panel">...</div></div>
```

---

## 23. Action Menu

**When**: Overflow actions (⋮ trigger). Items are actions, NOT selectable values.

**Variants**: default · `action-menu__item--danger` · divider

**Tokens**: `panel_radius: --radius-xl` · `item_height: 40px` · `item_radius: --radius-lg` · `trigger: icon-btn ⋮`

**Do**: Group related actions, separate with divider. Mark destructive with `--danger`.
**Don't**: Use for value selection — use dropdown. Exceed 8 items — restructure.

```html
<div class="action-menu" data-action-menu><button class="icon-btn" data-action-menu-trigger>⋮</button><div class="action-menu__panel"><button class="action-menu__item">Edit</button><div class="action-menu__divider"></div><button class="action-menu__item action-menu__item--danger">Delete</button></div></div>
```

---

## 24. Accordion / Disclosure

**When**: Collapsible content sections (FAQ, settings groups, long content).

**States**: open (chevron rotate 180°) · closed

**Tokens**: `container_radius: --radius-lg` · `item_divider: --color-border-subtle` · `header_hover: --color-surface-hover`

**Do**: Allow multiple open by default. Use for progressive disclosure.
**Don't**: Nest accordions > 2 levels.

```html
<div class="accordion" data-accordion><div class="accordion__item is-open"><button class="accordion__header">Title <span class="accordion__chevron">▾</span></button><div class="accordion__body">...</div></div></div>
```

---

## 25. Nav List / Sidebar

**When**: Primary vertical navigation (sidebar, settings menu).

**States**: default → hover (surface-hover) → active (primary-subtle)

**Tokens**: `item_height: 40px` · `item_radius: --radius-lg` · `active_bg: --color-primary-subtle` · `group_label: --color-text-muted`

**Do**: Group items with labels. Mark active with `is-active`.
**Don't**: Use for > 12 items — collapse into tree-view.

```html
<nav class="nav-list"><div class="nav-list__group-label">Main</div><a class="nav-list__item is-active">Home</a><a class="nav-list__item">Cards</a></nav>
```

---

## 26. Link

**When**: Navigation hyperlink in body text.

**Variants**: primary (default) · `link--muted`

**Tokens**: `color: --color-primary` · `hover: underline`

**Do**: Use for in-text navigation.
**Don't**: Use for buttons — use `.btn` or `.btn--link`.

```html
<a class="link" href="#">View docs</a>
<a class="link link--muted">Secondary</a>
```

---

## 27. Counter Label

**When**: Numeric count next to nav item/button (issues, notifications).

**Variants**: neutral · `counter--primary` · `counter--inverse`

**Tokens**: `radius: --radius-full` · `min_width: 20px` · `height: 20px`

**Do**: Use for counts > 0. Show "99+" for > 99.
**Don't**: Use for status — use state-label.

```html
Issues <span class="counter counter--primary">42</span>
```

---

## 28. Relative Time

**When**: Timestamp display ("2h ago", "just now").

**Tokens**: `color: --color-text-muted` · `nowrap: true` · `font-size: --font-size-xs`

**Do**: Use for human-friendly times. Update via JS.
**Don't**: Show raw ISO timestamp to users.

```html
<span class="relative-time">2h ago</span>
```

---

## 29. Truncate

**When**: Long text in constrained space (card title, list label).

**Variants**: single-line (`.truncate`) · 2-line (`.truncate--2`)

**Tokens**: `ellipsis: true` · `line_clamp: 2` (webkit)

**Do**: Use single-line for titles. Use 2-line for descriptions.
**Don't**: Truncate < 20 chars — no benefit.

```html
<p class="truncate">Long text...</p>
<p class="truncate truncate--2">Long paragraph...</p>
```

---

## 30. Button Group

**When**: Related actions as single joined control (copy/edit/delete).

**Tokens**: `container_radius: --radius-md` · `separator: --color-border` · `joined: true`

**Do**: Group ≤ 4 buttons. Use for related actions.
**Don't**: Mix primary + destructive in same group.

```html
<div class="btn-group"><button class="btn">Copy</button><button class="btn">Edit</button><button class="btn">Delete</button></div>
```

---

## 31. Timeline

**When**: Chronological event list (history, activity feed, commit log).

**Variants**: default (primary dot) · `timeline__dot--muted`

**Tokens**: `dot_radius: --radius-full` · `dot_border: 2px --color-primary` · `line_bg: --color-border-subtle`

**Do**: Order newest-first. Use muted dot for past/inactive.
**Don't**: Use for future scheduled events — use calendar.

```html
<div class="timeline"><div class="timeline__item"><span class="timeline__dot"></span><div class="timeline__content"><p class="timeline__title">Created</p><p class="timeline__meta">2h ago</p></div></div></div>
```

---

## 32. Tree View

**When**: Hierarchical nested navigation (file tree, folder structure, playlist tree).

**States**: open (chevron rotate 90°) · closed · selected (primary-subtle)

**Tokens**: `row_radius: --radius-md` · `indent: 16px` · `chevron_rotate: 90deg` · `selected_bg: --color-primary-subtle`

**Do**: Use chevron for expandable nodes. Indent children 16px.
**Don't**: Use for < 2 levels — use nav-list.

```html
<div class="tree" data-tree><div class="tree__node is-open"><div class="tree__row"><span class="tree__chevron">›</span><span class="tree__label">src</span></div><div class="tree__children">...</div></div></div>
```

---

## 33. Data Table

**When**: Tabular data (rows × columns). Sortable, selectable.

**States**: default → hover (surface-hover) → selected (primary-subtle)

**Tokens**: `header_color: --color-text-muted` · `row_divider: --color-border-subtle` · `hover_bg: --color-surface-hover`

**Do**: Use uppercase muted header. Hairline row dividers.
**Don't**: Use for < 3 rows — use list. Add zebra striping — hover is enough.

```html
<table class="data-table"><thead><tr><th>Title</th></tr></thead><tbody><tr><td>Row 1</td></tr></tbody></table>
```

---

## 34. State Label

**When**: Status indicator with dot + label (PR state, issue state, video state).

**Variants**: open (success) · closed (muted) · merged (primary) · draft (secondary)

**Tokens**: `radius: --radius-full` · `dot: 8px currentColor` · `border: variant-color` · `bg: variant-subtle`

**Do**: Use dot + label for clarity. Match color to semantic.
**Don't**: Use for counts — use counter.

```html
<span class="state-label state-label--open"><span class="state-label__dot"></span>Open</span>
```

---

## 35. Token / Tag Input

**When**: Enter multiple tags/labels (form tags, email recipients, search filters).

**Tokens**: `container_radius: --radius-md` · `token_radius: --radius-full` · `token_bg: --color-primary-subtle` · `focus_ring: true`

**Do**: Add token on Enter/comma. Remove with × or Backspace on empty.
**Don't**: Allow duplicate tokens. Exceed ~10 tokens — use multi-select.

```html
<div class="token-input" data-token-input><span class="token-input__token">tag <button class="token-input__remove">×</button></span><input class="token-input__field" placeholder="Add tag…" /></div>
```

---

## 36. Keybinding Hint

**When**: Show keyboard shortcut (⌘K, Ctrl+S).

**Tokens**: `radius: --radius-sm` · `border: 1px --color-border (2px bottom)` · `bg: --color-surface` · `font: monospace`

**Do**: Show platform-appropriate glyphs (⌘ Mac, Ctrl Win).
**Don't**: Use for mouse-only actions.

```html
<span class="kbd-group"><span class="kbd">⌘</span><span class="kbd">K</span></span>
```

---

## AI Agent Usage Guide

**To find a component**: Query the `components:` list in YAML frontmatter by `id`, `name`, or `category`. Each entry has `section` pointing to the matching `##` heading below.

**To find a token**: Query `tokens:` in YAML frontmatter. Each token has `usage` field explaining when to use it.

**To build a component**: Read its `##` section for when/variants/states/do-don't + code snippet. Tokens are listed in YAML.

**To verify visual**: Open `./showcase.html` in browser — all 36 components rendered with live states.

**Common queries**:
- "Which token for hover fill?" → `tokens.color.surface-hover` (usage: "hover fill universal")
- "Which radius for a button?" → `tokens.radius.md` (18px pill, usage lists BUTTON)
- "How to build a destructive button?" → `components[id=button].section` → "## 1. Button" → variant `btn--destructive`
- "What color for selected list item?" → `tokens.color.primary-subtle` (usage: "selected/active fill")
