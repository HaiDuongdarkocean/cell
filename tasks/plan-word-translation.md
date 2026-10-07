# Plan — word-translation

Spec: `docs/specs/word-translation.md` · Brief: `docs/intent/word-translation-design-brief.md` · Mapping: `docs/intent/word-translation-component-mapping.md` · Chosen: Concept A (Interlinear).

Feature: per-term native-language gloss under each tokenized word on the subtitle overlay block. Rides the shipped readings machinery (`resolveTerms`, term→cue index, chunked metadata wave).

## Slices

| # | Slice | Files | AC traced |
|---|---|---|---|
| 1 | Message + handler + client: `TRANSLATE_TERMS`, term markers `⟦T{i}⟧…⟦/T{i}⟧`, ≤1500-char sub-batching, marker-aligned parse, echo/empty filter | `dictionarySchemas.ts`, `registry.ts`, `types.ts`, `handlers/translateTerms.ts`, `features/translate/` client | SC-1, SC-4, SC-5, SC-7 |
| 2 | Hydration: `Token.gloss`, `termGlossCache`, `resolveTerms` gloss param (has()-authoritative), preloader 5th leg + `setGlossTargetLanguage` + `setShowGlosses` | `tokenize/types.ts`, `videoTokenMap.ts`, `videoTokenPreloader.ts` | SC-1, SC-5, SC-6 |
| 3 | Render: `data-gloss` attr, `::after` below word (±0.4em bleed, ellipsis), `margin-bottom` headroom, `gloss-off` class, both CSS builders, `setTokenizeShowGlosses` plumbing | `tokenSpanRenderer.ts`, `tokenSpanCss.ts`, `subtitleTokenizeController.ts`, `reactSubtitleController.ts`, `contentScriptMessages` | SC-2, SC-3, SC-8 |
| 4 | Setting: `showWordTranslations` flat field + migration + mirror wiring, SettingsRow under "Show readings", i18n en/vi, storage listener, `subtitleOverlayNativeLanguage` invalidation | `types.ts` (settings), `settingsRegistry.ts`, `profileResolution.ts`, `settingsStore.ts`, `SettingsDialogContent.tsx`, i18n files, `contentScriptController.ts` | SC-4, SC-6 |
| 5 | Gates + verify: unit tests (marker roundtrip, chunk-wipe, echo filter, toggle), 4 npm gates, browser screenshots (on/off/wrap), verify review, architecture doc, ship | tests + docs | SC-1..SC-9 |

## Non-goals (spec boundaries)

Cue list, card preview, web-tokenize, local-player glosses; new providers; format picker.

## Risks

- Google marker fidelity on 1–3 char terms → fallback join `\n`-separated if markers stripped (spec open question; verify in slice 1 tests + browser).
- Gloss longer than word → ellipsis, accepted per REQ-3 + brief.
