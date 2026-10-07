# Design Review — word-translation

## Gate record

- Stage: `design` → approval gate (interactive mode)
- Artifacts: `docs/intent/word-translation-design-brief.md`, `docs/intent/word-translation-component-mapping.md`, `src/entrypoints/mockup-word-translation/`
- Linter: `node scripts/check-design-brief.mjs word-translation` → `VERDICT: PASS` (9 tokens, 3 components, 0 icons)
- Evidence: `tmp/word-translation/concept-a-light.png`, `concept-b-light.png`, `concept-c-light.png`, `concept-a-dark-desktop.png`

## What was presented

Three divergent concepts on the rendered mockup (real `bindTokenBlock` panel + A/B/C variants, mobile/desktop/light/dark):

- **A — Interlinear:** per-word gloss centered under the token, `::after` mirror of the IPA `::before` cap, ellipsis-bounded, bottom headroom.
- **B — Gloss strip:** one muted annotation line under the whole cue, `·`-separated — line-level IA.
- **C — Glimpse:** faint tick under glossable words; hover/tap floats a surface-elevated chip — on-demand IA.

## User decision

User picked **Concept A — Interlinear** ("chọn a").

Rationale captured in brief: matches the approved spec contract (`data-gloss` + `::after`), reuses the reading-cap grammar the user already learned, copy-clean for free (no DOM text), and needs no new shared component.

Accepted tradeoff: glosses longer than `token width + 0.8em` bleed truncate with ellipsis — consistent with spec REQ-3 ("ellipsis rather than reflow"); dictionary popup remains the full-meaning surface.

## Findings

| # | Finding | Disposition |
|---|---|---|
| 1 | Adjacent glosses wider than their words collide (mockup iteration 1) | solved — bounded `left/right: ±0.4em` + ellipsis |
| 2 | Ellipsis clips long glosses on very short words ("không" under "no") | accepted — spec REQ-3; popup is the complete surface |
| 3 | `data-gloss` absent = no ::after → loading and missing states are free | noted |
| 4 | C needs pointer interaction inside overlay tokens → conflicts with existing click → popup | rejected with concept C |

VERDICT: APPROVE
