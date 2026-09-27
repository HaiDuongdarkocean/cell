import { compareHlc, hlcEq } from '../../../domain/hlc';
import { mergeRecord, sortRecordsForApply } from '../../../domain/merge';
import { parentRecordKeys } from '../../../domain/opaqueRecords';
import { stableHash } from '../../../domain/stableHash';
import type {
  ChangeRecord,
  DataClass,
  PendingKey,
  RecordKey,
  Scope,
} from '../../../domain/types';
import type { ApplyResult, LocalSource } from '../../../ports/localSource';
import {
  deleteOpaqueRecord,
  getOpaqueRecord,
  opaqueRecordKey,
  putOpaqueRecord,
} from '../syncDb';
import {
  SYNC_META,
  ensureSyncRuntime,
  mintRecordHlc,
  stampRemoteMeta,
} from './capture';
import type { StoredRecordMeta } from './capture';
import {
  awaitIdbTx,
  getMetaAt,
  getMetaByRecKeyAt,
  listMetaEntriesIn,
  listPending,
  deleteOutboxEntries,
  metaChangeRecord,
} from './outbox';

export interface LocalValue {
  readonly found: boolean;
  readonly value?: unknown;
}

export interface SnapshotEntry {
  readonly key: RecordKey;
  readonly metaKey: RecordKey;
  readonly value: unknown;
}

export type ApplyDisposition = 'apply' | 'opaque';

export abstract class IdbLocalSource implements LocalSource {
  abstract readonly dataClass: DataClass;

  protected abstract readonly keyPrefix: string;
  protected abstract openDb(): Promise<IDBDatabase>;
  protected abstract readStores(): readonly string[];
  protected abstract applyStores(): readonly string[];
  protected abstract snapshotStores(): readonly string[];

  private readonly drainedRowIds = new Map<string, number[]>();

  async pending(limit: number): Promise<PendingKey[]> {
    const db = await this.openDb();
    const drains = await listPending(db, this.keyPrefix, limit);
    for (const drain of drains) {
      const ledgerKey = `${drain.pending.scope} ${drain.pending.key}`;
      const known = this.drainedRowIds.get(ledgerKey) ?? [];
      for (const id of drain.rowIds) {
        if (!known.includes(id)) known.push(id);
      }
      this.drainedRowIds.set(ledgerKey, known);
    }
    return drains.map((drain) => drain.pending);
  }

  async ack(keys: PendingKey[]): Promise<void> {
    const rowIds: number[] = [];
    for (const key of keys) {
      const ledgerKey = `${key.scope} ${key.key}`;
      const ids = this.drainedRowIds.get(ledgerKey);
      if (ids) rowIds.push(...ids);
      this.drainedRowIds.delete(ledgerKey);
    }
    if (rowIds.length === 0) return;
    const db = await this.openDb();
    await deleteOutboxEntries(db, rowIds);
  }

  async resolve(keys: PendingKey[]): Promise<ChangeRecord[]> {
    const db = await this.openDb();
    const tx = db.transaction([...this.readStores()], 'readonly');
    const byKey = new Map<RecordKey, ChangeRecord>();
    for (const pending of keys) {
      if (pending.dataClass !== this.dataClass) continue;
      const meta = await getMetaAt(tx, pending.key, pending.scope);
      if (!meta) continue;
      const local = await this.readLocalValue(tx, pending.key);
      for (const record of await this.resolveRecords(tx, pending, meta, local)) {
        byKey.set(record.key, record);
      }
    }
    await awaitIdbTx(tx);
    return [...byKey.values()];
  }

  async current(scope: Scope, keys: RecordKey[]): Promise<Map<RecordKey, ChangeRecord | null>> {
    const out = new Map<RecordKey, ChangeRecord | null>();
    await ensureSyncRuntime();
    const db = await this.openDb();
    const tx = db.transaction([...this.readStores()], 'readonly');
    for (const key of keys) {
      if (!this.knownKey(key)) {
        out.set(key, null);
        continue;
      }
      const meta = await getMetaAt(tx, key, scope);
      if (meta?.op === 'delete') {
        out.set(key, metaChangeRecord(scope, this.dataClass, key, meta));
        continue;
      }
      const local = await this.readLocalValue(tx, key);
      if (meta) {
        out.set(
          key,
          local.found ? metaChangeRecord(scope, this.dataClass, key, meta, local.value) : null,
        );
        continue;
      }
      if (!local.found) {
        out.set(key, null);
        continue;
      }
      const localScope = await this.scopeOfLocalValue(tx, key, local.value);
      if (localScope !== scope) {
        out.set(key, null);
        continue;
      }
      const hlc = await mintRecordHlc();
      out.set(
        key,
        metaChangeRecord(scope, this.dataClass, key, { hlc, firstHlc: hlc, op: 'put' }, local.value),
      );
    }
    await awaitIdbTx(tx);
    return out;
  }

  async *snapshot(scope: Scope): AsyncIterable<ChangeRecord> {
    const db = await this.openDb();
    await ensureSyncRuntime();
    const rtx = db.transaction([...this.snapshotStores()], 'readonly');
    const entries = await this.collectSnapshotEntries(rtx, scope);
    const metas = (await listMetaEntriesIn(rtx, this.keyPrefix)).filter(
      (meta) => meta.scope === scope,
    );
    await awaitIdbTx(rtx);
    const metaByKey = new Map<RecordKey, StoredRecordMeta>(metas.map((m) => [m.recKey, m]));
    const minted = new Map<RecordKey, StoredRecordMeta>();
    for (const entry of entries) {
      if (metaByKey.has(entry.key) || metaByKey.has(entry.metaKey) || minted.has(entry.metaKey)) {
        continue;
      }
      const hlc = await mintRecordHlc();
      minted.set(entry.metaKey, {
        key: entry.metaKey,
        recKey: entry.metaKey,
        scope,
        hlc,
        firstHlc: hlc,
        op: 'put',
      });
    }
    for (const [metaKey, meta] of minted) metaByKey.set(metaKey, meta);
    const records = new Map<RecordKey, ChangeRecord>();
    for (const entry of entries) {
      const meta = metaByKey.get(entry.key) ?? metaByKey.get(entry.metaKey);
      if (!meta) continue;
      records.set(
        entry.key,
        metaChangeRecord(scope, this.dataClass, entry.key, meta, entry.value),
      );
    }
    for (const meta of metas) {
      if (meta.op === 'delete' || !records.has(meta.recKey)) {
        records.set(
          meta.recKey,
          metaChangeRecord(scope, this.dataClass, meta.recKey, { ...meta, op: 'delete' }),
        );
      }
    }
    for (const record of records.values()) yield record;
  }

  async stampCommitted(records: readonly ChangeRecord[]): Promise<void> {
    if (records.length === 0) return;
    const db = await this.openDb();
    const tx = db.transaction([SYNC_META], 'readwrite');
    const store = tx.objectStore(SYNC_META);
    for (const record of records) {
      if (record.dataClass !== this.dataClass) continue;
      await stampRemoteMeta(store, record.key, {
        scope: record.scope,
        hlc: record.hlc,
        firstHlc: record.firstHlc ?? record.hlc,
        op: record.op,
        valueHash: record.op === 'put' ? stableHash(record.value) : undefined,
      });
    }
    await awaitIdbTx(tx);
  }

  async applyRemote(records: ChangeRecord[]): Promise<ApplyResult> {
    const applied: ChangeRecord[] = [];
    const localWon: ChangeRecord[] = [];
    const opaque: ChangeRecord[] = [];
    const mine = sortRecordsForApply(
      records.filter((record) => record.dataClass === this.dataClass),
    );
    if (mine.length === 0) return { applied, localWon, opaque };
    await ensureSyncRuntime();
    const db = await this.openDb();

    const candidates: ChangeRecord[] = [];
    const preOpaque: ChangeRecord[] = [];
    const rtx = db.transaction([...this.applyStores()], 'readonly');
    for (const record of mine) {
      const verdict = await this.applyDisposition(rtx, record);
      (verdict === 'apply' ? candidates : preOpaque).push(record);
    }
    await awaitIdbTx(rtx);
    for (const record of preOpaque) {
      await this.retainOpaque(record);
      opaque.push(record);
    }

    const lateOpaque: ChangeRecord[] = [];
    const supersededOpaque: { scope: Scope; key: RecordKey; hlc: ChangeRecord['hlc'] }[] = [];
    const wtx = db.transaction([...this.applyStores()], 'readwrite');
    const stampStore = wtx.objectStore(SYNC_META);
    for (const record of candidates) {
      if ((await this.applyDisposition(wtx, record)) !== 'apply') {
        lateOpaque.push(record);
        continue;
      }
      const local = await this.localRecordForMerge(wtx, record);
      const winner = mergeRecord(local, record);
      if (winner === null || winner === local) {
        localWon.push(record);
        continue;
      }
      await this.writeRemote(wtx, winner, record);
      await stampRemoteMeta(stampStore, record.key, {
        scope: record.scope,
        hlc: winner.hlc,
        firstHlc: winner.firstHlc ?? winner.hlc,
        op: winner.op,
        valueHash: winner.op === 'put' ? stableHash(winner.value) : undefined,
      });
      supersededOpaque.push({ scope: record.scope, key: record.key, hlc: winner.hlc });
      if (winner === record || hlcEq(winner.hlc, record.hlc)) {
        applied.push(record);
      } else {
        localWon.push(record);
      }
    }
    await awaitIdbTx(wtx);
    for (const record of lateOpaque) {
      await this.retainOpaque(record);
      opaque.push(record);
    }
    for (const entry of supersededOpaque) {
      const row = await getOpaqueRecord(opaqueRecordKey(entry.scope, entry.key));
      if (row && compareHlc(row.record.hlc, entry.hlc) < 0) {
        await deleteOpaqueRecord(row.key);
      }
    }
    return { applied, localWon, opaque };
  }

  private async retainOpaque(record: ChangeRecord): Promise<void> {
    const row = await getOpaqueRecord(opaqueRecordKey(record.scope, record.key));
    if (row && compareHlc(row.record.hlc, record.hlc) >= 0) return;
    await putOpaqueRecord(record);
  }

  private async applyDisposition(
    tx: IDBTransaction,
    record: ChangeRecord,
  ): Promise<ApplyDisposition> {
    if (!this.knownKey(record.key)) return 'opaque';
    if (record.op === 'put' && !this.putMaterializable(record)) return 'opaque';
    if (record.op === 'put' && (await this.parentTombstoned(tx, record))) return 'opaque';
    if (!(await this.applyCheck(tx, record))) return 'opaque';
    return 'apply';
  }

  private async parentTombstoned(tx: IDBTransaction, record: ChangeRecord): Promise<boolean> {
    const keys = [...parentRecordKeys(record.key), ...this.parentKeys(record)];
    for (const parentKey of keys) {
      const meta = await getMetaAt(tx, parentKey, record.scope);
      if (meta?.op === 'delete') return true;
    }
    return false;
  }

  private async localRecordForMerge(
    tx: IDBTransaction,
    record: ChangeRecord,
  ): Promise<ChangeRecord | null> {
    const meta =
      (await getMetaAt(tx, record.key, record.scope)) ??
      (await this.sameScopeOrOrphanMeta(tx, record));
    if (meta?.op === 'delete') {
      return metaChangeRecord(record.scope, this.dataClass, record.key, meta);
    }
    const local = await this.readLocalValue(tx, record.key);
    if (meta) {
      return local.found
        ? metaChangeRecord(record.scope, this.dataClass, record.key, meta, local.value)
        : null;
    }
    if (!local.found) return null;
    const scope = await this.scopeOfLocalValue(tx, record.key, local.value);
    if (scope !== null && scope !== record.scope) return null;
    const hlc = await mintRecordHlc();
    const stamped = await stampRemoteMeta(tx.objectStore(SYNC_META), record.key, {
      scope: record.scope,
      hlc,
      firstHlc: hlc,
      op: 'put',
      valueHash: stableHash(local.value),
    });
    return metaChangeRecord(record.scope, this.dataClass, record.key, stamped, local.value);
  }

  private async sameScopeOrOrphanMeta(
    tx: IDBTransaction,
    record: ChangeRecord,
  ): Promise<StoredRecordMeta | undefined> {
    const metas = await getMetaByRecKeyAt(tx, record.key);
    return metas.find((meta) => meta.scope === null);
  }

  protected tombstoneRecord(scope: Scope, key: RecordKey, meta: StoredRecordMeta): ChangeRecord {
    return metaChangeRecord(scope, this.dataClass, key, { ...meta, op: 'delete' });
  }

  protected putRecord(
    scope: Scope,
    key: RecordKey,
    meta: StoredRecordMeta,
    value: unknown,
  ): ChangeRecord {
    return metaChangeRecord(scope, this.dataClass, key, { ...meta, op: 'put' }, value);
  }

  protected abstract readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue>;

  protected async resolveRecords(
    _tx: IDBTransaction,
    pending: PendingKey,
    meta: StoredRecordMeta,
    local: LocalValue,
  ): Promise<ChangeRecord[]> {
    const scope = meta.scope ?? pending.scope;
    if (meta.op === 'delete' || !local.found) {
      return [this.tombstoneRecord(scope, pending.key, meta)];
    }
    return [this.putRecord(scope, pending.key, meta, local.value)];
  }

  protected abstract collectSnapshotEntries(
    tx: IDBTransaction,
    scope: Scope,
  ): Promise<SnapshotEntry[]>;

  protected abstract scopeOfLocalValue(
    tx: IDBTransaction,
    key: RecordKey,
    value: unknown,
  ): Promise<Scope | null>;

  protected abstract knownKey(key: RecordKey): boolean;

  protected parentKeys(_record: ChangeRecord): RecordKey[] {
    return [];
  }

  protected abstract putMaterializable(record: ChangeRecord): boolean;

  protected async applyCheck(_tx: IDBTransaction, _record: ChangeRecord): Promise<boolean> {
    return true;
  }

  protected abstract writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    remote: ChangeRecord,
  ): Promise<void>;
}
