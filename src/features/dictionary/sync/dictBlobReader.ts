import type { BlobReader } from '@/features/sync';
import { idbRequest } from '@/features/sync';
import { getDB, INDEXES, STORES } from '../repositories/baseRepository';
import { partitionResourceRows, serializeResourcePortable } from './resourceIdentity';
import { gzipSync } from 'fflate';
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
  const wtx = db.transaction([STORES.ENTRY], 'readonly');
  const rows = (await idbRequest(
    wtx.objectStore(STORES.ENTRY).index(INDEXES.by_resource).getAll(resource.id),
  )) as Record<string, unknown>[];
  const { dictRows, freqRows } = partitionResourceRows(rows);
  const bytes = gzipSync(serializeResourcePortable(dictRows, freqRows), { mtime: 0 });
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/gzip' });
}
