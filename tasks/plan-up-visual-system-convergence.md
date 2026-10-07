# Plan — up-visual-system-convergence (DELIVER)

> Spec: `docs/specs/up-visual-system-convergence.md` · Brief: `docs/intent/up-visual-system-convergence-design-brief.md` (all recipe picks already resolved) · Mapping: `docs/intent/up-visual-system-convergence-component-mapping.md`
> Owner: `devin-ux-coord` (build agent: no pipeline-state mutations, no commits). Predecessors 28–32 all shipped — site map re-verified against current code.

## Staging (spec §Flows — one reviewable commit group each; coordinator commits)

### Commit 1 — chrome
- `tokens.json`: `component.panel.shadow` → `--shadow-modal`; `component.panel.border` → `color-border`; `component.popover.border` `transparent` → `color-border` (every theme block ×10 presets).
- REQ-6 seam: drop `CardCreatorPanel` `border-left` (keep `DictionaryTab` `border-right`); sidebar tab/tools groups get `Separator` hairline instead of ~64px void.
- REQ-11: header overflow kebab `Menu` (post-31 header); `slidersHorizontal` stays on vocab filter; Study Modes tab icon → `flame` (UniversalPanel + bottom nav).
- REQ-9.4: overlay-chrome ghosts (`.profileButton`, `.closeButton`, tokenize halves) → hairline border + primary-tint hover.

### Commit 2 — tab surfaces
- REQ-3: vocab `.toolBtn` triggers → `Button variant="secondary" size="sm"` + chevron (Edit stays ghost toggle); `.toolBtn` CSS dies.
- REQ-4: RecapTab `.statusChip` + VocabTab `.statusBadge` → `Chip status` prop; bespoke CSS + `filter: brightness()` die.
- REQ-7: Playlist `.empty` → `EmptyState compact` + `audioWave`; vocab title-only empties gain icon+description (new `vocabulary.empty*Hint` keys en+vi).
- REQ-5: card-creator footer → `Clear` errorSubtle + `Add` secondary + `Update` primary; playlist delete → `errorSubtle`.
- REQ-8: all uppercase/tracking sites → SectionHeader/Text label/Heading; `text-transform` deleted.
- REQ-10: banner owns failure statement; settings status row suppresses duplicated failure text while banner mounted.
- REQ-12: playlist `.itemRow` rides `--card-radius`, stripe dies (failed → `error-subtle` tint treatment); `ModeCards` overrides removed; `StudyModesTab` opacity-as-color → tokens; dashed add-box family → `border hairline dashed color-border` + `radius-lg` + `input-height` floor.

### Commit 3 — shared molecules
- `Menu.module.css`: `.item[aria-checked='true']` gains `primary-subtle` bg; checked+hover → `--button-primary-subtle-hover-bg`.
- `Button.module.css`: new `.secondary` = `--button-secondary-bg/-fg` + hairline `color-border`; consumer sweep for compensating overrides (`.offRow.offRow` documented, no subtitle edits).
- `Chip.tsx`+module: `status` prop (5 color-ways via `--chip-status-*` pairs, hover = color-mix deepen; `as="span"` = static); showcase + test per §10.2.
- `SegmentedControl` `filled`/`chips` active → accent recipe (contrast gate: `primary-subtle` + `text-accent-strong` on tinted track; fallback = documented solid variant).
- `NavItem` label `font-size-xs` → `--font-size-sm` (truncation check at 180px rail).
- `SearchableSelect`: `.menu` hairline `border-emphasized`; `.option` rest `surface`, `:active` `surface-pressed`.
- `HintIcon` hover → `surface-hover` ghost; accent only on open/focus-visible; `cursor: help` kept.
- `--color-track` `85%` → `75%` transparent (Slider/Progress/Toggle consumers verified).
- `QueueSidebar` active row gains accent text.
- REQ-3 leftovers: LPP kebab → `Menu`/`MenuItem`/`destructive`; profile switcher `Dialog`+`RadioGroup` → `Menu` radio items anchored to `.profileButton`; bottom-nav `.toolRow` → `MenuItem emphasis` inside `BottomSheet`; `tool-row-*` tokens retire.

## Sweeps to run (spec-mandated, output → report)
- residual floats: `position: fixed|absolute` + `z-index` under panel scope; `overlay-hover|overlay-pressed|color-field[^-]` on floating/on-surface fills.
- `text-transform: uppercase` under panel scope → 0.
- `opacity:` under panel scope → only disabled/`--opacity-hover`/keyframes.
- `variant="secondary"` compensating overrides.
- residual `dashed` surfaces (`Dropzone`, `ResourcesPanel`, `ImportProgress`).
- `statusChip|statusBadge` → 0; `filter: brightness` on chips → 0.

## Gates
`npm run typecheck && npm run lint && npm run test:unit && npm run build`; `check-design-system-css` (+`:features`); subtitle-split-view AC re-verify after `.secondary`.
