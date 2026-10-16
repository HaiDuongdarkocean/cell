# Component Mapping — ai-bridge-dictionary

Maps each new UI element to a canonical `src/shared/ui` component, catalog icon, and tokens. No new primitives.

| UI element | Component | Icon | Tokens |
|---|---|---|---|
| Toolbar pills `ai`, `breakdown` | existing toolbar pill mechanism (feature-local, `Chip`-based) | icon: `atom`, icon: `scanText` | `component.chip.height` |
| Provider picker row | `Chip` ×4 + `StatusDot` per pill | — | `component.chip.height`, `component.button.radius` |
| Answer container | `Surface` | — | `color-surface-card` |
| Answer text | `Text` | — | `component.input.font-size`, `color-text-primary` |
| Loading state | `Skeleton` | — | `color-skeleton` |
| Error state | `EmptyState` + `Button` | icon: `alertCircle` | `component.button.*` |
| Retry | `IconButton` + `Tooltip` | icon: `rotateCcw` | `component.button.height-sm` |
| Attribution line | `Text` muted | — | `color-text-muted`, `component.button.font-size-sm` |
| Translate engine toggle | `SegmentedControl` | — | `color-skeleton` |
| Settings section | `SettingsSection` + `SettingsRow` | icon: `zap` | settings defaults |
| Feature toggles | `Toggle` | — | `color-skeleton` |
| Default provider | `Select` | — | `component.input.*` |
| Failover order editor | `Chip` row + `IconButton` | icons: `chevronLeft`, `chevronRight` | `component.chip.height` |
| Prompt feature switch | `SegmentedControl` | — | `color-skeleton` |
| Prompt fields | `Textarea` | — | `component.input.*` |
| Save/reset | `Button` (primary / outline) | — | `component.button.*` |
| All-fail notice | `Toast` | icon: `triangleAlert` | `color-skeleton` |

New shared components required: **none**. New icons required: **none** — all in `ICON_CATALOG` (`atom`, `scanText`, `rotateCcw`, `alertCircle`, `chevronLeft`, `chevronRight`, `zap`, `triangleAlert`).

i18n key prefixes: `dict.ai.*`, `dict.breakdown.*`, `dict.translate.engine.*`, `settings.ai.*`.
