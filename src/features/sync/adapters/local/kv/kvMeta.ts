import type { KeyValueStore } from '../../../ports/keyValueStore';
import type { ChangeRecord, RecordKey, RecordMeta, Scope } from '../../../domain/types';
import { SYNC_META_KV_STORAGE_KEY } from './keys';
import { kvValueHash } from './valueHash';

export interface KvRecordMeta extends RecordMeta {
  readonly suppressed?: boolean;
}

export type SyncMetaKV = Record<string, KvRecordMeta>;

export function kvMetaKey(scope: Scope, key: RecordKey): string {
  return `${scope}|${key}`;
}

export function parseKvMetaKey(metaKey: string): { scope: Scope; key: RecordKey } | null {
  const cut = metaKey.indexOf('|');
  if (cut < 0) return null;
  const rawScope = metaKey.slice(0, cut);
  const key = metaKey.slice(cut + 1);
  if (key === '') return null;
  if (rawScope === 'global') return { scope: 'global', key };
  if (rawScope.startsWith('profile:')) return { scope: rawScope as Scope, key };
  return null;
}

function isRecordMeta(value: unknown): value is KvRecordMeta {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<KvRecordMeta>;
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
  opts?: { suppressed?: boolean },
): Promise<void> {
  if (records.length === 0) return;
  const meta = await readSyncMetaKV(kv);
  for (const record of records) {
    meta[kvMetaKey(record.scope, record.key)] = {
      hlc: record.hlc,
      firstHlc: record.firstHlc ?? record.hlc,
      op: record.op,
      valueHash: record.op === 'put' ? await kvValueHash(record.value) : undefined,
      ...(opts?.suppressed === true ? { suppressed: true } : {}),
    };
  }
  await kv.set('local', SYNC_META_KV_STORAGE_KEY, meta);
}
