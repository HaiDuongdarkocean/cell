import { getAudioAsset as getAudioAssetById, putAudioAsset, deleteAudioAsset, getAllAudioAssets } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAsset as getImageAssetById, putImageAsset, deleteImageAsset, getAllImageAssets } from '@/features/srs/repositories/imageAssetRepository';

const BYTES_PER_MB = 1024 * 1024;

export interface AssetWithSize {
  readonly id: string;
  readonly size: number;
  readonly lastAccessed: number;
}

async function evictIfNeeded(
  listAll: () => Promise<readonly AssetWithSize[]>,
  del: (id: string) => Promise<void>,
  quotaMb: number,
  excludeIds?: Set<string>,
): Promise<void> {
  const records = (await listAll()).map((r) => ({
    id: r.id,
    size: r.size,
    lastAccessed: r.lastAccessed,
  }));
  const quotaBytes = quotaMb * BYTES_PER_MB;
  let total = records.reduce((sum, r) => sum + r.size, 0);
  if (total <= quotaBytes) return;

  const lruSorted = [...records].sort((a, b) => a.lastAccessed - b.lastAccessed);
  for (const record of lruSorted) {
    if (excludeIds?.has(record.id)) continue;
    await del(record.id);
    total -= record.size;
    if (total <= quotaBytes) break;
  }
}

async function touchAsset<T extends { lastAccessed: number }>(
  get: (id: string) => Promise<T>,
  put: (asset: T) => Promise<T>,
  id: string,
): Promise<void> {
  const record = await get(id);
  await put({ ...record, lastAccessed: Date.now() });
}

/** Find a cached asset by note + field (+ optional index), refreshing LRU. */
export async function getCachedAsset<T extends { id: string; fieldId: string; index?: number }>(
  getByNote: (noteId: string) => Promise<readonly T[]>,
  touch: (id: string) => Promise<void>,
  noteId: string,
  fieldId: string,
  index = 0,
): Promise<T | undefined> {
  const assets = await getByNote(noteId);
  const asset = assets.find((a) => a.fieldId === fieldId && (a.index ?? 0) === index);
  if (!asset) return undefined;
  await touch(asset.id);
  return asset;
}

/** Find an existing stored asset by note + field + index + extra predicate. */
export async function findExistingAsset<T extends { fieldId: string; index?: number }>(
  getByNote: (noteId: string) => Promise<readonly T[]>,
  noteId: string,
  fieldId: string,
  index: number,
  match?: (asset: T) => boolean,
): Promise<T | undefined> {
  const assets = await getByNote(noteId);
  return assets.find(
    (a) => a.fieldId === fieldId && (a.index ?? 0) === index && (match?.(a) ?? true),
  );
}

/** Write the asset and evict everything else over quota, sparing it. */
export async function persistAsset<T extends { id: string }>(
  put: (asset: T) => Promise<T>,
  evict: (excludeIds: Set<string>) => Promise<void>,
  asset: T,
): Promise<T> {
  await put(asset);
  await evict(new Set([asset.id]));
  return asset;
}

/** Return the cached asset or run the store path. */
export async function resolveOrStore<T>(
  load: () => Promise<T | undefined>,
  store: () => Promise<T | undefined>,
): Promise<T | undefined> {
  return (await load()) ?? (await store());
}

/** Evict audio assets until the cache is under the given quota (MB). */
export async function evictAudioIfNeeded(quotaMb: number, excludeIds?: Set<string>): Promise<void> {
  await evictIfNeeded(getAllAudioAssets, deleteAudioAsset, quotaMb, excludeIds);
}

/** Evict image assets until the cache is under the given quota (MB). */
export async function evictImageIfNeeded(quotaMb: number, excludeIds?: Set<string>): Promise<void> {
  await evictIfNeeded(getAllImageAssets, deleteImageAsset, quotaMb, excludeIds);
}

/** Refresh the last-accessed timestamp for an audio asset. */
export async function touchAudioAsset(id: string): Promise<void> {
  await touchAsset(getAudioAssetById, putAudioAsset, id);
}

/** Refresh the last-accessed timestamp for an image asset. */
export async function touchImageAsset(id: string): Promise<void> {
  await touchAsset(getImageAssetById, putImageAsset, id);
}
