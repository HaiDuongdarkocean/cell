# ADR-041: Unified Multi-Candidate English Lemma Module

**Date:** 2025-01-20
**Status:** Accepted
**Supersedes:** ADR-040 (inflectional morphology lemma — single-candidate)

## Context

ADR-040 added comparative/superlative lemma support to `englishPlugin.englishLemma`. However, two problems remained:

1. **Duplicate lemma systems.** The codebase had TWO separate lemmatization implementations:
   - `phraseMatcher.candidateLemmas` (multi-candidate, ~250 irregular verbs, CVC doubling + silent-e)
   - `englishPlugin.englishLemma` (single-candidate, ~100 irregular verbs, no CVC/silent-e)
   
   The same word "running" got `run` (correct) in phrase matching but `runn` (wrong) in dictionary lookup.

2. **Incomplete coverage.** `englishLemma` was missing:
   - CVC doubling reversal (bigger→big, stopped→step)
   - Silent-e restoration (nicest→nice, charged→charge)
   - Irregular plural nouns (children→child, men→man)
   - -ves plural (knives→knife, wolves→wolf)
   - Possessive -'s (cat's→cat)
   - Sibilant -es (boxes→box, watches→watch)
   - ie→ying gerund (lying→lie)

English has exactly 8 inflectional suffixes (closed class) + finite irregular forms. The old code covered ~40% of these.

## Decision

Extract a single shared module: `src/features/dictionaryPopup/logic/englishLemma.ts`.

### Multi-candidate return

```typescript
export function englishLemmaCandidates(word: string): string[]
```

Returns ALL possible base forms, ordered by likelihood. The original word is always the last candidate (fallback). False positives (e.g. "wat" from "water") are harmless — the orchestrator tries the raw term FIRST, then iterates candidates; false lemmas not in the dictionary are silently discarded.

This solves the CVC/silent-e ambiguity:
- `bigger` → `["big", "bigger"]` (CVC doubling gives "big", bare stem gives "bigg" which is wrong but harmless)
- `nicest` → `["nice", "nic"]` (silent-e gives "nice", bare stem gives "nic" which is wrong but harmless)

### Coverage: ALL 8 inflectional suffixes

| # | Suffix | Rule | Example |
|---|--------|------|---------|
| 1 | -s (verb) | bare + -ies→-y + sibilant -es + -oes→-o | looks→look, carries→carry, watches→watch, goes→go |
| 2 | -ed | CVC + silent-e + -ied→-y + bare | stopped→step, charged→charge, carried→carry, kicked→kick |
| 3 | -ing | CVC + silent-e + ie→ying + bare | running→run, taking→take, lying→lie, working→work |
| 4 | -er | -ier→-y + bare + CVC + silent-e | easier→easy, taller→tall, bigger→big, nicer→nice |
| 5 | -est | -iest→-y + bare + CVC + silent-e | easiest→easy, tallest→tall, biggest→big, nicest→nice |
| 6 | -s (noun) | bare + -ies→-y + sibilant -es + -oes→-o + -ves | cats→cat, cities→city, boxes→box, knives→knife |
| 7 | -'s (possessive) | strip 's + recurse | cat's→cat, children's→child |
| 8 | -s (possessive plural) | same as #6 | dogs'→dog (rare) |

Plus irregular forms (closed classes):
- **Irregular verbs** (~250 entries, merged from both maps)
- **Irregular comparison** (better→good, worse→bad, more→much, etc.)
- **Irregular plural nouns** (children→child, men→man, mice→mouse, feet→foot, teeth→tooth, geese→goose, lice→louse, oxen→ox, brethren→brother, people→person)

### Interface change

`LanguagePlugin` gets a new optional method:
```typescript
lemmaCandidates?(word: string): string[];
```

The existing `lemma(word: string): string` is kept for backward compatibility — it returns `englishLemmaCandidates(word)[0]`.

### Orchestrator integration

`assembleLookupResult`: when raw term fails, iterate `lemmaCandidates()` and use the first match.

`lookupOrchestratorMulti`: when winner is a word fallback with definitions, add lemma candidates as additional results (deduplicated by effective term, not candidate string — because `assembleLookupResult` may resolve a candidate to the same lemma as the winner).

### phraseMatcher delegation

`phraseMatcher.candidateLemmas` now delegates to `englishLemmaCandidates`. The duplicate `IRREGULAR_LEMMAS` map (165 lines) and helper functions (`isConsonant`, `endsInDoubleConsonant`, `VOWELS`) were removed.

## Consequences

**Positive:**
- Single source of truth for English lemmatization — no more divergence between phrase matching and dictionary lookup.
- ALL 8 inflectional suffixes covered — hovering any inflected English word resolves to its dictionary entry.
- Multi-candidate approach handles ambiguity without a lexicon — false positives are harmless.
- 165 lines of duplicate code removed from phraseMatcher.

**Negative:**
- `englishLemmaCandidates` may return up to 6 candidates per word — orchestrator does up to 6 IndexedDB lookups in the worst case. Bounded to <6ms total (IDB indexed lookup <1ms each).
- Possessive -'s stripping cannot distinguish "cat's" (possessive) from "it's" (contraction). For "it's", the lemma returns "it" which is the correct lookup in most subtitle contexts. Contractions with other suffixes (don't, they're, we've) are NOT stripped because the apostrophe is followed by "t", "re", "ve" — not "s".

**Out of scope (future ADR if needed):**
- Latin/Greek plurals (data→datum, criteria→criterion) — rare in subtitles.
- Derivational morphology (happiness→happy, quickly→quick) — different linguistic process.
- Comparative with "more/most" (more beautiful→beautiful) — already handled as separate words.

## Verification

- 46 unit tests in `englishLemma.test.ts` covering all 8 suffixes + irregulars + false-positive guards.
- 18 integration tests in `englishPlugin.test.ts` verifying plugin delegation.
- 27 integration tests in `lookupOrchestrator.test.ts` verifying end-to-end lemma fallback.
- 223 phraseMatcher tests pass (no regression after delegation).
- Total: 3087 tests pass, 0 regressions.
- Build + typecheck clean.
