# Spec: Word Translation — per-term gloss under tokenized subtitle words

> Intent: `docs/intent/word-translation.md` · ui_surface: yes · Mode: interactive (user-approved)

## Objective

Render a native-language gloss **under** each tokenized subtitle word on the overlay block — the glance-level meaning layer, sibling to the IPA cap above (`reading-annotation` shipped `d062d9d0`/`26f0a26c`). Resolution rides the same chunked metadata wave as readings (`videoTokenPreloader.flushPendingTerms` → `videoTokenMap.resolveTerms`); translation comes from the existing background `TRANSLATE` pipeline (Google unofficial → MyMemory fallback, `handlers/translate.ts`, `translateService.ts`). Scope is deliberately one surface — the overlay block — per user decision.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | enables "word translations" on a language profile | profile toggle | glosses appear/disappear on overlay tokens without re-tokenizing |
| System | token list hydration | unique terms per flush chunk | one batched translate request → `Token.gloss` |
| System | MT endpoint fails / term untranslatable | null/empty result | no gloss on that token, no visual artifact |
| System | native language unset | `subtitleOverlayNativeLanguage === ''` | gloss leg skipped entirely — zero requests |
| System | dictionary/settings change mid-session | storage change event | glosses re-resolve or visibility flips live |

## Requirements

### Functional

REQ-1: Batched term translation
- Actor: system
- Goal: chunk of unique terms → gloss map in one roundtrip per chunk
- Basic flow:
  1. New client `getWordTranslations(sl, tl, terms)` in `src/features/translate/` mirroring `readingsClient` shape (`readingsClient.ts`); content-script → background via a new message type `TRANSLATE_TERMS` (schema mirrors `TranslatePayloadSchema` + `terms.max(500)`, `dictionarySchemas.ts`)
  2. Background handler `handlers/translateTerms.ts` wraps each term in markers `⟦T{i}⟧term⟦/T{i}⟧` — same contract Google already honours for cue markers (`joinCueTexts`, `translateService.ts:114`) — then **sub-batches the joined marker string into ≤1500-char HTTP requests** (a 100-term preloader chunk with ~15-char marker overhead per term exceeds 1500, so one message can fan out to N Google calls); calls the same Google→MyMemory fetch chain as `TRANSLATE`
  3. Response parsed by marker alignment (`alignTranslatedSegments` generalized or a term-marker variant `alignTermGlosses`); results merged across sub-batches → `Record<term, gloss>` — markers stripped, empty/absent marker → term omitted
  4. Untranslatable results (empty, marker echo, or `gloss === term` case-insensitive) are normalized to empty string in the map — the resolver reads "covered, no gloss" like the readings `''` convention (`videoTokenPreloader.ts:127-129`)
- Alt flow: 0 terms or `tl` empty → handler returns `{ glosses: {} }` without network
- Exception: both providers fail → `success:false` → client resolves `null` → existing glosses survive
- Rules: never `LOOKUP_REQUEST`; single-word MT accepted as hint-layer (intent risk register); source lang = overlay target language
- NFR refs: NFR-1, NFR-4

REQ-2: Token hydration — `Token.gloss`
- Actor: system
- Goal: glosses hydrate in the same metadata wave as status/frequency/reading
- Basic flow:
  1. `Token` gains `gloss: string | undefined` — mutable, matching sibling resolved fields (`status`/`frequencyBand`/`reading`, `types.ts:21-25`); `createTokenList` leaves undefined
  2. `videoTokenPreloader.flushPendingTerms` adds a 5th leg to the existing `Promise.all` (`videoTokenPreloader.ts:102-107`): `showGlosses && nativeLang ? getWordTranslations(langCode, nativeLang, terms).catch(() => null) : Promise.resolve(null)`
  3. `videoTokenMap.resolveTerms`/`resolveMetadata` signature grows a `glosses` map (same `has()`-is-authoritative semantics as readings — chunk coverage marks empty glosses `''` so later chunks never wipe earlier ones, `videoTokenMap.ts:96-105`); a `termGlossCache` parallels `termReadingCache` so `prepare()` re-builds hydrated tokens
  4. `changed` flag compares `gloss !== token.gloss` — gloss-only updates still emit and rebind (`videoTokenMap.ts:106`)
  5. `webTokenizeController` and the **local-player path** (`useSubtitleActions.ts:129-182` builds its own subtitle tokenize controller) do not fetch glosses — gloss leg stays gated on `showGlosses` and the default-off profile value keeps it silent there (same exclusion class as readings REQ-2)
  6. The preloader's gloss target language must follow `subtitleOverlayNativeLanguage` live: add `setGlossTargetLanguage(tl)` (or a `getNativeLang()` option) to `VideoTokenPreloader` — the preloader otherwise captures a stale language at construction (review finding M2)
- Exception: translate leg rejects → `catch(() => null)` → other metadata still applies
- Rules: dedupe via existing `resolvedTerms`/`pendingTerms`; zero extra messages when toggle off or native lang unset; `gloss === undefined` and `gloss === term` render identically (nothing)
- NFR refs: NFR-1, NFR-4

REQ-3: Gloss rendering — below the word
- Actor: system
- Goal: gloss paints under the token glyph, coexisting with the IPA cap above
- Basic flow:
  1. `tokenSpanRenderer` sets `data-gloss` on the inner `.js-Tihoka-token-word` span next to `data-reading` (`tokenSpanRenderer.ts:63-115`); `restyleTokenBlock` re-applies it
  2. CSS in BOTH builders (`buildTokenSpanCss` + `buildTokenSpanCssForShadow`, `tokenSpanCss.ts`): `::after { content: attr(data-gloss); position: absolute; top: 100%; left: 50%; transform: translateX(-50%); font-size: 0.6em; opacity: 0.85; white-space: nowrap; pointer-events: none; user-select: none }` — pseudo-element = copy-clean by construction
  3. Bottom headroom: `margin-bottom` on `.js-Tihoka-token--word` when glosses enabled — the wrap-collision fix pattern proven for `margin-top: 0.85em` (`tokenSpanCss.ts`); a per-token class `js-Tihoka-token--gloss-off` mirrors `reading-off`, applied by `applyTokenClasses` (`tokenSpanRenderer.ts:65-69`), so headroom only applies when the feature is on
  4. Live visibility flip (no re-tokenize): `applyTokenClasses` toggles `gloss-off` per token span alongside `reading-off`, driven by the same render-flag plumbing
  5. Only the subtitle overlay block renders glosses in v1 — cue list/card preview stay untouched per intent scope ("chọn 1")
- Exception: gloss wider than token → `max-width` + `text-overflow: ellipsis` on the pseudo slot, never reflow the line
- Rules: decorative only — no DOM text node, no aria surface; attribute and pseudo-element target the same node (`attr()` reads own attribute)
- NFR refs: NFR-2, NFR-3

REQ-4: Profile toggle `showWordTranslations`
- Actor: learner
- Goal: glosses follow the language profile, persist, flip live
- Basic flow:
  1. Flat-field convention — required `boolean` on both `Settings` and `LanguageProfile` (`types.ts`), wired through all four touchpoints: `FLAT_FIELD_KEYS`, `syncFlatFieldsToActiveProfile` hardcoded list, `ACTIVE_PROFILE_MIRROR_EXCLUSIONS`, and a `settingsStore` migration — identical wiring to `showReadings` (`profileResolution.ts`, `settingsRegistry.ts`)
  2. Default `false` for all profiles (IPA shipped default-zh-only; glosses are denser UI — opt-in)
  3. Control: `SettingsRow` toggle in the Subtitle Block card directly under "Show readings" (`SettingsDialogContent.tsx:466-479`); i18n `en` + `vi`
  4. Live flip: `contentScriptController` storage listener extends the `newSettings?.showReadings` block (`contentScriptController.ts:611-613`) — `subtitleTokenizeCtrl.setShowGlosses` mirrors `setShowReadings` (early-return + `resolvedTerms.clear()` + re-queue, `videoTokenPreloader.ts:261-267`); render layer gets `setTokenizeShowGlosses` sibling to `setTokenizeShowReadings` (`reactSubtitleController.ts:814-819`)
- Rules: toggle off sends zero translate requests; toggling ON must reset the resolved-term dedupe or already-resolved tokens never fetch glosses
- NFR refs: NFR-3, NFR-5

REQ-5: Invalidation
- Actor: system
- Goal: native-language or source-language changes re-resolve glosses
- Basic flow: a **new storage-change trigger** on `settings.subtitleOverlayNativeLanguage` (today only `subtitleOverlayTargetLanguage` re-evaluates tokenize, `contentScriptController.ts:604-606`) → `subtitleTokenizeCtrl.setGlossTargetLanguage(newTl)` → preloader setter updates `tl`, clears `resolvedTerms` + `termGlossCache` (so wrong-language glosses cannot linger — `invalidate()` today only clears `resolvedTerms`/`pendingTerms`, it does NOT touch the map caches) → re-queues `map.terms()`. `subtitleOverlayTargetLanguage` change re-runs `syncSubtitleTokenize` as today, which rebuilds the controller and drops all caches via `map.clear()`.
- Exception: re-resolve fails → existing glosses stay (stale hint beats blank flicker)
- NFR refs: NFR-4

### Non-functional

- NFR-1 Performance: ≤1 extra batched message leg inside the existing `Promise.all` per chunk (≤500 terms/request client-side, ≤1500 chars per Google request); term→cue indexed resolve only (no full-cue scan — `resolveTerms` shipped `26f0a26c`); hydration never blocks first token paint
- NFR-2 Copy/selection: copying an annotated line yields raw sentence text only (pseudo-element, non-selectable)
- NFR-3 Layout: zero reflow — gloss slot is absolutely positioned in reserved `margin-bottom` headroom; verified with screenshot evidence incl. a wrapped 2-line cue
- NFR-4 Degradation: no network, MT failure, empty native lang, toggle off → pixels identical to today's render
- NFR-5 i18n + a11y: `en`/`vi` keys for the toggle row; gloss adds no focusable/announced element

## Flows / States

Chunk lifecycle (same scheduler as readings):

```
terms pending → flushPendingTerms ─┬─ getWordStatuses
                                   ├─ getFrequencyEntries
                                   ├─ loadBandOptions
                                   ├─ getReadings        (showReadings)
                                   └─ getWordTranslations (showGlosses ∧ nativeLang)
                                   → map.resolveTerms(chunk, statuses, freqs, readings, glosses)
                                   → emit(affectedCueIndexes) → rebind visible cue
```

## Function ↔ Feature Map

| Function | Features |
|---|---|
| Translate unique terms to native language | `TRANSLATE_TERMS` message + `handlers/translateTerms.ts` + `getWordTranslations` client |
| Hydrate tokens with gloss | `Token.gloss`, `videoTokenPreloader` 5th leg, `videoTokenMap.resolveTerms` gloss map + `termGlossCache` |
| Render gloss under word | `data-gloss` + `::after` pseudo slot + `margin-bottom` headroom + `gloss-off` container flag |
| Let learner control the feature | `showWordTranslations` profile field + Settings Subtitle Block toggle + storage-change live flip |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `Token.gloss` | `?: string` | `PreparedCue.tokens` (videoTokenMap) | session — cleared with map |
| `termGlossCache` | `Map<term, gloss>` | videoTokenMap closure | session — parallels `termReadingCache` |
| `TRANSLATE_TERMS` payload | `{tabId: number, sl: string, tl: string, terms: string[]}` — zod, `terms.max(500)`; response `MessageResponse<{ glosses: Record<string, string> }>`; `direction: 'cs->bg'` | `dictionarySchemas.ts` + `registry.ts` | transient |
| `showWordTranslations` | `boolean` | `Settings` + `LanguageProfile` (flat-field + mirror) | persisted |

## Traceability

| Need (intent ID) | REQ | AC |
|---|---|---|
| N1 inline gloss | REQ-1, REQ-2 | SC-1 |
| N2 below word, coexists with IPA | REQ-3 | SC-2, SC-3 |
| N3 native-language target | REQ-1 rule, REQ-5 | SC-4 |
| N4 chunked + deduped + cached | REQ-2, NFR-1 | SC-5 |
| N5 live toggle | REQ-4 | SC-6 |
| N6 wrap-safe layout | REQ-3 (3), NFR-3 | SC-7 |
| N7 not selectable/copied | REQ-3 (2), NFR-2 | SC-8 |

| Journey step | REQ |
|---|---|
| TO-BE 2 gloss under each word | REQ-2, REQ-3 |
| TO-BE 3 read without pausing | REQ-1, NFR-1 |
| TO-BE 5 toggle off restores plain | REQ-4 |

## Boundaries

- Always: reuse existing translate pipeline + resolveTerms; both CSS builders; real-browser verify + screenshot
- Ask first: new dependency; manifest change; new persisted storage schema beyond the flat-field migration
- Never: per-token individual HTTP requests; gloss in copyable text nodes; cue-list/card-preview rendering (v1 scope)

## Success Criteria

- SC-1: live cue on a subtitle-overlay page renders native-language glosses under word tokens (e.g. "still" → "vẫn" when native=vi)
- SC-2: IPA cap above + gloss below render simultaneously on the same token without collision
- SC-3: a cue that wraps to 2 lines shows no gloss overlapping the next line's text or caps
- SC-4: empty `subtitleOverlayNativeLanguage` → zero `TRANSLATE_TERMS` messages, tokens render as today
- SC-5: `TRANSLATE_TERMS` messages ≤ ceil(uniqueTerms/500) per hydration wave; Google HTTP requests ≤ ceil(joinedChars/1500) per message; repeated terms across cues send no extra requests
- SC-6: toggling `showWordTranslations` flips gloss visibility live without reload; persists across page reload
- SC-7: MT failure mid-wave → tokens render gloss-less, no blank gaps or error UI
- SC-8: copying the subtitle line yields raw text only — no gloss text in clipboard/selection
- SC-9: screenshot evidence before/after on the overlay block (gloss on, gloss off, wrapped cue)

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Unit tests: marker join/align roundtrip, resolveTerms gloss chunk-wipe regression, toggle live-flip
- [ ] Real-browser verify + screenshot evidence (SC-9)
- [ ] `docs/2-architechture-system.md` updated (new message + gloss leg)
- [ ] `docs/reviews/word-translation-verify.md` ends `VERDICT: PASS`

## Open Questions / Accepted Risks

- Single-word MT quality is a hint layer by design (intent risk R1 — popup stays the truth)
- Google marker fidelity on 1–3 char terms — verified in DELIVER; fallback = per-term unpadded join with `\n` separator
- Cue list glosses are a named follow-up if the overlay gloss proves useful
