# UI-UX-Contract — Options page redesign

> Single source of truth. Implementer does NOT change placement/vibe/IA without returning to Gate 1.
> UX (structure, sections 5-7) locked at Gate 1. UI (surface, sections 8-14) locked at Gate 2.

```yaml
# 1. meta
screen: options; route: chrome-extension://<id>/options.html; workflow: redesign; mode: B; created_at: 2026-07-10

# 2. intent
page_kind: settings
audience: "Anh yêu — developer tự dùng, technical, dùng Chrome extension hàng ngày"
primary_job: "Quản lý tài nguyên (dictionary + frequency import) + tùy chỉnh giao diện (theme) + cài đặt hệ thống"
vibe_read: "Reading this as: settings for developer, dark atmospheric workspace language, leaning minimalist-ui."
redesign_mode: preserve   # giữ cấu trúc 3 section, restyle surface sang design-dark-github

# 3. dials (1-10)
variance: 4   # settings = symmetric, sidebar + content grid cân đối
motion: 3     # settings = static, chỉ transition hover/focus
density: 5    # settings = comfortable, 24px padding, 64px section gap

# 4. design system reference (DO NOT re-define tokens)
design_system:
  tokens: "docs/design-system/tokens/*"            # color, typography, spacing, shape-elevation-motion
  components: "docs/design-system/components/*"     # popup-react, controllers, popup-media
  guidelines: "docs/design-system/guidelines/*"     # visual, layout, accessibility, content, development
  patterns: "docs/design-system/patterns/*"         # interaction, settings
  aesthetic: minimalist-ui
  deviations: []   # full compliance, no new tokens

# === GATE 1 — UX STRUCTURE (locked at wireframe approval) ===

# 5. function inventory (Mode B — audit existing + restyle)
functions:
  - { id: F1, name: "Import từ điển", element: dropzone, frequency: occasional, tab: resources, zone: primary, priority: above-fold, affordance: "kéo thả file hoặc click để chọn", steps_to_complete: 2, flow_ok: true }
  - { id: F2, name: "Xem danh sách từ điển", element: list, frequency: frequent, tab: resources, zone: primary, priority: above-fold, affordance: "card hiển thị name + wordCount + delete", steps_to_complete: 1, flow_ok: true }
  - { id: F3, name: "Xóa từ điển", element: button, frequency: rare, tab: resources, zone: primary, priority: on-demand, affordance: "icon ✕ trên card → confirm modal", steps_to_complete: 2, flow_ok: true }
  - { id: F4, name: "Import danh sách tần suất", element: dropzone, frequency: occasional, tab: resources, zone: secondary, priority: below-fold, affordance: "kéo thả file hoặc click", steps_to_complete: 2, flow_ok: true }
  - { id: F5, name: "Xem danh sách tần suất", element: list, frequency: frequent, tab: resources, zone: secondary, priority: below-fold, affordance: "card hiển thị name + wordCount + delete", steps_to_complete: 1, flow_ok: true }
  - { id: F6, name: "Xóa danh sách tần suất", element: button, frequency: rare, tab: resources, zone: secondary, priority: on-demand, affordance: "icon ✕ trên card → confirm modal", steps_to_complete: 2, flow_ok: true }
  - { id: F7, name: "Chỉnh sửa giao diện (theme)", element: panel, frequency: occasional, tab: theme, zone: primary, priority: above-fold, affordance: "mode cards + color customization + preview", steps_to_complete: 3, flow_ok: true }
  - { id: F8, name: "Import/export theme", element: button, frequency: rare, tab: theme, zone: secondary, priority: below-fold, affordance: "import/export buttons", steps_to_complete: 2, flow_ok: true }
  - { id: F9, name: "Cài đặt (placeholder M11)", element: panel, frequency: rare, tab: settings, zone: tertiary, priority: on-demand, affordance: "placeholder text — move SettingsDialog sau", steps_to_complete: 1, flow_ok: true }

# 6. information architecture (grouping + zones + order)
ia:
  model: scope-first   # settings pattern — me/data, me/visual, system
  nav_type: sidebar    # 3 items hiện tại + room grow (5-12 tối ưu sidebar)
  nav_items: [resources, theme, settings]
  grouping: "by user mental model — data import / visual / system. Không phải codebase modules."
  grouping_reason: { resources: "data import — user nghĩ 'tài nguyên học'", theme: "visual — user nghĩ 'giao diện'", settings: "system — user nghĩ 'cài đặt hệ thống'" }
  order: "frequency first — resources (import hàng tuần) → theme (chỉnh khi chán) → settings (hiếm)"
  default_tab: "resources"; back_nav: false; search: false
  zones: { primary: "resources — import + list, above-fold, frequent", secondary: "theme — mode + color + preview, below-fold, occasional", tertiary: "settings — placeholder, on-demand, rare" }
  whitespace_map: "large gap 64px giữa sidebar và content; small gap 24px trong card; border --color-slate-edge chỉ ở card outline + sidebar divider"

# 7. layout (structure — no color/font/radius here)
layout:
  container: { max_width: "1200px", margin: "0 auto", padding_block: "24px", min_height: "100dvh" }
  header: { title: "Cell — Tùy chọn", title_size: "40px", title_weight: "425", title_tracking: "-0.02em", title_wrap: balance }
  nav: { type: sidebar, gap: "0", border: "right 1px --color-slate-edge", button_padding: "12px 16px min 44px height", active_indicator: "left 2px --color-terminal-green" }
  panel: { padding_block: "24px" }
  ascii_wireframe: |
    Desktop ≥1024px      Tablet 768-1023px   Mobile <768px
    ┌──────────────────┐ ┌──────┐            ┌──────────────────┐
    │                  │ │      │            │  Cell      [☰]   │
    │  ▣ Tài nguyên    │ │  ▣   │            ├──────────────────┤
    │                  │ │      │            │                  │
    │  ▢ Giao diện     │ │  ▢   │            │  (content        │
    │                  │ │      │            │   full width)    │
    │  ▢ Cài đặt       │ │  ▢   │            │                  │
    │                  │ │      │            │                  │
    │  ────────────    │ │  ──  │            │                  │
    │                  │ │      │            │                  │
    │  (room sau)      │ │  +   │            │                  │
    │                  │ │      │            │                  │
    └──────────────────┘ └──────┘            └──────────────────┘
    200px full             56px icon-only      0px + hamburger drawer
  responsive:
    desktop: "sidebar 200px full — icon + label, luôn visible"
    tablet: "sidebar 56px icon-only — icon + tooltip, luôn visible"
    mobile: "sidebar 0px hidden — hamburger [☰] top-right, drawer overlay 200px khi click"
    content_parity: "same 3 items (resources/theme/settings) on every breakpoint, only nav type changes"

# === Mode B — placement decision ===
placement:
  existing_wireframe: |
    ┌─────────────────────────────────────────┐
    │ Cell — Tùy chọn                         │  ← 16px
    │ [Tài nguyên][Giao diện][Cài đặt]        │  ← tablist ngang, no aria-controls
    ├─────────────────────────────────────────┤
    │ [error/success banner]                  │
    │ Từ điển                                 │
    │ [Dropzone]                              │
    │ [Card][Card]                            │
    │ Danh sách tần suất                      │
    │ [Dropzone]                              │
    │ [Card][Card]                            │
    └─────────────────────────────────────────┘
  new_function: { name: "redesign surface", frequency: occasional, destructive: false, spec: "restyle sang design-dark-github — dark canvas, terminal-green, glass cards, sidebar nav" }
  proposed_wireframe: |
    ┌──────────────────────────────────────────────────────────┐
    │  Cell — Tùy chọn                                        │  ← 40px
    ├────────────────┬─────────────────────────────────────────┤
    │  ▣ Tài nguyên  │  ┌──────────────────────────────────┐  │
    │  ▢ Giao diện   │  │  ╔══════════════════════════╗   │  │
    │  ▢ Cài đặt     │  │  ║ Từ điển                  ║   │  │
    │  ──────────    │  │  ║ [Dropzone]                ║   │  │
    │  (room sau)    │  │  ║ [Card][Card]              ║   │  │
    │                │  │  ╚══════════════════════════╝   │  │
    │                │  │  ╔══════════════════════════╗   │  │
    │                │  │  ║ Danh sách tần suất       ║   │  │
    │                │  │  ║ [Dropzone]                ║   │  │
    │                │  │  ║ [Card][Card]              ║   │  │
    │                │  │  ╚══════════════════════════╝   │  │
    │                │  └──────────────────────────────────┘  │
    └────────────────┴─────────────────────────────────────────┘
  decision: { group: "keep 3 sections (resources/theme/settings)", zone: "primary=resources, secondary=theme, tertiary=settings", order_position: "frequency — resources → theme → settings", destructive_handling: "delete icon per card + confirm modal, no change", why: "Jakob's Law — VS Code/GitHub Settings sidebar pattern; scope-first IA; room grow cho items sau" }
  side_effect_check: { re_grouping: false, hick_le7: true, miller_le7: true, whitespace_ok: true, one_primary: true }

# === GATE 2 — UI SURFACE (locked at contract approval) ===

# 8. task flows (max 3 steps each)
flows:
  - { task: "Import từ điển", steps: ["kéo thả file vào dropzone", "chờ progress bar xong"], count: 2, ok: true }
  - { task: "Xóa từ điển", steps: ["click ✕ trên card", "confirm trong modal"], count: 2, ok: true }
  - { task: "Chỉnh theme", steps: ["click tab Giao diện", "chọn mode card", "tùy chỉnh color + xem preview"], count: 3, ok: true }
  - { task: "Export theme", steps: ["click tab Giao diện", "click Export button"], count: 2, ok: true }

# 9. first-glance test (3s)
first_glance: { sees_in_3s: "title 'Cell — Tùy chọn' + sidebar 3 items + content Tài nguyên (dropzone + cards)", knows_what_to_do: "kéo thả file vào dropzone để import", needs_guide: false }

# 10. visual hierarchy
hierarchy: { pattern: F, eye_path: ["1st: title 'Cell — Tùy chọn'", "2nd: sidebar active item (terminal-green border)", "3rd: dropzone trong content card"], gestalt: "proximity — sidebar items gần nhau (16px gap), content card gần dropzone (24px); similarity — tất cả card cùng glass surface" }

# 11. state coverage (per component)
states:
  - { component: "SidebarItem", loading: "n/a", empty: "n/a", error: "n/a", hover: "bg rgba(255,255,255,0.06)", active: "left 2px --color-terminal-green + text --color-snow", focus: "2px ring --color-terminal-green 3:1", disabled: "n/a" }
  - { component: "Dropzone", loading: "n/a", empty: "composed — 'kéo thả file hoặc click'", error: "inline — red border + message", hover: "border --color-terminal-green + bg rgba(95,237,131,0.05)", active: "n/a", focus: "2px ring --color-terminal-green", disabled: "opacity 0.5 + cursor not-allowed (khi importing)" }
  - { component: "ResourceCard", loading: "skeleton — rgba(255,255,255,0.06) pulse", empty: "n/a", error: "n/a", hover: "bg rgba(255,255,255,0.1)", active: "n/a", focus: "2px ring --color-terminal-green", disabled: "n/a" }
  - { component: "ImportProgress", loading: "progress bar --color-terminal-green fill", empty: "n/a", error: "inline", hover: "n/a", active: "n/a", focus: "n/a", disabled: "n/a" }
  - { component: "DeleteConfirmModal", loading: "n/a", empty: "n/a", error: "n/a", hover: "button hover bg", active: "n/a", focus: "2px ring", disabled: "n/a" }
  - { component: "ErrorBanner", loading: "n/a", empty: "n/a", error: "inline — bg rgba(255,0,0,0.1) + --color-snow text", hover: "n/a", active: "n/a", focus: "n/a", disabled: "n/a" }
  - { component: "SuccessBanner", loading: "n/a", empty: "n/a", error: "n/a", hover: "n/a", active: "n/a", focus: "n/a", disabled: "n/a" }
  - { component: "ThemePanel", loading: "n/a", empty: "n/a", error: "inline", hover: "n/a", active: "n/a", focus: "2px ring", disabled: "n/a" }
  - { component: "SettingsPlaceholder", loading: "n/a", empty: "composed — 'Cài đặt — chuyển từ SettingsDialog sang đây (M11 ponytail)'", error: "n/a", hover: "n/a", active: "n/a", focus: "n/a", disabled: "n/a" }

# 12. anti-slop bans (from anti-slop-checklist.md)
anti_slop:
  bans: [em_dash, inter_font, ai_purple_gradient, three_equal_cards, fake_screenshot_div, scroll_cue, locale_strip, version_footer, eyebrow_overuse]
  hero_fit: { headline_max_lines: 2, subtext_max_words: 20 }   # settings không hero, nhưng title vẫn max 2 lines

# 13. accessibility
a11y:
  contrast: WCAG_AA   # 4.5:1 body (--color-snow on --color-deep-void), 3:1 large
  focus_ring: visible   # 2px --color-terminal-green, 3:1 against --color-deep-void
  keyboard: "tab order: sidebar item 1 → 2 → 3 → content; arrow keys move within sidebar; no traps"
  aria: { tablist: false, sidebar: { role: "navigation", aria_label: "Tùy chọn sections" }, sidebaritem: { role: "tab", aria_controls: "panel-<id>", aria_selected: "<bool>" }, tabpanel: { role: "tabpanel", id: "panel-<id>", aria_labelledby: "nav-<id>" } }
  skip_link: true; alt_text: true   # icon ✕ có aria-label "Xóa <name>"

# 14. mockup
mockup: { file: mockups/options.html, status: pending }

# 15. definition of done
dod:
  contract_compliance: [every function has a component, every token via CSS var, every state implemented, zero anti-slop violations, ARIA matches a11y]
  ux_acceptance: [first-glance passes, every flow <=3 steps, zero AI tells, a11y 0 violations, console 0 errors, mobile single-column no h-scroll]

# 16. acceptance tests (reviewer runs post-implement)
acceptance_tests:
  - { id: AT1a, name: "First-glance sees_in_3s", method: "MCP take_snapshot, assert title + sidebar + dropzone visible in first viewport", pass: "all 3 visible" }
  - { id: AT1b, name: "First-glance knows_what_to_do", method: "MCP evaluate_script, assert exactly 1 primary action (dropzone) visible", pass: "count=1" }
  - { id: AT2, name: "Flow step count", method: "MCP click + take_snapshot per step, count steps per task", pass: "all tasks <=3" }
  - { id: AT3, name: "Visual tell sweep", method: "grep code for em-dash/Inter/purple/hex + MCP evaluate_script for visual tells", pass: "zero" }
  - { id: AT4, name: "A11y runtime", method: "MCP lighthouse_audit + evaluate_script ARIA assert", pass: "0 violations + ARIA linkage ok" }
  - { id: AT5, name: "Console clean", method: "MCP list_console_messages, count errors", pass: "0 errors" }
  - { id: AT6, name: "Responsive collapse", method: "MCP emulate 375px + evaluate_script assert no h-scroll + targets >=44px + single-column", pass: "all pass" }
  - { id: AT7, name: "Contract compliance", method: "grep code for hex/Inter/linear + evaluate_script assert placement matches", pass: "100% match" }

# audit (redesign only) — 8 axes
audit:
  typography: ["title 16px → 40px (design system heading)", "font Inter → Mona Sans (design system)", "letter-spacing -0.02em at 40px"]
  color: ["fallback hex → design system tokens (--color-deep-void, --color-terminal-green, --color-slate-edge)", "light theme → dark theme (design-dark-github)"]
  layout: ["tablist ngang → sidebar dọc (room grow)", "100vh → 100dvh", "section gap 16px → 64px (design system)"]
  interactivity: ["tab aria-controls missing → add", "tabpanel aria-labelledby missing → add", "hover state cho sidebar item + dropzone + card"]
  content: ["empty state text-only → composed (dropzone hint)", "loading 'Đang tải...' → skeleton"]
  component: ["card border-only → glass surface rgba(255,255,255,0.06)", "dropzone restyle terminal-green hover", "delete icon → IconButton atom (shared/ui)"]
  iconography: ["sidebar icon ▣/▢ → SVG inline (design system style)", "delete ✕ → SVG trash/x icon"]
  code_quality: ["fallback hex trong CSS → var(--token) only", "TabButton inline → SidebarItem component tách", "SettingsPlaceholder inline → SettingsPanel component"]

# layout audit (Gate 1 checklist result)
layout_audit:
  status: APPROVED
  sections:
    input_fetch: "Mode B — audit OptionsApp.tsx + ResourcesPanel.tsx + CSS; read AGENTS.md + ADR-022/023 + design-dark-github.md"
    ia: "scope-first sidebar, 3 items, room grow"
    grouping: "by user mental model — data/visual/system, no dump group"
    cognitive_load: "Hick 3 items, Miller 3 chunks, one primary per zone"
    order: "frequency first — resources → theme → settings"
    hierarchy: "F-pattern, title → sidebar active → dropzone"
    minimalism: "glass card subtle, no decorative border, 64px section gap"
    convention: "VS Code/GitHub Settings sidebar pattern (Jakob's Law)"
    bans: "no em-dash, no Inter, no AI-purple, no 3 equal cards, no fake screenshot"
    wireframe: "3 breakpoint (desktop full / tablet icon-only / mobile drawer) — approved"
    responsive: "content parity, nav type transforms, touch targets >=44px"

# addendum (reviewer fails appended during implement loop)
addendum: {}
```
