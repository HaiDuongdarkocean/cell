import {
  flatten,
  isPlainJsonObject,
  profileRecordKey,
} from '../../../domain/flatten';
import type { FieldRegistry, FlatRecord } from '../../../domain/flatten';
import {
  PROFILE_EXISTENCE_KEY,
  profileFieldMaterializable,
  profileRecordsOf,
} from '../../../domain/merge';
import type { MergeContext } from '../../../domain/merge';
import { isSuppressedChildPut } from '../../../domain/opaqueRecords';
import { profileIdForTarget, scopeForTarget, targetOf } from '../../../domain/scope';
import { PROFILE_FIELD_REGISTRY } from '../../../domain/settingsRegistry';
import type { ChangeRecord, RecordKey, Scope } from '../../../domain/types';
import { directoryKvShape, flattenedKvShape, isDirectoryRecordKey } from './kvShapes';
import type { KvRecordMeta } from './kvMeta';

export const PROFILES_STORAGE_FIELD = 'languageProfiles';
export type KvWriteVia = 'kv' | 'settings';

export interface ScopedLeaf {
  readonly scope: Scope;
  readonly key: RecordKey;
  readonly value: unknown;
}

export interface SliceMergeHelpers {
  readonly metaRow: (scope: Scope, key: RecordKey) => KvRecordMeta | undefined;
  readonly localRecord: (scope: Scope, key: RecordKey) => ChangeRecord | null;
  readonly existenceWinner: (scope: Scope) => ChangeRecord | null;
}

export interface SliceApplyResult {
  readonly value: unknown;
  readonly materialized: readonly ChangeRecord[];
  readonly rejected: readonly ChangeRecord[];
}

export interface KvSlice {
  readonly storageKey: string;
  readonly writeVia: KvWriteVia;
  readonly existenceKey?: RecordKey;
  leaves(value: unknown): ScopedLeaf[];
  ownsRecord(scope: Scope, key: RecordKey): boolean;
  mergeContext(record: ChangeRecord, helpers: SliceMergeHelpers): MergeContext;
  materializable(record: ChangeRecord, helpers: SliceMergeHelpers): boolean;
  apply(
    current: unknown,
    winners: readonly ChangeRecord[],
    metaRow: (scope: Scope, key: RecordKey) => KvRecordMeta | undefined,
  ): SliceApplyResult;
}

function isPathWithin(path: string, ancestor: string): boolean {
  return ancestor === '' || path === ancestor || path.startsWith(`${ancestor}/`);
}

function removeLeafTree(leafMap: Map<string, FlatRecord>, path: string): void {
  for (const key of [...leafMap.keys()]) {
    if (isPathWithin(key, path)) leafMap.delete(key);
  }
}

function setLeafTree(leafMap: Map<string, FlatRecord>, path: string, record: FlatRecord): void {
  for (const key of [...leafMap.keys()]) {
    if (isPathWithin(key, path) || isPathWithin(path, key)) leafMap.delete(key);
  }
  leafMap.set(path, record);
}

function partitionApplied(
  winners: readonly ChangeRecord[],
  pathOfKey: (key: RecordKey) => string | null,
  rejectedPaths: ReadonlySet<string>,
): { materialized: ChangeRecord[]; rejected: ChangeRecord[] } {
  const materialized: ChangeRecord[] = [];
  const rejected: ChangeRecord[] = [];
  for (const record of winners) {
    const path = pathOfKey(record.key);
    if (path === null || (record.op === 'put' && rejectedPaths.has(path))) {
      rejected.push(record);
    } else {
      materialized.push(record);
    }
  }
  return { materialized, rejected };
}

export function flattenedKvSlice(
  storageKey: string,
  registry: FieldRegistry,
  writeVia: KvWriteVia,
): KvSlice {
  const shape = flattenedKvShape(storageKey, registry);
  return {
    storageKey,
    writeVia,
    leaves(value) {
      return shape.flattenLeaves(value).map((leaf) => ({
        scope: 'global' as Scope,
        key: shape.recordKeyOf(leaf.path),
        value: leaf.value,
      }));
    },
    ownsRecord(scope, key) {
      return scope === 'global' && shape.pathOfKey(key) !== null;
    },
    mergeContext() {
      return {};
    },
    materializable(record, helpers) {
      if (!shape.isMaterializable(record)) return false;
      return !isSuppressedChildPut(
        record,
        (parentKey) => helpers.metaRow(record.scope, parentKey)?.op === 'delete',
      );
    },
    apply(current, winners, metaRow) {
      const leafMap = new Map<string, FlatRecord>();
      for (const leaf of shape.flattenLeaves(current)) {
        const meta = metaRow('global', shape.recordKeyOf(leaf.path));
        leafMap.set(leaf.path, {
          path: leaf.path,
          value: leaf.value,
          op: 'put',
          hlc: meta?.hlc,
          firstHlc: meta?.firstHlc,
        });
      }
      for (const record of winners) {
        const path = shape.pathOfKey(record.key);
        if (path === null) continue;
        if (record.op === 'delete') {
          removeLeafTree(leafMap, path);
        } else {
          setLeafTree(leafMap, path, {
            path,
            value: record.value,
            op: 'put',
            hlc: record.hlc,
            firstHlc: record.firstHlc,
          });
        }
      }
      const { value, rejected: rejectedFlat } = shape.project(current, [...leafMap.values()]);
      const rejectedPaths = new Set(rejectedFlat.map((record) => record.path));
      const { materialized, rejected } = partitionApplied(winners, shape.pathOfKey, rejectedPaths);
      return { value, materialized, rejected };
    },
  };
}

export function directoryKvSlice(storageKey: string): KvSlice {
  const shape = directoryKvShape(storageKey);
  return {
    storageKey,
    writeVia: 'kv',
    leaves(value) {
      return shape.flattenLeaves(value).map((leaf) => ({
        scope: 'global' as Scope,
        key: leaf.path,
        value: leaf.value,
      }));
    },
    ownsRecord(scope, key) {
      return scope === 'global' && isDirectoryRecordKey(key);
    },
    mergeContext() {
      return {};
    },
    materializable(record) {
      return shape.isMaterializable(record);
    },
    apply(current, winners, metaRow) {
      const leafMap = new Map<string, FlatRecord>();
      for (const leaf of shape.flattenLeaves(current)) {
        const meta = metaRow('global', leaf.path);
        leafMap.set(leaf.path, {
          path: leaf.path,
          value: leaf.value,
          op: 'put',
          hlc: meta?.hlc,
          firstHlc: meta?.firstHlc,
        });
      }
      for (const record of winners) {
        if (record.op === 'delete') {
          removeLeafTree(leafMap, record.key);
        } else {
          setLeafTree(leafMap, record.key, {
            path: record.key,
            value: record.value,
            op: 'put',
            hlc: record.hlc,
            firstHlc: record.firstHlc,
          });
        }
      }
      const { value } = shape.project(current, [...leafMap.values()]);
      const { materialized, rejected } = partitionApplied(
        winners,
        (key) => (isDirectoryRecordKey(key) ? key : null),
        new Set(),
      );
      return { value, materialized, rejected };
    },
  };
}

function profilesArrayOf(value: unknown): unknown[] {
  if (!isPlainJsonObject(value)) return [];
  const profiles = value[PROFILES_STORAGE_FIELD];
  return Array.isArray(profiles) ? profiles : [];
}

function elementTarget(element: unknown): string | null {
  if (!isPlainJsonObject(element)) return null;
  const target = element.target;
  if (typeof target !== 'string' || target.trim() === '') return null;
  return targetOf(target);
}

function elementExistenceValue(element: Record<string, unknown>, target: string): unknown {
  const id = element.id;
  return typeof id === 'string' && id !== '' ? id : profileIdForTarget(target);
}

function profileFieldPath(key: RecordKey): string | null {
  const prefix = `${PROFILE_EXISTENCE_KEY}/`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

const PROFILE_ELEMENT_SHAPE = flattenedKvShape('profile', PROFILE_FIELD_REGISTRY);

function compareProfileElements(a: unknown, b: unknown): number {
  const orderOf = (element: unknown): number =>
    isPlainJsonObject(element) && typeof element.order === 'number' && Number.isFinite(element.order)
      ? element.order
      : Number.MAX_SAFE_INTEGER;
  const byOrder = orderOf(a) - orderOf(b);
  if (byOrder !== 0) return byOrder;
  const targetA = elementTarget(a) ?? '';
  const targetB = elementTarget(b) ?? '';
  return targetA < targetB ? -1 : targetA > targetB ? 1 : 0;
}

export function profilesKvSlice(storageKey: string): KvSlice {
  return {
    storageKey,
    writeVia: 'settings',
    existenceKey: PROFILE_EXISTENCE_KEY,
    leaves(value) {
      const out: ScopedLeaf[] = [];
      for (const element of profilesArrayOf(value)) {
        const target = elementTarget(element);
        if (target === null || !isPlainJsonObject(element)) continue;
        const scope = scopeForTarget(target);
        out.push({ scope, key: PROFILE_EXISTENCE_KEY, value: elementExistenceValue(element, target) });
        for (const leaf of flatten(element, PROFILE_FIELD_REGISTRY)) {
          out.push({ scope, key: profileRecordKey(leaf.path), value: leaf.value });
        }
      }
      return out;
    },
    ownsRecord(scope, key) {
      return (
        scope.startsWith('profile:') &&
        (key === PROFILE_EXISTENCE_KEY || profileFieldPath(key) !== null)
      );
    },
    mergeContext(record, helpers) {
      if (record.key === PROFILE_EXISTENCE_KEY) return {};
      return { profile: profileRecordsOf(helpers.existenceWinner(record.scope)) };
    },
    materializable(record, helpers) {
      if (record.key === PROFILE_EXISTENCE_KEY || record.op === 'delete') return true;
      return profileFieldMaterializable(
        record,
        profileRecordsOf(helpers.existenceWinner(record.scope)),
      );
    },
    apply(current, winners, metaRow) {
      const settings = isPlainJsonObject(current) ? current : {};
      const nextProfiles = [...profilesArrayOf(current)];
      const byScope = new Map<Scope, ChangeRecord[]>();
      for (const record of winners) {
        const list = byScope.get(record.scope) ?? [];
        list.push(record);
        byScope.set(record.scope, list);
      }
      const materialized: ChangeRecord[] = [];
      const rejected: ChangeRecord[] = [];
      for (const [scope, records] of byScope) {
        const target = scope.slice('profile:'.length);
        const index = nextProfiles.findIndex((element) => elementTarget(element) === target);
        const existing = index >= 0 ? nextProfiles[index] : undefined;
        const existence = records.find((record) => record.key === PROFILE_EXISTENCE_KEY);
        const fields = records.filter((record) => record.key !== PROFILE_EXISTENCE_KEY);
        if (existence !== undefined && existence.op === 'delete') {
          if (index >= 0) nextProfiles.splice(index, 1);
          materialized.push(existence, ...fields);
          continue;
        }
        if (existing === undefined && existence === undefined) {
          rejected.push(...fields);
          continue;
        }
        const leafMap = new Map<string, FlatRecord>();
        if (existing !== undefined) {
          for (const leaf of flatten(existing, PROFILE_FIELD_REGISTRY)) {
            const meta = metaRow(scope, profileRecordKey(leaf.path));
            leafMap.set(leaf.path, {
              path: leaf.path,
              value: leaf.value,
              op: 'put',
              hlc: meta?.hlc,
              firstHlc: meta?.firstHlc,
            });
          }
        }
        for (const record of fields) {
          const path = profileFieldPath(record.key);
          if (path === null) {
            rejected.push(record);
            continue;
          }
          if (record.op === 'delete') {
            removeLeafTree(leafMap, path);
          } else {
            setLeafTree(leafMap, path, {
              path,
              value: record.value,
              op: 'put',
              hlc: record.hlc,
              firstHlc: record.firstHlc,
            });
          }
        }
        const { value, rejected: rejectedFlat } = PROFILE_ELEMENT_SHAPE.project(
          existing,
          [...leafMap.values()],
        );
        const rejectedPaths = new Set(rejectedFlat.map((record) => record.path));
        const element = isPlainJsonObject(value) ? { ...value } : {};
        if (
          existence !== undefined &&
          existence.op === 'put' &&
          typeof existence.value === 'string' &&
          existence.value !== ''
        ) {
          element.id = existence.value;
        } else if (typeof element.id !== 'string' || element.id === '') {
          element.id = profileIdForTarget(target);
        }
        if (typeof element.target !== 'string' || element.target === '') {
          element.target = target;
        }
        if (index >= 0) nextProfiles[index] = element;
        else nextProfiles.push(element);
        if (existence !== undefined) materialized.push(existence);
        for (const record of fields) {
          const path = profileFieldPath(record.key);
          if (path !== null && record.op === 'put' && rejectedPaths.has(path)) {
            rejected.push(record);
          } else {
            materialized.push(record);
          }
        }
      }
      nextProfiles.sort(compareProfileElements);
      return {
        value: { ...settings, [PROFILES_STORAGE_FIELD]: nextProfiles },
        materialized,
        rejected,
      };
    },
  };
}
