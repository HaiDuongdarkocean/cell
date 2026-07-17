# Spec: Complete English Inflectional Morphology Lemma Coverage

## Objective

**What:** Make the popup dictionary resolve ANY inflected English word to its dictionary lemma form, covering ALL 8 English inflectional suffixes + ALL common irregular forms.

**Why:** When a user hovers over "children", "bigger", "nicest", "running", "boxes", "cat's" — the dictionary lookup must find the base form ("child", "big", "nice", "run", "box", "cat"). Currently many forms return `null` because `englishLemma` is incomplete and returns a single guess instead of multiple candidates for ambiguous cases.

**Who:** Users watching English subtitles with the popup dictionary enabled.

**Success looks like:** Hovering over ANY inflected English word in a subtitle resolves to its dictionary entry. No `null` results for words whose lemma is in the dictionary.

## Background — English Inflectional Morphology (Complete Taxonomy)

English has **exactly 8 inflectional suffixes** (this is a closed class — no new ones are added):

| # | Suffix | Category | Example | Current Coverage |
|---|--------|----------|---------|-----------------|
| 1 | -s | 3rd person singular verb | looks→look, carries→carry, goes→go, watches→watch | Partial: -s ✓, -es after sibilants ✗, -ies→-y ✓ |
| 2 | -ed | past tense / past participle | kicked→kick, carried→carry, stopped→stop, charged→charge | Partial: bare stem ✓, -ied→-y ✓, CVC doubling ✗, silent-e ✗ |
| 3 | -ing | gerund / present participle | running→run, taking→take, lying→lie | Partial: bare stem ✓, CVC ✗, silent-e ✗, -ie→-ying ✗ |
| 4 | -er | comparative (adj/adv) | taller→tall, easier→easy, bigger→big, nicer→nice | Partial: -ier→-y ✓, bare stem ✓, CVC ✗, silent-e ✗ |
| 5 | -est | superlative (adj/adv) | tallest→tall, easiest→easy, biggest→big, nicest→nice | Partial: -iest→-y ✓, bare stem ✓, CVC ✗, silent-e ✗ |
| 6 | -s | plural noun | cats→cat, cities→city, boxes→box, knives→knife | Partial: -s ✓, -es sibilants ✗, -ies→-y ✓, -ves ✗ |
| 7 | -'s | possessive singular | cat's→cat, dog's→dog | NOT covered |
| 8 | -s | possessive plural (dogs'→dog) | dogs'→dog | NOT covered (rare in subtitles) |

Plus **irregular forms** (closed classes):

| Category | Example | Current Coverage |
|----------|---------|-----------------|
| Irregular verbs | was→be, took→take, flew→fly | Partial: englishPlugin map is smaller than phraseMatcher map (~100 vs ~250 entries) |
| Irregular comparison | better→good, worse→bad | ✓ (just added in ADR-040) |
| Irregular plural nouns | children→child, men→man, mice→mouse, feet→foot, teeth→tooth, women→woman, geese→goose, lice→louse | NOT covered |
| -ves plural (f→v) | knives→knife, wives→wife, wolves→wolf, leaves→leaf, loaves→loaf, halves→half, shelves→shelf, calves→calf, selves→self, thieves→thief | NOT covered |
| -en plural | children→child, oxen→ox, brethren→brother | NOT covered (rare) |
| Latin/Greek plurals | data→datum, criteria→criterion, analyses→analysis, phenomena→phenomenon, stimuli→stimulus | NOT covered (rare in subtitles, low priority) |

## Architecture Decision: Unify Lemma Logic

### The Problem: Two Duplicate Lemma Systems

The codebase has **two separate lemmatization systems**:

1. **`phraseMatcher.candidateLemmas(word): string[]`** — multi-candidate, has CVC doubling + silent-e restoration for verbs. Used for phrase matching (ADR-037). NOT exported, NOT reusable.

2. **`englishPlugin.englishLemma(word): string`** — single-return, missing CVC/silent-e. Used for dictionary lookup (ADR-040). Smaller irregular verb map.

This is a **design inconsistency**: the phrase matcher has better lemmatization than the dictionary lookup. The same word "running" gets `run` (correct) in phrase matching but `runn` (wrong) in dictionary lookup.

### The Solution: Single Shared Multi-Candidate Lemma Module

**Extract** the lemma logic into a shared module: `src/features/dictionaryPopup/logic/englishLemma.ts`

This module exports:
```typescript
/** Multi-candidate English lemmatization. Returns ALL possible base forms
 *  for a word, ordered by likelihood. False positives are harmless — the
 *  caller (orchestrator) just tries each against the dictionary and keeps
 *  the ones that match. */
export function englishLemmaCandidates(word: string): string[]
```

**Why multi-candidate?** Some inflections are ambiguous:
- `bigger` → `bigg` (bare stem) OR `big` (CVC doubling reversal) — both are valid candidates
- `nicest` → `nic` (bare stem) OR `nice` (silent-e restoration) — both are valid candidates
- `lying` → `ly` (bare stem, wrong) OR `lie` (ie→ying reversal) — both are valid candidates

The dictionary lookup tries each candidate; false positives (e.g. `bigg` not in dict) are silently discarded. This is the same pattern `candidateLemmas` already uses successfully in phraseMatcher.

### Orchestrator Integration

The orchestrator changes from:
```typescript
// Current: single lemma fallback
const lemma = plugin.lemma(lookupTerm);  // returns string
```

To:
```typescript
// New: multi-candidate lemma fallback
const candidates = plugin.lemmaCandidates(lookupTerm);  // returns string[]
for (const candidate of candidates) {
  const entries = await findDictionaryByTerm(langCode, candidate);
  if (entries.length > 0) { /* use this candidate */ break; }
}
```

The `LanguagePlugin` interface gets a new optional method:
```typescript
/** Multi-candidate lemmatization: returns all possible base forms. */
lemmaCandidates?(word: string): string[];
```

The existing `lemma(word: string): string` is kept for backward compatibility (returns `lemmaCandidates(word)[0]`).

## Tech Stack

- TypeScript strict mode, no `any`
- Jest unit tests (colocated: `englishLemma.ts` → `englishLemma.test.ts`)
- No new dependencies
- Pure function — no I/O, no IndexedDB, no side effects

## Commands

```
Build:    npm run build
Test:     npm run test:unit
Lint:     npm run lint
Typecheck: npx tsc --noEmit
```

## Project Structure

```
src/features/dictionaryPopup/
  logic/
    englishLemma.ts          ← NEW: shared multi-candidate lemma module
    englishLemma.test.ts     ← NEW: comprehensive test suite
    lookupOrchestrator.ts    ← MODIFIED: use lemmaCandidates
  plugins/
    englishPlugin.ts         ← MODIFIED: delegate to shared module, add lemmaCandidates
    englishPlugin.test.ts    ← MODIFIED: update tests for new behavior
    languagePlugin.ts        ← MODIFIED: add lemmaCandidates to interface
src/features/dictionary/
  logic/
    phraseMatcher.ts         ← MODIFIED: delegate to shared module (remove duplicate)
```

## Code Style

```typescript
// Multi-candidate: returns array, first = most likely
export function englishLemmaCandidates(word: string): string[] {
  const lower = word.toLowerCase();
  const irreg = IRREGULAR_VERBS.get(lower);
  if (irreg) return [irreg];
  // ... regular rules, each returns candidates ordered by likelihood
}

// Single-candidate wrapper for backward compat
export function englishLemma(word: string): string {
  return englishLemmaCandidates(word)[0] ?? word.toLowerCase();
}
```

## Testing Strategy

- **Unit tests** for every inflection rule (small, pure function, milliseconds)
- **Edge case tests** for false-positive guards (forest→forest, not for+est)
- **Integration tests** in lookupOrchestrator.test.ts for end-to-end lemma fallback
- **Regression tests** — all existing tests must pass

Test categories:
1. Irregular verbs (expanded map)
2. Irregular comparison (already done)
3. Irregular plural nouns (new)
4. -ves plural (new)
5. Regular -ed with CVC + silent-e (new)
6. Regular -ing with CVC + silent-e + ie→ying (new)
7. Regular -er with CVC + silent-e (new)
8. Regular -est with CVC + silent-e (new)
9. Noun plural -s with -es sibilants (new)
10. Possessive -'s (new)
11. False-positive guards (forest, water, her, test, etc.)

## Boundaries

- **Always do:** Run tests before commits, follow naming conventions, colocate tests
- **Ask first:** Changing the `LanguagePlugin` interface signature, adding dependencies
- **Never do:** Break existing phraseMatcher tests, remove the `lemma()` method (keep for backward compat), add Latin/Greek plurals (out of scope — rare in subtitles)

## Success Criteria

1. `englishLemmaCandidates("easiest")` returns `["easy"]`
2. `englishLemmaCandidates("bigger")` returns `["big", "bigg"]` (CVC doubling)
3. `englishLemmaCandidates("nicest")` returns `["nice", "nic"]` (silent-e)
4. `englishLemmaCandidates("running")` returns `["run", "runn", "runne"]` (CVC + silent-e)
5. `englishLemmaCandidates("lying")` returns `["lie", "ly"]` (ie→ying)
6. `englishLemmaCandidates("boxes")` returns `["box"]` (sibilant -es)
7. `englishLemmaCandidates("knives")` returns `["knife"]` (-ves plural)
8. `englishLemmaCandidates("children")` returns `["child"]` (irregular plural)
9. `englishLemmaCandidates("men")` returns `["man"]` (irregular plural)
10. `englishLemmaCandidates("cat's")` returns `["cat"]` (possessive)
11. `englishLemmaCandidates("forest")` returns `["forest"]` (false-positive guard)
12. `englishLemmaCandidates("water")` returns `["water"]` (false-positive guard)
13. All 3044+ existing tests pass
14. Build succeeds
15. phraseMatcher still works (delegates to shared module)

## Open Questions

None — the taxonomy is complete (English has exactly 8 inflectional suffixes, closed class). The irregular forms are finite and enumerable. Latin/Greek plurals are explicitly out of scope (rare in subtitles).

## Out of Scope

- Latin/Greek plurals (data→datum, criteria→criterion) — rare in subtitles
- Possessive plural (dogs'→dog) — rare in subtitles, ambiguous with singular possessive
- Derivational morphology (happiness→happy, quickly→quick) — different linguistic process, not inflectional
- Comparative/superlative of long adjectives (more beautiful→beautiful) — uses "more/most" which are separate words, already handled by irregular comparison map
