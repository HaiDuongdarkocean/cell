import {
  elementArrayRuleFor,
  flatten,
  isExcludedPath,
  isMaterializablePath,
  isPlainJsonObject,
  isSyncedPath,
  kvRecordKey,
  kvRecordPath,
  unflatten,
} from '../../../domain/flatten';
import type {
  DecodedSegment,
  FieldRegistry,
  FlatLeaf,
  FlatRecord,
} from '../../../domain/flatten';
import type { ChangeRecord, RecordKey } from '../../../domain/types';

export interface KvProjection {
  readonly value: unknown;
  readonly rejected: readonly FlatRecord[];
}

export interface KvShape {
  readonly storageKey: string;
  flattenLeaves(value: unknown): FlatLeaf[];
  recordKeyOf(path: string): RecordKey;
  pathOfKey(key: RecordKey): string | null;
  isMaterializable(record: ChangeRecord): boolean;
  project(current: unknown, live: readonly FlatRecord[]): KvProjection;
}

function keySegments(segments: readonly string[]): DecodedSegment[] {
  return segments.map((key) => ({ kind: 'key', key }));
}

function isSyncedLocal(segments: readonly string[], registry: FieldRegistry): boolean {
  const decoded = keySegments(segments);
  return isSyncedPath(decoded, registry) && !isExcludedPath(decoded, registry);
}

function pruneUnsyncedSurvivors(
  current: unknown,
  segments: readonly string[],
  registry: FieldRegistry,
): { keep: boolean; value?: unknown } {
  if (!isPlainJsonObject(current)) {
    return isSyncedLocal(segments, registry) ? { keep: false } : { keep: true, value: current };
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    const child = [...segments, key];
    if (!isSyncedPath(keySegments(child), registry)) {
      out[key] = value;
      continue;
    }
    const pruned = pruneUnsyncedSurvivors(value, child, registry);
    if (pruned.keep) out[key] = pruned.value;
  }
  return Object.keys(out).length > 0 ? { keep: true, value: out } : { keep: false };
}

function mergeSkeleton(
  current: unknown,
  skeleton: unknown,
  segments: readonly string[],
  registry: FieldRegistry,
): unknown {
  const next = skeleton === undefined && isPlainJsonObject(current) ? {} : skeleton;
  if (!isPlainJsonObject(next)) return next;
  const base = isPlainJsonObject(current) ? current : {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (Object.prototype.hasOwnProperty.call(next, key)) continue;
    const child = [...segments, key];
    if (!isSyncedPath(keySegments(child), registry)) {
      out[key] = value;
      continue;
    }
    const pruned = pruneUnsyncedSurvivors(value, child, registry);
    if (pruned.keep) out[key] = pruned.value;
  }
  for (const [key, skel] of Object.entries(next)) {
    out[key] = mergeSkeleton(base[key], skel, [...segments, key], registry);
  }
  return out;
}

function restoreStrippedFields(
  next: unknown,
  current: unknown,
  segments: readonly string[],
  registry: FieldRegistry,
): unknown {
  const rule = elementArrayRuleFor(keySegments(segments), registry);
  if (Array.isArray(next)) {
    const stripFields = rule?.stripFields;
    if (!stripFields || stripFields.length === 0 || !Array.isArray(current)) return next;
    const currentById = new Map<string, unknown>();
    for (const element of current) {
      const id = rule.elementId(element);
      if (id !== null) currentById.set(id, element);
    }
    return next.map((element) => {
      const id = rule.elementId(element);
      const existing = id === null ? undefined : currentById.get(id);
      if (!isPlainJsonObject(element) || !isPlainJsonObject(existing)) return element;
      const restored: Record<string, unknown> = { ...element };
      for (const field of stripFields) {
        if (Object.prototype.hasOwnProperty.call(existing, field)) {
          restored[field] = existing[field];
        }
      }
      return restored;
    });
  }
  if (isPlainJsonObject(next)) {
    const out: Record<string, unknown> = {};
    const base = isPlainJsonObject(current) ? current : {};
    for (const [key, value] of Object.entries(next)) {
      out[key] = restoreStrippedFields(value, base[key], [...segments, key], registry);
    }
    return out;
  }
  return next;
}

export function flattenedKvShape(storageKey: string, registry: FieldRegistry): KvShape {
  return {
    storageKey,
    flattenLeaves(value) {
      return flatten(value, registry);
    },
    recordKeyOf(path) {
      return kvRecordKey(storageKey, path);
    },
    pathOfKey(key) {
      return kvRecordPath(storageKey, key);
    },
    isMaterializable(record) {
      if (record.op === 'put' && record.value === undefined) return false;
      const path = kvRecordPath(storageKey, record.key);
      return path !== null && isMaterializablePath(path, registry);
    },
    project(current, live) {
      const { value: skeleton, rejected } = unflatten(live, registry);
      const merged = mergeSkeleton(current, skeleton, [], registry);
      return { value: restoreStrippedFields(merged, current, [], registry), rejected };
    },
  };
}

const DIRECTORY_KEY_PREFIXES = ['connection:', 'binding:'];

export function isDirectoryRecordKey(key: RecordKey): boolean {
  return (
    key === 'systemConnection' ||
    DIRECTORY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

export function directoryKvShape(storageKey: string): KvShape {
  return {
    storageKey,
    flattenLeaves(value) {
      if (!isPlainJsonObject(value)) return [];
      return Object.entries(value)
        .filter(([key, entry]) => entry !== undefined && isDirectoryRecordKey(key))
        .map(([key, entry]) => ({ path: key, value: entry }));
    },
    recordKeyOf(path) {
      return path;
    },
    pathOfKey(key) {
      if (key.startsWith('kv:') || key === 'profile' || key.startsWith('profile/')) {
        return null;
      }
      return key;
    },
    isMaterializable(record) {
      if (record.op === 'put' && record.value === undefined) return false;
      return isDirectoryRecordKey(record.key);
    },
    project(current, live) {
      const out: Record<string, unknown> = {};
      if (isPlainJsonObject(current)) {
        for (const [key, entry] of Object.entries(current)) {
          if (entry !== undefined && !isDirectoryRecordKey(key)) out[key] = entry;
        }
      }
      for (const record of live) {
        if (record.op !== 'delete' && record.value !== undefined) {
          out[record.path] = record.value;
        }
      }
      return { value: out, rejected: [] };
    },
  };
}
