# Component Mapping — anki-notetype-pills

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Notetype pill | `Chip` (`as="button"`, `size="sm"`, `selected`) | reuse | `derived.dark.color-field`, `derived.dark.color-primary-subtle`, `derived.dark.color-text-accent-strong`, `static.radius.pill` | — |
| Manage icon button | `IconButton` (`variant="ghost"`, `size="sm"`) | reuse | `derived.dark.color-overlay-hover` | icon: `slidersHorizontal` |
| Bar container | `Stack` horizontal layout + plain `div` pills group | reuse layout | `static.spacing.2`, `static.spacing.4` | — |
| Manage surface (desktop) | `Popover` (`variant="menu"`, `menuAlign="right"`) | reuse | `derived.dark.color-surface-elevated`, `static.shadow.popover`, `static.radius.md` | — |
| Manage surface (mobile) | `BottomSheet` (`open`, `title`) | reuse | `component.dialog.bg`, `component.dialog.radius` | — |
| Notetype toggle row | `Checkbox` (`variant="row"`) | reuse (moved from `advRow` block) | `derived.dark.color-surface-hover` | — |
| Sample dots / arrows | existing `.dot`/`.dotActive` + `IconButton` | unchanged | `core.dark.primary` | icons: `chevronLeft`, `chevronRight` |
| Field selects | `Select` | unchanged | — | — |
| Empty state | `Text` (`variant="supporting"`) | reuse | `core.dark.textSecondary` | — |
| Pill focus ring | `Chip` `:focus-visible` (existing) | reuse | `static.spacing.0-5`, `derived.dark.color-border-focus` | — |

New CSS (in `ImportWizard.module.css` only): `.ntBar` (flex row, `min-width:0` pills container, `flex-wrap`), `.ntPills` (flex wrap gap), `.ntCount` (secondary text inside pill), `.ntManagePop` (popover padding/max-height list). No new shared components, no new icons, no new tokens.
