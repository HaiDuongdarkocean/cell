# Design Review — vocabulary-tab-redesign

> Date: 2026-09-18 · Variant judged: **Concept A — Chapter tabs**
> Method: `all`-mode autonomous gate. NOTE — `vision-reader` subagent unavailable (weekly quota exhausted); verdict produced by the orchestrating agent reading the rendered screenshots directly. Human veto remains available.
> Evidence: `tmp/vocabulary-tab-redesign-design/{a-mobile-light,a-mobile-dark,a-desktop-light,a-desktop-dark,real-mobile-light}.png` (scratch, gitignored)
> Lint gate: `check-design-brief.mjs vocabulary-tab-redesign` → `VERDICT: PASS` (20 tokens, 15 components, 5 icons)

## Faithfulness checklist

| # | Criterion | Result |
|---|---|---|
| 1 | Surfaces solid/filled, no glass/blur, token-plausible colors | PASS — flat card surface, hairline dividers, status pills use status-token colors (tracking amber / known green / ignored gray) in both themes |
| 2 | Shape: radii consistent with quiet-confidence language | PASS — pill rail + `radius-md`-class cards/inputs; small radius on list rows |
| 3 | Typography rhythm matches sibling panels | PASS — same label/term/meta scale as shipped tab |
| 4 | Touch targets ≥44px; not cramped at ~375px | PASS — segment pills, rows, Edit button all reach target height; dedicated search row removes the cramped shared row |
| 5 | States visible | PASS — selected segment filled, status pill variants distinct, edit mode hides delete by default (destructive affordance on demand only) |
| 6 | Dark theme token-driven | PASS — desktop-dark fully legible, no washed areas, status colors keep semantics |
| 7 | P0 audit fixes land | PASS — search owns a full row; filter chips → single segment rail; always-visible delete → view/edit split; permanent-only delete → Trash + restore + 24h countdown |

## Deviations

| Sev | Deviation | Note |
|---|---|---|
| P2 | At ~375px the `Ignored` segment count is clipped and `Trash` segment scrolls off-screen | Accepted risk recorded in brief — rail is horizontally scrollable, counts preserved; matches "scrollable rail" mitigation |

No P0/P1 deviations. The chosen concept demonstrably fixes every audited pain while staying inside the shipped component/token system (mapping: zero `create` decisions, one `extend` on `InkTabs` count slot).

## Judge

Orchestrating agent (self-review — vision-reader quota exhausted). Screenshots compared side-by-side vs shipped `real-mobile-light.png`.

VERDICT: PASS
