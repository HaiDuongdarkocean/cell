import { getAudioAsset as getAudioAssetById, putAudioAsset, deleteAudioAsset, getAllAudioAssets } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAsset as getImageAssetById, putImageAsset, deleteImageAsset, getAllImageAssets } from '@/features/srs/repositories/imageAssetRepository';

const BYTES_PER_MB = 1024 * 1024;

export interface AssetWithSize {
  readonly id: string;
  readonly size: number;
  readonly lastAccessed: number;
}

async function totalSizeOf(records: readonly AssetWithSize[]): Promise<number> {
  return records.reduce((sum, r) => sum + r.size, 0);
}

function lruSort(records: readonly AssetWithSize[]): AssetWithSize[] {
  return [...records].sort((a, b) => a.lastAccessed - b.lastAccessed);
}

/** Evict audio assets until the cache is under the given quota (MB). */
export async function evictAudioIfNeeded(quotaMb: number, excludeIds?: Set<string>): Promise<void> {
  const records = (await getAllAudioAssets()).map((r) => ({
    id: r.id,
    size: r.size,
    lastAccessed: r.lastAccessed,
  }));
  const quotaBytes = quotaMb * BYTES_PER_MB;
  let total = await totalSizeOf(records);
  if (total <= quotaBytes) return;

  for (const record of lruSort(records)) {
    if (excludeIds?.has(record.id)) continue;
    await deleteAudioAsset(record.id);
    total -= record.size;
    if (total <= quotaBytes) break;
  }
}

/** Evict image assets until the cache is under the given quota (MB). */
export async function evictImageIfNeeded(quotaMb: number, excludeIds?: Set<string>): Promise<void> {
  const records = (await getAllImageAssets()).map((r) => ({
    id: r.id,
    size: r.size,
    lastAccessed: r.lastAccessed,
  }));
  const quotaBytes = quotaMb * BYTES_PER_MB;
  let total = await totalSizeOf(records);
  if (total <= quotaBytes) return;

  for (const record of lruSort(records)) {
    if (excludeIds?.has(record.id)) continue;
    await deleteImageAsset(record.id);
    total -= record.size;
    if (total <= quotaBytes) break;
  }
}

/** Refresh the last-accessed timestamp for an audio asset. */
export async function touchAudioAsset(id: string): Promise<void> {
  const record = await getAudioAssetById(id);
  await putAudioAsset({ ...record, lastAccessed: Date.now() });
}

/** Refresh the last-accessed timestamp for an image asset. */
export async function touchImageAsset(id: string): Promise<void> {
  const record = await getImageAssetById(id);
  await putImageAsset({ ...record, lastAccessed: Date.now() });
}
