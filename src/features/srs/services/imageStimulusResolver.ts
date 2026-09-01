import type { SrsImageAsset } from '@/entities/srs/types';
import { getCachedImageAsset, storeImageAsset } from './imageAssetCache';

/** Create a blob URL for an image asset. Caller must revoke when done. */
export function createImageBlobUrl(asset: SrsImageAsset): string {
  const blob = new Blob([asset.bytes], { type: asset.mimeType });
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return `data:${asset.mimeType};base64,${btoa(String.fromCharCode(...new Uint8Array(asset.bytes)))}`;
}

/** Revoke a blob URL returned by `createImageBlobUrl`. */
export function revokeImageBlobUrl(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

/**
 * Resolve or cache an image data URL for a note field.
 * Rejects external image URLs; callers must convert images to data URLs first.
 */
export async function resolveImageDataUrl(
  noteId: string,
  fieldId: string,
  dataUrl: string,
): Promise<SrsImageAsset | undefined> {
  const cached = await getCachedImageAsset(noteId, fieldId);
  if (cached) return cached;
  return storeImageAsset(noteId, fieldId, dataUrl);
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
): Promise<SrsImageAsset> {
  // Store as a data URL so imageAssetCache accepts it; this avoids an external URL.
  const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return storeImageAsset(noteId, fieldId, `data:${mimeType};base64,${base64}`, mimeType);
}
