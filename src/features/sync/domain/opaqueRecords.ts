import { compareHlc } from './hlc';
import type { ChangeRecord, RecordKey } from './types';

export type OpaqueReason = 'unknown-key' | 'parent-tombstoned' | 'unmaterializable';

export interface OpaqueRecordEntry {
  readonly record: ChangeRecord;
  readonly reason: OpaqueReason;
}

export interface OpaqueContext {
  readonly canMaterialize: (record: ChangeRecord) => boolean;
  readonly isParentTombstoned: (key: RecordKey) => boolean;
}

export type RecordDisposition =
  | { readonly kind: 'apply' }
  | { readonly kind: 'opaque'; readonly reason: OpaqueReason };

export interface DispositionSplit {
  readonly apply: readonly ChangeRecord[];
  readonly opaque: readonly OpaqueRecordEntry[];
}

export function toOpaqueEntry(record: ChangeRecord, reason: OpaqueReason): OpaqueRecordEntry {
  return { record, reason };
}

export function parentRecordKeys(key: RecordKey): RecordKey[] {
  const parents: RecordKey[] = [];
  let current = key;
  for (;;) {
    const cut = current.lastIndexOf('/');
    if (cut < 0) return parents;
    current = current.slice(0, cut);
    parents.push(current);
  }
}

export function isSuppressedChildPut(
  record: ChangeRecord,
  isTombstoned: (key: RecordKey) => boolean,
): boolean {
  return record.op === 'put' && parentRecordKeys(record.key).some(isTombstoned);
}

export function dispositionFor(
  record: ChangeRecord,
  context: OpaqueContext,
): RecordDisposition {
  if (!context.canMaterialize(record)) return { kind: 'opaque', reason: 'unknown-key' };
  if (isSuppressedChildPut(record, context.isParentTombstoned)) {
    return { kind: 'opaque', reason: 'parent-tombstoned' };
  }
  return { kind: 'apply' };
}

export function splitByDisposition(
  records: readonly ChangeRecord[],
  context: OpaqueContext,
): DispositionSplit {
  const apply: ChangeRecord[] = [];
  const opaque: OpaqueRecordEntry[] = [];
  for (const record of records) {
    const disposition = dispositionFor(record, context);
    if (disposition.kind === 'apply') apply.push(record);
    else opaque.push(toOpaqueEntry(record, disposition.reason));
  }
  return { apply, opaque };
}

export function retainOpaqueRecord(
  existing: OpaqueRecordEntry | undefined,
  record: ChangeRecord,
  reason: OpaqueReason,
): OpaqueRecordEntry {
  if (!existing || compareHlc(record.hlc, existing.record.hlc) > 0) {
    return toOpaqueEntry(record, reason);
  }
  return existing;
}

export function releasableOpaqueRecords(
  entries: readonly OpaqueRecordEntry[],
  context: OpaqueContext,
): OpaqueRecordEntry[] {
  return entries.filter((entry) => dispositionFor(entry.record, context).kind === 'apply');
}
