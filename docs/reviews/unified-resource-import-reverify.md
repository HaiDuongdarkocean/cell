# Re-verify: unified-resource-import (post-ship, fresh-context)

Date: 2026-10-04 · Refs: `docs/specs/unified-resource-import.md`, ADR-115, verify artifact `unified-resource-import-verify.md`
Method: 4 parallel fresh-context read-only subagents vs actual code on `main` (HEAD `889af3a7`).

## SC matrix

| SC | Verdict | Note |
|---|---|---|
| SC-1 one dropzone | PASS | `ResourcesPanel.tsx:84-92`, one `ResourceSection`; old section copy keys dead |
| SC-2 format→components deterministic | **PARTIAL** | Code correct; per-format component assertions missing — `dictionaryComponents.test.ts` cited in artifacts does NOT exist |
| SC-3 sqlite schema-driven | PASS | union/fallback/ParseError all tested `sqliteStrategy.test.ts` |
| SC-4 unified store IO | PASS | 0 `STORES.FREQUENCY` refs; `kind:'freq'` stamped at write boundary; bounded cursors |
| SC-5 v13→v14 migration | PASS | fixture test covers data preservation; minor: `profileIds`/`wordCount` not asserted |
| SC-6 abort-safe/idempotent | PASS | deterministic mid-copy throw → replay without dupes (`baseRepository.test.ts:224-250`) |
| SC-7 dual-bank zip | **PARTIAL** | code correct; no test with both `term_bank_1`+`term_meta_bank_1` asserting `components` |
| SC-8 reorder single axis | PASS | `resourceRepository.ts:197-213`, panel sends merged flat ids |
| SC-9 disabledComponents gating | PASS | lookup merge + freq filter honor it; legacy fallback correct |
| SC-10 FREQUENCY_GET | **PARTIAL** | impl correct + cursor-bounded, but spec-mandated disabled/disabledComponents test missing; empty-allowed set doesn't early-return |
| SC-11 detached jobs + SW reconcile | PASS | durable registry + `sweepOrphanedWork` covers session-storage wipe |
| SC-12 portable byte-identical | PASS | `kind` added to STRIPPED_FIELDS; `backwardTerm` retained → parity |
| SC-13 old blob compat | PASS | deserialize unchanged; round-trip tested |
| SC-14 no resourceType branches | PASS | all remaining `type` checks are documented label/fallback sites |

## Defects confirmed (cross-lane corroborated)

| # | Severity | Defect | Where |
|---|---|---|---|
| A | **HIGH** | `JsonFrequencyStrategy.parse` lacks `isZip`/`unzipAll` — zipped json-frequency routes to it via `sniffZipFormat` → ParseError always | `jsonFrequencyStrategy.ts:42-54` vs siblings all unwrap |
| B | **HIGH** | `.txt.gz`/`.json.gz` >1MB → head gunzip throws → `detectByExtension` has no inner-map → "Could not detect format" on an accepted extension | `formatDetector.ts:28-42`, `fileDetector.ts:168-172` |
| C | **MEDIUM** (3 lanes independent) | Component chips toggleable during `uploading` but subset frozen at first chunk — flagship interaction silently inert | `ImportProgress.tsx:29` PICKER_LIVE; `resources.ts:362-374` meta captured once; `ResourcesPanel.tsx:534` narrowed frozen at runJob |
| D | MEDIUM | Multi-`.json` zip: only FIRST `.json` sniffed+parsed → silent partial import, no union | `formatDetector.ts:156` + same pattern per strategy |
| E | MEDIUM | Object-array `.json` failing all sniffs → falls back to `json-array` → quoted-string regex imports keys+values as frequency words (silent garbage) | `jsonArrayStrategy.ts:49-74` |
| F | MEDIUM-LOW | `RollbackError` path: suppressed error row + card stuck "importing" forever | `importJobTypes.ts:118-135` coverage match has no status filter |
| G | LOW | "Delete all" title counts mid-import resources it won't delete | `ResourcesPanel.tsx:836` vs `:765` |
| H | LOW | `RESOURCE_COMPONENTS` lazy-scan lacks `installationFinished` guard (latent) | `resources.ts:274-295` |
| I | LOW | `frequencyBand` skips `installationFinished` check → unfinished resource occupies priority slot | `tokenize/utils/frequencyBand.ts` |
| J | LOW | showcase mock missing `RESOURCE_SET_COMPONENTS` handler → chip persistence path untested there | `mockDictionary.ts:482-485` |
| K | LOW | empty `allowed` set in FREQUENCY_GET still opens cursor | `frequency.ts:44-45` |

## Cosmetic / cleanup

- Dead i18n keys `resources.dictionary.*`, `resources.frequency.*` (12/catalog)
- Stale suite labels `frequencyRepository`/`dictionaryRepository` in resourceEntryRepository tests
- `ResourceCard` re-implements chip instead of shared `Chip as="button"`; no `:focus-visible`
- `successTimers` ref, `deleteProgress` prop, 'success' status — dead code
- vi.json: `inflections`/`wordFamily` left English; `dropHint` lists ".db.gz" vs accept ".db,.gz"
- `importResourceBlob` trusts wire `type` instead of re-deriving (safe — derived label only)
- Pre-existing: `rankByTerm` vs `entriesToBand` pick different "best" freq rows (cueListTokens.ts:141)

## Blast radius (neighboring features)

No confirmed user-visible regressions. Legacy resources without `components` work via documented fallbacks. Sync blob byte-parity verified. Old-extension blobs round-trip. Popup `disabledComponents` gating tested. Latent inconsistencies noted (H, I, LOW-3/LOW-5 in agent report) all unreachable on current write paths.

## Verdict

**PASS with conditions.** All 14 SCs verified in code; 3 PARTIAL are missing mandated test proof, not wrong behavior. Ship-blocking candidates: defect **A** (route advertises format the strategy can't serve — every zipped json-frequency import fails) and **C** (flagship interaction inert during its main usable window). Defects B, D, E are silent-misroute class — spec explicitly forbids silent misrouting.

## Recommended follow-up batch (single fix commit + tests)

1. `JsonFrequencyStrategy`: add zip unwrap (match sibling strategies) + test zipped input
2. `formatDetector`/`detectByExtension`: map inner extensions for `.gz` beyond `.db` (txt/json) or document rejection honestly in `accept`
3. Chips: either restrict `PICKER_LIVE` to `queued` or read `selectedComponents` at final chunk / getter
4. SC-mandated tests: components assertion per format (create `dictionaryComponents.test.ts`), dual-bank zip test, FREQUENCY_GET disabled/disabledComponents test
5. `frequency.ts`: `if (allowed.size === 0)` early return
6. `importJobTypes` coverage match: exclude terminal-status jobs so failed imports re-surface the error row
7. Cleanup sweep: dead i18n keys, suite labels, `ResourceCard` → shared `Chip`
