# Patterns — Cell Extension

> DSDS-style: interaction + use cases + stance. Patterns are repeatable compositions of components for recurring problems.

## Pattern files

| File | Content | Status |
|---|---|---|
| [interaction.md](interaction.md) | Interaction patterns (14) — ADR-cited, use-when/don't-use-when | stable |
| [settings.md](settings.md) | Settings UI patterns (6 groups) — sidebar, card, typography, form, dependency, danger zone | stable |

## Rules

- Every pattern must have `use-when` + `don't-use-when` (anti-pattern)
- New pattern = ADR required (see [../governance.md#contribution-process](../governance.md#contribution-process))
- Patterns compose components — don't invent new components inside patterns
