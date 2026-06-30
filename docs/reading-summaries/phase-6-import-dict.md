# Phase 6 — import-dictionary-frequency (Orca v3) — Tóm tắt kiến trúc

> Đã đọc ~40 file core của project `import dictioanry and requency list for theocean-extension-dictionary` (Orca v3).

## Tech stack

- **Chrome Extension MV3**: `manifest_version: 3`, service worker `background.js` (type module), permissions `storage`, `tabs`, `scripting`, `identity`; OAuth2 Google (scope profile/email/drive.file); CSP cho phép `wasm-unsafe-eval` để chạy sql.js.
- **Vanilla JS ES modules**: `"type": "module"`, không bundler, không framework UI — toàn bộ logic core viết bằng class JS thuần + `import/export`. Test qua `node --test` + `fake-indexeddb`.
- **IndexedDB là DB chính**: không SQLite native, không server — toàn bộ frequency/dictionary/resource lưu trong IndexedDB, schema version 9 với migration từng bước trong `onupgradeneeded`.
- **sql.js (WASM)**: parse file Migaku `.db.gz` — `gunzipSync` (fflate) → `initSqlJs` load `sql-wasm.wasm` từ `lib/` → `SQL.Database(bytes)` → `exec` SELECT rồi yield từng row.
- **fflate**: thư viện nén/giải nén sync (`gunzipSync`, `unzipSync`) cho ZIP/GZIP — load qua `window.fflate`, dùng cho cả TxtLine zipped, Yomitan ZIP, và SQLite gz.

## IndexedDB schema

- DB name động: `orca-dict-{hash8}-{lang}` — hash 8 ký tự sinh bằng `crypto.randomUUID().slice(0,8)` lưu trong `chrome.storage.local` key `orca.dbHash` (fallback `devmode0` khi chạy ngoài extension).
- **Store `langResourceInfo`**: metadata mỗi file đã import (id auto, name, description, url, version, type `FREQUENCY`/`DICTIONARY`, languageSrc, installationFinished, signature, wordCount, order, createdAt). Indexes: `by_signature`, `by_type`, `by_order`, `by_wordCount`.
- **Store `langFrequencyEntry`**: từng từ vựng (id auto, langResourceInfoId FK, lang, term, backwardTerm, displayTerm, termAlt, reading, backwardReading, frequency). Indexes: `by_resource`, `by_term`, `by_backwardTerm`, `by_lang`.
- **Store `langDictionaryEntry`**: entry từ điển giàu (thêm definition, pos, examples, audio). Indexes: `by_resource`, `by_term`, `by_backwardTerm`. Thêm ở schema v9.
- **Migration chain v1→v9**: v1 tạo 2 store đầu; v2 thêm `by_order`; v3 bỏ `by_lang_term` index + deprecate `lang` field; v4 thêm `by_wordCount`; v5 deprecate `fileSize`; v6 thêm lại `by_lang` index cho multi-language; v9 thêm `langDictionaryEntry` store.

## Repository pattern

- **BaseRepository**: lớp trừu tượng giữ singleton `_dbPromise` (cache connection), `resolveDbName()` đọc hash từ chrome.storage, `createSchema(db)` + migration chain trong `onupgradeneeded`, helper `getStore(mode)`/`getIndex(name,mode)`/`promisify(req)`/`txDone(tx)`. Mọi repo con kế thừa và chỉ cần truyền `storeName` vào constructor.
- **ResourceRepository** (`langResourceInfo`): `create` (gán `order = Date.now()`), `getAllOrdered` (qua index `by_order`), `findBySignature` (dedupe), `search` (substring trong name), `updateOrders` (reorder batch).
- **FrequencyRepository** (`langFrequencyEntry`): `bulkInsert`, `findByTerm` (exact), `findByPrefix` (`IDBKeyRange.bound(lower, lower+'\uffff')`), `findBySuffix` (dùng `backwardTerm` reversed + index `by_backwardTerm`), `getByResource` (cursor pagination offset/limit), `deleteByResource` (cascade delete với progress callback).
- **DictionaryRepository**: mirror y hệt FrequencyRepository nhưng cho `langDictionaryEntry` — cho phép import pipeline swap repo FREQUENCY↔DICTIONARY mà không đổi logic.
- **LanguageRepository**: facade composite — nhận `languageCode`, tạo `dbConfig` riêng (`orca-dict-{hash}-{lang}`), bên trong giữ 3 sub-BaseRepository (resourceInfo/frequency/dictionary) → CRUD cho cả 3 store trong 1 DB ngôn ngữ.
- **ProfileRepository**: DB central `orca-profiles-central`, store `languageProfile` — `create`, `findByLanguage`, `getActive`, `setActive` (deactivate tất cả khác), `getByTier`, `getStats`.
- **UserRepository**: store `user` — `getCurrent` (lấy record đầu), `save` (upsert id='current', gán tier/uiLanguage/motherTongue default), `clear`.
- **WordStatusRepository**: wrap `langFrequencyEntry` theo languageCode — quản lý status flow `unknown→tracking→learning→known→ignore` với `transitionStatus` validate ma trận chuyển, `getDueForReview`, `getLearningProgress` (% known).

## Services layer

- **ImportOrchestrator**: main use-case — validate file → detect format → compute signature → checkDuplicate → create resource (installationFinished=false) → `StrategyFactory.create(format,...)` → `strategy.execute()` → patch resource (wordCount, metadata Yomitan/SQLite) → return stats. Khi lỗi → `rollbackImport` (deleteByResource + delete resource) atomic.
- **FileDetectorService**: static helpers — `validateFile` (max 500MB), `readMagicBytes`, `isGzip`/`isZip`/`isSqlite` (magic bytes), `gunzipFile` (fflate), `unzipAll` (fflate → map filename→Uint8Array), `extractZipFile`.
- **FormatDetectorService**: hybrid detect — SQLite raw bị reject (phải .db.gz), GZIP→`GZIP_WRAPPED`, ZIP→list entries → có `index.json` = `YOMITAN`, có `.txt`/`.json` = `TXT_ZIPPED`/`JSON_ZIPPED`, còn lại text qua extension `.txt`/`.json`.
- **ResourceService**: wrapper mỏng trên ResourceRepository + `checkDuplicate(signature)` throw `DuplicateFileError` nếu resource đã `installationFinished`.
- **LanguageProfileService**: quản lý multi-profile — `switchProfile(langCode)` dùng `DatabaseManager.switchConnection(old,new)`, cache `Map<lang, LanguageRepository>` và `Map<lang, connection>`, `getAllStats` aggregate.
- **DatabaseManager**: singleton — ràng buộc **single active connection**, `getConnection(config)` reuse hoặc close-then-open, `switchConnection(old,new)`, `connectionHistory` log. (Hiện mock cho test.)
- **AuthService**: OAuth Google thật — `launchWebAuthFlow` → exchange code→token → `fetchUserInfo` → save user; `signOut` clear.
- **AccountService**: edit profile (displayName validate, uiLanguage, motherTongue).
- **ProfileService**: lifecycle profile + tier enforcement (`canAddLanguage` check `tierLimits`), `createProfile` (UNSUPPORTED_LANGUAGE/ALREADY_EXISTS/TIER_LIMIT), `switchProfile` broadcast `orca.profileSwitched`.
- **BootstrapDownloadService**: download resource mặc định nền, streaming reader + progress %.
- **PermissionService**: host permission per-site (scope all/domain/page) + blacklist trong chrome.storage.
- **TabCoordinationService**: broadcast message tới tabs, queue cho tab offline, dedup qua messageHistory.

## Import strategies

- **BaseImportStrategy (template method)**: constructor nhận (file, resourceId, options) → ước lượng total = `file.size / avgBytesPerWord`; `getRepository()` hook (mặc định FrequencyRepository); `transformEntry(raw,index)` hook → qua `NormalizationPipeline.processWord` → record frequency; `parse()` abstract (subclass implement async generator); `execute()` template — for-await parse → transformEntry → `BatchProcessor.add` → flush → progress + yield event loop mỗi batch. `getFrequency(index,raw)` mặc định `index+1`.
- **BaseDictionaryImportStrategy**: override `getRepository()` → DictionaryRepository, `batchSize` = `dictionaryBatchSize` (2000), `estimatedTotal` = `file.size / avgBytesPerDictEntry` (80), `transformEntry` thêm definition/pos/examples/audio/reading/backwardReading.
- **TxtLineStrategy**: streaming line-by-line qua `ReadableStream` + `TextDecoder` (stream:true), split `\r?\n`, auto-unzip nếu `unzipFirst`.
- **JsonArrayStrategy**: streaming **token-level** JSON parser (không load full JSON) — state machine in-string/escape/arrayStarted, yield `{term}` mỗi string đóng. Hỗ trợ `\n\t\r\"\\/` (skip `\u`).
- **YomitanStrategy**: unzip all → tìm `index.json` (metadata title/revision) → sort `term_meta_bank_*.json` theo số → mỗi entry `[term, type, meta]`, chỉ lấy `type==='freq'`, meta có thể là number hoặc `{reading, frequency}` hoặc `{value, displayValue}` hoặc nested `{frequency:{value}}`.
- **SqliteStrategy**: gunzip → load sql.js WASM → `exec` SELECT metadata từ `langResourceInfo` → `exec` SELECT term/displayTerm/termAlt/reading/frequency từ `langFrequencyEntry ORDER BY frequency ASC` → yield. Cache `_sqlJsPromise` singleton.
- **CambridgeJsonStrategy**: parse JSON array `[{term, altterm, pronunciation, definition, pos, examples, audio}]` qua FileReader, ghi vào DictionaryRepository.
- **StrategyFactory**: switch theo format — TXT_PLAIN/ZIPPED→TxtLine, JSON_PLAIN/ZIPPED→ (isDict? CambridgeJson : JsonArray), YOMITAN→Yomitan, GZIP_WRAPPED→Sqlite. `options.resourceType==='DICTIONARY'` quyết định dictionary vs frequency.

## Pipeline

- **NormalizationPipeline.processWord(rawWord, lang)**: 6 bước — trim → strip JSON garbage (dấu phẩy, quote) → reject empty/structural-only (`[]{}()`) → NFC normalize giữ case = `displayTerm` → lowercase = `term` → `reverseUnicodeSafe(term)` = `backwardTerm`. Return `{term, displayTerm, backwardTerm, termAlt:''}` hoặc null.
- **SignatureGenerator.compute(file)**: `SHA-256(first 1MB)` + `_${file.size}_${nameWithoutExt}` — dùng `crypto.subtle.digest`, sample 1MB đầu để nhanh với file lớn. Dùng cho dedupe trong ResourceService.checkDuplicate.
- **backwardTerm trick**: lưu term reversed để query suffix như prefix — `findBySuffix` reverse query rồi `IDBKeyRange.bound(reversed, reversed+'\uffff')` trên index `by_backwardTerm`. Unicode-safe qua `reverseUnicodeSafe`.

## Analysis

- **IPlusOneSelector**: hiện thực Krashen i+1 — câu chỉ eligible khi có **đúng 1** distinct word ở status UNKNOWN/TRACKING (HIGHLIGHTABLE_STATUSES); trả về term đó hoặc null. Pure logic, không side-effect.
- **SentenceExtractor**: split text thành câu qua regex tránh abbreviation (`Dr.`, `Jan.`) — `[^.!?]+(?:[.!?]+(?!\s|$)[^.!?]*)*[.!?]*(?:\s|$)`, trim + filter empty.
- **WordTokenizer**: regex `[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*` (Unicode property escape, giữ apostrophe/hyphen nội bộ như "don't", "well-known"), lowercase, `tokenizeWithPositions` trả `{term, start, end}`.
- **WordStatus**: constants `UNKNOWN/KNOWN/TRACKING/IGNORED` (frozen) + `HIGHLIGHTABLE_STATUSES = [UNKNOWN, TRACKING]`.
- **LRUCache**: Map-based LRU (default capacity 5000) — `get` move-to-end, `set` evict oldest khi vượt capacity. Dùng cho cache frequency lookup khi highlight.

## Architecture Insights for Cell

- **Repository pattern tách biệt IndexedDB**: BaseRepository giữ 1 connection singleton + toàn bộ schema/migration trong `onupgradeneeded`; repo con chỉ truyền storeName → Cell có thể áp dụng pattern này cho mọi IndexedDB store, dễ test với `fake-indexeddb`.
- **Strategy pattern + template method cho import đa format**: BaseImportStrategy.define `execute()` template (parse→transform→batch→flush), subclass chỉ implement `parse()` async generator + override `getRepository()`/`transformEntry()` — thêm format mới = thêm 1 class, không sửa orchestrator. Cell import subtitle/audio có thể dùng pattern tương tự.
- **IndexedDB schema design cho search**: `backwardTerm` (term reversed) + index `by_backwardTerm` cho phép suffix search mà không cần full-text search engine — trick đơn giản, hiệu quả, Unicode-safe. Cell có thể áp dụng cho search từ vựng.
- **i+1 detection pure logic**: IPlusOneSelector + WordTokenizer + WordStatus tách hoàn toàn khỏi DOM/IndexedDB — input array word+status, output term hoặc null. Cell highlight engine có thể reuse trực tiếp module này.
- **Language profile = DB-per-language**: mỗi ngôn ngữ 1 IndexedDB riêng (`orca-dict-{hash}-{lang}`), ProfileRepository central track active profile, DatabaseManager switch connection atomic — pattern multi-tenant cho extension, tránh cross-language pollution.
- **Dedupe qua content signature**: SHA-256(first 1MB) + size + name → cheap, đủ phân biệt file, không cần hash toàn bộ. Cell download dedupe có thể áp dụng tương tự.
- **Atomic rollback import**: ImportOrchestrator catch error → `rollbackImport` cascade delete entries + delete resource → dữ liệu không bị half-imported. Cell nên có transaction/rollback tương tự cho mọi import batch.
- **Streaming parse cho file lớn**: TxtLine/JsonArray dùng `ReadableStream` + `TextDecoder` stream:true + async generator → không load full file vào memory, yield mỗi line/token. Cell xử lý subtitle/video lớn nên theo pattern này.
