# Verify: unified-resource-import

Fresh-context adversarial review of the implementation against `docs/specs/unified-resource-import.md` Success Criteria (SC-1..SC-14). Two passes: initial FAIL with three findings, fixes re-verified at HEAD `b4c69342` (+ cosmetic follow-ups).

## Pass 1 — findings (all since resolved)

| # | Finding | Severity | Resolution | Evidence |
|---|---|---|---|---|
| B1 | Panel always transmitted `components`, so head-limited detection (1MB) could silently drop the frequency family from large mixed ZIPs / hard-fail freq-only zips | Blocker | Panel sends the subset only when the user narrows detection; un-narrowed jobs send `undefined` → strategy stays authoritative | `ResourcesPanel.tsx:534-540` (`narrowedComponents`), invariant `selected ⊆ detected` via `handleToggleComponent` last-chip guard; wire path `resourceClient.ts:211` → `resources.ts:118` → `importOrchestrator.ts:99`; tests `ResourcesPanel.test.tsx:149-196` |
| — | `frequencyBand.ts` branched on `ResourceInfo.type` (SC-14) | Major | Shared `resourceOffersComponent` — components-first, legacy `type==='FREQUENCY'` fallback only when `components` absent, honors `disabledComponents` | `dictionaryComponents.ts:71-79`; callers `handlers/frequency.ts:22-29`, `frequencyBand.ts:34` (semantic parity, no unrelated `installationFinished` gate added) |
| — | No genuine v13→v14 migration / abort-safety tests (SC-5/SC-6) | Major | Real v13 fixture (`indexedDB.open(name, 13)`), rows move with `kind:'freq'`, resource backfill, abort mid-upgrade → stays v13 → replay without duplicates | `baseRepository.test.ts:154-262` |

## SC walkthrough (pass 2)

- **SC-1** one section/dropzone/flat list — `ResourcesPanel.tsx` single `<Dropzone>`; e2e `showcase-unified-resources.spec.ts` asserts 1 list + 1 input + 4 flat cards.
- **SC-2/SC-3** deterministic format→componentSet; sqlite table-name sniff incl. legacy `entries`; strategy-authoritative emit — `formatDetector.ts`, `sqliteStrategy.ts`, `termBankStrategy.ts` + suites.
- **SC-4** all entry IO via `STORES.ENTRY`; 0 `STORES.FREQUENCY` refs; `kind:'freq'` discriminator — `resourceEntryRepository.ts`.
- **SC-5/SC-6** migration tests above; atomic versionchange tx, abort-safe replay.
- **SC-7** mixed zip → one resource, both families, `wordCount` = sum — `termBankStrategy` partition in `flushBatch`; suite asserts.
- **SC-8/SC-9/SC-10** type-free `RESOURCE_REORDER` 0..n; `disabledComponents` honored in lookup merge (`lookupOrchestrator.ts:600-601`) and `FREQUENCY_GET` allowed-ids; cursor-bounded queries.
- **SC-11** registry job + importing card handoff (`importJobTypes.buildPendingImports`) — panel-close continues in SW.
- **SC-12/SC-13** portable `{d,f}` rows partitioned by `kind`, `contentHash` unchanged; `importResourceBlob` derives components + wordCount — sync suites.
- **SC-14** remaining `type ===` sites are only legacy-row fallbacks (`dictionaryComponents.ts:76`, `lookupOrchestrator.ts:227` documented, `baseRepository.ts:109` the migration itself) or display labels.
- Showcase mock parity (`mockDictionary.ts`): chunks accumulated per jobId, real `detectComponents` on reassembled bytes, `deriveResourceType` label — same contract as production.

## Gates at verify HEAD

typecheck PASS · lint PASS (0 errors; 6 pre-existing srs warnings) · test:unit PASS 670/7912 · build PASS · showcase e2e 4/4 PASS (screenshots `tmp/unified-resource-import/`).

## Residual minors (cosmetic, fixed post-review)

1. `resourceOffersComponent` legacy fallback is frequency-only — now documented on the helper.
2. Stale describe labels in `baseRepository.test.ts` — renamed.
3. Showcase mock `format` labels used `json-array` for dictionaries — corrected to `json-entries`.

VERDICT: PASS
