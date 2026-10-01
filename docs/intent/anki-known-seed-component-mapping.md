# Component Mapping — anki-known-seed

> Brief: `docs/intent/anki-known-seed-design-brief.md`

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Sync section card | Section | reuse | `surface`, `border` | `navRepeat` |
| Enabled row | SettingsRow + Toggle | reuse | `text`, `primary` | — |
| Write-back row + hint | SettingsRow + Toggle + HintIcon | reuse | `textSecondary` | `info` |
| Write-back risk copy | Text (muted, sm) | reuse | `textSecondary` | — |
| Addon port field | InputField | reuse | `border`, `text` | — |
| Addon connection indicator | StatusDot | reuse | `color-token-status-known`, `textSecondary` | — |
| Sync now action | Button | reuse | `primary` | `rotateCcw` |
| Last-sync summary line | Text + Timestamp | reuse | `textSecondary` | — |
| Addon-absent hint | Alert (default) | reuse | `color-info`, `color-info-subtle` | `info` |
| `learning` token color | — (token only) | extend tokens.json | `color-token-status-learning`, `color-token-status-learning-bg` | — |
| `learning` status chip | Chip | reuse | `chip-status-learning-bg`, `chip-status-learning-fg` | — |
| `learning` status dot | StatusDot | reuse | `color-token-status-learning` | — |
| Vocabulary filter option | Menu | reuse | `color-surface-hover` | — |
| Status-key hint (`5`) | Kbd | reuse | `textSecondary` | — |
