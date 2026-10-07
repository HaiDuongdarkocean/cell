# Component Mapping — mining-queue

> Deconstruction of the "Inbox Tray" variant (`docs/intent/mining-queue-design-brief.md`). Every element traces to a spec REQ; nothing invents a component — the row composition is new, its atoms all exist.

| Element (site) | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Queue tab entry (panel registry append) | NavItem | extend — one registry row renders through the existing sidebar/tools nav atom; keeps ≤5 bottom-rail contract | `component.nav-item.*` | Icon: `layers` |
| Tab host + scroll region | Box | reuse — feature tab mounts inside the panel's existing pane/scroll classes (up-tab-layout-contract) | `color-surface` | — |
| Tab header (title + count) | SectionHeader + Text | reuse — "Queue · N items" header row | `static.font.sizes.sm`, `color-text-secondary` | — |
| Queue row | css (feature module) | create — row anatomy (chip + text + meta + actions) is a new composition; NOT a new atom — composes shared atoms inside a feature-scoped layout | `color-surface-hover` (hover), `color-divider` (row seam), `radius-md` | — |
| Kind chip (term / sentence) | Chip | reuse — term tint = `component.chip-status.learning-bg` family, sentence = `color-field` | `color-primary-subtle`, `color-field`, `radius-pill` | — |
| Term text / sentence text | Text | reuse — term `static.font.sizes.md` medium; sentence `static.font.sizes.sm`, 2-line clamp (`-webkit-line-clamp`) | `static.font.sizes.md`, `static.font.sizes.sm`, `color-text` | — |
| Meta line (source · cue time · age) | Text | reuse | `color-text-secondary`, `static.font.sizes.xs` | — |
| Row action buttons (cardify/quick-add/discard) | IconButton | reuse — trailing action cluster idiom (vocab row actions), `ghost` sm | `color-surface-hover`, `static.touchTarget.mobile` | Icon: `pencil` · `zap` · `trash2` |
| Save affordance — lookup candidate | IconButton | reuse — sits beside existing quick-add/send-to-card actions on the candidate toolbar slot | `color-surface-hover`, `color-primary-subtle` (active flash) | Icon: `layers` |
| Save affordance — cue row | IconButton | reuse — same actions slot as the timestamp button on cue rows | `color-surface-hover`, `static.touchTarget.mobile` | Icon: `layers` |
| Save confirmation | css (existing toast host) | reuse — transient, non-modal toast pattern already used by card sends | `color-surface-popover`, `color-text` | — |
| Save failure | css (toast error variant) | reuse | `color-error-subtle`, `color-error` | — |
| Empty queue | EmptyState | reuse (`compact`) | `color-text-secondary`, `color-border` | Icon: `layers` |
| Loading queue | Spinner | reuse | `color-text-secondary` | — |
| List fetch error | inline error row + Button (`secondary`) retry | reuse | `color-error-subtle`, `color-error` | — |
| Queue tab on mobile | Menu | reuse — `mobileNav:'tools'` rows already render inside the Tools sheet | `color-surface-hover` | Icon: `layers` |

## Conventions check

- Components resolve to `src/shared/ui/*` atoms (`NavItem`, `Box`, `SectionHeader`, `Text`, `Chip`, `IconButton`, `EmptyState`, `Spinner`, `Button`, `Menu`); the feature pieces (`QueueTab` view, the cue-row button host, the candidate-toolbar slot) are composition sites that consume atoms, not atoms themselves.
- Icons resolve to `ICON_CATALOG`: `layers` (queue identity + save), `pencil` (cardify), `zap` (quick-add), `trash2` (discard).
- No new tokens. Values referenced: `static.touchTarget.mobile`, `radius-pill`, `radius-md`, `color-primary-subtle`, `color-field`, `color-divider`, `color-surface-hover`, `color-text`, `color-text-secondary`, `static.font.sizes.*`, `color-error-subtle`, `color-error`, `component.chip-status.*`, `component.nav-item.*`.
- The single `create` row is feature-scoped CSS composing atoms — consistent with sibling list UIs (playlist/vocabulary rows own their row module).
