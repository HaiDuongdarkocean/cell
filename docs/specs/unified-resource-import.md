# Spec: Unified Resource Import — một điểm import, một entry-store, components suy từ nội dung

> Intent: `docs/intent/unified-resource-import.md` · ui_surface: yes · Mode: interactive

## Objective

Một điểm import duy nhất nhận mọi định dạng resource đã hỗ trợ; hệ thống tự suy ra file chứa component nào từ nội dung (không hỏi user); mọi entry — kể cả frequency rows — nằm trong một object-store theo kiến trúc dictionary-entry; `resourceType` do user khai báo bị loại bỏ khỏi pipeline, thay bằng `ResourceInfo.components` suy từ nội dung; dữ liệu user hiện có được migrate nguyên vẹn ở schema v14; hành vi lookup/tokenize/sync giữ nguyên.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner (panel user) | Thả/chọn file vào dropzone; kéo reorder; toggle enable/component; sửa badge | File(s), thứ tự mới, quyết định ở duplicate-prompt | Detected-kind badge, progress, resource cards một danh sách, error rõ ràng |
| Content script (tokenize/subtitle) | Tra rank theo term batch | `FREQUENCY_GET {langCode, terms}` | `Map<term, FrequencyEntry[]>` (wire shape giữ nguyên) |
| Dictionary popup | Lookup term | term + langCode | LookupResult giữ nguyên semantics |
| Sync engine | apply remote resource records/blobs | ChangeRecord, blob bytes | Resource + entries materialize local |
| JobRegistry (SW) | start/reconcile import+delete jobs | job params + file bytes | progress/done/interrupted |
| Dev seed | seed dev resources | file paths | resources import được |

System-internal: detect/sniff, strategy parse, store write, migration, merge, index build — không chứa hành vi người dùng.

## Requirements

### Functional

REQ-1: Unified import entry
- Actor: Learner
- Goal: Nạp bất kỳ file resource nào từ một dropzone duy nhất.
- Preconditions: ResourcesPanel mở với langCode hợp lệ.
- Basic flow:
  1. actor thả/chọn 1+ file
  2. system validate ext (union `.txt,.json,.zip,.db,.gz`), size ≤ `MAX_FILE_SIZE`, signature dedupe trong queue
  3. system tạo 1 job row/file (queued) và hiển thị detected-kind badge
  4. system upload theo chunked FIFO scheduler (`MAX_CONCURRENT_IMPORTS=2`, `MAX_INFLIGHT_BYTES`) vào JobRegistry
  5. system import detached ở SW; resource card hiện đúng components khi xong
- Alt flow: file duplicate signature → parked duplicate prompt (giữ nguyên); skipped row → "Thay thế" rerun (giữ nguyên); file multi-component → job row hiển thị đủ components và actor deselect được component trước upload (xem REQ-2 alt flow).
- Exception: ext/size/signature fail → error row ngay, không chiếm scheduler slot; detect fail → error row với lý do `resources.error.detect` (i18n mới); upload stall >30s → interrupted (giữ nguyên).
- Rules: một file = một job row; không silent skip ngoài duplicate-prompt; badge mang tính best-effort — SW detect authoritative trên full bytes; badge states: tên component(s) detect được (`definitions`, `frequency`, cả hai), `SQLite — detecting` cho sqlite chưa sniff được ở panel, `unknown → error` cho detect fail — mỗi state một i18n key (`resources.badge.*`).
- Postcondition: resource row `installationFinished=true` với `components` đầy đủ, entries trong unified store.
- NFR refs: NFR-1, NFR-2, NFR-4

REQ-2: Content-derived component detection
- Actor: system (panel-side sniff cho badge; SW-side authoritative cho import)
- Goal: Suy ra `(format, componentSet)` của file từ bytes, không cần `resourceType` khai báo.
- Basic flow:
  1. system đọc head 1MB (+ filename) → `detectFormat` hiện có → ImportFormat
  2. system map format → componentSet theo bảng D1 (mục Data)
  3. system hiển thị badge ở panel / dùng componentSet ở orchestrator
- Alt flow: zip >1MB head → 'term-bank' fallback, SW re-sniff full bytes (giữ nguyên cơ chế `sniffZipFormat`); sqlite → schema-sniff `sqlite_master` (tables present) chọn componentSet; zip/sqlite chứa nhiều loại nội dung → union componentSet. **Override**: với file multi-component, job row hiển thị checklist components → actor deselect component không muốn nạp trước khi upload (vd zip hai-bank chỉ muốn dictionary) — lựa chọn truyền qua chunk payload và strategy chỉ emit loại được chọn; single-component file không có gì để chọn (override là no-op theo thiết kế).
- Exception: format không detect → `Could not detect format` error (giữ nguyên); sqlite không có table nào khớp schema → `ParseError` rõ tên thiếu.
- Rules: detection deterministic — mọi format hiện hỗ trợ quyết được bằng content; **không có ambiguity-prompt** (không format nào cần user phân loại — deviation được ghi ở Open Questions: detect-sai-do-content thì error row + delete+reimport là escape hatch, không có nút "đổi loại" vì rows là gì thì là đó); `resolveFormat` hack (`json-array`+DICTIONARY→`json-entries`) bị xóa — `json-array` luôn là frequency-content.
- Postcondition: `importFile` không nhận `resourceType`; resource.components = componentSet thực có.
- NFR refs: NFR-3

REQ-3: Unified entry store
- Actor: system
- Goal: Mọi entry (dict-shape lẫn freq-shape) nằm trong một object-store, query phân biệt bằng `kind` stamp.
- Basic flow:
  1. system ghi dict entries (shape `DictionaryEntry` hiện có, `kind` absent) vào `STORES.ENTRY` (tên vật lý giữ `langDictionaryEntry` — không đổi tên store, chỉ rename symbol)
  2. system ghi freq entries (shape `FrequencyEntry` + `kind:'freq'` + `backwardTerm`) vào cùng store
  3. system query dict-side lọc `kind !== 'freq'`; query freq-side lọc `kind === 'freq'`
- Alt flow: none.
- Exception: none bổ sung (IDB errors lan truyền như hiện nay).
- Rules: `frequency` trở thành `DictionaryComponent` mới — `collectEntryComponents` thêm khi row có freq payload (component fold này là code mới — hiện chỉ `BaseDictionaryStrategy` collect; freq strategies chưa collect gì); `FrequencyEntry` wire shape giữ nguyên (backwardTerm/kind là internal); một repository duy nhất thay cặp mirror (`resourceEntryRepository`); `findDictionaryByTerm/Prefix/Suffix` lọc `kind!=='freq'`; `findFreqByTerms/ByResource/...` lọc `kind==='freq'`; `backwardTerm` giữ trên cả hai shape (index chung); `INDEXES.by_type` trên `langResourceInfo` giữ nguyên (phục vụ derived label/wire).
- Postcondition: `STORES.FREQUENCY` không còn được ghi; mọi read/write entry qua một repo.
- NFR refs: NFR-1, NFR-3, NFR-5

REQ-4: Schema v14 migration
- Actor: system (IDB upgrade on open)
- Goal: Dời toàn bộ `langFrequencyEntry` rows sang unified store, stamp `kind:'freq'`, backfill `components`/`type` trên resource rows, drop store cũ — không mất dữ liệu.
- Basic flow:
  1. system open DB v14 → `onupgradeneeded` chạy trong versionchange tx
  2. system cursor-copy từng freq row → put vào `langDictionaryEntry` với `kind:'freq'` (giữ nguyên mọi field khác; autoIncrement id mới chấp nhận được — id không phải identity bền)
  3. system update từng resource row: `type==='FREQUENCY'` → `components=['frequency']` (merge nếu đã có); type giữ nguyên giá trị cũ làm derived label
  4. system `deleteObjectStore('langFrequencyEntry')`
- Alt flow: DB mới tinh → create-all path tạo đúng schema v14 (không có freq store).
- Exception: copy gián đoạn → versionchange tx abort → DB giữ v13, lần open sau chạy lại (idempotent vì freq store chưa drop khi abort).
- Rules: migration chạy một lần per DB per lang; không chạm dict rows (không stamp `kind` cho chúng — absent = dict); `contentHash`/`signature`/`enabled`/`priority`/`profileIds`/`disabledComponents`/`importedAt`/`wordCount` giữ nguyên; test helpers resolve live `DB_SCHEMA_VERSION` (lesson `e2e-idb-seed-version-drift`).
- Postcondition: không store nào tên `langFrequencyEntry`; mọi freq data đọc được qua query `kind==='freq'`.
- NFR refs: NFR-1, NFR-5

REQ-5: Multi-component strategy emission
- Actor: system
- Goal: Một strategy run emit được nhiều loại entry khi file chứa nhiều nội dung; resource ghi nhận đủ components.
- Basic flow:
  1. term-bank strategy parse `term_bank_*` → dict entries VÀ `term_meta_bank_*` (type 'freq') → freq entries trong cùng một pass
  2. sqlite strategy parse bảng `langResourceEntry` (dict) và/hoặc `langFrequencyEntry`/`entries` (freq) theo bảng hiện có
  3. system ghi hai loại rows vào unified store, `components` = union
- Alt flow: file chỉ một loại nội dung → y như hiện nay; `wordCount` = tổng entries mọi kind.
- Exception: bank/table kỳ vọng vắng → `ParseError` rõ (giữ message hiện có); meta bank có nhưng zero 'freq' rows → không thêm 'frequency' vào components.
- Rules: `BaseImportStrategy` giữ template `execute()`; `transformEntry`/`flushBatch` xử lý union raw types (đã generic sẵn); batch flush ghi một store; `components()` fold cả hai loại entry.
- Postcondition: zip hai-bank → resource `components` chứa cả `definitions` và `frequency`.
- NFR refs: NFR-1, NFR-3

REQ-6: Unified resource list + single priority axis
- Actor: Learner
- Goal: Quản mọi resource trong một danh sách duy nhất với một trục priority.
- Basic flow:
  1. actor mở ResourcesPanel → một section một danh sách, mỗi card hiển thị components của resource
  2. actor kéo-reorder → system ghi `priority` 0..n theo thứ tự danh sách chung (`RESOURCE_REORDER` bỏ `resourceType`; `reorderResources` không filter type)
  3. actor toggle enabled / disabledComponents như hiện nay (freq resource tự có toggle 'frequency')
- Alt flow: none.
- Exception: reorder payload lạ → zod reject (giữ nguyên).
- Rules: merge semantics giữ nguyên — priority quyết component nào của resource nào thắng; `sortByPriority` hiện có là SSOT; lookup `dictionaryResources` = resources có component 'definitions' (fallback `type==='DICTIONARY'` cho row chưa migrate); freq-capable = component 'frequency' và không bị `disabledComponents` chặn.
- Postcondition: `ResourceInfo.priority` là một trục duy nhất cho cả defs lẫn freq merge.
- NFR refs: NFR-4

REQ-7: Frequency query parity + resource gate
- Actor: content script, dictionary popup
- Goal: `FREQUENCY_GET` trả wire shape `FrequencyEntry[]` y hệt, chỉ từ resources enabled + không disable component 'frequency'.
- Basic flow:
  1. actor gửi `FREQUENCY_GET {langCode, terms}` (chunks ≤500 giữ nguyên)
  2. system load resource map (enabled, `components` chứa 'frequency', `disabledComponents` không chứa 'frequency', `installationFinished`)
  3. system cursor `by_term` jump-scan trên unified store lọc `kind==='freq'` + resourceId hợp lệ → project sang `FrequencyEntry` (bỏ `kind`/`backwardTerm`)
- Alt flow: popup path (`lookupOrchestrator`) lọc bằng `allowedResourceIds` đã có — thêm điều kiện components.
- Exception: không resource nào freq-capable → trả map rỗng nhanh, không query store.
- Rules: rank merge semantics giữ nguyên (lowest-frequency wins, priority tiebreak theo resource order); `RESOURCE_SAMPLE`/`RESOURCE_FIND` trả unified rows — resourceType param bỏ, sample trả bất kỳ kind nào resource chứa. **Behavior delta ghi rõ**: handler hôm nay (`frequency.ts:28`) query không gate theo enabled/disabled — resource bị disable vẫn rò rank; gate mới là bug-fix có chủ đích, không phải parity thuần.
- Postcondition: mọi consumer freq (tokenize, cueListTokens, unknownCueMap, videoTokenPreloader, popup) không đổi code, không đổi kết quả.
- NFR refs: NFR-1, NFR-4

REQ-8: Background execution parity
- Actor: JobRegistry
- Goal: Import/delete jobs chạy detached, reconcile sau SW restart — y như hiện nay.
- Basic flow: giữ nguyên `resources.ts` flow — chunk accumulate → executor `importFile` → `markDone`; delete → `deleteResourceCascade` (giờ một entry store + phrase index + resource).
- Alt flow: reconcile `installationFinished=false` → rollback (giữ nguyên).
- Exception: `importPayloads` mất sau SW kill → job interrupted "reimport" (giữ nguyên).
- Rules: `resource-import` job params bỏ `resourceType` (hoặc optional-ignore); `resource-delete` params bỏ `resourceType`; duplicate qua `findActive` vẫn theo signature.
- Postcondition: jobs durable như cũ, params gọn hơn.
- NFR refs: NFR-1, NFR-2

REQ-9: Sync compatibility
- Actor: sync engine
- Goal: Portable blob format byte-identical; `contentHash` stable; wire meta tương thích.
- Basic flow:
  1. serialize: đọc unified store → partition `kind==='freq'` → `f`-lines, còn lại → `d`-lines → `stableJson` sort → gzip (giữ `serializeResourcePortable(dictRows, freqRows)` signature hoặc wrapper partition-internally — bytes output phải giữ format `d`/`f` prefixed sorted lines)
  2. deserialize: `d`-lines → dict-shape rows, `f`-lines → freq-shape + `kind:'freq'` → ghi unified store
  3. `toResourceMeta` giữ field `type` (derived: có 'definitions' → 'DICTIONARY' else 'FREQUENCY') để peers cũ đọc được
- Alt flow: blob cũ (từ app version trước) → deserialize path giống hệt (format không đổi).
- Exception: corrupt blob → error như hiện nay.
- Rules: `contentHash` của resource không đổi nếu nội dung entries không đổi — `STRIPPED_FIELDS` (resourceIdentity.ts:6) chỉ thêm `kind`; `backwardTerm` **giữ serialize** (đang serialize trên cả d/f-lines hôm nay — strip nó sẽ đổi blob bytes + contentHash); `importResourceBlob` ghi một store thay hai, derive `components` từ rows vừa deserialize (dictRows → component fold, freqRows → + 'frequency') và `wordCount = dictRows.length + freqRows.length` (site `dictLocalSource.ts:349` hiện set `dictRows.length`); `ensureResourceContentHash` (resourceIdentity.ts:56-62) đổi sang đọc một store + partition by kind; `applyStores()`/`readStores()` cập nhật store list.
- Postcondition: sync identity + cross-version blob interop giữ nguyên.
- NFR refs: NFR-1, NFR-5

REQ-10: Declared-type elimination
- Actor: system (maintainer-facing invariant)
- Goal: Không còn nhánh nghiệp vụ nào phân chia theo `resourceType` user-khai-báo; `ResourceInfo.type` chỉ là derived display label + wire-compat field.
- Basic flow:
  1. system bỏ `resourceType` khỏi `importFile`, `createStrategy`, `resolveFormat`, `ImportChunkMeta`, job params, `ResourceImportChunkPayloadSchema` (optional-backward hoặc drop — internal API), `ImportJob.resourceType` → `detectedComponents`
  2. system thay `row.type === 'DICTIONARY'` branches (`dictLocalSource.ts:341` phrase-index rebuild, `lookupOrchestrator.ts:224`, `resources.ts:296-319` SAMPLE/FIND, `importOrchestrator.ts:108` phrase-index gate, `resourceRepository.ts:196-212` reorder type-filter, `ResourcesPanel.tsx:753-758` registry-job type filter) bằng components/format-derived checks
  3. system sweep 41 files đụng `ResourceType` — mỗi site: đổi sang components-check / xóa / giữ làm label, có lý do ghi trong code
- Alt flow: `devSeed` bỏ `resourceType` field (detect từ file).
- Exception: sót một nhánh → grep-gate `type === 'DICTIONARY'|'FREQUENCY'` trong deliver verify bắt.
- Rules: `ResourceType` union vẫn export (wire compat + derived label) nhưng không còn là input của bất kỳ write-path nào.
- Postcondition: type-related branches chỉ còn ở display/derived-label/wire-serialize.
- NFR refs: NFR-3

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Hot path không suy giảm: `findFreqByTerms` cursor-bounded theo `by_term` (không full-store scan); batch lookup ≤ cùng lớp độ phức tạp hiện nay (jump-cursor O(matches)); freq rows lean (không field dict thừa trên row) | P | Perf-check trước/sau trên fixture 100k freq + 50k dict rows; không regression đo được |
| NFR-2 | Import vẫn background-detached + memory-bounded: chunk upload `MAX_INFLIGHT_BYTES`, strategy batch flush 5000, không đọc full-file ngoài zip/sqlite (đã là hiện trạng) | P, R | JobRegistry tests + existing bounds giữ nguyên |
| NFR-3 | Single-source: một repo entry duy nhất; mọi phân chia theo `components`/payload, không theo `type` khai-báo | S | grep-gate: 0 match `type === '(DICTIONARY|FREQUENCY)'` ngoài derived-label/wire sites được liệt kê |
| NFR-4 | UX giữ chất lượng hiện có: i18n en+vi cho mọi chuỗi mới, a11y (badge đọc được screen-reader), dropzone không block, delete-all copy cập nhật | U | Review + i18n key audit |
| NFR-5 | Migration an toàn: idempotent, abort-safe (tx-level), không đổi `contentHash`/`signature` của resource nào; upgrade chạy ở background, không UI-blocking prompt | R | Unit test fake-indexeddb v13→v14 fixture |

## Flows / States

Import flow (state machine của một job — giữ nguyên cấu trúc, chỉ đổi bước detect):

```
queued --sniff-head→ queued(badge=detected-kind)
queued --validate-fail→ error
queued --slot-free→ uploading --chunks-acked→ importing
importing --detect-full→ strategy-parse → success | error | duplicate-park
duplicate-park --replace→ uploading | --skip→ skipped
```

Type-detection flow (authoritative, SW):

```
bytes → isGzip/isZip/isSqlite magic
 zip → unzipAll → bank names? → term_bank ⇒ {definitions}; term_meta_bank ⇒ {frequency}; both ⇒ union
       json/txt inside → JSON-shape sniff như detectFormat
 sqlite → sql.js open → tables: langResourceEntry ⇒ {definitions}; langFrequencyEntry|entries ⇒ {frequency}; both ⇒ union; none ⇒ ParseError
 json → shape sniff (entries|frequency|array|wordlist) → componentSet
 txt → {frequency}
 gzip → unwrap → recurse
```

Migration flow:

```
openDB(v14) → onupgradeneeded:
  langFrequencyEntry exists? → cursor copy + kind:'freq' → drop store
  resources: type==='FREQUENCY' && !components → components=['frequency']
  → versionchange tx commit (atomic)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Detect resource content | `detectFormat`+`sniffZipFormat` (có sẵn); sqlite schema sniffer (mới, nhỏ); format→componentSet map (mới) |
| Route/emit parsed entries | `BaseImportStrategy` union-emission; `TermBankStrategy` dual-bank; `SqliteStrategy` schema-driven; các strategy đơn-loại giữ nguyên |
| Store entries | `resourceEntryRepository` (merge của 2 repo mirror, `STORES.ENTRY='langDictionaryEntry'`, kind filter) |
| Migrate legacy data | v14 `onupgradeneeded` cursor-copy + drop store + components backfill |
| Present + drive import | Một dropzone (union accept); job rows + detected-kind badge; pending/terminal rows (giữ nguyên) |
| Manage resources | Một `ResourceSection`/list; `ResourceCard` hiển thị components; reorder một trục (`reorderResources` bỏ type-filter) |
| Serve frequency data | `FREQUENCY_GET` handler + `findFreqRowsByTerms` (kind filter + resource gate); `FrequencyEntry` projection |
| Serve dictionary data | dict query paths lọc `kind!=='freq'`; `dictionaryResources` = components-derived |
| Sync resources | `serializeResourcePortable` partition-by-kind; `importResourceBlob` one-store; `toResourceMeta` derived `type` |
| Report undetectable/invalid | error row + i18n reason (giữ pattern `getUserMessage`) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| ResourceInfo | id, name, langCode, `type` (derived label — wire/display only), format, signature, contentHash, `components`, `disabledComponents`, enabled, priority, profileIds, wordCount, installationFinished, importedAt | `langResourceInfo` (lang DB, extension IDB) | đến khi user xóa |
| ResourceEntry (dict-shape) | id, resourceId, term, reading, backwardTerm, altterm, pronunciation, definition, senses… (giữ nguyên DictionaryEntry; `kind` absent) | `langDictionaryEntry` (symbol `STORES.ENTRY`) | theo resource |
| ResourceEntry (freq-shape) | id, resourceId, term, reading, backwardTerm, frequency, pos?, total?, genres?, `kind:'freq'` | `langDictionaryEntry` | theo resource |
| ImportJob (UI) | jobId, file, fileName, `detectedComponents`, signature, status… | panel state (volatile) | session |
| Job (registry) | id, kind resource-import/delete, params {signature, langCode, fileName, duplicateDecision} — `resourceType` dropped | JobRegistry persistence | terminal → dismissed |
| Portable blob | lines `d<stableJson>` / `f<stableJson>` sorted | Drive blobs/<contentHash> | theo resource |
| Wire meta | name, langCode, `type` (derived), format, enabled, priority, disabledComponents, contentHash | sync records `resource:<token>` | theo resource |

Component mới: `'frequency'` thêm vào `DictionaryComponent` + `ComponentName` zod enum + `DICTIONARY_COMPONENTS` order. Format→componentSet map (D1): `txt|json-array|json-frequency → {frequency}`; `wordlist-json|json-entries → {definitions…}` (`wordlist-json` emit dict entries với `definition` = comma-joined tags — `wordlistJsonStrategy.ts` extends `BaseDictionaryStrategy`); `term-bank → {definitions?, frequency?}` theo bank presence; `sqlite → theo table presence`.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria) |
|---|---|---|
| N1 (một điểm import) | REQ-1 | SC-1 |
| N2 (content-derived detect) | REQ-2 | SC-2, SC-3 |
| N3 (một entry-store) | REQ-3 | SC-4 |
| N4 (migration không mất data) | REQ-4 | SC-5, SC-6 |
| N5 (multi-component file nạp trọn) | REQ-5 | SC-7 |
| N6 (một list một trục priority) | REQ-6 | SC-8, SC-9 |
| N7 (hot path parity) | REQ-7 | SC-10 |
| N8 (background jobs) | REQ-8 | SC-11 |
| N9 (sync compat) | REQ-9 | SC-12, SC-13 |
| N10 (không nhánh type) | REQ-10 | SC-14 |

| Journey step | REQ |
|---|---|
| AS-IS 1-4 (hai dropzone, nhầm ô, mất nửa bank, phân loại extension) | REQ-1, REQ-2, REQ-5 |
| AS-IS 5 (repo mirror đôi) | REQ-3, REQ-10 |
| TO-BE 1-2 (thả một chỗ, badge, chạy ngầm) | REQ-1, REQ-2, REQ-8 |
| TO-BE 3 (zip hai bank trọn vẹn; sqlite tự quyết) | REQ-5, REQ-2 |
| TO-BE 4 (v14 migrate nguyên vẹn) | REQ-4 |
| TO-BE 5 (reorder một trục) | REQ-6 |
| TO-BE 6 (một repo, behavior không đổi) | REQ-3, REQ-7, REQ-10 |

## Boundaries

- Always: giữ wire shapes (`FrequencyEntry`, portable `d`/`f` lines, sync meta fields); batch/cursor-bounded queries; i18n cho mọi chuỗi mới; `npm run typecheck && test:unit && lint && build` trước commit; migration test trên fake-indexeddb fixture.
- Ask first: manifest/permission changes (không dự kiến cần); dependency mới (không cần — fflate/sql.js đã có); đổi tên vật lý object-store `langDictionaryEntry` (quyết định: KHÔNG đổi — chỉ rename symbol; đổi tên = migrate thêm ~500k dict rows không lợi ích).
- Never: silent misroute (detect fail = error rõ); đọc/ghi IDB object store `langFrequencyEntry` sau v14 (tên trùng với sqlite source table `langFrequencyEntry` trong `.db` files — đó là external schema, không liên quan); đổi `signature`/`contentHash` formula; đụng dirty files của `sync-on-use`/session-recap owners — sequence hoặc rebase, không edit đè.

## Success Criteria

- [ ] SC-1: Một dropzone duy nhất trên ResourcesPanel chấp nhận `.txt,.json,.zip,.db,.gz`; mỗi file hợp lệ tạo đúng một job row có detected-kind trước upload; không còn section FREQUENCY riêng.
- [ ] SC-2: Format→componentSet deterministic cho cả 7 format; unit test mỗi format → đúng components trên resource sau import (kể cả `json-array` → chỉ 'frequency').
- [ ] SC-3: sqlite có `langResourceEntry` → dict-content; có `langFrequencyEntry`/`entries` → freq-content; có cả hai → union; không có → ParseError rõ.
- [ ] SC-4: Mọi read/write entry qua `STORES.ENTRY`; grep-gate 0 reference `STORES.FREQUENCY` trong `src/` sau migrate; freq rows có `kind:'freq'`, dict rows không.
- [ ] SC-5: Fixture v13 (dict+freq resources+entries) → open v14 → mọi resource/entry/enabled/priority/profiles/contentHash nguyên vẹn; `langFrequencyEntry` không còn; freq resources có `components` chứa 'frequency'.
- [ ] SC-6: Migration idempotent + abort-safe: gián đoạn giữa copy → open lại chạy lại từ đầu không duplicate (fake-indexeddb test bằng cách throw giữa tx, reopen).
- [ ] SC-7: Zip chứa `term_bank_1` + `term_meta_bank_1` → một resource `components` ⊇ {definitions, frequency}, cả hai loại rows query được; wordCount = tổng hai loại.
- [ ] SC-8: `RESOURCE_REORDER` không cần `resourceType`; reorder một danh sách ghi priority 0..n trên toàn bộ resources của lang.
- [ ] SC-9: Lookup merge tôn trọng `disabledComponents` chứa 'frequency' (resource freq-disabled không đóng góp rank) và priority một trục.
- [ ] SC-10: `FREQUENCY_GET` trả `Map<term, FrequencyEntry[]>` shape y hệt cho seeded dataset có mọi resource enabled (behavior-parity: response khớp fixture expectations hiện có); test mới chứng minh resources disabled hoặc `disabledComponents` chứa 'frequency' không đóng góp rank (delta mới, fix rò rank hiện nay); cursor vẫn jump-bounded (không `getAll()` toàn store).
- [ ] SC-11: Đóng panel giữa import → job tiếp tục (JOB_LIST/JOB_EVENT); SW restart giữa import → reconcile interrupted/rollback y như hiện nay.
- [ ] SC-12: `serializeResourcePortable` output byte-identical cho cùng tập entries trước/sau unify (partition theo kind); `contentHash` resource giữ nguyên sau migration cho nội dung không đổi.
- [ ] SC-13: Blob tạo bởi version cũ (`{dictRows,freqRows}` hiện tại) import được vào unified store và ngược lại — round-trip test.
- [ ] SC-14: grep-gate: 0 match `resourceType` trong payload schemas/`importFile`/`createStrategy`; `type === 'DICTIONARY'|'FREQUENCY'` chỉ còn ở các site derived-label/wire được liệt kê trong code review.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check + browser verify (before/after shots của panel)
- [ ] Migration test (fake-indexeddb v13→v14) + freq-parity test + portable round-trip test
- [ ] Bump hardcoded `DB_SCHEMA_VERSION` pins trong test hiện có (`phraseIndexRepository.test.ts:56` expect 13 → 14) và seed helpers resolve live version
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` + ADR mới (store merge + components-derived type) cập nhật
- [ ] Coordination note: diff không đè lên dirty files của `sync-on-use` (dictLocalSource/syncRuntime) — nếu shipped trước thì rebase, nếu chưa thì ghi handoff note

## Open Questions / Accepted Risks

- **Migration time**: copy freq rows trong versionchange tx là one-time cost per lang DB; đo trên fixture lớn nhất ở DELIVER — nếu vượt ngưỡng cảm nhận được (>vài giây) thì cân nhắc hiển thị tiến trình (không có UI surface lúc upgrade — ghi accepted risk).
- **json-array intent**: array-of-strings luôn thành freq-content (không thể "làm dict" vì không có defs) — đúng parity với hành vi frequency-section hôm nay; ai thả nhầm sẽ thấy badge 'frequency'.
- **Không có "đổi loại" sau detect**: intent đề badge-override; spec hiện thực hóa phần hợp nghĩa của nó — multi-component file cho deselect components trước upload (REQ-2 alt flow). Còn detect-sai-do-content (file thật sự chỉ có freq nhưng user tưởng dict) thì không override được vì rows là gì thì là đó — escape hatch: error row rõ + delete + reimport. Đây là deviation có chủ đích so với chữ "sửa badge" trong intent, đã cân nhắc.
- **sqlite sniffer chi phí**: schema-sniff cần mở sql.js (~1MB wasm lazy) ở SW trong import — chấp nhận được (đã lazy-load cho parse); panel-side badge cho sqlite hiển thị generic 'SQLite' (không mở wasm chỉ để badge).
- **type field giữ lại**: `ResourceInfo.type` tồn tại tiếp như derived label + wire-compat (toResourceMeta); không phải SSOT nghiệp vụ — rủi ro dev sau này nhánh theo nó lại → ghi ADR + lint note.
- **sync-on-use overlap**: `dictLocalSource.ts`/`syncRuntime.ts` đang được agent khác sửa — deliver phải rebase/sequence, không merge đè.
- **`kind` stamp asymmetry**: freq rows có `kind`, dict rows không (absent=dict) — quyết định để không chạm ~500k dict rows khi migrate; ghi trong ADR.
