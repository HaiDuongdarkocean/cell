# Todo — unified-resource-import

## Task 1: Types + schemas foundation

**Description:** Thêm `'frequency'` vào `DictionaryComponent` + `ComponentName` zod enum + `DICTIONARY_COMPONENTS`; định nghĩa stored-entry model (dict rows không kind, freq rows `kind:'freq'`); `resourceType` thành optional/dropped trên `ResourceImportChunkPayloadSchema`, `ResourceReorderPayloadSchema`, `ResourceSamplePayloadSchema`, `ResourceFindPayloadSchema`.

**Acceptance criteria:**
- [ ] `'frequency'` là DictionaryComponent hợp lệ end-to-end (type + zod + label map chỗ cần)
- [ ] Payload schemas không còn required `resourceType` (SC-14)
- [ ] typecheck green

**Verification:** `npm run typecheck`
**Dependencies:** None · **Priority:** P0 · **Parallel:** false (foundation)
**Files:** `src/entities/dictionary/types.ts`, `src/entities/dictionary/resourceSchemas.ts`
**Scope:** S

## Task 2: Unified entry repository + v14 migration

**Description:** Merge `dictionaryRepository`+`frequencyRepository` → một repo trên `STORES.ENTRY='langDictionaryEntry'`; dict queries lọc `kind!=='freq'`, freq queries lọc `kind==='freq'`; `DB_SCHEMA_VERSION` 13→14: cursor-copy `langFrequencyEntry` rows + stamp `kind:'freq'`, backfill `components=['frequency']` cho freq resources, drop store. Tests fake-indexeddb.

**Acceptance criteria:**
- [ ] Một repo duy nhất; không reference `STORES.FREQUENCY` trong src (SC-4)
- [ ] Migration v13→v14 giữ nguyên fields + idempotent + abort-safe (SC-5, SC-6)
- [ ] `phraseIndexRepository.test.ts` version pin bump 13→14
- [ ] Cursors `by_term`/`by_backwardTerm`/`by_resource` hoạt động trên unified store

**Verification:** migration + repo unit tests; `npm run test:unit`
**Dependencies:** Task 1 · **Priority:** P0 · **Parallel:** false
**Files:** `baseRepository.ts`, `dictionaryRepository.ts`, `frequencyRepository.ts` → `resourceEntryRepository.ts`, tests
**Scope:** L

## Task 3: Content → componentSet detection

**Description:** Map format→components (D1); zip: bank names presence (`term_bank`→definitions, `term_meta_bank`→frequency, union); sqlite: schema sniff `sqlite_master` tables→components; `detectComponents(head, name)` + authoritative full-bytes path ở SW.

**Acceptance criteria:**
- [ ] 7 format → componentSet deterministic (SC-2); `wordlist-json`→definitions (review fix)
- [ ] sqlite: dict/freq/both/none→ParseError (SC-3)
- [ ] Không ambiguity-prompt cần thiết

**Verification:** detector unit tests (zip fixtures, sqlite fixtures)
**Dependencies:** Task 1 · **Priority:** P0 · **Parallel:** false (shares types)
**Files:** `logic/formatDetector.ts` (+ new module nếu cần), tests
**Scope:** M

## Task 4: Strategy plumbing

**Description:** `createStrategy` bỏ `resourceType`; xóa `resolveFormat` hack; `TermBankStrategy` emit cả hai bank families một pass; `SqliteStrategy` schema-driven multi-table; `BaseFrequencyStrategy` component fold + `'frequency'`; strategies nhận optional component-subset (deselect override).

**Acceptance criteria:**
- [ ] Zip hai-bank → cả dict+freq rows, `components` union (SC-7); `wordCount` tổng
- [ ] `json-array` luôn freq-content (không `resolveFormat` hack)
- [ ] Component deselect lọc emission đúng loại
- [ ] `ParseError` khi bank/table kỳ vọng vắng (message giữ nguyên)

**Verification:** strategy tests (mixed zip, sqlite both-table, subset filter)
**Dependencies:** Tasks 2, 3 · **Priority:** P0 · **Parallel:** false
**Files:** `strategyFactory.ts`, `termBankStrategy.ts`, `sqliteStrategy.ts`, `baseImportStrategy.ts`, tests
**Scope:** L

## Task 5: Import path sans type

**Description:** `importFile`/orchestrator bỏ `resourceType`; `ImportChunkMeta` + job params bỏ type; handlers `resources.ts` SAMPLE/FIND/REORDER type-free; `resourceClient.importResourceFile` signature mới (+ detectedComponents + subset override); `devSeed` detect từ file.

**Acceptance criteria:**
- [ ] `importFile` không nhận resourceType; chunk schema parse được payload mới
- [ ] `reorderResources` không filter type — priority 0..n toàn bộ resources (SC-8)
- [ ] Job params gọn; `buildPendingImports` vẫn dedupe đúng
- [ ] Phrase-index gate `format==='json-entries'` (không còn type check — `importOrchestrator.ts:108`)

**Verification:** handler-level tests nếu có; typecheck; manual smoke ở Task 9
**Dependencies:** Tasks 2–4 · **Priority:** P0 · **Parallel:** false
**Files:** `logic/importOrchestrator.ts`, `services/resourceClient.ts`, `entrypoints/background/handlers/resources.ts`, `devSeed*`, `resourceRepository.ts` reorder
**Scope:** M

## Task 6: FREQUENCY_GET gate + projection

**Description:** Handler load resource map (enabled + components có 'frequency' + không disabledComponents + installationFinished), query `findFreqByTerms` (kind='freq' + resourceIds), project → `FrequencyEntry` wire shape.

**Acceptance criteria:**
- [ ] Wire response `Map<term, FrequencyEntry[]>` shape y hệt (SC-10)
- [ ] Disabled/'frequency'-disabled resources không đóng góp (delta mới, test chứng minh)
- [ ] Cursor jump-bounded, không getAll

**Verification:** parity unit test seeded dataset + disabled-exclusion test
**Dependencies:** Task 2 · **Priority:** P0 · **Parallel:** false
**Files:** `entrypoints/background/handlers/frequency.ts`, repo query fn
**Scope:** M

## Task 7: Lookup components-derived filters

**Description:** `lookupOrchestrator`: `dictionaryResources` = components 'definitions' (fallback type cho rows chưa migrate); freq-side gating components 'frequency' trong allowedResourceIds/popup path.

**Acceptance criteria:**
- [ ] Lookup kết quả không đổi cho dataset parity; freq-disabled resource không góp rank trong popup (SC-9)
- [ ] Không nhánh `type ===` trong hot path (SC-14)

**Verification:** existing lookup tests + new disabled-component case
**Dependencies:** Tasks 2, 6 · **Priority:** P0 · **Parallel:** false
**Files:** `dictionaryPopup/logic/lookupOrchestrator.ts`, resourceContext
**Scope:** S

## Task 8: Sync parity

**Description:** `serializeResourcePortable` partition theo kind (bytes identical); `STRIPPED_FIELDS` += 'kind'; `ensureResourceContentHash` đọc một store; `importResourceBlob` derive components + `wordCount=dict+freq`; `dictLocalSource` applyStores/readStores một store, phrase-index rebuild gate → components/format-derived; `toResourceMeta` type derived.

**Acceptance criteria:**
- [ ] Serialize bytes identical cùng input (SC-12); contentHash ổn định sau migration
- [ ] Blob version cũ import được (SC-13); synced resource có components đúng (không dead `[]`)
- [ ] `dictLocalSource.ts:349` wordCount = dictRows+freqRows

**Verification:** portable round-trip test; dictLocalSource tests
**Dependencies:** Task 2 · **Priority:** P0 · **Parallel:** false
**Files:** `sync/resourceIdentity.ts`, `sync/dictLocalSource.ts`, tests
**Scope:** M

## Task 9: Unified panel UI

**Description:** ResourcesPanel một section (`resources.unified.*`, `sectionId='resources'`); `handleFiles` bỏ type + panel-side detect badge (async detectFormat head); `ImportJob.detectedComponents`; `ImportProgress` KindBadge (`Badge`+`Icon`) + `Chip` picker multi-component → subset vào chunk payload; `ResourceCard` bỏ `isDict` gate chips + `'frequency'` label; delete copy noun "tài nguyên"; i18n en+vi.

**Acceptance criteria:**
- [ ] SC-1: một dropzone, một job row/file, badge trước upload; không section FREQUENCY
- [ ] Multi-component → chips deselect; lựa chọn vào payload (REQ-2 override)
- [ ] File xong → card vào list ngay (live, user requirement)
- [ ] a11y (aria-pressed chips, badge text) + i18n đủ en/vi
- [ ] `resources.edit.selectAll`... flows giữ nguyên

**Verification:** `ResourcesPanel.test.tsx` rewrite; typecheck; browser verify Task 11
**Dependencies:** Tasks 1–6 · **Priority:** P0 · **Parallel:** false
**Files:** `ResourcesPanel.tsx`, `ImportProgress.tsx`, `ResourceCard.tsx`, `importJobTypes.ts`, `importJobTypes.test?`, `en.json`, `vi.json`, css
**Scope:** L

## Task 10: Sweep + test fixes

**Description:** Grep-gate `resourceType`/`type === '(DICTIONARY|FREQUENCY)'`: mỗi site đổi components-check/xóa/derived-label; update tests cũ (strategy tests, orchestrator tests, repo tests, e2e helpers, version pins); `resources.ts:281` lazy-scan + `[]` truthy pitfall (synced resource components=[] phải re-scan).

**Acceptance criteria:**
- [ ] SC-14 grep-gate clean
- [ ] `npm run test:unit` green toàn bộ
- [ ] components=[] resource vẫn được lazy-scan (không short-circuit dead)

**Verification:** `npm run test:unit`; grep output rỗng
**Dependencies:** Tasks 1–9 · **Priority:** P0 · **Parallel:** false
**Files:** sweep across ~41 files
**Scope:** M

## Task 11: Docs + cleanup + gates

**Description:** `docs/2-architechture-system.md` update; ADR mới (unified store + kind asymmetry + derived type); `docs/0-wiki.md` changelog; xóa `src/entrypoints/mockup-unified-resource-import/`; gates: typecheck, lint, test:unit, build; browser verify panel + import flow (screenshots before/after); verify review subagent → `-verify.md`; sign-off.

**Acceptance criteria:**
- [ ] 4 gates green; visual evidence panel mới
- [ ] ADR + arch doc + wiki updated
- [ ] `docs/reviews/unified-resource-import-verify.md` PASS

**Verification:** transition --to shipped exits 0
**Dependencies:** Tasks 1–10 · **Priority:** P0 · **Parallel:** false
**Scope:** M
