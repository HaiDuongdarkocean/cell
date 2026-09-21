# Sign-off Review — resources-import-ux

VERDICT: SIGN_OFF

## Scope verified

- Spec: `docs/specs/resources-import-ux.md`
- Plan: `tasks/plan-resources-import-ux.md` + post-plan user feedback
  (integrated-lookup refresh, resource-management rework, profile-scoping
  removal, filename-stem display, drag-and-drop UX rework, edit-mode-only
  deletion affordances).
- Verify artifacts: `docs/reviews/resources-import-ux-verify.md` (PASS) and
  `docs/reviews/resources-import-ux-verify-drag.md` (fresh-context subagent
  review of the drag session — PASS-WITH-NOTES; actionable minors fixed:
  non-primary-button guard, re-entrant session guard, settle duration
  aligned to `--duration-normal`, settle-path unit coverage added).

## Deterministic gates

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test:unit` — 564/564 suites, 6717/6717 tests.
- `npm run build` — pass (feature-cycle + deep-import checks clean).
- Browser verify (`testing-extension-browser`, bundled Chromium + cloned
  profile + uBlock) — `tmp/resources-import-ux/verify2.mjs` **34/34 checks**,
  incl. ghost/placeholder mid-drag screenshot and drag-order persistence
  across reload.

## Business acceptance

- Disabling/enabling/importing/deleting a dictionary refreshes the
  integrated lookup result immediately; the last searched term is retained
  and replayed after mutations and across reloads.
- Resource cards show filename stems (no `.json`/`.zip`/`.db.gz`), word
  count only; technical metadata, profile assignment, and "Ưu tiên N" gone.
- Edit mode gates all deletion affordances; bulk delete is section-scoped
  and selection-aware.
- Pointer drag matches the requested pattern: lifted ghost, dashed
  placeholder chasing the target slot, siblings animating aside, smooth
  settle; keyboard ArrowUp/Down preserved.
- Frequency-band configuration redesigned (`Ngưỡng độ phổ biến`).
