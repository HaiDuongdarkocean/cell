# Component Mapping — up-visual-system-convergence

> Deconstruction of the "Registry Lock" recipe board (`docs/intent/up-visual-system-convergence-design-brief.md`). Convergence item: almost every decision is reuse/extend of the shipped system; nothing requires `create` — the sole API addition is a `status` prop on `Chip` (extend, `DESIGN.md §10.2` lifecycle: showcase + test + `experimental`).

| Element (site) | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Choice-list surface (vocab menus, profile switcher, kebab, overflow, tools sheet) | Menu | reuse — Popover `menu` surface + item rows + separators is already R-FLOAT; `component.popover.border` `transparent` → `color-border` makes the declared hairline visible (AC-3) | `--color-surface-elevated`, `color-border`, `--shadow-popover` | — |
| Checked row in a menu | Menu | extend — the item's `aria-checked` gains selected tint + deepened-hover composition (spec REQ-1) | `--color-primary-subtle`, `color-primary`, `--button-primary-subtle-hover-bg` | Icon: `check` |
| Destructive menu row | Menu | reuse — `destructive` item prop | `color-error`, `--color-error-subtle` | Icon: `trash2` |
| Menu grouping | Menu | reuse — separator row | `--color-divider` | — |
| Menu/select trigger (vocab filter, sort) | Button | extend — new `.secondary` recipe; trigger skin = secondary + trailing chevron | `--button-secondary-bg`, `--button-secondary-fg`, `color-border`, `--color-overlay-hover` | Icon: `slidersHorizontal`, Icon: `chevronDown` |
| Mode toggle (vocab Edit) | Button (`ghost` + `aria-pressed`) | reuse — toggle treatment, not an emphasis variant | `color-primary`, `--color-surface-hover` | Icon: `pencil` |
| Sole commit action (footer Update, adds) | Button (`primary`) | reuse — L-SCARCITY ≤1 per surface | `color-primary`, `--button-fg` | — |
| Enabled secondary actions (Add, Sync now, ~60 call sites) | Button (`secondary`) | extend — `.secondary` gains the affordance border the legacy recipe lacked | `--button-secondary-bg`, `--button-secondary-fg`, `color-border`, `--button-disabled-opacity` | — |
| Destructive-ish reset (footer Clear) | Button (`errorSubtle`) | reuse | `--color-error-subtle`, `color-error` | — |
| Playlist destructive (delete) | Button (`errorSubtle`) | reuse | `--color-error-subtle`, `color-error` | — |
| Selected card / mode card | Card (`interactive` + `selected`) | reuse — StudyModes `.modeCard` + LanguageProfilePanel `.choice` route through it | `--color-primary-subtle`, `--color-text-accent-strong`, `--shadow-inset-selected` | — |
| Playlist row surface | Card | redesign — ride `--card-radius`; bespoke stripe → documented status treatment | `--card-radius`, `--color-error-subtle`, `color-error` | — |
| Segment strip (settings/theme selectors) | SegmentedControl | redesign — `filled`/`chips` active repoint to the accent recipe (contrast gate) | `--color-primary-subtle`, `--color-text-accent-strong`, `--color-surface-hover` | — |
| Sidebar/bottom nav item (`aria-current`) | NavItem | reuse — R-NAV-CURRENT kept; label token bumps xs→sm | `--color-primary-subtle`, `color-primary`, `--font-size-sm` | Icon: `flame` |
| Panel shell | Surface (`variant="panel"`) | redesign — repoint of the panel token group | `--shadow-modal`, `color-border` | — |
| Searchable select menu + options | SearchableSelect | extend — menu hairline; option rest/active surfaces de-alphaed | `--color-border-emphasized`, `color-surface`, `--color-surface-hover`, `--color-surface-pressed` | Icon: `chevronDown` |
| Status chip (unknown/tracking/learning/known/ignore) | Chip (`status` prop — new prop) | extend — smallest-proposal molecule; static = `as="span"` | `--chip-status-unknown-bg`, `--chip-status-ignore-fg`, `color-text`, `--radius-pill` | — |
| Lookup/filter chips (recap) | Chip | reuse — different job, stays | `--color-field`, `--color-field-hover` | — |
| Empty panes (playlist, vocabulary, siblings) | EmptyState (`compact`) | reuse — hand-rolled `.empty` + title-only states converge | `color-text-secondary`, `color-border`, `--radius-lg` | Icon: `audioWave` |
| Dashed add-box / drop placeholder | EmptyState (`bordered`) + site classes | redesign — one family: dashed border + `radius-lg` + `input-height` floor | `border-width-hairline`, `color-border`, `--radius-lg`, `--input-height` | Icon: `plus` |
| Section/group headings | SectionHeader + Text (`label`) + Heading | reuse — uppercase dialect deleted | `--font-size-sm`, `--tracking-normal`, `color-text-secondary` | — |
| Hint button | HintIcon | redesign — ghost hover; accent only on expanded/focus | `--color-surface-hover`, `color-primary`, `--color-text-accent-strong`, `--color-surface-popover` | Icon: `info` |
| Slider unfilled track / progress track / toggle-off | Slider + Progress + Toggle | redesign — shared `--color-track` strengthened 85%→75% transparent | `--color-track`, `color-primary` | — |
| Overlay-chrome ghost buttons (profile, close, tokenize) | IconButton + Button (`ghost`) | extend — golden-rule-7 chrome border + primary hover tint | `color-border`, `--color-primary-subtle`, `color-primary` | Icon: `x`, Icon: `ellipsisVertical` |
| Sidebar section split | Separator | reuse — replaces the ~64px void | `--color-divider` | — |
| Pane seam (dictionary↔card-creator) | css hairline on the dictionary pane | redesign — single border stays on left pane, twin dropped | `--color-divider`, `border-width-hairline` | — |
| Tools-sheet action rows | Menu (`emphasis` items) inside BottomSheet | reuse — replaces `.toolRow`; `ListItem` only if item 31 mandates | `--color-surface-hover`, `color-text` | Icon: `library`, Icon: `layers`, Icon: `playRoundedRect` |
| Profile switcher | Menu | redesign — item `radio` rows replace `Dialog` + `RadioGroup` for a single pick | `--color-primary-subtle`, `color-primary` | Icon: `check` |
| Blocking failure banner (card creator) | Alert (`error`) | reuse — owns the failure statement in dialog view | `--alert-error-bg`, `--alert-error-fg` | — |
| Ambient connection status (settings row) | StatusDot + Text | reuse — ambient only while banner mounted | `color-success`, `color-error`, `color-text-secondary` | — |
| Loading branch (playlist) | Spinner | reuse — loading ≠ empty | `color-text-secondary` | — |
| Overflow kebab (post-item-31 header) | Menu | reuse — item rows + separators; every overflowed action labeled | `--color-surface-hover` | Icon: `ellipsisVertical` |
| kbd glyphs (shortcut editor) | Kbd | reuse — glyph casing is content, not a heading | `--color-muted`, `color-text` | — |
| Board specimen frames (mockup only) | css — mockup.module.css | reuse tokens — no product component | `color-surface`, `--color-divider`, `--spacing-3`, `--radius-lg` | — |

## Conventions check

- Component names above resolve to `src/shared/ui/*` atoms; feature files (vocabulary, playlist, study-modes, language-profile, sidebar, bottom-nav, header, card-creator, dictionary pane, queue, sync, card-creator dialog/settings, practice-options, `ShortcutInput`, `MultiSelect`, `InkTabs`) consume — they are not atoms.
- Icon ids resolve to `ICON_CATALOG` (`src/shared/icons/index.ts`). Study Modes tab glyph changes `slidersHorizontal` → `flame` (collision fix, REQ-11); the vocab filter trigger keeps `slidersHorizontal`.
- No `create` decisions — the `Chip` `status` prop is `extend` on a stable atom (showcase + unit test required at DELIVER per `DESIGN.md §10.2`).
- No new tokens. Value changes only: `component.panel.shadow` → `--shadow-modal`, `component.panel.border` → `color-border`, `component.popover.border` `transparent` → `color-border`, `--color-track` `85%` → `75%` transparent; the universal-panel tool-row tokens retire with `.toolRow` (spec-sanctioned; flagged as an "ask-first" boundary item for DELIVER).
- `RadioGroup`/`Dialog` lose one consumer (profile switcher) but stay in the library — no deprecation.
