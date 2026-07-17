# Implementation Plan: Complete English Inflectional Morphology Lemma Coverage

## Overview

Extract and unify the duplicated lemma logic from `phraseMatcher.candidateLemmas` and `englishPlugin.englishLemma` into a single shared multi-candidate module. Extend it to cover ALL 8 English inflectional suffixes + ALL common irregular forms. Wire the orchestrator to try multiple lemma candidates against the dictionary.

## Architecture Decisions

1. **Single shared module** (`englishLemma.ts`) — eliminates duplication between phraseMatcher and englishPlugin. Both delegate to it.
2. **Multi-candidate return** (`string[]`) — solves CVC doubling and silent-e ambiguity by returning all possibilities. False positives are harmless (dict lookup discards them).
3. **New `lemmaCandidates` method on `LanguagePlugin`** — additive, doesn't break existing `lemma()` method. `lemma()` becomes a wrapper that returns `lemmaCandidates()[0]`.
4. **Orchestrator tries all candidates** — when raw term fails, iterate through `lemmaCandidates()` and use the first one that has dictionary entries.
5. **Latin/Greek plurals excluded** — rare in subtitles, low ROI, can be added later.

## Task List

### Phase 1: Foundation — Shared Lemma Module

- [x] **Task 1: Create `englishLemma.ts` with multi-candidate lemma function**
  - Acceptance: `englishLemmaCandidates(word): string[]` exported, covers ALL rules from the spec
  - Verify: Unit tests in `englishLemma.test.ts` pass for all 11 success criteria
  - Files: `src/features/dictionaryPopup/logic/englishLemma.ts` (new), `src/features/dictionaryPopup/logic/englishLemma.test.ts` (new)
  - Dependencies: None
  - Scope: S (2 files)

  Sub-rules to implement (in priority order):
  1. Irregular verbs (merge both maps — phraseMatcher has ~250, englishPlugin has ~100)
  2. Irregular comparison (better→good, worse→bad — already done, move to shared)
  3. Irregular plural nouns (children→child, men→man, women→woman, mice→mouse, feet→foot, teeth→tooth, geese→goose, lice→louse, oxen→ox, brethren→brother)
  4. -ves plural (knives→knife, wives→wife, wolves→wolf, leaves→leaf, loaves→loaf, halves→half, shelves→shelf, calves→calf, selves→self, thieves→thief)
  5. Possessive -'s (cat's→cat, dog's→dog — strip 's suffix)
  6. Regular -ed: bare stem + y-replacement + CVC doubling + silent-e restoration
  7. Regular -ing: bare stem + CVC doubling + silent-e restoration + ie→ying
  8. Regular -er: -ier→-y + bare stem + CVC doubling + silent-e restoration
  9. Regular -est: -iest→-y + bare stem + CVC doubling + silent-e restoration
  10. Noun plural -s: bare stem + -ies→-y + -es sibilant stripping (boxes→box, buses→bus, wishes→wish, watches→watch, brushes→brush, buzzes→buzz)
  11. 3rd person -s: bare stem + -ies→-y + -es sibilant stripping (goes→go, watches→watch)

### Checkpoint: Foundation
- [x] All englishLemma unit tests pass (46/46)
- [x] Build succeeds
- [x] No existing tests broken (phraseMatcher still uses its own copy for now)

### Phase 2: Wire Shared Module

- [x] **Task 2: Add `lemmaCandidates` to `LanguagePlugin` interface**
  - Acceptance: `LanguagePlugin` has optional `lemmaCandidates?(word: string): string[]` method
  - Verify: `npx tsc --noEmit` passes
  - Files: `src/features/dictionaryPopup/plugins/languagePlugin.ts`
  - Dependencies: Task 1
  - Scope: XS (1 file)

- [x] **Task 3: Update `englishPlugin.ts` to delegate to shared module**
  - Acceptance: `englishPlugin.lemmaCandidates` calls `englishLemmaCandidates`, `englishPlugin.lemma` returns `englishLemmaCandidates(word)[0]`
  - Verify: `englishPlugin.test.ts` passes (update tests for multi-candidate behavior where needed)
  - Files: `src/features/dictionaryPopup/plugins/englishPlugin.ts`, `src/features/dictionaryPopup/plugins/englishPlugin.test.ts`
  - Dependencies: Task 1, Task 2
  - Scope: S (2 files)

- [x] **Task 4: Update `phraseMatcher.ts` to delegate to shared module**
  - Acceptance: `candidateLemmas` in phraseMatcher calls `englishLemmaCandidates` instead of having its own copy. All phraseMatcher tests pass.
  - Verify: `npm run test:unit -- --testPathPatterns="phraseMatcher"` passes
  - Files: `src/features/dictionary/logic/phraseMatcher.ts`
  - Dependencies: Task 1
  - Scope: S (1 file, remove duplicate code)

### Checkpoint: Wiring
- [x] All unit tests pass
- [x] Build succeeds
- [x] phraseMatcher and englishPlugin both use shared module

### Phase 3: Orchestrator Integration

- [x] **Task 5: Update `assembleLookupResult` to try all lemma candidates**
  - Acceptance: When raw term fails, orchestrator iterates `lemmaCandidates()` and uses first match. When raw term succeeds, adds lemma candidates as additional results.
  - Verify: `lookupOrchestrator.test.ts` passes with new test cases (bigger→big, nicest→nice, running→run, boxes→box, children→child, cat's→cat)
  - Files: `src/features/dictionaryPopup/logic/lookupOrchestrator.ts`, `src/features/dictionaryPopup/logic/lookupOrchestrator.test.ts`
  - Dependencies: Task 2, Task 3
  - Scope: M (2 files)

### Checkpoint: Integration
- [x] All unit tests pass (3087 passed, 4 skipped — 3044+ existing + 43 new)
- [x] Build succeeds
- [x] End-to-end: inflected words resolve to dictionary entries

### Phase 4: Polish

- [x] **Task 6: Run full test suite + build + typecheck**
  - Acceptance: `npm run test:unit` passes, `npm run build` succeeds, `npx tsc --noEmit` passes
  - Verify: All three commands green
  - Files: None (verification only)
  - Dependencies: Task 5
  - Scope: XS

- [x] **Task 7: Update docs + ADR**
  - Acceptance: `docs/2-architechture-system.md` updated with new module, ADR-040 updated or ADR-041 created for the unified lemma architecture
  - Verify: `ls` confirms files exist, content reflects new architecture
  - Files: `docs/2-architechture-system.md`, `docs/adr/041-unified-lemma-module.md` (new), `docs/0-wiki.md`
  - Dependencies: Task 6
  - Scope: S (3 files)

### Checkpoint: Complete
- [x] All acceptance criteria from spec met
- [x] All 11 success criteria verified with tests (36/36 runtime verify + 46 unit tests)
- [x] No regressions (3087 passed, 0 failed)
- [x] Docs updated (ADR-040 superseded, ADR-041 created, wiki + arch updated)
- [ ] Ready for user verification in Chrome — **needs manual test in browser**

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| phraseMatcher tests break after delegating to shared module | High | Task 4 runs phraseMatcher tests immediately after change. If any fail, the shared module is missing a rule — add it. |
| False-positive lemmas cause wrong dictionary lookups | Medium | Multi-candidate approach: orchestrator tries raw term FIRST, only falls back to lemmas if raw fails. False lemmas that aren't in dict are silently discarded. |
| Possessive -'s stripping breaks contractions (it's, don't) | Medium | Only strip -'s when the remaining stem is ≥2 chars AND the apostrophe is followed by exactly "s" (not "t", "ll", "re", "ve"). |
| -es sibilant stripping over-strips (hose→ho, nose→no) | Medium | Only strip -es after sibilant sounds (s, ss, sh, ch, x, z). "hose" ends in "se" not a sibilant, so it stays. |
| Performance: multiple dictionary queries per lookup | Low | Bounded to ≤4 candidates per rule. Dictionary query is IndexedDB indexed lookup — <1ms each. Total <4ms per lookup. |

## Open Questions

None — the spec is complete. English inflectional morphology is a closed class with exactly 8 suffixes + finite irregular forms.
