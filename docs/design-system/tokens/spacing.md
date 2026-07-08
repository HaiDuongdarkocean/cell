# Spacing Tokens — Cell Extension

> 4px base unit (M3 principle #7 — 4dp Grid System).

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--spacing-xs` | 4px | stable | 1.0.0 | Button internal padding, tight gap | theme.css:54 |
| `--spacing-sm` | 8px | stable | 1.0.0 | Row padding, default gap | theme.css:55 |
| `--spacing-md` | 12px | stable | 1.0.0 | Card padding | theme.css:56 |
| `--spacing-lg` | 16px | stable | 1.0.0 | Section padding | theme.css:57 |
| `--spacing-xl` | 24px | stable | 1.0.0 | Page padding | theme.css:58 |

## Spacing scale comparison

See [../references.md#spacing-scale-comparison](../references.md#spacing-scale-comparison) for YouTube/M3/our token mapping.

## Rules

- Always pick from scale — no arbitrary values (e.g. `7px`, `15px`)
- Related elements = closer spacing (Gestalt proximity)
- Unrelated groups = larger gap
- Macro whitespace (between sections) > micro whitespace (within component)
- Container padding: 16-24px mobile, 24-48px desktop
