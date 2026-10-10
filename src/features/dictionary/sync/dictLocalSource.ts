import {
  awaitIdbTx,
  getMetaAt,
  getRowAt,
  idbRequest,
  IdbLocalSource,
  listMetaEntriesIn,
  scopeForTarget,
  targetOf,
  tombstoneMetaAt,
} from '@/features/sync';
import type { ChangeRecord, DataClass, PendingKey, RecordKey, Scope } from '@/features/sync';
import type { LocalValue, SnapshotEntry, StoredRecordMeta } from '@/features/sync';
import type { ApplyContext } from '@/features/sync';
import type { DictionaryComponent, ResourceInfo } from '@/entities/dictionary';
import type { WordStatusSource } from '@/features/dictionary/services/wordStatusArbitration';
import { normalizeStoredStatus, type StoredWordStatus } from '@/features/dictionary/services/wordStatusSemantics';
import { getDB, INDEXES, STORES } from '../repositories/baseRepository';
import { buildPhraseIndexForResource } from '../logic/phraseIndexBuilder';
import { collectEntryComponents, deriveResourceType, sortedComponents, type ComponentSource } from '../logic/dictionaryComponents';
import { gunzipFile, isGzip } from '../logic/fileDetector';
import { blobBytes } from '@/features/sync';
import {
  deserializeResourcePortable,
  ensureResourceContentHash,
  resourceRecordKey,
  resourceRecordToken,
} from './resourceIdentity';
import { logger } from '@/shared/lib/logger';

const RESOURCE_PREFIX = 'resource:';
const WORD_PREFIX = 'word:';

const RESOURCE_FIELDS = [
  'name',
  'enabled',
  'priority',
  'disabledComponents',
] as const;

/** Wire-accepted statuses — `learning` stays readable so rows synced from a
 *  peer running the pre-tracking/hasCard model still apply (coalesced to
 *  `tracking` on write). */
const WORD_STATUSES: ReadonlySet<StoredWordStatus> = new Set([
  'known',
  'unknown',
  'tracking',
  'learning',
  'ignore',
]);

interface WordStatusWireRow {
  readonly term: string;
  readonly status: string;
  readonly updatedAt: number;
  readonly source?: WordStatusSource;
  readonly sourceAt?: number;
}

interface ResourceKeyParts {
  readonly token: string;
  readonly field: string | null;
}

function parseResourceKey(key: RecordKey): ResourceKeyParts | null {
  if (!key.startsWith(RESOURCE_PREFIX)) return null;
  const rest = key.slice(RESOURCE_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return rest.length > 0 ? { token: rest, field: null } : null;
  const token = rest.slice(0, slash);
  const field = rest.slice(slash + 1);
  if (token.length === 0 || field.length === 0 || field.includes('/')) return null;
  return { token, field };
}

function isResourceMeta(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toResourceMeta(row: ResourceInfo): Record<string, unknown> {
  return {
    name: row.name,
    langCode: row.langCode,
    type: row.type,
    format: row.format,
    enabled: row.enabled,
    priority: row.priority,
    disabledComponents: row.disabledComponents ? [...row.disabledComponents] : undefined,
    contentHash: row.contentHash,
  };
}

class DictResourceLocalSource extends IdbLocalSource {
  readonly dataClass: DataClass = 'dictResource';
  protected readonly keyPrefix = RESOURCE_PREFIX;

  constructor(private readonly langCode: string) {
    super();
  }

  protected openDb(): Promise<IDBDatabase> {
    return getDB(this.langCode);
  }

  protected readStores(): readonly string[] {
    return [STORES.RESOURCE, STORES.SYNC_META];
  }

  protected applyStores(): readonly string[] {
    return [
      STORES.RESOURCE,
      STORES.ENTRY,
      STORES.PHRASE_INDEX,
      STORES.SYNC_META,
    ];
  }

  protected snapshotStores(): readonly string[] {
    return [STORES.RESOURCE, STORES.SYNC_META];
  }

  private resourceScope(): Scope {
    return scopeForTarget(targetOf(this.langCode));
  }

  async resolve(keys: PendingKey[]): Promise<ChangeRecord[]> {
    await this.backfillContentHashes(keys.map((pending) => pending.key));
    return super.resolve(keys);
  }

  async *snapshot(scope: Scope): AsyncIterable<ChangeRecord> {
    await this.backfillAllContentHashes();
    yield* super.snapshot(scope);
  }

  private async backfillContentHashes(keys: readonly RecordKey[]): Promise<void> {
    const db = await this.openDb();
    const rtx = db.transaction([STORES.RESOURCE], 'readonly');
    const store = rtx.objectStore(STORES.RESOURCE);
    const touched = new Set<number>();
    for (const key of keys) {
      const parts = parseResourceKey(key);
      if (!parts) continue;
      const row = await this.resourceByToken(store, parts.token);
      if (row && !row.contentHash && row.id !== undefined) touched.add(row.id);
    }
    for (const id of touched) {
      const row = (await idbRequest(
        db.transaction([STORES.RESOURCE], 'readonly').objectStore(STORES.RESOURCE).get(id),
      )) as ResourceInfo | undefined;
      if (row) await ensureResourceContentHash(db, row);
    }
  }

  private async backfillAllContentHashes(): Promise<void> {
    const db = await this.openDb();
    const rows = (await idbRequest(
      db.transaction([STORES.RESOURCE], 'readonly').objectStore(STORES.RESOURCE).getAll(),
    )) as ResourceInfo[];
    for (const row of rows) {
      if (!row.contentHash && row.id !== undefined) await ensureResourceContentHash(db, row);
    }
  }

  protected knownKey(key: RecordKey): boolean {
    return parseResourceKey(key) !== null;
  }

  protected async readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue> {
    const parts = parseResourceKey(key);
    if (!parts) return { found: false };
    const row = await this.resourceByToken(tx.objectStore(STORES.RESOURCE), parts.token);
    if (!row) return { found: false };
    if (parts.field === null) return { found: true, value: toResourceMeta(row) };
    if (!(RESOURCE_FIELDS as readonly string[]).includes(parts.field)) return { found: false };
    const value: unknown = (row as unknown as Record<string, unknown>)[parts.field];
    return value === undefined ? { found: false } : { found: true, value };
  }

  protected async resolveRecords(
    tx: IDBTransaction,
    pending: PendingKey,
    meta: StoredRecordMeta,
    local: LocalValue,
  ): Promise<ChangeRecord[]> {
    const scope = meta.scope ?? pending.scope;
    const parts = parseResourceKey(pending.key);
    if (!parts) return [this.tombstoneRecord(scope, pending.key, meta)];
    const row = await this.resourceByToken(tx.objectStore(STORES.RESOURCE), parts.token);
    const token = row ? resourceRecordToken(row) : parts.token;
    if (meta.op === 'delete' || !local.found) {
      const key = parts.field ? `resource:${token}/${parts.field}` : `resource:${token}`;
      return [this.tombstoneRecord(scope, key, meta)];
    }
    if (parts.field !== null) {
      return [this.putRecord(scope, `resource:${token}/${parts.field}`, meta, local.value)];
    }
    const records: ChangeRecord[] = [this.putRecord(scope, `resource:${token}`, meta, local.value)];
    for (const field of RESOURCE_FIELDS) {
      const fieldMeta =
        (await getMetaAt(tx, `resource:${token}/${field}`, scope)) ??
        (await getMetaAt(tx, `resource:${parts.token}/${field}`, scope));
      if (!fieldMeta || fieldMeta.op === 'delete') continue;
      const value: unknown = row ? (row as unknown as Record<string, unknown>)[field] : undefined;
      if (value === undefined) continue;
      records.push(this.putRecord(scope, `resource:${token}/${field}`, fieldMeta, value));
    }
    return records;
  }

  protected async collectSnapshotEntries(
    tx: IDBTransaction,
    scope: Scope,
  ): Promise<SnapshotEntry[]> {
    if (scope !== this.resourceScope()) return [];
    const rows = (await idbRequest(tx.objectStore(STORES.RESOURCE).getAll())) as ResourceInfo[];
    const entries: SnapshotEntry[] = [];
    for (const row of rows) {
      const base = resourceRecordKey(row);
      entries.push({ key: base, metaKey: base, value: toResourceMeta(row) });
      for (const field of RESOURCE_FIELDS) {
        const value: unknown = (row as unknown as Record<string, unknown>)[field];
        if (value === undefined) continue;
        entries.push({ key: `${base}/${field}`, metaKey: `${base}/${field}`, value });
      }
    }
    return entries;
  }

  protected async scopeOfLocalValue(): Promise<Scope | null> {
    return this.resourceScope();
  }

  protected putMaterializable(record: ChangeRecord): boolean {
    const parts = parseResourceKey(record.key);
    if (!parts) return false;
    if (parts.field !== null) {
      return (RESOURCE_FIELDS as readonly string[]).includes(parts.field);
    }
    const value = record.value;
    if (!isResourceMeta(value)) return false;
    return value.langCode === this.langCode && typeof value.name === 'string';
  }

  protected async applyCheck(tx: IDBTransaction, record: ChangeRecord): Promise<boolean> {
    const parts = parseResourceKey(record.key);
    if (!parts) return false;
    if (record.op === 'put' && parts.field !== null) {
      return !!(await this.resourceByToken(tx.objectStore(STORES.RESOURCE), parts.token));
    }
    return true;
  }

  protected async writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    _remote: ChangeRecord,
  ): Promise<void> {
    const parts = parseResourceKey(winner.key);
    if (!parts) return;
    const store = tx.objectStore(STORES.RESOURCE);
    if (winner.op === 'delete') {
      if (parts.field === null) {
        await this.deleteResourceCascade(tx, parts.token, winner);
        return;
      }
      const row = await this.resourceByToken(store, parts.token);
      if (row) await idbRequest(store.put({ ...row, [parts.field]: undefined }));
      return;
    }
    if (parts.field !== null) {
      const row = await this.resourceByToken(store, parts.token);
      if (row) await idbRequest(store.put({ ...row, [parts.field]: winner.value }));
      return;
    }
    if (!this.putMaterializable(winner)) return;
    const existing = await this.resourceByToken(store, parts.token);
    const value = winner.value as Record<string, unknown>;
    const next: Record<string, unknown> = {
      components: existing?.components ?? [],
      installationFinished: existing?.installationFinished ?? false,
      wordCount: existing?.wordCount ?? 0,
      signature: existing?.signature ?? parts.token,
      importedAt: existing?.importedAt ?? Date.now(),
      metadata: existing?.metadata,
      ...value,
      contentHash: parts.token,
      langCode: this.langCode,
    };
    if (existing?.id !== undefined) next.id = existing.id;
    await idbRequest(store.put(next));
  }

  protected async afterApplyCommit(
    _applied: readonly ChangeRecord[],
    ctx?: ApplyContext,
  ): Promise<void> {
    if (!ctx?.fetchBlob) return;
    const db = await this.openDb();
    const rows = (await idbRequest(
      db.transaction([STORES.RESOURCE], 'readonly').objectStore(STORES.RESOURCE).getAll(),
    )) as ResourceInfo[];
    const pendingRows = rows.filter(
      (row) => !row.installationFinished && row.contentHash && row.signature === row.contentHash,
    );
    let inflight: Promise<Blob | null> | undefined;
    for (let i = 0; i < pendingRows.length; i++) {
      const row = pendingRows[i]!;
      const blob = await (inflight ?? ctx.fetchBlob(row.contentHash!));
      inflight = undefined;
      if (!blob) {
        logger.warn('dict sync: resource blob unavailable, deferring import', {
          resourceId: row.id,
          contentHash: row.contentHash,
        });
        continue;
      }
      const next = pendingRows[i + 1];
      if (next?.contentHash) inflight = ctx.fetchBlob(next.contentHash);
      await this.importResourceBlob(db, row, blob);
    }
  }

  private async importResourceBlob(
    db: IDBDatabase,
    row: ResourceInfo,
    blob: Blob,
  ): Promise<void> {
    if (row.id === undefined) return;
    const bytes = await blobBytes(blob);
    const { dictRows, freqRows } = deserializeResourcePortable(isGzip(bytes) ? gunzipFile(bytes) : bytes);
    const wtx = db.transaction([STORES.ENTRY], 'readwrite');
    const entryStore = wtx.objectStore(STORES.ENTRY);
    const staleKeys = (await idbRequest(
      entryStore.index(INDEXES.by_resource).getAllKeys(row.id),
    )) as IDBValidKey[];
    for (const key of staleKeys) entryStore.delete(key);
    for (const entry of dictRows) entryStore.add({ ...entry, resourceId: row.id });
    for (const entry of freqRows) entryStore.add({ ...entry, resourceId: row.id, kind: 'freq' });
    await awaitIdbTx(wtx);
    if (row.format === 'json-entries') {
      await buildPhraseIndexForResource(this.langCode, row.id);
    }
    const componentSet = new Set<DictionaryComponent>();
    for (const entry of dictRows) {
      collectEntryComponents(componentSet, entry as unknown as ComponentSource);
    }
    if (freqRows.length > 0) componentSet.add('frequency');
    const components = sortedComponents(componentSet);
    const ftx = db.transaction([STORES.RESOURCE], 'readwrite');
    const store = ftx.objectStore(STORES.RESOURCE);
    const fresh = (await idbRequest(store.get(row.id))) as ResourceInfo | undefined;
    if (fresh) {
      await idbRequest(
        store.put({
          ...fresh,
          type: deriveResourceType(components),
          components,
          installationFinished: true,
          wordCount: dictRows.length + freqRows.length,
        }),
      );
    }
    await awaitIdbTx(ftx);
  }

  private async deleteResourceCascade(
    tx: IDBTransaction,
    token: string,
    winner: ChangeRecord,
  ): Promise<void> {
    const store = tx.objectStore(STORES.RESOURCE);
    const row = await this.resourceByToken(store, token);
    if (row?.id !== undefined) {
      const contentKeys = (await idbRequest(
        tx.objectStore(STORES.ENTRY).index(INDEXES.by_resource).getAllKeys(row.id),
      )) as IDBValidKey[];
      for (const contentKey of contentKeys) {
        tx.objectStore(STORES.ENTRY).delete(contentKey);
      }
      tx.objectStore(STORES.PHRASE_INDEX).delete(row.id);
      store.delete(row.id);
    }
    const metas = await listMetaEntriesIn(tx, `${RESOURCE_PREFIX}${token}/`);
    for (const meta of metas) {
      await tombstoneMetaAt(tx, meta.recKey, meta.scope ?? winner.scope, winner.hlc);
    }
  }

  private async resourceByToken(
    store: IDBObjectStore,
    token: string,
  ): Promise<ResourceInfo | undefined> {
    const byHash = (await idbRequest(
      store.index(INDEXES.by_contentHash).get(token),
    )) as ResourceInfo | undefined;
    if (byHash) return byHash;
    return (await idbRequest(
      store.index(INDEXES.by_signature).get(token),
    )) as ResourceInfo | undefined;
  }
}

class DictWordStatusLocalSource extends IdbLocalSource {
  readonly dataClass: DataClass = 'wordStatus';
  protected readonly keyPrefix = WORD_PREFIX;

  constructor(private readonly langCode: string) {
    super();
  }

  protected openDb(): Promise<IDBDatabase> {
    return getDB(this.langCode);
  }

  protected readStores(): readonly string[] {
    return [STORES.WORD_STATUS, STORES.WORD_TRASH, STORES.SYNC_META];
  }

  protected applyStores(): readonly string[] {
    return [STORES.WORD_STATUS, STORES.WORD_TRASH, STORES.SYNC_META];
  }

  protected snapshotStores(): readonly string[] {
    return this.readStores();
  }

  protected knownKey(key: RecordKey): boolean {
    return key.startsWith(WORD_PREFIX) && key.slice(WORD_PREFIX.length).length > 0;
  }

  protected async readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue> {
    if (!this.knownKey(key)) return { found: false };
    const term = key.slice(WORD_PREFIX.length);
    const row = await getRowAt<WordStatusWireRow>(tx, STORES.WORD_STATUS, term);
    if (!row) return { found: false };
    if (await getRowAt(tx, STORES.WORD_TRASH, term)) return { found: false };
    return { found: true, value: { ...row, status: normalizeStoredStatus(row.status as StoredWordStatus) } };
  }

  protected async collectSnapshotEntries(
    tx: IDBTransaction,
    scope: Scope,
  ): Promise<SnapshotEntry[]> {
    if (scope !== this.wordScope()) return [];
    const rows = (await idbRequest(tx.objectStore(STORES.WORD_STATUS).getAll())) as WordStatusWireRow[];
    const entries: SnapshotEntry[] = [];
    for (const row of rows) {
      if (await getRowAt(tx, STORES.WORD_TRASH, row.term)) continue;
      const key = `${WORD_PREFIX}${row.term}`;
      entries.push({
        key,
        metaKey: key,
        value: { ...row, status: normalizeStoredStatus(row.status as StoredWordStatus) },
      });
    }
    return entries;
  }

  protected async scopeOfLocalValue(): Promise<Scope | null> {
    return this.wordScope();
  }

  protected putMaterializable(record: ChangeRecord): boolean {
    if (!this.knownKey(record.key)) return false;
    const value = record.value;
    if (typeof value !== 'object' || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
      entry.term === record.key.slice(WORD_PREFIX.length) &&
      typeof entry.status === 'string' &&
      WORD_STATUSES.has(entry.status as StoredWordStatus)
    );
  }

  protected async applyCheck(_tx: IDBTransaction, record: ChangeRecord): Promise<boolean> {
    return record.op === 'delete' ? true : this.putMaterializable(record);
  }

  protected async writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    _remote: ChangeRecord,
  ): Promise<void> {
    const term = winner.key.slice(WORD_PREFIX.length);
    const statusStore = tx.objectStore(STORES.WORD_STATUS);
    const trashStore = tx.objectStore(STORES.WORD_TRASH);
    const value = winner.value as {
      term: string;
      status: StoredWordStatus;
      updatedAt?: number;
      source?: WordStatusSource;
      sourceAt?: number;
    };
    const status = normalizeStoredStatus(value.status);
    if (winner.op === 'delete' || status === 'unknown') {
      await idbRequest(statusStore.delete(term));
      await idbRequest(trashStore.delete(term));
      return;
    }
    await idbRequest(trashStore.delete(term));
    await idbRequest(
      statusStore.put({
        term,
        status,
        updatedAt: value.updatedAt ?? Date.now(),
        source: value.source,
        sourceAt: value.sourceAt,
      }),
    );
  }

  private wordScope(): Scope {
    return scopeForTarget(targetOf(this.langCode));
  }
}

export type DictDataClass = 'dictResource' | 'wordStatus';

export function createDictLocalSource(langCode: string, dataClass: DictDataClass): IdbLocalSource {
  if (dataClass === 'dictResource') return new DictResourceLocalSource(langCode);
  if (dataClass === 'wordStatus') return new DictWordStatusLocalSource(langCode);
  throw new Error(`Unknown dictionary data class: ${dataClass}`);
}

export function dictLocalSources(langCode: string): IdbLocalSource[] {
  return [
    new DictResourceLocalSource(langCode),
    new DictWordStatusLocalSource(langCode),
  ];
}
