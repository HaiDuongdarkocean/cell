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

## Hardening batch — resolved (2026-10-04)

All recommended fixes landed; gates re-run on the batch (typecheck + lint + 674 suites / 7958 tests + build + showcase e2e 4/4):

- **A** — `JsonFrequencyStrategy` unwraps zip via `selectZipDataJson` (matches siblings); `jsonFrequencyStrategy.test.ts` covers zip/gz/raw/ambiguity/non-array.
- **B** — `detectByExtension` maps `.gz` inner extensions (`txt`/`json`/`zip`); orchestrator gunzips the full file and re-detects by inner name, so >1MB `.txt.gz`/`.json.gz` import correctly. Detector + orchestrator tests cover truncated heads and end-to-end gz import.
- **C** — Live narrowing: `ImportCallbacks.getComponents` is invoked per upload chunk; the SW keeps the latest per-chunk `components` and hands it to the executor. `resources.test.ts` proves the last chunk's selection wins; `ResourcesPanel.test.tsx` proves narrowing reaches `getComponents`.
- **D+E** — `selectZipDataJson` content-verifies every data-shaped `.json`; >1 match or >1 `.txt` → `ParseError` naming the fix ("import them one at a time"). `jsonArrayStrategy` validates the full text is a JSON array of strings (residue `[]` check) — object keys no longer import as terms.
- **F** — `buildPendingImports` requires `!isTerminalJob` for coverage; failed/interrupted jobs render as their own rows again (`importJobTypes.test.ts`).
- **G–K + small** — FREQUENCY_GET early-returns when no resource is eligible (no cursor opened); `RESOURCE_COMPONENTS` and `frequencyBand` gate on `installationFinished`; `dictLocalSource` derives `components`+`type` from imported rows; showcase mock handles `RESOURCE_SET_COMPONENTS`/`RESOURCE_COMPONENTS` with a persistent `resourceOverrides` layer.
- **Cleanup** — `ResourceCard` chips use shared `Chip` (custom css deleted); last selected chip disabled with reason title; delete-all counts finished resources only; 12 dead i18n keys removed, `dropHint` lists real accepted extensions, `inflections`/`wordFamily` translated in vi; suite labels renamed to `resourceEntryRepository`.
- **Tests added** — `dictionaryComponents.test.ts` (SC-2), dual-bank zip components, FREQUENCY_GET gating (disabled/disabledComponents/unfinished/legacy fallback + early return), sync blob derive (`components`+`type` incl. FREQUENCY-only), e2e chip persistence across section remount.
- **Foreign fix** — `defEntry.test.ts` fixture updated to `{count, source}` (broken at HEAD by `abea89b4`).

Remaining known (accepted): pre-existing `rankByTerm`/`entriesToBand` divergence; latent inconsistencies noted in lane reports remain unreachable on current write paths.

## Round 3 — live-flow verification (2026-10-05)

User-driven re-verify: 3 fresh subagent lanes (SC-1..7, SC-8..14 + blast radius, flow/UI-UX audit) plus a new live-flow e2e lane with screenshot evidence. Verdict: **all 14 SCs PASS**; no user-visible regression in popup, tokenize/frequency-band, sync, FREQUENCY_GET, resource ops, or legacy resources. The open section updates **in place** at every stage — no leave/re-enter needed: local upload row → registry job row → in-place importing card → finished card + visible Alert.

Fixed in this round:

- **Live-flow UX** (`21b9ee93`) — import completion/failure shows a visible `Alert` (previously sr-only announce); `ImportJob.langCode` added so registry jobs filter per panel language and `runJob` cannot misroute after a profile switch; job rows dedupe against registry `signature` and skip signatures already in the resource list; skipped-duplicate rows get dismiss; upload with zero acked chunks shows "Preparing…" instead of a false 0%; mixed-kind zip (json data + word list) fails with a clear one-at-a-time `ParseError`.
- **Stage2 e2e blast radius** — six specs hardcoded `DB_SCHEMA_VERSION = 12` without the `existing?.version` bump guard: once the app opened the DB at v14, seeding threw `VersionError`, and `immersion-playback` also transacted the removed `langFrequencyEntry` store (`NotFoundError`). All six now probe `indexedDB.databases()` first; `immersion-playback` seeds freq rows into `langDictionaryEntry` with `kind:'freq'` + `components` on resources when the legacy store is gone. Verified live: `immersion-playback` 5/5, `popup-status-keys` seed resolves the popup at v14.
- **Polish** — `deserializeResourcePortable` emits the friendly 'corrupt portable resource blob' error for malformed/1-char lines (was raw `SyntaxError`); `jsonArrayStrategy` throws `ParseError` on a malformed string instead of silently skipping it (also fixes inflated `reportTotal`); stale test name fixed.

Evidence: `tmp/unified-resource-import/` — `10-uploading-row.png` (local row + live chips), `11-importing-card.png` (resource card mid-import in place), `12-done-card.png` (finished card + success alert, same mount), `13-live-chips.png`, `14-narrowed-card.png` (queued narrowing lands definitions-only), `15-error-row.png` (failed import keeps retry/dismiss row). Showcase e2e 7/7; unit gates re-run on HEAD.

Residual (accepted): `popup-status-keys` has 2 pre-existing stale assertions unrelated to this feature (badge text capitalized since `6be1fd87`; `CueRecommendFab` migrated to shared `Menu` at `b5abd84f`); `disabledComponents:['frequency']` inside the lookup merge lacks a dedicated test — covered by the eligibility predicate and `frequency.test.ts` handler tests.
