# Sign-off Review — word-translation

VERDICT: SIGN_OFF

## Scope verified

- Spec: `docs/specs/word-translation.md`
- Design brief: `docs/intent/word-translation-design-brief.md` (Concept A — Interlinear)
- Implementation: TRANSLATE_TERMS message + schema + background handler
  (`translateTerms.ts`), `wordTranslationsClient` + marker helpers in
  `translateService.ts`, `termGlossCache`/`clearGlosses`/`resolveTerms` in
  `videoTokenMap.ts`, fifth preloader leg + `setShowGlosses`/
  `setGlossTargetLanguage`, `data-gloss` + `::after` lane in
  `tokenSpanRenderer.ts`/`tokenSpanCss.ts`, `showWordTranslations` setting
  (schema v36→v37, Settings → Subtitle Block, EN/VI i18n), controller wiring +
  live storage-change updates; `gloss-off` suppression on non-overlay surfaces
  (CueList, PreviewBlock).

## Fresh-context verify (subagent, adversarial)

Initial findings — all fixed and re-verified:

| # | Finding | Resolution |
|---|---------|------------|
| B1 | Marker-joined request body glued without separators (`⟦T0⟧you⟦/T0⟧⟦T1⟧were⟦/T1⟧…`) made Google echo it back untranslated → every gloss `''` — found during live verify, not review | `joinTermTexts` joins markers with `\n` (markers survive + terms translate); primary request is plain `\n`-join with positional zip (better single-word glosses), marker body is the count-mismatch fallback |
| B2 | `translateTermChunk` fell back to returning the wrong-length `plain` segment list → positional zip would misalign glosses onto wrong terms (`translateTerms.ts`) | Single-term chunks join their segments; multi-term count mismatches now fail the sub-batch so covered terms retain prior glosses |
| B3 | A gloss response resolving after `setGlossTargetLanguage` would persist old-language glosses into `termGlossCache` + rendered tokens | Leg captures `tl` at request time and drops results when the target changed mid-flight (`videoTokenPreloader.ts`); regression test `drops glosses that resolve after the target language changed` |

## Browser evidence

`docs/reviews/word-translation-verify.md` — PASS on Brave + mock StreamFlix:
glosses paint below tokens with IPA above (`gloss-live.png`), live toggle
OFF→ON (`gloss-off.png`), native-language switch `vi→fr→vi` re-fetches without
stale glosses, zero requests when disabled, bounded ellipsis, subtitle-only
scope.

VERDICT: SIGN_OFF
