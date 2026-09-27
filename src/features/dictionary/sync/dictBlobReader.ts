import type { BlobReader } from '@/features/sync';
import { idbRequest } from '@/features/sync';
import { getDB, INDEXES, STORES } from '../repositories/baseRepository';
import { serializeResourcePortable } from './resourceIdentity';
import type { ResourceInfo } from '@/entities/dictionary';

export function createDictBlobReader(
  langCodes: () => Promise<readonly string[]>,
): BlobReader {
  return {
    async read(contentHash: string): Promise<Blob | null> {
      for (const langCode of await langCodes()) {
        const blob = await readResourceBlob(langCode, contentHash);
        if (blob !== null) return blob;
      }
      return null;
    },
  };
}

async function readResourceBlob(langCode: string, contentHash: string): Promise<Blob | null> {
  const db = await getDB(langCode);
  const rtx = db.transaction([STORES.RESOURCE], 'readonly');
  const resources = (await idbRequest(
    rtx.objectStore(STORES.RESOURCE).index(INDEXES.by_contentHash).getAll(contentHash),
  )) as ResourceInfo[];
  const resource = resources.find((r) => r.id !== undefined);
  if (resource === undefined) return null;
  const wtx = db.transaction([STORES.DICTIONARY, STORES.FREQUENCY], 'readonly');
  const dictRows = (await idbRequest(
    wtx.objectStore(STORES.DICTIONARY).index(INDEXES.by_resource).getAll(resource.id),
  )) as Record<string, unknown>[];
  const freqRows = (await idbRequest(
    wtx.objectStore(STORES.FREQUENCY).index(INDEXES.by_resource).getAll(resource.id),
  )) as Record<string, unknown>[];
  const bytes = serializeResourcePortable(dictRows, freqRows);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/octet-stream' });
}
