# Verify — word-translation (browser gate)

> Date: 2026-10-07 · Owner: devin
> Item stage: `deliver` · Gates: typecheck/lint/testUnit/build = pass · **browser = pass**
> Environment: Brave `:9224` (agent profile `C:\cell-browser-sessions\brave-agent`), extension reloaded from current `dist/`, mock StreamFlix `http://127.0.0.1:4321/` (Solo Leveling Ep 1, EN track, native = `vi`).

## Root cause fixed during verify

First browser pass returned `data-gloss` absent on every token even though the
`TRANSLATE_TERMS` route answered `success: true`. Direct probing showed the
marker-joined request body `⟦T0⟧you⟦/T0⟧⟦T1⟧were⟦/T1⟧…` (glued, no separators)
made Google Translate treat the payload as one opaque token and echo it back
untranslated; the same-term suppression then produced `''` for every gloss.
Two fixes landed:

1. `joinTermTexts` now separates marker pairs with `\n` — Google translates
   each term AND preserves the markers.
2. `translateTermChunk` now tries the plain `\n`-joined positional join first
   (better single-word glosses), falling back to the marker-joined body when
   segment count mismatches the term count.

The adversarial sign-off review surfaced two more defects, both fixed and
re-verified in the browser (fresh `dist/`, glosses + IPA confirmed again):

- `translateTermChunk` could return a wrong-length `plain` segment list when
  the marker fallback also failed → positional zip misaligned glosses onto
  wrong terms. Now: single-term chunks join their segments; multi-term
  mismatches fail the sub-batch (terms retain existing glosses).
- A `TRANSLATE_TERMS` response resolving *after* `setGlossTargetLanguage`
  would have written stale-language glosses into the cache/map. The leg now
  captures the target at request time and drops results when the target
  changed mid-flight (`videoTokenPreloader.ts` + regression test).

## What was verified this session

| # | Check | Result |
|---|-------|--------|
| 1 | Tokens render `data-gloss` alongside `data-reading` on the overlay block — "YOU WERE GOOD TO ME" → `bạn/đã/tốt/để/tôi` + `ju/wɜr/ɡʊd/tu/mi` (DOM probe, 5/5 word tokens) | ✅ |
| 2 | Glosses actually paint — IPA caps above glyphs, glosses below, cue between nav clusters; re-verified after the stale-write fix on a fresh build (screenshot `tmp/word-translation/gloss-live.png`, DOM `data-gloss` + `data-reading` on all 5 tokens) | ✅ |
| 3 | Glosses don't overlap adjacent tokens — bounded `::after` (`left/right: -0.4em`, `overflow:hidden`, `text-overflow:ellipsis`), confirmed in mockup `concept-a-light.png` and the live shot | ✅ |
| 4 | Toggle OFF live → `js-cell-token--gloss-off` on all tokens, `data-gloss` cleared, glosses hidden (screenshot `gloss-off.png`); toggle ON re-fetches and restores `bạn/đã/tốt/để/tôi` | ✅ |
| 5 | Native-language change invalidates and re-fetches — `vi→fr` produced `vous/étaient/bien/à/moi`, `fr→vi` produced `bạn/đã/tốt/để/tôi`; no stale glosses | ✅ |
| 6 | Disabled mode makes zero translation requests — gloss leg gated by `showGlosses && glossTargetLanguage`; unit test asserts `getWordTranslations` not called when either is unset | ✅ |
| 7 | Failed/skipped gloss leg retains existing glosses (undefined map semantics); covered terms with `''` clear — `videoTokenMap.test.ts` | ✅ |
| 8 | Marker alignment + 1500-char sub-batching + same-term suppression — `translateService.test.ts` / handler logic | ✅ |
| 9 | Scope limited to subtitle overlay block — `CueList`/`PreviewBlock` render `js-cell-token--gloss-off` so the `::after` lane and footroom stay out of non-overlay surfaces | ✅ |

VERDICT: PASS
