# ADR-040: Inflectional Morphology Lemma for Dictionary Lookup

**Date**: 2026-07-16
**Status**: Superseded by ADR-041 (unified multi-candidate lemma module)

## Context

When a user hovers over an inflected word in a subtitle (e.g. "easiest", "easier",
"better"), the popup dictionary looked up the raw token directly in IndexedDB.
Cambridge dictionary stores only the base form (lemma) — "easy", "good" — so
inflected forms returned `null`:

```
"He was the easiest guy to push around."
  easiest → findDictionaryByTerm("easiest") → [] → null rendered

"It would've been easier for Agent Kim."
  easier → findDictionaryByTerm("easier") → [] → null rendered
```

The `englishLemma` function existed in `englishPlugin.ts` but was **never called**
in the lookup flow — it was dead code. It also only handled verb inflections
(-ed, -s, -ing), missing adjective/adverb comparison entirely.

## Decision

Implement inflectional morphology lemma reduction covering the full set of
English inflectional suffixes, and wire it into the orchestrator as a two-tier
fallback:

### 1. Extend `englishLemma` with comparative/superlative rules

**Irregular comparison** (unambiguous, map lookup):
- `better` → `good`, `best` → `good`
- `worse` → `bad`, `worst` → `bad`
- `more` → `much`, `most` → `much`
- `less` → `little`, `least` → `little`
- `farther`/`further` → `far`, `farthest`/`furthest` → `far`
- `elder` → `old`, `eldest` → `old`

**Regular comparative -er**:
- `-ier` → `-y`: `easier` → `easy`, `happier` → `happy` (stem ≥ 2 chars)
- Regular: `taller` → `tall`, `faster` → `fast` (stem ≥ 3 chars)

**Regular superlative -est**:
- `-iest` → `-y`: `easiest` → `easy`, `happiest` → `happy` (stem ≥ 2 chars)
- Regular: `tallest` → `tall`, `fastest` → `fast` (stem ≥ 4 chars to avoid
  `forest` → `for`, `modest` → `mod`)

### 2. Wire lemma into orchestrator lookup flow

**`assembleLookupResult`** — lemma fallback when raw term not in dictionary:
```
findDictionaryByTerm("easiest") → []
plugin.lemma("easiest") → "easy"
findDictionaryByTerm("easy") → [definitions]
→ result.term = "easy", definitions rendered
```

**`lookupOrchestratorMulti`** — lemma as additional candidate when both forms
are in dictionary:
```
findDictionaryByTerm("easiest") → [definitions]  (winner)
plugin.lemma("easiest") → "easy"
findDictionaryByTerm("easy") → [definitions]     (additional candidate)
→ popup shows both "easiest" and "easy" as separate candidates
```

Deduplication: if `assembleLookupResult` already fell back to lemma internally
(raw not in dict), `winnerResult.term` IS the lemma. The multi-candidate check
compares against `winnerResult.term`, not `lookupTerm`, so no duplicate.

## Known Ceilings (ponytail)

Marked for future upgrade, not blocking current usage:

1. **CVC doubling reversal**: `bigger` → `bigg` (not `big`), `hottest` → `hott`
   (not `hot`). The CVC doubling rule (big → bigger, hot → hotter) doubles the
   final consonant, but reversing it is ambiguous without a lexicon — "tall"
   also ends in double consonant but is the base form. Upgrade: try both stem
   and stem-with-one-consonant-stripped in the orchestrator.

2. **Silent -e drop**: `nicest` → `nic` (not `nice`), `larger` → `larg` (not
   `large`). Words ending in silent -e drop it before -er/-est. Upgrade: try
   stem + "e" as a second candidate in the orchestrator.

3. **No false-positive risk**: the lemma is only a fallback candidate. The
   orchestrator tries the raw term first. If the raw term is in the dictionary,
   it's used directly. False lemmas (e.g. "water" → "wat") won't be in the
   dictionary, so they return empty and are silently discarded.

## Consequences

- `easiest`, `easier`, `better`, `best`, `worse`, `worst`, and all regular
  comparative/superlative forms now resolve to their lemma when the inflected
  form isn't in the dictionary.
- When both inflected and lemma forms exist in the dictionary, both are shown
  as separate candidates (progressive rendering via `appendCandidate`).
- No regression: 3044 unit tests pass, including all existing lemma tests for
  verbs (-ed, -s, -ing) and phrase matching.
