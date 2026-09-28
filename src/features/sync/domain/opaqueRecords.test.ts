import {
  dispositionFor,
  isSuppressedChildPut,
  parentRecordKeys,
  releasableOpaqueRecords,
  retainOpaqueRecord,
  splitByDisposition,
  toOpaqueEntry,
} from './opaqueRecords';
import type { ChangeRecord, Hlc } from './types';

const h = (wall: number, counter = 0, node = 'a'): Hlc => ({ wall, counter, node });

const rec = (
  key: string,
  op: 'put' | 'delete',
  wall: number,
  value?: unknown,
): ChangeRecord => ({
  scope: 'global',
  dataClass: 'settings',
  key,
  op,
  value,
  hlc: h(wall),
});

describe('opaque retention', () => {
  it('retains the full change record for republish', () => {
    const record = rec('kv:settings/future/x', 'put', 3, { next: true });
    const entry = toOpaqueEntry(record, 'unknown-key');
    expect(entry.record).toBe(record);
    expect(entry.reason).toBe('unknown-key');
    expect(entry.record.value).toEqual({ next: true });
  });

  it('keeps the winning record by hlc when superseded', () => {
    const older = rec('k', 'put', 1, 'old');
    const newer = rec('k', 'put', 5, 'new');
    const held = toOpaqueEntry(older, 'unknown-key');
    expect(retainOpaqueRecord(held, newer, 'unknown-key').record).toBe(newer);
    expect(retainOpaqueRecord(toOpaqueEntry(newer, 'unknown-key'), older, 'unknown-key').record).toBe(newer);
    expect(retainOpaqueRecord(undefined, older, 'unmaterializable').record).toBe(older);
  });
});

describe('parent tombstone suppression', () => {
  it('lists ancestor record keys', () => {
    expect(parentRecordKeys('kv:settings/a/b')).toEqual(['kv:settings/a', 'kv:settings']);
    expect(parentRecordKeys('profile/x')).toEqual(['profile']);
    expect(parentRecordKeys('profile')).toEqual([]);
  });

  it('suppresses puts whose parent is tombstoned, never deletes', () => {
    const tombstoned = (key: string) => key === 'profile';
    expect(isSuppressedChildPut(rec('profile/name', 'put', 3, 'x'), tombstoned)).toBe(true);
    expect(isSuppressedChildPut(rec('profile/name', 'delete', 3), tombstoned)).toBe(false);
    expect(isSuppressedChildPut(rec('other/name', 'put', 3, 'x'), tombstoned)).toBe(false);
    expect(isSuppressedChildPut(rec('profile', 'put', 3, 'x'), tombstoned)).toBe(false);
  });
});

describe('disposition', () => {
  const ctx = (materializable: string[], tombstoned: string[]) => ({
    canMaterialize: (record: ChangeRecord) => materializable.includes(record.key),
    isParentTombstoned: (key: string) => tombstoned.includes(key),
  });

  it('routes unmaterializable keys to opaque and known keys to apply', () => {
    expect(dispositionFor(rec('unknown', 'put', 1), ctx(['known'], [])).kind).toBe('opaque');
    expect(dispositionFor(rec('known', 'put', 1), ctx(['known'], []))).toEqual({ kind: 'apply' });
  });

  it('routes suppressed child puts to opaque with parent-tombstoned reason', () => {
    const disposition = dispositionFor(
      rec('profile/name', 'put', 3, 'x'),
      ctx(['profile/name'], ['profile']),
    );
    expect(disposition).toEqual({ kind: 'opaque', reason: 'parent-tombstoned' });
  });

  it('splits a batch into applies and opaque entries', () => {
    const records = [
      rec('a', 'put', 1, 1),
      rec('future/x', 'put', 1, 2),
      rec('parent/child', 'put', 1, 3),
    ];
    const split = splitByDisposition(records, ctx(['a', 'parent/child'], ['parent']));
    expect(split.apply.map((r) => r.key)).toEqual(['a']);
    expect(split.opaque.map((e) => [e.record.key, e.reason])).toEqual([
      ['future/x', 'unknown-key'],
      ['parent/child', 'parent-tombstoned'],
    ]);
  });

  it('releases parent-tombstoned entries once the parent exists again', () => {
    const held = toOpaqueEntry(rec('profile/name', 'put', 3, 'x'), 'parent-tombstoned');
    const stillDown = ctx(['profile/name'], ['profile']);
    expect(releasableOpaqueRecords([held], stillDown)).toEqual([]);
    const resurrected = ctx(['profile/name'], []);
    expect(releasableOpaqueRecords([held], resurrected)).toEqual([held]);
  });
});
