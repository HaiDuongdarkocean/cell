# Verify — srs-front-variants

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/srs-front-variants.md` · Plan: `tasks/plan-srs-front-variants.md` · Design review: `docs/reviews/srs-front-variants-design.md` (APPROVE)

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean |
| `npm run lint` | pass | 0 errors (3 pre-existing exhaustive-deps warnings) |
| `npm run test:unit` | pass | 666 suites / 7833 tests — incl. `variantFront.test.ts` (isServable matrix, toggle derive/degrade, expectedField), `variantPresetRepository.test.ts`, `selectNextReview.test.ts` (unservable variants skipped, no NO_TEMPLATE), `SrsStudyProvider.test.tsx` |
| `npm run build` | pass | vite build + postbuild CSP patch |
| browser | pass | real-Chrome verify below |

## Real-browser verification

`tmp/srs-variants-verify/verify.mjs` — Playwright persistent Chromium + packed `dist` (cloned profile, warm-up launch), on the srs-study page:

- Home renders; Study settings opens; tabs present: General / **Variants** / Customize card
- Variants shelf: preset Select (`Default · Collection default`), kebab, search, `New` tile; 4 variant tiles rendering live `SrsVariantFront` previews — `Word + Sentence` (ephemeral sample sentence), `Sound`/`Meaning`/`Spelling` builtin with loop counts
- Tile click → editor Dialog: live preview + name input + 11 field chips + loops control + Save; no footer close; top-right × closes back to the settings sheet
- Zero console/page errors across the whole run
- Screenshots: `tmp/srs-variants-verify/shots/01-home.png` … `04-variant-editor.png` — 12/12 checks pass

## Fixes landed during deliver/handoff

- `1b5184ba` — dictation graded against live audio toggle; `inputCorrect` tri-state (undefined = nothing to grade — `remember` no longer demands an imaginary spelling pass on non-input variants)
- `SrsStudyProvider.submit` applies toggles changed after stimulus build so grading matches what the user actually saw; variant editor gets × close; Variants panel selects wrap on narrow widths
- `065f8fe3` — collateral perf fix on the same surface's import path: ankiImport chunked write pipeline (3614 → 19 IDB transactions on a 600-card fixture, pooled media resolve ×8 + filename dedup); import seeds per-variant components via deck preset

## Requirement traceability (spec §AC)

- AC-1/2/3 front render only declared fieldIds — `SrsVariantFront` field-driven renderer; no default targetWord/sentence leak
- AC-4 derived toggles gate on material (scope needs target+sentence, audio needs wordAudio+sentAudio; missing → no toggle rendered); `variantToggles` pref persists
- AC-5 per-variant `components`/`studyAgainDue` records; session carries `variant` + `dictationMode` on records
- AC-6/9 servable filter in `selectNextReview` candidates — unservable variants skipped, Sound always servable when term or sentence exists
- AC-7 unservable component does not block explore-lock/maintenance (learningPath param)
- AC-8 front DOM excludes the graded expected field
- AC-10/11/12 Variants tab shelf + editor dialog (draft/Save, ghost Delete→destructive hover, × close only, loops 1–3, live preview) — verified on real Chrome
- AC-13/14 preset scoped collection default + deck override; builtin reset preserves customs
- Import path: components initialized per deck preset variants; revlog → record mapping preserved
