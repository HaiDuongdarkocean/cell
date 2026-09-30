# Component Mapping: anki-import

> Every element → a real `src/shared/ui/` component or explicit create decision.
> Linter-enforced: components/icons must exist; tokens must come from tokens.json.

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Top-bar import button | IconButton | reuse — same `ghost sm circle chromeButton` pattern as settings gear | `--color-surface-hover` | `import` |
| Wizard host (desktop) | Dialog | reuse — modal stepper, Escape/overlay-dismiss via existing stack | `--color-surface-popover` | — |
| Wizard host (mobile) | MobileSheet | reuse — bottom sheet on `useIsMobile` | `--color-surface-popover` | — |
| Step rail (desktop) / step label (mobile) | Text + Badge | extend — rail is a Flex column of Badge+Text rows; mobile collapses to Badge `2/6` + Text | `--color-text-primary`, `--color-text-muted`, `--color-primary-subtle` | — |
| Source option card | SelectableCard | reuse — same archetype as destination pickers | `--color-surface-card`, `--color-border-subtle`, `--primary` | `import`, `folderOpen` |
| Connect status line | Text + Spinner | reuse | `--color-text-muted` | — |
| Failure checklist block | Alert + SettingsRow + Input + Button | reuse — Alert(warning) wraps the 3-step guide + retry | `--color-warning-subtle`, `--color-on-warning` | `info` |
| Section labels | SectionHeader | reuse | `--color-text-primary` | — |
| Deck row | Checkbox + Text + Badge cluster | reuse — same row archetype as deck select-mode in `SrsHome` | `--color-surface-card`, `--color-info-subtle` | — |
| Cloze disabled row | Checkbox(disabled) + Badge | reuse — Badge text "không hỗ trợ" | `--color-text-disabled` | — |
| Select all row | Checkbox + Link/Button ghost | reuse | — | — |
| Language select | Select + FlagIcon | reuse — same pattern as profile pickers | — | — |
| Notetype switcher | Tabs | reuse — one tab per selected notetype | `--color-surface-hover` | — |
| Field→role row | Text + Select | reuse — role dropdown per field | `--color-border-subtle` | `chevronDown` |
| Card preview pane | Card + Box | reuse — renders stimulus through the real preview path; mockup draws a static equivalent | `--color-surface-card`, `--color-card-foreground` | — |
| Sample prev/next + "mẫu khác" | IconButton + Button ghost | reuse | — | `chevronLeft`, `chevronRight`, `rotateCcw` |
| Mapping warning (empty target) | Alert | reuse | `--color-warning-subtle` | `triangleAlert` |
| Run progress | Progress + Text + Button ghost(cancel) | reuse | `--primary`, `--color-track` | — |
| Report count rows | ListItem + Badge | reuse — per-category counts | `--color-success-subtle`, `--color-error-subtle`, `--color-info-subtle` | `check`, `x`, `info` |
| Fidelity note | Alert info | reuse | `--color-info-subtle` | `info` |
| Footer actions | Button (ghost/primary) | reuse — Quay lại / Tiếp tục / Hủy / Học ngay / Đóng | — | — |
| Empty picker state | EmptyState | reuse | — | `folderOpen` |

## New assets

- Icon `import` — **created** (`src/shared/icons/svg/import.svg`, lucide
  `import`, registered in `ICON_CATALOG`; nothing in the catalog expressed
  inbound-migration).
- No new components. The stepper rail is composition (Badge+Text+Flex), not
  a new primitive — a `Stepper` component is only warranted if a second flow
  needs it.

## Token discipline

All colors/spacing/typography via existing semantic tokens
(`--color-surface-card`, `--color-text-muted`, `--color-primary-subtle`,
`static.spacing.*`, `static.font.sizes.*`). No ad-hoc hex. Dark mode +
375px floor are first-class states, verified in the mockup.
