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
  getMetaAt,
  idbRequest,
  listMetaEntriesIn,
  scopeForTarget,
  targetOf,
  tombstoneMetaAt,
} from '@/features/sync';
import type { ResourceInfo, WordStatus } from '@/entities/dictionary';
import type { WordStatusEntry } from '../services/wordStatusStore';
import { getDB, INDEXES, STORES } from '../repositories/baseRepository';

export type DictDataClass = 'dictResource' | 'wordStatus';

const RESOURCE_PREFIX = 'resource:';
const WORD_PREFIX = 'word:';

const RESOURCE_SYNCED_FIELDS = [
  'name',
  'enabled',
  'priority',
  'profileIds',
  'disabledComponents',
] as const;

type ResourceField = (typeof RESOURCE_SYNCED_FIELDS)[number];

const ALL_WORD_STATUSES: readonly WordStatus[] = ['tracking', 'known', 'ignore', 'unknown'];

interface ResourceKeyParts {
  readonly signature: string;
  readonly field: ResourceField | null;
}

function parseResourceKey(key: RecordKey): ResourceKeyParts | null {
  if (!key.startsWith(RESOURCE_PREFIX)) return null;
  const rest = key.slice(RESOURCE_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return rest.length > 0 ? { signature: rest, field: null } : null;
  const signature = rest.slice(0, slash);
  const field = rest.slice(slash + 1);
  if (signature.length === 0 || field.includes('/')) return null;
  if (!(RESOURCE_SYNCED_FIELDS as readonly string[]).includes(field)) return null;
  return { signature, field: field as ResourceField };
}

function stripLocalId(row: ResourceInfo): Record<string, unknown> {
  const { id: _id, ...rest } = row;
  return rest;
}

const RESOURCE_READ_STORES = [STORES.RESOURCE, STORES.SYNC_META] as const;
const RESOURCE_APPLY_STORES = [
  STORES.RESOURCE,
  STORES.DICTIONARY,
  STORES.FREQUENCY,
  STORES.PHRASE_INDEX,
  STORES.SYNC_META,
] as const;
const WORD_STATUS_READ_STORES = [STORES.WORD_STATUS, STORES.SYNC_META] as const;
const WORD_STATUS_APPLY_STORES = [
  STORES.WORD_STATUS,
  STORES.WORD_TRASH,
  STORES.SYNC_META,
] as const;

abstract class DictLocalSource extends IdbLocalSource {
  protected readonly langScope: Scope;

  constructor(
    readonly dataClass: DictDataClass,
    protected readonly langCode: string,
  ) {
    super();
    this.langScope = scopeForTarget(targetOf(langCode));
  }

  protected openDb(): Promise<IDBDatabase> {
    return getDB(this.langCode);
  }

  protected async scopeOfLocalValue(): Promise<Scope | null> {
    return this.langScope;
  }
}

class DictResourceSource extends DictLocalSource {
  protected readonly keyPrefix = RESOURCE_PREFIX;

  protected readStores(): readonly string[] {
    return RESOURCE_READ_STORES;
  }

  protected applyStores(): readonly string[] {
    return RESOURCE_APPLY_STORES;
  }

  protected snapshotStores(): readonly string[] {
    return RESOURCE_READ_STORES;
  }

  protected knownKey(key: RecordKey): boolean {
    return parseResourceKey(key) !== null;
  }

  protected async readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue> {
    const parts = parseResourceKey(key);
    if (!parts) return { found: false };
    const row = await this.resourceBySignature(tx, parts.signature);
    if (!row) return { found: false };
    if (parts.field === null) return { found: true, value: stripLocalId(row) };
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
    const parts = parseResourceKey(pending.key);
    if (!parts || meta.op === 'delete' || !local.found) {
      return [this.tombstoneRecord(scope, pending.key, meta)];
    }
    if (parts.field !== null) {
      return [this.putRecord(scope, pending.key, meta, local.value)];
    }
    const records: ChangeRecord[] = [
      this.putRecord(scope, pending.key, meta, local.value),
    ];
    const row = local.value as ResourceInfo;
    for (const field of RESOURCE_SYNCED_FIELDS) {
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
    if (scope !== this.langScope) return [];
    const rows = await allRowsAt<ResourceInfo>(tx, STORES.RESOURCE);
    const entries: SnapshotEntry[] = [];
    for (const row of rows) {
      const base = `${RESOURCE_PREFIX}${row.signature}`;
      entries.push({ key: base, metaKey: base, value: stripLocalId(row) });
      for (const field of RESOURCE_SYNCED_FIELDS) {
        const value: unknown = row[field];
        if (value === undefined) continue;
        entries.push({ key: `${base}/${field}`, metaKey: base, value });
      }
    }
    return entries;
  }

  protected putMaterializable(record: ChangeRecord): boolean {
    const parts = parseResourceKey(record.key);
    if (!parts) return false;
    if (parts.field !== null) return record.value !== undefined;
    const value = record.value;
    if (typeof value !== 'object' || value === null) return false;
    const row = value as Record<string, unknown>;
    return row.signature === parts.signature && typeof row.name === 'string';
  }

  protected async applyCheck(tx: IDBTransaction, record: ChangeRecord): Promise<boolean> {
    const parts = parseResourceKey(record.key);
    if (!parts) return false;
    if (parts.field === null) return true;
    if (record.op === 'delete') return true;
    return (await this.resourceBySignature(tx, parts.signature)) !== undefined;
  }

  protected async writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    remote: ChangeRecord,
  ): Promise<void> {
    const parts = parseResourceKey(winner.key);
    if (!parts) return;
    const store = tx.objectStore(STORES.RESOURCE);
    const existing = await this.resourceBySignature(tx, parts.signature);
    if (parts.field === null) {
      if (winner.op === 'delete') {
        await this.deleteResourceCascade(tx, existing, winner);
        return;
      }
      const incoming = winner.value as Record<string, unknown>;
      const next: Record<string, unknown> = { ...(existing ?? {}), ...incoming };
      delete next.id;
      if (existing?.id !== undefined) next.id = existing.id;
      if (existing) {
        await this.overlayWinningFields(tx, next, existing, parts.signature, remote);
      }
      await idbRequest(store.put(next));
      return;
    }
    if (!existing) return;
    const next: Record<string, unknown> = { ...existing };
    if (winner.op === 'delete') {
      delete next[parts.field];
    } else {
      next[parts.field] = winner.value;
    }
    await idbRequest(store.put(next));
  }

  private async overlayWinningFields(
    tx: IDBTransaction,
    next: Record<string, unknown>,
    existing: ResourceInfo,
    signature: string,
    remote: ChangeRecord,
  ): Promise<void> {
    for (const field of RESOURCE_SYNCED_FIELDS) {
      const meta = await getMetaAt(tx, `${RESOURCE_PREFIX}${signature}/${field}`);
      if (!meta) continue;
      if (compareHlc(meta.hlc, remote.hlc) <= 0) continue;
      const localValue: unknown = existing[field];
      if (meta.op === 'delete' || localValue === undefined) {
        delete next[field];
      } else {
        next[field] = localValue;
      }
    }
  }

  private async deleteResourceCascade(
    tx: IDBTransaction,
    existing: ResourceInfo | undefined,
    winner: ChangeRecord,
  ): Promise<void> {
    const signature = winner.key.slice(RESOURCE_PREFIX.length);
    const leafMetas = await listMetaEntriesIn(tx, `${RESOURCE_PREFIX}${signature}/`);
    for (const meta of leafMetas) {
      await tombstoneMetaAt(tx, meta.key, winner.scope, winner.hlc);
    }
    if (!existing) return;
    if (existing.id !== undefined) {
      await this.deleteByResourceId(tx, STORES.DICTIONARY, existing.id);
      await this.deleteByResourceId(tx, STORES.FREQUENCY, existing.id);
      await idbRequest(tx.objectStore(STORES.PHRASE_INDEX).delete(existing.id));
      await idbRequest(tx.objectStore(STORES.RESOURCE).delete(existing.id));
    }
  }

  private async deleteByResourceId(
    tx: IDBTransaction,
    storeName: string,
    resourceId: number,
  ): Promise<void> {
    const store = tx.objectStore(storeName);
    const keys = await idbRequest(
      store.index(INDEXES.by_resource).getAllKeys(resourceId),
    );
    for (const key of keys) {
      store.delete(key);
    }
  }

  private async resourceBySignature(
    tx: IDBTransaction,
    signature: string,
  ): Promise<ResourceInfo | undefined> {
    return idbRequest(
      tx
        .objectStore(STORES.RESOURCE)
        .index(INDEXES.by_signature)
        .get(signature) as IDBRequest<ResourceInfo | undefined>,
    );
  }
}

class WordStatusSource extends DictLocalSource {
  protected readonly keyPrefix = WORD_PREFIX;

  protected readStores(): readonly string[] {
    return WORD_STATUS_READ_STORES;
  }

  protected applyStores(): readonly string[] {
    return WORD_STATUS_APPLY_STORES;
  }

  protected snapshotStores(): readonly string[] {
    return WORD_STATUS_READ_STORES;
  }

  protected knownKey(key: RecordKey): boolean {
    return key.startsWith(WORD_PREFIX) && key.length > WORD_PREFIX.length;
  }

  protected async readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue> {
    const term = key.slice(WORD_PREFIX.length);
    const row = await idbRequest(
      tx.objectStore(STORES.WORD_STATUS).get(term) as IDBRequest<WordStatusEntry | undefined>,
    );
    return row === undefined ? { found: false } : { found: true, value: row };
  }

  protected async collectSnapshotEntries(
    tx: IDBTransaction,
    scope: Scope,
  ): Promise<SnapshotEntry[]> {
    if (scope !== this.langScope) return [];
    const rows = await allRowsAt<WordStatusEntry>(tx, STORES.WORD_STATUS);
    return rows
      .filter((row) => row.status !== 'unknown')
      .map((row) => ({
        key: `${WORD_PREFIX}${row.term}`,
        metaKey: `${WORD_PREFIX}${row.term}`,
        value: row,
      }));
  }

  protected putMaterializable(record: ChangeRecord): boolean {
    const term = record.key.slice(WORD_PREFIX.length);
    const value = record.value;
    if (typeof value !== 'object' || value === null) return false;
    const row = value as Record<string, unknown>;
    return row.term === term && (ALL_WORD_STATUSES as readonly string[]).includes(row.status as string);
  }

  protected async writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    _remote: ChangeRecord,
  ): Promise<void> {
    const term = winner.key.slice(WORD_PREFIX.length);
    const statusStore = tx.objectStore(STORES.WORD_STATUS);
    const trashStore = tx.objectStore(STORES.WORD_TRASH);
    if (winner.op === 'delete') {
      await idbRequest(statusStore.delete(term));
      await idbRequest(trashStore.delete(term));
      return;
    }
    const value = winner.value as WordStatusEntry;
    if (value.status === 'unknown') {
      await idbRequest(statusStore.delete(term));
      return;
    }
    await idbRequest(trashStore.delete(term));
    await idbRequest(
      statusStore.put({
        term,
        status: value.status,
        updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
      }),
    );
  }
}

export function createDictLocalSource(
  langCode: string,
  dataClass: DictDataClass,
): LocalSource {
  if (dataClass === 'dictResource') return new DictResourceSource('dictResource', langCode);
  if (dataClass === 'wordStatus') return new WordStatusSource('wordStatus', langCode);
  throw new Error(`Unknown dictionary data class: ${dataClass}`);
}
