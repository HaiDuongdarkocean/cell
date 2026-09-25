# Sign-off Review — dict-example-selection

VERDICT: SIGN_OFF

## Scope verified

- Intent: `docs/intent/dict-example-selection.md` (user-approved "ok")
- Design: `docs/intent/dict-example-selection-design-brief.md` — user picked Concept A, shared `•` idle dot for def + example rows
- Spec: `docs/specs/dict-example-selection.md` (spec-review APPROVE_WITH_CHANGES, all 8 items applied)
- Verify: `docs/reviews/dict-example-selection-verify.md` — fresh-context `subagent_explore` review, VERDICT: PASS on all 14 ACs

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` — pass (scoped; unrelated foreign-file errors excluded)
- `npm run test:unit` — scoped 77/77 across 8 suites; full suite green except unrelated `migakuFixtures.test.ts` timeouts (foreign dirty files)
- `npm run build` — pass
- Browser (real Chromium, Universal Panel showcase, mobile 390px) — `tmp/dict-example-selection/verify.mjs` **20/20**

## Business acceptance

- Example rows render as sibling checkable rows: idle `·` dot → hover/focus reveals checkbox, matching the definition row contract.
- Checking an example auto-checks its parent definition; unchecking a definition resets that definition's example selections; removing the last checked example leaves the definition checked.
- Default is manual: selecting a definition takes 0 examples. Settings → Dictionary Popup offers "Pick examples myself | Include all examples" (per-language-profile).
- Selected examples ship inside the `definitions` card field as `· ` lines beneath their `• ` definition — verified end-to-end in the Card Creator field on real Chromium.
- Selected example ids clone into the integrated Universal Panel dictionary via `PopupSelectionSnapshot.selectedExampleIds`; Quick Add / Send to Card / Ocean SRS all consume the same selection.
- Example text remains selectable for copy/nested lookup; Space/Enter toggle via keyboard.
