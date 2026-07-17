# TODO: Inflectional Morphology Lemma Coverage

## Phase 1: Foundation — Shared Lemma Module
- [ ] Task 1: Create `englishLemma.ts` with multi-candidate lemma function (all 8 suffixes + irregulars)
- [ ] Checkpoint: Foundation tests pass, build clean

## Phase 2: Wire Shared Module
- [ ] Task 2: Add `lemmaCandidates` to `LanguagePlugin` interface
- [ ] Task 3: Update `englishPlugin.ts` to delegate to shared module
- [ ] Task 4: Update `phraseMatcher.ts` to delegate to shared module (remove duplicate)
- [ ] Checkpoint: All unit tests pass, build clean

## Phase 3: Orchestrator Integration
- [ ] Task 5: Update `assembleLookupResult` to try all lemma candidates
- [ ] Checkpoint: Integration tests pass, build clean

## Phase 4: Polish
- [ ] Task 6: Full test suite + build + typecheck
- [ ] Task 7: Update docs + ADR-041
- [ ] Checkpoint: Complete — ready for user verification
