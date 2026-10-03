# Sign-off Review — pos-dictionary-variants

VERDICT: SIGN_OFF

## Scope verified

- Intent: `docs/intent/pos-dictionary-variants.md` — multi-pos terms as
  independent lexical units with GoldenDict-style pos nav; owner-approved.
- Spec: `docs/specs/pos-dictionary-variants.md` — spec review
  APPROVE_WITH_CHANGES, all 7 findings applied.
- Design: `docs/intent/pos-dictionary-variants-design-brief.md` +
  component mapping — owner selected Concept A (chapter links);
  `PosVariantNav` justified as feature-scope component (InkTabs/Link do
  not express the archetype); brief lint PASS.
- Verify: `docs/reviews/pos-dictionary-variants-verify.md` — VERDICT: PASS;
  status-aggregate defect + overlay pos-fold gap found and fixed pre-commit.

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` (item files) — pass
- `npm run test:unit` — 668/668 suites, 7,893/7,893 tests
- `npm run build` — pass
- Real-browser verify — Playwright Chromium on showcase Real tab
  (`tmp/pos-dictionary-variants/`): pos nav swap, accent toggle,
  per-pos status/freq/inflections, `other` bucket, single-pos nav hidden.

## Business acceptance

- `present` (and any multi-pos term) is now three learnable units:
  `adjective | verb | noun` links above the headword swap IPA, accent,
  frequency chips, inflections, definitions, image query and card prefill.
- Vocabulary status is per (term, pos): marking `present·verb` does not
  mark `present·noun`; term-level consumers (overlay, highlighting, other
  tabs) see the least-learned aggregate.
- Sources: COCA 60000 → per-pos rank + 5-genre breakdown; MacmillanEnEn →
  per-homograph AmE prons + senses; Macmillan 2nd Ed → UK/US prons for the
  accent toggle. All import through the existing Resources pipeline.

## Accepted residual risks

- `.mdd` audio extraction deferred (spec) — `sound://` refs stored verbatim.
- REQ-9 hot-path approximation: overlay aggregate uses materialized pos
  rows only — unmarked variants count as absent in the tokenize hot path
  (spec-sanctioned; dictionary lookup uses the full variant set).
- Full 53k/173k-row imports exercised via converters on real MDX fixtures;
  end-to-end bulk import into a live profile is a post-ship smoke, not a
  gate blocker (import path is the existing resource pipeline).
