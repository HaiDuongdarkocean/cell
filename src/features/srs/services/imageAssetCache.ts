import type { SrsImageAsset } from '@/entities/srs/types';
import { generateId } from '@/features/srs/lib/helpers';
import { getImageAssetsByNote, putImageAsset } from '@/features/srs/repositories/imageAssetRepository';
import { evictImageIfNeeded, touchImageAsset, getCachedAsset, findExistingAsset, persistAsset } from './quotaManager';
import { dataUrlToArrayBuffer } from '@/shared/lib/base64';

function isDataUrl(s: string): boolean {
  return s.startsWith('data:');
}

function buildAssetId(noteId: string, fieldId: string): string {
  return `img-${noteId}-${fieldId}-${generateId()}`;
}

/** Find a cached image asset for the given note and field. */
export async function getCachedImageAsset(noteId: string, fieldId: string, index = 0): Promise<SrsImageAsset | undefined> {
  return getCachedAsset(getImageAssetsByNote, touchImageAsset, noteId, fieldId, index);
}

/**
 * Decode a data-URL/base64 image and store it as a cached image asset.
 * Rejects external image URLs (privacy / CSP policy).
 */
export async function storeImageAsset(
  noteId: string,
  fieldId: string,
  dataUrl: string,
  mimeType?: string,
  index = 0,
): Promise<SrsImageAsset> {
  if (!isDataUrl(dataUrl)) {
    throw new Error('External image URLs are not accepted; provide a data URL or base64 payload');
  }

  const bytes = dataUrlToArrayBuffer(dataUrl);
  const detectedMime = mimeType ?? dataUrl.slice(5, dataUrl.indexOf(';')) ?? 'image/png';
  const existing = await findExisting(noteId, fieldId, index);
  const asset: SrsImageAsset = {
    id: existing?.id ?? buildAssetId(noteId, fieldId),
    noteId,
    fieldId,
    index: index || undefined,
    mimeType: detectedMime,
    bytes,
    size: bytes.byteLength,
    lastAccessed: Date.now(),
    createdAt: existing?.createdAt ?? Date.now(),
  };
  return persistAsset(putImageAsset, (ids) => evictImageIfNeeded(50, ids), asset);
}

async function findExisting(noteId: string, fieldId: string, index: number): Promise<SrsImageAsset | undefined> {
  return findExistingAsset(getImageAssetsByNote, noteId, fieldId, index);
}
