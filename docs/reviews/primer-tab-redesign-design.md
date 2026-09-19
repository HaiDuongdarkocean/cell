# Design review — primer-tab-redesign

- **Slug:** primer-tab-redesign
- **Date:** 2026-09-27
- **Artifacts:**
  - docs/intent/primer-tab-redesign-design-brief.md
  - docs/intent/primer-tab-redesign-component-mapping.md
  - src/entrypoints/mockup-primer-tab-redesign/ (interactive, dev server)
  - tmp/primer-mockup-shots/ (13 screenshots: real + A/B/C × mobile/desktop × light/dark)

## Variants presented

| Concept | Meta treatment | Character |
|---|---|---|
| A — Plain text | `new · freq #2 · ×53` single muted run | quietest, cheapest |
| B — CSS-visual | tinted status word + bordered `#tag` + repeat icon + count | info by affordance |
| C — Signal meter | tinted status word + 5-seg freq meter (band→fill) + `#rank` + `×count` | rank as visual signal |

Locked anatomy shared by all: circular `navPlay` left → term → meta line; single-line header
stats; tightened spacing; token-driven light/dark.

## Verification evidence

- Mockup renders production `PrimerTab` (Real tab) alongside all three variants at ~340px
  and ~520px stage widths, light + dark.
- Meta line stays single-line at 340px in all variants; longest term ellipsizes.
- Status words are literal text in every variant (screen-reader parity).
- `tsc --noEmit` clean on all mockup files.

## Concept selection

**REQ-1..4 meta variant (A/B/C):** decided by another agent's in-flight work — not this
item's call. Recorded here so no agent re-asks or re-implements it.

**REQ-5 + REQ-6 (panel-chrome additions):** APPROVED by Anh on 2026-09-19 —
conditional tab strip (render iff ≥2 renderable tabs) and cue-list scroll-desync with
the `Sync to video` pill (pill click / cue-timestamp seek / filterEpoch change resync).
Mockup-verified: `tmp/primer-mockup-shots/chrome-*.png` — 1-tab no-strip, 2-tabs strip,
desync→pill→resync, light/dark, mobile/desktop.

## Scope carve-out (2026-09-19)

This item delivers **REQ-5 + REQ-6 only**: `SubtitlePanel.tsx` tab-strip condition,
`CueList.tsx`/`.module.css` desync + pill, `cueList.syncToVideo` i18n, `crosshair` icon.
`PrimerTab.*`, `FrequencyBadge`, and the meta-variant decision belong to the other
agent's lane — do not touch.

## Checklist (design gate)

- [x] Three genuinely divergent concepts (not cosmetic variations) — meta treatment differs materially
- [x] Row anatomy follows user-confirmed spec (play left, term, meta below)
- [x] Mobile-first: verified at 340px, meta never wraps
- [x] Desktop verified at 520px
- [x] Light + dark themes verified
- [x] Every interactive element traces to spec (play→seek, row/term→lookup; scroll→desync, pill/seek→resync; ≥2 tabs→strip)
- [x] Shared components mapped — no new primitives
- [x] i18n plan: joined header key + shared `vocabulary.status.*` + `cueList.syncToVideo`
- [x] Dead-code plan: `FrequencyBadge` + `.band*`/`.occurrences` removal (other agent's lane)
- [x] User selection recorded (REQ-5/6 approved; A/B/C owned externally)
- [x] `check-design-brief` run — PASS (5 tokens, 3 components, 1 icon)

VERDICT: APPROVE

## Pivot (2026-09-19)

User decided the Words tab is removed entirely instead of redesigned — the FAB
already provides the learner-facing design language, and the feature is not
needed now. REQ-5/REQ-6 (approved + shipped separately) remain in the product;
REQ-1..4 and the A/B/C meta variants are abandoned with the feature. Removal
deletes `PrimerTab.*`, `primerList.*`, `FrequencyBadge.*`, `primer.*` i18n keys,
the `mockup-primer-tab-redesign` entrypoint, and the `SubtitlePanel` words
wiring. Pipeline item `primer-tab-redesign` transitioned to `dropped`.
