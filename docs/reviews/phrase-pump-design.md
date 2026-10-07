# Review: phrase-pump — DESIGN gate

> Artifacts: `docs/intent/phrase-pump-design-brief.md` · `docs/intent/phrase-pump-component-mapping.md` (lint PASS: 5 tokens, 12 components, 6 icons) · mockup `src/entrypoints/mockup-phrase-pump/` · screenshots `tmp/phrase-pump-design/`

## Round 1 — vision-reader FAIL → applied fixes

| Finding | Severity | Fix |
|---|---|---|
| Pause/play not visually primary vs flanks (lg=48 vs md=40 → 8px diff invisible) | major | Center transport → `variant="solid"` (primary fill) + lg; flanks ghost |
| Mobile touch targets — `chips` segmented variant is `calc(--touch-target - 8px)`, flanks md=40px below coarse floor | major | SegmentedControl → `raised` (full `min-height: var(--touch-target)`); flanks → `lg` (48px ≥ 44 everywhere) |
| Reveal icon showed action-glyph (eyeOff while visible) — ambiguous | minor | State-icon semantics: `eye` when revealed; aria-label keeps action wording |
| Pause hint wording / summary split | minor | Kept — hint text is intentional spec wording; "Done" + subline is the card convention |

## Round 2 — self-review of reshot screens

`playing-desktop-dark/light`, `setup-mobile-dark`, `paused-tts-mobile-dark`, `summary-desktop-dark`, `empty-desktop-light` all render the mapped anatomy: setup card (Select/Toggle/raised Segmenteds/primary Start), stage card (source chip + `3 / 24` + `skipped 1` + reveal toggle; large centered sentence + term chip; transport `navPrev · solid navPause · navNext · recStop`), paused-TTS hint line, summary card, EmptyState. No clipping, no contrast failures in either theme.

## Traceability

- REQ-1 → setup card atoms (Select, Toggle, SegmentedControl raised, Button primary).
- REQ-3/REQ-4 → stage card + transport + hint + reveal toggle.
- REQ-5 → `SrsHome` secondary Button (`audioWave`) + `PlaylistTab` ListItem launcher (outside records conditional) + `?view=pump` deep link.
- REQ-6 → EmptyState + summary card.
- REQ-8 → all atoms shared; every control aria-labeled; transport ≥44px on coarse pointers; icons from `ICON_CATALOG` only.

VERDICT: PASS
