# Component Mapping — session-recap

> Brief: `docs/intent/session-recap-design-brief.md`

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Tab nav entry (sidebar + bottom nav) | Button | reuse (existing TABS pattern) | `--primary`, `--textSecondary` | `clock` |
| Hero session container | Card | reuse | `--surface`, `--border` | — |
| Section headers ("Phiên gần nhất"/"Phiên trước") | SectionHeader | reuse | `--textSecondary` | — |
| Duration hero text | Heading | reuse | `--text`, `--font-sizes-2xl` | — |
| Source + time line | Text + Timestamp | reuse | `--textSecondary` | `video` / `windowPage` |
| Coverage chip | Chip | reuse | `--color-primary-subtle` | `gauge` |
| Metric group labels ("Đã tra"/"Đã mark") | Text | reuse | `--textSecondary`, `--font-sizes-sm` | — |
| Lookup term chip | Chip (as="button") | reuse | `--color-surface-hover` | — |
| Status-grouped term chips | Chip (as="button") | reuse + feature class | `--chip-status-learning-bg`/`--chip-status-learning-fg`, `--chip-status-known-bg`/`--chip-status-known-fg`, `--chip-status-tracking-bg`/`--chip-status-tracking-fg`, `--chip-status-ignore-bg`/`--chip-status-ignore-fg` | — |
| `live` badge | Badge (variant="success") | reuse | `--color-token-status-known` | — |
| `derived` badge | Badge (variant="muted") | reuse | `--textSecondary` | `info` |
| "+N" overflow chip | Chip | reuse | `--textSecondary` | — |
| Session list row | ListItem | reuse | `text`, `--textSecondary`, `--color-surface-hover` | `play` |
| Expandable session details | Collapsible + Card | reuse | `--surface`, `--border` | `chevronDown` |
| Empty state | EmptyState | reuse | `--textSecondary` | `clock` |
| Error state + retry | Alert + Button | reuse | `--error`, `--primary` | `rotateCcw` |
| Loading | Spinner | reuse | `primary` | — |
| Term tap → dictionary | `openDictionaryLookup` (controller) | reuse (existing API) | — | — |

No `create` decisions — toàn bộ element map vào `src/shared/ui/` hiện có. Icon tab `clock` từ ICON_CATALOG, chưa dùng bởi tab nào (dictionary bookOpen · vocabulary scanText · studyModes slidersHorizontal · playlist audioWave · settings gear).
