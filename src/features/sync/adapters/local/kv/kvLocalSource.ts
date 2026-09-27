import { nextFirstHlc } from '../../../domain/flatten';
import type { FlatLeaf, FlatRecord } from '../../../domain/flatten';
import { mergeRecord } from '../../../domain/merge';
import { dispositionFor } from '../../../domain/opaqueRecords';
import type {
  ChangeRecord,
  DataClass,
  Hlc,
  PendingKey,
  RecordKey,
  RecordMeta,
  Scope,
} from '../../../domain/types';
import type { ApplyResult, LocalSource } from '../../../ports/localSource';
import type { KeyValueStore } from '../../../ports/keyValueStore';
import { appendConflictLog } from './conflictLog';
import type { ConflictLogEntry } from './conflictLog';
import { SYNC_META_KV_STORAGE_KEY } from './keys';
import { readSyncMetaKV } from './kvMeta';
import type { SyncMetaKV } from './kvMeta';
import type { KvShape } from './kvShapes';
import { kvValueHash } from './valueHash';

export interface KvLocalSourceDeps {
  readonly kv: KeyValueStore;
  readonly tick: () => Hlc;
  readonly writeValue: (value: unknown) => Promise<void>;
  readonly now?: () => number;
}

interface LocalCandidate {
  readonly record: ChangeRecord | null;
  readonly drifted: boolean;
}

export class KvLocalSource implements LocalSource {
  constructor(
    readonly dataClass: DataClass,
    private readonly shape: KvShape,
    private readonly deps: KvLocalSourceDeps,
    private readonly scope: Scope = 'global',
  ) {}

  async pending(limit: number): Promise<PendingKey[]> {
    if (limit <= 0) return [];
    const [value, metaAll] = await Promise.all([this.readValue(), this.readMeta()]);
    const meta = this.ownMeta(metaAll);
    const leaves = this.shape.flattenLeaves(value);
    const leafPaths = new Set(leaves.map((leaf) => leaf.path));
    const hashes = new Map<string, string>();
    await Promise.all(
      leaves.map(async (leaf) => {
        hashes.set(leaf.path, await kvValueHash(leaf.value));
      }),
    );
    const out: PendingKey[] = [];
    for (const leaf of leaves) {
      const key = this.shape.recordKeyOf(leaf.path);
      const metaRow = meta.get(key);
      const hash = hashes.get(leaf.path);
      if (
        metaRow === undefined ||
        metaRow.op !== 'put' ||
        metaRow.valueHash === undefined ||
        metaRow.valueHash !== hash
      ) {
        out.push({ scope: this.scope, dataClass: this.dataClass, key, op: 'put' });
      }
    }
    for (const [key, metaRow] of meta) {
      if (metaRow.op !== 'put') continue;
      const path = this.shape.pathOfKey(key);
      if (path !== null && !leafPaths.has(path)) {
        out.push({ scope: this.scope, dataClass: this.dataClass, key, op: 'delete' });
      }
    }
    out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return out.slice(0, limit);
  }

  async resolve(keys: PendingKey[]): Promise<ChangeRecord[]> {
    if (keys.length === 0) return [];
    const [value, metaAll] = await Promise.all([this.readValue(), this.readMeta()]);
    const meta = this.ownMeta(metaAll);
    const leaves = new Map(this.shape.flattenLeaves(value).map((leaf) => [leaf.path, leaf]));
    const out: ChangeRecord[] = [];
    for (const pending of keys) {
      const path = this.shape.pathOfKey(pending.key);
      if (path === null) continue;
      const leaf = leaves.get(path);
      const metaRow = meta.get(pending.key);
      if (leaf !== undefined) {
        const hash = await kvValueHash(leaf.value);
        if (metaRow?.op === 'put' && metaRow.valueHash === hash) continue;
        const hlc = this.deps.tick();
        out.push({
          scope: this.scope,
          dataClass: this.dataClass,
          key: pending.key,
          op: 'put',
          value: leaf.value,
          hlc,
          firstHlc: nextFirstHlc(metaRow, hlc),
        });
      } else {
        if (metaRow === undefined || metaRow.op === 'delete') continue;
        out.push({
          scope: this.scope,
          dataClass: this.dataClass,
          key: pending.key,
          op: 'delete',
          hlc: this.deps.tick(),
          firstHlc: metaRow.firstHlc ?? metaRow.hlc,
        });
      }
    }
    return out;
  }

  ack(_keys: PendingKey[]): Promise<void> {
    return Promise.resolve();
  }

  async *snapshot(scope: Scope): AsyncIterable<ChangeRecord> {
    if (scope !== this.scope) return;
    const [value, metaAll] = await Promise.all([this.readValue(), this.readMeta()]);
    const meta = this.ownMeta(metaAll);
    const leaves = this.shape.flattenLeaves(value);
    const leafPaths = new Set(leaves.map((leaf) => leaf.path));
    for (const leaf of leaves) {
      const key = this.shape.recordKeyOf(leaf.path);
      const metaRow = meta.get(key);
      const live = metaRow?.op === 'put' ? metaRow : undefined;
      const hlc = live?.hlc ?? this.deps.tick();
      yield {
        scope: this.scope,
        dataClass: this.dataClass,
        key,
        op: 'put',
        value: leaf.value,
        hlc,
        firstHlc: live ? live.firstHlc ?? live.hlc : hlc,
      };
    }
    for (const [key, metaRow] of [...meta.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
      const path = this.shape.pathOfKey(key);
      if (path === null || leafPaths.has(path)) continue;
      if (metaRow.op === 'delete') {
        yield {
          scope: this.scope,
          dataClass: this.dataClass,
          key,
          op: 'delete',
          hlc: metaRow.hlc,
          firstHlc: metaRow.firstHlc,
        };
      } else {
        const hlc = this.deps.tick();
        yield {
          scope: this.scope,
          dataClass: this.dataClass,
          key,
          op: 'delete',
          hlc,
          firstHlc: metaRow.firstHlc ?? hlc,
        };
      }
    }
  }

  async current(keys: RecordKey[]): Promise<Map<RecordKey, ChangeRecord | null>> {
    const [value, metaAll] = await Promise.all([this.readValue(), this.readMeta()]);
    const meta = this.ownMeta(metaAll);
    const leaves = new Map(this.shape.flattenLeaves(value).map((leaf) => [leaf.path, leaf]));
    const out = new Map<RecordKey, ChangeRecord | null>();
    for (const key of keys) {
      const path = this.shape.pathOfKey(key);
      const metaRow = path === null ? undefined : meta.get(key);
      if (path === null || metaRow === undefined) {
        out.set(key, null);
        continue;
      }
      const leaf = leaves.get(path);
      out.set(key, {
        scope: this.scope,
        dataClass: this.dataClass,
        key,
        op: metaRow.op,
        value: metaRow.op === 'put' ? leaf?.value : undefined,
        hlc: metaRow.hlc,
        firstHlc: metaRow.firstHlc,
      });
    }
    return out;
  }

  async applyRemote(records: ChangeRecord[]): Promise<ApplyResult> {
    const applied: ChangeRecord[] = [];
    const localWon: ChangeRecord[] = [];
    const opaque: ChangeRecord[] = [];
    const conflicts: ConflictLogEntry[] = [];
    const [value, metaAll] = await Promise.all([this.readValue(), this.readMeta()]);
    const meta = this.ownMeta(metaAll);
    const metaView = new Map<RecordKey, RecordMeta>(meta);
    const leafList = this.shape.flattenLeaves(value);
    const leaves = new Map(leafList.map((leaf) => [leaf.path, leaf]));
    const winners: ChangeRecord[] = [];

    const context = {
      canMaterialize: (record: ChangeRecord) => this.shape.isMaterializable(record),
      isParentTombstoned: (key: RecordKey) => metaView.get(key)?.op === 'delete',
    };

    for (const remote of records) {
      if (remote.dataClass !== this.dataClass) continue;
      const remotePath = this.shape.pathOfKey(remote.key);
      if (remotePath === null) continue;
      if (dispositionFor(remote, context).kind === 'opaque') {
        opaque.push(remote);
        continue;
      }
      const { record: local, drifted } = await this.localCandidate(
        remote.key,
        leaves.get(remotePath),
        metaView.get(remote.key),
      );
      const winner = mergeRecord(local, remote);
      if (winner === null || winner !== remote) {
        if (drifted && local !== null) {
          conflicts.push(this.conflictEntry(remote, local.hlc, 'local'));
          localWon.push(remote);
        }
        continue;
      }
      winners.push(remote);
      metaView.set(remote.key, {
        hlc: remote.hlc,
        firstHlc: remote.firstHlc ?? remote.hlc,
        op: remote.op,
      });
      if (drifted && local !== null) {
        conflicts.push(this.conflictEntry(remote, local.hlc, 'remote'));
      }
    }

    const finalApplied = await this.persistWinners(value, leafList, meta, winners, applied, opaque);
    await appendConflictLog(this.deps.kv, conflicts);
    return { applied: finalApplied, localWon, opaque };
  }

  private async persistWinners(
    current: unknown,
    leafList: readonly FlatLeaf[],
    meta: Map<RecordKey, RecordMeta>,
    winners: readonly ChangeRecord[],
    applied: ChangeRecord[],
    opaque: ChangeRecord[],
  ): Promise<ChangeRecord[]> {
    if (winners.length === 0) return applied;
    const live = new Map<string, FlatRecord>();
    for (const leaf of leafList) {
      const key = this.shape.recordKeyOf(leaf.path);
      const metaRow = meta.get(key);
      live.set(leaf.path, {
        path: leaf.path,
        op: 'put',
        value: leaf.value,
        hlc: metaRow?.hlc,
        firstHlc: metaRow?.firstHlc ?? metaRow?.hlc,
      });
    }
    for (const winner of winners) {
      const path = this.shape.pathOfKey(winner.key) ?? '';
      if (winner.op === 'delete') {
        live.delete(path);
      } else {
        live.set(path, {
          path,
          op: 'put',
          value: winner.value,
          hlc: winner.hlc,
          firstHlc: winner.firstHlc ?? winner.hlc,
        });
      }
    }
    const projected = this.shape.project(current, [...live.values()]);
    const rejectedKeys = new Set(
      projected.rejected.map((record) => this.shape.recordKeyOf(record.path)),
    );
    for (const winner of winners) {
      if (winner.op === 'put' && rejectedKeys.has(winner.key)) {
        opaque.push(winner);
      } else {
        applied.push(winner);
      }
    }
    await this.deps.writeValue(projected.value);
    const stored = await this.readValue();
    const nextLeaves = new Map(
      this.shape.flattenLeaves(stored).map((leaf) => [leaf.path, leaf]),
    );
    const metaOut = { ...(await this.readMeta()) };
    for (const winner of applied) {
      const path = this.shape.pathOfKey(winner.key) ?? '';
      const leaf = nextLeaves.get(path);
      metaOut[winner.key] = {
        hlc: winner.hlc,
        firstHlc: winner.firstHlc ?? winner.hlc,
        op: winner.op,
        valueHash:
          winner.op === 'put' ? await kvValueHash(leaf?.value ?? winner.value) : undefined,
      };
    }
    await this.deps.kv.set('local', SYNC_META_KV_STORAGE_KEY, metaOut);
    return applied;
  }

  private async localCandidate(
    key: RecordKey,
    leaf: FlatLeaf | undefined,
    meta: RecordMeta | undefined,
  ): Promise<LocalCandidate> {
    if (
      leaf !== undefined &&
      meta?.op === 'put' &&
      meta.valueHash !== undefined &&
      meta.valueHash === (await kvValueHash(leaf.value))
    ) {
      return { record: this.metaRecord(key, meta, leaf.value), drifted: false };
    }
    if (leaf === undefined && meta?.op === 'delete') {
      return { record: this.metaRecord(key, meta), drifted: false };
    }
    if (leaf === undefined && meta === undefined) {
      return { record: null, drifted: false };
    }
    const hlc = this.deps.tick();
    if (leaf !== undefined) {
      return {
        record: {
          scope: this.scope,
          dataClass: this.dataClass,
          key,
          op: 'put',
          value: leaf.value,
          hlc,
          firstHlc: nextFirstHlc(meta, hlc),
        },
        drifted: true,
      };
    }
    return {
      record: {
        scope: this.scope,
        dataClass: this.dataClass,
        key,
        op: 'delete',
        hlc,
        firstHlc: meta?.firstHlc ?? meta?.hlc ?? hlc,
      },
      drifted: true,
    };
  }

  private metaRecord(key: RecordKey, meta: RecordMeta, value?: unknown): ChangeRecord {
    return {
      scope: this.scope,
      dataClass: this.dataClass,
      key,
      op: meta.op,
      value,
      hlc: meta.hlc,
      firstHlc: meta.firstHlc,
    };
  }

  private conflictEntry(
    remote: ChangeRecord,
    localHlc: Hlc,
    winner: 'local' | 'remote',
  ): ConflictLogEntry {
    return {
      at: this.deps.now?.() ?? Date.now(),
      scope: remote.scope,
      dataClass: remote.dataClass,
      key: remote.key,
      localHlc,
      remoteHlc: remote.hlc,
      winner,
    };
  }

  private async readValue(): Promise<unknown> {
    return this.deps.kv.get('local', this.shape.storageKey);
  }

  private async readMeta(): Promise<SyncMetaKV> {
    return readSyncMetaKV(this.deps.kv);
  }

  private ownMeta(meta: SyncMetaKV): Map<RecordKey, RecordMeta> {
    const out = new Map<RecordKey, RecordMeta>();
    for (const [key, row] of Object.entries(meta)) {
      if (this.shape.pathOfKey(key) !== null) out.set(key, row);
    }
    return out;
  }
}
