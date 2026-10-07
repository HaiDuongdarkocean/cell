# Spec review — word-translation

> Date: 2026-10-07 · Reviewer: spec-reviewer subagent (fresh context) · Artifact: `docs/specs/word-translation.md` v1

Verified spec citations against source (`videoTokenPreloader.ts`, `videoTokenMap.ts`, `tokenSpanRenderer.ts`, `tokenSpanCss.ts`, `handlers/translate.ts`, `translateService.ts`, `contentScriptController.ts`, `reactSubtitleController.ts`, `profileResolution.ts`, `settingsRegistry.ts`, `settingsStore.ts`, `dictionarySchemas.ts`, `SettingsDialogContent.tsx`, `types.ts`, `subtitleTokenizeController.ts`) — nearly all are accurate and the mechanisms described (5th `Promise.all` leg, `has()`-authoritative gloss map, `data-gloss` + `::after` mirror of `data-reading`/`::before`, four flat-field touchpoints, storage-change live flip) are implementable as written.

**Blockers:** none.

**Major:**

1. [REQ-1 / NFR-1 / SC-5] [PO/TL]: "one roundtrip per chunk" contradicts the ≤1500-char Google budget. A 100-term preloader chunk with `⟦T{i}⟧…⟦/T{i}⟧` markers (~15 chars overhead/term) ≈ 2–2.5k chars; the 500-term schema max is ~11k chars. The handler must sub-batch by char budget — meaning `translate traffic ≤ ceil(uniqueTerms/500)` in SC-5 is wrong vs actual HTTP requests (only bounds client→SW messages). Fix: state that `translateTerms.ts` splits the joined marker string into ≤1500-char sub-batches; rewrite SC-5 to bound messages and HTTP requests separately.
2. [REQ-2 / REQ-5] [TL]: `nativeLang` staleness. `invalidate()` (`videoTokenPreloader.ts:269-273`) re-queues terms but the preloader captures the gloss target language at construction — spec never says how the *new* `subtitleOverlayNativeLanguage` reaches it. As written, re-resolution after a native-lang change re-fetches glosses in the OLD language. Fix: specify a `setGlossTargetLanguage(tl)` setter or a `getNativeLang()` getter passed via `VideoTokenPreloaderOptions`, wired on the `subtitleOverlayNativeLanguage` storage change (note: today only `subtitleOverlayTargetLanguage` triggers `syncSubtitleTokenize`, `contentScriptController.ts:604-606` — the native-lang trigger is new wiring, name it).

**Minor:**

3. [REQ-5] [TL]: parenthetical misdescribes `invalidate()` — it clears `resolvedTerms`/`pendingTerms` only; it does NOT call `map.clear()` or clear `termGlossCache` (only `setCues` → `map.clear()` does). Wrong-language glosses linger in cache until refetch coverage. Fix: correct the description; add `termGlossCache` clear (or key the cache by `sl→tl`) on language change.
4. [REQ-3 (3–4)] [TL]: "container class `gloss-off`" mislabels the precedent — `reading-off` is applied per token span in `applyTokenClasses` (`tokenSpanRenderer.ts:65-69`), not at container level. Pick one mechanism and name it correctly.
5. [Data] [PO]: `TRANSLATE_TERMS` response contract unspecified — only implied (`{glosses:{}}`, `Record<term,gloss>`). Add an explicit payload+response schema + message direction, like the sibling spec's "Data Contracts" (`reading-annotation.md:90-94`).
6. [REQ-2 (1)] [TL]: `readonly gloss?: string` diverges from sibling resolved fields — `status`/`frequencyBand`/`reading` are declared mutable `x | undefined` (`types.ts:21-25`). Use `gloss: string | undefined` for consistency, or note the deliberate difference.
7. [REQ-2 (5)] [BA]: exclusion names `webTokenizeController` but not local-player — `useSubtitleActions.ts:129-182` also builds a subtitle tokenize controller with `showReadings`; if it inherits `showWordTranslations` it would fetch glosses with no render surface. State the exclusion (or confirm default-off keeps it safe).

## Applied fixes

1. REQ-1/NFR-1/SC-5 — handler now specifies ≤1500-char sub-batching of the marker-joined text; SC-5 bounds messages (≤ceil(terms/500)) and Google HTTP requests (≤ceil(joinedChars/1500)) separately.
2. REQ-2/REQ-5 — added `setGlossTargetLanguage(tl)` (or `getNativeLang()` option) on `VideoTokenPreloader` plus the new `subtitleOverlayNativeLanguage` storage-change trigger wiring.
3. REQ-5 — corrected `invalidate()` description (it does not clear map caches); gloss lang change clears `resolvedTerms` + `termGlossCache` explicitly.
4. REQ-3 — `gloss-off` is a per-token class applied by `applyTokenClasses`, mirroring `reading-off` — not a container class.
5. Data — `TRANSLATE_TERMS` payload + response schema + `direction: cs->bg` added to the table.
6. REQ-2 — `Token.gloss` is `string | undefined` mutable, matching `reading`/`status`/`frequencyBand`.
7. REQ-2 — local-player path (`useSubtitleActions.ts:129-182`) explicitly excluded from gloss fetch.

VERDICT: APPROVE_WITH_CHANGES
