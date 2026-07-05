# ADR-023: Port Theocean Dictionary Import (IndexedDB + Strategy + Atomic Rollback)

> Date: 2026-07-05
> Status: Accepted
> Phase: G3 — Architecture Decision Record
> Spec: `docs/specs/spec-port-theocean-dict-and-theme.md` (F7-F12)
> Intent: `docs/intent/intent-port-theocean-dict-and-theme.md`
> Plan: `docs/plan/plan-port-theocean-dict-and-theme.md` (Phase B, M7-M12)

## Context

Cell mở rộng sang immersion language learning → cần corpus từ vựng (frequency list + dictionary) lưu IndexedDB (chrome.storage.local 10MB không đủ cho ≤500MB corpus). Reference `theocean-extension-dictionary` (vanilla JS MV3 v3.0.0) đã có import 5 format chạy được, port + rewrite idiomatic TS.

**5 format import** (spec F8-F9):
1. **TXT** (mỗi dòng 1 từ) — `.txt` hoặc `.zip` chứa `.txt`
2. **JSON Array** — `["word1", "word2", ...]` (frequency) hoặc `[{term, definition, ...}]` (Cambridge dict)
3. **Yomitan ZIP** — `index.json` + `term_meta_bank_*.json` (frequency meta)
4. **Migaku SQLite** — `.db.gz` (gzip-wrapped SQLite)
5. **Cambridge JSON** — dict entry `{term, altterm, pronunciation, definition, pos, examples, audio}`

**Problem**: Import file lớn ≤500MB, streaming (không load full vào RAM), auto-detect format, dedupe (re-import same file), atomic rollback khi fail, 5 strategy khác nhau nhưng 1 orchestrator.

## Decision

### D1: IndexedDB schema — 3 object stores + dbHash random

```ts
// DB name: orca-dict-{hash8}-en  (hash random 8 chars, sinh trên chrome.runtime.onInstalled)
//   hash lưu chrome.storage.local.orca.dbHash
//   Tests fallback 'devmode0' khi chrome.storage absent (reference pattern)

// 3 object stores (spec F7):
langResourceInfo:    keyPath 'id' auto
  indexes: by_signature, by_type, by_order
langFrequencyEntry:  keyPath 'id' auto
  indexes: by_resource, by_term, by_backwardTerm
langDictionaryEntry: keyPath 'id' auto
  indexes: by_resource, by_term, by_backwardTerm
```

**Why dbHash random**: Tránh conflict khi uninstall/reinstall (DB cũ orphaned không ghi đè). Reference pattern. 8 chars đủ unique.

**Why `backwardTerm` index**: Prefix search `findByPrefix("app")` + suffix search `findBySuffix("ing")` qua backwardTerm (reverse string) — 1 index trick, không cần 2 query.

**Why 3 stores tách**: Resource metadata (1 row/file) ≠ frequency entries (word list) ≠ dictionary entries (rich fields). Tách → query riêng, delete cascade rõ.

**Rejected: 1 store `entries` với `type` field** — query chậm, delete theo resource scan toàn table.

**Rejected: dbHash hardcode** — reinstall conflict, test không deterministic (reference dùng random + test fallback).

### D2: Migration v9 create-all ONLY (cell fresh DB)

```ts
// baseRepository.openDB — onupgradeneeded
if (oldVersion < 9) {
  // create-all: 3 stores + all indexes (by_signature, by_type, by_order,
  //              by_resource, by_term, by_backwardTerm)
}
// ponytail: cell là DB mới, không có user v1-v8. Full v1→v9 chain = dead code.
//           Reference port chain (v1→v9) skip — chỉ create-all branch.
```

**Why create-all only**: Cell là DB mới (feature chưa tồn tại trước) → 0 user v1-v8. Port full chain = dead code (Risk #11). `ponytail:` comment ghi upgrade path nếu sau này cần migration v9→v10.

**Rejected: Port full v1→v9 chain** — dead code, maintenance burden, 0 user benefit.

### D3: Strategy template method pattern (5 strategy + 1 base)

```ts
// baseImportStrategy.ts — template method (subclass KHÔNG override execute)
export abstract class BaseImportStrategy {
  protected abstract getRepository(): BaseRepository;
  protected abstract transformEntry(raw: RawEntry, index: number): StoredEntry | null;
  protected abstract parse(): AsyncGenerator<RawEntry>;  // streaming
  async execute(): Promise<ImportResult> {
    // template: for await (raw of parse()) → transformEntry → batchProcessor.add → flush at 5000
  }
}

// 5 concrete strategies:
txtLineStrategy       — ReadableStream line-by-line + TextDecoder, auto-unzip if .zip
jsonArrayStrategy     — streaming token-level JSON string-array parse (không load full)
yomitanStrategy       — unzip all, parse index.json, sort term_meta_bank_*.json, yield {term, reading, frequency}
sqliteStrategy        — gunzip → sql.js wasm lazy-load → exec SQL → yield {term, reading, frequency}
cambridgeJsonStrategy — parse JSON array [{term, altterm, pronunciation, definition, pos, examples, audio}]

// baseDictionaryStrategy.ts — dict variant (DictionaryRepository + rich fields)
// strategyFactory.create(format, file, resourceId, options) — route JSON → Cambridge if resourceType==='DICTIONARY'
```

**Why template method**: 5 strategy chia sẻ flow (parse → transform → batch → flush), chỉ khác `parse()` + `transformEntry()` + `getRepository()`. Template method = 1 orchestration, subclass = 3 hook. Giữ pattern reference, rewrite TS idiomatic.

**Why class (không function)**: Strategy có state (file handle, resourceId, batchProcessor). Class encapsulate state + template method. Ponytail: class cho stateful orchestrator/strategy, function cho pure logic (spec Code Style).

**Why streaming `AsyncGenerator`**: File 500MB không load full RAM. `parse()` yield từng entry, `execute()` consume + batch. Memory ~5000 entries (batch size) thay vì ~500K entries.

**Rejected: Strategy function + switch case** — state phẳng, khó test riêng, flow duplicate 5 lần.

**Rejected: Load full file → array → batch** — 500MB RAM spike, crash.

### D4: fflate cho cả gzip + zip (1 lib ~30KB)

```ts
import { gunzipSync, unzipSync, strFromU8 } from 'fflate';
// gzip: gunzipSync(compressed) — .db.gz
// zip:  unzipSync(compressed) → { [path]: Uint8Array } — Yomitan, TXT zipped
```

**Why fflate cho cả 2**: 1 lib (~30KB) đơn giản hơn 2 code paths (gzip native `DecompressionStream` + zip fflate). Ponytail: fewer code paths > save ~10KB. Consistency API.

**Rejected: `DecompressionStream` native cho gzip + fflate cho zip** — 2 code paths, API khác, test 2 path, save ~10KB không đáng.

### D5: sql.js lazy-load (`web_accessible_resources`, CSP đã có wasm-unsafe-eval)

```ts
// sqliteStrategy.ts — lazy load chỉ khi import .db.gz
import initSqlJs from 'sql.js';
// sql-wasm.wasm + sql-wasm.js → public/manifest.json web_accessible_resources
// CSP: public/manifest.json:58 đã có script-src 'self' 'wasm-unsafe-eval' — KHÔNG đổi CSP

const SQL = await initSqlJs({ locateFile: () => chrome.runtime.getURL('sql-wasm.wasm') });
const db = new SQL.Database(ungzippedBuffer);
const rows = db.exec('SELECT term, reading, frequency FROM entries');
```

**Why lazy-load**: sql.js wasm ~1MB+, chỉ cần khi user import `.db.gz` (Migaku format). Load upfront = phình every popup boot. Lazy = 0 impact khi không dùng.

**Why `web_accessible_resources`**: sql.js fetch wasm qua URL, cần accessible từ extension page. MV3 require declare.

**Why CSP đã đủ**: `public/manifest.json:58` đã có `script-src 'self' 'wasm-unsafe-eval'` (verified spec OQ#1). wasm-unsafe-eval cho phép wasm compile. KHÔNG cần `unsafe-eval` (security risk).

**Failure path (Risk #4)**: wasm load fail (fetch error / wasm parse error) → throw `ImportError(DatabaseError)` → orchestrator catch → rollback. Không crash.

**Rejected: Load sql.js upfront** — 1MB+ vào main bundle, every boot.

**Rejected: Native SQLite (wa-sqlite, sqlite-wasm OPFS)** — over-engineer, sql.js đủ cho read-only parse 1 file.

### D6: Atomic rollback (orchestrator catch → rollbackImport)

```ts
// importOrchestrator.importFile(file, langCode, options)
//   1. validate → detect → signature → checkDuplicate
//   2. create resource (installationFinished=false) → onResourceCreated(resourceId)
//   3. strategy.execute() → onProgress(processed, estimatedTotal)
//   4. success → update resource (wordCount, installationFinished=true, metadata)
//   5. error → rollbackImport(resourceId) → rethrow

async function rollbackImport(resourceId: number): Promise<void> {
  try {
    await dictionaryRepository.deleteByResource(resourceId);  // cascade + progress
    await frequencyRepository.deleteByResource(resourceId);
    await resourceRepository.delete(resourceId);
  } catch (rollbackErr) {
    throw new RollbackError(resourceId, rollbackErr);  // rollback-during-rollback surfaced
  }
}
```

**Rollback triggers**: strategy parse/transform error, **wasm load failure**, quota exceeded, user cancel.

**Why atomic**: Import fail giữa chừng → partial data orphaned → corrupt corpus. Rollback = clean state (xóa resource + entries). User retry clean.

**Why `installationFinished=false` flag**: Resource tạo trước strategy.execute (UI thấy progress). Nếu crash giữa chừng, flag=false → có thể detect + cleanup sau (hoặc rollback ngay).

**Rollback-during-rollback**: delete fail → `RollbackError` surfaced (không silent). User biết resource orphaned, manual cleanup.

**Rejected: Best-effort (không rollback)** — partial data corrupt, user không biết.

**Rejected: Transaction wrap toàn import** — IndexedDB transaction không sống qua streaming (5K batch), không hold transaction 500MB import.

### D7: SHA-256 signature dedupe (1MB sample + size + name)

```ts
// signatureGenerator.compute(file) → `${sha256(first1MB)}_${size}_${nameWithoutExt}`
const first1MB = await file.slice(0, 1024 * 1024).arrayBuffer();
const hash = await crypto.subtle.digest('SHA-256', first1MB);
// + file.size + file.name (without extension)
```

**Why 1MB sample**: Full SHA-256 của 500MB = slow (read toàn file). 1MB đầu + size + name = đủ unique (collision cần cùng 1MB đầu + cùng size + cùng name). Re-import same file = same signature → `DuplicateFileError`, no resource created.

**Why `crypto.subtle`**: Native Web Crypto, 0 dep, available trong extension + content-script.

**Rejected: Full file SHA-256** — slow 500MB, user wait.

**Rejected: Random UUID** — không detect duplicate, re-import tạo 2 resource.

### D8: Batch 5000 + streaming parse (memory bounded)

```ts
// batchProcessor.ts
const BATCH_SIZE = 5000;  // spec F7
async function add(entry: StoredEntry): Promise<void> {
  buffer.push(entry);
  if (buffer.length >= BATCH_SIZE) await flush();
}
async function flush(): Promise<void> {
  await repository.bulkInsert(buffer);  // 1 transaction per batch
  buffer = [];
}
```

**Why 5000**: IndexedDB transaction overhead per insert cao. 5000/transaction = balance giữa memory (5000 entries ~500KB) vs throughput. Reference dùng 5000, giữ.

**Why streaming + batch**: Parse yield 1 entry → buffer → flush 5000. Memory bounded ~500KB thay vì 500MB.

## Consequences

### Positive
- 5 format import qua 1 orchestrator (template method DRY)
- Streaming + batch → memory bounded ~500KB cho file 500MB
- Atomic rollback → clean state khi fail
- SHA-256 dedupe → re-import detect, no duplicate
- sql.js lazy-load → 0 impact khi không import `.db.gz`
- dbHash random → reinstall không conflict
- `backwardTerm` index → prefix + suffix search 1 trick
- CSP đã có wasm-unsafe-eval → 0 CSP change

### Negative
- 3 new deps: `fflate` (~30KB), `sql.js` (~1MB+ wasm lazy), `fake-indexeddb` (devDep) — check bundle size trước add (spec Boundaries "Ask first")
- `web_accessible_resources` thêm sql-wasm.wasm + sql-wasm.js → manifest change, test real Chrome
- Migration v9 create-all only → nếu sau này cần v9→v10 migration, viết mới (không có chain reference)
- `IndexedDB` quota (≤500MB enforced bằng `validateFile`, nhưng browser quota có thể thấp hơn → `QuotaExceededError` → rollback)
- Strategy class (5 + base) — nhiều file, nhưng mỗi file nhỏ + test colocate

### Neutral
- DB name `orca-dict-{hash}-en` — hardcode `en` (single language, multi-language out of scope)
- `lang` prefix trong store name giữ reference naming (consistency với reference port)

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| 1 store `entries` với `type` field | Query chậm, delete theo resource scan toàn table |
| dbHash hardcode | Reinstall conflict, test không deterministic |
| Port full v1→v9 migration chain | Dead code, cell fresh DB, 0 user v1-v8 |
| Strategy function + switch case | State phẳng, flow duplicate 5 lần, khó test riêng |
| Load full file → array → batch | 500MB RAM spike, crash |
| `DecompressionStream` native gzip + fflate zip | 2 code paths, API khác, save ~10KB không đáng |
| Load sql.js upfront | 1MB+ vào main bundle every boot |
| wa-sqlite / sqlite-wasm OPFS | Over-engineer, sql.js đủ cho read-only parse 1 file |
| Best-effort (không rollback) | Partial data corrupt, user không biết |
| Transaction wrap toàn import | IndexedDB tx không sống qua streaming 5K batch |
| Full file SHA-256 | Slow 500MB, user wait |
| Random UUID signature | Không detect duplicate, re-import tạo 2 resource |

## Module Boundaries (api-and-interface-design)

### `src/entities/dictionary/` (types — pure)

```ts
export type ImportFormat = 'TXT_PLAIN' | 'TXT_ZIPPED' | 'JSON_PLAIN' | 'JSON_ZIPPED' | 'YOMITAN' | 'GZIP_WRAPPED';
export type ResourceType = 'FREQUENCY' | 'DICTIONARY';
export interface ResourceInfo {
  id?: number; signature: string; name: string; format: ImportFormat;
  resourceType: ResourceType; wordCount: number; order: number;
  installationFinished: boolean; createdAt: number; metadata?: unknown;
}
export interface FrequencyEntry { id?: number; resourceId: number; term: string; backwardTerm: string; reading?: string; frequency?: number; }
export interface DictionaryEntry { id?: number; resourceId: number; term: string; backwardTerm: string; reading?: string; definition?: string; pos?: string; examples?: string[]; audio?: string; }
```

### `src/features/dictionary/repositories/` (IndexedDB CRUD)

```ts
// baseRepository.ts — singleton connection + migration
export class BaseRepository {
  static async getDB(): Promise<IDBDatabase>;
  protected getStore(mode: IDBTransactionMode): IDBObjectStore;
}
// resourceRepository, frequencyRepository, dictionaryRepository — extend BaseRepository
// bulkInsert, findByTerm, findByPrefix, findBySuffix, getByResource, countByResource, deleteByResource
```

### `src/features/dictionary/logic/` (orchestrator + strategies + pure)

```ts
// importOrchestrator.ts — use-case
export async function importFile(file: File, langCode: string, options: ImportOptions): Promise<ImportResult>;
export async function rollbackImport(resourceId: number): Promise<void>;

// strategies/baseImportStrategy.ts — template method
export abstract class BaseImportStrategy { protected abstract getRepository(); protected abstract transformEntry(); protected abstract parse(); async execute(): Promise<ImportResult>; }

// strategyFactory.ts
export function createStrategy(format: ImportFormat, file: File, resourceId: number, options: ImportOptions): BaseImportStrategy;

// importErrors.ts — hierarchy
export abstract class ImportError extends Error { abstract getUserMessage(): string; }
export class ValidationError extends ImportError {}
export class ParseError extends ImportError {}
export class DatabaseError extends ImportError {}
export class RollbackError extends ImportError {}
export class DuplicateFileError extends ImportError {}
export class FileTooLargeError extends ImportError {}
export class CorruptedZipError extends ImportError {}
```

### `src/shared/lib/storage/dbHash.ts` (onInstall hash)

```ts
export async function getDbHash(): Promise<string>;  // read chrome.storage.local.orca.dbHash, fallback 'devmode0'
// chrome.runtime.onInstalled → generate 8-char random → save
```

## References

- Spec: `docs/specs/spec-port-theocean-dict-and-theme.md` (F7-F12)
- Intent: `docs/intent/intent-port-theocean-dict-and-theme.md`
- Plan: `docs/plan/plan-port-theocean-dict-and-theme.md` (Phase B, M7-M12)
- ADR-016: FSD screaming architecture (`src/features/dictionary/`, `src/entities/dictionary/`)
- ADR-022: Theme system (shared options entrypoint)
- Reference: `project-reference/import dictioanry and requency list for theocean-extension-dictionary/` (vanilla JS import 5 format)
- Chrome MV3: `web_accessible_resources`, `wasm-unsafe-eval` CSP (https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)
