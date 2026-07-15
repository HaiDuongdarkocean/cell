# UI-UX-Contract — Popup Dictionary

> Single source of truth. Implementer does NOT change placement/vibe/IA without returning to Gate 1.
> UX (structure, sections 5-7) locked at Gate 1 (Variant A approved 2026-07-13).
> UI (surface, sections 8-14) locked at Gate 2.
> Spec: `docs/specs/spec-popup-dictionary.md`. Intent: `docs/intent/intent-popup-dictionary.md`.

```yaml
# 1. meta
screen: popup-dictionary; route: content-script overlay (floating, Shadow DOM); workflow: new; mode: A; created_at: 2026-07-13

# 2. intent
page_kind: tool
audience: language learner via video immersion, Chromium desktop/tablet/mobile, RAM 4GB, EN+ZH focus
primary_job: "Tra từ/cụm tại con trỏ trong subtitle overlay, xem definition + nguyên liệu, Quick Add hoặc Send to Creator"
vibe_read: "Reading this as: tool for language learner, dense-info language, leaning minimalist-ui (content-first, compact icon-toolbar, no chrome waste)."
# redesign_mode omitted (new screen)

# 3. dials (1-10)
variance: 4   # symmetric floating panel, anchored near cursor, no asymmetric hero
motion: 3     # static content, only panel toggle + state transitions, no cinematic
density: 7    # packed info (definitions + panel + toolbar in 560px), but readable via tokens

# 4. design system reference (DO NOT re-define tokens)
design_system:
  tokens: "src/shared/lib/themeTokens.ts (STATIC_TOKENS + buildColorTokens), docs/design-system/design-dark-github.* + design-light-youtube.*"
  components: "src/shared/ui/* (Button, IconButton, Dialog, BottomSheet, Tabs, Tooltip, Checkbox, Select, SearchableSelect, Alert, Badge, Skeleton, Spinner, EmptyState)"
  guidelines: "docs/design-system/design-system.md, AGENTS.md (ponytail, no third-party names, px tokens in content-script)"
  patterns: "docs/mockups/anki-card-mockup.html (card creator restyle reference), docs/specs/design/dictionary-popup-prototype-handoff.md (prototype spec reference)"
  aesthetic: minimalist-ui   # content-first, compact, no gradient/glassmorphism/neon
  deviations: []   # full compliance, no new tokens

# 4b. Component mapping to design-system.md (AI MUST use this)
# Every UI piece below maps to a component in docs/design-system/design-system-showcase/design-system.md.
# Do NOT invent class names or tokens; query the YAML/Markdown for the mapped component.
component_map:
  - { contract_section: "Header target + reading",     ds_component_id: "input",        ds_section: "## 3. Input / Textarea / Search", css_class: "popup__word / popup__reading", notes: "Text blocks styled with design tokens, not interactive input" }
  - { contract_section: "Header badges",               ds_component_id: "badge",        ds_section: "## 9. Badge / Chip / Tag",        css_class: "badge badge--primary", notes: "Frequency badge" }
  - { contract_section: "Header status dropdown",      ds_component_id: "dropdown",     ds_section: "## 4. Dropdown / Select",         css_class: "dropdown", notes: "5 status values" }
  - { contract_section: "Header icon buttons",         ds_component_id: "icon-button",  ds_section: "## 2. Icon Button",             css_class: "icon-btn", notes: "settings, send-to-creator, quick-add" }
  - { contract_section: "Quick Add button",            ds_component_id: "button",       ds_section: "## 1. Button",                    css_class: "btn btn--primary popup__quick-add", notes: "Primary CTA, stands out" }
  - { contract_section: "Toolbar icon toggles",        ds_component_id: "icon-button",  ds_section: "## 2. Icon Button",             css_class: "icon-btn", notes: "Audio/Image/Translate/Links single-select" }
  - { contract_section: "Panel container",             ds_component_id: "card",         ds_section: "## 8. Card",                      css_class: "panel", notes: "Card 10px radius, surface bg" }
  - { contract_section: "Panel config footer",         ds_component_id: "card",         ds_section: "## 8. Card",                      css_class: "config-footer", notes: "Injected below panel content" }
  - { contract_section: "General config",              ds_component_id: "card",         ds_section: "## 8. Card",                      css_class: "general-config", notes: "Always visible in edit mode" }
  - { contract_section: "Definitions list",           ds_component_id: "list-item",    ds_section: "## 16. List Item",                css_class: "def-item", notes: "40px min-height, hover fill, checkbox leading" }
  - { contract_section: "Definition checkbox",         ds_component_id: "checkbox",     ds_section: "## 5–6. Checkbox / Radio",        css_class: "checkbox", notes: "Per-definition selection" }
  - { contract_section: "Empty states",                ds_component_id: "empty-state",  ds_section: "## 20. Empty State",               css_class: "empty-state", notes: "icon + title + desc + action" }
  - { contract_section: "Footer status dropdown",      ds_component_id: "dropdown",     ds_section: "## 4. Dropdown / Select",         css_class: "dropdown", notes: "Same 5 status, right-aligned footer" }
  - { contract_section: "Footer resize handle",        ds_component_id: "icon-button",  ds_section: "## 2. Icon Button",             css_class: "icon-btn popup__resize", notes: "nwse-resize cursor" }
  - { contract_section: "Card Creator workspace",      ds_component_id: "dialog",       ds_section: "## 10. Dialog / Modal",           css_class: "workspace", notes: "12px radius, 2 panes" }
  - { contract_section: "Card Creator header",         ds_component_id: "icon-button",  ds_section: "## 2. Icon Button",             css_class: "icon-btn", notes: "Title 'Card Creator' + settings + close actions" }
  - { contract_section: "Card Creator preview card",   ds_component_id: "card",         ds_section: "## 8. Card",                      css_class: "creator-preview", notes: "Large centered target word + sentence quote" }
  - { contract_section: "Card Creator field card",     ds_component_id: "card",         ds_section: "## 8. Card",                      css_class: "creator-field-card", notes: "Header: label + action + X; Body: textarea/content" }
  - { contract_section: "Card Creator media card",     ds_component_id: "card",         ds_section: "## 8. Card",                      css_class: "creator-media-card", notes: "Audio item rows or image grid + ADD/SEARCH" }
  - { contract_section: "Card Creator footer",         ds_component_id: "button",       ds_section: "## 1. Button",                    css_class: "btn / btn--primary", notes: "CLEAR FIELDS (secondary) + CREATE CARD (primary)" }

# === GATE 1 — UX STRUCTURE (locked, Variant A approved) ===

# 5. function inventory (Mode A)
functions:
  - { id: F1,  name: "Lookup trigger (click/hover/modifier)", element: entry-point, frequency: frequent, tab: n/a, zone: primary,   priority: above-fold, affordance: "click/hover token trong subtitle overlay mở popup", steps_to_complete: 1, flow_ok: true }
  - { id: F2,  name: "Popup container (Shadow DOM, auto-position, resize, sticky size)", element: panel, frequency: frequent, tab: n/a, zone: primary, priority: above-fold, affordance: "floating panel anchored near cursor, resize handle góc phải", steps_to_complete: 1, flow_ok: true }
  - { id: F3,  name: "Target word/phrase", element: text, frequency: frequent, tab: n/a, zone: primary, priority: above-fold, affordance: "largest text, bold, header", steps_to_complete: 1, flow_ok: true }
  - { id: F4,  name: "Reading (IPA/pinyin)", element: text, frequency: frequent, tab: n/a, zone: primary, priority: above-fold, affordance: "IPA/pinyin dòng riêng dưới target, không có play icon (play word ở Audio panel)", steps_to_complete: 1, flow_ok: true }
  - { id: F5,  name: "Status + frequency badges", element: badge, frequency: frequent, tab: n/a, zone: primary, priority: above-fold, affordance: "dòng riêng dưới reading: status dropdown + frequency badge (không hiển thị dict count)", steps_to_complete: 1, flow_ok: true }
  - { id: F6,  name: "Status cycle (5 status)", element: select, frequency: frequent, tab: n/a, zone: primary, priority: above-fold, affordance: "dropdown 5 status (unknown/known/tracking/learning/ignore), có ở header dòng badges VÀ footer", steps_to_complete: 1, flow_ok: true }
  - { id: F7,  name: "Settings (⚙) — edit mode toggle toàn popup", element: icon-button, frequency: occasional, tab: n/a, zone: primary, priority: above-fold, affordance: "icon ⚙ góc phải header, toggle ON/OFF edit mode. ON: General config luôn hiện + mỗi panel mở có config footer inject. OFF: ẩn hết config. Chỉ nhấn [⚙] lại mới tắt (không phải Esc, không phải toolbar)", steps_to_complete: 1, flow_ok: true }
  - { id: F8,  name: "Send to Creator (card icon)", element: icon-button, frequency: occasional, tab: n/a, zone: primary, priority: above-fold, affordance: "icon card góc phải header, mở Card Creator workspace", steps_to_complete: 2, flow_ok: true }
  - { id: F9,  name: "Quick Add (+ icon)", element: icon-button, frequency: frequent, tab: n/a, zone: primary, priority: above-fold, affordance: "icon + góc phải header, Quick Add 3 mode (manual/quick/hybrid)", steps_to_complete: 1, flow_ok: true }
  - { id: F10, name: "Toolbar: Audio toggle (single-select)", element: icon-button, frequency: frequent, tab: n/a, zone: secondary, priority: above-fold, affordance: "icon 🔊 mở Audio panel (đóng panel khác đang mở — single-select, chỉ 1 panel lúc)", steps_to_complete: 1, flow_ok: true }
  - { id: F11, name: "Toolbar: Image toggle (single-select)", element: icon-button, frequency: occasional, tab: n/a, zone: secondary, priority: above-fold, affordance: "icon 🖼 mở Image panel (đóng panel khác đang mở)", steps_to_complete: 1, flow_ok: true }
  - { id: F12, name: "Toolbar: Translate toggle (single-select)", element: icon-button, frequency: occasional, tab: n/a, zone: secondary, priority: above-fold, affordance: "icon 译 mở Translate panel (đóng panel khác đang mở)", steps_to_complete: 1, flow_ok: true }
  - { id: F13, name: "Toolbar: Links toggle (single-select)", element: icon-button, frequency: rare, tab: n/a, zone: tertiary, priority: on-demand, affordance: "icon 🔗 mở Links panel (đóng panel khác đang mở)", steps_to_complete: 1, flow_ok: true }
  - { id: F14, name: "Close (click outside / Esc)", element: implicit, frequency: frequent, tab: n/a, zone: n/a, priority: on-demand, affordance: "click ngoài popup hoặc Esc đóng popup (Esc KHÔNG tắt edit mode, chỉ nhấn [⚙] mới tắt)", steps_to_complete: 1, flow_ok: true }
  - { id: F15, name: "Definitions panel (always visible, checkbox per-definition)", element: list, frequency: frequent, tab: n/a, zone: primary, priority: above-fold, affordance: "luôn hiện dưới toolbar, checkbox per-definition, default all selected", steps_to_complete: 1, flow_ok: true }
  - { id: F16, name: "Audio panel (PLAY WORD/SENTENCE, Forvo + TTS)", element: panel, frequency: frequent, tab: n/a, zone: secondary, priority: on-demand, affordance: "toggle on/off, lazy load Forvo, 2 groups word/sentence", steps_to_complete: 2, flow_ok: true }
  - { id: F17, name: "Image panel (horizontal scroll strip, checkmark)", element: panel, frequency: occasional, tab: n/a, zone: secondary, priority: on-demand, affordance: "toggle on/off, lazy load Google Images, scroll strip + checkmark", steps_to_complete: 2, flow_ok: true }
  - { id: F18, name: "Translate panel (target + source card, copy)", element: panel, frequency: occasional, tab: n/a, zone: secondary, priority: on-demand, affordance: "toggle on/off, lazy load Google Translate, target trên source dưới", steps_to_complete: 2, flow_ok: true }
  - { id: F19, name: "Links panel (external dict list, mở tab mới)", element: panel, frequency: rare, tab: n/a, zone: tertiary, priority: on-demand, affordance: "toggle on/off, list link + external icon, click mở tab mới", steps_to_complete: 2, flow_ok: true }
  - { id: F20, name: "Footer: status cycle dropdown (5 status)", element: select, frequency: frequent, tab: n/a, zone: primary, priority: below-fold, affordance: "dropdown 5 status bên phải footer (đồng bộ với header status)", steps_to_complete: 1, flow_ok: true }
  - { id: F21, name: "Resize handle (kéo góc)", element: handle, frequency: occasional, tab: n/a, zone: primary, priority: below-fold, affordance: "handle góc phải footer, kéo resize, sticky size persist", steps_to_complete: 1, flow_ok: true }
  - { id: F22, name: "General config (inject khi [⚙] ON)", element: panel, frequency: occasional, tab: n/a, zone: tertiary, priority: on-demand, affordance: "luôn hiện khi edit mode ON, dưới toolbar trên definitions: default panel + trigger mode + hover delay + SRS destination", steps_to_complete: 1, flow_ok: true }
  - { id: F23, name: "Audio config footer (inject dưới Audio panel khi [⚙] ON)", element: panel, frequency: occasional, tab: n/a, zone: tertiary, priority: on-demand, affordance: "inject ngay dưới Audio content khi [⚙] ON + Audio panel đang mở: accent per-lang + auto-play toggle", steps_to_complete: 1, flow_ok: true }
  - { id: F24, name: "Image config footer (inject dưới Image panel khi [⚙] ON)", element: panel, frequency: occasional, tab: n/a, zone: tertiary, priority: on-demand, affordance: "inject ngay dưới Image content khi [⚙] ON + Image panel đang mở: max images + source", steps_to_complete: 1, flow_ok: true }
  - { id: F25, name: "Translate config footer (inject dưới Translate panel khi [⚙] ON)", element: panel, frequency: occasional, tab: n/a, zone: tertiary, priority: on-demand, affordance: "inject ngay dưới Translate content khi [⚙] ON + Translate panel đang mở: target lang + source lang", steps_to_complete: 1, flow_ok: true }
  - { id: F26, name: "Links config footer (inject dưới Links panel khi [⚙] ON)", element: panel, frequency: occasional, tab: n/a, zone: tertiary, priority: on-demand, affordance: "inject ngay dưới Links content khi [⚙] ON + Links panel đang mở: per-lang checkbox + add custom link", steps_to_complete: 1, flow_ok: true }
  - { id: F27, name: "Close (click outside / Esc)", element: implicit, frequency: frequent, tab: n/a, zone: n/a, priority: on-demand, affordance: "click ngoài popup hoặc Esc đóng popup (Esc KHÔNG tắt edit mode, chỉ nhấn [⚙] mới tắt)", steps_to_complete: 1, flow_ok: true }

# 6. information architecture (grouping + zones + order)
ia:
  model: task-flow   # tool: trigger → lookup → review → add
  nav_type: floating   # popup floating, toolbar = icon toggle row (không tabs)
  nav_items: [Audio, Image, Translate, Links]
  grouping: "by user task-flow: identity (header) → materials toggle (toolbar, single-select) → core content (definitions) → supplementary (active panel, 0 hoặc 1) → status (footer)"
  grouping_reason: { header: "target identity + exit actions — user cần biết đang tra gì + cách add", toolbar: "panel toggles — chọn nguyên liệu muốn xem", definitions: "core content luôn visible — principle #1", active_panel: "supplementary materials lazy load — không che definitions", footer: "status + resize — housekeeping" }
  notes: "Không hiển thị dict count ở header (chỉ status + frequency)"
  order: "frequency first (target, definitions, Quick Add), task-flow second (toolbar Audio→Image→Translate→Links), destructive/housekeeping last (status, resize, settings)"
  default_tab: "dictionary (definitions always visible, không panel toggle active mặc định — trừ default panel setting global sticky)"; back_nav: false; search: false
  zones: { primary: "header (target identity + Quick Add/Send/Settings) + definitions (always visible) — above-fold core", secondary: "toolbar + active panel (lazy load) — toggle on demand", tertiary: "Links panel, More overflow, Config overlay — rare/collapsed" }
  whitespace_map: "large gap (var(--space-4)) giữa header|toolbar|content|footer (separates groups); small gap (var(--space-2)) within header (target→reading→badges→actions), within toolbar (icon buttons), within definitions (cards); border (var(--color-border)) header bottom + footer top (proximity ambiguous giữa groups)"

# 7. layout (structure)
layout:
  container: { max_width: "min(560px, calc(100vw - 32px)) desktop, calc(100vw - 24px) mobile", margin: "auto-position near cursor", padding_block: "var(--space-3)", min_height: "auto (fit content, max 70vh body scroll)" }
  header: { title: "target word/phrase (no em-dash)", title_size: "var(--font-size-2xl)", title_weight: "var(--font-weight-bold)", title_tracking: "var(--tracking-tight)", title_wrap: balance }
  nav: { type: icon-row, gap: "var(--space-1)", border: "bottom var(--color-border)", button_padding: "8px (36x36px icon button)", active_indicator: "var(--color-primary) border-bottom 2px + subtle bg" }
  panel: { padding_block: "var(--space-3)" }
  ascii_wireframe: |
    DEPRECATED — see `state_matrix` and `html_skeleton` below (machine-parseable, no ASCII).
  state_matrix:
    view_mode: { edit_mode: OFF, general_config: hidden, panel: "0 or 1 open", panel_config_footer: hidden, definitions: visible }
    edit_mode_idle: { edit_mode: ON, general_config: visible, panel: "0 open", panel_config_footer: hidden, definitions: visible }
    edit_mode_audio: { edit_mode: ON, general_config: visible, panel: "Audio open", panel_config_footer: "Audio config visible", definitions: visible }
    edit_mode_image: { edit_mode: ON, general_config: visible, panel: "Image open", panel_config_footer: "Image config visible", definitions: visible }
    edit_mode_translate: { edit_mode: ON, general_config: visible, panel: "Translate open", panel_config_footer: "Translate config visible", definitions: visible }
    edit_mode_links: { edit_mode: ON, general_config: visible, panel: "Links open", panel_config_footer: "Links config visible", definitions: visible }
    edit_mode_panel_closed: { edit_mode: ON, general_config: visible, panel: "0 open", panel_config_footer: hidden, definitions: visible }
    edit_mode_off: { edit_mode: OFF, general_config: hidden, panel: "preserved", panel_config_footer: hidden, definitions: visible }
    not_found: { target: "xyzabc", reading: empty, frequency: null, definitions: "empty-state with 'Try external dictionaries →' action" }
    chinese_lookup: { target: "喜欢", reading: "xǐ huān (pinyin)", definitions: "CC-CEDICT entries with examples" }
  html_skeleton: |
    <div class="popup">
      <!-- HEADER -->
      <div class="popup__header">
        <div class="popup__header-meta">
          <p class="popup__target">{TARGET_WORD}</p>
          <p class="popup__reading">{READING_IPA_OR_PINYIN}</p>
          <div class="popup__badges">
            <div class="dropdown popup__status">{STATUS_DROPDOWN}</div>
            {FREQUENCY_BADGE_IF_ANY}
          </div>
        </div>
        <div class="popup__actions">
          <button class="icon-btn" aria-label="Settings">{SETTINGS_SVG}</button>
          <button class="icon-btn" aria-label="Send to Card Creator">{CARD_SVG}</button>
          <button class="icon-btn" aria-label="Quick Add">{PLUS_SVG}</button>
        </div>
      </div>

      <!-- TOOLBAR (4 icons, single-select) -->
      <div class="popup__toolbar">
        <button class="icon-btn" aria-label="Audio panel">{AUDIO_SVG}</button>
        <button class="icon-btn" aria-label="Image panel">{IMAGE_SVG}</button>
        <button class="icon-btn" aria-label="Translate panel">{TRANSLATE_SVG}</button>
        <button class="icon-btn" aria-label="Links panel">{LINKS_SVG}</button>
      </div>

      <!-- BODY (order depends on edit_mode) -->
      <div class="popup__body">
        <!-- view_mode (⚙ OFF): Panel (if any) → Definitions → Footer -->
        <!-- edit_mode (⚙ ON): Panel (if any) → Panel config footer (if any) → General config → Definitions → Footer -->

        {ACTIVE_PANEL_IF_ANY}
        {PANEL_CONFIG_FOOTER_IF_EDIT_AND_PANEL_OPEN}
        {GENERAL_CONFIG_IF_EDIT_MODE}
        {DEFINITIONS_OR_EMPTY_STATE}
      </div>

      <!-- FOOTER (mandatory) -->
      <div class="popup__footer">
        <div class="dropdown popup__status">{STATUS_DROPDOWN_SYNC}</div>
        <button class="icon-btn popup__resize" aria-label="Resize">{RESIZE_SVG}</button>
      </div>
    </div>

=== EDIT MODE BEHAVIOR MATRIX ===
| Element                      | [⚙] OFF (view)         | [⚙] ON (edit)                              |
|------------------------------|-------------------------|---------------------------------------------|
| General config               | ẩn                     | LUÔN hiện (dưới toolbar, trên definitions)  |
| Toolbar icon                 | single-select panel    | single-select panel + config footer         |
| Panel content                | 0 hoặc 1 panel mở      | 0 hoặc 1 panel mở (như view mode)          |
| Panel config footer          | ẩn                     | hiện khi panel đó đang mở (inject dưới)     |
| Definitions                  | visible, tick được     | visible, tick được (test chọn từ khác)      |
| Tắt edit mode                | n/a                    | CHỈ nhấn [⚙] lần nữa (không Esc, không toolbar) |
| Auto-save                    | n/a                    | mỗi thay đổi config → save chrome.storage.local debounced 500ms |
| Test chọn từ khác            | n/a                    | nhấn token khác trong subtitle → popup load result mới, edit mode vẫn ON |

=== MOCKUP IMPLEMENTATION NOTES ===
- Toolbar has exactly 4 icons: Audio, Image, Translate, Links. NO "none"/"close" icon — single-select behavior handles "no panel" by clicking active icon again.
- Header layout order: target word (largest) → reading → badges (status + frequency) → actions (settings, send-to-creator, quick-add).
- Body layout order when [⚙] ON: Panel (if any) → Panel config footer (if any) → General config → Definitions → Footer.
- Body layout order when [⚙] OFF: Panel (if any) → Definitions → Footer.
- Footer is mandatory: status dropdown right + resize handle right.
- Card Creator header is a simple title bar "Card Creator" + settings + close actions (NOT a mirror of Popup header).
- Card Creator body order: Card type/deck subheader → Preview card (target word + sentence) → Field cards (target, sentence, translation, definition, sentence audio, word audio, images, example sentences, notes) → Footer (CLEAR FIELDS + CREATE CARD).
- Each field card has a header: label on the left, action button (CREATE/SEARCH/MODIFY/ADD) + X clear button on the right.
- Media cards (audio/image) display selected items inside the card body and expose ADD/SEARCH actions in the header.
- Footer has exactly two buttons: CLEAR FIELDS (secondary) and CREATE CARD (primary).

=== TOOLBAR SINGLE-SELECT RULE ===
- Toolbar icon = radio behavior (không phải multi-toggle checkbox).
- Nhấn icon active lần nữa → đóng panel đó (0 panel mở).
- Nhấn icon khác → đóng panel cũ, mở panel mới (chỉ 1 panel lúc).
- Không bao giờ 2 panel cùng mở.

=== LAYOUT ORDER KHI [⚙] ON ===
1. Header (target + reading + badges + 3 actions)
2. Toolbar (icon single-select panel + config footer)
3. Panel đang mở (0 hoặc 1): content → config footer (inject ngay dưới)
4. General config (luôn hiện, sau panel)
5. Definitions (visible, tick được)
6. Footer (status + resize)
  responsive:
    desktop: "popup min(560px, 100vw-32px), toolbar 1 row, definitions 1 column, panel above definitions, resize handle visible"
    tablet: "popup 100vw-24px, toolbar horizontal-scroll nếu thiếu, definitions 1 column, resize handle visible"
    mobile: "popup 100vw-24px full-width, header actions icon-only (no label), toolbar horizontal-scroll, definitions 1 column, resize handle ẩn (auto full-width), footer status pill right, no h-scroll"
    content_parity: "same groups mọi breakpoint (header/toolbar/panel/definitions/footer), chỉ toolbar nav type đổi scroll + resize handle ẩn mobile"
    responsive_ascii: |
    responsive_yaml: |
      tablet_le_1024px: { popup_width: "100vw-24px", toolbar: "1 row (or horizontal-scroll at 320px)", resize_handle: visible, header_actions: "icon-only", badges: "status + frequency" }
      mobile_375px: { popup_width: "100vw-24px full-width", header_actions: "44x44px touch", toolbar: "horizontal-scroll", badges: "compact status + frequency", resize_handle: hidden, body: "no h-scroll, independent scroll" }
# === GATE 2 — UI SURFACE ===

# 8. task flows (max 3 steps each)
flows:
  - { task: "Tra từ nhanh + xem definition", steps: ["hover/click token trong subtitle", "popup hiện definition + IPA + frequency", "đóng (click ngoài/Esc)"], count: 3, ok: true }
  - { task: "Quick Add (không tick)", steps: ["hover/click token", "nhấn [+] Quick Add", "toast success/fail"], count: 3, ok: true }
  - { task: "Quick Add (manual tick)", steps: ["hover/click token", "tick definitions/audio/image muốn", "nhấn [+] Quick Add"], count: 3, ok: true }
  - { task: "Send to Creator", steps: ["hover/click token", "nhấn [card] Send to Creator", "Card Creator workspace mở"], count: 3, ok: true }
  - { task: "Nghe audio word", steps: ["hover/click token", "nhấn [🔊] toggle Audio panel", "nhấn play item Forvo/TTS"], count: 3, ok: true }
  - { task: "Đổi status từ", steps: ["hover/click token", "nhấn [unknown ▼] ở header HOẶC footer", "chọn status (known/tracking/learning/ignore)"], count: 3, ok: true }
  - { task: "Chỉnh config popup (edit mode)", steps: ["nhấn [⚙] ON → General config hiện", "nhấn toolbar icon (🔊/🖼/译/🔗) để mở panel + config footer tương ứng", "nhấn [⚙] lại OFF → tắt edit mode"], count: 3, ok: true }
  - { task: "Test config mới với từ khác", steps: ["[⚙] ON + edit config", "nhấn token khác trong subtitle", "popup load result mới, edit mode vẫn ON, xem config apply"], count: 3, ok: true }
  - { task: "Resize popup", steps: ["kéo handle góc phải footer", "thả — sticky size persist", ""], count: 2, ok: true }

# 9. first-glance test (3s)
first_glance: { sees_in_3s: "target word lớn + IPA + definitions list có checkbox + 3 icon góc phải (settings/card/quick-add) + toolbar icon row", knows_what_to_do: "đọc definition, tick muốn add, nhấn [+] Quick Add", needs_guide: false }

# 10. visual hierarchy
hierarchy: { pattern: F, eye_path: ["1st: target word (largest, bold, top-left)", "2nd: definitions list (checkbox + text, center mass)", "3rd: Quick Add [+] (primary accent, top-right)"], gestalt: "proximity: header group (target+reading+badges+actions) tight, definitions cards tight within, large gap separates header/toolbar/definitions/footer; similarity: all icon buttons same size/style, all definition cards same structure" }

# 11. state coverage (per component)
states:
  - { component: "Popup container", loading: "skeleton header (target+reading shimmer) nếu lookup delayed", empty: "n/a (popup chỉ mở khi có trigger)", error: "inline 'Lookup failed' + retry trong body", hover: "n/a (floating)", active: "n/a", focus: "2px ring var(--color-primary) khi focus vào popup", disabled: "n/a" }
  - { component: "Header target", loading: "skeleton text block", empty: "n/a", error: "inline 'Not found' + fallback 'Try selection'", hover: "n/a", active: "n/a", focus: "n/a", disabled: "n/a" }
  - { component: "Settings [⚙] toggle", loading: "n/a", empty: "n/a", error: "n/a", hover: "var(--color-surface-hover) bg", active: "var(--color-primary) bg + ring khi ON (edit mode)", focus: "2px ring", disabled: "n/a" }
  - { component: "Quick Add [+] button", loading: "spinner trong icon", empty: "n/a", error: "toast 'Could not add card' + Retry", hover: "var(--color-primary-hover) bg", active: "pressed scale 0.95", focus: "2px ring", disabled: "true khi no definition selected" }
  - { component: "Toolbar icon toggle", loading: "n/a", empty: "n/a", error: "n/a", hover: "var(--color-surface-hover) bg", active: "var(--color-primary) border-bottom 2px + var(--color-primary-subtle) bg", focus: "2px ring", disabled: "n/a" }
  - { component: "Definitions list", loading: "skeleton 3 cards", empty: "composed 'No definitions found for {term}' + 'Try external dictionaries →' (mở Links panel)", error: "inline 'Dictionary error' + retry", hover: "card bg var(--color-surface-hover)", active: "n/a", focus: "2px ring trên checkbox", disabled: "n/a" }
  - { component: "Audio panel item", loading: "spinner + 'Loading audio...'", empty: "composed 'No audio available' + 'Use TTS' button", error: "inline 'Audio error' + Retry + 'Use TTS' fallback", hover: "row bg subtle", active: "play icon → pause icon khi playing", focus: "2px ring", disabled: "n/a" }
  - { component: "Image strip", loading: "skeleton strip (5 placeholder cards)", empty: "composed 'No images' + 'Open search' button", error: "inline retry trên card lỗi", hover: "card overlay subtle", active: "checkmark toggle", focus: "2px ring", disabled: "n/a" }
  - { component: "Translate card", loading: "skeleton 2 lines (target+source)", empty: "composed 'Translation unavailable' + retry", error: "inline 'Translate error' + Retry", hover: "n/a", active: "n/a", focus: "2px ring copy button", disabled: "n/a" }
  - { component: "Links panel", loading: "n/a (instant, local config)", empty: "composed 'No external dictionaries' + 'Configure' button", error: "n/a", hover: "row bg subtle", active: "n/a", focus: "2px ring", disabled: "n/a" }
  - { component: "Status dropdown (header + footer)", loading: "n/a", empty: "n/a", error: "n/a", hover: "var(--color-surface-hover)", active: "open menu", focus: "2px ring", disabled: "n/a" }
  - { component: "General config (edit mode)", loading: "n/a", empty: "n/a", error: "n/a", hover: "n/a", active: "visible khi [⚙] ON, fields editable", focus: "2px ring first control", disabled: "n/a" }
  - { component: "Panel config footer (edit mode)", loading: "n/a", empty: "n/a", error: "n/a", hover: "n/a", active: "visible khi [⚙] ON + panel đó mở, fields editable", focus: "2px ring", disabled: "n/a" }
  - { component: "Resize handle", loading: "n/a", empty: "n/a", error: "n/a", hover: "var(--color-primary) bg", active: "cursor resize, drag", focus: "n/a", disabled: "n/a" }

# 12. anti-slop bans
anti_slop:
  bans: [em_dash, inter_font, ai_purple_gradient, three_equal_cards, fake_screenshot_div, scroll_cue, locale_strip, version_footer, eyebrow_overuse]
  notes: "Inter OK vì Cell đã dùng (themeTokens default) — ban 'inter_font' ở đây nghĩa là không default sang Inter nếu Cell đã có font stack khác; Cell dùng Inter → giữ. No em-dash trong copy. No purple gradient. No 3 equal-weight cards (definitions list là list không phải card grid)."

# 13. accessibility
a11y:
  contrast: WCAG_AA   # 4.5:1 body, 3:1 large (theme tokens đã validate)
  focus_ring: visible   # 2px var(--color-primary), 3:1
  keyboard: "Tab order: header actions (settings → card → quick-add) → toolbar icons → active panel controls → config footers (nếu edit mode) → general config (nếu edit mode) → definitions checkboxes → footer status. Esc đóng popup (KHÔNG tắt edit mode). Chỉ nhấn [⚙] mới tắt edit mode. No focus trap (floating panel, không modal)."
  aria: { tablist: false, toolbar: { role: toolbar, aria_label: "Popup panels" }, button: { role: button, aria_label per icon }, checkbox: { role: checkbox, aria_checked }, status_dropdown: { role: combobox, aria_expanded }, panel: { role: region, aria_label } }
  skip_link: false   # floating popup, không page navigation
  alt_text: true   # image strip alt "Image result for {term}"
  reduced_motion: "respect prefers-reduced-motion — tắt panel toggle animation, chỉ opacity"

# 14. mockup
mockup: { file: mockups/popup-dictionary/index.html, status: built }

# 15. definition of done
dod:
  contract_compliance: [every function has a component, every token via CSS var (themeTokens), every state implemented, zero anti-slop violations, ARIA matches a11y section, no third-party names in code/comment]
  ux_acceptance: [first-glance passes, every flow <=3 steps, zero AI tells, a11y 0 violations, console 0 errors, mobile single-column no h-scroll, popup auto-position avoid overflow, resize sticky persist]

# 16. acceptance tests (reviewer runs post-implement via ui-checker)
acceptance_tests:
  - { id: AT1, name: "First-glance", method: "desktop screenshot, 3 questions in 3s: (a) what word? (b) what does it mean? (c) how to add card?", pass: "3/3 match — target visible, definitions visible, Quick Add [+] visible" }
  - { id: AT2, name: "Flow step count", method: "read flow sim cho 8 flows trong section 8", pass: "all tasks <=3 steps" }
  - { id: AT3, name: "Visual tell sweep", method: "scan mockup + impl screenshots for AI tells (em-dash, purple gradient, 3 equal cards, fake screenshot)", pass: "zero" }
  - { id: AT4, name: "A11y runtime", method: "read a11y report (axe-core qua MCP edge-devtools)", pass: "0 violations" }
  - { id: AT5, name: "Console clean", method: "read console log khi mở popup + toggle panel + Quick Add", pass: "0 errors" }
  - { id: AT6, name: "Responsive collapse", method: "desktop 1280px vs mobile 375px", pass: "single-column, no h-scroll, icon targets >=36px (mobile 44px touch), toolbar horizontal-scroll, resize handle ẩn mobile" }
  - { id: AT7, name: "Contract compliance", method: "code diff vs contract (placement, tokens, states, ARIA)", pass: "100% match" }

# audit (new screen — audit prototype handoff reference)
audit:
  typography: ["prototype handoff dùng Inter — Cell đã dùng Inter, giữ", "target size 2xl, definitions base, section labels uppercase small chỉ cho grouping (PLAY WORD, DEFINITIONS)"]
  color: ["map prototype purple reference → Cell theme tokens (var(--color-primary) blue default), không hardcode purple", "dark default + light toggle"]
  layout: ["popup floating không modal overlay toàn màn hình", "definitions always visible (principle #1)", "toolbar toggle không tab"]
  interactivity: ["lazy load panel ngoài (audio/image/translate/links) — chỉ fetch khi toggle on", "Quick Add 3 mode (manual/quick/hybrid)", "status cycle 5 giá trị", "resize sticky persist"]
  content: ["mock data EN (hello) + ZH (喜欢) + not-found (xyzabc) + external error", "definitions từ Cambridge + Eng-Vi gộp list", "audio Forvo US/UK + TTS fallback"]
  component: ["reuse shared/ui: IconButton, Checkbox, Select, Badge, Skeleton, Spinner, EmptyState, Tooltip", "popup container mới (Shadow DOM mount, auto-position, resize)"]
  iconography: ["SVG icon set neutral names (audioIcon, imageIcon, translateIcon, linksIcon, settingsIcon, quickAddIcon, sendToCreatorIcon, playIcon, copyIcon, externalLinkIcon, resizeIcon) — không nhắc sản phẩm bên thứ ba", "icon-only button 36x36px desktop, 44x44px mobile touch", "bỏ moreIcon — 4 toolbar items là đủ MVP"]
  code_quality: ["function component + hooks, named export, TypeScript strict, colocate test", "CSS Modules + theme tokens, không hex/raw", "content-script isolated world: px tokens không rem"]

# layout audit (Gate 1 checklist result)
layout_audit:
  status: APPROVED
  sections:
    input_fetch: "5 inputs fetched từ codebase (themeTokens, shared/ui, languageRegistry, settingsStore, messages) + upstream (intent + spec) — không hỏi user"
    ia: "task-flow model, floating nav, 4 toolbar items (Audio/Image/Translate/Links)"
    grouping: "5 groups by user task-flow, ≤7 per group (Miller)"
    cognitive_load: "definitions always visible giảm switch cost, toolbar toggle giảm scan cost"
    order: "frequency first (target, definitions, Quick Add), task-flow second (toolbar), housekeeping last (footer, settings)"
    hierarchy: "F-pattern, target 1st, definitions 2nd, Quick Add 3rd"
    minimalism: "no chrome waste, icon-only toolbar, config ẩn trong overlay"
    convention: "Jakob's Law — popup floating như extension dict phổ biến, checkbox list convention, icon toolbar convention"
    bans: "no em-dash, no purple gradient, no 3 equal cards, no fake screenshot"
    wireframe: "Variant A approved (toolbar-toggle + definitions always visible)"
    responsive: "content parity mọi breakpoint, toolbar scroll mobile, resize ẩn mobile"

# addendum (reviewer fails appended during implement loop)
addendum: {}
```

# === CARD CREATOR WORKSPACE (restyle, D5) ===

> Mode B (incremental restyle on existing Card Creator page). Placement + surface locked here.

## Card Creator function inventory (Mode B)

| ID | Function | Element | Frequency | Zone | Affordance |
|---|---|---|---|---|---|
| CC1 | Header "Card Creator" + [⚙] + [✕] | header | frequent | primary | SVG icon-only header, title left, icons right |
| CC2 | Sub-header: Card type + Deck | select row | frequent | primary | 2 dropdowns cạnh nhau desktop, stack mobile |
| CC3 | Target word title | text | frequent | primary | target word lớn ở đầu right pane |
| CC4 | Sentence quote | text | frequent | primary | sentence italic, target word bold |
| CC5 | Field: Target word | input row | frequent | primary | input + "Modify syntax" toggle |
| CC6 | Field: Sentence | textarea row | frequent | primary | textarea + [CREATE] action |
| CC7 | Field: Sentence translation | textarea row | occasional | secondary | textarea + [CREATE] action |
| CC8 | Field: Definition | textarea row | frequent | primary | textarea + [SEARCH] action |
| CC9 | Field: Sentence audio | media row | occasional | secondary | audio player + [CREATE] action |
| CC10 | Field: Word audio | media row | frequent | primary | audio player + [ADD] action |
| CC11 | Field: Images | media row | occasional | secondary | image cards + [ADD] + [SEARCH] |
| CC12 | Field: Example sentences | textarea row | rare | tertiary | textarea + [SEARCH] action |
| CC13 | Field: Notes | textarea row | occasional | secondary | textarea + [CREATE] action |
| CC14 | Media update mode | select | occasional | secondary | Overwrite/Append/Skip |
| CC15 | Cancel + Add/Update buttons | button | frequent | primary | text + icon, footer right pane |
| CC16 | Settings dialog (from [⚙]) | dialog | occasional | tertiary | Card settings với auto-pill toggles + send card to |
| CC17 | Left pane = Popup Dictionary | panel | frequent | primary | popup dictionary UI embedded as lookup pane; status dropdown in its header |

## Card Creator placement decision (Mode B)

- Existing structure: `CardCreatorDialogContent.tsx` (alert + note type/deck + fields + preview + footer).
- New functions: SRS dropdown, target word title, sentence quote, action buttons per field, settings dialog, left pane popup dictionary, workspace footer status.
- Decision:
  - Left pane: embed popup dictionary (lookup source of truth).
  - Right pane: Card Creator form (restyle with header #4, SVG icons, SRS dropdown, status footer).
  - Settings dialog: from [⚙] icon in right pane header — auto-prefill toggles + audio voice + bold target + send card to.
  - Footer status: workspace bottom-right, sync with popup dictionary status.
- Side effect check: re_grouping: true (major restructure from single dialog to two-pane workspace); hick_le7: true (toolbar 4 icons, fields 10 rows); miller_le7: true; whitespace_ok: true; one_primary: true (Add/Update button primary).

## Card Creator workspace structure (YAML + HTML skeleton)

> For full Card Creator right-pane spec, see `docs/specs/design/UI-UX-Contract-card-creator.md`.

```yaml
workspace:
  class: workspace
  layout: flex row (desktop) / flex column (tablet, mobile)
  children:
    - left_pane: { class: "workspace__pane workspace__pane--left", content: popup_dictionary_embedded }
    - right_pane: { class: "workspace__pane workspace__pane--right", content: card_creator }
```

```html
<div class="workspace">
  <!-- LEFT PANE: Popup Dictionary (reused component) -->
  <div class="workspace__pane workspace__pane--left">
    <div class="workspace__pane-header"><p class="workspace__pane-title">Popup Dictionary</p></div>
    <div class="workspace__pane-body">{POPUP_DICTIONARY_COMPONENT}</div>
  </div>

  <!-- RIGHT PANE: Card Creator (see UI-UX-Contract-card-creator.md for full spec) -->
  <div class="workspace__pane workspace__pane--right">
    {CARD_CREATOR_HEADER}
    {CARD_CREATOR_SUBHEADER}
    {CARD_CREATOR_BODY_WITH_PREVIEW_AND_FIELD_CARDS}
    {CARD_CREATOR_FOOTER_CLEAR_AND_CREATE}
  </div>
</div>
```

## Card Creator settings dialog (HTML skeleton)

```html
<div class="dialog-overlay is-open">
  <div class="dialog" role="dialog" aria-label="Card settings">
    <div class="dialog__header">
      <h2 class="dialog__title">Card settings</h2>
      <button class="icon-btn" aria-label="Close settings">{CLOSE_SVG}</button>
    </div>
    <div class="dialog__body">
      <div class="dialog__section">
        <h3 class="dialog__section-title">Automatic pre-fill</h3>
        <div class="toggle-row"><span>Master toggle</span><button class="toggle" aria-pressed="true">{ON_OFF}</button></div>
      </div>
      <div class="dialog__section"><h3 class="dialog__section-title">SENTENCE</h3><label class="checkbox"><input type="checkbox" checked> Sentence containing Target Word</label></div>
      <div class="dialog__section"><h3 class="dialog__section-title">TRANSLATION</h3><label class="checkbox"><input type="checkbox" checked> Auto translation</label><label class="checkbox"><input type="checkbox" checked> Secondary subtitles</label></div>
      <div class="dialog__section"><h3 class="dialog__section-title">SENTENCE AUDIO</h3><label class="checkbox"><input type="checkbox" checked> Video audio</label><label class="checkbox"><input type="checkbox" checked> Text-to-Speech (TTS)</label><div class="dropdown">{ACCENT_US_DROPDOWN}</div></div>
      <div class="dialog__section"><h3 class="dialog__section-title">WORD AUDIO</h3><label class="checkbox"><input type="checkbox" checked> From dictionary</label><label class="checkbox"><input type="checkbox" checked> Text-to-Speech (TTS)</label><div class="dropdown">{ACCENT_US_DROPDOWN}</div></div>
      <div class="dialog__section"><h3 class="dialog__section-title">IMAGES</h3><label class="checkbox"><input type="checkbox" checked> Video screenshot</label><label class="checkbox"><input type="checkbox" checked> Dictionary image search result</label></div>
      <div class="dialog__section"><h3 class="dialog__section-title">EXAMPLE SENTENCES</h3><label class="checkbox"><input type="checkbox" checked> First dictionary example</label></div>
      <button class="btn">Reset defaults</button>
      <div class="dialog__section"><h3 class="dialog__section-title">Bold target word</h3><label class="checkbox"><input type="checkbox" checked> Bold target word in sentence</label></div>
      <div class="dialog__section"><h3 class="dialog__section-title">Send card to</h3><label class="radio"><input type="radio" name="send-to" checked> Anki</label><label class="radio"><input type="radio" name="send-to"> Cell Memory (stub)</label></div>
    </div>
  </div>
</div>
```

## Card Creator responsive (YAML)

```yaml
responsive:
  desktop: { workspace: "flex row", left_pane: "popup dictionary full height", right_pane: "card creator full height" }
  tablet_le_1024px: { workspace: "flex column", left_pane: "popup dictionary max 35vh", right_pane: "card creator flex 1", both_panes: "scroll independently" }
  mobile_375px: { workspace: "flex column", left_pane: "popup dictionary max 30vh", right_pane: "card creator flex 1", header_actions: "44x44px touch", subheader_dropdowns: "stack vertical", field_cards: "full width stack", footer_buttons: "full width stack (CLEAR top, CREATE below)", status_stays_in: "popup dictionary header (left pane)" }
```
---

# === CARD CREATOR AI-EXECUTABLE VISUAL SPEC ===

> **DEPRECATED for standalone Card Creator tasks.** Use `docs/specs/design/UI-UX-Contract-card-creator.md` instead.
> Section này giữ lại làm context cho popup-dictionary workflow tổng thể.
> Đây là source of truth machine-readable để AI agent reproduce giao diện Card Creator y hệt ảnh tham chiếu #1.
> AI phải đọc section này TRƯỚC khi viết code Card Creator. Mọi quyết định visual phải map về `design-system.md` component + token.

## 1. Visual blueprint (declarative)

```yaml
card_creator_blueprint:
  container: workspace__pane--right
  background: color-background
  border_left: 1px solid color-border
  layout:
    - section: header
      height: auto
      padding: space-3 space-4
      border_bottom: 1px solid color-border-subtle
      content: [title "Card Creator", actions [settings, close]]
    - section: subheader
      height: auto
      padding: space-2 space-4
      border_bottom: 1px solid color-border-subtle
      content: [Card type dropdown, Deck dropdown]
    - section: body
      flex: 1
      overflow_y: auto
      padding: space-3 space-4
      content:
        - preview_card
        - field_cards [target, sentence, translation, definition, sentence_audio, word_audio, images, examples, notes]
    - section: footer
      height: auto
      padding: space-3 space-4
      border_top: 1px solid color-border-subtle
      content: [CLEAR FIELDS, CREATE CARD]
```

## 2. Component → design-system.md mapping

| UI element | design-system.md component | Custom class | Token notes |
|---|---|---|---|
| Header title | — (plain text) | `.creator-header__title` | `font-size: font-size-lg`, `font-weight: font-weight-semibold`, `color: color-text` |
| Header actions | icon-button | `.icon-btn` | 40×40 desktop, 44×44 mobile |
| Subheader dropdowns | dropdown | `.dropdown` | hairline border, radius-md, surface bg |
| Preview card | card | `.creator-preview` | radius-lg (10px), border 1px color-border, bg color-surface, padding space-5 space-4 |
| Preview target word | — | `.creator-preview__word` | `font-size: font-size-3xl`, `font-weight: font-weight-bold`, `color: color-text` |
| Preview sentence | — | `.creator-preview__sentence` | `font-size: font-size-base`, `color: color-text-secondary`; target `<b>` = color-text semibold |
| Field card | card | `.creator-field-card` | radius-lg, border 1px color-border, bg color-surface |
| Field card header | card header | `.creator-field-card__header` | border-bottom 1px color-border-subtle, padding space-2 space-3 |
| Field label | — | `.creator-field-card__label` | `font-size: font-size-xs`, uppercase, letter-spacing 0.04em, color-text-muted |
| Field action button | button | `.btn.btn--ghost` | uppercase label text, hover surface-hover |
| Field clear X | icon-button | `.icon-btn.creator-field-card__clear` | 28×28, color-text-muted, svg 16×16 |
| Field textarea | input | `.creator-field-card__body textarea` | width 100%, min-height 56px, radius-md, border color-border, bg color-background |
| Audio play item | button | `.audio-play` | inline-flex, gap space-2, padding space-2 space-4, radius-md, border color-border, bg color-background |
| Audio ADD button | button | `.btn.btn--primary` | text "+ ADD", align-self flex-start |
| Image grid | — | `.creator-image-grid` | grid auto-fill minmax(120px, 1fr), gap space-2 |
| Image thumb | — | `.creator-image-grid__thumb` | aspect-ratio 4/3, radius-lg, border color-border, bg surface-hover |
| Footer CLEAR | button | `.btn` | secondary, default surface style |
| Footer CREATE | button | `.btn.btn--primary` | primary CTA |

## 3. Field card inventory (order locked)

| # | Label | Action | Content type |
|---|-------|--------|--------------|
| 1 | Target word | MODIFY | textarea value = target |
| 2 | Sentence | CREATE | textarea value = sentence, target bold |
| 3 | Sentence translation | CREATE | textarea value = translation |
| 4 | Definition | SEARCH | textarea value = first definition text |
| 5 | Sentence audio | CREATE | audio-play row + ADD button |
| 6 | Word audio | SEARCH | audio-play row + ADD button |
| 7 | Images | ADD, SEARCH | image grid (auto-prefill 2 placeholders) |
| 8 | Example sentences | SEARCH | textarea value = first example or empty |
| 9 | Notes | CREATE | textarea empty |

## 4. State matrix

| Element | Default | Hover | Active/Selected | Focus | Disabled |
|---------|---------|-------|-----------------|-------|----------|
| Field card | surface bg, border color-border | — | — | — | — |
| Field textarea | bg color-background, border color-border | border color-border-focus | — | 2px ring color-primary, offset 2px | opacity 0.5 |
| Action button (ghost) | transparent border | bg surface-hover | scale 0.98 | 2px ring | opacity 0.5 |
| Clear X icon | color-text-muted | color-text | — | ring | — |
| Audio play | bg color-background | bg surface-hover, border focus | — | ring | — |
| ADD primary | bg primary | bg primary-hover | scale 0.98 | ring | opacity 0.5 |
| CREATE CARD primary | bg primary | bg primary-hover | scale 0.98 | ring | disabled if no target |
| CLEAR FIELDS | bg surface | bg surface-hover | scale 0.98 | ring | — |

## 5. Acceptance Criteria (AT) for AI verification

```yaml
AT1: Right pane has class workspace__pane--right
AT2: Header title textContent === "Card Creator"
AT3: Header has exactly 2 icon buttons (settings, close)
AT4: Subheader has exactly 2 dropdowns labeled "Card type" and "Deck"
AT5: Preview card exists with class creator-preview
AT6: Preview word textContent matches fixture.target
AT7: Preview sentence contains fixture.sentence with target wrapped in <b>
AT8: There are exactly 9 .creator-field-card elements
AT9: Field card labels in order: ["Target word","Sentence","Sentence translation","Definition","Sentence audio","Word audio","Images","Example sentences","Notes"]
AT10: Each field card header has label + action button + clear X
AT11: Audio cards have .audio-play row + .btn--primary "+ ADD" button
AT12: Image card has .creator-image-grid with 2+ .creator-image-grid__thumb
AT13: Footer has exactly 2 buttons: "CLEAR FIELDS" and "CREATE CARD"
AT14: Clicking clear X in field card triggers clear toast/action
AT15: Dark + light theme both render without overflow (card widths stable)
AT16: Console has zero errors after switching to creator view
```

## 6. AI implementation order

1. Read this spec section and the `component_map` at top of file.
2. Query `design-system.md` for each mapped component (card, button, icon-button, dropdown, input).
3. Build HTML structure top-down: header → subheader → body → footer.
4. Apply token audit: grep `--color-*` in new code vs `design-system.md` → MISSING = 0.
5. Run AT1-AT16 with Playwright. Fail → redesign, do not patch symptoms.

## 7. How this spec prevents drift

- **Declarative**: tells WHAT classes/tokens to use, not HOW to invent them.
- **Referenced**: every class maps to `design-system.md` component/token.
- **Verifiable**: 16 ATs turn subjective "giống ảnh" into pass/fail checks.
- **Ordered**: field inventory #1-9 prevents AI from reordering or omitting fields.
- **State matrix**: prevents AI from guessing hover/focus styles.

## Card Creator notes

- For a focused Card Creator redesign task, see `docs/specs/design/UI-UX-Contract-card-creator.md`.

- Action buttons (CREATE/SEARCH/ADD) use SVG icon + tooltip on desktop; icon-only on mobile.
- No AI/ChatGPT sections in settings.
- No Meme mode, no inflections (out of MVP per D3).
- Left pane is the popup dictionary component reused; right pane is the existing Card Creator form restyled.
- SRS switch is only in settings dialog (Send card to: Anki | Cell Memory); no SRS dropdown in Card Creator sub-header.

## Notes for implementer

1. **No third-party names**: không "OCEAN", "Yomitan", "Migaku", "Forvo" trong tên biến/comment (Forvo OK trong user-facing label audio vì là nguồn dữ liệu, không phải tên sản phẩm cạnh tranh). Tên biến neutral: `phraseMatcher`, `lemmaResolver`, `possessiveNormalizer`, `languagePlugin`, `audioSource`, `imageSource`.
2. **MVP scope (D3)**: dictionary match (cụm dài → đơn) + Chinese dictionary-driven segmentation. Plugin interface thiết kế sẵn, implement đầy đủ EN+ZH (lemma + possessive + phrasal/idiom) phase sau.
3. **5 status (D1)**: unknown → known → tracking → learning → ignore.
4. **Hybrid default tab (D2)**: global default + per-language override.
5. **Edit mode ([⚙] toggle)**: nhấn [⚙] ON → General config luôn hiện + mỗi panel mở có config footer inject. Nhấn [⚙] lại OFF → ẩn hết config. Esc KHÔNG tắt edit mode. Auto-save mỗi thay đổi config (debounced 500ms). User test chọn từ khác trong edit mode (popup load result mới, edit mode vẫn ON).
6. **Card Creator restyle (D5)**: sau popup dictionary, không đồng thời.
7. **Web text lookup (D6)**: P1, MVP subtitle overlay trước.
