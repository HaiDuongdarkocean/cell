# Subtitle Cleanup Rules — Component Mapping

> Brief: `docs/intent/subtitle-cleanup-rules-design-brief.md` · Variant: Rule list rows (all-mode single variant)

## Chosen variant

**Rule list rows** inside the existing Advanced `Card` — every element reuses shipped atoms or existing feature patterns. No `create` decisions are needed; nothing in the chosen variant exceeds what `src/shared/ui` + the StudyModesTab row grammar already express.

## UI elements

| UI element | Decision | Component | Token(s) | Icon |
|---|---|---|---|---|
| "Subtitle cleanup" group heading + eyebrow | reuse | `Text` (`variant="label"`, `styles.eyebrow`) + `Heading level={4}` | `--color-text-muted` | — |
| Group description line | reuse | `Text` `color="secondary"` | `--color-text-muted` | — |
| Rule row container | extend | `Stack` (vertical) + row `div` (feature css, mirrors `.modeCardWrapper` rhythm) | `--color-border-subtle`, `--card-radius` | — |
| Rule enable control | reuse | `Toggle` (`size="md"` = 44px touch target; `checked`, `onChange`, `ariaLabel`) | — | — |
| Rule name | reuse | `Text` (`variant="heading-3"` → feature class like `.modeTitle`) | — | — |
| Rule description | reuse | `Text` `color="secondary"` | `--color-text-muted` | — |
| Rule pattern (inspectable) | reuse | `Code` | — | — |
| Custom-rule Edit button | reuse | `Button` `variant="ghost"` `size="sm"` `leadingIcon` (44px min-height via row css) | — | `pencil` |
| Custom-rule Delete button | reuse | `Button` `variant="ghost"` `size="sm"` `leadingIcon` (44px min-height via row css) | — | `trash` |
| "Built-in" lock signal | extend | muted text tag (`Text`-styled span; absence of row actions also signals) | `--color-text-muted` | — |
| Add rule button | reuse | `Button` `size="sm"` `leadingIcon` | — | `plus` |
| Rule editor dialog | reuse | `Dialog` (`open`, `onOpenChange`, `title`, `footer`) + `FormGroup` + `Input` ×3 | `--alert-error-fg` (error text) | — |
| Editor inline error | reuse | `Text` `color="error"` role alert-adjacent | `--color-error-muted` | `alertCircle` |
| Delete-confirm dialog | reuse | `Dialog` + `Button variant="destructive"` (identical to custom-mode confirm) | `--button-destructive-bg` | — |
| Lead-in control | reuse | `SliderRow` (`label`, `hint`, `min=0 max=2000 step=50`, `formatValue` → ms) + `Icon` slot | — | `clock` |
| Practice legend `Ctrl` (practice session footer) | reuse | `Kbd` (existing legend slot) | — | — |
| Full-width answer input | reuse | `.answerInput` class (delete the `60ch` line — markup unchanged) | — | — |

## Mockup → production mapping

- `real.tsx` recreates the shipped `AdvancedSection` (`StudyModesTab.tsx:247-350`) 1:1 — chip rows + the single `removeBracketed` checkbox — for comparison.
- Variant replaces that checkbox with the rules group (`CleanupRulesGroup` feature component to be created under `src/features/studyModes/ui/`): resolved rule list → rows; customs carry edit/delete; "Add rule" → editor `Dialog`; delete → confirm `Dialog`.
- `SliderRow` for `cueLeadInMs` sits inside the same card, `formatValue={(v) => \`${v} ms\`}`.
- Practice legend + input width map to `SubtitlePracticeSession`/`SubtitlePractice.module.css` — legend text swap + one CSS line deletion; no new markup.

## Anti-patterns avoided

- No new shared-ui component — `create` count is zero; every element is reuse or a feature-local extension of existing row grammar.
- No new icon — all from `ICON_CATALOG` (`plus`, `pencil`, `trash`, `clock`, `alertCircle`).
- No hardcoded tokens — error text, borders, radii all `var(--*)` token names above.
- No production edits in the mockup — everything new lives in `src/entrypoints/mockup-subtitle-cleanup-rules/` + feature files at deliver time.
