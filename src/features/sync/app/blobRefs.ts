import type { ChangeRecord } from '../domain/types';
import { isPlainJsonObject } from '../domain/flatten';

export interface BlobReader {
  read(contentHash: string): Promise<Blob | null>;
}

const BLOB_HASH_FIELDS = ['blobHash', 'contentHash'] as const;
const BLOB_HASH_LIST_FIELDS = ['blobHashes', 'contentHashes'] as const;
const RESOURCE_KEY_RE = /^resource:([^/]+)$/;

export function referencedBlobHashes(record: ChangeRecord): string[] {
  if (record.op !== 'put') return [];
  const out = new Set<string>();
  if (record.dataClass === 'dictResource') {
    const bare = RESOURCE_KEY_RE.exec(record.key);
    if (bare) out.add(bare[1]!);
  }
  collectHashFields(record.value, out);
  return [...out];
}

function collectHashFields(value: unknown, out: Set<string>): void {
  if (!isPlainJsonObject(value)) return;
  for (const field of BLOB_HASH_FIELDS) {
    const v = value[field];
    if (typeof v === 'string' && v !== '') out.add(v);
  }
  for (const field of BLOB_HASH_LIST_FIELDS) {
    const v = value[field];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item !== '') out.add(item);
      }
    }
  }
}
