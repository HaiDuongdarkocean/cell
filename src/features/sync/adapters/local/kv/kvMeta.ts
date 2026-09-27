import type { KeyValueStore } from '../../../ports/keyValueStore';
import type { ChangeRecord, RecordKey, RecordMeta } from '../../../domain/types';
import { SYNC_META_KV_STORAGE_KEY } from './keys';
import { kvValueHash } from './valueHash';

export type SyncMetaKV = Record<RecordKey, RecordMeta>;

function isRecordMeta(value: unknown): value is RecordMeta {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<RecordMeta>;
  return (
    typeof row.hlc === 'object' &&
    row.hlc !== null &&
    (row.op === 'put' || row.op === 'delete')
  );
}

export async function readSyncMetaKV(kv: KeyValueStore): Promise<SyncMetaKV> {
  const raw = await kv.get<Record<string, unknown>>('local', SYNC_META_KV_STORAGE_KEY);
  if (raw === undefined || raw === null || typeof raw !== 'object') return {};
  const out: SyncMetaKV = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isRecordMeta(value)) out[key] = value;
  }
  return out;
}

export async function stampKvMeta(
  kv: KeyValueStore,
  records: readonly ChangeRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const meta = await readSyncMetaKV(kv);
  for (const record of records) {
    meta[record.key] = {
      hlc: record.hlc,
      firstHlc: record.firstHlc ?? record.hlc,
      op: record.op,
      valueHash: record.op === 'put' ? await kvValueHash(record.value) : undefined,
    };
  }
  await kv.set('local', SYNC_META_KV_STORAGE_KEY, meta);
}
