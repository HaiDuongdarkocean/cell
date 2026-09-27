import { persistSyncedSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS } from '@/shared/config/config';
import { isPlainJsonObject, jsonEquals, nextFirstHlc } from '../../../domain/flatten';
import { mergeRecord, PROFILE_EXISTENCE_KEY } from '../../../domain/merge';
import {
  SETTINGS_FIELD_REGISTRY,
  SYNCED_KV_REGISTRIES,
} from '../../../domain/settingsRegistry';
import type {
  ChangeRecord,
  DataClass,
  Hlc,
  PendingKey,
  RecordKey,
  Scope,
} from '../../../domain/types';
import type { KeyValueStore } from '../../../ports/keyValueStore';
import type { ApplyResult, LocalSource } from '../../../ports/localSource';
import { appendConflictLog } from './conflictLog';
import type { ConflictLogEntry } from './conflictLog';
import { SYNC_DIRECTORY_STORAGE_KEY, SYNC_META_KV_STORAGE_KEY } from './keys';
import { kvMetaKey, parseKvMetaKey, readSyncMetaKV, stampKvMeta } from './kvMeta';
import type { KvRecordMeta, SyncMetaKV } from './kvMeta';
import { directoryKvSlice, flattenedKvSlice, profilesKvSlice } from './kvSlices';
import type { KvSlice, ScopedLeaf, SliceMergeHelpers } from './kvSlices';
import { kvValueHash } from './valueHash';

export type KvDataClass = 'settings' | 'secondaryKey' | 'syncDirectory' | 'profileConfig';

export const KV_DATA_CLASSES: readonly KvDataClass[] = [
  'settings',
  'secondaryKey',
  'syncDirectory',
  'profileConfig',
];

export type KvValueWriter = (value: unknown) => Promise<void>;

export interface KvLocalSourceDeps {
  readonly kv: KeyValueStore;
  readonly tick: () => Hlc;
  readonly now?: () => number;
  readonly writers?: Partial<Record<string, KvValueWriter>>;
}

export interface KvLocalSource extends LocalSource {
  stampCommitted(records: readonly ChangeRecord[]): Promise<void>;
}

interface LeafEntry extends ScopedLeaf {
  readonly hash: string;
}

interface SliceState {
  readonly slice: KvSlice;
  readonly value: unknown;
  readonly leafMap: Map<string, LeafEntry>;
}

const SECONDARY_STORAGE_KEYS: readonly string[] = Object.keys(SYNCED_KV_REGISTRIES).filter(
  (key) => key !== STORAGE_KEYS.SETTINGS,
);

function comparePending(a: PendingKey, b: PendingKey): number {
  if (a.scope !== b.scope) return a.scope < b.scope ? -1 : 1;
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return a.op === b.op ? 0 : a.op === 'put' ? -1 : 1;
}

class KvLocalSourceImpl implements KvLocalSource {
  private readonly resolvedRecords = new Map<string, ChangeRecord>();

  constructor(
    readonly dataClass: DataClass,
    private readonly slices: readonly KvSlice[],
    private readonly deps: KvLocalSourceDeps,
  ) {}

  private mint(): Hlc {
    return this.deps.tick();
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private async writeSliceValue(slice: KvSlice, value: unknown): Promise<void> {
    const writer = this.deps.writers?.[slice.storageKey];
    if (writer !== undefined) {
      await writer(value);
      return;
    }
    if (slice.writeVia === 'settings') {
      await persistSyncedSettings(isPlainJsonObject(value) ? value : {});
      return;
    }
    if (value === undefined) {
      await this.deps.kv.del('local', slice.storageKey);
    } else {
      await this.deps.kv.set('local', slice.storageKey, value);
    }
  }

  private async sliceStates(): Promise<SliceState[]> {
    return Promise.all(
      this.slices.map(async (slice) => {
        const value = await this.deps.kv.get('local', slice.storageKey);
        const leafMap = new Map<string, LeafEntry>();
        for (const leaf of slice.leaves(value)) {
          leafMap.set(kvMetaKey(leaf.scope, leaf.key), {
            ...leaf,
            hash: await kvValueHash(leaf.value),
          });
        }
        return { slice, value, leafMap };
      }),
    );
  }

  private effectiveRecord(
    scope: Scope,
    key: RecordKey,
    leaf: LeafEntry | undefined,
    meta: KvRecordMeta | undefined,
  ): ChangeRecord | null {
    if (leaf !== undefined) {
      if (
        meta !== undefined &&
        meta.op === 'put' &&
        meta.suppressed !== true &&
        meta.valueHash === leaf.hash
      ) {
        return {
          scope,
          dataClass: this.dataClass,
          key,
          op: 'put',
          value: leaf.value,
          hlc: meta.hlc,
          firstHlc: meta.firstHlc ?? meta.hlc,
        };
      }
      const hlc = this.mint();
      return {
        scope,
        dataClass: this.dataClass,
        key,
        op: 'put',
        value: leaf.value,
        hlc,
        firstHlc: nextFirstHlc(meta, hlc),
      };
    }
    if (meta === undefined) return null;
    if (meta.op === 'delete' || meta.suppressed === true) {
      return {
        scope,
        dataClass: this.dataClass,
        key,
        op: meta.op,
        hlc: meta.hlc,
        firstHlc: meta.firstHlc,
      };
    }
    const hlc = this.mint();
    return {
      scope,
      dataClass: this.dataClass,
      key,
      op: 'delete',
      hlc,
      firstHlc: meta.firstHlc ?? meta.hlc,
    };
  }

  private static isDrifted(leaf: LeafEntry | undefined, meta: KvRecordMeta | undefined): boolean {
    if (leaf === undefined) {
      return meta !== undefined && meta.op === 'put' && meta.suppressed !== true;
    }
    return (
      meta === undefined ||
      meta.op !== 'put' ||
      meta.suppressed === true ||
      meta.valueHash !== leaf.hash
    );
  }

  private stateOf(states: readonly SliceState[], scope: Scope, key: RecordKey): SliceState | undefined {
    return states.find((state) => state.slice.ownsRecord(scope, key));
  }

  async pending(limit: number): Promise<PendingKey[]> {
    const meta = await readSyncMetaKV(this.deps.kv);
    const states = await this.sliceStates();
    const out: PendingKey[] = [];
    for (const { leafMap } of states) {
      for (const leaf of leafMap.values()) {
        const row = meta[kvMetaKey(leaf.scope, leaf.key)];
        if (KvLocalSourceImpl.isDrifted(leaf, row)) {
          out.push({ scope: leaf.scope, dataClass: this.dataClass, key: leaf.key, op: 'put' });
        }
      }
    }
    for (const [metaKey, row] of Object.entries(meta)) {
      if (row.op !== 'put' || row.suppressed === true) continue;
      const parsed = parseKvMetaKey(metaKey);
      if (parsed === null) continue;
      const state = this.stateOf(states, parsed.scope, parsed.key);
      if (state === undefined || state.leafMap.has(metaKey)) continue;
      out.push({ scope: parsed.scope, dataClass: this.dataClass, key: parsed.key, op: 'delete' });
    }
    out.sort(comparePending);
    return out.slice(0, Math.max(0, limit));
  }

  async resolve(keys: PendingKey[]): Promise<ChangeRecord[]> {
    const meta = await readSyncMetaKV(this.deps.kv);
    const states = await this.sliceStates();
    const records: ChangeRecord[] = [];
    for (const pendingKey of keys) {
      if (pendingKey.dataClass !== this.dataClass) continue;
      const state = this.stateOf(states, pendingKey.scope, pendingKey.key);
      if (state === undefined) continue;
      const metaKey = kvMetaKey(pendingKey.scope, pendingKey.key);
      const leaf = state.leafMap.get(metaKey);
      const row = meta[metaKey];
      const hlc = this.mint();
      const record: ChangeRecord =
        leaf !== undefined
          ? {
              scope: pendingKey.scope,
              dataClass: this.dataClass,
              key: pendingKey.key,
              op: 'put',
              value: leaf.value,
              hlc,
              firstHlc: nextFirstHlc(row, hlc),
            }
          : {
              scope: pendingKey.scope,
              dataClass: this.dataClass,
              key: pendingKey.key,
              op: 'delete',
              hlc,
              firstHlc: row?.firstHlc ?? row?.hlc,
            };
      records.push(record);
      this.resolvedRecords.set(metaKey, record);
    }
    return records;
  }

  async ack(keys: PendingKey[]): Promise<void> {
    const records: ChangeRecord[] = [];
    for (const pendingKey of keys) {
      const metaKey = kvMetaKey(pendingKey.scope, pendingKey.key);
      const record = this.resolvedRecords.get(metaKey);
      if (record !== undefined) {
        records.push(record);
        this.resolvedRecords.delete(metaKey);
      }
    }
    await stampKvMeta(this.deps.kv, records);
  }

  async stampCommitted(records: readonly ChangeRecord[]): Promise<void> {
    await stampKvMeta(
      this.deps.kv,
      records.filter((record) => record.dataClass === this.dataClass),
    );
  }

  async *snapshot(scope: Scope): AsyncIterable<ChangeRecord> {
    const meta = await readSyncMetaKV(this.deps.kv);
    const states = await this.sliceStates();
    const emit: ChangeRecord[] = [];
    for (const { slice, leafMap } of states) {
      for (const leaf of leafMap.values()) {
        if (leaf.scope !== scope) continue;
        const row = meta[kvMetaKey(scope, leaf.key)];
        if (
          row !== undefined &&
          row.op === 'put' &&
          row.suppressed !== true &&
          row.valueHash === leaf.hash
        ) {
          emit.push({
            scope,
            dataClass: this.dataClass,
            key: leaf.key,
            op: 'put',
            value: leaf.value,
            hlc: row.hlc,
            firstHlc: row.firstHlc ?? row.hlc,
          });
        } else {
          const hlc = this.mint();
          emit.push({
            scope,
            dataClass: this.dataClass,
            key: leaf.key,
            op: 'put',
            value: leaf.value,
            hlc,
            firstHlc: nextFirstHlc(row, hlc),
          });
        }
      }
      for (const [metaKey, row] of Object.entries(meta)) {
        const parsed = parseKvMetaKey(metaKey);
        if (parsed === null || parsed.scope !== scope) continue;
        if (!slice.ownsRecord(parsed.scope, parsed.key)) continue;
        if (row.op === 'delete') {
          emit.push({
            scope,
            dataClass: this.dataClass,
            key: parsed.key,
            op: 'delete',
            hlc: row.hlc,
            firstHlc: row.firstHlc,
          });
        } else if (!leafMap.has(metaKey) && row.suppressed !== true) {
          emit.push({
            scope,
            dataClass: this.dataClass,
            key: parsed.key,
            op: 'delete',
            hlc: this.mint(),
            firstHlc: row.firstHlc ?? row.hlc,
          });
        }
      }
    }
    emit.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    await stampKvMeta(this.deps.kv, emit);
    for (const record of emit) yield record;
  }

  private allEffectiveRecords(meta: SyncMetaKV, states: readonly SliceState[]): ChangeRecord[] {
    const out: ChangeRecord[] = [];
    for (const { slice, leafMap } of states) {
      for (const leaf of leafMap.values()) {
        const record = this.effectiveRecord(
          leaf.scope,
          leaf.key,
          leaf,
          meta[kvMetaKey(leaf.scope, leaf.key)],
        );
        if (record !== null) out.push(record);
      }
      for (const [metaKey, row] of Object.entries(meta)) {
        const parsed = parseKvMetaKey(metaKey);
        if (parsed === null || leafMap.has(metaKey)) continue;
        if (!slice.ownsRecord(parsed.scope, parsed.key)) continue;
        const record = this.effectiveRecord(parsed.scope, parsed.key, undefined, row);
        if (record !== null) out.push(record);
      }
    }
    return out;
  }

  async current(keys: RecordKey[]): Promise<Map<RecordKey, ChangeRecord | null>> {
    const meta = await readSyncMetaKV(this.deps.kv);
    const states = await this.sliceStates();
    const records = this.allEffectiveRecords(meta, states);
    const out = new Map<RecordKey, ChangeRecord | null>();
    for (const key of keys) {
      let merged: ChangeRecord | null = null;
      for (const record of records) {
        if (record.key !== key) continue;
        merged = merged === null ? record : mergeRecord(merged, record);
      }
      out.set(key, merged);
    }
    return out;
  }

  async applyRemote(records: ChangeRecord[]): Promise<ApplyResult> {
    const meta = await readSyncMetaKV(this.deps.kv);
    const states = await this.sliceStates();
    const staged = new Map<string, KvRecordMeta>();
    const applied: ChangeRecord[] = [];
    const localWon: ChangeRecord[] = [];
    const opaque: ChangeRecord[] = [];
    const conflicts: ConflictLogEntry[] = [];
    const winnersBySlice = new Map<KvSlice, ChangeRecord[]>();
    const existenceWinners = new Map<Scope, ChangeRecord | null>();

    const metaRow = (scope: Scope, key: RecordKey): KvRecordMeta | undefined =>
      staged.get(kvMetaKey(scope, key)) ?? meta[kvMetaKey(scope, key)];

    const localRecordFor = (scope: Scope, key: RecordKey): ChangeRecord | null => {
      const state = this.stateOf(states, scope, key);
      if (state === undefined) return null;
      return this.effectiveRecord(scope, key, state.leafMap.get(kvMetaKey(scope, key)), metaRow(scope, key));
    };

    const helpers: SliceMergeHelpers = {
      metaRow,
      localRecord: localRecordFor,
      existenceWinner: (scope) =>
        existenceWinners.get(scope) ?? localRecordFor(scope, PROFILE_EXISTENCE_KEY),
    };

    const stageApplied = async (record: ChangeRecord, suppressed: boolean): Promise<void> => {
      staged.set(kvMetaKey(record.scope, record.key), {
        hlc: record.hlc,
        firstHlc: record.firstHlc ?? record.hlc,
        op: record.op,
        valueHash: record.op === 'put' ? await kvValueHash(record.value) : undefined,
        ...(suppressed ? { suppressed: true } : {}),
      });
    };

    for (const state of states) {
      const existenceKey = state.slice.existenceKey;
      if (existenceKey === undefined) continue;
      const scopes = new Set<Scope>();
      for (const record of records) {
        if (state.slice.ownsRecord(record.scope, record.key)) scopes.add(record.scope);
      }
      for (const scope of scopes) {
        const remote = records.find(
          (record) => record.scope === scope && record.key === existenceKey,
        );
        const local = this.effectiveRecord(
          scope,
          existenceKey,
          state.leafMap.get(kvMetaKey(scope, existenceKey)),
          metaRow(scope, existenceKey),
        );
        existenceWinners.set(scope, remote === undefined ? local : mergeRecord(local, remote));
      }
    }

    for (const record of records) {
      if (record.dataClass !== this.dataClass) continue;
      const state = this.stateOf(states, record.scope, record.key);
      if (state === undefined) {
        opaque.push(record);
        continue;
      }
      const metaKey = kvMetaKey(record.scope, record.key);
      const leaf = state.leafMap.get(metaKey);
      const row = metaRow(record.scope, record.key);
      const local = this.effectiveRecord(record.scope, record.key, leaf, row);
      const drifted = KvLocalSourceImpl.isDrifted(leaf, row);
      const winner = mergeRecord(local, record, state.slice.mergeContext(record, helpers));
      if (winner === record) {
        const list = winnersBySlice.get(state.slice) ?? [];
        list.push(record);
        winnersBySlice.set(state.slice, list);
        if (drifted && local !== null) {
          conflicts.push({
            at: this.now(),
            scope: record.scope,
            dataClass: record.dataClass,
            key: record.key,
            localHlc: local.hlc,
            remoteHlc: record.hlc,
            winner: 'remote',
          });
        }
        await stageApplied(record, false);
        if (record.op === 'delete') {
          state.leafMap.delete(metaKey);
        } else {
          state.leafMap.set(metaKey, {
            scope: record.scope,
            key: record.key,
            value: record.value,
            hash: await kvValueHash(record.value),
          });
        }
      } else {
        if (winner !== null) localWon.push(record);
        if (drifted && local !== null) {
          conflicts.push({
            at: this.now(),
            scope: record.scope,
            dataClass: record.dataClass,
            key: record.key,
            localHlc: local.hlc,
            remoteHlc: record.hlc,
            winner: 'local',
          });
        }
      }
    }

    for (const [slice, winners] of winnersBySlice) {
      const state = states.find((entry) => entry.slice === slice);
      if (state === undefined) continue;
      const materializable: ChangeRecord[] = [];
      for (const record of winners) {
        if (slice.materializable(record, helpers)) {
          materializable.push(record);
        } else {
          opaque.push(record);
          await stageApplied(record, true);
        }
      }
      const result = slice.apply(state.value, materializable, metaRow);
      if (!jsonEquals(result.value, state.value)) {
        await this.writeSliceValue(slice, result.value);
      }
      const materializedSet = new Set(result.materialized);
      for (const record of materializable) {
        if (materializedSet.has(record)) applied.push(record);
        else {
          opaque.push(record);
          await stageApplied(record, true);
        }
      }
    }

    for (const appliedRecord of applied) {
      if (appliedRecord.op !== 'delete') continue;
      const owner = this.slices.find((slice) => slice.existenceKey === appliedRecord.key);
      if (owner === undefined) continue;
      const metaKeys = new Set([...Object.keys(meta), ...staged.keys()]);
      for (const metaKey of metaKeys) {
        const parsed = parseKvMetaKey(metaKey);
        if (
          parsed === null ||
          parsed.scope !== appliedRecord.scope ||
          parsed.key === appliedRecord.key ||
          !owner.ownsRecord(parsed.scope, parsed.key)
        ) {
          continue;
        }
        const row = staged.get(metaKey) ?? meta[metaKey];
        if (row === undefined || row.op !== 'put') continue;
        staged.set(metaKey, {
          hlc: appliedRecord.hlc,
          firstHlc: row.firstHlc ?? row.hlc,
          op: 'delete',
        });
      }
    }

    if (staged.size > 0) {
      const merged: SyncMetaKV = { ...meta };
      for (const [metaKey, row] of staged) merged[metaKey] = row;
      await this.deps.kv.set('local', SYNC_META_KV_STORAGE_KEY, merged);
    }
    await appendConflictLog(this.deps.kv, conflicts);
    return { applied, localWon, opaque };
  }
}

function slicesForDataClass(dataClass: KvDataClass): KvSlice[] {
  switch (dataClass) {
    case 'settings':
      return [flattenedKvSlice(STORAGE_KEYS.SETTINGS, SETTINGS_FIELD_REGISTRY, 'settings')];
    case 'secondaryKey':
      return SECONDARY_STORAGE_KEYS.map((key) =>
        flattenedKvSlice(key, SYNCED_KV_REGISTRIES[key], 'kv'),
      );
    case 'syncDirectory':
      return [directoryKvSlice(SYNC_DIRECTORY_STORAGE_KEY)];
    case 'profileConfig':
      return [profilesKvSlice(STORAGE_KEYS.SETTINGS)];
  }
}

export function createKvLocalSource(
  dataClass: KvDataClass,
  deps: KvLocalSourceDeps,
): KvLocalSource {
  return new KvLocalSourceImpl(dataClass, slicesForDataClass(dataClass), deps);
}

export function createKvLocalSources(deps: KvLocalSourceDeps): KvLocalSource[] {
  return KV_DATA_CLASSES.map((dataClass) => createKvLocalSource(dataClass, deps));
}
