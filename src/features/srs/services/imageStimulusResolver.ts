import type { SrsImageAsset } from '@/entities/srs/types';
import { getCachedImageAsset, storeImageAsset } from './imageAssetCache';
import { resolveOrStore } from './quotaManager';
import { createBlobUrl, revokeBlobUrl } from '@/shared/lib/blobUrl';
import { bytesToDataUrl } from '@/shared/lib/base64';

/** Create a blob URL for an image asset. Caller must revoke when done. */
export function createImageBlobUrl(asset: SrsImageAsset): string {
  return createBlobUrl(asset.bytes, asset.mimeType);
}

/** Revoke a blob URL returned by `createImageBlobUrl`. */
export function revokeImageBlobUrl(url: string): void {
  revokeBlobUrl(url);
}

/**
 * Resolve or cache an image data URL for a note field.
 * Rejects external image URLs; callers must convert images to data URLs first.
 */
export async function resolveImageDataUrl(
  noteId: string,
  fieldId: string,
  dataUrl: string,
  index = 0,
): Promise<SrsImageAsset | undefined> {
  return resolveOrStore(
    () => getCachedImageAsset(noteId, fieldId, index),
    () => storeImageAsset(noteId, fieldId, dataUrl, undefined, index),
  );
}

/**
 * Store externally-provided image bytes for a note field.
 * Use when the caller already has the raw bytes and mime type.
 */
export async function cacheImageBytes(
  noteId: string,
  fieldId: string,
  bytes: ArrayBuffer,
  mimeType: string,
  index = 0,
): Promise<SrsImageAsset> {
  // Store as a data URL so imageAssetCache accepts it; this avoids an external URL.
  return storeImageAsset(noteId, fieldId, bytesToDataUrl(bytes, mimeType), mimeType, index);
}
