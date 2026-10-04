# Spec Review — unified-resource-import

Verdict: APPROVE_WITH_CHANGES — spec is technically convergent with the codebase (all cited line refs verified), but contains one wrong-requirement blocker and several majors that must be edited before DELIVER.

*(Reviewed spec against `docs/intent/unified-resource-import.md` + verified every cited claim against source.)*

## Findings

### Blocker

1. [§Data D1] [BA/TL]: Format→componentSet map assigns `wordlist-json → {frequency}`. Wrong: `WordlistJsonStrategy` extends `BaseDictionaryStrategy` and bulk-inserts **dictionary** entries whose `definition` = comma-joined tags (wordlistJsonStrategy.ts:4-6,19,61-63 — "Stored as DICTIONARY entries… lookups surface 'N5'/'HSK 3'"). Mapping it to `{frequency}` makes the resource invisible to `dictionaryResources`-derived gating → its entries never serve lookups = silent misroute (violates the spec's own `Never: silent misroute` boundary). Fix: `wordlist-json → {definitions}`.

### Major

2. [REQ-1/SC-1 vs intent Workflow + Draft AC + Scope "badge + override khi sai"] [BA]: Spec silently drops the **badge-override affordance**. Intent requires user can edit the detected-kind badge before upload when detection is wrong. A deterministic-but-wrong detection is then **uncorrectable**: re-dropping yields the same detection, delete+reimport doesn't help. Fix: add an override requirement OR record an explicit accepted-deviation in Open Questions with mitigation.
3. [REQ-9 Rules] [TL]: "`kind`/`backwardTerm` strip khi serialize như `id`/`resourceId`" is factually wrong. `STRIPPED_FIELDS` (resourceIdentity.ts:6) contains only `id`/`resourceId`; `backwardTerm` **is serialized today** on both d- and f-lines (dictionaryRepository.ts:11,18 / frequencyRepository.ts:12,19). Stripping it changes blob bytes → breaks SC-12 byte-identical + NFR-5 contentHash stability. Fix: strip only `kind`; `backwardTerm` must remain serialized.
4. [REQ-7/SC-10] [PO/TL]: Spec claims `FREQUENCY_GET` gates by enabled/components while asserting parity. But the current handler has **no resource gate at all** — frequency.ts:28 calls `findFrequencyByTerms` directly; disabled resources leak rank today. The gate is a behavior change (arguably a bug fix). Fix: acknowledge the delta; scope byte-identical claims to enabled-only fixtures; add disabled-exclusion assertion.
5. [REQ-9 — missing requirement] [TL]: Sync blob import never computes `components`. `dictLocalSource.writeRemote` seeds `components: existing?.components ?? []` (dictLocalSource.ts:276) and `importResourceBlob` only restores `installationFinished`/`wordCount` (line 344-352). Under components-as-SSOT gating, a synced resource lands with `components=[]` → dead resource (and `[]` is truthy → lazy `RESOURCE_COMPONENTS` scan short-circuits, resources.ts:281). Fix: `importResourceBlob` derives components from deserialized rows.
6. [REQ-9/REQ-10 — missed call-sites] [TL]: `dictLocalSource.ts:349` sets `wordCount: dictRows.length` → must become `dictRows.length + freqRows.length`. Also `resourceIdentity.ts:56-62` (`ensureResourceContentHash` reads both stores) and `ResourcesPanel.tsx:753-758` (`j.params.resourceType` section filter) are unlisted call-sites.

### Minor

7. [REQ-4/NFR-5] [PO]: `phraseIndexRepository.test.ts:56` pins `expect(DB_SCHEMA_VERSION).toBe(13)` — must bump to 14; add to DoD.
8. [REQ-3] [TL]: `INDEXES.by_type` on `langResourceInfo` survives type-elimination — note retention (wire/derived-label) or removal decision.
9. [REQ-3] [TL]: `collectEntryComponents`/`collectComponents` hook only exists on `BaseDictionaryStrategy` (baseImportStrategy.ts:176-184); `BaseFrequencyStrategy` collects nothing — kind-aware component fold is new code, spec should say so.
10. [REQ-1] [PO]: "detected-kind badge" UX — pin badge states + i18n keys so design/deliver doesn't improvise.
11. [Boundaries] [TL]: `Never: đọc/ghi langFrequencyEntry sau v14` collides in name with the **sqlite source table** `langFrequencyEntry` (sqliteStrategy.ts:144 — external file schema). Reword to "IDB object store".

## Missing requirements (vs intent)

- Badge/kind override before upload — Finding 2.
- `importResourceBlob` components derivation for synced resources — Finding 5.
- `wordCount` update on sync-apply path — Finding 6.

## Wrong technical assumptions

- `wordlist-json → {frequency}` — it emits dict entries (Finding 1).
- `backwardTerm` is already stripped at serialize — it isn't; only id/resourceId are (Finding 3).
- `FREQUENCY_GET` already gates by enabled resources — it doesn't (Finding 4).
- Component fold is "generic sẵn" — only transform/flush are; freq strategies collect no components (Finding 9).

## Verified claims (no action)

- `formatDetector.ts` magic/zip/JSON sniff ✓; `resolveFormat` hack + `createStrategy(resourceType)` ✓ (strategyFactory.ts:31-33,46-50); termBank/sqlite bank/table selection by resourceType ✓; `DB_SCHEMA_VERSION=13` + identical store shapes ✓ (baseRepository.ts:10,104-116); repo mirror pair ✓; `d`/`f` portable lines + contentHash covering both ✓; `toResourceMeta.type` + applyStores ✓; `resourceType` required in chunk schema + reorder/sample/find ✓; popup allowedResourceIds + lowest-rank merge ✓ (lookupOrchestrator.ts:224,582-588,801-813); cited line refs 341/224/296-319 all exact ✓; v14 versionchange-tx copy+drop is legal IDB (abort rolls back store ops → idempotent claim sound) ✓; fake-indexeddb is the established repo test approach ✓; keep-physical-name `langDictionaryEntry` tradeoff is sound (avoids ~500k-row copy; symbol rename only) ✓.

## Lens summary

- BA: Intent traceability is strong (all N1–N10 + journey steps mapped), but the approved badge-override need was silently dropped.
- PO: SCs are mostly falsifiable; SC-10's "byte-identical" collides with the new resource gate; badge states/component labels need concrete specs.
- TL: Architecture is sound and heavily verified against real code; fixes needed are surgical — wrong D1 entry, wrong strip-list, missing components-derivation on sync import, missed wordCount/type-filter call-sites.

## Action items

1. Fix D1 map `wordlist-json` → `{definitions}` — spec §Data
2. Decide badge override: add REQ or record accepted deviation — spec REQ-1/REQ-2/Open Questions
3. Correct REQ-9 strip rule (kind only) + add components/wordCount derivation on blob import — spec REQ-9
4. Rewrite SC-10 parity scope + acknowledge FREQUENCY_GET gate delta — spec SC-10/REQ-7
5. Add missed call-sites to sweep list (dictLocalSource:349, resourceIdentity:56-62, ResourcesPanel:753-758, version-pin test) — spec REQ-10/DoD

## Risks chấp nhận

- Migration copy time inside versionchange tx blocks lang-DB opens — revisit at DELIVER perf measurement on largest fixture (>vài giây → reconsider progress surfacing).
- `kind`-stamp asymmetry + retained `type` field/physical store name — revisit if a future dev re-introduces type branching (ADR + lint note planned).
- `json-entries`/`json-frequency` head-heuristic false positives — revisit when override affordance decision lands.

VERDICT: APPROVE_WITH_CHANGES

---

## Resolution (post-review spec edits)

All action items addressed in `docs/specs/unified-resource-import.md`:

- **Item 1 → done**: D1 map corrected — `wordlist-json` grouped with `json-entries → {definitions…}` (its strategy extends `BaseDictionaryStrategy`).
- **Item 2 → done**: REQ-2 alt flow adds component deselect for multi-component files before upload (the implementable half of badge-override); single-component misdetection recorded as deliberate deviation in Open Questions — rows are what they are, escape hatch = clear error + delete + reimport.
- **Item 3 → done**: REQ-9 rules corrected — `STRIPPED_FIELDS` only gains `kind`; `backwardTerm` stays serialized (byte-parity preserved); `importResourceBlob` now required to derive `components` + `wordCount = dictRows+freqRows`; `ensureResourceContentHash` touch-point listed.
- **Item 4 → done**: REQ-7/SC-10 acknowledge the enabled/components gate as intentional bug-fix delta; byte-identical scoped to all-enabled fixtures; disabled-exclusion assertion added.
- **Item 5 → done**: call-sites added (`dictLocalSource.ts:349`, `resourceIdentity.ts:56-62`, `ResourcesPanel.tsx:753-758`, `importOrchestrator.ts:108`, `resourceRepository.ts:196-212`); version-pin test bump added to DoD.
- **Minors**: `by_type` retention noted (REQ-3); component fold flagged as new code (REQ-3); badge states + i18n keys pinned (REQ-1 rules); "IDB object store" wording clarified (Boundaries).
