# Intent: Unified Resource Import — một điểm import, hệ thống tự nhận diện, một entry-store

> Slug: `unified-resource-import` · Mode: interactive · Source: user statement (2026-10-04)
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | User phải phân loại file dữ liệu ngôn ngữ thành "dictionary" hay "frequency list" trước khi nạp — phải biết file chứa gì rồi chọn đúng ô thả. Đây là câu hỏi **file tự trả lời được** nhưng hệ thống đang hỏi user. Thả nhầm → import lỗi (`ParseError: no term_bank files`) hoặc nội dung bị cắt lặng lẽ (zip có cả hai bank chỉ nạp một phần theo ô đã chọn). | `ResourcesPanel.tsx:82-101` (2 dropzone, accept khác nhau), `ResourcesPanel.tsx:577-628` (resourceType suy từ section), `termBankStrategy.ts:73-77,104-138` (mode DICTIONARY ném lỗi khi chỉ có term_meta_bank) | high |
| Change | 2 dropzone + 2 entry-store + `resourceType` do user khai báo → 1 điểm import tự nhận diện + 1 entry-store + components suy từ nội dung file. | `types.ts:17-18` (ResourceType), `baseRepository.ts:103-116` (2 store giống hệt keyPath+index) | high |
| Solution | Hướng: resource là **container của components** — tầng detect hiện có suy ra component-set từ bytes; entries (gồm cả frequency rows, vốn chỉ là dictionary-entry chỉ mang rank) ghi vào một store theo kiến trúc dictionary; mọi phân chia nghiệp vụ đi qua `ResourceInfo.components` thay vì `type`. Mô hình này portable sync format đã dùng sẵn (`{dictRows, freqRows}`). | `dictionaryComponents.ts:8-22` (component model), `dictBlobReader.ts:30-39` (`serializeResourcePortable(dictRows, freqRows)` — một resource đã chứa hai loại rows), `types.ts:60-64` (`components` + `disabledComponents` đã tồn tại) | high |
| Value | User: thả file là xong, không cần biết file chứa gì; file multi-component nạp trọn vẹn thay vì mất nửa lặng lẽ; một trục priority duy nhất. Maintainer: repo mirror đôi → một; type-branching → component-branching; ít bề mặt bug. | `dictionaryRepository.ts:4` ("Same pattern as frequencyRepository"), `ResourcesPanel.tsx:661-679` (reorder per-type hiện nay) | high |
| Stakeholder | Anh (primary dogfooder, quản nhiều resources/đổi thứ tự thường xuyên) + learner persona 5–80 low-RAM; agent maintainers chịu repo đôi. | AGENTS.md persona | high |
| Context | MV3: SW chết bất cứ lúc nào → import đã chạy ngầm qua JobRegistry; IDB schema v13 create-all-only → migration v14 là vùng mới của codebase này; `sync-on-use` đang in-flight đụng `dictLocalSource`/handlers (agent khác, cần sequence). | `baseRepository.ts:9-10,74-86`, `resources.ts:111-134` (JobRegistry executor), `dictLocalSource.ts:315-353`, pipeline-state `sync-on-use` stage=deliver owner=`devin-sync-on-use` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Agent dev | Detect infra (`formatDetector`, strategies, repos) đã có ~80% — còn thiếu type-inference + store merge + migration | Phải quét hết 41 files đụng `ResourceType` để không để nhánh chết (lesson `refactor-orphaned-delegation-guard`) |
| Customer | Learner | Không phải học khái niệm "dictionary vs frequency"; file nạp đúng nội dung nó chứa | Đã quen 2-section UI → badge/type hint phải rõ để không mất phương hướng |
| Supplier/Dependency | File formats bên ngoài (yomitan banks, sqlite, txt, json variants) | Format sniff rules là heuristic — sqlite schema là chỗ duy nhất còn mơ hồ thật | Không format nào do mình kiểm soát → detection phải fail-loud, không đoán lặng |
| Organization | Maintainers | `ResourceInfo.type` hiện là SSOT cho nhiều nhánh (store routing, phrase-index gate, sync phrase rebuild, RESOURCE_SAMPLE/FIND) — thay bằng components phải sweep sạch | `importOrchestrator.ts:90,101,108`, `dictLocalSource.ts:341`, `resources.ts:296-319`, `lookupOrchestrator.ts:224` |
| Regulator | Store policy / privacy | none — dữ liệu vẫn local-first IDB, không telemetry | Không thay đổi permission/manifest |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Một nơi duy nhất để thả/chọn file resource — chấp nhận union mọi format hiện hỗ trợ | F | `ResourcesPanel.tsx:88,97` (accept khác nhau: dict thiếu `.txt`) | high |
| N2 | Hệ thống tự suy ra file chứa component gì từ nội dung, không hỏi user; không suy ra được → đường resolve tường minh (parked prompt như duplicate, hoặc error rõ), không đoán lặng | F, R | `formatDetector.ts:26-80` đã sniff magic+zip+JSON shape; `sniffZipFormat` đã phân biệt được bank/txt/json; thiếu sqlite-schema sniff + both-banks handling | high |
| N3 | Frequency data sống trong kiến trúc dictionary-entry — một entry-store; freq row lean (không field dict) khi chỉ mang rank | F, S | `types.ts:81-93` (FrequencyEntry) vs `types.ts:169-199` (DictionaryEntry): cùng keyPath/indexes (`baseRepository.ts:103-116`); repos mirror (`dictionaryRepository.ts:4`) | high |
| N4 | Migrate v13→v14 không mất dữ liệu: resources, entries, `enabled`, `priority`, `profileIds`, `contentHash`, sync identity nguyên vẹn; không yêu cầu user import lại | R | `types.ts:41-66` (fields phải bảo toàn); `signature`/`contentHash` là sync + dedupe identity | high |
| N5 | File multi-component (zip chứa `term_bank` + `term_meta_bank`) nạp toàn bộ nội dung vào một resource | F | `termBankStrategy.ts:73-77` — hiện chọn một bank theo declared type, phần còn lại bỏ; portable format đã hỗ trợ mixed (`dictBlobReader.ts:36-39`) | high |
| N6 | Một danh sách resource thống nhất (type badge, không còn 2 section); một trục priority — merge semantics theo component (component nào resource không có thì priority của nó vô nghĩa với component đó) | U | `lookupOrchestrator.ts:200-210` priority merge đã theo resource; `components`/`disabledComponents` merge per-component đã tồn tại (`types.ts:60-64`, `dictionaryComponents.ts`) | medium |
| N7 | Hot path giữ nguyên lớp độ phức tạp: freq batch lookup qua `by_term` cursor-bounded (không full-scan), batch import vẫn streaming; không tăng đáng kể RAM (freq rows lean) | P | `frequencyRepository.ts:59-109` (`findFrequencyByTerms` cursor+jump); `baseImportStrategy.ts` batching; `resourceClient.ts:198-217` chunked upload + `MAX_INFLIGHT_BYTES` bound | high |
| N8 | Import vẫn chạy ngầm: JobRegistry owns sau khi bytes hand off — survive panel close, reconcile sau SW restart | R | `resources.ts:111-134,146-154,327-409` | high |
| N9 | Sync portable format + `contentHash` giữ tương thích hai chiều — blob đã sync vẫn import được, blob mới vẫn đọc được bản cũ trong cửa sổ rollout | R, +infra | `dictBlobReader.ts:30-39`, `dictLocalSource.ts:315-353`; `contentHash` là remote identity (`types.ts:49-53`) | medium |
| N10 | Không còn nhánh nghiệp vụ theo `type` khai-báo: store routing, phrase-index gate, phrase-index rebuild on sync-import, RESOURCE_SAMPLE/FIND đều component/format-derived | F, S | `importOrchestrator.ts:90,101,108`; `dictLocalSource.ts:341`; `resources.ts:296-319`; `lookupOrchestrator.ts:224`; `strategyFactory.ts:46-51` (resolveFormat hack) | high |

## Scope

- **In:** một dropzone/entry import duy nhất trên ResourcesPanel (union accept) + auto-detect components lúc enqueue (badge + override khi sai) + đường resolve tường minh cho file không detect được; merge `langFrequencyEntry`→`langDictionaryEntry` (hoặc rename `langResourceEntry`) + IDB migration v14 batched; component mới cho frequency-rank trong `DictionaryComponent` (rank ≠ `frequencyStars` — sao là grade hiển thị trong dict entry, rank là corpus position); strategies emit rows theo component thực có của file (term-bank zip nạp cả hai bank; sqlite theo schema sniff); refactor orchestrator/factory/handler/repos bỏ `resourceType` khai-báo; freq queries (`FREQUENCY_GET`, `findFrequencyByTerms`, prefix/suffix/sample/count/delete) đọc một store lọc theo freq-payload + freq-capable resources; UI list một danh sách duy nhất + type badge + reorder một trục; message-schema updates; cập nhật seeds/e2e/tests; docs (`2-architechture-system.md`, ADR mới).
- **Out:** format file mới; catalog/store tải resource online; thay đổi ngữ nghĩa frequency-band/tokenize; thay đổi lookup merge algorithm (probe, phrase-index build rules vẫn chỉ áp cho resources có definitions); đổi tên IDB database (`orca-dict-*` giữ nguyên — DB name không phải store name).
- **Non-goals:** không gộp `langWordStatus`/`langWordTrash`/`langPhraseIndex` (khác lifecycle); không viết lại `findFrequencyByTerms` thành index mới nếu cursor hiện tại đủ nhanh — measure trước optimize sau; không đổi `signature`/`contentHash` formula (đứt dedupe + sync identity).

## Workflow

User mở Settings → Resources → thấy một dropzone "Thả file tài nguyên" (union accept `.txt,.json,.zip,.db,.gz`) → kéo một hoặc nhiều file vào → panel đọc 1MB head từng file → detect format + components → job row xuất hiện với badge loại (Dictionary / Frequency / Dictionary+Frequency) — user có thể sửa badge trước khi upload nếu detect sai → scheduler FIFO đẩy chunks (dual bound như cũ) → background JobRegistry nhận đủ bytes → orchestrator re-sniff đầy đủ (zip >1MB cần full-bytes như hiện nay) → strategy parse → emit entries mang đúng component payload → ghi một entry-store → resource row ghi `components` (và `disabledComponents` rỗng) → hoàn tất, card xuất hiện trong danh sách một trục theo priority. File sqlite: detect thêm bước schema-sniff (đọc `sqlite_master` ở đầu file) chọn mapping; schema không khớp cả hai → job park ở prompt "Import as…" (reuse pattern duplicate-park) → user chọn một lần → chạy tiếp. Đường system↔system: content-script ↔ background (chunk upload, FREQUENCY_GET, RESOURCE_*), background ↔ IDB (1 resource store + 1 entry store + phrase index + sync outbox), sync ↔ portable blob ({dictRows,freqRows} giữ nguyên shape). Person↔device: user thả file, đọc badge, kéo thả reorder trên một danh sách, toggle enabled/components như cũ.

## Journey

### AS-IS

1. Anh tải `JPDB.zip` (chỉ có `term_meta_bank` — frequency list) → mở Settings → thấy 2 ô: Dictionaries (`.json,.zip,.db,.gz`) và Frequency (`.txt,.json,.zip,.db,.gz`).
2. Anh phải tự biết file "loại nào" rồi chọn ô; chọn nhầm ô Dictionary → upload xong → strategy mode DICTIONARY ném `ParseError: no term_bank_*.json files found` — mất công upload, phải thả lại đúng ô.
3. Yomitan dict zip có cả `term_bank` + `term_meta_bank` → thả ô Dictionary → chỉ definitions được nạp, phần frequency bị bỏ lặng lẽ (và ngược lại nếu thả ô Frequency) — không UI nào báo mất nửa nội dung.
4. `.txt` chỉ ô Frequency nhận; `.json` cả hai nhận nhưng nghĩa khác nhau (array-of-strings vs entries) — cùng extension user vẫn phải phân biệt.
5. Maintainer sửa một bug repo → vá hai file gần-như-mirror (`frequencyRepository.ts` ↔ `dictionaryRepository.ts`), và mọi nhánh `type === 'DICTIONARY'` rải ở orchestrator/sync/handlers/lookup phải nhớ cập nhật cặp đôi.

### TO-BE

1. Anh thả `JPDB.zip` (hay bất kỳ file nào) vào một dropzone duy nhất → panel sniff head → job row hiện badge "Frequency" ngay khi enqueue — sai thì đổi badge trước upload.
2. Job chạy ngầm qua JobRegistry y như cũ → resource mới xuất hiện trong danh sách một trục với `components: ['frequency']` đúng theo nội dung file.
3. Zip hai bank → một resource `components: ['definitions','frequency',…]` — trọn vẹn, không phần nào bị cắt lặng lẽ; sqlite → schema-sniff tự chọn nhánh, không quyết được mới hỏi một lần.
4. User cũ mở extension sau update → IDB v14 migrate frequency rows sang entry-store chung, `type`→`components` — resource/entries/priority/enabled nguyên vẹn, không action thủ công.
5. Reorder một danh sách duy nhất: kéo frequency list lên trên dict → rank của nó thắng theo đúng merge-priority đã có; dict không có rank thì không ảnh hưởng lẫn nhau.
6. Maintainer sửa entry-path → một repo, một store; detect/format strategies giữ nguyên interface — hot path tokenize/lookup không đổi hành vi.

## Stories

- S1: As a learner, tôi muốn thả file tài nguyên ngôn ngữ vào một chỗ duy nhất mà không phải phân loại — done when mọi file hợp lệ nạp đúng nội dung bất kể loại, và file không hợp lệ báo lỗi rõ.
- S2: As a learner, tôi muốn file chứa nhiều loại dữ liệu được nạp trọn vẹn — done when zip dict+freq tạo một resource có cả hai components và cả hai đều phục vụ lookup/tokenize.
- S3: As an existing user, dữ liệu đã import phải nguyên vẹn sau update — done when profile v13 mở ra v14 có đủ resources/entries/priority/enabled/profiles/sync-identity, không phải import lại.
- S4: As a learner on low-RAM device, import và lookup không tốn thêm tài nguyên — done when batch lookup vẫn cursor-bounded, import vẫn chunk/batch streaming, và freq rows không phình theo schema dict.
- S5: As a maintainer, tôi muốn một entry-store + một repository + không nhánh `type` — done when mọi read/write đi qua một store và phân chia theo components/payload thực có.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Migration v13→v14 copy 100k+ freq rows trong `onupgradeneeded` chặn/nặng DB open (mọi lookup chờ DB) | internal, operational | high | Batched cursor copy trong upgrade tx; đo trên list lớn nhất ở DELIVER; nếu vượt budget → lazy-migrate có flag (quyết ở SPECIFY); `refactor-orphaned-delegation-guard` bắt cả hai đường đọc phải cùng semantics |
| Freq hot-path chậm lại: `by_term` cursor giờ trả cả dict rows nặng ở cùng key | internal | medium | Bounded theo số row tại key đó (không scan); giữ freq rows lean; perf-check `findFrequencyByTerms` trước/sau trong plan |
| `sync-on-use` in-flight đụng `dictLocalSource`/sync handlers (agent khác own, stage=deliver) | internal | medium | Không đụng file của họ khi dirty; spec liệt kê touch-points; sequence deliver hoặc rebase sau khi item đó shipped |
| Detect nhầm (json-array "định làm dict" → freq-only resource) → user bối rối | human | low | Badge + override; string-array vốn không có defs nên sai lệch vô hại về data |
| Nhánh `type` sót lại thành dead path (41 files đụng ResourceType) | internal | medium | Sweep list trong spec; grep-gate ở deliver; tests mới bắt mọi path |
| Schema bump phá e2e seeds + test assertions (`e2e-idb-seed-version-drift`, `schema-version-bump-sync-test-assertions`) | internal | low | Helpers resolve live `DB_SCHEMA_VERSION`; update assertions cùng PR |
| Remote sync apply xen giữa local migration (`sync-persist-obligation-before-state-apply`) | hidden | medium | Migration idempotent; obligation persist trước apply; review kỹ ở SPECIFY |
| `wordCount` semantics đổi khi resource multi-component (sync path đang dùng `dictRows.length`) | internal | low | SPECIFY định nghĩa lại: wordCount = tổng entries mọi components |
| Heuristic detect `json-frequency` vs `json-entries` mỏng (8192-byte head, key sniff) | external | low | Đã ship; sai → badge-override + parked-prompt fallback; không silent |

## Decision

go — codebase đã hội tụ sẵn một nửa về đúng mô hình này (một `ResourceInfo` có `components`, portable format `{dictRows,freqRows}`, hai store/index giống hệt nhau, repos mirror). Gộp xoá được: một quyết định user không nên phải trả lời, một code-path mirror đôi, và một silent data-loss (nửa bank bị bỏ). Rủi ro lớn nhất — migration dữ liệu + đụng `sync-on-use` in-flight — đều quản được bằng sequencing + sweep, không phải lý do no-go.

## Draft Acceptance Criteria

Need-level (SPECIFY derive system ACs từ đây):

- [ ] Một dropzone duy nhất nhận union format; mỗi job hiển thị detected-kind trước khi upload và cho phép sửa.
- [ ] Zip chứa `term_bank` + `term_meta_bank` tạo một resource chứa cả hai loại entries (không mất nửa nội dung).
- [ ] File không detect được loại → job park ở prompt/chooser tường minh hoặc error rõ — không silent misroute.
- [ ] Profile có data v13: sau update mọi resource/entries/enabled/priority/profiles/`contentHash` nguyên vẹn; freq rank lookup trả kết quả y hệt trước migrate (seeded fixture test).
- [ ] `FREQUENCY_GET` + tokenize/frequency-band trả kết quả giống hệt hôm nay với cùng dataset (behavior-parity test trên fixtures hiện có).
- [ ] Import vẫn chạy detached qua JobRegistry: đóng panel không mất job, SW restart reconcile đúng (interrupted/rollback như hiện nay).
- [ ] Một danh sách resource một trục priority; component-level merge tôn trọng `disabledComponents` và priority như hiện nay.
- [ ] Không còn nhánh nghiệp vụ theo `type` khai-báo ở orchestrator/strategies/repos/handlers/lookup (grep-gate).
- [ ] Portable sync blob: blob cũ import được vào store mới; blob mới giữ shape `{dictRows,freqRows}` (hoặc tương đương có migration note) — `contentHash` identity không đổi cho cùng nội dung.
