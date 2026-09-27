import type {
  ChangeRecord,
  LocalSource,
  LocalValue,
  PendingKey,
  RecordKey,
  Scope,
  SnapshotEntry,
  StoredRecordMeta,
} from '@/features/sync';
import {
  IdbLocalSource,
  allRowsAt,
  compareHlc,
  getDeviceId,
  getMetaAt,
  getRowAt,
  idbRequest,
  listMetaEntriesIn,
  scopeForTarget,
  targetOf,
  tombstoneMetaAt,
} from '@/features/sync';
import {
  getReaderDB,
  STORES,
  type BookRecord,
  type ReaderProgressRecord,
} from '../services/readerRepository';

export type ReaderDataClass = 'readerBook' | 'readerProgress';

const BOOK_PREFIX = 'book:';
const PROGRESS_PREFIX = 'progress:';
const POSITION_SUFFIX = 'position';
const READ_TIME_INFIX = 'readTime';

const BOOK_SYNCED_FIELDS = ['title', 'filename', 'languageCode'] as const;
type BookField = (typeof BOOK_SYNCED_FIELDS)[number];

const BOOK_READ_STORES = [STORES.BOOKS, STORES.SYNC_META] as const;
const BOOK_APPLY_STORES = [STORES.BOOKS, STORES.PROGRESS, STORES.SYNC_META] as const;
const PROGRESS_READ_STORES = [STORES.PROGRESS, STORES.BOOKS, STORES.SYNC_META] as const;
const PROGRESS_APPLY_STORES = [STORES.PROGRESS, STORES.BOOKS, STORES.SYNC_META] as const;

function bookScopeOf(record: Pick<BookRecord, 'languageCode'>): Scope {
  return record.languageCode ? scopeForTarget(targetOf(record.languageCode)) : 'global';
}

interface BookKeyParts {
  readonly bookId: string;
  readonly field: BookField | null;
}

function parseBookKey(key: RecordKey): BookKeyParts | null {
  if (!key.startsWith(BOOK_PREFIX)) return null;
  const rest = key.slice(BOOK_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return rest.length > 0 ? { bookId: rest, field: null } : null;
  const bookId = rest.slice(0, slash);
  const field = rest.slice(slash + 1);
  if (bookId.length === 0 || field.includes('/')) return null;
  if (!(BOOK_SYNCED_FIELDS as readonly string[]).includes(field)) return null;
  return { bookId, field: field as BookField };
}

interface ProgressKeyParts {
  readonly bookId: string;
  readonly kind: 'position' | 'readTime';
  readonly deviceId?: string;
}

function parseProgressKey(key: RecordKey): ProgressKeyParts | null {
  if (!key.startsWith(PROGRESS_PREFIX)) return null;
  const rest = key.slice(PROGRESS_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  const bookId = rest.slice(0, slash);
  const tail = rest.slice(slash + 1);
  if (bookId.length === 0) return null;
  if (tail === POSITION_SUFFIX) return { bookId, kind: 'position' };
  if (tail.startsWith(`${READ_TIME_INFIX}/`)) {
    const deviceId = tail.slice(READ_TIME_INFIX.length + 1);
    if (deviceId.length === 0 || deviceId.includes('/')) return null;
    return { bookId, kind: 'readTime', deviceId };
  }
  return null;
}

function positionValue(row: ReaderProgressRecord): Record<string, unknown> {
  return {
    paragraphIndex: row.paragraphIndex,
    tokenIndex: row.tokenIndex,
    updatedAt: row.updatedAt,
  };
}

function totalReadTime(row: ReaderProgressRecord): number {
  const buckets = row.readTimeByDevice ?? {};
  const values = Object.values(buckets).filter((v): v is number => Number.isFinite(v));
  if (values.length === 0) return row.readTimeMs ?? 0;
  return values.reduce((sum, v) => sum + v, 0);
}

class ReaderBookSource extends IdbLocalSource {
  readonly dataClass = 'readerBook' as const;
  protected readonly keyPrefix = BOOK_PREFIX;

  protected openDb(): Promise<IDBDatabase> {
    return getReaderDB();
  }

  protected readStores(): readonly string[] {
    return BOOK_READ_STORES;
  }

  protected applyStores(): readonly string[] {
    return BOOK_APPLY_STORES;
  }

  protected snapshotStores(): readonly string[] {
    return BOOK_READ_STORES;
  }

  protected knownKey(key: RecordKey): boolean {
    return parseBookKey(key) !== null;
  }

  protected async readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue> {
    const parts = parseBookKey(key);
    if (!parts) return { found: false };
    const row = await getRowAt<BookRecord>(tx, STORES.BOOKS, parts.bookId);
    if (!row) return { found: false };
    if (parts.field === null) return { found: true, value: row };
    const value: unknown = row[parts.field];
    return value === undefined ? { found: false } : { found: true, value };
  }

  protected async resolveRecords(
    tx: IDBTransaction,
    pending: PendingKey,
    meta: StoredRecordMeta,
    local: LocalValue,
  ): Promise<ChangeRecord[]> {
    const scope = meta.scope ?? pending.scope;
    const parts = parseBookKey(pending.key);
    if (!parts || meta.op === 'delete' || !local.found) {
      return [this.tombstoneRecord(scope, pending.key, meta)];
    }
    if (parts.field !== null) {
      return [this.putRecord(scope, pending.key, meta, local.value)];
    }
    const records: ChangeRecord[] = [
      this.putRecord(scope, pending.key, meta, local.value),
    ];
    const row = local.value as BookRecord;
    for (const field of BOOK_SYNCED_FIELDS) {
      const value: unknown = row[field];
      if (value === undefined) continue;
      const fieldKey = `${pending.key}/${field}`;
      const fieldMeta = await getMetaAt(tx, fieldKey);
      if (fieldMeta?.op === 'delete') continue;
      records.push(this.putRecord(scope, fieldKey, fieldMeta ?? meta, value));
    }
    return records;
  }

  protected async collectSnapshotEntries(
    tx: IDBTransaction,
    scope: Scope,
  ): Promise<SnapshotEntry[]> {
    const rows = await allRowsAt<BookRecord>(tx, STORES.BOOKS);
    const entries: SnapshotEntry[] = [];
    for (const row of rows) {
      if (bookScopeOf(row) !== scope) continue;
      const base = `${BOOK_PREFIX}${row.id}`;
      entries.push({ key: base, metaKey: base, value: row });
      for (const field of BOOK_SYNCED_FIELDS) {
        const value: unknown = row[field];
        if (value === undefined) continue;
        entries.push({ key: `${base}/${field}`, metaKey: base, value });
      }
    }
    return entries;
  }

  protected async scopeOfLocalValue(
    _tx: IDBTransaction,
    _key: RecordKey,
    value: unknown,
  ): Promise<Scope | null> {
    const row = value as BookRecord;
    return bookScopeOf(row);
  }

  protected putMaterializable(record: ChangeRecord): boolean {
    const parts = parseBookKey(record.key);
    if (!parts) return false;
    if (parts.field !== null) return record.value !== undefined;
    const value = record.value;
    if (typeof value !== 'object' || value === null) return false;
    const row = value as Record<string, unknown>;
    return row.id === parts.bookId && typeof row.title === 'string';
  }

  protected async applyCheck(tx: IDBTransaction, record: ChangeRecord): Promise<boolean> {
    const parts = parseBookKey(record.key);
    if (!parts) return false;
    if (parts.field === null) return true;
    if (record.op === 'delete') return true;
    return (await getRowAt<BookRecord>(tx, STORES.BOOKS, parts.bookId)) !== undefined;
  }

  protected async writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    remote: ChangeRecord,
  ): Promise<void> {
    const parts = parseBookKey(winner.key);
    if (!parts) return;
    const store = tx.objectStore(STORES.BOOKS);
    if (parts.field === null) {
      if (winner.op === 'delete') {
        await this.deleteBookCascade(tx, parts.bookId, winner);
        return;
      }
      const incoming = winner.value as Record<string, unknown>;
      const existing = await getRowAt<BookRecord>(tx, STORES.BOOKS, parts.bookId);
      const next: Record<string, unknown> = { ...(existing ?? {}), ...incoming, id: parts.bookId };
      if (existing) {
        await this.overlayWinningFields(tx, next, existing, parts.bookId, remote);
      }
      await idbRequest(store.put(next));
      return;
    }
    const existing = await getRowAt<BookRecord>(tx, STORES.BOOKS, parts.bookId);
    if (!existing) return;
    const next: Record<string, unknown> = { ...existing };
    if (winner.op === 'delete') {
      if (parts.field === 'languageCode') next.languageCode = null;
      else delete next[parts.field];
    } else {
      next[parts.field] = winner.value;
    }
    await idbRequest(store.put(next));
  }

  private async overlayWinningFields(
    tx: IDBTransaction,
    next: Record<string, unknown>,
    existing: BookRecord,
    bookId: string,
    remote: ChangeRecord,
  ): Promise<void> {
    for (const field of BOOK_SYNCED_FIELDS) {
      const meta = await getMetaAt(tx, `${BOOK_PREFIX}${bookId}/${field}`);
      if (!meta) continue;
      if (compareHlc(meta.hlc, remote.hlc) <= 0) continue;
      const localValue: unknown = existing[field];
      if (meta.op === 'delete') {
        if (field === 'languageCode') next.languageCode = null;
        else delete next[field];
        continue;
      }
      if (localValue === undefined) {
        if (field === 'languageCode') next.languageCode = null;
        else delete next[field];
      } else {
        next[field] = localValue;
      }
    }
  }

  private async deleteBookCascade(
    tx: IDBTransaction,
    bookId: string,
    winner: ChangeRecord,
  ): Promise<void> {
    await idbRequest(tx.objectStore(STORES.BOOKS).delete(bookId));
    const progress = await getRowAt<ReaderProgressRecord>(tx, STORES.PROGRESS, bookId);
    await idbRequest(tx.objectStore(STORES.PROGRESS).delete(bookId));
    const leafMetas = await listMetaEntriesIn(tx, `${BOOK_PREFIX}${bookId}/`);
    for (const meta of leafMetas) {
      await tombstoneMetaAt(tx, meta.key, winner.scope, winner.hlc);
    }
    const progressMetas = await listMetaEntriesIn(tx, `${PROGRESS_PREFIX}${bookId}/`);
    const progressKeys = new Set<RecordKey>([`${PROGRESS_PREFIX}${bookId}/position`]);
    for (const meta of progressMetas) progressKeys.add(meta.key);
    for (const deviceId of Object.keys(progress?.readTimeByDevice ?? {})) {
      progressKeys.add(`${PROGRESS_PREFIX}${bookId}/readTime/${deviceId}`);
    }
    for (const key of progressKeys) {
      await tombstoneMetaAt(tx, key, winner.scope, winner.hlc);
    }
  }
}

class ReaderProgressSource extends IdbLocalSource {
  readonly dataClass = 'readerProgress' as const;
  protected readonly keyPrefix = PROGRESS_PREFIX;

  protected openDb(): Promise<IDBDatabase> {
    return getReaderDB();
  }

  protected readStores(): readonly string[] {
    return PROGRESS_READ_STORES;
  }

  protected applyStores(): readonly string[] {
    return PROGRESS_APPLY_STORES;
  }

  protected snapshotStores(): readonly string[] {
    return PROGRESS_READ_STORES;
  }

  protected knownKey(key: RecordKey): boolean {
    return parseProgressKey(key) !== null;
  }

  protected parentKeys(record: ChangeRecord): RecordKey[] {
    const parts = parseProgressKey(record.key);
    return parts ? [`${BOOK_PREFIX}${parts.bookId}`] : [];
  }

  protected async readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue> {
    const parts = parseProgressKey(key);
    if (!parts) return { found: false };
    const row = await getRowAt<ReaderProgressRecord>(tx, STORES.PROGRESS, parts.bookId);
    if (!row) return { found: false };
    if (parts.kind === 'position') return { found: true, value: positionValue(row) };
    const bucket = row.readTimeByDevice?.[parts.deviceId ?? ''];
    return bucket === undefined
      ? { found: false }
      : { found: true, value: bucket };
  }

  protected async collectSnapshotEntries(
    tx: IDBTransaction,
    scope: Scope,
  ): Promise<SnapshotEntry[]> {
    const rows = await allRowsAt<ReaderProgressRecord>(tx, STORES.PROGRESS);
    const entries: SnapshotEntry[] = [];
    for (const row of rows) {
      const rowScope = await this.progressScope(tx, row.bookId);
      if (rowScope === null || rowScope !== scope) continue;
      entries.push({
        key: `${PROGRESS_PREFIX}${row.bookId}/position`,
        metaKey: `${PROGRESS_PREFIX}${row.bookId}/position`,
        value: positionValue(row),
      });
      for (const [deviceId, ms] of Object.entries(row.readTimeByDevice ?? {})) {
        if (!Number.isFinite(ms)) continue;
        entries.push({
          key: `${PROGRESS_PREFIX}${row.bookId}/readTime/${deviceId}`,
          metaKey: `${PROGRESS_PREFIX}${row.bookId}/readTime/${deviceId}`,
          value: ms,
        });
      }
    }
    return entries;
  }

  protected async scopeOfLocalValue(
    tx: IDBTransaction,
    key: RecordKey,
    _value: unknown,
  ): Promise<Scope | null> {
    const parts = parseProgressKey(key);
    if (!parts) return null;
    return this.progressScope(tx, parts.bookId);
  }

  protected putMaterializable(record: ChangeRecord): boolean {
    const parts = parseProgressKey(record.key);
    if (!parts) return false;
    if (parts.kind === 'readTime') {
      return typeof record.value === 'number' && Number.isFinite(record.value);
    }
    const value = record.value;
    if (typeof value !== 'object' || value === null) return false;
    const position = value as Record<string, unknown>;
    return (
      typeof position.paragraphIndex === 'number' &&
      typeof position.tokenIndex === 'number' &&
      typeof position.updatedAt === 'string'
    );
  }

  protected async writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    _remote: ChangeRecord,
  ): Promise<void> {
    const parts = parseProgressKey(winner.key);
    if (!parts) return;
    const store = tx.objectStore(STORES.PROGRESS);
    const existing = await getRowAt<ReaderProgressRecord>(tx, STORES.PROGRESS, parts.bookId);
    if (parts.kind === 'position') {
      if (winner.op === 'delete') {
        await this.deletePosition(tx, parts.bookId, existing, winner);
        return;
      }
      const position = winner.value as {
        paragraphIndex: number;
        tokenIndex: number;
        updatedAt: string;
      };
      const next: ReaderProgressRecord = {
        ...(existing ?? this.emptyProgress(parts.bookId, winner)),
        paragraphIndex: position.paragraphIndex,
        tokenIndex: position.tokenIndex,
        updatedAt: position.updatedAt,
      };
      await idbRequest(store.put(next));
      return;
    }
    const deviceId = parts.deviceId ?? '';
    const buckets: Record<string, number> = { ...(existing?.readTimeByDevice ?? {}) };
    const ownDevice = getDeviceId();
    if (
      existing &&
      existing.readTimeByDevice === undefined &&
      typeof existing.readTimeMs === 'number' &&
      Number.isFinite(existing.readTimeMs) &&
      existing.readTimeMs > 0 &&
      ownDevice &&
      buckets[ownDevice] === undefined
    ) {
      buckets[ownDevice] = existing.readTimeMs;
    }
    if (winner.op === 'delete') {
      delete buckets[deviceId];
    } else {
      buckets[deviceId] = winner.value as number;
    }
    const hasBuckets = Object.keys(buckets).length > 0;
    if (!hasBuckets) {
      const positionMeta = await getMetaAt(tx, `${PROGRESS_PREFIX}${parts.bookId}/position`);
      if (!existing || positionMeta?.op !== 'put') {
        if (existing) await idbRequest(store.delete(parts.bookId));
        return;
      }
    }
    const next: ReaderProgressRecord = {
      ...(existing ?? this.emptyProgress(parts.bookId, winner)),
      readTimeByDevice: buckets,
      readTimeMs: Object.values(buckets).reduce((sum, v) => sum + v, 0),
    };
    await idbRequest(store.put(next));
  }

  private async deletePosition(
    tx: IDBTransaction,
    bookId: string,
    existing: ReaderProgressRecord | undefined,
    winner: ChangeRecord,
  ): Promise<void> {
    if (!existing) return;
    const buckets = existing.readTimeByDevice ?? {};
    const store = tx.objectStore(STORES.PROGRESS);
    if (Object.keys(buckets).length === 0) {
      await idbRequest(store.delete(bookId));
      return;
    }
    const next: ReaderProgressRecord = {
      bookId,
      paragraphIndex: 0,
      tokenIndex: 0,
      updatedAt: new Date(winner.hlc.wall).toISOString(),
      readTimeByDevice: buckets,
      readTimeMs: totalReadTime({ ...existing, readTimeByDevice: buckets }),
    };
    await idbRequest(store.put(next));
  }

  private emptyProgress(bookId: string, record: ChangeRecord): ReaderProgressRecord {
    return {
      bookId,
      paragraphIndex: 0,
      tokenIndex: 0,
      updatedAt: new Date(record.hlc.wall).toISOString(),
      readTimeByDevice: {},
      readTimeMs: 0,
    };
  }

  private async progressScope(tx: IDBTransaction, bookId: string): Promise<Scope | null> {
    const book = await getRowAt<BookRecord>(tx, STORES.BOOKS, bookId);
    if (book) return bookScopeOf(book);
    const meta = await getMetaAt(tx, `${PROGRESS_PREFIX}${bookId}/position`);
    if (meta) return meta.scope;
    const metas = await listMetaEntriesIn(tx, `${PROGRESS_PREFIX}${bookId}/`);
    return metas[0]?.scope ?? null;
  }
}

export function createReaderLocalSource(dataClass: ReaderDataClass): LocalSource {
  if (dataClass === 'readerBook') return new ReaderBookSource();
  if (dataClass === 'readerProgress') return new ReaderProgressSource();
  throw new Error(`Unknown reader data class: ${dataClass}`);
}
