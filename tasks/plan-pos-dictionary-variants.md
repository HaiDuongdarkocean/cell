# Plan — pos-dictionary-variants

Spec: `docs/specs/pos-dictionary-variants.md` · Design: `docs/intent/pos-dictionary-variants-design-brief.md` (Concept A — Chapter links) + `docs/intent/pos-dictionary-variants-component-mapping.md`

## Task 1: Types + `posNormalize` foundation

**Priority:** P0
**Depends on:** —
**Parallel:** false (contract — everything consumes these types)
**Blocked strategy:** wait
**Worktree:** no

**Files likely touched:**
- `src/shared/lib/posNormalize.ts` (new)
- `src/entities/dictionary/types.ts` (`prons: {accent,ipa,audioRef}[]`, `FrequencyEntry` +pos/total/genres, `PosVariant`, `LookupResult.variants`)
- `src/entities/dictionary/popupTypes.ts`
- `src/entities/dictionary/resourceSchemas.ts` (zod payload schemas)
- `tests/unit/posNormalize.test.ts` (new)

**Estimated scope:** M

**AC:** SC-11 partial — `normalizePos('j')==='adjective'`; COCA codes + Macmillan labels map per N7 table; unknown raw → lowercase pass-through; `''` → `''`.

## Task 2: `json-frequency` format + frequencyRepository

**Priority:** P0
**Depends on:** T1 (FrequencyEntry shape)
**Parallel:** false (IndexedDB schema/version bump — shared file risk)
**Blocked strategy:** wait
**Worktree:** no

**Files likely touched:**
- `src/features/dictionary/logic/formatDetector.ts` (+`json-frequency` detection after json-entries)
- `src/features/dictionary/logic/importOrchestrator.ts`
- `src/features/dictionary/strategies/` (new `jsonFrequencyStrategy.ts` extends BaseFrequencyStrategy)
- `src/features/dictionary/repositories/frequencyRepository.ts` (pos/genres storage + pos query)
- `src/entities/dictionary/resourceSchemas.ts`
- `tests/unit/` strategy + repo tests

**Estimated scope:** M

**AC:** SC-2 — json-frequency file imports as FREQUENCY; `findFrequencyByTerm` returns pos rows with pos+total+genres; term-only rows still query as before (zero migration for old rows).

## Task 3: COCA converter

**Priority:** P0
**Depends on:** T2 (json-frequency record contract — spec §Data is the agreed interface)
**Parallel:** true (scripts/ disjoint from src/)
**Blocked strategy:** mock-contract
**Worktree:** no

**Files likely touched:**
- `scripts/tihoka-convert-frequency.mjs` (new)
- `scripts/dict-adapters/coca.mjs` (new)
- `tests/` fixture test for COCA block parsing (or runnable check in converter)

**Estimated scope:** M

**AC:** SC-1 — run on real `COCA Frequency 60000.mdx` → JSON, `present` = 4 rows (adjective 1334, noun 2259, verb 818, adverb 8560) each with total + 5 genres; pos normalized via `posNormalize` (jiti import).

## Task 4: Macmillan converters

**Priority:** P0
**Depends on:** T1 (`prons` shape)
**Parallel:** true (scripts/ disjoint)
**Blocked strategy:** mock-contract
**Worktree:** no

**Files likely touched:**
- `scripts/dict-adapters/macmillan.mjs` (upgrade → entry per homograph, prons[] per accent, per-homograph stars/inflections)
- `scripts/dict-adapters/macmillan2e.mjs` (new — 2nd Ed UK+US per homograph → accent labels)
- `scripts/dict-adapters/mdx.mjs` (only if key-grouping needed)
- `tests/` fixture tests

**Estimated scope:** L

**AC:** SC-3 — convert MacmillanEnEn: `present` = 3 entries (adjective/verb/noun) each pos+prons+stars+senses+inflections; `water` keeps wordforms; 2nd Ed → prons have both `uk`/`us` accents where source has them; records without audio refs still emit (match-condition fallback per spec).

## Task 5: wordStatusStore per-POS + aggregate

**Priority:** P0
**Depends on:** T1
**Parallel:** true (services/ disjoint from T2–T4 files)
**Blocked strategy:** mock-contract
**Worktree:** no

**Files likely touched:**
- `src/features/dictionary/services/wordStatusStore.ts` (composite `term␟pos` keys, pos field, prefix-scan helpers, aggregate)
- Status consumers: vocabulary browser, anki status sync, subtitle highlight hot path — route through aggregate helper
- `tests/unit/wordStatusStore*.test.ts`

**Estimated scope:** M

**AC:** SC-7 (`present␟verb` independent of `present`/`present␟noun`), SC-8 (term-only rows behave as before), SC-15 (aggregate with variant set → resolved statuses incl. implicit unknown; hot-path materialized-only approximation documented).

## Task 6: lookupOrchestrator variants

**Priority:** P0
**Depends on:** T1, T2, T5
**Parallel:** false
**Blocked strategy:** wait
**Worktree:** no

**Files likely touched:**
- `src/features/dictionaryPopup/logic/lookupOrchestrator.ts`
- `tests/` orchestrator tests

**Estimated scope:** M

**AC:** SC-4 (variants order = provider appearance; senses scoped), SC-9 (freq chips per list, pos-joined then term-fallback), SC-11 (freq `j` joins `adjective`), SC-12 (flat fields preserved → existing tests green), `other` bucket last (SC-14 logic).

## Task 7: Popup UI — PosVariantNav + accent toggle + swap

**Priority:** P0
**Depends on:** T6
**Parallel:** false
**Blocked strategy:** wait
**Worktree:** no

**Files likely touched:**
- `src/features/dictionaryPopup/ui/PosVariantNav.tsx` (new)
- `src/features/dictionaryPopup/ui/CandidateView.tsx` + `.module.css`
- `src/features/dictionaryPopup/logic/` (selection state, image re-query, card prefill, accent persistence via settings `lastUsedAccent[lang]`)
- `src/shared/i18n` en.json + vi.json (`dict.pos.*`, `dict.pos.other`)
- `tests/` UI unit tests

**Estimated scope:** L

**AC:** SC-5 (bar + full swap, no re-fetch), SC-6 (accent toggle, single-accent static), SC-13 (card prefill variant-scoped), SC-14 (`other` renders pos-less senses), SC-12 (single-POS popup identical to today).

## Task 8: Import smoke + canon docs

**Priority:** P1
**Depends on:** T3, T4, T6
**Parallel:** false
**Blocked strategy:** wait
**Worktree:** no

**Files likely touched:**
- `docs/2-architechture-system.md`, `docs/0-wiki.md`
- `docs/adr/` new ADR (per-POS status key + posNormalize)
- converted JSON output path for user import

**Estimated scope:** S

**AC:** SC-2 end-to-end import; DoD docs updated; converted files placed at agreed path with import instructions.

## Task 9: Gates + verify + ship

**Priority:** P0
**Depends on:** all
**Parallel:** false
**Blocked strategy:** wait
**Worktree:** no

**AC:** `npm run typecheck && npm run lint && npm run test:unit && npm run build` green (SC-10: no dict content in dist); real-Chrome verify + screenshots (POS bar, swap, accent toggle); fresh-context verify review → `docs/reviews/pos-dictionary-variants-verify.md` PASS; signoff; delete `src/entrypoints/mockup-pos-dictionary-variants/`; commit; `transition --to shipped`.

## Checkpoints

### After Tasks 1–2
- [ ] typecheck green; posNormalize + repo tests pass

### After Tasks 3–5
- [ ] converters run on real MDX → JSON verified (SC-1, SC-3 data side)
- [ ] status store tests pass

### After Tasks 6–7
- [ ] orchestrator + UI unit tests green; mockup-matching UI in real popup

### After Task 9
- [ ] all SC verified; ship
