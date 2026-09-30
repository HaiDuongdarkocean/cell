# Component mapping: srs-flashcard-redesign

| UI element | Component | Tokens | Icon |
|---|---|---|---|
| Stage | Box | ``core.dark.background`` | — |
| Corner buttons | Button (`variant="ghost"`, `shape="circle"`, `size="sm"`) | ``derived.dark.color-surface-elevated`` fill override (documented override, same pattern as existing `.audioButton`) | `x`, `repeat`, `layers`, `trash`, `pencil` |
| Step dots | Button (`shape="circle"`, `size="sm"`) or plain divs (non-interactive) | ``derived.dark.color-surface-elevated``, active ``derived.dark.color-primary-subtle`` + ``core.dark.primary`` | `volumeHigh`, `bookOpen`, `pencil` |
| Due counter | Text | ``static.font.sizes.sm`,` ``core.dark.textSecondary`` | — |
| Grade buttons | Button (`shape="circle"`, `size="lg"`) | ``derived.dark.color-surface-elevated``; gradient ``core.dark.warning`` → ``core.dark.error`` (existing `.rememberButton`) | `x`, `check` |
| Card | Box | ``core.dark.surface``, ``static.radius.card``, ``static.shadow.md``, ``static.spacing.6`` | — |
| "New" pill | Badge | ``core.dark.success``, ``derived.dark.color-on-success``, ``static.radius.full``, ``static.font.sizes.xs`` | — |
| Word | Heading | ``static.font.sizes.3xl`` | — |
| Sentence / translation | Text | ``static.font.sizes.xl`,` ``static.font.sizes.md`,` ``core.dark.textSecondary`` | — |
| Audio buttons | Button (`shape="circle"`) | ``derived.dark.color-primary-subtle``, ``core.dark.primary`` icon | `audioWave`, `volumeHigh` |
| See translation | Button (`variant="secondary"`, `size="sm"`) | ``static.font.tracking.widest``, uppercase | — |
| Divider | Separator | ``core.dark.border`` | — |
| Notes block | Box | ``derived.dark.color-primary-subtle``, ``static.radius.lg``, ``static.font.sizes.xs`` caption | — |
| Spelling input | InputField | — | — |
| Edit panel shell | Box (card shell) + Label + Textarea + Select + Button | ``core.dark.surface``, ``static.radius.md``, ``static.spacing.3`` rows | `settings`, `wrench`, `play`, `plus` |
| Delete / reset rows | Button (`variant="destructive"` / `ghost`) | — | — |
| Meta footer | Text | ``static.font.sizes.xs`,` ``core.dark.textSecondary`` | — |

New files: `src/entrypoints/srs-study/SrsEditCardPanel.tsx` + `.module.css`. Restyle `SrsReviewCard*.tsx`, `SrsReviewCard.module.css`, `App.tsx`, `App.module.css`. Provider additions in `src/features/srs/ui/SrsStudyProvider.tsx`.
