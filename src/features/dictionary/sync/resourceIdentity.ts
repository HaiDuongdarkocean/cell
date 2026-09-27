import { stableJson } from '@/features/sync';
import { idbRequest } from '@/features/sync';
import { INDEXES, STORES } from '../repositories/baseRepository';
import type { ResourceInfo } from '@/entities/dictionary';

const STRIPPED_FIELDS = new Set(['id', 'resourceId']);

export function serializeResourcePortable(
  dictRows: readonly Record<string, unknown>[],
  freqRows: readonly Record<string, unknown>[],
): Uint8Array {
  const lines: string[] = [];
  for (const row of dictRows) lines.push(`d${stableJson(stripRow(row))}`);
  for (const row of freqRows) lines.push(`f${stableJson(stripRow(row))}`);
  lines.sort();
  return new TextEncoder().encode(lines.join('\n'));
}

export function deserializeResourcePortable(bytes: Uint8Array): {
  dictRows: Record<string, unknown>[];
  freqRows: Record<string, unknown>[];
} {
  const dictRows: Record<string, unknown>[] = [];
  const freqRows: Record<string, unknown>[] = [];
  for (const line of new TextDecoder().decode(bytes).split('\n')) {
    if (line.length === 0) continue;
    const row = JSON.parse(line.slice(1)) as Record<string, unknown>;
    if (line[0] === 'd') dictRows.push(row);
    else if (line[0] === 'f') freqRows.push(row);
    else throw new Error('corrupt portable resource blob');
  }
  return { dictRows, freqRows };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function resourceRecordToken(resource: Pick<ResourceInfo, 'contentHash' | 'signature'>): string {
  return resource.contentHash ?? resource.signature;
}

export function resourceRecordKey(
  resource: Pick<ResourceInfo, 'contentHash' | 'signature'>,
): string {
  return `resource:${resourceRecordToken(resource)}`;
}

export async function ensureResourceContentHash(
  db: IDBDatabase,
  resource: ResourceInfo,
): Promise<ResourceInfo> {
  if (resource.contentHash) return resource;
  if (resource.id === undefined) return resource;
  const rtx = db.transaction([STORES.DICTIONARY, STORES.FREQUENCY], 'readonly');
  const dictRows = (await idbRequest(
    rtx.objectStore(STORES.DICTIONARY).index(INDEXES.by_resource).getAll(resource.id),
  )) as Record<string, unknown>[];
  const freqRows = (await idbRequest(
    rtx.objectStore(STORES.FREQUENCY).index(INDEXES.by_resource).getAll(resource.id),
  )) as Record<string, unknown>[];
  const hash = await sha256Hex(serializeResourcePortable(dictRows, freqRows));
  const wtx = db.transaction([STORES.RESOURCE], 'readwrite');
  const store = wtx.objectStore(STORES.RESOURCE);
  const fresh = (await idbRequest(store.get(resource.id))) as ResourceInfo | undefined;
  if (!fresh) return resource;
  if (fresh.contentHash) return fresh;
  const next = { ...fresh, contentHash: hash };
  await idbRequest(store.put(next));
  return next;
}

function stripRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!STRIPPED_FIELDS.has(key)) out[key] = value;
  }
  return out;
}
